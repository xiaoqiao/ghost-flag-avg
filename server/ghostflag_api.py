#!/usr/bin/env python3
"""
幽灵旗 AVG —— 账号与云存档服务（极简版）
只用 Python 标准库；SQLite 存储；只监听本机端口，由 Apache 反向代理到 https://<域名>/ghostflag-api/。

接口（均为 JSON）：
  GET  /health                         → {"ok": true}
  POST /register  {username, password} → {token, username}
  POST /login     {username, password} → {token, username}
  POST /logout    （Authorization: Bearer <token>）
  GET  /me        → {username}
  GET  /save      → {data, updated_at, rev}（没有云存档时 data 为 null、rev 为 0）
  PUT  /save      {data, base}         → {updated_at, rev}
                  base = 客户端上次看到的 rev；云端已被别的设备更新（rev 不同）时返回 409，客户端重新拉取合并后再传

安全要点：密码用 scrypt 加盐哈希（同时最多算 2 个，防止并发请求撑爆内存）；登录令牌只存 SHA-256 摘要；
注册与登录有频率限制；请求体与存档大小有上限；CORS 只放行游戏网站，以及本地双击打开时的来源（Chrome 发 "file://"，其他浏览器多为 "null"）。
"""
import hashlib, hmac, json, os, re, secrets, sqlite3, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get('GF_HOST', '127.0.0.1')
PORT = int(os.environ.get('GF_PORT', '8765'))
DB_PATH = os.environ.get('GF_DB', '/var/lib/ghostflag-api/ghostflag.db')
ALLOWED_ORIGINS = set(filter(None, os.environ.get('GF_ORIGINS', 'https://xiaoqiao.github.io,null,file://').split(',')))
MAX_BODY = 600 * 1024          # 请求体上限
MAX_SAVE = 512 * 1024          # 单个云存档上限（字符）
MAX_USERS = int(os.environ.get('GF_MAX_USERS', '1000'))
TOKEN_DAYS = 180
USERNAME_RE = re.compile(r'^[A-Za-z0-9_一-龥]{2,16}$')

_db_lock = threading.Lock()
_kdf_sem = threading.BoundedSemaphore(2)   # scrypt 每次约占 16MB 内存，限制同时计算的个数


