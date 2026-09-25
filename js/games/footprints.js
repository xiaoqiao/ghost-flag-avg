/*
 * 小游戏 footprints —— 愤怒的三角形墓室：踩着卫不回的红脚印走到尖端的拱门。
 * 画面：俯视网格（7 列 × 9 行大理石地砖，三角形：下方入口最宽，尖端只剩一格宽的拱门），
 *       三具白骨、满地短铁矢；顶上淡淡叠一层 ctx.bgImage('heart_anger') 作氛围。
 * 玩法：“愤怒”每隔几秒让画面泛红，泛红时脚印几乎看不见；右下“看手心”（夏侯婴画的符）点一下，
 *       2 秒内画面清晰、脚印变亮，冷却 5 秒。按顺序点下一个脚印格（只能迈到相邻 8 格）。
 *       点错 → 箭雨 → 'lose'（简单模式第一次点错只警告）；走到尖端拱门 → 'win'。
 * 操作：鼠标 / 触摸点格子；键盘方向键（WASD）选格、空格 / 回车迈步、F 或 H 看手心。
 * 测试钩子：.gfg-footprints-stage 的 data-state（intro/play/rain/done）、data-step（已走步数）、
 *           data-cur / data-next（"列,行"）、data-anger（0–1）、data-palm（1=手心生效）、data-cd（冷却剩余秒）、data-kb（键盘光标格）。
 */
