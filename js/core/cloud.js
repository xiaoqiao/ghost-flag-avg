/*
 * 幽灵旗 AVG —— 账号与云存档（极简）
 * 后端：https://corpus.zisu.edu.cn/ghostflag-api（见 server/ghostflag_api.py）。
 * 同步 = 拉取云端 → 与本机合并（同一存档位保留较新的，已读/图鉴取并集，删除记录生效）→ 带版本号上传；
 *        云端在此期间被别的设备更新过（409）就重新拉取合并。云端存档读不出来时只报错，绝不覆盖。
 * 触发：存档/删档后、回到标题、启动时、页面重新显示时；页面隐藏时尝试带版本号快速上传一次。
 * 连不上时游戏照常，进度仍在本机。存档数据沿用存档码格式（GF.saveCode）。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var E = GF.E, UI = GF.UI;
  var esc = E.esc;
  // 测试时可以用 window.GF_CLOUD_API 指向本地起的服务
  var API = (typeof root.GF_CLOUD_API === 'string' && root.GF_CLOUD_API) || 'https://corpus.zisu.edu.cn/ghostflag-api';
  var KEY = 'account', OWNER = 'owner';
  var NAME_RE = /^[A-Za-z0-9_一-龥]{2,16}$/;
  var STALE = { stale: true }; // 同步途中账号变了：静默放弃

  var C = GF.cloud = {
    status: 'idle',       // idle | syncing | ok | error
    lastSync: 0,
    lastError: '',
    rev: null,            // 本页面最近一次看到的云端版本号
    pollMs: 120000,       // 页面显示时的定时拉取间隔
    account: E.LS.get(KEY, null)   // {username, token}
  };

  function saveAccount(a) { C.account = a; E.LS.set(KEY, a); refreshBadge(); }

  function req(method, path, body, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 12000) : null;
    var headers = { 'Content-Type': 'application/json' };
    var tok = opts.token !== undefined ? opts.token : (C.account && C.account.token);
    if (tok) headers.Authorization = 'Bearer ' + tok;
    return fetch(API + path, {
      method: method, headers: headers, body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined, keepalive: !!opts.keepalive, mode: 'cors', credentials: 'omit'
    }).then(function (r) {
      return r.text().then(function (t) {
        if (timer) clearTimeout(timer);
        var j = null;
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = null; }
        if (!r.ok) { var err = new Error((j && j.error) || ('服务器返回 ' + r.status)); err.status = r.status; err.body = j; throw err; }
        if (!j) throw new Error('服务器响应不完整');
        return j;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? '连接超时' : '连不上云存档服务器');
    });
  }

  /* ------------------------------------------------------------ 同步 */
  var syncing = null, pending = false, dirty = false, gen = 0, timer = null, due = 0, inMerge = false, lastTry = 0;
  var cache = null, cacheTimer = null; // 预先编码好的存档：页面隐藏时要同步发出请求，来不及临时压缩
  function markDirty() {
    dirty = true; gen++; cache = null;
    clearTimeout(cacheTimer); cacheTimer = setTimeout(buildCache, 800);
  }
  function buildCache() {
    if (!C.account) return;
    var g1 = gen, packed = GF.saveCode.pack();
    delete packed.time;
    GF.saveCode.encode(packed).then(function (code) { if (gen === g1) cache = { code: code, gen: g1 }; }, function () {});
  }

  C.sync = function (manual) {
    if (!C.account) return Promise.resolve(false);
    if (syncing) { pending = true; return syncing; }
    clearTimeout(timer); timer = null;
    lastTry = Date.now();
    var acct = C.account, changedLocal = 0, tries = 0, g0 = gen, replaced = [];
    C.status = 'syncing'; refreshBadge(); refreshPanel();
    function alive() { if (C.account !== acct) throw STALE; }
    function round() {
      return req('GET', '/save', null, { token: acct.token }).then(function (r) {
        alive();
        var base = typeof r.rev === 'number' ? r.rev : 0;
        var got = r.data ? GF.saveCode.decode(r.data).then(null, function (e) { throw new Error('云端存档无法读取：' + e.message); })
                         : Promise.resolve(null);
        var cloudCanon = null;
        return got.then(function (obj) {
          alive();
          if (obj) {
            cloudCanon = GF.saveCode.canon(obj); // 合并会改动 obj，先取指纹
            inMerge = true;
            try { changedLocal += GF.saveCode.merge(obj, { tombstones: true, replaced: replaced }); } finally { inMerge = false; }
            // 本机存档已被替换：立刻记下（即使稍后上传失败，也要提示并保护它）
            if (E.running && !E.autotest) noteNewer(replaced);
          }
          g0 = gen;
          var packed = GF.saveCode.pack();
          if (cloudCanon !== null && GF.saveCode.canon(packed) === cloudCanon) return null;
          delete packed.time;
          return GF.saveCode.encode(packed);
        }).then(function (code) {
          alive();
          if (code === null) return { rev: base }; // 云端内容已是最新：不重传，版本号不涨，减少多设备冲突
          return req('PUT', '/save', { data: code, base: base }, { token: acct.token });
        }).then(function (res) { alive(); C.rev = res.rev; }, function (e) {
          if (e.status === 409 && ++tries < 3) return round(); // 别的设备刚传过：重新拉取合并
          throw e;
        });
      });
    }
    syncing = round().then(function () {
      if (gen === g0) dirty = false;
      C.status = 'ok'; C.lastSync = Date.now(); C.lastError = '';
      E.LS.set(OWNER, acct.username); // 记下本机进度属于哪个账号
      if (manual) E.toast('<b>云存档</b>已同步' + (changedLocal ? '，从云端更新了 ' + changedLocal + ' 个存档位' : ''), 'item');
      refreshContinue();
      return true;
    }).catch(function (e) {
      if (e === STALE) return false;
      C.status = 'error'; C.lastError = e.message;
      if (e.status === 401) {
        saveAccount(null); C.rev = null;
        E.toast('<b>云存档</b>登录已失效，请重新登录', 'item');
        if (panelEl && panelEl.isConnected && panelEl.dataset.mode === 'in') UI.account(); // 面板换成登录表单
      }
      else if (manual) E.toast('<b>云存档</b>' + esc(e.message) + '（进度已保存在本机）', 'item');
      return false;
    }).then(function (ok) {
      syncing = null; refreshBadge(); refreshPanel();
      if (pending) { pending = false; C.schedule(1000); }
      return ok;
    });
    return syncing;
  };

  // 标题画面的“继续游戏”按本机存档增删（不重绘标题，不关面板）
  function refreshContinue() {
    var m = document.querySelector('#title-screen:not(.gone) .ts-menu');
    if (!m) return;
    var b = m.querySelector('[data-a=continue]'), has = !!E.latestSave();
    if (has && !b) m.insertAdjacentHTML('afterbegin', '<button data-a="continue">继续游戏</button>');
    else if (!has && b) b.remove();
  }
  // 正在游玩时从云端取回了比当前进度更新的存档（别的设备存的）：问玩家要不要读取，免得旧进度的自动存档把它覆盖。
  // runBase = 当前进度的时间：读档时取那份存档的时间，新开局或本机存档时取当前时间
  var runBase = Date.now();
  var origLoad = E.loadFrom, origNew = E.newGame;
  E.loadFrom = function (slot) {
    var sv = E.getSaves()[slot];
    runBase = sv && sv.meta && sv.meta.time ? sv.meta.time : Date.now();
    loadWhenCalm = null; // 玩家自己读了档：之前答应的“读取”作废
    return origLoad.apply(this, arguments);
  };
  E.newGame = function () { runBase = Date.now(); loadWhenCalm = null; return origNew.apply(this, arguments); };
  // 记下待提示的存档位；等到普通对话状态（没有推理、卡片、结局、小游戏、菜单）再问，读档才安全
  var offerKey = null, offering = false, loadWhenCalm = null;
  function noteNewer(keys) {
    var saves = E.getSaves(), best = offerKey && saves[offerKey] ? offerKey : null;
    keys.forEach(function (k) {
      var sv = saves[k];
      if (sv && sv.meta && sv.meta.time > runBase && (!best || sv.meta.time > saves[best].meta.time)) best = k;
    });
    offerKey = best;
  }
  function calm() {
    return E.running && !E.autotest && E.blocked === 0 && !(E.D.choices && E.D.choices.classList.contains('show')) &&
      !document.querySelector('.gf-game-root, .deduce, .ending-card, .overlay-card, #menus .panel.show, .ac-sheet');
  }
  function showOffer() {
    var k = offerKey, sv = E.getSaves()[k];
    if (!sv || !sv.meta || sv.meta.time <= runBase) { offerKey = null; return; }
    offering = true;
    E.setAuto(false); E.setSkip(false);
    var m = sv.meta;
    UI.confirm('另一台设备上有更新的进度：<br>' + esc(m.chapter || '') + (m.text ? '<br>「' + esc(String(m.text).slice(0, 40)) + '」' : '') +
      '<br>要读取它吗？（继续当前进度的话，之后的自动存档会覆盖它）', '读取', '继续当前').then(function (ok) {
      offering = false; offerKey = null; runBase = Date.now(); // 同一份进度只问一次
      if (ok) { if (calm()) E.loadFrom(k); else loadWhenCalm = k; }
    });
  }
  // 每秒：该问的时候问；页面显示着就每两分钟拉取一次（长时间开着的页面也能发现别处的新进度）
  setInterval(function () {
    if (loadWhenCalm && calm()) { var k = loadWhenCalm; loadWhenCalm = null; E.loadFrom(k); }
    if (!E.running) loadWhenCalm = null;
    if (offerKey && !offering) {
      if (!E.running) offerKey = null; // 已回到标题：“继续游戏”会用最新的存档
      else if (calm()) showOffer();
    }
    if (C.account && document.visibilityState === 'visible' && !syncing && !timer && Date.now() - lastTry > C.pollMs) C.sync(false);
  }, 1000);

  // 预约一次同步；已有更早的预约就沿用，连续存档不会一直往后推
  C.schedule = function (ms) {
    if (!C.account) return;
    var at = Date.now() + (ms == null ? 4000 : ms);
    if (timer && due <= at) return;
    clearTimeout(timer); due = at;
    timer = setTimeout(function () { timer = null; C.sync(false); }, Math.max(0, at - Date.now()));
  };

  // “清除全部数据”前调用：停掉一切同步
  C.reset = function () {
    clearTimeout(timer); timer = null;
    dirty = false; pending = false;
    C.account = null; C.rev = null; C.status = 'idle';
  };

  // 存档、删档后自动同步；结局等全局进度写入时记为有改动
  var origSaveTo = E.saveTo;
  E.saveTo = function (slot) {
    // 正等着问玩家要不要读取别处更新的自动存档：先别用旧进度覆盖它
    if (slot === 'auto' && (offerKey === 'auto' || loadWhenCalm === 'auto') && E.running) return false;
    var r = origSaveTo.apply(this, arguments);
    if (r && !offerKey && !loadWhenCalm) runBase = Date.now(); // 提示待定时不推进，免得把提示作废
    if (r && C.account) { markDirty(); C.schedule(); }
    return r;
  };
  var origDelete = E.deleteSave;
  E.deleteSave = function () {
    var r = origDelete.apply(this, arguments);
    if (C.account) { markDirty(); C.schedule(); }
    return r;
  };
  var origSaveGlobal = E.saveGlobal;
  E.saveGlobal = function () {
    var r = origSaveGlobal.apply(this, arguments);
    if (C.account && !inMerge) markDirty();
    return r;
  };
  // 回到标题时同步一次（结局、图鉴等全局进度）
  var origTitle = UI.title;
  UI.title = function () {
    var r = origTitle.apply(this, arguments);
    injectTitleBadge();
    if (C.account) C.schedule(500);
    return r;
  };
  document.addEventListener('visibilitychange', function () {
    if (!C.account) return;
    if (document.visibilityState === 'visible') {
      // 切回来时先拉一次，免得在旧进度上继续玩
      if (!syncing && Date.now() - C.lastSync > 60000) C.schedule(300);
      return;
    }
    // 页面隐藏：带版本号快速上传；云端已被别处更新就放弃（409），下次打开时再合并
    // （请求必须当场发出：页面关闭时来不及再压缩，所以用预先编码好的 cache）
    if (!dirty || syncing || C.rev == null || !cache || cache.gen !== gen || cache.code.length > 60000) return;
    var acct = C.account, base = C.rev, g0 = gen;
    req('PUT', '/save', { data: cache.code, base: base }, { keepalive: true, token: acct.token }).then(function (res) {
      if (C.account === acct && C.rev === base) { C.rev = res.rev; if (gen === g0) dirty = false; }
    }, function () { /* 忽略 */ });
  });

  /* ------------------------------------------------------------ 界面 */
  function badgeText() {
    if (!C.account) return '☁ 登录 / 注册';
    var s = { idle: '', syncing: ' · 同步中…', ok: ' · 已同步', error: ' · 未连接' }[C.status] || '';
    return '☁ ' + esc(C.account.username) + s;
  }
  function refreshBadge() {
    var b = document.getElementById('cloud-badge');
    if (b) { b.innerHTML = badgeText(); b.classList.toggle('err', !!C.account && C.status === 'error'); }
  }
  function injectTitleBadge() {
    var t = document.getElementById('title-screen');
    if (!t || document.getElementById('cloud-badge')) return;
    var b = E.h('button', '', badgeText());
    b.id = 'cloud-badge';
    b.addEventListener('click', function (e) { e.stopPropagation(); E.audio.init(); UI.account(); });
    t.appendChild(b);
    refreshBadge();
  }

  var panelEl = null;
  function fmtTime(ms) { if (!ms) return '—'; var d = new Date(ms); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function refreshPanel() {
    if (!panelEl || !panelEl.isConnected || panelEl.dataset.mode !== 'in') return;
    var st = panelEl.querySelector('.ac-status');
    if (st) st.innerHTML = C.status === 'syncing' ? '正在同步……' : C.status === 'error' ? '<span class="no">' + esc(C.lastError || '同步失败') + '</span>（进度已保存在本机）' : C.lastSync ? '上次同步：' + fmtTime(C.lastSync) : '';
  }

  // 手机上的登录表单放在舞台外、按系统方向显示：不跟着舞台旋转缩小，弹出键盘也不影响
  function sheet(title, html) {
    var w = E.h('div', 'ac-sheet', '<div class="ac-card"><div class="ac-head"><h2>' + title + '</h2><button class="ac-x" aria-label="关闭">✕</button></div>' + html + '</div>');
    document.body.appendChild(w);
    E.blocked++;
    var closed = false;
    w.close = function () {
      if (closed) return;
      closed = true;
      E.blocked = Math.max(0, E.blocked - 1);
      var ae = document.activeElement;
      if (ae && w.contains(ae) && ae.blur) ae.blur();
      w.remove();
      setTimeout(E.fit, 300);
    };
    w.querySelector('.ac-x').addEventListener('click', w.close);
    w.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === w) w.close(); });
    w.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') w.close(); });
    ['pointerdown', 'contextmenu', 'wheel'].forEach(function (ev) { w.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    return w;
  }

  function hasLocal() {
    var G = E.global;
    return Object.keys(E.getSaves()).length > 0 || G.endings.length > 0 || G.chapters.length > 0 || Object.keys(G.read).length > 0;
  }
  function clearLocalProgress() {
    E.LS.set('saves', {}); E.LS.set('deleted', {});
    var G = E.global;
    G.read = {};
    ['chapters', 'endings', 'clues', 'docs', 'persons'].forEach(function (k) { G[k] = []; });
    E.saveGlobal();
  }

  var LOGIN_HTML =
    '<p class="ac-tip">注册一个账号，游戏进度就能保存在云端，在电脑和手机之间接着玩。账号只用来保存游戏进度。</p>' +
    '<form class="ac-form" autocomplete="on" onsubmit="return false">' +
    '<label>用户名<input class="ac-user" name="username" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="16" placeholder="2–16 位，中文、字母、数字或下划线"></label>' +
    '<label>密　码<input class="ac-pass" name="password" type="password" autocomplete="current-password" maxlength="64" placeholder="至少 6 位"></label>' +
    '</form>' +
    '<div class="btn-row"><button class="btn ac-login">登录</button><button class="btn ac-reg">注册新账号</button></div>' +
    '<div class="ac-status"></div><div class="ac-extra"></div>' +
    '<p class="sc-note">本机已有的进度会在登录后自动合并上传，不会丢失。</p>';

  function bindLogin(p, close) {
    var u = p.querySelector('.ac-user'), pw = p.querySelector('.ac-pass');
    var st = p.querySelector('.ac-status'), extra = p.querySelector('.ac-extra'), busy = false;
    function say(html) { st.innerHTML = html; }
    function go(kind) {
      if (busy) return;
      var name = u.value.trim(), pass = pw.value;
      if (!name || !pass) return say('<span class="no">请输入用户名和密码</span>');
      if (!NAME_RE.test(name)) return say('<span class="no">用户名需要 2–16 位，只能用中文、字母、数字或下划线</span>');
      if (pass.length < 6 || pass.length > 64) return say('<span class="no">密码需要 6–64 位</span>');
      // 本机进度属于另一个账号：先让玩家选，再发请求（不悄悄合并，也不先注册再说）
      var owner = E.LS.get(OWNER, null);
      if (owner && String(owner).toLowerCase() !== name.toLowerCase() && hasLocal()) return askSwitch(owner, name, pass, kind);
      send(kind, name, pass, 'keep');
    }
    function send(kind, name, pass, mode) {
      busy = true; extra.innerHTML = '';
      say(kind === 'register' ? '正在注册……' : '正在登录……');
      req('POST', '/' + kind, { username: name, password: pass }, { token: null }).then(function (r) {
        finish({ username: r.username, token: r.token }, kind, mode);
      }, function (e) { say('<span class="no">' + esc(e.message) + '</span>'); }).then(function () { busy = false; });
    }
    function askSwitch(owner, name, pass, kind) {
      say('');
      var verb = kind === 'register' ? '注册并登录' : '登录';
      extra.innerHTML = '<div class="ac-switch">这台设备上的进度来自账号「' + esc(owner) + '」。' + verb + '「' + esc(name) + '」后：' +
        '<div class="btn-row"><button class="btn ac-use">用「' + esc(name) + '」的云端进度</button>' +
        '<button class="btn ac-mix">两边合并</button><button class="btn ac-cancel">取消</button></div>' +
        '<p class="sc-note">用云端进度：本机存档换成「' + esc(name) + '」的（「' + esc(owner) + '」已同步到云端的进度不受影响，重新登录它即可取回）。两边合并：本机进度也会存进「' + esc(name) + '」。</p></div>';
      extra.querySelector('.ac-use').addEventListener('click', function () { send(kind, name, pass, 'replace'); });
      extra.querySelector('.ac-mix').addEventListener('click', function () { send(kind, name, pass, 'merge'); });
      extra.querySelector('.ac-cancel').addEventListener('click', function () { extra.innerHTML = ''; say('已取消'); });
    }
    function finish(acct, kind, mode) {
      var owner = E.LS.get(OWNER, null);
      if (mode === 'replace') clearLocalProgress();
      // 本机的删除记录只对原账号有意义：换了账号（或本机从未同步过）就丢掉，免得误删新账号的存档
      else if (!owner || String(owner).toLowerCase() !== acct.username.toLowerCase()) E.LS.set('deleted', {});
      C.rev = null; C.status = 'idle';
      saveAccount(acct);
      E.toast('<b>云存档</b>' + (kind === 'register' ? '注册成功，' : '登录成功，') + '欢迎你，' + esc(acct.username), 'item');
      close();
      if (mode === 'replace') UI.title(); // 本机进度已清空：回到（刷新）标题
      C.sync(true);
    }
    p.querySelector('.ac-login').addEventListener('click', function () { go('login'); });
    p.querySelector('.ac-reg').addEventListener('click', function () { go('register'); });
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go('login'); });
  }

  function logout(p) {
    var acct = C.account;
    if (!acct) { UI.closePanel(p); return; }
    var st = p.querySelector('.ac-status');
    // 退出前把最近的改动推上去（同步途中又有新改动就再同步，最多 3 次）
    function flush(n) { return C.sync(false).then(function (ok) { return ok && (dirty || pending) && n < 3 ? flush(n + 1) : ok; }); }
    var before = (dirty || syncing) ? (st.textContent = '正在同步最近的进度……', flush(0)) : Promise.resolve(true);
    before.then(function (ok) {
      if (C.account !== acct) { if (p.isConnected) UI.closePanel(p); return; }
      clearTimeout(timer); timer = null;
      dirty = false; pending = false; C.rev = null;
      C.status = 'idle';
      saveAccount(null);
      req('POST', '/logout', null, { token: acct.token }).catch(function () {});
      UI.closePanel(p);
      E.toast('<b>云存档</b>已退出登录' + (ok ? '（本机进度仍保留）' : '；最近的进度没能同步到云端，仍保存在本机'), 'item');
    });
  }

  UI.account = function () {
    if (panelEl && panelEl.isConnected) { if (panelEl.close) panelEl.close(); else UI.closePanel(panelEl); }
    panelEl = null;
    if (E.running) { E.setAuto(false); E.setSkip(false); }
    var p;
    if (C.account) {
      p = panelEl = UI.panel('account', '账号与云存档',
        '<div class="ac-who">当前账号：<b>' + esc(C.account.username) + '</b></div>' +
        '<p class="ac-tip">存档会自动同步到云端。换一台设备（比如手机）登录同一个账号，进度就接上了。</p>' +
        '<div class="ac-status"></div>' +
        '<div class="btn-row"><button class="btn ac-sync">立即同步</button><button class="btn ac-out">退出登录</button></div>');
      p.dataset.mode = 'in';
      refreshPanel();
      p.querySelector('.ac-sync').addEventListener('click', function () { C.sync(true); refreshPanel(); });
      p.querySelector('.ac-out').addEventListener('click', function () { logout(p); });
      return;
    }
    var touch = E.D && E.D.stage && E.D.stage.classList.contains('touch');
    if (touch) {
      p = panelEl = sheet('账号与云存档', LOGIN_HTML);
      bindLogin(p, p.close);
    } else {
      p = panelEl = UI.panel('account', '账号与云存档', LOGIN_HTML);
      bindLogin(p, function () { UI.closePanel(p); });
      setTimeout(function () { var u = p.querySelector('.ac-user'); if (u && p.isConnected) u.focus(); }, 300);
    }
    p.dataset.mode = 'out';
  };

  // 设置面板、手机菜单里加入口
  var origSettings = UI.settings;
  UI.settings = function () {
    var r = origSettings.apply(this, arguments);
    var all = document.querySelectorAll('.panel.settings'), sp = all[all.length - 1]; // 刚关的旧面板可能还在淡出
    var row = sp && sp.querySelector('.btn-row');
    if (row && !row.querySelector('.ac-open')) {
      var b = E.h('button', 'btn ac-open', '云存档');
      b.addEventListener('click', function () { UI.closePanel(sp); UI.account(); });
      row.insertBefore(b, row.firstChild);
    }
    return r;
  };
  var origTouch = UI.touchMenu;
  if (origTouch) {
    UI.touchMenu = function () {
      var r = origTouch.apply(this, arguments);
      var all = document.querySelectorAll('.panel.touchmenu'), tp = all[all.length - 1];
      var grid = tp && tp.querySelector('.tm-grid');
      if (grid && !grid.querySelector('[data-a=cloud]')) {
        var b = E.h('button', '', '云存档'); b.dataset.a = 'cloud';
        b.addEventListener('click', function (e) { e.stopPropagation(); UI.closePanel(tp); UI.account(); });
        grid.appendChild(b);
      }
      return r;
    };
  }

  // 启动：若已登录，稍后静默同步一次（把其他设备的进度拉过来）
  injectTitleBadge();
  if (C.account) C.schedule(1500);
})(typeof window !== 'undefined' ? window : globalThis);
