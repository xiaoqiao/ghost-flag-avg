/*
 * 背景：“三层楼”系列（2004 年现代部分）
 *   sanceng_ext     裕通路85弄弄口的三层楼外景（下午，晴）
 *   sanceng_center  普济路弄堂尽头的中央三层楼（阴天下午）
 *   juweihui        居委会办公室
 *   sanceng_stairs  中央楼一楼木楼梯 → 二楼走廊尽头的朱红门
 *   su_room         苏逸才的房间（明亮，满橱手抄佛经）
 *   zhang_room      张轻的房间（普通、阴沉，窗帘半掩）
 *   basement        钱六的地下室（物件位置固定，供 dark_basement 小游戏作底图）
 *   sealed_stairs   尾声：通往地下室的楼梯口被水泥封死
 * 风格：扁平剧场感矢量，灰水泥 / 灰绿 / 积尘木色，朱红点缀。
 * 所有 SVG 内部 id / class / keyframes 都带 bg-xxx 前缀。
 */
(function () {
  'use strict';
  var U = GF.art.util;
  var B = GF.art.bg;
  var FONT = 'Songti SC, STSong, SimSun, serif';

  /* ---------------- 小工具（仅本文件） ---------------- */
  function k(v) { return Math.round(v * 10) / 10; }
  function op(a) { return 'opacity="' + a + '"'; }
  function stops(a) {
    return a.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  function LG(id, x1, y1, x2, y2, st, ex) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + (ex ? ' ' + ex : '') + '>' + stops(st) + '</linearGradient>';
  }
  function RG(id, cx, cy, r, st, ex) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (ex ? ' ' + ex : '') + '>' + stops(st) + '</radialGradient>';
  }
  function BLUR(id, sd) { return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'; }
  function PAT(id, w, h, inner) { return '<pattern id="' + id + '" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse">' + inner + '</pattern>'; }
  function R(x, y, w, h, f, ex) { return '<rect x="' + k(x) + '" y="' + k(y) + '" width="' + k(w) + '" height="' + k(h) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function PG(pts, f, ex) { return '<polygon points="' + pts.map(k).join(',') + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function PT(d, f, ex) { return '<path d="' + d + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function SK(d, c, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function LN(x1, y1, x2, y2, c, w, ex) { return '<line x1="' + k(x1) + '" y1="' + k(y1) + '" x2="' + k(x2) + '" y2="' + k(y2) + '" stroke="' + c + '" stroke-width="' + w + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function CI(cx, cy, r, f, ex) { return '<circle cx="' + k(cx) + '" cy="' + k(cy) + '" r="' + k(r) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function EL(cx, cy, rx, ry, f, ex) { return '<ellipse cx="' + k(cx) + '" cy="' + k(cy) + '" rx="' + k(rx) + '" ry="' + k(ry) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function TX(x, y, size, fill, t, ex) { return '<text x="' + k(x) + '" y="' + k(y) + '" font-size="' + size + '" fill="' + fill + '" font-family="' + FONT + '"' + (ex ? ' ' + ex : '') + '>' + t + '</text>'; }
  /* 竖排文字 */
  function TXV(x, y, size, fill, t, ex) {
    var s = '<text font-size="' + size + '" fill="' + fill + '" font-family="' + FONT + '" text-anchor="middle"' + (ex ? ' ' + ex : '') + '>';
    for (var i = 0; i < t.length; i++) s += '<tspan x="' + k(x) + '" y="' + k(y + i * size * 1.08) + '">' + t[i] + '</tspan>';
    return s + '</text>';
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function G(inner, ex) { return '<g' + (ex ? ' ' + ex : '') + '>' + inner + '</g>'; }
  /* 在四边形（按 tl,tr,br,bl）内按 (u,v) 双线性取点 */
  function quad(q, u, v) {
    var tx = q[0] + (q[2] - q[0]) * u, ty = q[1] + (q[3] - q[1]) * u;
    var bx = q[6] + (q[4] - q[6]) * u, by = q[7] + (q[5] - q[7]) * u;
    return [tx + (bx - tx) * v, ty + (by - ty) * v];
  }
  function qrect(q, u1, v1, u2, v2) {
    return [].concat(quad(q, u1, v1), quad(q, u2, v1), quad(q, u2, v2), quad(q, u1, v2));
  }
  /* 四边形里的椭圆（取 16 个点） */
  function qell(q, cu, cv, ru, rv) {
    var a = [];
    for (var i = 0; i < 16; i++) { var t = i / 16 * Math.PI * 2; a = a.concat(quad(q, cu + Math.cos(t) * ru, cv + Math.sin(t) * rv)); }
    return a;
  }

  /* 晾晒的衣物（挂在竹竿下，cx 为衣架中心，top 为竿的高度） */
  var CLOTH = ['#c9c3b2', '#8d9aa6', '#a4574a', '#6f7d6a', '#d9d5c9', '#55636f', '#b59a6a'];
  function garment(r, cx, top, cls) {
    var c = pick(r, CLOTH), t = r(), d;
    if (t < .4) d = 'M' + k(cx - 13) + ' ' + k(top) + 'l-9 11 5 5 4-4v27h26v-27l4 4 5-5-9-11z';
    else if (t < .7) d = 'M' + k(cx - 10) + ' ' + k(top) + 'h20l3 42h-9l-4-27-4 27h-9z';
    else d = 'M' + k(cx - 9) + ' ' + k(top) + 'h18v' + k(26 + r() * 16) + 'h-18z';
    return '<path class="' + cls + '" style="animation-delay:-' + k(r() * 5) + 's" d="' + d + '" fill="' + c + '"/>';
  }

  /* 立面窗户：高窗 + 顶上气窗 */
  var CURT = ['#8a8f7a', '#9b8b6c', '#6e7f86', '#a36e5b', '#bdb49a', '#5f6b5a'];
  function win(p, r, wx, wy, ww, wh, c, shade, lit, bars) {
    var s = '';
    s += R(wx + ww * .12, wy + wh + 8, ww * .76, 50 + r() * 110, 'url(#' + p + '-streak)');
    s += R(wx - 7, wy - 13, ww + 14, 13, c.lintel);
    s += R(wx, wy, ww, wh, c.recess);
    s += R(wx + 5, wy + 5, ww - 10, wh - 8, lit ? 'url(#' + p + '-lit)' : 'url(#' + p + '-glass)');
    if (r() < .55) {
      var cw = (ww - 10) * (.25 + r() * .5), left = r() < .5;
      s += R(left ? wx + 5 : wx + ww - 5 - cw, wy + wh * .24, cw, wh * .76 - 3, lit ? '#d9b27a' : pick(r, CURT), op(lit ? .6 : .8));
    }
    s += R(wx + ww / 2 - 1.5, wy + wh * .22, 3, wh * .78 - 3, c.frame) + R(wx + 5, wy + wh * .21, ww - 10, 4, c.frame) + R(wx + 5, wy + wh * .52, ww - 10, 3, c.frame);
    s += PG([wx + 7, wy + wh * .26, wx + ww * .42, wy + wh * .26, wx + 7, wy + wh * .7], '#fff', op(.07));
    if (bars) s += R(wx, wy, ww, wh, 'url(#' + p + '-bars)');
    if (shade) s += PG([wx, wy, wx + ww, wy, wx + ww - 4, wy + 15, wx + 13, wy + 15, wx + 13, wy + wh, wx, wy + wh], '#101418', op(.45));
    s += R(wx - 9, wy + wh, ww + 18, 7, c.sill) + R(wx - 9, wy + wh + 7, ww + 18, 9, '#000', op(.22));
    return s;
  }
  /* 空调外机 */
  function acUnit(p, x, y, w) {
    return R(x, y, w, 30, '#c2c2b8') + R(x, y + 30, w, 4, '#6b6d66') + CI(x + w * .66, y + 15, 10, 'none', 'stroke="#80827a" stroke-width="2"') +
      R(x + 5, y + 7, w * .36, 14, 'url(#' + p + '-acg)') + R(x + 2, y + 34, w - 4, 10, '#000', op(.18));
  }
  /* 防盗窗 */
  function grille(p, wx, wy, ww, wh) {
    return PG([wx - 16, wy - 8, wx + ww + 16, wy - 8, wx + ww + 10, wy - 22, wx - 10, wy - 22], '#6c6f68') +
      R(wx - 14, wy - 8, ww + 28, wh + 16, 'url(#' + p + '-gb)') +
      R(wx - 14, wy - 8, ww + 28, wh + 16, 'none', 'stroke="#2e3334" stroke-width="3"') + R(wx - 14, wy + wh * .5, ww + 28, 2, '#2e3334');
  }
  /* 晾衣竿 + 衣物 */
  function laundry(r, x1, x2, y, cls) {
    var s = LN(x1, y, x2, y, '#8a7a55', 3);
    var n = 2 + Math.floor(r() * 2), step = (x2 - x1) / (n + 1);
    for (var i = 1; i <= n; i++) s += garment(r, x1 + step * i + (r() - .5) * 8, y + 3, cls);
    return s;
  }
  /* 立面共用 defs（栅栏图案、空调格栅） */
  function facadeDefs(p) {
    return PAT(p + '-bars', 10, 10, '<rect x="4" width="2.6" height="10" fill="#23282a"/>') +
      PAT(p + '-gb', 9, 10, '<rect x="3" width="1.8" height="10" fill="#2e3334"/>') +
      PAT(p + '-acg', 6, 5, '<rect width="6" height="2" fill="#8d8f86"/>');
  }

  /* 三层楼立面：o = {x,y,w,h,bays,par,pal,shade,door,lit,ac,grille,laundry,patches,seed}；o.box 回填各窗坐标 */
  function facade(p, o) {
    var r = U.rng(o.seed), s = '', x = o.x, y = o.y, w = o.w, h = o.h, par = o.par, fh = (h - par) / 3, bw = w / o.bays, c = o.pal, i;
    o.box = {};
    s += R(x, y, w, h, c.wall);
    for (i = 0; i < o.patches; i++)
      s += R(x + r() * (w - 120), y + par + r() * (h - par - 80), 40 + r() * 150, 30 + r() * 100, r() < .5 ? '#55574f' : '#dcd8ca', op(k(.05 + r() * .09)));
    // 檐口下淌下来的黑色水渍
    for (i = 0; i < o.bays * 2; i++) s += R(x + r() * w, y + par, 8 + r() * 30, 60 + r() * 200, 'url(#' + p + '-streak)');
    s += R(x, y, w, h, 'url(#' + p + '-wallv)');
    s += R(x - 8, y, w + 16, par, c.parapet) + R(x - 8, y, w + 16, 4, c.cornice) + R(x - 12, y + par - 9, w + 24, 9, c.cornice) + R(x - 8, y + par, w + 16, 16, '#000', op(.22));
    for (var f = 1; f < 3; f++) {
      var yb = y + par + fh * f;
      s += R(x - 5, yb - 6, w + 10, 7, c.cornice) + R(x - 5, yb + 1, w + 10, 9, '#000', op(.16));
    }
    var ws = '', ex = '';
    for (f = 0; f < 3; f++) for (var b = 0; b < o.bays; b++) {
      var ft = y + par + fh * f, ww = bw * .42, wh = fh * .68, wx = x + b * bw + (bw - ww) / 2, wy = ft + fh * .15;
      o.box[f + ',' + b] = [wx, wy, ww, wh];
      if (f === 2 && b === o.door) continue;
      var lit = (o.lit || []).some(function (q) { return q[0] === f && q[1] === b; });
      ws += win(p, r, wx, wy, ww, wh, c, o.shade, lit, f === 2);
      var q = r();
      if (f < 2 && q < o.ac) ex += acUnit(p, wx + ww * .05, wy + wh + 18, ww * .9);
      else if (f < 2 && q < o.ac + o.grille) ex += grille(p, wx, wy, ww, wh);
      else if (f < 2 && r() < o.laundry) ex += laundry(r, wx - 26, wx + ww + 26, wy + wh * .6, p + '-sway');
    }
    return s + ws + ex;
  }
  function swayCss(p) {
    return '<style>.' + p + '-sway{transform-box:fill-box;transform-origin:50% 0;animation:' + p + '-sw 4.6s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-sw{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}</style>';
  }
  /* 电线：从 a 到 b 下垂 sag */
  function wire(x1, y1, x2, y2, sag, c, w) {
    return '<path d="M' + k(x1) + ' ' + k(y1) + 'Q' + k((x1 + x2) / 2) + ' ' + k((y1 + y2) / 2 + sag) + ' ' + k(x2) + ' ' + k(y2) + '" fill="none" stroke="' + (c || '#23272a') + '" stroke-width="' + (w || 2) + '"/>';
  }
  /* 浮尘 */
  function motes(p, r, n, x, y, w, h, col) {
    var s = '';
    for (var i = 0; i < n; i++)
      s += CI(x + r() * w, y + r() * h, .8 + r() * 1.8, col || '#fff4d8', 'class="' + p + '-mote" style="animation-delay:-' + k(r() * 12) + 's" ' + op(k(.25 + r() * .5)));
    return s;
  }
  function moteCss(p) {
    return '<style>.' + p + '-mote{animation:' + p + '-mf 12s ease-in-out infinite alternate}' +
      '@keyframes ' + p + '-mf{0%{transform:translate(0,0)}50%{transform:translate(14px,-18px)}100%{transform:translate(-10px,-34px)}}</style>';
  }
  /* 一簇树叶（左上受光） */
  function foliage(r, n, x, y, w, h, cols, skip) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var tx = x + r() * w, ty = y + r() * h;
      if (skip && skip(tx, ty)) continue;
      var rx = 16 + r() * 30, ry = 11 + r() * 18, c = pick(r, cols);
      s += EL(tx, ty, rx, ry, c) + EL(tx - rx * .25, ty - ry * .3, rx * .6, ry * .5, U.mix(c, '#c9b98a', .25), op(.5));
    }
    return s;
  }

  /* ================================================================ sanceng_ext */
  B.sanceng_ext = function () {
    var p = 'bg-scext', r = U.rng(85), d = '', s = '', i;
    d += LG(p + '-sky', 0, 0, 0, 1, [[0, '#7c8a93'], [.5, '#a9b1b0'], [1, '#d4cfbf']]);
    d += RG(p + '-sun', .04, .08, .8, [[0, '#ffe7b0', .8], [.35, '#f3d9a4', .3], [1, '#f3d9a4', 0]]);
    d += LG(p + '-wallv', 0, 0, 0, 1, [[0, '#000', 0], [.75, '#000', .02], [.93, '#1c1d15', .3], [1, '#1c1d15', .45]]);
    d += LG(p + '-side', 0, 0, 1, 0, [[0, '#51564f'], [1, '#3f4441']]);
    d += LG(p + '-glass', 0, 0, .6, 1, [[0, '#879399'], [.35, '#4a565d'], [1, '#232a2f']]);
    d += LG(p + '-lit', 0, 0, 0, 1, [[0, '#e9c88a'], [1, '#b98a52']]);
    d += LG(p + '-streak', 0, 0, 0, 1, [[0, '#3a382f', .38], [1, '#3a382f', 0]]);
    d += LG(p + '-gnd', 0, 0, 0, 1, [[0, '#7b7a70'], [.3, '#5f605a'], [1, '#34372f']]);
    d += LG(p + '-warm', 0, 0, 1, .25, [[0, '#ffd690', .34], [.5, '#ffd690', .1], [1, '#ffd690', 0]]);
    d += PAT(p + '-fw', 14, 16, '<rect x="3" y="4" width="8" height="5" fill="#8c979d"/>');
    d += facadeDefs(p);
    s += R(0, 0, 1600, 900, 'url(#' + p + '-sky)') + R(0, 0, 1600, 900, 'url(#' + p + '-sun)');
    for (i = 0; i < 8; i++) s += EL(150 + r() * 1350, 30 + r() * 250, 140 + r() * 260, 7 + r() * 14, '#ece6d6', op(k(.16 + r() * .2)));
    // 远处高楼（空气透视）
    var fx = 60;
    while (fx < 1600) {
      var fw = 36 + r() * 80, fh2 = 80 + r() * 240, fc = r() < .5 ? '#a2acb1' : '#97a2a8';
      s += R(fx, 480 - fh2, fw, fh2 + 20, fc) + R(fx + 3, 480 - fh2 + 8, fw - 6, fh2, 'url(#' + p + '-fw)', op(.5));
      if (r() < .3) s += R(fx + fw * .4, 480 - fh2 - 30, 3, 30, fc);
      fx += fw + r() * 40;
    }
    // 塔吊
    s += G(R(236, 150, 10, 330, '#8d989d') + LN(160, 150, 440, 150, '#8d989d', 6) + LN(241, 110, 160, 150, '#8d989d', 2) + LN(241, 110, 420, 150, '#8d989d', 2) +
      R(160, 150, 30, 16, '#8d989d') + LN(380, 150, 380, 240, '#8d989d', 1.5) + R(374, 240, 12, 8, '#8d989d'), op(.9));
    s += R(0, 470, 1600, 60, '#bdbfb6', op(.35));
    // 左侧老平房（中景，黑瓦坡顶）
    var hx = 120;
    for (i = 0; i < 3; i++) {
      var hw = 110 + r() * 50, ht = 450 + r() * 40;
      s += PG([hx - 12, ht, hx + hw / 2, ht - 46, hx + hw + 12, ht, hx + hw + 12, ht + 8, hx - 12, ht + 8], '#3f4543') + PG([hx + hw / 2, ht - 46, hx + hw + 12, ht, hx + hw / 2, ht], '#2f3533') +
        R(hx, ht + 8, hw, 650 - ht, '#8a887d') + R(hx + hw * .55, ht + 8, hw * .45, 650 - ht, '#000', op(.12));
      for (var j = 0; j < 2; j++) s += R(hx + 18 + j * (hw / 2), ht + 40, hw / 4, 50, '#2d3336') + R(hx + 14 + j * (hw / 2), ht + 90, hw / 4 + 8, 5, '#b4b1a4');
      hx += hw + 16;
    }
    // 主楼侧墙（背光）
    s += PG([1240, 42, 1332, 70, 1332, 636, 1240, 642], 'url(#' + p + '-side)');
    [[.35, .363], [.67, .68]].forEach(function (t) { s += PG([1240, 42 + 600 * t[0], 1332, 70 + 566 * t[0], 1332, 76 + 566 * t[0], 1240, 48 + 600 * t[0]], '#383c3a'); });
    for (i = 0; i < 6; i++) s += R(1246 + r() * 70, 80 + r() * 300, 6 + r() * 14, 80 + r() * 200, '#2c302e', op(.4));
    s += PG([1240, 36, 1336, 64, 1336, 76, 1240, 76], '#4a4f4c');
    // 屋顶天线（露出一截）
    s += LN(700, 40, 700, 0, '#3a3e3f', 2) + LN(686, 12, 714, 12, '#3a3e3f', 2) + LN(690, 24, 710, 24, '#3a3e3f', 2);
    s += LN(1080, 40, 1080, 4, '#3a3e3f', 2) + LN(1066, 16, 1094, 16, '#3a3e3f', 2);
    // 主楼立面
    var pal = { wall: '#9d9a8f', parapet: '#8f8d83', cornice: '#b9b6a8', sill: '#bdb9aa', lintel: '#aaa699', frame: '#5d584c', recess: '#2a2f31' };
    var fo = { x: 500, y: 40, w: 740, h: 602, bays: 5, par: 34, pal: pal, shade: true, door: 2, lit: [], ac: .28, grille: .28, laundry: .5, patches: 16, seed: 1937 };
    s += facade(p, fo);
    // 二楼窗口伸出的长竹竿 + 床单
    var b1 = fo.box['1,3'];
    s += LN(b1[0] + b1[2] / 2, b1[1] + b1[3] * .7, b1[0] + b1[2] / 2 + 150, b1[1] + b1[3] * .7 - 44, '#8a7a55', 4);
    s += PT('M' + k(b1[0] + b1[2] / 2 + 60) + ' ' + k(b1[1] + b1[3] * .7 - 17) + 'l62 -18v96l-62 14z', '#d9d5c9', 'class="' + p + '-sway"') + PT('M' + k(b1[0] + b1[2] / 2 + 60) + ' ' + k(b1[1] + b1[3] * .7 - 17) + 'l62 -18v96l-62 14z', '#6d6a5e', op(.18));
    // 入口与居委会牌子
    var db = fo.box['2,2'], dw = 78, dx = db[0] + db[2] / 2 - dw / 2, dy = db[1] - 6;
    s += R(dx - 18, dy - 22, dw + 36, 14, '#b4b0a2') + R(dx - 18, dy - 8, dw + 36, 10, '#000', op(.28)) + R(dx, dy, dw, 642 - dy, '#15191b') +
      PG([dx, dy, dx + dw, dy, dx + dw, dy + 20, dx + 14, 642, dx, 642], '#000', op(.35)) +
      R(dx + 24, dy + 44, 30, 50, '#3a3a33', op(.6)) + R(dx - 18, 634, dw + 36, 8, '#aaa698');
    s += R(dx + dw + 14, dy + 8, 28, 118, '#e7e3d6') + R(dx + dw + 14, dy + 8, 28, 118, 'none', 'stroke="#6c6a60" stroke-width="2"') +
      TXV(dx + dw + 28, dy + 26, 14, '#2c2a26', '三层楼居委会') + R(dx + dw + 42, dy + 14, 6, 118, '#000', op(.2));
    s += R(dx - 58, dy + 30, 36, 24, '#2a4f7c') + TX(dx - 40, dy + 47, 12, '#e8eef4', '85', 'text-anchor="middle"');
    // 午后暖光（从左上）
    s += PG([500, 40, 1240, 40, 1240, 260, 500, 642], 'url(#' + p + '-warm)');
    // 楼脚自行车
    for (i = 0; i < 3; i++) {
      var bx = 640 + i * 56, by = 624;
      s += G(CI(bx, by, 17, 'none', 'stroke="#23282a" stroke-width="3"') + CI(bx + 44, by, 17, 'none', 'stroke="#23282a" stroke-width="3"') +
        SK('M' + bx + ' ' + by + 'l16-26h22l6 26M' + (bx + 16) + ' ' + (by - 26) + 'l6 26 16-26M' + (bx + 14) + ' ' + (by - 34) + 'h8M' + (bx + 38) + ' ' + (by - 26) + 'l-3-10h8', '#23282a', 3), op(.85));
    }
    // 地面
    s += R(0, 640, 1600, 260, 'url(#' + p + '-gnd)') + R(0, 640, 1600, 10, '#a19e92') + R(0, 650, 1600, 6, '#000', op(.2));
    s += PG([0, 700, 112, 650, 560, 900, 0, 900], '#000', op(.22));
    s += PG([318, 656, 342, 656, 780, 900, 700, 900], '#000', op(.2));
    for (i = 0; i < 10; i++) s += R(r() * 1600, 690 + r() * 200, 60 + r() * 180, 2, '#000', op(.12));
    // 电线杆 + 电线
    s += wire(292, 64, 1600, 150, 70) + wire(368, 64, 1240, 76, 40) + wire(300, 64, 0, 130, 30) + wire(360, 96, 1600, 270, 110, '#1d2123', 1.6) +
      wire(300, 96, 500, 300, 30, '#1d2123', 1.6) + wire(330, 96, 1240, 330, 80, '#1d2123', 1.4) + wire(0, 40, 1600, 60, 60, '#2a2e30', 1.2);
    s += R(318, 0, 26, 720, '#3a3e3c') + R(318, 0, 7, 720, '#6d6f66') + R(268, 58, 124, 9, '#2c302f') + R(276, 92, 108, 7, '#2c302f');
    for (i = 0; i < 5; i++) s += R(282 + i * 24, 50, 7, 10, '#c9c7bb');
    s += R(300, 300, 62, 70, '#4a4e4a') + R(304, 304, 54, 62, '#5b5f5a') + R(300, 300, 8, 70, '#6d6f66');
    for (i = 0; i < 9; i++) s += R(320 + r() * 16, 420 + r() * 200, 12 + r() * 10, 14 + r() * 14, pick(r, ['#d9d6c8', '#e8e2c8', '#c7cdd0']), op(.85));
    // 弄口门柱（前景剪影）+ 路牌
    s += R(0, 0, 112, 900, '#23282a') + R(0, 110, 124, 26, '#2c3133') + R(0, 104, 128, 8, '#3b4042') + R(106, 136, 6, 764, '#343a3b');
    for (i = 0; i < 14; i++) s += R(0, 150 + i * 52, 106, 2, '#1a1e20');
    s += R(14, 318, 90, 58, '#1e4a7a') + R(17, 321, 84, 52, 'none', 'stroke="#e8eef4" stroke-width="1.5"') +
      TX(59, 344, 17, '#eef2f6', '裕通路', 'text-anchor="middle"') + TX(59, 366, 16, '#eef2f6', '85弄', 'text-anchor="middle"');
    // 右上梧桐（前景）
    s += SK('M1600 260 C1520 210 1470 150 1420 50 M1540 180 C1500 160 1470 170 1440 140 M1600 120 C1560 100 1530 60 1520 0', '#262c28', 10);
    s += foliage(r, 34, 1380, -20, 240, 260, ['#2c3a30', '#35463a', '#253028', '#415444'], function (x, y) { return x < 1440 && y > 150; });
    s += swayCss(p);
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .5));
  };

  /* ================================================================ sanceng_center */
  B.sanceng_center = function () {
    var p = 'bg-sccen', r = U.rng(3701), d = '', s = '', i;
    d += LG(p + '-sky', 0, 0, 0, 1, [[0, '#4a535a'], [.45, '#6f777c'], [.75, '#9a9e9a'], [1, '#aeb0a8']]);
    d += RG(p + '-halo', .5, .28, .42, [[0, '#d8d8cc', .6], [1, '#d8d8cc', 0]]);
    d += RG(p + '-cl', .5, .5, .5, [[0, '#3a4249', .75], [1, '#3a4249', 0]]);
    d += LG(p + '-wallv', 0, 0, 0, 1, [[0, '#000', 0], [.7, '#000', 0], [1, '#000', .3]]);
    d += LG(p + '-glass', 0, 0, .5, 1, [[0, '#6f7a7f'], [.4, '#3c464c'], [1, '#1e2428']]);
    d += LG(p + '-lit', 0, 0, 0, 1, [[0, '#f0d49a'], [1, '#c89a5c']]);
    d += LG(p + '-streak', 0, 0, 0, 1, [[0, '#2f2e28', .42], [1, '#2f2e28', 0]]);
    d += LG(p + '-lw', 0, 0, 1, 0, [[0, '#2c312e'], [1, '#4f5450']]);
    d += LG(p + '-rw', 0, 0, 1, 0, [[0, '#5b605b'], [1, '#363b38']]);
    d += LG(p + '-gnd', 0, 0, 0, 1, [[0, '#6c6e68'], [.3, '#4d504b'], [1, '#232624']]);
    d += facadeDefs(p);
    s += R(0, 0, 1600, 900, 'url(#' + p + '-sky)') + R(0, 0, 1600, 900, 'url(#' + p + '-halo)');
    var cl = '';
    for (i = 0; i < 18; i++) cl += EL(r() * 1600, 10 + r() * 300, 160 + r() * 300, 26 + r() * 50, 'url(#' + p + '-cl)');
    s += '<g class="' + p + '-drift">' + cl + '</g>';
    // 地面（先铺满到地平线）
    s += R(0, 540, 1600, 360, 'url(#' + p + '-gnd)');
    // 远景：极淡的高楼群
    var fx = 0;
    while (fx < 1600) {
      var fw = 40 + r() * 70, fh = 30 + r() * 130;
      s += R(fx, 548 - fh, fw, fh, '#8d928f', op(.5));
      fx += fw + 20 + r() * 90;
    }
    s += R(0, 525, 1600, 30, '#9a9c95', op(.45));
    // 拆迁空地：土堆、碎砖
    var mound = 'M300 590';
    for (i = 0; i <= 20; i++) mound += 'L' + k(300 + i * 50) + ' ' + k(560 - r() * 20 - (i > 5 && i < 15 ? 0 : 10));
    s += PT(mound + 'L1300 590Z', '#5a5b55');
    for (i = 0; i < 30; i++) s += R(420 + r() * 760, 552 + r() * 30, 6 + r() * 16, 3 + r() * 6, pick(r, ['#77776d', '#4b4c47', '#8a6f5c']));
    s += PG([470, 590, 470, 522, 490, 514, 505, 532, 530, 528, 530, 590], '#4c4e4a') + PG([1110, 590, 1110, 508, 1128, 502, 1150, 524, 1150, 590], '#51534e');
    // 一棵瘦树
    s += SK('M548 585 C552 500 540 460 520 420 M545 500 C570 470 585 450 600 430 M532 450 C510 430 505 420 492 400', '#2c302d', 5);
    s += foliage(r, 12, 490, 385, 120, 70, ['#3b463d', '#333d35']);
    // 中央楼：屋顶楼梯间、水箱、天线
    s += PG([985, 64, 1030, 80, 1030, 568, 985, 570], '#3a3f3d');
    for (i = 0; i < 4; i++) s += R(990 + r() * 30, 90 + r() * 200, 5 + r() * 8, 80 + r() * 200, '#2c302e', op(.5));
    s += R(632, 26, 72, 40, '#6f716b') + R(652, 40, 22, 26, '#2a2e30') + R(632, 26, 72, 5, '#8a8b82');
    s += R(906, 40, 54, 26, '#63655f') + EL(933, 40, 27, 5, '#7b7d75');
    s += LN(760, 66, 760, 6, '#2e3233', 2) + LN(746, 16, 774, 16, '#2e3233', 2) + LN(749, 26, 771, 26, '#2e3233', 2) + LN(752, 36, 768, 36, '#2e3233', 2);
    s += LN(870, 66, 870, 20, '#2e3233', 1.6) + LN(860, 28, 880, 28, '#2e3233', 1.6);
    var pal = { wall: '#86857c', parapet: '#7a7a72', cornice: '#9c9a8f', sill: '#a19f93', lintel: '#94928a', frame: '#4a4740', recess: '#22272a' };
    var fo = { x: 615, y: 64, w: 370, h: 506, bays: 4, par: 28, pal: pal, shade: false, door: 1, lit: [[0, 2]], ac: .15, grille: .35, laundry: .3, patches: 12, seed: 606 };
    s += facade(p, fo);
    var db = fo.box['2,1'], dx = db[0] + db[2] / 2 - 28;
    s += R(dx - 12, db[1] - 16, 80, 10, '#9c9a8f') + R(dx, db[1] - 6, 56, 576 - db[1], '#121618') + R(dx - 12, 564, 80, 6, '#8e8c82');
    // 二楼那扇窗帘拉得严严实实的窗（张轻）
    var zb = fo.box['1,2'];
    s += R(zb[0] + 5, zb[1] + 5, zb[2] - 10, zb[3] - 8, '#4a3f38') + R(zb[0] + 5, zb[1] + 5, zb[2] - 10, zb[3] - 8, 'url(#' + p + '-bars)', op(.25));
    // 楼后透出的一片亮天，把楼压成半剪影
    s += R(615, 64, 370, 506, '#20282c', op(.12));
    // 弄堂两侧墙（VP 800,545）
    var VX = 800, VY = 545;
    function ty(x) { return 110 + (VY - 110) * x / VX; }
    function by(x) { return 900 - (900 - VY) * x / VX; }
    var LQ = [0, ty(0), 500, ty(500), 500, by(500), 0, by(0)];
    var RQ = [1600, ty(0), 1100, ty(500), 1100, by(500), 1600, by(0)];
    function lane(q, fill, side) {
      var t = PG(q, fill);
      // 墙面污渍
      for (var n = 0; n < 7; n++) { var u = r() * .9; t += PG(qrect(q, u, .05 + r() * .3, u + .03 + r() * .06, .6 + r() * .4), '#000', op(k(.05 + r() * .08))); }
      // 楼层腰线
      t += PG(qrect(q, 0, .47, 1, .49), '#6a6e68') + PG(qrect(q, 0, .49, 1, .51), '#000', op(.2));
      // 屋檐
      t += PG([q[0], q[1], q[2], q[3], q[2], q[3] - 26, q[0], q[1] - 110], '#1b1f1f') + PG([q[0], q[1], q[2], q[3], q[2], q[3] - 5, q[0], q[1] - 18], '#2c3130');
      // 分户落水管
      [.18, .5, .78].forEach(function (u) { t += PG(qrect(q, u, 0, u + .012, 1), '#262a29'); });
      // 窗与后门
      [[.04, .15], [.25, .36], [.56, .64], [.83, .89]].forEach(function (a) {
        t += PG(qrect(q, a[0], .14, a[1], .38), '#1c2124') + PG(qrect(q, a[0], .37, a[1] + .01, .4), '#6e716a');
        t += PG(qrect(q, a[0], .14, (a[0] + a[1]) / 2, .38), pick(r, ['#5f6b5a', '#6e7f86', '#8a8f7a']), op(.5));
        t += PG(qrect(q, a[0] + .01, .6, a[1] - .01, .98), '#1a1d1e') + PG(qrect(q, a[0] - .006, .57, a[1] + .006, .6), '#747770');
      });
      // 电表箱、门灯
      t += PG(qrect(q, .41, .42, .46, .5), '#5b5f59') + PG(qrect(q, .7, .52, .72, .55), '#c9c3a8', op(.6));
      // 墙的尽头：一道受光的转角
      t += PG([q[2] - (side ? -4 : 4), q[3], q[2], q[3], q[4], q[5], q[4] - (side ? -4 : 4), q[5]], '#7d817a');
      return t;
    }
    s += lane(LQ, 'url(#' + p + '-lw)', 0) + lane(RQ, 'url(#' + p + '-rw)', 1);
    // 左墙窗外晾衣竿伸向弄堂
    s += LN(120, 250, 330, 300, '#7a6c4f', 4);
    for (i = 0; i < 4; i++) s += garment(r, 160 + i * 44, 258 + i * 10.5, p + '-sway');
    // 地面：水泥板缝 + 水洼
    for (i = 1; i < 9; i++) { var gy = 545 + 355 / (1 + (9 - i) * .55); s += LN(0, gy, 1600, gy, '#000', 1.2, op(.14)); }
    s += EL(760, 740, 150, 18, '#a3a8a5', op(.35)) + R(752, 726, 18, 30, '#3d423f', op(.3)) + EL(1010, 690, 80, 9, '#a3a8a5', op(.3)) + EL(520, 800, 110, 14, '#a3a8a5', op(.25));
    // 电线与乌鸦
    s += wire(0, 190, 1600, 170, 90) + wire(0, 60, 1600, 90, 120, '#1c2022', 1.6) + wire(230, 230, 1370, 240, 50, '#1c2022', 1.4) + wire(420, 330, 615, 300, 20, '#1c2022', 1.2);
    var crow = function (x, y) { return PT('M' + x + ' ' + y + 'c3-8 10-9 13-4l6 1-5 3 1 8-4 2-2-7c-5 1-8 0-9-3z', '#15181a'); };
    s += crow(1040, 226) + crow(1070, 229);
    s += '<style>.' + p + '-drift{animation:' + p + '-dr 60s linear infinite alternate}@keyframes ' + p + '-dr{to{transform:translateX(-80px)}}</style>' + swayCss(p);
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .62));
  };

  /* ================================================================ juweihui */
  B.juweihui = function () {
    var p = 'bg-jwh', r = U.rng(2004), d = '', s = '', i, j;
    // VP (800,330)；后墙 x240–1360 y60–600
    function yt(x) { return x <= 800 ? 60 - .482 * (240 - x) : 60 - .482 * (x - 1360); }
    function yb(x) { return x <= 800 ? 600 + .482 * (240 - x) : 600 + .482 * (x - 1360); }
    d += LG(p + '-wu', 0, 0, 0, 1, [[0, '#a9a99e'], [1, '#c3c1b3']]);
    d += LG(p + '-wg', 0, 0, 0, 1, [[0, '#6f8879'], [1, '#56695d']]);
    d += LG(p + '-lw', 0, 0, 1, 0, [[0, '#6f716a'], [1, '#9a9b8f']]);
    d += LG(p + '-rw', 0, 0, 1, 0, [[0, '#8d8e83'], [1, '#5e605a']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#86847a'], [1, '#4c4b45']]);
    d += RG(p + '-tube', .5, .5, .5, [[0, '#eef8f4', .85], [.3, '#dff0ec', .35], [1, '#dff0ec', 0]]);
    d += LG(p + '-beam', 0, 0, 1, 1, [[0, '#ffe2a8', .55], [.7, '#ffe2a8', .12], [1, '#ffe2a8', 0]]);
    d += LG(p + '-cab', 0, 0, 1, 0, [[0, '#7a8a80'], [.5, '#6c7b72'], [1, '#56625b']]);
    d += LG(p + '-sky', 0, 0, 0, 1, [[0, '#f4ead0'], [1, '#d9cfae']]);
    d += LG(p + '-pen', 0, 0, 1, 0, [[0, '#8e211d'], [.45, '#b53a30'], [1, '#7e1c19']]);
    // 墙面
    s += R(0, 0, 1600, 900, '#2b2e2c');
    s += PG([115.5, 0, 1484.5, 0, 1360, 60, 240, 60], '#5b5e58');
    s += R(240, 60, 1120, 360, 'url(#' + p + '-wu)') + R(240, 416, 1120, 184, 'url(#' + p + '-wg)') + R(240, 412, 1120, 6, '#4b5e52');
    for (i = 0; i < 12; i++) s += R(260 + r() * 1040, 70 + r() * 320, 30 + r() * 120, 20 + r() * 80, r() < .6 ? '#8f8d80' : '#d6d3c4', op(k(.08 + r() * .1)));
    var LWQ = [0, 0, 240, 60, 240, 600, 0, 715.7];
    s += PG([0, 0, 115.5, 0, 240, 60, 240, 600, 0, 715.7], 'url(#' + p + '-lw)');
    s += PG([0, yt(0) + (yb(0) - yt(0)) * .75, 240, 416, 240, 600, 0, 715.7], '#566a5e', op(.9));
    var RWQ = [1360, 60, 1600, 0, 1600, 715.7, 1360, 600];
    s += PG([1600, 0, 1484.5, 0, 1360, 60, 1360, 600, 1600, 715.7], 'url(#' + p + '-rw)');
    s += PG([1600, yt(1600) + (yb(1600) - yt(1600)) * .75, 1360, 416, 1360, 600, 1600, 715.7], '#4c5d53', op(.9));
    s += PG([0, 715.7, 240, 600, 1360, 600, 1600, 715.7, 1600, 900, 0, 900], 'url(#' + p + '-fl)');
    // 水磨石地坪的缝
    for (i = 0; i < 9; i++) s += LN(800 + (i - 4) * 150, 600, 800 + (i - 4) * 480, 900, '#000', 1.5, op(.1));
    for (i = 0; i < 3; i++) { var fy = 640 + i * i * 40 + i * 30; s += LN(0, fy, 1600, fy, '#000', 1.5, op(.09)); }
    // 右墙：通走廊的门（带气窗）
    s += PG(qrect(RWQ, .3, .22, .66, 1), '#3b3a33') + PG(qrect(RWQ, .33, .36, .63, 1), '#6b5a44') + PG(qrect(RWQ, .33, .25, .63, .33), '#b9c2bb', op(.7));
    s += PG(qrect(RWQ, .37, .42, .59, .62), '#000', op(.12)) + PG(qrect(RWQ, .37, .68, .59, .92), '#000', op(.12)) + PG(qrect(RWQ, .38, .64, .41, .67), '#c9b37a');
    // 右墙：值班小黑板
    s += PG(qrect(RWQ, .72, .18, .92, .4), '#5b4632') + PG(qrect(RWQ, .74, .21, .9, .38), '#2e3a33');
    for (i = 0; i < 4; i++) s += PG(qrect(RWQ, .76, .25 + i * .03, .86 - r() * .05, .26 + i * .03), '#d9dcd2', op(.6));
    // 左墙窗（带铁栅）
    var WQ = [50, 113, 175, 149.2, 175, 426.4, 50, 445.6];
    s += PG([40, 100, 185, 139, 185, 436, 40, 458], '#3d403b') + PG(WQ, 'url(#' + p + '-sky)');
    for (i = 0; i < 10; i++) s += EL(60 + r() * 110, 150 + r() * 120, 16 + r() * 14, 10 + r() * 10, '#8e9a7e', op(.55));
    for (i = 1; i < 6; i++) s += PG(qrect(WQ, i / 6 - .012, 0, i / 6 + .012, 1), '#2d302c');
    s += PG(qrect(WQ, 0, .38, 1, .41), '#4d4a40') + PG(qrect(WQ, .47, 0, .53, 1), '#4d4a40');
    s += PG([40, 458, 185, 436, 195, 444, 50, 470], '#8c8a7e');
    // 左墙：一条长木凳
    s += PG(qrect(LWQ, .25, .8, .92, .83), '#6b5238') + PG(qrect(LWQ, .25, .83, .92, .85), '#4d3a28') + PG(qrect(LWQ, .3, .85, .33, 1), '#3e2e20') + PG(qrect(LWQ, .86, .85, .88, 1), '#3e2e20');
    // 窗投下的光束与地上光斑（窗四角 → 地面四角）
    var FP = [600, 860, 690, 790, 420, 650, 300, 690];
    s += PG([50, 113, 175, 149, 690, 790, 600, 860, 300, 690, 50, 446], 'url(#' + p + '-beam)', op(.5));
    s += PG(FP, '#f5d9a0', op(.3));
    for (i = 1; i < 6; i++) s += PG(qrect(FP, i / 6 - .015, 0, i / 6 + .015, 1), '#3a3a33', op(.28));
    s += PG(qrect(FP, 0, .38, 1, .42), '#3a3a33', op(.28));
    // 宣传栏
    s += R(282, 146, 250, 190, '#5a4632') + R(292, 156, 230, 170, '#d7d3c2') + R(292, 156, 230, 26, '#a8332b') + TX(407, 175, 17, '#f4e8c8', '居 民 公 告 栏', 'text-anchor="middle"');
    for (i = 0; i < 7; i++) {
      var nx = 300 + (i % 4) * 55 + r() * 6, ny = 190 + Math.floor(i / 4) * 66 + r() * 6;
      s += R(nx, ny, 46, 56, pick(r, ['#f2efe3', '#e8e0c4', '#f5f3ea', '#e9c9b8']), 'transform="rotate(' + k((r() - .5) * 6) + ' ' + nx + ' ' + ny + ')"');
      for (j = 0; j < 5; j++) s += R(nx + 5, ny + 8 + j * 8, 34 - r() * 10, 2, '#6c685c', op(.6));
    }
    s += PG([292, 156, 380, 156, 300, 326, 292, 326], '#fff', op(.12));
    // 锦旗
    var PEN = ['为民服务', '排忧解难', '热心公益', '情系百姓'];
    for (i = 0; i < 4; i++) {
      var px = 580 + i * 98, py = 124;
      s += R(px - 6, py - 6, 84, 5, '#6e5a3c') + CI(px + 36, py - 12, 3, '#3a3a33') + LN(px - 4, py - 4, px + 36, py - 12, '#3a3a33', 1) + LN(px + 76, py - 4, px + 36, py - 12, '#3a3a33', 1);
      s += PT('M' + px + ' ' + py + 'h72v150l-36 18-36-18z', 'url(#' + p + '-pen)') + PT('M' + (px + 5) + ' ' + (py + 5) + 'h62v140l-31 15-31-15z', 'none', 'stroke="#d9b45a" stroke-width="1.5"');
      s += TXV(px + 36, py + 40, 17, '#f0cf6a', PEN[i]);
      s += PT('M' + px + ' ' + (py + 150) + 'l36 18 36-18', 'none', 'stroke="#d9b45a" stroke-width="7" stroke-dasharray="1.5 4.5" transform="translate(0 7)"');
      s += PT('M' + (px + 72) + ' ' + py + 'v150l-10 5v-155z', '#000', op(.15));
    }
    // 挂钟、日历
    s += CI(1040, 130, 26, '#e9e5d6') + CI(1040, 130, 26, 'none', 'stroke="#3d3a33" stroke-width="4"') + LN(1040, 130, 1040, 112, '#222', 2.5) + LN(1040, 130, 1053, 138, '#222', 2);
    s += R(990, 182, 84, 104, '#efeadb') + R(990, 182, 84, 26, '#b8322a') + TX(1032, 201, 15, '#fff3dc', '2004', 'text-anchor="middle"') + TX(1032, 236, 26, '#b8322a', '六月', 'text-anchor="middle"');
    s += R(996, 246, 72, 30, 'url(#' + p + '-cal)');
    d += PAT(p + '-cal', 11, 11, '<rect width="7" height="5" fill="#77736a"/>');
    // 文件柜
    for (i = 0; i < 3; i++) {
      var cx = 1090 + i * 88;
      s += R(cx, 290, 84, 310, 'url(#' + p + '-cab)') + R(cx, 290, 84, 6, '#95a399') + LN(cx + 42, 300, cx + 42, 590, '#3b453f', 2);
      s += R(cx + 34, 420, 4, 30, '#c7ccc6') + R(cx + 46, 420, 4, 30, '#c7ccc6') + R(cx + 12, 318, 22, 12, '#e4e1d4') + R(cx + 50, 318, 22, 12, '#e4e1d4');
      s += R(cx + 2, 592, 80, 8, '#2b312d') + R(cx + 60, 296, 24, 294, '#000', op(.08));
    }
    s += PG([1178, 300, 1210, 296, 1210, 590, 1178, 592], '#2e3531') + R(1180, 330, 6, 40, '#c9b37a') + R(1188, 336, 6, 44, '#8ea2a8') + R(1180, 400, 12, 34, '#d8d0b8');
    s += R(1098, 252, 70, 38, '#9a7b52') + R(1098, 252, 70, 8, '#b18e60') + R(1190, 262, 60, 28, '#d9d3bf') + R(1194, 256, 52, 8, '#c9c2aa');
    // 柜顶一盆绿萝
    s += PT('M1284 290 l6 -26 h36 l6 26z', '#8a5a3a') + foliage(r, 8, 1280, 240, 56, 26, ['#4f6e4a', '#5f8456']);
    s += SK('M1300 262 c-6 20 -4 40 -10 70 M1318 262 c8 30 4 50 12 90', '#4f6e4a', 3);
    // 落地电扇
    s += R(292, 430, 6, 170, '#3c403c') + EL(295, 602, 30, 7, '#2d302d') + CI(295, 400, 42, '#454a46') + CI(295, 400, 38, '#8c948f') + CI(295, 400, 38, 'none', 'stroke="#555b57" stroke-width="1" stroke-dasharray="3 3"') + CI(295, 400, 8, '#3c403c');
    // 办公桌（玻璃台面）
    s += PG([500, 506, 1010, 506, 1026, 522, 486, 522], '#8a6c4a') + PG([500, 506, 1010, 506, 1026, 522, 486, 522], '#cfe0dc', op(.18));
    s += R(486, 522, 540, 12, '#5e4631') + R(496, 534, 150, 96, '#6d5238') + R(866, 534, 150, 96, '#6d5238') + R(646, 534, 220, 20, '#5a4330');
    for (i = 0; i < 3; i++) s += R(504, 542 + i * 29, 134, 24, '#7a5d40') + R(874, 542 + i * 29, 134, 24, '#7a5d40') + R(564, 552 + i * 29, 16, 4, '#c8b88e') + R(934, 552 + i * 29, 16, 4, '#c8b88e');
    s += R(646, 554, 220, 80, '#000', op(.45));
    // 椅背
    s += R(700, 440, 8, 70, '#5a4330') + R(790, 440, 8, 70, '#5a4330') + R(700, 446, 98, 10, '#6d5238') + R(700, 470, 98, 8, '#6d5238');
    // 桌面物件：搪瓷杯、卷宗、拨盘电话、信纸、热水瓶
    function mug(x, y) { return R(x, y, 26, 30, '#efece3') + EL(x + 13, y, 13, 4, '#2b2b27') + R(x, y, 26, 4, '#1f3f6e') + CI(x + 13, y + 16, 5, '#b8322a') + SK('M' + (x + 26) + ' ' + (y + 8) + 'c10 0 10 14 0 14', '#efece3', 3); }
    s += mug(560, 478) + mug(900, 480);
    s += R(620, 490, 90, 16, '#c9b98e') + R(624, 482, 84, 10, '#d8caa2') + R(618, 476, 88, 8, '#bca97c');
    s += PT('M760 506 c0-22 10-28 30-28 s30 6 30 28z', '#1b1c1c') + R(770, 468, 44, 12, '#1b1c1c', 'rx="6"') + CI(790, 492, 9, '#3a3a38') + CI(790, 492, 4, '#1b1c1c');
    s += R(836, 494, 50, 12, '#e8e3d0') + R(840, 488, 44, 8, '#f0ecdd', 'transform="rotate(-4 840 488)"');
    s += R(452, 440, 30, 90, '#b33a2e', 'rx="6"') + R(456, 428, 22, 14, '#3b3b35') + EL(467, 486, 9, 16, '#e7c56a', op(.7));
    // 日光灯（吊杆）
    [[470, 690], [910, 1130]].forEach(function (a, ix) {
      s += LN(a[0] + 20, 0, a[0] + 20, 90, '#2b2d2b', 2) + LN(a[1] - 20, 0, a[1] - 20, 90, '#2b2d2b', 2);
      s += PG([a[0] - 6, 88, a[1] + 6, 88, a[1] - 4, 98, a[0] + 4, 98], '#4a4d49');
      s += EL((a[0] + a[1]) / 2, 102, 190, 40, 'url(#' + p + '-tube)', ix ? 'class="' + p + '-flk"' : '');
      s += R(a[0] + 6, 98, a[1] - a[0] - 12, 7, '#f2fbf8', ix ? 'class="' + p + '-flk"' : '');
    });
    // 墙上走明线（瓷夹板）
    s += LN(240, 70, 1360, 70, '#3a3c38', 2);
    for (i = 0; i < 8; i++) s += CI(280 + i * 150, 70, 4, '#dcd8ca');
    s += R(0, 0, 1600, 900, '#1b2a2a', op(.08));
    s += '<style>.' + p + '-flk{animation:' + p + '-fk 7s steps(1) infinite}@keyframes ' + p + '-fk{0%,91%,95%{opacity:1}92%,94%{opacity:.25}93%{opacity:.7}}</style>';
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .55));
  };

  /* ================================================================ sanceng_stairs */
  B.sanceng_stairs = function () {
    var p = 'bg-scst', r = U.rng(1937), d = '', s = '', i;
    d += LG(p + '-cor', 0, 0, 0, 1, [[0, '#7d887f'], [1, '#56605a']]);
    d += LG(p + '-door', 0, 0, 1, 0, [[0, '#b5402f'], [.6, '#9a3225'], [1, '#6e2219']]);
    d += LG(p + '-shaft', 0, 0, 1, 0, [[0, '#dfe8de', .55], [1, '#dfe8de', 0]]);
    d += RG(p + '-pool', .5, .5, .5, [[0, '#d9e2d6', .5], [1, '#d9e2d6', 0]]);
    d += LG(p + '-lw', 0, 0, 0, 1, [[0, '#3a4440'], [.5, '#262d2b'], [1, '#161a19']]);
    d += LG(p + '-spill', 0, 0, 0, 1, [[0, '#cfd8cc', .28], [1, '#cfd8cc', 0]]);
    d += LG(p + '-hall', 0, 0, 0, 1, [[0, '#101313'], [.6, '#1b201f'], [1, '#232826']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#262320'], [1, '#141312']]);
    // 一楼大厅（暗）
    s += R(0, 0, 1600, 900, '#0e1111') + R(0, 54, 1600, 646, 'url(#' + p + '-hall)');
    for (i = 0; i < 10; i++) s += R(r() * 1500, 120 + r() * 480, 40 + r() * 140, 30 + r() * 110, r() < .5 ? '#000' : '#39403d', op(k(.1 + r() * .12)));
    s += R(0, 560, 1600, 140, '#1d2a25', op(.6)) + R(0, 556, 1600, 5, '#0c0f0e');
    // 一楼地面（木地板）
    s += R(0, 700, 1600, 200, 'url(#' + p + '-fl)') + R(0, 694, 1600, 8, '#0b0d0c');
    for (i = 0; i < 16; i++) s += LN(800 + (i - 8) * 110, 700, 800 + (i - 8) * 260, 900, '#000', 1.5, op(.35));
    // 楼梯
    var VY = 250, N = 16, K = 188.75, Y = 510;
    function zy(z, h) { return VY + (Y - h * K) / z; }
    function hw(z) { return 280 / z; }
    var zN = 1 + N * .1, yl = zy(zN, 1.6);
    // 二楼走廊（远景）
    var DX1 = 752, DX2 = 848, DT = 132, DB = 318;
    s += PG([692, 30, 908, 30, 908, yl, 692, yl], 'url(#' + p + '-cor)');
    s += PG([692, 30, 740, 112, 740, DB, 692, yl], '#6b766e') + PG([908, 30, 860, 112, 860, DB, 908, yl], '#4f5953');
    s += PG([692, 30, 908, 30, 860, 112, 740, 112], '#3c433f');
    s += PG([692, yl, 908, yl, 860, DB, 740, DB], '#5d5245');
    // 走廊左墙的窗 → 光
    s += PG([700, 110, 726, 132, 726, 250, 700, 262], '#eef2e6');
    s += PG([700, 110, 726, 132, 726, 250, 700, 262, 860, 330, 860, 200], 'url(#' + p + '-shaft)', op(.55));
    // 朱红门
    s += R(DX1 - 8, DT - 8, DX2 - DX1 + 16, DB - DT + 8, '#3c2a22') + R(DX1, DT, DX2 - DX1, DB - DT, 'url(#' + p + '-door)');
    [[10, 14], [54, 14], [10, 100], [54, 100]].forEach(function (a) { s += R(DX1 + a[0], DT + a[1], 32, 70, '#000', op(.15)) + R(DX1 + a[0], DT + a[1] + 68, 32, 2, '#e06a50', op(.3)); });
    s += CI(DX2 - 14, 232, 4, '#d8b25a') + R(DX1, DT, DX2 - DX1, DB - DT, 'url(#' + p + '-pool)');
    s += PG([DX1, 200, DX2, 240, DX2, 300, DX1, 280], '#ffe9c8', op(.18));
    // 踏步
    var st = '';
    for (i = 1; i <= N; i++) {
      var z = 1 + (i - 1) * .1, z2 = z + .1, h0 = (i - 1) * .1, h1 = i * .1;
      var y1 = zy(z, h1), y0 = zy(z, h0), yk = zy(z2, h1), w1 = hw(z), w2 = hw(z2), lt = i / N;
      st += PG([800 - w1, y1, 800 + w1, y1, 800 + w1, y0, 800 - w1, y0], U.mix('#1c1714', '#3d332a', lt));
      st += PG([800 - w1, y1, 800 + w1, y1, 800 + w2, yk, 800 - w2, yk], U.mix('#3a2e24', '#8a7358', lt * lt));
      st += PG([800 - w1, y1 - 1, 800 + w1, y1 - 1, 800 + w1, y1 + 2.5, 800 - w1, y1 + 2.5], U.mix('#4a3c2e', '#b39a78', lt), op(.8));
      st += EL(800 - w1 * .15, (y1 + yk) / 2, w1 * .35, (y1 - yk) * .3, '#c9b08a', op(k(.05 + lt * .12)));
    }
    s += st + PG([692, yl, 908, yl, 1080, 780, 520, 780], 'url(#' + p + '-spill)');
    // 楼梯左侧墙
    s += PG([520, 40, 692, 30, 692, yl, 520, 780], 'url(#' + p + '-lw)') + PG([520, 40, 692, 30, 692, 110, 520, 300], '#56625c', op(.35));
    s += PG([520, 700, 692, yl - 30, 692, yl - 22, 520, 712], '#4a4036');
    s += PG([520, 600, 692, yl - 60, 692, yl - 30, 520, 700], '#1f2a26', op(.5));
    // 右侧栏杆
    var hx0 = 1080, hy0 = 560, hx1 = 908, hy1 = 318, bal = '';
    for (i = 0; i <= 15; i++) {
      var tt = i / 15, bx = hx0 + (hx1 - hx0) * tt, byy = hy0 + (hy1 - hy0) * tt, fy = zy(1 + tt * 1.6, tt * 1.6);
      bal += R(bx - 2.5 * (1.2 - tt * .6), byy, 5 * (1.2 - tt * .6), fy - byy, '#2a211a');
    }
    s += bal + PG([hx0 - 4, hy0 - 10, hx1, hy1 - 6, hx1, hy1 + 2, hx0 - 4, hy0 + 4], '#5b4634') + PG([hx0 - 4, hy0 - 10, hx1, hy1 - 6, hx1, hy1 - 3, hx0 - 4, hy0 - 5], '#9c8061');
    s += R(1070, 520, 36, 270, '#3a2d22') + R(1064, 510, 48, 16, '#5b4634') + R(1070, 520, 8, 270, '#6a533d') + EL(1088, 790, 40, 6, '#000', op(.4));
    // 二楼楼板截面（前景顶部）
    s += R(0, 0, 1600, 44, '#0c0f0f') + R(0, 40, 520, 14, '#1c1f1d') + R(1080, 40, 520, 14, '#1c1f1d');
    for (i = 0; i < 9; i++) s += R(i * 200 - 10, 0, 34, 54, '#161918');
    // 左侧：信箱、电表、自行车、旧告示
    for (i = 0; i < 12; i++) s += R(150 + (i % 4) * 62, 300 + Math.floor(i / 4) * 52, 56, 46, '#2b2a24') + R(158 + (i % 4) * 62, 310 + Math.floor(i / 4) * 52, 30, 4, '#0c0c0c') + R(160 + (i % 4) * 62, 324 + Math.floor(i / 4) * 52, 20, 10, '#cfc7a8', op(.35));
    s += R(146, 296, 256, 164, 'none', 'stroke="#3a3326" stroke-width="3"');
    s += R(60, 150, 70, 90, '#2e3431') + R(66, 160, 58, 30, '#1b1f1e') + CI(95, 175, 8, '#a8a58e', op(.35)) + wire(95, 150, 200, 54, 12, '#0e1010', 2) + wire(80, 150, 40, 54, 8, '#0e1010', 2);
    s += R(420, 200, 60, 80, '#8a8676', op(.25), 'transform="rotate(3 450 240)"') + R(428, 214, 44, 3, '#000', op(.2)) + R(428, 224, 38, 3, '#000', op(.2));
    s += G(CI(250, 650, 44, 'none', 'stroke="#262b2a" stroke-width="5"') + CI(390, 650, 44, 'none', 'stroke="#262b2a" stroke-width="5"') +
      SK('M250 650l50-70h70l20 70M300 580l20 70 50-70M290 560h26M370 580l-8-26h24', '#262b2a', 6), op(.95));
    s += SK('M212 628a44 44 0 0 1 40-20M352 628a44 44 0 0 1 40-20', '#56605a', 2, op(.5));
    // 右侧：最暗处的小门（通往地下）
    s += R(1250, 330, 150, 370, '#070808') + R(1242, 322, 166, 10, '#1f2321') + R(1242, 322, 10, 378, '#1f2321') + R(1398, 322, 10, 378, '#1f2321');
    s += R(1450, 420, 5, 240, '#3a3226') + PG([1440, 660, 1466, 660, 1460, 700, 1446, 700], '#2b2620');
    s += R(1180, 270, 40, 56, '#262a27') + R(1186, 282, 12, 20, '#35393a');
    // 裸灯泡
    s += LN(400, 54, 400, 180, '#0b0d0d', 2) + CI(400, 188, 9, '#3a3a33') + R(396, 172, 8, 10, '#2a2a26');
    s += motes(p, r, 22, 700, 110, 180, 220, '#eef2e4') + moteCss(p);
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .7));
  };

  /* ---------------- 室内（苏 / 张）共用几何：VP(800,340)，后墙 x300–1300 y70–590 ---------------- */
  var LWALL = [0, -92, 300, 70, 300, 590, 0, 740], RWALL = [1300, 70, 1600, -92, 1600, 740, 1300, 590];
  function rmLeftQ(u1, u2, v1, v2) { return qrect(LWALL, u1, v1, u2, v2); }
  function rmRightQ(u1, u2, v1, v2) { return qrect(RWALL, u1, v1, u2, v2); }
  /* 把左墙上的点向屋内推 m 米（屏幕上水平移动，比例随深度） */
  function pushL(pts, m) {
    var o = [];
    for (var i = 0; i < pts.length; i += 2) o.push(pts[i] + (832 - 1.04 * pts[i]) / 3.6 * m, pts[i + 1]);
    return o;
  }
  /* 书橱的一格（线装 / 绢本手抄经平放成摞，偶有竖放的函套），作为 <g id> 复用 */
  var SUTRA = ['#e4d7b4', '#d8c795', '#ccb983', '#efe6cc', '#c9a86a', '#3e4a66'];
  function bookRows(p, r, nv, w, rh) {
    var d = '';
    for (var v = 0; v < nv; v++) {
      var s = R(0, 0, w, rh - 8, '#1d1510'), bx = 3;
      for (;;) {
        if (r() < .2) {
          var fw = 14 + r() * 10;
          if (bx + fw > w - 3) break;
          s += R(bx, 7, fw, rh - 15, pick(r, ['#3b4866', '#34405a', '#6b4a36'])) + R(bx + 3, 13, fw - 6, 12, '#e6dcc0', op(.8));
          bx += fw + 2;
          continue;
        }
        var sw = 26 + r() * 28;
        if (bx + sw > w - 3) break;
        var n = 3 + Math.floor(r() * 5), th = (rh - 14) / 8;
        for (var j = 0; j < n; j++) s += R(bx + (r() - .5) * 3, rh - 8 - (j + 1) * th, sw, th - .8, pick(r, SUTRA));
        bx += sw + 3;
      }
      d += '<g id="' + p + '-row' + v + '">' + s + '</g>';
    }
    return d;
  }
  function shelfFront(p, r, x, y, w, rows, rh, wood, nv) {
    var s = R(x - 8, y - 12, w + 16, rows * rh + 12, wood) + R(x - 8, y - 12, w + 16, 8, U.mix(wood, '#ffffff', .15));
    for (var i = 0; i < rows; i++) {
      var ry = y + i * rh, v = Math.floor(r() * nv);
      s += r() < .5 ? '<use href="#' + p + '-row' + v + '" x="' + x + '" y="' + k(ry) + '"/>' :
        '<use href="#' + p + '-row' + v + '" transform="translate(' + (x + w) + ' ' + k(ry) + ') scale(-1 1)"/>';
      s += R(x - 2, ry + rh - 8, w + 4, 8, U.mix(wood, '#000', .2));
    }
    return s;
  }
  /* 侧墙上的书橱（透视） */
  function shelfSide(r, q, rows, wood) {
    var s = PG(q, wood);
    for (var i = 0; i < rows; i++) {
      var v1 = .02 + i * (.96 / rows), v2 = v1 + .96 / rows - .025;
      s += PG(qrect(q, .06, v1, .94, v2), '#1d1510');
      var u = .08;
      while (u < .88) {
        var du = .07 + r() * .08;
        s += PG(qrect(q, u, v1 + (v2 - v1) * (.3 + r() * .35), Math.min(u + du - .012, .92), v2), pick(r, SUTRA));
        u += du;
      }
    }
    return s;
  }

  /* ================================================================ su_room */
  B.su_room = function () {
    var p = 'bg-su', r = U.rng(1949), d = '', s = '', i;
    d += LG(p + '-bw', 0, 0, 0, 1, [[0, '#cfc7b2'], [1, '#bdb49c']]);
    d += LG(p + '-lw', 0, 0, 1, 0, [[0, '#8d8574'], [1, '#b3aa94']]);
    d += LG(p + '-rw', 0, 0, 1, 0, [[0, '#aea58f'], [1, '#7e7766']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#9a7a56'], [1, '#5a4430']]);
    d += LG(p + '-out', 0, 0, 0, 1, [[0, '#fbf5e2'], [1, '#e9e2c0']]);
    d += LG(p + '-beam', 0, 0, 0, 1, [[0, '#fff1c8', .55], [1, '#fff1c8', 0]]);
    d += RG(p + '-glow', .5, .45, .5, [[0, '#fff3d0', .6], [1, '#fff3d0', 0]]);
    d += RG(p + '-fp', .5, .5, .5, [[0, '#fff0c4', .3], [1, '#fff0c4', 0]]);
    d += bookRows(p, r, 5, 250, 67);
    s += R(0, 0, 1600, 900, '#3a3128');
    // 天花、墙、地
    s += PG([0, -92, 1600, -92, 1300, 70, 300, 70], '#a39a86');
    s += R(300, 70, 1000, 520, 'url(#' + p + '-bw)');
    s += PG(LWALL, 'url(#' + p + '-lw)') + PG(RWALL, 'url(#' + p + '-rw)');
    s += PG([0, 740, 300, 590, 1300, 590, 1600, 740, 1600, 900, 0, 900], 'url(#' + p + '-fl)');
    for (i = 0; i < 14; i++) s += LN(300 + i * 1000 / 13, 590, 800 + (300 + i * 1000 / 13 - 800) * 3.2, 1200, '#3a2a1c', 1.5, op(.35));
    // 踢脚线
    s += R(300, 578, 1000, 12, '#6a5238') + PG([0, 728, 300, 580, 300, 590, 0, 740], '#5a4430') + PG([1600, 728, 1300, 580, 1300, 590, 1600, 740], '#5a4430');
    // 窗：外面是邻家的黑瓦屋脊和一树阳光
    var WX = 630, WY = 110, WW = 340, WH = 320;
    s += R(WX - 16, WY - 16, WW + 32, WH + 32, '#6b523a') + R(WX, WY, WW, WH, 'url(#' + p + '-out)');
    s += PG([WX, WY + 230, WX + 120, WY + 196, WX + 260, WY + 226, WX + WW, WY + 214, WX + WW, WY + WH, WX, WY + WH], '#b9b4a2', op(.7));
    s += PG([WX, WY + 236, WX + 120, WY + 202, WX + 260, WY + 232, WX + WW, WY + 220, WX + WW, WY + 228, WX + 260, WY + 240, WX + 120, WY + 210, WX, WY + 244], '#8f8a78', op(.7));
    s += foliage(r, 16, WX, WY, WW, 150, ['#c3c9a2', '#b4bd92', '#d0d4b0']);
    for (i = 1; i < 4; i++) s += R(WX + WW * i / 4 - 3, WY, 6, WH, '#5d4631');
    s += R(WX, WY + WH * .36 - 3, WW, 6, '#5d4631') + R(WX + WW / 2 - 5, WY, 10, WH, '#5d4631');
    // 左扇外开
    s += PG([WX - 16, WY - 10, WX - 70, WY + 12, WX - 70, WY + WH - 6, WX - 16, WY + WH + 10], '#7a5f43') + PG([WX - 24, WY + 4, WX - 62, WY + 20, WX - 62, WY + WH - 14, WX - 24, WY + WH - 4], '#e6dcc0', op(.6));
    s += R(WX - 22, WY + WH + 14, WW + 44, 14, '#8a6c4a') + R(WX - 22, WY + WH + 28, WW + 44, 6, '#000', op(.2));
    s += EL(WX + WW / 2, WY + WH / 2, WW * .9, WH * .8, 'url(#' + p + '-glow)');
    // 书橱：后墙左右 + 两侧墙
    s += shelfFront(p, r, 330, 112, 250, 7, 67, '#5b3e28', 5) + shelfFront(p, r, 1020, 112, 250, 7, 67, '#5b3e28', 5);
    s += R(330, 112, 250, 469, '#fff4dc', op(.05)) + R(1020, 112, 250, 469, '#fff4dc', op(.1));
    s += shelfSide(r, rmLeftQ(.12, .92, .08, .86), 7, '#4a3222') + shelfSide(r, rmRightQ(.08, .88, .08, .86), 7, '#4a3222');
    s += PG(rmLeftQ(0, .5, 0, 1), '#000', op(.12)) + PG(rmRightQ(.5, 1, 0, 1), '#000', op(.18));
    // 两把靠背椅（桌子两侧）
    [[560, 1], [1040, -1]].forEach(function (c) {
      var cx = c[0];
      s += R(cx - 28, 380, 7, 220, '#4d3522') + R(cx + 21, 380, 7, 220, '#4d3522') + PT('M' + (cx - 34) + ' 384q34 -16 68 0v8h-68z', '#5c4029') + R(cx - 12, 394, 24, 86, '#6e4e32');
      s += R(cx - 34, 480, 68, 12, '#5c4029') + R(cx - 30, 492, 60, 8, '#3d2a1b');
    });
    // 八仙桌
    var TX1 = 600, TX2 = 1000;
    s += PG([TX1 + 16, 450, TX2 - 16, 450, TX2, 468, TX1, 468], '#6e4e32') + R(TX1, 468, TX2 - TX1, 12, '#4d3522') + R(TX1 + 10, 480, TX2 - TX1 - 20, 18, '#5c4029');
    s += SK('M' + (TX1 + 30) + ' 498 q20 14 40 0 M' + (TX2 - 70) + ' 498 q20 14 40 0', '#4d3522', 3);
    s += R(TX1 + 6, 480, 16, 120, '#4d3522') + R(TX2 - 22, 480, 16, 120, '#4d3522') + R(TX1 + 40, 470, 12, 110, '#3d2a1b') + R(TX2 - 52, 470, 12, 110, '#3d2a1b');
    // 桌上：摊开晾干的绢本经卷、砚台、笔、香炉、已抄好的经
    var MS = [650, 396, 840, 396, 860, 460, 630, 460];
    s += PG([636, 460, 866, 460, 870, 466, 632, 466], '#3d2a1b');
    s += PG(MS, '#efe4c4') + PG(qrect(MS, .495, 0, .505, 1), '#bda77a');
    for (i = 0; i < 18; i++) {
      var uu = .04 + i * .053;
      if (Math.abs(uu - .5) < .03) continue;
      s += PG(qrect(MS, uu, .1, uu + .012, .9 - r() * .3), '#2a241c', op(.7));
    }
    s += PG(qrect(MS, .82, .72, .9, .86), '#b8322a', op(.8));
    s += R(880, 448, 58, 14, '#1c1c1c') + EL(900, 452, 14, 3, '#3a4550') + R(870, 444, 80, 3, '#6b4a2e', 'transform="rotate(-4 870 444)"') + R(930, 440, 16, 5, '#e8e0cc', 'transform="rotate(-4 930 440)"');
    s += R(955, 440, 26, 20, '#6b5a3a') + EL(968, 440, 13, 3, '#8a7650') + R(962, 420, 1.5, 20, '#8a3a2a');
    s += SK('M963 420 c-6 -20 10 -30 0 -50 s8 -30 -4 -50', '#f4efe2', 2, 'class="' + p + '-smoke" opacity=".5"');
    for (i = 0; i < 4; i++) s += R(612, 452 - i * 7, 34, 6, i % 2 ? '#3e4a66' : '#e4d7b4');
    // 光束 + 地上光斑
    s += PG([WX, WY + 10, WX + WW, WY + 10, 1180, 900, 480, 900], 'url(#' + p + '-beam)', op(.55));
    for (i = 1; i < 4; i++) { var bx = WX + WW * i / 4, bx2 = 480 + 700 * i / 4; s += PG([bx - 3, WY + 10, bx + 3, WY + 10, bx2 + 12, 900, bx2 - 12, 900], '#6a5238', op(.12)); }
    s += EL(810, 820, 340, 90, 'url(#' + p + '-fp)');
    // 吊灯
    s += LN(800, 0, 800, 40, '#3a3128', 2) + PT('M770 58 q30-22 60 0z', '#e9e3d0') + R(794, 40, 12, 8, '#3a3128');
    s += motes(p, r, 36, 560, 150, 520, 520) + moteCss(p);
    s += '<style>.' + p + '-smoke{animation:' + p + '-sm 6s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 100%}@keyframes ' + p + '-sm{to{transform:skewX(8deg) scaleY(1.05)}}</style>';
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .45));
  };

  /* ================================================================ zhang_room */
  B.zhang_room = function () {
    var p = 'bg-zh', r = U.rng(1908), d = '', s = '', i;
    d += LG(p + '-bw', 0, 0, 0, 1, [[0, '#5e625b'], [1, '#4b4f49']]);
    d += LG(p + '-lw', 0, 0, 1, 0, [[0, '#343834'], [1, '#4d514b']]);
    d += LG(p + '-rw', 0, 0, 1, 0, [[0, '#4a4e48'], [1, '#2e322e']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#4d4639'], [1, '#221f1a']]);
    d += LG(p + '-cur', 0, 0, 1, 0, [[0, '#3e4a3c'], [.5, '#4a5646'], [1, '#353f33']]);
    d += LG(p + '-blade', 0, 0, 0, 1, [[0, '#d8dfd4', .5], [1, '#d8dfd4', 0]]);
    d += LG(p + '-door', 0, 0, 1, 0, [[0, '#5e1f18'], [1, '#8e2e22']]);
    d += RG(p + '-fp', .5, .5, .5, [[0, '#cfd6ca', .25], [1, '#cfd6ca', 0]]);
    s += R(0, 0, 1600, 900, '#1d201d');
    s += PG([0, -92, 1600, -92, 1300, 70, 300, 70], '#3b3e39');
    s += R(300, 70, 1000, 520, 'url(#' + p + '-bw)');
    for (i = 0; i < 10; i++) s += R(320 + r() * 940, 90 + r() * 420, 40 + r() * 120, 30 + r() * 90, '#000', op(k(.04 + r() * .06)));
    s += PG(LWALL, 'url(#' + p + '-lw)') + PG(RWALL, 'url(#' + p + '-rw)');
    s += PG([0, 740, 300, 590, 1300, 590, 1600, 740, 1600, 900, 0, 900], 'url(#' + p + '-fl)');
    for (i = 0; i < 14; i++) s += LN(300 + i * 1000 / 13, 590, 800 + (300 + i * 1000 / 13 - 800) * 3.2, 1200, '#0e0d0b', 1.5, op(.4));
    s += R(300, 578, 1000, 12, '#2e2a22') + PG([0, 728, 300, 580, 300, 590, 0, 740], '#2a261f') + PG([1600, 728, 1300, 580, 1300, 590, 1600, 740], '#2a261f');
    // 窗（大半被窗帘遮住），缝里看得见对面灰楼
    var WX = 630, WY = 110, WW = 340, WH = 320;
    s += R(WX - 16, WY - 16, WW + 32, WH + 32, '#3a3129') + R(WX, WY, WW, WH, '#a7aea6');
    s += R(WX + 200, WY + 40, WW - 200, WH - 40, '#7d837c') + R(WX + 250, WY + 90, 30, 50, '#5a605a') + R(WX + 250, WY + 190, 30, 50, '#5a605a');
    for (i = 1; i < 4; i++) s += R(WX + WW * i / 4 - 3, WY, 6, WH, '#2e2720');
    s += R(WX, WY + WH * .36 - 3, WW, 6, '#2e2720');
    s += R(WX - 40, WY - 34, WW + 80, 8, '#2a241e');
    var cur = '';
    for (i = 0; i < 12; i++) cur += R(WX - 34 + i * 22, WY - 26, 22, WH + 70, i % 2 ? '#3a4538' : '#465244');
    s += G(cur, 'class="' + p + '-cur"') + R(WX - 34, WY - 26, 264, WH + 70, 'url(#' + p + '-cur)', op(.4));
    for (i = 0; i < 4; i++) s += R(WX + WW - 20 + i * 16, WY - 26, 16, WH + 70, i % 2 ? '#3a4538' : '#465244');
    // 缝里漏进来的光刃
    s += PG([WX + 232, WY, WX + WW - 22, WY, 1010, 900, 820, 900], 'url(#' + p + '-blade)', op(.5));
    s += EL(930, 850, 160, 50, 'url(#' + p + '-fp)');
    // 左墙：大衣橱（靠墙，门朝屋内）
    var WQ = rmLeftQ(.42, .78, .16, 1), WF = pushL(WQ, .6);
    s += PG([WQ[0], WQ[1], WF[0], WF[1], WF[6], WF[7], WQ[6], WQ[7]], '#2c241e');
    s += PG(WF, '#3c3128') + PG(qrect(WF, .04, .04, .32, .8), '#43372c') + PG(qrect(WF, .68, .04, .96, .8), '#43372c') + PG(qrect(WF, .34, .04, .66, .8), '#2c2620');
    s += PG(qell(WF, .5, .42, .12, .3), '#666d67') + PG(qell(WF, .47, .38, .04, .16), '#a8b0a8', op(.3));
    s += PG(qrect(WF, 0, .82, 1, .98), '#362c24') + PG(qrect(WF, .3, .44, .32, .52), '#8b7a5a') + PG(qrect(WF, .68, .44, .7, .52), '#8b7a5a');
    s += PG(qrect(WF, 0, 0, 1, .02), '#4d3f33');
    // 后墙左：单人床，被子叠成豆腐块
    s += R(330, 470, 250, 16, '#2c2620') + R(330, 486, 250, 104, '#332a22') + R(338, 400, 10, 190, '#2c2620') + R(562, 440, 10, 150, '#2c2620');
    s += R(334, 452, 242, 20, '#6f716a') + R(334, 452, 242, 5, '#858780') + R(348, 424, 60, 30, '#9a9b92', 'rx="6"');
    s += R(470, 420, 90, 34, '#56605a') + R(470, 420, 90, 8, '#6b746d') + R(470, 436, 90, 2, '#3e4640');
    s += R(380, 560, 30, 12, '#1a1714') + R(414, 562, 30, 10, '#1a1714');
    // 五斗柜（右后）+ 热水瓶 + 茶叶罐 + 旧收音机
    s += R(1030, 380, 230, 210, '#3f342a') + R(1030, 380, 230, 10, '#51443a');
    for (i = 0; i < 4; i++) s += R(1040, 398 + i * 46, 210, 40, '#463a2f') + R(1140, 414 + i * 46, 12, 5, '#8b7a5a');
    s += R(1060, 316, 30, 64, '#6e3a30', 'rx="6"') + R(1064, 306, 22, 12, '#2b2b27') + R(1110, 340, 30, 40, '#6d6a5f') + EL(1125, 340, 15, 4, '#85826f');
    s += R(1160, 336, 80, 44, '#4a3a2c', 'rx="4"') + R(1168, 344, 40, 28, '#6a5a44') + CI(1224, 358, 7, '#2a2420');
    // 墙上挂过东西的浅色印子 + 钉子
    s += R(1080, 160, 150, 110, '#6f746b', op(.35)) + CI(1155, 150, 3, '#1b1b18') + LN(1155, 150, 1155, 156, '#1b1b18', 2);
    // 方桌 + 两把木椅
    s += PG([640, 474, 960, 474, 976, 490, 624, 490], '#4a3c2f') + R(624, 490, 352, 12, '#352b22') + R(632, 502, 14, 98, '#352b22') + R(954, 502, 14, 98, '#352b22');
    s += R(760, 452, 40, 26, '#d6d2c4', 'rx="10"') + SK('M800 460 q16 -2 16 -14', '#d6d2c4', 3) + R(754, 448, 12, 6, '#d6d2c4') + R(772, 444, 16, 8, '#c6c2b4');
    s += R(840, 464, 14, 14, '#e2ddcf') + R(866, 464, 14, 14, '#e2ddcf');
    [600, 1000].forEach(function (cx) {
      s += R(cx - 26, 410, 7, 190, '#2e261f') + R(cx + 19, 410, 7, 190, '#2e261f') + R(cx - 28, 406, 56, 9, '#3b3128') + R(cx - 22, 430, 44, 6, '#3b3128') + R(cx - 30, 500, 60, 12, '#3b3128');
    });
    // 右墙：朱红门（屋内侧）
    var DQ = rmRightQ(.3, .62, .2, 1);
    s += PG(rmRightQ(.28, .64, .17, 1), '#2a211b') + PG(DQ, 'url(#' + p + '-door)');
    [[.12, .08, .45, .45], [.55, .08, .88, .45], [.12, .55, .45, .92], [.55, .55, .88, .92]].forEach(function (a) { s += PG(qrect(DQ, a[0], a[1], a[2], a[3]), '#000', op(.18)); });
    s += PG(qrect(DQ, .14, .48, .22, .52), '#9c8a60') + PG(qrect(DQ, .7, .1, .74, .14), '#1a1a18');
    // 裸灯泡（不亮）
    s += LN(800, 0, 800, 150, '#1a1a17', 2) + CI(800, 162, 10, '#4a4c46') + R(795, 146, 10, 10, '#2a2a26');
    s += R(0, 0, 1600, 900, '#16221e', op(.18));
    s += motes(p, r, 18, 860, 150, 140, 500, '#dfe6da') + moteCss(p);
    s += '<style>.' + p + '-cur{transform-box:fill-box;transform-origin:50% 0;animation:' + p + '-cs 8s ease-in-out infinite alternate}@keyframes ' + p + '-cs{to{transform:skewX(.8deg)}}</style>';
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .7));
  };

  /* ================================================================ basement
   * 物件固定位置（供 dark_basement）：门 x140–300；床 x300–700 y520–760；书橱 x1080–1360 y220–720；
   * 椅子 x800–900；杂物 x900–1050。先画“被光照亮时”的样子，
   * 再盖一层半透明黑 <g id="bg-basement-dim">（小游戏若要纯“亮态”可把这一组替换掉）。
   */
  B.basement = function () {
    var p = 'bg-bsm', r = U.rng(6), d = '', s = '', i;
    d += LG(p + '-bw', 0, 0, 0, 1, [[0, '#56635c'], [1, '#414d47']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#48504a'], [1, '#2a2f2a']]);
    d += LG(p + '-door', 0, 0, 1, 0, [[0, '#4a5354'], [1, '#343c3e']]);
    d += RG(p + '-damp', .5, .5, .5, [[0, '#1a2420', .55], [1, '#1a2420', 0]]);
    d += LG(p + '-gap', 0, 0, 1, 0, [[0, '#f0c88a', .95], [1, '#f0c88a', 0]]);
    d += RG(p + '-spill', .5, .5, .5, [[0, '#e0b070', .35], [1, '#e0b070', 0]]);
    d += RG(p + '-dim', .14, .5, .9, [[0, '#050908', .5], [.3, '#050908', .74], [1, '#050908', .8]]);
    d += LG(p + '-wood', 0, 0, 1, 0, [[0, '#4a3624'], [1, '#3a2a1c']]);
    // 天花、墙、地（低矮、无窗）
    s += R(0, 0, 1600, 900, '#1a201d');
    s += PG([0, 0, 1600, 0, 1480, 90, 120, 90], '#2e3632');
    s += R(120, 90, 1360, 580, 'url(#' + p + '-bw)');
    s += PG([0, 0, 120, 90, 120, 670, 0, 760], '#38443e') + PG([1600, 0, 1480, 90, 1480, 670, 1600, 760], '#323c37');
    s += PG([0, 760, 120, 670, 1480, 670, 1600, 760, 1600, 900, 0, 900], 'url(#' + p + '-fl)');
    // 水泥墙的模板缝、潮斑、下部返潮
    for (i = 0; i < 8; i++) s += LN(120, 90 + i * 72, 1480, 90 + i * 72, '#27302c', 1.5, op(.5));
    for (i = 0; i < 10; i++) s += EL(160 + r() * 1300, 200 + r() * 420, 60 + r() * 120, 40 + r() * 90, 'url(#' + p + '-damp)');
    for (i = 0; i < 7; i++) s += R(200 + r() * 1200, 90, 3 + r() * 5, 80 + r() * 200, '#1c2521', op(.35));
    s += R(120, 590, 1360, 80, '#1c2621', op(.35));
    // 天花管线
    s += R(0, 96, 1600, 12, '#46504a') + R(0, 96, 1600, 3, '#6a756d') + R(0, 118, 1600, 7, '#38403b');
    for (i = 0; i < 8; i++) s += R(60 + i * 210, 92, 14, 22, '#2a302c');
    // 床头墙上歪歪扭扭刻着的诗句（钱六）
    s += TX(420, 440, 26, '#8e9a92', '出师未捷身先死', 'transform="rotate(-3 420 440)" opacity=".38" letter-spacing="6"');
    s += TX(460, 480, 20, '#8e9a92', '常使英雄泪满襟', 'transform="rotate(2 460 480)" opacity=".26" letter-spacing="8"');
    // 门（左，铁门虚掩，门缝漏光）
    s += R(140, 250, 160, 420, '#1d2322') + R(132, 242, 176, 10, '#4e5754') + R(132, 242, 10, 428, '#4e5754') + R(298, 242, 10, 428, '#4e5754');
    s += R(146, 256, 138, 414, 'url(#' + p + '-door)');
    for (i = 0; i < 6; i++) s += CI(156, 270 + i * 76, 3, '#6b7573') + CI(274, 270 + i * 76, 3, '#6b7573');
    s += R(160, 290, 110, 140, 'none', 'stroke="#5b6462" stroke-width="3"') + R(160, 460, 110, 180, 'none', 'stroke="#5b6462" stroke-width="3"');
    s += R(254, 440, 20, 8, '#9ba39e') + R(258, 448, 8, 20, '#7b8480');
    for (i = 0; i < 5; i++) s += R(150 + r() * 120, 300 + r() * 340, 10 + r() * 30, 4 + r() * 10, '#6a4a30', op(.5));
    s += PG([284, 256, 298, 250, 298, 670, 284, 670], 'url(#' + p + '-gap)');
    // 门边开关（坏的）+ 挂在钉子上的旧棉袄
    s += R(318, 430, 20, 30, '#b8b3a2') + R(325, 438, 6, 12, '#3a3a33') + LN(328, 430, 328, 108, '#262b28', 2);
    s += CI(372, 262, 3, '#222') + PT('M372 264 l-18 10 -22 8 -8 50 6 90 26 4 4 -60 14 0 4 60 26 -4 6 -90 -8 -50 -22 -8z', '#454a3e') + SK('M372 274v150', '#2e3229', 2);
    // 床（左下，x300–700 y520–760）
    s += R(304, 560, 8, 200, '#2e3434') + R(344, 540, 8, 220, '#2e3434') + LN(308, 578, 348, 562, '#2e3434', 5) + LN(308, 620, 348, 604, '#2e3434', 5);
    for (i = 0; i < 4; i++) s += LN(318 + i * 8, 574 - i * 3, 318 + i * 8, 640 - i * 3, '#3e4545', 2.5);
    s += R(312, 640, 390, 36, '#66665a') + R(312, 640, 390, 7, '#82826b');
    s += PT('M350 642 c20 -26 60 -30 110 -24 c60 8 90 -10 150 -6 c40 2 70 10 90 28 v36 h-350z', '#76694f') + SK('M420 628 c40 -8 80 4 130 -2 M520 640 c30 -6 60 0 90 -4', '#4a4234', 3);
    s += PT('M318 632 c6 -18 44 -20 58 -4 c4 8 -4 14 -30 14 c-20 0 -30 -2 -28 -10z', '#948f78');
    s += R(312, 676, 390, 10, '#2e3434') + R(318, 686, 8, 74, '#2e3434') + R(690, 660, 8, 100, '#2e3434') + R(660, 610, 8, 150, '#2e3434') + LN(664, 612, 700, 600, '#2e3434', 5);
    s += R(326, 686, 360, 70, '#0e1210', op(.7)) + EL(440, 744, 26, 10, '#454840') + R(530, 734, 50, 16, '#352f26') + R(586, 738, 44, 14, '#352f26');
    // 椅子（x800–900）
    s += R(812, 470, 9, 240, '#56412c') + R(880, 470, 9, 240, '#56412c') + R(810, 466, 82, 12, '#6a4f36') + R(816, 510, 70, 8, '#6a4f36');
    s += R(800, 590, 102, 14, '#6a4f36') + R(804, 604, 8, 110, '#453323') + R(890, 604, 8, 110, '#453323') + R(806, 660, 90, 5, '#453323');
    s += PT('M830 588 c10-16 40-16 52 0z', '#726b55');
    // 杂物堆（x900–1050，下方）：木箱、纸箱、成捆旧报纸、煤油灯、坛子、酒瓶
    s += R(912, 630, 110, 90, '#65523c') + R(912, 630, 110, 10, '#7a644a') + LN(912, 675, 1022, 675, '#3e3224', 2) + LN(967, 640, 967, 720, '#3e3224', 2);
    s += R(930, 580, 80, 50, '#74644c') + LN(930, 605, 1010, 605, '#4a3e2e', 2);
    s += PT('M1022 720c-6-30-4-50 8-62h24c12 12 14 32 8 62z', '#55625e') + R(1034, 648, 16, 12, '#3c4644');
    for (i = 0; i < 6; i++) s += R(900, 712 - i * 9, 64, 8, pick(r, ['#9a9680', '#aaa48a', '#87846e']));
    s += LN(930, 668, 930, 712, '#3a3226', 1.5) + R(946, 546, 30, 34, '#3f5054', 'rx="4"') + R(954, 536, 14, 12, '#2a3234') + EL(961, 562, 8, 10, '#9ab0b2', op(.4)) + SK('M950 538q11-14 22 0', '#2a3234', 2);
    s += R(1000, 596, 12, 36, '#3f563e') + R(1002, 588, 8, 10, '#2b3a2b');
    // 书橱（右，x1080–1360 y220–720）
    s += R(1080, 220, 280, 500, 'url(#' + p + '-wood)') + R(1074, 212, 292, 16, '#5a412b') + R(1080, 690, 280, 30, '#2e2016');
    s += R(1094, 236, 252, 300, '#1a130d');
    for (i = 0; i < 4; i++) {
      var ry = 236 + i * 75, bx = 1098;
      while (bx < 1320) {
        var bw2 = 10 + r() * 14, bh2 = 44 + r() * 24;
        if (r() < .3) { var sw = 26 + r() * 16; for (var j = 0; j < 4; j++) s += R(bx, ry + 66 - (j + 1) * 7, sw, 6, pick(r, ['#c2ae82', '#b09c70', '#86735a'])); bx += sw + 3; continue; }
        s += R(bx, ry + 70 - bh2, bw2, bh2, pick(r, ['#644a32', '#735a3e', '#4a5646', '#7a6444', '#54432f']));
        bx += bw2 + 1;
      }
      s += R(1094, ry + 70, 252, 6, '#46321f');
    }
    s += R(1094, 236, 124, 300, '#d8e4dc', op(.05)) + R(1220, 236, 126, 300, '#d8e4dc', op(.08)) + LN(1219, 236, 1219, 536, '#46321f', 5);
    s += PG([1100, 240, 1150, 240, 1100, 330], '#fff', op(.06)) + PG([1226, 240, 1276, 240, 1226, 330], '#fff', op(.06));
    s += R(1094, 546, 120, 140, '#523b28') + R(1224, 546, 122, 140, '#523b28') + R(1200, 600, 6, 20, '#a8946c') + R(1232, 600, 6, 20, '#a8946c');
    // 书橱脚下：隐约的水泥板缝（下沉）
    s += PG([1060, 724, 1380, 724, 1400, 760, 1044, 760], '#1f2320', op(.5)) + LN(1044, 760, 1400, 760, '#151816', 2, op(.6)) + SK('M1120 740 l30 8 20 -4 36 10', '#151816', 1.5, op(.6));
    // 裸灯泡（坏）
    s += LN(760, 108, 760, 200, '#1a1e1c', 2) + CI(760, 210, 10, '#555a54') + R(755, 194, 10, 10, '#2a2e2b');
    // ---- 半透明黑：直接看很暗，门口留微光 ----
    s += '<g id="bg-basement-dim">' + R(0, 0, 1600, 900, 'url(#' + p + '-dim)') + '</g>';
    s += PG([284, 256, 298, 250, 298, 670, 284, 670], 'url(#' + p + '-gap)', op(.8)) + EL(300, 520, 170, 300, 'url(#' + p + '-spill)');
    s += PG([290, 672, 300, 672, 500, 900, 390, 900], '#e8b878', op(.13));
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .55));
  };

  /* ================================================================ sealed_stairs */
  B.sealed_stairs = function () {
    var p = 'bg-seal', r = U.rng(704), d = '', s = '', i;
    d += LG(p + '-bw', 0, 0, 0, 1, [[0, '#353b38'], [1, '#262b28']]);
    d += LG(p + '-fl', 0, 0, 0, 1, [[0, '#2e2c27'], [1, '#141412']]);
    d += LG(p + '-new', 0, 0, 0, 1, [[0, '#7f8582'], [1, '#6c726f']]);
    d += LG(p + '-beam', 0, 0, 1, .6, [[0, '#e8ecdf', .45], [1, '#e8ecdf', 0]]);
    d += LG(p + '-lw', 0, 0, 1, 0, [[0, '#1c201e'], [1, '#2b302d']]);
    s += R(0, 0, 1600, 900, '#131614');
    // 后墙（VP 800,330）+ 墙裙
    s += R(0, 60, 1600, 580, 'url(#' + p + '-bw)') + R(0, 0, 1600, 64, '#0e1110') + R(0, 58, 1600, 8, '#222724');
    for (i = 0; i < 9; i++) s += R(i * 200 - 10, 0, 30, 70, '#1a1e1c');
    for (i = 0; i < 14; i++) s += R(r() * 1500, 80 + r() * 420, 50 + r() * 150, 30 + r() * 100, r() < .5 ? '#000' : '#5d625c', op(k(.05 + r() * .08)));
    s += R(0, 480, 1600, 160, '#243129', op(.6)) + R(0, 476, 1600, 5, '#171f1b');
    // 地面
    s += R(0, 640, 1600, 260, 'url(#' + p + '-fl)') + R(0, 636, 1600, 6, '#0b0d0c');
    for (i = 0; i < 16; i++) s += LN(800 + (i - 8) * 110, 640, 800 + (i - 8) * 280, 900, '#000', 1.5, op(.35));
    // 左：通往二楼的木楼梯（侧面），扶手与栏杆
    var sx0 = -60, run = 34, rise = 32, n = 18, stp = 'M' + sx0 + ' 640';
    for (i = 0; i < n; i++) stp += 'v-' + rise + 'h' + run;
    s += PT(stp + 'V640Z', '#2a221b');
    for (i = 0; i < n; i++) s += R(sx0 + i * run, 640 - (i + 1) * rise, run + 2, 5, '#7a6248') + R(sx0 + i * run, 640 - (i + 1) * rise + 5, 3, rise - 5, '#3e3226');
    s += PG([sx0, 640, sx0 + n * run, 640 - n * rise, sx0 + n * run, 640], '#000', op(.3));
    var rl = function (x) { return 640 - 120 - (x - sx0) * rise / run; };
    for (i = 1; i < n; i++) { var bx = sx0 + i * run + run / 2; s += R(bx - 2, rl(bx), 4, (640 - (i + 1) * rise) - rl(bx), '#231c16'); }
    s += LN(sx0, rl(sx0), sx0 + n * run, rl(sx0 + n * run), '#5b4634', 9) + LN(sx0, rl(sx0) - 4, sx0 + n * run, rl(sx0 + n * run) - 4, '#8e7458', 3);
    s += R(40, 420, 26, 220, '#3a2d22') + R(34, 410, 38, 14, '#5b4634');
    // 楼梯底下堆的杂物剪影
    s += R(250, 580, 80, 60, '#1b1714') + R(340, 560, 50, 80, '#211c17') + PT('M160 640v-40h50l10 40z', '#1d1916');
    // 从左上看不见的高窗斜射进来的日光（落在封口上）
    s += PG([560, 60, 760, 60, 1300, 640, 1000, 640], 'url(#' + p + '-beam)', op(.55));
    // 被封死的楼梯口：新抹的水泥，平整、颜色发青
    var X1 = 900, X2 = 1110, T = 262, Bt = 640;
    s += R(X1 - 16, T - 16, X2 - X1 + 32, Bt - T + 16, '#1d211f');
    for (i = 0; i < 10; i++) s += CI(X1 - 10 + (i % 2) * (X2 - X1 + 20), T + 30 + Math.floor(i / 2) * 70, 2, '#0e100f');
    s += R(X1, T, X2 - X1, Bt - T, 'url(#' + p + '-new)');
    for (i = 0; i < 9; i++) s += SK('M' + k(X1 + 10 + r() * 150) + ' ' + k(T + 20 + r() * 330) + ' q' + k(24 + r() * 20) + ' -12 ' + k(60 + r() * 30) + ' 0', '#9aa09c', 2, op(.25));
    // 光斑落在封口与墙上（窗格投影）
    var LP = [950, 300, 1100, 250, 1230, 600, 1060, 640];
    s += PG(LP, '#dfe4d6', op(.2));
    s += PG(qrect(LP, .47, 0, .53, 1), '#1d211f', op(.3)) + PG(qrect(LP, 0, .46, 1, .5), '#1d211f', op(.3));
    s += R(X1, T, X2 - X1, 3, '#a4aaa6', op(.6)) + R(X1, T, 3, Bt - T, '#a4aaa6', op(.4)) + R(X1, Bt - 18, X2 - X1, 18, '#4f5552', op(.5));
    // 地面上一道同样新的水泥门槛，几点溅落
    s += PG([X1 - 8, 640, X2 + 8, 640, X2 + 18, 652, X1 - 14, 652], '#6c726f');
    for (i = 0; i < 6; i++) s += EL(X1 - 60 + r() * 330, 668 + r() * 60, 4 + r() * 8, 1.5 + r() * 2.5, '#6c726f', op(.7));
    // 旧电线沿墙走来，扎进水泥里就没了；两只旧开关
    s += SK('M560 210 H880 V' + T, '#0f1211', 3) + SK('M880 300 H' + X1, '#0f1211', 3);
    for (i = 0; i < 5; i++) s += CI(600 + i * 60, 210, 3.5, '#8e8b7c');
    s += R(830, 380, 24, 34, '#9d9888') + R(838, 388, 8, 16, '#3a3a33') + R(856, 380, 24, 34, '#9d9888') + R(864, 388, 8, 16, '#3a3a33') + LN(842, 380, 842, 300, '#0f1211', 2) + LN(868, 380, 868, 300, '#0f1211', 2) + LN(842, 300, 880, 300, '#0f1211', 2);
    // 右侧：信箱、扫帚
    for (i = 0; i < 6; i++) s += R(1270 + (i % 3) * 58, 290 + Math.floor(i / 3) * 50, 52, 44, '#2b2a24') + R(1276 + (i % 3) * 58, 300 + Math.floor(i / 3) * 50, 30, 4, '#0c0c0c') + R(1278 + (i % 3) * 58, 314 + Math.floor(i / 3) * 50, 20, 10, '#cfc7a8', op(.3));
    s += R(1470, 400, 5, 236, '#3a3226') + PG([1460, 636, 1486, 636, 1480, 676, 1466, 676], '#2b2620');
    s += motes(p, r, 26, 640, 100, 500, 480, '#eef0e4') + moteCss(p);
    return U.svg('<defs>' + d + '</defs>' + s + U.vignette(p, .72));
  };
})();
