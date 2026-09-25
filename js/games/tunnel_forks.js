/*
 * 小游戏 tunnel_forks（第五章）：孙家兄弟挖的甬道岔路。
 * 5 个岔口（第 3、5 个是三岔），正确那条路的洞口壁上伸着一只小铁盘油灯。
 * 选错 → 死路（土墙）→ 退回原岔口；第一次选错时卫先点破规律，之后只有那多吐槽。
 * 每过一个岔口：顶部“深度”下降、甬道更矮更暗。第 5 个岔口后到达死路尽头，地上有洞 → win。只会 win。
 * 操作：鼠标/触摸点击甬道口；键盘 ←/→（A/D）选择、回车/空格确认、1/2/3 直选。
 */
(function () {
  'use strict';
  var GF = window.GF = window.GF || {};
  if (!GF.games || !GF.games.register) return;

  var ID = 'tunnel_forks';
  var P = 'gfg-tunnel_forks-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';

  // 甬道口几何（与背景 tunnel_fork 约定：左 x≈560、右 x≈1040，y≈330–620；中间第三条由本游戏自己画）
  var M_LEFT = { x: 560, top: 330, bot: 632, w: 224 };
  var M_RIGHT = { x: 1040, top: 330, bot: 632, w: 224 };
  var M_MID = { x: 800, top: 380, bot: 630, w: 158 };
  var FLOOR_Y = 640;                         // 世界压扁（变矮）的基准线
  var FORKS = [2, 2, 3, 2, 3];               // 每个岔口的路数
  var DEPTH = [9, 12, 15, 18, 21, 23];       // 深度（米）
  var SQUASH = [1, 0.97, 0.94, 0.91, 0.88];  // 甬道越来越低
  var CEIL = [0, 52, 92, 126, 156];          // 顶部压下来的土
  var DARK = [0.36, 0.46, 0.55, 0.63, 0.71]; // 越来越暗

  var INTRO = [
    '第一个岔口。两条土道黑洞洞的，看上去一模一样。',
    '又一个岔口。',
    '这回是三条。甬道又矮了一截，我得猫着腰走。',
    '空气又闷又潮，头顶的土几乎擦着头盔。',
    '三条路，一样黑。但愿这是最后一个岔口。'
  ];
  var QUIPS = [
    '又是土墙。我冲它叹了口气，它没理我。',
    '死路。卫先在身后咳了一声，意思再明白不过。',
    '墙上还留着镐印——挖到这儿的人，大概也骂了一句。',
    '看油灯，那多。看油灯。',
    '我大概是全上海最不适合干这行的人。回头。'
  ];

  function rngOf(seed) {
    if (GF.art && GF.art.util && GF.art.util.rng) return GF.art.util.rng(seed);
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }

  /* ---------------------------------------------------------------- 美术：甬道口 */

  // 手挖的土洞口：下宽上窄、顶部圆拱、边缘粗糙
  function archPath(m, r, rough) {
    rough = rough == null ? 3 : rough;
    var x0 = m.x - m.w / 2, x1 = m.x + m.w / 2, top = m.top, bot = m.bot;
    var sh = Math.min(m.w * 0.5, (bot - top) * 0.46);
    var lean = m.w * 0.05;
    var pts = [], i, n = 6;
    function j() { return (r() - 0.5) * 2 * rough; }
    for (i = 0; i <= n; i++) pts.push([x0 + lean * i / n + j(), bot - (bot - (top + sh)) * i / n]);
    for (i = 1; i < 14; i++) {
      var a = Math.PI - Math.PI * i / 14;
      pts.push([m.x + Math.cos(a) * (m.w / 2 - lean) + j(), top + sh - Math.sin(a) * sh + j()]);
    }
    for (i = 0; i <= n; i++) pts.push([x1 - lean * (n - i) / n + j(), top + sh + (bot - (top + sh)) * i / n]);
    return 'M' + pts.map(function (p) { return f1(p[0]) + ',' + f1(p[1]); }).join('L') + 'Z';
  }

  // 一个甬道口（洞内渐深、地面楔形延伸、边缘受光）；pre = 渐变 id 前缀
  function mouthArt(m, r, pre) {
    var s = '';
    var d = archPath(m, r, 3);
    s += '<path d="' + d + '" fill="#000" opacity=".55" transform="translate(0,4)"/>';
    s += '<path d="' + d + '" fill="url(#' + pre + 'in)"/>';
    var m2 = { x: m.x + (m.x < 800 ? 8 : (m.x > 800 ? -8 : 0)), top: m.top + (m.bot - m.top) * 0.3, bot: m.bot - 44, w: m.w * 0.5 };
    s += '<path d="' + archPath(m2, r, 4) + '" fill="url(#' + pre + 'deep)"/>';
    s += '<path d="M' + f1(m.x - m.w / 2 + 16) + ',' + m.bot + ' L' + f1(m.x + m.w / 2 - 16) + ',' + m.bot +
      ' L' + f1(m.x + m.w * 0.12) + ',' + (m.bot - 52) + ' L' + f1(m.x - m.w * 0.12) + ',' + (m.bot - 52) + 'Z" fill="url(#' + pre + 'wedge)"/>';
    s += '<path d="' + d + '" fill="none" stroke="#6b4f36" stroke-width="3" opacity=".5"/>';
    s += '<path d="' + d + '" fill="none" stroke="#a07a52" stroke-width="1.2" opacity=".28" transform="translate(-1.5,-1.5)"/>';
    return s;
  }

  // 洞口旁的杂物：垂下的树根、石块、镐印（每个口都有，油灯才需要“细看”）
  function clutterArt(m, r) {
    var s = '', i;
    var x0 = m.x - m.w / 2, x1 = m.x + m.w / 2;
    var nroot = 1 + Math.floor(r() * 2);
    for (i = 0; i < nroot; i++) {
      var rx = m.x + (r() - 0.5) * m.w * 0.7, ry = m.top + 6 + r() * 14, len = 28 + r() * 46, bend = (r() - 0.5) * 30;
      s += '<path d="M' + f1(rx) + ',' + f1(ry) + ' q' + f1(bend) + ',' + f1(len * 0.5) + ' ' + f1(bend * 0.3) + ',' + f1(len) +
        '" stroke="#140d08" stroke-width="' + f1(1.5 + r() * 2) + '" fill="none" stroke-linecap="round" opacity=".9"/>';
    }
    for (i = 0; i < 3 + Math.floor(r() * 3); i++) {
      var sx = (r() < 0.5 ? x0 - 30 + r() * 40 : x1 - 10 + r() * 40), sy = m.bot + 2 + r() * 10, sw = 6 + r() * 12;
      s += '<ellipse cx="' + f1(sx) + '" cy="' + f1(sy) + '" rx="' + f1(sw) + '" ry="' + f1(sw * 0.55) + '" fill="#2e2117"/>' +
        '<ellipse cx="' + f1(sx - sw * 0.2) + '" cy="' + f1(sy - sw * 0.2) + '" rx="' + f1(sw * 0.5) + '" ry="' + f1(sw * 0.22) + '" fill="#5d4530" opacity=".55"/>';
    }
    for (i = 0; i < 8; i++) {
      var px = (r() < 0.5 ? x0 - 12 - r() * 60 : x1 + 12 + r() * 60), py = m.top + 20 + r() * (m.bot - m.top - 40);
      s += '<path d="M' + f1(px) + ',' + f1(py) + ' q6,-4 12,' + f1(2 + r() * 6) + '" stroke="#000" stroke-width="2" fill="none" opacity=".28"/>';
    }
    return s;
  }

  // 小铁盘油灯。x,y = 油盘中心；dir=+1 表示灯挂在洞口左壁、铁臂向右伸
  function lampArt(x, y, dir, k, boost, pre) {
    var g = '<g transform="translate(' + f1(x) + ',' + f1(y) + ') scale(' + k + ')">';
    g += '<ellipse cx="' + (-10 * dir) + '" cy="-14" rx="' + f1(40 * boost) + '" ry="' + f1(52 * boost) + '" fill="url(#' + pre + 'spill)" class="' + P + 'glow"/>';
    g += '<circle cx="0" cy="-10" r="' + f1(34 * boost) + '" fill="url(#' + pre + 'glow)" class="' + P + 'glow"/>';
    g += '<path d="M' + (-21 * dir) + ',-6 L' + (-21 * dir) + ',11" stroke="#120e0b" stroke-width="4" stroke-linecap="round"/>';
    g += '<path d="M' + (-21 * dir) + ',2 L' + (-3 * dir) + ',2" stroke="#1a1410" stroke-width="2.6" stroke-linecap="round"/>';
    g += '<path d="M' + (-20 * dir) + ',10 L' + (-8 * dir) + ',3" stroke="#1a1410" stroke-width="1.8" stroke-linecap="round"/>';
    g += '<path d="M-10,0.5 Q0,9.5 10,0.5 Z" fill="#2a211b" stroke="#86633c" stroke-width="1.1"/>';
    g += '<path d="M-8.5,1 L8.5,1" stroke="#e0a458" stroke-width="1" opacity=".75"/>';
    g += '<path d="M0,1 L0,-2" stroke="#222" stroke-width="1"/>';
    g += '<path class="' + P + 'flame" d="M0,-17 C3.8,-10 4.8,-4.5 0,-0.5 C-4.8,-4.5 -3.8,-10 0,-17Z" fill="url(#' + pre + 'flame)"/>';
    g += '<path class="' + P + 'flame ' + P + 'core" d="M0,-10.5 C1.6,-6.5 2.1,-3.5 0,-1.5 C-2.1,-3.5 -1.6,-6.5 0,-10.5Z" fill="#fff7dc"/>';
    return g + '</g>';
  }

  function lampDefs(pre) {
    return '<radialGradient id="' + pre + 'glow"><stop offset="0" stop-color="#ffcf87" stop-opacity=".62"/>' +
      '<stop offset=".3" stop-color="#ffa24e" stop-opacity=".2"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + pre + 'spill"><stop offset="0" stop-color="#c98a4a" stop-opacity=".22"/><stop offset="1" stop-color="#c98a4a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + pre + 'flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a1a"/>' +
      '<stop offset=".45" stop-color="#ffc255"/><stop offset="1" stop-color="#ffe7a6" stop-opacity=".2"/></linearGradient>';
  }

  function mouthDefs(pre) {
    return '<radialGradient id="' + pre + 'in" cx=".5" cy=".7" r=".78"><stop offset="0" stop-color="#000"/>' +
      '<stop offset=".62" stop-color="#030201"/><stop offset=".9" stop-color="#0e0906"/><stop offset="1" stop-color="#1c130b"/></radialGradient>' +
      '<linearGradient id="' + pre + 'wedge" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3b2a1b" stop-opacity=".9"/>' +
      '<stop offset="1" stop-color="#1a110a" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + pre + 'deep" cx=".5" cy=".6" r=".6"><stop offset=".45" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>';
  }

  /* ---------------------------------------------------------------- 美术：兜底岔路口底图 */
  var fallbackCache = null;
  function fallbackFork() {
    if (fallbackCache) return fallbackCache;
    var r = rngOf(1937);
    var pre = P + 'fb-';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice"><defs>' +
      mouthDefs(pre) + lampDefs(pre) +
      '<linearGradient id="' + pre + 'wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241910"/><stop offset=".6" stop-color="#3a291b"/><stop offset="1" stop-color="#46321f"/></linearGradient>' +
      '<linearGradient id="' + pre + 'ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0705"/><stop offset="1" stop-color="#20160e"/></linearGradient>' +
      '<linearGradient id="' + pre + 'lw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c130c"/><stop offset="1" stop-color="#34251a"/></linearGradient>' +
      '<linearGradient id="' + pre + 'rw" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#140e09"/><stop offset="1" stop-color="#2e2117"/></linearGradient>' +
      '<linearGradient id="' + pre + 'floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1f15"/><stop offset="1" stop-color="#4b3624"/></linearGradient>' +
      '<radialGradient id="' + pre + 'light" cx="800" cy="930" r="1000" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffc27a" stop-opacity=".24"/>' +
      '<stop offset=".55" stop-color="#ffb060" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + pre + 'fg" cx="150" cy="330" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb35c" stop-opacity=".3"/>' +
      '<stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + pre + 'vig" cx="50%" cy="52%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></radialGradient>' +
      '</defs>';
    s += '<rect width="1600" height="900" fill="#0f0a07"/>';
    // 粗糙的边线
    function jag(x0, y0, x1, y1, n, amp) {
      var out = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        out.push(f1(x0 + (x1 - x0) * t + (i && i < n ? (r() - 0.5) * amp : 0)) + ',' + f1(y0 + (y1 - y0) * t + (i && i < n ? (r() - 0.5) * amp : 0)));
      }
      return out;
    }
    var topEdge = jag(250, 192, 1350, 192, 22, 16);
    var botEdge = jag(1362, 640, 238, 640, 22, 8);
    s += '<path d="M0,0 L1600,0 L' + topEdge.slice().reverse().join(' L') + ' Z" fill="url(#' + pre + 'ceil)"/>';
    s += '<path d="M0,0 L250,192 L238,640 L0,900 Z" fill="url(#' + pre + 'lw)"/>';
    s += '<path d="M1600,0 L1350,192 L1362,640 L1600,900 Z" fill="url(#' + pre + 'rw)"/>';
    s += '<path d="M' + topEdge.join(' L') + ' L' + botEdge.join(' L') + ' Z" fill="url(#' + pre + 'wall)"/>';
    s += '<path d="M0,900 L1600,900 L' + botEdge.join(' L') + ' Z" fill="url(#' + pre + 'floor)"/>';
    var i;
    // 地层与镐印
    for (i = 0; i < 5; i++) {
      var yy = 240 + i * 82 + r() * 20;
      s += '<path d="M260,' + f1(yy) + ' C520,' + f1(yy - 14 + r() * 28) + ' 1080,' + f1(yy - 14 + r() * 28) + ' 1340,' + f1(yy + (r() - 0.5) * 16) +
        '" stroke="#000" stroke-width="' + f1(1 + r() * 2) + '" fill="none" opacity=".2"/>';
    }
    for (i = 0; i < 150; i++) {
      var px = 262 + r() * 1080, py = 205 + r() * 420;
      var len = 8 + r() * 14;
      s += '<path d="M' + f1(px) + ',' + f1(py) + ' q' + f1(len / 2) + ',' + f1(-3 - r() * 3) + ' ' + f1(len) + ',' + f1(r() * 6 - 1) +
        '" stroke="' + (r() < 0.7 ? '#000' : '#8c6a47') + '" stroke-width="' + f1(1 + r() * 1.6) + '" fill="none" opacity="' + f1(0.12 + r() * 0.16) + '"/>';
    }
    // 两侧壁：向远处汇聚的纹理
    for (i = 0; i < 26; i++) {
      var yl = r() * 900;
      s += '<path d="M0,' + f1(yl) + ' L' + f1(120 + r() * 100) + ',' + f1(yl * 0.55 + 190 * 0.45 + (r() - 0.5) * 40) + '" stroke="#000" stroke-width="' + f1(1 + r() * 2) + '" opacity=".22"/>';
      var yr = r() * 900;
      s += '<path d="M1600,' + f1(yr) + ' L' + f1(1480 - r() * 100) + ',' + f1(yr * 0.55 + 190 * 0.45 + (r() - 0.5) * 40) + '" stroke="#000" stroke-width="' + f1(1 + r() * 2) + '" opacity=".22"/>';
    }
    // 地面：踩出来的两道车辙/脚印带，碎石
    s += '<path d="M640,900 C640,780 590,690 560,642" stroke="#1e150d" stroke-width="60" fill="none" opacity=".35" stroke-linecap="round"/>';
    s += '<path d="M960,900 C960,780 1010,690 1040,642" stroke="#1e150d" stroke-width="60" fill="none" opacity=".35" stroke-linecap="round"/>';
    for (i = 0; i < 70; i++) {
      var gy = 650 + Math.pow(r(), 1.4) * 250, gx = 60 + r() * 1480;
      var gw = 2 + (gy - 640) / 260 * (6 + r() * 12);
      s += '<ellipse cx="' + f1(gx) + '" cy="' + f1(gy) + '" rx="' + f1(gw) + '" ry="' + f1(gw * 0.5) + '" fill="#1f160e" opacity=".85"/>' +
        '<ellipse cx="' + f1(gx - gw * 0.2) + '" cy="' + f1(gy - gw * 0.18) + '" rx="' + f1(gw * 0.55) + '" ry="' + f1(gw * 0.2) + '" fill="#6b5037" opacity=".4"/>';
    }
    // 两个甬道口
    s += mouthArt(M_LEFT, r, pre) + clutterArt(M_LEFT, r);
    s += mouthArt(M_RIGHT, r, pre) + clutterArt(M_RIGHT, r);
    // 近处左壁：一路走来的油灯（让玩家先认识它长什么样）
    s += '<rect width="1600" height="900" fill="url(#' + pre + 'fg)"/>';
    s += lampArt(150, 350, 1, 2.3, 1.25, pre);
    // 手里的光 + 暗角
    s += '<rect width="1600" height="900" fill="url(#' + pre + 'light)"/>';
    s += '<rect width="1600" height="900" fill="url(#' + pre + 'vig)"/>';
    s += '</svg>';
    fallbackCache = s;
    return s;
  }

  /* ---------------------------------------------------------------- 美术：死路 / 洞 */
  function deadEndSvg(seed, withHole) {
    var r = rngOf(seed);
    var pre = P + (withHole ? 'ho-' : 'de-');
    var W = { x: 800, top: 250, bot: 660, w: 560 };
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice"><defs>' + lampDefs(pre) +
      '<radialGradient id="' + pre + 'tube" cx="800" cy="470" r="900" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="#3a2a1c"/><stop offset=".7" stop-color="#1c140d"/><stop offset="1" stop-color="#080504"/></radialGradient>' +
      '<radialGradient id="' + pre + 'end" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#57402a"/><stop offset=".7" stop-color="#3b2a1b"/><stop offset="1" stop-color="#241910"/></radialGradient>' +
      '<linearGradient id="' + pre + 'floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2016"/><stop offset="1" stop-color="#46321f"/></linearGradient>' +
      '<radialGradient id="' + pre + 'hole" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#000"/><stop offset=".75" stop-color="#050302"/><stop offset="1" stop-color="#1a110a"/></radialGradient>' +
      '<radialGradient id="' + pre + 'vig" cx="50%" cy="52%" r="70%"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".88"/></radialGradient>' +
      '</defs>';
    s += '<rect width="1600" height="900" fill="url(#' + pre + 'tube)"/>';
    // 管状甬道的“肋”：从四周汇聚到尽头
    var i;
    for (i = 0; i < 34; i++) {
      var a = i / 34 * Math.PI * 2 + r() * 0.1;
      var ox = 800 + Math.cos(a) * 1150, oy = 470 + Math.sin(a) * 760;
      var ix = 800 + Math.cos(a) * 300, iy = 455 + Math.sin(a) * 215;
      s += '<path d="M' + f1(ox) + ',' + f1(oy) + ' L' + f1(ix) + ',' + f1(iy) + '" stroke="#000" stroke-width="' + f1(1.5 + r() * 3) + '" opacity="' + f1(0.12 + r() * 0.15) + '"/>';
    }
    // 地面
    s += '<path d="M0,900 L1600,900 L1110,648 L490,648 Z" fill="url(#' + pre + 'floor)"/>';
    // 尽头的土墙
    var d = archPath(W, r, 7);
    s += '<path d="' + d + '" fill="url(#' + pre + 'end)"/>';
    s += '<path d="' + d + '" fill="none" stroke="#000" stroke-width="10" opacity=".35"/>';
    for (i = 0; i < 90; i++) {
      var px = W.x - W.w * 0.42 + r() * W.w * 0.84, py = W.top + 60 + r() * (W.bot - W.top - 80);
      var len = 10 + r() * 16;
      s += '<path d="M' + f1(px) + ',' + f1(py) + ' q' + f1(len * 0.4) + ',' + f1(-4 - r() * 4) + ' ' + f1(len) + ',' + f1(r() * 8 - 2) +
        '" stroke="' + (r() < 0.75 ? '#1a110a' : '#8f6d49') + '" stroke-width="' + f1(1.2 + r() * 2) + '" fill="none" opacity="' + f1(0.2 + r() * 0.25) + '"/>';
    }
    for (i = 0; i < 26; i++) {
      var gy = 655 + Math.pow(r(), 1.3) * 240, gx = 200 + r() * 1200;
      var gw = 3 + (gy - 650) / 250 * (8 + r() * 14);
      s += '<ellipse cx="' + f1(gx) + '" cy="' + f1(gy) + '" rx="' + f1(gw) + '" ry="' + f1(gw * 0.5) + '" fill="#1c140d"/>' +
        '<ellipse cx="' + f1(gx - gw * 0.2) + '" cy="' + f1(gy - gw * 0.2) + '" rx="' + f1(gw * 0.5) + '" ry="' + f1(gw * 0.2) + '" fill="#6d5238" opacity=".4"/>';
    }
    // 墙脚一堆塌土
    s += '<path d="M560,662 Q640,610 730,640 Q800,600 880,646 Q980,620 1040,664 Z" fill="#2c1f14" opacity=".9"/>';
    if (withHole) {
      // 地上的洞：黑、边缘松土，里面隐约一级级土台阶
      s += '<ellipse cx="800" cy="760" rx="228" ry="74" fill="#1a120b"/>';
      s += '<ellipse cx="800" cy="756" rx="206" ry="62" fill="url(#' + pre + 'hole)"/>';
      s += '<path d="M612,748 Q800,700 988,748" stroke="#7a5a3a" stroke-width="3" fill="none" opacity=".55"/>';
      for (i = 0; i < 4; i++) {
        var sy = 742 + i * 13, sw = 150 - i * 30;
        s += '<path d="M' + (800 - sw) + ',' + sy + ' Q800,' + (sy + 8) + ' ' + (800 + sw) + ',' + sy + '" stroke="#4a3522" stroke-width="' + (4 - i * 0.7) + '" fill="none" opacity="' + (0.7 - i * 0.15) + '"/>';
      }
      for (i = 0; i < 18; i++) {
        var hx = 800 + (r() - 0.5) * 520, hy = 760 + (r() - 0.5) * 150;
        if (Math.pow((hx - 800) / 230, 2) + Math.pow((hy - 760) / 76, 2) < 1.05) continue;
        s += '<ellipse cx="' + f1(hx) + '" cy="' + f1(hy) + '" rx="' + f1(4 + r() * 8) + '" ry="' + f1(2 + r() * 4) + '" fill="#3b2a1b"/>';
      }
      // 洞边壁上也有一盏：对的路
      s += lampArt(1118, 402, -1, 1.5, 1.3, pre);
    }
    s += '<rect width="1600" height="900" fill="url(#' + pre + 'vig)"/>';
    s += '<rect width="1600" height="900" fill="#000" opacity="' + (withHole ? 0.12 : 0.28) + '"/>';
    return s + '</svg>';
  }

  /* ---------------------------------------------------------------- 压下来的顶 */
  function ceilSvg(d) {
    var H = CEIL[d];
    if (!H) return '';
    var r = rngOf(500 + d);
    var pre = P + 'ce' + d + '-';
    var pts = [];
    for (var x = 0; x <= 1600; x += 40) {
      var t = (x - 800) / 800;
      pts.push(f1(x) + ',' + f1(H + 70 * t * t + (r() - 0.5) * 18));
    }
    var s = '<defs><linearGradient id="' + pre + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050302"/>' +
      '<stop offset=".8" stop-color="#1a120b"/><stop offset="1" stop-color="#2e2116"/></linearGradient></defs>';
    s += '<path d="M0,0 L1600,0 L' + pts.slice().reverse().join(' L') + ' Z" fill="url(#' + pre + 'g)"/>';
    s += '<path d="M' + pts.join(' L') + '" fill="none" stroke="#6a4e35" stroke-width="2" opacity=".35"/>';
    for (var i = 0; i < 6 + d * 3; i++) {
      var rx = r() * 1600, tt = (rx - 800) / 800, ry = H + 70 * tt * tt - 4, len = 18 + r() * 50;
      s += '<path d="M' + f1(rx) + ',' + f1(ry) + ' q' + f1((r() - 0.5) * 24) + ',' + f1(len * 0.6) + ' ' + f1((r() - 0.5) * 10) + ',' + f1(len) +
        '" stroke="#0e0906" stroke-width="' + f1(1.5 + r() * 2.5) + '" fill="none" stroke-linecap="round"/>';
    }
    return s;
  }

  /* ---------------------------------------------------------------- CSS */
  var CSS =
    '.' + P + 'wrap{position:absolute;left:0;top:0;width:1600px;height:900px;overflow:hidden;background:#000;font-family:' + FONT + ';color:#efe6d2}' +
    '.' + P + 'scene,.' + P + 'alt{position:absolute;left:0;top:0;width:1600px;height:900px}' +
    '.' + P + 'world{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:800px ' + FLOOR_Y + 'px}' +
    '.' + P + 'bg,.' + P + 'bg>svg,.' + P + 'layer{position:absolute;left:0;top:0;width:1600px;height:900px}' +
    '.' + P + 'w1,.' + P + 'w2,.' + P + 'ceil{will-change:transform}' +
    '.' + P + 'dark{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;will-change:transform;--x:800px;--y:520px;--a:.4;--a0:0;' +
    'background:radial-gradient(circle 230px at var(--x) var(--y),rgba(255,214,160,.10),rgba(255,214,160,0)),' +
    'radial-gradient(circle 360px at var(--x) var(--y),rgba(0,0,0,var(--a0)) 32%,rgba(0,0,0,var(--a)) 100%)}' +
    '.' + P + 'alt{opacity:0;pointer-events:none}' +
    '.' + P + 'flame{transform-box:fill-box;transform-origin:50% 100%;animation:' + P + 'fl .9s ease-in-out infinite alternate}' +
    '.' + P + 'core{animation-duration:.63s}' +
    '.' + P + 'glow{animation:' + P + 'gl 1.7s ease-in-out infinite alternate}' +
    '@keyframes ' + P + 'fl{0%{transform:scale(1,1) skewX(0)}30%{transform:scale(.9,1.1) skewX(4deg)}55%{transform:scale(1.06,.9) skewX(-3deg)}80%{transform:scale(.95,1.13) skewX(2deg)}100%{transform:scale(1,.96) skewX(-1deg)}}' +
    '@keyframes ' + P + 'gl{0%{opacity:.72}40%{opacity:1}70%{opacity:.8}100%{opacity:.95}}' +
    '.' + P + 'label{position:absolute;transform:translate(-50%,0);color:#e0b56a;font-size:28px;letter-spacing:.24em;white-space:nowrap;opacity:0;' +
    'transition:opacity .2s,transform .2s;text-shadow:0 0 10px #000,0 0 22px #000;pointer-events:none}' +
    '.' + P + 'label.on{opacity:1;transform:translate(-50%,-6px)}' +
    '.' + P + 'label i{display:block;font-style:normal;text-align:center;font-size:22px;letter-spacing:0;margin-bottom:2px}' +
    '.' + P + 'tip{position:absolute;left:50%;top:22px;transform:translateX(-50%);font-size:27px;letter-spacing:.08em;white-space:nowrap;' +
    'padding:10px 60px;color:rgba(239,230,210,.9);text-shadow:0 2px 8px #000;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 18%,rgba(0,0,0,.55) 82%,rgba(0,0,0,0));transition:opacity .4s}' +
    '.' + P + 'tip b{color:#e0b56a;font-weight:normal}' +
    '.' + P + 'hud{position:absolute;left:34px;top:24px;display:flex;align-items:flex-start;gap:6px;padding:10px 18px 12px 6px;' +
    'background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,0));transition:opacity .4s}' +
    '.' + P + 'hud svg{display:block}' +
    '.' + P + 'mark{transition:transform .9s cubic-bezier(.5,0,.3,1)}' +
    '.' + P + 'hl{font-size:22px;letter-spacing:.5em;color:#e0b56a;margin-top:6px}' +
    '.' + P + 'dv{font-size:40px;color:#efe6d2;margin-top:4px;letter-spacing:.04em}' +
    '.' + P + 'dv small{font-size:22px;margin-left:4px;color:rgba(239,230,210,.7)}' +
    '.' + P + 'fk{font-size:22px;color:rgba(239,230,210,.66);margin-top:8px;letter-spacing:.1em}' +
    '.' + P + 'dots{margin-top:8px;display:flex;gap:9px}' +
    '.' + P + 'dots span{width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(224,181,106,.7);box-sizing:border-box;transition:background .4s}' +
    '.' + P + 'dots span.done{background:#e0b56a}' +
    '.' + P + 'dots span.cur{box-shadow:0 0 8px #e0b56a}' +
    '.' + P + 'fade{position:absolute;left:0;top:0;width:1600px;height:900px;background:#000;opacity:1;pointer-events:none;transition:opacity .5s}' +
    '.' + P + 'wrap.hover{cursor:pointer}';

  /* ---------------------------------------------------------------- 游戏 */
  GF.games.register(ID, {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root;
        var dead = false, timers = [], rafId = 0;
        var state = 'busy';
        var cur = 0, ruleTold = false, wrongTotal = 0, wrongAfterRule = 0;
        var sel = -1, pressMouth = -1;
        var mouths = [];
        var correct = FORKS.map(function (n) { return Math.floor(Math.random() * n); });
        // 避免连续三次同一个答案（显得有规律）
        for (var ci = 2; ci < correct.length; ci++) {
          if (correct[ci] === correct[ci - 1] && correct[ci] === correct[ci - 2]) correct[ci] = (correct[ci] + 1) % FORKS[ci];
        }
        var torch = { x: 800, y: 520, tx: 800, ty: 520 };

        function later(fn, ms) {
          var t = setTimeout(function () {
            var k = timers.indexOf(t); if (k >= 0) timers.splice(k, 1);
            if (!dead) fn();
          }, ms);
          timers.push(t); return t;
        }
        function wait(ms) { return new Promise(function (res) { later(res, ms); }); }
        function say(text, who) {
          try { var p = ctx.say(text, who); return (p && p.then) ? p : wait(2500); } catch (e) { return wait(1500); }
        }
        function sfx(id) { try { if (ctx.audio && ctx.audio.sfx) ctx.audio.sfx(id); } catch (e) { /* 音频可能未实现 */ } }

        // ---------- DOM
        var wrap = document.createElement('div');
        wrap.className = P + 'wrap';
        wrap.innerHTML =
          '<style>' + CSS + '</style>' +
          '<div class="' + P + 'scene">' +
          '  <div class="' + P + 'world ' + P + 'w1"><div class="' + P + 'bg"></div>' +
          '    <svg class="' + P + 'layer ' + P + 'ov" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"></svg></div>' +
          '  <svg class="' + P + 'layer ' + P + 'ceil" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"></svg>' +
          '  <div class="' + P + 'dark"></div>' +
          '  <div class="' + P + 'world ' + P + 'w2"><svg class="' + P + 'layer ' + P + 'lamps" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"></svg></div>' +
          '  <div class="' + P + 'labels"></div>' +
          '</div>' +
          '<div class="' + P + 'alt"></div>' +
          '<div class="' + P + 'hud"></div>' +
          '<div class="' + P + 'tip"></div>' +
          '<div class="' + P + 'fade"></div>';
        root.appendChild(wrap);
        function q(c) { return wrap.querySelector('.' + P + c); }
        var scene = q('scene'), w1 = q('w1'), w2 = q('w2'), bgEl = q('bg'), ov = q('ov'), ceil = q('ceil'),
          dark = q('dark'), lamps = q('lamps'), labels = q('labels'), alt = q('alt'), hud = q('hud'), tip = q('tip'), fade = q('fade');

        var bgStr = '';
        try { bgStr = ctx.bgSvg('tunnel_fork') || ''; } catch (e) { bgStr = ''; }
        bgEl.innerHTML = bgStr || fallbackFork();

        // ---------- HUD：深度计
        (function buildHud() {
          var g = '<svg width="54" height="236" viewBox="0 0 54 236">';
          g += '<line x1="26" y1="12" x2="26" y2="224" stroke="rgba(239,230,210,.3)" stroke-width="2"/>';
          for (var k = 0; k < DEPTH.length; k++) {
            var yy = 18 + k * 40;
            g += '<line x1="18" y1="' + yy + '" x2="34" y2="' + yy + '" stroke="rgba(239,230,210,.45)" stroke-width="2"/>';
            if (k < DEPTH.length - 1) g += '<line x1="22" y1="' + (yy + 20) + '" x2="30" y2="' + (yy + 20) + '" stroke="rgba(239,230,210,.25)" stroke-width="1.5"/>';
          }
          g += '<g class="' + P + 'mark" style="transform:translateY(18px)"><path d="M4,-9 L20,0 L4,9 Z" fill="#e0b56a"/>' +
            '<circle cx="26" cy="0" r="4" fill="#e0b56a"/></g></svg>';
          var dots = '';
          for (var j = 0; j < FORKS.length; j++) dots += '<span></span>';
          hud.innerHTML = g + '<div><div class="' + P + 'hl">深度</div><div class="' + P + 'dv"></div>' +
            '<div class="' + P + 'fk"></div><div class="' + P + 'dots">' + dots + '</div></div>';
        })();
        function updateHud(level, forkIdx) {
          var mk = hud.querySelector('.' + P + 'mark');
          mk.style.transform = 'translateY(' + (18 + level * 40) + 'px)';
          hud.querySelector('.' + P + 'dv').innerHTML = '−' + DEPTH[level] + '<small>米</small>';
          hud.querySelector('.' + P + 'fk').textContent = forkIdx < FORKS.length ? ('第 ' + (forkIdx + 1) + ' / ' + FORKS.length + ' 个岔口') : '岔口已过';
          var ds = hud.querySelectorAll('.' + P + 'dots span');
          for (var j = 0; j < ds.length; j++) {
            ds[j].className = j < forkIdx ? 'done' : (j === forkIdx ? 'cur' : '');
          }
        }
        function updateTip() {
          tip.innerHTML = ruleTold
            ? '找洞口壁上的<b>小铁盘油灯</b>　·　点击甬道（← → 选择，回车确认）'
            : '看清楚再走　·　点击一条甬道（← → 选择，回车确认）';
        }

        // ---------- 坐标换算（世界被压扁）
        function sq() { return SQUASH[Math.min(cur, SQUASH.length - 1)]; }
        function toScreenY(wy) { return FLOOR_Y + (wy - FLOOR_Y) * sq(); }
        function toWorldY(sy) { return FLOOR_Y + (sy - FLOOR_Y) / sq(); }

        // ---------- 渲染岔口
        function renderFork(i) {
          var n = FORKS[i];
          mouths = n === 3 ? [M_LEFT, M_MID, M_RIGHT] : [M_LEFT, M_RIGHT];
          var r = rngOf(4000 + i * 97);
          var s = SQUASH[i];
          w1.style.transform = w2.style.transform = 'scaleY(' + s + ')';
          // 覆盖层：第三条路 + 各口杂物
          var o = '<defs>' + mouthDefs(P + 'ov' + i + '-') + '</defs>';
          if (n === 3) o += mouthArt(M_MID, r, P + 'ov' + i + '-');
          mouths.forEach(function (m) { o += clutterArt(m, r); });
          ov.innerHTML = o;
          ceil.innerHTML = ceilSvg(i);
          // 油灯
          var boost = (ctx.easy ? 1.55 : 1) * (wrongAfterRule >= 2 ? 1.5 : 1);
          var m = mouths[correct[i]];
          var side = r() < 0.5 ? -1 : 1;                 // -1 左壁，+1 右壁
          if (m === M_LEFT && r() < 0.3) side = -1;
          var lx = side < 0 ? m.x - m.w / 2 + m.w * 0.05 + 10 : m.x + m.w / 2 - m.w * 0.05 - 10;
          var ly = m.top + (m.bot - m.top) * (0.3 + r() * 0.16);
          var lk = m === M_MID ? 0.85 : 0.95;
          lamps.innerHTML = '<defs>' + lampDefs(P + 'lp' + i + '-') + '</defs><g class="' + P + 'lamp" data-mouth="' + correct[i] + '">' +
            lampArt(lx, ly, side < 0 ? 1 : -1, lk, boost, P + 'lp' + i + '-') + '</g>';
          // 选择标签（屏幕坐标）
          var names = n === 3 ? ['左', '中', '右'] : ['左', '右'];
          labels.innerHTML = mouths.map(function (mm, k) {
            var cy = toScreenYFor(i, (mm.top + mm.bot) / 2);
            return '<div class="' + P + 'label" data-mouth="' + k + '" data-cx="' + mm.x + '" data-cy="' + Math.round(cy) + '" style="left:' + mm.x + 'px;top:' +
              Math.round(toScreenYFor(i, mm.bot) + 14) + 'px"><i>▲</i>走' + names[k] + '边</div>';
          }).join('');
          dark.style.setProperty('--a', DARK[i]);
          dark.style.setProperty('--a0', (i * 0.05).toFixed(2));
          sel = -1; setSel(-1);
          wrap.setAttribute('data-fork', i);
          updateHud(i, i);
          updateTip();
        }
        function toScreenYFor(i, wy) { return FLOOR_Y + (wy - FLOOR_Y) * SQUASH[i]; }

        function setSel(k) {
          sel = k;
          var ls = labels.children;
          for (var j = 0; j < ls.length; j++) ls[j].classList.toggle('on', j === k);
          wrap.classList.toggle('hover', k >= 0 && state === 'choose');
          if (k >= 0 && mouths[k]) { torch.tx = mouths[k].x; torch.ty = toScreenY((mouths[k].top + mouths[k].bot) / 2); }
        }

        function mouthAt(sx, sy) {
          var wy = toWorldY(sy);
          for (var k = 0; k < mouths.length; k++) {
            var m = mouths[k];
            var pad = m === M_MID ? 12 : 26;
            if (sx >= m.x - m.w / 2 - pad && sx <= m.x + m.w / 2 + pad && wy >= m.top - 24 && wy <= m.bot + 50) return k;
          }
          return -1;
        }

        // ---------- 转场
        function setFade(v, ms) { fade.style.transition = 'opacity ' + (ms || 500) + 'ms'; fade.style.opacity = v; }
        function resetTransform(el, from) {
          el.style.transition = 'none';
          el.style.transform = from || 'none';
          void el.offsetWidth;
        }
        function zoomInto(el, x, y, scale, ms) {
          el.style.transformOrigin = x + 'px ' + y + 'px';
          el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.55,0,.8,.4)';
          el.style.transform = 'scale(' + scale + ')';
        }
        function settle(el, ms) {
          el.style.transition = 'transform ' + ms + 'ms cubic-bezier(.2,.6,.3,1)';
          el.style.transform = 'none';
        }

        // ---------- 主流程
        function showFork(i, fromScale) {
          alt.style.opacity = 0; alt.innerHTML = '';
          scene.style.visibility = 'visible';
          renderFork(i);
          resetTransform(scene, 'scale(' + (fromScale || 1.08) + ')');
          scene.style.transformOrigin = '800px 480px';
          settle(scene, 900);
          setFade(0, 650);
          return wait(650);
        }

        function showAlt(svg, fromScale) {
          alt.innerHTML = svg;
          alt.style.opacity = 1;
          scene.style.visibility = 'hidden';
          labels.innerHTML = '';
          resetTransform(alt, 'scale(' + (fromScale || 1.12) + ')');
          alt.style.transformOrigin = '800px 470px';
          settle(alt, 900);
          setFade(0, 600);
          return wait(600);
        }

        async function choose(k) {
          if (state !== 'choose' || dead || k < 0 || k >= mouths.length) return;
          state = 'busy';
          wrap.setAttribute('data-state', state);
          wrap.classList.remove('hover');
          setSel(k);
          var m = mouths[k];
          var ok = k === correct[cur];
          sfx('footsteps');
          zoomInto(scene, m.x, toScreenY((m.top + m.bot) / 2 + 30), 2.6, 750);
          later(function () { setFade(1, 420); }, 300);
          await wait(760);
          if (dead) return;
          if (ok) {
            cur++;
            if (cur >= FORKS.length) { finale(); return; }
            await showFork(cur, 1.14);
            if (dead) return;
            if (!ruleTold && cur === 2) {
              // 一次都没走错（多半是蒙的）——卫先也要把规律说出来
              ruleTold = true;
              updateTip();
              await say('眼神不错嘛。发现没有？走对的洞口，壁上都伸着一只小铁盘油灯。', 'weixian');
              if (dead) return;
              await say('工人挖洞用矿灯，油灯是完工后才装的——只会装在对的那条路上。', 'weixian');
              if (dead) return;
            } else if (INTRO[cur]) {
              say(INTRO[cur]);
            }
            enable();
          } else {
            wrongTotal++;
            if (ruleTold) wrongAfterRule++;
            await showAlt(deadEndSvg(900 + wrongTotal * 13 + cur, false), 1.1);
            if (dead) return;
            sfx('thud');
            if (!ruleTold) {
              ruleTold = true;
              await say('走了不到二十步，迎面一堵土墙。死路。');
              if (dead) return;
              await say('别瞎撞了。你回头看岔口——对的那条，洞口壁上有个小铁盘油灯。', 'weixian');
              if (dead) return;
              await say('工人挖洞用矿灯，油灯是完工后才装的，只装在对的路上。', 'weixian');
              if (dead) return;
            } else {
              await say(QUIPS[(wrongAfterRule - 1) % QUIPS.length]);
              if (dead) return;
            }
            setFade(1, 450);
            await wait(470);
            if (dead) return;
            sfx('footsteps');
            await showFork(cur, 0.9);
            if (dead) return;
            if (wrongAfterRule === 2) say('我把脸凑近了些，一个洞口一个洞口地看过去。');
            enable();
          }
        }

        function enable() {
          if (dead) return;
          state = 'choose';
          wrap.setAttribute('data-state', state);
          if (sel >= 0) setSel(sel);
        }

        async function finale() {
          wrap.setAttribute('data-state', 'finale');
          updateHud(DEPTH.length - 1, FORKS.length);
          tip.style.opacity = 0;
          await showAlt(deadEndSvg(4242, true), 1.12);
          if (dead) return;
          await say('又一堵土墙……不对，脚下有个洞。一级一级的土台阶，通向更深的地方。');
          if (dead) return;
          sfx('footsteps');
          zoomInto(alt, 800, 760, 3.2, 1200);
          later(function () { setFade(1, 700); }, 500);
          hud.style.opacity = 0;
          await wait(1250);
          finish('win');
        }

        // ---------- 输入
        function onMove(e) {
          var p = ctx.toLocal(e);
          torch.tx = p.x; torch.ty = p.y;
          if (state !== 'choose') return;
          var k = mouthAt(p.x, p.y);
          if (k !== sel) setSel(k);
          if (e.pointerType === 'mouse' || !e.pointerType) wrap.classList.toggle('hover', k >= 0);
        }
        function onDown(e) {
          var p = ctx.toLocal(e);
          torch.tx = p.x; torch.ty = p.y;
          pressMouth = state === 'choose' ? mouthAt(p.x, p.y) : -1;
          if (pressMouth >= 0) setSel(pressMouth);
        }
        function onUp(e) {
          if (pressMouth < 0) return;
          var p = ctx.toLocal(e);
          var k = mouthAt(p.x, p.y);
          var pm = pressMouth; pressMouth = -1;
          if (k === pm) choose(k);
        }
        function onKey(e) {
          if (dead || state !== 'choose') return;
          var key = e.key;
          var n = mouths.length;
          if (key === 'ArrowLeft' || key === 'a' || key === 'A') { setSel(sel <= 0 ? 0 : sel - 1); e.preventDefault(); }
          else if (key === 'ArrowRight' || key === 'd' || key === 'D') { setSel(sel < 0 ? n - 1 : Math.min(n - 1, sel + 1)); e.preventDefault(); }
          else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
            e.preventDefault();
            if (sel >= 0) choose(sel); else setSel(0);
          } else if (key >= '1' && key <= '3') {
            var k = +key - 1;
            if (k < n) choose(k);
          }
        }
        wrap.addEventListener('pointermove', onMove);
        wrap.addEventListener('pointerdown', onDown);
        wrap.addEventListener('pointerup', onUp);
        document.addEventListener('keydown', onKey);

        // ---------- 手电光（跟随指针，平滑）
        function loop() {
          if (dead) return;
          var dx = torch.tx - torch.x, dy = torch.ty - torch.y;
          if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
            torch.x += dx * 0.16; torch.y += dy * 0.16;
            dark.style.setProperty('--x', torch.x.toFixed(1) + 'px');
            dark.style.setProperty('--y', torch.y.toFixed(1) + 'px');
          }
          rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);

        function finish(result) {
          if (dead) return;
          dead = true;
          wrap.setAttribute('data-state', 'done');
          cancelAnimationFrame(rafId);
          timers.forEach(clearTimeout); timers = [];
          document.removeEventListener('keydown', onKey);
          wrap.removeEventListener('pointermove', onMove);
          wrap.removeEventListener('pointerdown', onDown);
          wrap.removeEventListener('pointerup', onUp);
          resolve(result);
        }

        // ---------- 开场
        (async function () {
          await showFork(0, 1.1);
          if (dead) return;
          say(INTRO[0]);
          enable();
        })();
      });
    }
  });
})();