(function () {
  'use strict';
  var GF = window.GF;
  var ID = 'footprints', P = 'gfg-footprints-';
  var W = 1600, H = 900;
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';
  var COLS = 7, ROWS = 9, CELL = 86, X0 = 800 - COLS * CELL / 2, Y0 = 58;
  var HW = [0, 1, 1, 2, 2, 2, 3, 3, 3];                    // 每行以第 3 列为中心的半宽 → 1,3,3,5,5,5,7,7,7 格
  var START = [3, 9];                                      // 入口（棋盘下方）
  var PATH = [[2, 8], [1, 7], [0, 6], [1, 5], [2, 5], [3, 5], [4, 5], [5, 4], [4, 3], [3, 2], [2, 1], [3, 0]];
  var SKELS = [{ c: 1, r: 6, rot: 28 }, { c: 4, r: 4, rot: -52 }, { c: 3, r: 1, rot: 172 }];
  var PALM_MS = 2000;

  var CSS = [
    '.P-stage{position:absolute;inset:0;overflow:hidden;background:#080505;font-family:' + FONT + ';color:#efe6d2}',
    '.P-bgimg{position:absolute;inset:-20px;width:1640px;height:940px;object-fit:cover;filter:brightness(.34) saturate(.8) blur(2px)}',
    '.P-bgalt{position:absolute;inset:0;filter:brightness(.3)}.P-bgalt svg{width:100%;height:100%}',
    '.P-shade{position:absolute;inset:0;background:radial-gradient(ellipse 36% 60% at 50% 50%,rgba(8,5,5,.35),rgba(8,5,5,.9) 100%)}',
    '.P-shake{position:absolute;inset:0;will-change:transform}',
    '.P-board{position:absolute;left:0;top:0;width:1600px;height:900px;transition:filter .5s}',
    '.P-board.P-angry{filter:blur(1.4px) saturate(1.3)}',
    '.P-board text{font-family:' + FONT + '}',
    '.P-prints{transition:filter .25s}',
    '.P-prints.P-lit{filter:drop-shadow(0 0 6px rgba(255,90,70,.9))}',
    '.P-light{position:absolute;inset:0;pointer-events:none}',
    '.P-red{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:multiply;' +
      'background:radial-gradient(ellipse 60% 70% at 50% 50%,rgba(210,40,30,.85),rgba(120,0,0,1) 90%)}',
    '.P-redglow{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse 55% 65% at 50% 50%,rgba(255,60,40,.22),rgba(255,40,20,.05) 70%)}',
    '.P-atmo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.13;mix-blend-mode:screen;pointer-events:none}',
    '.P-rain{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none}',
    '.P-flash{position:absolute;inset:0;background:#ff2a18;opacity:0;pointer-events:none;mix-blend-mode:screen}',
    '.P-panel{position:absolute;left:44px;top:70px;width:400px;pointer-events:none}',
    '.P-tag{font-size:22px;color:#e0b56a;letter-spacing:.3em}',
    '.P-obj{font-size:30px;line-height:1.5;margin-top:10px;color:#efe6d2;text-shadow:0 0 10px #000}',
    '.P-count{font-size:28px;margin-top:22px;color:#cdbf9f;letter-spacing:.08em}.P-count b{color:#e0b56a;font-size:40px;font-weight:normal}',
    '.P-help{font-size:26px;line-height:1.6;margin-top:22px;color:#9c917c}',
    '.P-msg{position:absolute;left:44px;top:520px;width:400px;font-size:28px;line-height:1.6;color:#efe6d2;opacity:0;transition:opacity .35s;' +
      'padding:16px 20px;border-left:3px solid #e0b56a;background:linear-gradient(90deg,rgba(20,12,10,.85),rgba(20,12,10,0));pointer-events:none;text-shadow:0 0 8px #000}',
    '.P-msg.P-on{opacity:1}.P-msg.P-warn{border-left-color:#c8402e}',
    '.P-palm{position:absolute;left:1236px;top:612px;width:300px;height:250px;border-radius:16px;border:2px solid rgba(224,181,106,.6);' +
      'background:linear-gradient(rgba(34,22,16,.9),rgba(14,9,7,.94));display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.7);transition:border-color .2s,box-shadow .3s,transform .12s;touch-action:none;outline:none}',
    '.P-palm:hover,.P-palm:focus-visible{border-color:#e0b56a}',
    '.P-palm.P-cool{cursor:default;border-color:rgba(120,100,80,.4)}',
    '.P-palm.P-active{border-color:#fff1cf;box-shadow:0 0 50px rgba(224,181,106,.55),inset 0 0 40px rgba(224,181,106,.2)}',
    '.P-palm.P-nudge{animation:' + P + 'nudge 1s ease-in-out infinite}',
    '@keyframes ' + P + 'nudge{0%,100%{box-shadow:0 0 0 rgba(224,181,106,0)}50%{box-shadow:0 0 44px rgba(224,181,106,.75);transform:scale(1.03)}}',
    '.P-palmicon{position:relative;width:132px;height:132px}',
    '.P-palmicon svg{position:absolute;inset:0;width:100%;height:100%}',
    '.P-ring{position:absolute;inset:-6px;border-radius:50%;opacity:0}',
    '.P-palmt{font-size:34px;letter-spacing:.3em;margin-left:.3em;margin-top:8px;color:#efe6d2}',
    '.P-palms{font-size:24px;color:#a99d86;letter-spacing:.08em}',
    '.P-palm.P-cool .P-palmt{color:#7d7462}'
  ].join('\n').replace(/\.P-/g, '.' + P);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function n1(v) { return Math.round(v * 10) / 10; }
  function valid(c, r) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && Math.abs(c - 3) <= HW[r]; }
  function ccx(c) { return X0 + (c + 0.5) * CELL; }
  function ccy(r) { return Y0 + (r + 0.5) * CELL; }
  function key(c, r) { return c + ',' + r; }
  function isSkel(c, r) { for (var i = 0; i < SKELS.length; i++) if (SKELS[i].c === c && SKELS[i].r === r) return true; return false; }

  /* ---------------- 静态棋盘 SVG ---------------- */
  function boardSvg() {
    var R = rng(20260924), s = '';
    s += '<svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" width="1600" height="900">';
    s += '<defs>' +
      '<linearGradient id="' + P + 'm0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bdb6a9"/><stop offset=".55" stop-color="#a39c8f"/><stop offset="1" stop-color="#8b8478"/></linearGradient>' +
      '<linearGradient id="' + P + 'm1" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4ad9f"/><stop offset=".6" stop-color="#9a9285"/><stop offset="1" stop-color="#857e72"/></linearGradient>' +
      '<radialGradient id="' + P + 'rock" cx=".5" cy=".55" r=".7"><stop offset="0" stop-color="#241c18"/><stop offset="1" stop-color="#0b0807"/></radialGradient>' +
      '<radialGradient id="' + P + 'arch" cx=".5" cy="1" r="1"><stop offset="0" stop-color="#1a0f0a"/><stop offset="1" stop-color="#020101"/></radialGradient>' +
      '</defs>';
    // 岩体
    var bx0 = X0 - 46, bx1 = X0 + COLS * CELL + 46, by0 = 4, by1 = Y0 + ROWS * CELL;
    s += '<rect x="' + bx0 + '" y="' + by0 + '" width="' + (bx1 - bx0) + '" height="' + (by1 - by0) + '" rx="10" fill="url(#' + P + 'rock)"/>';
    for (var k = 0; k < 26; k++) {   // 岩壁裂纹
      var kx = bx0 + R() * (bx1 - bx0), ky = by0 + R() * (by1 - by0);
      s += '<path d="M' + n1(kx) + ' ' + n1(ky) + ' l' + n1((R() - .5) * 40) + ' ' + n1(R() * 30) + ' l' + n1((R() - .5) * 30) + ' ' + n1(R() * 26) + '" stroke="#352a24" stroke-width="1.5" fill="none" opacity=".7"/>';
    }
    // 大理石地砖
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (!valid(c, r)) continue;
      var x = X0 + c * CELL, y = Y0 + r * CELL;
      s += '<rect x="' + (x + 1.5) + '" y="' + (y + 1.5) + '" width="' + (CELL - 3) + '" height="' + (CELL - 3) + '" rx="2" fill="url(#' + P + 'm' + ((c + r) % 2) + ')"/>';
      s += '<rect x="' + (x + 1.5) + '" y="' + (y + 1.5) + '" width="' + (CELL - 3) + '" height="' + (CELL - 3) + '" rx="2" fill="#5a4c3e" opacity="' + (0.05 + R() * 0.14).toFixed(2) + '"/>';
      for (var v = 0; v < 2; v++) {   // 纹理
        var vx = x + 6 + R() * (CELL - 12), vy = y + 4, ex = x + 6 + R() * (CELL - 12), ey = y + CELL - 4;
        s += '<path d="M' + n1(vx) + ' ' + n1(vy) + ' Q' + n1(x + R() * CELL) + ' ' + n1(y + R() * CELL) + ' ' + n1(ex) + ' ' + n1(ey) + '" stroke="#8a8173" stroke-width="' + (0.8 + R()).toFixed(1) + '" fill="none" opacity=".45"/>';
      }
    }
    // 墙沿（阶梯状三角形轮廓）
    var pts = [], rr;
    for (rr = ROWS - 1; rr >= 0; rr--) { var xl = X0 + (3 - HW[rr]) * CELL; pts.push([xl, Y0 + (rr + 1) * CELL], [xl, Y0 + rr * CELL]); }
    for (rr = 0; rr < ROWS; rr++) { var xr = X0 + (4 + HW[rr]) * CELL; pts.push([xr, Y0 + rr * CELL], [xr, Y0 + (rr + 1) * CELL]); }
    var d = 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
    s += '<path d="' + d + '" fill="none" stroke="#050303" stroke-width="10" stroke-linejoin="miter"/>';
    s += '<path d="' + d + '" fill="none" stroke="#6b5440" stroke-width="2" opacity=".8"/>';
    // 尖端拱门
    var ax = X0 + 3 * CELL, aw = CELL;
    s += '<path d="M' + (ax + 4) + ' ' + (Y0 + 2) + ' L' + (ax + 4) + ' ' + (Y0 - 18) + ' A' + (aw / 2 - 4) + ' ' + (aw / 2 - 4) + ' 0 0 1 ' + (ax + aw - 4) + ' ' + (Y0 - 18) + ' L' + (ax + aw - 4) + ' ' + (Y0 + 2) + ' Z" fill="url(#' + P + 'arch)" stroke="#9a7a4c" stroke-width="3"/>';
    s += '<text x="' + (ax + aw / 2) + '" y="' + (Y0 - 24) + '" text-anchor="middle" font-size="22" fill="#e0b56a" opacity=".85">拱门</text>';
    // 入口
    var ey0 = Y0 + ROWS * CELL;
    s += '<rect x="' + X0 + '" y="' + (ey0 + 6) + '" width="' + (COLS * CELL) + '" height="' + (H - ey0 - 6) + '" fill="#171110" opacity=".85"/>';
    for (var st = 0; st < 3; st++) s += '<line x1="' + (X0 + 10) + '" x2="' + (X0 + COLS * CELL - 10) + '" y1="' + (ey0 + 18 + st * 18) + '" y2="' + (ey0 + 18 + st * 18) + '" stroke="#3a2e26" stroke-width="2"/>';
    s += '<text x="' + (X0 + 40) + '" y="' + (ey0 + 48) + '" font-size="22" fill="#8c7f69">入口</text>';
    // 满地短铁矢
    s += '<g>';
    for (var a = 0; a < 72; a++) {
      var ac, ar; do { ac = (R() * COLS) | 0; ar = (R() * ROWS) | 0; } while (!valid(ac, ar));
      var px = X0 + ac * CELL + 8 + R() * (CELL - 16), py = Y0 + ar * CELL + 8 + R() * (CELL - 16), ang = R() * 360, len = 22 + R() * 14;
      s += '<g transform="translate(' + n1(px) + ' ' + n1(py) + ') rotate(' + n1(ang) + ')" opacity=".78">' +
        '<line x1="' + n1(-len / 2) + '" y1="1.5" x2="' + n1(len / 2) + '" y2="1.5" stroke="#000" stroke-width="3" opacity=".35"/>' +
        '<line x1="' + n1(-len / 2) + '" y1="0" x2="' + n1(len / 2) + '" y2="0" stroke="#2e2a26" stroke-width="3" stroke-linecap="round"/>' +
        '<line x1="' + n1(-len / 2) + '" y1="-.8" x2="' + n1(len / 2 - 4) + '" y2="-.8" stroke="#7a7064" stroke-width="1"/>' +
        '<path d="M' + n1(len / 2) + ' -4 L' + n1(len / 2 + 8) + ' 0 L' + n1(len / 2) + ' 4 Z" fill="#26221f"/>' +
        '<path d="M' + n1(-len / 2) + ' 0 l-5 -4 M' + n1(-len / 2) + ' 0 l-5 4" stroke="#4a4038" stroke-width="1.6"/></g>';
    }
    s += '</g>';
    // 三具白骨
    SKELS.forEach(function (k) { s += skeleton(ccx(k.c), ccy(k.r), k.rot); });
    s += '</svg>';
    return s;
  }

  function skeleton(x, y, rot) {
    function bones(col, w, fillSkull) {
      var g = '<g stroke="' + col + '" stroke-linecap="round" stroke-linejoin="round" fill="none">';
      g += '<ellipse cx="0" cy="-40" rx="' + (12 + w / 2) + '" ry="' + (14 + w / 2) + '" fill="' + fillSkull + '" stroke="none"/>';
      g += '<path d="M0 -26 L0 22" stroke-width="' + (3.5 + w) + '"/>';
      for (var i = 0; i < 4; i++) { var ry = -20 + i * 7; g += '<path d="M-1 ' + ry + ' q-15 1 -16 10 M1 ' + ry + ' q15 1 16 10" stroke-width="' + (2.4 + w) + '"/>'; }
      g += '<ellipse cx="0" cy="27" rx="11" ry="6" stroke-width="' + (3 + w) + '"/>';
      g += '<path d="M-8 -22 L-26 -4 L-36 16 M8 -22 L24 -8 L40 -12" stroke-width="' + (3 + w) + '"/>';
      g += '<path d="M-6 31 L-12 56 L-10 80 M6 31 L16 54 L26 74" stroke-width="' + (3.2 + w) + '"/>';
      return g + '</g>';
    }
    var g = '<g transform="translate(' + n1(x) + ' ' + n1(y) + ') rotate(' + rot + ') scale(.84)">';
    g += '<g transform="translate(3 4)" opacity=".55">' + bones('#140e0b', 5, '#140e0b') + '</g>';   // 投影
    g += bones('#3b2f26', 3.2, '#3b2f26');                                                        // 暗边
    g += bones('#e6dfcc', 0, '#e6dfcc');
    g += '<circle cx="-4.5" cy="-42" r="3.4" fill="#1e1814"/><circle cx="4.5" cy="-42" r="3.4" fill="#1e1814"/><path d="M-1.5 -34 L0 -31 L1.5 -34" stroke="#1e1814" stroke-width="1.6" fill="none"/>';
    g += '<line x1="-18" y1="-6" x2="-2" y2="-30" stroke="#1c1916" stroke-width="3.2"/>';   // 插在骨头上的铁矢
    g += '<line x1="10" y1="6" x2="30" y2="-12" stroke="#1c1916" stroke-width="3.2"/>';
    return g + '</g>';
  }

  /** 一个格子里的一对红脚印（朝向下一格） */
  function footSvg(i) {
    var cur = PATH[i], nxt = PATH[i + 1], prv = i > 0 ? PATH[i - 1] : START;
    var dx, dy;
    if (nxt) { dx = nxt[0] - prv[0]; dy = nxt[1] - prv[1]; } else { dx = 0; dy = -1; }
    var ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    var sole = 'M0 -13 C6 -13 7 -5 6 1 C5 5 3 6 0 6 C-3 6 -5 5 -6 1 C-7 -5 -6 -13 0 -13 Z';
    var heel = 'M0 8 C4 8 5 11 4.5 14 C4 17 -4 17 -4.5 14 C-5 11 -4 8 0 8 Z';
    function one(ox, oy, t) {
      return '<g transform="translate(' + ox + ' ' + oy + ') rotate(' + t + ')"><path d="' + sole + '"/><path d="' + heel + '"/></g>';
    }
    return '<g class="' + P + 'fp" data-i="' + i + '" transform="translate(' + n1(ccx(cur[0])) + ' ' + n1(ccy(cur[1])) + ') rotate(' + n1(ang) + ')" fill="#b3241c" stroke="#5a0c08" stroke-width="1">' +
      one(-10, 9, -6) + one(10, -11, 5) + '</g>';
  }

  function palmIconSvg() {
    return '<svg viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="66" cy="66" r="62" fill="#1a110c" stroke="#6b5440" stroke-width="2"/>' +
      '<path d="M44 112 C38 96 32 82 30 70 C29 64 36 62 39 68 L44 80 L44 36 C44 30 52 30 52 36 L53 64 L54 28 C54 22 63 22 63 28 L63 63 L65 30 C65 24 74 24 74 30 L74 65 L77 40 C78 34 86 35 85 41 L83 82 C82 96 78 104 74 112 Z" fill="#c9a98a" stroke="#6e5238" stroke-width="2"/>' +
      '<g stroke="#b3241c" stroke-width="2.6" fill="none" stroke-linecap="round">' +
      '<path d="M50 76 L78 76 M64 70 L64 102 M54 86 Q64 80 74 86 M52 96 L58 90 L64 98 L70 90 L76 96"/><circle cx="64" cy="70" r="3" fill="#b3241c"/></g></svg>';
  }

  GF.games.register(ID, {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, audio = ctx.audio || {};
        var EASY = !!ctx.easy;
        var CALM = EASY ? 2.8 : 1.9, RISE = 0.55, RED = EASY ? 1.9 : 2.6, FALL = 0.6, CYCLE = CALM + RISE + RED + FALL;
        var CALM_VIS = EASY ? 0.5 : 0.36;
        var COOLDOWN = EASY ? 3.5 : 5;
        var rafId = 0, timers = [], ended = false;
        function later(fn, ms) { var t = setTimeout(function () { if (!ended) fn(); }, ms); timers.push(t); return t; }
        function au(fn, a) { try { if (audio[fn]) audio[fn](a); } catch (e) { /* 静默 */ } }

        /* ---------- DOM ---------- */
        var stl = document.createElement('style'); stl.textContent = CSS; root.appendChild(stl);
        var stage = document.createElement('div');
        stage.className = P + 'stage';
        var fps = ''; for (var i = 0; i < PATH.length; i++) fps += footSvg(i);
        stage.innerHTML =
          '<div class="' + P + 'bgwrap"></div><div class="' + P + 'shade"></div>' +
          '<div class="' + P + 'shake">' +
            '<div class="' + P + 'board">' + boardSvg() + '</div>' +
            '<svg class="' + P + 'board ' + P + 'dyn" viewBox="0 0 1600 900" width="1600" height="900" style="position:absolute;left:0;top:0" xmlns="http://www.w3.org/2000/svg">' +
              '<g class="' + P + 'trail" opacity=".62"></g>' +
              '<g class="' + P + 'prints">' + fps + '</g>' +
              '<rect class="' + P + 'hov" width="' + (CELL - 6) + '" height="' + (CELL - 6) + '" rx="4" fill="rgba(224,181,106,.12)" stroke="#e0b56a" stroke-width="2" stroke-dasharray="7 5" opacity="0"/>' +
              '<rect class="' + P + 'kb" width="' + (CELL - 10) + '" height="' + (CELL - 10) + '" rx="4" fill="none" stroke="#efe6d2" stroke-width="3" opacity="0"/>' +
              '<rect class="' + P + 'cur" width="' + (CELL - 4) + '" height="' + (CELL - 4) + '" rx="4" fill="rgba(224,181,106,.18)" stroke="#e0b56a" stroke-width="3.5"/>' +
              '<g class="' + P + 'me"><circle r="17" fill="#1a120c" stroke="#e0b56a" stroke-width="3"/><text y="8" text-anchor="middle" font-size="22" fill="#efe6d2">我</text></g>' +
            '</svg>' +
            '<div class="' + P + 'light"></div>' +
            '<div class="' + P + 'red"></div><div class="' + P + 'redglow"></div>' +
            '<div class="' + P + 'atmowrap"></div>' +
            '<canvas class="' + P + 'rain" width="1600" height="900"></canvas>' +
          '</div>' +
          '<div class="' + P + 'panel">' +
            '<div class="' + P + 'tag">愤 怒 之 室</div>' +
            '<div class="' + P + 'obj">踩着卫不回留下的红脚印，一格一格走到尖端的拱门。</div>' +
            '<div class="' + P + 'count">脚印 <b class="' + P + 'n">0</b> / ' + PATH.length + '</div>' +
            '<div class="' + P + 'help">点身边相邻的格子迈步<br>方向键选格 · 空格迈步<br>F 键 · 看手心</div>' +
          '</div>' +
          '<div class="' + P + 'msg"></div>' +
          '<div class="' + P + 'palm" tabindex="0" role="button" aria-label="看手心">' +
            '<div class="' + P + 'palmicon">' + palmIconSvg() + '<div class="' + P + 'ring"></div></div>' +
            '<div class="' + P + 'palmt">看手心</div><div class="' + P + 'palms">夏侯婴画的符 · F</div>' +
          '</div>' +
          '<div class="' + P + 'flash"></div>';
        root.appendChild(stage);
        function $(n) { return stage.querySelector('.' + P + n); }
        var shakeEl = $('shake'), boardEls = stage.querySelectorAll('.' + P + 'board'), prints = $('prints'), trail = $('trail');
        var hov = $('hov'), kbR = $('kb'), curR = $('cur'), me = $('me'), light = $('light'), red = $('red'), redglow = $('redglow');
        var canvas = $('rain'), g2 = canvas.getContext('2d'), flash = $('flash'), msgEl = $('msg'), countN = $('n');
        var palm = $('palm'), ring = $('ring'), palmS = $('palms');

        // 底图：愤怒的插画（压暗、模糊）+ 顶上一层淡淡的同一张图；缺失时退回矢量图 / 纯色
        var bgUrl = ctx.bgImage ? ctx.bgImage('heart_anger') : '';
        function svgFallback() {
          var svg = ctx.bgSvg ? ctx.bgSvg('heart_anger') : '';
          $('bgwrap').innerHTML = svg ? '<div class="' + P + 'bgalt">' + svg + '</div>' : '';
          $('atmowrap').innerHTML = '';
        }
        if (bgUrl) {
          var im = document.createElement('img'); im.className = P + 'bgimg'; im.alt = ''; im.draggable = false;
          im.onerror = function () { if (!ended) svgFallback(); };
          im.src = bgUrl; $('bgwrap').appendChild(im);
          var im2 = document.createElement('img'); im2.className = P + 'atmo'; im2.alt = ''; im2.draggable = false;
          im2.onerror = function () { if (im2.parentNode) im2.remove(); };
          im2.src = bgUrl; $('atmowrap').appendChild(im2);
        } else svgFallback();

        /* ---------- 状态 ---------- */
        var S = { state: 'intro', step: 0, cur: START.slice(), warned: false, palmUntil: 0, cdUntil: 0, firstAnger: false, palmUsed: false };
        var T = 0, lastT = 0, anger = 0, vis = CALM_VIS, kb = null, msgTimer = 0, shake = 0, flashA = 0, rain = null, lastFar = 0;
        var nowS = function () { return performance.now() / 1000; };

        function setData() {
          stage.setAttribute('data-state', S.state);
          stage.setAttribute('data-step', String(S.step));
          stage.setAttribute('data-cur', key(S.cur[0], S.cur[1]));
          var n = PATH[S.step]; stage.setAttribute('data-next', n ? key(n[0], n[1]) : '');
        }
        function place(el, c, r, sz) { el.setAttribute('x', n1(X0 + c * CELL + (CELL - sz) / 2)); el.setAttribute('y', n1(Y0 + r * CELL + (CELL - sz) / 2)); }
        function placeMe(animate) {
          var c = S.cur[0], r = S.cur[1];
          place(curR, c, r, CELL - 4);
          curR.setAttribute('opacity', r >= ROWS ? '0' : '1');
          var tx = ccx(c), ty = ccy(r) + (r >= ROWS ? -14 : 0);
          me.style.transition = animate ? 'transform .28s ease-out' : 'none';
          me.style.transform = 'translate(' + n1(tx) + 'px,' + n1(ty) + 'px)';
          light.style.background = 'radial-gradient(circle 420px at ' + n1(tx) + 'px ' + n1(ty) + 'px,rgba(0,0,0,0) 0%,rgba(0,0,0,.2) 40%,rgba(4,2,2,.8) 100%)';
        }
        function msg(text, warn, ms) {
          msgEl.textContent = text; msgEl.classList.toggle(P + 'warn', !!warn); msgEl.classList.add(P + 'on');
          clearTimeout(msgTimer); msgTimer = setTimeout(function () { msgEl.classList.remove(P + 'on'); }, ms || 3200); timers.push(msgTimer);
        }
        setData(); placeMe(false);

        /* ---------- 看手心 ---------- */
        function usePalm() {
          if (ended || S.state !== 'play') return;
          var t = nowS();
          if (t < S.cdUntil) { msg('符还在手心里发烫……再等一等。', false, 1600); return; }
          S.palmUntil = t + PALM_MS / 1000; S.cdUntil = t + COOLDOWN;
          palm.classList.remove(P + 'nudge');
          au('sfx', 'clue');
          if (!S.palmUsed) { S.palmUsed = true; msg('我摊开手掌，死死盯住那道符。心头的火，一下子被压了下去。'); }
        }
        palm.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); usePalm(); });

        /* ---------- 迈步 ---------- */
        function cellAt(x, y) {
          var c = Math.floor((x - X0) / CELL), r = Math.floor((y - Y0) / CELL);
          return valid(c, r) ? [c, r] : null;
        }
        function tryStep(c, r) {
          if (S.state !== 'play') return;
          var cc = S.cur[0], cr = S.cur[1];
          if (c === cc && r === cr) return;
          if (Math.abs(c - cc) > 1 || Math.abs(r - cr) > 1) {
            var t = nowS(); if (t - lastFar > 1.2) { lastFar = t; msg('一步迈不了那么远。只能踩身边的格子。', false, 1800); }
            return;
          }
          var nx = PATH[S.step];
          if (nx && c === nx[0] && r === nx[1]) {
            S.cur = [c, r]; S.step++;
            var fp = prints.querySelector('[data-i="' + (S.step - 1) + '"]'); if (fp) trail.appendChild(fp);
            countN.textContent = String(S.step);
            au('sfx', 'footsteps');
            placeMe(true); setData();
            kb = null; kbR.setAttribute('opacity', '0'); stage.setAttribute('data-kb', '');
            if (S.step >= PATH.length) win();
            return;
          }
          wrongStep(c, r);
        }

        function wrongStep(c, r) {
          if (EASY && !S.warned) {
            S.warned = true;
            au('sfx', 'click');
            shake = 6;
            msg(isSkel(c, r) ? '差点踩上那具白骨——脚下的石板轻轻一沉，我赶紧把脚缩了回来。' : '脚下的石板轻轻一沉，我赶紧把脚缩了回来。不是这一格。', true, 3600);
            flashA = 0.25;
            return;
          }
          S.state = 'rain'; S.cur = [c, r]; placeMe(true); setData();
          hov.setAttribute('opacity', '0'); kbR.setAttribute('opacity', '0');
          au('sfx', 'click');
          later(function () {
            au('sfx', 'arrows');
            startRain(ccx(c), ccy(r));
          }, 320);
          later(function () {
            ctx.say('脚下一沉，机括“咔”地一响——四面石壁里的铁矢，泼雨一样射了下来。').then(function () { finish('lose'); });
          }, 1700);
        }

        function win() {
          S.state = 'done'; setData();
          hov.setAttribute('opacity', '0');
          au('sfx', 'stone');
          later(function () {
            ctx.say('最后一个脚印就在拱门底下。我一脚跨了进去，背后那片血红，终于淡了下去。').then(function () { finish('win'); });
          }, 500);
        }

        /* ---------- 箭雨 ---------- */
        function startRain(tx, ty) {
          var R = rng(7), list = [];
          for (var i = 0; i < 60; i++) {
            var side = R(), sx, sy;
            if (side < 0.4) { sx = X0 - 60; sy = Y0 + R() * ROWS * CELL; }
            else if (side < 0.8) { sx = X0 + COLS * CELL + 60; sy = Y0 + R() * ROWS * CELL; }
            else { sx = X0 + R() * COLS * CELL; sy = -20; }
            var ex = tx + (R() - 0.5) * 220, ey = ty + (R() - 0.5) * 200;
            if (i < 8) { ex = tx + (R() - 0.5) * 40; ey = ty + (R() - 0.5) * 40; }
            list.push({ sx: sx, sy: sy, ex: ex, ey: ey, t0: R() * 0.9, dur: 0.22 + R() * 0.12 });
          }
          rain = { t: 0, list: list };
          flashA = 0.7; shake = 18;
        }
        function drawRain(dt) {
          if (!rain) return;
          rain.t += dt;
          g2.clearRect(0, 0, W, H);
          var hitNow = false;
          rain.list.forEach(function (a) {
            var k = (rain.t - a.t0) / a.dur;
            if (k < 0) return;
            var done = k >= 1; k = Math.min(1, k);
            if (done && !a.hit) { a.hit = true; hitNow = true; }
            var x = lerp(a.sx, a.ex, k), y = lerp(a.sy, a.ey, k), ang = Math.atan2(a.ey - a.sy, a.ex - a.sx);
            var len = done ? 22 : 34;
            g2.save(); g2.translate(x, y); g2.rotate(ang);
            if (!done) { g2.strokeStyle = 'rgba(255,220,180,.25)'; g2.lineWidth = 2; g2.beginPath(); g2.moveTo(-90, 0); g2.lineTo(-len, 0); g2.stroke(); }
            g2.strokeStyle = '#1c1916'; g2.lineWidth = 3.5; g2.lineCap = 'round';
            g2.beginPath(); g2.moveTo(-len, 0); g2.lineTo(0, 0); g2.stroke();
            g2.strokeStyle = '#8a8070'; g2.lineWidth = 1; g2.beginPath(); g2.moveTo(-len, -1); g2.lineTo(-4, -1); g2.stroke();
            g2.fillStyle = '#2a2521'; g2.beginPath(); g2.moveTo(0, -4); g2.lineTo(8, 0); g2.lineTo(0, 4); g2.fill();
            g2.restore();
          });
          if (hitNow) { shake = Math.max(shake, 9); flashA = Math.max(flashA, 0.18); }
        }

        /* ---------- 输入 ---------- */
        function onDown(e) {
          if (ended) return;
          if (e.button != null && e.button > 0) return;
          if (S.state !== 'play') return;
          var p = ctx.toLocal(e), cell = cellAt(p.x, p.y);
          if (!cell) {
            if (p.x > X0 - 40 && p.x < X0 + COLS * CELL + 40 && p.y < Y0 + ROWS * CELL) msg('那是石壁。', false, 1400);
            return;
          }
          tryStep(cell[0], cell[1]);
        }
        function onMove(e) {
          if (ended || S.state !== 'play' || e.pointerType === 'touch') return;
          var p = ctx.toLocal(e), cell = cellAt(p.x, p.y);
          if (cell && Math.abs(cell[0] - S.cur[0]) <= 1 && Math.abs(cell[1] - S.cur[1]) <= 1 && !(cell[0] === S.cur[0] && cell[1] === S.cur[1])) {
            place(hov, cell[0], cell[1], CELL - 6); hov.setAttribute('opacity', '1'); stage.style.cursor = 'pointer';
          } else { hov.setAttribute('opacity', '0'); stage.style.cursor = cell ? 'not-allowed' : 'default'; }
        }
        stage.addEventListener('pointerdown', onDown);
        stage.addEventListener('pointermove', onMove);

        var DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1], A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1] };
        function onKey(e) {
          if (ended) return;
          var k = e.key;
          if (S.state !== 'play') {
            if (k === ' ' || k === 'Enter') {   // 推进字幕
              var c = root.querySelector('.gf-game-caption');
              if (c) { e.preventDefault(); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
            }
            return;
          }
          if (k === 'f' || k === 'F' || k === 'h' || k === 'H') { e.preventDefault(); usePalm(); return; }
          if (DIRS[k]) {
            e.preventDefault();
            var dxy = DIRS[k], base = kb || S.cur.slice();
            var nc = base[0] + dxy[0], nr = base[1] + dxy[1];
            if (!kb) { nc = S.cur[0] + dxy[0]; nr = S.cur[1] + dxy[1]; }
            // 在“当前格 ± 1”范围内移动光标（可到对角格：先按上再按左）
            nc = clamp(nc, S.cur[0] - 1, S.cur[0] + 1); nr = clamp(nr, S.cur[1] - 1, S.cur[1] + 1);
            if (!valid(nc, nr) && !(nc === S.cur[0] && nr === S.cur[1])) { if (!kb) return; nc = base[0]; nr = base[1]; }
            kb = [nc, nr]; stage.setAttribute('data-kb', key(nc, nr));
            place(kbR, nc, nr, CELL - 10); kbR.setAttribute('opacity', '1');
            return;
          }
          if (k === ' ' || k === 'Enter') {
            e.preventDefault();
            if (e.repeat) return;
            if (kb) tryStep(kb[0], kb[1]);
            else msg('先用方向键选一个格子。', false, 1600);
          }
        }
        window.addEventListener('keydown', onKey);

        /* ---------- 主循环 ---------- */
        function frame(now) {
          if (ended) return;
          rafId = requestAnimationFrame(frame);
          var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now;
          var t = nowS();
          if (S.state === 'play') T += dt;

          // 愤怒的周期：平静 → 泛红 → 血红 → 回落
          var ph = T % CYCLE, a;
          if (ph < CALM) a = 0;
          else if (ph < CALM + RISE) a = (ph - CALM) / RISE;
          else if (ph < CALM + RISE + RED) a = 1;
          else a = 1 - (ph - CALM - RISE - RED) / FALL;
          if (S.state === 'intro') a = 0;
          var palmOn = t < S.palmUntil && S.state === 'play';
          if (palmOn) a = 0;
          anger += (a - anger) * Math.min(1, dt * (palmOn ? 14 : 6));
          if (a >= 0.99 && !S.firstAnger && S.state === 'play') {
            S.firstAnger = true; palm.classList.add(P + 'nudge');
            msg('一股无名火直往脑门上窜，眼前的一切都泛起了血色——脚印看不清了。看看手心！', true, 4200);
          }
          var throb = anger * (0.82 + 0.18 * Math.sin(T * 7.5));
          red.style.opacity = (throb * 0.62).toFixed(3);
          redglow.style.opacity = (throb * 0.9).toFixed(3);
          for (var b = 0; b < boardEls.length; b++) boardEls[b].classList.toggle(P + 'angry', anger > 0.55);

          // 脚印的可见度：平静时隐约可见（忽隐忽现），血红时几乎看不见，看手心时清清楚楚
          var flick = 0.72 + 0.28 * Math.sin(T * 3.1) * Math.sin(T * 5.3 + 1);
          var target = palmOn ? 1 : lerp(CALM_VIS * flick, 0.03, anger);
          if (S.state === 'intro') target = CALM_VIS;
          if (S.state === 'done' || S.state === 'rain') target = 0.9;
          vis += (target - vis) * Math.min(1, dt * 10);
          prints.setAttribute('opacity', vis.toFixed(3));
          prints.classList.toggle(P + 'lit', palmOn);
          stage.setAttribute('data-anger', anger.toFixed(2));
          stage.setAttribute('data-palm', palmOn ? '1' : '0');

          // 看手心按钮：生效 / 冷却
          var cd = Math.max(0, S.cdUntil - t);
          stage.setAttribute('data-cd', cd.toFixed(1));
          palm.classList.toggle(P + 'active', palmOn);
          palm.classList.toggle(P + 'cool', !palmOn && cd > 0);
          if (palmOn) {
            ring.style.opacity = '1';
            ring.style.background = 'conic-gradient(rgba(255,241,207,.85) ' + ((S.palmUntil - t) / (PALM_MS / 1000) * 360).toFixed(1) + 'deg,transparent 0)';
            ring.style.webkitMask = ring.style.mask = 'radial-gradient(circle,transparent 64px,#000 65px)';
            palmS.textContent = '心头的火压下去了';
          } else if (cd > 0) {
            ring.style.opacity = '1';
            ring.style.background = 'conic-gradient(rgba(224,181,106,.55) ' + ((1 - cd / COOLDOWN) * 360).toFixed(1) + 'deg,rgba(60,40,30,.5) 0)';
            ring.style.webkitMask = ring.style.mask = 'radial-gradient(circle,transparent 64px,#000 65px)';
            palmS.textContent = '冷却 ' + Math.ceil(cd) + ' 秒';
          } else {
            ring.style.opacity = '0';
            palmS.textContent = '夏侯婴画的符 · F';
          }

          drawRain(dt);
          shake = Math.max(0, shake - dt * 30);
          flashA = Math.max(0, flashA - dt * 1.6);
          flash.style.opacity = flashA.toFixed(3);
          shakeEl.style.transform = shake > 0.1 ? 'translate(' + n1((Math.random() - 0.5) * shake * 2) + 'px,' + n1((Math.random() - 0.5) * shake * 2) + 'px)' : '';
        }

        function finish(r) {
          if (ended) return;
          ended = true;
          cancelAnimationFrame(rafId);
          timers.forEach(clearTimeout); timers = [];
          window.removeEventListener('keydown', onKey);
          resolve(r);
        }

        /* ---------- 开场 ---------- */
        rafId = requestAnimationFrame(frame);
        ctx.say('三角形的墓室，越往里越窄，尖上只剩一道拱门。满地短铁矢，三具白骨——只有卫不回踩过的格子是安全的。').then(function () {
          if (ended) return;
          S.state = 'play'; setData(); T = 0;
          msg('他走过的地方，留下了一串红脚印。', false, 3000);
          if (EASY || (ctx.failCount || 0) >= 2) {
            try { ctx.skipBtn(function () { finish('win'); }); } catch (e) { /* 忽略 */ }
          }
        });
      });
    }
  });
})();
