/*
 * 背景：“心”字四墓室 + 回忆场景（1928 / 1936 / 1937）
 * heart_fear, heart_despair, heart_anger, heart_madness,
 * zhabei_1936, zhabei_1937_room, sanceng_roof_1937, qianlong_tomb
 */
(function () {
  'use strict';
  var U = GF.art.util;

  /* ================================================================ 公共小工具 */
  function R(v) { return Math.round(v); }
  function R1(v) { return Math.round(v * 10) / 10; }
  function pts(a) { return a.map(function (p) { return R(p[0]) + ',' + R(p[1]); }).join(' '); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 透视相机：X 右，Y 上（离地高度），Z 前；E 眼高，yaw 水平偏转(弧度) */
  function camera(f, cx, cy, E, yaw, camX, camZ) {
    var c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    camX = camX || 0; camZ = camZ || 0;
    var P = function (X, Y, Z) {
      var x = X - camX, z = Z - camZ;
      var X2 = x * c - z * s, Z2 = x * s + z * c;
      return [cx + X2 * f / Z2, cy + (E - Y) * f / Z2, Z2];
    };
    P.depth = function (X, Z) { var x = X - camX, z = Z - camZ; return x * s + z * c; };
    P.f = f;
    return P;
  }

  /* 平面多边形按“相机深度 >= zn”裁剪（Sutherland–Hodgman） */
  function clipPlan(poly, P, zn) {
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var da = P.depth(a[0], a[1]), db = P.depth(b[0], b[1]);
      if (da >= zn) out.push(a);
      if ((da >= zn) !== (db >= zn)) {
        var t = (zn - da) / (db - da);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function projPlan(poly, P, Y) { return poly.map(function (p) { return P(p[0], Y, p[1]); }); }

  /* 沿墙线（折线）按弧长取点 */
  function sampler(line) {
    var L = [0];
    for (var i = 1; i < line.length; i++) {
      L.push(L[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    }
    var fn = function (s) {
      s = clamp(s, 0, L[L.length - 1]);
      var i = 1; while (i < L.length - 1 && L[i] < s) i++;
      var t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
      var a = line[i - 1], b = line[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    fn.len = L[L.length - 1];
    return fn;
  }

  /* 墙面分段四边形（远→近），color(i, depth, facing) 返回颜色 */
  function wallQuads(line, H, P, zn, color, extra) {
    var segs = [];
    for (var i = 0; i < line.length - 1; i++) {
      var a = line[i], b = line[i + 1];
      var da = P.depth(a[0], a[1]), db = P.depth(b[0], b[1]);
      if (da < zn && db < zn) continue;
      if (da < zn) { var t = (zn - da) / (db - da); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
      else if (db < zn) { var t2 = (zn - da) / (db - da); b = [a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2]; }
      var A0 = P(a[0], 0, a[1]), B0 = P(b[0], 0, b[1]), B1 = P(b[0], H, b[1]), A1 = P(a[0], H, a[1]);
      // 背面剔除：屏幕上底边从左到右为正面（内墙按逆时针给出）
      var dx = B0[0] - A0[0];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      var facing = Math.abs(dx) / (Math.abs(dx) + 400 * len / Math.max(P.depth(mx, mz), .5));
      segs.push({ d: P.depth(mx, mz), q: [A0, B0, B1, A1], i: i, facing: facing, back: dx < -0.5 });
    }
    segs.sort(function (p, q) { return q.d - p.d; });
    var s = '';
    segs.forEach(function (g) {
      if (g.back) return;
      var c = color(g.i, g.d, g.facing);
      s += '<polygon points="' + pts(g.q) + '" fill="' + c + '" stroke="' + c + '"/>';
    });
    return '<g stroke-width="1"' + (extra || '') + '>' + s + '</g>';
  }

  /* 平面遮挡：相机→点 的视线是否被遮挡折线挡住 */
  function segX(a, b, c, d) {
    var r1 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    var r2 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
    var r3 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0]);
    var r4 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0]);
    return r1 * r2 < 0 && r3 * r4 < 0;
  }
  function hidden(cam, p, occ) {
    if (!occ) return false;
    // 把目标点往相机方向挪一点，避免与自身所在墙段相交
    var q = [p[0] + (cam[0] - p[0]) * .02, p[1] + (cam[1] - p[1]) * .02];
    for (var i = 0; i < occ.length - 1; i++) if (segX(cam, q, occ[i], occ[i + 1])) return true;
    return false;
  }

  /* ---------- 墓壁符号（蝌蚪状曲线）：模板 + 抖动 + 旋转 ---------- */
  var GLYPHS = [
    'M0 -7D M0 -5C6 -2 -6 2 0 8',
    'M0 0Q4 -1 3 3Q0 6 -4 2Q-6 -4 1 -6Q7 -6 7 1',
    'M-7 -2Q-3 -6 0 -2Q3 2 7 -2M-7 3Q-3 -1 0 3Q3 7 7 3',
    'M0 -8L0 8M-5 -4Q0 1 5 -4M-3 6D',
    'M-7 0Q0 -6 7 0Q0 6 -7 0M0 0D',
    'M-6 -6L0 -2L-4 2Q2 8 7 4',
    'M-6 6C-6 -8 6 -8 2 0C-1 6 5 8 7 5',
    'M-6 -5D M-3 -5Q3 -5 2 0Q1 5 6 6M-5 2Q-2 0 -1 4',
    'M-5 -7Q5 -3 -2 1Q-7 5 4 7M5 -6D',
    'M-7 4Q-4 -6 0 0Q4 6 7 -4M0 -7D'
  ];
  var GLYPH_TOK = GLYPHS.map(function (g) { return g.match(/[A-Za-z]|-?[\d.]+/g); });
  function glyph(r, x, y, sz, wob, rot, stretch) {
    var tpl = GLYPH_TOK[Math.floor(r() * GLYPH_TOK.length)];
    var a = (rot || 0) + (r() - .5) * (wob || .8), c = Math.cos(a), s = Math.sin(a), fl = r() < .5 ? -1 : 1;
    var k = sz / 16, out = '', cmd = '', buf = [], cx = 0, cy = 0;
    var j = sz < 8 ? 0 : 1.6;
    function flush() {
      if (!cmd) return;
      if (cmd === 'D') { out += 'h.1'; }
      else {
        var ps = [];
        for (var i = 0; i + 1 < buf.length; i += 2) {
          var u = (buf[i] * fl + (r() - .5) * j) * k * (stretch || 1), v = (buf[i + 1] + (r() - .5) * j) * k;
          ps.push([R(x + u * c - v * s), R(y + u * s + v * c)]);
        }
        if (cmd === 'M') { out += 'M' + ps[0][0] + ' ' + ps[0][1]; cx = ps[0][0]; cy = ps[0][1]; }
        else {
          // 相对坐标输出（更短）
          out += cmd.toLowerCase();
          var per = cmd === 'C' ? 3 : cmd === 'Q' ? 2 : 1;
          for (var m = 0; m < ps.length; m++) {
            var dx = ps[m][0] - cx, dy = ps[m][1] - cy;
            out += (m ? (dx < 0 ? '' : ' ') : '') + dx + (dy < 0 ? '' : ' ') + dy;
            if ((m + 1) % per === 0) { cx = ps[m][0]; cy = ps[m][1]; }
          }
        }
      }
      buf = [];
    }
    for (var i = 0; i < tpl.length; i++) {
      var t = tpl[i];
      if (/[A-Za-z]/.test(t)) { flush(); cmd = t; } else buf.push(+t);
    }
    flush();
    return out.replace(/ (?=[A-Za-z])/g, '');
  }

  /* 在墙面上撒符号：返回三档粗细的 path d */
  function wallGlyphs(line, H, P, r, n, opt) {
    var S = sampler(line), d = ['', '', ''], tries = 0, got = 0;
    opt = opt || {};
    var vmin = opt.vmin == null ? .3 : opt.vmin, vmax = opt.vmax == null ? H - .3 : opt.vmax;
    var sizeM = opt.size || .42, bias = opt.bias || 0;
    while (got < n && tries < n * 12) {
      tries++;
      var s = r() * S.len, p = S(s), v = vmin + r() * (vmax - vmin);
      var z = P.depth(p[0], p[1]);
      if (z < 1.2) continue;
      if (bias && r() > Math.pow(clamp(s / S.len, 0, 1), bias)) continue;
      var q = P(p[0], v, p[1]);
      if (q[0] < -20 || q[0] > 1620 || q[1] < -20 || q[1] > 920) continue;
      if (opt.skip && opt.skip(q, p, v)) continue;
      if (hidden(opt.cam, p, opt.occ)) continue;
      var sz = sizeM * P.f / z * (.7 + r() * .6);
      if (sz < 3) continue;
      if (opt.maxSz && sz > opt.maxSz) sz = opt.maxSz * (.8 + r() * .4);
      var band = sz > 26 ? 0 : sz > 12 ? 1 : 2;
      d[band] += glyph(r, q[0], q[1], sz, opt.wob);
      got++;
    }
    return d;
  }

  /* 大理石纹：在墙面参数空间里画弯曲纹路 */
  function wallVeins(line, H, P, r, n) {
    var S = sampler(line), d = '';
    for (var i = 0; i < n; i++) {
      var s = r() * S.len, v = r() * H, ds = (r() - .5) * 3, dv = (r() - .5) * 2.4;
      var seg = '';
      for (var k = 0; k <= 6; k++) {
        var ss = s + ds * k / 6 + Math.sin(k * 1.7 + i) * .15, vv = v + dv * k / 6 + Math.cos(k * 2.3 + i) * .18;
        var p = S(ss), z = P.depth(p[0], p[1]);
        if (z < .8 || vv < 0 || vv > H) { seg = ''; break; }
        var q = P(p[0], vv, p[1]);
        seg += (k ? 'L' : 'M') + R(q[0]) + ' ' + R(q[1]);
      }
      d += seg;
    }
    return d;
  }
  /* 地面大理石纹 */
  function floorVeins(P, r, n, x0, x1, z0, z1) {
    var d = '';
    for (var i = 0; i < n; i++) {
      var X = x0 + r() * (x1 - x0), Z = z0 + r() * (z1 - z0), a = r() * 6.28, L = 1 + r() * 3;
      var seg = '';
      for (var k = 0; k <= 6; k++) {
        var t = k / 6, xx = X + Math.cos(a) * L * t + Math.sin(t * 9 + i) * .25, zz = Z + Math.sin(a) * L * t + Math.cos(t * 8 + i) * .2;
        if (P.depth(xx, zz) < .8) { seg = ''; break; }
        var q = P(xx, 0, zz);
        seg += (k ? 'L' : 'M') + R(q[0]) + ' ' + R(q[1]);
      }
      d += seg;
    }
    return d;
  }

  /* 地面上的斑点（血迹等）：返回椭圆 path 片段（同色同透明度的斑点合并成一条 path） */
  function floorBlot(P, X, Z, rM, sq) {
    var q = P(X, 0, Z), rx = rM * P.f / q[2];
    if (q[1] > 905 || q[0] < -50 || q[0] > 1650) return '';
    var ry = Math.max((P(X, 0, Z - rM)[1] - P(X, 0, Z + rM)[1]) / 2, rx * .1) * (sq || 1);
    var F = rx > 4 ? R : R1;
    rx = F(rx); ry = F(ry);
    return 'M' + F(q[0] - rx) + ' ' + R(q[1]) + 'a' + rx + ' ' + ry + ' 0 1 0 ' + F(2 * rx) + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + F(-2 * rx) + ' 0';
  }

  /* 墙灯：托架 + 火苗 + 光晕；返回 {glow, body} */
  function wallLamp(pfx, x, y, k, cls) {
    var g = '<circle cx="' + R(x) + '" cy="' + R(y) + '" r="' + R(90 * k) + '" fill="url(#' + pfx + '-lg)"/>';
    var b = '<path d="M' + R1(x - 7 * k) + ' ' + R1(y + 3 * k) + 'h' + R1(14 * k) + 'l' + R1(-4 * k) + ' ' + R1(5 * k) + 'h' + R1(-6 * k) + 'z" fill="' + pfx + 'LB"/>' +
      '<path class="' + cls + '" d="M' + R1(x) + ' ' + R1(y - 13 * k) + 'q' + R1(6 * k) + ' ' + R1(9 * k) + ' 0 ' + R1(16 * k) + 'q' + R1(-6 * k) + ' ' + R1(-7 * k) + ' 0 ' + R1(-16 * k) + 'z" fill="url(#' + pfx + '-fl)"/>';
    return { glow: g, body: b };
  }

  /* 老照片：划痕、霉斑、灰尘、暗角 */
  function oldPhoto(pfx, seed, tint) {
    var r = U.rng(seed), s = '', d = '', dd = '';
    for (var i = 0; i < 9; i++) {
      var x = r() * 1600, y0 = r() * 300, len = 200 + r() * 600, bend = (r() - .5) * 30;
      d += 'M' + R(x) + ' ' + R(y0) + 'q' + R(bend) + ' ' + R(len / 2) + ' ' + R((r() - .5) * 12) + ' ' + R(len);
    }
    for (var j = 0; j < 70; j++) {
      var cx = r() * 1600, cy = r() * 900;
      dd += 'M' + R(cx) + ' ' + R(cy) + 'l' + R1((r() - .5) * 6) + ' ' + R1((r() - .5) * 6);
    }
    s += '<path d="' + d + '" stroke="#f3e6c8" stroke-width=".9" fill="none" opacity=".28"/>';
    s += '<path d="' + dd + '" stroke="#1a1008" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".45"/>';
    // 霉斑：边角的一簇簇褐绿圆斑
    s += '<g filter="url(#' + pfx + '-mb)" opacity=".5">';
    var corners = [[60, 70], [1540, 110], [1490, 820], [110, 840], [r() * 1600, 40]];
    corners.forEach(function (c, ci) {
      for (var m = 0; m < 7; m++) {
        s += '<circle cx="' + R(c[0] + (r() - .5) * 150) + '" cy="' + R(c[1] + (r() - .5) * 110) + '" r="' + R(8 + r() * 30) + '" fill="' + (m % 3 ? '#4a3a1a' : '#6a5a2a') + '" opacity="' + R1(.3 + r() * .5) + '"/>';
      }
    });
    s += '</g>';
    s += '<defs><filter id="' + pfx + '-mb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<radialGradient id="' + pfx + '-ov" cx="50%" cy="48%" r="72%"><stop offset="50%" stop-color="#2a1a0a" stop-opacity="0"/><stop offset="85%" stop-color="#2a1a0a" stop-opacity=".55"/><stop offset="100%" stop-color="#140a04" stop-opacity=".9"/></radialGradient></defs>';
    s += '<rect width="1600" height="900" fill="' + (tint || '#a0703a') + '" opacity=".16" style="mix-blend-mode:multiply"/>';
    s += '<rect width="1600" height="900" fill="url(#' + pfx + '-ov)"/>';
    return s;
  }

  /* 小光晕/火焰的通用渐变 */
  function glowDefs(pfx, core, halo, flameA, flameB) {
    return '<radialGradient id="' + pfx + '-lg"><stop offset="0" stop-color="' + core + '" stop-opacity=".55"/><stop offset=".25" stop-color="' + halo + '" stop-opacity=".22"/><stop offset="1" stop-color="' + halo + '" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + pfx + '-fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + flameA + '"/><stop offset=".6" stop-color="' + flameB + '"/><stop offset="1" stop-color="' + flameB + '" stop-opacity="0"/></linearGradient>';
  }
  function flickerCSS(pfx) {
    return '<style>.' + pfx + '-fk{transform-box:fill-box;transform-origin:50% 100%;animation:' + pfx + '-fk 1.3s ease-in-out infinite alternate}' +
      '.' + pfx + '-fk2{transform-box:fill-box;transform-origin:50% 100%;animation:' + pfx + '-fk 1.7s ease-in-out -.6s infinite alternate}' +
      '.' + pfx + '-br{animation:' + pfx + '-br 2.4s ease-in-out infinite alternate}' +
      '@keyframes ' + pfx + '-fk{0%{transform:scale(1,1)}40%{transform:scale(.9,1.12)}100%{transform:scale(1.06,.9)}}' +
      '@keyframes ' + pfx + '-br{from{opacity:.8}to{opacity:1}}</style>';
  }

  /* ---------- “心”字墓室通用绘制 ---------- */
  function tombRoom(o) {
    var pfx = o.pfx, P = o.P, r = U.rng(o.seed), C = o.col, s = '';
    var line = o.wall, H = o.H;
    var defs = '<defs>' + glowDefs(pfx, C.lampCore, C.lampHalo, C.flameA, C.flameB) +
      '<linearGradient id="' + pfx + '-fg" gradientUnits="userSpaceOnUse" x1="0" y1="' + (o.hy || 390) + '" x2="0" y2="900"><stop offset="0" stop-color="' + C.floorFar + '"/><stop offset="1" stop-color="' + C.floorNear + '"/></linearGradient>' +
      '<linearGradient id="' + pfx + '-cg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="' + (o.hy || 390) + '"><stop offset="0" stop-color="' + C.void + '"/><stop offset="1" stop-color="' + C.ceil + '"/></linearGradient>' +
      '<linearGradient id="' + pfx + '-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.void + '" stop-opacity=".95"/><stop offset=".45" stop-color="' + C.void + '" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + pfx + '-rf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.flameB + '" stop-opacity=".45"/><stop offset="1" stop-color="' + C.flameB + '" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + pfx + '-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.mist + '" stop-opacity="0"/><stop offset=".5" stop-color="' + C.mist + '" stop-opacity="' + (C.mistOp || .22) + '"/><stop offset="1" stop-color="' + C.mist + '" stop-opacity="0"/></linearGradient>' +
      (o.defs || '') + '</defs>';
    s += defs + flickerCSS(pfx) + (o.css || '');
    s += '<rect width="1600" height="900" fill="' + C.void + '"/>';
    // 天花
    var cp = projPlan(clipPlan(o.plan, P, .35), P, H);
    s += '<polygon points="' + pts(cp) + '" fill="url(#' + pfx + '-cg)"/>';
    if (o.ceiling) s += o.ceiling;
    // 地面
    var fp = projPlan(clipPlan(o.plan, P, .35), P, 0);
    s += '<polygon points="' + pts(fp) + '" fill="url(#' + pfx + '-fg)"/>';
    s += '<clipPath id="' + pfx + '-fc"><polygon points="' + pts(fp) + '"/></clipPath>';
    s += '<g clip-path="url(#' + pfx + '-fc)">';
    if (o.floorUnder) s += o.floorUnder;
    if (o.grid) {
      var gd = '';
      for (var gx = o.fx0; gx <= o.fx1; gx += o.grid) { var g0 = P(gx, 0, Math.max(o.fz0, .5)), g1 = P(gx, 0, o.fz1); gd += 'M' + R(g0[0]) + ' ' + R(g0[1]) + 'L' + R(g1[0]) + ' ' + R(g1[1]); }
      for (var gz = o.fz0; gz <= o.fz1; gz += o.grid) { var h0 = P(o.fx0, 0, gz), h1 = P(o.fx1, 0, gz); gd += 'M' + R(h0[0]) + ' ' + R(h0[1]) + 'L' + R(h1[0]) + ' ' + R(h1[1]); }
      s += '<path d="' + gd + '" stroke="' + (C.seam || '#000') + '" stroke-width="1.5" fill="none" opacity="' + (C.seamOp || .35) + '"/>';
    }
    s += '<path d="' + floorVeins(P, r, o.floorVeinN || 60, o.fx0, o.fx1, o.fz0, o.fz1) + '" stroke="' + C.vein + '" stroke-width="1.1" fill="none" opacity="' + (C.veinOp || .3) + '"/>';
    s += '</g>';
    // 墙
    s += wallQuads(line, H, P, .35, function (i, d, fa) {
      var l = clamp(1.25 - d / (o.fogD || 30), 0, 1) * (.55 + .45 * fa);
      return U.mix(C.wallDark, C.wall, l);
    });
    // 远墙细密刻文：屏幕空间 pattern 铺在远处墙带上
    if (o.inscribe) {
      var ib = [], it = [], ir = U.rng(o.seed + 5), tile = '';
      line.forEach(function (p) {
        if (P.depth(p[0], p[1]) < o.inscribe.dmin) return;
        var a = P(p[0], .4, p[1]), b = P(p[0], H - .5, p[1]);
        if (a[0] < -200 || a[0] > 1800) return;
        ib.push(a); it.unshift(b);
      });
      for (var ti = 0; ti < 4; ti++) tile += glyph(ir, 5 + (ti % 2) * 17 + ir() * 4, 5 + (ti >> 1) * 11 + ir() * 3, 7);
      s += '<defs><pattern id="' + pfx + '-ip" width="36" height="24" patternUnits="userSpaceOnUse"><path d="' + tile + '" fill="none" stroke="' + C.glyph + '" stroke-width=".9" stroke-linecap="round"/></pattern></defs>';
      if (ib.length > 2) s += '<polygon points="' + pts(ib.concat(it)) + '" fill="url(#' + pfx + '-ip)" opacity="' + (o.inscribe.op || .5) + '"/>';
    }
    // 墙纹 + 符号
    s += '<path d="' + wallVeins(line, H, P, r, o.wallVeinN || 70) + '" stroke="' + C.vein + '" stroke-width="1.3" fill="none" opacity=".4"/>';
    var gd = wallGlyphs(line, H, P, r, o.glyphN || 320, o.glyphOpt);
    var gid = pfx + '-gy';
    s += '<defs><path id="' + gid + '0" d="' + gd[0] + '"/><path id="' + gid + '1" d="' + gd[1] + '"/><path id="' + gid + '2" d="' + gd[2] + '"/></defs>';
    s += '<g fill="none" stroke-linecap="round" stroke-linejoin="round"' + (o.glyphG || '') + '>' +
      '<g stroke="' + C.glyphGlow + '" opacity="' + (C.glyphGlowOp || .18) + '"><use href="#' + gid + '0" stroke-width="7"/><use href="#' + gid + '1" stroke-width="4.5"/><use href="#' + gid + '2" stroke-width="2.6"/></g>' +
      '<g stroke="' + C.glyph + '"><use href="#' + gid + '0" stroke-width="2.6"/><use href="#' + gid + '1" stroke-width="1.6"/><use href="#' + gid + '2" stroke-width="1"/></g></g>';
    if (o.afterWall) s += o.afterWall;
    // 顶部压暗
    s += '<rect width="1600" height="900" fill="url(#' + pfx + '-top)"/>';
    // 灯
    var LS = sampler(line), glows = '', bodies = '', pools = '', refl = '';
    for (var t = o.lampStart || 1; t < LS.len; t += o.lampGap || 3) {
      var p = LS(t), z = P.depth(p[0], p[1]);
      if (z < 1.5) continue;
      var q = P(p[0], o.lampH || 2.6, p[1]);
      if (q[0] < -60 || q[0] > 1660) continue;
      if (o.lampSkip && o.lampSkip(q)) continue;
      if (o.glyphOpt && hidden(o.glyphOpt.cam, p, o.glyphOpt.occ)) continue;
      var k = clamp(9 / z, .12, 1.6);
      var L = wallLamp(pfx, q[0], q[1], k, (t | 0) % 2 ? pfx + '-fk' : pfx + '-fk2');
      var lo = o.lampFade ? R1(clamp(1.4 - z / o.lampFade, .15, 1)) : 1;
      if (lo < 1) { L.glow = L.glow.replace('/>', ' opacity="' + lo + '"/>'); L.body = '<g opacity="' + lo + '">' + L.body + '</g>'; }
      glows += L.glow; bodies += L.body;
      pools += '<ellipse cx="' + R(q[0]) + '" cy="' + R(q[1] + 20 * k) + '" rx="' + R(120 * k) + '" ry="' + R(150 * k) + '" fill="url(#' + pfx + '-lg)"' + (lo < 1 ? ' opacity="' + lo + '"' : '') + '/>';
      var fq = P(p[0], 0, p[1]);
      if (z > 5) refl += '<ellipse cx="' + R(fq[0]) + '" cy="' + R(fq[1] + (fq[1] - q[1]) * .55) + '" rx="' + R1(14 * k) + '" ry="' + R((fq[1] - q[1]) * .6) + '" fill="url(#' + pfx + '-lg)"/>';
    }
    s += '<g style="mix-blend-mode:screen" opacity="' + (o.poolOp || .7) + '">' + pools + '</g>';
    s += '<g clip-path="url(#' + pfx + '-fc)" style="mix-blend-mode:screen">' + refl + '</g>';
    if (o.floorOver) s += o.floorOver;
    s += '<g class="' + pfx + '-br" style="mix-blend-mode:screen">' + glows + '</g>' + bodies.replace(new RegExp(pfx + 'LB', 'g'), C.bracket);
    // 雾
    s += '<rect x="0" y="' + (o.mistY || 330) + '" width="1600" height="' + (o.mistH || 260) + '" fill="url(#' + pfx + '-mist)"/>';
    if (o.front) s += o.front;
    s += U.vignette(pfx, o.vig == null ? .8 : o.vig);
    return s;
  }

  /* ================================================================ 1. 恐惧 */
  /* 穹顶：把平面按比例向中心收缩、逐层抬高，画成同心环 + 肋 */
  function dome(plan, P, H, cxz, rings, stroke, op) {
    var d = '';
    rings.forEach(function (rg) {
      var ring = plan.map(function (p) { return [cxz[0] + (p[0] - cxz[0]) * rg[0], cxz[1] + (p[1] - cxz[1]) * rg[0]]; });
      var cp = clipPlan(ring, P, .6);
      if (cp.length < 3) return;
      d += 'M' + projPlan(cp, P, rg[1]).map(function (q) { return R(q[0]) + ' ' + R(q[1]); }).join('L') + 'Z';
    });
    for (var i = 0; i < plan.length - 1; i += 3) {
      var p = plan[i], seg = '', last = rings[rings.length - 1];
      [[1, H]].concat(rings).forEach(function (rg, k) {
        var X = cxz[0] + (p[0] - cxz[0]) * rg[0], Z = cxz[1] + (p[1] - cxz[1]) * rg[0];
        if (P.depth(X, Z) < .6) { seg = ''; return; }
        var q = P(X, rg[1], Z);
        seg += (seg ? 'L' : 'M') + R(q[0]) + ' ' + R(q[1]);
      });
      d += seg;
    }
    return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" opacity="' + op + '"/>';
  }

  GF.art.bg.heart_fear = function () {
    var pfx = 'bg-hfear';
    var P = camera(820, 800, 390, 1.6, -.11, 0, 0);
    // 水滴形平面：尖端在脚下，圆端在远处
    var plan = [];
    for (var i = 0; i <= 48; i++) {
      var t = i / 48 * Math.PI * 2;
      var X = 16 * Math.sin(t) * Math.sin(t / 2) * (1 + .07 * Math.sin(3 * t + 1));
      var Z = 12 - 12 * Math.cos(t) + .6 * Math.sin(2 * t);
      plan.push([X, Z]);
    }
    plan.reverse(); // 逆时针 → 内墙正面朝向相机
    var archX = 0, archZ = 23.7, aw = 1.9, ah = 5;
    var r = U.rng(7);
    // 远处拱门
    var A = P(archX - aw, 0, archZ), B = P(archX + aw, 0, archZ), Ts = P(archX, ah - aw, archZ);
    var rad = (B[0] - A[0]) / 2, mx = (A[0] + B[0]) / 2;
    var archD = 'M' + R(A[0]) + ' ' + R(A[1]) + 'V' + R(Ts[1]) + 'A' + R(rad) + ' ' + R(rad) + ' 0 0 1 ' + R(B[0]) + ' ' + R(Ts[1]) + 'V' + R(B[1]) + 'Z';
    var arch = '<ellipse cx="' + R(mx) + '" cy="' + R(Ts[1]) + '" rx="' + R(rad * 4.2) + '" ry="' + R(rad * 2.6) + '" fill="url(#' + pfx + '-sp)" style="mix-blend-mode:screen"/>' +
      '<path d="' + archD + '" fill="none" stroke="#8fe8d0" stroke-width="16" opacity=".1"/>' +
      '<path d="' + archD + '" fill="#010403" stroke="#3a6a60" stroke-width="3"/>' +
      '<path d="' + archD + '" fill="url(#' + pfx + '-ad)"/>';
    function inArch(q) { return q[0] > A[0] - 14 && q[0] < B[0] + 14 && q[1] > Ts[1] - rad - 14; }
    // 拱门周围更密的大符号
    var ag = '';
    for (var k = 0; k < 24; k++) {
      var ang = Math.PI * (k / 23), rr = rad * (1.45 + r() * .3);
      ag += glyph(r, mx + Math.cos(Math.PI - ang) * rr * 1.1, Ts[1] - Math.sin(ang) * rr * 1.05 + (k % 2) * 7, 13 + r() * 6);
    }
    for (var k2 = 0; k2 < 12; k2++) {
      var side = k2 % 2 ? 1 : -1;
      ag += glyph(r, mx + side * rad * (1.55 + r() * .4), Ts[1] + 12 + (k2 >> 1) * 22, 12 + r() * 5);
    }
    arch += '<path d="' + ag + '" fill="none" stroke="#8fffe0" stroke-width="4.5" opacity=".2" stroke-linecap="round"/>' +
      '<path d="' + ag + '" fill="none" stroke="#041210" stroke-width="1.8" stroke-linecap="round"/>';
    // 血迹：从脚下一路通往拱门，渗进石头的暗黑色
    var blood = ['', ''], halo = '';
    for (var z = 1.8; z < archZ - .6; z += .3 + r() * .5 * Math.min(1, z / 6)) {
      var bx = archX * (z / archZ) + Math.sin(z / 3.2) * .9 * (1 - z / archZ) + (r() - .5) * .3;
      var n = 1 + Math.floor(r() * 4);
      for (var m = 0; m < n; m++) {
        blood[m % 2] += floorBlot(P, bx + (r() - .5) * .28, z + (r() - .5) * .22, .02 + r() * .06, .6 + r());
      }
      if (r() < .25) for (var sm = 0; sm < 5; sm++) blood[0] += floorBlot(P, bx + sm * .02, z + sm * .07, .03 + r() * .02);
      if (r() < .3) halo += floorBlot(P, bx + (r() - .5) * .2, z, .1 + r() * .1, .5 + r() * .6);
    }
    blood = '<path d="' + halo + '" fill="#1c0907" opacity=".28"/><path d="' + blood[0] + '" fill="#0e0303" opacity=".85"/><path d="' + blood[1] + '" fill="#260807" opacity=".7"/>';
    return U.svg(tombRoom({
      pfx: pfx, P: P, seed: 11, plan: plan, wall: plan.concat([plan[0]]), H: 7,
      fx0: -15, fx1: 15, fz0: 1.5, fz1: 25.5, fogD: 34, floorVeinN: 26, wallVeinN: 26, grid: 2, hy: 390,
      col: {
        void: '#020807', ceil: '#0a1a17', wall: '#22463e', wallDark: '#030907', vein: '#5c948a',
        floorFar: '#1c3a34', floorNear: '#010403', mistOp: .2, seam: '#020807', seamOp: .5, glyph: '#03100c', glyphGlow: '#7fe8cc', glyphGlowOp: .3,
        lampCore: '#e4fff0', lampHalo: '#4fb89c', flameA: '#f4ffe8', flameB: '#8fe0c0', mist: '#3f8a78', bracket: '#0c1a17'
      },
      defs: '<radialGradient id="' + pfx + '-ad" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#0b1c18" stop-opacity=".2"/></radialGradient>' +
        '<radialGradient id="' + pfx + '-sp"><stop offset="0" stop-color="#5fc8ac" stop-opacity=".45"/><stop offset="1" stop-color="#5fc8ac" stop-opacity="0"/></radialGradient>',
      ceiling: dome(plan, P, 7, [0, 13], [[.84, 8], [.62, 9], [.36, 9.7]], '#2c5a50', .35),
      glyphN: 190, glyphOpt: { size: .5, skip: inArch }, inscribe: { dmin: 12, op: .45 }, lampSkip: inArch, lampGap: 3.2, lampH: 2.8, poolOp: .95,
      afterWall: arch,
      floorOver: '<g clip-path="url(#' + pfx + '-fc)">' + blood + '</g>',
      mistY: 380, mistH: 200
    }));
  };

  /* ================================================================ 2. 沮丧 */
  GF.art.bg.heart_despair = function () {
    var pfx = 'bg-hdesp';
    var P = camera(760, 800, 385, 1.6, .22, -.5, -3);
    var Rc = 12, w = 2.6, Z0 = 2, left = [], right = [], mid = [], nrm = [];
    for (var zz = -4; zz < Z0; zz += 1.5) { left.push([-w, zz]); right.push([w, zz]); mid.push([0, zz]); nrm.push([1, 0]); }
    for (var i = 0; i <= 26; i++) {
      var ph = i / 26 * 2.3;
      var cxp = Rc - Rc * Math.cos(ph), czp = Z0 + Rc * Math.sin(ph), nx = Math.cos(ph), nz = -Math.sin(ph);
      left.push([cxp - w * nx, czp - w * nz]); right.push([cxp + w * nx, czp + w * nz]); mid.push([cxp, czp]); nrm.push([nx, nz]);
    }
    var plan = left.concat(right.slice().reverse());
    var cam = [-.5, -3], r = U.rng(21);
    // 血迹：沿中线偏左，拐弯处消失在内墙后
    var MS = sampler(mid), blood = ['', ''], halo = '';
    for (var s2 = 3; s2 < MS.len; s2 += .35 + r() * .6) {
      var c = MS(s2), off = Math.sin(s2 / 2.3) * .5 - .2;
      var ph2 = Math.max(0, (c[1] - Z0) / Rc), nx2 = s2 < Z0 + 1 ? 1 : Math.cos(Math.asin(clamp((c[1] - Z0) / Rc, -1, 1)));
      var bp = [c[0] + off * nx2, c[1]];
      if (hidden(cam, bp, right)) continue;
      var n = 1 + Math.floor(r() * 3);
      for (var m = 0; m < n; m++) blood[m % 2] += floorBlot(P, bp[0] + (r() - .5) * .3, bp[1] + (r() - .5) * .25, .02 + r() * .06, .6 + r());
      if (r() < .3) halo += floorBlot(P, bp[0], bp[1], .1 + r() * .12, .6 + r() * .5);
    }
    // 横向石板缝，显出弯道走势
    var seams = '';
    for (var si = 0; si < left.length; si++) {
      var a = left[si], b = right[si];
      if (P.depth(a[0], a[1]) < .5 || P.depth(b[0], b[1]) < .5) continue;
      var qa = P(a[0], 0, a[1]), qb = P(b[0], 0, b[1]);
      seams += 'M' + R(qa[0]) + ' ' + R(qa[1]) + 'L' + R(qb[0]) + ' ' + R(qb[1]);
    }
    for (var sl = -1; sl <= 1; sl += 2) {
      var sd = '';
      mid.forEach(function (c, k) {
        var X = c[0] + sl * .9 * nrm[k][0], Z = c[1] + sl * .9 * nrm[k][1];
        if (P.depth(X, Z) < .5) return;
        var q = P(X, 0, Z); sd += (sd ? 'L' : 'M') + R(q[0]) + ' ' + R(q[1]);
      });
      seams += sd;
    }
    var bl = '<path d="' + halo + '" fill="#141010" opacity=".18"/><path d="' + blood[0] + '" fill="#0c0808" opacity=".8"/><path d="' + blood[1] + '" fill="#231816" opacity=".65"/>';
    // 缓慢飘动的灰雾
    var css = '<style>.' + pfx + '-mv{animation:' + pfx + '-mv 18s ease-in-out infinite alternate}@keyframes ' + pfx + '-mv{from{transform:translateX(-60px)}to{transform:translateX(60px)}}</style>';
    var fog = '<g class="' + pfx + '-mv" opacity=".5">';
    for (var f = 0; f < 7; f++) fog += '<ellipse cx="' + R(200 + f * 220 + r() * 80) + '" cy="' + R(430 + r() * 60) + '" rx="' + R(260 + r() * 160) + '" ry="' + R(40 + r() * 30) + '" fill="url(#' + pfx + '-fo)"/>';
    fog += '</g>';
    return U.svg(tombRoom({
      pfx: pfx, P: P, seed: 23, plan: plan, wall: plan, H: 5.2,
      fx0: -3, fx1: 14, fz0: -2, fz1: 14, fogD: 18, floorVeinN: 30, wallVeinN: 40, hy: 385,
      col: {
        void: '#070808', ceil: '#141516', wall: '#56585a', wallDark: '#08090a', vein: '#2a2b2c', veinOp: .35,
        floorFar: '#3e4042', floorNear: '#121314', seam: '#0a0b0c', seamOp: .45, glyph: '#151617', glyphGlow: '#b0b2b4', glyphGlowOp: .1,
        lampCore: '#e0d8c8', lampHalo: '#8a8478', flameA: '#f0e6d0', flameB: '#b0a690', mist: '#5a5c60', mistOp: .25, bracket: '#1a1b1c'
      },
      defs: '<radialGradient id="' + pfx + '-fo"><stop offset="0" stop-color="#6a6c70" stop-opacity=".45"/><stop offset="1" stop-color="#6a6c70" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="' + pfx + '-dk"><stop offset="0" stop-color="#000" stop-opacity=".85"/><stop offset=".6" stop-color="#000" stop-opacity=".4"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>',
      css: css,
      glyphN: 230, glyphOpt: { size: .42, cam: cam, occ: right, maxSz: 34 }, inscribe: null,
      lampGap: 3.4, lampH: 2.5, lampStart: 2, poolOp: .55, lampFade: 14,
      floorUnder: '<path d="' + seams + '" stroke="#0b0c0d" stroke-width="2" fill="none" opacity=".6"/>',
      floorOver: '<g clip-path="url(#' + pfx + '-fc)">' + bl + '</g>',
      front: fog, mistY: 330, mistH: 220, vig: .85
    }));
  };

  /* ---------- 地上的白骨与铁矢 ---------- */
  function skeleton(P, X, Z, ang, r, col, dark) {
    var c = Math.cos(ang), s = Math.sin(ang), d = '', jt = '', rb = '';
    function W(u, v, y) { var x = X + u * c - v * s, z = Z + u * s + v * c; return P(x, y || .03, z); }
    function M(q) { return R(q[0]) + ' ' + R(q[1]); }
    function L(a, b) { return 'M' + M(W(a[0], a[1], a[2])) + 'L' + M(W(b[0], b[1], b[2])); }
    var j = function () { return (r() - .5) * .16; };
    // 脊柱
    d += 'M' + M(W(.16, 0, .08)) + 'L' + M(W(.5, 0, .12)) + 'L' + M(W(.8, j() * .2, .06));
    // 肋骨：从脊柱拱起、向两侧落到地面
    for (var k = 0; k < 7; k++) {
      var u = .21 + k * .062, wv = .17 - Math.abs(k - 2) * .012;
      rb += 'M' + M(W(u, 0, .12)) + 'Q' + M(W(u + .02, -wv, .13)) + ' ' + M(W(u + .08, -wv * .9, .02)) +
        'M' + M(W(u, 0, .12)) + 'Q' + M(W(u + .02, wv, .13)) + ' ' + M(W(u + .08, wv * .9, .02));
    }
    var aL = [[.2, -.19], [.47 + j(), -.33 + j()], [.72 + j(), -.28 + j()]], aR = [[.2, .19], [.42 + j(), .36 + j()], [.24 + j(), .55 + j()]];
    var lL = [[.86, -.09], [1.3 + j(), -.19 + j()], [1.74 + j(), -.15 + j()]], lR = [[.86, .09], [1.27 + j(), .25 + j()], [1.64 + j(), .42 + j()]];
    [aL, aR, lL, lR].forEach(function (bn) {
      d += L(bn[0], bn[1]) + L(bn[1], bn[2]);
      jt += 'M' + M(W(bn[1][0], bn[1][1])) + 'h.1M' + M(W(bn[2][0], bn[2][1])) + 'h.1';
    });
    d += L([.2, -.19, .05], [.2, .19, .05]); // 锁骨
    var q = W(0, 0, .1), z = q[2], w = clamp(.032 * P.f / z, 1.1, 5);
    // 骨盆
    var pv = W(.84, 0, .05), pr = .13 * P.f / z;
    var pel = 'M' + R(pv[0] - pr) + ' ' + R(pv[1]) + 'q' + R1(pr) + ' ' + R1(-pr * .5) + ' ' + R1(pr * 2) + ' 0q' + R1(-pr) + ' ' + R1(pr * .45) + ' ' + R1(-pr * 2) + ' 0z';
    // 头骨：立体的，按屏幕方向画
    var sr = .1 * P.f / z, hx = q[0], hy = q[1] - sr * .4;
    var skull = '<path d="M' + R1(hx - sr) + ' ' + R1(hy) + 'a' + R1(sr) + ' ' + R1(sr * .95) + ' 0 1 1 ' + R1(sr * 2) + ' 0q0 ' + R1(sr * .6) + ' ' + R1(-sr * .35) + ' ' + R1(sr * .75) + 'h' + R1(-sr * .6) + 'q' + R1(-sr * .4) + ' ' + R1(-sr * .15) + ' ' + R1(-sr * .4) + ' ' + R1(-sr * .75) + 'z" fill="' + col + '"/>' +
      '<path d="M' + R1(hx - sr * .42) + ' ' + R1(hy + sr * .1) + 'h.1M' + R1(hx + sr * .42) + ' ' + R1(hy + sr * .1) + 'h.1" stroke="' + dark + '" stroke-width="' + R1(sr * .55) + '" stroke-linecap="round"/>';
    var sh = W(.8, 0, 0), shr = .95 * P.f / z;
    return '<ellipse cx="' + R(sh[0]) + '" cy="' + R(sh[1]) + '" rx="' + R(shr) + '" ry="' + R(shr * .18) + '" fill="' + dark + '" opacity=".45"/>' +
      '<g stroke-linecap="round" stroke-linejoin="round" fill="none">' +
      '<path d="' + d + rb + '" stroke="' + dark + '" stroke-width="' + R1(w * 2) + '" opacity=".55"/>' +
      '<path d="' + rb + '" stroke="' + col + '" stroke-width="' + R1(w * .7) + '"/>' +
      '<path d="' + d + '" stroke="' + col + '" stroke-width="' + R1(w) + '"/>' +
      '<path d="' + jt + '" stroke="' + col + '" stroke-width="' + R1(w * 1.8) + '"/>' +
      '<path d="' + pel + '" fill="' + col + '" stroke="' + dark + '" stroke-width="' + R1(w * .5) + '"/></g>' + skull;
  }
  function bolts(P, r, n, area, near) {
    var d = '', hi = '', tip = '';
    for (var i = 0; i < n; i++) {
      var p = area(r);
      if (!p) continue;
      var a = r() * 6.28, L = .32, up = r() < .25 ? .12 + r() * .15 : .02;
      var A = P(p[0], .02, p[1]), B = P(p[0] + Math.cos(a) * L, up, p[1] + Math.sin(a) * L);
      if (A[2] < near || A[1] > 905) continue;
      var seg = 'M' + R(A[0]) + ' ' + R(A[1]) + 'l' + R(B[0] - A[0]) + ' ' + R(B[1] - A[1]);
      d += seg; tip += 'M' + R(B[0]) + ' ' + R(B[1]) + 'h.1';
      if (r() < .5) hi += 'M' + R(A[0]) + ' ' + R(A[1] - 1) + 'l' + R((B[0] - A[0]) * .6) + ' ' + R((B[1] - A[1]) * .6);
    }
    return [d, hi, tip];
  }

  /* ================================================================ 3. 愤怒 */
  GF.art.bg.heart_anger = function () {
    var pfx = 'bg-hang';
    var P = camera(800, 800, 380, 1.75, -.07, 0, -1.2);
    var tipX = 1.1, tipZ = 17, hw = .5;
    var Lw = [], Rw = [];
    for (var i = 0; i <= 12; i++) {
      var t = i / 12;
      Lw.push([-3.9 + (tipX - hw + 3.9) * t, tipZ * t]);
      Rw.push([3.9 + (tipX + hw - 3.9) * t, tipZ * t]);
    }
    var wall = Lw.concat(Rw.slice().reverse());
    var plan = wall.slice();
    var r = U.rng(31);
    // 尖端拱门
    var A = P(tipX - hw, 0, tipZ), B = P(tipX + hw, 0, tipZ), Ts = P(tipX, 2.2 - hw, tipZ);
    var rad = (B[0] - A[0]) / 2, mx = (A[0] + B[0]) / 2;
    var archD = 'M' + R(A[0]) + ' ' + R(A[1]) + 'V' + R(Ts[1]) + 'A' + R1(rad) + ' ' + R1(rad) + ' 0 0 1 ' + R(B[0]) + ' ' + R(Ts[1]) + 'V' + R(B[1]) + 'Z';
    var arch = '<ellipse cx="' + R(mx) + '" cy="' + R(Ts[1]) + '" rx="150" ry="120" fill="url(#' + pfx + '-sp)" style="mix-blend-mode:screen"/>' +
      '<path d="' + archD + '" fill="#050000" stroke="#ff7040" stroke-width="3" stroke-opacity=".5"/>';
    // 墙上的箭孔
    var holes = '';
    [Lw, Rw].forEach(function (Wl) {
      var S = sampler(Wl);
      for (var s2 = .6; s2 < S.len - .6; s2 += .7) {
        var p = S(s2);
        [.5, 1.1].forEach(function (h) {
          var q = P(p[0], h, p[1]);
          if (q[2] < 1.5) return;
          var rr = .045 * P.f / q[2];
          holes += 'M' + R1(q[0] - rr) + ' ' + R(q[1]) + 'a' + R1(rr) + ' ' + R1(rr) + ' 0 1 0 ' + R1(2 * rr) + ' 0a' + R1(rr) + ' ' + R1(rr) + ' 0 1 0 ' + R1(-2 * rr) + ' 0';
        });
      }
    });
    var holeS = '<path d="' + holes + '" fill="#0a0100" stroke="#ff8a50" stroke-width=".8" stroke-opacity=".35"/>';
    // 三具白骨
    var bone = '#e2c2a2', boneD = '#2a0a04';
    var sks = skeleton(P, -.4, 11.4, -.5, r, bone, boneD) + skeleton(P, 2.0, 9.4, 2.5, r, bone, boneD) + skeleton(P, -1.9, 6.4, .8, r, bone, boneD);
    // 明黄布料（幽灵旗的残片）
    // 明黄布料：揉皱的一团（屏幕空间造型，按深度缩放）
    var cq = P(.65, 0, 7.8), ck = 82 / (cq[2] / 9.8) / 100;
    var cloth = '<g transform="translate(' + R(cq[0]) + ' ' + R(cq[1]) + ') scale(' + R1(ck) + ' ' + R1(ck * .62) + ')">' +
      '<ellipse cx="2" cy="10" rx="60" ry="9" fill="#1a0602" opacity=".6"/>' +
      '<path d="M-54 9Q-50 -5 -33 -9L-20 -21Q-5 -28 6 -17L21 -24Q39 -19 45 -6L56 7Q48 9 40 8L36 13Q16 11 0 13Q-12 11 -20 15Q-38 12 -54 9Z" fill="#e8c020"/>' +
      '<path d="M-33 -9Q-20 -2 -6 4Q-18 8 -34 9ZM6 -17Q12 -4 24 3Q36 2 45 -6Q30 -8 21 -24Z" fill="#a87c08" opacity=".75"/>' +
      '<path d="M-20 -21Q-8 -16 3 -19M21 -24Q30 -18 34 -12M-48 4Q-40 -2 -33 -6" stroke="#fff4b0" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M-44 4q9 -12 20 -6t18 -4t16 -9t18 2" stroke="#16100a" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M-24 -2l-3 -7M-8 -5l2 -8M8 -14l-1 -6M-34 -1l-6 3" stroke="#16100a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M10 4q10 -2 16 5q-8 4 -18 1z" fill="#5a2206" opacity=".7"/>' +
      '<path d="M36 13l3 -4l3 3l3 -4l4 3l3 -4" stroke="#6a4a00" stroke-width="1.5" fill="none"/></g>';
    // 铁矢
    var bt = bolts(P, r, 175, function (rr) {
      var z = 3 + Math.pow(rr(), .8) * 13, half = 3.9 + (hw - 3.9) * (z / tipZ) - .2, x = (rr() * 2 - 1) * half + tipX * z / tipZ;
      return [x, z];
    }, 1.2);
    var boltS = '<path d="' + bt[0] + '" stroke="#1a0804" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="' + bt[2] + '" stroke="#1a0804" stroke-width="4.5" stroke-linecap="round"/><path d="' + bt[1] + '" stroke="#d08050" stroke-width=".9" fill="none" opacity=".7"/>';
    // 天花上的横梁
    var beams = '';
    for (var bi = 1; bi < Lw.length; bi++) {
      var ba = P(Lw[bi][0], 4.6, Lw[bi][1]), bb = P(Rw[bi][0], 4.6, Rw[bi][1]);
      beams += 'M' + R(ba[0]) + ' ' + R(ba[1]) + 'L' + R(bb[0]) + ' ' + R(bb[1]);
    }
    return U.svg(tombRoom({
      pfx: pfx, P: P, seed: 33, plan: plan, wall: wall, H: 4.6,
      fx0: -4.4, fx1: 4.4, fz0: 0, fz1: 17.2, fogD: 26, floorVeinN: 22, wallVeinN: 36, grid: .9, hy: 380,
      col: {
        void: '#0c0302', ceil: '#1e0806', wall: '#7a2812', wallDark: '#140403', vein: '#c05a30', veinOp: .3,
        floorFar: '#6a2410', floorNear: '#120403', seam: '#1a0502', seamOp: .6, glyph: '#1a0502', glyphGlow: '#ff4a18', glyphGlowOp: .4,
        lampCore: '#fff0c0', lampHalo: '#ff5a1a', flameA: '#fff6d8', flameB: '#ff8a30', mist: '#b03a18', mistOp: .2, bracket: '#240804'
      },
      defs: '<radialGradient id="' + pfx + '-sp"><stop offset="0" stop-color="#ff6a30" stop-opacity=".5"/><stop offset="1" stop-color="#ff6a30" stop-opacity="0"/></radialGradient>' +
        '<linearGradient id="' + pfx + '-cf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4a0" stop-opacity=".5"/><stop offset=".5" stop-color="#e8c020" stop-opacity="0"/><stop offset="1" stop-color="#6a3a00" stop-opacity=".5"/></linearGradient>',
      glyphN: 175, glyphOpt: { size: .4, maxSz: 30 }, lampGap: 2.6, lampH: 2.4, lampStart: 1.5, poolOp: .8,
      ceiling: '<path d="' + beams + '" stroke="#3a0e06" stroke-width="3" fill="none" opacity=".8"/>',
      afterWall: holeS + arch,
      floorOver: boltS + sks + cloth,
      mistY: 330, mistH: 200, vig: .85
    }));
  };

  /* ================================================================ 4. 疯狂 */
  GF.art.bg.heart_madness = function () {
    var pfx = 'bg-hmad';
    var P = camera(760, 800, 400, 1.6, .04, 0, .2);
    var Rr = 8, cz = 8.6, plan = [];
    for (var i = 0; i <= 36; i++) {
      var a = Math.PI / 2 + i / 36 * Math.PI * 2; // 从最近点开始逆时针
      plan.push([Math.cos(a) * Rr * -1, cz - Math.sin(a) * Rr]);
    }
    plan.reverse();
    var r = U.rng(41);
    // 扭转的穹顶肋：越往上越旋转，像旋涡
    var vort = '';
    for (var k = 0; k < 18; k++) {
      var th = k / 18 * Math.PI * 2, seg = '';
      for (var lv = 0; lv <= 8; lv++) {
        var t = lv / 8, rr = Rr * (1 - t * .92), ang = th + t * 2.4, y = 6 + Math.sin(t * 1.5708) * 5;
        var X = Math.cos(ang) * rr, Z = cz + Math.sin(ang) * rr;
        if (P.depth(X, Z) < .8) { seg = ''; continue; }
        var q = P(X, y, Z);
        seg += (seg ? 'L' : 'M') + R(q[0]) + ' ' + R(q[1]);
      }
      vort += seg;
    }
    for (var rg = 1; rg <= 3; rg++) {
      var t2 = rg / 4, rr2 = Rr * (1 - t2 * .92), y2 = 6 + Math.sin(t2 * 1.5708) * 5, sg = '';
      for (var m = 0; m <= 40; m++) {
        var a2 = m / 40 * Math.PI * 2, X2 = Math.cos(a2) * rr2, Z2 = cz + Math.sin(a2) * rr2;
        if (P.depth(X2, Z2) < .8) { if (sg) vort += sg; sg = ''; continue; }
        var q2 = P(X2, y2, Z2); sg += (sg ? 'L' : 'M') + R(q2[0]) + ' ' + R(q2[1]);
      }
      vort += sg;
    }
    var ceiling = '<path d="' + vort + '" stroke="#d050c0" stroke-width="2.5" fill="none" opacity=".45"/>';
    // 出口拱门（通往棺室）
    var aw = .8, A = P(-aw, 0, cz + Rr - .05), B = P(aw, 0, cz + Rr - .05), Ts = P(0, 2.4 - aw, cz + Rr - .05);
    var rad = (B[0] - A[0]) / 2, mx = (A[0] + B[0]) / 2;
    var archD = 'M' + R(A[0]) + ' ' + R(A[1]) + 'V' + R(Ts[1]) + 'A' + R1(rad) + ' ' + R1(rad) + ' 0 0 1 ' + R(B[0]) + ' ' + R(Ts[1]) + 'V' + R(B[1]) + 'Z';
    function inArch(q) { return q[0] > A[0] - 12 && q[0] < B[0] + 12 && q[1] > Ts[1] - rad - 12; }
    var arch = '<path d="' + archD + '" fill="#030004" stroke="#ff50c0" stroke-width="2.5" stroke-opacity=".45"/>';
    // 箭孔
    var holes = '', S = sampler(plan);
    for (var s2 = .5; s2 < S.len; s2 += .75) {
      var p = S(s2);
      [.6, 1.3, 2.0].forEach(function (h) {
        var q = P(p[0], h, p[1]);
        if (q[2] < 2 || q[0] < -10 || q[0] > 1610 || inArch(q)) return;
        var hr = .05 * P.f / q[2];
        holes += 'M' + R1(q[0] - hr) + ' ' + R(q[1]) + 'a' + R1(hr) + ' ' + R1(hr) + ' 0 1 0 ' + R1(2 * hr) + ' 0a' + R1(hr) + ' ' + R1(hr) + ' 0 1 0 ' + R1(-2 * hr) + ' 0';
      });
    }
    // 拱门上方的符号旋涡：三条旋臂，越外越大、被拉长，整体缓慢扭转；只画在墙面上
    var vx = mx, vy = Ts[1] - 120, sp = '', arm = '';
    for (var ar = 0; ar < 3; ar++) {
      var armD = '';
      for (var n = 0; n <= 16; n++) {
        var t3 = n / 16, ang3 = ar * 2.094 + t3 * 4.2, rad3 = 24 + t3 * t3 * 560;
        var gx = vx + Math.cos(ang3) * rad3 * 1.3, gy = vy + Math.sin(ang3) * rad3 * .36;
        armD += (n ? 'L' : 'M') + R(gx) + ' ' + R(gy);
        if (n > 1 && !inArch([gx, gy + 30])) sp += glyph(r, gx, gy, 14 + t3 * 36, .6, ang3 + 1.5708, 1.3 + t3);
      }
      arm += armD;
    }
    var fl = [];
    plan.forEach(function (p) { if (P.depth(p[0], p[1]) > 3) fl.push(P(p[0], 0, p[1])); });
    fl.sort(function (a, b) { return b[0] - a[0]; });
    var wallClip = '<clipPath id="' + pfx + '-wc"><polygon points="-300,-300 1900,-300 ' + pts(fl) + '"/></clipPath>';
    // 起伏的墙面波带：像墙在呼吸
    var waves = '';
    for (var wv = 0; wv < 5; wv++) {
      var h0 = .9 + wv * 1.05, ph = r() * 6, sg2 = '';
      for (var s3 = 0; s3 <= S.len; s3 += .9) {
        var p3 = S(s3), q3 = P(p3[0], h0 + Math.sin(s3 * .55 + ph) * .35, p3[1]);
        if (q3[2] < 1.5 || q3[0] < -100 || q3[0] > 1700) { if (sg2) waves += sg2; sg2 = ''; continue; }
        sg2 += (sg2 ? 'L' : 'M') + R(q3[0]) + ' ' + R(q3[1]);
      }
      waves += sg2;
    }
    var swirl = '<defs><path id="' + pfx + '-sp" d="' + sp + '"/></defs>' +
      '<path d="' + waves + '" stroke="#ff50c8" stroke-width="5" fill="none" opacity=".12"/><path d="' + waves + '" stroke="#200418" stroke-width="1.4" fill="none" opacity=".6"/>' +
      wallClip + '<g clip-path="url(#' + pfx + '-wc)"><g class="' + pfx + '-w0" fill="none" stroke-linecap="round"><path d="' + arm + '" stroke="#ff60d0" stroke-width="18" opacity=".1"/><path d="' + arm + '" stroke="#ff80e0" stroke-width="2" opacity=".25"/>' +
      '<use href="#' + pfx + '-sp" stroke="#ff4ad0" stroke-width="10" opacity=".28"/><use href="#' + pfx + '-sp" stroke="#1e0418" stroke-width="3.4"/><use href="#' + pfx + '-sp" stroke="#ffb0ec" stroke-width="1.2" opacity=".8"/></g></g>';
    var css = '<style>.' + pfx + '-w0{transform-origin:' + R(vx) + 'px ' + R(vy) + 'px;animation:' + pfx + '-w 6s ease-in-out infinite alternate}' +
      '@keyframes ' + pfx + '-w{0%{transform:rotate(-2.5deg) scale(.99)}100%{transform:rotate(2.5deg) scale(1.02)}}' +
      '.' + pfx + '-pl{animation:' + pfx + '-pl 3.3s ease-in-out infinite alternate}@keyframes ' + pfx + '-pl{from{opacity:.7}to{opacity:1}}</style>';
    // 满地铁矢（中央最密）
    var bt = bolts(P, r, 215, function (rr) {
      var a = rr() * 6.283, d = Math.pow(rr(), .7) * (Rr - .4);
      return [Math.cos(a) * d, cz + Math.sin(a) * d];
    }, 1.4);
    var boltS = '<path d="' + bt[0] + '" stroke="#12030e" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="' + bt[2] + '" stroke="#12030e" stroke-width="4.4" stroke-linecap="round"/><path d="' + bt[1] + '" stroke="#e070c0" stroke-width=".9" fill="none" opacity=".6"/>';
    var inner = tombRoom({
      pfx: pfx, P: P, seed: 43, plan: plan, wall: plan, H: 6,
      fx0: -8, fx1: 8, fz0: .8, fz1: 16.6, fogD: 30, floorVeinN: 14, wallVeinN: 20, grid: 1.4, hy: 400,
      col: {
        void: '#0a0310', ceil: '#1e0a24', wall: '#5a1c56', wallDark: '#0c030e', vein: '#c050b0', veinOp: .3,
        floorFar: '#3e1440', floorNear: '#0a020a', seam: '#0e030e', seamOp: .55, glyph: '#16031a', glyphGlow: '#ff40c0', glyphGlowOp: .35,
        lampCore: '#ffe6f6', lampHalo: '#c02890', flameA: '#fff0fa', flameB: '#f070c8', mist: '#902a80', mistOp: .22, bracket: '#1a0618'
      },
      css: css,
      ceiling: ceiling,
      glyphN: 95, glyphOpt: { size: .5, wob: 2.4, skip: inArch, maxSz: 40 }, lampGap: 2.9, lampH: 3, lampStart: 1, poolOp: .75, lampSkip: inArch,
      afterWall: '<path d="' + holes + '" fill="#0a010a" stroke="#ff70d0" stroke-width=".7" stroke-opacity=".3"/>' + arch + '<g class="' + pfx + '-pl">' + swirl + '</g>',
      floorOver: boltS,
      mistY: 340, mistH: 220, vig: .9
    });
    // 画面整体倾斜（荷兰角），让人站不稳
    return U.svg('<rect width="1600" height="900" fill="#0a0310"/><g transform="translate(800 450) rotate(-4) scale(1.13) translate(-800 -450)">' + inner + '</g>' +
      '<rect width="1600" height="900" fill="url(#' + pfx + '-rv)"/><defs><radialGradient id="' + pfx + '-rv" cx="50%" cy="45%" r="70%"><stop offset=".55" stop-color="#3a0030" stop-opacity="0"/><stop offset="1" stop-color="#1a0014" stop-opacity=".6"/></radialGradient></defs>');
  };
})();
