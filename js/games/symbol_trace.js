/*
 * 小游戏 symbol_trace（第八章 · 湖畔别墅小客厅）
 * 夏侯婴用指尖在空中画暗示符，替那多解除死亡暗示。共 3 道符，每道 5–7 个发光点：
 *   先由她的指尖演示一遍发光轨迹 → 玩家按同样顺序点击或拖过这些光点；
 *   连错一个点，轨迹消散、她再演示一遍，重来（不会失败）；
 *   每完成一道，符光沉进眼里，画面更暗、眼皮更沉；第三道完成后闭眼入睡 → win。
 * 底图 ctx.bgImage('villa_room') 的 AI 插画；缺失时退回 ctx.bgSvg('villa_room')，再退回本文件自绘的兜底客厅。
 * 操作：鼠标/触摸点击或拖过光点；键盘方向键选点、空格/回车连接、R 再看一遍。
 */
(function () {
  'use strict';
  var GF = window.GF;
  if (!GF || !GF.games) return;

  var P = 'gfg-symbol_trace-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';
  var AMBER = '#e0b56a', PAPER = '#efe6d2', JADE = '#7fc3a0';
  var BOX = { x: 545, y: 180, w: 510, h: 480 };   // 符文所在区域（舞台坐标）

  // 三道暗示符：nodes 为 BOX 内的归一化坐标（按书写顺序），bends 为每一笔的弯曲度，orn 是完成后浮现的附笔
  var GLYPHS = [
    // 一：一道竖脊被弧线横截，末笔回钩
    { nodes: [[0.50, 0.04], [0.48, 0.58], [0.16, 0.40], [0.84, 0.28], [0.66, 0.94]],
      bends: [0.06, 0.5, -0.22, 0.3],
      orn: [{ t: 'ring', x: 0.50, y: 0.70, r: 0.03 }, { t: 'line', p: [[0.30, 0.10], [0.40, 0.16]] }, { t: 'line', p: [[0.60, 0.16], [0.70, 0.10]] },
            { t: 'dot', x: 0.24, y: 0.80 }, { t: 'line', p: [[0.84, 0.50], [0.94, 0.58]] }] },
    // 二：一只被竖笔贯穿的眼
    { nodes: [[0.08, 0.44], [0.92, 0.40], [0.28, 0.60], [0.54, 0.08], [0.74, 0.76], [0.34, 0.95]],
      bends: [-0.42, -0.3, 0.18, -0.2, 0.3],
      orn: [{ t: 'ring', x: 0.52, y: 0.46, r: 0.05 }, { t: 'dot', x: 0.52, y: 0.46 }, { t: 'line', p: [[0.14, 0.14], [0.24, 0.22]] },
            { t: 'line', p: [[0.84, 0.14], [0.76, 0.22]] }, { t: 'dot', x: 0.90, y: 0.90 }] },
    // 三：由中心向外旋开的涡，尾笔挑起
    { nodes: [[0.50, 0.52], [0.68, 0.34], [0.44, 0.16], [0.16, 0.44], [0.38, 0.84], [0.84, 0.76], [0.92, 0.10]],
      bends: [0.32, 0.3, 0.3, 0.3, 0.24, -0.12],
      orn: [{ t: 'ring', x: 0.50, y: 0.52, r: 0.075 }, { t: 'dot', x: 0.10, y: 0.16 }, { t: 'dot', x: 0.18, y: 0.08 }, { t: 'dot', x: 0.27, y: 0.05 },
            { t: 'line', p: [[0.72, 0.96], [0.98, 0.92]] }, { t: 'dot', x: 0.62, y: 0.56 }] }
  ];

  // 睡意分级：完成 0/1/2/3 道符后的画面参数
  var SLEEP = {
    dim: [0.36, 0.5, 0.64, 1],
    blur: [1.5, 3.5, 6, 10],
    bright: [0.85, 0.66, 0.5, 0.3],
    lid: [0, 34, 66, 470],
    sway: [0, 3, 7, 0]
  };

  var LINES = {
    intro: '夏侯婴让我坐稳，抬起右手。她的指尖在空中亮起一点青光。',
    introYing: '看着我的手指，跟着它走一遍。别想别的。',
    fail: ['断了。没关系，再看一遍。', '别急，心别乱，跟着光走。', '手别抖，照着我的来。'],
    after1: '那道光像一滴凉水，落进了眼睛里。眼皮开始发沉。',
    after2: '她的声音越来越远，屋子在一点点往下沉。',
    after2Ying: '最后一个。撑住，别睡。',
    end: '我想说句什么，却只来得及闭上眼睛。'
  };

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f(n) { return Math.round(n * 10) / 10; }

  /* ================================================================ 兜底底图：别墅小客厅 */
  var roomCache = null;
  function fallbackRoom() {
    if (roomCache) return roomCache;
    var r = rng(808), o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice"><defs>' +
      '<linearGradient id="symbol_trace-f-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d2c1f"/><stop offset="1" stop-color="#20160f"/></linearGradient>' +
      '<linearGradient id="symbol_trace-f-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c3cc"/><stop offset=".55" stop-color="#e7d9b8"/><stop offset="1" stop-color="#f3e2bd"/></linearGradient>' +
      '<linearGradient id="symbol_trace-f-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc2c8"/><stop offset="1" stop-color="#4d7f8c"/></linearGradient>' +
      '<linearGradient id="symbol_trace-f-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#553a26"/><stop offset="1" stop-color="#23170e"/></linearGradient>' +
      '<linearGradient id="symbol_trace-f-cur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3222"/><stop offset=".3" stop-color="#7a5536"/><stop offset=".55" stop-color="#4f3524"/><stop offset=".8" stop-color="#6e4b30"/><stop offset="1" stop-color="#3a271a"/></linearGradient>' +
      '<linearGradient id="symbol_trace-f-beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".22"/><stop offset="1" stop-color="#ffe2b0" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="symbol_trace-f-vig" cx="50%" cy="45%" r="75%"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>' +
      '<filter id="symbol_trace-f-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>' +
      '</defs>');
    o.push('<rect width="1600" height="900" fill="url(#symbol_trace-f-wall)"/>');
    var pan = '';
    for (var x = 40; x < 1600; x += 92) pan += 'M' + x + ' 0V640';
    o.push('<path d="' + pan + '" stroke="#170f09" stroke-opacity=".5" stroke-width="3"/>');
    // 落地窗外：天、山、瀑布、湖、草坪
    var WX0 = 330, WX1 = 1270, WY0 = 70, WY1 = 640;
    o.push('<rect x="' + WX0 + '" y="' + WY0 + '" width="' + (WX1 - WX0) + '" height="' + (WY1 - WY0) + '" fill="url(#symbol_trace-f-sky)"/>');
    o.push('<path d="M330 330L420 250L520 290L640 190L760 270L860 220L990 300L1110 210L1270 290V420H330Z" fill="#7d9ba1"/>');
    o.push('<path d="M330 380L470 300L590 350L720 290L880 360L1010 300L1140 350L1270 320V440H330Z" fill="#587a80"/>');
    o.push('<path d="M1042 305q4 50 2 108" stroke="#f4f1e6" stroke-width="5" stroke-opacity=".75" fill="none"/>');
    o.push('<rect x="330" y="430" width="940" height="160" fill="url(#symbol_trace-f-lake)"/>');
    var ref = '';
    for (var i = 0; i < 26; i++) {
      var ry = 440 + r() * 140, rx = 340 + r() * 900, rl = 20 + r() * 80;
      ref += 'M' + f(rx) + ' ' + f(ry) + 'h' + f(rl);
    }
    o.push('<path d="' + ref + '" stroke="#e8f2ee" stroke-opacity=".35" stroke-width="2"/>');
    o.push('<path d="M330 590Q700 560 1270 585V640H330Z" fill="#7f9660"/>');
    o.push('<ellipse cx="560" cy="612" rx="16" ry="9" fill="#f7f4ee"/><path d="M570 606q10 -18 4 -30" stroke="#f7f4ee" stroke-width="3" fill="none"/>');
    // 窗框
    o.push('<path d="M' + WX0 + ' ' + WY0 + 'H' + WX1 + 'V' + WY1 + 'H' + WX0 + 'Z" fill="none" stroke="#24170e" stroke-width="22"/>');
    o.push('<path d="M565 70V640M800 70V640M1035 70V640M330 210H1270" stroke="#24170e" stroke-width="13"/>');
    o.push('<path d="M330 640H1270" stroke="#4b3322" stroke-width="10"/>');
    // 窗帘
    o.push('<path d="M200 40Q250 360 220 900H0V40Z" fill="url(#symbol_trace-f-cur)"/><path d="M320 40Q300 400 360 900H200Q250 380 200 40Z" fill="#5a3d28"/>');
    o.push('<path d="M1400 40Q1350 360 1380 900H1600V40Z" fill="url(#symbol_trace-f-cur)"/><path d="M1280 40Q1300 400 1240 900H1400Q1350 380 1400 40Z" fill="#5a3d28"/>');
    o.push('<rect x="0" y="22" width="1600" height="26" fill="#1c120b"/>');
    // 地板与阳光
    o.push('<path d="M0 700H1600V900H0Z" fill="url(#symbol_trace-f-floor)"/>');
    var pl = '';
    for (i = -8; i <= 8; i++) pl += 'M' + (800 + i * 70) + ' 700L' + (800 + i * 170) + ' 900';
    o.push('<path d="' + pl + '" stroke="#1a110a" stroke-opacity=".5" stroke-width="2"/>');
    o.push('<path d="M0 640H1600V700H0Z" fill="#2c1d13"/><path d="M0 640H1600" stroke="#6a4a31" stroke-width="3"/>');
    o.push('<g filter="url(#symbol_trace-f-blur)"><path d="M470 110L1120 110L1500 900L760 900Z" fill="url(#symbol_trace-f-beam)"/>' +
      '<path d="M720 720L1180 720L1420 900L860 900Z" fill="#ffd9a0" fill-opacity=".14"/></g>');
    // 茶几与茶具、沙发剪影
    o.push('<path d="M560 800H1040L1010 826H590Z" fill="#150d08"/><path d="M600 826h14v74h-14zM986 826h14v74h-14z" fill="#150d08"/>' +
      '<path d="M700 800c0-26 12-36 30-36s30 10 30 36z" fill="#1c130c"/><path d="M752 780l26-10v6l-22 12z" fill="#1c130c"/>' +
      '<path d="M836 800c0-12 4-16 16-16s16 4 16 16zM890 800c0-12 4-16 16-16s16 4 16 16z" fill="#1c130c"/>');
    o.push('<path d="M1230 900V720q0-40 50-44h260q60 4 60 44V900Z" fill="#120b07"/><path d="M1200 900V780q0-26 30-26t30 26V900Z" fill="#0e0905"/>');
    o.push('<rect width="1600" height="900" fill="url(#symbol_trace-f-vig)"/></svg>');
    roomCache = o.join('');
    return roomCache;
  }

  function svgToImgSrc(svg) {
    if (!/xmlns=/.test(svg.slice(0, 400))) svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function mountSvg(el, svg) {
    if (/<image[^>]+href="(?!data:)/.test(svg)) {
      el.innerHTML = svg.replace(/<svg\b/, '<svg style="width:100%;height:100%;display:block"');
    } else {
      var img = document.createElement('img');
      img.src = svgToImgSrc(svg);
      img.draggable = false;
      img.style.cssText = 'display:block;width:100%;height:100%;';
      el.appendChild(img);
    }
  }

  // 夏侯婴的指尖（指尖在局部坐标原点，手指向右下方伸出）
  var FINGER_SVG =
    '<svg class="' + P + 'fingersvg" viewBox="-60 -60 560 560" width="560" height="560">' +
    '<defs><linearGradient id="' + P + 'skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ede3"/><stop offset=".5" stop-color="#dccdbf"/><stop offset="1" stop-color="#9a897d"/></linearGradient>' +
    '<linearGradient id="' + P + 'fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<mask id="' + P + 'mask" maskUnits="userSpaceOnUse" x="-40" y="-120" width="400" height="240"><rect x="-40" y="-120" width="400" height="240" fill="url(#' + P + 'fade)"/></mask>' +
    '<filter id="' + P + 'fblur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="1.3"/></filter></defs>' +
    '<g transform="rotate(38) scale(1.45)"><g mask="url(#' + P + 'mask)" filter="url(#' + P + 'fblur)">' +
    '<path d="M122 19C142 19 162 29 172 43C176 55 164 61 150 57C138 53 129 39 122 19Z" fill="#b3a194"/>' +
    '<path d="M6 -10.5C-4.5 -10.5 -9.5 -5.5 -9.5 0C-9.5 6.5 -4 11 6 11.5L70 13.5C82 14 90 16 102 17L230 22L232 -22L102 -15C90 -15 82 -13.5 70 -13Z" fill="url(#' + P + 'skin)"/>' +
    '<path d="M3 -8.5C-3.5 -8 -5.5 -4.5 -5.5 -1L17 -2C19 -6 15.5 -8.8 10 -9Z" fill="#fff8ef" opacity=".75"/>' +
    '<path d="M58 -11q3 11 0 23M104 -13q4 14 0 29" stroke="#8c7a6e" stroke-width="1.2" fill="none" opacity=".45"/>' +
    '<path d="M6 -10.5L70 -13C84 -13.5 92 -15 102 -15L200 -20" stroke="' + JADE + '" stroke-width="2.2" opacity=".6" fill="none"/>' +
    '</g></g></svg>';

  var CSS = [
    '.' + P + 'wrap{position:absolute;inset:0;overflow:hidden;background:#070605;font-family:' + FONT + ';}',
    '.' + P + 'bg{position:absolute;inset:-24px;transition:filter 2.2s ease;}',
    '.' + P + 'photo{display:block;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none;}',
    '.' + P + 'char{position:absolute;left:1110px;top:30px;width:400px;height:900px;filter:brightness(.75) blur(1.2px);}',
    '.' + P + 'char svg{width:100%;height:100%;display:block;}',
    '.' + P + 'dim{position:absolute;inset:0;background:#05070a;transition:opacity 2.2s ease;}',
    '.' + P + 'vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 38%,rgba(0,0,0,.75) 100%);pointer-events:none;}',
    '.' + P + 'focus{position:absolute;left:50%;top:47%;width:1100px;height:900px;margin:-450px 0 0 -550px;pointer-events:none;' +
      'background:radial-gradient(ellipse at center,rgba(3,6,8,.55) 0,rgba(3,6,8,.4) 35%,rgba(3,6,8,0) 68%);}',
    '.' + P + 'glow{position:absolute;left:50%;top:46%;width:900px;height:760px;margin:-380px 0 0 -450px;pointer-events:none;' +
      'background:radial-gradient(ellipse at center,rgba(127,195,160,.13),rgba(127,195,160,0) 62%);transition:opacity 1s;}',
    '.' + P + 'cv{position:absolute;left:0;top:0;width:1600px;height:900px;}',
    '.' + P + 'finger{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;opacity:0;transition:opacity .45s;will-change:transform;}',
    '.' + P + 'finger.on{opacity:.95}',
    '.' + P + 'fingersvg{position:absolute;left:-60px;top:-60px;overflow:visible;}',
    '.' + P + 'lid{position:absolute;left:-20px;right:-20px;height:900px;pointer-events:none;z-index:80;will-change:transform;}',
    '.' + P + 'lidt{top:-900px;background:linear-gradient(to bottom,#000 0,#000 calc(100% - 90px),rgba(0,0,0,0) 100%);}',
    '.' + P + 'lidb{top:900px;background:linear-gradient(to top,#000 0,#000 calc(100% - 90px),rgba(0,0,0,0) 100%);}',
    '.' + P + 'top{position:absolute;left:50%;top:22px;transform:translateX(-50%);z-index:50;text-align:center;pointer-events:none;white-space:nowrap;' +
      'padding:10px 30px 12px;background:rgba(6,8,8,.62);border:1px solid rgba(127,195,160,.3);border-radius:4px;color:' + PAPER + ';transition:opacity .8s;}',
    '.' + P + 'top b{display:block;font-weight:normal;font-size:28px;letter-spacing:.08em;}',
    '.' + P + 'top span{display:block;font-size:26px;color:#a9b8ae;letter-spacing:.1em;margin-top:4px;}',
    '.' + P + 'status{position:absolute;left:0;right:0;top:128px;text-align:center;z-index:50;pointer-events:none;font-size:30px;letter-spacing:.3em;' +
      'color:#9fe0bf;text-shadow:0 0 14px rgba(127,195,160,.55),0 2px 3px #000,0 0 22px #000;transition:opacity .4s;}',
    '.' + P + 'prog{position:absolute;right:30px;top:22px;z-index:50;pointer-events:none;padding:12px 22px;background:rgba(6,8,8,.66);' +
      'border:1px solid rgba(127,195,160,.35);border-radius:4px;color:#cfd8d0;font-size:26px;letter-spacing:.12em;display:flex;align-items:center;gap:14px;transition:opacity .8s;}',
    '.' + P + 'pip{width:16px;height:16px;transform:rotate(45deg);border:2px solid rgba(127,195,160,.6);transition:all .5s;}',
    '.' + P + 'pip.on{background:' + JADE + ';box-shadow:0 0 12px ' + JADE + ';}',
    '.' + P + 'pip.cur{border-color:' + AMBER + ';}',
    '.' + P + 'replay{position:absolute;right:30px;top:96px;z-index:55;padding:8px 20px;font-size:26px;letter-spacing:.1em;color:#cfd8d0;cursor:pointer;' +
      'background:rgba(6,8,8,.6);border:1px solid rgba(127,195,160,.4);border-radius:4px;transition:opacity .4s,border-color .2s,color .2s;}',
    '.' + P + 'replay:hover{color:#fff;border-color:' + AMBER + ';}',
    '.' + P + 'replay.off{opacity:0;pointer-events:none;}',
    '.' + P + 'root .gf-game-caption{width:max-content;max-width:1180px;box-sizing:border-box;}',
    '.' + P + 'root .gf-game-caption em{font-style:normal;color:' + AMBER + ';}'
  ].join('\n');

  /* ================================================================ 游戏 */
  GF.games.register('symbol_trace', {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, easy = !!ctx.easy;
        var A = ctx.audio || {};
        var dead = false, timers = [], raf = 0;
        function sfx(id) { try { if (A.sfx) A.sfx(id); } catch (e) { /* 音频可能未就绪 */ } }
        function wait(ms) { return new Promise(function (res) { timers.push(setTimeout(res, ms)); }); }
        function say(text, who) { try { return ctx.say(text, who); } catch (e) { return Promise.resolve(); } }
        function el(tag, cls, parent, html) {
          var e = document.createElement(tag);
          if (cls) e.className = cls;
          if (html != null) e.innerHTML = html;
          (parent || wrap).appendChild(e);
          return e;
        }

        root.classList.add(P + 'root');
        var style = document.createElement('style');
        style.textContent = CSS;
        root.appendChild(style);
        var wrap = document.createElement('div');
        wrap.className = P + 'wrap';
        root.appendChild(wrap);

        // —— 底图
        var bg = el('div', P + 'bg');
        function vectorBg() {
          var bgStr = '';
          try { bgStr = ctx.bgSvg('villa_room') || ''; } catch (e) { bgStr = ''; }
          if (!/<svg[\s>]/.test(bgStr)) bgStr = fallbackRoom();
          mountSvg(bg, bgStr);
        }
        var photo = '';
        try { photo = (ctx.bgImage && ctx.bgImage('villa_room')) || ''; } catch (e) { photo = ''; }
        if (photo) {
          var bgImg = document.createElement('img');
          bgImg.className = P + 'photo'; bgImg.alt = ''; bgImg.draggable = false;
          bgImg.onerror = function () { if (!dead) { bg.innerHTML = ''; wrap.classList.remove(P + 'isphoto'); vectorBg(); } };
          bgImg.src = photo;
          bg.appendChild(bgImg);
          wrap.classList.add(P + 'isphoto');
        } else vectorBg();
        try {   // 夏侯婴的剪影（角色画师的生成器存在时才画）
          if (GF.art && typeof GF.art.char === 'function') {
            var cs = GF.art.char('xiahouying', {});
            if (cs && /<svg/.test(cs)) el('div', P + 'char', null, cs);
          }
        } catch (e) { /* 忽略 */ }
        var dim = el('div', P + 'dim');
        el('div', P + 'vig');
        el('div', P + 'focus');
        var glow = el('div', P + 'glow');

        // —— 画布（按设备像素比提高分辨率）
        var cv = el('canvas', P + 'cv');
        var DPR = Math.min(2, window.devicePixelRatio || 1);
        cv.width = 1600 * DPR; cv.height = 900 * DPR;
        var g = cv.getContext('2d');

        var finger = el('div', P + 'finger', null, FINGER_SVG);
        var lidT = el('div', P + 'lid ' + P + 'lidt'), lidB = el('div', P + 'lid ' + P + 'lidb');

        // —— HUD
        var top = el('div', P + 'top', null,
          '<b>先看她的指尖怎么走，再按同样的顺序点击或拖过光点</b>' +
          '<span>连错会散掉重来 · 键盘：方向键选点，空格连接，R 重看</span>');
        var status = el('div', P + 'status');
        var prog = el('div', P + 'prog', null, '暗示符 <i class="' + P + 'pip"></i><i class="' + P + 'pip"></i><i class="' + P + 'pip"></i>');
        var pips = prog.querySelectorAll('.' + P + 'pip');
        var replayBtn = el('div', P + 'replay off', null, '↺ 再看一遍（R）');

        // —— 状态
        var gi = 0, phase = 'intro', conn = 0, errors = 0, totalErrors = 0, level = 0;
        var nodes = [], segs = [], segStart = [], flash = [], particles = [];
        var demo = null, trailFade = null, complete = null, failT = 0, failNode = -1, shakeT = 0;
        var pointer = { x: 0, y: 0, down: false, has: false, type: 'mouse' }, focusIdx = -1, hoverIdx = -1;
        var lidCur = 0, lidBlink = null, nextDroop = 0, droopT = 0, t0 = performance.now();
        var sway = { x: 0, y: 0 }, glyphAlpha = 0;

        function setStatus(t) { status.textContent = t || ''; }
        function updPips() {
          for (var i = 0; i < pips.length; i++) {
            pips[i].classList.toggle('on', i < gi || (i === gi && phase === 'complete'));
            pips[i].classList.toggle('cur', i === gi && phase !== 'complete');
          }
        }
        function applySleep(L) {
          dim.style.opacity = String(SLEEP.dim[L]);
          bg.style.filter = 'blur(' + SLEEP.blur[L] + 'px) brightness(' + SLEEP.bright[L] + ') saturate(' + (1 - L * 0.18) + ')';
        }
        applySleep(0);

        // —— 几何
        function buildGlyph(k) {
          var G = GLYPHS[k];
          nodes = G.nodes.map(function (n) { return { bx: BOX.x + n[0] * BOX.w, by: BOX.y + n[1] * BOX.h, x: 0, y: 0 }; });
          segs = [];
          for (var i = 0; i < nodes.length - 1; i++) segs.push({ a: i, b: i + 1, bend: G.bends[i] });
          flash = nodes.map(function () { return -1e9; });
          conn = 0; segStart = []; errors = 0; focusIdx = -1;
          updNodes(0);
        }
        function updNodes(t) {
          var amp = easy ? 0 : SLEEP.sway[level];
          sway.x = amp * Math.sin(t * 0.00065);
          sway.y = amp * 0.7 * Math.sin(t * 0.0009 + 1.3);
          var sh = 0;
          if (t - shakeT < 380) sh = (1 - (t - shakeT) / 380) * 9 * Math.sin((t - shakeT) * 0.09);
          for (var i = 0; i < nodes.length; i++) { nodes[i].x = nodes[i].bx + sway.x + sh; nodes[i].y = nodes[i].by + sway.y; }
        }
        function segCtrl(s) {
          var a = nodes[s.a], b = nodes[s.b], dx = b.x - a.x, dy = b.y - a.y, L = Math.sqrt(dx * dx + dy * dy) || 1;
          return { x: (a.x + b.x) / 2 + (-dy / L) * s.bend * L, y: (a.y + b.y) / 2 + (dx / L) * s.bend * L };
        }
        function segPoint(s, u) {
          var a = nodes[s.a], b = nodes[s.b], c = segCtrl(s), v = 1 - u;
          return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
        }
        function glyphCenter() { return { x: BOX.x + BOX.w / 2 + sway.x, y: BOX.y + BOX.h / 2 + sway.y }; }

        // —— 绘制
        function strokePath(fn, a, wm) {
          var passes = [[26, 'rgba(127,195,160,', 0.07], [12, 'rgba(127,195,160,', 0.18], [5, 'rgba(170,232,205,', 0.55], [2, 'rgba(238,255,248,', 0.95]];
          for (var i = 0; i < passes.length; i++) {
            g.beginPath(); fn();
            g.lineWidth = passes[i][0] * wm;
            g.strokeStyle = passes[i][1] + (passes[i][2] * a) + ')';
            g.stroke();
          }
        }
        function drawSeg(s, u0, u1, a, wm) {
          if (u1 <= u0) return;
          strokePath(function () {
            var n = Math.max(2, Math.ceil((u1 - u0) * 26)), p = segPoint(s, u0);
            g.moveTo(p.x, p.y);
            for (var i = 1; i <= n; i++) { p = segPoint(s, u0 + (u1 - u0) * i / n); g.lineTo(p.x, p.y); }
          }, a, wm);
        }
        function drawOrn(a) {
          var G = GLYPHS[gi], m = function (x, y) { return { x: BOX.x + x * BOX.w + sway.x, y: BOX.y + y * BOX.h + sway.y }; };
          G.orn.forEach(function (o) {
            if (o.t === 'line') {
              strokePath(function () { o.p.forEach(function (pt, i) { var q = m(pt[0], pt[1]); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); }, a, 0.6);
            } else if (o.t === 'ring') {
              var c = m(o.x, o.y);
              strokePath(function () { g.arc(c.x, c.y, o.r * BOX.w, 0, Math.PI * 2); }, a, 0.55);
            } else {
              var d = m(o.x, o.y);
              dot(d.x, d.y, 16, 0.5 * a);
            }
          });
        }
        function dot(x, y, r, a) {
          var gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(240,255,248,' + a + ')');
          gr.addColorStop(0.25, 'rgba(160,225,195,' + (a * 0.7) + ')');
          gr.addColorStop(1, 'rgba(127,195,160,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
        function drawNode(i, t, a) {
          var n = nodes[i], lit = i < conn, fl = Math.max(0, 1 - (t - flash[i]) / 600);
          var breathe = 0.75 + 0.25 * Math.sin(t * 0.004 + i * 1.7);
          if (lit) {
            dot(n.x, n.y, 30 + fl * 26, (0.85 + fl * 0.15) * a);
          } else {
            dot(n.x, n.y, 24 + fl * 30, (0.5 * breathe + fl * 0.8) * a);
            g.beginPath(); g.arc(n.x, n.y, 15, 0, Math.PI * 2);
            g.lineWidth = 2; g.strokeStyle = 'rgba(170,232,205,' + (0.62 * breathe * a) + ')'; g.stroke();
          }
          if (i === hoverIdx && phase === 'play' && !lit) {
            g.beginPath(); g.arc(n.x, n.y, 19, 0, Math.PI * 2);
            g.lineWidth = 2; g.strokeStyle = 'rgba(210,245,228,' + (0.6 * a) + ')'; g.stroke();
          }
          if (i === failNode && t - failT < 700) {
            var k = 1 - (t - failT) / 700;
            g.beginPath(); g.arc(n.x, n.y, 16 + (1 - k) * 20, 0, Math.PI * 2);
            g.lineWidth = 3; g.strokeStyle = 'rgba(214,120,96,' + (0.8 * k) + ')'; g.stroke();
          }
        }
        function drawHints(t, a) {
          if (phase !== 'play' || conn >= nodes.length) return;
          var showNext = conn === 0 || easy || errors >= 2;
          if (showNext) {
            var n = nodes[conn], k = (t % 1300) / 1300;
            g.beginPath(); g.arc(n.x, n.y, 14 + k * 26, 0, Math.PI * 2);
            g.lineWidth = 2; g.strokeStyle = 'rgba(224,181,106,' + (0.7 * (1 - k) * a) + ')'; g.stroke();
          }
          if (errors >= 3 || (easy && errors >= 1)) {
            g.font = '22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
            for (var i = conn; i < nodes.length; i++) {
              g.fillStyle = 'rgba(207,232,218,' + (0.75 * a) + ')';
              g.fillText(String(i + 1), nodes[i].x + 24, nodes[i].y - 24);
            }
          }
        }
        function drawFocus(a) {
          if (focusIdx < 0 || phase !== 'play') return;
          var n = nodes[focusIdx];
          g.save();
          g.setLineDash([6, 6]);
          g.beginPath(); g.arc(n.x, n.y, 26, 0, Math.PI * 2);
          g.lineWidth = 2.5; g.strokeStyle = 'rgba(224,181,106,' + (0.9 * a) + ')'; g.stroke();
          g.restore();
        }
        function spawn(x, y, n, spd, life, spread) {
          for (var i = 0; i < n; i++) {
            var ang = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.7);
            particles.push({ x: x + (Math.random() - 0.5) * (spread || 0), y: y + (Math.random() - 0.5) * (spread || 0),
              vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - spd * 0.2, life: life * (0.6 + Math.random() * 0.4), age: 0, s: 1 + Math.random() * 2.4 });
          }
        }
        function drawParticles(dt) {
          for (var i = particles.length - 1; i >= 0; i--) {
            var q = particles[i];
            q.age += dt;
            if (q.age >= q.life) { particles.splice(i, 1); continue; }
            q.x += q.vx * dt / 1000; q.y += q.vy * dt / 1000;
            q.vx *= 0.985; q.vy *= 0.985;
            var k = 1 - q.age / q.life;
            dot(q.x, q.y, q.s * 4, 0.7 * k);
          }
        }

        // —— 演示
        function demoTiming() { return { seg: easy ? 760 : 600, pause: 170, lead: 450 }; }
        function demoState(el) {
          var T = demoTiming(), e = el - T.lead;
          if (e < 0) return { seg: 0, u: 0, before: true };
          var per = T.seg + T.pause, k = Math.floor(e / per);
          if (k >= segs.length) return { seg: segs.length - 1, u: 1, done: true };
          var r2 = e - k * per, u = r2 < T.seg ? r2 / T.seg : 1;
          u = 0.5 - 0.5 * Math.cos(Math.PI * u);
          return { seg: k, u: u };
        }
        function runDemo() {
          return new Promise(function (res) {
            phase = 'demo';
            conn = 0; segStart = [];
            replayBtn.classList.add('off');
            setStatus('看好了');
            demo = { t0: performance.now(), lastNode: -1, res: res };
            finger.classList.add('on');
            sfx('whisper');
          });
        }
        function demoTick(t) {
          var st = demoState(t - demo.t0);
          var reached = st.before ? -1 : (st.done ? segs.length : st.seg + (st.u >= 1 ? 1 : 0));
          if (!st.before && demo.lastNode < 0) { demo.lastNode = 0; flash[0] = t; }
          while (demo.lastNode < reached) { demo.lastNode++; flash[demo.lastNode] = t; spawn(nodes[demo.lastNode].x, nodes[demo.lastNode].y, 8, 60, 700); }
          var tip = st.before ? { x: nodes[0].x, y: nodes[0].y } : segPoint(segs[st.seg], st.u);
          if (!st.before) {
            for (var i = 0; i < st.seg; i++) drawSeg(segs[i], 0, 1, 1, 1);
            drawSeg(segs[st.seg], 0, st.u, 1, 1);
          }
          if (Math.random() < 0.6) spawn(tip.x, tip.y, 1, 30, 650, 6);
          dot(tip.x, tip.y, 46, 0.9);
          dot(tip.x, tip.y, 12, 1);
          finger.style.transform = 'translate(' + f(tip.x) + 'px,' + f(tip.y) + 'px)';
          if (st.done && !demo.ending) {
            demo.ending = true;
            timers.push(setTimeout(function () {
              if (dead || !demo) return;
              var res = demo.res;
              demo = null;
              trailFade = { t0: performance.now() };
              finger.classList.remove('on');
              phase = 'play';
              setStatus('轮到你了');
              replayBtn.classList.remove('off');
              res();
            }, 380));
          }
        }

        // —— 玩家输入
        var R_HIT = easy ? 60 : 46, R_TIGHT = 26;
        function nearest(p, r) {
          var best = -1, bd = r;
          for (var i = 0; i < nodes.length; i++) {
            var d = Math.sqrt((nodes[i].x - p.x) * (nodes[i].x - p.x) + (nodes[i].y - p.y) * (nodes[i].y - p.y));
            if (d <= bd) { bd = d; best = i; }
          }
          return { i: best, d: bd };
        }
        function tryNode(i, mode, d) {
          if (phase !== 'play' || i < 0) return;
          if (i === conn) { connect(i); return; }
          if (i < conn) return;                    // 已连上的点：拖过去不算错
          if (mode === 'move' && d > R_TIGHT) return;  // 拖动时只是擦过旁边的点，不算错
          fail(i);
        }
        function connect(i) {
          var t = performance.now();
          conn++;
          flash[i] = t;
          if (i > 0) segStart[i - 1] = t;
          spawn(nodes[i].x, nodes[i].y, 10, 80, 700);
          sfx('click');
          if (trailFade) trailFade = null;
          if (conn >= nodes.length) completeGlyph();
        }
        var cbComplete = null;
        function fail(i) {
          var t = performance.now();
          phase = 'fail';
          errors++; totalErrors++;
          failT = t; failNode = i; shakeT = t;
          sfx('gust');
          setStatus('');
          // 已画出的笔画化作光尘散去
          for (var s = 0; s < conn - 1; s++) {
            for (var u = 0; u <= 1; u += 0.08) { var p = segPoint(segs[s], u); spawn(p.x, p.y, 1, 90, 900, 4); }
          }
          for (var k = 0; k < conn; k++) spawn(nodes[k].x, nodes[k].y, 6, 70, 800);
          conn = 0; segStart = [];
          pointer.down = false;
          replayBtn.classList.add('off');
          timers.push(setTimeout(function () {
            if (dead) return;
            say(LINES.fail[(errors - 1) % LINES.fail.length], 'xiahouying');
            timers.push(setTimeout(function () { if (!dead) runDemo(); }, 900));
          }, 650));
        }
        function completeGlyph() {
          phase = 'complete';
          complete = { t0: performance.now() };
          replayBtn.classList.add('off');
          setStatus('');
          updPips();
          sfx('bell');
          timers.push(setTimeout(function () {
            if (dead) return;
            var c = glyphCenter();
            spawn(c.x, c.y, 70, 520, 1300, BOX.w * 0.6);
          }, 450));
          if (cbComplete) { var cb = cbComplete; cbComplete = null; timers.push(setTimeout(function () { if (!dead) cb(); }, 1400)); }
        }
        function replay() {
          if (phase !== 'play' || dead) return;
          sfx('click');
          runDemo();
        }

        function onDown(e) {
          if (dead) return;
          if (e.button != null && e.button > 0) return;
          var p = ctx.toLocal(e);
          pointer.x = p.x; pointer.y = p.y; pointer.has = true; pointer.type = e.pointerType || 'mouse';
          if (phase !== 'play') return;
          pointer.down = true;
          try { root.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
          var h = nearest(p, R_HIT);
          tryNode(h.i, 'down', h.d);
        }
        function onMove(e) {
          if (dead) return;
          var p = ctx.toLocal(e), last = { x: pointer.x, y: pointer.y };
          pointer.x = p.x; pointer.y = p.y; pointer.has = true; pointer.type = e.pointerType || 'mouse';
          if (phase !== 'play') return;
          hoverIdx = nearest(p, R_HIT).i;
          cv.style.cursor = hoverIdx >= 0 ? 'pointer' : 'default';
          if (!pointer.down) return;
          // 快速拖动时插值检查，免得跳过光点
          var dx = p.x - last.x, dy = p.y - last.y, n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 10));
          for (var k = 1; k <= n && phase === 'play' && pointer.down; k++) {
            var q = { x: last.x + dx * k / n, y: last.y + dy * k / n }, h = nearest(q, R_HIT);
            tryNode(h.i, 'move', h.d);
          }
        }
        function onUp() { pointer.down = false; }
        function onKey(e) {
          if (dead) return;
          var k = e.key;
          var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
          if (dir) {
            e.preventDefault();
            if (phase !== 'play') return;
            if (focusIdx < 0) {
              var c = glyphCenter();
              focusIdx = nearest(c, 9999).i;
              return;
            }
            var from = nodes[focusIdx], best = -1, bs = 1e9;
            for (var i = 0; i < nodes.length; i++) {
              if (i === focusIdx) continue;
              var vx = nodes[i].x - from.x, vy = nodes[i].y - from.y, L = Math.sqrt(vx * vx + vy * vy);
              var cos = (vx * dir[0] + vy * dir[1]) / L;
              if (cos < 0.35) continue;
              var score = L * (1 + (1 - cos) * 2.5);
              if (score < bs) { bs = score; best = i; }
            }
            if (best >= 0) focusIdx = best;
          } else if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
            e.preventDefault();
            if (e.repeat || phase !== 'play') return;
            if (focusIdx < 0) { focusIdx = nearest(glyphCenter(), 9999).i; return; }
            tryNode(focusIdx, 'down', 0);
          } else if (k === 'r' || k === 'R') {
            replay();
          }
        }
        root.addEventListener('pointerdown', onDown);
        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerup', onUp);
        root.addEventListener('pointercancel', onUp);
        window.addEventListener('keydown', onKey);
        replayBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); replay(); });

        // —— 主循环
        var lastT = performance.now();
        function frame(t) {
          if (dead) return;
          var dt = Math.min(50, t - lastT);
          lastT = t;
          updNodes(t - t0);
          g.setTransform(DPR, 0, 0, DPR, 0, 0);
          g.clearRect(0, 0, 1600, 900);
          g.globalCompositeOperation = 'lighter';
          g.lineCap = 'round'; g.lineJoin = 'round';
          glyphAlpha = Math.min(1, glyphAlpha + dt / 700);
          var a = phase === 'intro' ? glyphAlpha : 1;

          if (phase === 'complete' && complete) {
            var ce = t - complete.t0, flare = Math.min(1, ce / 450), abs = Math.max(0, Math.min(1, (ce - 450) / 900));
            var sc = 1 + abs * abs * 1.3, al = 1 - abs;
            var c = glyphCenter();
            g.save();
            g.translate(c.x, c.y); g.scale(sc, sc); g.translate(-c.x, -c.y);
            for (var s = 0; s < segs.length; s++) drawSeg(segs[s], 0, 1, al, 1 + (1 - abs) * 0.35 * flare);
            drawOrn(al * flare);
            for (var i = 0; i < nodes.length; i++) drawNode(i, t, al);
            g.restore();
          } else if (nodes.length) {
            for (i = 0; i < nodes.length; i++) drawNode(i, t, a);
            if (phase === 'demo' && demo) demoTick(t);
            if (trailFade) {   // 演示轨迹慢慢淡去
              var fa = 1 - (t - trailFade.t0) / 900;
              if (fa <= 0) trailFade = null;
              else for (s = 0; s < segs.length; s++) drawSeg(segs[s], 0, 1, fa * 0.8, 1);
            }
            if (phase === 'play' || phase === 'fail') {
              for (s = 0; s < conn - 1; s++) {
                var u = Math.min(1, (t - (segStart[s] || 0)) / 200);
                drawSeg(segs[s], 0, u, 1, 1);
              }
              if (phase === 'play' && pointer.down && conn > 0 && conn < nodes.length) {
                var ln = nodes[conn - 1];
                g.beginPath(); g.moveTo(ln.x, ln.y); g.lineTo(pointer.x, pointer.y);
                g.lineWidth = 3; g.strokeStyle = 'rgba(160,225,195,.35)'; g.stroke();
                dot(pointer.x, pointer.y, 18, 0.5);
              }
              drawHints(t, a);
              drawFocus(a);
            }
          }
          drawParticles(dt);
          g.globalCompositeOperation = 'source-over';

          // 眼皮：静息高度 + 困倦时的下垂 + 完成后的眨眼
          var target = SLEEP.lid[level];
          if (!easy && level >= 1 && level < 3 && phase !== 'end') {
            if (!nextDroop) nextDroop = t + (level === 1 ? 8000 : 5500);
            if (t > nextDroop) { droopT = t; nextDroop = t + (level === 1 ? 9000 : 6000) + Math.random() * 2000; }
            var de = (t - droopT) / 1500;
            if (de >= 0 && de <= 1) target += Math.sin(de * Math.PI) * (level === 1 ? 36 : 70);
          }
          if (lidBlink) {
            var be = (t - lidBlink.t0) / lidBlink.dur;
            if (be >= 1) lidBlink = null;
            else target = Math.max(target, Math.sin(be * Math.PI) * lidBlink.depth);
          }
          lidCur += (target - lidCur) * Math.min(1, dt / (phase === 'end' ? 260 : 140));
          lidT.style.transform = 'translateY(' + f(lidCur) + 'px)';
          lidB.style.transform = 'translateY(' + f(-lidCur) + 'px)';
          raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);

        function cleanup() {
          dead = true;
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
          window.removeEventListener('keydown', onKey);
          root.removeEventListener('pointerdown', onDown);
          root.removeEventListener('pointermove', onMove);
          root.removeEventListener('pointerup', onUp);
          root.removeEventListener('pointercancel', onUp);
        }

        // —— 流程
        function playGlyph() {
          return new Promise(function (res) {
            cbComplete = res;
          });
        }
        root.__debug = {
          phase: function () { return phase; },
          glyph: function () { return gi; },
          conn: function () { return conn; },
          focus: function () { return focusIdx; },
          errors: function () { return totalErrors; },
          nodes: function () { return nodes.map(function (n) { return { x: n.x, y: n.y }; }); }
        };

        async function main() {
          updPips();
          await wait(350);
          if (dead) return;
          await say(LINES.intro);
          if (dead) return;
          say(LINES.introYing, 'xiahouying');
          for (gi = 0; gi < GLYPHS.length; gi++) {
            buildGlyph(gi);
            phase = 'intro'; glyphAlpha = 0;
            updPips();
            await wait(900);
            if (dead) return;
            var done = playGlyph();
            await runDemo();
            if (dead) return;
            await done;
            if (dead) return;
            // 符光沉进眼里：画面暗一级，眨一次沉重的眼
            level = gi + 1;
            nodes = []; segs = []; complete = null;
            if (level < 3) {
              applySleep(level);
              glow.style.opacity = String(1 - level * 0.3);
              lidBlink = { t0: performance.now(), dur: 1300, depth: 300 };
              sfx('whisper');
              await wait(900);
              if (dead) return;
              if (level === 1) await say(LINES.after1);
              else { await say(LINES.after2); if (dead) return; say(LINES.after2Ying, 'xiahouying'); }
              if (dead) return;
            }
          }
          // 结束演出：闭眼、画面沉入黑暗
          phase = 'end';
          setStatus('');
          top.style.opacity = '0'; prog.style.opacity = '0';
          applySleep(3);
          glow.style.opacity = '0';
          var sp = say(LINES.end);
          await wait(1400);
          if (dead) return;
          await sp;
          if (dead) return;
          await wait(300);
          if (dead) return;
          cleanup();
          resolve('win');
        }
        main().catch(function (err) {
          if (window.console) console.error(err);
          if (!dead) { cleanup(); resolve('win'); }
        });
      });
    }
  });
})();