class Busy(Exception):
    pass


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _db_lock, db() as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE COLLATE NOCASE,
          pw_hash TEXT NOT NULL,
          pw_salt TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_login INTEGER
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS saves (
          user_id INTEGER PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          rev INTEGER NOT NULL DEFAULT 0
        );
        ''')
        # 旧库升级：补上版本号列
        if 'rev' not in [r[1] for r in c.execute('PRAGMA table_info(saves)')]:
            c.execute('ALTER TABLE saves ADD COLUMN rev INTEGER NOT NULL DEFAULT 0')


def hash_pw(password, salt):
    if not _kdf_sem.acquire(timeout=10):
        raise Busy()
    try:
        return hashlib.scrypt(password.encode('utf-8'), salt=bytes.fromhex(salt), n=2 ** 14, r=8, p=1, dklen=32).hex()
    finally:
        _kdf_sem.release()


def token_digest(token):
    return hashlib.sha256(token.encode('ascii', 'ignore')).hexdigest()


# ---------------------------------------------------------------- 频率限制（内存，按 IP）
class Limiter:
    def __init__(self):
        self.hits = {}
        self.lock = threading.Lock()

    def allow(self, key, limit, window):
        now = time.time()
        with self.lock:
            q = [t for t in self.hits.get(key, []) if now - t < window]
            if len(q) >= limit:
                self.hits[key] = q
                return False
            q.append(now)
            self.hits[key] = q
            if len(self.hits) > 20000:  # 防止无限增长
                self.hits = {k: v for k, v in self.hits.items() if v and now - v[-1] < 3600}
            return True

    def reserve(self, key, limit, window):
        """原子地“检查并占一个名额”，返回占位标记（失败时 None）；之后可用 release 退还"""
        now = time.time()
        with self.lock:
            q = [t for t in self.hits.get(key, []) if now - t < window]
            if len(q) >= limit:
                self.hits[key] = q
                return None
            q.append(now)
            self.hits[key] = q
            return now

    def release(self, key, mark):
        with self.lock:
            q = self.hits.get(key)
            if q and mark in q:
                q.remove(mark)


# 在某账号上成功登录过的 IP（内存，重启清空）：不受该账号的失败次数上限影响，攻击者无法把本人锁在门外
GOOD_IPS = {}
_good_lock = threading.Lock()


def mark_good(username, ip):
    with _good_lock:
        s = GOOD_IPS.setdefault(username.lower(), [])
        if ip in s:
            s.remove(ip)
        s.append(ip)
        del s[:-20]
        if len(GOOD_IPS) > 5000:
            GOOD_IPS.clear()


def is_good(username, ip):
    with _good_lock:
        return ip in GOOD_IPS.get(username.lower(), [])


LIMIT = Limiter()


class Handler(BaseHTTPRequestHandler):
    server_version = 'ghostflag-api'
    sys_version = ''

    # ------------------------------------------------------------ 工具
    def client_ip(self):
        # Apache 会把真实来源 IP 追加在 X-Forwarded-For 末尾；前面的部分可被客户端伪造，所以取最后一个
        fwd = self.headers.get('X-Forwarded-For', '')
        return (fwd.split(',')[-1].strip() if fwd else self.client_address[0]) or 'unknown'

    def cors(self):
        origin = self.headers.get('Origin')
        if origin and origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
            self.send_header('Access-Control-Max-Age', '86400')

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def fail(self, code, msg):
        self.reply(code, {'error': msg})

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_BODY:
            raise ValueError('请求太大')
        raw = self.rfile.read(n) if n else b'{}'
        try:
            obj = json.loads(raw.decode('utf-8') or '{}')
        except Exception:
            raise ValueError('请求格式不对')
        if not isinstance(obj, dict):
            raise ValueError('请求格式不对')
        return obj

    def auth_user(self):
        h = self.headers.get('Authorization', '')
        if not h.startswith('Bearer '):
            return None
        th = token_digest(h[7:].strip())
        now = int(time.time())
        with db() as c:
            row = c.execute('SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id '
                            'WHERE s.token_hash = ? AND s.expires_at > ?', (th, now)).fetchone()
        return row

    def new_session(self, c, user_id):
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        c.execute('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)',
                  (token_digest(token), user_id, now, now + TOKEN_DAYS * 86400))
        c.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
        return token

    def log_message(self, fmt, *args):  # 精简日志：不记录请求体
        sys.stderr.write('%s %s\n' % (self.client_ip(), fmt % args))

    # ------------------------------------------------------------ 路由
    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        try:
            path = self.path.split('?')[0]
            if path == '/health':
                return self.reply(200, {'ok': True})
            if path == '/me':
                u = self.auth_user()
                return self.reply(200, {'username': u['username']}) if u else self.fail(401, '请先登录')
            if path == '/save':
                u = self.auth_user()
                if not u:
                    return self.fail(401, '请先登录')
                with db() as c:
                    row = c.execute('SELECT data, updated_at, rev FROM saves WHERE user_id = ?', (u['id'],)).fetchone()
                if not row:
                    return self.reply(200, {'data': None, 'updated_at': None, 'rev': 0})
                return self.reply(200, {'data': row['data'], 'updated_at': row['updated_at'], 'rev': row['rev']})
            return self.fail(404, '没有这个接口')
        except Exception as e:  # noqa
            sys.stderr.write('GET error: %r\n' % e)
            return self.fail(500, '服务器出错了')

    def do_POST(self):
        try:
            path = self.path.split('?')[0]
            if path in ('/register', '/login'):
                return self.account(path[1:])
            if path == '/logout':
                h = self.headers.get('Authorization', '')
                if h.startswith('Bearer '):
                    with _db_lock, db() as c:
                        c.execute('DELETE FROM sessions WHERE token_hash = ?', (token_digest(h[7:].strip()),))
                return self.reply(200, {'ok': True})
            return self.fail(404, '没有这个接口')
        except ValueError as e:
            return self.fail(400, str(e))
        except Busy:
            return self.fail(503, '服务器忙，请稍后再试')
        except Exception as e:  # noqa
            sys.stderr.write('POST error: %r\n' % e)
            return self.fail(500, '服务器出错了')

    def do_PUT(self):
        try:
            if self.path.split('?')[0] != '/save':
                return self.fail(404, '没有这个接口')
            u = self.auth_user()
            if not u:
                return self.fail(401, '请先登录')
            if not LIMIT.allow('save:%d' % u['id'], 60, 600):
                return self.fail(429, '同步太频繁，请稍后再试')
            b = self.body()
            data, base = b.get('data'), b.get('base')
            if not isinstance(data, str) or not data.startswith('GFSAVE1-'):
                return self.fail(400, '存档格式不对')
            if len(data) > MAX_SAVE:
                return self.fail(413, '存档太大')
            if base is not None and (not isinstance(base, int) or isinstance(base, bool)):
                return self.fail(400, '请求格式不对')
            now = int(time.time())
            with _db_lock, db() as c:
                row = c.execute('SELECT rev FROM saves WHERE user_id = ?', (u['id'],)).fetchone()
                cur = row['rev'] if row else 0
                if base is not None and base != cur:
                    return self.reply(409, {'error': '云端存档刚被其他设备更新', 'rev': cur})
                c.execute('INSERT INTO saves (user_id, data, updated_at, rev) VALUES (?,?,?,?) '
                          'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev',
                          (u['id'], data, now, cur + 1))
            return self.reply(200, {'updated_at': now, 'rev': cur + 1})
        except ValueError as e:
            return self.fail(400, str(e))
        except Exception as e:  # noqa
            sys.stderr.write('PUT error: %r\n' % e)
            return self.fail(500, '服务器出错了')

    def account(self, kind):
        ip = self.client_ip()
        b = self.body()
        username = str(b.get('username') or '').strip()
        password = str(b.get('password') or '')
        if not USERNAME_RE.match(username):
            return self.fail(400, '用户名需要 2–16 位，只能用中文、字母、数字或下划线')
        if not (6 <= len(password) <= 64):
            return self.fail(400, '密码需要 6–64 位')
        if kind == 'register':
            if not LIMIT.allow('reg-try:' + ip, 60, 3600):
                return self.fail(429, '注册太频繁，请一小时后再试')
            # 先查重名和名额（不计入注册次数），同一个网络下的朋友换名字重试不会被锁
            with db() as c:
                if c.execute('SELECT 1 FROM users WHERE username = ?', (username,)).fetchone():
                    return self.fail(409, '这个用户名已经有人用了')
                if c.execute('SELECT COUNT(*) FROM users').fetchone()[0] >= MAX_USERS:
                    return self.fail(403, '注册人数已满')
            if not LIMIT.allow('reg:' + ip, 20, 3600):
                return self.fail(429, '注册太频繁，请一小时后再试')
            salt = secrets.token_hex(16)
            ph = hash_pw(password, salt)
            now = int(time.time())
            with _db_lock, db() as c:
                if c.execute('SELECT COUNT(*) FROM users').fetchone()[0] >= MAX_USERS:
                    return self.fail(403, '注册人数已满')
                try:
                    cur = c.execute('INSERT INTO users (username, pw_hash, pw_salt, created_at, last_login) VALUES (?,?,?,?,?)',
                                    (username, ph, salt, now, now))
                except sqlite3.IntegrityError:
                    return self.fail(409, '这个用户名已经有人用了')
                token = self.new_session(c, cur.lastrowid)
            mark_good(username, ip)
            return self.reply(200, {'token': token, 'username': username})
        # 登录：按 IP、按“用户名+IP”限流（只按用户名计数的话，别人可以故意输错把你锁在外面）
        if not LIMIT.allow('login:' + ip, 20, 600) or not LIMIT.allow('login-u:%s|%s' % (username.lower(), ip), 10, 600):
            return self.fail(429, '尝试次数太多，请十分钟后再试')
        # 再加一道按用户名的宽松上限（只数失败次数），防止换很多 IP 猜同一个账号的密码。
        # 先原子占位（并发请求绕不过去），密码正确再退还；本账号登录成功过的 IP 不受此限
        fail_key, mark = 'login-fail:' + username.lower(), None
        if not is_good(username, ip):
            mark = LIMIT.reserve(fail_key, 50, 600)
            if mark is None:
                return self.fail(429, '这个账号近期密码错误次数太多，已暂时锁定新设备登录，请稍后再试')
        with db() as c:
            row = c.execute('SELECT id, username, pw_hash, pw_salt FROM users WHERE username = ?', (username,)).fetchone()
        try:
            good = bool(row) and hmac.compare_digest(hash_pw(password, row['pw_salt']), row['pw_hash'])
        except Busy:
            if mark is not None:
                LIMIT.release(fail_key, mark)  # 服务器忙不算一次失败
            raise
        if not good:
            return self.fail(401, '用户名或密码不对')
        if mark is not None:
            LIMIT.release(fail_key, mark)
        mark_good(username, ip)
        with _db_lock, db() as c:
            c.execute('UPDATE users SET last_login = ? WHERE id = ?', (int(time.time()), row['id']))
            token = self.new_session(c, row['id'])
        return self.reply(200, {'token': token, 'username': row['username']})


class Server(ThreadingHTTPServer):
    request_queue_size = 128  # 默认只有 5，突发请求时会被直接拒绝
    daemon_threads = True


def main():
    init_db()
    srv = Server((HOST, PORT), Handler)
    srv.daemon_threads = True
    sys.stderr.write('ghostflag-api listening on %s:%d, db=%s\n' % (HOST, PORT, DB_PATH))
    srv.serve_forever()


if __name__ == '__main__':
    main()
