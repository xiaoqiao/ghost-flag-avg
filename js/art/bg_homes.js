/*
 * 背景：住宅与街头 —— 那多家（夜/被翻）、杨铁家、傅惜娣家、钟书同家、街口、出租车、诊所、尾声书橱。
 * 风格：扁平剧场感矢量（大块几何 + 渐变光池 + 暗角）。所有 id / class / keyframes 带背景前缀。
 */
(function () {
  'use strict';
  var U = GF.art.util;

  /* ---------------- 小工具 ---------------- */
  function n(v) { return Math.round(v * 10) / 10; }
  function R(x, y, w, h, f, a) {
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" fill="' + f + '"' + (a ? ' ' + a : '') + '/>';
  }
  function PG(pts, f, a) {
    return '<polygon points="' + pts.map(n).join(' ') + '" fill="' + f + '"' + (a ? ' ' + a : '') + '/>';
  }
  function PA(d, f, a) { return '<path d="' + d + '" fill="' + f + '"' + (a ? ' ' + a : '') + '/>'; }
  function LN(x1, y1, x2, y2, s, w, a) {
    return '<line x1="' + n(x1) + '" y1="' + n(y1) + '" x2="' + n(x2) + '" y2="' + n(y2) + '" stroke="' + s + '" stroke-width="' + w + '"' + (a ? ' ' + a : '') + '/>';
  }
  function EL(cx, cy, rx, ry, f, a) {
    return '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + f + '"' + (a ? ' ' + a : '') + '/>';
  }
  function stops(st) {
    return st.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  /** 线性渐变；默认自上而下（包围盒坐标） */
  function LG(id, st, x1, y1, x2, y2, user) {
    return '<linearGradient id="' + id + '" x1="' + (x1 == null ? 0 : x1) + '" y1="' + (y1 == null ? 0 : y1) + '" x2="' + (x2 == null ? 0 : x2) +
      '" y2="' + (y2 == null ? 1 : y2) + '"' + (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(st) + '</linearGradient>';
  }
  /** 径向渐变（包围盒坐标，中心 .5 .5） */
  function RG(id, st, cx, cy, r) {
    return '<radialGradient id="' + id + '" cx="' + (cx == null ? 0.5 : cx) + '" cy="' + (cy == null ? 0.5 : cy) + '" r="' + (r == null ? 0.5 : r) + '">' + stops(st) + '</radialGradient>';
  }
  /** 光池：椭圆 + 径向渐变 */
  function glow(D, id, cx, cy, rx, ry, color, op, a) {
    D.push(RG(id, [[0, color, op], [0.45, color, op * 0.45], [1, color, 0]]));
    return EL(cx, cy, rx, ry, 'url(#' + id + ')', a);
  }
  function blurF(id, sd) {
    return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }
  /** 同色矩形/多边形合并成一条 path，压缩体积 */
  function Batch() { this.m = {}; this.o = []; }
  Batch.prototype.add = function (c, d) { if (!this.m[c]) { this.m[c] = []; this.o.push(c); } this.m[c].push(d); return this; };
  Batch.prototype.rect = function (x, y, w, h, c) { return this.add(c, 'M' + n(x) + ' ' + n(y) + 'h' + n(w) + 'v' + n(h) + 'h' + n(-w) + 'z'); };
  Batch.prototype.poly = function (p, c) {
    var d = 'M' + n(p[0]) + ' ' + n(p[1]);
    for (var i = 2; i < p.length; i += 2) d += 'L' + n(p[i]) + ' ' + n(p[i + 1]);
    return this.add(c, d + 'z');
  };
  Batch.prototype.circ = function (x, y, r, c) { return this.add(c, 'M' + n(x - r) + ' ' + n(y) + 'a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(2 * r) + ' 0a' + n(r) + ' ' + n(r) + ' 0 1 0 ' + n(-2 * r) + ' 0z'); };
  Batch.prototype.out = function (a) {
    var s = '', self = this;
    this.o.forEach(function (c) { s += '<path fill="' + c + '" d="' + self.m[c].join('') + '"' + (a ? ' ' + a : '') + '/>'; });
    return s;
  };
  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }

  /** 书架一层：在 [x, x+w] 内、底线 y 处排书；返回 Batch 已添加 */
  function shelfBooks(bt, rnd, x, y, w, hMax, pal, o) {
    o = o || {};
    var cx = x + 2;
    while (cx < x + w - 8) {
      var bw = (o.minW || 7) + rnd() * (o.varW || 12), bh = hMax * (0.6 + rnd() * 0.38);
      if (cx + bw > x + w - 2) break;
      var r = rnd();
      if (o.gap && r < o.gap) { cx += bw * 1.6; continue; }
      var c = pick(rnd, pal);
      if (r > 0.94 && cx + 40 < x + w) { // 平放的一摞
        var k = 2 + Math.floor(rnd() * 3), sw = 30 + rnd() * 14, yy = y;
        for (var i = 0; i < k; i++) { var th = 5 + rnd() * 5; bt.rect(cx + rnd() * 4, yy - th, sw - rnd() * 6, th - 1, pick(rnd, pal)); yy -= th; }
        cx += sw + 3; continue;
      }
      if (r > 0.88 && o.lean !== false) { // 斜靠
        var ang = (o.leanMax || 0.28) * (0.5 + rnd() * 0.5), sn = Math.sin(ang), cs = Math.cos(ang);
        var x0 = cx + bh * sn;
        bt.poly([cx, y, cx + bw * cs, y - bw * sn * 0.2, x0 + bw * cs, y - bh * cs, x0, y - bh * cs + 2], c);
        cx += bw + bh * sn + 2; continue;
      }
      bt.rect(cx, y - bh, bw - 1, bh, c);
      if (rnd() < 0.45) bt.rect(cx + 1, y - bh + bh * (0.1 + rnd() * 0.12), bw - 3, 2 + rnd() * 3, o.band || 'rgba(230,210,160,.28)');
      cx += bw;
    }
    return bt;
  }

  /** 透视房间几何：后墙 [bx0,bx1]×[by0,by1]，灭点 (vx,vy) */
  function room(o) {
    var s0 = (0 - o.vx) / (o.bx0 - o.vx), s1 = (1600 - o.vx) / (o.bx1 - o.vx);
    var g = {
      o: o,
      lt: o.vy + (o.by0 - o.vy) * s0, lb: o.vy + (o.by1 - o.vy) * s0,
      rt: o.vy + (o.by0 - o.vy) * s1, rb: o.vy + (o.by1 - o.vy) * s1,
      /** 把后墙平面上的点按深度系数 s 拉近 */
      p: function (x, y, s) { return [o.vx + (x - o.vx) * s, o.vy + (y - o.vy) * s]; }
    };
    g.ceil = [0, 0, 1600, 0, 1600, g.rt, o.bx1, o.by0, o.bx0, o.by0, 0, g.lt];
    g.left = [0, g.lt, o.bx0, o.by0, o.bx0, o.by1, 0, g.lb];
    g.right = [1600, g.rt, o.bx1, o.by0, o.bx1, o.by1, 1600, g.rb];
    g.floor = [0, g.lb, o.bx0, o.by1, o.bx1, o.by1, 1600, g.rb, 1600, 900, 0, 900];
    g.back = [o.bx0, o.by0, o.bx1, o.by0, o.bx1, o.by1, o.bx0, o.by1];
    return g;
  }
  /** 地板木条：从后墙底边向画面外放射 */
  function planks(g, step, color, w, rnd, seam) {
    var o = g.o, d = '', x;
    for (x = o.bx0 - 1400; x <= o.bx1 + 1400; x += step) {
      var s = (900 - o.vy) / (o.by1 - o.vy), p = g.p(x, o.by1, s);
      var y0 = o.by1, x0 = x;
      d += 'M' + n(x0) + ' ' + y0 + 'L' + n(p[0]) + ' ' + n(p[1]);
    }
    var out = '<path d="' + d + '" stroke="' + color + '" stroke-width="' + w + '" fill="none"/>';
    if (seam && rnd) { // 木条接缝
      var sd = '';
      for (var i = 0; i < seam; i++) {
        var sy = o.by1 + 8 + Math.pow(rnd(), 1.3) * (900 - o.by1 - 8), sc = (sy - o.vy) / (o.by1 - o.vy);
        var bx = o.bx0 - 1400 + step * Math.floor(rnd() * ((o.bx1 - o.bx0 + 2800) / step));
        var a = g.p(bx, o.by1, sc), b = g.p(bx + step, o.by1, sc);
        sd += 'M' + n(a[0]) + ' ' + n(sy) + 'L' + n(b[0]) + ' ' + n(sy);
      }
      out += '<path d="' + sd + '" stroke="' + color + '" stroke-width="' + w + '" fill="none"/>';
    }
    return out;
  }

  /* ================================================================
   * 那多的住处（夜 / 被翻过的正午）
   * ================================================================ */
  function nadoRoom(mode) {
    var night = mode === 'night', P = night ? 'bgnh' : 'bgnhr';
    var D = [], B = [], rnd = U.rng(night ? 2004 : 616);
    var g = room({ bx0: 150, bx1: 1450, by0: 70, by1: 590, vx: 800, vy: 330 });
    var C = night ? {
      ceil: '#080b12', wallT: '#121926', wallB: '#1a2230', left: '#0c1019', right: '#111722',
      floorT: '#16130f', floorB: '#0d0b09', plank: '#07060a', wood: '#2a2119', woodD: '#17120d', woodL: '#3a2d20',
      bookPal: ['#2a2622', '#3a2a24', '#23303a', '#3b3526', '#2d2233', '#1d2a26', '#463424']
    } : {
      ceil: '#2b2e2c', wallT: '#4a4f4a', wallB: '#3c413d', left: '#323633', right: '#393d39',
      floorT: '#3d352c', floorB: '#2a241e', plank: '#221d18', wood: '#5a4634', woodD: '#3b2e22', woodL: '#7a6048',
      bookPal: ['#6a5a48', '#5a4a44', '#4a5a5e', '#6e664e', '#5b4a5e', '#44584e', '#7a5a3e', '#8a7a60']
    };
    D.push(LG(P + '-wall', [[0, C.wallT], [1, C.wallB]]));
    D.push(LG(P + '-floor', [[0, C.floorT], [1, C.floorB]]));
    D.push(LG(P + '-desk', [[0, C.woodL], [1, C.wood]]));

    B.push(PG(g.ceil, C.ceil), PG(g.back, 'url(#' + P + '-wall)'), PG(g.floor, 'url(#' + P + '-floor)'));
    B.push(planks(g, 58, C.plank, 1.4, rnd, 26));
    B.push(PG(g.left, C.left), PG(g.right, C.right));
    // 踢脚线
    B.push(PG([g.o.bx0, 580, g.o.bx1, 580, g.o.bx1, 590, g.o.bx0, 590], C.woodD));
    B.push(PG([0, g.lb - 14, g.o.bx0, 580, g.o.bx0, 590, 0, g.lb], C.woodD));
    B.push(PG([1600, g.rb - 14, g.o.bx1, 580, g.o.bx1, 590, 1600, g.rb], C.woodD));
    // 墙角阴影
    D.push(LG(P + '-cornL', [[0, '#000', 0.45], [1, '#000', 0]], 0, 0, 1, 0));
    D.push(LG(P + '-cornR', [[0, '#000', 0], [1, '#000', 0.45]], 0, 0, 1, 0));
    B.push(R(150, 70, 60, 520, 'url(#' + P + '-cornL)'), R(1390, 70, 60, 520, 'url(#' + P + '-cornR)'));
    B.push(R(150, 70, 1300, 26, U.rgba('#000', 0.25)));

    /* ---- 窗 ---- */
    var wx0 = 230, wx1 = 650, wy0 = 120, wy1 = 440;
    B.push('<clipPath id="' + P + '-winclip"><rect x="' + (wx0 + 10) + '" y="' + (wy0 + 10) + '" width="' + (wx1 - wx0 - 20) + '" height="' + (wy1 - wy0 - 20) + '"/></clipPath>');
    var W = [];
    if (night) {
      D.push(LG(P + '-sky', [[0, '#070b16'], [0.55, '#0d1420'], [0.85, '#1e2638'], [1, '#3a2e2a']]));
      W.push(R(wx0, wy0, wx1 - wx0, wy1 - wy0, 'url(#' + P + '-sky)'));
      // 远景楼群（冷、淡）
      var far = new Batch(), fx = wx0;
      while (fx < wx1) { var fw = 20 + rnd() * 40, fh = 60 + rnd() * 120; far.rect(fx, wy1 - 40 - fh, fw, fh + 40, '#1f2940'); fx += fw - 4; }
      W.push(far.out());
      // 东方明珠剪影（远）
      var tx = 400;
      W.push('<g fill="#26324a">' + R(tx - 2, 140, 4, 70, '#26324a') + '<circle cx="' + tx + '" cy="218" r="13"/>' + R(tx - 3, 228, 6, 70, '#26324a') +
        '<circle cx="' + tx + '" cy="300" r="19"/>' + PG([tx - 30, 400, tx - 6, 316, tx + 6, 316, tx + 30, 400], '#26324a') + '</g>');
      W.push('<circle class="' + P + '-blink" cx="' + tx + '" cy="140" r="2.4" fill="#ff4a3a"/>');
      W.push('<circle cx="' + tx + '" cy="218" r="13" fill="#ff6a9a" opacity=".22"/><circle cx="' + tx + '" cy="300" r="19" fill="#ff6a9a" opacity=".16"/>');
      // 中景楼 + 窗灯
      var mid = new Batch(), lit = new Batch(), mx = wx0 - 10;
      while (mx < wx1) {
        var mw = 40 + rnd() * 60, mh = 110 + rnd() * 150;
        if (Math.abs(mx + mw / 2 - 400) < 70) mh = Math.min(mh, 100);
        var top = wy1 - mh;
        mid.rect(mx, top, mw, mh, rnd() < 0.5 ? '#111827' : '#0e1420');
        for (var yy = top + 10; yy < wy1 - 8; yy += 11) for (var xx = mx + 5; xx < mx + mw - 6; xx += 9) {
          var rr = rnd();
          if (rr < 0.16) lit.rect(xx, yy, 5, 6, '#e8a854'); else if (rr < 0.22) lit.rect(xx, yy, 5, 6, '#9fb8d8'); else if (rr < 0.25) lit.rect(xx, yy, 5, 6, '#f0d08a');
        }
        mx += mw + rnd() * 20;
      }
      W.push(mid.out(), lit.out('opacity=".85"'));
      // 近处一幢高楼的边
      W.push(PG([wx1 - 90, wy0, wx1, wy0, wx1, wy1, wx1 - 110, wy1], '#090d15'));
      var nb = new Batch();
      for (var ny = wy0 + 14; ny < wy1 - 10; ny += 24) { nb.rect(wx1 - 80 + (ny - wy0) * -0.05, ny, 14, 9, rnd() < 0.3 ? '#d89a4a' : '#141c2a'); nb.rect(wx1 - 50, ny, 14, 9, rnd() < 0.25 ? '#e8b060' : '#141c2a'); }
      W.push(nb.out());
      // 地面钠灯雾
      D.push(LG(P + '-haze', [[0, '#e0903a', 0], [1, '#e0903a', 0.45]]));
      W.push(R(wx0, wy1 - 90, wx1 - wx0, 90, 'url(#' + P + '-haze)'));
    } else {
      W.push(R(wx0, wy0, wx1 - wx0, wy1 - wy0, '#f4ecd8'));
    }
    B.push('<g clip-path="url(#' + P + '-winclip)">' + W.join('') + '</g>');
    // 窗框（铝合金推拉窗）
    var fr = night ? '#2a303c' : '#6a6e6a', frL = night ? '#3e4656' : '#8a8e88';
    B.push(PA('M' + wx0 + ' ' + wy0 + 'h' + (wx1 - wx0) + 'v' + (wy1 - wy0) + 'h' + (wx0 - wx1) + 'z M' + (wx0 + 10) + ' ' + (wy0 + 10) + 'v' + (wy1 - wy0 - 20) + 'h' + (wx1 - wx0 - 20) + 'v' + (wy0 - wy1 + 20) + 'z', fr, 'fill-rule="evenodd"'));
    B.push(R((wx0 + wx1) / 2 - 5, wy0 + 10, 10, wy1 - wy0 - 20, fr), R(wx0 + 10, 250, wx1 - wx0 - 20, 6, fr));
    B.push(R(wx0 - 12, wy1, wx1 - wx0 + 24, 10, frL), R(wx0 - 8, wy1 + 10, wx1 - wx0 + 16, 5, U.rgba('#000', 0.35)));
    if (night) {
      // 玻璃反光
      B.push(PG([wx0 + 30, wy0 + 12, wx0 + 70, wy0 + 12, wx0 + 16, wy1 - 12, wx0 + 12, wy1 - 12, wx0 + 12, wy1 - 80], 'rgba(160,190,230,.05)'));
      // 窗台上的仙人掌
      B.push(R(560, wy1 - 22, 24, 22, '#3a2a20'), PA('M566 ' + (wy1 - 22) + 'c-4-30 16-30 12 0z', '#1c2a22'));
    }

    /* ---- 窗帘 ---- */
    var cur = [];
    B.push(R(wx0 - 60, wy0 - 22, wx1 - wx0 + 120, 6, night ? '#20242c' : '#5a584e'));
    function drape(x0, x1, y0, y1, base, fold, hi, sway) {
      var s = '<path d="M' + x0 + ' ' + y0 + 'H' + x1 + 'L' + (x1 + sway) + ' ' + y1 + 'H' + (x0 + sway * 0.4) + 'Z" fill="' + base + '"/>';
      var k = Math.round((x1 - x0) / 16), d = '', dh = '';
      for (var i = 0; i < k; i++) {
        var fx = x0 + (i + 0.3) * (x1 - x0) / k;
        d += 'M' + n(fx) + ' ' + y0 + 'l6 0l' + n(sway * (fx - x0) / (x1 - x0) + 2) + ' ' + (y1 - y0) + 'l-8 0z';
        dh += 'M' + n(fx + 8) + ' ' + y0 + 'l3 0l' + n(sway * (fx - x0) / (x1 - x0) + 1) + ' ' + (y1 - y0) + 'l-4 0z';
      }
      return s + PA(d, fold) + PA(dh, hi);
    }
    if (night) {
      cur.push(drape(190, 285, wy0 - 18, 480, '#2b2420', 'rgba(0,0,0,.35)', 'rgba(140,160,200,.10)', -6));
      cur.push(drape(598, 690, wy0 - 18, 480, '#2b2420', 'rgba(0,0,0,.35)', 'rgba(240,170,90,.08)', 8));
    } else {
      D.push(LG(P + '-curglow', [[0, '#e8c890'], [0.5, '#d4aa70'], [1, '#a88050']]));
      cur.push(drape(190, 440, wy0 - 18, 482, 'url(#' + P + '-curglow)', 'rgba(90,60,30,.28)', 'rgba(255,240,200,.25)', -4));
      cur.push(drape(452, 690, wy0 - 18, 482, 'url(#' + P + '-curglow)', 'rgba(90,60,30,.28)', 'rgba(255,240,200,.25)', 6));
      // 缝隙：刺眼的正午
      B.push(PG([440, wy0 - 16, 455, wy0 - 16, 458, 482, 446, 482], '#fffbe8'));
    }
    B.push(cur.join(''));
    if (!night) B.push(glow(D, P + '-slitg', 450, 300, 70, 240, '#fff4c8', 0.8), glow(D, P + '-curg', 440, 300, 330, 280, '#f0c880', 0.35));

    /* ---- 书桌上方：搁板 + 软木板 + 月历 ---- */
    var shelfY = 262;
    var bt = new Batch();
    if (night) shelfBooks(bt, rnd, 722, shelfY, 420, 72, C.bookPal);
    else {
      shelfBooks(bt, rnd, 722, shelfY, 420, 72, C.bookPal, { gap: 0.35, leanMax: 0.6 });
    }
    B.push(bt.out());
    B.push(R(712, shelfY, 440, 8, C.woodL), R(712, shelfY + 8, 440, 4, U.rgba('#000', 0.4)));
    B.push(R(730, shelfY + 12, 8, 18, C.woodD), R(1126, shelfY + 12, 8, 18, C.woodD));
    // 软木板：剪报与照片
    B.push(R(740, 116, 170, 118, night ? '#3a2c1e' : '#8a6a48'), R(740, 116, 170, 118, 'none', 'stroke="' + C.woodD + '" stroke-width="5"'));
    var clip = new Batch(), pins = new Batch();
    var cps = [[752, 126, 48, 60], [806, 124, 40, 30], [852, 130, 46, 56], [808, 160, 36, 46], [760, 192, 40, 32], [856, 190, 44, 34]];
    cps.forEach(function (c, i) {
      var ok = night || i % 3 === 1;
      var col = night ? (i % 2 ? '#5a5a52' : '#6a6454') : '#d8d0bc';
      if (ok) {
        clip.rect(c[0], c[1], c[2], c[3], col);
        for (var l = c[1] + 8; l < c[1] + c[3] - 4; l += 6) clip.rect(c[0] + 4, l, c[2] - 8 - (l % 12), 2, night ? '#3a3a36' : '#9a9486');
      }
      pins.rect(c[0] + c[2] / 2 - 2, c[1] - 1, 4, 4, '#b0302a');
    });
    B.push(clip.out(), pins.out());
    if (!night) B.push(PG([806, 124, 846, 124, 850, 150, 812, 166], '#e0d8c4', 'transform="rotate(18 806 124)"'));
    // 月历
    B.push(R(960, 132, 92, 112, night ? '#6a665c' : '#d4cebe'), R(960, 132, 92, 34, night ? '#5a2a26' : '#a8443a'));
    B.push('<text x="1006" y="158" font-family="Songti SC, STSong, SimSun, serif" font-size="20" fill="' + (night ? '#c8b8a0' : '#f4e8d8') + '" text-anchor="middle">六月</text>');
    var cal = new Batch();
    for (var ci = 0; ci < 30; ci++) cal.rect(966 + (ci % 7) * 12, 174 + Math.floor(ci / 7) * 14, 8, 6, night ? '#4a463e' : '#8a8478');
    B.push(cal.out(), R(1034, 202, 10, 8, 'none', 'stroke="#c0302a" stroke-width="2"'));

    /* ---- 书桌 ---- */
    var dt = [700, 450, 1170, 450], df = g.p(700, 450, 1.14), df2 = g.p(1170, 450, 1.14);
    B.push(PG([dt[0], dt[1], dt[2], dt[3], df2[0], df2[1], df[0], df[1]], 'url(#' + P + '-desk)'));
    B.push(PG([df[0], df[1], df2[0], df2[1], df2[0], df2[1] + 12, df[0], df[1] + 12], C.woodD));
    var legB = g.p(700, 590, 1.14), legB2 = g.p(1170, 590, 1.14);
    // 抽屉柜（左）与右侧挡板
    var dx0 = df[0], dx1 = df[0] + 118, dy0 = df[1] + 12, dy1 = legB[1];
    B.push(R(dx0, dy0, dx1 - dx0, dy1 - dy0, C.wood), R(dx1 - 6, dy0, 6, dy1 - dy0, C.woodD));
    B.push(R(df2[0] - 14, df2[1] + 12, 14, legB2[1] - df2[1] - 12, C.wood), R(dx1, dy0, df2[0] - 14 - dx1, dy1 - dy0, U.rgba('#000', 0.35)));
    var drawerH = (dy1 - dy0) / 3;
    for (var di = 0; di < 3; di++) {
      var yy0 = dy0 + di * drawerH;
      if (!night && di < 2) { // 被拉出的抽屉
        var ox = di === 0 ? 34 : 22, oy = di === 0 ? 26 : 16;
        B.push(R(dx0 + 4, yy0 + 3, dx1 - dx0 - 8, drawerH - 6, '#140f0b'));
        B.push(PG([dx0 + 4 - ox * 0.3, yy0 + oy, dx1 - 4 - ox * 0.3, yy0 + oy, dx1 - 4, yy0 + 4, dx0 + 4, yy0 + 4], C.woodD));
        B.push(R(dx0 + 2 - ox * 0.3, yy0 + oy, dx1 - dx0 - 4, drawerH - 4, C.woodL), R(dx0 + 2 - ox * 0.3, yy0 + oy, dx1 - dx0 - 4, 3, 'rgba(255,240,210,.25)'));
        B.push(R(dx0 + (dx1 - dx0) / 2 - 14 - ox * 0.3, yy0 + oy + drawerH / 2 - 3, 28, 5, '#a89880'));
        B.push(PG([dx0 + 10 - ox * 0.3, yy0 + oy + 2, dx0 + 40 - ox * 0.3, yy0 + oy - 12, dx0 + 60 - ox * 0.3, yy0 + oy - 4, dx0 + 36 - ox * 0.3, yy0 + oy + 6], '#e8e0cc'));
      } else {
        B.push(R(dx0 + 4, yy0 + 3, dx1 - dx0 - 8, drawerH - 6, C.woodL, 'opacity=".55"'));
        B.push(R(dx0 + (dx1 - dx0) / 2 - 14, yy0 + drawerH / 2 - 3, 28, 5, night ? '#5a5040' : '#a89880'));
      }
    }

    /* ---- 显示器（CRT）与桌面杂物 ---- */
    var mx0 = 880, mx1 = 1040, my1 = 458;
    B.push(PG([mx0 + 30, my1 - 8, mx1 - 30, my1 - 8, mx1 - 20, my1 + 2, mx0 + 20, my1 + 2], night ? '#2a2c30' : '#8a8a84'));
    B.push(PG([mx0 + 20, 300, mx1 - 20, 300, mx1 - 10, my1 - 14, mx0 + 10, my1 - 14], night ? '#1e2024' : '#7a7a74'));
    B.push(R(mx0, 292, mx1 - mx0, 148, night ? '#2c2f35' : '#a8a8a0', 'rx="6"'));
    if (night) {
      D.push(RG(P + '-scr', [[0, '#cfe6ff'], [0.5, '#6f9fd8'], [1, '#2a4a80']], 0.45, 0.4, 0.7));
      B.push(R(mx0 + 14, 304, mx1 - mx0 - 28, 108, 'url(#' + P + '-scr)', 'rx="8" class="' + P + '-scr"'));
      var tl = new Batch();
      for (var li = 0; li < 7; li++) tl.rect(mx0 + 26, 318 + li * 12, 40 + rnd() * 70, 4, 'rgba(20,40,80,.45)');
      B.push(tl.out());
      B.push(glow(D, P + '-scrg', 960, 360, 300, 230, '#5a8ad0', 0.35, 'style="mix-blend-mode:screen" class="' + P + '-scr"'));
      B.push(glow(D, P + '-scrd', 960, 462, 200, 26, '#7aaae8', 0.35, 'style="mix-blend-mode:screen"'));
    } else {
      B.push(R(mx0 + 14, 304, mx1 - mx0 - 28, 108, '#3a3e3c', 'rx="8"'));
      B.push(PG([mx0 + 30, 308, mx0 + 60, 308, mx0 + 34, 408, mx0 + 18, 408], 'rgba(255,250,230,.12)'));
    }
    B.push(R(mx0 + 60, 424, 40, 6, night ? '#15171a' : '#6a6a64'), '<circle cx="' + (mx1 - 18) + '" cy="428" r="3" fill="' + (night ? '#5aff8a' : '#556') + '"/>');
    // 键盘、鼠标、音箱
    B.push(PG([888, 462, 1032, 462, 1040, 472, 882, 472], night ? '#26282c' : '#b0aea4'), PG([1062, 462, 1078, 462, 1080, 471, 1060, 471], night ? '#26282c' : '#b0aea4'));
    B.push(R(846, 380, 26, 72, night ? '#15161a' : '#4a4a46', 'rx="3"'), R(1048, 380, 26, 72, night ? '#15161a' : '#4a4a46', 'rx="3"'));
    B.push('<circle cx="859" cy="424" r="8" fill="' + (night ? '#0a0b0d' : '#2a2a28') + '"/><circle cx="1061" cy="424" r="8" fill="' + (night ? '#0a0b0d' : '#2a2a28') + '"/>');
    if (night) {
      // 报纸摞、工作手册、笔筒、马克杯
      var pb = new Batch();
      for (var pi = 0; pi < 7; pi++) pb.rect(716 + (pi % 2) * 3, 452 - pi * 5, 96, 4, pi % 2 ? '#8a8474' : '#a49c88');
      B.push(pb.out());
      B.push(PG([1086, 458, 1128, 456, 1134, 466, 1090, 469], '#7a2a22'), R(1108, 456, 3, 12, '#c8b890'));
      B.push(R(1140, 428, 18, 30, '#3a3e48'), LN(1144, 428, 1140, 406, '#8a8a8a', 2), LN(1152, 428, 1156, 410, '#b03a2a', 2));
      B.push(R(818, 436, 20, 22, '#6a5a48', 'rx="2"'), '<path class="' + P + '-steam" d="M828 432c-6-10 6-14 0-24" stroke="rgba(200,210,230,.25)" stroke-width="2" fill="none"/>');
    } else {
      // 桌面凌乱：纸散开、书倒着
      var pp = new Batch();
      [[716, 440, 60, 0.2], [760, 448, 70, -0.15], [1080, 452, 64, 0.1], [1120, 446, 50, -0.3], [800, 455, 44, 0.4]].forEach(function (q) {
        var c = Math.cos(q[3]), s = Math.sin(q[3]), w = q[2], h = 16;
        pp.poly([q[0], q[1], q[0] + w * c, q[1] + w * s * 0.3, q[0] + w * c - h * s * 0.3, q[1] + w * s * 0.3 + h * 0.5, q[0] - h * s * 0.3, q[1] + h * 0.5], '#e8e0ce');
      });
      B.push(pp.out('opacity=".92"'));
      B.push(PG([1100, 424, 1150, 410, 1156, 424, 1106, 440], '#6a3a2c'), PG([1100, 424, 1106, 440, 1104, 446, 1098, 430], '#4a2a20'));
      B.push(R(1140, 436, 18, 22, '#3a3e48', 'transform="rotate(80 1149 447)"'));
    }

    /* ---- 转椅 ---- */
    var chc = night ? '#121418' : '#3a3834', chh = night ? '#22262e' : '#57544e';
    if (night) {
      B.push(PA('M905 438q55-14 110 0l-6 84h-98z', chc), PA('M912 446q48-10 96 0', 'none', 'stroke="' + chh + '" stroke-width="3"'));
      B.push(PG([888, 520, 1032, 520, 1044, 540, 876, 540], chh), R(952, 540, 16, 50, chc));
      B.push(PA('M900 604l60-14l60 14l-8 6l-52-10l-52 10z', chc));
    } else { // 被推倒在地：靠背着地，五星脚朝天
      B.push(EL(960, 628, 120, 14, 'rgba(0,0,0,.3)'));
      B.push(PA('M846 626l26-58q50-10 96 4l-18 64q-50 6-104-10z', chc), PA('M860 616l20-44q40-6 76 4', 'none', 'stroke="' + chh + '" stroke-width="3"'));
      B.push(PG([958, 560, 1000, 548, 1016, 616, 972, 630], chh), LN(1004, 580, 1062, 548, chc, 9));
      var sx = 1062, sy2 = 548, legs = '';
      [[-40, -10], [-10, -38], [30, -30], [42, 6], [8, 30]].forEach(function (l) { legs += 'M' + sx + ' ' + sy2 + 'l' + l[0] + ' ' + l[1]; B.push('<circle cx="' + (sx + l[0]) + '" cy="' + (sy2 + l[1]) + '" r="6" fill="' + chc + '"/>'); });
      B.push('<path d="' + legs + '" stroke="' + chc + '" stroke-width="7" stroke-linecap="round"/>');
    }

    /* ---- 床头柜 + 台灯 ---- */
    var ns = g.p(1195, 488, 1.06), ns2 = g.p(1275, 488, 1.06);
    B.push(PG([1195, 488, 1275, 488, ns2[0], ns2[1], ns[0], ns[1]], C.woodL));
    var nsB = g.p(1195, 590, 1.06);
    B.push(R(ns[0], ns[1], ns2[0] - ns[0], nsB[1] - ns[1], C.wood), R(ns[0] + 6, ns[1] + 10, ns2[0] - ns[0] - 12, 40, C.woodD, 'opacity=".6"'));
    if (!night) B.push(PG([ns[0] + 6, ns[1] + 10, ns2[0] - 6, ns[1] + 10, ns2[0] + 4, ns[1] + 38, ns[0] - 4, ns[1] + 38], C.woodL), R(ns[0] + 8, ns[1] + 12, ns2[0] - ns[0] - 16, 12, '#120d0a'));
    var lx = 1236;
    B.push(PA('M' + (lx - 16) + ' 492h32l-6-10h-20z', night ? '#3a3024' : '#6a5a44'), R(lx - 2, 420, 4, 64, night ? '#4a3e2e' : '#7a6a54'));
    D.push(LG(P + '-shade', night ? [[0, '#ffe2a8'], [1, '#e89a48']] : [[0, '#e8dcc0'], [1, '#c8b490']]));
    B.push(PG([lx - 22, 376, lx + 22, 376, lx + 36, 428, lx - 36, 428], 'url(#' + P + '-shade)'));
    if (night) {
      D.push(LG(P + '-coneU', [[0, '#ffc478', 0], [1, '#ffc478', 0.16]]));
      B.push(PA('M' + (lx - 22) + ' 376L' + (lx - 120) + ' 70H' + (lx + 120) + 'L' + (lx + 22) + ' 376z', 'url(#' + P + '-coneU)'));
      B.push(PG([lx - 36, 428, lx + 36, 428, lx + 70, 490, lx - 70, 490], 'rgba(255,196,120,.16)'));
      B.push('<g class="' + P + '-lamp">' + glow(D, P + '-lampg', lx, 410, 420, 330, '#f0a850', 0.42, 'style="mix-blend-mode:screen"') +
        glow(D, P + '-lampc', lx, 405, 90, 70, '#ffe0a0', 0.6, 'style="mix-blend-mode:screen"') + '</g>');
    } else {
      B.push(glow(D, P + '-lampc', lx, 405, 50, 40, '#ffe0a0', 0.35, 'style="mix-blend-mode:screen"'));
    }

    /* ---- 床（右下角，沿右墙） ---- */
    var hb = [1290, 1450];
    B.push(PA('M1290 590V420q0-18 18-18h124q18 0 18 18V590z', night ? '#211a14' : '#5a4634'));
    B.push(PA('M1302 590V428q0-12 12-12h112q12 0 12 12V590z', night ? '#2a2119' : '#6a5440'));
    var bA = [1290, 506], bB = [1450, 506], bC = g.p(1450, 506, 1.23), bDp = g.p(1290, 506, 1.633), bE = g.p(1290, 590, 1.633);
    B.push(PG([bA[0], bA[1], bB[0], bB[1], 1600, bC[1], 1600, bDp[1]], night ? '#2e3848' : '#8a8e8a'));
    B.push(PG([bA[0], bA[1], 1600, bDp[1], 1600, bE[1], 1290, 590], night ? '#1a212c' : '#5a5e5a'));
    if (night) {
      B.push(PA('M1300 506q10-26 40-26h60q30 0 40 20l6 12z', '#48526a'), PA('M1310 520q60-18 150 6l140 40v50l-300-100z', '#384866'));
      B.push(PA('M1330 530q120 10 270 60v28q-150-40-280-70z', '#2c3a54'));
      B.push(glow(D, P + '-bedg', 1330, 510, 160, 60, '#f0b060', 0.35, 'style="mix-blend-mode:screen"'));
    } else {
      // 被掀开的被子、枕头被扔
      B.push(PA('M1296 512q40-40 90-14l20 20l-30 18z', '#c8c8c0'), PA('M1360 540q80-60 150-20t90 10v80q-120 20-250-40z', '#6a7a88'));
      B.push(PA('M1440 560q60-20 160 0v30q-90 30-180 0z', '#56687a'), PA('M1300 580q30 20 70 10l-10 30q-40 4-64-20z', '#d4d2c8'));
    }

    /* ---- 左墙：衣橱 ---- */
    var wa = g.p(150, 200, 1.03), wb = g.p(150, 590, 1.03), wc = g.p(150, 200, 1.2), wd = g.p(150, 590, 1.2);
    var wm = g.p(150, 200, 1.115), wmb = g.p(150, 590, 1.115);
    B.push(PG([wa[0], wa[1], wc[0], wc[1], wd[0], wd[1], wb[0], wb[1]], C.wood));
    var wtop = g.p(150, 190, 1.03), wtop2 = g.p(150, 190, 1.2);
    B.push(PG([wtop[0], wtop[1], wtop2[0], wtop2[1], wc[0], wc[1], wa[0], wa[1]], C.woodL));
    if (night) {
      B.push(LN(wm[0], wm[1], wmb[0], wmb[1], C.woodD, 3), LN(wm[0] + 6, 380, wm[0] + 6, 410, '#6a5a40', 3), LN(wm[0] - 6, 380, wm[0] - 6, 410, '#6a5a40', 3));
    } else {
      B.push(PG([wa[0], wa[1], wm[0], wm[1], wmb[0], wmb[1], wb[0], wb[1]], '#0e0b09'));
      var hang = new Batch();
      for (var hi2 = 0; hi2 < 5; hi2++) { var hx = wa[0] - 8 - hi2 * 10; hang.poly([hx, wa[1] + 30 - hi2, hx - 6, wa[1] + 34, hx - 8, wa[1] + 180 + rnd() * 60, hx + 2, wa[1] + 180], pick(rnd, ['#3a3a44', '#4a3a32', '#2a3440', '#5a5a52'])); }
      B.push(hang.out());
      // 被拉开的门板（朝向观众）
      B.push(PG([wa[0], wa[1], wa[0] + 104, wa[1] - 10, wa[0] + 104, wb[1] + 12, wb[0], wb[1]], C.woodL));
      B.push(PG([wa[0] + 12, wa[1] + 16, wa[0] + 92, wa[1] + 8, wa[0] + 92, wb[1] - 16, wb[0] + 12, wb[1] - 20], '#9a9c94', 'opacity=".45"'));
      B.push(PG([wa[0] + 30, wa[1] + 20, wa[0] + 50, wa[1] + 18, wa[0] + 24, wb[1] - 30, wa[0] + 16, wb[1] - 40], 'rgba(255,250,235,.25)'));
      // 搭在门顶上的衬衫
      B.push(PA('M' + (wa[0] + 20) + ' ' + (wa[1] - 4) + 'l60 -8l6 70l-18 4l-6-50l-24 4l-4 60l-16-2z', '#5a6e84'));
      B.push(PA('M' + (wb[0] - 30) + ' ' + (wb[1] - 6) + 'q40-20 90 4l30 20l-110 8z', '#4a4038'));
    }

    /* ---- 天花吊灯（关） ---- */
    B.push(EL(800, 58, 70, 10, night ? '#141922' : '#5a5e5a'), EL(800, 54, 60, 7, night ? '#1e2430' : '#6e726c'));

    /* ---- 光线整体 ---- */
    if (night) {
      // 窗外城市冷光投在地板
      B.push(PG([260, 598, 640, 598, 760, 720, 180, 720], 'rgba(120,150,200,.07)'));
      B.push(glow(D, P + '-flg', 1236, 600, 360, 80, '#f0a850', 0.18, 'style="mix-blend-mode:screen"'));
      // 整体夜蓝压暗，暖灯附近保留
      D.push(RG(P + '-dark', [[0, '#0d1420', 0], [0.5, '#0d1420', 0.25], [1, '#05070c', 0.75]], 0.72, 0.45, 0.8));
      B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    } else {
      // 地板上散落的纸、翻倒的东西（在中下部，只作质感）
      var fl = new Batch();
      for (var fi = 0; fi < 18; fi++) {
        var fx2 = 150 + rnd() * 1250, fy2 = 612 + Math.pow(rnd(), 0.8) * 250, a2 = rnd() * 3.14, w2 = 34 + rnd() * 26, h2 = w2 * 1.35, sq = 0.3 + (fy2 - 600) / 900;
        var ca = Math.cos(a2), sa = Math.sin(a2), pts = [];
        [[0, 0], [w2, 0], [w2, h2], [0, h2]].forEach(function (q) { pts.push(fx2 + q[0] * ca - q[1] * sa, fy2 + (q[0] * sa + q[1] * ca) * sq); });
        fl.poly(pts, rnd() < 0.75 ? '#cfc8b6' : '#9a9282');
      }
      B.push(fl.out('opacity=".8"'));
      B.push(PG([160, 606, 230, 596, 250, 614, 176, 628], '#6a4a3a'), PG([1180, 640, 1250, 630, 1262, 648, 1190, 660], '#3a4a5a'));
      // 光柱：自窗帘缝斜射而下
      D.push(LG(P + '-beam', [[0, '#fff8e0', 0.55], [0.6, '#fff0c8', 0.22], [1, '#fff0c8', 0]], 0, 0, 0.3, 1));
      B.push(PG([440, 130, 458, 130, 700, 900, 560, 900], 'url(#' + P + '-beam)', 'style="mix-blend-mode:screen"'));
      B.push(glow(D, P + '-spot', 640, 760, 160, 40, '#fff4d0', 0.6, 'style="mix-blend-mode:screen"'));
      // 光柱里的浮尘
      var dust = '';
      for (var k = 0; k < 26; k++) { var t = rnd(); dust += '<circle cx="' + n(450 + t * 170 + (rnd() - 0.5) * 40) + '" cy="' + n(140 + t * 620) + '" r="' + n(0.8 + rnd() * 1.6) + '"/>'; }
      B.push('<g fill="#fffbe8" class="' + P + '-dust" opacity=".7">' + dust + '</g>');
      // 迷香：淡紫灰的薄雾层
      D.push(blurF(P + '-fog', 30));
      B.push('<g filter="url(#' + P + '-fog)" class="' + P + '-fogm">' + EL(520, 360, 420, 80, '#dcd2e4', 'opacity=".26"') + EL(1120, 320, 380, 60, '#d4cce0', 'opacity=".2"') + EL(800, 530, 760, 70, '#dcd6e4', 'opacity=".26"') + '</g>');
      B.push(R(0, 0, 1600, 900, 'rgba(214,204,226,.1)'));
      D.push(RG(P + '-dark', [[0, '#1a1c1a', 0], [0.6, '#1a1c1a', 0.2], [1, '#0a0b0a', 0.6]], 0.35, 0.35, 0.85));
      B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    }

    var css = night ?
      '.' + P + '-blink{animation:' + P + '-bl 2.6s steps(1) infinite}@keyframes ' + P + '-bl{0%{opacity:1}50%{opacity:.15}}' +
      '.' + P + '-lamp{animation:' + P + '-br 7s ease-in-out infinite}@keyframes ' + P + '-br{0%,100%{opacity:.88}50%{opacity:1}}' +
      '.' + P + '-scr{animation:' + P + '-fl 5s linear infinite}@keyframes ' + P + '-fl{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.9}49%{opacity:1}}' +
      '.' + P + '-steam{animation:' + P + '-st 4s ease-in-out infinite;transform-origin:828px 432px}@keyframes ' + P + '-st{0%{opacity:0;transform:translateY(4px)}50%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}'
      :
      '.' + P + '-dust{animation:' + P + '-du 14s ease-in-out infinite alternate}@keyframes ' + P + '-du{to{transform:translate(-14px,22px)}}' +
      '.' + P + '-fogm{animation:' + P + '-fo 18s ease-in-out infinite alternate}@keyframes ' + P + '-fo{to{transform:translateX(60px);opacity:.75}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, night ? 0.7 : 0.55));
  }
  GF.art.bg.nado_home = function () { return nadoRoom('night'); };
  GF.art.bg.nado_home_ransacked = function () { return nadoRoom('ransacked'); };

  /** 透视茶几：后墙平面 x0..x1、桌面高 ty，深度 s0..s1；带腿与地面阴影 */
  function ctable(g, x0, x1, ty, s0, s1, c) {
    var a = g.p(x0, ty, s0), b = g.p(x1, ty, s0), cc = g.p(x1, ty, s1), d = g.p(x0, ty, s1);
    var fy0 = g.o.vy + (g.o.by1 - g.o.vy) * s0, fy1 = g.o.vy + (g.o.by1 - g.o.vy) * s1, th = 11 * s1;
    var f0 = g.p(x0, g.o.by1, s0), f1 = g.p(x1, g.o.by1, s0), f2 = g.p(x1, g.o.by1, s1), f3 = g.p(x0, g.o.by1, s1);
    var o = PG([f0[0] - 10, fy0, f1[0] + 10, fy0, f2[0] + 14, fy1 + 6, f3[0] - 14, fy1 + 6], 'rgba(0,0,0,.35)');
    o += R(a[0] + 10, a[1], 8, fy0 - a[1], c.leg) + R(b[0] - 18, b[1], 8, fy0 - b[1], c.leg);
    if (c.shelf) { var m0 = g.p(x0, g.o.by1 - 40, s0), m1 = g.p(x1, g.o.by1 - 40, s0), m2 = g.p(x1, g.o.by1 - 40, s1), m3 = g.p(x0, g.o.by1 - 40, s1); o += PG([m0[0], m0[1], m1[0], m1[1], m2[0], m2[1], m3[0], m3[1]], c.edge); }
    o += PG([a[0], a[1], b[0], b[1], cc[0], cc[1], d[0], d[1]], c.top);
    o += PG([d[0], d[1], cc[0], cc[1], cc[0], cc[1] + th, d[0], d[1] + th], c.edge);
    o += R(d[0] + 6, d[1] + th, 11, fy1 - d[1] - th, c.leg) + R(cc[0] - 17, cc[1] + th, 11, fy1 - cc[1] - th, c.leg);
    o += LN(d[0] + 2, d[1] + 1, cc[0] - 2, cc[1] + 1, c.hi, 2);
    if (c.sheen) o += PG([a[0] + (b[0] - a[0]) * 0.15, a[1] + 1, a[0] + (b[0] - a[0]) * 0.32, a[1] + 1, d[0] + (cc[0] - d[0]) * 0.26, d[1] - 1, d[0] + (cc[0] - d[0]) * 0.08, d[1] - 1], c.sheen);
    return o;
  }

  /** 一张地面瓷砖/木地板的横向接缝（等距透视） */
  function floorRows(g, depthStep, camD, color, w) {
    var o = g.o, d = '';
    for (var k = 1; k < 40; k++) {
      var s = camD / (camD - k * depthStep), y = o.vy + (o.by1 - o.vy) * s;
      if (y > 900) break;
      d += 'M0 ' + n(y) + 'H1600';
    }
    return '<path d="' + d + '" stroke="' + color + '" stroke-width="' + w + '"/>';
  }

  /* ================================================================
   * 杨铁家：浦东世纪公园附近的新公寓客厅，白天
   * ================================================================ */
  GF.art.bg.yangtie_home = function () {
    var P = 'bgyt', D = [], B = [], rnd = U.rng(611);
    var g = room({ bx0: 120, bx1: 1480, by0: 60, by1: 600, vx: 820, vy: 330 });
    D.push(LG(P + '-wall', [[0, '#7c857e'], [1, '#949b92']]));
    D.push(LG(P + '-floor', [[0, '#b8b4a6'], [1, '#8c897e']]));
    B.push(PG(g.ceil, '#b2b6ac'), PG(g.back, 'url(#' + P + '-wall)'), PG(g.floor, 'url(#' + P + '-floor)'));
    B.push(planks(g, 80, 'rgba(96,94,86,.45)', 1.2), floorRows(g, 0.42, 6, 'rgba(96,94,86,.45)', 1.2));
    // 阳光在地上的平行四边形
    B.push(PG([880, 600, 1360, 600, 1160, 900, 470, 900], 'rgba(255,246,220,.22)'));
    B.push(PG(g.left, '#687069'), PG(g.right, '#737b73'));
    B.push(R(120, 588, 1360, 12, '#6a6e66'), PG([0, g.lb - 16, 120, 588, 120, 600, 0, g.lb], '#5a5e58'), PG([1600, g.rb - 16, 1480, 588, 1480, 600, 1600, g.rb], '#5a5e58'));
    B.push(R(120, 60, 1360, 16, 'rgba(0,0,0,.12)'));

    /* ---- 阳台推拉门与窗外世纪公园 ---- */
    var x0 = 880, x1 = 1360, y0 = 110, y1 = 600;
    B.push('<clipPath id="' + P + '-dclip"><rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '"/></clipPath>');
    var W = [];
    D.push(LG(P + '-sky', [[0, '#d8e0e2'], [0.7, '#eef0ea'], [1, '#f4f2e8']]));
    W.push(R(x0, y0, x1 - x0, y1 - y0, 'url(#' + P + '-sky)'));
    // 远处陆家嘴（空气透视：淡、冷）
    var sk = new Batch(), sx = x0 - 10;
    while (sx < x1) { var sw = 18 + rnd() * 36, sh = 40 + rnd() * 120; sk.rect(sx, 400 - sh, sw, sh + 60, '#c2cacc'); sx += sw + rnd() * 16; }
    W.push(sk.out());
    // 金茂大厦式的塔楼 + 东方明珠
    var jm = 'M1150 460V300l6-4v-30l5-4v-26l4-3v-22l3-3v-18l2-2v-30h2v30l2 2v18l3 3v22l4 3v26l5 4v30l6 4V460z';
    W.push(PA(jm, '#b0bcc2'), R(1238, 262, 3, 60, '#b8c2c6'), '<circle cx="1239.5" cy="300" r="7" fill="#b8c2c6"/><circle cx="1239.5" cy="340" r="10" fill="#b8c2c6"/>', PG([1226, 420, 1236, 345, 1243, 345, 1253, 420], '#b8c2c6'));
    // 公园树冠三层
    var tr = new Batch();
    [[430, '#9aa894', 26], [455, '#7c8e74', 30], [485, '#61755c', 34]].forEach(function (L, li) {
      for (var tx = x0 - 20; tx < x1 + 30; tx += L[2] * 0.9) tr.circ(tx + rnd() * 10, L[0] - rnd() * 22, L[2] * (0.7 + rnd() * 0.5), L[1]);
      tr.rect(x0, L[0], x1 - x0, 60, L[1]);
    });
    W.push(tr.out());
    W.push(R(x0, 470, x1 - x0, 6, 'rgba(230,240,240,.6)'));
    // 阳台：栏杆 + 晾衣竿
    var rl = new Batch();
    rl.rect(x0, 470, x1 - x0, 7, '#d6d8d0');
    for (var bx = x0 + 6; bx < x1; bx += 22) rl.rect(bx, 477, 4, 72, '#c4c6be');
    rl.rect(x0, 546, x1 - x0, 6, '#c4c6be');
    rl.rect(x0, 552, x1 - x0, 48, '#9a9a90');
    W.push(rl.out());
    W.push(R(x0, 150, x1 - x0, 4, '#8a8e88'));
    var cl = new Batch();
    [[930, 60, 90, '#8e9eae'], [1010, 44, 70, '#c0a8a0'], [1070, 80, 54, '#e0e0da'], [1170, 50, 96, '#7a8a78'], [1236, 64, 60, '#b8b0a0']].forEach(function (c) {
      cl.poly([c[0], 154, c[0] + c[1], 154, c[0] + c[1] + 2, 154 + c[2], c[0] - 2, 154 + c[2] + 4], c[3]);
    });
    W.push(cl.out());
    B.push('<g clip-path="url(#' + P + '-dclip)">' + W.join('') + '</g>');
    // 门框（逆光，偏暗）
    var fr = new Batch(), fc = '#6f746e';
    fr.rect(x0 - 8, y0 - 8, x1 - x0 + 16, 12, fc).rect(x0 - 8, y0, 12, y1 - y0, fc).rect(x1 - 4, y0, 12, y1 - y0, fc);
    [1000, 1120, 1240].forEach(function (x) { fr.rect(x - 4, y0, 8, y1 - y0, fc); });
    fr.rect(x0, 300, x1 - x0, 5, fc);
    B.push(fr.out(), R(x0 - 8, y1 - 8, x1 - x0 + 16, 8, '#5a5e58'));
    // 薄纱窗帘 + 厚帘
    var sh2 = new Batch();
    for (var fx = x0; fx < 990; fx += 14) sh2.rect(fx, y0, 7, y1 - y0, 'rgba(255,255,250,.18)');
    for (fx = 1250; fx < x1; fx += 14) sh2.rect(fx, y0, 7, y1 - y0, 'rgba(255,255,250,.18)');
    B.push(R(x0, y0, 110, y1 - y0, 'rgba(250,250,244,.42)'), R(1250, y0, 110, y1 - y0, 'rgba(250,250,244,.42)'), sh2.out());
    B.push(R(830, 92, 580, 6, '#4a4e4a'));
    B.push(PA('M836 98h66l-8 502h-66z', '#566664'), PA('M1340 98h66l18 502h-70z', '#566664'));
    B.push(PA('M850 98h10l-8 502h-10zM874 98h8l-8 502h-8zM1360 98h10l12 502h-10zM1384 98h8l12 502h-8z', 'rgba(0,0,0,.2)'));
    B.push(glow(D, P + '-dglow', 1120, 360, 520, 380, '#fffaf0', 0.35, 'style="mix-blend-mode:screen"'));
    D.push(LG(P + '-shaft', [[0, '#fff6e0', 0.16], [1, '#fff6e0', 0]], 0, 0, 0, 1));
    B.push(PG([900, 120, 1360, 120, 1160, 900, 470, 900], 'url(#' + P + '-shaft)', 'style="mix-blend-mode:screen"'));

    /* ---- 空调挂机 ---- */
    B.push(R(150, 92, 200, 50, '#d4d6ce', 'rx="8"'), R(158, 126, 184, 8, '#a8aaa2', 'rx="3"'), '<circle cx="320" cy="108" r="2.5" fill="#6ad08a"/>');
    B.push(PA('M150 120h-10v70h-6', 'none', 'stroke="#c8c8c0" stroke-width="4"'));

    /* ---- 沙发上方的“迎客松”山水画 ---- */
    B.push(R(318, 176, 388, 196, '#3a2e24'), R(326, 184, 372, 180, '#d6d0bc'));
    var mt = new Batch();
    mt.poly([326, 364, 380, 250, 430, 300, 480, 214, 560, 330, 620, 262, 698, 364], '#a8aca0');
    mt.poly([326, 364, 360, 300, 420, 340, 470, 280, 520, 364], '#7c8278');
    mt.poly([560, 364, 600, 300, 650, 336, 698, 290, 698, 364], '#6a7068');
    B.push(mt.out(), R(326, 318, 372, 24, 'rgba(240,236,224,.55)'));
    B.push(PA('M600 300q-10-30 20-60', 'none', 'stroke="#3a3a30" stroke-width="4"'), PA('M586 262q30-10 60 2l-20 6zM600 246q24-8 50 0l-18 6zM612 284q24-6 40 4l-16 4z', '#3e4a38'));
    B.push(R(348, 196, 10, 60, '#8a3a2a', 'opacity=".6"'), R(348, 262, 10, 10, '#b8402c'));

    /* ---- 沙发（仿皮，靠背铺白色钩花巾） ---- */
    var sofa = '#5e4132', sofaL = '#7a5644', sofaD = '#3e2a20';
    B.push(R(240, 428, 530, 90, sofa, 'rx="18"'), R(246, 432, 518, 10, sofaL, 'rx="5"'));
    B.push(LN(416, 440, 416, 510, sofaD, 2), LN(594, 440, 594, 510, sofaD, 2));
    // 钩花巾
    var lace = '';
    [300, 462, 624].forEach(function (lx) {
      lace += 'M' + lx + ' 424h96v30';
      for (var q = 0; q < 6; q++) lace += 'q-8 10-16 0';
      lace += 'z';
    });
    B.push(PA(lace, '#e8e6de'));
    var dots = new Batch();
    [300, 462, 624].forEach(function (lx) { for (var q = 0; q < 12; q++) dots.circ(lx + 8 + (q % 6) * 16, 434 + Math.floor(q / 6) * 10, 2.2, '#b8b6ae'); });
    B.push(dots.out());
    B.push(R(222, 462, 54, 110, sofa, 'rx="16"'), R(734, 462, 54, 110, sofa, 'rx="16"'), R(226, 466, 46, 8, sofaL, 'rx="4"'), R(738, 466, 46, 8, sofaL, 'rx="4"'));
    B.push(R(270, 506, 470, 18, sofaL, 'rx="6"'), R(270, 522, 470, 48, sofa), LN(426, 506, 426, 570, sofaD, 2), LN(584, 506, 584, 570, sofaD, 2));
    B.push(R(262, 570, 486, 10, sofaD), R(262, 580, 486, 16, 'rgba(0,0,0,.25)'));
    // 靠垫
    B.push(PA('M286 470q30-10 70 0l4 40q-40 6-76 0z', '#8a7a62'), PA('M662 468q34-8 66 4l-4 40q-36 4-66-2z', '#6e7a86'));

    /* ---- 边几 + 电话 + 报纸 ---- */
    B.push(R(800, 510, 64, 8, '#4a3a2e'), R(804, 518, 56, 82, '#3e3026'), R(810, 492, 44, 18, '#c8c0ae', 'rx="4"'), PA('M812 492q20-14 40 0', 'none', 'stroke="#b0a896" stroke-width="7"'));
    B.push(LN(816, 510, 800, 560, '#a8a090', 1.5));

    /* ---- 发财树 ---- */
    B.push(PG([1402, 540, 1466, 540, 1458, 600, 1410, 600], '#7a4a36'), R(1398, 534, 72, 10, '#8a5a44'));
    B.push(PA('M1430 534q-10-80 6-150q12 70-2 150zM1436 534q14-90 -2-160q-4 90-6 160z', '#6a5038'));
    var lv = new Batch();
    for (var i = 0; i < 26; i++) {
      var a = rnd() * 6.28, rr = 20 + rnd() * 60, cx = 1434 + Math.cos(a) * rr * 0.9, cy = 360 + Math.sin(a) * rr * 0.6 - 20;
      lv.poly([1434, 376, cx - 6, cy, cx + Math.cos(a) * 26, cy + Math.sin(a) * 14, cx + 6, cy + 4], i % 3 ? '#4a6248' : '#5e7a5a');
    }
    B.push(lv.out());

    /* ---- 左墙：通往卧室的门洞 ---- */
    var da = g.p(120, 180, 1.03), db = g.p(120, 600, 1.03), dc = g.p(120, 180, 1.16), dd = g.p(120, 600, 1.16);
    B.push(PG([da[0], da[1], dc[0], dc[1], dd[0], dd[1], db[0], db[1]], '#b8b8b0'));
    B.push(PG([da[0] - 6, da[1] + 8, dc[0] + 6, dc[1] + 10, dd[0] + 6, dd[1], db[0] - 6, db[1]], '#3a3e3a'));
    B.push(PG([da[0] - 6, da[1] + 8, da[0] - 26, da[1] + 6, db[0] - 26, db[1] + 2, db[0] - 6, db[1]], '#8a8e84', 'opacity=".7"'));

    /* ---- 茶几：一杯龙井 ---- */
    B.push(ctable(g, 420, 760, 513, 1.2, 1.33, { top: '#6a5242', edge: '#3a2c22', leg: '#2e241c', hi: 'rgba(255,240,220,.3)', sheen: 'rgba(255,255,245,.12)', shelf: 1 }));
    // 果盘
    B.push(EL(390, 562, 46, 10, '#d8d4c8'), '<circle cx="376" cy="552" r="12" fill="#d8803a"/><circle cx="400" cy="550" r="12" fill="#c8702e"/><circle cx="390" cy="540" r="11" fill="#e0904a"/>');
    // 报纸
    B.push(PG([630, 552, 700, 548, 708, 564, 634, 568], '#d8d2c0'), LN(642, 556, 690, 553, '#8a867a', 2), LN(642, 561, 680, 559, '#8a867a', 2));
    // 玻璃杯里的龙井：茶叶竖立
    var gx = 520, gy1 = 563;
    B.push(EL(gx, gy1, 20, 4, 'rgba(0,0,0,.3)'));
    B.push(PA('M' + (gx - 15) + ' ' + (gy1 - 56) + 'h30l-3 54h-24z', 'rgba(220,232,220,.35)'));
    B.push(PA('M' + (gx - 14) + ' ' + (gy1 - 40) + 'h28l-2 38h-24z', 'rgba(184,196,96,.6)'));
    var lf = new Batch();
    for (var k = 0; k < 7; k++) { var lx2 = gx - 10 + k * 3.4, ly = gy1 - 36 + rnd() * 20; lf.poly([lx2, ly, lx2 + 2, ly - 8, lx2 + 3, ly + 2], '#6a8a3a'); }
    B.push(lf.out(), R(gx - 15, gy1 - 57, 30, 3, 'rgba(255,255,255,.5)'), R(gx + 8, gy1 - 52, 3, 44, 'rgba(255,255,255,.4)'));
    B.push('<g class="' + P + '-steam" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"><path d="M514 502c-8-12 8-18 0-32"/><path d="M526 498c6-12-8-18 2-30"/></g>');

    /* ---- 吸顶灯 ---- */
    B.push(PG([740, 64, 900, 64, 880, 78, 760, 78], '#d8d8d0'), R(760, 78, 120, 3, 'rgba(0,0,0,.15)'));

    // 空气透视：整体轻微冷灰
    D.push(RG(P + '-dark', [[0, '#1a1e1c', 0], [0.6, '#1a1e1c', 0.1], [1, '#0a0c0b', 0.5]], 0.6, 0.4, 0.8));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-steam{animation:' + P + '-st 5s ease-in-out infinite}@keyframes ' + P + '-st{0%{opacity:0;transform:translateY(6px)}40%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.5));
  };

  /* ================================================================
   * 傅惜娣家（莘庄）：老式家具、樟木箱、缝纫机、挂钟，午后
   * ================================================================ */
  GF.art.bg.fu_home = function () {
    var P = 'bgfu', D = [], B = [], rnd = U.rng(612);
    var g = room({ bx0: 140, bx1: 1460, by0: 70, by1: 590, vx: 780, vy: 320 });
    D.push(LG(P + '-wall', [[0, '#8e8a78'], [1, '#a29c88']]));
    D.push(LG(P + '-floor', [[0, '#6a3a2c'], [1, '#3e231b']]));
    B.push(PG(g.ceil, '#9c9886'), PG(g.back, 'url(#' + P + '-wall)'), PG(g.floor, 'url(#' + P + '-floor)'));
    B.push(planks(g, 44, 'rgba(30,14,10,.55)', 1.4, rnd, 30));
    B.push(PG(g.left, '#76725f'), PG(g.right, '#7e7a68'));
    // 绿漆墙裙
    var dz = 430, dl = g.p(140, dz, 1), dlf = [0, 320 + (dz - 320) * (780 / 640)], drf = [1600, 320 + (dz - 320) * (820 / 680)];
    B.push(PG([140, dz, 1460, dz, 1460, 590, 140, 590], '#5e7a6a'), R(140, dz - 4, 1320, 5, '#3e5448'));
    B.push(PG([0, dlf[1], 140, dz, 140, 590, 0, g.lb], '#4e6658'), PG([1600, drf[1], 1460, dz, 1460, 590, 1600, g.rb], '#526a5c'));
    // 墙面污渍与剥落
    var st = new Batch();
    for (var i = 0; i < 18; i++) st.rect(160 + rnd() * 1280, 440 + rnd() * 130, 3 + rnd() * 9, 2 + rnd() * 3, 'rgba(210,214,190,.18)');
    D.push(RG(P + '-stain', [[0, '#5a4a2a', 0.12], [1, '#5a4a2a', 0]]));
    for (i = 0; i < 4; i++) st.add('url(#' + P + '-stain)', 'M' + n(200 + rnd() * 1200) + ' ' + n(90 + rnd() * 60) + 'h' + n(80 + rnd() * 80) + 'v' + n(120 + rnd() * 120) + 'h-' + n(100) + 'z');
    B.push(st.out());

    /* ---- 窗（旧木框，绿漆） ---- */
    var wx0 = 520, wx1 = 860, wy0 = 130, wy1 = 400;
    B.push('<clipPath id="' + P + '-wclip"><rect x="' + wx0 + '" y="' + wy0 + '" width="' + (wx1 - wx0) + '" height="' + (wy1 - wy0) + '"/></clipPath>');
    var W = [];
    D.push(LG(P + '-sky', [[0, '#d4d6cc'], [1, '#e8e4d4']]));
    W.push(R(wx0, wy0, wx1 - wx0, wy1 - wy0, 'url(#' + P + '-sky)'));
    // 对面的楼：灰、窗、晾衣竿
    W.push(R(wx0 + 40, wy0 + 30, 400, 300, '#b4b2a4'));
    var ow = new Batch();
    for (var yy = wy0 + 50; yy < wy1; yy += 56) for (var xx = wx0 + 60; xx < wx1; xx += 70) { ow.rect(xx, yy, 36, 30, '#8a8a80'); ow.rect(xx, yy + 30, 36, 3, '#c8c6b8'); }
    W.push(ow.out(), LN(wx0, wy0 + 110, wx1, wy0 + 104, '#6a6a60', 2));
    var cl = new Batch();
    [[560, 22, 30, '#c48a7a'], [600, 30, 24, '#8a9aaa'], [680, 18, 36, '#e0dcd0'], [740, 28, 26, '#9a8a6a']].forEach(function (c) { cl.rect(c[0], wy0 + 106, c[1], c[2], c[3]); });
    W.push(cl.out());
    B.push('<g clip-path="url(#' + P + '-wclip)">' + W.join('') + '</g>');
    var wf = new Batch(), wc = '#4a665c';
    wf.rect(wx0 - 12, wy0 - 12, wx1 - wx0 + 24, 14, wc).rect(wx0 - 12, wy0, 14, wy1 - wy0, wc).rect(wx1 - 2, wy0, 14, wy1 - wy0, wc);
    wf.rect(wx0, 186, wx1 - wx0, 10, wc).rect((wx0 + wx1) / 2 - 5, 186, 10, wy1 - 186, wc);
    wf.rect(wx0 + 84, wy0, 6, 56, wc).rect(wx0 + 170, wy0, 6, 56, wc).rect(wx0 + 256, wy0, 6, 56, wc);
    wf.rect(wx0, 290, wx1 - wx0, 6, wc);
    B.push(wf.out());
    // 掉漆斑点
    var chip = new Batch();
    for (i = 0; i < 12; i++) chip.rect(wx0 - 10 + rnd() * (wx1 - wx0 + 20), wy0 - 10 + (i % 2 ? rnd() * 12 : wy1 - wy0 + rnd() * 6), 4 + rnd() * 6, 2, '#8a9a88');
    B.push(chip.out());
    B.push(R(wx0 - 22, wy1, wx1 - wx0 + 44, 12, '#6e6a58'), R(wx0 - 18, wy1 + 12, wx1 - wx0 + 36, 5, 'rgba(0,0,0,.3)'));
    // 半截碎花布帘
    D.push('<pattern id="' + P + '-flw" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#d8ccb2"/><circle cx="6" cy="6" r="3" fill="#c07a74"/><circle cx="17" cy="16" r="2.4" fill="#7a9a82"/><circle cx="16" cy="5" r="1.2" fill="#c07a74"/></pattern>');
    B.push(LN(wx0 - 6, 290, wx1 + 6, 290, '#3a3a34', 2));
    var cur = 'M' + (wx0 - 4) + ' 292H' + (wx1 + 4) + 'V' + (wy1 - 4);
    for (var q = 0; q < 12; q++) cur += 'q-' + ((wx1 - wx0 + 8) / 24) + ' 8 -' + ((wx1 - wx0 + 8) / 12) + ' 0';
    B.push(PA(cur + 'z', 'url(#' + P + '-flw)'));
    B.push(PA('M560 292v104M620 292v104M680 292v104M740 292v104M800 292v104', 'none', 'stroke="rgba(90,60,40,.25)" stroke-width="6"'));
    // 窗台上的吊兰
    B.push(PG([560, wy1 - 26, 600, wy1 - 26, 594, wy1, 566, wy1], '#8a5a44'));
    B.push(PA('M580 374q-40 10-50 60M580 374q-20 20-24 70M580 374q30 6 44 56M580 374q10 30 6 64M580 374q-50-4-62 26M580 374q40-10 60 14', 'none', 'stroke="#5a7a4a" stroke-width="3"'));
    B.push(glow(D, P + '-wg', 690, 260, 300, 200, '#fff4dc', 0.35, 'style="mix-blend-mode:screen"'));

    /* ---- 大衣柜（椭圆镜）+ 柜顶箱子 ---- */
    var wd = '#4a261a', wdL = '#6a3a26', wdD = '#2c150e';
    B.push(R(168, 108, 110, 44, '#6a4a30'), R(172, 112, 102, 6, '#8a6a48'), R(280, 124, 150, 28, '#4a5a64'), R(290, 118, 60, 6, '#5a6a74'), R(284, 150, 150, 2, 'rgba(0,0,0,.4)'));
    B.push(R(160, 152, 290, 438, wd), R(160, 152, 290, 12, wdL), R(154, 146, 302, 10, wdL));
    B.push(R(172, 176, 80, 390, wdL, 'opacity=".35"'), R(358, 176, 80, 390, wdL, 'opacity=".35"'), LN(260, 170, 260, 580, wdD, 3), LN(350, 170, 350, 580, wdD, 3));
    D.push(LG(P + '-mir', [[0, '#b8c0bc'], [0.5, '#8a948e'], [1, '#6a726c']], 0, 0, 1, 1));
    B.push(EL(305, 360, 38, 150, wdD), EL(305, 360, 32, 144, 'url(#' + P + '-mir)'));
    B.push(PA('M290 250l14-20l-6 190l-12 30z', 'rgba(255,255,250,.35)'));
    B.push(R(246, 360, 5, 26, '#b8904a'), R(360, 360, 5, 26, '#b8904a'), R(160, 560, 290, 30, wdD));

    /* ---- 缝纫机（窗下） ---- */
    var sx = 580, sy = 470;
    B.push(R(sx - 20, sy, 280, 14, '#5a3424'), R(sx - 16, sy + 14, 272, 4, 'rgba(0,0,0,.4)'));
    B.push(PA('M' + (sx + 20) + ' ' + sy + 'v-50q0-16 16-16h120q16 0 16 16v8h-24v-4q0-6-6-6h-86q-6 0-6 6v46z', '#16140f'));
    B.push(PA('M' + (sx + 150) + ' ' + (sy - 42) + 'h24v42h-24z', '#16140f'), PA('M' + (sx + 44) + ' ' + (sy - 58) + 'h110', 'none', 'stroke="#b89448" stroke-width="2"'));
    B.push('<circle cx="' + (sx + 190) + '" cy="' + (sy - 30) + '" r="16" fill="#2a2620"/><circle cx="' + (sx + 190) + '" cy="' + (sy - 30) + '" r="5" fill="#8a7a5a"/>');
    B.push(R(sx + 70, sy - 80, 4, 18, '#8a8a80'), R(sx + 64, sy - 94, 16, 14, '#b0342a', 'rx="2"'));
    // 铸铁踏板架
    B.push(PA('M' + (sx - 10) + ' ' + (sy + 18) + 'l10 100l-14 0l-6-100zM' + (sx + 250) + ' ' + (sy + 18) + 'l-10 100h14l6-100z', '#1e1c18'));
    B.push(PA('M' + (sx) + ' ' + (sy + 70) + 'q60-20 120 0t120 0', 'none', 'stroke="#1e1c18" stroke-width="5"'), R(sx + 60, sy + 104, 130, 12, '#1e1c18'));
    // 绷架与布
    B.push(EL(sx + 110, sy - 4, 34, 7, 'none', 'stroke="#a88a5a" stroke-width="3"'), PG([sx + 70, sy - 2, sx + 150, sy - 6, sx + 160, sy + 30, sx + 80, sy + 34], '#c8b8a4', 'opacity=".9"'));

    /* ---- 挂钟 + 老照片 ---- */
    B.push(R(1024, 150, 92, 196, '#4a2a1c', 'rx="6"'), R(1030, 156, 80, 184, '#5e3624', 'rx="4"'));
    B.push('<circle cx="1070" cy="196" r="32" fill="#e4dcc6"/><circle cx="1070" cy="196" r="32" fill="none" stroke="#b8904a" stroke-width="3"/>');
    var tk = '';
    for (i = 0; i < 12; i++) { var an = i * Math.PI / 6; tk += 'M' + n(1070 + Math.cos(an) * 26) + ' ' + n(196 + Math.sin(an) * 26) + 'L' + n(1070 + Math.cos(an) * 30) + ' ' + n(196 + Math.sin(an) * 30); }
    B.push('<path d="' + tk + '" stroke="#3a2a1c" stroke-width="2"/>', LN(1070, 196, 1070, 176, '#1a1410', 3), LN(1070, 196, 1086, 204, '#1a1410', 2.4));
    B.push(R(1040, 240, 60, 92, '#2a1a12'), '<g class="' + P + '-pend">' + LN(1070, 240, 1070, 310, '#b8904a', 2) + '<circle cx="1070" cy="314" r="11" fill="#c8a050"/><circle cx="1067" cy="311" r="4" fill="#f0d898" opacity=".6"/></g>');
    B.push(R(1040, 240, 60, 92, 'rgba(200,220,210,.08)'));
    // 相框：亡夫遗像、全家福
    B.push(R(920, 180, 76, 100, '#1a1410'), R(926, 186, 64, 88, '#b8b0a0'), EL(958, 220, 16, 20, '#4a4640'), PA('M934 274q24-40 48 0z', '#3a3632'));
    B.push(R(1144, 170, 104, 80, '#6a4a30'), R(1150, 176, 92, 68, '#a89c84'));
    var fam = new Batch();
    [1166, 1186, 1206, 1226].forEach(function (x, k) { fam.circ(x, 200 + (k % 2) * 4, 7, '#5a5448'); fam.rect(x - 9, 208 + (k % 2) * 4, 18, 36 - (k % 2) * 4, '#5a5448'); });
    B.push(fam.out());

    /* ---- 樟木箱（雕花，铜锁） ---- */
    var cx0 = 920, cx1 = 1220, cy0 = 440, cy1 = 560;
    D.push(LG(P + '-chest', [[0, '#9a6a3a'], [1, '#6a4424']]));
    B.push(R(cx0 - 10, cy1, cx1 - cx0 + 20, 24, '#3a2014'), R(cx0 + 4, cy1 + 24, 20, 6, '#2a160e'), R(cx1 - 24, cy1 + 24, 20, 6, '#2a160e'));
    B.push(R(cx0, cy0, cx1 - cx0, cy1 - cy0, 'url(#' + P + '-chest)'), R(cx0 - 4, cy0 - 10, cx1 - cx0 + 8, 14, '#a8784a'), R(cx0 - 4, cy0 + 2, cx1 - cx0 + 8, 3, 'rgba(0,0,0,.35)'));
    B.push(R(cx0 + 14, cy0 + 18, 118, 86, 'none', 'stroke="#5a3a1e" stroke-width="3"'), R(cx1 - 132, cy0 + 18, 118, 86, 'none', 'stroke="#5a3a1e" stroke-width="3"'));
    var carve = '';
    [cx0 + 73, cx1 - 73].forEach(function (c) {
      carve += 'M' + (c - 40) + ' ' + (cy0 + 62) + 'q20-30 40 0t40 0M' + (c - 30) + ' ' + (cy0 + 80) + 'q15-18 30 0t30 0M' + c + ' ' + (cy0 + 30) + 'q-12 16 0 32q12-16 0-32';
    });
    B.push('<path d="' + carve + '" stroke="#4a2c14" stroke-width="2.4" fill="none"/>');
    B.push(R(1052, cy0 + 4, 36, 44, '#c09a4a', 'rx="4"'), R(1064, cy0 + 30, 12, 20, '#8a6a2a', 'rx="2"'), R(1054, cy0 + 6, 32, 5, '#f0d090', 'opacity=".5"'));
    // 箱上：钩花台布、热水瓶、茶盘
    var dly = 'M' + (cx0 + 20) + ' ' + (cy0 - 10) + 'h200v8';
    for (q = 0; q < 10; q++) dly += 'q-10 10 -20 0';
    B.push(PA(dly + 'z', '#e6e2d4'));
    D.push(LG(P + '-flask', [[0, '#8a2a22'], [0.35, '#d0584a'], [0.7, '#b2402e'], [1, '#6a1e16']], 0, 0, 1, 0));
    B.push(R(962, 346, 50, 86, 'url(#' + P + '-flask)', 'rx="10"'), R(970, 332, 34, 18, '#c8c4b4', 'rx="4"'), R(980, 324, 14, 10, '#8a6a4a'));
    B.push('<g fill="#f0d4c8" opacity=".85"><circle cx="978" cy="382" r="5"/><circle cx="992" cy="396" r="4"/><circle cx="984" cy="410" r="5"/></g>', R(962, 360, 50, 3, '#e8c890'), R(962, 418, 50, 3, '#e8c890'));
    B.push(EL(1120, 428, 60, 6, '#3a2418'), R(1086, 408, 18, 18, '#e8e4d8', 'rx="3"'), R(1116, 410, 18, 16, '#e8e4d8', 'rx="3"'), R(1146, 400, 26, 26, '#6a7a6a', 'rx="3"'));

    /* ---- 吊灯：搪瓷灯罩 + 灯泡 ---- */
    B.push(LN(780, 30, 780, 186, '#2a2620', 2));
    B.push(PA('M752 206q28-28 56 0z', '#e8e6dc'), PA('M752 206h56', 'none', 'stroke="#3a4a54" stroke-width="3"'), '<circle cx="780" cy="210" r="7" fill="#fff0c8"/>');
    B.push('<g class="' + P + '-bulb">' + glow(D, P + '-bg', 780, 250, 380, 260, '#f0c070', 0.3, 'style="mix-blend-mode:screen"') + glow(D, P + '-bg2', 780, 212, 40, 30, '#fff4d0', 0.8) + '</g>');
    B.push(PG([756, 208, 804, 208, 900, 560, 660, 560], 'rgba(255,220,150,.05)'));

    /* ---- 右：藤椅 ---- */
    var rc = '#8a6a44', rcD = '#5a4228';
    B.push(PA('M1290 560v-120q0-50 70-50t70 50v120z', rc), PA('M1306 540v-100q0-36 54-36t54 36v100z', rcD, 'opacity=".5"'));
    var weave = '';
    for (i = 0; i < 8; i++) weave += 'M1300 ' + (420 + i * 16) + 'h120';
    B.push('<path d="' + weave + '" stroke="' + rcD + '" stroke-width="1.5" opacity=".6"/>', R(1276, 540, 170, 24, rc, 'rx="8"'), R(1286, 564, 12, 60, rcD), R(1424, 564, 12, 60, rcD));
    B.push(R(1300, 520, 124, 22, '#7a4a44', 'rx="6"'));

    /* ---- 茶几 + 鸳鸯锦帕（垂下一角，正面可见） ---- */
    B.push(ctable(g, 720, 1020, 506, 1.2, 1.32, { top: '#6a3e28', edge: '#3a2016', leg: '#2e180e', hi: 'rgba(255,220,180,.25)' }));
    var hx = 893, ty = 566;
    // 锦帕斜铺，一角从桌沿垂下
    B.push(PG([hx, 545, hx + 92, 553, hx + 53, ty, hx - 53, ty, hx - 92, 555], '#efe8dc'));
    B.push(PA('M' + (hx - 53) + ' ' + ty + 'H' + (hx + 53) + 'L' + (hx + 2) + ' ' + (ty + 62) + 'z', '#f4eee2'));
    B.push(PA('M' + (hx - 44) + ' ' + (ty + 3) + 'H' + (hx + 44) + 'L' + (hx + 2) + ' ' + (ty + 53) + 'z', 'none', 'stroke="#c8606a" stroke-width="2"'));
    B.push(PA('M' + (hx - 60) + ' ' + ty + 'H' + (hx + 60), 'none', 'stroke="rgba(0,0,0,.25)" stroke-width="2"'), '<circle cx="' + (hx + 2) + '" cy="' + (ty + 64) + '" r="3" fill="#c8606a"/>', LN(hx + 2, ty + 66, hx + 2, ty + 76, '#c8606a', 2));
    // 一对鸳鸯
    B.push(PA('M' + (hx - 26) + ' ' + (ty + 20) + 'q12-12 26 0q-12 7-26 0z', '#d06a3a'), '<circle cx="' + (hx - 2) + '" cy="' + (ty + 12) + '" r="5" fill="#3a7a6a"/>', PA('M' + (hx + 2) + ' ' + (ty + 12) + 'l7 2l-7 2z', '#d8a040'));
    B.push(PA('M' + (hx + 2) + ' ' + (ty + 26) + 'q12-12 24 0q-12 7-24 0z', '#8a6a4a'), '<circle cx="' + (hx + 25) + '" cy="' + (ty + 18) + '" r="4" fill="#8a7a5a"/>');
    B.push(PA('M' + (hx - 20) + ' ' + (ty + 34) + 'q6-3 12 0t12 0t12 0', 'none', 'stroke="#6aa0b0" stroke-width="1.6"'), PA('M' + (hx - 60) + ' ' + (ty - 6) + 'q8-8 14 0M' + (hx + 50) + ' ' + (ty - 6) + 'q8-8 14 0', 'none', 'stroke="#c85a6a" stroke-width="2"'));
    B.push(glow(D, P + '-hg', hx, ty + 10, 120, 60, '#fff0d8', 0.3, 'style="mix-blend-mode:screen"'));

    // 窗光：斜落在缝纫机与地板上
    D.push(LG(P + '-shaft', [[0, '#fff2d0', 0.2], [1, '#fff2d0', 0]]));
    B.push(PG([530, 190, 850, 190, 980, 760, 400, 760], 'url(#' + P + '-shaft)', 'style="mix-blend-mode:screen"'));
    B.push(PG([520, 598, 860, 598, 940, 760, 420, 760], 'rgba(255,240,210,.1)'));
    D.push(RG(P + '-dark', [[0, '#1a140e', 0], [0.55, '#1a140e', 0.18], [1, '#0a0806', 0.62]], 0.5, 0.38, 0.8));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-pend{transform-origin:1070px 240px;animation:' + P + '-sw 2s ease-in-out infinite alternate}@keyframes ' + P + '-sw{from{transform:rotate(-7deg)}to{transform:rotate(7deg)}}' +
      '.' + P + '-bulb{animation:' + P + '-bb 6s ease-in-out infinite}@keyframes ' + P + '-bb{0%,100%{opacity:.85}50%{opacity:1}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.6));
  };

  /* ================================================================
   * 钟书同家：学者客厅，满墙书架，树影，台灯，傍晚前
   * ================================================================ */
  GF.art.bg.zhong_home = function () {
    var P = 'bgzh', D = [], B = [], rnd = U.rng(613);
    var g = room({ bx0: 230, bx1: 1470, by0: 60, by1: 590, vx: 860, vy: 330 });
    D.push(LG(P + '-wall', [[0, '#3e443e'], [1, '#4c524a']]));
    D.push(LG(P + '-floor', [[0, '#4a3628'], [1, '#2a1e16']]));
    B.push(PG(g.ceil, '#2e322e'), PG(g.back, 'url(#' + P + '-wall)'), PG(g.floor, 'url(#' + P + '-floor)'));
    B.push(planks(g, 40, 'rgba(20,12,8,.5)', 1.3, rnd, 34));
    B.push(PG(g.left, '#343a34'), PG(g.right, '#2e332e'));

    /* ---- 左墙的窗：树 ---- */
    var a = g.p(230, 110, 1.04), b = g.p(230, 450, 1.04), c = g.p(230, 110, 1.3), d = g.p(230, 450, 1.3);
    var wpts = [a[0], a[1], c[0], c[1], d[0], d[1], b[0], b[1]];
    B.push('<clipPath id="' + P + '-wclip"><polygon points="' + wpts.map(n).join(' ') + '"/></clipPath>');
    D.push(LG(P + '-wsky', [[0, '#e8e0c0'], [1, '#c8c8a8']]));
    D.push(blurF(P + '-tb', 1.5));
    var tr = new Batch();
    for (var i = 0; i < 70; i++) tr.circ(20 + rnd() * 200, 60 + rnd() * 380, 8 + rnd() * 20, pick(rnd, ['#4a6040', '#5a7248', '#3a4e34', '#7a8a52', '#98a060']));
    B.push('<g clip-path="url(#' + P + '-wclip)">' + PG(wpts, 'url(#' + P + '-wsky)') + '<g filter="url(#' + P + '-tb)">' + tr.out() + '</g>' + '<g class="' + P + '-sway">' + EL(120, 200, 60, 40, '#e8d8a0', 'opacity=".5"') + EL(80, 330, 40, 30, '#e8d8a0', 'opacity=".4"') + '</g></g>');
    var m1 = g.p(230, 110, 1.17), m2 = g.p(230, 450, 1.17), h1 = g.p(230, 270, 1.04), h2 = g.p(230, 270, 1.3);
    B.push('<polygon points="' + wpts.map(n).join(' ') + '" fill="none" stroke="#c8c0a8" stroke-width="10"/>', LN(m1[0], m1[1], m2[0], m2[1], '#c8c0a8', 8), LN(h1[0], h1[1], h2[0], h2[1], '#c8c0a8', 6));
    var sl1 = g.p(230, 456, 1.02), sl2 = g.p(230, 456, 1.34);
    B.push(PG([sl1[0], sl1[1], sl2[0], sl2[1], sl2[0], sl2[1] + 14, sl1[0], sl1[1] + 10], '#a89c80'));
    // 窗帘（深绿丝绒，拢在一侧）
    var cu1 = g.p(230, 90, 1.33), cu2 = g.p(230, 590, 1.33);
    B.push(PG([cu1[0] + 26, cu1[1] + 6, cu1[0] - 20, cu1[1], cu2[0] - 24, cu2[1], cu2[0] + 30, cu2[1] - 4], '#2a3a30'));

    /* ---- 满墙书架 ---- */
    var pal = ['#5a3a2a', '#3a4a3a', '#6a5a3a', '#2e3a4a', '#7a6a4a', '#4a3a3a', '#8a7a5a', '#3a3028', '#6a4a36', '#a89a78'];
    function bookcase(x0, x1, y0, y1, rows, seed) {
      var r2 = U.rng(seed), bt = new Batch(), s = '', h = (y1 - y0 - 16) / rows;
      s += R(x0 - 10, y0 - 12, x1 - x0 + 20, y1 - y0 + 12, '#2a1c14');
      s += R(x0, y0, x1 - x0, y1 - y0 - 10, '#140e0a');
      for (var r = 0; r < rows; r++) {
        var base = y0 + (r + 1) * h;
        if (r2() < 0.28) { // 蓝布函套的线装书
          var fx = x0 + 6 + r2() * (x1 - x0 - 140), k = 2 + Math.floor(r2() * 3);
          shelfBooks(bt, r2, x0, base, fx - x0, h - 10, pal);
          for (var j = 0; j < k; j++) { bt.rect(fx + j * 44, base - 30, 42, 30, '#2a3a5a'); bt.rect(fx + j * 44 + 26, base - 26, 8, 20, '#d8d0bc'); }
          shelfBooks(bt, r2, fx + k * 44 + 4, base, x1 - fx - k * 44 - 4, h - 10, pal);
        } else shelfBooks(bt, r2, x0, base, x1 - x0, h - 10, pal, { gap: 0.03 });
        bt.rect(x0, base, x1 - x0, 7, '#3a281c');
        bt.rect(x0, base - h + 7, x1 - x0, 10, 'rgba(0,0,0,.35)');
      }
      bt.rect(x0 + (x1 - x0) / 2 - 4, y0, 8, y1 - y0 - 10, '#2a1c14');
      return s + bt.out();
    }
    B.push(bookcase(250, 690, 84, 590, 6, 71), bookcase(1040, 1450, 84, 590, 6, 72));

    /* ---- 中间：横幅字画 ---- */
    B.push(R(724, 150, 290, 110, '#8a7a5a'), R(736, 160, 266, 90, '#e2d8c0'));
    B.push('<text x="869" y="222" font-family="Songti SC, STSong, SimSun, serif" font-size="46" fill="#2a2420" text-anchor="middle" letter-spacing="10">宁静致远</text>');
    B.push(R(980, 166, 12, 12, '#b0402c'), R(980, 182, 12, 12, '#b0402c', 'opacity=".8"'));

    /* ---- 午后斜阳：从左窗投到后墙，带树影 ---- */
    var lp = [300, 120, 640, 180, 700, 540, 360, 560];
    B.push('<clipPath id="' + P + '-lclip"><polygon points="' + lp.join(' ') + '"/></clipPath>');
    D.push(LG(P + '-sun', [[0, '#ffd890', 0.5], [1, '#f0b060', 0.28]], 0, 0, 1, 1));
    var lv = new Batch();
    for (i = 0; i < 70; i++) { var ex = 290 + rnd() * 420, ey = 110 + rnd() * 460, er = 5 + rnd() * 16; lv.add('#ffe2a0', 'M' + n(ex - er) + ' ' + n(ey) + 'a' + n(er) + ' ' + n(er * 0.6) + ' 0 1 0 ' + n(2 * er) + ' 0a' + n(er) + ' ' + n(er * 0.6) + ' 0 1 0 ' + n(-2 * er) + ' 0z'); }
    D.push(blurF(P + '-soft', 2.5));
    B.push('<g clip-path="url(#' + P + '-lclip)" style="mix-blend-mode:screen">' + PG(lp, 'url(#' + P + '-sun)', 'opacity=".45"') +
      '<g class="' + P + '-sway" filter="url(#' + P + '-soft)" opacity=".55">' + lv.out() + '</g></g>');
    // 窗棂影
    B.push('<g clip-path="url(#' + P + '-lclip)">' + PG([470, 140, 480, 141, 536, 560, 526, 560], 'rgba(0,0,0,.25)') + '</g>');
    // 体积光
    D.push(LG(P + '-beam', [[0, '#ffe0a0', 0.18], [1, '#ffe0a0', 0]], 0, 0, 1, 0));
    B.push(PG([130, 110, 300, 120, 360, 560, 110, 470], 'url(#' + P + '-beam)', 'style="mix-blend-mode:screen"'));

    /* ---- 旧皮沙发 ---- */
    var sf = '#4a2e20', sfL = '#6a4430', sfD = '#2a1a12';
    B.push(R(708, 420, 320, 96, sf, 'rx="16"'), R(714, 424, 308, 8, sfL, 'rx="4"'), LN(868, 432, 868, 510, sfD, 2));
    B.push(R(690, 460, 48, 118, sf, 'rx="14"'), R(1000, 460, 48, 118, sf, 'rx="14"'));
    B.push(R(734, 508, 270, 18, sfL, 'rx="6"'), R(734, 524, 270, 50, sf), LN(868, 508, 868, 574, sfD, 2), R(726, 574, 286, 12, sfD));
    var crk = '';
    for (i = 0; i < 10; i++) { var cx = 720 + rnd() * 290, cy = 430 + rnd() * 70; crk += 'M' + n(cx) + ' ' + n(cy) + 'l' + n(rnd() * 16 - 8) + ' ' + n(rnd() * 10); }
    B.push('<path d="' + crk + '" stroke="rgba(200,160,120,.25)" stroke-width="1.5"/>', PA('M760 470q40-12 80 2l-2 34q-40 4-76-2z', '#6a5a44'));

    /* ---- 边几与台灯 ---- */
    var lx = 1078;
    B.push(R(1044, 500, 70, 8, '#3a281c'), R(1050, 508, 58, 90, '#2a1c14'));
    B.push(PA('M' + (lx - 18) + ' 500h36l-6-12h-24z', '#6a5a3a'), R(lx - 2, 432, 4, 58, '#8a7a50'));
    D.push(LG(P + '-shade', [[0, '#f8dca0'], [1, '#d89048']]));
    B.push(PG([lx - 26, 380, lx + 26, 380, lx + 40, 436, lx - 40, 436], 'url(#' + P + '-shade)'));
    B.push('<g class="' + P + '-lamp">' + glow(D, P + '-lg', lx, 420, 380, 300, '#f0a850', 0.38, 'style="mix-blend-mode:screen"') + glow(D, P + '-lc', lx, 414, 80, 60, '#ffe0a0', 0.55, 'style="mix-blend-mode:screen"') + '</g>');
    D.push(LG(P + '-coneU', [[0, '#ffc478', 0], [1, '#ffc478', 0.14]]));
    B.push(PA('M' + (lx - 26) + ' 380L' + (lx - 110) + ' 60H' + (lx + 110) + 'L' + (lx + 26) + ' 380z', 'url(#' + P + '-coneU)'));

    /* ---- 茶几：烟灰缸、盖碗、照片 ---- */
    B.push(ctable(g, 740, 1000, 506, 1.2, 1.32, { top: '#4a3020', edge: '#24160e', leg: '#1e120a', hi: 'rgba(255,210,150,.25)' }));
    var ph = new Batch();
    [[790, 548, 0.1], [826, 552, -0.2], [860, 546, 0.3]].forEach(function (p) { var c2 = Math.cos(p[2]), s2 = Math.sin(p[2]); ph.poly([p[0], p[1], p[0] + 40 * c2, p[1] + 40 * s2 * 0.3, p[0] + 40 * c2 - 10 * s2, p[1] + 12, p[0] - 10 * s2, p[1] + 12 - 40 * s2 * 0.1], '#e0dccc'); });
    B.push(ph.out(), R(794, 551, 30, 6, '#5a5a52'), R(830, 555, 30, 6, '#4a4a44'));
    B.push(EL(960, 552, 26, 8, '#8a9a9a'), EL(960, 550, 20, 5, '#3a3a36'), R(952, 546, 22, 3, '#e8e4d8', 'transform="rotate(-12 952 546)"'), '<circle cx="973" cy="542" r="2" fill="#ff8a3a"/>');
    B.push('<path class="' + P + '-smoke" d="M973 540c-10-20 14-30 0-50s10-30-4-50" stroke="rgba(210,210,200,.35)" stroke-width="3" fill="none"/>');
    B.push(EL(1030, 552, 16, 5, '#e8e2d2'), PA('M1016 552q2-16 14-16t14 16z', '#e8e2d2'), EL(1030, 536, 12, 3, '#d8d2c2'));
    // 地上的书堆
    var st = new Batch();
    [[696, 588, 5], [1120, 594, 6], [640, 592, 3]].forEach(function (s0) { var yy = s0[1]; for (var j = 0; j < s0[2]; j++) { var th = 8 + rnd() * 6; st.rect(s0[0] + rnd() * 8 - 4, yy - th, 56 + rnd() * 12, th - 1, pick(rnd, pal)); yy -= th; } });
    B.push(st.out());

    D.push(RG(P + '-dark', [[0, '#141810', 0], [0.55, '#141810', 0.2], [1, '#060805', 0.68]], 0.55, 0.4, 0.8));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-sway{animation:' + P + '-sw 7s ease-in-out infinite alternate}@keyframes ' + P + '-sw{to{transform:translate(8px,4px)}}' +
      '.' + P + '-lamp{animation:' + P + '-br 8s ease-in-out infinite}@keyframes ' + P + '-br{0%,100%{opacity:.9}50%{opacity:1}}' +
      '.' + P + '-smoke{animation:' + P + '-sm 6s ease-in-out infinite;transform-origin:973px 540px}@keyframes ' + P + '-sm{0%{opacity:.2;transform:scaleX(1)}50%{opacity:.8;transform:scaleX(-1) translateY(-6px)}100%{opacity:.2;transform:scaleX(1)}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.65));
  };

  /* ================================================================
   * 欧明德的心理诊所：石库门二楼，一圈皮沙发，几盏暖黄的灯
   * ================================================================ */
  GF.art.bg.clinic = function () {
    var P = 'bgcl', D = [], B = [], rnd = U.rng(625);
    var g = room({ bx0: 170, bx1: 1430, by0: 50, by1: 580, vx: 800, vy: 320 });
    D.push(LG(P + '-wall', [[0, '#3a2e24'], [1, '#4a3c2e']]));
    D.push(LG(P + '-floor', [[0, '#3a2618'], [1, '#1e140c']]));
    B.push(PG(g.ceil, '#1e1712'), PG(g.back, 'url(#' + P + '-wall)'), PG(g.floor, 'url(#' + P + '-floor)'));
    B.push(planks(g, 38, 'rgba(10,6,4,.5)', 1.2, rnd, 30));
    B.push(PG(g.left, '#2c231b'), PG(g.right, '#30261d'));
    // 护墙板
    var wb = new Batch();
    wb.rect(170, 440, 1260, 140, '#2e1e14');
    for (var x = 186; x < 1420; x += 84) wb.rect(x, 456, 70, 108, '#3a281a');
    wb.rect(170, 436, 1260, 8, '#4a3222');
    B.push(wb.out());
    var lwt = g.p(170, 440, 1.0), lwt2 = [0, 320 + 120 * (800 / 630)];
    B.push(PG([0, lwt2[1], 170, 440, 170, 580, 0, g.lb], '#24180f'), PG([1600, lwt2[1], 1430, 440, 1430, 580, 1600, g.rb], '#24180f'));
    // 顶上的木梁
    B.push(R(170, 50, 1260, 18, '#140e0a'), PG([0, 0, 1600, 0, 1600, 14, 0, 14], '#120c08'));

    /* ---- 两扇石库门木窗 ---- */
    function win(x0, x1, y0, y1, pfx) {
      var s = '', W = '';
      s += '<clipPath id="' + pfx + '"><rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '"/></clipPath>';
      W += R(x0, y0, x1 - x0, y1 - y0, '#a8aca6');
      // 对面石库门屋顶与老虎窗
      W += PG([x0 - 20, y0 + 200, x0 + 60, y0 + 140, x1 + 20, y0 + 150, x1 + 20, y1, x0 - 20, y1], '#4a4a48');
      var tl = new Batch();
      for (var yy = y0 + 150; yy < y1; yy += 10) tl.rect(x0 - 20, yy, x1 - x0 + 40, 2, '#3a3a38');
      W += tl.out();
      W += PG([x0 + 90, y0 + 150, x0 + 120, y0 + 118, x0 + 150, y0 + 150, x0 + 150, y0 + 190, x0 + 90, y0 + 190], '#6a6660') + R(x0 + 104, y0 + 150, 32, 30, '#2a2a28');
      W += R(x0, y0 + 80, x1 - x0, 60, '#8e928c');
      W += LN(x0, y0 + 60, x1, y0 + 70, '#3a3a38', 1.5);
      s += '<g clip-path="url(#' + pfx + ')">' + W + '</g>';
      var fb = new Batch(), fc = '#3a1e14';
      fb.rect(x0 - 10, y0 - 10, x1 - x0 + 20, 12, fc).rect(x0 - 10, y0, 12, y1 - y0, fc).rect(x1 - 2, y0, 12, y1 - y0, fc);
      fb.rect(x0, y0 + 70, x1 - x0, 10, fc).rect((x0 + x1) / 2 - 5, y0 + 70, 10, y1 - y0 - 70, fc);
      for (var gx = x0 + 18; gx < x1; gx += 18) fb.rect(gx, y0, 3, 70, fc);
      fb.rect(x0, y0 + 34, x1 - x0, 3, fc);
      for (var k = 1; k < 4; k++) fb.rect(x0, y0 + 80 + k * (y1 - y0 - 80) / 4, x1 - x0, 5, fc);
      fb.rect(x0 + (x1 - x0) / 4, y0 + 80, 4, y1 - y0 - 80, fc).rect(x0 + 3 * (x1 - x0) / 4, y0 + 80, 4, y1 - y0 - 80, fc);
      s += fb.out() + R(x0 - 20, y1, x1 - x0 + 40, 12, '#4a2c1c');
      // 厚丝绒窗帘拢起
      s += PA('M' + (x0 - 50) + ' ' + (y0 - 24) + 'h70q-10 170 10 250q-30 30-20 256h-60z', '#5a1e1a');
      s += PA('M' + (x1 + 50) + ' ' + (y0 - 24) + 'h-70q10 170-10 250q30 30 20 256h60z', '#5a1e1a');
      s += PA('M' + (x0 - 36) + ' ' + (y0 - 24) + 'h10q-6 170 8 250q-20 30-12 256h-10zM' + (x1 + 30) + ' ' + (y0 - 24) + 'h-10q6 170-8 250q20 30 12 256h10z', 'rgba(0,0,0,.3)');
      s += R(x0 - 64, y0 - 30, x1 - x0 + 128, 7, '#2a1a10');
      return s;
    }
    B.push(win(250, 450, 100, 440, P + '-w1'), win(1150, 1350, 100, 440, P + '-w2'));
    B.push(glow(D, P + '-wg1', 350, 280, 180, 220, '#c8d0d0', 0.2, 'style="mix-blend-mode:screen"'), glow(D, P + '-wg2', 1250, 280, 180, 220, '#c8d0d0', 0.2, 'style="mix-blend-mode:screen"'));

    /* ---- 中间：玻璃门书柜 + 大脑模型 + 证书 ---- */
    var bx0 = 590, bx1 = 1010;
    B.push(R(bx0 - 10, 96, bx1 - bx0 + 20, 344, '#2a1810'), R(bx0, 110, bx1 - bx0, 320, '#120a06'));
    var bt = new Batch(), pal = ['#5a2a22', '#3a3a2a', '#2a3440', '#6a5a3a', '#4a2a2a', '#7a6a4a', '#3a2a34'];
    [180, 260, 340, 420].forEach(function (y, r) {
      if (r === 1) { shelfBooks(bt, rnd, bx0, y, 250, 66, pal); }
      else shelfBooks(bt, rnd, bx0, y, bx1 - bx0, 66, pal);
      bt.rect(bx0, y, bx1 - bx0, 6, '#3a2418');
    });
    B.push(bt.out());
    // 大脑模型
    B.push(R(890, 250, 60, 10, '#2a2420'), PA('M872 250q-6-40 30-48q30-8 50 14q14 18 0 34z', '#c8a8a0'), PA('M880 230q14-8 24 2t22-4M884 242q16-6 30 0t28-2M900 210q6 10 0 20', 'none', 'stroke="#8a6a64" stroke-width="2"'));
    B.push(R(bx0, 110, bx1 - bx0, 320, 'rgba(180,200,210,.06)'), PA('M' + (bx0 + 20) + ' 110l40 0l-80 320l-40 0z', 'rgba(255,255,255,.05)'), R((bx0 + bx1) / 2 - 3, 110, 6, 320, '#2a1810'));
    // 证书
    [[512, 120], [1024, 120]].forEach(function (c) {
      B.push(R(c[0], c[1], 60, 80, '#1e120a'), R(c[0] + 5, c[1] + 5, 50, 70, '#d8ceb4'), LN(c[0] + 12, c[1] + 22, c[0] + 48, c[1] + 22, '#6a5a44', 2), LN(c[0] + 14, c[1] + 32, c[0] + 44, c[1] + 32, '#8a7a64', 1.5), '<circle cx="' + (c[0] + 30) + '" cy="' + (c[1] + 58) + '" r="6" fill="#a8402c"/>');
    });

    /* ---- 暖黄的灯（落地灯×2 + 吊灯） ---- */
    D.push(LG(P + '-shade', [[0, '#ffe0a0'], [1, '#e89848']]));
    D.push(LG(P + '-coneU', [[0, '#ffc070', 0], [1, '#ffc070', 0.18]]));
    function floorLamp(x, top, bottom, id) {
      var s = R(x - 2, top + 52, 4, bottom - top - 52, '#2a1e14') + PA('M' + (x - 22) + ' ' + bottom + 'h44l-8-8h-28z', '#2a1e14');
      s += PA('M' + (x - 30) + ' ' + top + 'L' + (x - 130) + ' 14H' + (x + 130) + 'L' + (x + 30) + ' ' + top + 'z', 'url(#' + P + '-coneU)');
      s += PG([x - 30, top, x + 30, top, x + 44, top + 56, x - 44, top + 56], 'url(#' + P + '-shade)');
      s += '<g class="' + P + '-lamp">' + glow(D, id, x, top + 40, 420, 340, '#f0a040', 0.42, 'style="mix-blend-mode:screen"') + glow(D, id + 'c', x, top + 34, 90, 70, '#ffe4a8', 0.6, 'style="mix-blend-mode:screen"') + '</g>';
      return s;
    }
    B.push(floorLamp(520, 250, 600, P + '-l1'), floorLamp(1085, 250, 600, P + '-l2'));
    B.push(LN(800, 14, 800, 120, '#1a120c', 2), PA('M770 146q30-40 60 0z', '#6a3a1a'), glow(D, P + '-pd', 800, 150, 240, 160, '#f0b050', 0.3, 'style="mix-blend-mode:screen"'), EL(800, 146, 30, 5, '#ffe0a0'));

    /* ---- 一圈皮沙发 ---- */
    var lc = '#5a221a', lcL = '#7a3426', lcD = '#34120e';
    function tufts(x0, x1, y0, y1, c) { var t = new Batch(); for (var yy = y0; yy < y1; yy += 22) for (var xx = x0 + ((yy - y0) / 22 % 2) * 14; xx < x1; xx += 28) t.circ(xx, yy, 2.4, c); return t.out(); }
    // 背后的长沙发
    B.push(R(560, 440, 480, 84, lc, 'rx="14"'), tufts(580, 1024, 456, 516, lcD), R(566, 444, 468, 7, lcL, 'rx="3"'));
    B.push(R(540, 470, 56, 110, lc, 'rx="22"'), R(1004, 470, 56, 110, lc, 'rx="22"'), R(546, 474, 44, 8, lcL, 'rx="4"'), R(1010, 474, 44, 8, lcL, 'rx="4"'));
    B.push(R(590, 518, 420, 18, lcL, 'rx="6"'), R(590, 534, 420, 44, lc), R(580, 578, 440, 10, lcD));
    // 左右扶手椅（侧向）
    function armchair(x, flip) {
      var s = '', m = flip ? -1 : 1, bx = x;
      s += PA('M' + bx + ' 600v-150q0-30 ' + (m * 30) + '-30h' + (m * 150) + 'q' + (m * 30) + ' 0 ' + (m * 30) + ' 30v150z', lc);
      s += tufts(Math.min(bx + m * 20, bx + m * 190), Math.max(bx + m * 20, bx + m * 190), 440, 520, lcD);
      s += R(Math.min(bx - m * 20, bx + m * 60), 500, 80, 120, lc, 'rx="26"') + R(Math.min(bx + m * 150, bx + m * 230), 500, 80, 120, lc, 'rx="26"');
      s += R(Math.min(bx + m * 40, bx + m * 190), 560, 150, 20, lcL, 'rx="6"') + R(Math.min(bx + m * 40, bx + m * 190), 578, 150, 40, lc);
      s += R(Math.min(bx - m * 14, bx + m * 54), 504, 66, 8, lcL, 'rx="4"') + R(Math.min(bx + m * 156, bx + m * 224), 504, 66, 8, lcL, 'rx="4"');
      return s;
    }
    B.push(armchair(150, false), armchair(1450, true));
    // 窗外冷光在皮面上的反光
    B.push(PA('M1180 446q40-14 90-10', 'none', 'stroke="rgba(200,210,220,.25)" stroke-width="3"'), PA('M330 446q-40-14-90-10', 'none', 'stroke="rgba(200,210,220,.25)" stroke-width="3"'));

    /* ---- 波斯地毯 ---- */
    var r0 = g.p(420, 580, 1.08), r1 = g.p(1180, 580, 1.08), r2 = g.p(1180, 580, 1.9), r3 = g.p(420, 580, 1.9);
    B.push(PG([r0[0], r0[1], r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]], '#4a1a18'));
    var i0 = g.p(450, 580, 1.12), i1 = g.p(1150, 580, 1.12), i2 = g.p(1150, 580, 1.8), i3 = g.p(450, 580, 1.8);
    B.push(PG([i0[0], i0[1], i1[0], i1[1], i2[0], i2[1], i3[0], i3[1]], 'none', 'stroke="#b88a4a" stroke-width="3"'));
    var i4 = g.p(480, 580, 1.16), i5 = g.p(1120, 580, 1.16), i6 = g.p(1120, 580, 1.72), i7 = g.p(480, 580, 1.72);
    B.push(PG([i4[0], i4[1], i5[0], i5[1], i6[0], i6[1], i7[0], i7[1]], '#2a1c24'));
    var rm = new Batch();
    for (var k = 0; k < 18; k++) { var tt = k / 18, a = g.p(480 + 640 * tt, 580, 1.16); rm.poly([a[0], a[1] + 2, a[0] + 8, a[1] + 6, a[0], a[1] + 10, a[0] - 8, a[1] + 6], '#c89a52'); }
    B.push(rm.out(), EL(800, 720, 150, 40, '#5a2220'), EL(800, 720, 80, 20, '#8a6a3a', 'opacity=".6"'));

    /* ---- 茶几：水杯 + 节拍器（催眠暗示） ---- */
    var t0 = g.p(680, 510, 1.28);
    B.push(ctable(g, 680, 920, 510, 1.28, 1.4, { top: '#3a2416', edge: '#1a0e08', leg: '#140a06', hi: 'rgba(255,200,130,.3)' }));
    var mx = 820, my = t0[1] + 8;
    B.push(PG([mx - 20, my, mx + 20, my, mx + 8, my - 66, mx - 8, my - 66], '#3a2214'), PG([mx - 14, my - 8, mx + 14, my - 8, mx + 5, my - 54, mx - 5, my - 54], '#d8c8a0', 'opacity=".25"'));
    B.push('<g class="' + P + '-met">' + LN(mx, my - 6, mx, my - 70, '#c8b080', 2) + R(mx - 5, my - 52, 10, 8, '#c8b080') + '</g>');
    B.push(PA('M' + (mx - 64) + ' ' + (my - 34) + 'h18l-2 32h-14z', 'rgba(210,225,230,.4)'), R(mx - 63, my - 20, 16, 18, 'rgba(200,220,230,.3)'));

    /* ---- 橡皮树 ---- */
    B.push(PG([1470, 560, 1530, 560, 1522, 620, 1478, 620], '#3a2a20'));
    var lv = new Batch();
    for (var j = 0; j < 14; j++) {
      var ly = 250 + j * 22, sd = j % 2 ? 1 : -1, ang = sd * (30 + rnd() * 30);
      lv.add(j % 3 ? '#1e2a1a' : '#2a3a24', 'M1500 ' + ly + 'q' + (sd * 20) + ' -22 ' + (sd * 48) + ' -10q' + (-sd * 10) + ' 22 ' + (-sd * 48) + ' 10z');
    }
    B.push(LN(1500, 560, 1500, 236, '#2a2018', 4), lv.out(), PA('M1500 236q-10-20 4-34q10 18-4 34z', '#2a3a24'));

    D.push(RG(P + '-dark', [[0, '#140c06', 0], [0.55, '#140c06', 0.22], [1, '#050302', 0.72]], 0.5, 0.38, 0.8));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-lamp{animation:' + P + '-br 7s ease-in-out infinite}@keyframes ' + P + '-br{0%,100%{opacity:.86}50%{opacity:1}}' +
      '.' + P + '-met{transform-origin:' + mx + 'px ' + (my - 6) + 'px;animation:' + P + '-mt 1.6s ease-in-out infinite alternate}@keyframes ' + P + '-mt{from{transform:rotate(-18deg)}to{transform:rotate(18deg)}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.65));
  };

  /* ================================================================
   * 尾声：那多家的书橱，青铜酒壶与两只耳杯，午后阳光
   * ================================================================ */
  GF.art.bg.nado_study = function () {
    var P = 'bgns', D = [], B = [], rnd = U.rng(710);
    B.push(R(0, 0, 1600, 900, '#2a2a26'));
    // 右侧墙面与纱帘（阳光来处）
    D.push(LG(P + '-rw', [[0, '#8a8674'], [1, '#c8bc98']], 0, 0, 1, 0));
    B.push(R(1340, 0, 260, 900, 'url(#' + P + '-rw)'), PA('M1500 0h100v900h-120q30-300 0-600t20-300z', 'rgba(255,248,225,.55)'));
    B.push(PA('M1520 0v900M1550 0v900M1575 0v900', 'none', 'stroke="rgba(255,255,240,.35)" stroke-width="6"'));
    // 书橱
    var wood = '#3a2618', woodL = '#5a3c26', woodD = '#20140c';
    B.push(R(40, 20, 1300, 880, wood), R(28, 14, 1324, 26, woodL), R(28, 40, 1324, 8, woodD));
    var shelves = [70, 250, 490, 700, 900], bays = [[80, 470], [490, 910], [930, 1300]];
    B.push(R(60, 60, 1260, 840, '#150d08'));
    var pal = ['#6a3a2a', '#3a4a3a', '#7a6a4a', '#2e3a4a', '#8a7a5a', '#5a3a3a', '#a89a78', '#3a3028', '#6a4a36', '#4a5a6a', '#8a4a34', '#c8b890'];
    var bt = new Batch();
    for (var r = 0; r < 4; r++) {
      var y0 = shelves[r] + 16, y1 = shelves[r + 1], h = y1 - y0;
      bays.forEach(function (b, bi) {
        if (r === 1 && bi === 1) { // 青铜器所在格：两侧少量书
          var bb = new Batch();
          for (var k = 0; k < 4; k++) bt.rect(b[0] + 6, y1 - (k + 1) * 11, 70 - k * 4, 10, pick(rnd, pal));
          shelfBooks(bt, rnd, b[1] - 70, y1, 70, h - 30, pal, { lean: false });
          return;
        }
        if (r === 1 && bi === 0) { // 《三国志》《三国演义》
          shelfBooks(bt, rnd, b[0], y1, 230, h - 40, pal);
          return;
        }
        shelfBooks(bt, rnd, b[0], y1, b[1] - b[0], h - 30, pal, { minW: 9, varW: 14 });
      });
    }
    B.push(bt.out());
    // 书名书脊
    var sp = [[318, '#2a3a5a', '三国志'], [346, '#2a3a5a', '三国志'], [374, '#6a2a22', '三国演义'], [410, '#4a3a2a', '资治通鉴']];
    sp.forEach(function (s) {
      B.push(R(s[0], 290, 26, 200, s[1]), R(s[0] + 3, 300, 20, 3, '#c8a860'), R(s[0] + 3, 470, 20, 3, '#c8a860'));
      var t = '<text x="' + (s[0] + 13) + '" y="316" font-family="Songti SC, STSong, SimSun, serif" font-size="15" fill="#e8d8b0" text-anchor="middle">';
      s[2].split('').forEach(function (ch, i) { t += '<tspan x="' + (s[0] + 13) + '" dy="' + (i ? 19 : 12) + '">' + ch + '</tspan>'; });
      B.push(t + '</text>');
    });
    // 隔板、立柱
    var fb = new Batch();
    shelves.forEach(function (y) { fb.rect(40, y, 1300, 16, woodL); fb.rect(40, y + 16, 1300, 5, 'rgba(0,0,0,.45)'); });
    fb.rect(470, 60, 20, 840, wood).rect(910, 60, 20, 840, wood).rect(40, 20, 22, 880, woodL).rect(1318, 20, 22, 880, wood);
    B.push(fb.out());
    // 格子内顶部阴影
    var sh = new Batch();
    for (r = 0; r < 4; r++) sh.rect(60, shelves[r] + 21, 1258, 26, 'rgba(0,0,0,.35)');
    B.push(sh.out());

    /* ---- 午后阳光：从右斜射，窗格投影 ---- */
    D.push(LG(P + '-sun', [[0, '#ffd890', 0.05], [0.5, '#ffd890', 0.38], [1, '#ffe8b0', 0.55]], 0, 0, 1, 0));
    var panes = [[420, 220, 900, 120, 960, 330, 470, 440], [440, 470, 980, 340, 1030, 560, 480, 690], [920, 110, 1330, 30, 1330, 240, 980, 320], [990, 330, 1330, 250, 1330, 470, 1040, 550]];
    var sunP = '';
    panes.forEach(function (p) { sunP += PG(p, 'url(#' + P + '-sun)'); });
    B.push('<g style="mix-blend-mode:screen" class="' + P + '-sun">' + sunP + '</g>');
    D.push(LG(P + '-beam', [[0, '#ffe8b8', 0], [1, '#ffe8b8', 0.22]], 0, 0, 1, 0));
    B.push(PG([420, 220, 1600, -60, 1600, 900, 480, 690], 'url(#' + P + '-beam)', 'style="mix-blend-mode:screen"'));
    B.push(glow(D, P + '-hot', 740, 380, 150, 110, '#ffd890', 0.35, 'style="mix-blend-mode:screen"'));
    /* ---- 青铜酒壶（壶）+ 两只耳杯 ---- */
    var cx = 700, base = 488;
    D.push(LG(P + '-brz', [[0, '#141a12'], [0.3, '#2a3a2e'], [0.58, '#44583e'], [0.78, '#9a7a44'], [0.9, '#e8c070'], [1, '#5a4428']], 0, 0, 1, 0));
    D.push(LG(P + '-brz2', [[0, '#1e2418'], [0.5, '#3e4e3e'], [0.82, '#c09a58'], [1, '#5a4428']], 0, 0, 1, 0));
    // 投在格背板上的影子（光从右来）
    B.push(PA('M' + (cx - 40) + ' ' + base + 'q-120-10-150-120q-10-60 40-90l60 20z', 'rgba(0,0,0,.4)'));
    var hu = 'M' + (cx - 34) + ' ' + base + 'l6-14q-40-30-40-80q0-44 30-66l8-18q-10-8-14-22h92q-4 14-14 22l8 18q30 22 30 66q0 50-40 80l6 14z';
    B.push(PA(hu, 'url(#' + P + '-brz)'));
    B.push(PA('M' + (cx - 30) + ' 290q30-26 60 0z', 'url(#' + P + '-brz2)'), '<circle cx="' + cx + '" cy="274" r="7" fill="url(#' + P + '-brz2)"/>');
    // 纹饰带
    var band = '';
    [[330, 58], [384, 72], [440, 64]].forEach(function (b) {
      band += 'M' + (cx - b[1]) + ' ' + b[0] + 'H' + (cx + b[1]);
      for (var x = cx - b[1] + 6; x < cx + b[1] - 6; x += 12) band += 'M' + x + ' ' + (b[0] + 4) + 'q3-6 6 0t6 0';
    });
    B.push('<path d="' + band + '" stroke="rgba(20,26,18,.6)" stroke-width="2" fill="none"/>');
    B.push('<path d="M' + (cx + 42) + ' 334q20 30 22 60M' + (cx + 50) + ' 410q-6 30-24 50" stroke="rgba(255,226,160,.6)" stroke-width="3" fill="none"/>');
    // 铺首衔环
    B.push('<circle cx="' + (cx - 58) + '" cy="356" r="11" fill="none" stroke="#2a3226" stroke-width="4"/><circle cx="' + (cx + 58) + '" cy="356" r="11" fill="none" stroke="#c8a060" stroke-width="4"/>');
    B.push(R(cx - 64, 340, 12, 8, '#2a3226'), R(cx + 52, 340, 12, 8, '#a88448'));
    // 铜绿斑
    var pt = new Batch();
    for (var i = 0; i < 18; i++) { var py = 380 + rnd() * 96, pw = 3 + rnd() * 10; pt.add('rgba(96,150,110,.3)', 'M' + n(cx - 60 + rnd() * 80) + ' ' + n(py) + 'h' + n(pw) + 'l2 3h' + n(-pw - 4) + 'z'); }
    B.push(pt.out());
    // 耳杯
    function cup(x, y, s) {
      var o = PA('M' + (x - 38 * s) + ' ' + (y - 16 * s) + 'q' + (38 * s) + ' ' + (40 * s) + ' ' + (76 * s) + ' 0z', 'url(#' + P + '-brz2)');
      o += EL(x - 44 * s, y - 16 * s, 12 * s, 4 * s, '#3a4a38') + EL(x + 44 * s, y - 16 * s, 12 * s, 4 * s, '#b08a50');
      o += EL(x, y - 16 * s, 38 * s, 8 * s, '#161a12') + EL(x, y - 16 * s, 38 * s, 8 * s, 'none', 'stroke="#c8a060" stroke-width="2"');
      o += EL(x + 10 * s, y + 2, 34 * s, 4, 'rgba(0,0,0,.4)');
      return o;
    }
    B.push(cup(596, base - 2, 1), cup(812, base - 2, 1.05));
    B.push(glow(D, P + '-rim', cx + 40, 380, 60, 110, '#ffd890', 0.28, 'style="mix-blend-mode:screen"'));

    // 浮尘
    var dust = '';
    for (var d = 0; d < 30; d++) dust += '<circle cx="' + n(600 + rnd() * 900) + '" cy="' + n(80 + rnd() * 520) + '" r="' + n(0.8 + rnd() * 1.8) + '"/>';
    B.push('<g fill="#fff4d8" opacity=".7" class="' + P + '-dust">' + dust + '</g>');

    D.push(RG(P + '-dark', [[0, '#120c06', 0], [0.5, '#120c06', 0.15], [1, '#050302', 0.7]], 0.55, 0.45, 0.75));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-dust{animation:' + P + '-du 16s ease-in-out infinite alternate}@keyframes ' + P + '-du{to{transform:translate(-30px,18px)}}' +
      '.' + P + '-sun{animation:' + P + '-sb 10s ease-in-out infinite}@keyframes ' + P + '-sb{0%,100%{opacity:.9}50%{opacity:1}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.6));
  };

  /* ================================================================
   * 上海街头路口：斑马线、红绿灯、车流、自行车，正午刺眼
   * ================================================================ */
  GF.art.bg.street = function () {
    var P = 'bgst', D = [], B = [], rnd = U.rng(624);
    D.push(LG(P + '-sky', [[0, '#fffdf4'], [0.5, '#f2efe2'], [1, '#dcdcd0']]));
    B.push(R(0, 0, 1600, 480, 'url(#' + P + '-sky)'));
    // 远处高楼（空气透视）
    var far = new Batch(), fx = -20;
    while (fx < 1600) { var fw = 40 + rnd() * 90, fh = 120 + rnd() * 220; far.rect(fx, 440 - fh, fw, fh, rnd() < 0.5 ? '#cfd2ca' : '#c6cac2'); fx += fw + rnd() * 30; }
    B.push(far.out());
    // 街对面的楼
    var bl = [
      [0, 250, 290, '#8e877a', 'old'], [250, 560, 160, '#c6c4ba', 'tile'], [560, 820, 240, '#9a8e7e', 'old2'],
      [820, 1150, 110, '#a9a9a1', 'bank'], [1150, 1410, 200, '#b4ae9e', 'bal'], [1410, 1620, 270, '#8a8274', 'old']
    ];
    var wn = new Batch(), fa = new Batch();
    bl.forEach(function (b) {
      fa.rect(b[0], b[2], b[1] - b[0], 480 - b[2], b[3]);
      fa.rect(b[0], b[2], b[1] - b[0], 8, U.mix(b[3], '#000000', 0.25));
      var type = b[4];
      for (var y = b[2] + 26; y < 390; y += (type === 'tile' ? 36 : 48)) {
        for (var x = b[0] + 18; x < b[1] - 30; x += (type === 'bank' ? 30 : 50)) {
          if (type === 'tile') { wn.rect(x, y, 34, 22, '#6e8a96'); wn.rect(x, y, 34, 4, '#50646c'); }
          else if (type === 'bank') { wn.rect(x, y, 16, 34, '#5a6a72'); }
          else if (type === 'bal') { wn.rect(x, y, 36, 28, '#6a6a62'); wn.rect(x - 4, y + 22, 44, 8, '#8a8474'); }
          else { wn.rect(x, y, 22, 32, '#4e4a44'); wn.rect(x - 3, y - 4, 28, 4, U.mix(b[3], '#000000', 0.3)); }
          if (rnd() < 0.3 && type !== 'bank') wn.rect(x + 22, y + 8, 14, 12, '#d8d8d0');
        }
      }
    });
    B.push(fa.out(), wn.out());
    D.push(LG(P + '-lit', [[0, '#fff6dc', 0.35], [1, '#fff6dc', 0]]));
    B.push(R(0, 100, 1600, 160, 'url(#' + P + '-lit)', 'style="mix-blend-mode:screen"'));
    // 石库门弄堂口的拱门与弄名
    B.push(PA('M60 480v-110q0-50 60-50t60 50v110z', '#6a6258'), PA('M78 480v-100q0-40 42-40t42 40v100z', '#2a2622'));
    B.push(R(70, 312, 100, 22, '#d8d0bc'), '<text x="120" y="329" font-family="Songti SC, STSong, SimSun, serif" font-size="17" fill="#3a3028" text-anchor="middle">福康里</text>');
    // 晾衣竿
    var cl = new Batch();
    [[280, 240], [300, 312], [1170, 290]].forEach(function (c) {
      cl.rect(c[0], c[1], 160, 3, '#5a5a54');
      for (var k = 0; k < 5; k++) cl.rect(c[0] + 10 + k * 30, c[1] + 3, 20, 18 + rnd() * 18, pick(rnd, ['#c86a5a', '#6a8aa8', '#e8e4d8', '#8a9a7a', '#b8a888']));
    });
    B.push(cl.out());
    // 底层商铺与招牌
    var sg = [[258, 390, 110, '#a84a3a', '烟纸店', '#f0e0c8'], [380, 390, 150, '#3a6a6a', '五金交电', '#e8f0e8'], [572, 396, 110, '#e0dcd0', '美发', '#8a2a2a'], [690, 396, 120, '#3a4a7a', '文具', '#e8e8f0'], [1160, 392, 120, '#6a3a2a', '点心', '#f0d8b8'], [1290, 392, 110, '#4a6a4a', '水果', '#f0f0e0']];
    var shop = new Batch();
    sg.forEach(function (s) { shop.rect(s[0], s[1] + 28, s[2], 480 - s[1] - 28, '#2e2c28'); });
    B.push(shop.out());
    sg.forEach(function (s) { B.push(R(s[0], s[1], s[2], 28, s[3]), '<text x="' + (s[0] + s[2] / 2) + '" y="' + (s[1] + 21) + '" font-family="Songti SC, STSong, SimSun, serif" font-size="18" fill="' + s[5] + '" text-anchor="middle">' + s[4] + '</text>'); });
    B.push(R(840, 410, 290, 70, '#2a2c2a'), R(840, 396, 290, 16, '#8a2a24'));
    var aw = new Batch();
    sg.forEach(function (s0) { aw.rect(s0[0], s0[1] + 28, s0[2], 14, 'rgba(0,0,0,.35)'); });
    B.push(aw.out());
    // 行道树：法国梧桐
    var tk = new Batch(), cn = new Batch(), ch = new Batch(), trees = [225, 530, 900, 1280];
    trees.forEach(function (tx) {
      tk.poly([tx - 9, 486, tx - 7, 330, tx - 30, 250, tx - 24, 246, tx, 310, tx + 22, 240, tx + 28, 244, tx + 7, 330, tx + 10, 486], '#6a6a5a');
      for (var k = 0; k < 16; k++) {
        var a = rnd() * 6.28, rr = rnd() * 120;
        cn.circ(tx + Math.cos(a) * rr, 214 + Math.sin(a) * rr * 0.45, 30 + rnd() * 26, rnd() < 0.5 ? '#5c6a46' : '#4c583a');
        if (rnd() < 0.65) ch.circ(tx + Math.cos(a) * rr - 12, 198 + Math.sin(a) * rr * 0.45, 16 + rnd() * 14, rnd() < 0.5 ? '#c8cc8c' : '#aab47a');
      }
    });
    B.push(tk.out(), cn.out(), ch.out());
    var bark = new Batch();
    trees.forEach(function (tx) { for (var k = 0; k < 6; k++) bark.rect(tx - 7 + rnd() * 8, 340 + rnd() * 130, 6 + rnd() * 5, 8 + rnd() * 12, '#b8b49c'); });
    B.push(bark.out());
    // 人行道
    B.push(R(0, 476, 1600, 18, '#b8b4a8'), R(0, 494, 1600, 6, '#8a8680'));
    B.push('<g fill="rgba(40,40,30,.35)">' + trees.map(function (tx) { return EL(tx, 488, 90, 7, 'rgba(40,40,30,.35)'); }).join('') + '</g>');
    // 马路
    D.push(LG(P + '-road', [[0, '#a8a69e'], [1, '#76746e']]));
    B.push(R(0, 500, 1600, 400, 'url(#' + P + '-road)'));
    B.push(PA('M0 540H1600', 'none', 'stroke="#d8d4c4" stroke-width="3" stroke-dasharray="60 50"'), PA('M0 582H1600M0 588H1600', 'none', 'stroke="#b8a468" stroke-width="3"'));
    // 斑马线
    var zb = new Batch(), ys = [506, 526, 550, 580, 618, 666, 730, 810, 900];
    for (var z = 0; z < ys.length - 1; z++) {
      var ya = ys[z] + 3, yb = ys[z] + (ys[z + 1] - ys[z]) * 0.55, fa2 = (ya - 500) / 400, fb2 = (yb - 500) / 400;
      zb.poly([560 - 300 * fa2, ya, 1040 + 300 * fa2, ya, 1040 + 300 * fb2, yb, 560 - 300 * fb2, yb], '#e8e6dc');
    }
    B.push(zb.out());
    // 正午的硬阴影：树冠投在人行道与路面
    var hs = new Batch();
    [225, 530, 900, 1280].forEach(function (tx) { for (var k = 0; k < 5; k++) hs.circ(tx - 70 + k * 36 + rnd() * 10, 492 + rnd() * 10, 22 + rnd() * 16, 'rgba(30,32,26,.42)'); });
    B.push('<g transform="translate(0 0) scale(1 1)"><path d="M0 476H1600V520H0z" fill="none"/>' + hs.out('transform="matrix(1 0 0 .3 0 344)"') + '</g>');
    // 车：出租车（青绿）、无轨电车、自行车
    B.push(EL(330, 572, 150, 8, 'rgba(20,20,20,.35)'));
    B.push(PA('M190 566v-26l30-4l36-30h110l40 30l24 6v24z', '#4a9a92'), PA('M262 536l24-24h36v24zM330 536v-24h32l26 24z', '#2a3a40'), R(190, 548, 240, 6, '#e8e4d8'));
    B.push('<circle cx="236" cy="566" r="14" fill="#1a1a1a"/><circle cx="386" cy="566" r="14" fill="#1a1a1a"/>', R(292, 500, 30, 8, '#e8e4d8'));
    B.push(PA('M60 520h110M40 536h120M70 552h90', 'none', 'stroke="rgba(240,240,230,.6)" stroke-width="3"'));
    // 无轨电车
    B.push(EL(1250, 572, 230, 10, 'rgba(20,20,20,.35)'));
    B.push(R(1030, 430, 440, 136, '#b8b2a2', 'rx="10"'), R(1030, 500, 440, 20, '#a8402c'));
    var bw = new Batch();
    for (var bx = 1048; bx < 1420; bx += 56) bw.rect(bx, 446, 46, 44, '#3a4448');
    B.push(bw.out(), LN(1300, 430, 1180, 262, '#2a2a28', 3), LN(1330, 430, 1210, 268, '#2a2a28', 3));
    B.push('<circle cx="1110" cy="566" r="18" fill="#1a1a1a"/><circle cx="1390" cy="566" r="18" fill="#1a1a1a"/>');
    // 自行车（远处小剪影）
    var bk = '';
    [[640, 488], [700, 492], [760, 486], [470, 490]].forEach(function (b) {
      bk += '<circle cx="' + (b[0] - 10) + '" cy="' + b[1] + '" r="7" fill="none" stroke="#2a2a28" stroke-width="2"/><circle cx="' + (b[0] + 10) + '" cy="' + b[1] + '" r="7" fill="none" stroke="#2a2a28" stroke-width="2"/>';
      bk += PA('M' + (b[0] - 10) + ' ' + b[1] + 'l8-12h8l4 12M' + (b[0] - 2) + ' ' + (b[1] - 12) + 'l-2-16', 'none', 'stroke="#2a2a28" stroke-width="2"') + '<circle cx="' + (b[0] - 3) + '" cy="' + (b[1] - 32) + '" r="4" fill="#2a2a28"/>';
    });
    B.push(bk);
    // 架空电线
    B.push('<path d="M-10 70Q800 120 1610 60M-10 96Q800 150 1610 90M-10 180Q800 230 1610 190M-10 196Q800 246 1610 206" stroke="#3a3a36" stroke-width="2" fill="none"/>');
    B.push('<path d="M1180 262L1100 225M1210 268L1300 231" stroke="#3a3a36" stroke-width="2"/>');

    /* ---- 红绿灯（右前景） ---- */
    B.push(R(1426, 120, 22, 780, '#34403a'), R(1430, 120, 5, 780, '#4e5c54'), R(1000, 138, 440, 14, '#34403a'));
    B.push(R(1060, 152, 56, 150, '#16181a', 'rx="8"'), R(1054, 152, 68, 8, '#16181a'));
    B.push('<circle cx="1088" cy="184" r="19" fill="#ff3a26"/><circle cx="1088" cy="228" r="19" fill="#3a2e10"/><circle cx="1088" cy="272" r="19" fill="#0e2a1a"/>');
    B.push('<g class="' + P + '-red">' + glow(D, P + '-rg', 1088, 184, 110, 110, '#ff5a3a', 0.38) + '</g>');
    B.push(R(1076, 170, 10, 8, 'rgba(255,230,220,.8)', 'rx="4"'));
    // 行人灯：红色小人 + 倒计时
    B.push(R(1374, 330, 52, 120, '#16181a', 'rx="6"'));
    B.push(PA('M1400 346a5 5 0 1 1 0.1 0zM1394 356h12l2 22h-4l-1 16h-6l-1-16h-4z', '#ff3a26'), R(1382, 410, 36, 30, '#0a0a0a'));
    B.push('<text x="1400" y="434" font-family="monospace" font-size="22" fill="#ff4a30" text-anchor="middle">27</text>');
    B.push(glow(D, P + '-pg', 1400, 370, 70, 60, '#ff5a3a', 0.35));
    // 对面的行人灯
    B.push(R(1004, 420, 8, 80, '#34403a'), R(994, 396, 28, 36, '#16181a', 'rx="3"'), '<circle cx="1008" cy="408" r="6" fill="#ff3a26"/>');

    /* ---- 刺眼的正午：日晕 + 泛白 ---- */
    B.push(glow(D, P + '-sun', 240, 20, 760, 420, '#fffbe8', 1, 'style="mix-blend-mode:screen"'));
    B.push(glow(D, P + '-core', 240, 30, 240, 160, '#ffffff', 1), '<circle cx="240" cy="30" r="34" fill="#ffffff"/>');
    D.push(LG(P + '-bleach', [[0, '#ffffff', 0.45], [0.5, '#ffffff', 0.12], [1, '#ffffff', 0]]));
    B.push(R(0, 0, 1600, 600, 'url(#' + P + '-bleach)'));
    // 镜头光斑（刺眼）
    B.push('<g style="mix-blend-mode:screen" opacity=".5">' + '<circle cx="470" cy="190" r="44" fill="#fff0c8" opacity=".25"/><circle cx="600" cy="262" r="14" fill="#e8f4ff" opacity=".4"/><circle cx="700" cy="318" r="30" fill="#ffe0c0" opacity=".2"/>' +
      PG([780, 360, 800, 348, 820, 360, 820, 384, 800, 396, 780, 384], '#e0f0ff', 'opacity=".3"') + '</g>');
    B.push(LN(0, 30, 520, 30, 'rgba(255,255,240,.5)', 2), LN(240, 0, 240, 110, 'rgba(255,255,240,.4)', 2));
    D.push(LG(P + '-heat', [[0, '#fff8e0', 0], [0.5, '#fff8e0', 0.28], [1, '#fff8e0', 0]]));
    B.push(R(0, 440, 1600, 90, 'url(#' + P + '-heat)', 'class="' + P + '-heat"'));
    var css = '.' + P + '-red{animation:' + P + '-rb 1.8s ease-in-out infinite}@keyframes ' + P + '-rb{0%,100%{opacity:.75}50%{opacity:1}}' +
      '.' + P + '-heat{animation:' + P + '-ht 5s ease-in-out infinite alternate}@keyframes ' + P + '-ht{to{opacity:.4;transform:translateY(-6px)}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.35));
  };

  /* ================================================================
   * 出租车后座：去浦东机场的高速，车速很快
   * ================================================================ */
  GF.art.bg.taxi = function () {
    var P = 'bgtx', D = [], B = [], rnd = U.rng(626);
    B.push(R(0, 0, 1600, 900, '#1a1a1a'));

    /* ---- 挡风玻璃外：高速公路（左） ---- */
    var ws = [0, 110, 780, 130, 760, 400, 0, 392];
    B.push('<clipPath id="' + P + '-wsc"><polygon points="' + ws.join(' ') + '"/></clipPath>');
    var W = [];
    D.push(LG(P + '-sky', [[0, '#9aa4a8'], [1, '#d4d6d0']]));
    W.push(R(0, 100, 800, 320, 'url(#' + P + '-sky)'));
    var vx = 610, vy = 290;
    W.push(R(0, 272, 800, 20, '#8a9288'));
    var far = new Batch();
    for (var i = 0; i < 12; i++) far.rect(rnd() * 780, 262 + rnd() * 10, 20 + rnd() * 50, 10 + rnd() * 18, '#7a8480');
    W.push(far.out());
    W.push(PG([0, 420, vx - 6, vy, vx + 6, vy, 800, 420], '#5a5c5a'), PG([0, 330, vx - 6, vy, 0, 420], '#6e7a62'), PG([800, 330, vx + 6, vy, 800, 420], '#6e7a62'));
    W.push('<path class="' + P + '-lane" d="M' + vx + ' ' + vy + 'L260 420M' + vx + ' ' + vy + 'L620 420" stroke="#e8e6dc" stroke-width="4" stroke-dasharray="14 18" fill="none"/>');
    W.push(LN(vx - 4, vy, 20, 420, '#d8d6cc', 3), LN(vx + 4, vy, 780, 420, '#d8d6cc', 3));
    W.push('<path class="' + P + '-lane" d="M' + vx + ' ' + vy + 'L0 360M' + vx + ' ' + vy + 'L800 352M' + vx + ' ' + vy + 'L120 420M' + vx + ' ' + vy + 'L760 420" stroke="rgba(240,240,230,.35)" stroke-width="2" stroke-dasharray="4 40" fill="none"/>');
    // 护栏
    W.push(PG([vx - 6, vy - 2, 0, 360, 0, 376, vx - 6, vy + 1], '#a8aaa4'), PG([vx + 6, vy - 2, 800, 356, 800, 372, vx + 6, vy + 1], '#a8aaa4'));
    // 龙门架与绿色指路牌
    W.push(R(490, 196, 6, 96, '#5a5e5c'), R(760, 196, 6, 96, '#5a5e5c'), R(490, 196, 276, 6, '#5a5e5c'));
    W.push(R(520, 202, 214, 56, '#2a6a4a'), R(524, 206, 206, 48, 'none', 'stroke="#e8ece8" stroke-width="1.5"'));
    W.push('<text x="612" y="238" font-family="Songti SC, STSong, SimSun, serif" font-size="22" fill="#f0f4f0" text-anchor="middle">浦东国际机场</text>', PA('M700 222l10 8l-10 8v-4h-12v-8h12z', '#f0f4f0'));
    // 高压电塔
    W.push('<path d="M140 280l14-80l14 80M144 250h20M147 230h14M136 214h36" stroke="#6a7070" stroke-width="2" fill="none"/>');
    B.push('<g clip-path="url(#' + P + '-wsc)">' + W.join('') + '</g>');
    B.push(PA('M0 100L790 124L790 150Q400 120 0 130z', '#2a2826'));
    // 仪表台
    D.push(LG(P + '-dash', [[0, '#2a2826'], [1, '#141312']]));
    B.push(PA('M0 380Q400 372 780 392L790 470H0z', 'url(#' + P + '-dash)'));
    B.push(R(630, 400, 120, 40, '#0a0a0a', 'rx="4"'), '<text x="690" y="430" font-family="monospace" font-size="26" fill="#ff4a30" text-anchor="middle">86.00</text>');
    B.push(glow(D, P + '-mg', 690, 420, 80, 30, '#ff4a30', 0.35, 'style="mix-blend-mode:screen"'));
    // 后视镜 + 平安结
    B.push(R(360, 132, 160, 40, '#141414', 'rx="10"'), R(368, 138, 144, 28, '#6a7070', 'rx="7"'), R(436, 110, 8, 24, '#141414'));
    B.push('<g class="' + P + '-charm">' + LN(440, 172, 440, 226, '#b02a22', 2) + PA('M440 226l12 12l-12 12l-12-12z', '#c8302a') + PA('M436 250h8l4 40h-16z', '#c8302a') + '</g>');

    /* ---- 前排副驾座椅（空） ---- */
    D.push(LG(P + '-seat', [[0, '#3a3834'], [1, '#22201e']], 0, 0, 1, 0));
    B.push(PA('M170 900V420q0-60 60-66h300q60 6 60 66V900z', 'url(#' + P + '-seat)'));
    B.push(PA('M270 356v-100q0-26 26-26h168q26 0 26 26v100z', '#34322e'), R(320, 356, 12, 30, '#6a6a66'), R(430, 356, 12, 30, '#6a6a66'));
    var sm = '';
    for (i = 0; i < 6; i++) sm += 'M' + (200 + i * 60) + ' 440v460';
    B.push('<path d="' + sm + '" stroke="rgba(0,0,0,.25)" stroke-width="3"/>', PA('M200 600h360', 'none', 'stroke="rgba(0,0,0,.35)" stroke-width="6"'));
    B.push(PA('M186 430q180-30 390 0', 'none', 'stroke="rgba(220,220,210,.15)" stroke-width="4"'));

    /* ---- B 柱 ---- */
    B.push(PG([770, 90, 850, 96, 830, 900, 740, 900], '#262422'), PG([800, 94, 812, 94, 790, 900, 776, 900], 'rgba(255,255,255,.04)'));

    /* ---- 右侧车窗：飞速后退的景物 ---- */
    var wp = 'M870 140Q870 118 894 118L1500 136Q1540 140 1548 176L1566 440Q1568 460 1546 460L884 452Q866 452 866 432z';
    B.push('<clipPath id="' + P + '-swc"><path d="' + wp + '"/></clipPath>');
    var S = [];
    D.push(LG(P + '-ssky', [[0, '#a8b0b2'], [1, '#dcdcd4']]));
    S.push(R(860, 110, 720, 360, 'url(#' + P + '-ssky)'));
    S.push(glow(D, P + '-msun', 1420, 300, 260, 120, '#f8e0b0', 0.55));
    // 远：农田、厂房、电塔（慢）
    var fr = new Batch();
    for (i = 0; i < 10; i++) fr.rect(860 + rnd() * 700, 300 + rnd() * 20, 30 + rnd() * 80, 20 + rnd() * 20, '#8a9290');
    S.push('<g class="' + P + '-slow">' + fr.out() + R(860, 330, 1440, 40, '#7a8a6a') + '<path d="M1000 330l18-120l18 120M1004 290h28M1008 250h20M990 226h56M1500 330l18-120l18 120M1504 290h28M1508 250h20M1490 226h56" stroke="#6a7070" stroke-width="2" fill="none"/><path d="M1046 226Q1260 250 1490 226M1046 236Q1260 262 1490 236" stroke="#6a7070" stroke-width="1.2" fill="none"/></g>');
    // 中：灯杆（快）
    var poles = '';
    for (i = 0; i < 6; i++) poles += R(880 + i * 240, 170, 60, 240, 'rgba(74,78,76,.18)') + R(880 + i * 240, 170, 8, 240, '#4a4e4c') + R(880 + i * 240, 170, 60, 6, '#4a4e4c');
    S.push('<g class="' + P + '-fast">' + poles + '</g>');
    // 近：护栏与草带的速度线（模糊）
    S.push(R(860, 370, 720, 100, '#6a7458'));
    var sp = new Batch();
    for (i = 0; i < 26; i++) sp.rect(860 + rnd() * 700, 372 + rnd() * 90, 80 + rnd() * 220, 2 + rnd() * 3, rnd() < 0.5 ? 'rgba(220,220,210,.45)' : 'rgba(40,50,30,.35)');
    S.push('<g class="' + P + '-streak">' + sp.out() + '</g>');
    S.push(R(860, 384, 720, 14, '#b8bab4'), R(860, 398, 720, 4, '#6a6c68'));
    B.push('<g clip-path="url(#' + P + '-swc)">' + S.join('') + '</g>');
    B.push(PA(wp, 'none', 'stroke="#0e0e0e" stroke-width="14"'));
    B.push(PA('M900 140L1000 140L920 440L880 440z', 'rgba(255,255,255,.07)'));
    // 顶棚
    D.push(LG(P + '-roof', [[0, '#4a4640'], [1, '#2a2824']]));
    B.push(PA('M0 0H1600V130Q1200 96 850 100Q420 80 0 104z', 'url(#' + P + '-roof)'), PA('M1180 70h120v14h-120z', '#1e1c1a'));
    // 车门内饰板
    D.push(LG(P + '-door', [[0, '#4a4640'], [1, '#1e1c1a']]));
    B.push(PA('M846 466L1580 474L1600 480V900H830z', 'url(#' + P + '-door)'));
    B.push(PA('M860 470L1580 478', 'none', 'stroke="#141414" stroke-width="10"'));
    // 车门锁销（小游戏关键）
    B.push(R(1484, 452, 12, 22, '#b8b4a8', 'rx="4"'), R(1486, 454, 4, 16, '#e8e4d8'));
    // 扶手、门把手
    B.push(PA('M880 560Q1200 540 1560 560L1560 600Q1200 586 880 606z', '#34302c'), PA('M1160 520h90q10 0 10 10v8h-110v-8q0-10 10-10z', '#9a968c'), R(1150, 530, 120, 18, '#1a1816', 'rx="6"'), R(1164, 532, 90, 8, '#b8b4a8', 'rx="4"'));
    // 摇窗把手（桑塔纳）
    B.push('<circle cx="1000" cy="640" r="12" fill="#2a2826"/>', PA('M1000 640l60 20', 'none', 'stroke="#2a2826" stroke-width="10" stroke-linecap="round"'));
    B.push(PA('M870 700Q1200 690 1590 700', 'none', 'stroke="rgba(0,0,0,.35)" stroke-width="4"'));
    // 车外天光落在内饰上
    D.push(LG(P + '-spill', [[0, '#dfe4e0', 0.16], [1, '#dfe4e0', 0]]));
    B.push(PG([880, 478, 1560, 484, 1560, 700, 880, 700], 'url(#' + P + '-spill)'));
    B.push(PA('M590 420q6 200 0 480', 'none', 'stroke="rgba(210,220,220,.18)" stroke-width="4"'), PA('M490 256v100', 'none', 'stroke="rgba(210,220,220,.2)" stroke-width="3"'));

    D.push(RG(P + '-dark', [[0, '#000', 0], [0.6, '#000', 0.2], [1, '#000', 0.65]], 0.5, 0.35, 0.8));
    B.push(R(0, 0, 1600, 900, 'url(#' + P + '-dark)'));
    var css = '.' + P + '-fast{animation:' + P + '-f .5s linear infinite}@keyframes ' + P + '-f{to{transform:translateX(-240px)}}' +
      '.' + P + '-slow{animation:' + P + '-s 16s linear infinite alternate}@keyframes ' + P + '-s{to{transform:translateX(-80px)}}' +
      '.' + P + '-streak{animation:' + P + '-k .35s linear infinite}@keyframes ' + P + '-k{to{transform:translateX(-160px)}}' +
      '.' + P + '-lane{animation:' + P + '-l .45s linear infinite}@keyframes ' + P + '-l{to{stroke-dashoffset:-32}}' +
      '.' + P + '-charm{transform-origin:440px 172px;animation:' + P + '-c 1.3s ease-in-out infinite alternate}@keyframes ' + P + '-c{from{transform:rotate(-8deg)}to{transform:rotate(9deg)}}';
    return U.svg('<defs>' + D.join('') + '</defs><style>' + css + '</style>' + B.join('') + U.vignette(P, 0.5));
  };
})();
