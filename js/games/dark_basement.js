/*
 * 小游戏 dark_basement —— 第五章 · 钱六的地下室
 * 职责：全黑的地下室，鼠标/手指的位置是那多的手电光圈；卫先的手电在房间里自己慢慢扫。
 *   流程：点床（躺上去，钱六挥手的幽影指向书橱）→ 点书橱（两人挪开，卫先敲墙“实心的”）
 *        → 点书橱原位置前的地面三次（震动、裂纹逐次加剧）→ 水泥板塌陷、白闪、抓住卫先的脚踝 → win。
 *   只会 win。点其他物件给出那多的旁白；久不推进时卫先会提示（简单模式提示更早，目标处有微光）。
 * 操作：鼠标/触摸 移动手电、点击调查；键盘 方向键/WASD 移动、空格/回车 调查或推进字幕、Tab 在物件间切换。
 * 底图：优先 ctx.bgSvg('basement')（隐藏它自带的 #bg-bsm-dim 暗层，让手电照出“亮着”的样子），
 *   缺失时用本文件的兜底底图；书橱、墙面补丁、水泥板、裂纹、洞口、幽影手臂、坠落特写都由本文件绘制。
 */
(function () {
  'use strict';
  var GF = window.GF = window.GF || {};
  if (!GF.games || !GF.games.register) return;

  var ID = 'dark_basement';
  var P = 'gfg-dark_basement-';          // 类名 / SVG id 前缀
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';
  var W = 1600, H = 900;

  /* ------------------------------------------------------------ 几何约定（与 bg_sanceng.js 的 basement 一致） */
  var SHELF_DX = 238, SHELF_DY = 4;       // 书橱被挪开的位移
  var SLAB = [[1098, 730], [1332, 730], [1358, 842], [1072, 842]];
  var SLAB_C = { x: 1214, y: 786 };
  var SHOULDER = { x: 424, y: 624 };      // 钱六（幽影）肩膀
  var HOT = {
    bed:     { r: [298, 536, 708, 768],  c: [500, 650],  name: '钱六的床' },
    door:    { r: [128, 238, 312, 674],  c: [222, 452],  name: '铁门' },
    tally:   { r: [322, 398, 652, 464],  c: [486, 430],  name: '墙上的刻痕' },
    coat:    { r: [326, 250, 406, 398],  c: [364, 330],  name: '旧外套' },
    sw:      { r: [310, 398, 346, 470],  c: [328, 446],  name: '电灯开关' },
    bulb:    { r: [736, 100, 784, 232],  c: [760, 206],  name: '灯泡' },
    chair:   { r: [794, 458, 906, 722],  c: [850, 590],  name: '木椅' },
    clutter: { r: [906, 528, 1068, 732], c: [982, 650],  name: '杂物堆' },
    shelf:   { r: [1068, 204, 1372, 726], c: [1220, 470], name: '书橱' },
    slab:    { r: [1048, 722, 1392, 872], c: [1214, 786], name: '书橱前的地面' }
  };
  var TAB_ORDER = ['door', 'coat', 'sw', 'tally', 'bulb', 'bed', 'chair', 'clutter', 'shelf', 'slab'];

  /* ------------------------------------------------------------ 台词（自拟，那多第一人称） */
  var LINES = {
    door: [['铁门虚掩着，门缝里渗进来一线灰白的光。那是来时的路。'], ['想打退堂鼓？门就在那儿，你请便。', 'weixian'], ['楼上隐约有人家在炒菜。听上去很远，远得像另一个世界。']],
    coat: [['钉子上挂着件旧外套，硬得像块铁皮。口袋里什么都没有。']],
    sw: [['我把开关来回拨了几下。咔哒，咔哒——什么也没亮。']],
    tally: [['墙上刻着一排排“正”字。他在数什么？日子，还是别的什么？'], ['刻痕很深。刻下它们的人，手上有的是时间。']],
    bulb: [['灯泡上积着厚厚一层灰，钨丝早断了。'], ['也许这盏灯，几十年来从没被拉亮过。']],
    bedDone: [['床板上还留着一个浅浅的人形凹坑。']],
    chair: [['一把掉了漆的木椅，椅面被磨得发亮。'], ['他大概常坐在这里，对着一屋子的黑发呆。一坐就是一天。']],
    clutter: [['纸箱、麻袋、暖壶、捆好的旧报纸……钱六几十年的日子，全堆在这一角。'], ['再往下翻，也只会翻出一层又一层的灰。']],
    wall: [['墙皮一碰就簌簌往下掉。'], ['水渍在墙上洇成一张张模糊的脸。我把光挪开了。'], ['敲了敲，闷声闷气。墙就是墙。']],
    floor: [['水泥地，冰凉，结结实实。'], ['灰积得很厚，只有床和门之间被踩出一条小道。']],
    ceiling: [['头顶的水管上挂满了蛛网。']],
    shelfEarly: [['一橱发霉的旧书。可我得先弄明白，那天钱六到底想让我去哪儿。']],
    slabEarly: [['书橱脚下的水泥地，好像微微往下凹着一点。']],
    shelfMoved: [['书橱已经挪开了。后面那面墙，卫先敲过，是实心的。']],
    wallFloorStep: [['墙没有问题。问题在脚下。']],
    floorOther: [['这块地是实的。书橱压过的那一块，踩上去不一样。']]
  };
  var HINTS = {
    bed: [['你不是说，那老头当时就躺在床上冲你挥手？', 'weixian'], ['钱六那天躺在床上……也许我该换成他的角度看一看。']],
    shelf: [['他胳膊挥的那个方向——那只书橱，你看呢？', 'weixian'], ['钱六指的是斜对面。那只书橱。']],
    floor: [['书橱压了几十年的那块地，你再踩踩看。', 'weixian'], ['书橱原来的位置前面，那块水泥板。']]
  };

  /* ------------------------------------------------------------ 小工具 */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function n1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function linear(t) { return t; }
  function pts(a) { return a.map(function (p) { return n1(p[0]) + ',' + n1(p[1]); }).join(' '); }
  function stops(a) {
    return a.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  function LG(id, x1, y1, x2, y2, st, user) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' +
      (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(st) + '</linearGradient>';
  }
  function RG(id, cx, cy, r, st, ex) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (ex ? ' ' + ex : '') + '>' + stops(st) + '</radialGradient>';
  }
  function BLUR(id, sd) { return '<filter id="' + id + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'; }
  function R(x, y, w, h, f, ex) { return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function PG(a, f, ex) { return '<polygon points="' + pts(a) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function PT(d, f, ex) { return '<path d="' + d + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function EL(cx, cy, rx, ry, f, ex) { return '<ellipse cx="' + n1(cx) + '" cy="' + n1(cy) + '" rx="' + n1(rx) + '" ry="' + n1(ry) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function CI(cx, cy, r, f, ex) { return '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="' + n1(r) + '" fill="' + f + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function LN(x1, y1, x2, y2, c, w, ex) { return '<line x1="' + n1(x1) + '" y1="' + n1(y1) + '" x2="' + n1(x2) + '" y2="' + n1(y2) + '" stroke="' + c + '" stroke-width="' + w + '"' + (ex ? ' ' + ex : '') + '/>'; }
  function PL(a, c, w, ex) { return '<polyline points="' + pts(a) + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (ex ? ' ' + ex : '') + '/>'; }
  function op(a) { return 'opacity="' + a + '"'; }
  function pick(r, a) { return a[(r() * a.length) | 0]; }
  function inRect(x, y, r) { return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; }

  var WALL_ST = [[0, '#4d5a54'], [1, '#3b4641']];
  var FLOOR_ST = [[0, '#3f453f'], [1, '#262a26']];

  /* ============================================================ 兜底底图（与 basement 背景同布局、同色调） */
  function roomSvg() {
    var r = rng(11), q = P + 'f-', s = '', i, x;
    var d = LG(q + 'bw', 0, 90, 0, 670, WALL_ST, true) + LG(q + 'fl', 0, 670, 0, 900, FLOOR_ST, true) +
      LG(q + 'door', 0, 0, 1, 0, [[0, '#3b4344'], [1, '#2a3032']]) +
      LG(q + 'gap', 0, 0, 1, 0, [[0, '#f0c88a', 0.9], [1, '#f0c88a', 0]]) +
      LG(q + 'pipe', 0, 0, 0, 1, [[0, '#5e6861'], [0.4, '#48514b'], [1, '#2c322e']]) +
      RG(q + 'damp', 0.5, 0.5, 0.5, [[0, '#1a2420', 0.6], [1, '#1a2420', 0]]) +
      RG(q + 'vig', '50%', '50%', '75%', [['55%', '#000', 0], ['100%', '#000', 0.6]]) +
      BLUR(q + 'b3', 3) + BLUR(q + 'b8', 8);
    s += R(0, 0, 1600, 900, '#1a201d');
    s += PG([[0, 0], [1600, 0], [1480, 90], [120, 90]], '#2c3430');
    s += R(120, 90, 1360, 580, 'url(#' + q + 'bw)');
    s += PG([[0, 0], [120, 90], [120, 670], [0, 760]], '#34403b') + PG([[1600, 0], [1480, 90], [1480, 670], [1600, 760]], '#2f3934');
    s += PG([[0, 760], [120, 670], [1480, 670], [1600, 760], [1600, 900], [0, 900]], 'url(#' + q + 'fl)');
    // 地面缝（透视）
    for (i = 0; i < 9; i++) { x = 120 + i * 170; s += LN(x, 670, 800 + (x - 800) * 2.1, 900, '#1d221e', 1.5, op(0.55)); }
    s += LN(40, 730, 1560, 730, '#1d221e', 1.2, op(0.4)) + LN(0, 810, 1600, 810, '#1d221e', 1.2, op(0.35));
    // 墙：模板缝、潮斑、水痕、裂缝
    for (i = 0; i < 8; i++) s += LN(120, 90 + i * 72, 1480, 90 + i * 72, '#27302c', 1.5, op(0.5));
    for (i = 0; i < 12; i++) s += EL(160 + r() * 1300, 180 + r() * 440, 60 + r() * 120, 40 + r() * 90, 'url(#' + q + 'damp)');
    for (i = 0; i < 9; i++) s += R(180 + r() * 1260, 108, 3 + r() * 5, 80 + r() * 220, '#1c2521', op(0.35) + ' filter="url(#' + q + 'b3)"');
    s += PL([[610, 150], [626, 196], [618, 240], [640, 300], [632, 352]], '#1f2723', 1.6, op(0.7));
    s += PL([[1500, 0], [1490, 40]], '#1f2723', 1.2);
    s += PT('M120 520 Q300 500 460 530 T800 515 T1140 530 T1480 512 V670 H120 Z', '#1a2420', op(0.35));
    // 天花管线
    s += R(0, 96, 1600, 14, 'url(#' + q + 'pipe)') + R(0, 118, 1600, 7, '#343b37');
    for (i = 0; i < 8; i++) s += R(60 + i * 210, 92, 14, 22, '#2a302c');
    s += PT('M300 110 q20 30 60 36 M300 110 q40 12 80 6', 'none', 'stroke="#8a948d" stroke-width=".8" ' + op(0.35));
    // 墙上的“正”字刻痕
    for (i = 0; i < 9; i++) {
      var sx = 330 + i * 34, sy = 410 + (i % 3) * 6;
      s += PT('M' + sx + ' ' + sy + 'h22M' + (sx + 11) + ' ' + sy + 'v26M' + (sx + 11) + ' ' + (sy + 12) + 'h9M' + (sx + 3) + ' ' + (sy + 14) + 'v12M' + (sx - 2) + ' ' + (sy + 26) + 'h26', 'none', 'stroke="#7b877f" stroke-width="1.6" ' + op(0.45));
    }
    // 铁门
    s += R(140, 250, 160, 420, '#1d2322') + R(132, 242, 176, 10, '#454d4a') + R(132, 242, 10, 428, '#454d4a') + R(298, 242, 10, 428, '#454d4a');
    s += R(146, 256, 138, 414, 'url(#' + q + 'door)');
    for (i = 0; i < 6; i++) s += CI(156, 270 + i * 76, 3, '#5b6563') + CI(274, 270 + i * 76, 3, '#5b6563');
    s += R(160, 290, 110, 140, 'none', 'stroke="#4b5452" stroke-width="3"') + R(160, 460, 110, 180, 'none', 'stroke="#4b5452" stroke-width="3"');
    s += EL(200, 640, 50, 22, '#5a3c26', op(0.35) + ' filter="url(#' + q + 'b8)"');
    s += R(254, 440, 20, 8, '#8b938e') + R(258, 448, 8, 20, '#6b7470');
    s += PG([[284, 256], [298, 250], [298, 670], [284, 670]], 'url(#' + q + 'gap)');
    // 开关 + 旧外套
    s += R(318, 430, 20, 30, '#b8b3a2') + R(325, 438, 6, 12, '#3a3a33') + LN(328, 430, 328, 108, '#262b28', 2);
    s += CI(362, 260, 3, '#222') + PT('M362 262 l-26 30 -6 130 30 10 10-60 10 60 30-10 -8-130z', '#3c4035') + PT('M346 300 l4 110 M378 300 l-2 100', 'none', 'stroke="#2c3027" stroke-width="2"');
    // 床
    s += EL(505, 760, 220, 14, '#000', op(0.5) + ' filter="url(#' + q + 'b8)"');
    s += R(304, 560, 8, 200, '#2a2f2f') + R(344, 540, 8, 220, '#2a2f2f') + LN(308, 578, 348, 562, '#2a2f2f', 5) + LN(308, 620, 348, 604, '#2a2f2f', 5);
    for (i = 0; i < 4; i++) s += LN(318 + i * 8, 574 - i * 3, 318 + i * 8, 640 - i * 3, '#3a4040', 2.5);
    s += R(312, 640, 390, 36, '#5a5a4c') + R(312, 640, 390, 7, '#76765f');
    for (i = 0; i < 16; i++) s += LN(330 + i * 23, 648, 322 + i * 23, 674, '#4d4d40', 2, op(0.6));
    s += PT('M350 642 c20 -26 60 -30 110 -24 c60 8 90 -10 150 -6 c40 2 70 10 90 28 v36 h-350z', '#6b604b') + PT('M420 628 c40 -8 80 4 130 -2', 'none', 'stroke="#4a4234" stroke-width="3"');
    for (i = 0; i < 22; i++) s += CI(560 + r() * 130, 630 + r() * 36, 2 + r() * 2, pick(r, ['#8a6a4e', '#7a5c44', '#94825a']), op(0.6));
    s += PT('M318 632 c6 -18 44 -20 58 -4 c4 8 -4 14 -30 14 c-20 0 -30 -2 -28 -10z', '#8a8570');
    s += R(312, 676, 390, 10, '#2a2f2f') + R(318, 686, 8, 74, '#2a2f2f') + R(690, 660, 8, 100, '#2a2f2f') + R(660, 610, 8, 150, '#2a2f2f') + LN(664, 612, 700, 600, '#2a2f2f', 5);
    s += R(326, 686, 360, 70, '#0e1210', op(0.7)) + EL(440, 744, 26, 10, '#3d4038') + R(530, 734, 50, 16, '#2e2a22') + R(586, 738, 44, 14, '#2e2a22');
    // 椅子
    s += EL(852, 716, 60, 8, '#000', op(0.45) + ' filter="url(#' + q + 'b3)"');
    s += R(812, 470, 9, 240, '#4d3a28') + R(880, 470, 9, 240, '#4d3a28') + R(810, 466, 82, 12, '#5e4631') + R(816, 510, 70, 8, '#5e4631');
    s += R(800, 590, 102, 14, '#5e4631') + R(804, 604, 8, 110, '#3e2e20') + R(890, 604, 8, 110, '#3e2e20') + R(806, 660, 90, 5, '#3e2e20');
    s += PT('M830 588 c10-16 40-16 52 0z', '#6a6450');
    // 杂物堆
    s += EL(985, 724, 90, 10, '#000', op(0.45) + ' filter="url(#' + q + 'b3)"');
    s += R(912, 630, 110, 90, '#5b4a36') + R(912, 630, 110, 10, '#6e5a42') + LN(912, 675, 1022, 675, '#3e3224', 2);
    s += R(930, 580, 80, 50, '#6a5a44') + LN(930, 605, 1010, 605, '#4a3e2e', 2);
    s += R(1024, 660, 36, 60, '#4c5a57', 'rx="8"') + R(1032, 650, 20, 12, '#3c4644');
    for (i = 0; i < 6; i++) s += R(900, 712 - i * 9, 64, 8, pick(r, ['#8e8a74', '#a09a80', '#7b7864']));
    s += LN(930, 668, 930, 712, '#3a3226', 1.5) + R(946, 546, 30, 34, '#3a4a4e', 'rx="4"') + R(954, 536, 14, 12, '#2a3234') + EL(961, 562, 8, 10, '#8aa0a2', op(0.4));
    s += R(1000, 596, 12, 36, '#3b4f3a') + R(1002, 588, 8, 10, '#2b3a2b');
    // 裸灯泡（坏）
    s += LN(760, 108, 760, 200, '#1a1e1c', 2) + CI(760, 210, 10, '#4b504a') + R(755, 194, 10, 10, '#2a2e2b') + CI(757, 207, 3, '#7a8078', op(0.6));
    // 门口漏出来的光
    s += PG([[290, 672], [300, 672], [520, 900], [380, 900]], '#e8b878', op(0.18));
    s += R(0, 0, 1600, 900, 'url(#' + q + 'vig)');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs>' + d + '</defs>' + s + '</svg>';
  }

  /* ============================================================ 书橱（可移动）+ 背后补丁 + 水泥板/裂纹/洞口 */
  function genCracks() {
    var r = rng(77), SQ = 0.43, RMAX = 134, cx = SLAB_C.x, cy = SLAB_C.y;
    function walk(x, y, ang, len, jit) {
      var p = [[x, y]], n = Math.max(2, Math.round(len / 10));
      for (var i = 0; i < n; i++) {
        ang += (r() - 0.5) * jit;
        var nx = x + Math.cos(ang) * 10, ny = y + Math.sin(ang) * 10;
        if (Math.sqrt(nx * nx + ny * ny) > RMAX) break;
        x = nx; y = ny; p.push([x, y]);
      }
      return p;
    }
    function toD(p) { return 'M' + p.map(function (a) { return n1(cx + a[0]) + ' ' + n1(cy + a[1] * SQ); }).join(' L'); }
    var st = [[], [], []], ends = [], i, a, p;
    var base = r() * 6.28;
    for (i = 0; i < 3; i++) {
      a = base + i * 2.1 + (r() - 0.5) * 0.6;
      p = walk((r() - 0.5) * 6, (r() - 0.5) * 6, a, 38 + r() * 26, 0.7);
      st[0].push({ d: toD(p), w: 2.6 }); ends.push({ p: p[p.length - 1], a: a });
    }
    ends.forEach(function (e) { var q = walk(e.p[0], e.p[1], e.a, 40 + r() * 30, 0.7); st[1].push({ d: toD(q), w: 2.1 }); e.p = q[q.length - 1]; });
    for (i = 0; i < 4; i++) {
      a = base + 1.05 + i * 1.57 + (r() - 0.5) * 0.5;
      p = walk(0, 0, a, 70 + r() * 50, 0.65);
      st[1].push({ d: toD(p), w: 1.9 }); ends.push({ p: p[p.length - 1], a: a });
    }
    ends.forEach(function (e) { var q = walk(e.p[0], e.p[1], e.a, 90, 0.8); if (q.length > 1) st[2].push({ d: toD(q), w: 1.8 }); });
    for (i = 0; i < 5; i++) { a = r() * 6.28; p = walk(0, 0, a, 140, 0.5); st[2].push({ d: toD(p), w: 2.8 }); }
    [48, 92].forEach(function (rad) {
      var a0 = r() * 6.28, span = 2.6 + r() * 1.8, q = [];
      for (var t = 0; t <= 1.001; t += 0.05) { var aa = a0 + span * t, rr = rad + (r() - 0.5) * 9; q.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
      st[2].push({ d: toD(q), w: 1.7 });
    });
    return st;
  }

  function holeSvg() {
    var r = rng(91), q = P + 'h-', s = '', i, rim = [];
    var rx = 110, ry = 46, cx = SLAB_C.x, cy = SLAB_C.y + 2;
    for (i = 0; i < 26; i++) {
      var a = i / 26 * Math.PI * 2, k = 0.86 + r() * 0.24;
      rim.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    s += '<clipPath id="' + q + 'clip"><polygon points="' + pts(rim) + '"/></clipPath>';
    s += PG(rim, '#030302');
    s += '<g clip-path="url(#' + q + 'clip)">';
    // 洞壁（远侧，被光照到一点）
    s += PT('M' + (cx - rx - 10) + ' ' + (cy - ry - 10) + ' H' + (cx + rx + 10) + ' V' + (cy + 6) + ' Q' + cx + ' ' + (cy - 14) + ' ' + (cx - rx - 10) + ' ' + (cy + 6) + ' Z', 'url(#' + q + 'wall)');
    // 锈铁梯
    var lx1 = cx - 26, lx2 = cx + 24, top = cy - ry + 4;
    s += LN(lx1, top, lx1 + 2, cy + ry, '#6e3f22', 4) + LN(lx2, top, lx2 + 2, cy + ry, '#6e3f22', 4);
    for (i = 0; i < 6; i++) { var yy = top + 8 + i * 12; s += LN(lx1, yy, lx2 + 1, yy, '#7d4726', 3.4) + LN(lx1, yy - 1.2, lx2 + 1, yy - 1.2, '#b3703e', 1, op(0.7)); }
    s += R(cx - rx - 10, cy - 10, (rx + 10) * 2, ry + 20, 'url(#' + q + 'fade)');
    s += '</g>';
    // 碎裂的边沿与碎块
    s += PG(rim, 'none', 'stroke="#5d655d" stroke-width="2.5" stroke-linejoin="round" ' + op(0.9));
    for (i = 0; i < 14; i++) {
      var p0 = rim[(r() * rim.length) | 0], sz = 4 + r() * 9, ch = [];
      for (var j = 0; j < 5; j++) { var aa = j / 5 * 6.28 + r(); ch.push([p0[0] + Math.cos(aa) * sz + (r() - 0.5) * 10, p0[1] + Math.sin(aa) * sz * 0.6 + (r() - 0.5) * 6]); }
      s += PG(ch, pick(r, ['#4a524a', '#3b423b', '#565e55']), 'stroke="#1a1e1b" stroke-width="1"');
    }
    return '<defs>' + LG(q + 'wall', 0, 0, 0, 1, [[0, '#59605a'], [0.5, '#2e332f'], [1, '#080908']]) +
      LG(q + 'fade', 0, 0, 0, 1, [[0, '#030302', 0], [0.7, '#030302', 0.95], [1, '#030302', 1]]) + '</defs>' + s;
  }

  function shelfSvg() {
    var r = rng(23), q = P + 's-', s = '', i, j;
    s += EL(1222, 726, 160, 9, '#000', op(0.55) + ' filter="url(#' + P + 'p-b6)"');
    s += R(1080, 220, 280, 500, 'url(#' + q + 'body)');
    s += R(1094, 236, 252, 300, '#1a130d');
    for (i = 0; i < 9; i++) s += LN(1110 + i * 26, 238, 1110 + i * 26, 534, '#120d09', 1.2);
    var pal = ['#5a3f2a', '#6b5238', '#3f4a3e', '#6e5a3c', '#4a3a2c', '#5e2c24', '#39404a', '#645034'];
    for (i = 0; i < 4; i++) {
      var ry = 236 + i * 75, bot = ry + 70, bx = 1098;
      while (bx < 1336) {
        var roll = r();
        if (roll < 0.07) { bx += 8 + r() * 16; continue; }
        if (roll < 0.26) {
          var sw = 32 + r() * 22, hy = bot, cnt = 3 + ((r() * 3) | 0);
          if (bx + sw > 1342) break;
          for (j = 0; j < cnt; j++) {
            var bh = 6 + r() * 3, c1 = pick(r, ['#b9a57a', '#a8946a', '#7d6a4c', '#2c3a52']);
            s += R(bx + (r() - 0.5) * 3, hy - bh, sw, bh, c1) + R(bx, hy - bh, sw, 1.2, '#d2c19a', op(0.35));
            hy -= bh + 0.6;
          }
          bx += sw + 3; continue;
        }
        var bw = 10 + r() * 14, bh2 = 44 + r() * 22;
        if (bx + bw > 1342) break;
        var col = pick(r, pal), body = R(bx, bot - bh2, bw, bh2, col) +
          R(bx, bot - bh2 + 6, bw, 2.5, '#c9b58a', op(0.28)) + R(bx, bot - 12, bw, 2.5, '#c9b58a', op(0.22)) +
          R(bx + 2, bot - bh2 + 16, bw - 4, 10, '#d8c8a0', op(0.18)) + R(bx, bot - bh2, 1.4, bh2, '#000', op(0.35));
        if (roll > 0.93 && bx > 1110) { s += '<g transform="rotate(' + n1(-6 - r() * 8) + ' ' + n1(bx + bw) + ' ' + bot + ')">' + body + '</g>'; bx += bw + 7; continue; }
        s += body; bx += bw + 0.8;
      }
      s += R(1094, bot, 252, 6, '#3e2c1d') + R(1094, bot, 252, 1.5, '#6a4e34') + R(1094, bot - 1, 252, 1, '#8a8a80', op(0.35));
    }
    // 玻璃门的反光
    s += R(1094, 236, 124, 300, '#d8e4dc', op(0.05)) + R(1220, 236, 126, 300, '#d8e4dc', op(0.08)) + LN(1219, 236, 1219, 536, '#3e2c1d', 5);
    s += PG([[1110, 236], [1150, 236], [1098, 330], [1098, 290]], '#e6efe8', op(0.07)) + PG([[1250, 236], [1300, 236], [1222, 380], [1222, 320]], '#e6efe8', op(0.07));
    s += PL([[1262, 300], [1280, 336], [1276, 362], [1296, 392]], '#cfd8d2', 1, op(0.35));
    // 下层柜门
    s += R(1094, 546, 120, 140, '#4a3524') + R(1224, 546, 122, 140, '#4a3524');
    s += R(1104, 556, 100, 120, 'none', 'stroke="#3a281a" stroke-width="3"') + R(1234, 556, 102, 120, 'none', 'stroke="#3a281a" stroke-width="3"');
    s += R(1200, 600, 6, 20, '#9a8660') + R(1232, 600, 6, 20, '#9a8660');
    for (i = 0; i < 5; i++) s += PL([[1098, 560 + i * 26], [1150, 562 + i * 26 + r() * 3], [1210, 558 + i * 26]], '#3c2a1b', 1, op(0.6));
    // 顶线、侧板、底座
    s += R(1074, 212, 292, 16, '#503a27') + R(1074, 212, 292, 2, '#7a5a3c') + R(1074, 210, 292, 2.5, '#8c8a80', op(0.45));
    s += R(1080, 228, 14, 492, '#46321f') + R(1346, 228, 14, 492, '#3a2919') + LN(1093, 228, 1093, 720, '#5e4631', 1.2);
    s += R(1080, 690, 280, 30, '#2e2016') + R(1080, 690, 280, 2, '#4a3524');
    s += R(1086, 718, 14, 6, '#1e150e') + R(1340, 718, 14, 6, '#1e150e');
    // 蛛网
    s += PT('M1074 214 L1112 214 M1074 214 L1074 252 M1074 214 L1104 244 M1080 214 Q1082 232 1074 234 M1090 214 Q1092 236 1074 244 M1100 214 Q1100 240 1074 250', 'none', 'stroke="#c8ccc6" stroke-width=".7" ' + op(0.35));
    return s;
  }

  function propsSvg(cracks) {
    var q = P + 'p-', s = '', i;
    var d = LG(q + 'bw', 0, 90, 0, 670, WALL_ST, true) + LG(q + 'fl', 0, 670, 0, 900, FLOOR_ST, true) +
      LG(P + 's-body', 0, 0, 1, 0, [[0, '#3a291b'], [0.5, '#44301f'], [1, '#382719']]) +
      RG(q + 'vig', '50%', '50%', '75%', [['55%', '#000', 0], ['100%', '#000', 0.6]]) +
      RG(q + 'sag', 0.5, 0.5, 0.5, [[0, '#0b0e0c', 0.55], [1, '#0b0e0c', 0]]) +
      BLUR(q + 'b6', 6) + BLUR(q + 'b3', 3) + BLUR(q + 'b10', 10) +
      '<mask id="' + q + 'mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><rect x="1058" y="196" width="328" height="676" fill="#fff" filter="url(#' + q + 'b10)"/></mask>';
    // 书橱背后的墙与地（补丁：挪开之后露出来）
    s += '<g mask="url(#' + q + 'mask)">';
    s += R(1040, 180, 360, 490, 'url(#' + q + 'bw)');
    for (i = 2; i < 8; i++) s += LN(1040, 90 + i * 72, 1400, 90 + i * 72, '#27302c', 1.5, op(0.5));
    s += R(1084, 216, 272, 454, '#6a7a72', op(0.22) + ' filter="url(#' + q + 'b3)"');
    s += R(1084, 216, 272, 454, 'none', 'stroke="#2a332e" stroke-width="3" ' + op(0.35) + ' filter="url(#' + q + 'b3)"');
    s += PT('M1086 218 L1130 218 M1086 218 L1086 262 M1086 218 L1118 250 M1092 218 Q1094 238 1086 240 M1104 218 Q1104 244 1086 252', 'none', 'stroke="#d0d6d0" stroke-width=".8" ' + op(0.4));
    s += PT('M1354 218 L1318 218 M1354 218 L1354 256 M1354 218 L1326 246 M1346 218 Q1344 236 1354 238', 'none', 'stroke="#d0d6d0" stroke-width=".8" ' + op(0.35));
    s += PL([[1300, 300], [1294, 340], [1306, 372], [1298, 420]], '#1f2723', 1.4, op(0.6));
    s += R(1040, 670, 360, 230, 'url(#' + q + 'fl)');
    s += LN(1040, 670, 1400, 670, '#1d2420', 2);
    s += PG([[1080, 672], [1360, 672], [1364, 722], [1076, 722]], '#525a52', op(0.45));
    s += R(1084, 714, 16, 8, '#161a17', op(0.7)) + R(1340, 714, 16, 8, '#161a17', op(0.7));
    s += R(0, 0, 1600, 900, 'url(#' + q + 'vig)');
    s += '</g>';
    // 拖动的擦痕（挪开后显示）
    s += '<g class="' + P + 'scrape" style="display:none">' +
      PT('M1090 716 L1330 718', 'none', 'stroke="#6a736a" stroke-width="3" ' + op(0.35) + ' stroke-linecap="round"') +
      PT('M1100 722 L1340 726', 'none', 'stroke="#6a736a" stroke-width="2" ' + op(0.3) + ' stroke-linecap="round"') + '</g>';
    // 水泥板 + 下陷 + 裂纹
    s += '<g class="' + P + 'slab">';
    s += PG(SLAB, '#373d37', 'stroke="#141816" stroke-width="2.5" stroke-linejoin="round"');
    s += PL([SLAB[0], SLAB[1]], '#5c645c', 1, op(0.6));
    s += EL(SLAB_C.x, SLAB_C.y + 4, 104, 42, 'url(#' + q + 'sag)', 'class="' + P + 'sag"');
    s += PT('M1120 750 l30 8 20 -4 36 10', 'none', 'stroke="#151816" stroke-width="1.5" ' + op(0.5));
    for (i = 0; i < 3; i++) {
      s += '<g class="' + P + 'crk' + i + '">';
      cracks[i].forEach(function (c) {
        s += PT(c.d, 'none', 'class="' + P + 'cl" stroke="#060706" stroke-width="' + c.w + '" stroke-linecap="round" stroke-linejoin="round"');
        s += PT(c.d, 'none', 'class="' + P + 'cl" transform="translate(.8 1.4)" stroke="#b9c2b9" stroke-opacity=".28" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"');
      });
      s += '</g>';
    }
    s += '</g>';
    s += '<g class="' + P + 'hole" style="display:none">' + holeSvg() + '</g>';
    s += '<g class="' + P + 'shelf">' + shelfSvg() + '</g>';
    return '<svg class="' + P + 'props" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900"><defs>' + d + '</defs>' + s + '</svg>';
  }

  /* ============================================================ 幽影手臂（钱六） */
  function armMarkup(k) {
    var st = 'fill="rgba(200,222,208,.24)" stroke="rgba(226,244,232,.78)" stroke-width="1.6" stroke-linejoin="round"';
    var bone = 'fill="none" stroke="rgba(236,250,240,.45)" stroke-width="1.1" stroke-linecap="round"';
    var fingers = '', fdef = [[26, -9, -13, 50], [29, -3, -4, 56], [30, 3, 5, 52], [28, 9, 14, 42]];
    fdef.forEach(function (f) {
      var x = f[0], y = f[1], a = f[2] * Math.PI / 180, seg = f[3] / 3, pl = [[x, y]];
      for (var i = 0; i < 3; i++) { a += 0.12; x += Math.cos(a) * seg; y += Math.sin(a) * seg; pl.push([x, y]); }
      fingers += PL(pl, 'rgba(214,236,222,.55)', 5.2) + PL(pl, 'rgba(240,252,244,.8)', 1.4);
      fingers += CI(pl[1][0], pl[1][1], 3.2, 'rgba(226,244,232,.5)') + CI(pl[2][0], pl[2][1], 2.6, 'rgba(226,244,232,.45)');
    });
    fingers += PL([[6, -8], [18, -26], [28, -38]], 'rgba(214,236,222,.55)', 5.5) + PL([[6, -8], [18, -26], [28, -38]], 'rgba(240,252,244,.8)', 1.4);
    return '<g class="' + P + 'arm' + k + '">' +
      '<g data-seg="u">' +
        PT('M-22 -22 Q18 -28 60 -18 L52 -10 L64 -3 L50 4 L62 12 L46 18 Q10 24 -22 20 Z', 'rgba(150,168,154,.16)', 'stroke="rgba(200,222,208,.32)" stroke-width="1.2"') +
        PT('M-4 -11 C40 -13 100 -9 150 -8 L150 8 C100 10 40 12 -4 11 Z', 'rgba(0,0,0,0)', st) +
        PT('M8 -2 C60 -3 110 -1 146 -1', 'none', bone) + EL(150, 0, 10, 9, 'rgba(210,232,218,.3)', 'stroke="rgba(226,244,232,.7)" stroke-width="1.4"') +
        '<g data-seg="f" transform="translate(150,0)">' +
          PT('M0 -8 C45 -7 95 -6 132 -5 L132 5 C95 6 45 7 0 8 Z', 'rgba(0,0,0,0)', st) +
          PT('M8 -2.5 L126 -1.5 M8 2.5 L126 1.8', 'none', bone) +
          '<g data-seg="h" transform="translate(132,0)">' +
            PT('M-3 -7 Q10 -10 27 -11 L31 11 Q12 11 -3 7 Z', 'rgba(0,0,0,0)', st) + fingers +
          '</g>' +
        '</g>' +
      '</g></g>';
  }
  function ghostSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900"><defs>' +
      '<filter id="' + P + 'glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      RG(P + 'mist', 0.5, 0.5, 0.5, [[0, '#cfe4d6', 0.28], [1, '#cfe4d6', 0]]) +
      '</defs>' +
      EL(SHOULDER.x + 30, SHOULDER.y - 4, 150, 44, 'url(#' + P + 'mist)', 'class="' + P + 'mistel"') +
      '<g filter="url(#' + P + 'glow)">' + armMarkup(3) + armMarkup(2) + armMarkup(1) + armMarkup(0) + '</g>' +
      '</svg>';
  }

  /* ============================================================ 坠落特写：抓住卫先的脚踝 */
  function grabSvg() {
    var r = rng(41), q = P + 'g-', s = '', i;
    var d = RG(q + 'glare', 0.5, 0.5, 0.5, [[0, '#fff6e0', 0.9], [0.22, '#f0dcb4', 0.42], [1, '#f0dcb4', 0]]) +
      LG(q + 'beam', 0, 0, 0, 1, [[0, '#f6ead0', 0.3], [1, '#f6ead0', 0]]) +
      LG(q + 'rimW', 1, 0, 0, 1, [[0, '#a6f7ec'], [0.4, '#4fb3a9', 0.85], [0.8, '#4fb3a9', 0]]) +
      LG(q + 'rimN', 1, 0, 0, 1, [[0, '#ffe3aa'], [0.45, '#e0b56a', 0.85], [0.85, '#e0b56a', 0]]) +
      LG(q + 'upper', 0, 0, 0, 1, [[0, '#2a2e2a'], [1, '#161a17']]) +
      LG(q + 'shaft', 0, 0, 0, 1, [[0, '#191b18'], [1, '#040404']]) +
      LG(q + 'skin', 0, 0, 1, 1, [[0, '#2c241b'], [1, '#110d0a']]) +
      LG(q + 'cloth', 0, 0, 1, 1, [[0, '#191a1e'], [1, '#0b0b0d']]) +
      RG(q + 'vig', 0.5, 0.45, 0.72, [[0.5, '#000', 0], [1, '#000', 0.9]]) +
      BLUR(q + 'b3', 3) + BLUR(q + 'b8', 8) + BLUR(q + 'b24', 24);
    s += R(0, 0, 1600, 900, '#050505');
    // 洞口上方：地下室的黑暗，被卫先的手电照亮一片
    var rimTop = [], x;
    for (x = -20; x <= 1620; x += 40) rimTop.push([x, 332 + Math.sin(x * 0.004) * 16 + (r() - 0.5) * 18]);
    s += PT('M-20 -20 H1620 V' + n1(rimTop[rimTop.length - 1][1]) + ' L' + rimTop.slice().reverse().map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join(' L') + ' Z', 'url(#' + q + 'upper)');
    s += CI(1180, 90, 460, 'url(#' + q + 'glare)');
    // 碎裂的水泥板断面
    var rimBot = rimTop.map(function (p) { return [p[0], p[1] + 46 + (r() - 0.3) * 26]; });
    s += PT('M' + rimTop.map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join(' L') + ' L' + rimBot.slice().reverse().map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join(' L') + ' Z', '#343a34');
    s += PL(rimTop, '#8a948a', 2.5, op(0.8));
    for (i = 0; i < 26; i++) { var rp = rimBot[(r() * rimBot.length) | 0]; s += PG([[rp[0] - 8, rp[1] - 4], [rp[0] + 10, rp[1] - 2], [rp[0] + 4, rp[1] + 8 + r() * 12]], '#2a2f2a'); }
    // 洞壁（竖井）
    s += PT('M-20 ' + n1(rimBot[0][1]) + ' L' + rimBot.map(function (p) { return n1(p[0]) + ' ' + n1(p[1]); }).join(' L') + ' V920 H-20 Z', 'url(#' + q + 'shaft)');
    for (i = 0; i < 16; i++) { x = r() * 1600; s += LN(x, 420 + r() * 60, x + (r() - 0.5) * 30, 900, '#000', 2 + r() * 5, op(0.3)); }
    // 手电的光柱（从右上往下）
    s += PG([[1120, 0], [1330, 0], [760, 900], [330, 900]], 'url(#' + q + 'beam)', 'filter="url(#' + q + 'b8)"');
    // 卫先：另一只脚（远一点）
    s += PT('M470 -10 L548 -10 Q552 120 540 240 L536 300 L486 300 Q480 200 476 120 Z', 'url(#' + q + 'cloth)');
    s += PT('M548 -10 Q552 120 540 240 L536 300', 'none', 'stroke="url(#' + q + 'rimW)" stroke-width="2" ' + op(0.7));
    s += PT('M536 296 Q544 312 540 326 L438 330 Q420 330 418 320 Q424 308 450 304 Q480 300 500 294 Z', '#0b0c0f');
    // 卫先：被抓住的那只脚
    s += PT('M700 -10 L842 -10 Q848 110 834 222 L828 300 L754 300 Q746 212 734 132 Q716 52 700 -10 Z', 'url(#' + q + 'cloth)');
    s += PT('M842 -10 Q848 110 834 222 L828 300', 'none', 'stroke="url(#' + q + 'rimW)" stroke-width="7" ' + op(0.35) + ' filter="url(#' + q + 'b3)"');
    s += PT('M842 -10 Q848 110 834 222 L828 300', 'none', 'stroke="#8ff0e4" stroke-width="2.4" ' + op(0.85));
    s += PT('M760 120 Q790 150 800 220', 'none', 'stroke="#23262c" stroke-width="2"');
    s += PT('M834 294 Q852 316 846 336 L676 342 Q640 344 632 330 Q640 312 676 306 Q720 300 758 292 Z', '#0a0b0e');
    s += PT('M846 336 L676 342 Q640 344 632 330 L632 338 Q642 352 676 352 L848 346 Z', '#2a2c30');
    s += PT('M632 330 Q640 312 676 306 Q720 300 758 292 L834 294', 'none', 'stroke="#8ff0e4" stroke-width="2" ' + op(0.75));
    for (i = 0; i < 4; i++) s += LN(700 + i * 16, 312 - i * 3, 712 + i * 16, 306 - i * 3, '#30333a', 2);
    // 那多的手：手背朝向镜头，四指从右往左扣住脚踝
    var hand = '';
    hand += PT('M868 352 Q902 326 944 352 Q1010 560 1130 910 L940 910 Q900 650 868 352 Z', 'url(#' + q + 'skin)');                        // 前臂
    hand += PT('M902 568 Q966 540 1020 578 L1150 910 L930 910 Z', '#0d0d0f');                                                              // 袖子
    hand += PT('M902 568 Q930 580 944 572 Q960 590 978 574 Q996 590 1020 578', 'none', 'stroke="#3a3530" stroke-width="2"');
    hand += PT('M852 206 Q890 200 910 222 L932 300 Q940 336 918 360 L860 354 Q846 300 852 206 Z', 'url(#' + q + 'skin)');              // 手背
    var fy = [224, 247, 270, 292];
    fy.forEach(function (y, k) {
      var tip = 750 + k * 3;
      hand += PT('M872 ' + (y - 11) + ' Q812 ' + (y - 14) + ' ' + (tip + 8) + ' ' + (y - 9) + ' Q' + (tip - 4) + ' ' + (y + 1) + ' ' + (tip + 8) + ' ' + (y + 10) + ' Q812 ' + (y + 12) + ' 872 ' + (y + 10) + ' Z', 'url(#' + q + 'skin)', 'stroke="#070605" stroke-width="1.5"');
      hand += PT('M838 ' + (y - 8) + ' q-4 8 0 16 M800 ' + (y - 9) + ' q-3 8 0 17', 'none', 'stroke="#3a2e22" stroke-width="1.4" ' + op(0.8));
    });
    hand += PT('M872 300 Q836 316 800 314 Q788 308 796 300 Q828 296 862 288 Z', 'url(#' + q + 'skin)', 'stroke="#070605" stroke-width="1.5"');  // 拇指
    s += hand;
    // 手与手臂的轮廓光（琥珀）
    var rimN = 'M868 352 Q902 326 944 352 Q1010 560 1130 910 M852 206 Q890 200 910 222 L932 300 Q940 336 918 360';
    fy.forEach(function (y) { rimN += ' M872 ' + (y - 11) + ' Q812 ' + (y - 14) + ' 758 ' + (y - 9); });
    s += PT(rimN, 'none', 'stroke="#e0b56a" stroke-width="7" ' + op(0.35) + ' filter="url(#' + q + 'b3)"');
    s += PT(rimN, 'none', 'stroke="#ffd896" stroke-width="2.2" ' + op(0.85) + ' stroke-linecap="round"');
    // 掉落的碎块与灰
    for (i = 0; i < 22; i++) {
      var sz = 3 + r() * 9, cx = 380 + r() * 900, cy = 300 + r() * 60, ch = [];
      for (var j = 0; j < 5; j++) { var aa = j / 5 * 6.28 + r(); ch.push([cx + Math.cos(aa) * sz, cy + Math.sin(aa) * sz]); }
      s += '<g class="' + P + 'deb" style="--dx:' + n1((r() - 0.5) * 160) + 'px;--rot:' + ((r() * 720) | 0) + 'deg;animation-duration:' + (0.9 + r() * 1.1).toFixed(2) + 's;animation-delay:-' + (r() * 2).toFixed(2) + 's">' + PG(ch, pick(r, ['#4a524a', '#3a403a', '#5a625a']), 'stroke="#111" stroke-width="1"') + '</g>';
    }
    for (i = 0; i < 40; i++) {
      s += '<g class="' + P + 'deb" style="--dx:' + n1((r() - 0.5) * 80) + 'px;--rot:0deg;animation-duration:' + (1.6 + r() * 1.6).toFixed(2) + 's;animation-delay:-' + (r() * 3).toFixed(2) + 's">' + CI(420 + r() * 820, 280 + r() * 120, 0.8 + r() * 1.6, '#e8dcc0', op(n1(0.25 + r() * 0.5))) + '</g>';
    }
    s += R(0, 0, 1600, 900, 'url(#' + q + 'vig)');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900"><defs>' + d + '</defs>' + s + '</svg>';
  }

  /* ============================================================ 样式 */
  function css() {
    var c = '.' + P;
    return [
      c + 'stage{position:absolute;left:0;top:0;width:1600px;height:900px;overflow:hidden;background:#000;cursor:none;}',
      c + 'world{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;will-change:transform;transition:filter 1.1s ease;}',
      c + 'bg{position:absolute;left:0;top:0;width:1600px;height:900px;}',
      c + 'bg>svg{display:block;width:1600px;height:900px;}',
      c + 'props{position:absolute;left:0;top:0;}',
      c + 'tint{position:absolute;left:0;top:0;width:1600px;height:900px;mix-blend-mode:soft-light;pointer-events:none;}',
      c + 'dark{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;}',
      c + 'ghost{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:0 0;pointer-events:none;opacity:0;transition:opacity .7s;}',
      c + 'grab{position:absolute;left:0;top:0;width:1600px;height:900px;display:none;pointer-events:none;}',
      c + 'grab>svg{display:block;transform-origin:800px 260px;animation:' + P + 'sway 1.6s ease-in-out infinite alternate;}',
      '@keyframes ' + P + 'sway{from{transform:rotate(-.9deg) translateY(-4px)}to{transform:rotate(1deg) translateY(5px)}}',
      c + 'deb{transform-box:fill-box;transform-origin:center;animation-name:' + P + 'fall;animation-timing-function:cubic-bezier(.4,0,1,1);animation-iteration-count:infinite;}',
      '@keyframes ' + P + 'fall{from{transform:translate(0,0) rotate(0deg);opacity:1}to{transform:translate(var(--dx),640px) rotate(var(--rot));opacity:.2}}',
      c + 'flash{position:absolute;left:0;top:0;width:1600px;height:900px;background:#fff;opacity:0;pointer-events:none;}',
      c + 'fade{position:absolute;left:0;top:0;width:1600px;height:900px;background:#000;opacity:1;pointer-events:none;transition:opacity .8s ease;z-index:70;}',
      c + 'hud{position:absolute;left:0;top:0;width:1600px;height:0;pointer-events:none;z-index:60;font-family:' + FONT + ';}',
      c + 'obj{position:absolute;left:48px;top:34px;padding:4px 0 8px 18px;border-left:3px solid #e0b56a;color:#efe6d2;font-size:30px;line-height:1.35;letter-spacing:.04em;' +
        'text-shadow:0 2px 10px #000,0 0 3px #000;opacity:0;transform:translateY(-8px);transition:opacity .5s,transform .5s;white-space:nowrap;}',
      c + 'obj.on{opacity:1;transform:none}',
      c + 'obj small{display:block;font-size:18px;letter-spacing:.42em;color:#e0b56a;margin-bottom:3px;}',
      c + 'dots{margin-left:16px;font-size:22px;letter-spacing:.25em;color:#e0b56a;vertical-align:3px;}',
      c + 'obj.pulse{animation:' + P + 'pulse 1.1s ease-in-out 3;}',
      '@keyframes ' + P + 'pulse{50%{text-shadow:0 0 18px rgba(224,181,106,.9),0 2px 10px #000;border-left-color:#ffe0a0}}',
      c + 'help{position:absolute;right:48px;top:38px;text-align:right;color:rgba(239,230,210,.66);font-size:22px;line-height:1.65;letter-spacing:.05em;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .9s;}',
      c + 'help b{color:#e0b56a;font-weight:normal;}',
      c + 'help.on{opacity:1}',
      c + 'help.dim{opacity:.4}',
      c + 'label{position:absolute;left:0;top:0;z-index:61;pointer-events:none;color:#efe6d2;font:26px/1 ' + FONT + ';letter-spacing:.06em;padding:9px 16px 10px;' +
        'background:rgba(8,8,8,.72);border:1px solid rgba(224,181,106,.6);border-radius:3px;white-space:nowrap;opacity:0;transition:opacity .18s;text-shadow:0 1px 4px #000;}',
      c + 'label.on{opacity:1}',
      c + 'label i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#e0b56a;margin-right:10px;vertical-align:4px;box-shadow:0 0 8px #e0b56a;}'
    ].join('');
  }

  /* ============================================================ 主体 */
  GF.games.register(ID, {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, easy = !!ctx.easy;
        var au = ctx.audio || {};
        function sfx(id) { try { if (au && au.sfx) au.sfx(id); } catch (e) { /* 音频可能是空实现 */ } }
        function heartbeat(b) { try { if (au && au.heartbeat) au.heartbeat(b); } catch (e) { /* 同上 */ } }

        var ended = false, timers = [], rafId = 0;
        function later(fn, ms) {
          var t = setTimeout(function () { var i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); if (!ended) fn(); }, ms);
          timers.push(t); return t;
        }
        function wait(ms) { return new Promise(function (res) { later(res, ms); }); }
        function say(text, who) {
          if (ended) return new Promise(function () {});
          if (!ctx.say) return wait(1800);
          return Promise.resolve(ctx.say(text, who));
        }

        /* ---------- DOM ---------- */
        var bgStr = '';
        try { bgStr = ctx.bgSvg ? (ctx.bgSvg('basement') || '') : ''; } catch (e) { bgStr = ''; }
        var hasBg = bgStr.indexOf('<svg') >= 0;
        var cracks = genCracks();
        root.innerHTML = '<style>' + css() + '</style>' +
          '<div class="' + P + 'stage" data-step="intro" data-busy="1" data-hover="">' +
            '<div class="' + P + 'world"><div class="' + P + 'bg">' + (hasBg ? bgStr : roomSvg()) + '</div>' + propsSvg(cracks) + '</div>' +
            '<canvas class="' + P + 'tint" width="1600" height="900"></canvas>' +
            '<canvas class="' + P + 'dark" width="1600" height="900"></canvas>' +
            '<div class="' + P + 'ghost">' + ghostSvg() + '</div>' +
            '<div class="' + P + 'grab">' + grabSvg() + '</div>' +
          '</div>' +
          '<div class="' + P + 'flash"></div>' +
          '<div class="' + P + 'hud">' +
            '<div class="' + P + 'obj"><small>目 标</small><span class="' + P + 'objt"></span><span class="' + P + 'dots"></span></div>' +
            '<div class="' + P + 'help">移动鼠标 / 手指：<b>照亮</b>　点击：<b>调查</b><br>键盘：方向键移动 · 空格调查 · Tab 切换</div>' +
          '</div>' +
          '<div class="' + P + 'label"><i></i><span></span></div>' +
          '<div class="' + P + 'fade"></div>';
        function $(c) { return root.querySelector('.' + P + c); }
        var stage = $('stage'), world = $('world'), bgEl = $('bg'), ghost = $('ghost'), grab = $('grab');
        var tintCv = $('tint'), darkCv = $('dark'), flash = $('flash'), fade = $('fade');
        var objEl = $('obj'), objT = $('objt'), dotsEl = $('dots'), helpEl = $('help'), label = $('label'), labelT = label.querySelector('span');
        var shelfG = $('shelf'), holeG = $('hole'), scrapeG = $('scrape'), sagEl = $('sag');
        var tg = tintCv.getContext('2d'), dg = darkCv.getContext('2d');

        // 背景自带的暗层去掉，让手电照出“亮着”的样子；没有暗层时按平均亮度提亮
        if (hasBg) {
          var dim = bgEl.querySelector('#bg-bsm-dim');
          if (dim) dim.style.display = 'none';
          else measureBg(bgStr, function (L) { if (L && L < 0.2) bgEl.style.filter = 'brightness(' + clamp(0.24 / L, 1, 2.4).toFixed(2) + ')'; });
        }
        function measureBg(str, cb) {
          try {
            var img = new Image();
            img.onload = function () {
              try {
                var c = document.createElement('canvas'); c.width = 160; c.height = 90;
                var g = c.getContext('2d'); g.drawImage(img, 0, 0, 160, 90);
                var dd = g.getImageData(0, 0, 160, 90).data, sum = 0;
                for (var i = 0; i < dd.length; i += 4) sum += (0.2126 * dd[i] + 0.7152 * dd[i + 1] + 0.0722 * dd[i + 2]) / 255;
                if (!ended) cb(sum / (dd.length / 4));
              } catch (e) { /* 画布被污染等：放弃自适应 */ }
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
          } catch (e) { /* 忽略 */ }
        }

        // 裂纹路径：先藏起来，踩一次长一截
        var crackGroups = [0, 1, 2].map(function (i) { return $('crk' + i); });
        crackGroups.forEach(function (g) {
          Array.prototype.forEach.call(g.querySelectorAll('path'), function (p) {
            var L = 60;
            try { L = p.getTotalLength() + 2; } catch (e) { /* 忽略 */ }
            p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L;
          });
        });
        function growCracks(i, ms) {
          Array.prototype.forEach.call(crackGroups[i].querySelectorAll('path'), function (p, k) {
            p.style.transition = 'stroke-dashoffset ' + ms + 'ms cubic-bezier(.2,.7,.3,1) ' + ((k >> 1) * 18) + 'ms';
            p.style.strokeDashoffset = '0';
          });
        }

        // 幽影手臂的节点
        var arms = [0, 1, 2, 3].map(function (k) {
          var g = ghost.querySelector('.' + P + 'arm' + k);
          return { g: g, u: g.querySelector('[data-seg="u"]'), f: g.querySelector('[data-seg="f"]'), h: g.querySelector('[data-seg="h"]') };
        });
        arms.forEach(function (a, k) { a.g.setAttribute('opacity', [1, 0.34, 0.2, 0.1][k]); });
        function setArm(a, v) {
          a.u.setAttribute('transform', 'translate(' + SHOULDER.x + ',' + SHOULDER.y + ') rotate(' + v[0].toFixed(2) + ') scale(1.22)');
          a.f.setAttribute('transform', 'translate(150,0) rotate(' + v[1].toFixed(2) + ')');
          a.h.setAttribute('transform', 'translate(132,0) rotate(' + v[2].toFixed(2) + ')');
        }
        arms.forEach(function (a) { setArm(a, [4, 6, 8]); });

        /* ---------- 状态 ---------- */
        var S = { step: 'intro', busy: true, stomps: 0, shelfMoved: false, lastProgress: performance.now(), hintIdx: 0, lockTorch: false, cmt: {} };
        var torch = { x: 640, y: 560, px: 640, py: 560, r: easy ? 212 : 190, I: 0, dim: 1 };
        var wx = { x: 1180, y: 340, tx: 1180, ty: 340, I: 0, on: 0, mode: 'wander', pause: 0.5, r: 116, speed: 170, jit: 0 };
        var WANDER = [[520, 300], [900, 200], [1250, 330], [700, 600], [1010, 690], [400, 440], [1400, 560], [860, 430], [240, 560], [1180, 640], [620, 180]];
        var FLOOR_WANDER = [[1160, 770], [1270, 800], [1210, 740], [1300, 770], [1120, 800]];
        var cam = { x: 0, y: 0, r: 0, s: 1 };
        var shake = 0, tremble = 0, beacon = { I: 0, until: 0 }, ripples = [];
        var anims = [], keys = {}, T = 0, lastT = performance.now();
        var hoverKey = '';

        function setStep(st) { S.step = st; stage.setAttribute('data-step', st); S.lastProgress = performance.now(); S.hintIdx = 0; }
        function setBusy(b) { S.busy = b; stage.setAttribute('data-busy', b ? '1' : '0'); if (!b) S.lastProgress = performance.now(); }
        function setObjective(text, dots) {
          if (!text) { objEl.classList.remove('on'); return; }
          objT.textContent = text; dotsEl.textContent = dots || '';
          objEl.classList.remove('pulse'); void objEl.offsetWidth; objEl.classList.add('on', 'pulse');
        }
        function stompDots() { var s = ''; for (var i = 0; i < 3; i++) s += i < S.stomps ? '●' : '○'; return s; }

        /* ---------- 摄像机（world 与 ghost 同步变换） ---------- */
        function applyCam() {
          var tr = 'translate(' + n1(cam.x) + 'px,' + n1(cam.y) + 'px) rotate(' + cam.r.toFixed(3) + 'deg) scale(' + cam.s.toFixed(4) + ')';
          world.style.transform = tr; ghost.style.transform = tr;
        }
        function camFor(px, py, s, rDeg, dx, dy) {
          var a = rDeg * Math.PI / 180, c = Math.cos(a) * s, si = Math.sin(a) * s;
          return { x: px + dx - (c * px - si * py), y: py + dy - (si * px + c * py), r: rDeg, s: s };
        }
        function w2s(x, y) {
          var a = cam.r * Math.PI / 180, c = Math.cos(a) * cam.s, si = Math.sin(a) * cam.s;
          return { x: cam.x + c * x - si * y, y: cam.y + si * x + c * y };
        }
        function s2w(x, y) {
          var a = cam.r * Math.PI / 180, c = Math.cos(a), si = Math.sin(a), dx = (x - cam.x) / cam.s, dy = (y - cam.y) / cam.s;
          return { x: c * dx + si * dy, y: -si * dx + c * dy };
        }
        function tween(ms, fn, ease) {
          return new Promise(function (res) { anims.push({ t0: performance.now(), ms: Math.max(1, ms), fn: fn, ease: ease || easeInOut, res: res }); });
        }
        function camTo(tg2, ms, ease) {
          var f = { x: cam.x, y: cam.y, r: cam.r, s: cam.s };
          return tween(ms, function (t) {
            cam.x = lerp(f.x, tg2.x, t); cam.y = lerp(f.y, tg2.y, t); cam.r = lerp(f.r, tg2.r, t); cam.s = lerp(f.s, tg2.s, t); applyCam();
          }, ease);
        }

        /* ---------- 粒子：浮尘 + 迸出的灰 ---------- */
        var mr = rng(5), motes = [], bursts = [];
        for (var mi = 0; mi < 90; mi++) motes.push({ x: mr() * W, y: mr() * H, vx: (mr() - 0.5) * 8, vy: (mr() - 0.5) * 6 - 2, s: 0.6 + mr() * 1.7, ph: mr() * 6.28 });
        function burst(x, y, n, spread, up, grav, life) {
          for (var i = 0; i < n; i++) {
            var a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
            var v = up * (0.35 + Math.random() * 0.8);
            bursts.push({ x: x + (Math.random() - 0.5) * 80, y: y + (Math.random() - 0.5) * 16, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: grav, life: 0, max: life * (0.6 + Math.random() * 0.7), s: 0.8 + Math.random() * 2.2 });
          }
        }

        /* ---------- 渲染：黑暗遮罩 + 光圈 ---------- */
        function floorSquash(y) { var t = clamp((y - 620) / 200, 0, 1); t = t * t * (3 - 2 * t); return [1 + 0.16 * t, 1 - 0.26 * t]; }
        function spotCut(g, x, y, r, I, sx, sy) {
          if (I <= 0.002) return;
          g.save(); g.translate(x, y); g.scale(sx, sy);
          var gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
          gr.addColorStop(0, 'rgba(0,0,0,' + I + ')');
          gr.addColorStop(0.46, 'rgba(0,0,0,' + (I * 0.97) + ')');
          gr.addColorStop(0.7, 'rgba(0,0,0,' + (I * 0.74) + ')');
          gr.addColorStop(0.86, 'rgba(0,0,0,' + (I * 0.32) + ')');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
        }
        function ringGrad(g, x, y, r, r0, r1, col, a) {
          var gr = g.createRadialGradient(x, y, r * r0, x, y, r * r1);
          gr.addColorStop(0, 'rgba(' + col + ',0)'); gr.addColorStop(0.55, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
          return gr;
        }
        function fringe(g, x, y, r, I, sx, sy) {
          if (I <= 0.02) return;
          g.save(); g.translate(x + 2.4, y + 1.2); g.scale(sx, sy);
          g.fillStyle = ringGrad(g, 0, 0, r, 0.8, 1.0, '255,122,60', (0.16 * I).toFixed(3));
          g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
          g.save(); g.translate(x - 2.4, y - 1.2); g.scale(sx, sy);
          g.fillStyle = ringGrad(g, 0, 0, r, 0.66, 0.9, '96,160,255', (0.1 * I).toFixed(3));
          g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
        }
        var wpCache = { x: 0, y: 0 };
        function wxScreen() { return wpCache; }
        function updateWxScreen() {
          wpCache = w2s(wx.x + Math.sin(T * 1.7) * 3 + wx.jit * (Math.random() - 0.5), wx.y + Math.cos(T * 2.3) * 3 + wx.jit * (Math.random() - 0.5));
        }
        function lightAt(x, y, tp, wp) {
          var b = 0, d;
          d = Math.hypot(x - torch.x, (y - torch.y) * 1.1) / torch.r; if (d < 1) b += torch.I * torch.dim * Math.pow(1 - d, 1.4);
          d = Math.hypot(x - wp.x, y - wp.y) / wx.r; if (d < 1) b += wx.I * 0.9 * Math.pow(1 - d, 1.4);
          return b;
        }
        function renderDark() {
          var g = dg, tp = { x: torch.x, y: torch.y }, wp = wxScreen();
          g.globalCompositeOperation = 'source-over';
          g.clearRect(0, 0, W, H);
          g.fillStyle = 'rgba(2,2,3,0.986)';
          g.fillRect(0, 0, W, H);
          g.globalCompositeOperation = 'destination-out';
          // 门缝的一线微光
          var dp = w2s(292, 460), dfl = w2s(330, 760);
          spotCut(g, dp.x, dp.y, 70, 0.22, 0.42, 3.4);
          spotCut(g, dfl.x, dfl.y, 190, 0.12, 1, 0.32);
          // 卫先的手电：光柱 + 光斑
          if (wx.I > 0.01) {
            var ax = 1180 + (wp.x - 800) * 0.22, ay = 1000;
            var dx = wp.x - ax, dy = wp.y - ay, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, hw = wx.r * 0.72;
            var cg = g.createLinearGradient(ax, ay, wp.x, wp.y);
            cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(0.55, 'rgba(0,0,0,' + (0.05 * wx.I) + ')'); cg.addColorStop(1, 'rgba(0,0,0,' + (0.13 * wx.I) + ')');
            g.fillStyle = cg; g.beginPath();
            g.moveTo(ax + nx * 8, ay + ny * 8); g.lineTo(wp.x + nx * hw, wp.y + ny * hw); g.lineTo(wp.x - nx * hw, wp.y - ny * hw); g.lineTo(ax - nx * 8, ay - ny * 8);
            g.closePath(); g.fill();
            var ws = floorSquash(wp.y);
            spotCut(g, wp.x, wp.y, wx.r, 0.9 * wx.I, ws[0], ws[1]);
          }
          // 提示微光（简单模式 / 提示后）
          var bt = beaconTarget();
          if (bt && beacon.I > 0.01) {
            var bp = w2s(bt[0], bt[1]);
            spotCut(g, bp.x, bp.y, 120, 0.16 * beacon.I * (0.6 + 0.4 * Math.sin(T * 3.2)), 1.2, 1);
          }
          // 那多的手电
          var I = torch.I * torch.dim, sq = floorSquash(tp.y), rr = torch.r * (1 + Math.sin(T * 1.9) * 0.012);
          spotCut(g, tp.x, tp.y, rr, I, sq[0], sq[1]);
          // 色散边 + 暖色雾
          g.globalCompositeOperation = 'source-over';
          fringe(g, tp.x, tp.y, rr, I, sq[0], sq[1]);
          if (I > 0.02) {
            var hz = g.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, rr * 0.9);
            hz.addColorStop(0, 'rgba(255,214,160,' + (0.07 * I) + ')'); hz.addColorStop(1, 'rgba(255,200,140,0)');
            g.fillStyle = hz; g.fillRect(tp.x - rr, tp.y - rr, rr * 2, rr * 2);
          }
          // 浮尘
          g.globalCompositeOperation = 'lighter';
          var i, m, b;
          for (i = 0; i < motes.length; i++) {
            m = motes[i]; b = lightAt(m.x, m.y, tp, wp);
            if (b < 0.03) continue;
            g.fillStyle = 'rgba(255,238,205,' + Math.min(0.8, b * 0.75 * (0.6 + 0.4 * Math.sin(T * 2 + m.ph))).toFixed(3) + ')';
            g.beginPath(); g.arc(m.x, m.y, m.s, 0, 6.2832); g.fill();
          }
          for (i = 0; i < bursts.length; i++) {
            m = bursts[i]; b = Math.max(0.12, lightAt(m.x, m.y, tp, wp)) * (1 - m.life / m.max);
            g.fillStyle = 'rgba(225,215,195,' + Math.min(0.85, b).toFixed(3) + ')';
            g.beginPath(); g.arc(m.x, m.y, m.s, 0, 6.2832); g.fill();
          }
          for (i = 0; i < ripples.length; i++) {
            var rp = ripples[i], k = rp.t / 0.55;
            g.strokeStyle = 'rgba(224,181,106,' + (0.5 * (1 - k)).toFixed(3) + ')'; g.lineWidth = 2;
            g.beginPath(); g.ellipse(rp.x, rp.y, 10 + 44 * k, (10 + 44 * k) * 0.6, 0, 0, 6.2832); g.stroke();
          }
          // 光心的小准星
          if (I > 0.3 && !S.lockTorch) {
            g.globalCompositeOperation = 'source-over';
            g.strokeStyle = 'rgba(239,230,210,.5)'; g.lineWidth = 1.5;
            g.beginPath(); g.arc(torch.px, torch.py, 5, 0, 6.2832); g.stroke();
          }
        }
        function renderTint() {
          var g = tg;
          g.clearRect(0, 0, W, H);
          var I = torch.I * torch.dim;
          if (I > 0.01) {
            var sq = floorSquash(torch.y), r = torch.r;
            g.save(); g.translate(torch.x, torch.y); g.scale(sq[0], sq[1]);
            var gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
            gr.addColorStop(0, 'rgba(255,222,160,' + (0.95 * I) + ')'); gr.addColorStop(0.5, 'rgba(255,196,120,' + (0.6 * I) + ')'); gr.addColorStop(1, 'rgba(255,180,100,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.restore();
          }
          if (wx.I > 0.01) {
            var wp = wxScreen(), ws = floorSquash(wp.y);
            g.save(); g.translate(wp.x, wp.y); g.scale(ws[0], ws[1]);
            var g2 = g.createRadialGradient(0, 0, 0, 0, 0, wx.r);
            g2.addColorStop(0, 'rgba(214,236,255,' + (0.75 * wx.I) + ')'); g2.addColorStop(1, 'rgba(200,228,255,0)');
            g.fillStyle = g2; g.beginPath(); g.arc(0, 0, wx.r, 0, 6.2832); g.fill(); g.restore();
          }
        }

        /* ---------- 热区 ---------- */
        function shelfRect() { var r = HOT.shelf.r; return S.shelfMoved ? [r[0] + SHELF_DX, r[1] + SHELF_DY, r[2] + SHELF_DX, r[3] + SHELF_DY] : r; }
        function hitTest(x, y) {
          if (S.shelfMoved && inRect(x, y, HOT.slab.r)) return 'slab';
          if (inRect(x, y, shelfRect())) return 'shelf';
          if (!S.shelfMoved && inRect(x, y, HOT.slab.r) && x > 1068 && x < 1372) return 'slab';
          var order = ['bed', 'door', 'sw', 'tally', 'coat', 'bulb', 'chair', 'clutter'];
          for (var i = 0; i < order.length; i++) if (inRect(x, y, HOT[order[i]].r)) return order[i];
          if (y < 94) return 'ceiling';
          return y >= 672 ? 'floor' : 'wall';
        }
        function hotCenter(k) {
          if (k === 'shelf' && S.shelfMoved) return [HOT.shelf.c[0] + SHELF_DX, HOT.shelf.c[1] + SHELF_DY];
          return HOT[k].c;
        }
        function beaconTarget() {
          if (S.step === 'bed') return HOT.bed.c;
          if (S.step === 'shelf') return HOT.shelf.c;
          if (S.step === 'floor') return HOT.slab.c;
          return null;
        }
        function hoverName(k) {
          if (!HOT[k]) return '';
          if (k === 'slab' && !S.shelfMoved) return '';
          return HOT[k].name;
        }
        function updateHover() {
          var name = '';
          if (!S.busy && torch.I > 0.5) {
            var w = s2w(torch.px, torch.py), k = hitTest(w.x, w.y);
            name = hoverName(k);
            if (name !== hoverKey) stage.setAttribute('data-hover', name ? k : '');
          }
          if (name !== hoverKey) {
            hoverKey = name;
            if (name) { labelT.textContent = name; label.classList.add('on'); } else label.classList.remove('on');
          }
          if (name) {
            var lw = label.offsetWidth || 160, lx = torch.x + torch.r * 0.52 + 14, ly = torch.y - torch.r * 0.62 - 20;
            if (lx + lw > W - 16) lx = torch.x - torch.r * 0.52 - 14 - lw;
            label.style.transform = 'translate(' + n1(clamp(lx, 12, W - lw - 12)) + 'px,' + n1(clamp(ly, 110, H - 60)) + 'px)';
          }
        }

        /* ---------- 旁白 ---------- */
        function comment(key) {
          var arr = LINES[key]; if (!arr) return;
          var i = S.cmt[key] || 0; S.cmt[key] = i + 1;
          var l = arr[i % arr.length];
          say(l[0], l[1]);
        }
        function giveHint() {
          var arr = HINTS[S.step]; if (!arr) return;
          var l = arr[S.hintIdx % arr.length]; S.hintIdx++;
          beacon.until = performance.now() + 7000;
          var c = beaconTarget();
          if (c) { wx.mode = 'hold'; wx.tx = c[0]; wx.ty = c[1]; later(function () { if (!S.busy && S.step !== 'floor') wx.mode = 'wander'; }, 6000); }
          objEl.classList.remove('pulse'); void objEl.offsetWidth; objEl.classList.add('pulse');
          say(l[0], l[1]);
        }

        /* ---------- 交互 ---------- */
        function interactAt(sx, sy) {
          if (S.busy || ended) return;
          var w = s2w(sx, sy), k = hitTest(w.x, w.y);
          ripples.push({ x: sx, y: sy, t: 0 });
          if (S.step === 'bed' && k === 'bed') { seqBed(); return; }
          if (S.step === 'shelf' && k === 'shelf') { seqShelf(); return; }
          if (S.step === 'floor' && k === 'slab') { stomp(); return; }
          sfx('click');
          if (k === 'bed' && S.step !== 'bed') return comment('bedDone');
          if (k === 'shelf') return comment(S.shelfMoved ? 'shelfMoved' : 'shelfEarly');
          if (k === 'slab') return comment('slabEarly');
          if (S.step === 'floor') {
            if (k === 'floor') return comment('floorOther');
            if (k === 'wall' && w.x > 1040 && w.x < 1400) return comment('wallFloorStep');
          }
          comment(k);
        }
        function advanceCaption() {
          var c = root.querySelector('.gf-game-caption');
          if (!c) return false;
          var ev;
          try { ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true }); }
          catch (e) { ev = document.createEvent('Event'); ev.initEvent('pointerdown', true, true); }
          c.dispatchEvent(ev);
          return true;
        }
        var down = null;
        function isCaption(el) { return !!(el && el.closest && el.closest('.gf-game-caption')); }
        function onMove(e) {
          if (ended) return;
          var p = ctx.toLocal(e);
          if (!S.lockTorch) { torch.px = clamp(p.x, 0, W); torch.py = clamp(p.y, 0, H); }
          if (down && Math.hypot(p.x - down.x, p.y - down.y) > down.max) down.max = Math.hypot(p.x - down.x, p.y - down.y);
        }
        function onDown(e) {
          if (ended) return;
          if (e.button != null && e.button > 0) return;
          var p = ctx.toLocal(e);
          down = { x: p.x, y: p.y, max: 0, cap: isCaption(e.target), id: e.pointerId };
          if (!S.lockTorch) {
            torch.px = clamp(p.x, 0, W); torch.py = clamp(p.y, 0, H);
            if (e.pointerType === 'touch') { torch.x = torch.px; torch.y = torch.py; }
          }
        }
        function onUp(e) {
          if (ended || !down) return;
          var d = down; down = null;
          if (d.id != null && e.pointerId != null && d.id !== e.pointerId) return;
          var p = ctx.toLocal(e);
          if (Math.max(d.max, Math.hypot(p.x - d.x, p.y - d.y)) > 26) return;   // 拖动照明，不算点击
          if (S.busy) { if (!d.cap) advanceCaption(); return; }
          interactAt(p.x, p.y);
        }
        root.addEventListener('pointermove', onMove, true);
        root.addEventListener('pointerdown', onDown, true);
        root.addEventListener('pointerup', onUp, true);
        root.addEventListener('pointercancel', function () { down = null; }, true);

        var KEYMAP = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd', a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd' };
        function onKeyDown(e) {
          if (ended) return;
          var k = e.key;
          if (KEYMAP[k]) { keys[KEYMAP[k]] = true; e.preventDefault(); return; }
          if (k === ' ' || k === 'Enter' || k === 'Spacebar') {
            e.preventDefault();
            if (e.repeat) return;
            if (S.busy) { advanceCaption(); return; }
            interactAt(torch.px, torch.py);
            return;
          }
          if (k === 'Tab') {
            e.preventDefault();
            if (S.lockTorch) return;
            var list = TAB_ORDER.filter(function (t) { return t !== 'slab' || S.shelfMoved; });
            var w = s2w(torch.px, torch.py), cur = hitTest(w.x, w.y), idx = list.indexOf(cur);
            idx = (idx + (e.shiftKey ? -1 : 1) + list.length) % list.length;
            if (cur === 'wall' || cur === 'floor' || cur === 'ceiling') idx = e.shiftKey ? list.length - 1 : 0;
            var c = hotCenter(list[idx]), sp = w2s(c[0], c[1]);
            torch.px = sp.x; torch.py = sp.y;
          }
        }
        function onKeyUp(e) { var m = KEYMAP[e.key]; if (m) keys[m] = false; }
        function onBlur() { keys = {}; }
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        /* ---------- 主循环 ---------- */
        function frame(now) {
          if (ended) return;
          rafId = requestAnimationFrame(frame);
          var dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now; T += dt;
          var i;
          for (i = anims.length - 1; i >= 0; i--) {
            var a = anims[i], p = Math.min(1, (now - a.t0) / a.ms);
            a.fn(a.ease(p));
            if (p >= 1) { anims.splice(i, 1); a.res(); }
          }
          // 键盘移动手电
          var kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
          if ((kx || ky) && !S.lockTorch) { torch.px = clamp(torch.px + kx * 640 * dt, 0, W); torch.py = clamp(torch.py + ky * 640 * dt, 0, H); }
          var kf = 1 - Math.exp(-dt * 20);
          torch.x += (torch.px - torch.x) * kf; torch.y += (torch.py - torch.y) * kf;
          // 卫先
          if (wx.mode === 'wander') {
            if (Math.hypot(wx.tx - wx.x, wx.ty - wx.y) < 14) {
              wx.pause -= dt;
              if (wx.pause <= 0) {
                var list = S.step === 'floor' ? FLOOR_WANDER : WANDER, nx;
                do { nx = list[(Math.random() * list.length) | 0]; } while (list.length > 1 && nx[0] === wx.tx && nx[1] === wx.ty);
                wx.tx = nx[0]; wx.ty = nx[1]; wx.pause = 0.7 + Math.random() * 1.8;
              }
            }
          }
          var dx = wx.tx - wx.x, dy = wx.ty - wx.y, dl = Math.hypot(dx, dy);
          if (dl > 0.5) { var sp = Math.min(wx.speed, dl * 2.4 + 10) * dt; if (sp > dl) sp = dl; wx.x += dx / dl * sp; wx.y += dy / dl * sp; }
          wx.I += (wx.on - wx.I) * (1 - Math.exp(-dt * 3));
          // 提示微光
          var bOn = (easy && !S.busy) ? 0.55 : 0;
          if (now < beacon.until) bOn = 1;
          beacon.I += (bOn - beacon.I) * (1 - Math.exp(-dt * 2.5));
          // 粒子
          for (i = 0; i < motes.length; i++) {
            var m = motes[i];
            m.vx += (Math.random() - 0.5) * 12 * dt; m.vy += (Math.random() - 0.5) * 12 * dt;
            m.vx *= 0.99; m.vy *= 0.99;
            m.x += m.vx * dt; m.y += (m.vy + 1.5) * dt;
            if (m.x < -5) m.x = W + 4; else if (m.x > W + 5) m.x = -4;
            if (m.y < -5) m.y = H + 4; else if (m.y > H + 5) m.y = -4;
          }
          for (i = bursts.length - 1; i >= 0; i--) {
            var b = bursts[i]; b.life += dt;
            if (b.life >= b.max) { bursts.splice(i, 1); continue; }
            b.vy += b.g * dt; b.vx *= 0.985; b.x += b.vx * dt; b.y += b.vy * dt;
          }
          for (i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > 0.55) ripples.splice(i, 1); }
          // 震动
          shake *= Math.exp(-dt * 4.2);
          var amp = shake + tremble;
          stage.style.transform = amp > 0.25 ? 'translate(' + n1((Math.random() - 0.5) * 2 * amp) + 'px,' + n1((Math.random() - 0.5) * 2 * amp) + 'px)' : '';
          updateWxScreen();
          if (grab.style.display !== 'block') { renderDark(); renderTint(); }
          updateHover();
          // 久不推进 → 卫先提示
          if (!S.busy && (S.step === 'bed' || S.step === 'shelf' || S.step === 'floor')) {
            if (now - S.lastProgress > (easy ? 7000 : 15000)) { S.lastProgress = now; giveHint(); }
          }
        }
        rafId = requestAnimationFrame(frame);

        /* ============================================================ 剧情段落 */
        async function seqIntro() {
          await wait(450);
          sfx('click');
          var fl = [0.7, 0.1, 0.1, 0.85, 0.35, 1];
          await tween(700, function (t) { torch.I = fl[Math.min(fl.length - 1, (t * fl.length) | 0)]; }, linear);
          torch.I = 1;
          fade.style.opacity = '0';
          helpEl.classList.add('on');
          await wait(500);
          wx.on = 1;
          await say('开关一个都不亮。这灯泡，怕是几十年没换过了。', 'weixian');
          await say('这个老人生前连灯都不开。');
          await say('那天，钱六就躺在那张床上，冲着黑暗挥手。也许他不是在发疯。');
          setObjective('到钱六的床边去');
          setStep('bed'); setBusy(false);
          later(function () { helpEl.classList.add('dim'); }, 14000);
        }

        async function seqBed() {
          setBusy(true); setObjective(null); sfx('footsteps');
          wx.mode = 'hold'; wx.tx = 470; wx.ty = 600;
          await say('我在床沿坐下，躺了上去——就是钱六躺过的位置。');
          world.style.filter = 'sepia(.35) saturate(.7) brightness(.86)';
          heartbeat(72);
          await camTo(camFor(500, 640, 1.14, -4.5, -70, 70), 1400, easeInOut);
          await say('床板硬得硌骨头。我闭上眼，回想那天黑暗里的他……');
          torch.dim = 0.75;
          var armP = runArm();
          await wait(700);
          var sayP = say('你去啊，去那里……去啊！', 'qianliu');
          await Promise.all([armP, sayP]);
          await say('他挥的不是门的方向。是斜对面——');
          wx.tx = HOT.shelf.c[0]; wx.ty = HOT.shelf.c[1] - 20; wx.speed = 420;
          world.style.filter = '';
          torch.dim = 1;
          await camTo({ x: 0, y: 0, r: 0, s: 1 }, 900, easeInOut);
          wx.speed = 170;
          heartbeat(0);
          await say('书橱？一个连灯都不点的人，攒一橱子书干什么。', 'weixian');
          setObjective('查看那只书橱');
          setStep('shelf'); setBusy(false);
        }

        function runArm() {
          ghost.style.opacity = '1';
          var hist = [], DUR = 5200;
          return tween(DUR, function (t) {
            var s = t * DUR / 1000, a1, a2, a3, u, alpha = 1;
            if (s < 0.9) { u = easeInOut(s / 0.9); a1 = lerp(6, -54, u); a2 = lerp(10, -26, u); a3 = lerp(12, -14, u); }
            else if (s < 0.9 + 3 * 0.72) {
              var ph = (s - 0.9) / 0.72 * Math.PI * 2;
              var o1 = (1 - Math.cos(ph)) / 2, o2 = (1 - Math.cos(ph - 0.7)) / 2, o3 = (1 - Math.cos(ph - 1.3)) / 2;
              a1 = lerp(-54, -8, o1); a2 = lerp(-26, 6, o2); a3 = lerp(-14, 16, o3);
            } else if (s < 3.9) { u = easeOut((s - 3.06) / 0.84); a1 = lerp(-54, -11.5, u); a2 = lerp(-26, 0, u); a3 = lerp(-14, 0, u); }
            else { a1 = -11.5 + Math.sin(s * 9) * 0.6; a2 = 0; a3 = Math.sin(s * 7) * 1.2; }
            if (s > DUR / 1000 - 0.7) alpha = Math.max(0, (DUR / 1000 - s) / 0.7);
            if (s < 0.35) alpha = s / 0.35;
            hist.unshift([a1, a2, a3]); if (hist.length > 16) hist.pop();
            setArm(arms[0], hist[0]);
            setArm(arms[1], hist[Math.min(hist.length - 1, 4)]);
            setArm(arms[2], hist[Math.min(hist.length - 1, 8)]);
            setArm(arms[3], hist[Math.min(hist.length - 1, 13)]);
            ghost.style.opacity = alpha.toFixed(3);
          }, linear).then(function () { ghost.style.opacity = '0'; });
        }

        async function seqShelf() {
          setBusy(true); setObjective(null);
          wx.mode = 'hold'; wx.tx = 1130; wx.ty = 470;
          await say('有古怪。来，搭把手——一、二！', 'weixian');
          sfx('stone');
          tremble = 2.2; wx.jit = 10;
          var top = w2s(1220, 214);
          burst(top.x, top.y, 70, 1.2, 40, 90, 2.4);
          burst(1220, 722, 30, 2.4, 70, 160, 1.4);
          await tween(1700, function (t) {
            var e = easeInOut(t), jerk = Math.sin(t * Math.PI * 9) * 3 * (1 - t) * t;
            shelfG.setAttribute('transform', 'translate(' + n1(SHELF_DX * e + jerk) + ',' + n1(SHELF_DY * e) + ')');
            wx.tx = 1130 + SHELF_DX * e;
          }, linear);
          tremble = 0; wx.jit = 0; shake = 5;
          S.shelfMoved = true; scrapeG.style.display = '';
          burst(1330, 722, 24, 2.4, 60, 160, 1.2);
          await wait(500);
          wx.tx = 1215; wx.ty = 430;
          await wait(900);
          for (var i = 0; i < 3; i++) { sfx('knock'); wx.jit = 6; ripples.push({ x: w2s(1215, 430).x, y: w2s(1215, 430).y, t: 0 }); await wait(160); wx.jit = 0; await wait(260); }
          await say('……实心的。', 'weixian');
          wx.tx = 1200; wx.ty = 760;
          await say('我伸手去摸那面墙，脚底却跟着一晃。');
          await say('脚下好像不太平。');
          setObjective('踩一踩书橱原来位置前的地面', stompDots());
          wx.mode = 'wander';
          setStep('floor'); setBusy(false);
        }

        var stompLock = false;
        function stomp() {
          if (stompLock) return;
          stompLock = true;
          S.stomps++; S.lastProgress = performance.now();
          dotsEl.textContent = stompDots();
          var n = S.stomps, sp = w2s(SLAB_C.x, SLAB_C.y);
          sfx('thud');
          burst(sp.x, sp.y, 26 + n * 14, 2.2, 60 + n * 30, 170, 1.3);
          torch.y += 14 * n;
          if (n < 3) {
            shake = [0, 6, 12][n];
            growCracks(n - 1, 520);
            sagEl.setAttribute('opacity', [1, 1.25, 1.6][n]);
            heartbeat([0, 84, 104][n]);
            if (n === 2) later(function () { sfx('crack'); }, 160);
            later(function () { stompLock = false; }, 520);
            if (n === 1) say('咚——声音发闷，底下像是空的。');
            else say('“空的！”我和卫先同时喊出声。');
            return;
          }
          seqBreak();
        }

        async function seqBreak() {
          setBusy(true); setStep('fall'); setObjective(null);
          S.lockTorch = true;
          sfx('crack'); shake = 24; heartbeat(132);
          growCracks(1, 90); growCracks(2, 160);
          await wait(200);
          holeG.style.display = '';
          sagEl.style.display = 'none';
          sfx('fall');
          wx.jit = 40; torch.px = torch.x + 80; torch.py = torch.y - 260;
          world.style.transition = 'filter .3s ease';
          world.style.filter = 'blur(2px) brightness(.85)';
          await camTo(camFor(SLAB_C.x, SLAB_C.y, 1.26, 3, -40, -340), 300, easeIn);
          flash.style.transition = 'none'; flash.style.opacity = '1';
          await wait(90);
          grab.style.display = 'block';
          tintCv.style.visibility = 'hidden'; darkCv.style.visibility = 'hidden';
          label.classList.remove('on');
          void flash.offsetWidth;
          flash.style.transition = 'opacity .8s ease-out'; flash.style.opacity = '0';
          shake = 16; tremble = 1.6;
          await wait(420);
          await say('脚下猛地一空——我往下一坠，胡乱一抓，攥住了卫先的脚踝！');
          await say('别拽我脚！抓我的手——我这块地也不牢！', 'weixian');
          // 收尾：被拽上来，回头看那个洞
          heartbeat(0);
          fade.style.transition = 'opacity .35s ease'; fade.style.opacity = '1';
          await wait(380);
          grab.style.display = 'none'; tremble = 0; shake = 0;
          world.style.transition = 'none'; world.style.filter = '';
          tintCv.style.visibility = ''; darkCv.style.visibility = '';
          var holeCam = camFor(SLAB_C.x, SLAB_C.y, 1.45, 0, 800 - SLAB_C.x, 470 - SLAB_C.y);
          cam.x = holeCam.x; cam.y = holeCam.y; cam.r = 0; cam.s = holeCam.s; applyCam();
          torch.x = torch.px = 790; torch.y = torch.py = 480; torch.dim = 1;
          wx.mode = 'hold'; wx.jit = 0; wx.x = wx.tx = SLAB_C.x + 8; wx.y = wx.ty = SLAB_C.y - 6;
          setStep('hole');
          fade.style.opacity = '0';
          await wait(900);
          fade.style.transition = 'opacity .6s ease'; fade.style.opacity = '1';
          await wait(640);
          finish('win');
        }

        /* ---------- 结束与清理 ---------- */
        function finish(result) {
          if (ended) return;
          ended = true;
          cancelAnimationFrame(rafId);
          timers.forEach(clearTimeout); timers = [];
          anims = [];
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', onBlur);
          heartbeat(0);
          stage.setAttribute('data-step', 'done');
          resolve(result);
        }

        seqIntro();
      });
    }
  });
})();
