/*
 * 幽灵旗 AVG —— 界面层
 * 标题画面、快捷菜单、工作手册（线索/人物/物证/物品/日志）、存读档、设置、回看、
 * 章节卡、居中字幕、文档浮层、手册日志浮层、推理面板、结局卡、制作名单、图鉴、输入处理。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var R = GF.registry;
  var E = GF.E;
  var UI = GF.UI = {};
  var $ = E.$, h = E.h, esc = E.esc, sleep = E.sleep;

  var stack = []; // 打开的菜单面板
  function D() { return E.D; }

  /* ============================================================ 通用面板 */
  function panel(cls, title, bodyHtml, opts) {
    opts = opts || {};
    var p = h('div', 'panel ' + cls);
    p.innerHTML = '<div class="panel-head"><h2>' + title + '</h2><button class="panel-x" title="关闭 (Esc)">✕</button></div><div class="panel-body">' + (bodyHtml || '') + '</div>';
    D().menus.appendChild(p);
    stack.push(p);
    E.blocked++;
    requestAnimationFrame(function () { p.classList.add('show'); });
    p.querySelector('.panel-x').addEventListener('click', function (e) { e.stopPropagation(); closePanel(p); });
    p.addEventListener('click', function (e) { e.stopPropagation(); });
    p._onClose = opts.onClose;
    E.audio.sfx('page');
    return p;
  }
  function closePanel(p) {
    var i = stack.indexOf(p);
    if (i < 0) return;
    stack.splice(i, 1);
    E.blocked = Math.max(0, E.blocked - 1);
    p.classList.remove('show');
    setTimeout(function () { p.remove(); }, 250);
    if (p._onClose) p._onClose();
  }
  UI.panel = panel;
  UI.closePanel = closePanel;
  UI.closeTop = function () { if (stack.length) { closePanel(stack[stack.length - 1]); return true; } return false; };
  UI.closeAll = function () { while (stack.length) closePanel(stack[stack.length - 1]); };

  function confirmBox(msg, okText, cancelText) {
    return new Promise(function (resolve) {
      var p = panel('confirm', '确认', '<p class="confirm-msg">' + msg + '</p><div class="btn-row"><button class="btn ok">' + (okText || '确定') + '</button><button class="btn cancel">' + (cancelText || '取消') + '</button></div>', { onClose: function () { resolve(false); } });
      p.querySelector('.ok').addEventListener('click', function () { p._onClose = null; closePanel(p); resolve(true); });
      p.querySelector('.cancel').addEventListener('click', function () { closePanel(p); });
    });
  }
  UI.confirm = confirmBox;

  /* ============================================================ 初始化与输入 */
  UI.init = function () {
    var d = D();
    // 快捷菜单
    var qm = $('#quickmenu');
    var btns = [
      ['auto', '自动'], ['skip', '快进'], ['log', '回看'], ['notebook', '手册'],
      ['save', '存档'], ['load', '读档'], ['qsave', '快存'], ['qload', '快读'], ['settings', '设置'], ['title', '标题']
    ];
    btns.forEach(function (b) {
      var el = h('button', 'qm-btn qm-' + b[0], b[1]);
      el.dataset.act = b[0];
      el.addEventListener('click', function (e) { e.stopPropagation(); UI.action(b[0]); });
      qm.appendChild(el);
    });
    // 触屏设备：用一个大“菜单”按钮代替底部那排小按钮
    // 只看“主要输入设备是否为手指”，带触摸屏的笔记本（主要用鼠标）仍保持电脑版界面
    var isTouch = window.matchMedia ? matchMedia('(pointer: coarse)').matches : ('ontouchstart' in window);
    if (isTouch) {
      d.stage.classList.add('touch');
      var mb = h('button', '', '☰');
      mb.id = 'touch-menu-btn';
      mb.setAttribute('aria-label', '菜单');
      mb.addEventListener('click', function (e) { e.stopPropagation(); UI.touchMenu(); });
      d.stage.appendChild(mb);
    }
    // 竖屏提示（仅手机竖屏时由 CSS 显示），可选择仍然继续
    var rh = h('div', '', '<div class="rh-box"><div class="rh-phone"></div><p>请把手机横过来游玩</p><small>横屏时画面和文字会大很多</small><button>仍然竖屏继续</button></div>');
    rh.id = 'rotate-hint';
    rh.querySelector('button').addEventListener('click', function () { rh.classList.add('dismissed'); });
    d.viewport.appendChild(rh);
    // 心神指示
    d.sanity.innerHTML = '<div class="sn-label">心神</div><svg class="sn-ecg" viewBox="0 0 200 40" preserveAspectRatio="none"><path d="M0 20 L60 20 L70 8 L80 32 L90 4 L100 36 L110 20 L200 20"/></svg><div class="sn-bar"><i></i></div><div class="sn-num">100</div>';
    // 舞台点击推进
    d.stage.addEventListener('click', function (e) {
      E.audio.init();
      if (e.target.closest('.panel,#quickmenu,.choice-btn,.gf-game-root,#title-screen,.overlay-card,.deduce,.ending-card')) return;
      E.userAdvance();
    });
    d.stage.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (UI.closeTop()) return;
      if (E.running && !E.blocked) E.setHideUI(!E.hideUI);
    });
    d.stage.addEventListener('wheel', function (e) {
      if (E.blocked || !E.running) return;
      if (e.deltaY < -20) UI.action('log');
      else if (e.deltaY > 20) E.userAdvance();
    }, { passive: true });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', function (e) { if (e.key === 'Control' && E.skipping && E.ctrlSkip) { E.ctrlSkip = false; E.setSkip(false); } });
    // 手电特效跟随指针
    d.stage.addEventListener('pointermove', function (e) {
      if (!d.stage.classList.contains('fx-torch')) return;
      var p = E.toLocal(e);
      d.stage.style.setProperty('--tx', p.x + 'px');
      d.stage.style.setProperty('--ty', p.y + 'px');
    });
    document.addEventListener('pointerdown', function () { E.audio.init(); }, { once: true });
    document.addEventListener('fullscreenchange', function () { setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60); });
  };

  function onKey(e) {
    if (e.key === 'Escape') { if (!UI.closeTop()) { if (E.running && !E.blocked) UI.action('settings'); } return; }
    if (E.blocked || !E.running) {
      // 面板里的数字键不处理
      return;
    }
    var k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); E.userAdvance(); }
    else if (k === 'Control') { if (!E.skipping) { E.ctrlSkip = true; E.setSkip(true); } }
    else if (k === 'a' || k === 'A') UI.action('auto');
    else if (k === 'h' || k === 'H') E.setHideUI(!E.hideUI);
    else if (k === 'ArrowUp' || k === 'l' || k === 'L') UI.action('log');
    else if (k === 'n' || k === 'N') UI.action('notebook');
    else if (k === 'F5' || k === 'q' || k === 'Q') { e.preventDefault(); UI.action('qsave'); }
    else if (k === 'F9') { e.preventDefault(); UI.action('qload'); }
    else if (/^[1-9]$/.test(k) && D().choices.classList.contains('show') && E.choiceKeys) E.choiceKeys(+k - 1);
  }

  UI.action = function (act) {
    E.audio.init();
    switch (act) {
      case 'auto': E.setAuto(!E.auto); break;
      case 'skip': E.setSkip(!E.skipping); break;
      case 'log': UI.backlog(); break;
      case 'notebook': UI.notebook(); break;
      case 'save': UI.saveLoad('save'); break;
      case 'load': UI.saveLoad('load'); break;
      case 'qsave': if (E.saveTo('quick')) E.toast('<b>快速存档</b>已保存', 'item'); break;
      case 'qload': if (E.getSaves().quick) E.loadFrom('quick'); else E.toast('<b>快速读档</b>还没有快速存档', 'item'); break;
      case 'settings': UI.settings(); break;
      case 'title': confirmBox('返回标题画面？未保存的进度会丢失（自动存档仍在）。', '返回标题').then(function (ok) { if (ok) UI.backToTitle(); }); break;
    }
  };

  /** 触屏专用菜单：大按钮网格 */
  UI.touchMenu = function () {
    var items = [
      ['auto', E.auto ? '停止自动' : '自动播放'], ['skip', E.skipping ? '停止快进' : '快进'], ['log', '回看'], ['notebook', '工作手册'],
      ['save', '存档'], ['load', '读档'], ['qsave', '快速存档'], ['qload', '快速读档'],
      ['hide', '隐藏界面'], ['fullscreen', '全屏'], ['settings', '设置'], ['title', '返回标题']
    ];
    var inGame = E.running;
    var html = '<div class="tm-grid">' + items.filter(function (it) { return inGame || ['load', 'settings', 'fullscreen'].indexOf(it[0]) >= 0; })
      .map(function (it) { return '<button data-a="' + it[0] + '">' + it[1] + '</button>'; }).join('') + '</div>';
    var p = panel('touchmenu', '菜单', html);
    p.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var a = b.dataset.a;
      closePanel(p);
      if (a === 'hide') { E.setHideUI(true); return; }
      if (a === 'fullscreen') {
        try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
        catch (err) { E.toast('<b>全屏</b>这个浏览器不支持；可以“添加到主屏幕”后再打开', 'item'); }
        return;
      }
      UI.action(a);
    });
  };

  UI.refreshModes = function () {
    var qm = $('#quickmenu');
    if (!qm) return;
    qm.querySelector('.qm-auto') && qm.querySelector('.qm-auto').classList.toggle('on', E.auto);
    qm.querySelector('.qm-skip') && qm.querySelector('.qm-skip').classList.toggle('on', E.skipping);
  };
  UI.refreshHud = function () {
    var nb = $('#quickmenu .qm-notebook');
    if (nb) { nb.classList.toggle('locked', !!E.S.notebookLocked); nb.textContent = E.S.notebookLocked ? '手册✕' : '手册'; }
    E.renderSanity();
  };
  UI.pulseNotebook = function () {
    var nb = $('#quickmenu .qm-notebook');
    if (!nb) return;
    nb.classList.remove('pulse'); void nb.offsetWidth; nb.classList.add('pulse');
  };
  UI.showGame = function () {
    var t = $('#title-screen');
    if (t) t.classList.add('gone');
    D().stage.classList.add('in-game');
  };
  UI.fatal = function (err) {
    E.toast('<b>出错了</b>' + esc(err && err.message || err), 'item');
  };

  /* ============================================================ 标题画面 */
  UI.title = function () {
    var d = D();
    E.stopRun();
    UI.closeAll();
    d.stage.classList.remove('in-game', 'flashback', 'ui-hidden');
    Object.keys(R.fx).forEach(function (k) { d.stage.classList.remove('fx-' + k); });
    d.chars.innerHTML = ''; d.cg.innerHTML = ''; d.overlay.innerHTML = '';
    d.textbox.classList.add('hidden');
    d.date.classList.remove('show');
    d.sanity.classList.remove('show');
    E.setBg('title', 'cut');
    var old = $('#title-screen'); if (old) old.remove();
    var t = h('div', '', '');
    t.id = 'title-screen';
    var hasSave = !!E.latestSave();
    t.innerHTML =
      '<div class="ts-logo"><div class="ts-sub">那 多 手 记</div><h1>幽灵旗</h1><div class="ts-en">THE GHOST FLAG</div></div>' +
      '<nav class="ts-menu">' +
      (hasSave ? '<button data-a="continue">继续游戏</button>' : '') +
      '<button data-a="new">开始游戏</button>' +
      '<button data-a="load">读取存档</button>' +
      '<button data-a="chapters">章节选择</button>' +
      '<button data-a="gallery">手册图鉴</button>' +
      '<button data-a="endings">结局图鉴</button>' +
      '<button data-a="settings">设置</button>' +
      '<button data-a="help">操作说明</button>' +
      '</nav>' +
      '<div class="ts-foot">改编自那多《幽灵旗》 · 非商业同人改编作品 · 点击任意处开启声音</div>';
    d.stage.appendChild(t);
    t.addEventListener('click', function (e) {
      E.audio.init();
      E.audio.bgm('title');
      var b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      E.audio.sfx('click');
      var a = b.dataset.a;
      if (a === 'new') { t.classList.add('gone'); E.gameFails = {}; E.newGame(R.meta.startLabel); }
      else if (a === 'continue') { var k = E.latestSave(); if (k) E.loadFrom(k); }
      else if (a === 'load') UI.saveLoad('load');
      else if (a === 'chapters') UI.chapterSelect();
      else if (a === 'gallery') UI.notebook(true);
      else if (a === 'endings') UI.endingGallery();
      else if (a === 'settings') UI.settings();
      else if (a === 'help') UI.help();
    });
    try { E.audio.bgm('title'); } catch (e) { /* 未交互前可能无声 */ }
  };
  UI.backToTitle = function () { if (E.running) E.saveTo('auto'); UI.title(); return Promise.resolve(); };

  UI.help = function () {
    panel('help', '操作说明',
      '<table class="help-t">' +
      '<tr><td>点击 / 空格 / 回车 / 滚轮下</td><td>推进文字</td></tr>' +
      '<tr><td>按住 Ctrl · 快进</td><td>快速跳过已读文字</td></tr>' +
      '<tr><td>A · 自动</td><td>自动播放</td></tr>' +
      '<tr><td>滚轮上 / ↑ / L · 回看</td><td>查看之前的对话</td></tr>' +
      '<tr><td>N · 手册</td><td>那多的工作手册：线索、人物、物证、物品、日志</td></tr>' +
      '<tr><td>右键 / H</td><td>隐藏对话框欣赏画面</td></tr>' +
      '<tr><td>Q 或 F5 / F9</td><td>快速存档 / 快速读档</td></tr>' +
      '<tr><td>1–9</td><td>选择对应选项</td></tr>' +
      '<tr><td>Esc</td><td>关闭面板 / 打开设置</td></tr>' +
      '</table>' +
      '<p class="help-p">故事里有 <b>推理</b>、<b>小游戏</b> 与 <b>多个结局</b>。走进死路时可以“回到抉择前”。觉得小游戏太难，可以在设置里打开“简单模式”。</p>');
  };

  /* ============================================================ 章节选择 / 图鉴 */
  UI.chapterSelect = function () {
    var G = E.global;
    var html = '<div class="chap-list">' + R.chapters.map(function (c, i) {
      var open = i === 0 || G.chapters.indexOf(c.id) >= 0;
      return '<button class="chap' + (open ? '' : ' locked') + '" data-id="' + c.id + '"' + (open ? '' : ' disabled') + '><span class="no">' + c.no + '</span><span class="tt">' + (open ? esc(c.title) : '？？？') + '</span></button>';
    }).join('') + '</div><p class="hint">读过的章节会在这里解锁。从中途开始时，之前章节的线索会自动补入手册。</p>';
    var p = panel('chapters', '章节选择', html);
    p.addEventListener('click', function (e) {
      var b = e.target.closest('.chap:not(.locked)');
      if (!b) return;
      var c = R.chapters.filter(function (x) { return x.id === b.dataset.id; })[0];
      UI.closeAll();
      E.gameFails = {};
      E.newGame(c.start, c.id);
    });
  };

  UI.endingGallery = function () {
    var G = E.global;
    var ids = Object.keys(R.endings);
    var html = '<div class="end-list">' + ids.map(function (id) {
      var en = R.endings[id], got = G.endings.indexOf(id) >= 0;
      return '<div class="end-item t-' + en.type + (got ? '' : ' locked') + '"><span class="et">' + en.type + ' END</span><b>' + (got ? esc(en.title) : '？？？') + '</b><p>' + (got ? esc(en.desc) : '尚未达成') + '</p></div>';
    }).join('') + '</div><p class="hint">已达成 ' + G.endings.length + ' / ' + ids.length + '</p>';
    panel('endings', '结局图鉴', html);
  };

  /* ============================================================ 工作手册 */
  UI.notebook = function (galleryMode) {
    var S = E.S, G = E.global;
    if (!galleryMode && S.notebookLocked) {
      E.toast('<b>工作手册</b>被偷走了……只剩几张便签。', 'item');
    }
    var clues = galleryMode ? G.clues : S.clues;
    var docs = galleryMode ? G.docs.filter(function (d) { return R.docs[d]; }) : S.docs;
    var persons = galleryMode ? G.persons : S.persons;
    var tabs = [['clues', '线索'], ['persons', '人物'], ['docs', '物证'], ['items', '随身物品'], ['notes', '日志']];
    if (galleryMode) tabs = tabs.filter(function (t) { return t[0] !== 'items' && t[0] !== 'notes'; });
    var html = '<div class="nb-tabs">' + tabs.map(function (t, i) { return '<button data-t="' + t[0] + '"' + (i === 0 ? ' class="on"' : '') + '>' + t[1] + '</button>'; }).join('') + '</div><div class="nb-page"></div>';
    var p = panel('notebook' + (S.notebookLocked && !galleryMode ? ' locked' : ''), galleryMode ? '手册图鉴' : '工作手册', html);
    var page = p.querySelector('.nb-page');
    function render(t) {
      var out = '';
      if (t === 'clues') {
        var total = Object.keys(R.clues).length;
        out += '<div class="nb-count">已记录 ' + clues.length + ' / ' + total + '</div>';
        R.chapters.forEach(function (ch) {
          var list = clues.filter(function (c) { return R.clues[c] && R.clues[c].ch === ch.id; });
          if (!list.length) return;
          out += '<h3>' + ch.no + ' ' + esc(ch.title) + '</h3>';
          list.forEach(function (c) { out += '<div class="nb-clue"><b>' + esc(R.clues[c].title) + '</b><p>' + esc(R.clues[c].text) + '</p></div>'; });
        });
        if (!clues.length) out += '<p class="empty">还什么都没记下。</p>';
      } else if (t === 'persons') {
        out += '<div class="nb-persons">';
        persons.forEach(function (id) {
          var c = R.characters[id]; if (!c) return;
          var bi = galleryMode ? c.bio.length - 1 : (S.bios[id] || 0);
          var nm = galleryMode ? c.name : E.displayName(id);
          out += '<div class="nb-person"><div class="pp-art" style="--rim:' + c.color + '">' + E.artHtml('char', id, {}) + '</div><div><b style="color:' + c.color + '">' + esc(nm) + '</b><p>' + esc(c.bio[Math.min(bi, c.bio.length - 1)]) + '</p></div></div>';
        });
        out += '</div>';
        if (!persons.length) out += '<p class="empty">还没有见到任何人。</p>';
      } else if (t === 'docs') {
        out += '<div class="nb-docs">';
        docs.forEach(function (id) { var dd = R.docs[id]; if (dd) out += '<button class="nb-doc" data-doc="' + id + '"><i class="k-' + dd.kind + '"></i>' + esc(dd.title) + '</button>'; });
        out += '</div>';
        if (!docs.length) out += '<p class="empty">还没有收集到物证。</p>';
      } else if (t === 'items') {
        S.items.forEach(function (i) { var it = R.items[i]; if (it) out += '<div class="nb-clue"><b>' + esc(it.name) + '</b><p>' + esc(it.desc) + '</p></div>'; });
        if (!S.items.length) out += '<p class="empty">身上没带什么特别的东西。</p>';
      } else if (t === 'notes') {
        S.notes.forEach(function (n) { out += '<div class="nb-note"><div class="nd">' + esc(n.date || '') + '</div><p>' + esc(n.text) + '</p></div>'; });
        if (!S.notes.length) out += '<p class="empty">这几天还没写日志。</p>';
      }
      page.innerHTML = out;
      page.scrollTop = 0;
    }
    p.querySelector('.nb-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      p.querySelectorAll('.nb-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      render(b.dataset.t);
    });
    page.addEventListener('click', function (e) {
      var b = e.target.closest('.nb-doc'); if (!b) return;
      UI.showDoc(b.dataset.doc, null, true);
    });
    render('clues');
  };

  /* ============================================================ 存读档 */
  UI.saveLoad = function (mode) {
    var saves = E.getSaves();
    var slots = ['auto', 'quick'].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(String));
    function card(k) {
      var s = saves[k];
      var label = k === 'auto' ? '自动存档' : k === 'quick' ? '快速存档' : '存档 ' + k;
      if (!s) return '<button class="slot empty" data-k="' + k + '"><div class="sl-thumb"></div><div class="sl-info"><b>' + label + '</b><p>— 空 —</p></div></button>';
      var m = s.meta, dt = new Date(m.time);
      var when = dt.getFullYear() + '/' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      return '<button class="slot" data-k="' + k + '"><div class="sl-thumb">' + E.artHtml('bg', m.bg || 'black') + '</div><div class="sl-info"><b>' + label + '</b><em>' + esc(m.chapter) + '</em><p>' + esc((m.text || '').slice(0, 42)) + '</p><small>' + when + (m.date ? ' · ' + esc(m.date) : '') + '</small></div>' +
        (k !== 'auto' ? '<span class="sl-del" data-del="' + k + '" title="删除">✕</span>' : '') + '</button>';
    }
    var canSave = mode === 'save' && E.running;
    var html = '<div class="sl-mode"><button data-m="save"' + (mode === 'save' ? ' class="on"' : '') + (E.running ? '' : ' disabled') + '>存档</button><button data-m="load"' + (mode === 'load' ? ' class="on"' : '') + '>读档</button>' +
      '<span class="sl-code"><button data-c="export">导出存档码</button><button data-c="import">导入存档码</button></span></div>' +
      '<div class="slots">' + slots.filter(function (k) { return !(canSave && k === 'auto'); }).map(card).join('') + '</div>';
    var p = panel('saveload', mode === 'save' ? '存档' : '读档', html);
    p.addEventListener('click', function (e) {
      var c = e.target.closest('.sl-code button');
      if (c) { closePanel(p); if (c.dataset.c === 'export') UI.exportCode(); else UI.importCode(); return; }
      var m = e.target.closest('.sl-mode button');
      if (m && !m.disabled) { closePanel(p); UI.saveLoad(m.dataset.m); return; }
      var del = e.target.closest('.sl-del');
      if (del) { e.stopPropagation(); confirmBox('删除这个存档？', '删除').then(function (ok) { if (ok) { E.deleteSave(del.dataset.del); closePanel(p); UI.saveLoad(mode); } }); return; }
      var s = e.target.closest('.slot'); if (!s) return;
      var k = s.dataset.k;
      if (mode === 'save') {
        var go = function () { E.saveTo(k); closePanel(p); UI.saveLoad('save'); E.toast('<b>存档</b>已保存到 ' + (k === 'quick' ? '快速存档' : '存档 ' + k), 'item'); };
        if (saves[k]) confirmBox('覆盖这个存档？', '覆盖').then(function (ok) { if (ok) go(); }); else go();
      } else if (saves[k]) {
        UI.closeAll();
        E.loadFrom(k);
      }
    });
  };

  /* ============================================================ 设置 */
  UI.settings = function () {
    var st = E.settings;
    function range(key, label, min, max, step, fmt) {
      return '<label class="set-row"><span>' + label + '</span><input type="range" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + st[key] + '"><em data-v="' + key + '">' + fmt(st[key]) + '</em></label>';
    }
    function tog(key, label, desc) {
      return '<label class="set-row tog"><span>' + label + '</span><input type="checkbox" data-k="' + key + '"' + (st[key] ? ' checked' : '') + '><i></i><small>' + desc + '</small></label>';
    }
    var fmts = {
      textSpeed: function (v) { return v >= 120 ? '瞬间' : v + ' 字/秒'; },
      autoDelay: function (v) { return (v / 1000).toFixed(1) + ' 秒'; },
      bgm: function (v) { return Math.round(v * 100) + '%'; }, sfx: function (v) { return Math.round(v * 100) + '%'; }, master: function (v) { return Math.round(v * 100) + '%'; }
    };
    var html =
      range('textSpeed', '文字速度', 10, 120, 5, fmts.textSpeed) +
      range('autoDelay', '自动播放间隔', 400, 4000, 100, fmts.autoDelay) +
      range('master', '总音量', 0, 1, 0.05, fmts.master) +
      range('bgm', '音乐', 0, 1, 0.05, fmts.bgm) +
      range('sfx', '音效', 0, 1, 0.05, fmts.sfx) +
      tog('tick', '打字音', '文字出现时的轻微声响') +
      tog('easy', '简单模式', '放宽小游戏的时限与容错，并提供跳过') +
      tog('skipUnread', '快进未读文字', '关闭时快进遇到没读过的文字会停下') +
      '<label class="set-row tog"><span>美术</span><input type="checkbox" data-k="artMode"' + (st.artMode === 'svg' ? '' : ' checked') + '><i></i><small>开：插画；关：矢量剪影（更省资源）</small></label>' +
      '<div class="btn-row"><button class="btn sc-exp">导出存档码</button><button class="btn sc-imp">导入存档码</button><button class="btn fs">全屏切换</button><button class="btn reset">清除全部数据</button></div>';
    var p = panel('settings', '设置', html);
    p.addEventListener('input', function (e) {
      var k = e.target.dataset.k; if (!k) return;
      if (e.target.type === 'checkbox') st[k] = k === 'artMode' ? (e.target.checked ? 'image' : 'svg') : e.target.checked;
      else { st[k] = parseFloat(e.target.value); var em = p.querySelector('[data-v="' + k + '"]'); if (em) em.textContent = fmts[k](st[k]); }
      E.saveSettings();
      if (k === 'artMode' && E.running) { E.setBg(E.S.stage.bg, 'cut'); }
    });
    p.querySelector('.sc-exp').addEventListener('click', function () { closePanel(p); UI.exportCode(); });
    p.querySelector('.sc-imp').addEventListener('click', function () { closePanel(p); UI.importCode(); });
    p.querySelector('.fs').addEventListener('click', function () {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* 忽略 */ }
    });
    p.querySelector('.reset').addEventListener('click', function () {
      confirmBox('清除全部存档、已读记录、图鉴与设置？此操作不可撤销。', '全部清除').then(function (ok) {
        if (!ok) return;
        try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('ghostflag.') === 0) localStorage.removeItem(k); }); } catch (e) { /* 忽略 */ }
        location.reload();
      });
    });
  };

  /* ============================================================ 回看 */
  UI.backlog = function () {
    var S = E.S;
    var html = '<div class="log-list">' + S.backlog.map(function (b) {
      if (b.choice) return '<div class="log-item choice">' + esc(b.text) + '</div>';
      return '<div class="log-item' + (b.name ? '' : ' narr') + '">' + (b.name ? '<b style="color:' + (b.color || '#e0b56a') + '">' + esc(b.name) + '</b>' : '') + '<p>' + GF.renderInline(b.text) + '</p></div>';
    }).join('') + '</div>';
    var p = panel('backlog', '回看', html);
    var list = p.querySelector('.log-list');
    list.scrollTop = list.scrollHeight;
  };

  /* ============================================================ 剧情浮层 */
  function overlayCard(cls, html, token, opts) {
    opts = opts || {};
    if (E.autotest) return Promise.resolve();
    return new Promise(function (resolve) {
      var d = D();
      var o = h('div', 'overlay-card ' + cls, html);
      d.overlay.appendChild(o);
      E.blocked++;
      requestAnimationFrame(function () { requestAnimationFrame(function () { o.classList.add('show'); }); });
      var done = false, minT = performance.now() + (opts.minMs || 500);
      function close() {
        if (done) return;
        if (performance.now() < minT) return;
        done = true;
        E.blocked = Math.max(0, E.blocked - 1);
        o.classList.remove('show');
        document.removeEventListener('keydown', key, true);
        setTimeout(function () { o.remove(); }, 400);
        resolve();
      }
      function key(e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
      o.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      document.addEventListener('keydown', key, true);
      if (opts.autoMs) setTimeout(function () { minT = 0; close(); }, opts.autoMs);
      if (E.skipping && opts.skippable) setTimeout(function () { minT = 0; close(); }, 250);
    });
  }

  UI.chapterCard = function (chId, token) {
    var c = R.chapters.filter(function (x) { return x.id === chId; })[0];
    E.audio.sfx('page');
    return overlayCard('chapter-card', '<div class="cc-no">' + esc(c.no) + '</div><div class="cc-title">' + esc(c.title) + '</div><div class="cc-line"></div><div class="cc-src">改编自那多《幽灵旗》</div>', token, { minMs: 900, autoMs: 3600, skippable: true });
  };
  UI.chapterEnd = function (chId, token) {
    var c = R.chapters.filter(function (x) { return x.id === chId; })[0];
    return overlayCard('chapter-end', '<div class="ce-t">— ' + esc(c ? c.no : '') + ' 完 —</div>', token, { minMs: 700, autoMs: 2600, skippable: true });
  };
  UI.centerText = function (text, token) {
    return overlayCard('center-text', '<div class="ct">' + GF.renderInline(text) + '</div>', token, { minMs: 600, skippable: true });
  };
  UI.showNote = function (text, date, token) {
    E.audio.sfx('pen');
    return overlayCard('note-card', '<div class="note-paper"><div class="np-head">工作手册</div><div class="np-date">' + esc(date || '') + '</div><div class="np-text">' + GF.renderInline(text) + '</div></div>', token, { minMs: 700, skippable: true });
  };

  UI.showDoc = function (id, token, fromNotebook) {
    var d = R.docs[id];
    if (!d) return Promise.resolve();
    E.audio.sfx('page');
    var art = '';
    if (d.art && GF.art && GF.art.doc && GF.art.doc[d.art]) { try { art = '<div class="doc-art">' + GF.art.doc[d.art]() + '</div>'; } catch (e) { console.warn(e); } }
    var paras = String(d.text).split('\n').map(function (t) { return '<p>' + GF.renderInline(t) + '</p>'; }).join('');
    var html = '<div class="doc doc-' + d.kind + (art ? ' has-art' : '') + '"><div class="doc-title">' + esc(d.title) + '</div>' + art + '<div class="doc-text">' + paras + '</div><div class="doc-hint">点击任意处关闭</div></div>';
    if (fromNotebook) {
      var o = h('div', 'overlay-card doc-overlay in-menu show', html);
      D().menus.appendChild(o);
      o.addEventListener('click', function (e) { e.stopPropagation(); o.remove(); });
      return Promise.resolve();
    }
    return overlayCard('doc-overlay', html, token, { minMs: 600 });
  };

  /* ============================================================ 推理 */
  UI.deduce = function (id, token) {
    var dd = R.deductions[id];
    if (!dd) return Promise.resolve(0);
    if (E.autotest) return Promise.resolve(0);
    return new Promise(function (resolve) {
      var d = D();
      var misses = 0;
      E.blocked++;
      var o = h('div', 'deduce');
      o.innerHTML = '<div class="dd-head"><span class="dd-tag">推 理</span></div><div class="dd-q">' + esc(dd.q) + '</div>' +
        '<div class="dd-opts">' + dd.options.map(function (t, i) { return '<button data-i="' + i + '"><span class="cn">' + '甲乙丙丁戊'[i] + '</span>' + esc(t) + '</button>'; }).join('') + '</div>' +
        '<div class="dd-reply"></div><button class="dd-notebook">翻看手册</button>';
      d.overlay.appendChild(o);
      E.audio.sfx('page');
      requestAnimationFrame(function () { o.classList.add('show'); });
      var reply = o.querySelector('.dd-reply');
      o.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('.dd-notebook')) { E.blocked--; UI.notebook(); var pp = stack[stack.length - 1]; var oc = pp._onClose; pp._onClose = function () { E.blocked++; if (oc) oc(); }; return; }
        var b = e.target.closest('.dd-opts button');
        if (!b || b.disabled || o.classList.contains('solved')) return;
        var i = +b.dataset.i;
        if (i === dd.correct) {
          o.classList.add('solved');
          b.classList.add('right');
          E.audio.sfx('stamp');
          reply.innerHTML = '<span class="ok">推理成立</span>';
          setTimeout(function () {
            o.classList.remove('show');
            setTimeout(function () { o.remove(); E.blocked = Math.max(0, E.blocked - 1); resolve(misses); }, 400);
          }, 1300);
        } else {
          misses++;
          b.disabled = true; b.classList.add('wrong');
          E.shake('soft');
          reply.innerHTML = '<span class="no">不对。</span>' + esc((dd.wrong && dd.wrong[i]) || '再想想。');
        }
      });
    });
  };

  /* ============================================================ 结局 */
  UI.ending = function (id, token) {
    var en = R.endings[id];
    var d = D();
    E.audio.bgm(en.type === 'BAD' ? 'dread' : en.type === 'TRUE' ? 'truth' : 'sorrow');
    return new Promise(function (resolve) {
      var o = h('div', 'ending-card t-' + en.type);
      var hasCp = !!E.S.checkpoint;
      o.innerHTML = '<div class="ec-type">' + en.type + ' END</div><div class="ec-title">' + esc(en.title) + '</div><div class="ec-desc">' + esc(en.desc) + '</div>' +
        '<div class="ec-btns">' +
        (en.type === 'BAD' && hasCp ? '<button data-a="cp">回到抉择前</button>' : '') +
        (en.type === 'TRUE' ? '<button data-a="next">继续</button>' : '<button data-a="title">返回标题</button>') +
        '</div>';
      d.overlay.appendChild(o);
      E.blocked++;
      requestAnimationFrame(function () { requestAnimationFrame(function () { o.classList.add('show'); }); });
      o.addEventListener('click', function (e) {
        e.stopPropagation();
        var b = e.target.closest('button'); if (!b) return;
        E.audio.sfx('click');
        E.blocked = Math.max(0, E.blocked - 1);
        o.remove();
        // 结局之后流程由这里接管：回档 / 回标题 / 制作名单 → 评价 → 标题（不 resolve，旧的执行循环随 token 失效）
        if (b.dataset.a === 'cp') E.toCheckpoint();
        else if (b.dataset.a === 'title') { E.stopRun(); UI.backToTitle(); }
        else if (b.dataset.a === 'next') {
          E.stopRun();
          UI.credits(token).then(function () { return UI.evaluation(); }).then(function () { UI.backToTitle(); });
        }
      });
    });
  };

  UI.evaluation = function () {
    var S = E.S, G = E.global;
    var total = Object.keys(R.clues).length;
    var got = S.clues.length;
    var endN = G.endings.length, endT = Object.keys(R.endings).length;
    var mins = Math.round(S.playMs / 60000);
    var rank = S.mistakes === 0 && got >= total - 3 ? '真相的收藏家' : S.mistakes <= 3 ? '老记者' : S.mistakes <= 8 ? '好奇心旺盛的记者' : '跑热线的新人';
    return new Promise(function (resolve) {
      var o = h('div', 'overlay-card eval-card');
      o.innerHTML = '<div class="ev"><h2>调查评价</h2><table>' +
        '<tr><td>收集线索</td><td>' + got + ' / ' + total + '</td></tr>' +
        '<tr><td>推理失误</td><td>' + S.mistakes + ' 次</td></tr>' +
        '<tr><td>达成结局</td><td>' + endN + ' / ' + endT + '</td></tr>' +
        '<tr><td>游玩时间</td><td>约 ' + mins + ' 分钟</td></tr>' +
        '</table><div class="rank">称号：<b>' + rank + '</b></div><p class="hint">点击返回标题</p></div>';
      D().overlay.appendChild(o);
      E.blocked++;
      requestAnimationFrame(function () { o.classList.add('show'); });
      o.addEventListener('click', function (e) { e.stopPropagation(); E.blocked = Math.max(0, E.blocked - 1); o.remove(); resolve(); });
    });
  };

  UI.credits = function (token) {
    E.audio.bgm('truth');
    var lines = [
      ['', '幽 灵 旗'], ['', 'THE GHOST FLAG'], ['', ''],
      ['原著', '那多《幽灵旗》（那多灵异手记）'], ['', ''],
      ['改编剧本', 'Claude'], ['引擎与程序', 'Claude'], ['程序化音乐与音效', 'Claude'],
      ['插画', 'AI 生成（经 Codex 图像生成）'], ['矢量美术', 'Claude'], ['', ''],
      ['登场人物', '那多 · 卫先 · 卫不回 · 钟书同 · 苏逸才 · 杨铁 · 傅惜娣 · 钱六'],
      ['', '路云 · 夏侯婴 · 明慧 · 欧明德 · 梁应物 · 蓝头 · 赵维 · 尤尼克'],
      ['', '孙耀祖 · 孙怀祖 · 孙辉祖 · 孙念祖'], ['', ''],
      ['', '本作为非商业的同人改编作品。'], ['', '感谢每一位读过那多手记的读者。'], ['', ''],
      ['', '是“心”，不是“新”。']
    ];
    return new Promise(function (resolve) {
      var o = h('div', 'credits');
      o.innerHTML = '<div class="cr-roll">' + lines.map(function (l) { return '<div class="cr-line">' + (l[0] ? '<span>' + esc(l[0]) + '</span>' : '') + '<b>' + esc(l[1]) + '</b></div>'; }).join('') + '</div><div class="cr-skip">点击跳过</div>';
      D().overlay.appendChild(o);
      E.blocked++;
      var done = false;
      function end() { if (done) return; done = true; E.blocked = Math.max(0, E.blocked - 1); o.classList.add('out'); setTimeout(function () { o.remove(); resolve(); }, 600); }
      o.addEventListener('click', function (e) { e.stopPropagation(); end(); });
      setTimeout(end, 30000);
      requestAnimationFrame(function () { o.classList.add('show'); });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
