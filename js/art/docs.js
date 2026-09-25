/*
 * 物证浮层插图（doc，viewBox 800x600）：
 *   flag_yang  杨铁的圆珠笔旗（蝌蚪曲线）
 *   flag_fu    同一张纸背面：傅惜娣的螺旋（透出正面线条）
 *   flag_zhong 钟书同在稿纸上用钢笔画的旗（锯齿纹 + 竖目）
 *   map1935    1935 年上海地图局部翻拍（邱家塘）
 *   auction    拍卖预展广告（报纸网点照片：明仿沈秀纳财盆）
 *   weimap     卫不回遗图复印件（会稽郡轮廓套闸北小图）
 * 所有 id 带前缀；不引用外部资源；重复元素循环生成。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var DOC = GF.art.doc;
  var PI2 = Math.PI * 2;
  var PREC = 10;

  /* ---------------- 小工具 ---------------- */
  function n(v) { return Math.round(v * PREC) / PREC; }
  function num(v) { return String(v).replace(/^(-?)0\./, '$1.'); }
  /** 折线路径（相对坐标，省字节） */
  function pl(pts, close) {
    var X = Math.round(pts[0][0] * PREC), Y = Math.round(pts[0][1] * PREC), s = 'M' + X / PREC + ' ' + Y / PREC + 'l';
    for (var i = 1; i < pts.length; i++) {
      var x = Math.round(pts[i][0] * PREC), y = Math.round(pts[i][1] * PREC), a = num((x - X) / PREC), b = num((y - Y) / PREC);
      s += (i === 1 || a[0] === '-' ? '' : ' ') + a + (b[0] === '-' ? '' : ' ') + b;
      X = x; Y = y;
    }
    return s + (close ? 'Z' : '');
  }
  /** Catmull-Rom 采样成密点 */
  function cr(pts, k, closed) {
    var out = [], L = pts.length, N = closed ? L : L - 1;
    for (var i = 0; i < N; i++) {
      var p0 = pts[closed ? (i - 1 + L) % L : Math.max(i - 1, 0)], p1 = pts[i],
        p2 = pts[(i + 1) % L], p3 = pts[closed ? (i + 2) % L : Math.min(i + 2, L - 1)];
      for (var j = 0; j < k; j++) {
        var t = j / k, t2 = t * t, t3 = t2 * t, q = [];
        for (var c = 0; c < 2; c++) {
          q.push(0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
            (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3));
        }
        out.push(q);
      }
    }
    out.push(closed ? out[0].slice() : pts[L - 1].slice());
    return out;
  }
  /** 手抖：低频随机游走 */
  function wob(pts, R, a) {
    var ox = 0, oy = 0, out = [];
    for (var i = 0; i < pts.length; i++) {
      ox = ox * 0.82 + (R() - 0.5) * a; oy = oy * 0.82 + (R() - 0.5) * a;
      out.push([pts[i][0] + ox, pts[i][1] + oy]);
    }
    return out;
  }
  /** 按弧长重采样 */
  function resample(pts, step) {
    var out = [pts[0]], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), t = step - acc;
      while (t <= d) { out.push([a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d]); t += step; }
      acc = d - (t - step);
    }
    return out;
  }
  /** 噪点滤镜：颜色固定为 rgb，alpha = k*A + b，限制在元素内 */
  function noiseF(id, freq, oct, seed, rgb, k, b) {
    return '<filter id="' + id + '" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="' + freq +
      '" numOctaves="' + oct + '" seed="' + seed + '"/><feColorMatrix type="matrix" values="0 0 0 0 ' + rgb[0] + ' 0 0 0 0 ' + rgb[1] +
      ' 0 0 0 0 ' + rgb[2] + ' 0 0 0 ' + k + ' ' + b + '"/><feComposite in2="SourceGraphic" operator="in"/></filter>';
  }
  /** 笔墨断续：用噪声调制 alpha */
  function inkF(id, seed, k, b) {
    return '<filter id="' + id + '" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="' + seed +
      '" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ' + k + ' ' + b +
      '" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  }
  function open() { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">'; }
  /** 深色桌面 + 投影 + 纸 */
  function desk(P, x, y, w, h, rot, paper) {
    return '<rect width="800" height="600" fill="#24201c"/><rect width="800" height="600" fill="url(#' + P + 'dv)"/>' +
      '<g transform="rotate(' + rot + ' 400 300)"><rect x="' + (x + 6) + '" y="' + (y + 9) + '" width="' + w + '" height="' + h + '" fill="#000" opacity=".55" filter="url(#' + P + 'sh)"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + paper + '"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#000" filter="url(#' + P + 'mt)"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#000" filter="url(#' + P + 'gr)"/>';
  }
  function deskDefs(P) {
    return '<radialGradient id="' + P + 'dv" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3b342d"/><stop offset="1" stop-color="#15120f"/></radialGradient>' +
      '<filter id="' + P + 'sh" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>' +
      noiseF(P + 'gr', 0.85, 2, 3, [0.3, 0.26, 0.2], 0.9, -0.36) +
      noiseF(P + 'mt', 0.011, 3, 8, [0.45, 0.38, 0.25], 0.4, -0.17);
  }
  function crease(x1, y1, x2, y2) {
    return '<path d="M' + x1 + ' ' + (y1 + 1.4) + 'L' + x2 + ' ' + (y2 + 1.4) + '" stroke="#000" stroke-width="2.2" opacity=".07"/>' +
      '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="#fff" stroke-width="1" opacity=".6"/>';
  }

  /* ================= flag_yang：圆珠笔蝌蚪旗 ================= */
  function yangInk() {
    var R = U.rng(4417), o = '', k, p;
    function ln(pts, w, op) {
      o += '<path d="' + pl(pts) + '"' + (w ? ' stroke-width="' + w + '"' : '') + (op ? ' opacity="' + op + '"' : '') + '/>';
    }
    function blob(x, y, r) { o += '<circle cx="' + n(x) + '" cy="' + n(y) + '" r="' + r + '" fill="#172f7c" stroke="none"/>'; }
    // 旗杆：双线，重描三遍
    for (p = 0; p < 3; p++) {
      var dx = (R() - 0.5) * 2.6, w = p ? 1.1 : 1.6;
      ln(wob(cr([[198 + dx, 98], [196 + dx, 240], [200 + dx, 390], [203 + dx, 530]], 12), R, 1.3), w);
      ln(wob(cr([[208 + dx, 100], [207 + dx, 250], [210 + dx, 400], [213 + dx, 528]], 12), R, 1.3), w);
    }
    ln(wob(cr([[196, 531], [205, 534], [214, 529]], 4), R, 0.8), 1.3);
    // 杆头圆球
    for (p = 0; p < 2; p++) {
      var ks = [];
      for (k = 0; k <= 30; k++) { var a = -1.3 + k * 0.25; ks.push([203 + Math.cos(a) * 9, 88 + Math.sin(a) * 8.5]); }
      ln(wob(ks, R, 1.1), p ? 1.1 : 1.5);
    }
    // 旗面轮廓（飘动的波浪边），重描
    var edge = [[209, 108], [300, 95], [420, 121], [540, 100], [619, 114], [613, 236], [623, 352], [520, 371], [400, 343], [292, 365], [211, 350]];
    for (p = 0; p < 3; p++) {
      ln(wob(cr(edge.map(function (q) { return [q[0] + (R() - 0.5) * 3.5, q[1] + (R() - 0.5) * 3.5]; }), 10), R, 1.7), p ? 1.1 : 1.6, p === 2 ? 0.75 : 0);
    }
    // 蝌蚪
    function tadpole(cx, cy) {
      var th = R() * PI2, hr = 4.4 + R() * 3.2, len = 22 + R() * 34, amp = 2.5 + R() * 4.5,
        per = 0.8 + R() * 1.4, ph = R() * PI2, bend = (R() - 0.5) * 2.2;
      var ex = cx + Math.cos(th) * (len + hr), ey = cy + Math.sin(th) * (len + hr);
      if (ex < 224 || ex > 604 || ey < 118 || ey > 345) th += Math.PI;
      var ct = Math.cos(th), st = Math.sin(th), hp = [], N = 26;
      for (k = 0; k <= N; k++) {
        var a = R() * 0.35 + k * 0.72, rr = hr * (1 - 0.7 * k / N) + (R() - 0.5) * 0.9,
          lx = Math.cos(a) * rr * 1.3, ly = Math.sin(a) * rr;
        hp.push([cx + lx * ct - ly * st, cy + lx * st + ly * ct]);
      }
      ln(hp, 1.45);
      var tp = [], ang = th, x = cx + ct * hr * 1.2, y = cy + st * hr * 1.2, M = Math.max(6, Math.round(len / 3.2));
      for (k = 0; k <= M; k++) {
        var u = k / M, off = amp * Math.sin(u * per * PI2 + ph) * Math.pow(u, 0.7),
          dxx = Math.cos(ang), dyy = Math.sin(ang);
        tp.push([x - dyy * off + (R() - 0.5) * 0.6, y + dxx * off + (R() - 0.5) * 0.6]);
        x += dxx * 3.2; y += dyy * 3.2; ang += bend / M;
      }
      ln(tp, 1.3);
      if (R() < 0.4) ln(tp.map(function (q) { return [q[0] + 0.9, q[1] + 0.6]; }), 0.9, 0.7);
      if (R() < 0.3) blob(tp[M][0], tp[M][1], 1.3);
      if (R() < 0.25) blob(hp[0][0], hp[0][1], 1.6);
    }
    for (var r = 0; r < 5; r++) for (var c = 0; c < 8; c++) tadpole(236 + c * 47 + (R() - 0.5) * 24, 133 + r * 47 + (R() - 0.5) * 20);
    // 两条贯穿的歪扭长曲线
    for (p = 0; p < 2; p++) {
      var lp = [], y0 = 165 + p * 110;
      for (k = 0; k <= 60; k++) lp.push([228 + k * 6.2, y0 + Math.sin(k * 0.42 + p * 2) * 9 + Math.sin(k * 0.13) * 12]);
      ln(wob(lp, R, 1.4), 1.1, 0.8);
    }
    // 角落试笔
    var tst = [];
    for (k = 0; k <= 44; k++) tst.push([612 + k * 1.3 + Math.cos(k * 0.9) * (6 + R() * 5), 512 + Math.sin(k * 0.9) * (4 + R() * 5) + k * 0.15]);
    ln(wob(tst, R, 0.8), 1.2, 0.85);
    return o;
  }

  DOC.flag_yang = function () {
    var P = 'dfy-';
    return open() + '<defs>' + deskDefs(P) + inkF(P + 'ink', 11, -1.4, 1.62) + '</defs>' +
      desk(P, 72, 34, 656, 532, -1.2, '#f5f4ee') +
      crease(72, 302, 728, 298) +
      '<g fill="none" stroke="#23409e" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + P + 'ink)">' + yangInk() + '</g>' +
      '</g></svg>';
  };

  /* ================= flag_fu：背面螺旋（透出正面） ================= */
  DOC.flag_fu = function () {
    var P = 'dff-', R = U.rng(7071), o = '', k, p;
    function ln(pts, w, op) {
      o += '<path d="' + pl(pts) + '"' + (w ? ' stroke-width="' + w + '"' : '') + (op ? ' opacity="' + op + '"' : '') + '/>';
    }
    // 旗杆 + 旗框（一遍，下笔重）
    ln(wob(cr([[160, 104], [162, 300], [166, 540]], 16), R, 1.2), 2.2);
    ln(wob(cr([[168, 106], [170, 300], [174, 538]], 16), R, 1.2), 2.2);
    ln(wob(cr([[170, 112], [380, 116], [598, 120], [595, 250], [592, 388], [380, 384], [172, 380]], 12), R, 1.5), 2.1);
    ln(wob(cr([[171, 114], [382, 118], [597, 123], [594, 250]], 10), R, 1.5), 1.3, 0.7);
    // 螺旋：由里向外，约十一圈，按弧长取点
    var cx = 382, cy = 250, T = 11, RX = 200, RY = 124, th = 0, pts = [], dr = 0;
    while (th < T * PI2) {
      var u = th / (T * PI2), rr = Math.pow(u, 0.93) + 0.012 * Math.sin(th * 0.37), lob = 1 + 0.05 * Math.sin(2 * th + 0.8 + u * 4);
      dr = dr * 0.93 + (R() - 0.5) * 1.7;
      var ccx = cx + 7 * Math.sin(th * 0.09), ccy = cy + 4 * Math.cos(th * 0.07), ex = (RX * rr * lob + dr) * Math.cos(th + 0.4), ey = (RY * rr * lob + dr * 0.7) * Math.sin(th + 0.4);
      pts.push([ccx + ex * 0.998 + ey * 0.07, ccy + ey - ex * 0.05]);
      th += Math.min(0.5, 14 / (RX * rr + 6));
    }
    ln(pts, 2.6);
    PREC = 1;
    ln(pts.map(function (q) { return [q[0] + 1, q[1] + 0.6]; }), 1.5, 0.75);
    PREC = 10;
    var inner = pts.slice(0, Math.floor(pts.length * 0.28)).map(function (q) { return [q[0] - 0.6, q[1] + 0.8]; });
    ln(inner, 2.2, 0.9);
    // 圆心反复戳涂
    var bl = [];
    for (k = 0; k <= 26; k++) { var a = k * 0.8, r2 = 5 * (1 - k / 30); bl.push([cx + Math.cos(a) * r2 * 1.3, cy + Math.sin(a) * r2]); }
    ln(bl, 2.2);
    // 正面透过来的反向线条
    PREC = 1;
    var ghost = yangInk(), groove = pl(pts.slice(0, 260).map(function (q) { return [q[0] + 1.5, q[1] - 1.2]; }));
    PREC = 10;
    return open() + '<defs>' + deskDefs(P) + inkF(P + 'ink', 5, -1.1, 1.55) +
      '<filter id="' + P + 'bl" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>' +
      desk(P, 72, 34, 656, 532, 0.9, '#f3f2ec') +
      crease(72, 298, 728, 302) +
      '<g transform="matrix(-1 0 0 1 800 0)" fill="none" stroke="#5c70b4" stroke-linecap="round" opacity=".2" filter="url(#' + P + 'bl)">' + ghost + '</g>' +
      '<g fill="none" stroke="#1d358f" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + P + 'ink)">' + o + '</g>' +
      '<path d="' + groove + '" fill="none" stroke="#fff" stroke-width=".6" opacity=".35"/>' +
      '</g></svg>';
  };

  /* ================= flag_zhong：稿纸钢笔 ================= */
  function lens(cx, cy, w, h, N) { // 竖立的尖角眼形（x = w(1-(y/h)^2)）
    var pts = [], i;
    for (i = 0; i <= N; i++) { var y = -h + 2 * h * i / N; pts.push([cx + w * (1 - y * y / (h * h)), cy + y]); }
    for (i = N - 1; i > 0; i--) { var y2 = -h + 2 * h * i / N; pts.push([cx - w * (1 - y2 * y2 / (h * h)), cy + y2]); }
    return pts;
  }
  function zigzag(pts, step, a, phase) { // 沿闭合曲线做锯齿
    var cl = pts.concat([pts[0]]), rs = resample(cl, step), out = [], L = rs.length - 1;
    for (var i = 0; i < L; i++) {
      var pa = rs[(i - 1 + L) % L], pb = rs[(i + 1) % L], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1,
        s = ((i + phase) % 2) ? a : -a;
      out.push([rs[i][0] - dy / d * s, rs[i][1] + dx / d * s]);
    }
    return out;
  }
  DOC.flag_zhong = function () {
    var P = 'dfz-', R = U.rng(92), INK = '#1c2436', G = '#b3503b', o = '', k, i;
    var F = 'font-family="Kaiti SC, STKaiti, KaiTi, serif"';
    // 旗杆 + 杆头
    o += '<path d="M196 90V522M203 90V522M190 522H209M199.5 62L193 86H206ZM193 86H206" />';
    o += '<circle cx="199.5" cy="59" r="3.2"/>';
    // 旗框（双线）
    o += '<path d="M203 96H598V388H203M208 101H593V383H208Z"/>';
    // 边缘一圈锯齿
    var rim = [];
    var sides = [[208, 101, 593, 101], [593, 101, 593, 383], [593, 383, 208, 383], [208, 383, 208, 101]];
    for (i = 0; i < 4; i++) {
      var s = sides[i], len = Math.hypot(s[2] - s[0], s[3] - s[1]), m = Math.round(len / 11), ux = (s[2] - s[0]) / len, uy = (s[3] - s[1]) / len;
      for (k = 0; k < m; k++) {
        var t = k * len / m, inw = (k % 2) ? 9 : 0;
        rim.push([s[0] + ux * t - uy * inw, s[1] + uy * t + ux * inw]);
      }
    }
    o += '<path d="' + pl(rim, true) + '" stroke-width="1.1"/>';
    // 层层交错的锯齿眼形
    var cx = 400, cy = 242;
    for (k = 0; k < 5; k++) {
      var zz = zigzag(lens(cx, cy, 36 + 31 * k, 58 + 16 * k, 80), 6.5 + k * 0.6, 3.6, k % 2);
      o += '<path d="' + pl(zz, true) + '" stroke-width="' + (1.25 - k * 0.05) + '"/>';
      if (k > 0) o += '<path d="' + pl(lens(cx, cy, 36 + 31 * k - 12, 58 + 16 * k - 7, 40), true) + '" stroke-width=".6" opacity=".7"/>';
    }
    // 竖眼
    o += '<path d="' + pl(lens(cx, cy, 20, 43, 30), true) + '" stroke-width="1.5"/>';
    o += '<path d="' + pl(lens(cx, cy, 23.5, 48, 30), true) + '" stroke-width=".8"/>';
    var hatch = '';
    for (k = -11; k <= 11; k += 2.2) hatch += 'M' + n(cx + k) + ' ' + (cy - 12) + 'V' + (cy + 12);
    o += '<g clip-path="url(#' + P + 'ir)"><path d="' + hatch + '" stroke-width=".7"/></g>';
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="11.5" stroke-width="1.2"/>';
    o += '<path d="' + pl(lens(cx, cy, 2.6, 10, 10), true) + '" fill="' + INK + '"/>';
    o += '<circle cx="' + (cx - 4.5) + '" cy="' + (cy - 5) + '" r="2.4" fill="#f1ead6" stroke="none"/>';
    // 标注
    o += '<path d="M646 222C610 214 520 222 431 238" stroke-width=".8" stroke-dasharray="3 2"/><path d="M438 232L429 238.5L439 242" stroke-width=".8"/>';
    o += '<text x="650" y="228" ' + F + ' font-size="15" fill="' + INK + '" stroke="none">竖目</text>';
    o += '<path d="M400 398V404H562V398M481 404V410" stroke-width=".8"/>';
    o += '<text x="481" y="425" ' + F + ' font-size="13" fill="' + INK + '" stroke="none" text-anchor="middle">锯齿五重</text>';
    // 墨点
    o += '<circle cx="203" cy="96" r="1.4" fill="' + INK + '"/><circle cx="598" cy="388" r="1.3" fill="' + INK + '"/>';

    return open() + '<defs>' + deskDefs(P) + inkF(P + 'ink', 21, -0.6, 1.25) +
      '<pattern id="' + P + 'g" width="28" height="36" patternUnits="userSpaceOnUse" x="120" y="48"><path d="M0 .5H28M0 27.5H28M.5 0V28" fill="none" stroke="' + G + '" stroke-width=".8"/></pattern>' +
      '<clipPath id="' + P + 'ir"><circle cx="' + cx + '" cy="' + cy + '" r="11.5"/></clipPath></defs>' +
      desk(P, 76, 22, 648, 556, -0.7, '#f1ead6') +
      '<g opacity=".55"><rect x="120" y="48" width="560" height="504" fill="url(#' + P + 'g)"/>' +
      '<rect x="114" y="42" width="572" height="514" fill="none" stroke="' + G + '" stroke-width="1.6"/>' +
      '<text x="686" y="570" font-family="Songti SC, STSong, SimSun, serif" font-size="9" fill="' + G + '" text-anchor="end">20×14=280</text></g>' +
      '<g fill="none" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".93" filter="url(#' + P + 'ink)">' + o + '</g>' +
      '</g></svg>';
  };

  /* ================= map1935：地图翻拍 ================= */
  DOC.map1935 = function () {
    var P = 'dm35-', R = U.rng(1935), INK = '#2d251d', PAPER = '#e6d4a4', ROAD = '#ecdcb0', RED = '#a8583f', WATER = '#9db1a6';
    var F = 'font-family="Songti SC, STSong, SimSun, serif"', HALO = ' stroke="' + PAPER + '" stroke-width="3.2" paint-order="stroke"';
    var o = '', i, k;
    function jl(a, b, m, amt) { // 带轻微弯折的线
      var pts = [];
      for (var j = 0; j <= m; j++) { var t = j / m; pts.push([a[0] + (b[0] - a[0]) * t + (j && j < m ? (R() - 0.5) * amt : 0), a[1] + (b[1] - a[1]) * t + (j && j < m ? (R() - 0.5) * amt : 0)]); }
      return pts;
    }
    // 道路
    var roads = [], lanes = '';
    [70, 138, 206, 262].forEach(function (y) { roads.push([pl(jl([40, y + (R() - 0.5) * 10], [766, y + (R() - 0.5) * 16], 4, 10)), 5]); });
    [96, 172, 252, 334, 612, 696].forEach(function (x) { roads.push([pl(jl([x, 36], [x + 14, 566], 5, 8)), 5]); });
    roads.push([pl(cr([[446, 566], [438, 400], [442, 250], [456, 36]], 6)), 9.5]); // 宝山路
    roads.push([pl(cr([[40, 392], [260, 398], [520, 388], [766, 402]], 6)), 9]);   // 虬江路
    roads.push([pl(jl([40, 238], [330, 156], 3, 6)), 4]);
    for (i = 0; i < 46; i++) { // 里弄
      var lx = 50 + R() * 700, ly = 50 + R() * 500, hz = R() < 0.55, L = 14 + R() * 26;
      lanes += 'M' + n(lx) + ' ' + n(ly) + (hz ? 'h' + n(L) : 'v' + n(L));
    }
    var rInk = '', rIn = '';
    roads.forEach(function (r) {
      rInk += '<path d="' + r[0] + '" stroke-width="' + (r[1] + 2.4) + '"/>';
      rIn += '<path d="' + r[0] + '" stroke-width="' + r[1] + '"/>';
    });
    o += '<rect x="40" y="36" width="726" height="530" fill="url(#' + P + 'h)" opacity=".75"/>';
    o += '<g fill="none" stroke="' + INK + '" opacity=".6"><path d="' + lanes + '" stroke-width="3.6"/></g><path d="' + lanes + '" fill="none" stroke="' + ROAD + '" stroke-width="1.6"/>';
    o += '<g fill="none" stroke="' + INK + '">' + rInk + '</g><g fill="none" stroke="' + ROAD + '">' + rIn + '</g>';
    // 苏州河
    var creek = cr([[40, 452], [140, 478], [235, 494], [330, 470], [420, 452], [505, 482], [590, 510], [680, 494], [766, 468]], 8);
    var cd = pl(creek);
    o += '<path d="' + cd + '" fill="none" stroke="' + INK + '" stroke-width="28"/><path d="' + cd + '" fill="none" stroke="' + WATER + '" stroke-width="25"/>';
    o += '<path d="' + cd + '" fill="none" stroke="' + INK + '" stroke-width=".7" stroke-dasharray="7 6" opacity=".55"/>';
    // 桥
    [[180, 488], [446, 461], [612, 508]].forEach(function (b) {
      o += '<path d="M' + (b[0] - 5) + ' ' + (b[1] - 19) + 'v38M' + (b[0] + 5) + ' ' + (b[1] - 19) + 'v38" stroke="' + INK + '" stroke-width="1.3"/>' +
        '<rect x="' + (b[0] - 4.4) + '" y="' + (b[1] - 18) + '" width="8.8" height="36" fill="' + ROAD + '"/>';
    });
    // 洼地 + 邱家塘
    var marsh = [], pond = [];
    for (i = 0; i < 16; i++) { var a = i / 16 * PI2; marsh.push([672 + Math.cos(a) * (92 + (R() - 0.5) * 26), 182 + Math.sin(a) * (80 + (R() - 0.5) * 22)]); }
    for (i = 0; i < 14; i++) { var b2 = i / 14 * PI2; pond.push([668 + Math.cos(b2) * (50 + (R() - 0.5) * 16), 176 + Math.sin(b2) * (36 + (R() - 0.5) * 12)]); }
    o += '<path d="' + pl(cr(marsh, 5, true), true) + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".9" stroke-dasharray="2 3"/>';
    for (i = 0; i < 26; i++) {
      var ma = R() * PI2, mr = 0.62 + R() * 0.33, tx = 672 + Math.cos(ma) * 88 * mr, ty = 182 + Math.sin(ma) * 76 * mr;
      o += '<use href="#' + P + 'tf" x="' + n(tx) + '" y="' + n(ty) + '"/>';
    }
    var pd = pl(cr(pond, 5, true), true);
    o += '<path d="' + pd + '" fill="' + WATER + '"/><path d="' + pd + '" fill="url(#' + P + 'w)"/><path d="' + pd + '" fill="none" stroke="' + INK + '" stroke-width="1.3"/>';
    o += '<path d="M592 240C620 232 640 250 668 244M700 262C712 240 740 236 766 238" fill="none" stroke="' + INK + '" stroke-width=".8" stroke-dasharray="4 3"/>';
    // 铁路（沪宁 + 淞沪）
    var rail = pl(cr([[40, 318], [250, 322], [420, 330], [468, 334]], 6)) + pl(cr([[480, 330], [516, 288], [538, 210], [554, 120], [566, 36]], 6));
    o += '<path d="M380 326L470 334M380 330L470 338" stroke="' + INK + '" stroke-width="1"/>';
    o += '<path d="' + rail + '" fill="none" stroke="' + INK + '" stroke-width="5.6"/><path d="' + rail + '" fill="none" stroke="' + ROAD + '" stroke-width="3" stroke-dasharray="9 9"/>';
    o += '<rect x="452" y="339" width="46" height="12" fill="' + INK + '"/>';
    // 地名
    o += '<g ' + F + ' fill="' + INK + '">';
    o += '<text x="208" y="232" font-size="30" letter-spacing="22" opacity=".85"' + HALO + '>閘北</text>';
    o += '<text x="96" y="476" font-size="15" letter-spacing="6" transform="rotate(12 96 476)"' + HALO + '>蘇州河</text>';
    o += '<text x="475" y="368" font-size="12" text-anchor="middle"' + HALO + '>上海北站</text>';
    o += '<text x="668" y="182" font-size="16" text-anchor="middle" font-weight="bold" stroke="' + WATER + '" stroke-width="3" paint-order="stroke">邱家塘</text>';
    o += '<text x="712" y="286" font-size="12"' + HALO + '>三層樓</text>';
    o += '<text x="112" y="315" font-size="9" letter-spacing="3"' + HALO + '>滬寧鐵路</text>';
    ['寶', '山', '路'].forEach(function (c, j) { o += '<text x="441" y="' + (152 + j * 12) + '" font-size="9.5" text-anchor="middle">' + c + '</text>'; });
    o += '<text x="560" y="395.5" font-size="9" letter-spacing="5">虬江路</text>';
    // 图题
    o += '<rect x="50" y="44" width="52" height="124" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="1.2"/><rect x="54" y="48" width="44" height="116" fill="none" stroke="' + INK + '" stroke-width=".5"/>';
    ['上', '海', '市', '街', '圖'].forEach(function (c, j) { o += '<text x="84" y="' + (70 + j * 19) + '" font-size="16" text-anchor="middle" font-weight="bold">' + c + '</text>'; });
    ['民', '國', '廿', '四', '年'].forEach(function (c, j) { o += '<text x="64" y="' + (100 + j * 11) + '" font-size="8.5" text-anchor="middle">' + c + '</text>'; });
    // 比例尺
    o += '<rect x="628" y="530" width="124" height="28" fill="' + PAPER + '" stroke="' + INK + '" stroke-width=".8"/><path d="M638 546h100" stroke="' + INK + '" stroke-width="4"/><path d="M663 546h25M713 546h25" stroke="' + PAPER + '" stroke-width="2.6"/>';
    o += '<text x="638" y="540" font-size="7">〇</text><text x="738" y="540" font-size="7" text-anchor="end">五百公尺</text>';
    o += '</g>';

    // 外框（黑白分格）
    var fr = '<rect x="32" y="28" width="742" height="546" fill="none" stroke="' + INK + '" stroke-width="1.6"/><rect x="40" y="36" width="726" height="530" fill="none" stroke="' + INK + '" stroke-width="1"/>', seg = '';
    for (i = 40; i < 766; i += 36) seg += 'M' + i + ' 32h18M' + i + ' 570h18';
    for (i = 36; i < 566; i += 36) seg += 'M36 ' + i + 'v18M770 ' + i + 'v18';
    fr += '<path d="' + seg + '" stroke="' + INK + '" stroke-width="6"/>';

    return open() + '<defs>' +
      noiseF(P + 'gr', 0.8, 2, 13, [0.25, 0.2, 0.14], 1.0, -0.4) +
      noiseF(P + 'mt', 0.009, 3, 6, [0.42, 0.3, 0.15], 0.8, -0.28) +
      '<pattern id="' + P + 'h" width="4.2" height="4.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 2.1H4.2" stroke="' + RED + '" stroke-width="1.15"/></pattern>' +
      '<pattern id="' + P + 'w" width="16" height="7" patternUnits="userSpaceOnUse"><path d="M2 3.5q2-1.6 4 0t4 0" fill="none" stroke="' + INK + '" stroke-width=".6"/></pattern>' +
      '<g id="' + P + 'tf" stroke="' + INK + '" stroke-width=".7" fill="none"><path d="M-4 0h8M-2.5 0l-1.5-5M0 0v-6M2.5 0l1.5-5"/></g>' +
      '<clipPath id="' + P + 'c"><rect x="40" y="36" width="726" height="530"/></clipPath>' +
      '<radialGradient id="' + P + 'vg" cx="46%" cy="44%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1a0f00" stop-opacity=".55"/></radialGradient>' +
      '<linearGradient id="' + P + 'lt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3a2400" stop-opacity=".18"/></linearGradient>' +
      '</defs>' +
      '<rect width="800" height="600" fill="#191613"/>' +
      '<g transform="rotate(.6 400 300)">' +
      '<rect x="18" y="12" width="770" height="580" fill="' + PAPER + '"/>' +
      '<g clip-path="url(#' + P + 'c)">' + o + '</g>' + fr +
      crease(18, 300, 788, 302) + '<path d="M402 12L401 592" stroke="#fff" stroke-width="1" opacity=".45"/><path d="M404 12L403 592" stroke="#000" stroke-width="2" opacity=".07"/>' +
      '<rect x="18" y="12" width="770" height="580" fill="#000" filter="url(#' + P + 'mt)"/>' +
      '<rect x="18" y="12" width="770" height="580" fill="#000" filter="url(#' + P + 'gr)"/>' +
      '<rect x="18" y="12" width="770" height="580" fill="url(#' + P + 'lt)"/>' +
      '</g><rect width="800" height="600" fill="url(#' + P + 'vg)"/></svg>';
  };

  /* ================= auction：报纸拍卖广告 ================= */
  DOC.auction = function () {
    var P = 'dau-', INK = '#26221e', NP = '#e3dccb', F = 'font-family="Songti SC, STSong, SimSun, serif"', o = '', i;
    // —— 照片（网点）——
    var cx = 280, rimY = 212;
    var body = 'M116 ' + rimY + 'C112 300 150 392 202 424L358 424C410 392 448 300 444 ' + rimY + 'Z';
    function band(y1, y2, sag) { // 两条下垂弧之间的环带
      return 'M100 ' + y1 + 'Q' + cx + ' ' + (y1 + sag * 2) + ' 460 ' + y1 + 'L460 ' + y2 + 'Q' + cx + ' ' + (y2 + sag * 2) + ' 100 ' + y2 + 'Z';
    }
    var ph = '<rect x="92" y="150" width="376" height="318" fill="url(#' + P + 'bd)"/>' +
      '<ellipse cx="292" cy="436" rx="170" ry="20" fill="#111" opacity=".7" filter="url(#' + P + 'sb)"/>' +
      '<path d="' + body + '" fill="#8a8a8a"/>' +
      '<g clip-path="url(#' + P + 'bc)">' +
      '<path d="' + band(226, 246, 10) + '" fill="url(#' + P + 'k1)"/>' +
      '<path d="' + band(256, 344, 12) + '" fill="url(#' + P + 'k2)"/>' +
      '<path d="' + band(356, 384, 9) + '" fill="url(#' + P + 'k1)"/>' +
      '<path d="' + band(390, 412, 7) + '" fill="url(#' + P + 'k3)"/>' +
      '<g fill="none" stroke="#1d1d1d" stroke-width="1.4">';
    [224, 248, 254, 346, 354, 386].forEach(function (y, j) {
      var s = [10, 10, 12, 12, 9, 9][j];
      ph += '<path d="M100 ' + y + 'Q' + cx + ' ' + (y + s * 2) + ' 460 ' + y + '"/>';
    });
    ph += '</g><rect x="100" y="200" width="360" height="240" fill="url(#' + P + 'sd)"/></g>' +
      '<rect x="202" y="422" width="156" height="12" fill="#5a5a5a"/><ellipse cx="' + cx + '" cy="434" rx="78" ry="6" fill="#3a3a3a"/>' +
      '<ellipse cx="' + cx + '" cy="' + rimY + '" rx="165" ry="30" fill="#d6d6d6"/>' +
      '<ellipse cx="' + cx + '" cy="' + (rimY + 1) + '" rx="152" ry="24" fill="url(#' + P + 'in)"/>' +
      '<path d="M130 206Q' + cx + ' 176 432 206" fill="none" stroke="#f2f2f2" stroke-width="2" opacity=".7"/>';
    ph += '<rect x="92" y="150" width="376" height="318" fill="url(#' + P + 'dt)" opacity=".5"/>';

    // —— 正文 ——
    var copy = '本公司秋季艺术珍品拍卖会汇集历代瓷器、陶器、玉器、书画及文房杂项七百余件，其中不乏海内外藏家珍藏多年、首次公开亮相之精品。压轴拍品明仿沈秀纳财盆，陶质，器形敦厚古拙，貌不惊人，然盆身满布极纤细繁复之回纹，层层相套，细若发丝，非凑近细观不能辨识。原器传出三国，此为明代仿制，流传有绪，品相完好。欢迎各界人士莅临预展，届时备有图录，凭本广告可免费入场。';
    var lines = [], per = 20;
    for (i = 0; i < copy.length;) { var e = i + per; if ('，。、；：'.indexOf(copy.charAt(e)) >= 0) e++; lines.push(copy.slice(i, e)); i = e; }
    var tx = '<text x="496" y="216" ' + F + ' font-size="10.3" fill="' + INK + '">';
    lines.forEach(function (l, j) { tx += '<tspan x="' + (j ? 496 : 506) + '" y="' + (216 + j * 17) + '">' + l + '</tspan>'; });
    tx += '</text>';

    o += '<path d="M66 60H734M66 64H734" stroke="' + INK + '" stroke-width="1.2"/>';
    o += '<text x="400" y="110" ' + F + ' font-size="40" font-weight="bold" text-anchor="middle" letter-spacing="2" fill="' + INK + '">秋季艺术珍品拍卖会</text>';
    o += '<path d="M66 128H734" stroke="' + INK + '" stroke-width="2.4"/><path d="M66 133H734" stroke="' + INK + '" stroke-width=".7"/>';
    o += '<rect x="496" y="148" width="68" height="30" fill="' + INK + '"/><text x="530" y="170" ' + F + ' font-size="20" font-weight="bold" fill="' + NP + '" text-anchor="middle" letter-spacing="4">预展</text>';
    o += '<text x="574" y="170" ' + F + ' font-size="13" fill="' + INK + '">敬请莅临 · 免费参观</text>';
    o += '<text x="496" y="198" ' + F + ' font-size="15" font-weight="bold" fill="' + INK + '">压轴拍品</text>';
    o += tx;
    o += '<path d="M496 404H724" stroke="' + INK + '" stroke-width=".7"/>';
    o += '<text ' + F + ' font-size="11" fill="' + INK + '"><tspan x="496" y="424">预展：拍卖日前三天</tspan><tspan x="496" y="442">地点：本公司展厅</tspan><tspan x="496" y="460">图录备索</tspan></text>';
    o += '<rect x="90" y="148" width="380" height="322" fill="none" stroke="' + INK + '" stroke-width="1"/>';
    o += '<text x="280" y="492" ' + F + ' font-size="15" fill="' + INK + '" text-anchor="middle" letter-spacing="3">明仿沈秀纳财盆</text>';
    o += '<path d="M480 150V470" stroke="' + INK + '" stroke-width=".6"/>';
    o += '<path d="M66 508H734" stroke="' + INK + '" stroke-width="1.2"/>';
    o += '<text ' + F + ' font-size="9.2" fill="' + INK + '" opacity=".85"><tspan x="70" y="526">启事：本报所载各类广告，内容由刊登者负责，读者请自行核实。</tspan><tspan x="70" y="541">分类广告受理 · 房产 · 家政 · 求职 · 遗失声明 · 寻人启事</tspan></text>';

    return open() + '<defs>' + deskDefs(P) +
      '<linearGradient id="' + P + 'bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e6e6e"/><stop offset=".62" stop-color="#b8b8b8"/><stop offset="1" stop-color="#d4d4d4"/></linearGradient>' +
      '<linearGradient id="' + P + 'sd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".12" stop-color="#000" stop-opacity=".1"/><stop offset=".3" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>' +
      '<radialGradient id="' + P + 'in" cx="50%" cy="80%" r="70%"><stop offset="0" stop-color="#6a6a6a"/><stop offset="1" stop-color="#2a2a2a"/></radialGradient>' +
      '<filter id="' + P + 'sb" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>' +
      '<clipPath id="' + P + 'bc"><path d="' + body + '"/></clipPath>' +
      // 回纹（小）/ 云雷纹（大）/ 蕉叶
      '<pattern id="' + P + 'k1" width="12" height="12" patternUnits="userSpaceOnUse" y="229"><rect width="12" height="12" fill="#a0a0a0"/><path d="M1 11V1H11V9H4V4H8V7" fill="none" stroke="#1a1a1a" stroke-width="1.1"/></pattern>' +
      '<pattern id="' + P + 'k2" width="40" height="22" patternUnits="userSpaceOnUse" y="262"><rect width="40" height="22" fill="#9a9a9a"/><path d="M2 20V2H18V17H6V6H14V13H10V10M22 2V20H38V5H26V16H34V9H30V12" fill="none" stroke="#161616" stroke-width="1.2"/></pattern>' +
      '<pattern id="' + P + 'k3" width="14" height="22" patternUnits="userSpaceOnUse" y="390"><rect width="14" height="22" fill="#8c8c8c"/><path d="M0 22L7 3L14 22M7 7V22" fill="none" stroke="#1a1a1a" stroke-width="1"/></pattern>' +
      '<radialGradient id="' + P + 'dg" r=".71"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>' +
      '<pattern id="' + P + 'dt" width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.6" height="3.6" fill="url(#' + P + 'dg)"/></pattern>' +
      '<filter id="' + P + 'ht" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/>' +
      '<feComponentTransfer><feFuncR type="discrete" tableValues="0.15 0.89"/><feFuncG type="discrete" tableValues="0.14 0.86"/><feFuncB type="discrete" tableValues="0.12 0.8"/></feComponentTransfer><feGaussianBlur stdDeviation=".3"/></filter>' +
      '</defs>' +
      desk(P, 52, 36, 696, 528, 1.1, NP) +
      '<g filter="url(#' + P + 'ht)">' + ph + '</g>' + o +
      '<rect x="52" y="36" width="696" height="528" fill="#000" filter="url(#' + P + 'gr)"/>' +
      '</g></svg>';
  };

  /* ================= weimap：复印件 ================= */
  DOC.weimap = function () {
    var P = 'dwm-', R = U.rng(3721), i, N = 120, C = [400, 300];
    var outer = [], ang = [];
    for (i = 0; i < N; i++) {
      var th = i / N * PI2, c = Math.cos(th);
      var r = 1 + 0.12 * Math.sin(2 * th + 1.3) + 0.08 * Math.sin(3 * th + 0.4) + 0.05 * Math.sin(5 * th + 2.1) + 0.03 * Math.sin(9 * th + 0.7);
      if (c > 0.15) r += (R() - 0.5) * 0.07 * c + 0.04 * Math.sin(17 * th) * c;
      outer.push([C[0] + 262 * r * Math.cos(th), C[1] + 206 * r * Math.sin(th)]);
      ang.push(th);
    }
    // 内图：沿外图左下内侧边缘贴着走，再从内部绕回
    var i1 = Math.round(N * 0.27), i2 = Math.round(N * 0.49), inner = [];
    for (i = i1; i <= i2; i++) {
      var p = outer[i], dx = p[0] - C[0], dy = p[1] - C[1], d = Math.hypot(dx, dy), s = (d - 10) / d;
      inner.push([C[0] + dx * s + (R() - 0.5) * 1.5, C[1] + dy * s + (R() - 0.5) * 1.5]);
    }
    var ends = [ang[i2], ang[i1]], back = [0.7, 0.52, 0.56, 0.42, 0.47, 0.6, 0.68];
    for (i = 0; i < back.length; i++) {
      var t = (i + 1) / (back.length + 1), a2 = ends[0] + (ends[1] - ends[0]) * t, ref = outer[Math.round(a2 / PI2 * N) % N];
      inner.push([C[0] + (ref[0] - C[0]) * back[i] + (R() - 0.5) * 14, C[1] + (ref[1] - C[1]) * back[i] + (R() - 0.5) * 14]);
    }
    var ii = cr(inner.slice(0, i2 - i1 + 1), 3).concat(inner.slice(i2 - i1 + 1)), od = pl(cr(outer, 2, true), true), id = pl(ii, true);
    var o = '<path d="' + od + '" fill="none" stroke="#141414" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<path d="' + pl(wob(cr(outer.slice(10, 70), 2), R, 1.2)) + '" fill="none" stroke="#141414" stroke-width="1.2" opacity=".8"/>' +
      '<path d="' + id + '" fill="none" stroke="#484848" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="' + pl(wob(cr(inner.slice(0, 8), 3), R, 0.8)) + '" fill="none" stroke="#565656" stroke-width=".9" opacity=".8"/>';
    var holes = '';
    [170, 430].forEach(function (y) { holes += '<circle cx="36" cy="' + y + '" r="11" fill="#1c1c1c"/><circle cx="36" cy="' + y + '" r="12.5" fill="none" stroke="#444" stroke-width="2" opacity=".6"/>'; });
    return open() + '<defs>' +
      noiseF(P + 'mt', 0.02, 2, 4, [0.2, 0.2, 0.2], 0.35, -0.12) + noiseF(P + 'gn', 0.6, 2, 7, [0.15, 0.15, 0.15], 0.9, -0.33) +
      '<filter id="' + P + 'sp" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="1" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 .1 0 0 0 0 .1 0 0 0 0 .1 0 0 0 4 -2.1"/>' +
      '<feComponentTransfer><feFuncA type="discrete" tableValues="0 0 0 .8"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<filter id="' + P + 'tn" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.6" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".4"/></filter>' +
      '<linearGradient id="' + P + 'lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050505"/><stop offset=".35" stop-color="#1a1a1a" stop-opacity=".75"/><stop offset="1" stop-color="#555" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + P + 'tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0a0a"/><stop offset="1" stop-color="#333" stop-opacity="0"/></linearGradient>' +
      '<filter id="' + P + 'eb"><feGaussianBlur stdDeviation="2.5"/></filter>' +
      '</defs>' +
      '<rect width="800" height="600" fill="#dcdbd6"/>' +
      '<rect width="800" height="600" fill="#000" filter="url(#' + P + 'mt)"/><rect width="800" height="600" fill="#000" filter="url(#' + P + 'gn)"/>' +
      '<g transform="rotate(-.8 400 300)" filter="url(#' + P + 'tn)">' + o + holes + '</g>' +
      '<path d="M0 118H800M0 471H800" stroke="#888" stroke-width="1" opacity=".35"/><path d="M0 331H800" stroke="#fff" stroke-width="2" opacity=".35"/>' +
      '<rect width="800" height="600" fill="#000" filter="url(#' + P + 'sp)"/>' +
      '<rect x="0" y="0" width="74" height="600" fill="url(#' + P + 'lg)"/>' +
      '<path d="M0 0H800V9Q600 15 400 8T0 12Z" fill="url(#' + P + 'tg)" filter="url(#' + P + 'eb)"/>' +
      '<path d="M792 0H800V600H795Z" fill="#111"/><path d="M0 594H800V600H0Z" fill="#222" opacity=".8"/>' +
      '</svg>';
  };
})();
