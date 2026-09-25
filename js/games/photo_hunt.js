/*
 * 小游戏 photo_hunt（第一章 · 上海图书馆 VIP 室）
 * 那多用一只黄铜放大镜检查《上海老建筑图册》里 1937 年的航拍老照片，找出三处异样：
 *   ① 点中任意一幢完好的楼 →“四幢楼毫发无损”
 *   ② 点中中央那幢（需先完成①）→“品字形的中心”
 *   ③ 点中楼之间 / 四周的废墟 →“废墟里一个人都没有”
 * 只会 win。底图 ctx.cgSvg('cg_photo1937')，缺失时用本文件自绘的兜底照片（构图与 CG 约定一致）。
 * 操作：鼠标移动放大镜、点击查看；触摸拖动（放大镜浮在指尖上方）、松手查看；键盘方向键移动、空格/回车查看。
 */
(function () {
  'use strict';
  var GF = window.GF;
  if (!GF || !GF.games) return;

  var P = 'gfg-photo_hunt-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';
  var AMBER = '#e0b56a', PAPER = '#efe6d2';
  var LENS_R = 140, ZOOM = 2;

  // CG 构图约定：四幢完好高楼的中心点（命中区域用椭圆，取归一化距离最小者）
  var BUILDINGS = [
    { id: 'fl', x: 600, y: 560, rx: 72, ry: 102, name: '前左' },
    { id: 'fr', x: 1000, y: 560, rx: 72, ry: 102, name: '前右' },
    { id: 'c', x: 800, y: 475, rx: 62, ry: 78, center: true, name: '中央' },
    { id: 'b', x: 800, y: 365, rx: 56, ry: 52, name: '最后面' }
  ];
  var PHOTO = { x0: 170, y0: 36, x1: 1430, y1: 832 };   // 照片大致范围（之外是书页）
  var SKY_Y = 250;                                      // 此线以上是天空与烟

  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function fi(n) { return Math.round(n); }

  /* ================================================================ 兜底照片（自绘） */
  var fallbackCache = null;
  function fallbackPhoto() {
    if (fallbackCache) return fallbackCache;
    var r = rng(1937);
    var X0 = 190, Y0 = 48, X1 = 1410, Y1 = 812, HOR = 236;
    var o = [];
    // 兜底画面里四幢楼的外框（中心点与 CG 约定一致）
    var fb = [
      { x: 800, y: 380, w: 100, h: 130 },   // 最后面
      { x: 800, y: 470, w: 112, h: 150 },   // 中央
      { x: 600, y: 560, w: 124, h: 190 },   // 前左
      { x: 1000, y: 560, w: 124, h: 190 }   // 前右
    ];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice">');
    o.push('<defs>' +
      '<linearGradient id="phf-page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3d6b2"/><stop offset=".55" stop-color="#d8c89f"/><stop offset="1" stop-color="#c7b385"/></linearGradient>' +
      '<linearGradient id="phf-gut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2912" stop-opacity=".62"/><stop offset=".5" stop-color="#5a4220" stop-opacity=".18"/><stop offset="1" stop-color="#5a4220" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="phf-edge" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#6a5028" stop-opacity=".35"/><stop offset="1" stop-color="#6a5028" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="phf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f8570"/><stop offset=".6" stop-color="#aca18a"/><stop offset="1" stop-color="#b8ad95"/></linearGradient>' +
      '<linearGradient id="phf-gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9d917a"/><stop offset=".25" stop-color="#877a64"/><stop offset="1" stop-color="#5e5343"/></linearGradient>' +
      '<radialGradient id="phf-vig" cx="50%" cy="48%" r="72%"><stop offset=".55" stop-color="#1b140b" stop-opacity="0"/><stop offset="1" stop-color="#1b140b" stop-opacity=".55"/></radialGradient>' +
      '<radialGradient id="phf-yard" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#b3a68b" stop-opacity=".75"/><stop offset="1" stop-color="#b3a68b" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="phf-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bcae92"/><stop offset="1" stop-color="#9c8d72"/></linearGradient>' +
      '<filter id="phf-smoke" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<filter id="phf-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>' +
      '<filter id="phf-blot" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>' +
      '<filter id="phf-soft" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation=".65"/></filter>' +
      '<pattern id="phf-dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.05" fill="#20170c" fill-opacity=".13"/></pattern>' +
      '<clipPath id="phf-clip"><rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '"/></clipPath>' +
      '</defs>');

    // —— 书页
    o.push('<rect width="1600" height="900" fill="url(#phf-page)"/>');
    var fox = '';
    for (var i = 0; i < 46; i++) {
      var fx = r() * 1600, fy = r() * 900, fr = 1.5 + r() * r() * 16;
      fox += '<circle cx="' + fi(fx) + '" cy="' + fi(fy) + '" r="' + f(fr) + '" fill="#a07a3c" fill-opacity="' + f(0.05 + r() * 0.12) + '"/>';
    }
    o.push(fox);
    var fib = 'M0 0';
    for (i = 0; i < 70; i++) {
      var ax = r() * 1600, ay = r() * 900, al = 8 + r() * 26, aa = r() * 6.28;
      fib += 'M' + fi(ax) + ' ' + fi(ay) + 'l' + f(Math.cos(aa) * al) + ' ' + f(Math.sin(aa) * al);
    }
    o.push('<path d="' + fib + '" stroke="#6b5530" stroke-opacity=".12" stroke-width=".8" fill="none"/>');
    o.push('<rect width="110" height="900" fill="url(#phf-gut)"/><rect x="1530" width="70" height="900" fill="url(#phf-edge)"/>');

    // —— 照片本体
    o.push('<g clip-path="url(#phf-clip)"><g filter="url(#phf-soft)">');
    o.push('<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (HOR - Y0 + 4) + '" fill="url(#phf-sky)"/>');
    o.push('<rect x="' + X0 + '" y="' + HOR + '" width="' + (X1 - X0) + '" height="' + (Y1 - HOR) + '" fill="url(#phf-gnd)"/>');

    // 远处城市：细碎的矮块
    var far = '';
    for (var fx2 = X0; fx2 < X1; fx2 += 5 + r() * 9) {
      var fh = 2 + r() * 7;
      far += 'M' + f(fx2) + ' ' + f(HOR + 3) + 'h' + f(3 + r() * 6) + 'v' + f(-fh) + 'h' + f(-(3 + r() * 5)) + 'z';
    }
    o.push('<path d="' + far + '" fill="#7d725f" fill-opacity=".55"/>');

    // 街道：向远处汇聚
    var VPX = 800, VPY = -760;
    var streets = '';
    [-620, -120, 330, 1270, 1720, 2240].forEach(function (bx) {
      var hw = 11;
      var k = (HOR - VPY) / (Y1 + 40 - VPY);
      streets += 'M' + f(VPX + (bx - hw - VPX) * k) + ' ' + HOR + 'L' + f(VPX + (bx + hw - VPX) * k) + ' ' + HOR +
        'L' + f(bx + hw) + ' ' + (Y1 + 40) + 'L' + f(bx - hw) + ' ' + (Y1 + 40) + 'z';
    });
    [0.1, 0.3, 0.58, 0.86].forEach(function (t) {
      var y = HOR + (Y1 - HOR) * Math.pow(t, 1.3), h = 3 + 12 * t;
      streets += 'M' + X0 + ' ' + f(y) + 'H' + X1 + 'v' + f(h) + 'H' + X0 + 'z';
    });
    o.push('<path d="' + streets + '" fill="#a99b80" fill-opacity=".45"/>');

    // 弹坑
    for (i = 0; i < 22; i++) {
      var cy = HOR + 20 + r() * (Y1 - HOR - 20), t0 = (cy - HOR) / (Y1 - HOR), cs = 0.4 + t0 * 0.9;
      var cx = X0 + r() * (X1 - X0);
      if (nearBuilding(cx, cy, 1.25)) continue;
      var crx = (14 + r() * 26) * cs, cry = crx * 0.42;
      o.push('<ellipse cx="' + fi(cx) + '" cy="' + fi(cy) + '" rx="' + f(crx + 4 * cs) + '" ry="' + f(cry + 3 * cs) + '" fill="#b6a88c" fill-opacity=".5"/>' +
        '<ellipse cx="' + fi(cx) + '" cy="' + f(cy + 1) + '" rx="' + f(crx) + '" ry="' + f(cry) + '" fill="#2e271f" fill-opacity=".8"/>');
    }

    // 大块明暗：焦黑区与白茫茫的瓦砾场
    var blot = '';
    for (i = 0; i < 34; i++) {
      var by = HOR + 10 + r() * (Y1 - HOR), bt = (by - HOR) / (Y1 - HOR), bs = 0.5 + bt;
      var bx = X0 + r() * (X1 - X0);
      if (nearBuilding(bx, by, 1.6)) continue;
      blot += '<ellipse cx="' + fi(bx) + '" cy="' + fi(by) + '" rx="' + fi((50 + r() * 90) * bs) + '" ry="' + fi((14 + r() * 26) * bs) + '" fill="' + (r() < 0.55 ? '#2a231b' : '#b9ac90') + '" fill-opacity="' + f(0.25 + r() * 0.25) + '"/>';
    }
    o.push('<g filter="url(#phf-blot)">' + blot + '</g>');

    // 废墟：按景深分带聚合成少量 path，楼穿插在对应景深里
    function nearBuilding(x, y, k) {
      for (var j = 0; j < fb.length; j++) {
        var b = fb[j];
        var dx = (x - b.x) / (b.w * 0.62 * k), dy = (y - (b.y + b.h * 0.42)) / (b.h * 0.2 * k + 16);
        if (dx * dx + dy * dy < 1) return true;
      }
      return false;
    }
    var bands = [fb[0].y + fb[0].h / 2, fb[1].y + fb[1].h / 2, fb[2].y + fb[2].h / 2, 9999];
    var layers = bands.map(function () { return { base: ['', '', '', ''], wl: '', wd: '', sl: '', sd: '', burn: '' }; });
    var y = HOR + 2;
    while (y < Y1 + 10) {
      var t = (y - HOR) / (Y1 - HOR), sc = 0.42 + 0.8 * t, rowH = 22 * sc;
      var L = layers[y < bands[0] ? 0 : y < bands[1] ? 1 : y < bands[2] ? 2 : 3];
      var x = X0 - 20 + r() * 30 * sc;
      while (x < X1 + 20) {
        var cw = (52 + r() * 26) * sc;
        if (!nearBuilding(x + cw / 2, y + rowH / 2, 1)) {
          var tone = Math.floor(r() * 4);
          // 低频明暗：不规则的淡色底块
          if (r() < 0.6) {
            L.base[tone] += 'M' + fi(x + r() * 8) + ' ' + fi(y + r() * 6) + 'L' + fi(x + cw * (0.5 + r() * 0.5)) + ' ' + fi(y + r() * 8) +
              'L' + fi(x + cw + r() * 6) + ' ' + fi(y + rowH * (0.5 + r() * 0.6)) + 'L' + fi(x + cw * r() * 0.6) + ' ' + fi(y + rowH + r() * 4) + 'z';
          }
          // 瓦砾堆：一簇碎三角
          var np = r() < 0.7 ? 3 + Math.floor(r() * 6) : 0, pcx = x + r() * cw, pcy = y + r() * rowH;
          for (var q = 0; q < np; q++) {
            var tx = pcx + (r() - 0.5) * cw * 0.7, ty = pcy + (r() - 0.5) * rowH * 0.8, tsz = (3 + r() * 8) * sc, tt = Math.floor(r() * 4);
            L.base[tt] += 'M' + f(tx) + ' ' + f(ty) + 'l' + f(tsz) + ' ' + f((r() - 0.3) * tsz * 0.6) + 'l' + f(-tsz * r()) + ' ' + f(-tsz * (0.4 + r() * 0.6)) + 'z';
            if (r() < 0.5) L.sl += 'M' + f(tx) + ' ' + f(ty) + 'l' + f(tsz * 0.6) + ' ' + f(-tsz * 0.25) + 'l' + f(-tsz * 0.2) + ' ' + f(-tsz * 0.35) + 'z';
          }
          // 残墙：参差的断口 + 背光面
          var nw = r() < 0.42 ? 1 + Math.floor(r() * 2) : 0;
          for (var w = 0; w < nw; w++) {
            var wx = x + r() * cw * 0.8, wy = y + rowH * (0.3 + r() * 0.6), ww = (5 + r() * 18) * sc, wh = (3 + r() * 15) * sc;
            var jag = 'M' + f(wx) + ' ' + f(wy) + 'h' + f(ww) + 'v' + f(-wh * (0.3 + r() * 0.5));
            for (var jj = 0; jj < 3; jj++) jag += 'l' + f(-ww / 3) + ' ' + f((r() - 0.6) * wh * 0.6);
            L.wl += jag + 'z';
            L.wd += 'M' + f(wx + ww) + ' ' + f(wy) + 'l' + f(ww * 0.3) + ' ' + f(-ww * 0.12) + 'v' + f(-wh * 0.35) + 'l' + f(-ww * 0.3) + ' ' + f(-wh * 0.1) + 'z';
          }
          // 孤立的烟囱/墙垛
          if (r() < 0.05) {
            var cx3 = x + r() * cw, ch = (14 + r() * 22) * sc, cww = (3 + r() * 3) * sc;
            L.wl += 'M' + f(cx3) + ' ' + f(y + rowH) + 'v' + f(-ch) + 'l' + f(cww * 0.5) + ' ' + f(-cww * 0.4) + 'l' + f(cww * 0.5) + ' ' + f(cww * 0.6) + 'v' + f(ch) + 'z';
            L.wd += 'M' + f(cx3 + cww) + ' ' + f(y + rowH) + 'v' + f(-ch * 0.9) + 'h' + f(cww * 0.6) + 'v' + f(ch * 0.9) + 'z';
          }
          if (r() < 0.3) {
            var bx2 = x + r() * cw, by2 = y + r() * rowH, br = (6 + r() * 16) * sc;
            L.burn += 'M' + f(bx2 - br) + ' ' + f(by2) + 'q' + f(br * 0.8) + ' ' + f(-br * (0.4 + r() * 0.5)) + ' ' + f(br * 2) + ' ' + f((r() - 0.5) * br * 0.4) + 'q' + f(-br) + ' ' + f(br * (0.3 + r() * 0.4)) + ' ' + f(-br * 2) + ' 0z';
          }
          var ns = 2 + Math.floor(r() * 5);
          for (var s = 0; s < ns; s++) {
            var sx = x + r() * cw, sy = y + r() * rowH, ss = (1 + r() * 2.4) * sc;
            if (r() < 0.45) L.sl += 'M' + f(sx) + ' ' + f(sy) + 'h' + f(ss) + 'l' + f(-ss * 0.3) + ' ' + f(ss * 0.7) + 'z';
            else L.sd += 'M' + f(sx) + ' ' + f(sy) + 'h' + f(ss) + 'v' + f(ss * 0.7) + 'h' + f(-ss) + 'z';
          }
          if (r() < 0.05) {  // 烧空的房子：只剩几截残墙围出的轮廓
            var hx = x + r() * cw * 0.3, hy = y + rowH * 0.2, hw2 = cw * 0.7, hh = rowH * 0.9, g = r() * 0.3 + 0.25;
            L.wl += 'M' + f(hx) + ' ' + f(hy) + 'h' + f(hw2 * g) + 'v' + f(2.2 * sc) + 'h' + f(-hw2 * g) + 'z' +
              'M' + f(hx) + ' ' + f(hy) + 'v' + f(hh * 0.55) + 'h' + f(2.4 * sc) + 'v' + f(-hh * 0.55) + 'z' +
              'M' + f(hx + hw2 * 0.45) + ' ' + f(hy + hh) + 'h' + f(hw2 * 0.55) + 'v' + f(2.2 * sc) + 'h' + f(-hw2 * 0.55) + 'z';
            L.burn += 'M' + f(hx + 3 * sc) + ' ' + f(hy + 3 * sc) + 'h' + f(hw2 - 5 * sc) + 'v' + f(hh - 3 * sc) + 'h' + f(-(hw2 - 5 * sc)) + 'z';
          }
        }
        x += cw;
      }
      y += rowH;
    }
    var TONES = ['#6f6351', '#7c6f5b', '#5e5344', '#877a64'];
    function band(L) {
      var s2 = '';
      for (var k = 0; k < 4; k++) if (L.base[k]) s2 += '<path d="' + L.base[k] + '" fill="' + TONES[k] + '" fill-opacity=".62"/>';
      if (L.burn) s2 += '<path d="' + L.burn + '" fill="#2b241c" fill-opacity=".55"/>';
      if (L.wd) s2 += '<path d="' + L.wd + '" fill="#3f362b"/>';
      if (L.wl) s2 += '<path d="' + L.wl + '" fill="#b9ab8f"/>';
      if (L.sd) s2 += '<path d="' + L.sd + '" fill="#2e271f" fill-opacity=".8"/>';
      if (L.sl) s2 += '<path d="' + L.sl + '" fill="#cbbe9f" fill-opacity=".85"/>';
      return s2;
    }
    function building(b) {
      var L0 = b.x - b.w / 2, R0 = b.x + b.w / 2, T = b.y - b.h / 2, B = b.y + b.h / 2;
      var sw = b.w * 0.27, rh = sw * 0.95, fw = b.w - sw, top = T + rh, wh = B - top;
      var s2 = '';
      // 院子与投影
      s2 += '<ellipse cx="' + f(b.x + 10) + '" cy="' + f(B - rh * 0.3) + '" rx="' + f(b.w * 0.95) + '" ry="' + f(rh * 1.3 + 8) + '" fill="url(#phf-yard)"/>';
      var sdx = b.h * 0.5, sdy = b.h * 0.1;
      s2 += '<path d="M' + f(L0 + fw) + ' ' + f(B) + 'L' + f(R0) + ' ' + f(B - rh) + 'L' + f(R0 + sdx) + ' ' + f(B - rh + sdy) + 'L' + f(L0 + fw + sdx * 0.8) + ' ' + f(B + sdy) + 'z" fill="#221b13" fill-opacity=".42"/>';
      // 正面、侧面、屋顶
      s2 += '<rect x="' + f(L0) + '" y="' + f(top) + '" width="' + f(fw) + '" height="' + f(wh) + '" fill="url(#phf-front)"/>';
      s2 += '<path d="M' + f(L0 + fw) + ' ' + f(top) + 'L' + f(R0) + ' ' + f(T) + 'L' + f(R0) + ' ' + f(B - rh) + 'L' + f(L0 + fw) + ' ' + f(B) + 'z" fill="#6b5f4c"/>';
      s2 += '<path d="M' + f(L0) + ' ' + f(top) + 'L' + f(L0 + sw) + ' ' + f(T) + 'L' + f(R0) + ' ' + f(T) + 'L' + f(L0 + fw) + ' ' + f(top) + 'z" fill="#cdbfa3"/>';
      var ins = 4;
      s2 += '<path d="M' + f(L0 + ins + 2) + ' ' + f(top - 2) + 'L' + f(L0 + sw + 1) + ' ' + f(T + ins * 0.7) + 'L' + f(R0 - ins) + ' ' + f(T + ins * 0.7) + 'L' + f(L0 + fw - 2) + ' ' + f(top - 2) + 'z" fill="#978a72"/>';
      // 屋顶楼梯间
      var sx = L0 + sw * 0.9 + fw * 0.12, sy = T + rh * 0.45, sw2 = fw * 0.22, sh = wh * 0.1;
      s2 += '<rect x="' + f(sx) + '" y="' + f(sy - sh) + '" width="' + f(sw2) + '" height="' + f(sh) + '" fill="#b1a388"/>' +
        '<path d="M' + f(sx + sw2) + ' ' + f(sy - sh) + 'l' + f(sw2 * 0.35) + ' ' + f(-sw2 * 0.3) + 'v' + f(sh) + 'l' + f(-sw2 * 0.35) + ' ' + f(sw2 * 0.3) + 'z" fill="#665a47"/>' +
        '<path d="M' + f(sx) + ' ' + f(sy - sh) + 'l' + f(sw2 * 0.35) + ' ' + f(-sw2 * 0.3) + 'h' + f(sw2) + 'l' + f(-sw2 * 0.35) + ' ' + f(sw2 * 0.3) + 'z" fill="#d6c9ad"/>';
      // 檐口与分层线
      var fl = [0, 0.3, 0.63, 1];
      s2 += '<rect x="' + f(L0) + '" y="' + f(top) + '" width="' + f(fw) + '" height="' + f(wh * 0.045) + '" fill="#d9cdb2"/>';
      for (var k = 1; k < 3; k++) {
        var ly = top + wh * fl[k];
        s2 += '<rect x="' + f(L0) + '" y="' + f(ly - 1.5) + '" width="' + f(fw) + '" height="2" fill="#574b3b"/><rect x="' + f(L0) + '" y="' + f(ly + 0.5) + '" width="' + f(fw) + '" height="1.6" fill="#cfc2a6"/>';
      }
      // 正面窗
      var win = '', nc = 5;
      for (k = 0; k < 3; k++) {
        var fy0 = top + wh * fl[k], fy1 = top + wh * fl[k + 1], fh = fy1 - fy0;
        for (var c = 0; c < nc; c++) {
          var cw2 = fw / nc, wx = L0 + cw2 * c + cw2 * 0.28, ww = cw2 * 0.44;
          var wy = fy0 + fh * 0.26, whh = fh * 0.48;
          if (k === 2 && c === 2) { wy = fy0 + fh * 0.18; whh = fh * 0.82; ww = cw2 * 0.56; wx = L0 + cw2 * c + cw2 * 0.22; }  // 石库门
          win += 'M' + f(wx) + ' ' + f(wy) + 'h' + f(ww) + 'v' + f(whh) + 'h' + f(-ww) + 'z';
        }
      }
      s2 += '<path d="' + win + '" fill="#3a3128"/>';
      // 侧面窗（斜切坐标系）
      var sk = -rh / sw, sw3 = '';
      for (k = 0; k < 3; k++) {
        var gy0 = wh * fl[k], gh = wh * (fl[k + 1] - fl[k]);
        for (c = 0; c < 3; c++) {
          var ux = sw / 3 * c + sw / 3 * 0.3;
          sw3 += 'M' + f(ux) + ' ' + f(gy0 + gh * 0.28) + 'h' + f(sw / 3 * 0.4) + 'v' + f(gh * 0.46) + 'h' + f(-sw / 3 * 0.4) + 'z';
        }
      }
      s2 += '<path transform="matrix(1 ' + f(sk * 100) / 100 + ' 0 1 ' + f(L0 + fw) + ' ' + f(top) + ')" d="' + sw3 + '" fill="#2a241d"/>';
      // 墙面雨渍
      s2 += '<rect x="' + f(L0 + fw * 0.08) + '" y="' + f(top + wh * 0.05) + '" width="' + f(fw * 0.05) + '" height="' + f(wh * 0.5) + '" fill="#6d614e" fill-opacity=".22"/>';
      return s2;
    }
    o.push(band(layers[0]) + building(fb[0]) + band(layers[1]) + building(fb[1]) + band(layers[2]) + building(fb[2]) + building(fb[3]) + band(layers[3]));

    // 浓烟：从废墟里升起、向右飘
    var smoke = '';
    var fires = '';
    [[300, 700, 1.1], [236, 452, 0.8], [430, 330, 0.9], [690, 292, 0.7], [945, 300, 0.75], [1180, 340, 0.95], [1275, 590, 1.1],
     [1365, 740, 1.0], [1135, 760, 0.8], [420, 800, 0.9]].forEach(function (s3) {
      var x0 = s3[0], y0 = s3[1], sz = s3[2], n = 15;
      for (var j = 0; j < n; j++) {
        var q = j / (n - 1), yy = y0 - q * (y0 - Y0 + 30) * (0.85 + r() * 0.15), xx = x0 + q * q * 110 * sz + (r() - 0.5) * 18 * (1 + q);
        var rr = (12 + q * 62) * sz * (0.8 + r() * 0.4);
        var col = q < 0.3 ? '#1c1814' : q < 0.65 ? '#352e26' : '#5a5245';
        smoke += '<ellipse cx="' + fi(xx) + '" cy="' + fi(yy) + '" rx="' + fi(rr) + '" ry="' + fi(rr * 0.78) + '" fill="' + col + '" fill-opacity="' + f(0.5 - q * 0.26) + '"/>';
      }
      fires += '<ellipse cx="' + fi(x0) + '" cy="' + fi(y0 + 4) + '" rx="' + f(9 * sz) + '" ry="' + f(4 * sz) + '" fill="#f7efd9" fill-opacity=".8"/>' +
        '<ellipse cx="' + fi(x0 - 6 * sz) + '" cy="' + fi(y0 + 6) + '" rx="' + f(5 * sz) + '" ry="' + f(2.5 * sz) + '" fill="#fffaf0" fill-opacity=".9"/>';
    });
    for (i = 0; i < 16; i++) {   // 天顶烟幕
      smoke += '<ellipse cx="' + fi(X0 + r() * (X1 - X0)) + '" cy="' + fi(Y0 + 20 + r() * 110) + '" rx="' + fi(120 + r() * 160) + '" ry="' + fi(40 + r() * 50) + '" fill="#3f382f" fill-opacity="' + f(0.16 + r() * 0.16) + '"/>';
    }
    for (i = 0; i < 7; i++) {    // 远方地平线烟霭
      smoke += '<ellipse cx="' + fi(X0 + r() * (X1 - X0)) + '" cy="' + fi(HOR - 10 + r() * 30) + '" rx="' + fi(140 + r() * 120) + '" ry="' + fi(16 + r() * 16) + '" fill="#8a806d" fill-opacity=".35"/>';
    }
    o.push('<g filter="url(#phf-glow)">' + fires + '</g>');
    o.push('<g filter="url(#phf-smoke)">' + smoke + '</g>');
    o.push('</g>');   // soft

    // 印刷网点、暗角、划痕、灰尘
    o.push('<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="#7a4f1c" fill-opacity=".12"/>');
    o.push('<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="url(#phf-dots)"/>');
    o.push('<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="url(#phf-vig)"/>');
    var scr = '';
    for (i = 0; i < 4; i++) {
      var sx0 = X0 + r() * (X1 - X0), sy0 = Y0 + r() * 300, sl = 120 + r() * 420;
      scr += 'M' + fi(sx0) + ' ' + fi(sy0) + 'q' + f((r() - 0.5) * 30) + ' ' + f(sl / 2) + ' ' + f((r() - 0.5) * 16) + ' ' + f(sl);
    }
    o.push('<path d="' + scr + '" stroke="#f1e7cc" stroke-opacity=".15" stroke-width="1" fill="none"/>');
    var dust = '';
    for (i = 0; i < 60; i++) {
      dust += '<circle cx="' + fi(X0 + r() * (X1 - X0)) + '" cy="' + fi(Y0 + r() * (Y1 - Y0)) + '" r="' + f(0.6 + r() * 1.6) + '" fill="' + (r() < 0.6 ? '#efe4c6' : '#1d160d') + '" fill-opacity="' + f(0.25 + r() * 0.4) + '"/>';
    }
    o.push(dust + '</g>');   // clip

    // 照片边线与图注
    o.push('<rect x="' + X0 + '" y="' + Y0 + '" width="' + (X1 - X0) + '" height="' + (Y1 - Y0) + '" fill="none" stroke="#2f2415" stroke-opacity=".7" stroke-width="2"/>');
    o.push('<text x="' + X0 + '" y="' + (Y1 + 40) + '" font-family="Songti SC,STSong,SimSun,serif" font-size="22" fill="#4a3a22" letter-spacing="3">图四十七　闸北，一九三七年秋。轰炸之后的航拍。</text>');
    o.push('<text x="' + X1 + '" y="' + (Y1 + 40) + '" text-anchor="end" font-family="Songti SC,STSong,SimSun,serif" font-size="20" fill="#5a4a30">— 112 —</text>');
    o.push('</svg>');
    fallbackCache = o.join('');
    return fallbackCache;
  }

  /* ================================================================ 小工具 */
  function svgToImgSrc(svg) {
    if (!/xmlns=/.test(svg.slice(0, 400))) svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  /** 把照片挂进容器：优先用 <img>（隔离 id、放大时矢量重绘清晰）；含外链图片时退回内联 */
  function mountPhoto(el, svg, w, h) {
    if (/<image[^>]+href="(?!data:)/.test(svg)) {
      el.innerHTML = '<div style="width:' + w + 'px;height:' + h + 'px">' + svg.replace(/<svg\b/, '<svg style="width:100%;height:100%;display:block"') + '</div>';
    } else {
      var img = document.createElement('img');
      img.src = svgToImgSrc(svg);
      img.draggable = false;
      img.style.cssText = 'display:block;width:' + w + 'px;height:' + h + 'px;';
      el.appendChild(img);
    }
  }
  /** 手绘感的椭圆圈 */
  function sketchEllipse(cx, cy, rx, ry, seed) {
    var r = rng(seed), pts = [], start = -2.3 + r() * 0.5, total = Math.PI * 2 + 0.5, n = 30;
    for (var i = 0; i <= n; i++) {
      var a = start + total * i / n, k = 1 + (r() - 0.5) * 0.05 + (i / n) * 0.07;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (i = 1; i < pts.length - 1; i++) {
      d += 'Q' + f(pts[i][0]) + ' ' + f(pts[i][1]) + ' ' + f((pts[i][0] + pts[i + 1][0]) / 2) + ' ' + f((pts[i][1] + pts[i + 1][1]) / 2);
    }
    return d;
  }

  var CSS = [
    '.' + P + 'wrap{position:absolute;inset:0;overflow:hidden;background:#0c0a08;cursor:none;font-family:' + FONT + ';}',
    '.' + P + 'photo{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:800px 470px;transition:transform 1.3s ease,filter 1.3s ease;}',
    '.' + P + 'marks{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;overflow:visible;}',
    '.' + P + 'halo{fill:none;stroke:' + AMBER + ';stroke-opacity:.28;stroke-width:12;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:' + P + 'draw .75s cubic-bezier(.5,.1,.3,1) forwards;}',
    '.' + P + 'core{fill:none;stroke:' + AMBER + ';stroke-width:4;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:' + P + 'draw .75s cubic-bezier(.5,.1,.3,1) forwards;}',
    '.' + P + 'dash{fill:none;stroke:' + AMBER + ';stroke-width:3;stroke-dasharray:14 10;stroke-linecap:round;opacity:0;animation:' + P + 'fade .9s ease forwards;}',
    '.' + P + 'dashhalo{stroke:#140f08;stroke-width:7;stroke-opacity:.45;}',
    '.' + P + 'tag{fill:' + AMBER + ';font:bold 30px ' + FONT + ';opacity:0;animation:' + P + 'fade .5s ease forwards;paint-order:stroke;stroke:#140f08;stroke-width:5px;}',
    '.' + P + 'glint{fill:none;stroke:' + PAPER + ';stroke-width:2.5;opacity:0;animation:' + P + 'glint 1.6s ease-out 2;}',
    '@keyframes ' + P + 'draw{to{stroke-dashoffset:0}}',
    '@keyframes ' + P + 'fade{to{opacity:1}}',
    '@keyframes ' + P + 'glint{0%{opacity:0;transform:scale(.6)}30%{opacity:.8}100%{opacity:0;transform:scale(1.3)}}',
    '.' + P + 'lens{position:absolute;left:0;top:0;width:' + (LENS_R * 2) + 'px;height:' + (LENS_R * 2) + 'px;pointer-events:none;z-index:60;will-change:transform;transition:opacity .25s;filter:drop-shadow(0 14px 18px rgba(0,0,0,.6));}',
    '.' + P + 'lens.hide{opacity:0}',
    '.' + P + 'glass{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#1a140c;}',
    '.' + P + 'mag{position:absolute;left:0;top:0;width:3200px;height:1800px;will-change:transform;}',
    '.' + P + 'mag .' + P + 'marks{width:3200px;height:1800px;}',
    '.' + P + 'shine{position:absolute;inset:0;border-radius:50%;pointer-events:none;' +
      'background:radial-gradient(circle at 34% 28%,rgba(255,250,235,.26),rgba(255,250,235,0) 30%),' +
      'radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 64%,rgba(20,12,4,.45) 100%);' +
      'box-shadow:inset 0 0 0 1px rgba(255,240,200,.25),inset 0 -10px 24px rgba(0,0,0,.25);}',
    '.' + P + 'cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;opacity:.55;}',
    '.' + P + 'cross:before,.' + P + 'cross:after{content:"";position:absolute;background:' + AMBER + ';}',
    '.' + P + 'cross:before{left:8px;top:0;width:2px;height:18px}.' + P + 'cross:after{top:8px;left:0;height:2px;width:18px}',
    '.' + P + 'rim{position:absolute;left:-10px;top:-10px;width:' + (LENS_R * 2 + 200) + 'px;height:' + (LENS_R * 2 + 200) + 'px;overflow:visible;}',
    '.' + P + 'top{position:absolute;left:50%;top:22px;transform:translateX(-50%);z-index:50;text-align:center;pointer-events:none;' +
      'padding:10px 30px 12px;background:rgba(10,8,6,.72);border:1px solid rgba(224,181,106,.35);border-radius:4px;color:' + PAPER + ';' +
      'box-shadow:0 6px 20px rgba(0,0,0,.45);transition:opacity .6s;}',
    '.' + P + 'top b{display:block;font-weight:normal;font-size:28px;letter-spacing:.08em;}',
    '.' + P + 'top span{display:block;font-size:20px;color:#b9ad95;letter-spacing:.1em;margin-top:4px;}',
    '.' + P + 'prog{position:absolute;right:30px;top:22px;z-index:50;pointer-events:none;min-width:270px;padding:12px 22px 14px;' +
      'background:rgba(10,8,6,.78);border:1px solid rgba(224,181,106,.45);border-radius:4px;color:' + PAPER + ';box-shadow:0 6px 20px rgba(0,0,0,.45);transition:opacity .6s;}',
    '.' + P + 'prog h3{margin:0 0 6px;font-weight:normal;font-size:26px;letter-spacing:.2em;color:#cfc3a8;display:flex;align-items:baseline;gap:10px;}',
    '.' + P + 'prog h3 em{font-style:normal;font-size:44px;color:' + AMBER + ';line-height:1;letter-spacing:0;transition:transform .3s;}',
    '.' + P + 'prog h3 em.pop{transform:scale(1.35)}',
    '.' + P + 'prog h3 i{font-style:normal;font-size:26px;color:#8f846f;letter-spacing:0;}',
    '.' + P + 'prog ol{margin:0;padding:0;list-style:none;}',
    '.' + P + 'prog li{font-size:26px;line-height:1.55;color:#6f6656;letter-spacing:.06em;transition:color .5s;}',
    '.' + P + 'prog li.ok{color:' + AMBER + ';}',
    '.' + P + 'prog li s{text-decoration:none;display:inline-block;width:1.6em;color:#8f846f;}',
    '.' + P + 'prog li.ok s{color:' + AMBER + ';}',
    '.' + P + 'float{position:absolute;z-index:70;pointer-events:none;white-space:nowrap;font-size:26px;color:' + PAPER + ';letter-spacing:.06em;' +
      'text-shadow:0 2px 6px #000,0 0 14px rgba(0,0,0,.9);transform:translate(-50%,0);animation:' + P + 'float 1.8s ease-out forwards;}',
    '@keyframes ' + P + 'float{0%{opacity:0;margin-top:8px}15%{opacity:1}75%{opacity:1}100%{opacity:0;margin-top:-26px}}',
    '.' + P + 'shade{position:absolute;inset:0;z-index:55;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,.85) 100%);opacity:0;transition:opacity 1.2s ease;}',
    '.' + P + 'root .gf-game-caption{width:max-content;max-width:1180px;box-sizing:border-box;}',
    '.' + P + 'root .gf-game-caption em{font-style:normal;color:' + AMBER + ';}'
  ].join('\n');

  /* ================================================================ 游戏 */
  GF.games.register('photo_hunt', {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, easy = !!ctx.easy;
        var A = ctx.audio || {};
        var dead = false, timers = [], raf = 0;
        function sfx(id) { try { if (A.sfx) A.sfx(id); } catch (e) { /* 音频可能未就绪 */ } }
        function later(fn, ms) { var t = setTimeout(function () { if (!dead) fn(); }, ms); timers.push(t); return t; }
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

        var svg = '';
        try { svg = ctx.cgSvg('cg_photo1937') || ''; } catch (e) { svg = ''; }
        if (!/<svg[\s>]/.test(svg)) svg = fallbackPhoto();

        var wrap = document.createElement('div');
        wrap.className = P + 'wrap';
        root.appendChild(wrap);

        var photo = el('div', P + 'photo');
        mountPhoto(photo, svg, 1600, 900);
        var NS = 'http://www.w3.org/2000/svg';
        function marksSvg(parent) {
          var s = document.createElementNS(NS, 'svg');
          s.setAttribute('class', P + 'marks');
          s.setAttribute('viewBox', '0 0 1600 900');
          parent.appendChild(s);
          return s;
        }
        var marks1 = marksSvg(photo);
        var shade = el('div', P + 'shade');

        // —— 放大镜
        var lens = el('div', P + 'lens hide');
        var glass = el('div', P + 'glass', lens);
        var mag = el('div', P + 'mag', glass);
        mountPhoto(mag, svg, 3200, 1800);
        var marks2 = marksSvg(mag);
        el('div', P + 'shine', glass);
        var cross = el('div', P + 'cross', glass);
        cross.style.display = 'none';
        var RS = LENS_R * 2 + 200, C = LENS_R + 10;
        var ticks = '';
        for (var i = 0; i < 72; i++) {
          var a = i / 72 * Math.PI * 2;
          ticks += 'M' + f(C + Math.cos(a) * (LENS_R + 3)) + ' ' + f(C + Math.sin(a) * (LENS_R + 3)) + 'L' + f(C + Math.cos(a) * (LENS_R + 10)) + ' ' + f(C + Math.sin(a) * (LENS_R + 10));
        }
        var hx = C + Math.cos(Math.PI / 4) * (LENS_R + 12), hy = C + Math.sin(Math.PI / 4) * (LENS_R + 12);
        el('div', null, lens, '<svg class="' + P + 'rim" viewBox="0 0 ' + RS + ' ' + RS + '">' +
          '<defs><linearGradient id="' + P + 'brass" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#f6dc95"/><stop offset=".22" stop-color="#b98a3c"/><stop offset=".45" stop-color="#fbe3a2"/>' +
          '<stop offset=".7" stop-color="#8a6326"/><stop offset="1" stop-color="#4a3210"/></linearGradient>' +
          '<linearGradient id="' + P + 'wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4326"/><stop offset=".45" stop-color="#3a2414"/><stop offset="1" stop-color="#1c110a"/></linearGradient></defs>' +
          // 手柄（沿 45° 方向）
          '<g transform="translate(' + f(hx) + ' ' + f(hy) + ') rotate(45)">' +
          '<rect x="-4" y="-15" width="34" height="30" rx="4" fill="url(#' + P + 'brass)"/>' +
          '<rect x="6" y="-15" width="3" height="30" fill="#4a3210" opacity=".6"/><rect x="18" y="-15" width="3" height="30" fill="#4a3210" opacity=".6"/>' +
          '<rect x="28" y="-19" width="150" height="38" rx="17" fill="url(#' + P + 'wood)"/>' +
          '<rect x="36" y="-14" width="132" height="6" rx="3" fill="#b07a48" opacity=".35"/>' +
          '<rect x="172" y="-17" width="16" height="34" rx="7" fill="url(#' + P + 'brass)"/></g>' +
          // 镜框
          '<circle cx="' + C + '" cy="' + C + '" r="' + (LENS_R + 7) + '" fill="none" stroke="url(#' + P + 'brass)" stroke-width="16"/>' +
          '<path d="' + ticks + '" stroke="#5a3e14" stroke-opacity=".45" stroke-width="1.4"/>' +
          '<circle cx="' + C + '" cy="' + C + '" r="' + (LENS_R + 15) + '" fill="none" stroke="#2c1e08" stroke-width="1.5" opacity=".8"/>' +
          '<circle cx="' + C + '" cy="' + C + '" r="' + (LENS_R - 0.5) + '" fill="none" stroke="#2c1e08" stroke-width="2"/>' +
          '<path d="M' + f(C - LENS_R * 0.62) + ' ' + f(C - LENS_R * 0.9) + 'A' + (LENS_R + 7) + ' ' + (LENS_R + 7) + ' 0 0 1 ' + f(C + LENS_R * 0.55) + ' ' + f(C - LENS_R * 0.95) + '" fill="none" stroke="#fff6d8" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>' +
          '</svg>');

        // —— HUD
        var top = el('div', P + 'top', null,
          '<b>移动放大镜细看照片，点击你觉得不对劲的地方</b>' +
          '<span>触屏：拖动放大镜，松手查看　·　键盘：方向键移动，空格 / 回车查看</span>');
        var prog = el('div', P + 'prog', null,
          '<h3>异样 <em>0</em><i>/ 3</i></h3><ol>' +
          '<li data-k="0"><s>①</s>尚未发现</li><li data-k="1"><s>②</s>尚未发现</li><li data-k="2"><s>③</s>尚未发现</li></ol>');
        var progNum = prog.querySelector('em');
        var LABELS = ['四幢楼毫发无损', '品字形的中心', '废墟里一个人都没有'];

        // —— 状态
        var found = [false, false, false], nFound = 0, sideClicks = 0, finished = false;
        var pos = { x: 380, y: 640 }, touchMode = false, armed = false, lensShown = false;
        var keys = {}, lastT = 0, lastProgressAt = Date.now(), hintIdx = 0;

        function placeLens() {
          var ox = 0, oy = touchMode ? -175 : 0;
          lens.style.transform = 'translate(' + f(pos.x + ox - LENS_R) + 'px,' + f(pos.y + oy - LENS_R) + 'px)';
          mag.style.transform = 'translate(' + f(LENS_R - pos.x * ZOOM) + 'px,' + f(LENS_R - pos.y * ZOOM) + 'px)';
          cross.style.display = touchMode ? 'block' : 'none';
        }
        function showLens(v) {
          if (v === lensShown) return;
          lensShown = v;
          lens.classList.toggle('hide', !v);
        }
        placeLens();
        later(function () { showLens(true); }, 350);

        // —— 命中分类
        function classify(x, y) {
          var k = easy ? 1.25 : 1, best = null, bd = 1;
          BUILDINGS.forEach(function (b) {
            var dx = (x - b.x) / (b.rx * k), dy = (y - b.y) / (b.ry * k), d = dx * dx + dy * dy;
            if (d <= bd) { bd = d; best = b; }
          });
          if (best) return { type: 'building', b: best };
          if (x < PHOTO.x0 || x > PHOTO.x1 || y < PHOTO.y0 || y > PHOTO.y1) return { type: 'page' };
          if (y < SKY_Y) return { type: 'sky' };
          return { type: 'ruins' };
        }

        // —— 标记
        var markSeed = 7;
        function addMark(html) {
          marks1.insertAdjacentHTML('beforeend', html);
          marks2.insertAdjacentHTML('beforeend', html);
        }
        function circle(cx, cy, rx, ry, delay) {
          var d = sketchEllipse(cx, cy, rx, ry, markSeed++);
          var st = delay ? ' style="animation-delay:' + delay + 'ms"' : '';
          addMark('<path class="' + P + 'halo" pathLength="1" d="' + d + '"' + st + '/><path class="' + P + 'core" pathLength="1" d="' + d + '"' + st + '/>');
          later(function () { sfx('pen'); }, delay || 0);
        }
        function tag(x, y, text, delay) {
          addMark('<text class="' + P + 'tag" x="' + f(x) + '" y="' + f(y) + '" style="animation-delay:' + (delay || 0) + 'ms">' + text + '</text>');
        }

        function floatMsg(text, x, y) {
          var m = el('div', P + 'float', null);
          m.textContent = text;
          var fx = Math.max(200, Math.min(1400, x)), fy = y + (touchMode ? -380 : -LENS_R - 60);
          if (fy < 150) fy = y + LENS_R + 24;
          fy = Math.min(700, fy);
          m.style.left = fx + 'px';
          m.style.top = fy + 'px';
          later(function () { if (m.parentNode) m.remove(); }, 1900);
        }

        function markProgress(k) {
          found[k] = true;
          nFound++;
          lastProgressAt = Date.now();
          hintIdx = 0;
          progNum.textContent = String(nFound);
          progNum.classList.add('pop');
          later(function () { progNum.classList.remove('pop'); }, 320);
          var li = prog.querySelector('li[data-k="' + k + '"]');
          li.classList.add('ok');
          li.innerHTML = '<s>' + ['①', '②', '③'][k] + '</s>' + LABELS[k];
          sfx('clue');
        }

        function discover(k, x, y) {
          markProgress(k);
          var p;
          if (k === 0) {
            BUILDINGS.forEach(function (b, j) { circle(b.x, b.y, b.rx * 0.95, b.ry * 0.9, j * 170); });
            tag(BUILDINGS[3].x + BUILDINGS[3].rx + 10, BUILDINGS[3].y - BUILDINGS[3].ry * 0.35, '①', 700);
            p = ctx.say('四幢楼……**毫发无损**。周围炸成了一片瓦砾，它们连块砖都没掉。');
          } else if (k === 1) {
            var c = BUILDINGS[2], outer = BUILDINGS.filter(function (b) { return !b.center; });
            outer.forEach(function (b, j) {
              var n2 = outer[(j + 1) % outer.length], dx = n2.x - b.x, dy = n2.y - b.y, len = Math.sqrt(dx * dx + dy * dy);
              var ux = dx / len, uy = dy / len, cut = function (bb) { return Math.min(bb.rx, bb.ry) * 1.05; };
              var x1 = b.x + ux * cut(b), y1 = b.y + uy * cut(b), x2 = n2.x - ux * cut(n2), y2 = n2.y - uy * cut(n2);
              var ln = ' x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" style="animation-delay:' + (j * 150) + 'ms"';
              addMark('<line class="' + P + 'dash ' + P + 'dashhalo"' + ln + '/><line class="' + P + 'dash"' + ln + '/>');
            });
            circle(c.x, c.y, c.rx * 1.25, c.ry * 1.15, 0);
            circle(c.x, c.y, c.rx * 1.38, c.ry * 1.26, 260);
            tag(c.x + c.rx * 1.4 + 6, c.y + 10, '②', 500);
            p = ctx.say('中间这幢被另外三幢围在当中——一个标准的**品**字。它才是中心。');
          } else {
            circle(x, y, 78, 62, 0);
            tag(x < 800 ? x - 112 : x + 80, y - 40, '③', 450);
            p = ctx.say('废墟里**一个人都没有**。没有逃难的，没有收尸的，连个影子都看不见。');
          }
          if (nFound >= 3) end(p);
        }

        function inspect(x, y) {
          if (finished || dead) return;
          sfx('click');
          var hit = classify(x, y);
          if (hit.type === 'building') {
            if (!found[0]) { discover(0, x, y); return; }
            if (hit.b.center && !found[1]) { discover(1, x, y); return; }
            if (hit.b.center) { floatMsg('中心那幢，已经圈出来了。', x, y); return; }
            sideClicks++;
            floatMsg('这幢也完好无损。', x, y);
            if (!found[1] && sideClicks === 2) later(function () { ctx.say('四幢楼的位置……好像有讲究。中间那幢被围着。'); }, 400);
            return;
          }
          if (hit.type === 'ruins') {
            if (!found[2]) { discover(2, x, y); return; }
            floatMsg('还是一个人也没有。', x, y);
            return;
          }
          if (hit.type === 'sky') { floatMsg('天上只有烟。', x, y); return; }
          floatMsg('这是书页的空白。', x, y);
        }

        // —— 空闲提示
        var HINTS = [
          '先看看那几幢还立着的楼。',
          '四幢楼摆成的形状……中间那幢有点意思。',
          '楼是完好的。那楼周围呢？街上的人都去哪儿了？'
        ];
        function hintTick() {
          if (finished || dead) return;
          var idle = Date.now() - lastProgressAt;
          if (idle > (easy ? 9000 : 18000) * (hintIdx + 1)) {
            hintIdx++;
            var k = !found[0] ? 0 : !found[1] ? 1 : 2;
            ctx.say(HINTS[k]);
            if (easy || hintIdx >= 2) glint(k);
          }
          later(hintTick, 1000);
        }
        function glint(k) {
          var b = k === 0 ? BUILDINGS[0] : k === 1 ? BUILDINGS[2] : { x: 380, y: 520, rx: 60, ry: 50 };
          addMark('<ellipse class="' + P + 'glint" style="transform-origin:' + b.x + 'px ' + b.y + 'px" cx="' + b.x + '" cy="' + b.y + '" rx="' + b.rx + '" ry="' + b.ry + '"/>');
        }

        // —— 输入
        function onMove(e) {
          if (dead) return;
          var p = ctx.toLocal(e);
          touchMode = e.pointerType === 'touch';
          pos.x = p.x; pos.y = p.y;
          if (!touchMode || armed) showLens(true);
          placeLens();
        }
        function onDown(e) {
          if (dead || finished) return;
          if (e.button != null && e.button > 0) return;
          armed = true;
          onMove(e);
          try { root.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        }
        function onUp(e) {
          if (!armed) return;
          armed = false;
          var p = ctx.toLocal(e);
          pos.x = p.x; pos.y = p.y;
          placeLens();
          inspect(pos.x, pos.y);
        }
        function onLeave(e) { if (e.pointerType === 'mouse') showLens(false); }
        function onKey(e) {
          if (dead) return;
          var k = e.key;
          if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
            keys[k] = e.type === 'keydown';
            if (e.type === 'keydown') { touchMode = false; showLens(true); }
            e.preventDefault();
          } else if (e.type === 'keydown' && (k === ' ' || k === 'Enter' || k === 'Spacebar')) {
            e.preventDefault();
            if (!e.repeat) inspect(pos.x, pos.y);
          }
        }
        function loop(t) {
          if (dead) return;
          var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
          lastT = t;
          var vx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), vy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
          if (vx || vy) {
            pos.x = Math.max(0, Math.min(1600, pos.x + vx * 560 * dt));
            pos.y = Math.max(0, Math.min(900, pos.y + vy * 560 * dt));
            placeLens();
          }
          raf = requestAnimationFrame(loop);
        }
        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerdown', onDown);
        root.addEventListener('pointerup', onUp);
        root.addEventListener('pointercancel', function () { armed = false; });
        root.addEventListener('pointerleave', onLeave);
        window.addEventListener('keydown', onKey);
        window.addEventListener('keyup', onKey);
        raf = requestAnimationFrame(loop);

        // —— 结束
        function cleanup() {
          dead = true;
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('keyup', onKey);
          root.removeEventListener('pointermove', onMove);
          root.removeEventListener('pointerdown', onDown);
          root.removeEventListener('pointerup', onUp);
          root.removeEventListener('pointerleave', onLeave);
        }
        function end(lastSay) {
          finished = true;
          Promise.resolve(lastSay).then(function () {
            if (dead) return;
            return ctx.say('三处不对劲，一处比一处扎眼。这几幢楼，到底是怎么活下来的？');
          }).then(function () {
            if (dead) return;
            // 结束演出：放大镜淡出，照片缓缓推近，圈痕留在暗下来的画面里
            showLens(false);
            top.style.opacity = '0';
            photo.style.transform = 'scale(1.06)';
            photo.style.filter = 'brightness(.8)';
            shade.style.opacity = '1';
            later(function () { cleanup(); resolve('win'); }, 1300);
          });
        }

        // —— 开场
        root.__debug = {
          found: found,
          buildings: BUILDINGS,
          isFinished: function () { return finished; },
          usingFallback: function () { return svg === fallbackCache; }
        };
        later(function () {
          sfx('page');
          ctx.say('照片上是轰炸后的闸北。我借来一只放大镜，一寸一寸地看。');
        }, 300);
        later(hintTick, 1000);
      });
    }
  });
})();
