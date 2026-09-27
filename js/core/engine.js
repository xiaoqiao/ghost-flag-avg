/*
 * 幽灵旗 AVG —— 引擎核心
 * 负责：剧本解释执行、舞台渲染（背景/CG/人物/特效）、文本框与打字机、自动/快进、
 *       存读档与回档点、全局进度（已读/章节/结局/图鉴）。界面（菜单、手册、存档页等）在 ui.js。
 * 调试：index.html?jump=标签 直接从某标签开始；?autotest=1 自动推进（选第一项、推理选对、小游戏自动胜利）。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var R = GF.registry;
  var E = GF.E = {};

  /* ============================================================ 工具 */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  E.$ = $; E.h = h; E.sleep = sleep; E.esc = esc; E.clone = clone;

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('ghostflag.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ghostflag.' + k, JSON.stringify(v)); return true; } catch (e) { return false; /* 存储不可用 */ } }
  };
  E.LS = LS;

  var QS = new URLSearchParams(location.search);
  E.autotest = QS.get('autotest') === '1' || !!QS.get('break');
  E.breakAt = QS.get('break') ? [QS.get('break').split(':')[0], parseInt(QS.get('break').split(':')[1], 10) || 0] : null;
  E.autotestLog = [];
  // 自动测试的选项策略：first（默认，第一个非超时默认项）/ last / rand:种子
  (function () {
    var mode = QS.get('pick') || 'first';
    var seed = parseInt((mode.split(':')[1] || '1'), 10) || 1;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    E.autotestPick = function (op, opts) {
      var o;
      var avoid = window.__gfAvoid || [];
      if (mode === 'avoid') o = opts.filter(function (x) { return !x.isDefault && avoid.indexOf(x.target) < 0; })[0] || opts.filter(function (x) { return avoid.indexOf(x.target) < 0; })[0] || opts[0];
      else if (mode === 'last') o = opts[opts.length - 1];
      else if (mode.indexOf('rand') === 0) o = opts[Math.floor(rnd() * opts.length)];
      else o = opts.filter(function (x) { return !x.isDefault; })[0] || opts[0];
      E.autotestLog.push('CHOICE ' + op.file + ':' + op.line + ' → ' + o.text + ' => ' + o.target);
      return o;
    };
  })();

  // 自动测试：?lose=游戏id:第n次  让指定小游戏第 n 次运行时判负（测试坏结局与回档）
  (function () {
    var spec = (QS.get('lose') || '').split(':');
    var count = {};
    E.autotestGame = function (id) {
      count[id] = (count[id] || 0) + 1;
      var r = (spec[0] === id && count[id] === (parseInt(spec[1], 10) || 1) && !E.autotestLostOnce) ? 'lose' : 'win';
      if (r === 'lose') E.autotestLostOnce = true;
      E.autotestLog.push('GAME ' + id + ' → ' + r);
      return r;
    };
  })();

  /* ============================================================ 设置与全局进度 */
  var DEFAULT_SETTINGS = { textSpeed: 45, autoDelay: 1400, bgm: 0.5, sfx: 0.8, master: 1, tick: true, easy: false, artMode: 'image', skipUnread: false };
  E.settings = Object.assign({}, DEFAULT_SETTINGS, LS.get('settings', {}));
  E.saveSettings = function () { LS.set('settings', E.settings); applyVolume(); };

  var G = E.global = Object.assign({ read: {}, chapters: [], endings: [], clues: [], docs: [], persons: [] }, LS.get('global', {}));
  var gTimer = null;
  function saveGlobal() { clearTimeout(gTimer); gTimer = setTimeout(function () { LS.set('global', G); }, 400); }
  E.saveGlobal = function () { LS.set('global', G); };
  function gAdd(list, v) { if (G[list].indexOf(v) < 0) { G[list].push(v); saveGlobal(); } }
  E.gAdd = gAdd;

  /* ============================================================ 音频代理 */
  function A() { return GF.audio || null; }
  E.audio = {
    init: function () { try { A() && A().init && A().init(); applyVolume(); } catch (e) { console.warn(e); } },
    bgm: function (id) { try { A() && A().bgm && A().bgm(id); } catch (e) { console.warn(e); } },
    amb: function (id) { try { A() && A().amb && A().amb(id); } catch (e) { console.warn(e); } },
    sfx: function (id) { try { A() && A().sfx && A().sfx(id); } catch (e) { console.warn(e); } },
    heartbeat: function (b) { try { A() && A().heartbeat && A().heartbeat(b); } catch (e) { console.warn(e); } },
    tick: function () { try { if (E.settings.tick && A() && A().tick) A().tick(); } catch (e) { /* 忽略 */ } }
  };
  function applyVolume() {
    try { A() && A().setVolume && A().setVolume({ master: E.settings.master, bgm: E.settings.bgm, sfx: E.settings.sfx }); } catch (e) { /* 忽略 */ }
  }

  /* ============================================================ 状态 */
  function freshState() {
    return {
      pc: 0, flags: {}, clues: [], items: [], docs: [], notes: [], renames: {}, bios: {}, persons: [],
      stage: { bg: 'black', cg: null, chars: [], bgm: null, amb: null, fx: {}, flashback: false, date: '', phone: null, sanityShown: false },
      sanity: 100, notebookLocked: false, chapter: 'c01', mistakes: 0, backlog: [], checkpoint: null, playMs: 0
    };
  }
  E.S = freshState();
  E.token = 0;
  E.gameFails = {};

  /* ============================================================ DOM */
  var D = {};
  E.D = D;
  function buildDom() {
    D.viewport = $('#viewport');
    D.stage = $('#stage');
    D.bg = $('#layer-bg');
    D.chars = $('#layer-chars');
    D.cg = $('#layer-cg');
    D.fx = $('#layer-fx');
    D.hud = $('#hud');
    D.date = $('#hud-date');
    D.sanity = $('#hud-sanity');
    D.textbox = $('#textbox');
    D.name = $('#tb-name');
    D.text = $('#tb-text');
    D.next = $('#tb-next');
    D.choices = $('#choices');
    D.overlay = $('#overlay');
    D.toasts = $('#toasts');
    D.menus = $('#menus');
    D.torch = $('#fx-torch');
  }

  /* 舞台按窗口等比缩放。触屏设备竖着拿时，把整个舞台顺时针转 90°，始终以横屏呈现 */
  var isTouchDevice = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  E.rot = null;
  var fitSize = null; // 上次实际排版时的窗口尺寸
  function fit() {
    // 触屏上在舞台内的文本框打字时，软键盘会改变窗口尺寸：保持原样，收起键盘后再重排。
    // 真的转了屏（横竖翻转）照常重排；软键盘不会让横竖翻转
    // 窗口比上次排版时小（键盘弹出）才冻结；键盘收起、窗口恢复就正常重排
    var w = window.innerWidth, hgt = window.innerHeight, ae = document.activeElement;
    var typing = ae && D.stage.contains(ae) && !ae.readOnly &&
      (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && /^(text|password|search|email|number|tel|url)$/.test(ae.type)));
    if (isTouchDevice && E.scale && typing && (hgt > w) === !!E.rot && fitSize && (w < fitSize[0] || hgt < fitSize[1])) return;
    fitSize = [w, hgt];
    if (isTouchDevice && hgt > w) {
      var sr = Math.min(hgt / 1600, w / 900);
      var tx = (w + 900 * sr) / 2, ty = (hgt - 1600 * sr) / 2;
      D.stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(90deg) scale(' + sr + ')';
      E.rot = { s: sr, tx: tx, ty: ty };
      E.scale = sr;
      D.stage.dataset.rot = '90';
      return;
    }
    var s = Math.min(w / 1600, hgt / 900);
    D.stage.style.transform = 'translate(' + ((w - 1600 * s) / 2) + 'px,' + ((hgt - 900 * s) / 2) + 'px) scale(' + s + ')';
    E.rot = null;
    E.scale = s;
    delete D.stage.dataset.rot;
  }
  E.fit = fit;
  /** 屏幕坐标 → 舞台坐标（1600×900）。旋转模式下做逆变换 */
  E.toLocal = function (evt) {
    var t = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]) || evt;
    if (E.rot) {
      var vr = D.viewport.getBoundingClientRect();
      var cx = t.clientX - vr.left, cy = t.clientY - vr.top;
      return { x: (cy - E.rot.ty) / E.rot.s, y: (E.rot.tx - cx) / E.rot.s };
    }
    var r = D.stage.getBoundingClientRect();
    return { x: (t.clientX - r.left) * 1600 / r.width, y: (t.clientY - r.top) * 900 / r.height };
  };
  /** 尝试让系统锁定横屏（安卓全屏 / 添加到主屏幕后生效；不支持时静默忽略） */
  E.lockLandscape = function () {
    try {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
    } catch (e) { /* 忽略 */ }
  };

  /* ============================================================ 美术取用 */
  function useImages() { return E.settings.artMode !== 'svg'; }
  E.artHtml = function (kind, id, opts) {
    opts = opts || {};
    var assets = GF.assets || { bg: {}, cg: {}, char: {} };
    if (kind === 'char') {
      var key = opts.outfit ? id + '@' + opts.outfit : id;
      var a = useImages() && (assets.char[key] || (!opts.outfit && assets.char[id]));
      if (a) return '<img class="art-img char-img" draggable="false" src="' + a.src + '" alt="">';
      if (GF.art && GF.art.char) { try { return GF.art.char(id, opts); } catch (e) { console.warn(e); } }
      return '<div class="char-placeholder"></div>';
    }
    var src = assets[kind] && assets[kind][id];
    if (useImages() && src) return '<img class="art-img" draggable="false" src="' + src + '" alt="">';
    var painter = GF.art && GF.art[kind] && GF.art[kind][id];
    if (painter) { try { return painter(); } catch (e) { console.warn('art error', kind, id, e); } }
    if (src) return '<img class="art-img" draggable="false" src="' + src + '" alt="">'; // 矢量模式下缺矢量图时回退插画
    if (id === 'black') return '<div class="art-flat" style="background:#000"></div>';
    if (id === 'white') return '<div class="art-flat" style="background:#f4f1ea"></div>';
    if (E.autotest) E.autotestLog.push('MISSING-ART ' + kind + ':' + id);
    return '<div class="art-missing"><span>' + esc(kind + ':' + id) + '</span></div>';
  };
  E.hasImage = function (kind, id) { var a = GF.assets && GF.assets[kind]; return !!(a && a[id]); };

  /* ============================================================ 背景 / CG */
  // 人物随场景光照调色：暖光（油灯/台灯）、冷暗（无光/夜）
  var LIGHT = {
    lamp: ['tunnel', 'tunnel_fork', 'slab_room', 'corridor', 'tomb_gate', 'coffin_room', 'heart_anger', 'cabin', 'nado_home', 'clinic', 'zhong_home', 'duoyunxuan', 'qianlong_tomb'],
    dark: ['corridor_dark', 'basement', 'heart_fear', 'heart_despair', 'heart_madness', 'jeep_night', 'zhang_room', 'sanceng_stairs', 'police', 'airplane', 'ktm_airport', 'sealed_stairs', 'hilton_wind', 'office_window']
  };
  function lightOf(id) { return LIGHT.lamp.indexOf(id) >= 0 ? 'lamp' : LIGHT.dark.indexOf(id) >= 0 ? 'dark' : ''; }
  function setBg(id, trans) {
    E.S.stage.bg = id;
    D.stage.dataset.light = lightOf(id);
    var slot = h('div', 'bg-slot', E.artHtml('bg', id));
    var old = Array.prototype.slice.call(D.bg.children);
    var dur = { cut: 0, fade: 650, slow: 1600, dissolve: 1000, flash: 0 }[trans || 'fade'];
    if (E.skipping || E.fastRestore || E.autotest) dur = 0;
    if (trans === 'flash' && !E.skipping) flash('white');
    slot.style.transitionDuration = dur + 'ms';
    if (trans === 'dissolve') slot.classList.add('dissolve');
    if (dur > 0) slot.style.opacity = '0';
    D.bg.appendChild(slot);
    if (dur > 0) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { slot.style.opacity = '1'; slot.classList.remove('dissolve'); }); });
      setTimeout(function () { old.forEach(function (o) { o.remove(); }); }, dur + 60);
      return sleep(Math.min(dur, 500));
    }
    old.forEach(function (o) { o.remove(); });
    return Promise.resolve();
  }
  E.setBg = setBg;

  function setCg(id) {
    E.S.stage.cg = id === 'off' ? null : id;
    var old = Array.prototype.slice.call(D.cg.children);
    old.forEach(function (o) { o.classList.add('out'); setTimeout(function () { o.remove(); }, 600); });
    if (id && id !== 'off') {
      var slot = h('div', 'cg-slot', E.artHtml('cg', id));
      D.cg.appendChild(slot);
      if (!E.skipping && !E.fastRestore) { slot.style.opacity = '0'; requestAnimationFrame(function () { requestAnimationFrame(function () { slot.style.opacity = '1'; }); }); }
      gAdd('docs', id);
    }
    return E.skipping ? Promise.resolve() : sleep(300);
  }

  /* ============================================================ 人物 */
  var POS = { farleft: 13, left: 29, center: 50, right: 71, farright: 87 };
  function charEl(id) { return D.chars.querySelector('.char[data-id="' + id + '"]'); }
  function showChar(id, pos, expr, outfit) {
    var st = E.S.stage;
    var existing = null;
    st.chars.forEach(function (c) { if (c.id === id) existing = c; });
    pos = pos || (existing && existing.pos) || 'center';
    var el = charEl(id);
    var needNew = !el || (existing && (existing.outfit || '') !== (outfit || ''));
    if (existing) { existing.pos = pos; existing.outfit = outfit || ''; if (expr) existing.expr = expr; }
    else st.chars.push({ id: id, pos: pos, expr: expr || '', outfit: outfit || '' });
    var c = R.characters[id];
    var scale = c && c.sil ? c.sil.height : 1;
    if (needNew) {
      if (el) el.remove();
      el = h('div', 'char');
      el.dataset.id = id;
      var inner = h('div', 'char-inner', E.artHtml('char', id, { outfit: outfit }));
      el.appendChild(inner);
      var isImg = !!inner.querySelector('img');
      el.classList.add(isImg ? 'is-img' : 'is-svg');
      if (isImg) el.style.height = Math.round(Math.min(1.1, scale) * 800) + 'px';
      el.style.setProperty('--rim', c ? c.color : '#ccc');
      el.style.left = POS[pos] + '%';
      if (!E.skipping && !E.fastRestore) { el.classList.add('enter'); setTimeout(function () { el.classList.remove('enter'); }, 500); }
      D.chars.appendChild(el);
    } else {
      el.style.left = POS[pos] + '%';
    }
    setExpr(el, expr || (existing && existing.expr) || '');
    gPerson(id);
    layoutDim();
  }
  function setExpr(el, expr) {
    if (!el) return;
    el.className = el.className.replace(/\bexpr-\w+/g, '').trim();
    if (expr && expr !== 'normal') {
      void el.offsetWidth;
      el.classList.add('expr-' + expr);
    }
  }
  function hideChar(id) {
    var st = E.S.stage;
    if (id === 'all') {
      st.chars = [];
      Array.prototype.forEach.call(D.chars.children, function (el) { el.classList.add('leave'); setTimeout(function () { el.remove(); }, 400); });
      return;
    }
    st.chars = st.chars.filter(function (c) { return c.id !== id; });
    var el = charEl(id);
    if (el) { el.removeAttribute('data-id'); el.classList.add('leave'); setTimeout(function () { el.remove(); }, 400); }
    layoutDim();
  }
  function layoutDim(speaker) {
    var many = E.S.stage.chars.length > 1;
    Array.prototype.forEach.call(D.chars.querySelectorAll('.char[data-id]'), function (el) {
      el.classList.toggle('dim', many && !!speaker && el.dataset.id !== speaker);
      el.classList.toggle('speaking', !!speaker && el.dataset.id === speaker);
    });
  }
  function gPerson(id) {
    if (E.S.persons.indexOf(id) < 0) E.S.persons.push(id);
    gAdd('persons', id);
  }

  /* ============================================================ 特效 */
  function flash(color) {
    var f = h('div', 'flash flash-' + (color || 'white'));
    D.fx.appendChild(f);
    setTimeout(function () { f.remove(); }, 900);
  }
  E.flash = flash;
  function shake(strength) {
    D.stage.classList.remove('shake', 'shake-strong', 'shake-soft');
    void D.stage.offsetWidth;
    D.stage.classList.add(strength === 'strong' ? 'shake-strong' : strength === 'soft' ? 'shake-soft' : 'shake');
    setTimeout(function () { D.stage.classList.remove('shake', 'shake-strong', 'shake-soft'); }, 700);
  }
  E.shake = shake;
  function setFx(id, on) {
    E.S.stage.fx[id] = !!on;
    if (!on) delete E.S.stage.fx[id];
    D.stage.classList.toggle('fx-' + id, !!on);
    if (id === 'heartbeat') E.audio.heartbeat(on ? 96 : 0);
  }
  function setFlashback(on) {
    E.S.stage.flashback = !!on;
    D.stage.classList.toggle('flashback', !!on);
  }
  function setDate(text) {
    E.S.stage.date = text || '';
    D.date.innerHTML = text ? '<span>' + esc(text) + '</span>' : '';
    D.date.classList.toggle('show', !!text);
    if (text && !E.skipping && !E.fastRestore) { D.date.classList.remove('pop'); void D.date.offsetWidth; D.date.classList.add('pop'); }
  }
  function renderSanity() {
    var S = E.S;
    D.sanity.classList.toggle('show', !!S.stage.sanityShown);
    var v = Math.max(0, Math.min(100, S.sanity));
    D.sanity.style.setProperty('--v', v);
    D.sanity.classList.toggle('low', v < 35);
    var num = D.sanity.querySelector('.sn-num');
    if (num) num.textContent = Math.round(v);
  }
  E.renderSanity = renderSanity;

  /* ============================================================ 文本框 */
  var advanceResolver = null;
  var typing = null; // {finish()}
  E.skipping = false;
  E.auto = false;
  E.hideUI = false;
  E.blocked = 0; // >0 时（菜单/浮层打开）不响应推进

  function displayName(id) {
    return (E.S.renames[id]) || (R.characters[id] ? R.characters[id].name : id);
  }
  E.displayName = displayName;

  function typeText(html, plainLen) {
    // 逐字显示：把 HTML 拆成字符级 span
    return new Promise(function (resolve) {
      D.text.innerHTML = html;
      var spans = [];
      (function wrap(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            Array.from(n.textContent).forEach(function (ch) {
              var s = document.createElement('span');
              s.className = 'ch';
              s.textContent = ch;
              frag.appendChild(s);
              spans.push(s);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') wrap(n);
        });
      })(D.text);
      var speed = E.settings.textSpeed; // 字/秒，>=120 视为瞬间
      if (E.skipping || speed >= 120 || E.autotest) {
        spans.forEach(function (s) { s.classList.add('on'); });
        return resolve();
      }
      var i = 0, done = false, timer = null;
      var base = 1000 / speed;
      function step() {
        if (done) return;
        if (i >= spans.length) { done = true; typing = null; return resolve(); }
        var s = spans[i++];
        s.classList.add('on');
        var ch = s.textContent;
        if (i % 2 === 0) E.audio.tick();
        var delay = base;
        if ('，、；：'.indexOf(ch) >= 0) delay = base * 4;
        else if ('。！？!?'.indexOf(ch) >= 0) delay = base * 7;
        else if (ch === '…' || ch === '—') delay = base * 2.5;
        timer = setTimeout(step, delay);
      }
      typing = {
        finish: function () {
          if (done) return;
          done = true; clearTimeout(timer);
          spans.forEach(function (s) { s.classList.add('on'); });
          typing = null;
          resolve();
        }
      };
      step();
    });
  }

  function waitAdvance(textLen) {
    return new Promise(function (resolve) {
      var t = null;
      advanceResolver = function () { clearTimeout(t); advanceResolver = null; resolve(); };
      if (E.autotest) { t = setTimeout(advanceResolver, 0); return; }
      if (E.skipping) { t = setTimeout(advanceResolver, 35); return; }
      if (E.auto) t = setTimeout(function () { if (advanceResolver) advanceResolver(); }, E.settings.autoDelay + (textLen || 0) * 45);
    });
  }
  E.waitAdvance = waitAdvance;
  E.kickAuto = function () {
    // 自动模式切换时，若当前正在等待推进，重新安排
    if (advanceResolver && (E.auto || E.skipping)) setTimeout(function () { if (advanceResolver) advanceResolver(); }, E.skipping ? 35 : E.settings.autoDelay);
  };

  /** 用户推进（点击/空格/回车） */
  E.userAdvance = function () {
    if (E.blocked > 0) return;
    if (E.hideUI) { E.setHideUI(false); return; }
    if (E.auto) { E.setAuto(false); }
    if (typing) { typing.finish(); return; }
    if (advanceResolver) { E.audio.sfx('click'); advanceResolver(); }
  };

  function lineKey(op) { return op.file + ':' + op.line; }

  async function showLine(op, token) {
    var S = E.S;
    var who = op.t === 'say' ? op.who : null;
    var key = lineKey(op);
    var wasRead = !!G.read[key];
    if (E.skipping && !wasRead && !E.settings.skipUnread && !E.autotest) E.setSkip(false);
    D.textbox.classList.remove('hidden');
    D.textbox.classList.toggle('narration', !who);
    var phone = who && S.stage.phone === who;
    D.textbox.classList.toggle('phone', !!phone);
    if (who) {
      var c = R.characters[who];
      D.name.innerHTML = (phone ? '<i class="phone-ico">☎</i>' : '') + esc(displayName(who));
      D.name.style.setProperty('--nc', c ? c.color : '#ccc');
      D.name.classList.add('show');
      if (op.expr) {
        var el = charEl(who);
        if (el) setExpr(el, op.expr);
        S.stage.chars.forEach(function (cc) { if (cc.id === who) cc.expr = op.expr; });
      }
      gPerson(who);
    } else {
      D.name.classList.remove('show');
      D.name.innerHTML = '';
    }
    layoutDim(who);
    D.next.classList.remove('show');
    var html = GF.renderInline(op.text);
    // 回看
    S.backlog.push({ who: who, name: who ? displayName(who) : '', color: who && R.characters[who] ? R.characters[who].color : '', text: op.text });
    if (S.backlog.length > 300) S.backlog.splice(0, S.backlog.length - 300);
    await typeText(html, op.text.length);
    if (token !== E.token) return;
    D.next.classList.add('show');
    await waitAdvance(op.text.length);
    if (token !== E.token) return;
    G.read[key] = 1; saveGlobal();
  }

  /* ============================================================ 选择 */
  function showChoice(op, token) {
    var S = E.S;
    E.setSkip(false);
    if (E.auto) E.setAuto(false);
    var opts = op.options.filter(function (o) { return GF.evalCond(o.cond, S); });
    return new Promise(function (resolve) {
      D.choices.innerHTML = '';
      D.choices.classList.add('show');
      if (op.prompt) D.choices.appendChild(h('div', 'choice-prompt', esc(op.prompt)));
      var timerEl = null, raf = null, t0 = performance.now();
      var decided = false;
      function pick(o) {
        if (decided || token !== E.token) return;
        decided = true;
        cancelAnimationFrame(raf);
        E.audio.sfx('click');
        D.choices.classList.remove('show');
        D.choices.innerHTML = '';
        S.backlog.push({ who: null, name: '', text: '▶ ' + o.text, choice: true });
        resolve(o);
      }
      opts.forEach(function (o, i) {
        var b = h('button', 'choice-btn' + (o.isDefault ? ' is-default' : ''), '<span class="cn">' + (i + 1) + '</span>' + GF.renderInline(o.text));
        b.addEventListener('click', function (e) { e.stopPropagation(); pick(o); });
        D.choices.appendChild(b);
      });
      if (op.timer) {
        timerEl = h('div', 'choice-timer', '<i></i>');
        D.choices.appendChild(timerEl);
        var bar = timerEl.firstChild;
        var dur = op.timer * (E.settings.easy ? 1.6 : 1);
        (function tick() {
          var p = (performance.now() - t0) / dur;
          bar.style.transform = 'scaleX(' + Math.max(0, 1 - p) + ')';
          if (p >= 1) { var d = opts.filter(function (o) { return o.isDefault; })[0] || opts[opts.length - 1]; pick(d); return; }
          raf = requestAnimationFrame(tick);
        })();
      }
      E.choiceKeys = function (n) { if (opts[n]) pick(opts[n]); };
      if (E.autotest) setTimeout(function () { pick(E.autotestPick ? E.autotestPick(op, opts) : opts.filter(function (o) { return !o.isDefault; })[0] || opts[0]); }, 0);
    });
  }

  /* ============================================================ 线索 / 物品 / 提示 */
  function toast(html, cls) {
    var t = h('div', 'toast ' + (cls || ''), html);
    D.toasts.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 500); }, 3200);
  }
  E.toast = toast;
  function addClue(id) {
    var S = E.S;
    if (S.clues.indexOf(id) >= 0) return;
    S.clues.push(id);
    gAdd('clues', id);
    var c = R.clues[id];
    if (!E.skipping) E.audio.sfx('clue');
    if (S.notebookLocked) toast('<b>✎ 手册被偷了——先记在便签上</b>' + esc(c.title), 'clue locked');
    else toast('<b>✎ 记入工作手册</b>' + esc(c.title), 'clue');
    if (GF.UI && GF.UI.pulseNotebook) GF.UI.pulseNotebook();
  }
  function itemCmd(act, id) {
    var S = E.S;
    var i = S.items.indexOf(id);
    if (act === 'add' && i < 0) { S.items.push(id); toast('<b>获得</b>' + esc(R.items[id].name), 'item'); }
    if (act === 'remove' && i >= 0) S.items.splice(i, 1);
  }

  /* ============================================================ 存档 */
  E.snapshot = function () {
    var S = E.S;
    var snap = clone(S);
    snap.checkpoint = null;
    snap.backlog = S.backlog.slice(-60);
    return snap;
  };
  function saveMeta() {
    var S = E.S;
    var ch = R.chapters.filter(function (c) { return c.id === S.chapter; })[0];
    var last = S.backlog[S.backlog.length - 1];
    return { time: Date.now(), chapter: ch ? ch.no + ' ' + ch.title : '', date: S.stage.date, text: last ? (last.name ? last.name + '：' : '') + last.text : '', bg: S.stage.bg };
  }
  E.saveTo = function (slot) {
    if (!E.running) return false;
    var saves = LS.get('saves', {});
    var st = E.snapshot();
    st.checkpoint = E.S.checkpoint; // 回档点跟着存档走
    var meta = saveMeta(), prev = saves[slot], del = LS.get('deleted', {})[slot] || 0;
    // 时间必须晚于这个存档位以前的任何记录（可能来自时钟偏快的另一台设备），否则云同步时会被当成旧存档
    meta.time = Math.max(meta.time, del + 1, prev && prev.meta && prev.meta.time ? prev.meta.time + 1 : 0);
    saves[slot] = { meta: meta, state: st };
    LS.set('saves', saves);
    return true;
  };
  E.getSaves = function () { return LS.get('saves', {}); };
  E.loadFrom = function (slot) {
    var saves = LS.get('saves', {});
    if (!saves[slot]) return false;
    E.restore(saves[slot].state);
    return true;
  };
  E.deleteSave = function (slot) {
    var s = LS.get('saves', {}), old = s[slot];
    delete s[slot]; LS.set('saves', s);
    // 记下被删存档自己的时间（不用本机时钟，避免设备间时钟偏差）：云同步时，不比它新的同位存档不再“复活”
    if (old && old.meta && old.meta.time) {
      var d = LS.get('deleted', {}); d[slot] = Math.max(d[slot] || 0, old.meta.time); LS.set('deleted', d);
    }
  };
  E.latestSave = function () {
    var saves = LS.get('saves', {}), best = null;
    Object.keys(saves).forEach(function (k) { if (!best || saves[k].meta.time > saves[best].meta.time) best = k; });
    return best;
  };
  function autosave() { if (!E.autotest) E.saveTo('auto'); }
  E.autosave = autosave;

  /** 从状态快照恢复并继续执行 */
  E.restore = function (state) {
    E.stopRun();
    var S = E.S = clone(state);
    if (!S.backlog) S.backlog = [];
    GF.UI && GF.UI.closeAll && GF.UI.closeAll();
    E.fastRestore = true;
    // 重建舞台
    D.chars.innerHTML = ''; D.cg.innerHTML = ''; D.choices.innerHTML = ''; D.choices.classList.remove('show');
    D.overlay.innerHTML = '';
    Object.keys(R.fx).forEach(function (k) { D.stage.classList.remove('fx-' + k); });
    var st = S.stage;
    setBg(st.bg || 'black', 'cut');
    if (st.cg) setCg(st.cg);
    var chars = st.chars; st.chars = [];
    chars.forEach(function (c) { showChar(c.id, c.pos, c.expr, c.outfit); });
    Object.keys(st.fx || {}).forEach(function (k) { setFx(k, true); });
    setFlashback(st.flashback);
    setDate(st.date);
    renderSanity();
    E.audio.bgm(st.bgm || 'stop');
    E.audio.amb(st.amb || 'stop');
    E.fastRestore = false;
    D.textbox.classList.remove('hidden');
    D.name.classList.remove('show'); D.text.innerHTML = '';
    GF.UI && GF.UI.showGame && GF.UI.showGame();
    GF.UI && GF.UI.refreshHud && GF.UI.refreshHud();
    E.run();
  };

  /** 新游戏 / 从章节开始 */
  E.newGame = function (label, chapterGrant) {
    E.stopRun();
    E.S = freshState();
    var S = E.S;
    if (chapterGrant) grantForChapter(chapterGrant);
    GF.UI && GF.UI.closeAll && GF.UI.closeAll();
    D.chars.innerHTML = ''; D.cg.innerHTML = ''; D.overlay.innerHTML = '';
    Object.keys(R.fx).forEach(function (k) { D.stage.classList.remove('fx-' + k); });
    setFlashback(false); setDate(''); renderSanity();
    setBg('black', 'cut');
    D.name.classList.remove('show'); D.text.innerHTML = '';
    var pc = E.program.labels[label || R.meta.startLabel];
    S.pc = pc == null ? 0 : pc;
    GF.UI && GF.UI.showGame && GF.UI.showGame();
    GF.UI && GF.UI.refreshHud && GF.UI.refreshHud();
    E.run();
  };
  /** 章节选择：补齐之前章节应有的线索/物品/状态 */
  function grantForChapter(chId) {
    var S = E.S;
    var order = R.chapters.map(function (c) { return c.id; });
    var idx = order.indexOf(chId);
    Object.keys(R.clues).forEach(function (k) { if (order.indexOf(R.clues[k].ch) < idx) S.clues.push(k); });
    var itemsBy = { c02: ['i_press_card', 'i_notebook'], c03: ['i_drawing'], c06: ['i_camera', 'i_diary', 'i_half_flag'], c08: ['i_sutra_tape'] };
    order.slice(0, idx + 1).forEach(function (c) { (itemsBy[c] || []).forEach(function (i) { if (S.items.indexOf(i) < 0) S.items.push(i); }); });
    if (idx >= order.indexOf('c05')) { S.renames.zhangqing = '卫不回'; S.bios.zhangqing = 1; S.bios.suyicai = 1; }
    if (idx >= order.indexOf('c07') && idx <= order.indexOf('c08')) { S.stage.sanityShown = true; S.sanity = idx === order.indexOf('c07') ? 65 : 40; }
  }

  /* ============================================================ 执行 */
  E.stopRun = function () {
    E.token++;
    E.running = false;
    if (typing) typing.finish();
    advanceResolver = null;
    E.setSkip(false);
    E.setAuto(false);
  };

  E.jump = function (label) {
    var pc = E.program.labels[label];
    if (pc == null) { console.error('标签不存在：' + label); return false; }
    E.S.pc = pc;
    return true;
  };

  E.run = async function () {
    var token = ++E.token;
    E.running = true;
    var ops = E.program.ops;
    var t0 = performance.now();
    var sinceYield = 0, burst = 0;
    try {
      while (token === E.token) {
        var S = E.S;
        // 防止纯指令循环卡死页面：定期让出主线程
        if (++sinceYield >= 40) {
          sinceYield = 0;
          await sleep(0);
          if (token !== E.token) return;
        }
        if (E.autotest && ++burst > 200000) { E.autotestLog.push('LOOP-GUARD 执行指令过多，疑似死循环 @' + (ops[S.pc] && ops[S.pc].file + ':' + ops[S.pc].line)); E.autotestDone = 'loop'; return; }
        if (S.pc >= ops.length) { await GF.UI.backToTitle(); return; }
        var op = ops[S.pc];
        var before = S.pc;
        // 调试断点 ?break=ch05.js:190：自动推进到这一行后恢复正常游玩
        if (E.breakAt && op.file === E.breakAt[0] && op.line >= E.breakAt[1]) { E.autotest = false; E.breakAt = null; }
        var r = await execOp(op, token);
        if (token !== E.token) return;
        if (S.pc === before && r !== 'stay') S.pc++;
        var now = performance.now(); S.playMs += now - t0; t0 = now;
      }
    } catch (err) {
      console.error(err);
      if (E.autotest) E.autotestLog.push('EXCEPTION ' + err.message);
      if (GF.UI && GF.UI.fatal) GF.UI.fatal(err);
    }
  };

  async function execOp(op, token) {
    var S = E.S, st = S.stage;
    if (op.t === 'label') { if (E.autotest) E.autotestLog.push('LABEL ' + op.name); return; }
    if (op.t === 'say' || op.t === 'narr') return showLine(op, token);
    if (op.t === 'choice') {
      var o = await showChoice(op, token);
      if (token !== E.token) return;
      E.jump(o.target);
      return;
    }
    var a = op.args, kv = op.kv;
    switch (op.name) {
      case 'chapter': {
        S.chapter = a[0];
        gAdd('chapters', a[0]);
        setDate('');
        if (!E.autotest) await GF.UI.chapterCard(a[0], token);
        if (token !== E.token) return;
        S.pc++;
        autosave();
        return;
      }
      case 'chapterend': if (!E.skipping && !E.autotest) await GF.UI.chapterEnd(S.chapter, token); return;
      case 'bg':
        if (st.cg) setCg('off');
        await setBg(a[0], a[1]);
        return;
      case 'show': showChar(a[0], a[1], a[2], kv.outfit); if (!E.skipping) await sleep(120); return;
      case 'hide': hideChar(a[0]); return;
      case 'cg': await setCg(a[0]); return;
      case 'bgm': st.bgm = a[0] === 'stop' ? null : a[0]; E.audio.bgm(a[0]); return;
      case 'amb': st.amb = a[0] === 'stop' ? null : a[0]; E.audio.amb(a[0]); return;
      case 'sfx': if (!E.skipping) E.audio.sfx(a[0]); return;
      case 'wait': if (!E.skipping && !E.autotest) await sleep(Math.min(8000, parseInt(a[0], 10) || 0)); return;
      case 'shake': if (!E.skipping) shake(a[0]); return;
      case 'flash': if (!E.skipping) flash(a[0]); return;
      case 'fx': setFx(a[0], a[1] === 'on'); return;
      case 'flashback': setFlashback(a[0] === 'on'); return;
      case 'center': await GF.UI.centerText(op.rest, token); return;
      case 'date': setDate(op.rest); return;
      case 'doc':
        if (S.docs.indexOf(a[0]) < 0) S.docs.push(a[0]);
        gAdd('docs', a[0]);
        if (!E.autotest) await GF.UI.showDoc(a[0], token);
        return;
      case 'clue': addClue(a[0]); return;
      case 'item': itemCmd(a[0], a[1]); return;
      case 'flag': {
        var f = GF.parseFlagExpr(op.body);
        if (!f) return;
        var cur = Number(S.flags[f.name] || 0);
        if (f.op === '+=') S.flags[f.name] = cur + Number(f.value);
        else if (f.op === '-=') S.flags[f.name] = cur - Number(f.value);
        else S.flags[f.name] = f.value === true ? true : (isNaN(Number(f.value)) ? f.value : Number(f.value));
        return;
      }
      case 'if': if (GF.evalCond(op.body, S)) E.jump(op.arrow); return;
      case 'jump': E.jump(a[0]); return;
      case 'deduce': {
        E.setSkip(false); if (E.auto) E.setAuto(false);
        var miss = await GF.UI.deduce(a[0], token);
        if (token !== E.token) return;
        S.mistakes += miss || 0;
        return;
      }
      case 'game': {
        E.setSkip(false); if (E.auto) E.setAuto(false);
        var res = await runGame(a[0], kv.arg, token);
        if (token !== E.token) return;
        if (res === 'lose') {
          E.gameFails[a[0]] = (E.gameFails[a[0]] || 0) + 1;
          if (kv.lose) { E.jump(kv.lose); return; }
          return 'stay'; // 没有失败分支：重玩这个小游戏
        }
        if (kv.win) E.jump(kv.win);
        return;
      }
      case 'checkpoint': {
        var snap = E.snapshot();
        snap.pc = S.pc + 1;
        S.checkpoint = snap;
        return;
      }
      case 'ending': {
        E.setSkip(false); if (E.auto) E.setAuto(false);
        gAdd('endings', a[0]);
        E.saveGlobal();
        if (E.autotest) { E.autotestLog.push('ENDING ' + a[0]); E.autotestDone = a[0]; }
        await GF.UI.ending(a[0], token);
        return;
      }
      case 'credits': await GF.UI.credits(token); return;
      case 'notebook': S.notebookLocked = a[0] === 'lock'; GF.UI.refreshHud(); if (a[0] === 'unlock') toast('<b>工作手册</b>物归原主', 'item'); return;
      case 'sanity': {
        var v = a[0];
        if (v === 'show') st.sanityShown = true;
        else if (v === 'hide') st.sanityShown = false;
        else {
          var n = parseInt(v.slice(1), 10);
          var prev = S.sanity;
          if (v[0] === '+') S.sanity += n; else if (v[0] === '-') S.sanity -= n; else S.sanity = n;
          S.sanity = Math.max(0, Math.min(100, S.sanity));
          if (S.sanity < prev && !E.skipping) { D.sanity.classList.remove('hit'); void D.sanity.offsetWidth; D.sanity.classList.add('hit'); }
        }
        renderSanity();
        return;
      }
      case 'rename': S.renames[a[0]] = op.rest; return;
      case 'bio': S.bios[a[0]] = parseInt(a[1], 10); return;
      case 'phone': st.phone = a[0] === 'off' ? null : a[0]; return;
      case 'note': {
        S.notes.push({ date: st.date, text: op.rest });
        if (!E.autotest && !E.skipping) await GF.UI.showNote(op.rest, st.date, token);
        return;
      }
      case 'autosave': autosave(); return;
      default: console.warn('未知指令', op);
    }
  }

  async function runGame(id, arg, token) {
    D.textbox.classList.add('hidden');
    D.choices.classList.remove('show');
    E.blocked++;
    var res;
    try {
      if (E.autotest) { res = E.autotestGame ? E.autotestGame(id, arg) : 'win'; }
      else {
        res = await GF.games.run(id, { stage: D.stage, arg: arg, easy: E.settings.easy, failCount: E.gameFails[id] || 0, audio: GF.audio });
      }
    } finally {
      E.blocked--;
    }
    if (token === E.token) D.textbox.classList.remove('hidden');
    E.audio.heartbeat(E.S.stage.fx.heartbeat ? 96 : 0);
    return res;
  }

  /** 回到最近的回档点 */
  E.toCheckpoint = function () {
    var cp = E.S.checkpoint;
    if (!cp) return false;
    var keep = clone(cp);
    keep.checkpoint = clone(cp);
    E.restore(keep);
    return true;
  };

  /* ============================================================ 模式开关 */
  E.setSkip = function (on) {
    E.skipping = !!on;
    D.stage && D.stage.classList.toggle('skipping', E.skipping);
    GF.UI && GF.UI.refreshModes && GF.UI.refreshModes();
    if (on && typing) typing.finish();
    if (on) E.kickAuto();
  };
  E.setAuto = function (on) {
    E.auto = !!on;
    GF.UI && GF.UI.refreshModes && GF.UI.refreshModes();
    if (on) E.kickAuto();
  };
  E.setHideUI = function (on) {
    E.hideUI = !!on;
    D.stage.classList.toggle('ui-hidden', E.hideUI);
  };

  /* ============================================================ 启动 */
  E.boot = function () {
    buildDom();
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () { setTimeout(fit, 120); setTimeout(fit, 500); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
    if (isTouchDevice) document.addEventListener('pointerdown', E.lockLandscape, { once: true });
    if (isTouchDevice) document.addEventListener('focusout', function () { setTimeout(fit, 300); });
    E.program = GF.compile();
    if (E.program.errors.length) console.warn('剧本解析问题：', E.program.errors);
    applyVolume();
    GF.UI.init();
    var jump = QS.get('jump');
    if (jump && E.program.labels[jump] != null) {
      var chId = 'c' + (jump.match(/^c(\d\d)/) || [0, '01'])[1];
      E.newGame(jump, chId);
    } else if (E.autotest) {
      E.newGame(R.meta.startLabel);
    } else {
      GF.UI.title();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
