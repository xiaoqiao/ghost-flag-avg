/*
 * 背景：标题画面 + 尼泊尔篇（第八章）+ 纯色/旧纸
 *   title ktm_airport jeep_night jungle cabin cableway lake_villa villa_room black white paper
 * 风格：扁平剧场感矢量插画，大块几何形 + 光池 + 空气透视。所有内部 id 均带 bg-<名> 前缀。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var BG = GF.art.bg;
  var TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- 小工具 */
  function r(v) { return Math.round(v * 10) / 10; }
  function f3(v) { return Math.round(v * 1000) / 1000; }
  function P2(p) { return r(p[0]) + ',' + r(p[1]); }
  function dPath(a, close) {
    var s = 'M' + P2(a[0]);
    for (var i = 1; i < a.length; i++) s += 'L' + P2(a[i]);
    return s + (close ? 'Z' : '');
  }
  function poly(a, attrs) { return '<polygon points="' + a.map(P2).join(' ') + '" ' + attrs + '/>'; }
  function stops(st) {
    return st.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] == null ? '' : ' stop-opacity="' + s[2] + '"') + '/>';
    }).join('');
  }
  function lg(id, x1, y1, x2, y2, st, user) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' +
      (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(st) + '</linearGradient>';
  }
  function rg(id, cx, cy, rr, st, user, extra) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + rr + '"' +
      (user ? ' gradientUnits="userSpaceOnUse"' : '') + (extra || '') + '>' + stops(st) + '</radialGradient>';
  }
  function blurF(id, sd, pad) {
    pad = pad || 30;
    return '<filter id="' + id + '" x="-' + pad + '%" y="-' + pad + '%" width="' + (100 + 2 * pad) + '%" height="' + (100 + 2 * pad) + '%">' +
      '<feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }
  /** path 片段：椭圆 */
  function ell(cx, cy, rx, ry) {
    return 'M' + r(cx - rx) + ' ' + r(cy) + 'a' + r(rx) + ' ' + r(ry) + ' 0 1 0 ' + r(2 * rx) + ' 0a' + r(rx) + ' ' + r(ry) + ' 0 1 0 ' + r(-2 * rx) + ' 0';
  }
  /** path 片段：圆点（配 stroke-linecap=round） */
  function dot(x, y) { return 'M' + r(x) + ' ' + r(y) + 'h.1'; }
  /** 关键点之间做中点位移，得到有细节的山脊线 */
  function ridge(rnd, keys, amp, depth) {
    var out = [keys[0]];
    for (var k = 0; k < keys.length - 1; k++) {
      var seg = [keys[k], keys[k + 1]], a = amp;
      for (var d = 0; d < depth; d++) {
        var q = [seg[0]];
        for (var i = 0; i < seg.length - 1; i++) {
          q.push([(seg[i][0] + seg[i + 1][0]) / 2, (seg[i][1] + seg[i + 1][1]) / 2 + (rnd() - 0.5) * a], seg[i + 1]);
        }
        seg = q; a *= 0.5;
      }
      out = out.concat(seg.slice(1));
    }
    return out;
  }
  function mtnD(pts, bottom) {
    return 'M' + r(pts[0][0]) + ' ' + bottom + 'L' + pts.map(P2).join('L') + 'L' + r(pts[pts.length - 1][0]) + ' ' + bottom + 'Z';
  }
  /** 山体受光面：keys 为 谷-峰-谷-峰… 交替；lightLeft 为 true 时峰左坡受光 */
  function facets(keys, bottom, lightLeft, rnd) {
    var s = '';
    for (var i = 1; i < keys.length - 1; i++) {
      var a = keys[i], pv = keys[i - 1], nx = keys[i + 1];
      if (a[1] > pv[1] || a[1] > nx[1]) continue; // 只取峰
      var cr = (rnd() - 0.3) * 60;
      if (lightLeft) {
        s += dPath([[pv[0], a[1] - 400], [a[0], a[1] - 400], a, [a[0] + cr, bottom], [pv[0] + (a[0] - pv[0]) * 0.3, bottom], pv], true);
      } else {
        s += dPath([[nx[0], a[1] - 400], [a[0], a[1] - 400], a, [a[0] - cr, bottom], [nx[0] - (nx[0] - a[0]) * 0.3, bottom], nx], true);
      }
    }
    return s;
  }
  function style(css) { return '<style>' + css + '</style>'; }

  /* ================================================================ 纯色 / 旧纸 */
  BG.black = function () { return U.svg('<rect width="1600" height="900" fill="#000"/>'); };
  BG.white = function () { return U.svg('<rect width="1600" height="900" fill="#fff"/>'); };

  BG.paper = function () {
    var P = 'bg-paper', R = U.rng(1904), i;
    var d = '<defs>' +
      lg(P + '-base', 0, 0, 1, 1, [[0, '#eddcb2'], [0.45, '#e7d3a4'], [1, '#dcc493']]) +
      rg(P + '-dk', 0.5, 0.5, 0.5, [[0, '#9a7236', 0.2], [0.6, '#9a7236', 0.08], [1, '#9a7236', 0]]) +
      rg(P + '-lt', 0.5, 0.5, 0.5, [[0, '#fbf1d6', 0.55], [1, '#fbf1d6', 0]]) +
      rg(P + '-edge', 0.5, 0.5, 0.72, [[0.6, '#5a3a12', 0], [0.86, '#5a3a12', 0.2], [1, '#3e260a', 0.55]]) +
      rg(P + '-fox', 0.5, 0.5, 0.5, [[0, '#8a5a24', 0.5], [0.5, '#8a5a24', 0.22], [1, '#8a5a24', 0]]) +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-base)"/>';
    for (i = 0; i < 16; i++) {
      s += '<ellipse cx="' + r(R() * 1600) + '" cy="' + r(R() * 900) + '" rx="' + r(120 + R() * 320) + '" ry="' + r(70 + R() * 200) +
        '" fill="url(#' + P + (i % 2 ? '-dk' : '-lt') + ')"/>';
    }
    // 纤维
    var fib = ['', '', ''];
    for (i = 0; i < 420; i++) {
      var a = (R() - 0.5) * 0.9 + (R() < 0.2 ? 1.57 : 0), l = 5 + R() * 22;
      fib[i % 3] += 'M' + r(R() * 1600) + ' ' + r(R() * 900) + 'l' + r(Math.cos(a) * l) + ' ' + r(Math.sin(a) * l);
    }
    s += '<g fill="none" stroke-linecap="round">' +
      '<path d="' + fib[0] + '" stroke="#8a6a38" stroke-width=".7" opacity=".16"/>' +
      '<path d="' + fib[1] + '" stroke="#fff6dc" stroke-width="1" opacity=".35"/>' +
      '<path d="' + fib[2] + '" stroke="#6a4a22" stroke-width=".5" opacity=".2"/></g>';
    // 霉斑
    var fox = '';
    for (i = 0; i < 46; i++) {
      var fx = R() < 0.6 ? (R() < 0.5 ? R() * 260 : 1340 + R() * 260) : R() * 1600, fy = R() * 900, fr = 1.5 + R() * R() * 14;
      fox += '<circle cx="' + r(fx) + '" cy="' + r(fy) + '" r="' + r(fr) + '" fill="url(#' + P + '-fox)" opacity="' + f3(0.4 + R() * 0.6) + '"/>';
    }
    s += fox;
    var sp = '';
    for (i = 0; i < 120; i++) sp += dot(R() * 1600, R() * 900);
    s += '<path d="' + sp + '" stroke="#7a5428" stroke-width="1.6" stroke-linecap="round" opacity=".35"/>';
    // 水渍环
    s += '<path d="' + ell(1335, 170, 118, 96) + '" fill="#b08a4a" opacity=".05" stroke="#8a6230" stroke-width="2.5" stroke-opacity=".12"/>' +
      '<path d="' + ell(1350, 182, 70, 58) + '" fill="none" stroke="#8a6230" stroke-width="1.2" opacity=".1"/>';
    // 折痕
    s += '<path d="M0 612L1600 598" stroke="#fff8e0" stroke-width="3" opacity=".25"/><path d="M0 615L1600 601" stroke="#7a5a2c" stroke-width="1.2" opacity=".14"/>';
    s += '<rect width="1600" height="900" fill="url(#' + P + '-edge)"/>';
    return U.svg(d + s);
  };

  /* ================================================================ 标题画面 */
  BG.title = function () {
    var P = 'bg-title', R = U.rng(1937813), i, k, u;
    /* 旗面参数化：u 沿旗长（0=旗杆），v 沿旗宽 */
    function fx(u) { return 352 + 596 * u - 10 * Math.sin(TAU * 1.35 * u); }
    function ft(u) { return 88 + 40 * u + 26 * Math.sin(TAU * 1.35 * u - 0.4) * (0.25 + u); }
    function fb(u) { return 332 + 34 * u + 30 * Math.sin(TAU * 1.35 * u - 1.0) * (0.25 + u); }
    function M(u, v) { var t = ft(u); return [fx(u), t + v * (fb(u) - t)]; }
    function uvD(list) { return dPath(list.map(function (q) { return M(q[0], q[1]); })); }

    var top = [], bot = [], tail = [];
    for (i = 0; i <= 32; i++) { u = i / 32; top.push(M(u, 0)); bot.push(M(u, 1)); }
    for (i = 1; i < 10; i++) { var pp = M(1, i / 10); tail.push([pp[0] - (i % 2 ? 16 + R() * 46 : R() * 10), pp[1]]); }
    var flagD = dPath(top.concat(tail, bot.reverse()), true);

    /* 旗面图案（模糊扭曲的螭龙 + 旋涡 + 蝌蚪纹 + 锯齿与竖眼），全部在 uv 空间生成再随旗面变形 */
    var body = [];
    for (i = 0; i <= 40; i++) { u = 0.09 + 0.74 * i / 40; body.push([u, 0.5 + 0.23 * Math.sin(u * 10.5 + 0.8) + 0.04 * Math.sin(u * 31)]); }
    var fins = '', legs = '', claws = '';
    for (i = 4; i < 40; i += 3) fins += uvD([[body[i][0], body[i][1] - 0.05], [body[i][0] + 0.014, body[i][1] - 0.15]]);
    [10, 17, 26, 33].forEach(function (kk, j) {
      var b = body[kk], dv = j % 2 ? -1 : 1, e = [b[0] + 0.035, b[1] + dv * 0.2];
      legs += uvD([b, [b[0] + 0.02, b[1] + dv * 0.12], e]);
      for (var c = -1; c <= 1; c++) claws += uvD([e, [e[0] + 0.02 + c * 0.013, e[1] + dv * 0.06]]);
    });
    var hd = body[40], head = [];
    for (i = 0; i < 12; i++) {
      var an = TAU * i / 12, sp = i % 3 ? 1 : 1.5;
      head.push([hd[0] + 0.045 * Math.cos(an) * sp, hd[1] + 0.12 * Math.sin(an) * sp]);
    }
    var horns = uvD([[hd[0] - 0.01, hd[1] - 0.08], [hd[0] + 0.03, hd[1] - 0.22], [hd[0] + 0.07, hd[1] - 0.26]]) +
      uvD([[hd[0] + 0.03, hd[1] + 0.07], [hd[0] + 0.1, hd[1] + 0.14]]);
    var spir = '';
    [[0.2, 0.22, 0.05, 0.13, 0], [0.6, 0.84, 0.045, 0.1, 1], [0.93, 0.3, 0.035, 0.12, 2], [0.42, 0.14, 0.03, 0.08, 3]].forEach(function (s) {
      var q = [];
      for (var kk = 0; kk <= 28; kk++) { var th = kk / 28 * TAU * 2.3 + s[4], rr = kk / 28; q.push([s[0] + s[2] * rr * Math.cos(th), s[1] + s[3] * rr * Math.sin(th)]); }
      spir += uvD(q);
    });
    var tad = '', tadH = '';
    for (i = 0; i < 12; i++) {
      var tu = 0.12 + R() * 0.78, tv = 0.1 + R() * 0.8, q = [];
      for (k = 0; k < 7; k++) q.push([tu + k * 0.011, tv + 0.025 * Math.sin(k * 1.4 + i)]);
      tad += uvD(q); tadH += uvD([q[0], [q[0][0] + 0.002, q[0][1]]]);
    }
    var zz = [];
    for (i = 0; i <= 14; i++) zz.push([i % 2 ? 0.075 : 0.035, 0.06 + i * 0.063]);
    var eye = uvD([[0.055, 0.36], [0.088, 0.5], [0.055, 0.64], [0.022, 0.5], [0.055, 0.36]]);
    var pat = '<g id="' + P + '-pat" fill="none" stroke="#1a1000" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + uvD(body.slice(12)) + '" stroke-width="30"/>' +
      '<path d="' + uvD(body.slice(0, 14)) + '" stroke-width="14"/>' +
      '<path d="' + fins + legs + '" stroke-width="7"/>' +
      '<path d="' + claws + horns + spir + tad + dPath(zz) + eye + '" stroke-width="5"/>' +
      '<path d="' + tadH + '" stroke-width="12"/>' +
      '<path d="' + uvD(head) + 'Z" fill="#1a1000"/></g>';

    /* 褶皱明暗 */
    var shS = [], shH = [];
    for (i = 0; i <= 24; i++) {
      u = i / 24; var b = Math.cos(TAU * 1.35 * u - 0.7);
      shS.push([f3(u), '#2a1800', f3(Math.max(0, -b) * 0.55)]);
      shH.push([f3(u), '#fff6c8', f3(Math.max(0, b) * 0.32)]);
    }

    var d = '<defs>' +
      lg(P + '-sky', 0, 0, 0, 1, [[0, '#0d0a08'], [0.3, '#221a12'], [0.55, '#4e3a22'], [0.66, '#7a5a30'], [0.72, '#94703c'], [1, '#3a2a18']]) +
      rg(P + '-sun', 560, 205, 560, [[0, '#f6e2b0', 0.75], [0.08, '#e6bc70', 0.5], [0.3, '#a4743a', 0.22], [1, '#3a2a18', 0]], true) +
      rg(P + '-fire', 0.5, 0.5, 0.5, [[0, '#ffb060', 0.9], [0.3, '#e0642a', 0.5], [1, '#801c08', 0]]) +
      rg(P + '-sm', 0.5, 0.5, 0.5, [[0, '#231c16', 0.9], [0.55, '#231c16', 0.6], [1, '#231c16', 0]]) +
      rg(P + '-sml', 0.5, 0.5, 0.5, [[0, '#6e5034', 0.7], [0.6, '#5a4028', 0.35], [1, '#5a4028', 0]]) +
      rg(P + '-ff', 560, 205, 470, [[0, '#fff2a8'], [0.22, '#f4d44a'], [0.55, '#e8c020'], [1, '#9a760c']], true) +
      lg(P + '-fs', r(fx(0)), 0, r(fx(1)), 0, shS, true) +
      lg(P + '-fh', r(fx(0)), 0, r(fx(1)), 0, shH, true) +
      lg(P + '-gnd', 0, 0, 0, 1, [[0, '#2c2014'], [0.4, '#150f0a'], [1, '#080605']]) +
      lg(P + '-ray', 0, 0, 1, 0, [[0, '#f4d8a0', 0.22], [1, '#f4d8a0', 0]]) +
      lg(P + '-pole', 0, 0, 1, 0, [[0, '#0c0806'], [0.6, '#241a10'], [1, '#8a6a3a']]) +
      '<clipPath id="' + P + '-fc"><path d="' + flagD + '"/></clipPath>' +
      '<pattern id="' + P + '-win" width="11" height="17" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="5" height="8" fill="#140e08" opacity=".6"/></pattern>' +
      blurF(P + '-pb', 3.4, 10) + blurF(P + '-pb2', 6, 10) + blurF(P + '-glow', 18, 20) + blurF(P + '-b3', 3) +
      pat + '</defs>';

    var s = '<rect width="1600" height="900" fill="url(#' + P + '-sky)"/>';
    s += '<rect width="1600" height="900" fill="url(#' + P + '-sun)"/>';
    s += '<circle cx="560" cy="205" r="46" fill="#f8e6b8" opacity=".55" filter="url(#' + P + '-b3)"/>';
    // 光束（穿过烟尘）
    var rays = '';
    for (i = 0; i < 9; i++) {
      var ang = -0.5 + i * 0.3 + (R() - 0.5) * 0.12, w = 0.025 + R() * 0.035, L = 1300;
      rays += poly([[560, 205], [560 + Math.cos(ang - w) * L, 205 + Math.sin(ang - w) * L], [560 + Math.cos(ang + w) * L, 205 + Math.sin(ang + w) * L]],
        'fill="#f0cc88" opacity="' + f3(0.04 + R() * 0.05) + '"');
    }
    s += '<g class="' + P + '-rays">' + rays + '</g>';
    // 天顶的浓烟
    var ceil = '';
    for (i = 0; i < 14; i++) {
      ceil += '<ellipse cx="' + r(i * 125 + R() * 60 - 40) + '" cy="' + r(-10 + R() * 110) + '" rx="' + r(200 + R() * 220) + '" ry="' + r(80 + R() * 70) + '" fill="url(#' + P + '-sm)"/>';
    }
    s += '<g opacity=".85">' + ceil + '</g>';
    // 远处轰炸机编队（极小）
    var planes = '';
    [[1395, 118, 1], [1430, 104, 0.85], [1462, 126, 0.9], [1498, 110, 0.75]].forEach(function (p) {
      planes += '<path transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + p[2] + ')" d="M-11 0L-1 -1L11 -2L1 1Z M-3 -1L-6 -4L-4 -4L0 -1Z"/>';
    });
    s += '<g fill="#1a130c" opacity=".7">' + planes + '</g>';

    /* 烟柱 */
    function smoke(x0, y0, n, drift, sc, cls) {
      var g = '<g class="' + cls + '">';
      for (var kk = 0; kk < n; kk++) {
        var t = kk / n, cx = x0 + drift * t * t * 420 + (R() - 0.5) * 24, cy = y0 - kk * 44 * sc;
        g += '<ellipse cx="' + r(cx) + '" cy="' + r(cy) + '" rx="' + r((28 + kk * 14) * sc * (0.8 + R() * 0.4)) + '" ry="' + r((24 + kk * 9) * sc) +
          '" fill="url(#' + P + (kk < 3 ? '-sml' : '-sm') + ')" opacity="' + f3(0.95 - t * 0.55) + '"/>';
      }
      return g + '</g>';
    }
    s += smoke(470, 560, 11, 0.7, 1.05, P + '-smA') + smoke(935, 568, 7, 0.5, 0.6, P + '-smB');

    /* 品字形四幢楼 */
    var blds = [[602, 44, 452, '#5c4832'], [716, 74, 372, '#3c2e20'], [846, 60, 404, '#46362a'], [962, 40, 462, '#62503a']];
    var bs = '';
    blds.forEach(function (b, j) {
      var x = b[0], w = b[1], y = b[2];
      bs += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (580 - y) + '" fill="' + b[3] + '"/>';
      bs += '<rect x="' + (x + 5) + '" y="' + (y + 14) + '" width="' + (w - 10) + '" height="' + (570 - y) + '" fill="url(#' + P + '-win)"/>';
      bs += '<rect x="' + (x - 2) + '" y="' + (y - 4) + '" width="' + (w + 4) + '" height="6" fill="' + b[3] + '"/>';
      bs += '<rect x="' + x + '" y="' + y + '" width="2.5" height="' + (580 - y) + '" fill="#d0a060" opacity=".45"/>';
      if (j === 1) { // 长兄之楼：屋顶小亭
        bs += '<rect x="' + (x + 24) + '" y="' + (y - 22) + '" width="26" height="20" fill="' + b[3] + '"/>' +
          '<path d="M' + (x + 14) + ' ' + (y - 20) + 'Q' + (x + 37) + ' ' + (y - 30) + ' ' + (x + 37) + ' ' + (y - 40) + 'Q' + (x + 37) + ' ' + (y - 30) + ' ' + (x + 60) + ' ' + (y - 20) + 'Z" fill="' + b[3] + '"/>' +
          '<rect x="' + (x + 36) + '" y="' + (y - 50) + '" width="2" height="12" fill="' + b[3] + '"/>';
      }
      for (k = 0; k < 3; k++) {
        bs += '<rect x="' + r(x + 8 + Math.floor(R() * (w - 16) / 11) * 11 - 2) + '" y="' + r(y + 18 + Math.floor(R() * 8) * 17) + '" width="5" height="8" fill="#f09040" opacity="' + f3(0.4 + R() * 0.5) + '"/>';
      }
    });
    s += '<g>' + bs + '</g>';
    // 楼群被烟尘笼罩
    s += '<rect x="560" y="330" width="480" height="260" fill="#8a6838" opacity=".14"/>';

    /* 废墟 */
    function ruinLine(y0, hmin, hmax, smin, smax) {
      var pts = [[0, y0 + 60]], x = -10;
      while (x < 1610) {
        var w = smin + R() * (smax - smin), h = hmin + R() * (hmax - hmin), t = R();
        if (t < 0.35) pts.push([x, y0 - h], [x + w * 0.3, y0 - h - R() * 14], [x + w * 0.5, y0 - h * 0.6], [x + w, y0 - h * (0.3 + R() * 0.5)]);
        else if (t < 0.55) pts.push([x, y0 - h * 0.4], [x + 3, y0 - h * 1.4], [x + 10, y0 - h * 1.35], [x + 13, y0 - h * 0.4], [x + w, y0 - h * 0.5]);
        else pts.push([x + w * 0.5, y0 - h * 0.5 - R() * 8], [x + w, y0 - h * 0.3]);
        x += w;
      }
      pts.push([1610, y0 + 60]);
      return 'M-10 900L' + pts.map(P2).join('L') + 'L1610 900Z';
    }
    s += '<path d="' + ruinLine(582, 8, 36, 16, 46) + '" fill="#3a2a1b"/>';
    // 地平线上的火
    var fires = [[470, 572, 170], [1135, 568, 150], [1492, 560, 120], [935, 578, 80], [262, 588, 90], [760, 584, 60]];
    var fs = '';
    fires.forEach(function (f) {
      fs += '<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="' + f[2] + '" ry="' + r(f[2] * 0.38) + '" fill="url(#' + P + '-fire)"/>';
      var fl = [];
      for (k = 0; k <= 8; k++) fl.push([f[0] - f[2] * 0.25 + k * f[2] * 0.0625, f[1] + 6 - (k % 2 ? 10 + R() * f[2] * 0.14 : R() * 5)]);
      fs += poly(fl.concat([[f[0] + f[2] * 0.25, f[1] + 12], [f[0] - f[2] * 0.25, f[1] + 12]]), 'fill="#f4a050" opacity=".85"');
    });
    s += '<g class="' + P + '-fire">' + fs + '</g>';
    s += smoke(1135, 552, 10, 0.9, 0.95, P + '-smC') + smoke(1492, 545, 8, 0.6, 0.8, P + '-smA') + smoke(262, 575, 6, 0.4, 0.6, P + '-smB');
    s += '<path d="' + ruinLine(632, 20, 70, 24, 70) + '" fill="#1e150d"/>';
    // 中景残墙（带窗洞）
    var walls = [[520, 640, 90, 110], [690, 646, 60, 70], [1020, 640, 110, 95], [1210, 648, 70, 60]];
    walls.forEach(function (w) {
      var x = w[0], yb = w[1], ww = w[2], hh = w[3], pts = [[x, yb], [x, yb - hh * (0.7 + R() * 0.3)]];
      for (k = 1; k < 5; k++) pts.push([x + ww * k / 5, yb - hh * (0.35 + R() * 0.65)]);
      pts.push([x + ww, yb - hh * (0.2 + R() * 0.4)], [x + ww, yb]);
      s += poly(pts, 'fill="#1a120b"');
      s += '<rect x="' + r(x + ww * 0.18) + '" y="' + r(yb - hh * 0.3) + '" width="' + r(ww * 0.16) + '" height="' + r(hh * 0.18) + '" fill="#6e4a26"/>';
      s += '<rect x="' + r(x + ww * 0.5) + '" y="' + r(yb - hh * 0.3) + '" width="' + r(ww * 0.14) + '" height="' + r(hh * 0.18) + '" fill="#5a3c20"/>';
      s += '<rect x="' + x + '" y="' + r(yb - hh * 0.6) + '" width="2" height="' + r(hh * 0.6) + '" fill="#b07c44" opacity=".35"/>';
    });
    // 倒下的电线杆
    s += '<path d="M1336 650L1276 360M1252 372L1306 360" stroke="#120c08" stroke-width="6" fill="none"/>' +
      '<path d="M1256 372Q1440 440 1610 418M1300 362Q1460 420 1610 398M1256 372Q1150 470 1040 520" stroke="#120c08" stroke-width="1.4" fill="none" opacity=".8"/>';
    // 斜插的焦梁
    s += '<path d="M1060 560L1165 470M860 600L790 540" stroke="#160f09" stroke-width="7"/>';

    /* 旗杆 + 旗 */
    s += '<path d="M170 660L230 628L262 604L300 598L330 586L372 590L410 604L462 618L520 636L560 660Z" fill="#150e08"/>';
    s += '<rect x="343" y="56" width="9" height="560" fill="url(#' + P + '-pole)"/>' +
      '<path d="M347.5 22L355 50L347.5 58L340 50Z" fill="#2a1e12"/><circle cx="347.5" cy="60" r="6" fill="#241a10"/>';
    s += '<g class="' + P + '-flag">' +
      '<path d="' + flagD + '" fill="#e8c020" opacity=".4" filter="url(#' + P + '-glow)"/>' +
      '<path d="' + flagD + '" fill="url(#' + P + '-ff)"/>' +
      '<g clip-path="url(#' + P + '-fc)">' +
      '<use href="#' + P + '-pat" filter="url(#' + P + '-pb)" opacity=".78"/>' +
      '<g transform="translate(10 -6)"><g class="' + P + '-ghost"><use href="#' + P + '-pat" filter="url(#' + P + '-pb2)" opacity=".28"/></g></g>' +
      '<rect x="340" y="40" width="640" height="420" fill="url(#' + P + '-fs)"/>' +
      '<rect x="340" y="40" width="640" height="420" fill="url(#' + P + '-fh)"/></g>' +
      '<path d="' + flagD + '" fill="none" stroke="#5a3e06" stroke-width="2" opacity=".7"/></g>';
    s += '<g fill="#1a120a">';
    [98, 168, 240, 312].forEach(function (y) { s += '<rect x="340" y="' + y + '" width="15" height="5" rx="2"/>'; });
    s += '</g>';

    /* 近景残墙 */
    s += poly([[0, 660], [0, 222], [40, 246], [62, 230], [90, 290], [118, 298], [132, 362], [160, 380], [172, 452], [196, 470], [212, 560], [236, 600], [262, 660]], 'fill="#100b07"');
    s += '<path d="M40 420V352Q60 328 80 352V420Z" fill="#5a3c20"/><rect x="96" y="486" width="38" height="70" fill="#4a3018"/>' +
      '<path d="M70 250L95 300L118 300L132 362L160 380L172 452L196 470L212 560" fill="none" stroke="#a87440" stroke-width="2" opacity=".4"/>';
    s += poly([[1600, 660], [1600, 424], [1572, 414], [1556, 444], [1532, 452], [1522, 500], [1492, 512], [1484, 560], [1462, 582], [1440, 660]], 'fill="#100b07"') +
      '<rect x="1544" y="506" width="28" height="52" fill="#4a3018"/><path d="M1526 470L1420 432" stroke="#100b07" stroke-width="8"/>';

    /* 地面与碎砖 */
    s += '<rect y="640" width="1600" height="260" fill="url(#' + P + '-gnd)"/>';
    var rub = '';
    for (i = 0; i < 70; i++) {
      var rx = R() * 1600, ry = 648 + R() * R() * 250, rs = 3 + R() * 9 * (ry - 600) / 150;
      rub += 'M' + r(rx) + ' ' + r(ry) + 'l' + r(rs) + ' ' + r(-rs * 0.4) + 'l' + r(rs * 0.7) + ' ' + r(rs * 0.5) + 'l' + r(-rs * 1.2) + ' ' + r(rs * 0.3) + 'Z';
    }
    s += '<path d="' + rub + '" fill="#3a2a1a" opacity=".6"/>';

    /* 飘灰与余烬 */
    var ash1 = '', ash2 = '', emb = '';
    for (i = 0; i < 110; i++) { var ax = R() * 1600, ay = R() * 640; if (i % 2) ash1 += dot(ax, ay); else ash2 += dot(ax, ay); }
    for (i = 0; i < 26; i++) emb += dot(380 + R() * 1200, 380 + R() * 220);
    s += '<g class="' + P + '-ash" stroke-linecap="round"><path d="' + ash1 + '" stroke="#c8b08a" stroke-width="2.2" opacity=".45"/>' +
      '<path d="' + ash2 + '" stroke="#e0d0b0" stroke-width="1.3" opacity=".5"/></g>' +
      '<path class="' + P + '-emb" d="' + emb + '" stroke="#ff9a40" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>';
    // 老胶片划痕
    s += '<path d="M212 0V900M988 0V520M1377 90V900M1512 0V300" stroke="#e8d8b0" stroke-width="1" opacity=".09"/>';
    s += U.vignette(P, 0.85);

    var css = '.' + P + '-flag{transform-origin:348px 210px;animation:' + P + '-wave 6s ease-in-out infinite alternate}' +
      '@keyframes ' + P + '-wave{0%{transform:skewY(0deg) scaleX(1)}100%{transform:skewY(1.6deg) scaleX(.975)}}' +
      '.' + P + '-ghost{animation:' + P + '-gh 5s ease-in-out infinite}' +
      '@keyframes ' + P + '-gh{0%,100%{transform:translate(0,0)}50%{transform:translate(-8px,6px)}}' +
      '.' + P + '-smA,.' + P + '-smC{animation:' + P + '-sm 14s ease-in-out infinite alternate}' +
      '.' + P + '-smB{animation:' + P + '-sm 10s ease-in-out infinite alternate-reverse}' +
      '@keyframes ' + P + '-sm{0%{transform:translate(0,0)}100%{transform:translate(26px,-10px)}}' +
      '.' + P + '-ash{animation:' + P + '-ash 18s linear infinite alternate}' +
      '@keyframes ' + P + '-ash{0%{transform:translate(0,0)}100%{transform:translate(40px,18px)}}' +
      '.' + P + '-fire,.' + P + '-emb{animation:' + P + '-fl 2.4s ease-in-out infinite alternate}' +
      '@keyframes ' + P + '-fl{0%{opacity:.75}50%{opacity:1}100%{opacity:.85}}' +
      '.' + P + '-rays{animation:' + P + '-fl 7s ease-in-out infinite alternate}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 加德满都机场外（夜） */
  BG.ktm_airport = function () {
    var P = 'bg-ktm', R = U.rng(40621), i, k;
    var d = '<defs>' +
      lg(P + '-sky', 0, 0, 0, 1, [[0, '#04070c'], [0.3, '#0a101a'], [0.46, '#111a28'], [0.54, '#1a2232'], [1, '#0d1420']]) +
      rg(P + '-fl', 270, 80, 760, [[0, '#cfe6e6', 0.4], [0.25, '#8aa8b4', 0.14], [1, '#0d1420', 0]], true) +
      lg(P + '-cone', 0, 226, 0, 560, [[0, '#f4ac4c', 0.5], [1, '#f4ac4c', 0.04]], true) +
      rg(P + '-pool', 0.5, 0.5, 0.5, [[0, '#e89a40', 0.55], [1, '#e89a40', 0]]) +
      rg(P + '-glow', 0.5, 0.5, 0.5, [[0, '#fff6e0', 1], [0.2, '#ffd890', 0.55], [1, '#ffb050', 0]]) +
      rg(P + '-cglow', 0.5, 0.5, 0.5, [[0, '#f4ffff', 1], [0.25, '#bfe0e8', 0.45], [1, '#7fb0c0', 0]]) +
      lg(P + '-gnd', 0, 0, 0, 1, [[0, '#121822'], [1, '#05070a']]) +
      lg(P + '-haze', 0, 0, 0, 1, [[0, '#4a5060', 0], [0.5, '#4a5060', 0.2], [1, '#4a5060', 0]]) +
      lg(P + '-refl', 0, 0, 0, 1, [[0, '#bfe0e8', 0.28], [1, '#bfe0e8', 0]]) +
      lg(P + '-refa', 0, 0, 0, 1, [[0, '#f0a040', 0.35], [1, '#f0a040', 0]]) +
      blurF(P + '-b4', 4) + blurF(P + '-b10', 10) +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-sky)"/>';
    var st = '', st2 = '';
    for (i = 0; i < 80; i++) { var sx = 300 + R() * 1300, sy = 70 + R() * 250; if (i % 3) st += dot(sx, sy); else st2 += dot(sx, sy); }
    s += '<path d="' + st + '" stroke="#c8d4e8" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>' +
      '<path class="' + P + '-tw" d="' + st2 + '" stroke="#e8f0ff" stroke-width="2" stroke-linecap="round" opacity=".7"/>';
    // 谷地四周的山
    var far = ridge(R, [[0, 372], [200, 318], [430, 356], [660, 300], [900, 348], [1170, 286], [1400, 336], [1600, 304]], 40, 4);
    var near = ridge(R, [[0, 420], [320, 386], [620, 414], [920, 382], [1260, 410], [1600, 378]], 26, 4);
    s += '<path d="' + mtnD(far, 600) + '" fill="#121b29"/>' + '<path d="' + mtnD(near, 600) + '" fill="#0c131d"/>';
    var hl = '';
    for (i = 0; i < 11; i++) hl += dot(420 + R() * 1150, 392 + R() * 30);
    s += '<path d="' + hl + '" stroke="#f0b060" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>';
    // 山坡上的尼泊尔塔庙剪影
    s += '<g fill="#080d15"><rect x="1010" y="392" width="60" height="30"/>' +
      '<path d="M996 394L1084 394L1066 380L1014 380Z M1018 380L1062 380L1062 366L1018 366Z M1006 368L1074 368L1058 354L1022 354Z M1026 354L1054 354L1054 344L1026 344Z M1016 346L1064 346L1050 334L1030 334Z"/>' +
      '<path d="M1040 334L1037 324L1040 314L1043 324Z"/></g>' +
      '<path d="M996 394L1014 380M1006 368L1022 354M1016 346L1030 334" stroke="#e8a050" stroke-width="1" opacity=".35"/>' +
      '<circle cx="1062" cy="408" r="2" fill="#ffc070"/><circle cx="1062" cy="408" r="10" fill="url(#' + P + '-glow)" opacity=".5"/>';
    // 远处树丛与停车场
    var trees = '';
    for (i = 0; i < 26; i++) { var tx = 640 + i * 38 + R() * 20, tr = 16 + R() * 24; trees += ell(tx, 452 - tr * 0.5, tr, tr * 0.8); }
    s += '<path d="' + trees + '" fill="#070b12"/><rect y="450" width="1600" height="450" fill="url(#' + P + '-gnd)"/>';
    s += '<rect y="400" width="1600" height="160" fill="url(#' + P + '-haze)" class="' + P + '-hz"/>';

    // 钠灯
    s += '<path d="M1228 212L1238 212L1236 536L1230 536Z" fill="#06080c"/><path d="M1233 220Q1210 206 1188 218" stroke="#06080c" stroke-width="5" fill="none"/>' +
      '<path d="M1172 220L1206 220L1200 228L1178 228Z" fill="#1a1a1a"/>' +
      '<path class="' + P + '-cone" d="M1178 228L1200 228L1360 540L1030 540Z" fill="url(#' + P + '-cone)"/>' +
      '<ellipse cx="1190" cy="540" rx="200" ry="24" fill="url(#' + P + '-pool)"/>' +
      '<ellipse cx="1189" cy="226" rx="70" ry="50" fill="url(#' + P + '-glow)" opacity=".8"/>';
    var bugs = '';
    for (i = 0; i < 14; i++) bugs += dot(1150 + R() * 80, 232 + R() * 70);
    s += '<path class="' + P + '-tw" d="' + bugs + '" stroke="#ffe0a0" stroke-width="1.6" stroke-linecap="round"/>';

    // 出租车
    function car(x, y, sc, flip) {
      return '<path transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -sc : sc) + ' ' + sc + ')" d="M-60 0L-60 -18Q-58 -24 -48 -25L-34 -26L-22 -40L22 -40L34 -26L56 -24Q62 -22 62 -14L62 0Z"/>';
    }
    s += '<g fill="#06090e">' + car(1400, 540, 1, false) + car(1530, 546, 1.1, true) + '<rect x="1560" y="486" width="60" height="62"/></g>' +
      '<rect x="1412" y="506" width="22" height="7" fill="#e8d8a0" opacity=".3"/><rect x="1370" y="507" width="16" height="6" fill="#e8d8a0" opacity=".25"/>';
    // 车灯眩光
    s += '<ellipse cx="1462" cy="530" rx="22" ry="10" fill="url(#' + P + '-glow)"/><ellipse cx="1462" cy="530" rx="190" ry="2.4" fill="#fff4d0" opacity=".45"/>' +
      '<path d="M1462 526L1250 560L1300 600Z" fill="#fff0c8" opacity=".08"/>';

    /* 人群（远离镜头的一排，举着接机牌） */
    function light(x) { // 左上荧光灯（冷）/ 右侧钠灯（暖）
      var c = Math.max(0, 1 - Math.abs(x - 330) / 520), a = Math.max(0, 1 - Math.abs(x - 1180) / 380);
      return [c, a];
    }
    var rows = [[536, 0.72, 29, '#0c1119'], [552, 0.8, 32, '#0a0e15'], [570, 0.9, 36, '#080b11']];
    var signs = [], crowd = '';
    rows.forEach(function (row, ri) {
      var yb = row[0], sc = row[1], x = 150 + R() * 20, bodyD = '', rimC = '', rimA = '';
      while (x < 1260) {
        var hx = x + (R() - 0.5) * 8, hy = yb - 74 * sc + (R() - 0.5) * 6 * sc, w = 15 * sc * (0.85 + R() * 0.3), hr = 8.5 * sc * (0.9 + R() * 0.2);
        var shape = 'M' + r(hx - w) + ' ' + (yb + 50) + 'L' + r(hx - w) + ' ' + r(hy + 22 * sc) + 'Q' + r(hx - w) + ' ' + r(hy + 12 * sc) + ' ' + r(hx - w * 0.4) + ' ' + r(hy + 11 * sc) +
          'L' + r(hx + w * 0.4) + ' ' + r(hy + 11 * sc) + 'Q' + r(hx + w) + ' ' + r(hy + 12 * sc) + ' ' + r(hx + w) + ' ' + r(hy + 22 * sc) + 'L' + r(hx + w) + ' ' + (yb + 50) + 'Z' + ell(hx, hy, hr, hr * 1.1);
        bodyD += shape;
        var L = light(hx);
        if (L[0] > 0.15) rimC += shape; else if (L[1] > 0.15) rimA += shape;
        if (R() < 0.42 - ri * 0.06) signs.push([hx, hy, sc, ri]);
        x += row[2] * (0.75 + R() * 0.5);
      }
      crowd += '<path d="' + rimC + '" fill="#6f8894" transform="translate(0 -1.6)" opacity="' + (0.45 + ri * 0.1) + '"/>' +
        '<path d="' + rimA + '" fill="#b07a3c" transform="translate(1.2 -1.4)" opacity="' + (0.5 + ri * 0.1) + '"/>' +
        '<path d="' + bodyD + '" fill="' + row[3] + '"/>';
      // 这一排举起的牌子
      signs.filter(function (sg) { return sg[3] === ri; }).forEach(function (sg, j) {
        var sw = (46 + R() * 34) * sg[2], sh = (28 + R() * 12) * sg[2], sy = sg[1] - 34 * sg[2] - sh - R() * 20, rot = r((R() - 0.5) * 22);
        var Lx = light(sg[0]), lit = Math.min(1, 0.3 + Lx[0] * 0.8 + Lx[1] * 0.9);
        var col = Lx[1] > Lx[0] ? U.mix('#3a3a40', '#f0d6a0', lit) : U.mix('#3a3e46', '#e6eee8', lit);
        crowd += '<path d="M' + r(sg[0] - 8 * sg[2]) + ' ' + r(sg[1] + 10 * sg[2]) + 'L' + r(sg[0] - 6 * sg[2]) + ' ' + r(sy + sh) + 'M' + r(sg[0] + 8 * sg[2]) + ' ' + r(sg[1] + 10 * sg[2]) + 'L' + r(sg[0] + 6 * sg[2]) + ' ' + r(sy + sh) +
          '" stroke="' + row[3] + '" stroke-width="' + r(5 * sg[2]) + '" stroke-linecap="round"/>';
        crowd += '<g transform="rotate(' + rot + ' ' + r(sg[0]) + ' ' + r(sy + sh / 2) + ')"><rect x="' + r(sg[0] - sw / 2) + '" y="' + r(sy) + '" width="' + r(sw) + '" height="' + r(sh) + '" fill="' + col + '"/>';
        var words = ['TAXI', 'HOTEL', 'NADO', 'GUIDE', 'TAXI'];
        var widx = signs.indexOf(sg);
        if (widx % 4 === 1 && words.length) {
          crowd += '<text x="' + r(sg[0]) + '" y="' + r(sy + sh * 0.68) + '" font-family="Songti SC, STSong, SimSun, serif" font-weight="bold" font-size="' + r(sh * 0.5) + '" text-anchor="middle" fill="#1c1c20" opacity=".8">' + words[(widx >> 2) % words.length] + '</text>';
        } else {
          var sq = 'M' + r(sg[0] - sw * 0.36) + ' ' + r(sy + sh * 0.4);
          for (k = 0; k < 6; k++) sq += 'l' + r(sw * 0.06) + ' ' + r((k % 2 ? 1 : -1) * sh * 0.14) + 'l' + r(sw * 0.06) + ' 0';
          sq += 'M' + r(sg[0] - sw * 0.3) + ' ' + r(sy + sh * 0.72) + 'h' + r(sw * 0.5);
          crowd += '<path d="' + sq + '" stroke="#202024" stroke-width="' + r(2.4 * sg[2]) + '" fill="none" opacity=".7"/>';
        }
        crowd += '</g>';
      });
    });
    s += crowd;
    // 挥动的手臂
    var arms = '';
    for (i = 0; i < 9; i++) { var ax = 200 + R() * 1040, ay = 500 + R() * 20; arms += 'M' + r(ax) + ' ' + r(ay) + 'l' + r((R() - 0.5) * 20) + ' ' + r(-26 - R() * 16); }
    s += '<path class="' + P + '-wave" d="' + arms + '" stroke="#0a0e15" stroke-width="4.5" stroke-linecap="round"/>';
    // 铁栏杆
    var rail = 'M130 572H1290M130 596H1290';
    for (k = 130; k <= 1290; k += 58) rail += 'M' + k + ' 572V612';
    s += '<path d="' + rail + '" stroke="#05070a" stroke-width="5"/><path d="M130 570H1290" stroke="#8aa0a8" stroke-width="1.4" opacity=".5"/>' +
      '<path d="M900 570H1290" stroke="#e0a050" stroke-width="1.4" opacity=".45"/>';

    // 地面反光
    s += '<rect x="170" y="600" width="220" height="220" fill="url(#' + P + '-refl)" filter="url(#' + P + '-b10)"/>' +
      '<rect x="1140" y="560" width="110" height="200" fill="url(#' + P + '-refa)" filter="url(#' + P + '-b10)"/>' +
      '<path d="' + ell(640, 700, 150, 12) + ell(1000, 760, 110, 9) + ell(300, 812, 180, 14) + '" fill="#2a3444" opacity=".5"/>' +
      '<path d="M540 700h90M960 760h60M220 812h120" stroke="#9ab8c4" stroke-width="1.5" opacity=".25"/>';

    // 左上：航站楼雨棚与柱子、荧光灯管
    s += '<rect width="1600" height="900" fill="url(#' + P + '-fl)"/>';
    s += '<path d="M0 0H1010L930 42L0 70Z" fill="#070a0f"/><path d="M0 70L930 42L1010 0" stroke="#3a4450" stroke-width="2" fill="none"/>' +
      '<path d="M0 70L930 42L930 50L0 80Z" fill="#141a22"/>' +
      '<path d="M210 80V92M370 76V88" stroke="#0a0c10" stroke-width="2"/>' +
      '<g class="' + P + '-flk"><rect x="190" y="90" width="200" height="8" rx="3" fill="#f0ffff"/>' +
      '<ellipse cx="290" cy="94" rx="190" ry="40" fill="url(#' + P + '-cglow)" opacity=".55"/></g>' +
      '<rect x="0" y="60" width="54" height="840" fill="#06080c"/><rect x="50" y="60" width="4" height="840" fill="#7a96a0" opacity=".35"/>';
    s += U.vignette(P, 0.72);
    var css = '.' + P + '-flk{animation:' + P + '-flk 5s steps(1) infinite}' +
      '@keyframes ' + P + '-flk{0%,100%{opacity:1}62%{opacity:1}63%{opacity:.35}64%{opacity:1}66%{opacity:.5}67%{opacity:1}}' +
      '.' + P + '-tw{animation:' + P + '-tw 3s ease-in-out infinite alternate}' +
      '@keyframes ' + P + '-tw{0%{opacity:.35}100%{opacity:.9}}' +
      '.' + P + '-hz{animation:' + P + '-hz 16s ease-in-out infinite alternate}' +
      '@keyframes ' + P + '-hz{0%{transform:translateX(0)}100%{transform:translateX(-40px)}}' +
      '.' + P + '-wave{animation:' + P + '-wv 1.6s ease-in-out infinite alternate}' +
      '@keyframes ' + P + '-wv{0%{transform:translateY(0)}100%{transform:translateY(-4px)}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 夜里盘山路 */
  BG.jeep_night = function () {
    var P = 'bg-jeep', R = U.rng(6263), i;
    var road = 'M-50 900C250 760 560 560 700 478L620 466L740 462C880 486 1150 620 1650 900Z';
    var rock = [[0, 0], [540, 0], [600, 120], [662, 250], [720, 360], [752, 430], [746, 468], [690, 486], [560, 560], [400, 650], [220, 760], [40, 860], [0, 880]];
    var d = '<defs>' +
      lg(P + '-sky', 0, 0, 0, 1, [[0, '#03050a'], [0.35, '#08101c'], [0.55, '#122036'], [1, '#0d1420']]) +
      rg(P + '-moon', 1290, 140, 300, [[0, '#d6e2f4', 0.4], [0.15, '#8aa0c8', 0.16], [1, '#0d1420', 0]], true) +
      lg(P + '-snow', 0, 240, 0, 400, [[0, '#cad6e6'], [0.35, '#7d8eab'], [1, '#2a3652']], true) +
      lg(P + '-road', 0, 460, 0, 900, [[0, '#18181a'], [0.15, '#3a342c'], [0.45, '#7a6c56'], [1, '#a8987a']], true) +
      lg(P + '-beam', 0, 930, 0, 470, [[0, '#fff2d4', 0.42], [0.55, '#fff2d4', 0.14], [1, '#fff2d4', 0]], true) +
      rg(P + '-hot', 0.5, 0.5, 0.5, [[0, '#fff0c8', 0.55], [1, '#fff0c8', 0]]) +
      lg(P + '-rock', 720, 640, 360, 200, [[0, '#6a5a46'], [0.18, '#2e2822'], [0.5, '#141518'], [1, '#0a0c10']], true) +
      lg(P + '-void', 0, 460, 0, 900, [[0, '#1a2842'], [0.3, '#0c1424'], [1, '#04060a']], true) +
      lg(P + '-mist', 0, 0, 0, 1, [[0, '#7a8aa8', 0], [0.5, '#7a8aa8', 0.26], [1, '#7a8aa8', 0]]) +
      '<clipPath id="' + P + '-rc"><path d="' + road + '"/></clipPath>' +
      '<clipPath id="' + P + '-kc"><path d="' + dPath(rock, true) + '"/></clipPath>' +
      blurF(P + '-b2', 2) + blurF(P + '-b8', 8) +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-sky)"/>';
    var st = '', st2 = '';
    for (i = 0; i < 120; i++) { var sx = 500 + R() * 1100, sy = R() * 300; if (Math.hypot(sx - 1290, sy - 140) < 90) continue; if (i % 4) st += dot(sx, sy); else st2 += dot(sx, sy); }
    s += '<path d="' + st + '" stroke="#c0cce0" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>' +
      '<path class="' + P + '-tw" d="' + st2 + '" stroke="#eef4ff" stroke-width="2.1" stroke-linecap="round"/>';
    s += '<rect width="1600" height="900" fill="url(#' + P + '-moon)"/><circle cx="1290" cy="140" r="27" fill="#eef2f6"/>' +
      '<circle cx="1282" cy="134" r="6" fill="#c8d0dc" opacity=".6"/><circle cx="1298" cy="150" r="4" fill="#c8d0dc" opacity=".5"/>';
    // 远方雪山（月光从右上来，右坡受光）
    var sk = [[560, 360], [700, 290], [800, 330], [930, 236], [1040, 318], [1150, 262], [1250, 330], [1380, 250], [1500, 322], [1600, 280]];
    var snowR = ridge(R, sk, 22, 3);
    s += '<path d="' + mtnD(snowR, 520) + '" fill="#1c2740"/>';
    s += '<clipPath id="' + P + '-sc"><path d="' + mtnD(snowR, 520) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-sc)" d="' + facets(sk, 520, false, R) + '" fill="url(#' + P + '-snow)" opacity=".9"/>';
    s += '<rect x="500" y="300" width="1100" height="120" fill="url(#' + P + '-mist)" opacity=".7"/>';
    var mid = ridge(R, [[560, 420], [760, 372], [980, 404], [1200, 360], [1420, 398], [1600, 368]], 24, 4);
    s += '<path d="' + mtnD(mid, 560) + '" fill="#0f182a"/><path d="' + dPath(mid) + '" stroke="#5a6e94" stroke-width="1.2" fill="none" opacity=".35"/>';
    var vr = ridge(R, [[600, 488], [900, 454], [1200, 482], [1600, 450]], 18, 4);
    s += '<path d="' + mtnD(vr, 900) + '" fill="url(#' + P + '-void)"/>';
    s += '<g class="' + P + '-mst"><rect x="560" y="440" width="1100" height="90" fill="url(#' + P + '-mist)"/><rect x="700" y="520" width="1000" height="120" fill="url(#' + P + '-mist)" opacity=".6"/></g>';

    // 路面
    s += '<path d="' + road + '" fill="url(#' + P + '-road)"/>';
    var gr = ['', '', '', ''];
    for (i = 0; i < 520; i++) {
      var gy = 470 + Math.pow(R(), 0.8) * 430, gx = 300 + R() * 1100, bin = gy < 600 ? 0 : gy < 760 ? 1 : 2;
      gr[R() < 0.5 ? bin : 3] += dot(gx, gy);
    }
    s += '<g clip-path="url(#' + P + '-rc)" stroke-linecap="round">' +
      '<ellipse cx="800" cy="720" rx="480" ry="190" fill="url(#' + P + '-hot)"/>' +
      '<path d="M500 900Q640 640 744 470L752 470Q700 640 590 900Z M1070 900Q880 660 760 470L768 470Q930 660 1160 900Z" fill="#3a3024" opacity=".45"/>' +
      '<path d="' + gr[0] + '" stroke="#c8b898" stroke-width="1.6" opacity=".5"/><path d="' + gr[1] + '" stroke="#d8c8a8" stroke-width="2.6" opacity=".55"/>' +
      '<path d="' + gr[2] + '" stroke="#e0d0b0" stroke-width="4" opacity=".55"/><path d="' + gr[3] + '" stroke="#2a241c" stroke-width="3" opacity=".5"/></g>';
    // 右侧崖边碎石唇
    var lip = [];
    for (i = 0; i <= 24; i++) {
      var t = i / 24, mt = 1 - t;
      var bx = mt * mt * mt * 740 + 3 * mt * mt * t * 880 + 3 * mt * t * t * 1150 + t * t * t * 1650;
      var by = mt * mt * mt * 462 + 3 * mt * mt * t * 486 + 3 * mt * t * t * 620 + t * t * t * 900;
      lip.push([bx + (R() - 0.3) * 8 * (0.3 + t * 3), by - (2 + R() * 10) * (0.3 + t * 2)]);
    }
    s += '<path d="' + dPath(lip) + 'L1650 900L1650 880Z" fill="#5a4e3c" opacity=".7"/>';
    // 白漆路标石
    [[0.07, 0.3], [0.17, 0.45], [0.31, 0.7], [0.5, 1.05], [0.74, 1.6]].forEach(function (m) {
      var t = m[0], mt = 1 - t, sc = m[1];
      var x = mt * mt * mt * 752 + 3 * mt * mt * t * 890 + 3 * mt * t * t * 1160 + t * t * t * 1660;
      var y = mt * mt * mt * 462 + 3 * mt * mt * t * 486 + 3 * mt * t * t * 620 + t * t * t * 900;
      s += '<g transform="translate(' + r(x) + ' ' + r(y) + ') scale(' + sc + ')"><path d="M-14 0L-14 -22Q-14 -34 0 -34Q14 -34 14 -22L14 0Z" fill="#e8e2d2"/>' +
        '<path d="M-14 -16L14 -16L14 -24Q14 -34 0 -34Q-14 -34 -14 -24Z" fill="#b8402e"/><path d="M4 0L4 -33Q14 -32 14 -22L14 0Z" fill="#000" opacity=".3"/></g>';
    });
    // 山壁
    s += poly(rock, 'fill="url(#' + P + '-rock)"');
    var cr = '', ledge = '', shrub = '';
    for (i = 0; i < 16; i++) {
      var cx = R() * 640, cy = 30 + R() * 700;
      cr += 'M' + r(cx) + ' ' + r(cy) + 'l' + r(40 + R() * 90) + ' ' + r(20 + R() * 40) + 'l' + r(20 + R() * 40) + ' ' + r(-10 + R() * 20);
    }
    for (i = 0; i < 9; i++) {
      var lx = 60 + R() * 560, ly = 60 + R() * 560, lw = 50 + R() * 90;
      ledge += 'M' + r(lx) + ' ' + r(ly) + 'l' + r(lw) + ' ' + r(lw * 0.25) + 'l' + r(-8) + ' ' + r(7) + 'l' + r(-lw + 8) + ' ' + r(-lw * 0.25 + 2) + 'Z';
      shrub += ell(lx + lw * 0.3, ly - 5, 14 + R() * 12, 8 + R() * 6);
    }
    s += '<g clip-path="url(#' + P + '-kc)"><path d="' + cr + '" stroke="#000" stroke-width="2" fill="none" opacity=".5"/>' +
      '<path d="' + ledge + '" fill="#3c4660" opacity=".35"/><path d="' + shrub + '" fill="#070a0e"/>' +
      '<path d="M720 360L752 430L746 468L690 486L560 560L400 650L220 760" stroke="#e8c890" stroke-width="3" fill="none" opacity=".35" filter="url(#' + P + '-b2)"/></g>' +
      '<path d="M540 0L600 120L662 250L720 360L752 430" stroke="#6a80a8" stroke-width="1.6" fill="none" opacity=".45"/>';
    // 弯道外侧的嘛呢堆与经幡
    s += '<path d="M770 470L778 452L786 446L796 450L804 462L808 472Z" fill="#6a6050"/><path d="M786 446L796 450L804 462L808 472L790 472Z" fill="#2a2620"/>' +
      '<path d="M788 446L788 408" stroke="#2a2620" stroke-width="2"/>';
    var flagC = ['#4a6aa0', '#e0dcd0', '#b04838', '#4a7a52', '#b08a50'], pf = '';
    for (i = 0; i < 16; i++) {
      var t2 = i / 16, fxp = 788 - t2 * 110, fyp = 408 - t2 * 70 + Math.sin(t2 * Math.PI) * 18;
      pf += '<path d="M' + r(fxp) + ' ' + r(fyp) + 'l-5 1l1 9l6 -1Z" fill="' + flagC[i % 5] + '" opacity="' + f3(0.55 - t2 * 0.35) + '"/>';
    }
    s += '<path d="M788 408Q735 356 678 338" stroke="#1a1a1a" stroke-width="1" fill="none"/><g class="' + P + '-pf">' + pf + '</g>';

    // 车灯光柱
    s += '<g style="mix-blend-mode:screen">' + poly([[600, 940], [520, 520], [900, 500], [700, 940]], 'fill="url(#' + P + '-beam)"') +
      poly([[960, 940], [780, 500], [1220, 560], [1060, 940]], 'fill="url(#' + P + '-beam)"') + '</g>';
    var dust = '';
    for (i = 0; i < 70; i++) dust += dot(560 + R() * 560, 520 + R() * 360);
    s += '<path class="' + P + '-dust" d="' + dust + '" stroke="#fff4d8" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>';
    // 引擎盖
    s += '<path d="M180 900C320 858 1280 858 1420 900Z" fill="#06080b"/><path d="M260 884C420 862 1180 862 1340 884" stroke="#4a5264" stroke-width="1.5" fill="none" opacity=".6"/>';
    s += U.vignette(P, 0.75);
    var css = '.' + P + '-tw{animation:' + P + '-tw 2.8s ease-in-out infinite alternate}@keyframes ' + P + '-tw{0%{opacity:.3}100%{opacity:.95}}' +
      '.' + P + '-mst{animation:' + P + '-m 20s ease-in-out infinite alternate}@keyframes ' + P + '-m{0%{transform:translateX(0)}100%{transform:translateX(-60px)}}' +
      '.' + P + '-dust{animation:' + P + '-d 6s linear infinite alternate}@keyframes ' + P + '-d{0%{transform:translate(0,0)}100%{transform:translate(-14px,-22px)}}' +
      '.' + P + '-pf{animation:' + P + '-pf 1.4s ease-in-out infinite alternate}@keyframes ' + P + '-pf{0%{transform:translateY(0)}100%{transform:translateY(-2px)}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 森林保护区（象背） */
  BG.jungle = function () {
    var P = 'bg-jgl', R = U.rng(7447), i, k;
    var el = 'M-52 -30C-58 -60 -40 -85 -5 -86C25 -87 42 -78 50 -66C58 -78 78 -80 84 -64C90 -50 86 -36 82 -28C80 -16 84 -6 88 0L82 0C76 -8 72 -18 70 -26C66 -30 60 -30 56 -28L48 -26L48 0L36 0L34 -22L14 -24L12 0L0 0L-2 -24L-26 -24L-28 0L-40 0L-42 -26L-48 -26C-50 -24 -52 -28 -52 -30Z' +
      'M-24 -86L-24 -102L20 -102L20 -86Z M-8 -102L-8 -112L4 -112L4 -102Z' + ell(-2, -118, 6, 7);
    var d = '<defs>' +
      lg(P + '-bg', 0, 0, 0, 620, [[0, '#eef0cc'], [0.35, '#c8d6a8'], [0.7, '#8eaa88'], [1, '#56725a']], true) +
      rg(P + '-sun', 1180, 20, 700, [[0, '#fffbe0', 0.95], [0.25, '#f6f0c0', 0.5], [1, '#f6f0c0', 0]], true) +
      lg(P + '-ray', 1260, -40, 600, 760, [[0, '#fff6c8', 0.5], [1, '#fff6c8', 0]], true) +
      lg(P + '-tn', 0, 0, 1, 0, [[0, '#0e1810'], [0.5, '#1a2818'], [0.8, '#3e4c2a'], [0.93, '#a8ac68'], [1, '#e2dc98']]) +
      lg(P + '-tm', 0, 0, 1, 0, [[0, '#3a5040'], [0.7, '#4e6448'], [1, '#a4b07c']]) +
      lg(P + '-trail', 0, 470, 0, 900, [[0, '#d2c49a'], [0.35, '#a08c64'], [1, '#5a4a32']], true) +
      lg(P + '-fog', 0, 0, 0, 1, [[0, '#e4ecd4', 0], [0.5, '#e4ecd4', 0.55], [1, '#e4ecd4', 0]]) +
      rg(P + '-spot', 0.5, 0.5, 0.5, [[0, '#fff2b0', 0.75], [1, '#fff2b0', 0]]) +
      lg(P + '-gnd', 0, 460, 0, 900, [[0, '#6a8452'], [0.4, '#3e5634'], [1, '#1a2616']], true) +
      blurF(P + '-b6', 6) + blurF(P + '-b12', 14) +
      '<path id="' + P + '-el" d="' + el + '"/>' +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-bg)"/><rect width="1600" height="700" fill="url(#' + P + '-sun)"/>';
    // 远树（雾中）
    var ft = '', fc = '';
    for (i = 0; i < 40; i++) {
      var x = R() * 1600, w = 5 + R() * 9, y0 = 90 + R() * 120;
      ft += 'M' + r(x) + ' ' + r(y0) + 'h' + r(w) + 'l' + r(w * 0.2) + ' ' + r(530 - y0) + 'h' + r(-w * 1.4) + 'Z';
      fc += ell(x + w / 2, y0 - 10, 30 + R() * 50, 22 + R() * 30);
    }
    s += '<path d="' + fc + '" fill="#b4c6a4" opacity=".75"/><path d="' + ft + '" fill="#9eb498" opacity=".8"/>';
    s += '<rect y="330" width="1600" height="230" fill="url(#' + P + '-fog)"/>';
    // 中景树
    var mc = '', mcl = '', mt = '';
    for (i = 0; i < 16; i++) {
      var mx = 60 + i * 96 + (R() - 0.5) * 60, mw = 14 + R() * 20, top = -20;
      if (mx > 680 && mx < 920) mx += (mx < 800 ? -90 : 90);
      mt += '<path d="M' + r(mx) + ' ' + top + 'h' + r(mw) + 'l' + r(mw * 0.15) + ' ' + r(560 + R() * 20) + 'l' + r(mw * 0.5) + ' 12h' + r(-mw * 2.1) + 'l' + r(mw * 0.5) + ' -12Z" fill="url(#' + P + '-tm)" opacity=".85"/>';
      for (k = 0; k < 3; k++) {
        var cx = mx + (R() - 0.5) * 120, cy = 60 + R() * 170, rr = 34 + R() * 40;
        mc += ell(cx, cy, rr, rr * 0.7); mcl += ell(cx + rr * 0.2, cy - rr * 0.25, rr * 0.6, rr * 0.35);
      }
    }
    s += mt + '<path d="' + mc + '" fill="#4a6a44"/><path d="' + mcl + '" fill="#7e9a58" opacity=".8"/>';
    var vine = '';
    for (i = 0; i < 12; i++) {
      var vx = R() * 1600, vy = 100 + R() * 120, vl = 120 + R() * 220;
      vine += 'M' + r(vx) + ' ' + r(vy) + 'q' + r((R() - 0.5) * 60) + ' ' + r(vl * 0.5) + ' ' + r((R() - 0.5) * 30) + ' ' + r(vl);
    }
    s += '<path d="' + vine + '" stroke="#3e5838" stroke-width="2.4" fill="none" opacity=".8"/>';
    s += '<rect y="420" width="1600" height="140" fill="url(#' + P + '-fog)" opacity=".6"/>';

    // 地面与小路
    s += '<path d="M0 470Q800 452 1600 470V900H0Z" fill="url(#' + P + '-gnd)"/>';
    s += '<path d="M470 900C620 740 840 640 780 560C746 514 800 488 808 468L824 468C832 492 796 516 822 560C884 650 1000 760 1190 900Z" fill="url(#' + P + '-trail)"/>';
    var spots = '';
    for (i = 0; i < 34; i++) {
      var sy = 480 + R() * 400, sx = 400 + R() * 800, sr = (6 + R() * 26) * (sy - 400) / 300;
      spots += '<ellipse cx="' + r(sx) + '" cy="' + r(sy) + '" rx="' + r(sr * 1.6) + '" ry="' + r(sr * 0.4) + '" fill="url(#' + P + '-spot)"/>';
    }
    s += '<g class="' + P + '-dap">' + spots + '</g>';
    // 象队（远处）
    [[812, 474, 0.13, '#7e8e74'], [800, 494, 0.19, '#667660'], [778, 526, 0.27, '#4e5e4a'], [790, 574, 0.38, '#3a4838']].forEach(function (e, j) {
      var tf = 'translate(' + e[0] + ' ' + e[1] + ') scale(' + (j % 2 ? -e[2] : e[2]) + ' ' + e[2] + ')';
      s += '<use href="#' + P + '-el" transform="translate(0 -1.5) ' + tf + '" fill="#f0e8b0" opacity=".7"/>' +
        '<use href="#' + P + '-el" transform="' + tf + '" fill="' + e[3] + '"/>';
    });
    // 高草
    var gr = ['', '', ''];
    for (i = 0; i < 260; i++) {
      var side = R() < 0.5, gx = side ? R() * 760 : 850 + R() * 750, gy = 470 + Math.pow(R(), 1.3) * 430;
      var trailL = 470 + (gy - 470) * -0.5 + 330, trailR = 820 + (gy - 470) * 0.8;
      if (gx > trailL - 40 && gx < trailR + 40 && gy > 520) continue;
      var h = (14 + R() * 30) * (0.4 + (gy - 450) / 180), lean = (R() - 0.5) * h * 0.5, w = 2 + h * 0.06;
      gr[Math.floor(R() * 3)] += 'M' + r(gx) + ' ' + r(gy) + 'l' + r(lean) + ' ' + r(-h) + 'l' + r(w - lean) + ' ' + r(h) + 'Z';
    }
    s += '<path d="' + gr[0] + '" fill="#2a4022"/><path d="' + gr[1] + '" fill="#4a6630"/><path d="' + gr[2] + '" fill="#8a9c4c"/>';

    // 光柱
    var rays = '';
    [[900, 60], [1000, 90], [1130, 50], [1260, 80], [720, 40]].forEach(function (g) {
      rays += poly([[g[0] + 200, -40], [g[0] + 200 + g[1], -40], [g[0] - 380 + g[1] * 1.6, 760], [g[0] - 380, 760]], 'fill="url(#' + P + '-ray)"');
    });
    s += '<g class="' + P + '-rays" style="mix-blend-mode:screen" opacity=".55">' + rays + '</g>';

    // 近景巨树
    function trunk(pts, lines) {
      var g = poly(pts, 'fill="url(#' + P + '-tn)"');
      var bl = '';
      for (var kk = 0; kk < lines.n; kk++) {
        var bx = lines.x0 + (lines.x1 - lines.x0) * (kk + R() * 0.6) / lines.n, by = -10;
        bl += 'M' + r(bx) + ' ' + by;
        for (var j = 1; j <= 6; j++) bl += 'L' + r(bx + (R() - 0.5) * 10 + j * lines.flare * (kk / lines.n - 0.5)) + ' ' + r(by + j * 105);
      }
      return g + '<path d="' + bl + '" stroke="#081008" stroke-width="2.6" fill="none" opacity=".45"/>';
    }
    s += trunk([[300, -20], [372, -20], [378, 520], [404, 600], [350, 596], [314, 606], [290, 596], [296, 520]], { n: 4, x0: 305, x1: 368, flare: 3 });
    s += trunk([[1200, -20], [1256, -20], [1262, 540], [1290, 610], [1236, 604], [1206, 612], [1180, 604], [1196, 540]], { n: 3, x0: 1204, x1: 1252, flare: 3 });
    s += trunk([[30, -20], [190, -20], [196, 400], [214, 560], [262, 650], [176, 636], [120, 666], [60, 640], [-10, 666], [-10, -20]], { n: 8, x0: 30, x1: 186, flare: 9 });
    s += trunk([[1380, -20], [1540, -20], [1552, 420], [1610, 560], [1610, 670], [1520, 644], [1450, 668], [1400, 636], [1330, 660], [1374, 560]], { n: 8, x0: 1384, x1: 1536, flare: 9 });
    var moss = '';
    for (i = 0; i < 18; i++) { var side2 = i % 2, mx2 = side2 ? 150 + R() * 40 : 1500 + R() * 40; moss += ell(mx2, 100 + R() * 480, 6 + R() * 10, 14 + R() * 30); }
    s += '<path d="' + moss + '" fill="#6a8a3a" opacity=".45"/>';
    // 顶部冠层
    var c1 = '', c2 = '', c3 = '';
    for (i = 0; i < 70; i++) {
      var cxx = R() * 1700 - 50, gapT = cxx > 860 && cxx < 1320, cyy = -30 + R() * (gapT ? 60 : 150), crx = 50 + R() * 90, cry = 26 + R() * 40;
      c1 += ell(cxx, cyy, crx, cry);
      if (R() < 0.7) c2 += ell(cxx + 8, cyy - 6, crx * 0.75, cry * 0.7);
      if (R() < 0.6) c3 += ell(cxx + crx * 0.3, cyy - cry * 0.35, crx * 0.45, cry * 0.35);
    }
    s += '<path d="' + c1 + '" fill="#16261a"/><path d="' + c2 + '" fill="#2a4424"/><path d="' + c3 + '" fill="#6e8e3a" opacity=".85"/>';
    var hv = '', lv = '';
    for (i = 0; i < 9; i++) {
      var hx = 120 + R() * 1360, hy = 60 + R() * 60, hl = 140 + R() * 200, sw = (R() - 0.5) * 50;
      hv += 'M' + r(hx) + ' ' + r(hy) + 'q' + r(sw) + ' ' + r(hl * 0.5) + ' ' + r(sw * 0.3) + ' ' + r(hl);
      for (k = 1; k < 5; k++) lv += ell(hx + sw * 0.35 * Math.sin(k) + (k % 2 ? 6 : -6), hy + hl * k / 5, 7, 3.5);
    }
    s += '<g class="' + P + '-sway"><path d="' + hv + '" stroke="#16261a" stroke-width="3" fill="none"/><path d="' + lv + '" fill="#243c20"/></g>';
    // 前景失焦大叶
    var lf = '';
    [[-30, 60, 260, 70, 0.5], [60, -30, 240, 60, 1.1], [1440, -20, 250, 64, 2.3], [1560, 90, 220, 56, 2.7], [-40, 200, 180, 50, 0.2]].forEach(function (l) {
      var ca = Math.cos(l[4]), sa = Math.sin(l[4]), L = l[2], W = l[3];
      function tp(a, b) { return [l[0] + a * ca - b * sa, l[1] + a * sa + b * ca]; }
      var p0 = tp(0, 0), p1 = tp(L * 0.5, -W), p2 = tp(L, 0), p3 = tp(L * 0.5, W);
      lf += 'M' + P2(p0) + 'Q' + P2(p1) + ' ' + P2(p2) + 'Q' + P2(p3) + ' ' + P2(p0) + 'Z';
    });
    s += '<path d="' + lf + '" fill="#0a140c" filter="url(#' + P + '-b6)" opacity=".92"/>';
    var pol = '';
    for (i = 0; i < 60; i++) pol += dot(500 + R() * 900, 120 + R() * 480);
    s += '<path class="' + P + '-pol" d="' + pol + '" stroke="#fff8d0" stroke-width="2" stroke-linecap="round" opacity=".6"/>';
    s += U.vignette(P, 0.55);
    var css = '.' + P + '-rays{animation:' + P + '-br 8s ease-in-out infinite alternate}@keyframes ' + P + '-br{0%{opacity:.35}100%{opacity:.65}}' +
      '.' + P + '-dap{animation:' + P + '-dp 5s ease-in-out infinite alternate}@keyframes ' + P + '-dp{0%{opacity:.7}100%{opacity:1}}' +
      '.' + P + '-pol{animation:' + P + '-pl 12s linear infinite alternate}@keyframes ' + P + '-pl{0%{transform:translate(0,0)}100%{transform:translate(-30px,24px)}}' +
      '.' + P + '-sway{transform-origin:800px 60px;animation:' + P + '-sw 7s ease-in-out infinite alternate}@keyframes ' + P + '-sw{0%{transform:skewX(0deg)}100%{transform:skewX(1.2deg)}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 猎人木屋（傍晚，室内） */
  BG.cabin = function () {
    var P = 'bg-cab', R = U.rng(6279), i;
    var VX = 780, VY = 380;
    function pr(x, y, t) { return [VX + (x - VX) * t, VY + (y - VY) * t]; }
    function box(x1, x2, y1, y2, ta, tb, cF, cS, cT) {
      var g = '';
      if (x2 < VX) g += poly([pr(x2, y1, ta), pr(x2, y1, tb), pr(x2, y2, tb), pr(x2, y2, ta)], 'fill="' + cS + '"');
      if (x1 > VX) g += poly([pr(x1, y1, ta), pr(x1, y1, tb), pr(x1, y2, tb), pr(x1, y2, ta)], 'fill="' + cS + '"');
      if (y1 > VY) g += poly([pr(x1, y1, ta), pr(x2, y1, ta), pr(x2, y1, tb), pr(x1, y1, tb)], 'fill="' + cT + '"');
      if (y2 < VY) g += poly([pr(x1, y2, ta), pr(x2, y2, ta), pr(x2, y2, tb), pr(x1, y2, tb)], 'fill="' + cT + '"');
      var a = pr(x1, y1, tb), b = pr(x2, y2, tb);
      return g + '<rect x="' + r(a[0]) + '" y="' + r(a[1]) + '" width="' + r(b[0] - a[0]) + '" height="' + r(b[1] - a[1]) + '" fill="' + cF + '"/>';
    }
    var BL = 380, BR = 1180, BT = 150, BB = 560, T = 2.3;
    var d = '<defs>' +
      '<pattern id="' + P + '-log" width="1600" height="30" y="' + BT + '" patternUnits="userSpaceOnUse">' +
      '<rect width="1600" height="30" fill="#4a3220"/><rect width="1600" height="11" y="3" fill="#6e4c30"/><rect width="1600" height="4" y="5" fill="#8a6440" opacity=".6"/>' +
      '<rect width="1600" height="4" y="26" fill="#1a100a"/></pattern>' +
      lg(P + '-sky', 0, 215, 0, 395, [[0, '#3a3456'], [0.4, '#a85848'], [0.75, '#f09a50'], [1, '#f8c878']], true) +
      lg(P + '-shaft', 800, 220, 460, 880, [[0, '#ffc070', 0.35], [1, '#ffc070', 0.02]], true) +
      lg(P + '-patch', 0, 640, 0, 880, [[0, '#ffc878', 0.55], [1, '#ffb060', 0.25]], true) +
      lg(P + '-floor', 0, 560, 0, 900, [[0, '#3a2818'], [1, '#1c120a']], true) +
      lg(P + '-lw', 380, 0, 0, 0, [[0, '#3e2a1a'], [1, '#1a110a']], true) +
      lg(P + '-rw', 1180, 0, 1600, 0, [[0, '#3a2818'], [1, '#150e08']], true) +
      rg(P + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffe0a0', 0.9], [0.2, '#ffb860', 0.45], [1, '#ff9a40', 0]]) +
      rg(P + '-cool', 0.5, 0.5, 0.5, [[0.4, '#1a2436', 0], [1, '#1a2436', 0.55]]) +
      blurF(P + '-b3', 3) + blurF(P + '-b10', 10) +
      '</defs>';
    var s = '';
    // 地板
    s += poly([[BL, BB], [BR, BB], pr(BR, BB, 3), pr(BL, BB, 3)], 'fill="url(#' + P + '-floor)"');
    var fl = '';
    for (var bx = BL; bx <= BR; bx += 44) { var q = pr(bx, BB, 3); fl += 'M' + bx + ' ' + BB + 'L' + P2(q); }
    for (i = 1; i < 6; i++) { var tt = 1 + i * i * 0.09, a = pr(BL, BB, tt), b = pr(BR, BB, tt); fl += 'M' + P2(a) + 'L' + P2(b); }
    s += '<path d="' + fl + '" stroke="#120a05" stroke-width="2" opacity=".7"/>';
    // 天花板与椽子
    s += poly([[BL, BT], [BR, BT], pr(BR, BT, T), pr(BL, BT, T)], 'fill="#1a110a"');
    var raf = '';
    for (var rx = BL; rx <= BR; rx += 100) raf += dPath([[rx - 7, BT], [rx + 7, BT], pr(rx + 7, BT, T), pr(rx - 7, BT, T)], true);
    s += '<path d="' + raf + '" fill="#2e1e12"/>';
    // 左右墙（原木横纹）
    s += poly([[BL, BT], [BL, BB], pr(BL, BB, T), pr(BL, BT, T)], 'fill="url(#' + P + '-lw)"') +
      poly([[BR, BT], [BR, BB], pr(BR, BB, T), pr(BR, BT, T)], 'fill="url(#' + P + '-rw)"');
    var hlL = '', hlR = '', chL = '';
    for (var ly = BT; ly < BB; ly += 30) {
      hlL += dPath([[BL, ly + 3], [BL, ly + 14], pr(BL, ly + 14, T), pr(BL, ly + 3, T)], true);
      hlR += dPath([[BR, ly + 3], [BR, ly + 14], pr(BR, ly + 14, T), pr(BR, ly + 3, T)], true);
      chL += 'M' + BL + ' ' + (ly + 28) + 'L' + P2(pr(BL, ly + 28, T)) + 'M' + BR + ' ' + (ly + 28) + 'L' + P2(pr(BR, ly + 28, T));
    }
    s += '<path d="' + hlL + '" fill="#7a5436" opacity=".35"/><path d="' + hlR + '" fill="#6a4a30" opacity=".3"/>' +
      '<path d="' + chL + '" stroke="#0e0804" stroke-width="3.5"/>';
    // 后墙
    s += '<rect x="' + BL + '" y="' + BT + '" width="' + (BR - BL) + '" height="' + (BB - BT) + '" fill="url(#' + P + '-log)"/>';
    s += '<path d="M' + BL + ' ' + BT + 'V' + BB + 'M' + BR + ' ' + BT + 'V' + BB + '" stroke="#0e0804" stroke-width="6"/>';
    // 窗外：夕照森林
    var WX = 720, WY = 215, WW = 170, WH = 180;
    s += '<rect x="' + WX + '" y="' + WY + '" width="' + WW + '" height="' + WH + '" fill="url(#' + P + '-sky)"/>' +
      '<circle cx="836" cy="352" r="20" fill="#ffe0a0"/><circle cx="836" cy="352" r="50" fill="url(#' + P + '-lamp)"/>';
    var pines = 'M' + WX + ' ' + (WY + WH);
    for (var px = WX; px <= WX + WW; px += 14) { var ph = 40 + R() * 60; pines += 'L' + r(px) + ' ' + r(WY + WH - ph * 0.55) + 'L' + r(px + 7) + ' ' + r(WY + WH - ph) + 'L' + r(px + 14) + ' ' + r(WY + WH - ph * 0.55); }
    s += '<path d="' + pines + 'L' + (WX + WW) + ' ' + (WY + WH) + 'Z" fill="#1e1420"/>';
    s += '<path d="M' + WX + ' ' + WY + 'h' + WW + 'v' + WH + 'h-' + WW + 'Z M' + (WX + WW / 2) + ' ' + WY + 'v' + WH + 'M' + WX + ' ' + (WY + WH / 2) + 'h' + WW + '" stroke="#24160c" stroke-width="10" fill="none"/>' +
      '<rect x="' + (WX - 12) + '" y="' + (WY + WH + 2) + '" width="' + (WW + 24) + '" height="10" fill="#8a6440"/>';
    // 双层床（后墙左）
    s += box(398, 648, 468, 488, 1, 1.12, '#5a6468', '#3a4448', '#6e787a') + // 下铺褥子
      box(398, 648, 486, 504, 1, 1.12, '#3e2816', '#2a1a0e', '#4a3220') +
      '<path d="M420 464q20 -8 44 0l0 8h-44Z" fill="#b8b0a0"/><rect x="560" y="470" width="80" height="17" fill="#8a3a28" opacity=".8"/>' +
      box(398, 648, 318, 334, 1, 1.12, '#5c5048', '#403630', '#6e6258') +
      box(398, 648, 334, 350, 1, 1.12, '#3e2816', '#2a1a0e', '#1e140a') +
      '<path d="M600 332l30 0l8 44l-26 -6Z" fill="#6a5c50"/>';
    s += '<g fill="#2e1e10">' + [398, 640].map(function (x) { var a = pr(x, 290, 1.12), b = pr(x + 9, BB, 1.12); return '<rect x="' + r(a[0]) + '" y="' + r(a[1]) + '" width="' + r(b[0] - a[0]) + '" height="' + r(b[1] - a[1]) + '"/>'; }).join('') + '</g>';
    var lad = '';
    for (i = 0; i < 5; i++) lad += 'M' + r(pr(652, 0, 1.12)[0]) + ' ' + r(pr(0, 360 + i * 34, 1.12)[1]) + 'h26';
    s += '<path d="' + lad + 'M' + r(pr(652, 0, 1.12)[0]) + ' ' + r(pr(0, 340, 1.12)[1]) + 'V' + r(pr(0, BB, 1.12)[1]) + 'M' + r(pr(652, 0, 1.12)[0] + 26) + ' ' + r(pr(0, 340, 1.12)[1]) + 'V' + r(pr(0, BB, 1.12)[1]) + '" stroke="#3a2614" stroke-width="5"/>';
    // 墙上鹿角
    s += '<path d="M512 196h28l-4 24h-20Z" fill="#3a2412"/><path d="M522 196C510 180 492 176 480 158M526 196C540 180 556 176 570 158M500 180L494 162M548 180L556 162M488 170L474 170M560 170L574 170" stroke="#d8c8a4" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
    // 左墙单人床（贴墙）
    s += box(380, 500, 482, 498, 1.05, 1.42, '#586062', '#3e484a', '#6c7474') + box(380, 500, 496, 514, 1.05, 1.42, '#3a2616', '#2a1a0e', '#3a2616');
    var fp = pr(380, 498, 1.4), fp2 = pr(500, 560, 1.42);
    s += '<rect x="' + r(fp2[0] - 10) + '" y="' + r(fp[1] + 4) + '" width="10" height="' + r(fp2[1] - fp[1] - 4) + '" fill="#241608"/>';
    // 挂钩外套与步枪（右墙）
    var d1 = pr(BR, 280, 1.3), d2 = pr(BR, BB, 1.3), d3 = pr(BR, BB, 1.75), d4 = pr(BR, 280, 1.75);
    s += poly([d1, d2, d3, d4], 'fill="#2a1a0e"');
    var dp = '';
    for (i = 1; i < 5; i++) { var tq = 1.3 + 0.45 * i / 5; dp += 'M' + P2(pr(BR, 282, tq)) + 'L' + P2(pr(BR, BB, tq)); }
    s += '<path d="' + dp + '" stroke="#140c06" stroke-width="2"/><circle cx="' + r(pr(BR, 420, 1.36)[0]) + '" cy="' + r(pr(BR, 420, 1.36)[1]) + '" r="4" fill="#8a7050"/>';
    var gun1 = pr(BR, 250, 1.15), gun2 = pr(BR, 238, 1.7);
    s += '<path d="M' + P2(gun1) + 'L' + P2(gun2) + '" stroke="#120a04" stroke-width="5"/><path d="M' + P2(pr(BR, 256, 1.55)) + 'L' + P2(gun2) + 'L' + P2(pr(BR, 262, 1.72)) + 'Z" fill="#3a2210"/>';
    s += '<path d="M' + P2(pr(BR, 300, 1.2)) + 'l-6 8q-14 60 -6 120l30 6q10 -60 -4 -126Z" fill="#3c4436"/>';
    // 铁炉（右后角）+ 烟囱
    s += box(1112, 1172, 452, 560, 1.0, 1.12, '#1a1a1c', '#101012', '#2a2a2c');
    var sf = pr(1126, 490, 1.12), sf2 = pr(1160, 520, 1.12);
    s += '<rect class="' + P + '-ember" x="' + r(sf[0]) + '" y="' + r(sf[1]) + '" width="' + r(sf2[0] - sf[0]) + '" height="' + r(sf2[1] - sf[1]) + '" fill="#ff8a30"/>' +
      '<ellipse class="' + P + '-ember" cx="' + r((sf[0] + sf2[0]) / 2) + '" cy="' + r(sf2[1] + 30) + '" rx="120" ry="40" fill="url(#' + P + '-lamp)" opacity=".5"/>' +
      '<rect x="1136" y="' + BT + '" width="12" height="302" fill="#141416"/>';
    // 搁板 + 杂物
    s += '<rect x="930" y="316" width="170" height="8" fill="#6e4c30"/>';
    var jar = '';
    [[944, 18, 22, '#5a6a5a'], [968, 14, 30, '#7a5a3a'], [990, 22, 16, '#8a8a80'], [1024, 16, 26, '#4a3a2a'], [1050, 30, 20, '#3a3a3c'], [1086, 10, 34, '#6a4a2a']].forEach(function (j) {
      jar += '<rect x="' + j[0] + '" y="' + (316 - j[2]) + '" width="' + j[1] + '" height="' + j[2] + '" fill="' + j[3] + '"/>';
    });
    s += jar + '<path d="M1040 188l30 0l-4 110l-22 0Z" fill="#4a5a36" opacity=".8"/>';
    // 桌子与椅子（右）
    s += box(930, 1100, 470, 482, 1.02, 1.3, '#5a3c24', '#3a2616', '#7a5634');
    [[934, 1.04], [1090, 1.04], [934, 1.28], [1090, 1.28]].forEach(function (l) {
      var a = pr(l[0], 482, l[1]), b = pr(l[0] + 8, BB, l[1]); s += '<rect x="' + r(a[0]) + '" y="' + r(a[1]) + '" width="' + r(b[0] - a[0]) + '" height="' + r(b[1] - a[1]) + '" fill="#2a1a0c"/>';
    });
    s += box(890, 930, 500, 508, 1.1, 1.22, '#4a3220', '#2e1e10', '#5a3c24') + box(890, 896, 430, 560, 1.1, 1.22, '#2a1a0c', '#20140a', '#2a1a0c');
    s += box(1000, 1050, 505, 513, 1.38, 1.5, '#4a3220', '#2e1e10', '#5a3c24') + box(1000, 1050, 440, 505, 1.49, 1.5, '#3a2616', '#2a1a0c', '#3a2616');
    var cup = pr(960, 470, 1.15), mp = pr(1010, 470, 1.2);
    s += '<rect x="' + r(cup[0]) + '" y="' + r(cup[1] - 16) + '" width="12" height="16" fill="#8a8a88"/>' +
      poly([[mp[0] - 30, mp[1] + 2], [mp[0] + 40, mp[1] + 2], [mp[0] + 34, mp[1] - 6], [mp[0] - 24, mp[1] - 6]], 'fill="#c8b890" opacity=".85"');
    // 吊灯
    s += '<path d="M1016 60V282" stroke="#0a0604" stroke-width="2"/>' +
      '<g class="' + P + '-lamp"><ellipse cx="1016" cy="300" rx="260" ry="200" fill="url(#' + P + '-lamp)" opacity=".45"/>' +
      '<path d="M1004 286h24l4 30h-32Z" fill="#ffd890"/><circle cx="1016" cy="302" r="6" fill="#fff4d0"/></g>' +
      '<path d="M1000 284h32M1000 318h32" stroke="#1a1208" stroke-width="3"/>';
    // 顶上横梁 + 草药束
    var tb1 = pr(BL, 200, 1.6), tb2 = pr(BR, 216, 1.6);
    s += '<rect x="' + r(tb1[0] - 40) + '" y="' + r(tb1[1] - 34) + '" width="' + r(tb2[0] - tb1[0] + 80) + '" height="34" fill="#24160c"/>' +
      '<rect x="' + r(tb1[0] - 40) + '" y="' + r(tb1[1] - 34) + '" width="' + r(tb2[0] - tb1[0] + 80) + '" height="4" fill="#7a5434" opacity=".6"/>';
    var herb = '';
    [540, 600, 660].forEach(function (hx) { herb += 'M' + hx + ' 96l-10 50l10 -8l10 8Z'; });
    s += '<path d="' + herb + '" fill="#3a4428"/>';
    // 窗光：光柱 + 地上窗格光斑
    s += '<g class="' + P + '-shaft" style="mix-blend-mode:screen">' + poly([[WX, WY], [WX + WW, WY], [WX + WW, WY + WH], [740, 640], [510, 880], [330, 880]], 'fill="url(#' + P + '-shaft)"') + '</g>';
    function F(u, v) { // 窗格 (u,v) → 地板光斑
      var A = [560, 640], B = [740, 640], C = [510, 880], D = [330, 880];
      var top = [A[0] + (B[0] - A[0]) * u, A[1]], bo = [D[0] + (C[0] - D[0]) * u, D[1]];
      return [top[0] + (bo[0] - top[0]) * (1 - v), top[1] + (bo[1] - top[1]) * (1 - v)];
    }
    var pt = '';
    [[0, 0.47], [0.53, 1]].forEach(function (uu) {
      [[0, 0.47], [0.53, 1]].forEach(function (vv) {
        pt += dPath([F(uu[0], vv[1]), F(uu[1], vv[1]), F(uu[1], vv[0]), F(uu[0], vv[0])], true);
      });
    });
    s += '<path d="' + pt + '" fill="url(#' + P + '-patch)" style="mix-blend-mode:screen"/>';
    var mote = '';
    for (i = 0; i < 50; i++) { var tm = R(), mx = 720 - tm * 300 + R() * 170, my = 220 + tm * 600 + (R() - 0.5) * 60; mote += dot(mx, my); }
    s += '<path class="' + P + '-mote" d="' + mote + '" stroke="#ffe8b8" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>';
    // 冷色暗部 + 暗角
    s += '<rect width="1600" height="900" fill="url(#' + P + '-cool)"/>' + U.vignette(P, 0.8);
    var css = '.' + P + '-lamp,.' + P + '-ember{animation:' + P + '-fl 2.2s ease-in-out infinite alternate}@keyframes ' + P + '-fl{0%{opacity:.82}40%{opacity:1}70%{opacity:.9}100%{opacity:.97}}' +
      '.' + P + '-shaft{animation:' + P + '-sh 9s ease-in-out infinite alternate}@keyframes ' + P + '-sh{0%{opacity:.8}100%{opacity:1}}' +
      '.' + P + '-mote{animation:' + P + '-mo 14s linear infinite alternate}@keyframes ' + P + '-mo{0%{transform:translate(0,0)}100%{transform:translate(18px,-26px)}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 深山索道站 */
  BG.cableway = function () {
    var P = 'bg-cw', R = U.rng(7010), i, k;
    function cab(t) { // 钢索二次贝塞尔
      var a = [468, 206], c = [930, 330], b = [1404, 196], m = 1 - t;
      return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]];
    }
    var d = '<defs>' +
      lg(P + '-sky', 0, 0, 0, 1, [[0, '#6c96bc'], [0.3, '#a2c0d6'], [0.55, '#e4dcc2'], [1, '#e8d8b8']]) +
      rg(P + '-sun', 230, 110, 620, [[0, '#fff6d8', 0.95], [0.12, '#fff0c0', 0.5], [1, '#fff0c0', 0]], true) +
      lg(P + '-snow', 0, 150, 0, 360, [[0, '#fbfaf2'], [0.45, '#dfe4e6'], [1, '#9aaabb']], true) +
      lg(P + '-haze', 0, 0, 0, 1, [[0, '#dde4e0', 0], [0.6, '#dde4e0', 0.6], [1, '#dde4e0', 0.85]]) +
      lg(P + '-mist', 0, 0, 0, 1, [[0, '#f0f2ee', 0], [0.5, '#f0f2ee', 0.75], [1, '#f0f2ee', 0.2]]) +
      lg(P + '-glass', 0, 0, 1, 1, [[0, '#dce8f0'], [0.45, '#8aa8c0'], [0.55, '#e8f0f4'], [1, '#6a88a4']]) +
      lg(P + '-hill', 0, 470, 0, 900, [[0, '#7e9a4c'], [0.25, '#4e6a34'], [1, '#1e2c18']], true) +
      lg(P + '-ray', 230, 110, 1100, 700, [[0, '#fff4d0', 0.35], [1, '#fff4d0', 0]], true) +
      blurF(P + '-b8', 8) +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-sky)"/><rect width="1600" height="900" fill="url(#' + P + '-sun)"/>';
    var cl = '';
    for (i = 0; i < 7; i++) cl += ell(300 + R() * 1300, 80 + R() * 120, 90 + R() * 160, 10 + R() * 12);
    s += '<path class="' + P + '-cl" d="' + cl + '" fill="#fbf8ee" opacity=".55" filter="url(#' + P + '-b8)"/>';
    // 远方雪山（左上来光，左坡受光）
    var sk = [[0, 300], [140, 222], [260, 276], [420, 186], [560, 262], [700, 196], [820, 250], [980, 168], [1120, 254], [1260, 214], [1600, 300]];
    var sr = ridge(R, sk, 26, 3);
    s += '<path d="' + mtnD(sr, 420) + '" fill="#8a9cb4"/>' +
      '<clipPath id="' + P + '-sc"><path d="' + mtnD(sr, 420) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-sc)" d="' + facets(sk, 420, true, R) + '" fill="url(#' + P + '-snow)"/>';
    s += '<rect y="250" width="1600" height="170" fill="url(#' + P + '-haze)"/>';
    // 中景两层青山
    var m1k = [[0, 380], [220, 330], [420, 372], [640, 318], [860, 366], [1000, 340], [1600, 380]];
    var m1 = ridge(R, m1k, 22, 4);
    s += '<path d="' + mtnD(m1, 700) + '" fill="#7d9a9c"/><clipPath id="' + P + '-m1"><path d="' + mtnD(m1, 700) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-m1)" d="' + facets(m1k, 700, true, R) + '" fill="#a2b8aa" opacity=".7"/>';
    s += '<rect y="330" width="1600" height="160" fill="url(#' + P + '-haze)" opacity=".8"/>';
    var m2k = [[400, 470], [620, 404], [800, 452], [960, 420], [1100, 470]];
    s += '<path d="' + mtnD(ridge(R, m2k, 18, 4), 700) + '" fill="#58766a"/>';
    // 对面高山（右）
    var bk = [[880, 700], [1000, 470], [1080, 340], [1200, 290], [1300, 180], [1420, 86], [1530, 150], [1610, 120]];
    var br = ridge(R, bk, 30, 4);
    s += '<path d="' + mtnD(br, 900) + '" fill="#34503a"/><clipPath id="' + P + '-bc"><path d="' + mtnD(br, 900) + '"/></clipPath>';
    var fr = '', fr2 = '', rk = '';
    for (i = 0; i < 150; i++) {
      var tx = 900 + R() * 700, ty = 120 + R() * 560, tr = 5 + R() * 9 * (ty / 400);
      if (R() < 0.5) fr += ell(tx, ty, tr, tr * 0.8); else fr2 += ell(tx, ty, tr * 0.8, tr * 0.7);
    }
    for (i = 0; i < 7; i++) { var rx = 1000 + R() * 520, ry = 200 + R() * 300; rk += 'M' + r(rx) + ' ' + r(ry) + 'l' + r(20 + R() * 30) + ' ' + r(40 + R() * 40) + 'l' + r(-30 - R() * 20) + ' ' + r(10) + 'Z'; }
    s += '<g clip-path="url(#' + P + '-bc)">' +
      '<path d="M1420 60L1300 180L1200 290L1080 340L1000 470L880 720L1260 720L1330 400Z" fill="#6a8a4c" opacity=".8"/>' +
      '<path d="' + fr + '" fill="#243a26"/><path d="' + fr2 + '" fill="#8aa050" opacity=".6"/><path d="' + rk + '" fill="#8a8c80" opacity=".7"/>' +
      '<path class="' + P + '-fall" d="M1188 330C1184 380 1192 430 1186 520" stroke="#f4f8f4" stroke-width="4" fill="none" stroke-dasharray="14 8"/></g>';
    // 对山的上站
    s += '<path d="M1384 194h52v22h-52Z" fill="#dcd8cc"/><path d="M1378 196l32 -16l32 16Z" fill="#8a3a2a"/><rect x="1392" y="202" width="10" height="8" fill="#3a4450"/>';
    // 山涧雾
    s += '<g class="' + P + '-mst"><rect x="500" y="440" width="1100" height="200" fill="url(#' + P + '-mist)"/><rect x="560" y="520" width="700" height="140" fill="url(#' + P + '-mist)" opacity=".7"/></g>';
    // 光束
    s += '<g class="' + P + '-ray" style="mix-blend-mode:screen">' + poly([[230, 110], [1200, 520], [900, 700]], 'fill="url(#' + P + '-ray)"') + poly([[230, 110], [1500, 300], [1400, 420]], 'fill="url(#' + P + '-ray)" opacity=".6"') + '</g>';
    // 近处山头
    var hk = [[-10, 470], [120, 452], [300, 460], [520, 470], [640, 520], [760, 640], [820, 900]];
    s += '<path d="' + mtnD(ridge(R, hk, 10, 3), 900) + '" fill="url(#' + P + '-hill)"/>';
    var grs = '';
    for (i = 0; i < 90; i++) { var gx = R() * 740, gy = 462 + R() * 60 + gx * 0.06; grs += 'M' + r(gx) + ' ' + r(gy) + 'l' + r((R() - 0.5) * 6) + ' ' + r(-5 - R() * 8); }
    s += '<path d="' + grs + '" stroke="#a8b860" stroke-width="1.6" opacity=".6"/>';
    // 索道站
    s += '<rect x="60" y="440" width="470" height="36" fill="#9a968a"/><rect x="60" y="440" width="470" height="6" fill="#d8d2c0"/>' +
      '<path d="M60 476h470l-20 30h-430Z" fill="#5a5850"/>';
    var fr3 = 'M100 440L110 190M190 440L186 180M400 440L408 170M480 440L486 184M110 300L190 260M186 300L110 260M408 300L486 264M486 300L408 264M100 390H500';
    s += '<path d="' + fr3 + '" stroke="#3a3e44" stroke-width="7"/>' +
      '<path d="M100 440L110 190M400 440L408 170" stroke="#a8acae" stroke-width="2" opacity=".6"/>';
    s += '<path d="M70 196L520 166L524 180L74 212Z" fill="#6a2e22"/><path d="M70 196L520 166" stroke="#c86a48" stroke-width="3"/>' +
      '<path d="M74 212L524 180L524 188L74 222Z" fill="#2a1a16"/>';
    s += '<rect x="130" y="340" width="96" height="100" fill="#d6d0bc"/><rect x="142" y="356" width="72" height="34" fill="#3a4a5a"/><path d="M142 356h72l-40 34h-32Z" fill="#8aa8c0" opacity=".6"/>';
    // 大轮
    var spk = '';
    for (k = 0; k < 8; k++) { var aa = k * TAU / 8; spk += 'M440 222l' + r(Math.cos(aa) * 52) + ' ' + r(Math.sin(aa) * 52); }
    s += '<g class="' + P + '-wh" style="transform-origin:440px 222px"><circle cx="440" cy="222" r="54" fill="none" stroke="#2a2e34" stroke-width="9"/>' +
      '<path d="' + spk + '" stroke="#3a3e44" stroke-width="4"/></g>';
    s += '<circle cx="440" cy="222" r="10" fill="#1a1c20"/><path d="M440 222V440" stroke="#3a3e44" stroke-width="10"/>';
    // 钢索
    var c0 = cab(0), c1 = cab(1);
    s += '<path d="M' + P2(c0) + 'Q930 330 ' + P2(c1) + '" stroke="#1a1c20" stroke-width="3" fill="none"/>' +
      '<path d="M' + r(c0[0]) + ' ' + r(c0[1] + 12) + 'Q930 344 ' + r(c1[0]) + ' ' + r(c1[1] + 10) + '" stroke="#2a2c30" stroke-width="2" fill="none"/>';
    // 经幡
    var pf = '', flagC = ['#4a6aa8', '#eeeae0', '#b8483a', '#4a8a56', '#b8904e'];
    for (i = 0; i < 18; i++) {
      var t = i / 18, fx = 524 + t * 180, fy = 182 + t * 260 - Math.sin(t * Math.PI) * 40;
      pf += '<path d="M' + r(fx) + ' ' + r(fy) + 'l9 2l-2 12l-9 -2Z" fill="' + flagC[i % 5] + '"/>';
    }
    s += '<path d="M524 182Q600 280 704 442" stroke="#3a3a3a" stroke-width="1" fill="none"/><path d="M704 442V520" stroke="#3a2e22" stroke-width="4"/><g class="' + P + '-pf">' + pf + '</g>';
    // 缆车（刚离站）
    var cp = cab(0.19);
    s += '<g transform="translate(' + r(cp[0]) + ' ' + r(cp[1]) + ')">' +
      '<rect x="-16" y="-8" width="32" height="12" rx="3" fill="#2a2c30"/><circle cx="-9" cy="-3" r="5" fill="#4a4e54"/><circle cx="9" cy="-3" r="5" fill="#4a4e54"/>' +
      '<path d="M0 4V56M-30 56H30" stroke="#2a2c30" stroke-width="5"/>' +
      '<path d="M-58 56H58Q66 56 66 66V138Q66 148 56 148H-56Q-66 148 -66 138V66Q-66 56 -58 56Z" fill="#a8402c"/>' +
      '<path d="M-58 66H58V116H-58Z" fill="url(#' + P + '-glass)"/>' +
      '<path d="M-20 66V116M20 66V116" stroke="#7a2a1c" stroke-width="4"/>' +
      '<path d="M-52 110L-30 66H-22L-44 110Z M8 110L28 66H34L14 110Z" fill="#fff" opacity=".45"/>' +
      '<path d="M-66 124H66" stroke="#6a2416" stroke-width="3"/><path d="M-66 66V138Q-66 148 -56 148H-50V56H-58Q-66 56 -66 66Z" fill="#e87a5a" opacity=".35"/></g>';
    // 鹰
    s += '<path d="M780 250q8 -6 14 0q6 -6 14 0M860 214q6 -5 11 0q5 -5 11 0" stroke="#2a2a2a" stroke-width="2" fill="none"/>';
    s += U.vignette(P, 0.45);
    var css = '.' + P + '-mst{animation:' + P + '-m 22s ease-in-out infinite alternate}@keyframes ' + P + '-m{0%{transform:translateX(0)}100%{transform:translateX(-70px)}}' +
      '.' + P + '-cl{animation:' + P + '-c 40s linear infinite alternate}@keyframes ' + P + '-c{0%{transform:translateX(0)}100%{transform:translateX(60px)}}' +
      '.' + P + '-fall{animation:' + P + '-f 1.2s linear infinite}@keyframes ' + P + '-f{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-22px}}' +
      '.' + P + '-pf{animation:' + P + '-pf 1.6s ease-in-out infinite alternate}@keyframes ' + P + '-pf{0%{transform:translateY(0)}100%{transform:translateY(-3px)}}' +
      '.' + P + '-wh{animation:' + P + '-wh 12s linear infinite}@keyframes ' + P + '-wh{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}' +
      '.' + P + '-ray{animation:' + P + '-r 9s ease-in-out infinite alternate}@keyframes ' + P + '-r{0%{opacity:.6}100%{opacity:1}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 湖畔别墅（仙境） */
  BG.lake_villa = function () {
    var P = 'bg-lv', R = U.rng(8800), i, k;
    var LY = 398; // 湖面水平线
    var d = '<defs>' +
      lg(P + '-sky', 0, 0, 0, LY, [[0, '#6ea4cc'], [0.45, '#aed0e2'], [1, '#eef0de']], true) +
      rg(P + '-sun', 300, 70, 700, [[0, '#fffbe6', 1], [0.1, '#fff4cc', 0.6], [1, '#fff4cc', 0]], true) +
      lg(P + '-snow', 0, 110, 0, 300, [[0, '#ffffff'], [0.5, '#e4eaec'], [1, '#a8b8c4']], true) +
      lg(P + '-lake', 0, LY, 0, 580, [[0, '#b4d4e2'], [0.3, '#6ea2c0'], [1, '#2e6888']], true) +
      lg(P + '-haze', 0, 0, 0, 1, [[0, '#e8f0ee', 0], [1, '#e8f0ee', 0.7]]) +
      lg(P + '-lawn', 0, 460, 0, 900, [[0, '#9cc464'], [0.3, '#6e9a44'], [1, '#2a4a22']], true) +
      lg(P + '-ray', 300, 70, 900, 700, [[0, '#fff8d8', 0.4], [1, '#fff8d8', 0]], true) +
      lg(P + '-mist', 0, 0, 0, 1, [[0, '#ffffff', 0], [0.5, '#ffffff', 0.55], [1, '#ffffff', 0]]) +
      '<clipPath id="' + P + '-lc"><rect x="0" y="' + LY + '" width="1600" height="200"/></clipPath>' +
      blurF(P + '-b6', 6) + blurF(P + '-b2', 1.5) +
      '</defs>';
    var s = '<rect width="1600" height="900" fill="url(#' + P + '-sky)"/><rect width="1600" height="600" fill="url(#' + P + '-sun)"/>';
    var cl = '';
    for (i = 0; i < 6; i++) cl += ell(500 + R() * 1100, 60 + R() * 110, 80 + R() * 140, 12 + R() * 14);
    s += '<path class="' + P + '-cl" d="' + cl + '" fill="#ffffff" opacity=".6" filter="url(#' + P + '-b6)"/>';
    // 山：画进一个组，湖里做倒影
    var mt = '';
    var sk = [[300, 300], [440, 214], [560, 256], [700, 150], [820, 236], [940, 176], [1060, 250], [1200, 206], [1300, 300]];
    var sr = ridge(R, sk, 20, 3);
    mt += '<path d="' + mtnD(sr, LY) + '" fill="#8ea6ba"/><clipPath id="' + P + '-sc"><path d="' + mtnD(sr, LY) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-sc)" d="' + facets(sk, LY, true, R) + '" fill="url(#' + P + '-snow)"/>';
    mt += '<rect x="0" y="200" width="1600" height="' + (LY - 200) + '" fill="url(#' + P + '-haze)"/>';
    var ck = [[380, LY], [520, 300], [640, 262], [760, 318], [880, 280], [1000, 330], [1100, LY]];
    var cr = ridge(R, ck, 16, 4);
    mt += '<path d="' + mtnD(cr, LY) + '" fill="#6a8e84"/><clipPath id="' + P + '-cc"><path d="' + mtnD(cr, LY) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-cc)" d="' + facets(ck, LY, true, R) + '" fill="#8eae96" opacity=".8"/>';
    // 左右环抱的青山
    var lk = [[-10, 40], [160, 120], [300, 210], [420, 300], [560, 370], [660, LY]];
    var lr = ridge(R, lk, 24, 4);
    mt += '<path d="' + mtnD(lr, LY) + 'M-10 ' + LY + 'L-10 40Z" fill="#2e5a3a"/>';
    var rk = [[900, LY], [1020, 330], [1140, 250], [1300, 150], [1440, 80], [1610, 30]];
    var rr = ridge(R, rk, 24, 4);
    mt += '<path d="' + mtnD(rr, LY) + 'M1610 ' + LY + 'L1610 30Z" fill="#2a5236"/>';
    var tr1 = '', tr2 = '';
    for (i = 0; i < 180; i++) {
      var lft = i % 2 === 0, tx = lft ? R() * 640 : 920 + R() * 690, ty;
      ty = lft ? 60 + tx * 0.52 + R() * (LY - 60 - tx * 0.52) : 40 + (1610 - tx) * 0.5 + R() * (LY - 40 - (1610 - tx) * 0.5);
      var trr = 5 + R() * 9;
      if (R() < 0.55) tr1 += ell(tx, ty, trr, trr * 0.85); else tr2 += ell(tx, ty, trr * 0.8, trr * 0.7);
    }
    mt += '<path d="' + tr1 + '" fill="#1c3a26"/><path d="' + tr2 + '" fill="#6a9a4c" opacity=".7"/>';
    // 左坡受光面
    mt += '<path d="M-10 40L160 120L300 210L420 300L560 370L660 ' + LY + 'L380 ' + LY + 'L120 200Z" fill="#8ab860" opacity=".22"/>';
    // 飞瀑
    mt += '<path d="M700 262C696 300 704 340 698 392" stroke="#ffffff" stroke-width="7" fill="none" opacity=".9"/>' +
      '<path class="' + P + '-fall" d="M700 262C696 300 704 340 698 392" stroke="#cfe4ee" stroke-width="3" fill="none" stroke-dasharray="10 12"/>' +
      '<ellipse cx="698" cy="392" rx="40" ry="10" fill="#fff" opacity=".8" filter="url(#' + P + '-b6)"/>';
    // 对岸大草坪
    mt += '<path d="M180 ' + LY + 'Q400 370 700 376Q880 380 1020 ' + LY + 'Z" fill="#9ccc64"/><path d="M180 ' + LY + 'Q400 378 700 382Q880 386 1020 ' + LY + 'Z" fill="#7aae4c"/>';
    var lt = '';
    [[260, 386], [330, 380], [470, 374], [860, 380], [930, 384]].forEach(function (t) { lt += ell(t[0], t[1] - 10, 12, 12) + 'M' + (t[0] - 1.5) + ' ' + t[1] + 'h3v' + (-6) + 'h-3Z'; });
    mt += '<path d="' + lt + '" fill="#2e5a30"/><path d="M560 376h36v-10l-18 -10l-18 10Z" fill="#f4f2ea"/><path d="M556 366l22 -14l22 14Z" fill="#8a4a36"/>';
    s += '<g id="' + P + '-mt">' + mt + '</g>';
    // 湖
    s += '<rect x="0" y="' + LY + '" width="1600" height="200" fill="url(#' + P + '-lake)"/>';
    s += '<g clip-path="url(#' + P + '-lc)"><use href="#' + P + '-mt" transform="translate(0 ' + (2 * LY) + ') scale(1 -1)" opacity=".45" filter="url(#' + P + '-b2)"/></g>';
    var rip = '', gl = '';
    for (i = 0; i < 60; i++) { var ry = LY + 4 + Math.pow(R(), 0.7) * 180, rx = R() * 1600, rl = 20 + (ry - LY) * 0.8 * R(); rip += 'M' + r(rx) + ' ' + r(ry) + 'h' + r(rl); }
    for (i = 0; i < 40; i++) gl += dot(200 + R() * 500, LY + 10 + R() * 120);
    s += '<path d="' + rip + '" stroke="#e8f4f8" stroke-width="1.2" opacity=".45"/>' +
      '<path class="' + P + '-gl" d="' + gl + '" stroke="#fffbe8" stroke-width="2.2" stroke-linecap="round"/>';
    s += '<g class="' + P + '-mst"><rect x="0" y="' + (LY - 40) + '" width="1600" height="70" fill="url(#' + P + '-mist)"/></g>';
    // 近岸草地（右侧伸向别墅 + 前景）
    s += '<path d="M0 560Q300 548 600 560Q840 566 940 520Q1000 470 1060 440Q1120 414 1200 404L1610 396V900H0Z" fill="url(#' + P + '-lawn)"/>' +
      '<path d="M0 560Q300 548 600 560Q840 566 940 520Q1000 470 1060 440Q1120 414 1200 404L1610 396" stroke="#d8ecb0" stroke-width="2" fill="none" opacity=".7"/>';
    // 别墅
    var v = '';
    v += '<path d="M1420 404L1476 392L1476 462L1420 474Z" fill="#b4b0a4"/><path d="M1400 332L1446 322L1446 386L1400 394Z" fill="#b8b4a8"/>' +
      '<rect x="1130" y="400" width="290" height="74" fill="#ece6d6"/><rect x="1150" y="330" width="250" height="64" fill="#f2ecde"/>' +
      '<path d="M1118 334L1432 334L1462 326L1404 280L1172 280Q1140 300 1106 338Z" fill="#6a3a2a"/><path d="M1106 338L1118 334L1432 334L1462 326L1462 332L1432 342L1118 342Z" fill="#3a2016"/>' +
      '<path d="M1172 280L1404 280L1370 262L1206 262Z" fill="#7e4a36"/><rect x="1360" y="248" width="16" height="30" fill="#8a7a6a"/>' +
      '<path d="M1120 396L1430 396L1478 386L1478 392L1430 404L1120 404Z" fill="#4a2c1c"/>';
    for (k = 0; k < 5; k++) {
      var wx = 1166 + k * 46;
      v += '<rect x="' + wx + '" y="344" width="28" height="38" fill="#4a2e1c"/><rect x="' + (wx + 3) + '" y="347" width="22" height="32" fill="#7ea4bc"/>' +
        '<path d="M' + (wx + 3) + ' 347h22l-14 32h-8Z" fill="#d8eaf0" opacity=".6"/><path d="M' + (wx + 14) + ' 347v32" stroke="#4a2e1c" stroke-width="2"/>';
    }
    for (k = 0; k < 3; k++) {
      var dx = 1190 + k * 76;
      v += '<rect x="' + dx + '" y="414" width="50" height="58" fill="#4a2e1c"/><rect x="' + (dx + 4) + '" y="418" width="42" height="54" fill="#88aec4"/>' +
        '<path d="M' + (dx + 4) + ' 418h42l-26 54h-16Z" fill="#e0eef2" opacity=".55"/><path d="M' + (dx + 25) + ' 418v54" stroke="#4a2e1c" stroke-width="3"/>';
    }
    var posts = '';
    for (k = 0; k < 7; k++) posts += 'M' + (1136 + k * 46) + ' 404V474';
    v += '<path d="' + posts + '" stroke="#5a3a24" stroke-width="5"/><path d="M1130 446H1420" stroke="#5a3a24" stroke-width="3"/>' +
      '<path d="M1150 474H1400L1420 490H1130Z" fill="#c8c0ac"/>';
    s += '<g>' + v + '</g><rect x="1130" y="330" width="4" height="144" fill="#fff" opacity=".6"/>';
    // 草坪上的树与花丛
    var bush = '', flw = '';
    for (i = 0; i < 12; i++) { var bx = 960 + R() * 640, by = 470 + R() * 60; bush += ell(bx, by, 18 + R() * 20, 12 + R() * 10); for (k = 0; k < 4; k++) flw += dot(bx + (R() - 0.5) * 30, by - 4 + (R() - 0.5) * 14); }
    s += '<path d="' + bush + '" fill="#3a6a34"/><path d="' + flw + '" stroke="#e86a8a" stroke-width="4" stroke-linecap="round"/>';
    // 左侧高大雪松
    var pine = '';
    for (k = 0; k < 9; k++) { var py = 20 + k * 62, pw = 30 + k * 14; pine += 'M' + (90 - pw) + ' ' + (py + 70) + 'L90 ' + py + 'L' + (90 + pw) + ' ' + (py + 70) + 'Z'; }
    s += '<path d="M84 0h12v620h-12Z" fill="#1a2418"/><path d="' + pine + '" fill="#1a3422"/>';
    var pl = '';
    for (k = 0; k < 9; k++) { var py2 = 20 + k * 62; pl += 'M90 ' + py2 + 'L' + (60 - k * 14) + ' ' + (py2 + 70) + 'L' + (80 - k * 6) + ' ' + (py2 + 70) + 'Z'; }
    s += '<path d="' + pl + '" fill="#4e7a40" opacity=".7"/>';
    // 白孔雀
    function peacock(x, y, sc, fan) {
      var g = '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')">';
      if (fan) {
        g += '<path d="M0 -20L-70 -60A80 80 0 0 1 70 -60Z" fill="#fbfaf4"/>';
        var ey = '';
        for (var j = 0; j < 11; j++) { var an = -2.45 + j * 0.175; ey += ell(Math.cos(an) * 66, -20 + Math.sin(an) * 66, 4, 5); ey += 'M0 -20L' + r(Math.cos(an) * 74) + ' ' + r(-20 + Math.sin(an) * 74); }
        g += '<path d="' + ey + '" stroke="#d8d8cc" stroke-width="1" fill="#e4e4da"/>';
      } else {
        g += '<path d="M-4 -18Q-50 -14 -80 2Q-40 -2 -2 -8Z" fill="#f4f2ea"/>';
      }
      g += '<path d="M-10 -8Q-14 -24 0 -26Q10 -26 12 -16Q14 -6 2 -4Z" fill="#fbfbf6"/><path d="M4 -24Q8 -40 12 -48Q16 -52 18 -46L20 -44L14 -42Q10 -34 10 -20Z" fill="#fbfbf6"/>' +
        '<path d="M14 -52l-2 -6M16 -52l0 -7M18 -51l2 -6" stroke="#f4f2ea" stroke-width="1"/><path d="M-4 -4L-5 8M4 -4L5 8" stroke="#9a8a70" stroke-width="1.6"/>' +
        '<ellipse cx="2" cy="10" rx="16" ry="3" fill="#2a4a22" opacity=".4"/></g>';
      return g;
    }
    s += peacock(360, 596, 0.9, true) + peacock(500, 604, 0.75, false);
    // 光束
    s += '<g class="' + P + '-ray" style="mix-blend-mode:screen">' + poly([[300, 70], [980, 560], [720, 620]], 'fill="url(#' + P + '-ray)"') + poly([[300, 70], [1300, 420], [1200, 520]], 'fill="url(#' + P + '-ray)" opacity=".6"') + '</g>';
    s += '<path d="M600 140q7 -5 12 0q5 -5 12 0M680 110q5 -4 9 0q4 -4 9 0M1000 90q6 -5 11 0q5 -5 11 0" stroke="#3a4a4a" stroke-width="1.6" fill="none"/>';
    s += U.vignette(P, 0.4);
    var css = '.' + P + '-fall{animation:' + P + '-f 1s linear infinite}@keyframes ' + P + '-f{0%{stroke-dashoffset:0}100%{stroke-dashoffset:-22px}}' +
      '.' + P + '-mst{animation:' + P + '-m 24s ease-in-out infinite alternate}@keyframes ' + P + '-m{0%{transform:translateX(0)}100%{transform:translateX(80px)}}' +
      '.' + P + '-cl{animation:' + P + '-c 40s linear infinite alternate}@keyframes ' + P + '-c{0%{transform:translateX(0)}100%{transform:translateX(-60px)}}' +
      '.' + P + '-gl{animation:' + P + '-g 2.4s ease-in-out infinite alternate}@keyframes ' + P + '-g{0%{opacity:.2}100%{opacity:.9}}' +
      '.' + P + '-ray{animation:' + P + '-r 9s ease-in-out infinite alternate}@keyframes ' + P + '-r{0%{opacity:.6}100%{opacity:1}}';
    return U.svg(style(css) + d + s);
  };

  /* ================================================================ 别墅小客厅（下午） */
  BG.villa_room = function () {
    var P = 'bg-vr', R = U.rng(8801), i, k;
    var VX = 800, VY = 400, BL = 240, BR = 1360, BT = 110, BB = 560, T = 2.6;
    function pr(x, y, t) { return [VX + (x - VX) * t, VY + (y - VY) * t]; }
    var d = '<defs>' +
      lg(P + '-out', 0, 130, 0, 560, [[0, '#d2e6f0'], [0.35, '#b8d4e2'], [0.55, '#9cc0d2'], [0.62, '#7eaec6'], [1, '#6a9cb6']], true) +
      lg(P + '-floor', 0, 560, 0, 900, [[0, '#8a5c36'], [1, '#3a2414']], true) +
      lg(P + '-lw', BL, 0, 0, 0, [[0, '#7a5230'], [1, '#3a2414']], true) +
      lg(P + '-rw', BR, 0, 1600, 0, [[0, '#6a4428'], [1, '#2e1c10']], true) +
      lg(P + '-shaft', 1200, 140, 500, 900, [[0, '#fff0c8', 0.3], [1, '#fff0c8', 0]], true) +
      lg(P + '-patch', 0, 560, 0, 900, [[0, '#ffe2a8', 0.7], [1, '#ffd08a', 0.3]], true) +
      lg(P + '-cur', 0, 0, 1, 0, [[0, '#fffaf0', 0.55], [0.25, '#fffaf0', 0.8], [0.5, '#f0e8d8', 0.5], [0.75, '#fffaf0', 0.85], [1, '#f0e8d8', 0.5]]) +
      rg(P + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffe0a0', 0.8], [1, '#ffc070', 0]]) +
      blurF(P + '-b3', 3) + blurF(P + '-b6', 6) +
      '</defs>';
    var s = '';
    // 窗外：湖光山色
    s += '<rect x="' + BL + '" y="' + BT + '" width="' + (BR - BL) + '" height="' + (BB - BT) + '" fill="url(#' + P + '-out)"/>';
    var mk = [[BL, 330], [420, 262], [600, 300], [760, 226], [920, 292], [1060, 244], [1200, 300], [BR, 270]];
    var mr = ridge(R, mk, 18, 4);
    s += '<path d="' + mtnD(mr, 392) + '" fill="#7a98a8"/><clipPath id="' + P + '-mc"><path d="' + mtnD(mr, 392) + '"/></clipPath>' +
      '<path clip-path="url(#' + P + '-mc)" d="' + facets(mk, 392, false, R) + '" fill="#a8c0cc"/>';
    s += '<path d="M' + BL + ' 392L' + BR + ' 392L' + BR + ' 380Q800 360 ' + BL + ' 384Z" fill="#6a9a60"/>';
    var rip = '';
    for (i = 0; i < 26; i++) rip += 'M' + r(BL + R() * (BR - BL)) + ' ' + r(400 + R() * 60) + 'h' + r(20 + R() * 50);
    s += '<path d="' + rip + '" stroke="#f0f8fa" stroke-width="1.4" opacity=".6"/>';
    s += '<path d="M' + BL + ' 470H' + BR + 'M' + BL + ' 492H' + BR + '" stroke="#4a3220" stroke-width="5"/>';
    var bal = '';
    for (var bx = BL + 10; bx < BR; bx += 30) bal += 'M' + bx + ' 470V560';
    s += '<path d="' + bal + '" stroke="#4a3220" stroke-width="3"/>';
    s += '<rect x="' + BL + '" y="' + BT + '" width="' + (BR - BL) + '" height="' + (BB - BT) + '" fill="#fffbee" opacity=".2"/>';
    // 窗框（落地窗）
    var mul = '';
    for (k = 0; k <= 5; k++) { var mx = BL + 20 + k * (BR - BL - 40) / 5; mul += 'M' + r(mx) + ' ' + BT + 'V' + BB; }
    s += '<path d="' + mul + '" stroke="#3a2414" stroke-width="16"/><path d="M' + BL + ' 190H' + BR + '" stroke="#3a2414" stroke-width="10"/>' +
      '<rect x="' + BL + '" y="' + BT + '" width="' + (BR - BL) + '" height="' + (BB - BT) + '" fill="none" stroke="#2e1c10" stroke-width="22"/>';
    s += '<path d="' + mul + '" stroke="#e8b878" stroke-width="2" opacity=".5" transform="translate(7 0)"/>';
    // 天花、左右墙、地板
    s += poly([[BL, BT], [BR, BT], pr(BR, BT, T), pr(BL, BT, T)], 'fill="#4a2e1a"');
    var beam = '';
    for (k = 1; k < 5; k++) { var tt = 1 + k * 0.4, a = pr(BL, BT, tt), b = pr(BR, BT, tt); beam += dPath([a, b, [b[0], b[1] + 14 * tt], [a[0], a[1] + 14 * tt]], true); }
    s += '<path d="' + beam + '" fill="#2e1c10"/>';
    s += poly([[BL, BT], [BL, BB], pr(BL, BB, T), pr(BL, BT, T)], 'fill="url(#' + P + '-lw)"') +
      poly([[BR, BT], [BR, BB], pr(BR, BB, T), pr(BR, BT, T)], 'fill="url(#' + P + '-rw)"');
    var pl = '';
    for (k = 1; k < 9; k++) { var tk = 1 + k * 0.2; pl += 'M' + P2(pr(BL, BT, tk)) + 'L' + P2(pr(BL, BB, tk)) + 'M' + P2(pr(BR, BT, tk)) + 'L' + P2(pr(BR, BB, tk)); }
    s += '<path d="' + pl + '" stroke="#24160c" stroke-width="2" opacity=".6"/>';
    // 墙裙线
    s += '<path d="M' + P2(pr(BL, 420, 1)) + 'L' + P2(pr(BL, 420, T)) + 'M' + P2(pr(BR, 420, 1)) + 'L' + P2(pr(BR, 420, T)) + '" stroke="#2a180c" stroke-width="4"/>';
    s += poly([[BL, BB], [BR, BB], pr(BR, BB, T), pr(BL, BB, T)], 'fill="url(#' + P + '-floor)"');
    var fb = '';
    for (var fx = BL; fx <= BR; fx += 56) fb += 'M' + fx + ' ' + BB + 'L' + P2(pr(fx, BB, T));
    s += '<path d="' + fb + '" stroke="#2a180c" stroke-width="1.6" opacity=".55"/>';
    // 地毯
    var rug = [pr(520, BB, 1.12), pr(1080, BB, 1.12), pr(1080, BB, 1.7), pr(520, BB, 1.7)];
    var rug2 = [pr(545, BB, 1.16), pr(1055, BB, 1.16), pr(1055, BB, 1.64), pr(545, BB, 1.64)];
    s += poly(rug, 'fill="#6a2a24"') + poly(rug2, 'fill="none" stroke="#c8a060" stroke-width="3"') + poly([pr(580, BB, 1.22), pr(1020, BB, 1.22), pr(1020, BB, 1.56), pr(580, BB, 1.56)], 'fill="#2a3450" opacity=".5"');
    // 左墙唐卡 + 壁灯；右墙书架
    var th = [pr(BL, 210, 1.3), pr(BL, 210, 1.62), pr(BL, 380, 1.62), pr(BL, 380, 1.3)];
    s += poly(th, 'fill="#5a1e18"') + poly([pr(BL, 226, 1.34), pr(BL, 226, 1.58), pr(BL, 360, 1.58), pr(BL, 360, 1.34)], 'fill="#b8883a"');
    var tc = pr(BL, 290, 1.46);
    s += '<ellipse cx="' + r(tc[0]) + '" cy="' + r(tc[1]) + '" rx="16" ry="30" fill="#3a5a7a"/><ellipse cx="' + r(tc[0]) + '" cy="' + r(tc[1] - 4) + '" rx="7" ry="11" fill="#e0c070"/>';
    var sc = pr(BL, 260, 2.05);
    s += '<path d="M' + r(sc[0]) + ' ' + r(sc[1]) + 'l24 -8l0 30l-24 -4Z" fill="#c89a58"/><ellipse cx="' + r(sc[0] + 10) + '" cy="' + r(sc[1] + 4) + '" rx="60" ry="60" fill="url(#' + P + '-lamp)" opacity=".5"/>';
    var bs1 = [pr(BR, 170, 1.25), pr(BR, 170, 1.75), pr(BR, BB, 1.75), pr(BR, BB, 1.25)];
    s += poly(bs1, 'fill="#3a2414"');
    var books = '', cols = ['#7a2e24', '#2e4a5a', '#8a7a4a', '#3a5a3a', '#6a4a6a', '#c8b890'];
    for (k = 0; k < 5; k++) {
      var sy = 190 + k * 72;
      for (var bt = 1.28; bt < 1.72; bt += 0.025 + R() * 0.02) {
        var b1 = pr(BR, sy + R() * 12, bt), b2 = pr(BR, sy + 58, bt + 0.018);
        books += '<path d="M' + P2(b1) + 'L' + P2([b2[0], b1[1] + (b2[1] - b1[1]) * 0.02]) + 'L' + P2(b2) + 'L' + P2([b1[0], b2[1] - (b2[1] - b1[1]) * 0.02]) + 'Z" fill="' + cols[Math.floor(R() * 6)] + '"/>';
      }
      books += '<path d="M' + P2(pr(BR, sy + 60, 1.25)) + 'L' + P2(pr(BR, sy + 60, 1.75)) + '" stroke="#2a180c" stroke-width="' + r(5 + k) + '"/>';
    }
    s += '<g opacity=".85">' + books + '</g>';
    // 窗纱
    s += '<g class="' + P + '-cL" style="transform-origin:' + (BL + 60) + 'px ' + BT + 'px"><path d="M' + (BL + 4) + ' ' + BT + 'H' + (BL + 130) + 'Q' + (BL + 110) + ' 340 ' + (BL + 150) + ' ' + BB + 'H' + (BL + 4) + 'Z" fill="url(#' + P + '-cur)"/></g>' +
      '<g class="' + P + '-cR" style="transform-origin:' + (BR - 60) + 'px ' + BT + 'px"><path d="M' + (BR - 4) + ' ' + BT + 'H' + (BR - 120) + 'Q' + (BR - 150) + ' 340 ' + (BR - 110) + ' ' + BB + 'H' + (BR - 4) + 'Z" fill="url(#' + P + '-cur)"/></g>';
    // 地板光斑（阳光从右侧斜射）
    var patch = '';
    for (k = 0; k < 5; k++) {
      var x0 = BL + 28 + k * (BR - BL - 40) / 5, x1 = BL + 12 + (k + 1) * (BR - BL - 40) / 5;
      var n0 = pr(x0, BB, 2.2), n1 = pr(x1, BB, 2.2);
      patch += dPath([[x0 - 30, BB + 4], [x1 - 30, BB + 4], [n1[0] - 460, n1[1]], [n0[0] - 460, n0[1]]], true);
    }
    s += '<path d="' + patch + '" fill="url(#' + P + '-patch)" style="mix-blend-mode:screen"/>';
    // 家具：背光剪影
    function chair(x, flip) {
      var m = flip ? -1 : 1;
      return '<g transform="translate(' + x + ' 0) scale(' + m + ' 1)"><path d="M-70 566V470Q-70 440 -40 440H40Q56 440 56 470V504H72Q80 504 80 520V566Z" fill="#2a1a10"/>' +
        '<path d="M-70 470Q-70 440 -40 440H40Q56 440 56 470" stroke="#ffd898" stroke-width="3" fill="none" opacity=".7"/>' +
        '<path d="M-64 566v12M72 566v12" stroke="#1a0e06" stroke-width="5"/></g>';
    }
    s += chair(540, false) + chair(1060, true);
    s += '<path d="M660 540H940L930 552H670Z" fill="#3a2414"/><path d="M670 552V586M930 552V586" stroke="#2a180c" stroke-width="6"/>' +
      '<path d="M660 540H940" stroke="#ffd898" stroke-width="2" opacity=".6"/>' +
      '<path d="M770 540q-2 -20 14 -22q18 0 18 22Z" fill="#2a2a2a"/><path d="M802 528l14 -6" stroke="#2a2a2a" stroke-width="3"/><path d="M784 518v-4h8v4" fill="#2a2a2a"/>' +
      '<path d="M840 540h14v-10h-14Z M866 540h14v-10h-14Z" fill="#3a3a3a"/>';
    // 盆栽
    var lv = '';
    for (k = 0; k < 14; k++) { var an = -2.8 + k * 0.2, ll = 60 + R() * 60; lv += 'M1270 470q' + r(Math.cos(an) * ll * 0.5) + ' ' + r(Math.sin(an) * ll * 0.8) + ' ' + r(Math.cos(an) * ll) + ' ' + r(Math.sin(an) * ll * 0.6 + 10); }
    s += '<path d="' + lv + '" stroke="#1e2e18" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M1246 470h48l-8 90h-32Z" fill="#6a3a24"/>';
    // 光柱与浮尘
    var sh = '';
    for (k = 0; k < 5; k++) {
      var sx0 = BL + 40 + k * (BR - BL - 40) / 5, sx1 = sx0 + (BR - BL - 40) / 5 - 40;
      sh += dPath([[sx0 + 60, BT + 30], [sx1 + 60, BT + 30], [sx1 - 380, 900], [sx0 - 380, 900]], true);
    }
    s += '<path class="' + P + '-sh" d="' + sh + '" fill="url(#' + P + '-shaft)" style="mix-blend-mode:screen" opacity=".7"/>';
    var mo = '';
    for (i = 0; i < 60; i++) mo += dot(300 + R() * 1000, 150 + R() * 560);
    s += '<path class="' + P + '-mo" d="' + mo + '" stroke="#fff6dc" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>';
    s += U.vignette(P, 0.6);
    var css = '.' + P + '-cL{animation:' + P + '-cl 6s ease-in-out infinite alternate}@keyframes ' + P + '-cl{0%{transform:skewX(0deg)}100%{transform:skewX(-2.5deg)}}' +
      '.' + P + '-cR{animation:' + P + '-cr 7s ease-in-out infinite alternate}@keyframes ' + P + '-cr{0%{transform:skewX(0deg)}100%{transform:skewX(2deg)}}' +
      '.' + P + '-sh{animation:' + P + '-s 10s ease-in-out infinite alternate}@keyframes ' + P + '-s{0%{opacity:.55}100%{opacity:.8}}' +
      '.' + P + '-mo{animation:' + P + '-m 16s linear infinite alternate}@keyframes ' + P + '-m{0%{transform:translate(0,0)}100%{transform:translate(-24px,20px)}}';
    return U.svg(style(css) + d + s);
  };
})();
