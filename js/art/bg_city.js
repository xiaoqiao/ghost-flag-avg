/*
 * 城市场景背景（2004 年上海）：报社编辑部 / 会议室 / 高层走廊窗、上海图书馆四景、警局问询室。
 * 画法：简易针孔透视投影（cam）+ 扁平几何色块分层 + 渐变光池/体积光 + 暗角。
 * 所有 SVG 内部 id / class / keyframes 均带背景名前缀（bgnr- bgmr- bgow- bglh- bglr- bglo- bgla- bgpo-）。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var FONT = 'Songti SC, STSong, SimSun, serif';

  /* ---------- 小工具 ---------- */
  function r1(v) { return Math.round(v * 10) / 10; }
  /** 针孔相机：世界坐标 X 右、Y 上（地面 0）、Z 向前 → 屏幕坐标 */
  function cam(f, cx, cy, h) {
    var P = function (X, Y, Z) { return [cx + f * X / Z, cy + f * (h - Y) / Z]; };
    P.h = h; P.f = f; P.cx = cx; P.cy = cy;
    return P;
  }
  function r0(v) { return Math.round(v); }
  function pts(a) { var s = []; for (var i = 0; i < a.length; i++) s.push(r0(a[i][0]) + ',' + r0(a[i][1])); return s.join(' '); }
  function poly(a, fill, ex) { return '<polygon points="' + pts(a) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function Q(P, v, fill, ex) { return poly(v.map(function (p) { return P(p[0], p[1], p[2]); }), fill, ex); }
  function rect(x, y, w, h, fill, ex) {
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" fill="' + fill + '"' + (ex ? ' ' + ex : '') + '/>';
  }
  function stops(a) {
    return a.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  /** 线性渐变；user=true 时坐标为画布像素 */
  function lin(id, x1, y1, x2, y2, st, user) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' +
      (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(st) + '</linearGradient>';
  }
  function rad(id, cx, cy, r, st, user) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
      (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(st) + '</radialGradient>';
  }
  function blurF(id, sd) {
    return '<filter id="' + id + '" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }
  /** 凸包（体积光：窗洞四角 + 地面光斑四角） */
  function hull(a) {
    a = a.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
    function cr(o, b, c) { return (b[0] - o[0]) * (c[1] - o[1]) - (b[1] - o[1]) * (c[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < a.length; i++) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], a[i]) <= 0) lo.pop(); lo.push(a[i]); }
    for (i = a.length - 1; i >= 0; i--) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], a[i]) <= 0) up.pop(); up.push(a[i]); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  /** 长方体的可见面（相机在 X=0）；c = {front, top, side, bottom} */
  function box(P, x0, x1, y0, y1, z0, z1, c) {
    var s = '';
    if (x1 < 0 && c.side) s += Q(P, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], c.side);
    if (x0 > 0 && c.side) s += Q(P, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], c.side);
    if (y1 < P.h && c.top) s += Q(P, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c.top);
    if (y0 > P.h && c.bottom) s += Q(P, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], c.bottom);
    if (c.front) s += Q(P, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], c.front);
    return s;
  }
  /** 把若干线段合成一个 path 的 d */
  function segs(list) {
    return list.map(function (l) { return 'M' + r0(l[0][0]) + ' ' + r0(l[0][1]) + 'L' + r0(l[1][0]) + ' ' + r0(l[1][1]); }).join('');
  }
  function fogger(fogCol, z0, span, max) {
    return function (c, z) { return U.mix(c, fogCol, Math.min(max, Math.max(0, (z - z0) / span))); };
  }


  /* =====================================================================
   * newsroom：外滩老楼里的开放式编辑部，白天，日光灯
   * ===================================================================== */
  GF.art.bg.newsroom = function () {
    var p = 'bgnr', P = cam(800, 800, 318, 1.75), R = U.rng(1101);
    var fog = fogger('#9aa5a1', 3, 15, 0.62);
    var XL = -7, XR = 6, YC = 3.9, ZB = 13, i, j;
    var d = '', s = '';
    d += lin(p + '-ceil', 0, 0, 0, 200, [[0, '#1f2624'], [1, '#56605c']], 1);
    d += lin(p + '-lw', 0, 0, 370, 0, [[0, '#262d2b'], [1, '#56605b']], 1);
    d += lin(p + '-rw', 1600, 0, 1170, 0, [[0, '#1a1f1e'], [1, '#4d5652']], 1);
    d += lin(p + '-fl', 0, 900, 0, 420, [[0, '#161a19'], [0.55, '#3b4340'], [1, '#6a726e']], 1);
    d += lin(p + '-bw', 0, 180, 0, 420, [[0, '#454e4a'], [1, '#626b66']], 1);
    d += lin(p + '-sky', 0, 190, 0, 360, [[0, '#c3cdcb'], [0.75, '#e6e9df'], [1, '#f3f0e2']], 1);
    d += lin(p + '-lwin', 0, 0, 1, 0, [[0, '#fbf6e6'], [1, '#d8ddd4']]);
    d += lin(p + '-beam', 0, 0, 1, 0, [[0, '#fff3d4', 0.32], [0.6, '#fff3d4', 0.1], [1, '#fff3d4', 0]]);
    d += lin(p + '-refl', 0, 0, 0, 1, [[0, '#eef0e6', 0.3], [1, '#eef0e6', 0]]);
    d += lin(p + '-pil', 0, 0, 1, 0, [[0, '#6f7a74'], [1, '#2c3431']]);
    d += rad(p + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffcf7a', 0.6], [1, '#ffcf7a', 0]]);
    d += blurF(p + '-b6', 6) + blurF(p + '-b14', 14);

    // 天花板 / 左右墙 / 地面 / 后墙
    s += Q(P, [[XL, YC, 0.3], [XR, YC, 0.3], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-ceil)');
    s += Q(P, [[XL, 0, 0.3], [XL, YC, 0.3], [XL, YC, ZB], [XL, 0, ZB]], 'url(#' + p + '-lw)');
    s += Q(P, [[XR, 0, 0.3], [XR, YC, 0.3], [XR, YC, ZB], [XR, 0, ZB]], 'url(#' + p + '-rw)');
    s += Q(P, [[XL, 0, 0.3], [XR, 0, 0.3], [XR, 0, ZB], [XL, 0, ZB]], 'url(#' + p + '-fl)');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-bw)');
    // 墙裙 + 顶角线
    s += Q(P, [[XL, 0, 0.3], [XL, 1.0, 0.3], [XL, 1.0, ZB], [XL, 0, ZB]], '#151a19', 'opacity=".5"');
    s += Q(P, [[XR, 0, 0.3], [XR, 1.0, 0.3], [XR, 1.0, ZB], [XR, 0, ZB]], '#101413', 'opacity=".5"');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, 1.0, ZB], [XL, 1.0, ZB]], '#222927', 'opacity=".4"');
    s += '<path d="' + segs([[P(XL, 3.6, 0.5), P(XL, 3.6, ZB)], [P(XR, 3.6, 0.5), P(XR, 3.6, ZB)], [P(XL, 3.6, ZB), P(XR, 3.6, ZB)]]) + '" stroke="#7b8580" stroke-width="2" opacity=".35"/>';

    // 地面接缝
    var L = [];
    for (var gx = -6; gx <= 5; gx++) L.push([P(gx, 0, 1.2), P(gx, 0, ZB)]);
    for (var gz = 2; gz <= ZB; gz++) L.push([P(XL, 0, gz), P(XR, 0, gz)]);
    s += '<path d="' + segs(L) + '" stroke="#0c100f" stroke-width="1.2" opacity=".3"/>';

    // 后墙三扇拱窗，窗外浦东天际线
    var k = 800 / ZB, wins = [-4.3, -0.5, 3.2], wp = '', mul = '';
    var ys = P(0, 0.9, ZB)[1], yp = P(0, 2.75, ZB)[1], hw = 1.0 * k;
    wins.forEach(function (X) {
      var c = P(X, 0, ZB)[0];
      var a = 'M' + r0(c - hw) + ' ' + r0(ys) + 'V' + r0(yp) + 'A' + r0(hw) + ' ' + r0(hw) + ' 0 0 1 ' + r0(c + hw) + ' ' + r0(yp) + 'V' + r0(ys) + 'Z';
      wp += a; mul += a + 'M' + r0(c) + ' ' + r0(ys) + 'V' + r0(yp - hw);
      for (j = 1; j < 4; j++) { var yy = ys - (ys - yp) * j / 3; mul += 'M' + r0(c - hw) + ' ' + r0(yy) + 'H' + r0(c + hw); }
      s += rect(c - hw * 1.25, P(0, 0, ZB)[1] + 1, hw * 2.5, 150, 'url(#' + p + '-refl)');
    });
    d += '<clipPath id="' + p + '-wc"><path d="' + wp + '"/></clipPath>';
    s += '<path d="' + wp + '" fill="#f6f5ea" filter="url(#' + p + '-b14)" opacity=".8"/>';
    var v = rect(300, 170, 1000, 220, 'url(#' + p + '-sky)'), hx = 320, base = 330, sk1 = 'M320 ' + base, sk2 = sk1;
    while (hx < 1220) {
      var bw = 10 + R() * 26, bh = 8 + R() * (R() < 0.2 ? 60 : 30);
      sk1 += 'V' + r0(base - bh) + 'H' + r0(hx + bw);
      sk2 += 'V' + r0(base - bh * 0.55 - 6) + 'H' + r0(hx + bw * 0.6);
      hx += bw;
    }
    v += '<path d="' + sk1 + 'V' + base + 'Z" fill="#b9c2c0"/><path d="' + sk2 + 'V' + base + 'Z" fill="#a4afae"/>';
    var tx = P(-0.2, 0, ZB)[0];
    v += '<g fill="#8f9b9e">' + rect(tx - 1.2, 200, 2.4, 26) + rect(tx - 2.5, 226, 5, 100) +
      '<circle cx="' + r0(tx) + '" cy="244" r="7"/><circle cx="' + r0(tx) + '" cy="290" r="11"/><circle cx="' + r0(tx) + '" cy="229" r="3.5"/>' +
      '<path d="M' + r0(tx - 17) + ' 328L' + r0(tx - 2) + ' 290h4L' + r0(tx + 17) + ' 328z"/></g>' +
      '<circle cx="' + r0(tx - 3) + '" cy="287" r="6" fill="#e0cbb0" opacity=".55"/><circle cx="' + r0(tx - 2) + '" cy="242" r="3.5" fill="#e0cbb0" opacity=".5"/>';
    var jx = P(3.4, 0, ZB)[0];
    v += '<path d="M' + r0(jx - 10) + ' 328V262l3-8V240l2-6v-8l2-5v-12l3-7 3 7v12l2 5v8l2 6v14l3 8V328z" fill="#9aa6a8"/>';
    v += rect(300, 326, 1000, 60, '#b4bdb9') + rect(300, 326, 1000, 2, '#dfe3da');
    for (i = 0; i < 14; i++) v += rect(320 + R() * 880, 332 + R() * 26, 20 + R() * 50, 1.5, '#e9ece2', 'opacity=".7"');
    s += '<g clip-path="url(#' + p + '-wc)">' + v + '</g>';
    s += '<path d="' + mul + '" stroke="#333c39" stroke-width="3" fill="none"/>';
    wins.forEach(function (X) { var c = P(X, 0, ZB)[0]; s += rect(c - hw - 6, ys, hw * 2 + 12, 5, '#2f3634'); });

    // 左墙高窗 + 投射到地面的光斑 / 体积光
    var beams = '', patches = '', D = [1, -0.55, -0.3];
    [2.2, 5.2, 8.2, 11.1].forEach(function (z) {
      var z1 = z + 1.3, y0 = 0.95, y1 = 3.35, W = [[XL, y0, z], [XL, y0, z1], [XL, y1, z1], [XL, y1, z]];
      s += Q(P, [[XL, y0 - 0.12, z - 0.12], [XL, y0 - 0.12, z1 + 0.12], [XL, y1 + 0.12, z1 + 0.12], [XL, y1 + 0.12, z - 0.12]], '#161b1a');
      s += Q(P, W, 'url(#' + p + '-lwin)');
      var ml = [[P(XL, y0, (z + z1) / 2), P(XL, y1, (z + z1) / 2)]];
      for (j = 1; j < 4; j++) ml.push([P(XL, y0 + (y1 - y0) * j / 4, z), P(XL, y0 + (y1 - y0) * j / 4, z1)]);
      s += '<path d="' + segs(ml) + '" stroke="#434c48" stroke-width="3"/>';
      var F = W.map(function (w) { var t = w[1] / -D[1]; return [w[0] + t * D[0], 0, w[2] + t * D[2]]; });
      patches += Q(P, F, '#f3e6c4', 'opacity=".2"');
      beams += poly(hull(W.concat(F).map(function (q) { return P(q[0], q[1], q[2]); })), 'url(#' + p + '-beam)');
    });
    s += patches;

    // 右墙：壁柱、公告栏、挂钟
    [4.0, 8.0, 12.0].forEach(function (z) {
      s += box(P, 5.7, XR, 0, YC, z, z + 0.5, { front: fog('#434c48', z), side: fog('#56605b', z) });
    });
    [[5.0, 7.4], [9.0, 11.4]].forEach(function (b) {
      s += Q(P, [[XR, 1.3, b[0]], [XR, 1.3, b[1]], [XR, 2.5, b[1]], [XR, 2.5, b[0]]], fog('#6e573c', b[0]));
      for (j = 0; j < 8; j++) {
        var zz = b[0] + 0.1 + R() * (b[1] - b[0] - 0.4), yy = 1.4 + R() * 0.8, wz = 0.18 + R() * 0.2;
        s += Q(P, [[XR, yy, zz], [XR, yy, zz + wz], [XR, yy + 0.26, zz + wz], [XR, yy + 0.26, zz]], fog(R() < 0.3 ? '#e0bd86' : '#dcd8c8', zz));
      }
    });
    var ck = P(XR, 3.0, 11.9), ck2 = P(XR, 3.0, 11.6), ck3 = P(XR, 3.26, 11.9);
    s += '<ellipse cx="' + r0(ck[0]) + '" cy="' + r0(ck[1]) + '" rx="' + r1(Math.abs(ck2[0] - ck[0])) + '" ry="' + r0(ck[1] - ck3[1]) + '" fill="#d7d4c6" stroke="#232928" stroke-width="2"/>';
    // 右侧合订本报架（面朝过道）
    s += box(P, 4.9, 5.7, 0, 2.3, 2.2, 3.9, { front: '#1d2220', side: '#2e3431', top: '#454b45' });
    for (var sh = 0; sh < 5; sh++) {
      var y0 = 0.12 + sh * 0.44, zz = 2.25;
      while (zz < 3.8) {
        var w = 0.1 + R() * 0.12, hg = 0.28 + R() * 0.1;
        s += Q(P, [[4.9, y0, zz], [4.9, y0, zz + w], [4.9, y0 + hg, zz + w], [4.9, y0 + hg, zz]], ['#5e4c3a', '#7d3a2e', '#4f564e', '#8f7a57', '#39434a'][Math.floor(R() * 5)]);
        zz += w + 0.012;
      }
    }

    // 天花梁 + 日光灯
    [3.0, 6.5, 10.0].forEach(function (z) {
      s += box(P, XL, XR, 3.6, YC, z, z + 0.35, { bottom: fog('#38403d', z), front: fog('#48514d', z) });
    });
    var lights = '', glows = '';
    [1.7, 4.4, 7.9, 11.3].forEach(function (z) {
      [-3.6, 0, 3.2].forEach(function (X) {
        lights += Q(P, [[X - 0.22, 3.72, z - 0.05], [X + 0.22, 3.72, z - 0.05], [X + 0.22, 3.72, z + 1.3], [X - 0.22, 3.72, z + 1.3]], '#232a28');
        lights += Q(P, [[X - 0.15, 3.7, z], [X + 0.15, 3.7, z], [X + 0.15, 3.7, z + 1.25], [X - 0.15, 3.7, z + 1.25]], fog('#f2f6ee', z * 0.3));
        glows += Q(P, [[X - 0.7, 3.7, z - 0.2], [X + 0.7, 3.7, z - 0.2], [X + 0.7, 3.7, z + 1.45], [X - 0.7, 3.7, z + 1.45]], '#eef3ea', 'opacity=".4"');
      });
    });
    s += '<g filter="url(#' + p + '-b14)">' + glows + '</g>' + lights;

    // 吊牌
    var sg = P(-1.1, 3.35, 7.2), sg2 = P(1.1, 2.95, 7.2);
    s += '<path d="M' + r0(sg[0] + 8) + ' ' + r0(sg[1]) + 'V' + r0(P(0, YC, 7.2)[1]) + 'M' + r0(sg2[0] - 8) + ' ' + r0(sg[1]) + 'V' + r0(P(0, YC, 7.2)[1]) + '" stroke="#2a302e" stroke-width="1.5"/>';
    s += rect(sg[0], sg[1], sg2[0] - sg[0], sg2[1] - sg[1], '#8e2f25') + rect(sg[0] + 3, sg[1] + 3, sg2[0] - sg[0] - 6, sg2[1] - sg[1] - 6, 'none', 'stroke="#d8b777" stroke-width="1" opacity=".6"');
    s += '<text x="' + r0((sg[0] + sg2[0]) / 2) + '" y="' + r0(sg2[1] - 11) + '" font-family="' + FONT + '" font-size="27" fill="#ecd9a8" text-anchor="middle" letter-spacing="8">编 辑 部</text>';

    // 办公桌（从后往前画）
    var lamps = [];
    [11.0, 8.8, 6.6, 4.4].forEach(function (z0, ri) {
      [[-6.0, -1.4, [-5.1, -3.6, -2.1]], [1.4, 5.0, [2.1, 3.7]]].forEach(function (blk, bi) {
        var x0 = blk[0], x1 = blk[1], z1 = z0 + 0.8;
        s += Q(P, [[x0 - 0.1, 0, z0 - 0.2], [x1 + 0.1, 0, z0 - 0.2], [x1 + 0.1, 0, z1], [x0 - 0.1, 0, z1]], '#0b0e0d', 'opacity=".45"');
        s += box(P, x0, x1, 0.74, 1.02, z1 - 0.04, z1, { front: fog('#4b5550', z0), top: fog('#7f8983', z0), side: fog('#3b4440', z0) });
        s += box(P, x0, x1, 0, 0.76, z0, z1, { front: fog('#323835', z0), top: fog('#7d7e72', z0), side: fog('#262b29', z0) });
        s += Q(P, [[x0, 0.72, z0], [x1, 0.72, z0], [x1, 0.76, z0], [x0, 0.76, z0]], fog('#9a9a8c', z0));
        if (z0 < 7) {
          var dl = [];
          blk[2].forEach(function (cx) {
            dl.push([P(cx + 0.35, 0.05, z0), P(cx + 0.35, 0.68, z0)]);
            for (var q = 1; q < 4; q++) dl.push([P(cx + 0.35, 0.68 - q * 0.17, z0), P(cx + 0.72, 0.68 - q * 0.17, z0)]);
          });
          s += '<path d="' + segs(dl) + '" stroke="' + fog('#1c201e', z0) + '" stroke-width="2"/>';
        }
        blk[2].forEach(function (cx) {
          var mz = z0 + 0.28;
          s += box(P, cx - 0.2, cx + 0.2, 0.8, 1.16, mz, mz + 0.45, { front: fog('#b3ab94', z0), top: fog('#cfc8b2', z0), side: fog('#8c8573', z0) });
          var on = R() < 0.45;
          s += Q(P, [[cx - 0.155, 0.85, mz], [cx + 0.155, 0.85, mz], [cx + 0.155, 1.11, mz], [cx - 0.155, 1.11, mz]], fog(on ? '#86a2ae' : '#26302f', z0));
          if (on) s += Q(P, [[cx - 0.14, 1.07, mz], [cx + 0.14, 1.07, mz], [cx + 0.14, 1.095, mz], [cx - 0.14, 1.095, mz]], fog('#2f5f86', z0));
          s += box(P, cx - 0.2, cx + 0.2, 0.76, 0.785, z0 + 0.05, z0 + 0.22, { front: fog('#958e7b', z0), top: fog('#bdb6a1', z0) });
        });
        var nP = 3 + Math.floor(R() * 3);
        for (j = 0; j < nP; j++) {
          var pw = 0.25 + R() * 0.2, px = x0 + 0.08 + R() * (x1 - x0 - pw - 0.1), ph = 0.02 + R() * (R() < 0.5 ? 0.42 : 0.08), pz = z0 + 0.04 + R() * 0.2;
          var ok = true;
          blk[2].forEach(function (cx) { if (px + pw > cx - 0.24 && px < cx + 0.24) ok = false; });
          if (!ok) continue;
          var pc = ['#e4d8b8', '#d8ccae', '#cbc7b6', '#ecdfbf'][Math.floor(R() * 4)];
          s += box(P, px, px + pw, 0.76, 0.76 + ph, pz, pz + 0.3, { front: fog(U.mix(pc, '#6f6a5c', 0.35), z0), top: fog(pc, z0), side: fog(U.mix(pc, '#4f4b42', 0.5), z0) });
          if (ph > 0.12) for (var t = 1; t < 3; t++) {
            var yy = 0.76 + ph * t / 3; s += Q(P, [[px, yy, pz], [px + pw, yy, pz], [px + pw, yy + 0.008, pz], [px, yy + 0.008, pz]], '#5d584c', 'opacity=".5"');
          }
        }
        if ((ri === 1 && bi === 0) || (ri === 2 && bi === 1) || (ri === 0 && bi === 1)) lamps.push([bi === 0 ? x1 - 0.3 : x0 + 0.3, z0 + 0.35]);
      });
    });
    // 台灯（暖色点缀）
    lamps.forEach(function (l) {
      var b = P(l[0], 0.76, l[1]), t = P(l[0] + 0.05, 1.18, l[1]), sc = 800 / l[1];
      s += '<ellipse cx="' + r0(b[0]) + '" cy="' + r0(b[1]) + '" rx="' + r0(sc * 0.65) + '" ry="' + r0(sc * 0.14) + '" fill="url(#' + p + '-lamp)"/>';
      s += '<path d="M' + r0(b[0]) + ' ' + r0(b[1]) + 'L' + r0(t[0]) + ' ' + r0(t[1]) + '" stroke="#202421" stroke-width="' + r1(sc * 0.014) + '"/>';
      s += '<path d="M' + r0(t[0] - sc * 0.08) + ' ' + r0(t[1] + sc * 0.06) + 'L' + r0(t[0] - sc * 0.02) + ' ' + r0(t[1] - sc * 0.03) + 'L' + r0(t[0] + sc * 0.09) + ' ' + r0(t[1] + sc * 0.03) + 'Z" fill="#35453a"/>';
      s += '<circle cx="' + r0(t[0]) + '" cy="' + r0(t[1] + sc * 0.06) + '" r="' + r1(sc * 0.05) + '" fill="#ffe0a0" filter="url(#' + p + '-b6)"/>';
    });

    // 体积光 + 浮尘
    s += '<g class="' + p + '-bm">' + beams + '</g>';
    var dust = '';
    for (i = 0; i < 40; i++) {
      var dp = P(-6 + R() * 5.5, 0.8 + R() * 2.6, 3 + R() * 9);
      dust += '<circle cx="' + r0(dp[0]) + '" cy="' + r0(dp[1]) + '" r="' + r1(0.7 + R() * 1.3) + '"/>';
    }
    s += '<g class="' + p + '-dust" fill="#fff6dc" opacity=".5">' + dust + '</g>';

    // 近景：右侧方柱（左面迎光）
    s += box(P, 2.2, 2.7, 0, YC, 2.3, 2.8, { front: '#111514', side: 'url(#' + p + '-pil)' });
    s += Q(P, [[2.2, 0, 2.3], [2.2, 0.25, 2.3], [2.2, 0.25, 2.8], [2.2, 0, 2.8]], '#0c0f0e');

    var css = '<style>.' + p + '-dust{animation:' + p + '-dr 18s ease-in-out infinite alternate}' +
      '.' + p + '-bm{animation:' + p + '-br 9s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-dr{to{transform:translate(26px,-14px)}}@keyframes ' + p + '-br{from{opacity:.8}to{opacity:1}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.62));
  };

  /** 在 X/Z 方向上裁剪平面多边形（Sutherland–Hodgman），ax=0 为 X，2 为 Z */
  function clipAx(pl, ax, v, keepGreater) {
    var out = [];
    for (var i = 0; i < pl.length; i++) {
      var a = pl[i], b = pl[(i + 1) % pl.length];
      var ina = keepGreater ? a[ax] >= v : a[ax] <= v, inb = keepGreater ? b[ax] >= v : b[ax] <= v;
      if (ina) out.push(a);
      if (ina !== inb) {
        var t = (v - a[ax]) / (b[ax] - a[ax]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return out;
  }
  /** 平放在高度 Y 上的旋转矩形（纸张、报纸） */
  function flat(cx, cz, w, dz, ang, Y) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return [[-w / 2, -dz / 2], [w / 2, -dz / 2], [w / 2, dz / 2], [-w / 2, dz / 2]].map(function (q) {
      return [cx + q[0] * c - q[1] * s, Y, cz + q[0] * s + q[1] * c];
    });
  }

  /* =====================================================================
   * meeting_room：报社会议室，长桌、白板、投影，窗帘半拉（评报会/选题会）
   * ===================================================================== */
  GF.art.bg.meeting_room = function () {
    var p = 'bgmr', P = cam(820, 800, 318, 1.62), R = U.rng(2207);
    var XL = -4.2, XR = 4.6, YC = 2.9, ZB = 8.5, TY = 0.76, i, j;
    var fog = fogger('#6d746f', 3, 12, 0.35);
    var d = '', s = '';
    d += lin(p + '-ceil', 0, 0, 0, 230, [[0, '#1b1f1e'], [1, '#474d4a']], 1);
    d += lin(p + '-lw', 0, 0, 420, 0, [[0, '#262b2a'], [1, '#535a56']], 1);
    d += lin(p + '-rw', 1600, 0, 1240, 0, [[0, '#1c201f'], [1, '#4a514d']], 1);
    d += lin(p + '-bw', 380, 0, 1240, 0, [[0, '#4b524e'], [0.5, '#5f6661'], [1, '#474d4a']], 1);
    d += lin(p + '-fl', 0, 900, 0, 460, [[0, '#121517'], [1, '#353c3f']], 1);
    d += lin(p + '-win', 0, 0, 0, 1, [[0, '#f6efd8'], [1, '#e2e2d4']]);
    d += lin(p + '-beam', 1, 0, 0, 0, [[0, '#fff0cc', 0.17], [0.6, '#fff0cc', 0.04], [1, '#fff0cc', 0]]);
    d += lin(p + '-proj', 0, 0, 0, 1, [[0, '#e4eef6', 0.07], [1, '#e4eef6', 0.26]]);
    d += lin(p + '-cur', 0, 0, 1, 0, [[0, '#566257'], [0.5, '#6d7a6c'], [1, '#4c574e']]);
    d += lin(p + '-tbl', 0, 0, 0, 1, [[0, '#4a3b30'], [1, '#6a5443']]);
    d += rad(p + '-scr', 0.5, 0.5, 0.5, [[0, '#dfe8ee', 0.45], [1, '#dfe8ee', 0]]);
    d += blurF(p + '-b8', 8) + blurF(p + '-b20', 20);

    // 房间
    s += Q(P, [[XL, YC, 0.3], [XR, YC, 0.3], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-ceil)');
    s += Q(P, [[XL, 0, 0.3], [XL, YC, 0.3], [XL, YC, ZB], [XL, 0, ZB]], 'url(#' + p + '-lw)');
    s += Q(P, [[XR, 0, 0.3], [XR, YC, 0.3], [XR, YC, ZB], [XR, 0, ZB]], 'url(#' + p + '-rw)');
    s += Q(P, [[XL, 0, 0.3], [XR, 0, 0.3], [XR, 0, ZB], [XL, 0, ZB]], 'url(#' + p + '-fl)');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-bw)');
    // 踢脚线
    s += '<path d="' + segs([[P(XL, 0.05, 0.5), P(XL, 0.05, ZB)], [P(XL, 0.05, ZB), P(XR, 0.05, ZB)], [P(XR, 0.05, ZB), P(XR, 0.05, 0.5)]]) + '" stroke="#15191a" stroke-width="5"/>';
    // 吊顶格栅
    var L = [];
    for (var gx = XL + 0.6; gx < XR; gx += 0.6) L.push([P(gx, YC, 0.9), P(gx, YC, ZB)]);
    for (var gz = 1.2; gz < ZB; gz += 0.6) L.push([P(XL, YC, gz), P(XR, YC, gz)]);
    s += '<path d="' + segs(L) + '" stroke="#101313" stroke-width="1.5" opacity=".55"/>';
    [[-1.8, 3.0], [1.2, 3.0], [-1.8, 5.4], [1.2, 5.4], [-1.8, 7.2], [1.2, 7.2]].forEach(function (l) {
      s += Q(P, [[l[0], YC, l[1]], [l[0] + 0.6, YC, l[1]], [l[0] + 0.6, YC, l[1] + 0.6], [l[0], YC, l[1] + 0.6]], fog('#6c7470', l[1]));
    });

    // 左墙：装框的报纸头版
    [2.6, 4.1, 5.6].forEach(function (z) {
      s += Q(P, [[XL, 1.15, z], [XL, 1.15, z + 1.0], [XL, 2.35, z + 1.0], [XL, 2.35, z]], '#16191a');
      s += Q(P, [[XL, 1.21, z + 0.06], [XL, 1.21, z + 0.94], [XL, 2.29, z + 0.94], [XL, 2.29, z + 0.06]], fog('#bdb7a4', z));
      s += Q(P, [[XL, 2.1, z + 0.12], [XL, 2.1, z + 0.6], [XL, 2.23, z + 0.6], [XL, 2.23, z + 0.12]], fog('#7a2c24', z));
      var tl = [];
      for (j = 0; j < 6; j++) tl.push([P(XL, 1.95 - j * 0.1, z + 0.12), P(XL, 1.95 - j * 0.1, z + 0.88)]);
      s += '<path d="' + segs(tl) + '" stroke="' + fog('#6b675c', z) + '" stroke-width="2"/>';
      s += Q(P, [[XL, 1.3, z + 0.5], [XL, 1.3, z + 0.88], [XL, 1.62, z + 0.88], [XL, 1.62, z + 0.5]], fog('#77746a', z));
    });

    // 右墙：三扇窗，窗帘半拉
    var beams = '', fpat = '', tpat = '', D = [-1, -0.42, -0.22];
    [[1.6, [[1.6, 2.05], [2.7, 3.0]]], [3.7, [[3.7, 4.3], [4.85, 5.1]]], [5.8, [[5.8, 6.15], [6.55, 7.0]]]].forEach(function (w) {
      var z0 = w[0], z1 = z0 + 1.4, y0 = 0.8, y1 = 2.55;
      s += Q(P, [[XR, y0 - 0.1, z0 - 0.08], [XR, y0 - 0.1, z1 + 0.08], [XR, y1 + 0.08, z1 + 0.08], [XR, y1 + 0.08, z0 - 0.08]], '#121515');
      s += Q(P, [[XR, y0, z0], [XR, y0, z1], [XR, y1, z1], [XR, y1, z0]], 'url(#' + p + '-win)');
      // 窗外：对面楼的剪影
      s += Q(P, [[XR, y0, z0], [XR, y0, z1], [XR, 1.6, z1], [XR, 1.9, z0 + 0.6], [XR, 1.9, z0]], '#c4c7bb', 'opacity=".7"');
      // 窗帘（留出缝隙 = 光）
      var cz = z0 - 0.15;
      w[1].concat([[z1 + 0.15, z1 + 0.15]]).forEach(function (g) {
        if (g[0] > cz) {
          s += Q(P, [[XR - 0.02, y0 - 0.25, cz], [XR - 0.02, y0 - 0.25, g[0]], [XR - 0.02, y1 + 0.3, g[0]], [XR - 0.02, y1 + 0.3, cz]], 'url(#' + p + '-cur)');
          var fl = [];
          for (var fz = cz + 0.09; fz < g[0] - 0.03; fz += 0.11) fl.push([P(XR - 0.02, y0 - 0.25, fz), P(XR - 0.02, y1 + 0.3, fz)]);
          s += '<path d="' + segs(fl) + '" stroke="#2a312c" stroke-width="2" opacity=".6"/>';
        }
        if (g[1] > g[0]) {
          var W = [[XR, y0, g[0]], [XR, y0, g[1]], [XR, y1, g[1]], [XR, y1, g[0]]];
          var F = W.map(function (q) { var t = q[1] / -D[1]; return [q[0] + t * D[0], 0, q[2] + t * D[2]]; });
          fpat += Q(P, F, '#f3e2b8', 'opacity=".13"');
          beams += poly(hull(W.concat(F).map(function (q) { return P(q[0], q[1], q[2]); })), 'url(#' + p + '-beam)');
          var T = W.map(function (q) { var t = (q[1] - TY - 0.02) / -D[1]; return [q[0] + t * D[0], TY + 0.02, q[2] + t * D[2]]; });
          T = clipAx(clipAx(T, 0, 1.2, false), 0, -1.2, true);
          if (T.length > 2) tpat += Q(P, T, '#ffe7b0', 'opacity=".28"');
        }
        cz = g[1];
      });
      s += Q(P, [[XR - 0.05, y1 + 0.3, z0 - 0.3], [XR - 0.05, y1 + 0.3, z1 + 0.3], [XR - 0.05, y1 + 0.36, z1 + 0.3], [XR - 0.05, y1 + 0.36, z0 - 0.3]], '#1b1f1e');
    });
    s += fpat;

    // 后墙：投影幕、白板、挂钟、盆栽
    var k = 820 / ZB, sc0 = P(-1.35, 2.6, ZB), sc1 = P(1.35, 0.95, ZB);
    s += '<ellipse cx="800" cy="' + r0((sc0[1] + sc1[1]) / 2) + '" rx="260" ry="150" fill="url(#' + p + '-scr)"/>';
    s += rect(sc0[0] - 8, sc0[1] - 12, sc1[0] - sc0[0] + 16, 12, '#202423');
    s += rect(sc0[0], sc0[1], sc1[0] - sc0[0], sc1[1] - sc0[1], '#dfe6ea');
    // 投影内容：报纸版面
    var sw = sc1[0] - sc0[0], sh = sc1[1] - sc0[1], ox = sc0[0], oy = sc0[1], pg = '';
    pg += rect(ox + sw * 0.12, oy + 8, sw * 0.76, sh - 14, '#f2f0e6');
    pg += '<text x="' + r0(ox + sw * 0.16) + '" y="' + r0(oy + 34) + '" font-family="' + FONT + '" font-size="24" font-weight="bold" fill="#7a2a22">晨星报</text>';
    pg += rect(ox + sw * 0.16, oy + 42, sw * 0.68, 2, '#555');
    pg += rect(ox + sw * 0.16, oy + 50, sw * 0.44, 12, '#2e3236');
    pg += rect(ox + sw * 0.62, oy + 50, sw * 0.22, 48, '#8b9197');
    var tl2 = '';
    for (j = 0; j < 8; j++) tl2 += 'M' + r0(ox + sw * 0.16) + ' ' + r0(oy + 70 + j * 9) + 'h' + r0(sw * (0.3 + (j % 3) * 0.04));
    for (j = 0; j < 4; j++) tl2 += 'M' + r0(ox + sw * 0.62) + ' ' + r0(oy + 108 + j * 9) + 'h' + r0(sw * 0.22);
    pg += '<path d="' + tl2 + '" stroke="#7d8388" stroke-width="3"/>';
    s += pg + rect(sc0[0], sc0[1], sw, sh, '#b9d0e4', 'opacity=".18"');
    // 白板
    var wb0 = P(-3.9, 2.25, ZB), wb1 = P(-1.75, 1.0, ZB);
    s += rect(wb0[0] - 5, wb0[1] - 5, wb1[0] - wb0[0] + 10, wb1[1] - wb0[1] + 10, '#8c918e');
    s += rect(wb0[0], wb0[1], wb1[0] - wb0[0], wb1[1] - wb0[1], '#c9cdc7');
    s += rect(wb0[0], wb1[1], wb1[0] - wb0[0], 5, '#6f7471');
    var mk = '', ww = wb1[0] - wb0[0];
    s += '<text x="' + r0(wb0[0] + 12) + '" y="' + r0(wb0[1] + 26) + '" font-family="' + FONT + '" font-size="19" fill="#2c4a8a">本周选题</text>';
    for (j = 0; j < 5; j++) {
      var yy = wb0[1] + 44 + j * 17, xx = wb0[0] + 14;
      mk += 'M' + r0(xx) + ' ' + r0(yy) + 'h5';
      var len = 50 + R() * 70;
      mk += 'M' + r0(xx + 12) + ' ' + r0(yy);
      for (var q = 0; q < len; q += 6) mk += 'l3 ' + r1(-1.5 + R() * 3) + 'l3 ' + r1(-1.5 + R() * 3);
    }
    s += '<path d="' + mk + '" stroke="#34518e" stroke-width="1.8" fill="none"/>';
    s += '<ellipse cx="' + r0(wb0[0] + ww * 0.72) + '" cy="' + r0(wb0[1] + 60) + '" rx="30" ry="18" fill="none" stroke="#a8322a" stroke-width="2"/>';
    s += '<path d="M' + r0(wb0[0] + ww * 0.55) + ' ' + r0(wb0[1] + 64) + 'l18 -2M' + r0(wb0[0] + ww * 0.72) + ' ' + r0(wb0[1] + 80) + 'l-6 24l14 -8" stroke="#a8322a" stroke-width="2" fill="none"/>';
    var ck = P(2.5, 2.3, ZB);
    s += '<circle cx="' + r0(ck[0]) + '" cy="' + r0(ck[1]) + '" r="' + r0(k * 0.17) + '" fill="#cfcfc4" stroke="#1e2221" stroke-width="3"/>';
    s += '<path d="M' + r0(ck[0]) + ' ' + r0(ck[1]) + 'l0 -11M' + r0(ck[0]) + ' ' + r0(ck[1]) + 'l9 4" stroke="#1e2221" stroke-width="2"/>';
    // 盆栽（后右角）
    var pt = P(3.7, 0, 8.0), pk = 820 / 8.0;
    s += '<path d="M' + r0(pt[0] - pk * 0.2) + ' ' + r0(pt[1] - pk * 0.45) + 'h' + r0(pk * 0.4) + 'l' + r0(-pk * 0.05) + ' ' + r0(pk * 0.45) + 'h' + r0(-pk * 0.3) + 'z" fill="#3b3430"/>';
    var lv = '';
    for (j = 0; j < 14; j++) {
      var a = -Math.PI / 2 + (R() - 0.5) * 2.4, ln = pk * (0.5 + R() * 0.7), bx = pt[0], by = pt[1] - pk * 0.45;
      var ex = bx + Math.cos(a) * ln, ey = by + Math.sin(a) * ln;
      lv += 'M' + r0(bx) + ' ' + r0(by) + 'Q' + r0((bx + ex) / 2 + (R() - 0.5) * 30) + ' ' + r0((by + ey) / 2) + ' ' + r0(ex) + ' ' + r0(ey);
    }
    s += '<path d="' + lv + '" stroke="#2f3d31" stroke-width="7" stroke-linecap="round" fill="none"/>';

    // 长桌（深色木）
    var tz0 = 2.5, tz1 = 7.5;
    s += Q(P, [[-1.35, 0, tz0 - 0.2], [1.35, 0, tz0 - 0.2], [1.35, 0, tz1 + 0.2], [-1.35, 0, tz1 + 0.2]], '#07090a', 'opacity=".5"');
    s += box(P, -0.55, 0.55, 0, 0.7, tz0 + 0.6, tz1 - 0.6, { front: '#0d0b0a', side: '#0a0908' });
    // 椅子（先画远侧与两侧）
    function chair(cx, cz, side) {
      var o = '', bx = side < 0 ? cx - 0.26 : cx + 0.2;
      o += box(P, cx - 0.03, cx + 0.03, 0.06, 0.44, cz - 0.03, cz + 0.03, { front: '#0e1011', side: '#0e1011' });
      o += box(P, cx - 0.25, cx + 0.25, 0.44, 0.52, cz - 0.25, cz + 0.25, { front: fog('#17191a', cz), top: fog('#2a2d2e', cz), side: fog('#131516', cz) });
      o += box(P, bx, bx + 0.06, 0.55, 1.2, cz - 0.23, cz + 0.23, { front: fog('#141617', cz), top: fog('#303435', cz), side: fog(side < 0 ? '#2a2e2f' : '#1d2021', cz) });
      return o;
    }
    for (var cz = 7.0; cz >= 3.0; cz -= 1.0) { s += chair(-1.6, cz, -1) + chair(1.6, cz, 1); }
    s += box(P, -1.2, 1.2, TY - 0.06, TY, tz0, tz1, { front: '#2a211b', top: 'url(#' + p + '-tbl)', side: '#211a15' });
    // 桌面反光（投影幕与窗）
    s += Q(P, [[-0.5, TY + 0.001, tz1 - 2.2], [0.5, TY + 0.001, tz1 - 2.2], [0.7, TY + 0.001, tz1], [-0.7, TY + 0.001, tz1]], '#dfe8ee', 'opacity=".12"');
    s += tpat;
    // 桌上：报纸、稿纸、茶杯、烟灰缸
    var items = '';
    for (j = 0; j < 11; j++) {
      var sd = j % 2 ? 1 : -1, zc = tz0 + 0.5 + (j / 11) * (tz1 - tz0 - 0.9) + R() * 0.2;
      var big = R() < 0.45;
      items += Q(P, flat(sd * (0.72 + R() * 0.15), zc, big ? 0.55 : 0.24, big ? 0.4 : 0.32, (R() - 0.5) * 0.6, TY + 0.003), fog(big ? '#b8b4a6' : '#d9d4c2', zc));
      if (big) items += Q(P, flat(sd * 0.8, zc - 0.05, 0.4, 0.05, 0, TY + 0.004), '#5a574f', 'opacity=".5"');
    }
    s += items;
    [[-0.85, 3.3], [0.9, 4.5], [-0.9, 5.6], [0.82, 6.6], [-0.3, 3.1]].forEach(function (m) {
      var b = P(m[0], TY, m[1]), t = P(m[0], TY + 0.1, m[1]), mw = 820 * 0.045 / m[1];
      s += rect(b[0] - mw, t[1], mw * 2, b[1] - t[1], fog('#d6d2c6', m[1])) + '<ellipse cx="' + r0(b[0]) + '" cy="' + r0(t[1]) + '" rx="' + r1(mw) + '" ry="' + r1(mw * 0.3) + '" fill="' + fog('#6b5a45', m[1]) + '"/>';
    });
    var ash = P(0.25, TY, 3.4);
    s += '<ellipse cx="' + r0(ash[0]) + '" cy="' + r0(ash[1]) + '" rx="22" ry="6" fill="#8d9aa0" opacity=".8"/>';
    // 投影仪 + 光束
    s += box(P, -0.18, 0.18, TY, TY + 0.12, 4.0, 4.34, { front: '#b9b8b0', top: '#d7d6cf', side: '#8e8d86' });
    var lens = P(0, TY + 0.07, 4.36), beam = [lens, P(-1.35, 2.6, ZB), P(1.35, 2.6, ZB), P(1.35, 0.95, ZB), P(-1.35, 0.95, ZB)];
    s += '<g class="' + p + '-pj">' + poly(hull(beam), 'url(#' + p + '-proj)') + '</g>';
    s += '<circle cx="' + r0(lens[0]) + '" cy="' + r0(lens[1]) + '" r="10" fill="#eef4f8" filter="url(#' + p + '-b8)"/>';
    // 光中浮尘
    var dust = '';
    for (i = 0; i < 26; i++) {
      var tz = 4.6 + R() * 3.6, tt = (tz - 4.36) / (ZB - 4.36), dp = P((R() - 0.5) * 2.4 * tt, TY + 0.07 + (0.9 + R() * 1.4) * tt, tz);
      dust += '<circle cx="' + r0(dp[0]) + '" cy="' + r0(dp[1]) + '" r="' + r1(0.6 + R()) + '"/>';
    }
    s += '<g class="' + p + '-dust" fill="#eef4f8" opacity=".5">' + dust + '</g>';
    s += '<g class="' + p + '-bm">' + beams + '</g>';

    var css = '<style>.' + p + '-dust{animation:' + p + '-dr 16s ease-in-out infinite alternate}' +
      '.' + p + '-pj{animation:' + p + '-fl 5s steps(2) infinite}.' + p + '-bm{animation:' + p + '-br 11s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-dr{to{transform:translate(-18px,-10px)}}@keyframes ' + p + '-fl{0%,100%{opacity:1}50%{opacity:.92}}' +
      '@keyframes ' + p + '-br{from{opacity:.75}to{opacity:1}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.65));
  };

  /* =====================================================================
   * office_window：报社高层走廊尽头的落地钢化玻璃窗，黄昏，俯瞰外滩车流
   * ===================================================================== */
  GF.art.bg.office_window = function () {
    var p = 'bgow', R = U.rng(3313), i, j;
    var WX0 = 250, WX1 = 1350, WY0 = 40, WY1 = 820, HZ = 222;
    var d = '', s = '', v = '';
    d += lin(p + '-sky', 0, WY0, 0, HZ, [[0, '#161a36'], [0.35, '#2f3158'], [0.7, '#7a5a72'], [0.9, '#c47e70'], [1, '#e8a070']], 1);
    d += lin(p + '-tw', 0, 50, 0, HZ, [[0, '#f6ba78'], [0.4, '#c67e5e'], [0.75, '#4e405a'], [1, '#262740']], 1);
    d += lin(p + '-riv', 0, HZ, 0, 335, [[0, '#7a6276'], [0.35, '#40405e'], [1, '#1e2238']], 1);
    d += lin(p + '-abyss', 0, 480, 0, WY1, [[0, '#141622'], [1, '#050609']], 1);
    d += lin(p + '-fac', 0, 460, 0, WY1, [[0, '#262434'], [1, '#07080c']], 1);
    d += lin(p + '-lw', 0, 0, WX0, 0, [[0, '#07080c'], [0.8, '#191a24'], [1, '#3a2c2c']], 1);
    d += lin(p + '-rw', 1600, 0, WX1, 0, [[0, '#07080c'], [0.8, '#191a24'], [1, '#3a2c2c']], 1);
    d += lin(p + '-fl', 0, 820, 0, 900, [[0, '#4a3634'], [1, '#0c0d12']], 1);
    d += lin(p + '-flr', 0, 0, 0, 1, [[0, '#e0946a', 0.5], [1, '#e0946a', 0]]);
    d += lin(p + '-glass', 0, 0, 1, 1, [[0, '#ffffff', 0], [0.45, '#ffffff', 0], [0.5, '#dfe6ff', 0.07], [0.56, '#ffffff', 0], [1, '#ffffff', 0]]);
    d += rad(p + '-sun', 0.5, 1, 0.8, [[0, '#ffb070', 0.5], [1, '#ffb070', 0]]);
    d += rad(p + '-pool', 0.5, 0.5, 0.5, [[0, '#f0a040', 0.4], [1, '#f0a040', 0]]);
    d += blurF(p + '-b3', 3) + blurF(p + '-b10', 10);
    d += '<clipPath id="' + p + '-wc"><rect x="' + WX0 + '" y="' + WY0 + '" width="' + (WX1 - WX0) + '" height="' + (WY1 - WY0) + '"/></clipPath>';

    // ---------- 窗外 ----------
    v += rect(WX0, WY0, WX1 - WX0, HZ - WY0 + 2, 'url(#' + p + '-sky)');
    v += '<ellipse cx="800" cy="' + HZ + '" rx="760" ry="90" fill="url(#' + p + '-sun)"/>';
    // 远层天际线（冷、淡）
    var far = 'M' + WX0 + ' ' + HZ, x = WX0;
    while (x < WX1) { var w = 12 + R() * 22; far += 'V' + r0(HZ - 6 - R() * 26) + 'H' + r0(x + w); x += w; }
    v += '<path d="' + far + 'V' + HZ + 'Z" fill="#5a4a64" opacity=".8"/>';
    // 近层楼群：顶部被夕照染橙
    var tw = '', side = '', wl = '', refl = '';
    x = WX0 - 10;
    while (x < WX1) {
      var bw = 20 + R() * 38, bh = 22 + R() * (R() < 0.25 ? 120 : 55);
      if (x > 520 && x < 610) { x = 612; continue; }
      if (x > 860 && x < 940) { x = 942; continue; }
      tw += rect(x, HZ - bh, bw, bh + 4, 'url(#' + p + '-tw)');
      side += rect(x + bw * 0.72, HZ - bh, bw * 0.28, bh + 4, '#1a1a30', 'opacity=".55"');
      for (j = 0; j < bh / 7 - 1; j++) for (var c = 0; c < 3; c++) if (R() < 0.3) wl += 'M' + r0(x + 4 + c * bw * 0.22) + ' ' + r0(HZ - bh + 6 + j * 7) + 'h3';
      if (bh > 50) refl += 'M' + r0(x + bw / 2) + ' ' + (HZ + 4) + 'v' + r0(bh * 0.8);
      x += bw + 2 + R() * 8;
    }
    v += tw + side;
    // 东方明珠
    var px = 566;
    v += '<g fill="url(#' + p + '-tw)"><path d="M' + (px - 30) + ' ' + HZ + 'L' + (px - 5) + ' 160h10L' + (px + 30) + ' ' + HZ + 'h-7L' + px + ' 170 ' + (px - 23) + ' ' + HZ + 'z"/>' +
      rect(px - 5, 84, 10, 80) + rect(px - 3, 60, 6, 30) + rect(px - 1.5, 26, 3, 40) + '</g>';
    v += '<circle cx="' + px + '" cy="160" r="21" fill="#a8505e"/><circle cx="' + (px - 6) + '" cy="154" r="11" fill="#f2a88e" opacity=".7"/>';
    v += '<circle cx="' + px + '" cy="96" r="13" fill="#b85a68"/><circle cx="' + (px - 4) + '" cy="92" r="6" fill="#f6b698" opacity=".75"/>';
    v += '<circle cx="' + px + '" cy="64" r="5.5" fill="#c8687a"/>';
    // 金茂
    var jx = 900;
    v += '<path d="M' + (jx - 22) + ' ' + HZ + 'V140l4-10V112l4-8V88l3-6V68l3-6V50l4-10 4 10v12l3 6v14l3 6v16l4 8v18l4 10V' + HZ + 'z" fill="url(#' + p + '-tw)"/>';
    v += '<path d="M' + (jx + 4) + ' ' + HZ + 'V58l4 4v14l3 6v16l3 6v18l4 8v18l4 10V' + HZ + 'z" fill="#1a1a30" opacity=".5"/>';
    v += '<path d="' + wl + '" stroke="#ffc878" stroke-width="2" opacity=".75"/>';
    // 江面
    v += rect(WX0, HZ, WX1 - WX0, 116, 'url(#' + p + '-riv)');
    v += '<path d="' + refl + '" stroke="#e8a070" stroke-width="5" stroke-dasharray="7 5" opacity=".22"/>';
    v += '<path d="M' + (px - 10) + ' ' + (HZ + 4) + 'v80M' + (px + 8) + ' ' + (HZ + 10) + 'v50" stroke="#d07080" stroke-width="7" stroke-dasharray="10 6" opacity=".28"/>';
    var wv = '';
    for (i = 0; i < 40; i++) { var yy = HZ + 6 + R() * 104, xx = WX0 + R() * 1100, ww = 10 + (yy - HZ) * 0.35 * R(); wv += 'M' + r0(xx) + ' ' + r0(yy) + 'h' + r0(ww); }
    v += '<path d="' + wv + '" stroke="#b08894" stroke-width="1.5" opacity=".35"/>';
    // 船与尾迹
    [[690, 268, 1], [1120, 306, -1], [400, 246, 1]].forEach(function (b, bi) {
      var sc = 0.6 + (b[1] - HZ) / 110;
      v += '<path d="M' + b[0] + ' ' + b[1] + 'l' + r0(-b[2] * 60 * sc) + ' ' + r0(-6 * sc) + 'M' + b[0] + ' ' + b[1] + 'l' + r0(-b[2] * 60 * sc) + ' ' + r0(5 * sc) + '" stroke="#9a8aa0" stroke-width="1.2" opacity=".5"/>';
      v += rect(b[0] - 14 * sc, b[1] - 3 * sc, 28 * sc, 6 * sc, '#15172a') + rect(b[0] - 4 * sc, b[1] - 7 * sc, 8 * sc, 4 * sc, '#15172a');
      v += '<circle cx="' + b[0] + '" cy="' + r0(b[1] - 5 * sc) + '" r="' + r1(1.6 * sc) + '" fill="#ffd28a"/>';
    });
    // 外滩防汛墙与步道
    v += rect(WX0, 338, WX1 - WX0, 20, '#3a3448') + rect(WX0, 338, WX1 - WX0, 3, '#9a7a7c');
    var lp = '', pd = '';
    for (x = WX0 + 20; x < WX1; x += 46) { lp += '<circle cx="' + x + '" cy="345" r="2.2"/>'; }
    for (i = 0; i < 26; i++) pd += rect(WX0 + R() * 1100, 348 + R() * 5, 2, 4, '#0c0c14');
    v += '<g fill="#ffcb7a">' + lp + '</g><g filter="url(#' + p + '-b3)" fill="#f0a040" opacity=".8">' + lp + '</g>' + pd;
    // 中山东一路：路面、车道线、路灯光池、车灯流
    function road(y) { return 'M' + WX0 + ' ' + r0(y) + 'Q800 ' + r0(y + 16) + ' ' + WX1 + ' ' + r0(y); }
    v += '<path d="' + road(361) + 'V' + 482 + 'Q800 498 ' + WX0 + ' 482Z" fill="#14141d"/>';
    var lanes = '';
    for (i = 0; i < 9; i++) lanes += road(368 + i * 12.5);
    v += '<path d="' + lanes + '" stroke="#34343f" stroke-width="1.2" stroke-dasharray="14 18" fill="none"/>';
    v += '<path d="' + road(418) + road(420) + '" stroke="#a08a50" stroke-width="1.2" fill="none" opacity=".6"/>';
    var pools = '';
    for (x = WX0 + 40; x < WX1; x += 125) {
      pools += '<ellipse cx="' + x + '" cy="' + r0(366 + 10 * Math.sin((x - WX0) / 1100 * Math.PI)) + '" rx="60" ry="12"/>';
      pools += '<ellipse cx="' + (x + 62) + '" cy="' + r0(476 + 13 * Math.sin((x + 62 - WX0) / 1100 * Math.PI)) + '" rx="66" ry="14"/>';
    }
    v += '<g fill="url(#' + p + '-pool)">' + pools + '</g>';
    var cars = '';
    for (i = 0; i < 8; i++) {
      var y = i < 4 ? 373 + i * 11.5 : 428 + (i - 4) * 12.5, col = i < 4 ? '#ff5a44' : '#fff0cc', da = '';
      for (j = 0; j < 6; j++) da += r0(5 + R() * 12) + ' ' + r0(30 + R() * 110) + ' ';
      var st = 'style="animation:' + p + (i < 4 ? '-mr ' : '-mw ') + r1(8 + R() * 7) + 's linear ' + r1(-R() * 10) + 's infinite"';
      cars += '<path d="' + road(y) + '" stroke="' + col + '" stroke-width="' + r1(2 + (i % 4) * 0.35) + '" stroke-dasharray="' + da.trim() + '" ' + st + '/>';
    }
    v += '<g fill="none" filter="url(#' + p + '-b3)" opacity=".9" stroke-linecap="round">' + cars + '</g><g fill="none" stroke-linecap="round">' + cars + '</g>';
    // 近侧人行道 + 行道树（俯视）
    v += '<path d="M' + WX0 + ' 486Q800 504 ' + WX1 + ' 486V' + WY1 + 'H' + WX0 + 'Z" fill="url(#' + p + '-abyss)"/>';
    var tr = '', trl = '';
    for (x = WX0 + 10; x < WX1; x += 64 + R() * 20) {
      var ty = 510 + 10 * Math.sin((x - WX0) / 1100 * Math.PI), tr0 = 20 + R() * 8;
      tr += '<circle cx="' + r0(x) + '" cy="' + r0(ty) + '" r="' + r0(tr0) + '"/>';
      trl += '<circle cx="' + r0(x - 4) + '" cy="' + r0(ty - 6) + '" r="' + r0(tr0 * 0.55) + '"/>';
    }
    v += '<g fill="#0e1719">' + tr + '</g><g fill="#26342f" opacity=".75">' + trl + '</g>';
    // 更下方：楼脚的深渊，几点路灯
    var deep = '';
    for (i = 0; i < 9; i++) deep += '<circle cx="' + r0(360 + R() * 880) + '" cy="' + r0(560 + R() * 180) + '" r="' + r1(1.2 + R() * 1.5) + '"/>';
    v += '<g fill="#f0a040" opacity=".7">' + deep + '</g>';
    // 两侧邻楼立面：竖线向下汇聚（三点透视，眩晕）
    var VX = 800, VY = 2300;
    function conv(x0, y0, y1) { return x0 + (VX - x0) * (y1 - y0) / (VY - y0); }
    [[WX0 - 40, 440, 0.18], [WX1 + 40, 1160, 0.18]].forEach(function (b, bi) {
      var xo = b[0], xi = b[1], y0 = bi ? 452 : 470;
      var face = [[xo, y0], [xi, y0 + 18], [conv(xi, y0 + 18, WY1), WY1], [xo, WY1]];
      v += poly(face, 'url(#' + p + '-fac)');
      v += poly([[xo, y0 - 14], [xi, y0 + 4], [xi, y0 + 18], [xo, y0]], '#4a3c48');
      var fl = '', lit = '';
      for (var k = 0; k < 7; k++) {
        var yk = y0 + 30 + k * (30 - k * 2);
        var xa = bi ? conv(xi, y0 + 18, yk) : xo, xb = bi ? xo : conv(xi, y0 + 18, yk);
        fl += 'M' + r0(Math.min(xa, xb)) + ' ' + r0(yk) + 'H' + r0(Math.max(xa, xb));
        for (var m = 0; m < 5; m++) if (R() < 0.35) {
          var tt = (m + 0.3) / 5, lx = xo + (conv(xi, y0 + 18, yk) - xo) * tt;
          lit += rect(lx, yk - 14 + k * 1.2, 10 - k, 9 - k * 0.8, '#e8a860', 'opacity="' + r1(0.75 - k * 0.08) + '"');
        }
      }
      for (m = 1; m < 5; m++) {
        var tt2 = m / 5, xt = xo + (xi - xo) * tt2;
        fl += 'M' + r0(xt) + ' ' + r0(y0 + 18 * tt2) + 'L' + r0(conv(xt, y0 + 18 * tt2, WY1)) + ' ' + WY1;
      }
      v += '<path d="' + fl + '" stroke="#05060a" stroke-width="3" opacity=".7"/>' + lit;
    });
    s += '<g clip-path="url(#' + p + '-wc)"><g class="' + p + '-sw">' + v + '</g></g>';

    // ---------- 玻璃：反光与走廊灯的倒影 ----------
    s += rect(WX0, WY0, WX1 - WX0, WY1 - WY0, 'url(#' + p + '-glass)');
    s += '<path d="M' + (WX0 + 60) + ' ' + WY1 + 'L' + (WX0 + 380) + ' ' + WY0 + 'h40L' + (WX0 + 100) + ' ' + WY1 + 'z" fill="#cfd8ff" opacity=".035"/>';

    // ---------- 走廊 ----------
    s += poly([[0, 0], [1600, 0], [WX1, WY0], [WX0, WY0]], '#0b0c11');
    s += poly([[0, 0], [WX0, WY0], [WX0, WY1], [0, 900]], 'url(#' + p + '-lw)');
    s += poly([[1600, 0], [WX1, WY0], [WX1, WY1], [1600, 900]], 'url(#' + p + '-rw)');
    s += poly([[0, 900], [WX0, WY1], [WX1, WY1], [1600, 900]], 'url(#' + p + '-fl)');
    s += poly([[WX0, WY1], [WX1, WY1], [WX1 + 140, 900], [WX0 - 140, 900]], 'url(#' + p + '-flr)');
    // 天花灯槽
    s += poly([[640, 8], [960, 8], [935, 24], [665, 24]], '#3a3530') + poly([[690, 12], [910, 12], [898, 20], [702, 20]], '#8a7a66', 'opacity=".6"');
    // 左墙：一扇门框 + 安全出口指示灯
    s += poly([[60, 150], [175, 110], [175, 780], [60, 848]], '#07080b') + poly([[70, 160], [168, 125], [168, 772], [70, 838]], '#15161d');
    s += poly([[150, 440], [160, 437], [160, 470], [150, 474]], '#8a7060');
    s += poly([[92, 96], [150, 78], [150, 98], [92, 118]], '#2a8a4a') + poly([[92, 96], [150, 78], [150, 98], [92, 118]], '#50e080', 'filter="url(#' + p + '-b10)" opacity=".6"');
    // 右墙：消防栓箱
    s += poly([[1440, 470], [1520, 490], [1520, 640], [1440, 610]], '#5a1e1a') + poly([[1446, 480], [1514, 497], [1514, 630], [1446, 602]], '#7a2a24');
    // 窗框、竖梃、扶手
    var fr = '#07080c';
    s += rect(WX0 - 14, WY0 - 14, WX1 - WX0 + 28, 14, fr) + rect(WX0 - 14, WY1, WX1 - WX0 + 28, 12, fr);
    s += rect(WX0 - 14, WY0, 14, WY1 - WY0, fr) + rect(WX1, WY0, 14, WY1 - WY0, fr);
    [617, 983].forEach(function (mx) { s += rect(mx - 5, WY0, 10, WY1 - WY0, fr) + rect(mx - 5, WY0, 2, WY1 - WY0, '#8a5a48', 'opacity=".55"'); });
    s += rect(WX0 - 30, 590, WX1 - WX0 + 60, 9, '#1b1c24') + rect(WX0 - 30, 590, WX1 - WX0 + 60, 2, '#e0a070', 'opacity=".55"');
    [WX0 + 60, 617, 983, WX1 - 60].forEach(function (bx) { s += rect(bx - 3, 599, 6, 22, '#0c0d12'); });
    // 窗边缘的暖色溢光
    s += rect(WX0 - 2, WY0, 4, WY1 - WY0, '#f0a070', 'opacity=".5" filter="url(#' + p + '-b10)"') + rect(WX1 - 2, WY0, 4, WY1 - WY0, '#f0a070', 'opacity=".5" filter="url(#' + p + '-b10)"');

    var css = '<style>.' + p + '-sw{transform-origin:800px 300px;animation:' + p + '-sw 14s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-sw{from{transform:rotate(-.35deg) scale(1.005)}to{transform:rotate(.35deg) scale(1.025)}}' +
      '@keyframes ' + p + '-mr{to{stroke-dashoffset:-600}}@keyframes ' + p + '-mw{to{stroke-dashoffset:600}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.55));
  };

  /** 远处极小的路人剪影（脚底 x,y，身高 h 像素） */
  function walker(x, y, h, col, stride) {
    var u = h / 10, st = stride == null ? 0.6 : stride;
    return '<path d="M' + r1(x - 1.3 * u) + ' ' + r1(y - 8.3 * u) + 'q' + r1(1.3 * u) + ' ' + r1(-0.5 * u) + ' ' + r1(2.6 * u) + ' 0l' + r1(0.3 * u) + ' ' + r1(3.4 * u) +
      'h' + r1(-0.5 * u) + 'l' + r1((0.2 + st) * u) + ' ' + r1(4.9 * u) + 'h' + r1(-0.9 * u) + 'l' + r1(-(0.6 + st * 0.5) * u) + ' ' + r1(-3.6 * u) + 'l' + r1(-(0.4 + st * 0.5) * u) + ' ' + r1(3.6 * u) +
      'h' + r1(-0.9 * u) + 'l' + r1((0.2 + st * 0.3) * u) + ' ' + r1(-4.9 * u) + 'h' + r1(-0.5 * u) + 'z" fill="' + col + '"/>' +
      '<circle cx="' + r1(x) + '" cy="' + r1(y - 9.1 * u) + '" r="' + r1(0.85 * u) + '" fill="' + col + '"/>';
  }

  /* =====================================================================
   * library_hall：上海图书馆底楼大堂，石材地面，高挑中庭，上午的光
   * ===================================================================== */
  GF.art.bg.library_hall = function () {
    var p = 'bglh', P = cam(760, 760, 372, 1.6), R = U.rng(4409), i, j;
    var XL = -9, XR = 8, ZB = 26, YT = 20;
    var fog = fogger('#a9aba4', 4, 26, 0.5);
    var d = '', s = '';
    d += lin(p + '-sky', 0, 0, 0, 420, [[0, '#b7c6ca'], [0.6, '#dfe5de'], [1, '#f4efdf']], 1);
    d += lin(p + '-bw', 0, 0, 0, 420, [[0, '#6f716c'], [1, '#9a9890']], 1);
    d += lin(p + '-rw', 1600, 0, 990, 0, [[0, '#2c3136'], [1, '#6e706c']], 1);
    d += lin(p + '-fl', 0, 900, 0, 418, [[0, '#1f2222'], [0.5, '#4a4c4a'], [1, '#86857e']], 1);
    d += lin(p + '-beam', 0, 0, 1, 0, [[0, '#fff0cc', 0.36], [0.5, '#fff0cc', 0.14], [1, '#fff0cc', 0]]);
    d += lin(p + '-col', 0, 0, 1, 0, [[0, '#c9c4b4'], [0.35, '#8e8b82'], [1, '#2e3134']]);
    d += lin(p + '-colb', 0, 0, 1, 0, [[0, '#e8e2cc'], [0.12, '#4a4d50'], [1, '#1c1f22']]);
    d += lin(p + '-refl', 0, 0, 0, 1, [[0, '#f4ecd6', 0.28], [1, '#f4ecd6', 0]]);
    d += lin(p + '-ban', 0, 0, 0, 1, [[0, '#7a2a26'], [1, '#5a1e1c']]);
    d += blurF(p + '-b12', 12);

    // 地面 / 右墙 / 后墙
    s += Q(P, [[XL, 0, 0.5], [XR, 0, 0.5], [XR, 0, ZB], [XL, 0, ZB]], 'url(#' + p + '-fl)');
    s += Q(P, [[XR, 0, 0.5], [XR, YT, 0.5], [XR, YT, ZB], [XR, 0, ZB]], 'url(#' + p + '-rw)');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, YT, ZB], [XL, YT, ZB]], 'url(#' + p + '-bw)');
    // 后墙石材分格 + 高侧窗
    var L = [];
    for (var gx = XL + 1.5; gx < XR; gx += 1.5) L.push([P(gx, 0, ZB), P(gx, YT, ZB)]);
    for (var gy = 1.2; gy < YT; gy += 1.2) L.push([P(XL, gy, ZB), P(XR, gy, ZB)]);
    s += '<path d="' + segs(L) + '" stroke="#5b5c57" stroke-width="1.2" opacity=".6"/>';
    s += Q(P, [[XL, 11.2, ZB], [XR, 11.2, ZB], [XR, 12.8, ZB], [XL, 12.8, ZB]], '#e9ecdf');
    L = [];
    for (gx = XL + 0.75; gx < XR; gx += 0.75) L.push([P(gx, 11.2, ZB), P(gx, 12.8, ZB)]);
    s += '<path d="' + segs(L) + '" stroke="#5b605e" stroke-width="2"/>';
    // 馆名
    var tp = P(-1.3, 7.2, ZB);
    s += '<text x="' + r0(tp[0]) + '" y="' + r0(tp[1]) + '" font-family="' + FONT + '" font-size="46" fill="#3e3a30" text-anchor="middle" letter-spacing="9" opacity=".85">上海图书馆</text>';
    s += '<text x="' + r0(tp[0] - 2) + '" y="' + r0(tp[1] - 2) + '" font-family="' + FONT + '" font-size="46" fill="#c9a766" text-anchor="middle" letter-spacing="9">上海图书馆</text>';
    s += rect(tp[0] - 160, tp[1] + 16, 320, 2, '#b89a60', 'opacity=".7"');
    // 后墙入口（通往阅览区）
    s += Q(P, [[-5.5, 0, ZB], [-3.5, 0, ZB], [-3.5, 3.2, ZB], [-5.5, 3.2, ZB]], '#2c2f30');
    s += Q(P, [[2.2, 0, ZB], [4.2, 0, ZB], [4.2, 3.2, ZB], [2.2, 3.2, ZB]], '#2c2f30');
    s += Q(P, [[-5.3, 0, ZB], [-3.7, 0, ZB], [-3.7, 2.9, ZB], [-5.3, 2.9, ZB]], '#8e9690', 'opacity=".35"');

    // 右侧：两层回廊（楼板 + 玻璃栏板）
    [[5.4, 3.6], [10.6, 3.6]].forEach(function (m) {
      var y = m[0], x0 = m[1];
      s += Q(P, [[x0, y - 0.7, 1], [XR, y - 0.7, 1], [XR, y - 0.7, ZB], [x0, y - 0.7, ZB]], fog('#55575a', 12));
      s += Q(P, [[x0, y - 0.7, 1], [x0, y - 0.7, ZB], [x0, y, ZB], [x0, y, 1]], '#c9c3b0');
      s += Q(P, [[x0, y, 1], [x0, y, ZB], [x0, y + 1.1, ZB], [x0, y + 1.1, 1]], '#cfe0dc', 'opacity=".18"');
      s += '<path d="' + segs([[P(x0, y + 1.1, 1), P(x0, y + 1.1, ZB)]]) + '" stroke="#d8d2c0" stroke-width="3"/>';
      var bl = [];
      for (var z = 2; z < ZB; z += 1.4) bl.push([P(x0, y, z), P(x0, y + 1.1, z)]);
      s += '<path d="' + segs(bl) + '" stroke="#9aa39f" stroke-width="1.5" opacity=".6"/>';
      // 回廊后面的书架/办公室暗影
      var sh = '';
      for (z = 6; z < ZB; z += 3.2) sh += Q(P, [[XR, y + 0.2, z], [XR, y + 0.2, z + 2.6], [XR, y + 3.8, z + 2.6], [XR, y + 3.8, z]], '#23272b', 'opacity=".55"');
      s += sh;
    });
    // 右墙底层：展板、门洞、长椅
    s += Q(P, [[XR, 0, 10.6], [XR, 0, 12.6], [XR, 3.0, 12.6], [XR, 3.0, 10.6]], '#15181b');
    s += Q(P, [[XR, 0, 10.8], [XR, 0, 12.4], [XR, 2.8, 12.4], [XR, 2.8, 10.8]], '#6a6454', 'opacity=".4"');
    [[4.2, '#8a6a44'], [5.8, '#4f6a6e'], [7.4, '#7a3a30'], [14.0, '#6e6a5a'], [15.6, '#4a5a6a'], [17.2, '#8a7650']].forEach(function (q) {
      var z = q[0];
      s += Q(P, [[XR - 0.05, 0.9, z], [XR - 0.05, 0.9, z + 1.3], [XR - 0.05, 2.7, z + 1.3], [XR - 0.05, 2.7, z]], '#d9d3c1');
      s += Q(P, [[XR - 0.06, 1.55, z + 0.1], [XR - 0.06, 1.55, z + 1.2], [XR - 0.06, 2.6, z + 1.2], [XR - 0.06, 2.6, z + 0.1]], fog(q[1], z));
      var tl = [];
      for (j = 0; j < 4; j++) tl.push([P(XR - 0.06, 1.4 - j * 0.12, z + 0.1), P(XR - 0.06, 1.4 - j * 0.12, z + 0.9 + (j % 2) * 0.2)]);
      s += '<path d="' + segs(tl) + '" stroke="#6a665c" stroke-width="1.5"/>';
      s += Q(P, [[XR - 0.05, 0, z + 0.6], [XR - 0.05, 0, z + 0.7], [XR - 0.05, 0.9, z + 0.7], [XR - 0.05, 0.9, z + 0.6]], '#2a2c2e');
    });
    s += box(P, 6.6, 7.4, 0.38, 0.46, 8.4, 10.2, { top: '#8a8272', side: '#3a3632', front: '#2e2b28' });
    s += box(P, 6.7, 6.8, 0, 0.38, 8.5, 8.6, { side: '#1a1a1a', front: '#1a1a1a' }) + box(P, 6.7, 6.8, 0, 0.38, 10.0, 10.1, { side: '#1a1a1a', front: '#1a1a1a' });
    // 扶梯
    s += Q(P, [[3.9, 0, 14], [5.3, 0, 14], [5.3, 4.7, 22], [3.9, 4.7, 22]], '#2a2d30');
    s += Q(P, [[3.9, 0, 14], [3.9, 4.7, 22], [3.9, 5.7, 22], [3.9, 1.0, 14]], '#cfe0dc', 'opacity=".3"');
    s += '<path d="' + segs([[P(3.9, 1.0, 14), P(3.9, 5.7, 22)], [P(3.9, 0, 14), P(3.9, 4.7, 22)]]) + '" stroke="#1b1d20" stroke-width="3"/>';

    // 左侧：整面玻璃幕墙，窗外梧桐
    var gw = [[XL, 0, 1.5], [XL, YT, 1.5], [XL, YT, ZB], [XL, 0, ZB]];
    d += '<clipPath id="' + p + '-gc">' + Q(P, gw, '#000') + '</clipPath>';
    var out = rect(0, -10, 520, 440, 'url(#' + p + '-sky)'), tr = '', tr2 = '';
    for (var z = 2; z < ZB; z += 0.9 + R() * 0.8) {
      var c = P(XL - 4, 5 + R() * 4, z + 3), rr = 760 * (2.2 + R() * 1.4) / (z + 3);
      tr += '<circle cx="' + r0(c[0]) + '" cy="' + r0(c[1]) + '" r="' + r0(rr) + '"/>';
      tr2 += '<circle cx="' + r0(c[0] + rr * 0.25) + '" cy="' + r0(c[1] - rr * 0.3) + '" r="' + r0(rr * 0.55) + '"/>';
    }
    out += '<g fill="#8e9c90">' + tr + '</g><g fill="#b2bdae">' + tr2 + '</g>';
    out += Q(P, [[XL - 4, 0, 1], [XL - 4, 4, 1], [XL - 4, 4, 40], [XL - 4, 0, 40]], '#9aa59c');
    s += '<g clip-path="url(#' + p + '-gc)">' + out + '</g>';
    // 幕墙竖梃/横档（近处粗、远处细）
    var mz = [], mzF = [], my = [];
    for (z = 1.5; z <= ZB; z += 1.6) (z < 8 ? mz : mzF).push([P(XL, 0, z), P(XL, YT, z)]);
    for (var y = 2.3; y < YT; y += 2.1) my.push([P(XL, y, 1.5), P(XL, y, ZB)]);
    s += '<path d="' + segs(mz) + '" stroke="#34393c" stroke-width="7"/>';
    s += '<path d="' + segs(mzF) + '" stroke="#3f4447" stroke-width="3"/>';
    s += '<path d="' + segs(my) + '" stroke="#3f4447" stroke-width="3"/>';
    s += Q(P, [[XL, 0, 1.5], [XL, 0.3, 1.5], [XL, 0.3, ZB], [XL, 0, ZB]], '#2b2f31');

    // 地砖接缝 + 幕墙在地面的倒影
    L = [];
    for (gx = -8.4; gx < XR; gx += 1.2) L.push([P(gx, 0, 1.2), P(gx, 0, ZB)]);
    for (var gz = 2.4; gz < ZB; gz += 1.2) L.push([P(XL, 0, gz), P(XR, 0, gz)]);
    s += '<path d="' + segs(L) + '" stroke="#141616" stroke-width="1.2" opacity=".35"/>';
    s += Q(P, [[XL, 0, 3], [XL + 2.5, 0, 3], [XL + 2.5, 0, ZB], [XL, 0, ZB]], '#f2eedf', 'opacity=".12"');

    // 阳光：地面光格 + 体积光
    var D = [1, -0.62, 0.34], pat = '', allW = [], allF = [];
    for (z = 1.5; z < ZB - 1.6; z += 1.6) {
      for (y = 0.3; y < 6.5; y += 2.1) {
        var W = [[XL, y + 0.08, z + 0.08], [XL, y + 0.08, z + 1.52], [XL, y + 2.02, z + 1.52], [XL, y + 2.02, z + 0.08]];
        var F = W.map(function (q) { var t = q[1] / -D[1]; return [q[0] + t * D[0], 0, q[2] + t * D[2]]; });
        if (F[0][2] < ZB && F[3][2] < ZB) pat += Q(P, F, '#fde8c0', 'opacity="' + r1(0.4 - z * 0.009) + '"');
      }
    }
    s += pat;
    [[3, 9], [9.4, 14.2], [15.8, 21]].forEach(function (zz) {
      var W = [[XL, 0.3, zz[0]], [XL, 0.3, zz[1]], [XL, 8.6, zz[1]], [XL, 8.6, zz[0]]];
      var F = W.map(function (q) { var t = q[1] / -D[1]; return [q[0] + t * D[0], 0, Math.min(ZB, q[2] + t * D[2])]; });
      s += '<g class="' + p + '-bm">' + poly(hull(W.concat(F).map(function (q) { return P(q[0], q[1], q[2]); })), 'url(#' + p + '-beam)') + '</g>';
    });

    // 服务台 + 远处路人
    s += box(P, -3.2, 2.2, 0, 1.1, 20.5, 21.3, { front: '#3b3a36', top: '#b6b0a0' });
    s += Q(P, [[-3.2, 0.95, 20.49], [2.2, 0.95, 20.49], [2.2, 1.02, 20.49], [-3.2, 1.02, 20.49]], '#c9a766');
    [[-4.4, 23.5, 0.5], [-1.6, 21.9, 0], [1.1, 22.1, 0.2], [-6.0, 24.5, 0.7]].forEach(function (w) {
      var f = P(w[0], 0, w[1]); s += walker(f[0], f[1], 760 * 1.68 / w[1], fog('#34373a', w[1] * 0.75), w[2]);
    });

    // 立柱：左侧逆光（映着幕墙），右侧受光
    [[-6.6, 21], [-6.6, 15], [-6.6, 9], [3.4, 19.5], [3.4, 13.5], [3.1, 7.2]].forEach(function (c) {
      var X = c[0], z = c[1], rr = 0.45, a = P(X - rr, 0, z), b = P(X + rr, YT, z);
      var left = X < 0;
      s += rect(a[0], b[1], b[0] - a[0], a[1] - b[1], left ? 'url(#' + p + '-colb)' : 'url(#' + p + '-col)');
      s += rect(a[0], a[1] - 760 * 0.25 / z, b[0] - a[0], 760 * 0.25 / z, left ? '#141618' : '#3a3c3c');
      s += rect(a[0] + (b[0] - a[0]) * 0.1, a[1], (b[0] - a[0]) * 0.8, 760 * 2.2 / z, 'url(#' + p + '-refl)', 'opacity="' + (left ? 0.25 : 0.5) + '"');
    });

    // 吊挂的讲座条幅
    [[4.4, 16.5, '讲座'], [4.4, 22.5, '展览']].forEach(function (b) {
      var t = P(b[0], 9.6, b[1]), bt = P(b[0] + 1.1, 5.9, b[1]);
      s += rect(t[0], t[1], bt[0] - t[0], bt[1] - t[1], 'url(#' + p + '-ban)');
      s += rect(t[0], t[1], bt[0] - t[0], 4, '#2a1c18');
      s += '<path d="M' + r0(t[0] + 3) + ' ' + r0(t[1]) + 'V0M' + r0(bt[0] - 3) + ' ' + r0(t[1]) + 'V0" stroke="#1c1e20" stroke-width="1.2" opacity=".7"/>';
      s += '<text x="' + r0((t[0] + bt[0]) / 2) + '" y="' + r0(t[1] + (bt[1] - t[1]) * 0.35) + '" font-family="' + FONT + '" font-size="' + r0((bt[0] - t[0]) * 0.42) + '" fill="#e8d4a8" text-anchor="middle" writing-mode="tb" letter-spacing="6">' + b[2] + '</text>';
    });

    // 光中浮尘
    var dust = '';
    for (i = 0; i < 36; i++) {
      var dp = P(-8 + R() * 8, 0.5 + R() * 6, 4 + R() * 16);
      dust += '<circle cx="' + r0(dp[0]) + '" cy="' + r0(dp[1]) + '" r="' + r1(0.7 + R() * 1.2) + '"/>';
    }
    s += '<g class="' + p + '-dust" fill="#fff6e0" opacity=".45">' + dust + '</g>';

    var css = '<style>.' + p + '-dust{animation:' + p + '-dr 20s ease-in-out infinite alternate}.' + p + '-bm{animation:' + p + '-br 10s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-dr{to{transform:translate(24px,-12px)}}@keyframes ' + p + '-br{from{opacity:.75}to{opacity:1}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.5));
  };

  /* =====================================================================
   * library_reading：上图 VIP 休息室，皮沙发、茶几，茶几上摊开的硬面精装大画册
   * ===================================================================== */
  GF.art.bg.library_reading = function () {
    var p = 'bglr', P = cam(820, 800, 262, 1.7), R = U.rng(5503), i, j;
    var XL = -3.6, XR = 4.2, YC = 3.1, ZB = 6.2, TY = 0.44;
    var d = '', s = '';
    d += lin(p + '-wall', 0, 70, 0, 480, [[0, '#4a4136'], [1, '#7d705c']], 1);
    d += lin(p + '-lw', 0, 0, 330, 0, [[0, '#1c1712'], [1, '#4a3f33']], 1);
    d += lin(p + '-rw', 1600, 0, 1350, 0, [[0, '#1f1a15'], [1, '#524638']], 1);
    d += lin(p + '-fl', 0, 900, 0, 490, [[0, '#120d0a'], [1, '#3d2d22']], 1);
    d += lin(p + '-win', 0, 0, 0, 1, [[0, '#e9efe6'], [1, '#f6f1dc']]);
    d += lin(p + '-sheer', 0, 0, 1, 0, [[0, '#f4efe0', 0.55], [0.5, '#f4efe0', 0.3], [1, '#f4efe0', 0.6]]);
    d += lin(p + '-drape', 0, 0, 1, 0, [[0, '#3a2a22'], [0.5, '#5a4032'], [1, '#2e211b']]);
    d += lin(p + '-lth', 0, 0, 0, 1, [[0, '#7a4232'], [1, '#3a1d17']]);
    d += lin(p + '-beam', 1, 0, 0, 1, [[0, '#fff6e0', 0.28], [1, '#fff6e0', 0]]);
    d += lin(p + '-shade', 0, 0, 1, 0, [[0, '#e8c890'], [0.5, '#fff0c8'], [1, '#c89a60']]);
    d += rad(p + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffc870', 0.5], [0.5, '#ffb050', 0.14], [1, '#ffb050', 0]]);
    d += rad(p + '-spot', 0.5, 0.5, 0.5, [[0, '#fff2d8', 0.5], [1, '#fff2d8', 0]]);
    d += blurF(p + '-b10', 10) + blurF(p + '-b3', 3);

    // 房间
    s += Q(P, [[XL, YC, 0.5], [XR, YC, 0.5], [XR, YC, ZB], [XL, YC, ZB]], '#1a1511');
    s += Q(P, [[XL, 0, 0.5], [XL, YC, 0.5], [XL, YC, ZB], [XL, 0, ZB]], 'url(#' + p + '-lw)');
    s += Q(P, [[XR, 0, 0.5], [XR, YC, 0.5], [XR, YC, ZB], [XR, 0, ZB]], 'url(#' + p + '-rw)');
    s += Q(P, [[XL, 0, 0.5], [XR, 0, 0.5], [XR, 0, ZB], [XL, 0, ZB]], 'url(#' + p + '-fl)');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-wall)');
    // 地板木纹
    var L = [];
    for (var gx = XL + 0.18; gx < XR; gx += 0.18) L.push([P(gx, 0, 1), P(gx, 0, ZB)]);
    s += '<path d="' + segs(L) + '" stroke="#0e0a08" stroke-width="1" opacity=".35"/>';
    // 墙纸竖纹 + 护墙板 + 顶角线
    L = [];
    for (gx = XL + 0.2; gx < XR; gx += 0.2) L.push([P(gx, 1.05, ZB), P(gx, YC, ZB)]);
    s += '<path d="' + segs(L) + '" stroke="#3e352b" stroke-width="2" opacity=".3"/>';
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, 1.0, ZB], [XL, 1.0, ZB]], '#3a2a1f');
    s += Q(P, [[XL, 1.0, ZB], [XR, 1.0, ZB], [XR, 1.07, ZB], [XL, 1.07, ZB]], '#6a4e38');
    var pn = '';
    for (gx = XL + 0.15; gx < XR - 0.5; gx += 0.72) pn += Q(P, [[gx, 0.18, ZB], [gx + 0.58, 0.18, ZB], [gx + 0.58, 0.86, ZB], [gx, 0.86, ZB]], '#2e2118');
    s += pn;
    s += Q(P, [[XL, YC - 0.14, ZB], [XR, YC - 0.14, ZB], [XR, YC, ZB], [XL, YC, ZB]], '#5a4a3a');
    s += '<path d="' + segs([[P(XL, YC - 0.14, 0.8), P(XL, YC - 0.14, ZB)], [P(XR, YC - 0.14, 0.8), P(XR, YC - 0.14, ZB)]]) + '" stroke="#5a4a3a" stroke-width="5"/>';

    // 左墙：通高书架
    s += Q(P, [[XL + 0.35, 0, 2.5], [XL + 0.35, 2.75, 2.5], [XL + 0.35, 2.75, ZB], [XL + 0.35, 0, ZB]], '#1c140f');
    var bk = '', sep = [];
    var cols = ['#6a2a22', '#2f3a4a', '#4a4030', '#7a6440', '#2e4234', '#8a7a5a', '#3a2a2a', '#5a5048'];
    for (var sh = 0; sh < 6; sh++) {
      var y0 = 0.12 + sh * 0.44, z = 3.5;
      while (z < ZB - 0.05) {
        var w = 0.12 + R() * 0.24, hg = 0.28 + R() * 0.1;
        bk += Q(P, [[XL + 0.35, y0, z], [XL + 0.35, y0, z + w], [XL + 0.35, y0 + hg, z + w], [XL + 0.35, y0 + hg, z]], cols[Math.floor(R() * cols.length)]);
        for (var q = 0.045; q < w; q += 0.045) sep.push([P(XL + 0.35, y0, z + q), P(XL + 0.35, y0 + hg * 0.9, z + q)]);
        z += w + (R() < 0.12 ? 0.12 : 0.004);
      }
      sep.push([P(XL + 0.35, y0 - 0.02, 3.4), P(XL + 0.35, y0 - 0.02, ZB)]);
    }
    s += bk + '<path d="' + segs(sep) + '" stroke="#0e0a08" stroke-width="1.2" opacity=".5"/>';
    s += '<path d="' + segs(sep.slice(-1).concat([[P(XL + 0.35, 2.75, 3.4), P(XL + 0.35, 2.75, ZB)]])) + '" stroke="#2a1d15" stroke-width="5"/>';

    // 后墙：国画、窗、落地灯
    var pa = P(-1.05, 2.45, ZB), pb = P(1.05, 1.5, ZB);
    s += rect(pa[0] - 8, pa[1] - 8, pb[0] - pa[0] + 16, pb[1] - pa[1] + 16, '#2a1d15') + rect(pa[0], pa[1], pb[0] - pa[0], pb[1] - pa[1], '#cfc4a8');
    var mt = '', mx = pa[0], pw = pb[0] - pa[0], ph = pb[1] - pa[1];
    mt += 'M' + r0(mx) + ' ' + r0(pb[1] - ph * 0.25);
    for (i = 0; i <= 12; i++) mt += 'L' + r0(mx + pw * i / 12) + ' ' + r0(pb[1] - ph * (0.3 + 0.45 * Math.abs(Math.sin(i * 0.9 + 1)) * (i > 3 && i < 9 ? 1.3 : 0.7)));
    mt += 'V' + r0(pb[1]) + 'H' + r0(mx) + 'Z';
    s += '<path d="' + mt + '" fill="#6a6a5e" opacity=".55"/>';
    s += '<path d="M' + r0(mx + pw * 0.55) + ' ' + r0(pb[1]) + 'l' + r0(pw * 0.1) + ' ' + r0(-ph * 0.5) + 'l' + r0(pw * 0.12) + ' ' + r0(ph * 0.5) + 'z" fill="#3a3a34" opacity=".6"/>';
    s += '<circle cx="' + r0(mx + pw * 0.2) + '" cy="' + r0(pa[1] + ph * 0.25) + '" r="7" fill="#a8322a" opacity=".7"/>';
    // 窗（纱帘 + 厚帘），窗外树影
    var wa = P(1.95, 2.75, ZB), wb = P(3.85, 0.75, ZB);
    s += rect(wa[0] - 6, wa[1] - 6, wb[0] - wa[0] + 12, wb[1] - wa[1] + 12, '#241a14');
    s += rect(wa[0], wa[1], wb[0] - wa[0], wb[1] - wa[1], 'url(#' + p + '-win)');
    var lv = '';
    for (i = 0; i < 16; i++) lv += '<circle cx="' + r0(wa[0] + R() * (wb[0] - wa[0])) + '" cy="' + r0(wa[1] + R() * (wb[1] - wa[1]) * 0.8) + '" r="' + r0(14 + R() * 20) + '"/>';
    d += '<clipPath id="' + p + '-wc"><rect x="' + r0(wa[0]) + '" y="' + r0(wa[1]) + '" width="' + r0(wb[0] - wa[0]) + '" height="' + r0(wb[1] - wa[1]) + '"/></clipPath>';
    s += '<g clip-path="url(#' + p + '-wc)" fill="#a9b5a2" opacity=".6">' + lv + '</g>';
    s += '<path d="M' + r0((wa[0] + wb[0]) / 2) + ' ' + r0(wa[1]) + 'V' + r0(wb[1]) + 'M' + r0(wa[0]) + ' ' + r0(wa[1] + (wb[1] - wa[1]) * 0.35) + 'H' + r0(wb[0]) + '" stroke="#3a2c22" stroke-width="5"/>';
    s += '<g class="' + p + '-cur">' + rect(wa[0] + 10, wa[1] - 4, wb[0] - wa[0] - 20, wb[1] - wa[1] + 10, 'url(#' + p + '-sheer)') + '</g>';
    s += rect(wa[0] - 34, wa[1] - 22, 52, wb[1] - wa[1] + 44, 'url(#' + p + '-drape)') + rect(wb[0] - 18, wa[1] - 22, 52, wb[1] - wa[1] + 44, 'url(#' + p + '-drape)');
    s += rect(wa[0] - 44, wa[1] - 28, wb[0] - wa[0] + 88, 8, '#1e1510');
    // 窗光：斜照到茶几与画册
    var sun = [P(1.95, 2.75, ZB), P(3.85, 2.75, ZB), P(3.85, 0.75, ZB), P(1.95, 0.75, ZB), P(-0.3, TY, 3.3), P(1.5, TY, 3.2), P(1.4, TY, 4.1), P(-0.2, TY, 4.2)];
    var beam = poly(hull(sun), 'url(#' + p + '-beam)');

    // 右墙壁灯
    var sc = P(XR, 1.95, 5.3), sc2 = P(XR, 1.95, 5.5);
    s += '<ellipse cx="' + r0(sc[0]) + '" cy="' + r0(sc[1]) + '" rx="70" ry="110" fill="url(#' + p + '-lamp)"/>';
    s += '<path d="M' + r0(sc[0]) + ' ' + r0(sc[1] + 16) + 'L' + r0(sc2[0]) + ' ' + r0(sc2[1] + 14) + 'L' + r0(sc2[0] - 4) + ' ' + r0(sc2[1] - 16) + 'L' + r0(sc[0] - 6) + ' ' + r0(sc[1] - 20) + 'Z" fill="url(#' + p + '-shade)"/>';
    // 地毯
    s += Q(P, [[-2.4, 0.005, 2.2], [3.1, 0.005, 2.2], [3.1, 0.005, 5.25], [-2.4, 0.005, 5.25]], '#3a1c19');
    s += Q(P, [[-2.2, 0.006, 2.4], [2.9, 0.006, 2.4], [2.9, 0.006, 5.05], [-2.2, 0.006, 5.05]], '#243029');
    s += Q(P, [[-1.9, 0.007, 2.7], [2.6, 0.007, 2.7], [2.6, 0.007, 4.75], [-1.9, 0.007, 4.75]], 'none', 'stroke="#8a6a3a" stroke-width="2" opacity=".6"');

    // 落地灯（沙发右侧）
    var lb = P(1.62, 0, 5.75), lt = P(1.62, 1.35, 5.75), sk = 820 / 5.75;
    s += '<ellipse cx="' + r0(lt[0]) + '" cy="' + r0(lt[1] + 20) + '" rx="220" ry="200" fill="url(#' + p + '-lamp)" class="' + p + '-glow"/>';
    s += '<path d="M' + r0(lb[0]) + ' ' + r0(lb[1]) + 'V' + r0(lt[1]) + '" stroke="#1a1410" stroke-width="3"/>';
    s += '<ellipse cx="' + r0(lb[0]) + '" cy="' + r0(lb[1]) + '" rx="' + r0(sk * 0.14) + '" ry="4" fill="#1a1410"/>';
    s += '<path d="M' + r0(lt[0] - sk * 0.16) + ' ' + r0(lt[1] + sk * 0.02) + 'L' + r0(lt[0] - sk * 0.12) + ' ' + r0(lt[1] - sk * 0.3) + 'H' + r0(lt[0] + sk * 0.12) + 'L' + r0(lt[0] + sk * 0.16) + ' ' + r0(lt[1] + sk * 0.02) + 'Z" fill="url(#' + p + '-shade)"/>';

    // 皮沙发（切斯特菲尔德式）
    var SZ0 = 5.3, SZ1 = 6.1;
    s += Q(P, [[-1.7, 0.002, SZ0 - 0.15], [1.4, 0.002, SZ0 - 0.15], [1.4, 0.002, SZ1], [-1.7, 0.002, SZ1]], '#000', 'opacity=".35"');
    s += box(P, -1.55, 1.25, 0.1, 0.98, SZ1 - 0.32, SZ1, { front: 'url(#' + p + '-lth)', top: '#8a4c3a' });
    var tf = '';
    for (var tx = -1.35; tx < 1.2; tx += 0.18) for (var ty = 0.55; ty < 0.95; ty += 0.14) {
      var tp = P(tx + ((ty * 7) % 2 ? 0.09 : 0), ty, SZ1 - 0.321); tf += '<circle cx="' + r0(tp[0]) + '" cy="' + r0(tp[1]) + '" r="1.6"/>';
    }
    s += '<g fill="#2a120e" opacity=".8">' + tf + '</g>';
    s += box(P, -1.35, 1.05, 0.1, 0.45, SZ0, SZ1 - 0.3, { front: '#4a251d', top: '#7a4232' });
    s += '<path d="' + segs([[P(-0.55, 0.45, SZ0), P(-0.55, 0.45, SZ1 - 0.3)], [P(0.25, 0.45, SZ0), P(0.25, 0.45, SZ1 - 0.3)]]) + '" stroke="#2a120e" stroke-width="2"/>';
    s += box(P, -1.55, -1.35, 0.1, 0.7, SZ0, SZ1, { front: '#522a20', top: '#8a4c3a', side: '#3a1d17' });
    s += box(P, 1.05, 1.25, 0.1, 0.7, SZ0, SZ1, { front: '#522a20', top: '#8a4c3a', side: '#6a3628' });
    s += Q(P, [[-1.55, 0, SZ0], [1.25, 0, SZ0], [1.25, 0.1, SZ0], [-1.55, 0.1, SZ0]], '#1a0e0b');
    // 靠垫
    s += Q(P, [[0.62, 0.45, SZ1 - 0.34], [0.98, 0.45, SZ1 - 0.34], [0.94, 0.8, SZ1 - 0.36], [0.66, 0.82, SZ1 - 0.36]], '#8a7a52');

    // 单人扶手椅（左）
    s += box(P, -3.05, -2.15, 0.1, 0.92, 4.95, 5.2, { front: '#3a1d17', top: '#6a3628', side: '#5a2e22' });
    s += box(P, -2.95, -2.25, 0.1, 0.44, 4.35, 4.95, { front: '#4a251d', top: '#7a4232', side: '#5a2e22' });
    s += box(P, -3.05, -2.9, 0.1, 0.64, 4.3, 5.2, { front: '#522a20', top: '#8a4c3a', side: '#3a1d17' });
    s += box(P, -2.3, -2.15, 0.1, 0.64, 4.3, 5.2, { front: '#522a20', top: '#8a4c3a', side: '#6a3628' });

    // 茶几 + 画册 + 茶具
    var T0 = 3.2, T1 = 4.1;
    s += Q(P, [[-0.5, 0.004, T0 - 0.1], [1.5, 0.004, T0 - 0.1], [1.5, 0.004, T1 + 0.1], [-0.5, 0.004, T1 + 0.1]], '#000', 'opacity=".35"');
    s += box(P, -0.35, -0.27, 0, TY - 0.05, T0 + 0.08, T0 + 0.16, { front: '#1c130e', side: '#2a1c14' }) + box(P, 1.17, 1.25, 0, TY - 0.05, T0 + 0.08, T0 + 0.16, { front: '#1c130e', side: '#2a1c14' });
    s += box(P, -0.3, 1.2, 0.1, 0.13, T0 + 0.1, T1 - 0.1, { front: '#1c130e', top: '#33231a' });
    s += box(P, 0.1, 0.62, 0.13, 0.19, T0 + 0.22, T0 + 0.6, { front: '#6a6a5a', top: '#b8ae94', side: '#4a4a3e' });
    s += box(P, -0.4, 1.3, TY - 0.06, TY, T0, T1, { front: '#2a1c14', top: '#4a3224', side: '#24180f' });
    s += Q(P, [[-0.3, TY + 0.001, T0 + 0.1], [1.2, TY + 0.001, T0 + 0.1], [1.2, TY + 0.001, T0 + 0.2], [-0.3, TY + 0.001, T0 + 0.2]], '#a88a6a', 'opacity=".25"');
    // 画册：厚硬封面 + 两页微微拱起 + 老照片
    var A0 = 3.38, A1 = 3.92, AX0 = 0.02, AX1 = 1.0, AM = (AX0 + AX1) / 2, CT = TY + 0.05;
    s += box(P, AX0 - 0.03, AX1 + 0.03, TY, CT, A0 - 0.02, A1 + 0.02, { front: '#5a1e1a', top: '#6e2620', side: '#3a1210' });
    s += Q(P, [[AX0, CT, A0], [AX0, CT, A1], [AM, CT - 0.01, A1], [AM, CT - 0.01, A0]], '#d9cfb4');
    s += Q(P, [[AM, CT - 0.01, A0], [AM, CT - 0.01, A1], [AX1, CT, A1], [AX1, CT, A0]], '#e8dfc6');
    s += Q(P, [[AX0, CT, A0], [AM, CT - 0.01, A0], [AM, CT - 0.012, A0 + 0.004], [AX0, CT - 0.002, A0 + 0.004]], '#b8ab8c');
    s += '<path d="' + segs([[P(AM, CT - 0.01, A0), P(AM, CT - 0.01, A1)]]) + '" stroke="#6a5a44" stroke-width="2"/>';
    s += Q(P, [[AM + 0.07, CT + 0.001, A0 + 0.08], [AX1 - 0.06, CT + 0.001, A0 + 0.08], [AX1 - 0.06, CT + 0.001, A1 - 0.1], [AM + 0.07, CT + 0.001, A1 - 0.1]], '#8a7556');
    s += Q(P, [[AM + 0.14, CT + 0.002, A0 + 0.16], [AM + 0.2, CT + 0.002, A0 + 0.16], [AM + 0.2, CT + 0.002, A0 + 0.3], [AM + 0.14, CT + 0.002, A0 + 0.3]], '#4a3c2c');
    s += Q(P, [[AM + 0.28, CT + 0.002, A0 + 0.2], [AM + 0.34, CT + 0.002, A0 + 0.2], [AM + 0.34, CT + 0.002, A0 + 0.33], [AM + 0.28, CT + 0.002, A0 + 0.33]], '#4a3c2c');
    var tl = [];
    for (j = 0; j < 4; j++) tl.push([P(AX0 + 0.07, CT, A0 + 0.1 + j * 0.08), P(AM - 0.07, CT, A0 + 0.1 + j * 0.08)]);
    s += '<path d="' + segs(tl) + '" stroke="#8a7e66" stroke-width="1.6"/>';
    [[1.12, 3.5], [-0.2, 3.75]].forEach(function (c) {
      var b = P(c[0], TY, c[1]), t = P(c[0], TY + 0.06, c[1]), cw = 820 * 0.045 / c[1];
      s += '<ellipse cx="' + r0(b[0]) + '" cy="' + r0(b[1]) + '" rx="' + r1(cw * 1.7) + '" ry="' + r1(cw * 0.4) + '" fill="#d8d2c2"/>';
      s += '<path d="M' + r1(b[0] - cw) + ' ' + r1(t[1]) + 'L' + r1(b[0] - cw * 0.7) + ' ' + r1(b[1] - 2) + 'H' + r1(b[0] + cw * 0.7) + 'L' + r1(b[0] + cw) + ' ' + r1(t[1]) + 'Z" fill="#ece6d6"/>';
      s += '<ellipse cx="' + r0(b[0]) + '" cy="' + r1(t[1]) + '" rx="' + r1(cw) + '" ry="' + r1(cw * 0.25) + '" fill="#9a7a3a"/>';
    });
    // 光斑
    s += '<ellipse cx="' + r0(P(0.6, TY, 3.7)[0]) + '" cy="' + r0(P(0.6, TY, 3.7)[1]) + '" rx="190" ry="44" fill="url(#' + p + '-spot)"/>';
    s += '<g class="' + p + '-bm">' + beam + '</g>';
    // 浮尘
    var dust = '';
    for (i = 0; i < 28; i++) {
      var t = R(), a = P(1.95 + R() * 1.9, 0.75 + R() * 2, ZB), b = P(-0.3 + R() * 1.7, TY, 3.3 + R() * 0.8);
      dust += '<circle cx="' + r0(a[0] + (b[0] - a[0]) * t) + '" cy="' + r0(a[1] + (b[1] - a[1]) * t) + '" r="' + r1(0.7 + R() * 1.1) + '"/>';
    }
    s += '<g class="' + p + '-dust" fill="#fff4dc" opacity=".55">' + dust + '</g>';

    var css = '<style>.' + p + '-dust{animation:' + p + '-dr 17s ease-in-out infinite alternate}.' + p + '-glow{animation:' + p + '-gl 6s ease-in-out infinite alternate}' +
      '.' + p + '-cur{transform-origin:50% 0;transform-box:fill-box;animation:' + p + '-cu 9s ease-in-out infinite alternate}.' + p + '-bm{animation:' + p + '-br 9s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-dr{to{transform:translate(-16px,10px)}}@keyframes ' + p + '-gl{from{opacity:.85}to{opacity:1}}' +
      '@keyframes ' + p + '-cu{from{transform:skewX(-1deg)}to{transform:skewX(1.2deg)}}@keyframes ' + p + '-br{from{opacity:.8}to{opacity:1}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.7));
  };

  /** 档案盒（正面朝镜头的纸盒 + 标签） */
  function archBox(P, x0, x1, y0, y1, z0, z1, col, fogf) {
    var s = box(P, x0, x1, y0, y1, z0, z1, { front: fogf(col, z0), top: fogf(U.mix(col, '#e8d8b0', 0.3), z0), side: fogf(U.mix(col, '#2a2016', 0.4), z0) });
    var w = x1 - x0, h = y1 - y0;
    s += Q(P, [[x0 + w * 0.2, y0 + h * 0.5, z0], [x1 - w * 0.2, y0 + h * 0.5, z0], [x1 - w * 0.2, y0 + h * 0.8, z0], [x0 + w * 0.2, y0 + h * 0.8, z0]], fogf('#e4dcc6', z0));
    s += Q(P, [[x0 + w * 0.42, y0 + h * 0.18, z0], [x1 - w * 0.42, y0 + h * 0.18, z0], [x1 - w * 0.42, y0 + h * 0.32, z0], [x0 + w * 0.42, y0 + h * 0.32, z0]], fogf('#3a2c1e', z0));
    return s;
  }

  /* =====================================================================
   * library_office：图书馆办公室，CRT 屏幕上的检索界面，桌上堆着档案盒
   * ===================================================================== */
  GF.art.bg.library_office = function () {
    var p = 'bglo', P = cam(900, 800, 300, 1.45), R = U.rng(6607), i, j;
    var XL = -2.7, XR = 1.95, ZB = 3.25, YC = 3.0, TY = 0.76;
    var fog = fogger('#3a3f3a', 2.6, 3, 0.25);
    var nf = function (c) { return c; };
    var d = '', s = '';
    d += lin(p + '-bw', 0, -100, 0, 700, [[0, '#353b36'], [0.6, '#5e665e'], [1, '#4a5049']], 1);
    d += lin(p + '-rw', 1600, 0, 1330, 0, [[0, '#2e342f'], [1, '#6a7168']], 1);
    d += lin(p + '-fl', 0, 900, 0, 640, [[0, '#1a1c1a'], [1, '#484c46']], 1);
    d += lin(p + '-blind', 0, 0, 1, 0, [[0, '#f8eed2'], [1, '#d8d8c8']]);
    d += lin(p + '-stripe', 1, 0, 0, 0, [[0, '#ffefc4', 0.5], [1, '#ffefc4', 0.12]]);
    d += rad(p + '-crt', 0.5, 0.5, 0.5, [[0, '#a8c8f0', 0.35], [1, '#a8c8f0', 0]]);
    d += rad(p + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffd080', 0.55], [1, '#ffd080', 0]]);
    d += lin(p + '-glass', 0, 0, 1, 1, [[0, '#ffffff', 0.18], [0.4, '#ffffff', 0], [1, '#ffffff', 0]]);
    d += blurF(p + '-b8', 8);

    // 墙与地面
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, YC, ZB], [XL, YC, ZB]], 'url(#' + p + '-bw)');
    s += Q(P, [[XR, 0, 0.5], [XR, YC, 0.5], [XR, YC, ZB], [XR, 0, ZB]], 'url(#' + p + '-rw)');
    s += Q(P, [[XL, 0, 0.5], [XL, YC, 0.5], [XL, YC, ZB], [XL, 0, ZB]], '#262a26');
    s += Q(P, [[XL, 0, 0.5], [XR, 0, 0.5], [XR, 0, ZB], [XL, 0, ZB]], 'url(#' + p + '-fl)');
    s += Q(P, [[XL, 0, ZB], [XR, 0, ZB], [XR, 0.12, ZB], [XL, 0.12, ZB]], '#1c201c');

    // 后墙左：通高钢架，满架档案盒
    var S0 = -2.6, S1 = -0.75, SZ = ZB - 0.42;
    s += box(P, S0, S1, 0, 2.7, SZ, ZB, { front: '#20251f' });
    var bx = '', lv = [0.06, 0.52, 0.98, 1.44, 1.9, 2.36];
    lv.forEach(function (y0, li) {
      var x = S0 + 0.05;
      while (x < S1 - 0.2) {
        var w = 0.14 + R() * 0.08, h = 0.33 + R() * 0.06, col = ['#8e6e48', '#9c7a50', '#7e6242', '#a48458', '#6a5a48'][Math.floor(R() * 5)];
        if (R() < 0.1) { x += w; continue; }
        bx += archBox(P, x, x + w, y0 + 0.02, y0 + 0.02 + h, SZ + 0.02, ZB - 0.04, col, nf);
        x += w + 0.01;
      }
      bx += box(P, S0, S1, y0 - 0.03, y0 + 0.02, SZ, ZB, { front: '#5a6258', top: '#3a403a' });
    });
    s += bx;
    s += box(P, S0 - 0.03, S0 + 0.02, 0, 2.72, SZ - 0.01, ZB, { front: '#626b61' }) + box(P, S1 - 0.02, S1 + 0.03, 0, 2.72, SZ - 0.01, ZB, { front: '#626b61', side: '#4a5249' });

    // 后墙：挂历 + 挂钟 + 电源插座
    var cal = P(-0.35, 2.15, ZB), cal2 = P(0.15, 1.45, ZB);
    s += rect(cal[0], cal[1], cal2[0] - cal[0], cal2[1] - cal[1], '#d8d0bc') + rect(cal[0], cal[1], cal2[0] - cal[0], (cal2[1] - cal[1]) * 0.45, '#6a8a8a');
    var grid = '';
    for (j = 0; j < 5; j++) grid += 'M' + r0(cal[0] + 8) + ' ' + r0(cal[1] + (cal2[1] - cal[1]) * (0.55 + j * 0.09)) + 'H' + r0(cal2[0] - 8);
    s += '<path d="' + grid + '" stroke="#8a8474" stroke-width="2" stroke-dasharray="6 5"/>';
    s += '<text x="' + r0((cal[0] + cal2[0]) / 2) + '" y="' + r0(cal[1] + (cal2[1] - cal[1]) * 0.3) + '" font-family="' + FONT + '" font-size="26" fill="#eae4d2" text-anchor="middle">6</text>';
    var ck = P(0.75, 2.2, ZB);
    s += '<circle cx="' + r0(ck[0]) + '" cy="' + r0(ck[1]) + '" r="38" fill="#e2ddd0" stroke="#1e221e" stroke-width="5"/>';
    s += '<path d="M' + r0(ck[0]) + ' ' + r0(ck[1]) + 'l-14 -18M' + r0(ck[0]) + ' ' + r0(ck[1]) + 'l24 6" stroke="#1e221e" stroke-width="3.5" stroke-linecap="round"/>';

    // 右墙：百叶窗
    var W0 = 2.25, W1 = 3.1, WY0 = 0.95, WY1 = 2.45;
    s += Q(P, [[XR, WY0 - 0.08, W0 - 0.08], [XR, WY0 - 0.08, W1 + 0.08], [XR, WY1 + 0.08, W1 + 0.08], [XR, WY1 + 0.08, W0 - 0.08]], '#1c201c');
    s += Q(P, [[XR, WY0, W0], [XR, WY0, W1], [XR, WY1, W1], [XR, WY1, W0]], 'url(#' + p + '-blind)');
    var sl = [];
    for (var y = WY0 + 0.05; y < WY1; y += 0.065) sl.push([P(XR, y, W0), P(XR, y, W1)]);
    s += '<path d="' + segs(sl) + '" stroke="#8a8676" stroke-width="2.4" opacity=".75"/>';
    // 百叶光条：落在后墙与桌面
    var st = '';
    for (i = 0; i < 9; i++) {
      var yy = 1.05 + i * 0.13, a = P(1.95, yy, 2.4), b = P(1.95, yy + 0.06, 2.4), c2 = P(-0.4, yy - 0.75, ZB), d2 = P(-0.4, yy - 0.71, ZB);
      if (yy - 0.73 > TY) st += poly([a, b, d2, c2], 'url(#' + p + '-stripe)');
    }
    s += '<g class="' + p + '-bl">' + st + '</g>';

    // 桌子（靠后墙）
    var D0 = 2.3, D1 = 3.1;
    s += box(P, -0.62, 1.9, 0, TY, D0, D1, { front: '#3a3e38', top: '#6f6c5e', side: '#2c302a' });
    s += Q(P, [[-0.62, TY - 0.035, D0], [1.9, TY - 0.035, D0], [1.9, TY, D0], [-0.62, TY, D0]], '#8a877a');
    var dr = [];
    for (j = 1; j < 4; j++) dr.push([P(1.2, TY - j * 0.18, D0), P(1.85, TY - j * 0.18, D0)]);
    dr.push([P(1.2, 0.04, D0), P(1.2, TY - 0.04, D0)], [P(-0.55, 0.04, D0), P(-0.55, TY - 0.04, D0)]);
    s += '<path d="' + segs(dr) + '" stroke="#1c1f1b" stroke-width="2.5"/>';
    // 桌面上的百叶光条
    var dsk = '';
    for (i = 0; i < 6; i++) {
      var z = 2.35 + i * 0.13;
      dsk += Q(P, [[0.55, TY + 0.001, z], [1.85, TY + 0.001, z + 0.12], [1.85, TY + 0.001, z + 0.18], [0.55, TY + 0.001, z + 0.06]], '#ffefc4', 'opacity=".28"');
    }
    s += dsk;

    // 台灯（左）
    var lb = P(-0.4, TY, 2.75), lt = P(-0.28, 1.2, 2.75), sk = 900 / 2.75;
    s += '<ellipse cx="' + r0(lb[0] + 10) + '" cy="' + r0(lb[1]) + '" rx="' + r0(sk * 0.45) + '" ry="' + r0(sk * 0.08) + '" fill="url(#' + p + '-lamp)"/>';
    s += '<path d="M' + r0(lb[0]) + ' ' + r0(lb[1]) + 'L' + r0(lb[0] + 6) + ' ' + r0(lt[1] + 20) + 'L' + r0(lt[0]) + ' ' + r0(lt[1]) + '" stroke="#1a1d1a" stroke-width="5" fill="none"/>';
    s += '<ellipse cx="' + r0(lb[0]) + '" cy="' + r0(lb[1]) + '" rx="' + r0(sk * 0.08) + '" ry="5" fill="#1a1d1a"/>';
    s += '<path d="M' + r0(lt[0] - 34) + ' ' + r0(lt[1] + 26) + 'L' + r0(lt[0] - 12) + ' ' + r0(lt[1] - 6) + 'L' + r0(lt[0] + 18) + ' ' + r0(lt[1] - 2) + 'L' + r0(lt[0] + 26) + ' ' + r0(lt[1] + 30) + 'Z" fill="#2e4a3a"/>';
    s += '<ellipse cx="' + r0(lt[0] - 4) + '" cy="' + r0(lt[1] + 28) + '" rx="28" ry="6" fill="#ffe2a0" filter="url(#' + p + '-b8)"/>';

    // CRT 显示器 + 检索界面
    var M0 = -0.08, M1 = 0.46, MZ = 2.5;
    s += '<ellipse cx="' + r0(P((M0 + M1) / 2, 1, MZ)[0]) + '" cy="' + r0(P(0, 1, MZ)[1]) + '" rx="260" ry="190" fill="url(#' + p + '-crt)" class="' + p + '-cg"/>';
    s += box(P, M0 + 0.12, M1 - 0.12, TY, 0.8, MZ + 0.1, MZ + 0.35, { front: '#9a9482', top: '#b8b29e' });
    s += box(P, M0 + 0.04, M1 - 0.04, 0.82, 1.2, MZ + 0.1, MZ + 0.5, { top: '#b4ad97', side: '#7e7866' });
    s += box(P, M0, M1, 0.8, 1.24, MZ, MZ + 0.12, { front: '#c6bfa8', top: '#d8d1bb', side: '#958f7c' });
    var sa = P(M0 + 0.045, 1.2, MZ - 0.001), sb = P(M1 - 0.045, 0.86, MZ - 0.001);
    var sx = sa[0], sy = sa[1], sw = sb[0] - sa[0], sh = sb[1] - sa[1], ui = '';
    ui += rect(sx, sy, sw, sh, '#1d2a38');
    ui += rect(sx + 4, sy + 4, sw - 8, sh - 8, '#d4dbe0');
    ui += rect(sx + 4, sy + 4, sw - 8, 13, '#244f94');
    ui += '<text x="' + r0(sx + 9) + '" y="' + r0(sy + 14) + '" font-family="' + FONT + '" font-size="10" fill="#f2f4f6">馆藏文献检索系统</text>';
    ui += '<text x="' + r0(sx + 10) + '" y="' + r0(sy + 34) + '" font-family="' + FONT + '" font-size="10" fill="#2a3440">检索词</text>';
    ui += rect(sx + 46, sy + 24, sw * 0.5, 13, '#ffffff', 'stroke="#6a7a8a" stroke-width="1"');
    ui += rect(sx + 50, sy + 26, 1.6, 9, '#1a2a3a', 'class="' + p + '-cur"');
    ui += rect(sx + 52 + sw * 0.5, sy + 24, 26, 13, '#b8c0c8', 'stroke="#6a7a8a" stroke-width="1"');
    var rl = '';
    for (j = 0; j < 6; j++) rl += 'M' + r0(sx + 10) + ' ' + r0(sy + 50 + j * 10) + 'h' + r0(sw * (0.55 + 0.3 * R()));
    ui += rect(sx + 7, sy + 64, sw - 14, 9, '#8fb0d8');
    ui += '<path d="' + rl + '" stroke="#5a6674" stroke-width="3"/>';
    ui += '<path d="' + (function () { var o = ''; for (var k = sy + 2; k < sy + sh; k += 3) o += 'M' + r0(sx) + ' ' + k + 'h' + r0(sw); return o; })() + '" stroke="#000" stroke-width="1" opacity=".12"/>';
    ui += rect(sx, sy, sw, sh, 'url(#' + p + '-glass)');
    s += ui + rect(sx - 2, sy - 2, sw + 4, sh + 4, 'none', 'stroke="#8a8472" stroke-width="3" rx="6"');
    s += '<circle cx="' + r0(sb[0] - 4) + '" cy="' + r0(P(0, 0.83, MZ)[1]) + '" r="2.5" fill="#6fe07a"/>';
    // 键盘、鼠标
    s += box(P, -0.05, 0.42, TY, TY + 0.03, 2.33, 2.47, { front: '#a09a86', top: '#c9c2ac' });
    var kk = [];
    for (j = 1; j < 4; j++) kk.push([P(-0.02, TY + 0.031, 2.33 + j * 0.035), P(0.39, TY + 0.031, 2.33 + j * 0.035)]);
    s += '<path d="' + segs(kk) + '" stroke="#7a7464" stroke-width="1.2"/>';
    s += '<ellipse cx="' + r0(P(0.56, TY, 2.4)[0]) + '" cy="' + r0(P(0.56, TY, 2.4)[1] - 3) + '" rx="10" ry="6" fill="#c9c2ac"/>';

    // 桌右：成堆的档案盒（有的打开，纸页外露）
    [[0.8, 1.2, 3], [1.26, 1.66, 4], [0.95, 1.4, 1, 2.35]].forEach(function (c) {
      var z0 = c[3] || 2.62, y = TY;
      for (var k = 0; k < c[2]; k++) {
        var hh = 0.14 + R() * 0.03, col = ['#9c7a50', '#8e6e48', '#a48458'][k % 3];
        var o = (R() - 0.5) * 0.04;
        s += archBox(P, c[0] + o, c[1] + o, y, y + hh, z0, z0 + 0.36, col, nf);
        y += hh + 0.004;
      }
      if (c[2] === 1) {
        s += Q(P, [[c[0] + 0.03, y, z0 + 0.04], [c[1] - 0.03, y, z0 + 0.04], [c[1] - 0.05, y + 0.06, z0 + 0.2], [c[0] + 0.05, y + 0.07, z0 + 0.2]], '#e6ddc4');
        s += Q(P, [[c[0] + 0.07, y + 0.07, z0 + 0.2], [c[1] - 0.08, y + 0.06, z0 + 0.2], [c[1] - 0.1, y + 0.12, z0 + 0.3], [c[0] + 0.1, y + 0.12, z0 + 0.3]], '#d4c8a8');
      }
    });
    // 散落文件
    s += Q(P, flat(-0.25, 2.45, 0.3, 0.22, 0.25, TY + 0.002), '#e2dac2') + Q(P, flat(0.62, 2.62, 0.26, 0.2, -0.3, TY + 0.002), '#d8ceb2');
    // 地上的档案盒
    [[-2.4, -1.95, 0, 2], [-1.9, -1.45, 0, 1]].forEach(function (c) {
      var y = 0;
      for (var k = 0; k < c[3]; k++) { s += archBox(P, c[0], c[1], y, y + 0.3, 2.35, 2.75, ['#8e6e48', '#a48458'][k % 2], nf); y += 0.3; }
    });
    // 椅子（推到桌左）
    s += box(P, -1.25, -0.72, 0.44, 0.5, 1.85, 2.25, { front: '#1a1d1c', top: '#2c302e', side: '#141716' });
    s += box(P, -1.23, -0.74, 0.54, 1.05, 2.26, 2.32, { front: '#1c201e', top: '#343836', side: '#141716' });
    s += box(P, -1.0, -0.96, 0.06, 0.44, 2.03, 2.07, { front: '#0e100f', side: '#0e100f' });

    var css = '<style>.' + p + '-cur{animation:' + p + '-bk 1.1s steps(1) infinite}.' + p + '-cg{animation:' + p + '-gl 4s ease-in-out infinite alternate}' +
      '.' + p + '-bl{animation:' + p + '-br 12s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-bk{50%{opacity:0}}@keyframes ' + p + '-gl{from{opacity:.85}to{opacity:1}}@keyframes ' + p + '-br{from{opacity:.8}to{opacity:1}}</style>';
    return U.svg(css + '<defs>' + d + '</defs>' + s + U.vignette(p, 0.7));
  };
})();
