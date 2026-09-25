/*
 * CG（第二批）：
 *   cg_heart  旧纸上的考古测绘平面图——四个墓室连起来恰是行书“心”字，上叠淡朱红毛笔“心”
 * 所有 id 带前缀 cgh-；不引用外部资源。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var PI2 = Math.PI * 2;

  function num(v) { return String(v).replace(/^(-?)0\./, '$1.'); }
  function pl(pts, close) { // 相对坐标折线
    var X = Math.round(pts[0][0] * 10), Y = Math.round(pts[0][1] * 10), s = 'M' + X / 10 + ' ' + Y / 10 + 'l';
    for (var i = 1; i < pts.length; i++) {
      var x = Math.round(pts[i][0] * 10), y = Math.round(pts[i][1] * 10), a = num((x - X) / 10), b = num((y - Y) / 10);
      s += (i === 1 || a[0] === '-' ? '' : ' ') + a + (b[0] === '-' ? '' : ' ') + b;
      X = x; Y = y;
    }
    return s + (close ? 'Z' : '');
  }
  function cr(pts, k) { // Catmull-Rom（开放）
    var out = [], L = pts.length;
    for (var i = 0; i < L - 1; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, L - 1)];
      for (var j = 0; j < k; j++) {
        var t = j / k, t2 = t * t, t3 = t2 * t, q = [];
        for (var c = 0; c < 2; c++) q.push(0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3));
        out.push(q);
      }
    }
    out.push(pts[L - 1].slice());
    return out;
  }
  /** 水滴：尖端 T，圆心 C，半径 r */
  function drop(T, C, r, m) {
    var dx = T[0] - C[0], dy = T[1] - C[1], d = Math.hypot(dx, dy), base = Math.atan2(dy, dx), al = Math.acos(r / d), pts = [T];
    for (var i = 0; i <= m; i++) { var a = base + al + (PI2 - 2 * al) * i / m; pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r]); }
    return pts;
  }
  /** 沿中线按宽度函数生成笔触轮廓 */
  function ribbon(line, wf) {
    var L = [], Rr = [], n = line.length;
    for (var i = 0; i < n; i++) {
      var a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, n - 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1,
        w = wf(i / (n - 1)) / 2, nx = -dy / d, ny = dx / d;
      L.push([line[i][0] + nx * w, line[i][1] + ny * w]);
      Rr.push([line[i][0] - nx * w, line[i][1] - ny * w]);
    }
    return L.concat(Rr.reverse());
  }
  function sq(cx, cy, s, rot) {
    var c = Math.cos(rot), si = Math.sin(rot), h = s / 2;
    return [[-h, -h], [h, -h], [h, h], [-h, h]].map(function (p) { return [cx + p[0] * c - p[1] * si, cy + p[0] * si + p[1] * c]; });
  }
  function circ(cx, cy, r, m) { var p = []; for (var i = 0; i < m; i++) p.push([cx + Math.cos(i / m * PI2) * r, cy + Math.sin(i / m * PI2) * r]); return p; }

  GF.art.cg.cg_heart = function () {
    var P = 'cgh-', R = U.rng(1937), INK = '#3a2e22', PAPER = '#e7dbbd', BX = 890, BY = 800, BS = 1040;
    var F = 'font-family="Songti SC, STSong, SimSun, serif"';

    /* ---------- 几何：按“心”的四笔排布 ---------- */
    var hookLine = cr([[575, 372], [588, 470], [632, 580], [718, 660], [850, 702], [990, 692], [1108, 642], [1196, 572]], 8);
    var hookPoly = ribbon(hookLine, function (t) { return 34 + 40 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62); });
    var E = hookLine[hookLine.length - 1], nH = hookLine.length;
    var tri = [hookPoly[nH - 1], [E[0] + 14, E[1] - 11], [1036, 492], hookPoly[nH + 6]];
    var dropCh = drop([386, 404], [458, 488], 50, 22);
    var circCh = circ(788, 336, 54, 36);
    var sqCh = sq(1133, 340, 116, 0.2);
    var closed = [dropCh, hookPoly, tri, circCh, sqCh].map(function (p) { return pl(p, true); });
    // 通道（中线 + 宽度）
    var corr = [
      [pl(cr([[196, 236], [290, 318], [396, 414]], 6)), 36],       // 入口斜坡
      [pl(cr([[486, 456], [530, 410], [584, 386]], 5)), 22],       // 点一 → 卧钩起笔
      [pl(cr([[1044, 490], [940, 420], [836, 362]], 5)), 20],      // 钩尖 → 中点
      [pl(cr([[822, 300], [950, 302], [1078, 326]], 5)), 20]       // 中点 → 棺室
    ];
    function layer(wAdd, attr, fillClosed) {
      var s = '<g fill="none" ' + attr + '>';
      closed.forEach(function (d) { s += '<path d="' + d + '"' + (fillClosed ? ' fill="url(#' + P + 'fl)" stroke="none"' : ' stroke-width="' + wAdd + '"') + '/>'; });
      corr.forEach(function (c) { s += '<path d="' + c[0] + '" stroke-width="' + (c[1] + (fillClosed ? 0 : wAdd)) + '"' + (fillClosed ? ' stroke="url(#' + P + 'fl)"' : '') + '/>'; });
      return s + '</g>';
    }
    var plan = layer(28, 'stroke="' + INK + '"') + layer(24.5, 'stroke="' + PAPER + '"') + layer(24.5, 'stroke="url(#' + P + 'ha)"') +
      layer(4.4, 'stroke="' + INK + '"') + layer(0, '', true);
    // 入口台阶
    var steps = '';
    for (var k = 0; k < 7; k++) {
      var t = 0.06 + k * 0.075, x = 196 + (396 - 196) * t, y = 236 + (414 - 236) * t, nx = -0.664, ny = 0.746;
      steps += 'M' + Math.round(x + nx * 17) + ' ' + Math.round(y + ny * 17) + 'L' + Math.round(x - nx * 17) + ' ' + Math.round(y - ny * 17);
    }
    plan += '<path d="' + steps + '" stroke="' + INK + '" stroke-width="1.3"/>';
    // 棺
    plan += '<path d="' + pl(sq(1135, 342, 70, 0.2), true) + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<path d="' + pl(sq(1135, 342, 56, 0.2), true) + '" fill="none" stroke="' + INK + '" stroke-width=".9" stroke-dasharray="5 4"/>';
    // 圆室中央的圆台、泪滴室的凹坑
    plan += '<circle cx="788" cy="336" r="16" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-dasharray="4 3"/>' +
      '<ellipse cx="462" cy="492" rx="14" ry="10" fill="none" stroke="' + INK + '" stroke-width="1" stroke-dasharray="3 3"/>';
    // 行进方向小箭头（沿中线）
    var arrows = '';
    [[0.18, hookLine], [0.52, hookLine], [0.86, hookLine]].forEach(function (a) {
      var L2 = a[1], i = Math.floor(a[0] * (L2.length - 1)), p = L2[i], q = L2[i + 1], ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
      arrows += '<path d="M-7 -5L4 0L-7 5" transform="translate(' + Math.round(p[0]) + ' ' + Math.round(p[1]) + ') rotate(' + Math.round(ang) + ')"/>';
    });
    plan += '<g fill="none" stroke="' + INK + '" stroke-width="1.3" opacity=".7">' + arrows + '</g>';

    /* ---------- 标注 ---------- */
    var lab = '<g ' + F + ' font-size="21" fill="' + INK + '">' +
      '<text x="196" y="214">入口</text>' +
      '<path d="M840 742V770M760 770H940" stroke="' + INK + '" stroke-width="1" fill="none"/><text x="850" y="796" text-anchor="middle">墓道</text>' +
      '<path d="M1250 300L1290 262H1340" stroke="' + INK + '" stroke-width="1" fill="none"/><text x="1298" y="254">棺室</text></g>';
    // 指北针 + 比例尺
    lab += '<g stroke="' + INK + '" fill="none" stroke-width="1.4"><circle cx="130" cy="120" r="30"/><path d="M130 78V162M88 120H172"/>' +
      '<path d="M130 80L120 124H140Z" fill="' + INK + '"/></g><text x="130" y="72" ' + F + ' font-size="18" fill="' + INK + '" text-anchor="middle">北</text>';
    lab += '<g stroke="' + INK + '" stroke-width="1.2"><rect x="110" y="818" width="200" height="8" fill="' + PAPER + '"/><path d="M110 822h50M210 822h50" stroke-width="8"/></g>' +
      '<text ' + F + ' font-size="14" fill="' + INK + '"><tspan x="106" y="846">0</tspan><tspan x="296" y="846">5 米</tspan></text>';

    /* ---------- 朱红毛笔“心” ---------- */
    /* ---------- 纸 ---------- */
    var stains = '';
    for (k = 0; k < 5; k++) {
      stains += '<ellipse cx="' + Math.round(100 + R() * 1400) + '" cy="' + Math.round(80 + R() * 740) + '" rx="' + Math.round(40 + R() * 120) + '" ry="' + Math.round(30 + R() * 90) + '" fill="url(#' + P + 'st)" opacity="' + (0.25 + R() * 0.35).toFixed(2) + '"/>';
    }

    var defs = '<defs>' +
      '<pattern id="' + P + 'g1" width="50" height="50" patternUnits="userSpaceOnUse" x="50" y="50"><path d="M0 .5H50M.5 0V50" fill="none" stroke="#8a765a" stroke-width=".7" opacity=".45"/></pattern>' +
      '<pattern id="' + P + 'g2" width="250" height="250" patternUnits="userSpaceOnUse" x="50" y="50"><path d="M0 .5H250M.5 0V250" fill="none" stroke="#7a6446" stroke-width="1.2" opacity=".5"/></pattern>' +
      '<pattern id="' + P + 'ha" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="' + PAPER + '"/><path d="M0 3.5H7" stroke="' + INK + '" stroke-width="1.1"/></pattern>' +
      '<pattern id="' + P + 'fl" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#ebe1c6"/><circle cx="3" cy="4" r=".9" fill="#8a7658"/><circle cx="11" cy="9" r=".7" fill="#8a7658"/><circle cx="6" cy="13" r=".6" fill="#8a7658"/></pattern>' +
      '<radialGradient id="' + P + 'st"><stop offset="0" stop-color="#b08a50" stop-opacity=".12"/><stop offset=".8" stop-color="#a07a40" stop-opacity=".2"/><stop offset=".9" stop-color="#8a6230" stop-opacity=".22"/><stop offset="1" stop-color="#8a6230" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + P + 'vg" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#5a3a10" stop-opacity="0"/><stop offset="1" stop-color="#3a2408" stop-opacity=".55"/></radialGradient>' +
      '<filter id="' + P + 'gr" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 .3 0 0 0 0 .24 0 0 0 0 .15 0 0 0 .9 -.34"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<filter id="' + P + 'mt" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="4" seed="12"/><feColorMatrix type="matrix" values="0 0 0 0 .45 0 0 0 0 .33 0 0 0 0 .16 0 0 0 .8 -.28"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<filter id="' + P + 'br" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="16" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency=".5 .045" numOctaves="2" seed="4" result="s"/><feColorMatrix in="s" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 2" result="sa"/><feComposite in="d" in2="sa" operator="in"/></filter>' +
      '<filter id="' + P + 'rough" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.9 1.4" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>' +
      '</defs>';

    var inner = defs +
      '<rect width="1600" height="900" fill="' + PAPER + '"/>' +
      '<rect width="1600" height="900" fill="#000" filter="url(#' + P + 'mt)"/>' + stains +
      '<rect x="50" y="50" width="1500" height="800" fill="url(#' + P + 'g1)"/><rect x="50" y="50" width="1500" height="800" fill="url(#' + P + 'g2)"/>' +
      '<rect x="36" y="36" width="1528" height="828" fill="none" stroke="' + INK + '" stroke-width="2.4"/><rect x="46" y="46" width="1508" height="808" fill="none" stroke="' + INK + '" stroke-width=".9"/>' +
      '<g transform="translate(62 -6)" filter="url(#' + P + 'rough)">' + plan + '</g>' + lab +
      '<g opacity=".26" style="mix-blend-mode:multiply"><text x="' + BX + '" y="' + BY + '" font-size="' + BS + '" text-anchor="middle" font-family="Kaiti SC, STKaiti, KaiTi, serif" fill="#c0301c" filter="url(#' + P + 'br)">心</text></g>' +
      '<rect width="1600" height="900" fill="#000" filter="url(#' + P + 'gr)"/>' +
      '<path d="M800 0V900" stroke="#fff" stroke-width="1.5" opacity=".35"/><path d="M803 0V900" stroke="#000" stroke-width="3" opacity=".06"/>' +
      '<rect width="1600" height="900" fill="url(#' + P + 'vg)"/>';
    return U.svg(inner);
  };
})();
