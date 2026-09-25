/*
 * 地下 / 墓穴背景：tunnel, tunnel_fork, slab_room, corridor_dark, corridor, tomb_gate, coffin_room
 * 画法：简化的单点透视“舞台布景”——世界坐标（米）投影到 1600x900，
 * 近处面片按光照分级着色（色阶化，扁平剧场感），远处雾化入黑。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var BG = GF.art.bg;

  /* ---------------- 小工具 ---------------- */
  function R(v) { return Math.round(v); }
  function n1(v) { return String(Math.round(v * 10) / 10); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function P(pts) {
    var s = 'M';
    for (var i = 0; i < pts.length; i++) s += (i ? 'L' : '') + R(pts[i][0]) + ' ' + R(pts[i][1]);
    return s + 'Z';
  }
  function P0(pts, close) {
    var s = 'M';
    for (var i = 0; i < pts.length; i++) s += (i ? 'L' : '') + R(pts[i][0]) + ' ' + R(pts[i][1]);
    return s + (close ? 'Z' : '');
  }
  function P1(pts, close) {
    var s = 'M';
    for (var i = 0; i < pts.length; i++) s += (i ? 'L' : '') + n1(pts[i][0]) + ' ' + n1(pts[i][1]);
    return s + (close ? 'Z' : '');
  }
  function ramp(stops, t) {
    t = clamp(t, 0, 1);
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        return U.mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return stops[stops.length - 1][1];
  }
  function Cam(x, y, f, cx, cy) { return { x: x, y: y, f: f, cx: cx, cy: cy }; }
  function pj(c, p) { return [c.cx + (p[0] - c.x) * c.f / p[2], c.cy + (p[1] - c.y) * c.f / p[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  /* 点光源（可带聚光锥）：l = {p:[x,y,z], i:强度, r:衰减半径, dir?:[..], c0?, c1?} */
  function lightAt(p, n, lights) {
    var L = 0;
    for (var i = 0; i < lights.length; i++) {
      var l = lights[i], v = sub(l.p, p), d = Math.sqrt(dot(v, v)) || 1e-3;
      var lam = dot(n, v) / d; if (lam < 0) lam = 0;
      var k = l.i * (0.3 + 0.7 * lam) / (1 + (d / l.r) * (d / l.r));
      if (l.dir) {
        var ca = -dot(l.dir, [v[0] / d, v[1] / d, v[2] / d]);
        var t = clamp((ca - l.c0) / (l.c1 - l.c0), 0, 1);
        k *= l.spill + (1 - l.spill) * t * t * (3 - 2 * t);
      }
      L += k;
    }
    return L;
  }

  /* 隧道/管状空间：rings 由近到远；按由远到近画每一圈面片，deco(i) 在第 i 圈画完后插入 */
  function tube(cam, rings, shade, deco) {
    var s = '';
    for (var i = rings.length - 2; i >= 0; i--) {
      var A = rings[i], B = rings[i + 1], n = A.pts.length, g = {}, ord = [];
      for (var j = 0; j < n; j++) {
        var k = (j + 1) % n, a = A.pts[j], b = A.pts[k], c = B.pts[k], d = B.pts[j];
        var col = shade(a, b, c, d, A);
        if (!col) continue;
        if (!g[col]) { g[col] = ''; ord.push(col); }
        g[col] += P([pj(cam, a), pj(cam, b), pj(cam, c), pj(cam, d)]);
      }
      for (var q = 0; q < ord.length; q++) s += '<path fill="' + ord[q] + '" stroke="' + ord[q] + '" d="' + g[ord[q]] + '"/>';
      if (deco) s += deco(i, A.z, B.z);
    }
    return s;
  }
  function quadNormal(a, b, d, center, p) {
    var n = norm(cross(sub(b, a), sub(d, a)));
    if (dot(n, sub(center, p)) < 0) n = [-n[0], -n[1], -n[2]];
    return n;
  }
  function mkRings(zs, prof, off, rnd, jit, scale) {
    return zs.map(function (z, i) {
      var o = off(z), sc = scale ? scale(z) : 1, jj = (i === 0 ? 0.3 : 1) * jit;
      var pts = prof.map(function (p) {
        var fy = p[1] > 1 ? 0.25 : 1;
        return [o[0] + p[0] * sc + (rnd() - 0.5) * 2 * jj, o[1] + p[1] * sc + (rnd() - 0.5) * 1.6 * jj * fy, z];
      });
      return { z: z, c: [o[0], o[1] + 0.3 * sc], pts: pts };
    });
  }

  /* 土色色阶 */
  var EARTH = [[0, '#050908'], [0.1, '#0c1512'], [0.24, '#1f211a'], [0.42, '#4e3520'], [0.62, '#8a5228'], [0.82, '#c87c36'], [1, '#f0b060']];
  var SOIL = [[0, '#060908'], [0.1, '#141512'], [0.24, '#30241a'], [0.42, '#5e4128'], [0.62, '#9a6634'], [0.82, '#d4924a'], [1, '#f4c070']];

  function earthShader(lights, rnd, amb, fog0, fog1, steps, noise, kFloor, kCeil) {
    noise = noise == null ? 0.06 : noise;
    return function (a, b, c, d, A) {
      var p = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4, (a[2] + b[2] + c[2] + d[2]) / 4];
      var n = quadNormal(a, b, d, [A.c[0], A.c[1], p[2]], p);
      var fl = n[1] < -0.55;
      if (fl) { p = [A.c[0], p[1], p[2]]; n = [0, -1, 0]; }   // 地面按中线取光，避免锯齿
      var L = amb + lightAt(p, n, lights) + (rnd() - 0.5) * noise;
      if (n[1] > 0.55) L *= kCeil || 0.78;           // 顶
      if (fl) L *= kFloor || 1;
      L = Math.round(clamp(L, 0, 1) * steps) / steps;
      var col = ramp(n[1] < -0.55 ? SOIL : EARTH, L);
      var fz = clamp((p[2] - fog0) / (fog1 - fog0), 0, 1);
      return U.mix(col, '#030605', Math.pow(fz, 1.3));
    };
  }

  /* 油灯公共 defs（火苗、光晕、动画） */
  function lampDefs(pf) {
    return '<radialGradient id="' + pf + '-glow"><stop offset="0" stop-color="#ffd088" stop-opacity=".75"/>' +
      '<stop offset=".18" stop-color="#f0a040" stop-opacity=".34"/><stop offset=".55" stop-color="#d07020" stop-opacity=".1"/>' +
      '<stop offset="1" stop-color="#d07020" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + pf + '-fg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6c8"/>' +
      '<stop offset=".45" stop-color="#ffb444"/><stop offset="1" stop-color="#e05a10" stop-opacity="0"/></linearGradient>' +
      '<g id="' + pf + '-fl"><path d="M0 0C-.42-.16-.3-.62 0-1C.3-.62.42-.16 0 0Z" fill="url(#' + pf + '-fg)"/>' +
      '<path d="M0 0C-.2-.1-.13-.34 0-.5C.13-.34.2-.1 0 0Z" fill="#fffbe6"/></g>';
  }
  function lampCss(pf) {
    return '<style>.' + pf + '-fk{transform-box:fill-box;transform-origin:50% 100%;animation:' + pf + '-fk .8s ease-in-out infinite alternate}' +
      '@keyframes ' + pf + '-fk{0%{transform:scale(1,1) skewX(0)}45%{transform:scale(.9,1.14) skewX(5deg)}100%{transform:scale(1.06,.88) skewX(-4deg)}}' +
      '.' + pf + '-gw{animation:' + pf + '-gw 1.9s ease-in-out infinite alternate}' +
      '@keyframes ' + pf + '-gw{0%{opacity:.78}35%{opacity:1}70%{opacity:.86}100%{opacity:.72}}' +
      '.' + pf + '-ds{animation:' + pf + '-ds 9s linear infinite}' +
      '@keyframes ' + pf + '-ds{0%{transform:translate(0,0);opacity:0}20%{opacity:.8}100%{transform:translate(14px,-60px);opacity:0}}</style>';
  }
  /* 壁上小铁盘油灯：X,Y 为铁盘中心，s 为每米像素，side=-1 左壁 / 1 右壁 */
  function ironLamp(pf, X, Y, s, side, k, glowR) {
    var pw = 0.09 * s, ph = 0.024 * s, fh = 0.12 * s, dl = 'animation-delay:-' + n1(k * 0.37) + 's';
    var o = '<circle cx="' + R(X) + '" cy="' + R(Y - fh * 0.5) + '" r="' + R((glowR || 1) * s) + '" fill="url(#' + pf + '-glow)" class="' + pf + '-gw" style="mix-blend-mode:screen;' + dl + '"/>';
    o += '<path d="M' + n1(X + side * 0.13 * s) + ' ' + n1(Y - 0.012 * s) + 'L' + n1(X) + ' ' + n1(Y + ph * 0.4) + '" stroke="#140e0a" stroke-width="' + n1(Math.max(1, 0.014 * s)) + '"/>';
    o += '<path d="M' + n1(X - pw) + ' ' + n1(Y) + 'Q' + n1(X) + ' ' + n1(Y + ph * 2.6) + ' ' + n1(X + pw) + ' ' + n1(Y) + 'Z" fill="#120c08"/>';
    o += '<ellipse cx="' + n1(X) + '" cy="' + n1(Y) + '" rx="' + n1(pw) + '" ry="' + n1(ph * 0.55) + '" fill="#7a4418"/>';
    o += '<path d="M' + n1(X - pw) + ' ' + n1(Y) + 'Q' + n1(X) + ' ' + n1(Y + ph * 2.6) + ' ' + n1(X + pw) + ' ' + n1(Y) + '" fill="none" stroke="#e89048" stroke-opacity=".55" stroke-width="' + n1(Math.max(0.6, 0.004 * s)) + '"/>';
    o += '<g transform="translate(' + n1(X + side * 0.02 * s) + ' ' + n1(Y - ph * 0.2) + ') scale(' + n1(fh * 0.5) + ' ' + n1(fh) + ')"><use href="#' + pf + '-fl" class="' + pf + '-fk" style="' + dl + '"/></g>';
    return o;
  }

  /* 土壁装饰：镐痕、树根、碎石、洛阳铲孔 —— 按深度分桶，交给 tube 的 deco 回调 */
  function Bins() { this.b = []; }
  Bins.prototype.add = function (z, svg) { this.b.push([z, svg]); };
  Bins.prototype.take = function (z0, z1) {
    var s = '';
    for (var i = 0; i < this.b.length; i++) if (this.b[i][0] >= z0 && this.b[i][0] < z1) s += this.b[i][1];
    return s;
  };

  function pickMark(cam, x, y, z, side, rnd) {
    var s = cam.f / z, o = '', len = 0.08 + rnd() * 0.1;
    for (var m = 0; m < 3; m++) {
      var yy = y + m * 0.03, a = pj(cam, [x, yy, z]), b = pj(cam, [x, yy + len * 0.55, z + len * 0.8]);
      o += 'M' + R(a[0]) + ' ' + R(a[1]) + 'L' + R(b[0]) + ' ' + R(b[1]);
    }
    return '<path d="' + o + '" stroke="#0a0604" stroke-opacity=".32" stroke-width="' + n1(Math.max(0.8, 0.01 * s)) + '" stroke-linecap="round"/>';
  }
  /* 黄土层理：沿壁面的水平线 */
  function strata(cam, rings, side, y, col, op) {
    var pts = [];
    rings.forEach(function (rg) {
      if (rg.z < 0.5) return;
      var x = rg.c[0] + side * 0.66;
      pts.push(pj(cam, [x, rg.c[1] - 0.3 + y, rg.z]));
    });
    return '<path d="' + P1(pts) + '" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="1.5"/>';
  }
  function root(cam, x, y, z, rnd) {
    var s = cam.f / z, pts = [], len = 0.05 + rnd() * 0.14, w = (rnd() - 0.5) * 0.08;
    for (var i = 0; i <= 5; i++) {
      var t = i / 5;
      pts.push(pj(cam, [x + Math.sin(t * 3 + x * 9) * 0.02 + w * t, y + t * len, z]));
    }
    return '<path d="' + P1(pts) + '" fill="none" stroke="#140d08" stroke-opacity=".75" stroke-width="' + n1(Math.max(0.6, 0.0045 * s)) + '" stroke-linecap="round"/>';
  }
  function stone(cam, x, y, z, rnd, lit) {
    var s = cam.f / z, r = 0.025 + rnd() * 0.05, pts = [], top = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI + i / 5 * Math.PI, rr = r * (0.7 + rnd() * 0.5);
      pts.push(pj(cam, [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9, z]));
    }
    pts.push(pj(cam, [x + r, y, z]));
    return '<path d="' + P1(pts, 1) + '" fill="' + U.mix('#140f0b', lit, 0.35) + '"/>' +
      '<path d="' + P1(pts.slice(1, 4)) + '" fill="none" stroke="' + lit + '" stroke-opacity=".5" stroke-width="' + n1(Math.max(0.6, 0.006 * s)) + '"/>' +
      '<ellipse cx="' + n1(pj(cam, [x, y, z])[0]) + '" cy="' + n1(pj(cam, [x, y, z])[1] + 0.004 * s) + '" rx="' + n1(r * s * 1.2) + '" ry="' + n1(r * s * 0.25) + '" fill="#000" opacity=".35"/>';
  }
  function shovelHole(cam, x, y, z) {
    var s = cam.f / z, c = pj(cam, [x, y, z]);
    return '<ellipse cx="' + n1(c[0]) + '" cy="' + n1(c[1]) + '" rx="' + n1(0.04 * s) + '" ry="' + n1(0.014 * s) + '" fill="#020303"/>' +
      '<path d="M' + n1(c[0] - 0.04 * s) + ' ' + n1(c[1]) + 'A' + n1(0.04 * s) + ' ' + n1(0.014 * s) + ' 0 0 0 ' + n1(c[0] + 0.04 * s) + ' ' + n1(c[1]) + '" fill="none" stroke="#b07038" stroke-opacity=".35" stroke-width="' + n1(Math.max(0.6, 0.004 * s)) + '"/>';
  }
  function motes(pf, pts, rnd) {
    var o = '';
    for (var i = 0; i < pts.length; i++) {
      o += '<circle cx="' + R(pts[i][0]) + '" cy="' + R(pts[i][1]) + '" r="' + n1(0.8 + rnd() * 1.4) + '" fill="#ffd8a0" class="' + pf + '-ds" style="animation-delay:-' + n1(rnd() * 9) + 's"/>';
    }
    return o;
  }


  /* ============ tunnel：孙氏兄弟挖的地下甬道 ============ */
  var TPROF = [[-0.5, 1.1], [-0.17, 1.13], [0.18, 1.12], [0.5, 1.1], [0.63, 0.78], [0.68, 0.35], [0.65, -0.05], [0.52, -0.32],
    [0.24, -0.45], [-0.08, -0.47], [-0.4, -0.39], [-0.62, -0.12], [-0.68, 0.3], [-0.64, 0.74]];

  BG.tunnel = function () {
    var pf = 'bg-tun', rnd = U.rng(5011), cam = Cam(0, 0, 700, 800, 380);
    var zs = [0.2, 0.42, 0.7, 1.0, 1.35, 1.75, 2.2, 2.7, 3.25, 3.85, 4.5, 5.25, 6.1, 7.1, 8.3, 9.7, 11.3, 13.2, 15.5];
    var off = function (z) { return [0.011 * z * z, 0.002 * z * z]; };
    var rings = mkRings(zs, TPROF, off, rnd, 0.04);
    var lampPos = [[-1, 2.05], [1, 4.1], [-1, 6.5], [1, 9.3], [-1, 12.6]];
    var lights = [], bins = new Bins(), dust = [];
    lampPos.forEach(function (lp, k) {
      var z = lp[1], o = off(z), side = lp[0];
      var w = [o[0] + side * 0.57, o[1] - 0.04, z];
      lights.push({ p: [w[0] - side * 0.06, w[1] - 0.1, z], i: 1.55 - k * 0.05, r: 0.62 });
      var X = pj(cam, w), s = cam.f / z;
      var soot = pj(cam, [w[0] - side * 0.05, o[1] - 0.43, z]);
      bins.add(z, '<ellipse cx="' + R(soot[0]) + '" cy="' + R(soot[1]) + '" rx="' + R(0.22 * s) + '" ry="' + R(0.09 * s) + '" fill="url(#' + pf + '-soot)"/>');
      bins.add(z, ironLamp(pf, X[0], X[1], s, side, k, 1.35));
      if (k < 3) for (var m = 0; m < 5; m++) dust.push([X[0] + (rnd() - 0.5) * 0.5 * s, X[1] + (rnd() - 0.3) * 0.4 * s]);
    });
    for (var i = 0; i < 26; i++) {
      var z = 1.2 + Math.pow(rnd(), 1.3) * 5, o = off(z), side = rnd() < 0.5 ? -1 : 1;
      bins.add(z, pickMark(cam, o[0] + side * 0.64, o[1] - 0.2 + rnd() * 0.9, z, side, rnd));
    }
    for (i = 0; i < 22; i++) {
      z = 1.7 + Math.pow(rnd(), 1.2) * 7; o = off(z);
      bins.add(z, root(cam, o[0] + (rnd() - 0.5) * 0.8, o[1] - 0.44, z, rnd));
    }
    for (i = 0; i < 14; i++) {
      z = 1.9 + Math.pow(rnd(), 1.2) * 6; o = off(z);
      bins.add(z, stone(cam, o[0] + (rnd() - 0.5) * 0.85, o[1] + 1.1, z, rnd, '#a87038'));
    }
    bins.add(2.9, shovelHole(cam, off(2.9)[0] + 0.12, off(2.9)[1] - 0.455, 2.9));
    bins.add(5.6, shovelHole(cam, off(5.6)[0] - 0.18, off(5.6)[1] - 0.45, 5.6));

    var shade = earthShader(lights, rnd, 0.03, 3.2, 13, 11, 0.04);
    var body = tube(cam, rings, shade, function (i, z0, z1) { return bins.take(z0, z1); });

    var defs = '<defs>' + lampDefs(pf) +
      '<linearGradient id="' + pf + '-air" x1="0" y1="0" x2="0" y2="1"><stop offset=".62" stop-color="#050807" stop-opacity="0"/><stop offset="1" stop-color="#050807" stop-opacity=".6"/></linearGradient>' +
      '<linearGradient id="' + pf + '-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030605" stop-opacity=".85"/><stop offset=".26" stop-color="#030605" stop-opacity="0"/>' +
      '<stop offset=".72" stop-color="#030605" stop-opacity="0"/><stop offset="1" stop-color="#030605" stop-opacity=".85"/></linearGradient>' +
      '<radialGradient id="' + pf + '-soot"><stop offset="0" stop-color="#040302" stop-opacity=".75"/><stop offset="1" stop-color="#040302" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    return U.svg(lampCss(pf) + defs + '<rect width="1600" height="900" fill="#020403"/>' + body +
      '<rect width="1600" height="900" fill="url(#' + pf + '-side)"/>' +
      motes(pf, dust, rnd) +
      '<rect width="1600" height="900" fill="url(#' + pf + '-air)"/>' + U.vignette(pf, 0.85));
  };

  /* ============ tunnel_fork：岔路口（不画油灯，小游戏会叠加） ============ */
  var CPROF = [[-1.7, 1.1], [-0.9, 1.12], [0, 1.13], [0.9, 1.12], [1.7, 1.1], [1.93, 0.78], [2.02, 0.4], [2.0, 0.0], [1.88, -0.3],
    [1.45, -0.55], [0.8, -0.66], [0, -0.69], [-0.8, -0.66], [-1.45, -0.55], [-1.88, -0.3], [-2.0, 0.0], [-2.02, 0.4], [-1.93, 0.78]];
  var MPROF = [[-0.46, 1.085], [0, 1.1], [0.46, 1.085], [0.52, 0.62], [0.51, 0.16], [0.43, -0.12], [0.24, -0.25], [0, -0.29],
    [-0.24, -0.25], [-0.43, -0.12], [-0.51, 0.16], [-0.52, 0.62]];

  BG.tunnel_fork = function () {
    var pf = 'bg-frk', rnd = U.rng(7303), cam = Cam(0, 0, 700, 800, 390), ZF = 3.3;
    var torch = { p: [0.2, 0.15, -0.3], dir: norm([0, 0.1, 1]), c0: 0.86, c1: 0.985, spill: 0.3, i: 2.0, r: 2.8 };
    var back = { p: [-1.3, -0.2, -0.6], i: 1.3, r: 1.9 };
    var lights = [torch, back];
    var chamber = mkRings([0.3, 0.55, 0.8, 1.08, 1.4, 1.75, 2.15, 2.6, ZF], CPROF, function () { return [0, 0]; }, rnd, 0.035);
    var shadeC = earthShader(lights, rnd, 0.04, 6, 20, 12, 0.02, 0.62, 0.55);
    var bins = new Bins();
    for (var i = 0; i < 22; i++) {
      var z = 1.3 + rnd() * 1.9, side = rnd() < 0.5 ? -1 : 1;
      bins.add(z, pickMark(cam, side * 1.98, -0.3 + rnd() * 1.0, z, side, rnd));
    }
    for (i = 0; i < 14; i++) { z = 1.3 + rnd() * 1.9; bins.add(z, root(cam, (rnd() - 0.5) * 3, -0.66, z, rnd)); }
    for (i = 0; i < 8; i++) { z = 2.1 + rnd() * 1.1; var sx = (rnd() < 0.5 ? -1 : 1) * (1.2 + rnd() * 0.6); bins.add(z, stone(cam, sx, 1.11, z, rnd, '#a87848')); }
    var chamberSvg = tube(cam, chamber, shadeC, function (i, z0, z1) { return bins.take(z0, z1); });
    var lay = '';
    [[-1, 0.2, '#000', 0.25], [-1, 0.55, '#e0a060', 0.1], [1, 0.1, '#000', 0.25], [1, 0.7, '#e0a060', 0.1]].forEach(function (q) {
      var pts = [];
      chamber.forEach(function (rg) { if (rg.z > 0.9) pts.push(pj(cam, [q[0] * 1.99, q[1], rg.z])); });
      lay += '<path d="' + P1(pts) + '" fill="none" stroke="' + q[2] + '" stroke-opacity="' + q[3] + '" stroke-width="1.5"/>';
    });

    function branch(sign, seed) {
      var r2 = U.rng(seed);
      var zs = [ZF, 3.7, 4.2, 4.8, 5.5, 6.4, 7.5, 9];
      var rings = mkRings(zs, MPROF, function (z) { var t = z - ZF; return [sign * (1.13 + 0.42 * t + 0.05 * t * t), 0.01 * t * t]; }, r2, 0.035);
      rings[0].pts = MPROF.map(function (p) { return [sign * 1.13 + p[0], p[1], ZF]; });
      var sh = earthShader(lights, r2, 0.02, ZF, 6.8, 8);
      return { rings: rings, svg: tube(cam, rings, sh) };
    }
    var L = branch(-1, 91), Rb = branch(1, 92);
    var face = chamber[chamber.length - 1].pts.map(function (p) { return pj(cam, p); });
    var hL = L.rings[0].pts.map(function (p) { return pj(cam, p); });
    var hR = Rb.rings[0].pts.map(function (p) { return pj(cam, p); });
    var faceD = P(face) + P(hL) + P(hR);

    var c1 = ramp(EARTH, 0.74), c2 = ramp(EARTH, 0.56), c3 = ramp(EARTH, 0.4), c4 = ramp(EARTH, 0.27);
    var defs = '<defs>' + lampDefs(pf) +
      '<clipPath id="' + pf + '-fc"><path clip-rule="evenodd" d="' + faceD + '"/></clipPath>' +
      '<radialGradient id="' + pf + '-pool" cx="800" cy="440" r="420" gradientUnits="userSpaceOnUse" gradientTransform="translate(800 440) scale(1 .78) translate(-800 -440)">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset=".2" stop-color="' + c1 + '"/>' +
      '<stop offset=".26" stop-color="' + c2 + '"/><stop offset=".44" stop-color="' + c2 + '"/>' +
      '<stop offset=".52" stop-color="' + c3 + '"/><stop offset=".72" stop-color="' + c3 + '"/>' +
      '<stop offset=".84" stop-color="' + c4 + '"/><stop offset="1" stop-color="' + ramp(EARTH, 0.18) + '"/></radialGradient>' +
      '<radialGradient id="' + pf + '-hole" cx="50%" cy="62%" r="62%"><stop offset=".25" stop-color="#000" stop-opacity=".96"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient>' +
      '<linearGradient id="' + pf + '-flr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>' +
      '<linearGradient id="' + pf + '-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030605" stop-opacity=".8"/><stop offset=".22" stop-color="#030605" stop-opacity="0"/>' +
      '<stop offset=".78" stop-color="#030605" stop-opacity="0"/><stop offset="1" stop-color="#030605" stop-opacity=".8"/></linearGradient>' +
      '</defs>';
    var faceSvg = '<g clip-path="url(#' + pf + '-fc)"><rect x="300" y="200" width="1000" height="460" fill="url(#' + pf + '-pool)"/>';
    // 墙面：黄土层理 + 镐痕
    var fm = '', fr = U.rng(11);
    for (i = 0; i < 34; i++) {
      var x = -1.9 + fr() * 3.8, y = -0.6 + fr() * 1.6;
      if (Math.abs(Math.abs(x) - 1.13) < 0.6 && y > -0.35) continue;
      var a = pj(cam, [x, y, ZF]), b = pj(cam, [x + 0.04, y + 0.1, ZF]);
      for (var m = 0; m < 3; m++) fm += 'M' + R(a[0] + m * 5) + ' ' + R(a[1] + m) + 'L' + R(b[0] + m * 5) + ' ' + R(b[1] + m);
    }
    faceSvg += '<path d="M300 318C500 312 640 326 800 318S1100 310 1300 322M300 360C520 356 700 368 900 360S1180 356 1300 364M300 540C480 548 640 536 800 544S1120 538 1300 546" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="2"/>';
    faceSvg += '<path d="M300 322C500 316 640 330 800 322S1100 314 1300 326M300 546C480 554 640 542 800 550S1120 544 1300 552" fill="none" stroke="#f4c080" stroke-opacity=".12" stroke-width="1.5"/>';
    faceSvg += '<path d="' + fm + '" stroke="#0a0604" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>';
    faceSvg += '</g>';
    function lip(h) {
      return '<path d="' + P1(h.slice(3).concat([h[0]])) + '" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="8" stroke-linejoin="round"/>' +
        '<path d="' + P1([h[h.length - 1], h[0], h[1], h[2], h[3]]) + '" fill="none" stroke="#d0925a" stroke-opacity=".4" stroke-width="2.5"/>';
    }
    var dust = [];
    for (i = 0; i < 16; i++) dust.push([640 + rnd() * 320, 330 + rnd() * 320]);

    return U.svg(lampCss(pf) + defs + '<rect width="1600" height="900" fill="#020403"/>' +
      L.svg + Rb.svg +
      '<path d="' + P(hL) + '" fill="url(#' + pf + '-hole)"/><path d="' + P(hR) + '" fill="url(#' + pf + '-hole)"/>' +
      chamberSvg + lay + faceSvg + lip(hL) + lip(hR) + motes(pf, dust, rnd) +
      '<rect y="600" width="1600" height="300" fill="url(#' + pf + '-flr)"/><rect width="1600" height="900" fill="url(#' + pf + '-side)"/>' + U.vignette(pf, 0.85));
  };

  /* ============ 墓道（corridor / corridor_dark 共用几何） ============ */
  /* 怪异符号字库（单位方格内的折线：u 向右，v 向下） */
  var GLY = [
    [[[0, .5], [.3, .22], [.7, .22], [1, .5], [.7, .78], [.3, .78], [0, .5]], [[.42, .5], [.58, .5]]],
    [[[.5, .5], [.62, .38], [.72, .56], [.5, .76], [.24, .54], [.34, .18], [.76, .12], [.96, .5], [.7, .96]]],
    [[[.5, 1], [.5, .22]], [[.12, .02], [.12, .36], [.88, .36], [.88, .02]]],
    [[[.2, .35], [.5, .14], [.8, .35], [.8, .65], [.5, .86], [.2, .65], [.2, .35]], [[0, 1], [1, 0]]],
    [[[.3, 0], [.72, .25], [.3, .5], [.72, .75], [.3, 1]], [[.85, .1], [.85, .2]]],
    [[[.1, .22], [.5, 0], [.9, .22]], [[.1, .6], [.5, .38], [.9, .6]], [[.5, .6], [.5, 1]]],
    [[[.08, 0], [.5, .45], [.92, 0]], [[.5, .45], [.5, 1]], [[.2, .78], [.26, .86]]],
    [[[.5, 0], [1, .92], [0, .92], [.5, 0]], [[.36, .62], [.5, .52], [.64, .62], [.5, .72], [.36, .62]]],
    [[[.2, 0], [.2, .7], [.5, 1], [.8, .7]], [[.62, .08], [.84, .2], [.72, .42], [.54, .26], [.62, .08]]],
    [[[.25, 0], [.25, 1]], [[.75, 0], [.75, 1]], [[.25, .32], [.75, .2]], [[.25, .72], [.75, .6]]],
    [[[0, .3], [.25, .12], [.5, .3], [.75, .12], [1, .3]], [[0, .72], [.25, .54], [.5, .72], [.75, .54], [1, .72]]],
    [[[.35, .38], [.65, .38], [.65, .62], [.35, .62], [.35, .38]], [[.5, 0], [.5, .22]], [[.5, .78], [.5, 1]], [[0, .5], [.2, .5]], [[.8, .5], [1, .5]]],
    [[[.1, 1], [.1, .1], [.9, .1]], [[.4, .4], [.9, .9]], [[.9, .4], [.4, .9]]],
    [[[.5, 0], [.1, .4], [.5, .8], [.9, .4], [.5, 0]], [[.5, .8], [.5, 1]], [[.46, .4], [.54, .4]]]
  ];
  function relNum(a) { var s = ''; for (var i = 0; i < a.length; i++) s += (i && a[i] >= 0 ? ' ' : '') + a[i]; return s; }
  /* 字形贴到竖直墙面（x = xw）：逐点精确透视投影 */
  function wallGlyph(cam, strokes, xw, y0, z0, g) {
    var s = '';
    for (var k = 0; k < strokes.length; k++) {
      var st = strokes[k], px = 0, py = 0, rel = [];
      for (var m = 0; m < st.length; m++) {
        var w = pj(cam, [xw, y0 + st[m][1] * g, z0 + st[m][0] * g * 0.8]), X = R(w[0]), Y = R(w[1]);
        if (m === 0) s += 'M' + X + ' ' + Y; else rel.push(X - px, Y - py);
        px = X; py = Y;
      }
      s += 'l' + relNum(rel);
    }
    return s;
  }

  var CM = {
    cam: Cam(0, 0, 1100, 770, 340), XL: -9, XR: 21, YF: 1.7, YC: -11, ZE: 200,
    rows: [-0.1, -3.1, -6.1], molds: [-1.6, -4.6, -7.6],
    haze: '#4a3428'
  };
  function corZn(xw) { var c = CM.cam; return (xw < 0 ? -xw * c.f / c.cx : xw * c.f / (1600 - c.cx)) * 1.01; }

  /* 墓道主体（不含灯火与雾） */
  function corBase(pf) {
    var c = CM, cam = c.cam, rnd = U.rng(3131), o = '', i, z;
    var cz = -c.YC * cam.f / cam.cy;
    o += '<path d="' + P([pj(cam, [c.XL, c.YC, cz]), pj(cam, [c.XR, c.YC, cz]), pj(cam, [c.XR, c.YC, c.ZE]), pj(cam, [c.XL, c.YC, c.ZE])]) + '" fill="url(#' + pf + '-ceil)"/>';
    // 地面
    o += '<path d="' + P([pj(cam, [c.XL, c.YF, 2.5]), pj(cam, [c.XR, c.YF, 2.5]), pj(cam, [c.XR, c.YF, c.ZE]), pj(cam, [c.XL, c.YF, c.ZE])]) + '" fill="url(#' + pf + '-flr)"/>';
    var ceilFloor = o; o = '';
    function floorFlow(x0, dx, w, col, op, ph) {
      var up = [], dn = [];
      for (var k = 0; k <= 14; k++) {
        var zz = 3 * Math.pow(70 / 3, k / 14), xx = x0 + dx * (zz / 70) + Math.sin(zz * 0.18 + ph) * 1.6, ww = w * (0.5 + 0.5 * Math.sin(zz * 0.3 + ph * 3));
        up.push(pj(cam, [xx - ww, c.YF, zz])); dn.unshift(pj(cam, [xx + ww, c.YF, zz]));
      }
      return '<path d="' + P(up.concat(dn)) + '" fill="' + col + '" opacity="' + op + '"/>';
    }
    o += floorFlow(-3, 5, 0.9, '#7a3020', 0.22, 1) + floorFlow(10, -3, 1.3, '#2a6a58', 0.18, 2.3) + floorFlow(16, 2, 0.7, '#5a3a78', 0.22, 4);
    var sm = '';
    for (var x = -9; x <= 21; x += 4) { var a = pj(cam, [x, c.YF, 2.5]), b = pj(cam, [x, c.YF, c.ZE]); sm += 'M' + R(a[0]) + ' ' + R(a[1]) + 'L' + R(b[0]) + ' ' + R(b[1]); }
    for (z = 6; z < 200; z = z < 60 ? z + 5 : z + 14) { a = pj(cam, [c.XL, c.YF, z]); b = pj(cam, [c.XR, c.YF, z]); sm += 'M' + R(a[0]) + ' ' + R(a[1]) + 'H' + R(b[0]); }
    o += '<path d="' + sm + '" stroke="#000" stroke-opacity=".5" stroke-width="1.2"/>';

    function wall(xw, dir, seed) {
      var zn = corZn(xw), r = U.rng(seed), w = '';
      w += '<path d="' + P([pj(cam, [xw, c.YF, zn]), pj(cam, [xw, c.YC, zn]), pj(cam, [xw, c.YC, c.ZE]), pj(cam, [xw, c.YF, c.ZE])]) + '" fill="url(#' + pf + '-w' + (xw < 0 ? 'l' : 'r') + ')"/>';
      // 彩色大理石流纹：跨越石缝的大片色带
      var cols = ['#2f7a62', '#8a3420', '#5a3478', '#8a6a30', '#2a5a6a', '#6a1c2a', '#3a6a3a'];
      for (var f = 0; f < 8; f++) {
        var yc = c.YF - 1 - r() * 10.5, amp = 0.5 + r() * 1.5, fr = 0.1 + r() * 0.25, ph = r() * 6, wd = 0.2 + r() * 0.8, up = [], dn = [];
        for (var k = 0; k <= 12; k++) {
          var zz = zn * Math.pow(140 / zn, k / 12), yy = yc + amp * Math.sin(zz * fr + ph), ww = wd * (0.25 + 0.75 * Math.abs(Math.sin(zz * 0.23 + ph)));
          up.push(pj(cam, [xw, clamp(yy - ww, c.YC, c.YF), zz])); dn.unshift(pj(cam, [xw, clamp(yy + ww, c.YC, c.YF), zz]));
        }
        w += '<path d="' + P(up.concat(dn)) + '" fill="' + cols[f % cols.length] + '" opacity="' + n1(0.26 + r() * 0.2) + '"/>';
      }
      // 石中的“眼”：几圈同心的妖异纹
      if (dir > 0) {
        [[15.5, -4.9, 1.0], [24, 0.2, 0.8], [31, -8.4, 0.9]].forEach(function (e, ei) {
          for (var ring = 0; ring < 3; ring++) {
            var pts = [], rr = e[2] * (1 - ring * 0.28);
            for (var k = 0; k < 12; k++) { var an = k / 12 * 6.283; pts.push(pj(cam, [xw, e[1] + Math.sin(an) * rr * 0.55, e[0] + Math.cos(an) * rr])); }
            w += '<path d="' + P(pts) + '" fill="' + ['#c8a060', '#2a6a5a', '#1a0a08'][ring] + '" opacity="' + ['.25', '.45', '.7'][ring] + '"/>';
          }
        });
      }
      // 脉络
      var vv = '';
      for (i = 0; i < 11; i++) {
        var vz = zn + Math.pow(r(), 1.6) * 45, vy = c.YF - r() * 12.5, an = r() * 6.28, pts = [];
        for (var m = 0; m < 8; m++) { an += (r() - 0.5) * 1.8; vz += Math.cos(an) * 0.8; vy += Math.sin(an) * 0.8; pts.push(pj(cam, [xw, clamp(vy, c.YC, c.YF), Math.max(zn, vz)])); }
        vv += P0(pts);
      }
      w += '<path d="' + vv + '" fill="none" stroke="#f0e0c0" stroke-opacity=".16" stroke-width="1.2"/>';
      // 顶部一带压暗
      w += '<path d="' + P([pj(cam, [xw, -7.6, zn]), pj(cam, [xw, c.YC, zn]), pj(cam, [xw, c.YC, c.ZE]), pj(cam, [xw, -7.6, c.ZE])]) + '" fill="#000" opacity=".5"/>';
      // 石缝与腰线
      var sm = '';
      for (var zz2 = Math.ceil(zn / 5) * 5 + 2.5; zz2 < 200; zz2 += zz2 < 60 ? 5 : 15) { var A = pj(cam, [xw, c.YF, zz2]), B = pj(cam, [xw, c.YC, zz2]); sm += 'M' + R(A[0]) + ' ' + R(A[1]) + 'V' + R(B[1]); }
      w += '<path d="' + sm + '" stroke="#000" stroke-opacity=".45" stroke-width="1.3"/>';
      var md = '';
      c.molds.forEach(function (y) { var A = pj(cam, [xw, y, zn]), B = pj(cam, [xw, y, c.ZE]); md += 'M' + R(A[0]) + ' ' + R(A[1]) + 'L' + R(B[0]) + ' ' + R(B[1]); });
      w += '<path d="' + md + '" stroke="#000" stroke-opacity=".6" stroke-width="3"/><path d="' + md + '" transform="translate(0 2)" stroke="#e0b070" stroke-opacity=".18" stroke-width="1"/>';
      // 符号：近处逐个精确投影，越往深处越小越密；更远处用细密刻纹图案
      var gy = dir > 0 ? [1.0, -2.35, -3.85, -5.35, -6.85, -9.3] : [-2.35, -3.85, -6.85];
      var zmax = dir > 0 ? 40 : 54, grp = ['', '', '', ''], wid = [4, 2.7, 1.8, 1.2];
      gy.forEach(function (y0) {
        for (var zz = zn + 0.4 + r() * 0.8; zz < zmax;) {
          var t = (zz - zn) / (zmax - zn), gsz = 0.95 - t * 0.4;
          var k = zz < 19 ? 0 : zz < 27 ? 1 : zz < 38 ? 2 : 3;
          grp[k] += wallGlyph(cam, GLY[Math.floor(r() * GLY.length)], xw, y0 - gsz * 0.5, zz, gsz);
          zz += gsz * (1.6 - t * 0.75) + (r() < 0.12 ? gsz : 0);
        }
      });
      var gid = pf + '-g' + (xw < 0 ? 'l' : 'r'), gl = '', gu = '';
      grp.forEach(function (d, k) {
        if (!d) return;
        gl += '<path id="' + gid + k + '" d="' + d + '" stroke-width="' + wid[k] + '"/>';
        gu += '<use href="#' + gid + k + '"/>';
      });
      w += '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#f4d098" stroke-opacity=".2" transform="translate(1 1.5)">' + gu + '</g><g stroke="#080504" stroke-opacity=".8">' + gl + '</g></g>';
      var fp = [pj(cam, [xw, c.YF, zmax]), pj(cam, [xw, c.YC, zmax]), pj(cam, [xw, c.YC, c.ZE]), pj(cam, [xw, c.YF, c.ZE])];
      w += '<path d="' + P(fp) + '" fill="url(#' + pf + '-pm)" opacity=".75"/>';
      var fp2 = [pj(cam, [xw, c.YF, 95]), pj(cam, [xw, c.YC, 95]), pj(cam, [xw, c.YC, c.ZE]), pj(cam, [xw, c.YF, c.ZE])];
      w += '<path d="' + P(fp2) + '" fill="url(#' + pf + '-pf)" opacity=".85"/>';
      return w;
    }
    var floorDet = o; o = '';
    var wl = wall(c.XL, 1, 71), wr = wall(c.XR, -1, 72);

    // 尽头墙与半圆拱门
    var e0 = pj(cam, [c.XL, c.YC, c.ZE]), e1 = pj(cam, [c.XR, c.YF, c.ZE]), s = cam.f / c.ZE;
    o += '<rect x="' + R(e0[0]) + '" y="' + R(e0[1]) + '" width="' + R(e1[0] - e0[0]) + '" height="' + R(e1[1] - e0[1]) + '" fill="' + U.mix('#5a4636', c.haze, 0.4) + '"/><rect x="' + R(e0[0]) + '" y="' + R(e0[1]) + '" width="' + R(e1[0] - e0[0]) + '" height="' + R(e1[1] - e0[1]) + '" fill="url(#' + pf + '-pf)" opacity=".5"/>';
    var ac = pj(cam, [6, c.YF - 7, c.ZE]), ar = 5 * s, af = pj(cam, [6, c.YF, c.ZE]);
    var arch = function (rr) {
      return 'M' + n1(ac[0] - rr) + ' ' + n1(af[1]) + 'V' + n1(ac[1]) + 'A' + n1(rr) + ' ' + n1(rr) + ' 0 0 1 ' + n1(ac[0] + rr) + ' ' + n1(ac[1]) + 'V' + n1(af[1]) + 'Z';
    };
    o += '<path d="' + arch(ar * 1.5) + '" fill="#7a624a"/><path d="' + arch(ar * 1.32) + '" fill="none" stroke="#2a1c14" stroke-width="1.6" stroke-dasharray="1.5 2.5"/>';
    o += '<path d="' + arch(ar * 1.12) + '" fill="#2a1c14"/>';
    o += '<path id="' + pf + '-door" d="' + arch(ar) + '" fill="#000"/>';
    var eg = '';
    [-1, 1].forEach(function (sd) { [0.4, -3.1, -6.1].forEach(function (y) { var p = pj(cam, [6 + sd * 9.5, y, c.ZE]); eg += 'M' + R(p[0]) + ' ' + R(p[1]) + 'h0'; }); });
    o += '<path d="' + eg + '" stroke="#ffe0a0" stroke-width="3" stroke-linecap="round"/>';
    return { base: ceilFloor, floor: floorDet, wl: wl, wr: wr, end: o, arch: { c: ac, r: ar, f: af } };
  }

  /* 铜制圆柱墩：左侧石壁旁，立在方石座上 */
  function corPier(pf) {
    var cam = CM.cam, z = 16.5, x = -7.3, s = cam.f / z, Y = CM.YF, o = '';
    var h = 0.28, bw = 0.62;
    // 石座：正面 + 顶面 + 右侧面
    o += '<path d="' + P([pj(cam, [x - bw, Y, z - bw]), pj(cam, [x + bw, Y, z - bw]), pj(cam, [x + bw, Y - h, z - bw]), pj(cam, [x - bw, Y - h, z - bw])]) + '" fill="#2e2620"/>';
    o += '<path d="' + P([pj(cam, [x + bw, Y, z - bw]), pj(cam, [x + bw, Y, z + bw]), pj(cam, [x + bw, Y - h, z + bw]), pj(cam, [x + bw, Y - h, z - bw])]) + '" fill="#1a1512"/>';
    o += '<path d="' + P([pj(cam, [x - bw, Y - h, z - bw]), pj(cam, [x + bw, Y - h, z - bw]), pj(cam, [x + bw, Y - h, z + bw]), pj(cam, [x - bw, Y - h, z + bw])]) + '" fill="#5a4a3a"/>';
    var b = pj(cam, [x, Y - h, z]), t = pj(cam, [x, Y - 1.4, z]), X = b[0], rw = 0.4 * s, ryb = rw * 0.16, ryt = rw * 0.08;
    function arc(y, rx, ry) { return 'M' + n1(X - rx) + ' ' + n1(y) + 'A' + n1(rx) + ' ' + n1(ry) + ' 0 0 0 ' + n1(X + rx) + ' ' + n1(y); }
    // 柱身
    o += '<path d="M' + n1(X - rw) + ' ' + n1(t[1]) + 'V' + n1(b[1]) + 'A' + n1(rw) + ' ' + n1(ryb) + ' 0 0 0 ' + n1(X + rw) + ' ' + n1(b[1]) + 'V' + n1(t[1]) + 'Z" fill="url(#' + pf + '-brz)"/>';
    // 底部箍 + 顶部外撇的盘沿
    o += '<path d="M' + n1(X - rw * 1.08) + ' ' + n1(b[1]) + 'V' + n1(b[1] - 0.12 * s) + 'H' + n1(X + rw * 1.08) + 'V' + n1(b[1]) + 'A' + n1(rw * 1.08) + ' ' + n1(ryb) + ' 0 0 1 ' + n1(X - rw * 1.08) + ' ' + n1(b[1]) + 'Z" fill="url(#' + pf + '-brz)"/>';
    o += '<path d="M' + n1(X - rw) + ' ' + n1(t[1] + 0.16 * s) + 'L' + n1(X - rw * 1.3) + ' ' + n1(t[1]) + 'H' + n1(X + rw * 1.3) + 'L' + n1(X + rw) + ' ' + n1(t[1] + 0.16 * s) + 'Z" fill="url(#' + pf + '-brz)"/>';
    // 纹带：一圈回纹 + 兽面凸点
    var yb = t[1] + 0.34 * s, yb2 = t[1] + 0.5 * s;
    o += '<path d="' + arc(yb, rw, ryt * 1.5) + arc(yb2, rw, ryt * 1.8) + arc(b[1] - 0.12 * s, rw * 1.08, ryb) + '" fill="none" stroke="#120a05" stroke-opacity=".85" stroke-width="' + n1(0.025 * s) + '"/>';
    var dots = '';
    for (var k = -3; k <= 3; k++) {
      var an = k / 3.4, dx = Math.sin(an) * rw * 0.95, sc = Math.cos(an);
      dots += 'M' + n1(X + dx - 0.05 * s * sc) + ' ' + n1((yb + yb2) / 2 + 1) + 'h' + n1(0.1 * s * sc) + 'M' + n1(X + dx) + ' ' + n1(yb + 2) + 'v' + n1(yb2 - yb - 4);
    }
    o += '<path d="' + dots + '" stroke="#1a0e06" stroke-width="' + n1(0.02 * s) + '" opacity=".7"/>';
    var rr = U.rng(4), pat = '';
    for (k = 0; k < 9; k++) pat += '<ellipse cx="' + n1(X - rw * 0.8 + rr() * rw * 1.6) + '" cy="' + n1(t[1] + (0.2 + rr() * 0.8) * (b[1] - t[1])) + '" rx="' + n1(2 + rr() * 6) + '" ry="' + n1(1 + rr() * 3) + '"/>';
    o += '<g fill="#5aa88a" opacity=".38">' + pat + '</g>';
    // 顶面：盘口与中央的引火孔
    o += '<ellipse cx="' + n1(X) + '" cy="' + n1(t[1]) + '" rx="' + n1(rw * 1.3) + '" ry="' + n1(ryt * 1.6) + '" fill="#a07a44"/>';
    o += '<ellipse cx="' + n1(X) + '" cy="' + n1(t[1]) + '" rx="' + n1(rw * 1.05) + '" ry="' + n1(ryt * 1.1) + '" fill="#2a1a0c"/>';
    o += '<ellipse cx="' + n1(X) + '" cy="' + n1(t[1]) + '" rx="' + n1(rw * 0.3) + '" ry="' + n1(ryt * 0.5) + '" fill="#000"/>';
    o += '<path d="M' + n1(X - rw * 1.3) + ' ' + n1(t[1]) + 'H' + n1(X + rw * 1.3) + '" stroke="#ffd890" stroke-opacity=".55" stroke-width="1.2"/>';
    // 通往墙脚的油槽
    var g0 = pj(cam, [x - bw, Y, z]), g1 = pj(cam, [CM.XL, Y, z + 0.3]);
    o += '<path d="M' + n1(g0[0]) + ' ' + n1(g0[1]) + 'L' + n1(g1[0]) + ' ' + n1(g1[1]) + '" stroke="#050302" stroke-width="' + n1(0.06 * s) + '"/>';
    return '<g id="' + pf + '-PIER">' + o + '</g><use href="#' + pf + '-PIER" transform="matrix(1 0 0 -1 0 ' + n1(2 * pj(cam, [x, Y, z])[1]) + ')" opacity=".25"/>';
  }

  function corSkeleton(arch) {
    var s = CM.cam.f / 188, x = arch.c[0] - 1.6 * s, y = arch.f[1] + 0.5 * s;
    var d = 'M' + n1(x) + ' ' + n1(y) + 'l' + n1(3.2 * s) + ' ' + n1(0.3 * s);
    for (var k = 0; k < 5; k++) d += 'M' + n1(x + (0.5 + k * 0.28) * s) + ' ' + n1(y - 0.25 * s) + 'l' + n1(0.1 * s) + ' ' + n1(0.5 * s);
    d += 'M' + n1(x + 3.2 * s) + ' ' + n1(y + 0.3 * s) + 'l' + n1(1.4 * s) + ' ' + n1(-0.35 * s) + 'M' + n1(x + 3.2 * s) + ' ' + n1(y + 0.3 * s) + 'l' + n1(1.3 * s) + ' ' + n1(0.45 * s);
    d += 'M' + n1(x + 0.6 * s) + ' ' + n1(y) + 'l' + n1(-0.4 * s) + ' ' + n1(-0.9 * s);
    return '<g fill="none" stroke="#f2ead8" stroke-width="1.1" stroke-linecap="round"><path d="' + d + '"/><circle cx="' + n1(x - 0.35 * s) + '" cy="' + n1(y - 0.1 * s) + '" r="' + n1(0.4 * s) + '" fill="#f2ead8"/></g>';
  }

  function corDefs(pf) {
    var h = CM.haze;
    return '<linearGradient id="' + pf + '-bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>' +
      '<linearGradient id="' + pf + '-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040505"/><stop offset=".8" stop-color="#0a0908"/><stop offset="1" stop-color="' + U.mix(h, '#000', 0.5) + '"/></linearGradient>' +
      '<linearGradient id="' + pf + '-flr" x1="0" y1="900" x2="0" y2="372" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0c0908"/><stop offset=".55" stop-color="#1e1512"/><stop offset=".9" stop-color="#3a2a20"/><stop offset="1" stop-color="' + h + '"/></linearGradient>' +
      '<linearGradient id="' + pf + '-wl" x1="0" y1="0" x2="720" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#15120f"/><stop offset=".65" stop-color="#241b16"/><stop offset="1" stop-color="' + h + '"/></linearGradient>' +
      '<linearGradient id="' + pf + '-wr" x1="1600" y1="0" x2="890" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#15120f"/><stop offset=".55" stop-color="#241b16"/><stop offset="1" stop-color="' + h + '"/></linearGradient>' +
      '<linearGradient id="' + pf + '-brz" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3018"/><stop offset=".12" stop-color="#d89a50"/><stop offset=".3" stop-color="#8a5a2a"/><stop offset=".65" stop-color="#3a2410"/><stop offset="1" stop-color="#120a05"/></linearGradient>' +
      '<pattern id="' + pf + '-pm" width="9" height="14" patternUnits="userSpaceOnUse"><path d="M1 2v5h3M6 2l2 3-2 3M2 10h3v3M7 10v3" fill="none" stroke="#0a0705" stroke-width=".9"/></pattern>' +
      '<pattern id="' + pf + '-pf" width="4" height="6" patternUnits="userSpaceOnUse"><path d="M.5 .5v3h2M2.5 4.5h1" fill="none" stroke="#0a0705" stroke-width=".8"/></pattern>';
  }

  /* 灯：近处完整灯盏 + 光晕，远处成串光点 */
  function corLamps(pf, lit, xw) {
    var c = CM, cam = c.cam, o = '', far = '', rows = '';
    [[xw, xw < 0 ? 1 : -1]].forEach(function (wv) {
      var side = wv[1], zn = corZn(xw);
      c.rows.forEach(function (y) {
        for (var z = 197.5; z > zn + 0.3; z -= 5) {
          var s = cam.f / z, p = pj(cam, [xw + side * 0.25, y, z]);
          if (z < 62) o += '<use href="#' + pf + (lit ? '-lp' : '-lu') + '" transform="translate(' + n1(p[0]) + ' ' + n1(p[1]) + ') scale(' + n1(s) + ')"/>';
          else if (lit) far += 'M' + R(p[0]) + ' ' + R(p[1]) + 'h0';
        }
        if (lit) rows += P([pj(cam, [xw, y - 0.9, zn]), pj(cam, [xw, y + 0.9, zn]), pj(cam, [xw, y + 0.9, c.ZE]), pj(cam, [xw, y - 0.9, c.ZE])]);
      });
    });
    if (!lit) return o;
    return '<path d="' + rows + '" fill="#f0a040" opacity=".09" style="mix-blend-mode:screen"/>' +
      '<path d="' + far + '" stroke="#ffd490" stroke-width="2.6" stroke-linecap="round"/>' + o;
  }
  function lampSym(pf) {
    return '<g id="' + pf + '-lu"><path d="M-.3-.02Q0 .2.3-.02Z" fill="#241609"/><path d="M-.32-.03h.64" stroke="#8a6a3a" stroke-width=".04"/><path d="M-.04.1-.1.4h.2L.04.1Z" fill="#1e140c"/></g>' +
      '<g id="' + pf + '-lp"><circle r="2" fill="url(#' + pf + '-glow)" style="mix-blend-mode:screen"/><use href="#' + pf + '-lu"/>' +
      '<g transform="translate(0 -.03) scale(.2 .42)"><use href="#' + pf + '-fl"/></g></g>';
  }

  /* 抛光地面倒影：竖直墙面关于地面的镜像恰好是一个仿射变换 */
  function corMirror(xw) {
    var c = CM.cam, Y2 = 2 * CM.YF;
    if (xw === 'end') return 'matrix(1 0 0 -1 0 ' + n1(2 * c.cy + Y2 * c.f / CM.ZE) + ')';
    return 'matrix(1 ' + (Y2 / xw).toFixed(4) + ' 0 -1 0 ' + n1(2 * c.cy - Y2 * c.cx / xw) + ')';
  }

  BG.corridor = function () {
    var pf = 'bg-cor', B = corBase(pf), a = B.arch, o = '';
    var defs = '<defs>' + lampDefs(pf) + corDefs(pf) + lampSym(pf) +
      '<radialGradient id="' + pf + '-haze" cx="' + R(a.c[0]) + '" cy="' + R(a.c[1]) + '" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d8a068" stop-opacity=".6"/><stop offset=".22" stop-color="#b07850" stop-opacity=".3"/><stop offset="1" stop-color="#a07050" stop-opacity="0"/></radialGradient>' +
      '<g id="' + pf + '-WL">' + B.wl + corLamps(pf, true, CM.XL) + '</g><g id="' + pf + '-WR">' + B.wr + corLamps(pf, true, CM.XR) + '</g><g id="' + pf + '-END">' + B.end + '</g>' +
      '</defs>';
    o += B.base;
    o += '<g opacity=".3"><use href="#' + pf + '-WL" transform="' + corMirror(CM.XL) + '"/><use href="#' + pf + '-WR" transform="' + corMirror(CM.XR) + '"/><use href="#' + pf + '-END" transform="' + corMirror('end') + '"/></g>';
    o += B.floor;
    o += '<use href="#' + pf + '-WL"/><use href="#' + pf + '-WR"/><use href="#' + pf + '-END"/>';
    o += '<rect width="1600" height="900" fill="url(#' + pf + '-haze)" style="mix-blend-mode:screen"/>';
    o += '<use href="#' + pf + '-door"/>';
    o += corSkeleton(a) + corPier(pf);
    return U.svg(defs + '<rect width="1600" height="900" fill="#060504"/>' + o +
      '<rect y="560" width="1600" height="340" fill="url(#' + pf + '-bot)"/>' + U.vignette(pf, 0.72));
  };

  BG.corridor_dark = function () {
    var pf = 'bg-cdk', B = corBase(pf), o = '';
    var defs = '<defs>' + corDefs(pf) + lampSym(pf) +
      '<g id="' + pf + '-ALL">' + B.base + B.floor + B.wl + corLamps(pf, false, CM.XL) + B.wr + corLamps(pf, false, CM.XR) + B.end + corPier(pf) + '</g>' +
      '<radialGradient id="' + pf + '-p"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<mask id="' + pf + '-m" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><rect width="1600" height="900" fill="#000"/>' +
      '<ellipse cx="265" cy="395" rx="240" ry="165" fill="url(#' + pf + '-p)"/>' +
      '<ellipse cx="985" cy="438" rx="330" ry="62" fill="url(#' + pf + '-p)" transform="rotate(-3 985 438)"/>' +
      '<ellipse cx="1180" cy="330" rx="120" ry="110" fill="url(#' + pf + '-p)" opacity=".35"/></mask>' +
      '<linearGradient id="' + pf + '-bA" x1="520" y1="960" x2="250" y2="390" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4f0e4" stop-opacity=".34"/><stop offset=".7" stop-color="#f4f0e4" stop-opacity=".1"/><stop offset="1" stop-color="#f4f0e4" stop-opacity=".02"/></linearGradient>' +
      '<linearGradient id="' + pf + '-bB" x1="1120" y1="960" x2="980" y2="440" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4f0e4" stop-opacity=".3"/><stop offset=".75" stop-color="#f4f0e4" stop-opacity=".08"/><stop offset="1" stop-color="#f4f0e4" stop-opacity=".02"/></linearGradient>' +
      '<style>.' + pf + '-ds{animation:' + pf + '-ds 11s linear infinite}@keyframes ' + pf + '-ds{0%{transform:translate(0,0);opacity:0}25%{opacity:.9}100%{transform:translate(-18px,-40px);opacity:0}}' +
      '.' + pf + '-sw{animation:' + pf + '-sw 7s ease-in-out infinite alternate}@keyframes ' + pf + '-sw{0%{opacity:.85}50%{opacity:1}100%{opacity:.9}}</style>' +
      '</defs>';
    o += '<use href="#' + pf + '-ALL" opacity=".06"/>';
    o += '<g class="' + pf + '-sw"><use href="#' + pf + '-ALL" mask="url(#' + pf + '-m)"/>' +
      '<rect width="1600" height="900" fill="#c8d8f0" opacity=".12" mask="url(#' + pf + '-m)" style="mix-blend-mode:screen"/></g>';
    // 两道手电光柱
    o += '<g style="mix-blend-mode:screen"><path d="M470 960L590 960L440 420L110 330Z" fill="url(#' + pf + '-bA)"/><path d="M505 960L560 960L380 395L200 360Z" fill="url(#' + pf + '-bA)"/>' +
      '<path d="M1060 960L1190 960L1310 450L680 425Z" fill="url(#' + pf + '-bB)"/><path d="M1100 960L1150 960L1150 445L860 435Z" fill="url(#' + pf + '-bB)"/></g>';
    var rnd = U.rng(88), d = '';
    for (var i = 0; i < 26; i++) {
      var tb = rnd(), A = i % 2 === 0;
      var x = A ? 540 - tb * 300 + (rnd() - 0.5) * 100 * (1 - tb) : 1120 - tb * 140 + (rnd() - 0.5) * 300 * tb;
      var y = 950 - tb * (A ? 560 : 510);
      d += '<circle cx="' + R(x) + '" cy="' + R(y) + '" r="' + n1(0.8 + rnd() * 1.6) + '" class="' + pf + '-ds" style="animation-delay:-' + n1(rnd() * 11) + 's"/>';
    }
    o += '<g fill="#f0f0e8">' + d + '</g>';
    return U.svg(defs + '<rect width="1600" height="900" fill="#020303"/>' + o + U.vignette(pf, 0.9));
  };
})();
