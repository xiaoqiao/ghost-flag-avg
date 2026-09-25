/*
 * 背景（地点组）：龙华寺前院 / 方丈室旁静室 / 交通公园 / 希尔顿客房（白天 & 起风傍晚）/ 朵云轩预展厅 / 飞机客舱
 * 风格：扁平剧场感矢量插画——大块几何形、有限色板、光池与体积光、空气透视。
 * 每张图的 SVG 内部 id / class / keyframes 都带独立前缀，避免同页串色：
 *   bglh- 龙华寺  bgtr- 静室  bgtp- 交通公园  bghl- 希尔顿白天  bghw- 希尔顿起风  bgdy- 朵云轩  bgap- 飞机
 * 构图约定：下方 260px 会被对话框覆盖，视觉重心放在上 2/3。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var FONT = 'Songti SC, STSong, SimSun, serif';

  /* ---------------- 本文件小工具 ---------------- */
  function q(v) { return Math.round(v * 10) / 10; }
  function i0(v) { return Math.round(v); }
  function at(ex) { return ex ? ' ' + ex : ''; }
  function stops(a) {
    var s = '';
    for (var i = 0; i < a.length; i++) {
      s += '<stop offset="' + a[i][0] + '" stop-color="' + a[i][1] + '"' + (a[i][2] == null ? '' : ' stop-opacity="' + a[i][2] + '"') + '/>';
    }
    return s;
  }
  function lg(id, x1, y1, x2, y2, a, us) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' +
      (us ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(a) + '</linearGradient>';
  }
  function rg(id, cx, cy, r, a, us, ex) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
      (us ? ' gradientUnits="userSpaceOnUse"' : '') + at(ex) + '>' + stops(a) + '</radialGradient>';
  }
  function blur(id, sd) {
    return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }
  function R(x, y, w, h, f, ex) { return '<rect x="' + q(x) + '" y="' + q(y) + '" width="' + q(w) + '" height="' + q(h) + '" fill="' + f + '"' + at(ex) + '/>'; }
  function P(pts, f, ex) { var a = []; for (var i = 0; i < pts.length; i++) a.push(q(pts[i])); return '<polygon points="' + a.join(' ') + '" fill="' + f + '"' + at(ex) + '/>'; }
  function D(d, f, ex) { return '<path d="' + d + '" fill="' + f + '"' + at(ex) + '/>'; }
  function E(cx, cy, rx, ry, f, ex) { return '<ellipse cx="' + q(cx) + '" cy="' + q(cy) + '" rx="' + q(rx) + '" ry="' + q(ry) + '" fill="' + f + '"' + at(ex) + '/>'; }
  function C(cx, cy, r, f, ex) { return '<circle cx="' + q(cx) + '" cy="' + q(cy) + '" r="' + q(r) + '" fill="' + f + '"' + at(ex) + '/>'; }
  function L(x1, y1, x2, y2, st, w, ex) { return '<line x1="' + q(x1) + '" y1="' + q(y1) + '" x2="' + q(x2) + '" y2="' + q(y2) + '" stroke="' + st + '" stroke-width="' + w + '"' + at(ex) + '/>'; }
  function G(inner, ex) { return '<g' + at(ex) + '>' + inner + '</g>'; }
  function T(x, y, txt, size, f, ex) { return '<text x="' + q(x) + '" y="' + q(y) + '" font-family="' + FONT + '" font-size="' + size + '" fill="' + f + '"' + at(ex) + '>' + txt + '</text>'; }
  function url(id) { return 'url(#' + id + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* 无 fill 属性的整数圆（放进 <g fill=..> 里批量用，省字节） */
  function l0(x1, y1, x2, y2) { return '<line x1="' + i0(x1) + '" y1="' + i0(y1) + '" x2="' + i0(x2) + '" y2="' + i0(y2) + '"/>'; }
  function c0(cx, cy, r) { return '<circle cx="' + i0(cx) + '" cy="' + i0(cy) + '" r="' + i0(r) + '"/>'; }

  /* 树冠：cols = [暗, 中, 亮, ...]，(lx,ly) 指向光源；越亮的层越集中在受光一侧 */
  function canopy(r, cx, cy, w, h, cnt, cols, lx, ly, rmin, rmax) {
    var s = '';
    for (var k = 0; k < cols.length; k++) {
      var m = Math.round(cnt * Math.pow(0.66, k)), got = 0, tries = 0, g = '';
      while (got < m && tries < m * 8) {
        tries++;
        var a = r() * 6.2832, dd = Math.sqrt(r());
        var ux = Math.cos(a) * dd, uy = Math.sin(a) * dd;
        if (k > 0 && ux * lx + uy * ly < -0.3 + k * 0.3) continue;
        var rr = (rmin + r() * (rmax - rmin)) * (1 - k * 0.16);
        g += c0(cx + ux * w / 2, cy + uy * h / 2, rr);
        got++;
      }
      s += '<g fill="' + cols[k] + '">' + g + '</g>';
    }
    return s;
  }

  /* 一排瓦当（圆点），用 pattern 省字节 */
  function tileEnds(id, x, y, w, pitch, rad, col) {
    return {
      def: '<pattern id="' + id + '" x="' + q(x) + '" y="' + q(y) + '" width="' + pitch + '" height="' + (rad * 2 + 2) + '" patternUnits="userSpaceOnUse"><rect width="' + pitch + '" height="' + (rad * 2 + 2) + '" fill="#23282d"/><circle cx="' + pitch / 2 + '" cy="' + (rad + 1) + '" r="' + rad + '" fill="' + col + '"/></pattern>',
      el: R(x, y, w, rad * 2 + 2, url(id))
    };
  }

  function wrap(p, defs, css, body, vig) {
    return U.svg('<defs>' + defs + '</defs>' + (css ? '<style>' + css + '</style>' : '') + body + U.vignette(p, vig));
  }

  /* =====================================================================
   * 龙华寺前院：大雄宝殿、香炉青烟、黄墙黛瓦，夏日上午（日光自右上）
   * ===================================================================== */
  GF.art.bg.longhua = function () {
    var p = 'bglh', r = U.rng(7301), d = '', s = '';
    d += lg(p + '-sky', 0, 0, 0, 1, [[0, '#8a9ea6'], [0.45, '#bcc3bb'], [1, '#e8dfc6']]);
    d += rg(p + '-sun', 1480, -40, 900, [[0, '#fff8e2', 1], [0.22, '#fbe6b6', 0.6], [1, '#fbe6b6', 0]], true);
    d += lg(p + '-ray', 1, 0, 0, 1, [[0, '#fff2cc', 0.55], [0.6, '#fff2cc', 0.1], [1, '#fff2cc', 0]]);
    d += lg(p + '-haze', 0, 0, 0, 1, [[0, '#ece4cc', 0], [0.6, '#ece4cc', 0.6], [1, '#ece4cc', 0.15]]);
    d += lg(p + '-roofsh', 0, 0, 1, 0, [[0, '#000', 0.3], [0.55, '#000', 0.05], [1, '#fff0d0', 0.2]]);
    d += lg(p + '-roofv', 0, 0, 0, 1, [[0, '#fff', 0.1], [1, '#000', 0.25]]);
    d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#c2a86e'], [1, '#9c8552']]);
    d += lg(p + '-gnd', 0, 0, 0, 1, [[0, '#c0b7a1'], [1, '#877f70']]);
    d += lg(p + '-brz', 0, 0, 1, 0, [[0, '#2a241e'], [0.5, '#4f4230'], [0.82, '#a3844f'], [1, '#6e5a3a']]);
    d += lg(p + '-stone', 0, 0, 1, 0, [[0, '#7d786c'], [0.65, '#a9a293'], [1, '#d3cbb8']]);
    d += rg(p + '-glow', 0.5, 0.78, 0.8, [[0, '#f0bb52', 1], [0.4, '#9a6224', 0.55], [1, '#140f0c', 0]]);
    d += rg(p + '-mgl', 0.5, 0.4, 0.7, [[0, '#f4f1dc'], [1, '#c9cfae']]);
    d += '<pattern id="' + p + '-tile" width="11" height="60" patternUnits="userSpaceOnUse"><rect width="11" height="60" fill="#3d444b"/><rect x="7" width="4" height="60" fill="#23282e"/><rect x="1" width="1.6" height="60" fill="#6a757e" opacity=".5"/></pattern>';
    d += '<pattern id="' + p + '-lat" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#7e5a3c"/><rect x="1.7" y="1.7" width="6.3" height="6.3" fill="#2a1d15"/></pattern>';
    d += '<pattern id="' + p + '-stp" x="0" y="484" width="20" height="9" patternUnits="userSpaceOnUse"><rect width="20" height="5" fill="#d6ceb9"/><rect y="5" width="20" height="4" fill="#958d7b"/></pattern>';
    d += '<pattern id="' + p + '-bal" x="0" y="463" width="10" height="13" patternUnits="userSpaceOnUse"><rect x="3" width="3" height="13" fill="#b9b19e"/></pattern>';
    d += '<pattern id="' + p + '-dg" x="420" y="256" width="40" height="48" patternUnits="userSpaceOnUse"><rect x="5" y="8" width="30" height="6" fill="#6a3a2c"/><rect x="11" y="15" width="18" height="9" fill="#3f5a58"/><rect x="15" y="25" width="10" height="18" fill="#5e3228"/></pattern>';
    d += '<pattern id="' + p + '-dg2" x="340" y="352" width="30" height="22" patternUnits="userSpaceOnUse"><rect x="7" y="4" width="16" height="5" fill="#5a3226"/><rect x="11" y="10" width="8" height="10" fill="#3a4f4e"/></pattern>';
    d += blur(p + '-b8', 8) + blur(p + '-b4', 4) + blur(p + '-b2', 2) + blur(p + '-b20', 20);
    d += '<clipPath id="' + p + '-mg"><circle cx="150" cy="468" r="82"/></clipPath>';
    var te1 = tileEnds(p + '-te1', 452, 247, 696, 11, 3.8, '#474e55');
    var te2 = tileEnds(p + '-te2', 342, 344, 916, 11, 3.8, '#474e55');
    var te3 = tileEnds(p + '-te3', -10, 346, 1620, 10, 3.4, '#4a5057');
    d += te1.def + te2.def + te3.def;

    /* 天空、日光、薄云 */
    s += R(0, 0, 1600, 620, url(p + '-sky')) + R(0, 0, 1600, 620, url(p + '-sun'));
    s += G(E(360, 96, 300, 9, '#f6f0e0') + E(520, 120, 220, 6, '#f6f0e0') + E(980, 70, 260, 7, '#f6f0e0') + E(1180, 104, 200, 5, '#fff6e4'),
      'filter="' + url(p + '-b4') + '" opacity=".55"');

    /* 远景：龙华塔（空气透视，偏冷偏淡） */
    s += G(pagoda(178, 372, 34), 'opacity=".9"');

    /* 院墙后的古树 */
    s += canopy(r, 250, 300, 420, 190, 26, ['#5b6c62', '#718273', '#8fa08b', '#a9b59d'], 0.6, -0.8, 24, 46);
    s += canopy(r, 1350, 280, 480, 230, 28, ['#58695f', '#6f8171', '#8e9f89', '#b0bb9f'], 0.6, -0.8, 26, 50);
    s += canopy(r, 560, 250, 180, 110, 10, ['#627366', '#7a8b79', '#95a38f'], 0.6, -0.8, 18, 32);
    s += canopy(r, 1050, 240, 200, 120, 10, ['#627366', '#7a8b79', '#98a792'], 0.6, -0.8, 18, 32);
    s += R(0, 140, 1600, 360, url(p + '-haze'));

    /* 两侧黄墙 + 黛瓦墙帽 */
    var wall = function (x, w) {
      return R(x, 350, w, 214, url(p + '-wall')) + R(x, 350, w, 16, '#000', 'opacity=".2"') +
        R(x, 538, w, 26, '#8d8676') + R(x, 538, w, 3, '#b7ae9b') +
        P([x - 6, 350, x + w + 6, 350, x + w + 6, 342, x + w, 332, x, 332, x - 6, 342], '#353b42') + R(x, 330, w, 4, '#646d75');
    };
    s += wall(-10, 360) + wall(1250, 360) + te3.el;
    /* 左墙月洞门，门外阳光花园 */
    s += G(R(60, 380, 180, 180, url(p + '-mgl')) +
      canopy(r, 110, 420, 120, 80, 9, ['#8fa083', '#a7b597', '#c4cdb1'], 0.6, -0.8, 14, 26) +
      canopy(r, 215, 440, 90, 70, 6, ['#879a7c', '#a3b294'], 0.6, -0.8, 12, 22) +
      P([100, 560, 200, 560, 168, 500, 140, 500], '#d8d2b8'), 'clip-path="' + url(p + '-mg') + '"');
    s += C(150, 468, 82, 'none', 'stroke="#9d9584" stroke-width="10"') + C(150, 468, 77, 'none', 'stroke="#6d665a" stroke-width="2"');
    /* 右墙“南無阿彌陀佛” */
    var zi = ['南', '無', '阿', '彌', '陀', '佛'];
    for (var zk = 0; zk < 6; zk++) s += T(1322 + zk * 45, 468, zi[zk], 40, '#6b2c20', 'opacity=".82"');

    /* ---- 大雄宝殿 ---- */
    // 上层屋顶（歇山）
    var roofU = 'M584 154L1016 154C1060 200 1120 224 1226 222C1196 238 1172 246 1150 250L450 250C428 246 404 238 374 222C480 224 540 200 584 154Z';
    s += D(roofU, url(p + '-tile')) + D(roofU, url(p + '-roofsh')) + D(roofU, url(p + '-roofv'));
    s += te1.el + R(440, 255, 720, 6, '#000', 'opacity=".35"');
    // 正脊 + 鸱吻
    s += R(572, 136, 456, 20, '#262b31') + R(572, 136, 456, 3, '#737d86') + R(572, 150, 456, 3, '#1a1e22');
    var chiwen = 'M568 156L568 116C568 104 578 98 588 100C598 102 602 110 598 118C594 124 590 126 592 136L604 136L604 156ZM568 122L558 112L560 132Z';
    s += D(chiwen, '#2b3036') + D(chiwen, '#2b3036', 'transform="matrix(-1 0 0 1 1600 0)"') + D('M1032 156L1032 116C1032 106 1026 101 1018 100C1024 104 1026 110 1026 118L1026 156Z', '#77828c', 'opacity=".55"');
    s += R(794, 118, 12, 20, '#2b3036') + C(800, 114, 8, '#2b3036') + C(802, 112, 3, '#737d86');
    // 小鸟两只
    s += D('M672 136c2-6 8-7 11-3l6-2-4 5c0 2-3 3-7 3z', '#2a2f33') + D('M700 136c2-5 7-6 10-2l5-2-3 4c0 2-3 3-6 3z', '#2a2f33');
    // 两檐之间：斗拱层 + 匾额
    s += R(420, 256, 760, 48, '#2a2320');
    s += R(420, 256, 760, 48, url(p + '-dg'), 'opacity=".9"');
    s += R(712, 257, 176, 46, '#18222c', 'stroke="#b08d44" stroke-width="3"') + R(718, 262, 164, 36, 'none', 'stroke="#6f5a2c" stroke-width="1"');
    var bian = ['大', '雄', '寶', '殿'];
    for (var bk = 0; bk < 4; bk++) s += T(724 + bk * 39, 292, bian[bk], 31, '#dcb85e');
    // 下层屋顶
    var roofL = 'M332 300L1268 300C1290 322 1312 326 1342 322C1318 338 1294 346 1262 349L338 349C306 346 282 338 258 322C288 326 310 322 332 300Z';
    s += D(roofL, url(p + '-tile')) + D(roofL, url(p + '-roofsh')) + D(roofL, url(p + '-roofv'));
    s += R(332, 298, 936, 4, '#1c2024') + te2.el;
    // 檐下阴影 + 小斗拱
    s += R(328, 352, 944, 22, '#1d1816');
    s += R(340, 352, 920, 22, url(p + '-dg2'));
    // 殿身：七开间
    var hx0 = 340, hx1 = 1260, bw = (hx1 - hx0) / 7;
    s += R(hx0 - 12, 372, hx1 - hx0 + 24, 112, '#1f1916');
    for (var b = 0; b < 7; b++) {
      var bx = hx0 + b * bw + 10, bwd = bw - 20;
      if (b === 0 || b === 6) {
        s += R(bx, 382, bwd, 100, url(p + '-wall')) + R(bx, 382, bwd, 10, '#000', 'opacity=".25"');
        s += C(bx + bwd / 2, 424, 24, url(p + '-lat'), 'stroke="#5a3a26" stroke-width="4"');
      } else if (b === 3) {
        var fx = bx + bwd / 2;
        s += R(bx, 382, bwd, 100, '#130e0b') + R(bx, 382, bwd, 100, url(p + '-glow'));
        s += C(fx, 420, 30, 'none', 'stroke="#e0b050" stroke-width="1.5" opacity=".5"');
        s += D('M' + (fx - 30) + ' 482Q' + (fx - 32) + ' 446 ' + (fx - 13) + ' 438L' + (fx + 13) + ' 438Q' + (fx + 32) + ' 446 ' + (fx + 30) + ' 482Z', '#c08e40', 'opacity=".75"');
        s += C(fx, 424, 11, '#cfa04a', 'opacity=".85"') + C(fx, 413, 5, '#cfa04a', 'opacity=".85"');
        s += R(bx, 382, 9, 100, url(p + '-lat')) + R(bx + bwd - 9, 382, 9, 100, url(p + '-lat'));
      } else {
        var lw = bwd / 4, dv = '';
        s += R(bx, 383, bwd, 64, url(p + '-lat')) + R(bx, 449, bwd, 33, '#5a3a26') + R(bx, 449, bwd, 3, '#7a5438');
        for (var k = 0; k <= 4; k++) dv += l0(bx + k * lw, 383, bx + k * lw, 482);
        s += G(dv, 'stroke="#2a1a12" stroke-width="2.5"');
      }
    }
    for (var c = 0; c <= 7; c++) {
      var cx = hx0 + c * bw;
      s += R(cx - 10, 374, 20, 110, '#6b3228') + R(cx + 3, 374, 7, 110, '#a4644a') + R(cx - 10, 374, 4, 110, '#3f1b15');
    }
    s += R(hx0 - 14, 372, hx1 - hx0 + 28, 11, '#3b5557') + R(hx0 - 14, 372, hx1 - hx0 + 28, 2, '#6f8d88');
    // 月台 + 栏杆 + 台阶
    s += R(262, 482, 1076, 8, '#d4cbb5') + R(262, 490, 1076, 72, url(p + '-stone'));
    s += G(L(262, 510, 1338, 510, '#7b7466', 1.2) + L(262, 532, 1338, 532, '#7b7466', 1.2) + L(262, 552, 1338, 552, '#7b7466', 1), 'opacity=".6"');
    var lan = function (x0, x1) {
      var o = R(x0, 458, x1 - x0, 5, '#d6cfbd') + R(x0, 476, x1 - x0, 6, '#c9c1ad');
      o += R(x0, 463, x1 - x0, 13, url(p + '-bal'));
      for (var x2 = x0; x2 <= x1; x2 += 60) o += R(x2 - 4, 447, 9, 39, '#ddd6c4') + R(x2 + 2, 447, 3, 39, '#f6efdd');
      return o;
    };
    s += lan(270, 688) + lan(912, 1330);
    s += P([690, 484, 910, 484, 934, 565, 666, 565], url(p + '-stp'));
    s += P([684, 470, 698, 470, 690, 566, 664, 566], '#bfb7a3') + P([902, 470, 916, 470, 936, 566, 910, 566], '#d7cfbb');
    // 远处极小香客
    var tiny = function (x, y, h, col) {
      return C(x, y - h + 4, h * 0.13, col) + P([x - h * 0.16, y - h + 9, x + h * 0.16, y - h + 9, x + h * 0.22, y, x - h * 0.22, y], col);
    };
    s += tiny(632, 482, 34, '#3b3430') + tiny(962, 490, 30, '#453d36') + tiny(978, 490, 26, '#524840');

    /* 地面：石板 + 中轴甬道 */
    s += R(0, 560, 1600, 340, url(p + '-gnd'));
    var fl = '';
    for (var z = 10; z > 2.9; z -= 0.75) { var y = 416 + 1440 / z; if (y > 562) fl += l0(0, y, 1600, y); }
    for (var X = -21; X <= 21; X += 1.4) fl += l0(800 + 90 * X, 562, 800 + 302 * X, 900);
    s += G(fl, 'stroke="#6f685b" stroke-width="1.2" opacity=".45"');
    s += P([700, 562, 900, 562, 1134, 900, 466, 900], '#d3cab3', 'opacity=".45"');
    // 左侧阴影（院墙投影）+ 树影斑驳
    s += P([0, 562, 330, 562, 120, 900, 0, 900], '#3e3a33', 'opacity=".28"');
    s += D('M1600 640C1480 650 1380 700 1300 760C1230 810 1180 860 1150 900L1600 900Z', '#3a372f', 'opacity=".3" filter="' + url(p + '-b20') + '"');
    s += G(E(1380, 700, 60, 10, '#fff4d8') + E(1500, 760, 50, 9, '#fff4d8') + E(1300, 820, 70, 12, '#fff4d8'), 'opacity=".18" filter="' + url(p + '-b4') + '"');

    /* 香炉（左中）：铜鼎 + 小亭顶 */
    var bx0 = 560;
    s += P([bx0 - 70, 612, bx0 + 60, 612, bx0 - 180, 690, bx0 - 330, 690], '#3a362e', 'opacity=".3"');
    s += R(bx0 - 84, 592, 168, 20, '#8a8475') + R(bx0 - 84, 588, 168, 6, '#c3bba7') + R(bx0 + 40, 594, 44, 18, '#a39c8b');
    s += D('M' + (bx0 - 56) + ' 552Q' + (bx0 - 64) + ' 572 ' + (bx0 - 70) + ' 590L' + (bx0 - 58) + ' 590Q' + (bx0 - 52) + ' 572 ' + (bx0 - 44) + ' 556Z', '#3a3025');
    s += D('M' + (bx0 + 56) + ' 552Q' + (bx0 + 64) + ' 572 ' + (bx0 + 70) + ' 590L' + (bx0 + 58) + ' 590Q' + (bx0 + 52) + ' 572 ' + (bx0 + 44) + ' 556Z', '#7a6440');
    s += R(bx0 - 5, 560, 10, 30, '#4a3d2c');
    var bowl = 'M' + (bx0 - 70) + ' 506L' + (bx0 + 70) + ' 506C' + (bx0 + 72) + ' 540 ' + (bx0 + 52) + ' 566 ' + bx0 + ' 568C' + (bx0 - 52) + ' 566 ' + (bx0 - 72) + ' 540 ' + (bx0 - 70) + ' 506Z';
    s += D(bowl, url(p + '-brz'));
    s += R(bx0 - 64, 520, 128, 10, '#000', 'opacity=".18"') + R(bx0 - 60, 522, 120, 2, '#c7a86a', 'opacity=".35"');
    s += R(bx0 - 78, 498, 156, 10, url(p + '-brz')) + R(bx0 - 78, 498, 156, 2, '#d8bd84', 'opacity=".7"');
    s += R(bx0 - 74, 478, 14, 22, 'none', 'stroke="#4a3d2c" stroke-width="5"') + R(bx0 + 60, 478, 14, 22, 'none', 'stroke="#8a7248" stroke-width="5"');
    s += R(bx0 - 56, 418, 8, 82, '#3a3025') + R(bx0 + 48, 418, 8, 82, '#8a7046');
    var ding = 'M' + (bx0 - 96) + ' 420C' + (bx0 - 80) + ' 426 ' + (bx0 - 60) + ' 424 ' + (bx0 - 50) + ' 418L' + (bx0 - 24) + ' 394L' + (bx0 + 24) + ' 394L' + (bx0 + 50) + ' 418C' + (bx0 + 60) + ' 424 ' + (bx0 + 80) + ' 426 ' + (bx0 + 96) + ' 420L' + (bx0 + 70) + ' 430L' + (bx0 - 70) + ' 430Z';
    s += D(ding, url(p + '-brz')) + R(bx0 - 70, 428, 140, 4, '#1f1a15');
    s += R(bx0 - 3, 372, 6, 24, '#6b5838') + C(bx0, 368, 8, '#8a7046') + C(bx0 + 2, 366, 3, '#d9bd84');
    var sticks = '';
    for (var si = 0; si < 9; si++) {
      var sxx = bx0 - 22 + si * 5.5, sh = 30 + r() * 16;
      sticks += L(sxx, 500, sxx + (r() - 0.5) * 6, 500 - sh, '#6a4a2a', 1.6) + C(sxx, 500 - sh, 1.6, '#ff9a3a');
    }
    s += sticks;
    /* 经幢（右中） */
    var jx = 1080;
    s += P([jx - 30, 612, jx + 36, 612, jx - 150, 680, jx - 230, 680], '#3a362e', 'opacity=".25"');
    s += R(jx - 44, 588, 88, 24, url(p + '-stone')) + R(jx - 34, 572, 68, 16, url(p + '-stone'));
    s += D('M' + (jx - 30) + ' 572Q' + jx + ' 552 ' + (jx + 30) + ' 572Z', '#b2ab9a');
    s += R(jx - 16, 440, 32, 134, url(p + '-stone'));
    var jl = '';
    for (var jy = 452; jy < 566; jy += 7) jl += l0(jx - 11, jy, jx + 9, jy);
    s += G(jl, 'stroke="#6e685c" opacity=".45"');
    s += D('M' + (jx - 40) + ' 442L' + (jx + 40) + ' 442L' + (jx + 26) + ' 426L' + (jx - 26) + ' 426Z', '#8c8678') + R(jx - 12, 402, 24, 24, url(p + '-stone'));
    s += D('M' + (jx - 30) + ' 404L' + (jx + 30) + ' 404L' + (jx + 14) + ' 392L' + (jx - 14) + ' 392Z', '#8c8678') + C(jx, 384, 8, '#b7b0a0');

    /* 香烟：静态底层 + 动态缕缕 */
    var smoke = function (o, w) {
      return '<path d="M' + (bx0 + o) + ' 470C' + (bx0 - 20 + o) + ' 420 ' + (bx0 + 24 + o) + ' 380 ' + (bx0 - 4 + o) + ' 330C' + (bx0 - 30 + o) + ' 282 ' + (bx0 + 10 + o) + ' 240 ' + (bx0 - 30 + o) + ' 196C' + (bx0 - 60 + o) + ' 164 ' + (bx0 - 40 + o) + ' 120 ' + (bx0 - 80 + o) + ' 90" fill="none" stroke="#f1eee6" stroke-width="' + w + '" stroke-linecap="round"/>';
    };
    s += G(smoke(0, 16) + smoke(10, 8), 'filter="' + url(p + '-b8') + '" opacity=".38"');
    s += G(smoke(-6, 3) + smoke(6, 2), 'filter="' + url(p + '-b2') + '" opacity=".4"');
    s += G(smoke(4, 10), 'class="' + p + '-sm" filter="' + url(p + '-b4') + '"');
    s += G(smoke(-10, 7), 'class="' + p + '-sm" style="animation-delay:-4.5s" filter="' + url(p + '-b4') + '"');

    /* 体积光：自右上斜射 */
    var rays = '';
    var rd = [[1380, 70, 180, 0.9], [1470, 50, 120, 0.7], [1540, 40, 250, 1], [1250, 60, 60, 0.5]];
    for (var ri = 0; ri < rd.length; ri++) {
      var a0 = rd[ri][0], ww = rd[ri][1];
      rays += P([a0, -10, a0 + ww, -10, a0 + ww - 1200 + rd[ri][2], 900, a0 - 1200 + rd[ri][2] - ww * 0.6, 900], url(p + '-ray'), 'opacity="' + rd[ri][3] * 0.5 + '"');
    }
    s += rays;

    /* 前景：右上角逆光的枝叶剪影 */
    s += canopy(r, 1520, 30, 300, 150, 20, ['#232c28', '#2f3a33', '#46533f'], -0.2, 0.9, 16, 34);
    s += canopy(r, 1330, -10, 200, 70, 9, ['#232c28', '#2f3a33'], -0.2, 0.9, 12, 26);
    s += D('M1600 120C1520 110 1460 70 1380 40L1384 34C1460 60 1530 96 1600 108Z', '#1f2723');
    s += '<style>.' + p + '-sm{animation:' + p + '-rise 9s linear infinite}@keyframes ' + p + '-rise{0%{transform:translate(0,40px);opacity:0}20%{opacity:.5}100%{transform:translate(-50px,-120px);opacity:0}}</style>';
    return wrap(p, d, '', s, 0.5);
  };

  /* 楼阁式宝塔（远景），左暗右亮 */
  function pagoda(cx, by, top) {
    var s = '', n7 = 7, sp = 40, H = by - top - sp, h = H / n7, y = by;
    for (var i = 0; i < n7; i++) {
      var w = 84 - i * 7, bh = h * 0.56, ew = w / 2 + 20 - i, ey = y - bh;
      s += R(cx - w / 2, ey, w / 2, bh, '#98998f') + R(cx, ey, w / 2, bh, '#b9b5a6');
      s += D('M' + q(cx - 5) + ' ' + q(y) + 'v' + q(-bh * 0.6) + 'a5 5 0 0 1 10 0v' + q(bh * 0.6) + 'z', '#5d625f');
      s += D('M' + q(cx - ew - 8) + ' ' + q(ey - 9) + 'Q' + q(cx - ew + 6) + ' ' + q(ey + 1) + ' ' + q(cx - ew + 18) + ' ' + q(ey + 1) + 'H' + q(cx + ew - 18) + 'Q' + q(cx + ew - 6) + ' ' + q(ey + 1) + ' ' + q(cx + ew + 8) + ' ' + q(ey - 9) + 'L' + q(cx + w / 2 - 6) + ' ' + q(y - h) + 'H' + q(cx - w / 2 + 6) + 'Z', '#6c747a');
      s += R(cx - ew + 10, ey - 1, 2 * ew - 20, 2, '#a7aeb0');
      y -= h;
    }
    s += R(cx - 2, y - sp, 4, sp, '#6c747a') + C(cx, y - sp * 0.35, 6, '#6c747a') + C(cx, y - sp * 0.65, 4.5, '#6c747a');
    return s;
  }

  /* =====================================================================
   * 方丈室旁静室：亮堂、木桌、一壶清茶、窗外竹影（光自右侧窗入）
   * ===================================================================== */
  GF.art.bg.tearoom = function () {
    var p = 'bgtr', r = U.rng(5207), d = '', s = '';
    d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#c3bcab'], [0.35, '#d9d3c4'], [1, '#c8c1b0']]);
    d += lg(p + '-rwall', 0, 0, 1, 0, [[0, '#a29a88'], [1, '#7c7565']]);
    d += lg(p + '-out', 0, 0, 0, 1, [[0, '#f7f7ea'], [0.6, '#e2e8d0'], [1, '#c8d3b4']]);
    d += lg(p + '-beam', 1, 0, 0, 0.3, [[0, '#fff4d6', 0.5], [1, '#fff4d6', 0.04]]);
    d += lg(p + '-floor', 0, 0, 0, 1, [[0, '#806a53'], [1, '#4a3a2b']]);
    d += lg(p + '-wood', 0, 0, 0, 1, [[0, '#9a7a56'], [0.15, '#6a4e36'], [1, '#4a3526']]);
    d += lg(p + '-pot', 0, 0, 1, 0, [[0, '#3f2419'], [0.6, '#6d3f2b'], [0.88, '#b27a55'], [1, '#7a4a33']]);
    d += lg(p + '-bmb', 0, 0, 1, 0, [[0, '#5b7258'], [0.5, '#8aa283'], [1, '#6a8266']]);
    d += rg(p + '-spill', 0.5, 0.5, 0.6, [[0, '#fff6dc', 0.55], [1, '#fff6dc', 0]]);
    d += rg(p + '-mwg', 0.6, 0.35, 0.8, [[0, '#fbfbef'], [1, '#d3dcbf']]);
    d += '<path id="' + p + '-leaf" d="M0 0Q14 -5.5 40 0Q14 5.5 0 0Z"/>';
    d += blur(p + '-b2', 2.2) + blur(p + '-b6', 6) + blur(p + '-b1', 1.2);
    var patch = [1130, 196, 1130, 488, 760, 560, 760, 268];
    d += '<clipPath id="' + p + '-pc"><polygon points="' + patch.join(' ') + '"/></clipPath>';
    d += '<clipPath id="' + p + '-mw"><circle cx="400" cy="300" r="122"/></clipPath>';
    var win = [1320, 171, 1540, 138, 1540, 572, 1320, 506];
    d += '<clipPath id="' + p + '-wc"><polygon points="' + win.join(' ') + '"/></clipPath>';

    var leaf = function (x, y, a, k, col) {
      return '<use href="#' + p + '-leaf" transform="translate(' + q(x) + ' ' + q(y) + ') rotate(' + q(a) + ') scale(' + q(k) + ')" fill="' + col + '"/>';
    };
    var spray = function (x, y, cnt, a0, spread, k, col) {
      var o = '';
      for (var i = 0; i < cnt; i++) o += leaf(x + (r() - 0.5) * 16, y + (r() - 0.5) * 10, a0 + (r() - 0.5) * spread, k * (0.75 + r() * 0.5), col);
      return o;
    };
    var bamboo = function (x0, x1, ytop, ybot, cols, k) {
      var o = '';
      for (var x = x0; x < x1; x += 34 + r() * 40) {
        var w = (7 + r() * 7) * k, lean = (r() - 0.5) * 30;
        o += P([x, ybot, x + w, ybot, x + w + lean, ytop, x + lean, ytop], cols[0]);
        for (var ny = ybot - 40 - r() * 30; ny > ytop; ny -= 60 + r() * 30) {
          var t = (ybot - ny) / (ybot - ytop);
          o += R(x + lean * t - 1, ny, w + 2, 2.5, cols[1]);
        }
      }
      return o;
    };

    /* 天花梁 */
    s += R(0, 0, 1600, 90, '#3b2c20');
    var raf = '';
    for (var rx = -20; rx < 1600; rx += 64) raf += R(rx, 0, 30, 60, '#2e2219');
    s += raf + R(0, 58, 1600, 30, '#4b3726') + R(0, 84, 1600, 4, '#6f553a');
    /* 后墙 */
    s += R(0, 88, 1262, 514, url(p + '-wall'));
    /* 右侧墙（透视）与窗 */
    s += P([1260, 88, 1600, 0, 1600, 760, 1260, 600], url(p + '-rwall'));
    s += P(win, url(p + '-out'));
    s += G(bamboo(1300, 1560, 100, 620, ['#9fb294', '#8aa07f'], 1) +
      spray(1380, 200, 10, 150, 80, 1.1, '#9ab08f') + spray(1470, 300, 12, 200, 90, 1.2, '#8aa283') + spray(1360, 420, 9, 170, 70, 1, '#a6b99a'),
      'clip-path="' + url(p + '-wc') + '"');
    // 窗格（步步锦，剪影）
    var wl = '';
    for (var vi = 0; vi <= 5; vi++) {
      var t = vi / 5, xx = lerp(1320, 1540, Math.pow(t, 0.85));
      var yt = lerp(171, 138, (xx - 1320) / 220), yb = lerp(506, 572, (xx - 1320) / 220);
      wl += L(xx, yt, xx, yb, '#3a2a1c', vi === 0 || vi === 5 ? 10 : 5);
    }
    for (var hi = 0; hi <= 7; hi++) {
      var th = hi / 7;
      wl += L(1320, lerp(171, 506, th), 1540, lerp(138, 572, th), '#3a2a1c', hi === 0 || hi === 7 ? 10 : 4);
    }
    s += wl + P([1310, 506, 1550, 572, 1550, 590, 1310, 518], '#4a3726');
    s += P([1320, 171, 1540, 138, 1540, 572, 1320, 506], url(p + '-spill'), 'opacity=".5"');

    /* 月洞窗：窗外竹林 */
    s += G(R(270, 170, 260, 260, url(p + '-mwg')) +
      bamboo(270, 540, 170, 440, ['#9db092', '#86997c'], 0.8) +
      bamboo(290, 530, 170, 440, ['#6f8768', '#5b7056'], 1.2) +
      '<g class="' + p + '-sway">' + spray(330, 220, 12, 160, 90, 1.1, '#6d8766') + spray(470, 250, 12, 30, 90, 1.2, '#5f7a5a') + spray(420, 360, 10, 200, 90, 1, '#7c9575') + spray(310, 330, 8, 10, 80, 1, '#5f7a5a') + '</g>',
      'clip-path="' + url(p + '-mw') + '"');
    s += C(400, 300, 124, 'none', 'stroke="#4d3a28" stroke-width="16"') + C(400, 300, 115, 'none', 'stroke="#7a5d40" stroke-width="3"') + C(400, 300, 133, 'none', 'stroke="#b3ac9b" stroke-width="3"');

    /* 挂轴：喫茶去 */
    s += L(665, 90, 628, 118, '#3a2a1c', 1.5) + L(665, 90, 702, 118, '#3a2a1c', 1.5) + C(665, 90, 3, '#3a2a1c');
    s += R(614, 118, 102, 360, '#b9b8a7') + R(624, 148, 82, 300, '#efe6cd') + R(608, 112, 114, 9, '#3a2a1c') + R(606, 474, 118, 12, '#3a2a1c') + R(600, 476, 8, 8, '#1e150e') + R(722, 476, 8, 8, '#1e150e');
    s += R(614, 118, 102, 360, '#000', 'opacity=".06"');
    var cha = ['喫', '茶', '去'];
    for (var ck = 0; ck < 3; ck++) s += T(638, 212 + ck * 72, cha[ck], 56, '#1c1712');
    s += T(634, 430, '趙州', 14, '#3a332a') + R(686, 418, 12, 14, '#a8392c');

    /* 墙上的光斑：窗格影 + 竹影（摇曳） */
    s += P(patch, '#fff4d8', 'opacity=".62"');
    var sh = '';
    var lat = '';
    for (var mi = 1; mi < 5; mi++) { var mx = lerp(1130, 760, mi / 5); lat += l0(mx, 150, mx, 620); }
    for (var mh = 1; mh < 7; mh++) { var fr = mh / 7; lat += l0(1130, lerp(196, 488, fr), 760, lerp(268, 560, fr)); }
    sh += G(lat, 'stroke="#aea694" stroke-width="6"');
    sh += '<g class="' + p + '-sh" filter="' + url(p + '-b2') + '">' +
      P([1030, 150, 1040, 150, 930, 620, 920, 620], '#8e8877') +
      spray(1000, 260, 14, 170, 110, 1.4, '#8e8877') + spray(880, 330, 12, 200, 100, 1.3, '#8e8877') + spray(1080, 400, 10, 150, 90, 1.2, '#8e8877') + spray(800, 440, 8, 210, 80, 1.2, '#8e8877') + '</g>';
    s += G(sh, 'clip-path="' + url(p + '-pc') + '" opacity=".75"');

    /* 左侧矮柜 + 小香炉 + 瓶花 */
    s += R(60, 470, 190, 132, '#5a4230') + R(60, 470, 190, 8, '#8a6a4a') + R(72, 488, 80, 48, 'none', 'stroke="#3d2c1f" stroke-width="2"') + R(158, 488, 80, 48, 'none', 'stroke="#3d2c1f" stroke-width="2"') + R(72, 544, 166, 46, 'none', 'stroke="#3d2c1f" stroke-width="2"');
    s += C(112, 512, 3, '#b08d5a') + C(198, 512, 3, '#b08d5a');
    s += D('M180 470L184 430Q176 420 186 404L196 404Q206 420 198 430L202 470Z', '#cfc8b6') + D('M190 404C182 370 160 350 150 320M190 404C196 372 214 356 236 344', 'none', 'stroke="#3d2c1f" stroke-width="2"');
    s += C(150, 320, 4, '#e8e0d0') + C(236, 344, 4, '#e8e0d0') + C(168, 342, 3, '#e8e0d0') + C(220, 352, 3, '#e8e0d0');
    s += R(96, 452, 34, 18, '#4a3c2e') + E(113, 452, 17, 4, '#6a5a44');
    s += G('<path d="M113 448C108 420 122 400 114 370C108 348 118 330 112 310" fill="none" stroke="#e9e5dc" stroke-width="2.5"/>', 'class="' + p + '-st2" filter="' + url(p + '-b1') + '"');

    /* 茶案 */
    s += P([1130, 488, 1130, 560, 1000, 580, 870, 548, 870, 500], '#6e6858', 'opacity=".35"');
    s += R(856, 466, 390, 16, url(p + '-wood')) + R(856, 466, 390, 3, '#caa57a') + R(866, 482, 370, 12, '#3f2d20');
    s += R(872, 494, 16, 122, '#3b2a1e') + R(1214, 494, 16, 122, '#4a3526') + R(1224, 494, 5, 122, '#8a6a48') + R(906, 494, 10, 96, '#2c1f16', 'opacity=".7"') + R(1186, 494, 10, 96, '#2c1f16', 'opacity=".7"');
    // 竹茶盘
    s += R(930, 456, 190, 10, '#8b7650') + R(930, 456, 190, 2, '#c8b184');
    var tl = '';
    for (var tx = 938; tx < 1116; tx += 9) tl += l0(tx, 458, tx, 466);
    s += G(tl, 'stroke="#6b5a3a"');
    // 紫砂壶
    s += E(996, 434, 44, 25, url(p + '-pot')) + R(956, 447, 80, 9, url(p + '-pot'));
    s += E(996, 410, 24, 6, '#5a3323') + E(996, 406, 18, 5, url(p + '-pot')) + C(996, 399, 5, '#7a4a33') + C(998, 397, 2, '#c08a62');
    s += D('M1036 432Q1052 430 1058 414L1066 410Q1066 420 1060 426Q1052 440 1038 444Z', url(p + '-pot'));
    s += D('M956 420C934 414 930 450 956 448L958 442C942 444 942 424 958 428Z', '#4a2a1d');
    s += E(1016, 428, 6, 12, '#f0c9a0', 'opacity=".25"');
    // 小杯
    var cup = function (x) { return P([x - 12, 442, x + 12, 442, x + 9, 456, x - 9, 456], '#ebe6db') + E(x, 442, 12, 3, '#b58a4a') + R(x + 4, 443, 5, 12, '#fffaf0', 'opacity=".6"'); };
    s += cup(1076) + cup(1106);
    s += R(1140, 430, 40, 36, '#3e4a44') + R(1140, 426, 40, 6, '#5a6a62') + R(1172, 430, 6, 36, '#7c8c82', 'opacity=".6"');
    // 茶气
    var steam = function (x, y, h) { return '<path d="M' + x + ' ' + y + 'C' + (x - 8) + ' ' + (y - h * 0.3) + ' ' + (x + 10) + ' ' + (y - h * 0.55) + ' ' + (x - 2) + ' ' + (y - h * 0.8) + 'S' + (x + 4) + ' ' + (y - h) + ' ' + x + ' ' + (y - h * 1.1) + '" fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round"/>'; };
    s += G(steam(1064, 408, 70), 'class="' + p + '-st" filter="' + url(p + '-b1') + '"');
    s += G(steam(996, 394, 60), 'class="' + p + '-st" style="animation-delay:-2s" filter="' + url(p + '-b1') + '"');
    s += G(steam(1076, 436, 50), 'class="' + p + '-st" style="animation-delay:-3.4s" filter="' + url(p + '-b1') + '"');

    /* 踢脚 + 地板（木板透视，消失点 585,282） */
    s += R(0, 578, 1262, 24, '#5b4632') + R(0, 578, 1262, 3, '#7e6247');
    s += P([0, 602, 1260, 602, 1600, 760, 1600, 900, 0, 900], url(p + '-floor'));
    var fb = '';
    for (var fx = -1400; fx <= 1260; fx += 70) {
      var ex = 585 + (fx - 585) * (900 - 282) / (602 - 282);
      fb += l0(fx, 602, ex, 900);
    }
    s += G(fb, 'stroke="#3e3024" stroke-width="1.4" opacity=".5"') + R(0, 602, 1262, 10, '#000', 'opacity=".2"');
    // 地板光斑
    s += P([1300, 640, 1560, 700, 1360, 900, 980, 900], '#fff0cf', 'opacity=".12"');

    /* 体积光：从右窗射向后墙 */
    s += P([1540, 138, 1320, 171, 1130, 196, 760, 268, 760, 560, 1130, 488, 1320, 506, 1540, 572], url(p + '-beam'), 'opacity=".55"');
    s += P([1540, 300, 1540, 572, 1360, 900, 1100, 900], url(p + '-beam'), 'opacity=".12"');
    s += P([1540, 150, 1540, 190, 760, 330, 760, 300], '#fff6dc', 'opacity=".1"') + P([1540, 330, 1540, 380, 760, 470, 760, 440], '#fff6dc', 'opacity=".08"');
    var mote = '';
    for (var mo = 0; mo < 22; mo++) mote += c0(820 + r() * 700, 200 + r() * 380, 1 + r() * 1.6);
    s += '<g fill="#fff8e6" opacity=".7" class="' + p + '-mote">' + mote + '</g>';

    var css = '.' + p + '-sway{transform-box:fill-box;transform-origin:50% 0;animation:' + p + '-sw 6s ease-in-out infinite alternate}' +
      '.' + p + '-sh{animation:' + p + '-shm 7s ease-in-out infinite alternate}' +
      '.' + p + '-st{animation:' + p + '-stm 4.8s ease-in-out infinite}' +
      '.' + p + '-st2{animation:' + p + '-stm 7s ease-in-out infinite;animation-delay:-3s}' +
      '.' + p + '-mote{animation:' + p + '-mo 12s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-sw{from{transform:rotate(-1.5deg)}to{transform:rotate(1.8deg)}}' +
      '@keyframes ' + p + '-shm{from{transform:translate(-4px,1px)}to{transform:translate(6px,-2px)}}' +
      '@keyframes ' + p + '-stm{0%{transform:translate(0,10px);opacity:0}30%{opacity:.75}100%{transform:translate(5px,-36px);opacity:0}}' +
      '@keyframes ' + p + '-mo{from{transform:translate(0,0)}to{transform:translate(-14px,-10px)}}';
    return wrap(p, d, css, s, 0.38);
  };

  /* =====================================================================
   * 交通公园：修剪整齐的草坪、指向远方的古装石像、老樟树与树洞。上午，日光自左上。
   * ===================================================================== */
  GF.art.bg.traffic_park = function () {
    var p = 'bgtp', r = U.rng(9113), d = '', s = '';
    d += lg(p + '-sky', 0, 0, 0, 1, [[0, '#8ea3ab'], [0.55, '#c6ccc3'], [1, '#e6e1d0']]);
    d += rg(p + '-sun', 160, 20, 820, [[0, '#fff6dc', 1], [0.3, '#f8e6bd', 0.45], [1, '#f8e6bd', 0]], true);
    d += lg(p + '-haze', 0, 0, 0, 1, [[0, '#e8e3d2', 0], [0.7, '#e8e3d2', 0.7], [1, '#e8e3d2', 0.2]]);
    d += lg(p + '-lawn', 0, 0, 0, 1, [[0, '#93a482'], [0.4, '#7f9270'], [1, '#5f7253']]);
    d += lg(p + '-ray', 0, 0, 1, 1, [[0, '#fff4d4', 0.5], [1, '#fff4d4', 0]]);
    d += lg(p + '-bark', 0, 0, 1, 0, [[0, '#8b7e69'], [0.25, '#6a5e4e'], [0.6, '#463d33'], [1, '#2c2620']]);
    d += lg(p + '-ped', 0, 0, 1, 0, [[0, '#c4c3b6'], [0.5, '#9d9d93'], [1, '#6f716b']]);
    d += rg(p + '-hole', 0.55, 0.5, 0.6, [[0, '#050403'], [0.7, '#15110d'], [1, '#2a231c']]);
    d += rg(p + '-spot', 0.5, 0.5, 0.5, [[0, '#fff2c8', 0.55], [1, '#fff2c8', 0]]);
    d += '<pattern id="' + p + '-bw" width="9" height="11" patternUnits="userSpaceOnUse"><rect width="9" height="11" fill="#aab2b4"/><rect x="2" y="3" width="4" height="4" fill="#9aa2a6"/></pattern>';
    d += '<pattern id="' + p + '-bw2" width="10" height="12" patternUnits="userSpaceOnUse"><rect width="10" height="12" fill="#9ca6a8"/><rect x="2" y="3" width="5" height="5" fill="#8a9598"/></pattern>';
    d += blur(p + '-b3', 3) + blur(p + '-b10', 10);
    /* 石像：一条复合路径（袍、袖、平伸右臂、侧脸、冠） */
    var fig =
      // 袍身（下摆外撇）
      'M246 396C252 368 260 338 268 306C272 288 276 274 282 266C290 260 296 258 300 258L310 258C318 262 324 266 328 272C334 300 340 334 346 362C350 374 354 386 358 396Z' +
      // 左袖垂下
      'M280 268C266 290 258 324 256 356C256 370 268 376 278 368C280 336 284 302 292 278Z' +
      // 平伸的右臂与垂袖，食指前指
      'M322 266L392 258L404 257L416 259L416 263L404 265L396 267C390 286 376 310 356 318C346 314 338 298 332 280Z' +
      // 颈、头（侧脸：高鼻深目、短须）
      'M296 260L297 246C292 243 289 236 289 228C289 216 296 208 306 208C314 208 319 213 320 219L321 225L326 231L321 233L321 238L318 240L318 246C316 250 312 252 308 252L308 260Z' +
      // 冠（进贤冠式：冠梁 + 发髻）
      'M293 214L295 200C299 196 311 196 315 200L317 212C308 208 300 208 293 214Z M300 200L302 190L310 190L311 199Z';
    d += '<clipPath id="' + p + '-fc"><path d="' + fig + '"/></clipPath>';

    /* 天空 */
    s += R(0, 0, 1600, 480, url(p + '-sky')) + R(0, 0, 1600, 480, url(p + '-sun'));
    s += G(E(520, 110, 280, 8, '#f6f1e2') + E(760, 140, 200, 6, '#f6f1e2') + E(300, 170, 180, 5, '#fbf5e6'), 'filter="' + url(p + '-b3') + '" opacity=".6"');
    s += D('M600 120l6-4 6 4M624 108l5-3 5 3M644 126l4-3 4 3', 'none', 'stroke="#56605f" stroke-width="1.6"');

    /* 远处城市天际线（闸北，2004） */
    var sk = '', x = -20;
    while (x < 1620) {
      var w = 40 + r() * 80, h = 40 + r() * 90;
      if (r() < 0.18) h = 130 + r() * 90;
      sk += R(x, 440 - h, w, h + 10, url(p + '-bw'));
      if (r() < 0.3) sk += R(x + w * 0.3, 440 - h - 10, w * 0.25, 10, '#a3abad');
      if (r() < 0.2) sk += L(x + w * 0.7, 440 - h, x + w * 0.7, 440 - h - 26, '#9ca4a6', 1.5);
      x += w + r() * 20;
    }
    s += G(sk, 'opacity=".75"');
    var sk2 = ''; x = -40;
    while (x < 1620) {
      var w2 = 60 + r() * 90, h2 = 20 + r() * 50;
      sk2 += R(x, 450 - h2, w2, h2 + 10, url(p + '-bw2'));
      x += w2 + 10 + r() * 60;
    }
    s += G(sk2, 'opacity=".8"') + R(0, 300, 1600, 170, url(p + '-haze'));

    /* 远处树带 */
    s += canopy(r, 400, 452, 900, 50, 60, ['#56695c', '#6e8170', '#8c9d88'], -0.7, -0.7, 14, 30);
    s += canopy(r, 1150, 450, 900, 46, 60, ['#56695c', '#6e8170', '#8c9d88'], -0.7, -0.7, 14, 30);
    s += R(0, 440, 1600, 40, '#e6e1d0', 'opacity=".25"');

    /* 草坪：割草条纹（透视） */
    s += R(0, 468, 1600, 432, url(p + '-lawn'));
    var stp = '';
    for (var k = -12; k <= 12; k += 2) {
      stp += P([800 + k * 26, 468, 800 + (k + 1) * 26, 468, 800 + (k + 1) * 190, 900, 800 + k * 190, 900], '#a5b592');
    }
    s += G(stp, 'opacity=".16"');
    // 远处修剪整齐的矮绿篱
    var hedge = function (x0, x1, y, h) { return R(x0, y, x1 - x0, h, '#4f6348') + R(x0, y - 4, x1 - x0, 5, '#9fb08a') + R(x0, y + h - 3, x1 - x0, 3, '#3a4a36'); };
    s += hedge(20, 460, 474, 16) + hedge(720, 980, 474, 14) + hedge(1040, 1580, 476, 16);
    s += hedge(0, 190, 548, 26);
    // 小路 + 斑马线
    var path = 'M430 900C520 760 640 640 640 560C640 520 610 492 596 470L626 470C650 492 690 520 696 560C704 650 700 780 820 900Z';
    s += D(path, '#bfb8a4') + D(path, 'none', 'stroke="#8e8876" stroke-width="3"');
    var zb = '';
    for (var zk = 0; zk < 6; zk++) zb += P([624 + zk * 12, 566, 632 + zk * 12, 566, 628 + zk * 14, 590, 618 + zk * 14, 590], '#efece0');
    s += G(zb, 'opacity=".85"');
    // 儿童交通灯（交通公园的标志）
    s += P([660, 562, 668, 562, 760, 590, 740, 594], '#3b4a33', 'opacity=".35"');
    s += R(657, 396, 7, 166, '#3c423d') + R(659, 396, 2, 166, '#788079');
    s += R(645, 344, 31, 70, '#2a2f2c', 'rx="5"') + R(645, 344, 31, 70, 'none', 'rx="5" stroke="#555d58" stroke-width="2"');
    s += C(660, 390, 22, url(p + '-spot'), 'opacity=".0"');
    s += C(660, 358, 8, '#d9503a') + C(660, 358, 18, '#e05a3c', 'opacity=".22"') + C(660, 379, 8, '#4a3d28') + C(660, 400, 8, '#2c4337');
    // 圆形指示牌
    s += R(1014, 420, 5, 110, '#3c423d') + C(1016, 408, 20, '#3a6594') + C(1016, 408, 20, 'none', 'stroke="#e9ece6" stroke-width="3"') + D('M1006 414L1022 402M1022 402L1014 402M1022 402L1022 410', 'none', 'stroke="#f2f2ea" stroke-width="3"');
    // 远处小人：打太极的老人、散步者
    var tiny = function (xx, yy, hh, col) { return C(xx, yy - hh + 3, hh * 0.13, col) + P([xx - hh * 0.15, yy - hh + 7, xx + hh * 0.15, yy - hh + 7, xx + hh * 0.2, yy, xx - hh * 0.2, yy], col); };
    s += tiny(820, 484, 22, '#4a4b44') + L(812, 470, 804, 466, '#4a4b44', 2) + tiny(520, 486, 20, '#55544c');

    /* 石像（左）：底座 + 人像 */
    s += P([226, 560, 376, 560, 700, 610, 560, 616], '#3f4f38', 'opacity=".35"');
    s += R(222, 504, 156, 58, url(p + '-ped')) + R(216, 498, 168, 10, '#cfcfc4') + R(222, 556, 156, 6, '#5d605a');
    s += R(244, 398, 112, 106, url(p + '-ped')) + R(238, 390, 124, 10, '#d4d3c8') + R(238, 398, 124, 3, '#6b6d67');
    s += R(270, 428, 60, 44, '#6f716b') + R(270, 428, 60, 44, 'none', 'stroke="#b9b9ad" stroke-width="2"');
    s += G(L(278, 440, 322, 440, '#9d9d93', 2) + L(278, 450, 316, 450, '#9d9d93', 2) + L(278, 460, 320, 460, '#9d9d93', 2), 'opacity=".6"');
    s += D(fig, '#7b7e78');
    s += G(P([220, 180, 300, 180, 294, 400, 220, 400], '#c3c2b6') + P([300, 180, 312, 180, 306, 400, 294, 400], '#a3a49b') + R(300, 256, 120, 5, '#d6d5c9') +
      P([288, 206, 304, 206, 300, 250, 288, 250], '#d0cfc3') +
      D('M280 304C278 334 274 366 268 396M298 300C300 332 302 364 304 396M318 294C324 326 332 360 338 396M340 292C356 300 374 296 390 272M262 330C262 346 264 358 270 366', 'none', 'stroke="#5d605b" stroke-width="2.5"') +
      R(266, 300, 76, 7, '#5d605b') + R(300, 222, 8, 3, '#3f423f') + D('M318 238C314 246 308 250 302 250', 'none', 'stroke="#5d605b" stroke-width="2"'),
      'clip-path="' + url(p + '-fc') + '"');

    /* 老樟树（右）：粗干、三大枝、三米高处的树洞 */
    var trunk = 'M1110 664C1146 646 1164 610 1170 548C1176 460 1172 360 1178 270C1182 212 1164 160 1116 100L1058 -10L1150 -10C1178 50 1204 104 1226 150C1238 104 1246 50 1244 -10L1300 -10C1302 60 1292 120 1288 172C1322 120 1372 70 1424 18L1466 54C1404 108 1334 170 1318 244C1308 330 1310 450 1320 548C1326 604 1344 640 1392 668Z';
    s += P([1300, 664, 1600, 630, 1600, 760, 1320, 700], '#2f3d2b', 'opacity=".35"');
    s += E(1250, 664, 170, 14, '#2f3a2a', 'opacity=".5"');
    s += D(trunk, url(p + '-bark'));
    s += D('M1110 664C1080 668 1060 664 1040 670L1160 672Z', '#4a4034') + D('M1392 668C1420 668 1440 664 1462 672L1340 674Z', '#3a322a');
    var fis = '';
    for (var fi = 0; fi < 16; fi++) {
      var tt = fi / 15, xb = lerp(1150, 1340, tt), xt = lerp(1184, 1308, tt), wig = (r() - 0.5) * 14;
      fis += '<path d="M' + q(xb) + ' 660Q' + q((xb + xt) / 2 + wig) + ' 440 ' + q(xt) + ' 200" fill="none" stroke="#231e19" stroke-width="' + q(1.5 + r() * 2.5) + '" opacity="' + q(0.35 + r() * 0.35) + '"/>';
    }
    s += fis;
    // 树洞
    s += D('M1196 214C1210 200 1250 198 1268 214C1284 232 1286 290 1274 318C1262 336 1216 338 1202 322C1188 300 1184 234 1196 214Z', '#7d705c');
    s += D('M1202 222C1214 210 1248 208 1262 222C1274 240 1276 290 1266 312C1254 326 1220 328 1208 314C1196 296 1192 238 1202 222Z', url(p + '-hole'));
    s += D('M1206 314C1222 326 1254 324 1266 312C1256 330 1216 334 1206 314Z', '#a39478');
    /* 樟树冠 */
    s += canopy(r, 1250, 40, 860, 300, 92, ['#34473b', '#4a5f4d', '#657a62', '#8a9c7f', '#aab795'], -0.75, -0.65, 26, 60);
    s += canopy(r, 960, 150, 260, 130, 26, ['#3a4d40', '#526753', '#71866b', '#97a88a'], -0.75, -0.65, 18, 38);
    s += canopy(r, 1540, 170, 240, 180, 26, ['#2f4136', '#44584a', '#5d7259'], -0.75, -0.65, 18, 40);
    // 树冠缝里的天光

    /* 光束：左上斜射，一束落在树洞 */
    s += P([200, -20, 330, -20, 1300, 380, 1140, 420], url(p + '-ray'), 'opacity=".35"');
    s += P([0, 60, 90, 20, 700, 620, 520, 640], url(p + '-ray'), 'opacity=".22"');
    s += E(1232, 268, 110, 110, url(p + '-spot'), 'opacity=".45"');
    // 草坪上的树荫斑驳
    var dap = '';
    for (var di = 0; di < 18; di++) dap += E(900 + r() * 700, 640 + r() * 200, 30 + r() * 60, 6 + r() * 10, '#34422e');
    s += G(dap, 'opacity=".22"');
    return wrap(p, d, '', s, 0.5);
  };

  /* =====================================================================
   * 希尔顿十八层客房：白天 hilton / 傍晚起风 hilton_wind（共用一个构图）
   * ===================================================================== */
  function hiltonRoom(p, wind) {
    var r = U.rng(wind ? 6629 : 6628), d = '', s = '', css = '';
    var W0 = 240, W1 = 1360, WT = 78, WB = 598;
    if (!wind) {
      d += lg(p + '-sky', 0, 0, 0, 1, [[0, '#9fb1ba'], [0.6, '#cfd6d3'], [1, '#e4e2d6']]);
      d += rg(p + '-glare', 200, 60, 700, [[0, '#fffbea', 0.9], [0.4, '#fff5dc', 0.35], [1, '#fff5dc', 0]], true);
      d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#5a5148'], [1, '#6c6255']]);
      d += lg(p + '-carpet', 0, 0, 0, 1, [[0, '#6a5f53'], [1, '#3e362f']]);
      d += lg(p + '-lightfl', 0, 0, 0, 1, [[0, '#fff6e2', 0.35], [1, '#fff6e2', 0]]);
    } else {
      d += lg(p + '-sky', 0, 0, 0, 1, [[0, '#0d1420'], [0.35, '#202638'], [0.62, '#5a3a3e'], [0.78, '#b0583a'], [0.86, '#d98a48'], [1, '#6a3a30']]);
      d += rg(p + '-glare', 520, 330, 620, [[0, '#f0a050', 0.55], [1, '#f0a050', 0]], true);
      d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#1c1c26'], [1, '#2a2630']]);
      d += lg(p + '-carpet', 0, 0, 0, 1, [[0, '#2c2830'], [1, '#141218']]);
      d += lg(p + '-lightfl', 0, 0, 0, 1, [[0, '#e08a4a', 0.22], [1, '#e08a4a', 0]]);
      d += rg(p + '-lamp', 0.5, 0.5, 0.5, [[0, '#ffd48a', 0.6], [1, '#ffd48a', 0]]);
      d += lg(p + '-sheer', 0, 0, 1, 0, [[0, '#d6d2dc', 0.1], [0.5, '#e8e2e6', 0.34], [1, '#d6d2dc', 0.08]]);
    }
    d += lg(p + '-haze', 0, 0, 0, 1, wind ? [[0, '#c0603a', 0], [1, '#d08040', 0.35]] : [[0, '#e6e6dc', 0], [1, '#e6e6dc', 0.55]]);
    d += lg(p + '-silver', 0, 0, 1, 0, [[0, '#6f7478'], [0.35, '#d8dcdf'], [0.55, '#f4f6f7'], [0.8, '#9ba1a6'], [1, '#c3c8cc']]);
    d += lg(p + '-drape', 0, 0, 1, 0, wind ? [[0, '#2a2528'], [0.5, '#4a3c38'], [1, '#231f22']] : [[0, '#6f624f'], [0.5, '#958470'], [1, '#6a5c4a']]);
    d += lg(p + '-tabletop', 0, 0, 0, 1, wind ? [[0, '#6a4a3a'], [1, '#221a18']] : [[0, '#b8bcb8'], [0.3, '#4a3e34'], [1, '#2a221c']]);
    d += '<clipPath id="' + p + '-win"><rect x="' + W0 + '" y="' + WT + '" width="' + (W1 - W0) + '" height="' + (WB - WT) + '"/></clipPath>';
    if (!wind) {
      d += '<pattern id="' + p + '-wm" width="9" height="10" patternUnits="userSpaceOnUse"><rect width="9" height="10" fill="#96a2a8"/><rect x="2" y="2" width="5" height="5" fill="#838f96"/></pattern>';
      d += '<pattern id="' + p + '-wn" width="12" height="14" patternUnits="userSpaceOnUse"><rect width="12" height="14" fill="#7d898f"/><rect x="2" y="3" width="7" height="7" fill="#65717a"/></pattern>';
    } else {
      d += '<pattern id="' + p + '-wm" width="36" height="30" patternUnits="userSpaceOnUse"><rect width="36" height="30" fill="#1a1f2c"/>' +
        '<rect x="3" y="4" width="4" height="4" fill="#e0a050"/><rect x="21" y="4" width="4" height="4" fill="#252b3a"/><rect x="12" y="14" width="4" height="4" fill="#252b3a"/><rect x="30" y="19" width="4" height="4" fill="#c88a40" opacity=".8"/><rect x="3" y="22" width="4" height="4" fill="#252b3a"/><rect x="21" y="24" width="4" height="4" fill="#252b3a"/></pattern>';
      d += '<pattern id="' + p + '-wn" width="48" height="40" patternUnits="userSpaceOnUse"><rect width="48" height="40" fill="#121620"/>' +
        '<rect x="4" y="6" width="6" height="6" fill="#e8a850"/><rect x="28" y="6" width="6" height="6" fill="#1e2433"/><rect x="16" y="20" width="6" height="6" fill="#aebccc" opacity=".5"/><rect x="38" y="26" width="6" height="6" fill="#1e2433"/><rect x="4" y="30" width="6" height="6" fill="#1e2433"/><rect x="28" y="30" width="6" height="6" fill="#d89848" opacity=".8"/></pattern>';
    }
    d += blur(p + '-b3', 3) + blur(p + '-b12', 12);

    /* ---- 窗外 ---- */
    var out = R(W0, WT, W1 - W0, WB - WT, url(p + '-sky')) + R(W0, WT, W1 - W0, WB - WT, url(p + '-glare'));
    if (!wind) out += G(E(500, 160, 240, 8, '#f4f2ea') + E(900, 130, 300, 10, '#eef0ea') + E(1200, 190, 160, 6, '#f4f2ea'), 'filter="' + url(p + '-b3') + '" opacity=".6"');
    // 远景：浦东（东方明珠 + 金茂）
    var farC = wind ? '#262a3a' : '#aab4b9';
    var far = '';
    var fx = W0;
    while (fx < W1) { var fw = 20 + r() * 40, fh = 6 + r() * 30; far += R(fx, 318 - fh, fw, fh + 4, farC); fx += fw + r() * 12; }
    far += R(640, 262, 22, 60, farC) + R(700, 280, 30, 42, farC) + R(1180, 236, 26, 86, farC) + R(1238, 256, 20, 66, farC) + R(430, 270, 26, 52, farC);
    // 东方明珠
    far += L(1000, 320, 1008, 270, farC, 3) + L(1020, 320, 1012, 270, farC, 3) + C(1010, 264, 14, farC) + R(1008, 206, 4, 60, farC) + C(1010, 202, 9, farC) + R(1009, 166, 2, 36, farC) + C(1010, 170, 4, farC) + L(1010, 166, 1010, 136, farC, 1.5);
    // 金茂
    var jm = '';
    for (var ji = 0; ji < 9; ji++) { var jw = 34 - ji * 2.6; jm += R(1100 - jw / 2, 318 - (ji + 1) * 15, jw, 16, farC); }
    far += jm + P([1092, 184, 1108, 184, 1100, 168], farC) + L(1100, 168, 1100, 146, farC, 1.5);
    if (wind) far += C(1010, 136, 2.5, '#ff5040') + C(1100, 146, 2.5, '#ff5040') + C(1010, 264, 3, '#c86a8a', 'opacity=".7"') + C(1010, 202, 2.5, '#c86a8a', 'opacity=".7"');
    out += G(far, 'opacity="' + (wind ? 0.95 : 0.8) + '"');
    out += R(W0, 250, W1 - W0, 80, url(p + '-haze'));
    // 中景城市
    var mid = R(W0, 380, W1 - W0, WB - 380, wind ? '#121620' : '#8a969c'); var mx = W0 - 20;
    while (mx < W1) {
      var mw = 34 + r() * 70, mt = 300 + r() * 70;
      if (r() < 0.2) mt = 250 + r() * 40;
      mid += R(mx, mt, mw, WB - mt, url(p + '-wm'));
      if (r() < 0.4) mid += R(mx + mw * 0.2, mt - 8, mw * 0.3, 8, wind ? '#1a1f2c' : '#8a969c');
      mx += mw + r() * 8;
    }
    out = out.replace('<!--MIDBASE-->', '') + mid + R(W0, 330, W1 - W0, 90, url(p + '-haze'), 'opacity=".7"');
    // 近景：俯视到的屋顶
    var near = ''; var nx = W0 - 30;
    while (nx < W1) {
      var nw = 80 + r() * 140, nt = 400 + r() * 90;
      near += R(nx, nt, nw, WB - nt, url(p + '-wn')) + R(nx, nt - 12, nw, 12, wind ? '#262c3c' : '#a4acac') + R(nx, nt, nw, 3, wind ? '#0d1018' : '#5c666c');
      if (r() < 0.6) near += R(nx + 10 + r() * (nw - 40), nt - 26, 22, 16, wind ? '#1c2230' : '#8e989a') + E(nx + nw * 0.7, nt - 10, 12, 4, wind ? '#1c2230' : '#8e989a');
      nx += nw + 6 + r() * 30;
    }
    out += near;
    if (wind) out += R(W0, 500, W1 - W0, 98, url(p + '-haze'), 'opacity=".9"');
    s += G(out, 'clip-path="' + url(p + '-win') + '"');
    // 玻璃反光（白天）/ 室内灯倒影（傍晚）
    if (!wind) s += G(P([300, 78, 420, 78, 260, 598, 240, 598, 240, 360], '#ffffff') + P([860, 78, 900, 78, 700, 598, 660, 598], '#ffffff') + P([1150, 78, 1230, 78, 1100, 598, 1030, 598], '#ffffff'), 'opacity=".06"');

    /* ---- 室内：天花、墙 ---- */
    s += R(0, 0, 1600, WT, wind ? '#15151d' : '#4a433b') + R(0, WT - 8, 1600, 8, wind ? '#20202a' : '#5d554b');
    s += C(420, 34, 7, wind ? '#2a2a32' : '#6f665a') + C(800, 34, 7, wind ? '#2a2a32' : '#6f665a') + C(1180, 34, 7, wind ? '#2a2a32' : '#6f665a');
    s += R(0, WT, W0, WB - WT + 14, url(p + '-wall')) + R(W1, WT, 1600 - W1, WB - WT + 14, url(p + '-wall'));
    // 右墙挂画
    s += R(1462, 190, 110, 140, wind ? '#0e0e14' : '#2c2721') + R(1470, 198, 94, 124, wind ? '#3a3440' : '#b7ab94') + P([1470, 290, 1510, 250, 1540, 280, 1564, 262, 1564, 322, 1470, 322], wind ? '#2a2632' : '#8f8672');
    // 窗框与窗棂
    var fcol = wind ? '#0e0f16' : '#2d2925';
    s += R(W0 - 10, WT - 4, W1 - W0 + 20, 10, fcol) + R(W0 - 12, WB - 4, W1 - W0 + 24, 16, fcol) + R(W0 - 12, WB - 4, W1 - W0 + 24, 3, wind ? '#5a3a34' : '#8a8378');
    var mullX = [W0, 520, 800, 1080, W1];
    for (var mi = 0; mi < mullX.length; mi++) s += R(mullX[mi] - 6, WT, 12, WB - WT, fcol) + R(mullX[mi] - 6, WT, 2, WB - WT, wind ? '#3a2a2e' : '#6d665c');
    s += R(W0, 152, W1 - W0, 8, fcol, 'opacity=".9"');

    /* 起风：中左扇窗大开（向内推开），纱帘被卷进来 */

    /* 窗帘 */
    if (!wind) {
      var pleat = function (x0, x1, y0, y1) {
        var o = R(x0, y0, x1 - x0, y1 - y0, url(p + '-drape'));
        for (var xx = x0 + 8; xx < x1; xx += 18) o += R(xx, y0, 6, y1 - y0, '#4f4537', 'opacity=".45"') + R(xx + 7, y0, 3, y1 - y0, '#b5a58c', 'opacity=".35"');
        return o;
      };
      s += pleat(140, 300, 70, 612) + pleat(1300, 1460, 70, 612);
      var sheer = function (x0, x1) {
        var o = R(x0, WT, x1 - x0, WB - WT + 10, '#f2eee6', 'opacity=".22"');
        for (var xx = x0 + 6; xx < x1; xx += 14) o += R(xx, WT, 2, WB - WT + 10, '#fffdf6', 'opacity=".3"');
        return o;
      };
      s += sheer(290, 420) + sheer(1180, 1310);
      s += R(120, 64, 1360, 8, '#3a332c') + C(120, 68, 7, '#3a332c') + C(1480, 68, 7, '#3a332c');
    } else {
      s += R(120, 64, 1360, 8, '#0e0e14') + C(120, 68, 7, '#0e0e14') + C(1480, 68, 7, '#0e0e14');
      // 右侧厚帘：被风压向墙边
      var rp = R(1310, 70, 150, 542, url(p + '-drape'));
      for (var rx = 1318; rx < 1460; rx += 18) rp += R(rx, 70, 6, 542, '#141216', 'opacity=".5"');
      s += rp;
      // 左侧厚帘：整幅被卷起，向屋内鼓成大弧
      s += G(D('M130 72L330 72C360 160 470 210 610 250C700 276 760 330 740 380C700 350 620 360 560 400C470 460 390 520 330 612L140 612C150 480 150 300 130 72Z', url(p + '-drape')) +
        D('M200 72C230 200 340 280 520 300C600 310 680 340 720 372', 'none', 'stroke="#151215" stroke-width="10" opacity=".55"') +
        D('M170 72C190 260 280 380 460 420', 'none', 'stroke="#151215" stroke-width="8" opacity=".45"') +
        D('M300 72C330 140 420 196 560 226', 'none', 'stroke="#8a5a44" stroke-width="4" opacity=".6"'),
        'class="' + p + '-cur"');
      // 纱帘：从开着的窗扇飞进来
      s += G(D('M520 80C600 110 720 120 860 150C980 176 1060 230 1080 300C1010 270 930 280 860 320C760 380 640 420 560 520C540 440 530 300 520 80Z', url(p + '-sheer')) +
        D('M530 90C640 130 800 150 960 210M540 200C660 230 800 250 960 280M545 330C640 330 760 330 880 320', 'none', 'stroke="#f4eef0" stroke-width="2" opacity=".35"'),
        'class="' + p + '-sheer"');
    }

    if (wind) {
      d += lg(p + '-pane', 1, 0, 0, 0, [[0, '#f0a060', 0.05], [0.6, '#c07050', 0.22], [1, '#f4b070', 0.35]]);
      s += P([520, WT, 408, 40, 408, 652, 520, WB], url(p + '-pane')) + P([520, WT, 408, 40, 408, 652, 520, WB], 'none', 'stroke="#0b0c12" stroke-width="9"');
      s += L(412, 46, 412, 648, '#f0a060', 1.5, 'opacity=".5"') + P([500, 120, 470, 100, 430, 560, 460, 570], '#ffe0c0', 'opacity=".08"');
    }
    /* 落地灯（左） */
    s += R(96, 318, 4, 290, wind ? '#0e0e12' : '#2a241f') + E(98, 608, 26, 6, wind ? '#0e0e12' : '#2a241f');
    s += P([66, 256, 130, 256, 146, 322, 50, 322], wind ? '#e8b060' : '#b3a68d');
    if (wind) s += E(98, 330, 220, 260, url(p + '-lamp'), 'opacity=".55"') + P([50, 322, 146, 322, 210, 620, -10, 620], '#ffcf80', 'opacity=".08"');
    else s += P([66, 256, 88, 256, 70, 322, 50, 322], '#8a7f6a', 'opacity=".6"');

    /* 单人沙发（左，逆光剪影） */
    var chairC = wind ? '#141218' : '#2f2923';
    s += D('M300 612L300 468C300 440 316 426 340 426L452 426C476 426 490 440 490 468L490 612Z', chairC);
    s += R(284, 500, 36, 112, chairC, 'rx="12"') + R(470, 500, 36, 112, chairC, 'rx="12"');
    s += D('M300 468C300 440 316 426 340 426L452 426C476 426 490 440 490 468', 'none', 'stroke="' + (wind ? '#8a5a44' : '#c9c2b2') + '" stroke-width="2.5" opacity=".6"');
    if (wind) s += D('M340 520L420 470L470 520Z', '#0c0b10', 'opacity=".4"');

    /* 地毯 + 窗光投影 */
    s += R(0, WB + 12, 1600, 900 - WB - 12, url(p + '-carpet'));
    var fl = '';
    var panes = [[W0 + 6, 514], [526, 794], [806, 1074], [1086, W1 - 6]];
    for (var pi = 0; pi < panes.length; pi++) {
      var a = panes[pi][0], b = panes[pi][1];
      if (wind && pi === 1) continue;
      fl += P([a, 612, b, 612, 800 + (b - 800) * 2.1, 900, 800 + (a - 800) * 2.1, 900], url(p + '-lightfl'));
    }
    if (wind) fl += P([526, 612, 794, 612, 1360, 900, 150, 900], url(p + '-lightfl'), 'opacity=".6"');
    s += fl;

    /* 地毯上的方毯（透视） */
    s += P([700, 618, 1420, 618, 1560, 740, 560, 740], wind ? '#2a2026' : '#6e5a4a') + P([724, 624, 1396, 624, 1520, 732, 600, 732], 'none', 'stroke="' + (wind ? '#4a3438' : '#9a8266') + '" stroke-width="3"') +
      P([748, 630, 1372, 630, 1480, 724, 640, 724], 'none', 'stroke="' + (wind ? '#3a2a30' : '#836c56') + '" stroke-width="1.5"');
    /* 茶几 + 古董茶具 + 报纸 */
    var tx0 = 850, tx1 = 1250, ty = 512;
    s += E((tx0 + tx1) / 2 + 30, 626, 240, 16, '#000', 'opacity=".3"');
    s += R(tx0 + 18, ty + 14, 12, 100, wind ? '#16110f' : '#221a15') + R(tx1 - 30, ty + 14, 12, 100, wind ? '#16110f' : '#221a15') + R(tx0 + 40, ty + 70, tx1 - tx0 - 80, 8, wind ? '#16110f' : '#221a15');
    s += R(tx0, ty, tx1 - tx0, 16, url(p + '-tabletop')) + R(tx0, ty, tx1 - tx0, 2, wind ? '#d08a58' : '#f2efe4');
    if (!wind) s += P([900, ty + 3, 1000, ty + 3, 980, ty + 13, 880, ty + 13], '#ffffff', 'opacity=".2"');

    // 银胎彩釉鹤嘴壶
    var tp = G(
      D('M958 512C952 496 956 478 968 468C974 462 976 456 976 448L1000 448C1000 456 1002 462 1008 468C1020 478 1024 496 1018 512Z', url(p + '-silver')) +
      D('M1012 490C1028 482 1036 466 1042 450C1046 438 1054 428 1066 422L1068 426C1058 432 1052 442 1048 454C1042 474 1032 492 1016 498Z', url(p + '-silver')) +
      D('M1066 422L1082 417L1068 427Z', '#9aa0a5') +
      D('M962 474C942 470 936 500 958 502', 'none', 'stroke="#9aa0a5" stroke-width="4"') +
      E(988, 448, 14, 4, '#b8bec2') + D('M978 448C978 438 998 438 998 448Z', url(p + '-silver')) + C(988, 434, 3.5, '#c9a45a') +
      R(958, 484, 60, 9, '#2f5f8e') + C(970, 488.5, 2.4, '#c8483a') + C(984, 488.5, 2.4, '#e0c05a') + C(998, 488.5, 2.4, '#c8483a') + C(1011, 488.5, 2.4, '#e0c05a') +
      D('M966 474L1010 474L1004 480L972 480Z', '#2f7a6a') + D('M962 502L1014 502L1016 508L960 508Z', '#8a3a34') +
      R(972, 452, 3, 50, '#ffffff', 'opacity=".55"'), wind ? 'opacity=".72"' : '');
    s += tp;
    var cupT = function (x) { return P([x - 11, 498, x + 11, 498, x + 7, 512, x - 7, 512], url(p + '-silver')) + R(x - 10, 502, 20, 4, '#2f5f8e') + E(x, 498, 11, 2.5, '#6f7478'); };
    s += cupT(1086) + cupT(1116);
    if (!wind) s += D('M958 512C952 496 956 478 968 468', 'none', 'stroke="#ffffff" stroke-width="1.5" opacity=".5"');

    // 报纸
    var paper = function (x, y, w, h, rot, tone) {
      var o = '<g transform="rotate(' + q(rot) + ' ' + q(x + w / 2) + ' ' + q(y + h / 2) + ')">' + R(x, y, w, h, tone) +
        R(x + 6, y + 4, w * 0.6, 5, '#3a3a3a', 'opacity=".55"');
      for (var ly = y + 13; ly < y + h - 3; ly += 5) o += R(x + 6, ly, w * 0.38, 1.6, '#5a5a5a', 'opacity=".4"') + R(x + w * 0.52, ly, w * 0.4, 1.6, '#5a5a5a', 'opacity=".4"');
      return o + '</g>';
    };
    if (!wind) {
      var ps = '';
      for (var si = 0; si < 11; si++) ps += R(1136 + (r() - 0.5) * 8, ty - 6 - si * 5, 104, 5, si % 2 ? '#cfcabd' : '#e2ddd0') + R(1136, ty - 6 - si * 5, 104, 1, '#8a867c', 'opacity=".6"');
      s += ps + paper(1134, ty - 66, 108, 10, -3, '#e8e3d6');
      var ps2 = '';
      for (var sj = 0; sj < 14; sj++) ps2 += R(1262 + (r() - 0.5) * 10, 606 - sj * 5, 110, 5, sj % 2 ? '#c9c4b7' : '#dcd7ca') + R(1262, 606 - sj * 5, 110, 1, '#8a867c', 'opacity=".6"');
      s += ps2;
    } else {
      // 被风吹倒的报纸堆 + 地上散落
      var ps3 = '';
      for (var sk = 0; sk < 5; sk++) ps3 += R(1140 + sk * 6, ty - 6 - sk * 4, 100, 4, sk % 2 ? '#8e8a90' : '#a4a0a4');
      s += ps3 + paper(1170, ty - 30, 96, 60, 24, '#a9a5a8');
      s += paper(1280, 596, 120, 70, -12, '#8e8a8e') + paper(1210, 640, 110, 60, 18, '#9a969a') + paper(700, 626, 120, 64, 8, '#8a868c') + paper(420, 660, 110, 60, -20, '#96929a');
      // 空中飞舞的纸
      s += '<g class="' + p + '-fly1">' + paper(820, 250, 70, 50, -28, '#b9b4b8') + '</g>';
      s += '<g class="' + p + '-fly2">' + paper(1150, 300, 60, 44, 36, '#a9a4a9') + '</g>';
      s += '<g class="' + p + '-fly3">' + paper(640, 430, 56, 40, 60, '#9e9a9e') + '</g>';
      // 风线
      s += G('<path d="M560 180C700 200 860 190 1000 230M600 320C740 330 900 330 1060 370M560 470C700 470 820 480 960 520" fill="none" stroke="#e8d8d0" stroke-width="1.5" opacity=".18"/>', 'class="' + p + '-gust"');
      // 冷暖交错的不祥色调
      s += R(0, 0, 1600, 900, '#301018', 'opacity=".14"');
      css = '.' + p + '-cur{transform-box:fill-box;transform-origin:0 0;animation:' + p + '-cw 2.6s ease-in-out infinite alternate}' +
        '.' + p + '-sheer{transform-box:fill-box;transform-origin:0 0;animation:' + p + '-sw 1.9s ease-in-out infinite alternate}' +
        '.' + p + '-fly1{animation:' + p + '-f1 5s ease-in-out infinite alternate}.' + p + '-fly2{animation:' + p + '-f2 4.2s ease-in-out infinite alternate}.' + p + '-fly3{animation:' + p + '-f1 6s ease-in-out infinite alternate-reverse}' +
        '.' + p + '-gust{animation:' + p + '-g 3s linear infinite}' +
        '@keyframes ' + p + '-cw{from{transform:skewX(0deg) scale(1,1)}to{transform:skewX(-3deg) scale(1.03,.98)}}' +
        '@keyframes ' + p + '-sw{from{transform:skewY(0deg) scale(1,1)}to{transform:skewY(2.5deg) scale(1.05,1.02)}}' +
        '@keyframes ' + p + '-f1{from{transform:translate(0,0) rotate(0)}to{transform:translate(40px,-18px) rotate(8deg)}}' +
        '@keyframes ' + p + '-f2{from{transform:translate(0,0) rotate(0)}to{transform:translate(30px,20px) rotate(-10deg)}}' +
        '@keyframes ' + p + '-g{0%{transform:translate(-80px,0);opacity:0}40%{opacity:1}100%{transform:translate(160px,10px);opacity:0}}';
    }
    return wrap(p, d, css, s, wind ? 0.72 : 0.45);
  }

  /* =====================================================================
   * 朵云轩：拍卖行预展厅——红木护墙、玻璃展柜、射灯光柱；中央展柜是仿沈秀纳财盆
   * ===================================================================== */
  GF.art.bg.duoyunxuan = function () {
    var p = 'bgdy', r = U.rng(3319), d = '', s = '';
    d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#2a130d'], [0.5, '#3d1d14'], [1, '#2b140e']]);
    d += lg(p + '-beam', 0, 0, 0, 1, [[0, '#ffe9bf', 0.34], [1, '#ffe9bf', 0]]);
    d += lg(p + '-beamS', 0, 0, 0, 1, [[0, '#ffe9bf', 0.2], [1, '#ffe9bf', 0.02]]);
    d += rg(p + '-pool', 0.5, 0.5, 0.5, [[0, '#ffd99a', 0.5], [0.6, '#e8a860', 0.14], [1, '#e8a860', 0]]);
    d += rg(p + '-fpool', 0.5, 0.5, 0.5, [[0, '#ffcf8a', 0.3], [1, '#ffcf8a', 0]]);
    d += lg(p + '-gold', 0, 0, 1, 0, [[0, '#6a4a1c'], [0.35, '#c8993e'], [0.55, '#f6dc8a'], [0.8, '#a87a2c'], [1, '#5a3e16']]);
    d += lg(p + '-glass', 0, 0, 1, 1, [[0, '#cfe4ea', 0.16], [0.5, '#cfe4ea', 0.03], [1, '#cfe4ea', 0.1]]);
    d += lg(p + '-floor', 0, 0, 0, 1, [[0, '#1e1310'], [1, '#0c0807']]);
    d += lg(p + '-plinth', 0, 0, 1, 0, [[0, '#1c0d09'], [0.7, '#3a1a11'], [1, '#56291a']]);
    d += '<pattern id="' + p + '-pan" width="160" height="360" patternUnits="userSpaceOnUse" x="0" y="112"><rect width="160" height="360" fill="none"/><rect x="14" y="16" width="132" height="330" fill="none" stroke="#4e281b" stroke-width="3"/><rect x="22" y="24" width="116" height="314" fill="none" stroke="#1d0c08" stroke-width="2"/><rect x="0" width="8" height="360" fill="#240f0a"/></pattern>';
    d += blur(p + '-b6', 6) + blur(p + '-b2', 2);

    /* 天花 + 射灯轨道 */
    s += R(0, 0, 1600, 100, '#120d0b');
    for (var bx = -40; bx < 1600; bx += 200) s += R(bx, 0, 16, 96, '#1d1512');
    s += R(0, 92, 1600, 8, '#1d1210') + R(100, 70, 1400, 6, '#2e2622') + R(100, 70, 1400, 1.5, '#5a4c40');
    /* 后墙：红木护墙板 */
    s += R(0, 100, 1600, 510, url(p + '-wall')) + R(0, 112, 1600, 360, url(p + '-pan'));
    s += R(0, 100, 1600, 14, '#1f0e09') + R(0, 110, 1600, 2, '#b08a44', 'opacity=".55"');
    s += R(0, 470, 1600, 14, '#1d0d08') + R(0, 470, 1600, 2, '#8a5a36', 'opacity=".7"');
    var dado = '';
    for (var dx = 10; dx < 1600; dx += 110) dado += R(dx, 494, 94, 100, 'none', 'stroke="#46231a" stroke-width="2"');
    s += dado + R(0, 596, 1600, 14, '#160906');

    /* 墙上的光池（射灯打在字画上） */
    var pools = [[380, 290, 170, 230], [560, 290, 140, 220], [800, 150, 220, 90], [1040, 290, 140, 220], [1220, 290, 170, 230]];
    for (var pi = 0; pi < pools.length; pi++) s += E(pools[pi][0], pools[pi][1], pools[pi][2], pools[pi][3], url(p + '-pool'));

    /* 匾额 */
    s += R(662, 120, 276, 66, '#0e0907') + R(668, 126, 264, 54, 'none', 'stroke="#b08a44" stroke-width="2.5"');
    var bian = ['朵', '雲', '軒'];
    for (var bk = 0; bk < 3; bk++) s += T(716 + bk * 62, 168, bian[bk], 42, '#d8b05a');

    /* 字画 */
    var mount = function (x, y, w, h, inner) {
      return L(x + w / 2, y - 26, x + 8, y, '#5a4636', 1.2) + L(x + w / 2, y - 26, x + w - 8, y, '#5a4636', 1.2) +
        R(x, y, w, h, '#6d6656') + R(x + 8, y + 26, w - 16, h - 64, '#dcd0b0') + inner +
        R(x - 4, y - 4, w + 8, 8, '#1a110c') + R(x - 6, y + h - 4, w + 12, 10, '#1a110c');
    };
    // 山水
    var sx = 330, sy = 170;
    var shan = P([sx + 10, sy + 250, sx + 36, sy + 120, sx + 58, sy + 170, sx + 74, sy + 100, sx + 90, sy + 250], '#8b8472', 'opacity=".75"') +
      P([sx + 10, sy + 250, sx + 30, sy + 190, sx + 50, sy + 230, sx + 70, sy + 170, sx + 90, sy + 250], '#4d483e', 'opacity=".8"') +
      R(sx + 10, sy + 196, 80, 12, '#e8dcbc', 'opacity=".7"') + P([sx + 60, sy + 70, sx + 72, sy + 48, sx + 84, sy + 72], '#8b8472', 'opacity=".5"');
    s += mount(sx, sy - 20, 100, 330, shan);
    // 书法
    var cal = '', cx0 = 530, poem = ['行到水窮處', '坐看雲起時'];
    for (var col = 0; col < 2; col++) for (var row = 0; row < 5; row++) cal += T(cx0 + 46 - col * 28, 214 + row * 38, poem[col].charAt(row), 26, '#1e1612');
    cal += T(cx0 + 14, 396, '摩詰句', 10, '#3a2e24') + R(cx0 + 16, 404, 9, 9, '#a8392c');
    s += mount(cx0, 150, 84, 300, cal);
    // 梅花
    var mx0 = 1000;
    var mei = D('M' + (mx0 + 16) + ' 420C' + (mx0 + 30) + ' 360 ' + (mx0 + 22) + ' 300 ' + (mx0 + 50) + ' 250C' + (mx0 + 62) + ' 226 ' + (mx0 + 56) + ' 200 ' + (mx0 + 68) + ' 186M' + (mx0 + 40) + ' 300C' + (mx0 + 60) + ' 290 ' + (mx0 + 66) + ' 270 ' + (mx0 + 70) + ' 250', 'none', 'stroke="#2a1d16" stroke-width="3.5"');
    for (var mb = 0; mb < 16; mb++) mei += C(mx0 + 22 + r() * 50, 190 + r() * 200, 2.6 + r() * 1.6, mb % 3 ? '#b8473e' : '#f0e6d6');
    s += mount(mx0, 150, 84, 300, mei);
    // 山水二（雪景）
    var sx2 = 1170, sy2 = 170;
    var shan2 = P([sx2 + 10, sy2 + 250, sx2 + 24, sy2 + 150, sx2 + 44, sy2 + 90, sx2 + 64, sy2 + 160, sx2 + 90, sy2 + 250], '#6d685c', 'opacity=".75"') +
      P([sx2 + 36, sy2 + 120, sx2 + 44, sy2 + 90, sx2 + 54, sy2 + 122], '#f2ead6') + R(sx2 + 10, sy2 + 214, 80, 10, '#e8dcbc', 'opacity=".6"') +
      P([sx2 + 50, sy2 + 250, sx2 + 70, sy2 + 200, sx2 + 90, sy2 + 250], '#3d392f', 'opacity=".85"');
    s += mount(sx2, sy2 - 20, 100, 330, shan2);

    /* 射灯灯头 + 光柱 */
    var fix = [165, 380, 572, 800, 1040, 1220, 1435];
    var tgt = [[70, 262, 250], [330, 430, 380], [530, 614, 330], [690, 910, 900], [1000, 1084, 330], [1170, 1270, 380], [1338, 1530, 250]];
    var beams = '';
    for (var fi = 0; fi < fix.length; fi++) {
      var fx = fix[fi], t0 = tgt[fi];
      beams += P([fx - 7, 84, fx + 7, 84, t0[1], t0[2], t0[0], t0[2]], url(fi === 3 ? p + '-beam' : p + '-beamS'));
    }
    s += beams;
    for (var fj = 0; fj < fix.length; fj++) {
      var f = fix[fj];
      s += R(f - 2, 74, 4, 8, '#2e2622') + '<g transform="rotate(' + (f < 800 ? -12 : f > 800 ? 12 : 0) + ' ' + f + ' 84)">' + R(f - 9, 80, 18, 24, '#2c2521', 'rx="3"') + E(f, 104, 8, 3, '#fff3d4') + '</g>';
    }

    /* 地面：抛光深色地板 + 倒影 + 光池 */
    s += R(0, 610, 1600, 290, url(p + '-floor'));
    s += E(800, 700, 260, 40, url(p + '-fpool')) + E(166, 660, 140, 24, url(p + '-fpool')) + E(1434, 660, 140, 24, url(p + '-fpool'));
    s += G(R(706, 612, 188, 150, '#6a3a22') + R(100, 612, 150, 110, '#5a3420') + R(1350, 612, 150, 110, '#5a3420'), 'opacity=".22" filter="' + url(p + '-b6') + '"');

    /* 立式玻璃展柜（左右） */
    var vit = function (x0, x1, objs) {
      var o = R(x0 - 8, 520, x1 - x0 + 16, 92, url(p + '-plinth')) + R(x0 - 8, 520, x1 - x0 + 16, 3, '#8a5a36');
      o += R(x0, 222, x1 - x0, 298, '#1a1210') + R(x0, 222, x1 - x0, 298, url(p + '-pool'), 'opacity=".55"');
      o += R(x0, 222, x1 - x0, 10, '#fff1cc', 'opacity=".75"') + R(x0, 232, x1 - x0, 30, '#fff1cc', 'opacity=".12"');
      o += R(x0, 330, x1 - x0, 3, '#dfe8e8', 'opacity=".35"') + R(x0, 428, x1 - x0, 3, '#dfe8e8', 'opacity=".35"');
      o += objs;
      o += R(x0, 222, x1 - x0, 298, url(p + '-glass')) + P([x0 + 20, 222, x0 + 50, 222, x0 + 10, 520, x0, 520, x0, 300], '#ffffff', 'opacity=".06"');
      o += R(x0 - 4, 216, x1 - x0 + 8, 8, '#3a2a1c') + R(x0 - 4, 216, 5, 306, '#5a4630') + R(x1 - 1, 216, 5, 306, '#3a2a1c');
      return o;
    };
    var vase = function (x, y, h, c1, c2) {
      return D('M' + (x - 5) + ' ' + (y - h) + 'L' + (x + 5) + ' ' + (y - h) + 'L' + (x + 4) + ' ' + (y - h * 0.82) + 'C' + (x + h * 0.34) + ' ' + (y - h * 0.7) + ' ' + (x + h * 0.3) + ' ' + (y - h * 0.2) + ' ' + (x + h * 0.14) + ' ' + y + 'L' + (x - h * 0.14) + ' ' + y + 'C' + (x - h * 0.3) + ' ' + (y - h * 0.2) + ' ' + (x - h * 0.34) + ' ' + (y - h * 0.7) + ' ' + (x - 4) + ' ' + (y - h * 0.82) + 'Z', c1) +
        R(x - h * 0.08, y - h * 0.7, h * 0.08, h * 0.5, '#ffffff', 'opacity=".35"') + (c2 ? R(x - h * 0.24, y - h * 0.5, h * 0.48, h * 0.1, c2, 'opacity=".8"') : '');
    };
    var card = function (x, y) { return R(x, y, 16, 10, '#e8e0cc') + R(x + 3, y + 3, 10, 1.5, '#555'); };
    s += vit(70, 262,
      vase(166, 330, 84, '#8fb09c') + card(214, 318) +
      E(166, 428, 46, 10, '#d8dfe4') + D('M120 428C124 400 208 400 212 428Z', '#d8dfe4') + D('M136 420C150 410 182 410 196 420', 'none', 'stroke="#35577f" stroke-width="3"') + card(214, 416) +
      D('M136 518L140 480L192 480L196 518Z', '#4f5a40') + R(132, 474, 68, 8, '#5f6a4c') + R(144, 466, 6, 10, '#4f5a40') + R(182, 466, 6, 10, '#4f5a40') + card(214, 506));
    s += vit(1338, 1530,
      vase(1434, 330, 78, '#e2d6c8', '#b0473e') + card(1484, 318) +
      C(1434, 400, 26, 'none', 'stroke="#9ab39a" stroke-width="16"') + R(1428, 424, 12, 6, '#3a2a1c') + card(1484, 416) +
      E(1434, 500, 42, 16, '#6a5a3a') + E(1434, 500, 30, 10, '#8a7a52') + D('M1400 518L1468 518L1458 506L1410 506Z', '#3a2a1c') + card(1484, 506));

    /* 中央展柜：仿沈秀纳财盆（聚宝盆） */
    s += R(700, 470, 200, 142, url(p + '-plinth')) + R(700, 470, 200, 3, '#b07a48') + R(716, 488, 168, 108, 'none', 'stroke="#1a0b07" stroke-width="2"');
    s += R(706, 336, 188, 134, '#140d0a') + E(800, 420, 120, 80, url(p + '-pool'));
    s += E(800, 456, 70, 8, '#000', 'opacity=".45"');
    s += D('M742 420L858 420C856 444 836 458 800 460C764 458 744 444 742 420Z', url(p + '-gold'));
    s += E(800, 420, 58, 9, '#5a3e16') + E(800, 418, 56, 7, '#8a6424');
    var ing = '';
    for (var ii = 0; ii < 11; ii++) {
      var ix = 758 + ii * 8 + (r() - 0.5) * 4, iy = 414 - Math.sin(ii / 10 * Math.PI) * 18 - r() * 4;
      ing += D('M' + q(ix - 8) + ' ' + q(iy) + 'Q' + q(ix) + ' ' + q(iy - 12) + ' ' + q(ix + 8) + ' ' + q(iy) + 'Q' + q(ix) + ' ' + q(iy + 5) + ' ' + q(ix - 8) + ' ' + q(iy) + 'Z', ii % 2 ? '#e8c46a' : '#c89a3e');
    }
    s += ing + C(800, 392, 6, '#f6e2a0') + C(800, 392, 14, '#fff0c0', 'opacity=".25"');
    s += C(738, 432, 7, 'none', 'stroke="#8a6424" stroke-width="3"') + C(862, 432, 7, 'none', 'stroke="#8a6424" stroke-width="3"');
    s += D('M770 436Q800 446 830 436', 'none', 'stroke="#5a3e16" stroke-width="2" opacity=".6"');
    s += R(706, 336, 188, 134, url(p + '-glass')) + R(702, 332, 196, 6, '#3a2a1c') + R(702, 332, 4, 140, '#5a4630') + R(894, 332, 4, 140, '#3a2a1c');
    s += P([730, 338, 760, 338, 720, 468, 708, 468], '#ffffff', 'opacity=".08"');
    s += card(876, 474);

    /* 隔离柱与红绒绳 */
    var post = function (x) { return R(x - 3, 540, 6, 72, '#b08a44') + R(x - 2, 540, 2, 72, '#f0d890', 'opacity=".6"') + C(x, 538, 6, '#c8a050') + E(x, 612, 14, 4, '#8a6a30'); };
    s += post(640) + post(960) + D('M640 548Q800 600 960 548', 'none', 'stroke="#7a1a1a" stroke-width="6"') + D('M640 546Q800 596 960 546', 'none', 'stroke="#b0303a" stroke-width="2" opacity=".6"');

    /* 光柱中的浮尘 */
    var dust = '';
    for (var di = 0; di < 26; di++) dust += c0(730 + r() * 140, 110 + r() * 220, 1 + r() * 1.4);
    s += '<g fill="#fff4d8" opacity=".7" class="' + p + '-dust">' + dust + '</g>';
    var css = '.' + p + '-dust{animation:' + p + '-dm 10s ease-in-out infinite alternate}@keyframes ' + p + '-dm{from{transform:translate(0,0)}to{transform:translate(6px,14px)}}';
    return wrap(p, d, css, s, 0.62);
  };

  /* =====================================================================
   * 飞机客舱：侧视舷窗墙面，窗外黄昏云海；机舱灯光昏暗，舷窗是主光源
   * ===================================================================== */
  GF.art.bg.airplane = function () {
    var p = 'bgap', r = U.rng(8807), d = '', s = '';
    var wins = [460, 860, 1260], WY0 = 246, WY1 = 450, WW = 140;
    d += lg(p + '-sky', 0, 0, 0, 1, [[0, '#0f1a30'], [0.3, '#26324e'], [0.55, '#6a5a6e'], [0.7, '#d08a5a'], [0.74, '#f4b068'], [1, '#8a6a7a']], false);
    d += '<linearGradient id="' + p + '-skyu" x1="0" y1="' + WY0 + '" x2="0" y2="' + WY1 + '" gradientUnits="userSpaceOnUse">' + stops([[0, '#0f1a30'], [0.35, '#2a3452'], [0.56, '#7a5e6a'], [0.63, '#e0955a'], [0.66, '#f8c070'], [0.7, '#c47a60'], [1, '#6a5070']]) + '</linearGradient>';
    d += rg(p + '-sun', 430, 375, 260, [[0, '#fff2c8', 1], [0.08, '#ffd88a', 0.9], [0.3, '#f0a050', 0.35], [1, '#f0a050', 0]], true);
    d += lg(p + '-bin', 0, 0, 0, 1, [[0, '#262c3a'], [0.75, '#3a4252'], [0.92, '#566072'], [1, '#1c212c']]);
    d += lg(p + '-wall', 0, 0, 0, 1, [[0, '#2c3444'], [0.25, '#3a4354'], [0.7, '#262d3b'], [1, '#161b25']]);
    d += lg(p + '-rev', 0, 0, 0, 1, [[0, '#4a4f60'], [0.5, '#6d6470'], [1, '#8a6a64']]);
    d += rg(p + '-spill', 0.5, 0.5, 0.5, [[0, '#f4a860', 0.34], [1, '#f4a860', 0]]);
    d += lg(p + '-seat', 1, 0, 0, 0, [[0, '#1a2236'], [0.7, '#243052'], [1, '#34426a']]);
    d += lg(p + '-cone', 0, 0, 0, 1, [[0, '#ffe2a8', 0.3], [1, '#ffe2a8', 0]]);
    d += lg(p + '-beam', 0, 0, 1, 1, [[0, '#f4a860', 0.22], [1, '#f4a860', 0]]);
    d += blur(p + '-b3', 3) + blur(p + '-b8', 8);
    var clip = '';
    for (var wi = 0; wi < wins.length; wi++) clip += '<rect x="' + (wins[wi] - WW / 2) + '" y="' + WY0 + '" width="' + WW + '" height="' + (WY1 - WY0) + '" rx="62"/>';
    d += '<clipPath id="' + p + '-wc">' + clip + '</clipPath>';

    s += R(0, 0, 1600, 900, '#131a26');
    /* 侧壁 */
    s += R(0, 200, 1600, 480, url(p + '-wall'));
    for (var sx = 660; sx < 1600; sx += 400) s += R(sx, 214, 2, 460, '#10141c', 'opacity=".6"');
    s += R(0, 520, 1600, 3, '#4a5264', 'opacity=".35"');
    /* 窗外：黄昏云海（一整幅，被舷窗裁出） */
    var sky = R(300, WY0, 1120, WY1 - WY0, url(p + '-skyu')) + R(300, WY0, 1120, WY1 - WY0, url(p + '-sun'));
    sky += G(E(700, 318, 220, 4, '#3a3048') + E(1100, 300, 260, 5, '#3a3048') + E(400, 330, 180, 3, '#4a3a50'), 'opacity=".7"');
    var cl = '<g class="' + p + '-drift">';
    var ccol = [['#8a6078', 382, 10, 30], ['#c47e6a', 392, 16, 40], ['#e8a47a', 404, 20, 50], ['#6a5070', 424, 26, 70], ['#f0b88a', 420, 22, 50]];
    for (var ci = 0; ci < ccol.length; ci++) {
      var g = '';
      for (var cx = 280 + r() * 30; cx < 1460; cx += ccol[ci][2] * 1.6 + r() * ccol[ci][2] * 2) g += c0(cx, ccol[ci][1] + r() * 12, ccol[ci][2] + r() * ccol[ci][3] * 0.4);
      cl += '<g fill="' + ccol[ci][0] + '">' + g + '</g>';
    }
    cl += '</g>';
    sky += cl + R(300, 376, 1120, 4, '#ffd69a', 'opacity=".35"');
    s += G(sky, 'clip-path="' + url(p + '-wc') + '"');
    /* 舷窗框：厚边框 + 内侧受光 */
    for (var wj = 0; wj < wins.length; wj++) {
      var x = wins[wj];
      s += E(x, 350, 150, 170, url(p + '-spill'));
      s += '<rect x="' + (x - 98) + '" y="' + (WY0 - 28) + '" width="196" height="' + (WY1 - WY0 + 56) + '" rx="92" fill="none" stroke="' + url(p + '-rev') + '" stroke-width="26"/>';
      s += '<rect x="' + (x - 84) + '" y="' + (WY0 - 14) + '" width="168" height="' + (WY1 - WY0 + 28) + '" rx="78" fill="none" stroke="#1a1f2a" stroke-width="3" opacity=".7"/>';
      s += '<rect x="' + (x - WW / 2 - 2) + '" y="' + (WY0 - 2) + '" width="' + (WW + 4) + '" height="' + (WY1 - WY0 + 4) + '" rx="64" fill="none" stroke="#f4b070" stroke-width="2" opacity=".55"/>';
      // 遮光板轨道（窗顶）
      s += R(x - 56, WY0 - 20, 112, 8, '#3a404e', 'rx="4"');
    }
    /* 第三扇窗：遮光板拉下一半 */
    s += G(R(1190, WY0, 140, 104, '#9a969a') + R(1190, WY0 + 96, 140, 8, '#6a666e') + R(1244, WY0 + 98, 32, 5, '#3a3a42', 'rx="2"') + R(1190, WY0, 140, 104, '#f0a060', 'opacity=".12"'), 'clip-path="' + url(p + '-wc') + '"');

    /* 行李舱 + 服务面板 */
    s += R(0, 0, 1600, 172, url(p + '-bin'));
    s += D('M0 150Q800 196 1600 150L1600 176Q800 222 0 176Z', '#1a1f2a');
    s += D('M0 150Q800 196 1600 150', 'none', 'stroke="#8a90a0" stroke-width="2" opacity=".35"');
    for (var bs = 20; bs < 1600; bs += 540) s += R(bs, 10, 3, 158, '#161a24') + R(bs + 250, 140, 44, 10, '#141821', 'rx="4"') + R(bs + 254, 142, 36, 3, '#5a6072');
    s += R(0, 184, 1600, 24, '#191e29') + R(0, 184, 1600, 2, '#3a4150');
    var psu = '';
    for (var px = 120; px < 1600; px += 400) {
      psu += C(px, 196, 6, '#2a303c') + C(px + 24, 196, 6, '#2a303c') + C(px + 60, 196, 5, '#111') + C(px + 80, 196, 5, '#111');
    }
    s += psu;
    // 亮着的阅读灯 + 光锥
    s += C(720, 196, 6, '#ffe8b0') + C(720, 196, 14, '#ffe8b0', 'opacity=".3"');
    s += P([712, 202, 728, 202, 820, 640, 610, 640], url(p + '-cone'));
    // 安全带指示灯
    s += R(988, 188, 64, 16, '#2a2a30', 'rx="3"') + R(992, 190, 26, 12, '#e8c890', 'rx="2"') + R(1022, 190, 26, 12, '#e8c890', 'rx="2"', 'opacity=".9"');
    s += D('M998 196h14M1005 192v8', 'none', 'stroke="#3a2a1a" stroke-width="2"') + D('M1027 196h16', 'none', 'stroke="#3a2a1a" stroke-width="2.5"');

    /* 舷窗投进来的暖光 */
    for (var wk = 0; wk < wins.length; wk++) s += P([wins[wk] - 60, 440, wins[wk] + 60, 440, wins[wk] + 220, 760, wins[wk] - 20, 760], url(p + '-beam'), 'opacity="' + (wk === 0 ? 1 : 0.7) + '"');

    /* 座椅侧影（面朝左） */
    var seat = function (bx) {
      var o = D('M' + bx + ' 700L' + (bx - 8) + ' 470C' + (bx - 10) + ' 430 ' + (bx + 4) + ' 404 ' + (bx + 36) + ' 404L' + (bx + 60) + ' 406C' + (bx + 82) + ' 410 ' + (bx + 92) + ' 430 ' + (bx + 94) + ' 460L' + (bx + 104) + ' 700Z', url(p + '-seat'));
      o += D('M' + (bx - 6) + ' 470C' + (bx - 8) + ' 440 ' + (bx + 4) + ' 414 ' + (bx + 32) + ' 412L' + (bx + 34) + ' 452C' + (bx + 14) + ' 454 ' + (bx - 2) + ' 470 ' + (bx - 4) + ' 490Z', '#d4d0c6');
      o += D('M' + (bx - 6) + ' 470C' + (bx - 8) + ' 440 ' + (bx + 4) + ' 414 ' + (bx + 32) + ' 412', 'none', 'stroke="#f8c890" stroke-width="3" opacity=".7"');
      o += R(bx - 170, 610, 176, 40, '#1f2940', 'rx="10"') + R(bx - 170, 610, 176, 4, '#6a5a6a', 'rx="2"');
      o += R(bx - 150, 572, 152, 14, '#161c2a', 'rx="6"') + R(bx - 150, 572, 152, 3, '#8a6a64', 'opacity=".6"') + R(bx - 120, 586, 10, 26, '#161c2a');
      o += R(bx - 150, 650, 12, 110, '#0f131c') + R(bx - 10, 650, 12, 110, '#0f131c');
      return o;
    };
    s += seat(140) + seat(560) + seat(960) + seat(1360);
    /* 地板 */
    s += R(0, 740, 1600, 160, '#0c1018') + R(0, 740, 1600, 3, '#2a3040');
    var css = '.' + p + '-drift{animation:' + p + '-dr 40s linear infinite alternate}@keyframes ' + p + '-dr{from{transform:translateX(0)}to{transform:translateX(-60px)}}';
    return wrap(p, d, css, s, 0.7);
  };

  GF.art.bg.hilton = function () { return hiltonRoom('bghl', false); };
  GF.art.bg.hilton_wind = function () { return hiltonRoom('bghw', true); };
})();
