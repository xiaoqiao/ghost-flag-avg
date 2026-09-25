/*
 * 小游戏 resist：恍惚发作（第七、八章）。
 * 画面逐渐模糊、倾斜，耳边低语；屏幕随机位置依次弹出“清醒”提示，限时内点中（或按空格/回车）。
 * 普通：每个提示 1.4 秒，点中 5 次清醒 → win；漏 3 个 → lose。
 * 简单：每个提示 2.0 秒，点中 3 次；漏 4 个才失败。easy 或 failCount>=2 时给“跳过”。
 * arg = street | window | taxi | bath（底图：ctx.bgImage(street / office_window / taxi / villa_room) 的 AI 插画；
 *   缺图时退回 ctx.bgSvg，再退回本文件自绘兜底）。
 */
(function () {
  'use strict';
  var GF = window.GF;
  if (!GF || !GF.games) return;

  var P = 'gfg-resist-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';

  /* ------------------------------------------------------------ 各场景文案 */
  var SCENES = {
    street: {
      bg: 'street', prompt: '拧大腿！', color: '#e0b56a',
      open: '行人灯是……绿的？',
      tip: '点中「拧大腿！」，把自己疼醒',
      whispers: ['绿灯了……', '走吧……', '就一步……', '没有车的……', '往前……', '别停下……'],
      win: '背后一只手揪住了我的衣领。', winSub: '是路口的纠察。灯是红的——一直都是红的。',
      lose: '一声刺耳的刹车。', loseSub: '然后，什么都听不见了。',
      winSfx: 'gasp', loseSfx: 'thud'
    },
    window: {
      bg: 'office_window', prompt: '醒过来！', color: '#e0b56a',
      open: '卫先走了，钟老也走了……不如，我也……',
      tip: '点中「醒过来！」，别让脚再往前',
      whispers: ['下面很安静……', '往前靠一点……', '不疼的……', '他们都走了……', '推开它……', '一步就好……'],
      win: '砰！额头狠狠撞在钢化玻璃上。', winSub: '我……刚才想干什么？',
      lose: '我转过身，推开了通往天台的门。', loseSub: '风很大。脚步很轻。',
      winSfx: 'glass', loseSfx: 'gust'
    },
    taxi: {
      bg: 'taxi', prompt: '关上车门！', color: '#e0b56a',
      open: '耳机里的诵经声，越来越远……',
      tip: '点中「关上车门！」，把手从门把上拿开',
      whispers: ['外面很凉快……', '拉一下就好……', '透透气……', '诵经声……听不见了……', '开门……', '风在叫你……'],
      win: '“喂！喂！”司机在吼——我一把摔上车门。', winSub: '风声停了。我悄悄按下了门锁。',
      lose: '风灌了进来。', loseSub: '车门大开，路面在脚下飞驰。',
      winSfx: 'car_door', loseSfx: 'gust'
    },
    bath: {
      bg: 'villa_room', prompt: '那多！', color: '#b56fc9', tag: '路云',
      open: '水很暖，暖得人不想动……',
      tip: '路云在叫你——点中她的呼唤「那多！」',
      whispers: ['睡吧……', '水很暖……', '再沉一点……', '闭上眼……', '好安静……', '不用醒……'],
      win: '我猛地撑起身子，接连呛了几口水。', winSub: '水面，刚刚已经没过了鼻尖。',
      lose: '水漫过了鼻翼。', loseSub: '那一声呼唤，我没有听见。',
      winSfx: 'splash', loseSfx: 'splash'
    }
  };

  /* ------------------------------------------------------------ 工具 */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  function svgWrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">' + inner + '</svg>';
  }
  function vig(id, a) {
    return '<radialGradient id="' + id + '" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="' + a + '"/></radialGradient>';
  }

  /* ------------------------------------------------------------ 兜底底图：街口（白天，刺眼） */
  function artStreet() {
    var r = rng(711), s = [];
    s.push('<defs>',
      '<linearGradient id="gfgrs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ccc6"/><stop offset=".55" stop-color="#e9e3d0"/><stop offset="1" stop-color="#f7f1e1"/></linearGradient>',
      '<radialGradient id="gfgrs-sun" cx=".16" cy="0" r=".8"><stop offset="0" stop-color="#fffef8"/><stop offset=".3" stop-color="#fff8e4" stop-opacity=".6"/><stop offset="1" stop-color="#fff8e4" stop-opacity="0"/></radialGradient>',
      '<linearGradient id="gfgrs-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e8a80"/><stop offset="1" stop-color="#46443f"/></linearGradient>',
      '<linearGradient id="gfgrs-walk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8a293"/><stop offset="1" stop-color="#5f5a51"/></linearGradient>',
      '<linearGradient id="gfgrs-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4eedd" stop-opacity="0"/><stop offset="1" stop-color="#f4eedd" stop-opacity=".8"/></linearGradient>',
      '<linearGradient id="gfgrs-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c3c4"/><stop offset=".45" stop-color="#e8ecea"/><stop offset=".55" stop-color="#9eabad"/><stop offset="1" stop-color="#7f8c8f"/></linearGradient>',
      '<pattern id="gfgrs-win1" width="16" height="20" patternUnits="userSpaceOnUse"><rect x="4" y="5" width="7" height="9" fill="#9e9887" opacity=".55"/></pattern>',
      '<pattern id="gfgrs-win2" width="26" height="34" patternUnits="userSpaceOnUse"><rect x="6" y="8" width="12" height="18" fill="#6f6a5e" opacity=".7"/><rect x="6" y="8" width="12" height="4" fill="#4f4a40" opacity=".6"/></pattern>',
      '<pattern id="gfgrs-win3" width="40" height="28" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="39" height="27" fill="none" stroke="#6a7679" stroke-width="1.2" opacity=".6"/></pattern>',
      '<pattern id="gfgrs-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.2" fill="#a88930"/></pattern>',
      vig('gfgrs-vig', 0.5),
      '</defs>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrs-sky)"/>');
    // 远处楼群（雾里）
    var x = -30;
    while (x < 1620) {
      var w = 60 + r() * 130, h = 110 + r() * 230;
      s.push('<rect x="' + f1(x) + '" y="' + f1(505 - h) + '" width="' + f1(w) + '" height="' + f1(h) + '" fill="#c3bdab"/>');
      s.push('<rect x="' + f1(x) + '" y="' + f1(505 - h) + '" width="' + f1(w) + '" height="' + f1(h) + '" fill="url(#gfgrs-win1)"/>');
      x += w + r() * 10;
    }
    // 左侧：老式洋楼一排（石库门风格的檐口）
    s.push('<path d="M-10 505 V300 H120 V285 H300 V300 H520 V505 Z" fill="#a39a86"/>');
    s.push('<rect x="-10" y="300" width="530" height="205" fill="url(#gfgrs-win2)"/>');
    s.push('<rect x="-10" y="296" width="530" height="8" fill="#8a826f"/><rect x="120" y="281" width="180" height="6" fill="#8a826f"/>');
    s.push('<rect x="-10" y="380" width="530" height="5" fill="#8a826f" opacity=".7"/><rect x="-10" y="450" width="530" height="5" fill="#8a826f" opacity=".7"/>');
    // 右侧：玻璃幕墙高楼
    s.push('<path d="M1190 505 V70 L1260 40 H1610 V505 Z" fill="url(#gfgrs-glass)"/>');
    s.push('<path d="M1190 505 V70 L1260 40 H1610 V505 Z" fill="url(#gfgrs-win3)"/>');
    s.push('<path d="M1300 40 L1360 40 L1250 505 L1190 505 Z" fill="#fff" opacity=".35"/>');
    // 雾
    s.push('<rect y="250" width="1600" height="260" fill="url(#gfgrs-haze)"/>');
    // 行道树（法国梧桐）
    [80, 330, 640, 940, 1470].forEach(function (tx) {
      // 树干与分叉
      s.push('<path d="M' + (tx - 8) + ' 522 C' + (tx - 6) + ' 470 ' + (tx - 4) + ' 430 ' + (tx - 3) + ' 395 L' + (tx - 40) + ' 350 L' + (tx - 34) + ' 346 L' + tx + ' 385 L' + (tx + 30) + ' 340 L' + (tx + 36) + ' 345 L' + (tx + 5) + ' 398 C' + (tx + 5) + ' 440 ' + (tx + 7) + ' 480 ' + (tx + 9) + ' 522 Z" fill="#6f675a"/>');
      s.push('<path d="M' + (tx - 3) + ' 470 h6 v10 h-6 Z M' + (tx - 2) + ' 430 h5 v8 h-5 Z" fill="#b3aa94" opacity=".6"/>');
      // 树冠：暗部在下、亮部在上，小团块叠出叶簇
      for (var k = 0; k < 22; k++) {
        var a = r() * Math.PI * 2, d = Math.sqrt(r());
        var cx = tx + Math.cos(a) * d * 95, cy = 335 + Math.sin(a) * d * 52, rr = 16 + r() * 26;
        var shade = cy > 350 ? '#737a5e' : (cy < 320 ? '#a9ad8a' : '#8c9272');
        s.push('<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(rr) + '" fill="' + shade + '" opacity=".82"/>');
      }
    });
    // 远侧人行道
    s.push('<rect y="500" width="1600" height="24" fill="#bab3a2"/><rect y="519" width="1600" height="4" fill="#dcd6c6"/>');
    // 马路
    s.push('<rect y="523" width="1600" height="217" fill="url(#gfgrs-road)"/>');
    s.push('<g stroke-linecap="butt">');
    for (var d = -40; d < 1640; d += 120) s.push('<line x1="' + d + '" y1="572" x2="' + (d + 60) + '" y2="572" stroke="#e8e3d6" stroke-width="3" opacity=".7"/>');
    s.push('<line x1="0" y1="618" x2="1600" y2="618" stroke="#d8b447" stroke-width="3"/><line x1="0" y1="626" x2="1600" y2="626" stroke="#d8b447" stroke-width="3"/>');
    for (d = -80; d < 1640; d += 150) s.push('<line x1="' + d + '" y1="684" x2="' + (d + 80) + '" y2="684" stroke="#ebe6da" stroke-width="5" opacity=".75"/>');
    s.push('</g>');
    // 斑马线（透视）
    for (var i = 0; i < 9; i++) {
      var nx = 430 + i * 86, fx = 800 + (nx - 800) * 0.74;
      s.push('<path d="M' + f1(fx) + ' 525 H' + f1(fx + 54 * 0.74) + ' L' + (nx + 54) + ' 738 H' + nx + ' Z" fill="#ece8dc" opacity=".9"/>');
    }
    for (i = 0; i < 90; i++) s.push('<circle cx="' + f1(420 + r() * 780) + '" cy="' + f1(530 + r() * 200) + '" r="' + f1(1 + r() * 2.5) + '" fill="#5a5750" opacity=".35"/>');
    // 近侧路缘与人行道
    s.push('<rect y="738" width="1600" height="12" fill="#d3ccbc"/><rect y="750" width="1600" height="10" fill="#8a8479"/>');
    s.push('<rect y="760" width="1600" height="140" fill="url(#gfgrs-walk)"/>');
    s.push('<path d="M0 772 H1600 V802 H0 Z" fill="#c9a64b"/><path d="M0 772 H1600 V802 H0 Z" fill="url(#gfgrs-dots)" opacity=".7"/>');
    for (var xb = -600; xb <= 2200; xb += 120) {
      s.push('<line x1="' + f1(800 + (xb - 800) * 0.8) + '" y1="802" x2="' + xb + '" y2="900" stroke="#4e4a42" stroke-width="1.5" opacity=".4"/>');
    }
    s.push('<line x1="0" y1="840" x2="1600" y2="840" stroke="#4e4a42" stroke-width="1.5" opacity=".35"/>');
    // 刺眼的日光
    s.push('<rect width="1600" height="900" fill="url(#gfgrs-sun)"/>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrs-vig)"/>');
    return svgWrap(s.join(''));
  }

  /* ------------------------------------------------------------ 兜底底图：报社高层落地窗（黄昏） */
  function artWindow() {
    var r = rng(233), s = [];
    s.push('<defs>',
      '<linearGradient id="gfgrw-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121525"/><stop offset=".3" stop-color="#342c4a"/><stop offset=".48" stop-color="#8e4d64"/><stop offset=".58" stop-color="#df8d56"/><stop offset=".62" stop-color="#f4c177"/></linearGradient>',
      '<radialGradient id="gfgrw-sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(360 520) scale(420 180)"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".25" stop-color="#ffb870" stop-opacity=".7"/><stop offset="1" stop-color="#ff9a55" stop-opacity="0"/></radialGradient>',
      '<linearGradient id="gfgrw-river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3b4c"/><stop offset="1" stop-color="#1c1824"/></linearGradient>',
      '<linearGradient id="gfgrw-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1a22"/><stop offset="1" stop-color="#0b0a0e"/></linearGradient>',
      '<linearGradient id="gfgrw-mull" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050506"/><stop offset=".5" stop-color="#17171b"/><stop offset="1" stop-color="#060607"/></linearGradient>',
      '<linearGradient id="gfgrw-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2420"/><stop offset="1" stop-color="#0c0a09"/></linearGradient>',
      '<pattern id="gfgrw-lit" width="9" height="12" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="3" height="4" fill="#f3b865" opacity=".55"/></pattern>',
      vig('gfgrw-vig', 0.7),
      '</defs>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrw-sky)"/>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrw-sun)"/>');
    // 云
    for (var i = 0; i < 9; i++) {
      var cy = 150 + r() * 260, cx = r() * 1600, w = 180 + r() * 360;
      s.push('<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(w) + '" ry="' + f1(5 + r() * 9) + '" fill="' + (cy > 320 ? '#f0a06a' : '#6f4e70') + '" opacity="' + f1(0.25 + r() * 0.3) + '"/>');
    }
    // 对岸天际线
    var sk = ['M0 520'], x = 0;
    while (x < 1600) {
      var w2 = 30 + r() * 70, h2 = 20 + r() * 110;
      if (x > 560 && x < 700) h2 += 60;
      sk.push('V' + f1(520 - h2) + 'H' + f1(x + w2));
      x += w2;
    }
    sk.push('V520Z');
    s.push('<path d="' + sk.join('') + '" fill="#2a2236"/><path d="' + sk.join('') + '" fill="url(#gfgrw-lit)"/>');
    // 电视塔（两颗球）与几幢摩天楼的剪影
    s.push('<g fill="#241d31">',
      '<path d="M1002 520 L1020 250 L1026 250 L1044 520 Z"/><path d="M985 520 L1018 380 L1022 380 Z"/><path d="M1061 520 L1028 380 L1024 380 Z"/>',
      '<circle cx="1023" cy="420" r="34"/><circle cx="1023" cy="300" r="21"/><circle cx="1023" cy="215" r="8"/><rect x="1021" y="130" width="4" height="90"/>',
      '<path d="M1170 520 V250 L1180 240 V200 L1190 190 V160 L1198 150 V120 L1204 90 L1210 120 V150 L1218 160 V190 L1228 200 V240 L1238 250 V520 Z"/>',
      '<path d="M1300 520 V160 Q1330 140 1360 160 V520 Z"/><path d="M1400 520 V300 H1470 V520 Z"/>',
      '</g>');
    s.push('<circle cx="1023" cy="420" r="34" fill="#c05a73" opacity=".25"/><circle cx="1023" cy="300" r="21" fill="#c05a73" opacity=".25"/>');
    s.push('<rect x="1170" y="250" width="68" height="270" fill="url(#gfgrw-lit)"/><rect x="1300" y="170" width="60" height="350" fill="url(#gfgrw-lit)"/>');
    // 江面与倒影
    s.push('<rect y="520" width="1600" height="90" fill="url(#gfgrw-river)"/>');
    for (i = 0; i < 40; i++) {
      var rx = 250 + r() * 260 + (i % 4 === 0 ? 650 : 0), ry = 528 + r() * 76;
      s.push('<rect x="' + f1(rx) + '" y="' + f1(ry) + '" width="' + f1(20 + r() * 60) + '" height="2" fill="#f6b16b" opacity="' + f1(0.2 + r() * 0.5) + '"/>');
    }
    // 近岸：从高处俯视的马路、车灯
    s.push('<rect y="610" width="1600" height="290" fill="url(#gfgrw-ground)"/>');
    s.push('<path d="M0 668 Q800 640 1600 690 L1600 740 Q800 690 0 716 Z" fill="#2c2830"/>');
    for (i = 0; i < 70; i++) {
      var t = r(), px = t * 1600, lane = r() < 0.5;
      var py = (lane ? 676 : 700) + (t < 0.5 ? -8 * t : 18 * (t - 0.5)) + r() * 4;
      s.push('<rect x="' + f1(px) + '" y="' + f1(py) + '" width="' + f1(6 + r() * 14) + '" height="2.4" rx="1" fill="' + (lane ? '#ffe7b8' : '#ff4a3a') + '" opacity="' + f1(0.5 + r() * 0.5) + '"/>');
    }
    // 更近处低矮楼顶
    s.push('<path d="M0 900 V790 H180 V760 H330 V800 H520 V770 H700 V820 H900 V780 H1100 V810 H1280 V765 H1460 V800 H1600 V900 Z" fill="#0e0d12"/>');
    s.push('<g fill="#f3b865" opacity=".5"><rect x="60" y="810" width="6" height="4"/><rect x="220" y="780" width="6" height="4"/><rect x="760" y="840" width="6" height="4"/><rect x="1330" y="790" width="6" height="4"/></g>');
    // 玻璃反光
    s.push('<path d="M200 0 L420 0 L-80 900 L-300 900 Z" fill="#cfe0ff" opacity=".05"/><path d="M1180 0 L1260 0 L900 900 L820 900 Z" fill="#cfe0ff" opacity=".05"/>');
    // 窗框（室内暗部）
    s.push('<rect x="0" y="0" width="1600" height="36" fill="#060607"/>');
    s.push('<rect x="0" y="0" width="46" height="900" fill="url(#gfgrw-mull)"/><rect x="528" y="0" width="24" height="900" fill="url(#gfgrw-mull)"/><rect x="1048" y="0" width="24" height="900" fill="url(#gfgrw-mull)"/><rect x="1554" y="0" width="46" height="900" fill="url(#gfgrw-mull)"/>');
    s.push('<rect x="0" y="118" width="1600" height="10" fill="#0a0a0c"/>');
    s.push('<rect x="0" y="852" width="1600" height="48" fill="url(#gfgrw-floor)"/><rect x="0" y="850" width="1600" height="3" fill="#d78f55" opacity=".35"/>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrw-vig)"/>');
    return svgWrap(s.join(''));
  }

  /* ------------------------------------------------------------ 兜底底图：出租车后座（去浦东机场的高速） */
  function artTaxi() {
    var r = rng(517), s = [];
    s.push('<defs>',
      '<linearGradient id="gfgrt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa6ae"/><stop offset="1" stop-color="#e2e3da"/></linearGradient>',
      '<linearGradient id="gfgrt-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8f8c"/><stop offset="1" stop-color="#4b4c4b"/></linearGradient>',
      '<linearGradient id="gfgrt-seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2c30"/><stop offset="1" stop-color="#121115"/></linearGradient>',
      '<radialGradient id="gfgrt-head" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#3b3a40"/><stop offset="1" stop-color="#18171b"/></radialGradient>',
      '<linearGradient id="gfgrt-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7b1b0"/><stop offset=".5" stop-color="#76806f"/><stop offset="1" stop-color="#3f463c"/></linearGradient>',
      '<linearGradient id="gfgrt-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset=".5" stop-color="#8a9097"/><stop offset="1" stop-color="#d0d4d8"/></linearGradient>',
      vig('gfgrt-vig', 0.75),
      '<style>.gfgrt-dash{animation:gfgrt-run .5s linear infinite}@keyframes gfgrt-run{from{stroke-dashoffset:0}to{stroke-dashoffset:-120}}.gfgrt-streak{animation:gfgrt-fly .35s linear infinite}@keyframes gfgrt-fly{from{transform:translateX(0)}to{transform:translateX(-160px)}}</style>',
      '</defs>');
    s.push('<rect width="1600" height="900" fill="#0d0d10"/>');
    // 挡风玻璃外：高速公路
    s.push('<clipPath id="gfgrt-ws"><path d="M250 118 H1330 L1420 470 H170 Z"/></clipPath>');
    s.push('<g clip-path="url(#gfgrt-ws)">');
    s.push('<rect x="0" y="100" width="1600" height="240" fill="url(#gfgrt-sky)"/>');
    s.push('<path d="M0 330 Q400 318 800 326 T1600 322 V340 H0 Z" fill="#8d9486"/>');
    for (var i = 0; i < 30; i++) {
      var tx = r() * 1600, th = 6 + r() * 14;
      s.push('<ellipse cx="' + f1(tx) + '" cy="' + f1(330 - th / 2) + '" rx="' + f1(8 + r() * 16) + '" ry="' + f1(th / 2) + '" fill="#707a68" opacity=".8"/>');
    }
    // 远处高压电塔
    [260, 1240].forEach(function (px) {
      s.push('<path d="M' + (px - 14) + ' 332 L' + px + ' 250 L' + (px + 14) + ' 332 M' + (px - 18) + ' 272 H' + (px + 18) + ' M' + (px - 12) + ' 290 H' + (px + 12) + '" stroke="#6a706a" stroke-width="2" fill="none"/>');
    });
    s.push('<path d="M0 336 H1600 V480 H0 Z" fill="#6f716c"/>');
    s.push('<path d="M760 334 L840 334 L1600 480 L0 480 Z" fill="url(#gfgrt-road)"/>');
    s.push('<path d="M790 334 L560 480" stroke="#f1eee4" stroke-width="4" stroke-dasharray="30 30" class="gfgrt-dash"/>');
    s.push('<path d="M810 334 L1040 480" stroke="#f1eee4" stroke-width="4" stroke-dasharray="30 30" class="gfgrt-dash"/>');
    s.push('<path d="M760 334 L0 452" stroke="#c9c7bd" stroke-width="3"/><path d="M840 334 L1600 452" stroke="#c9c7bd" stroke-width="3"/>');
    s.push('<path d="M740 330 L0 420 M860 330 L1600 420" stroke="#9ba09b" stroke-width="5"/>');
    // 龙门架与指路牌
    s.push('<path d="M600 336 V224 H1000 V336" stroke="#7b7f80" stroke-width="6" fill="none"/>');
    s.push('<rect x="705" y="232" width="190" height="52" rx="3" fill="#1f6b43" stroke="#e8efe9" stroke-width="2"/>');
    s.push('<text x="800" y="266" text-anchor="middle" font-family=\'' + FONT + '\' font-size="22" fill="#f1f5f2">浦东国际机场 ↑</text>');
    s.push('</g>');
    // 挡风玻璃边框、A 柱、车顶
    s.push('<path d="M0 0 H1600 V160 Q1480 120 1330 118 H250 Q120 120 0 160 Z" fill="#17161a"/>');
    s.push('<path d="M0 160 Q120 120 250 118 L170 470 L0 520 Z" fill="#0f0f12"/><path d="M1600 160 Q1480 120 1330 118 L1420 470 L1600 520 Z" fill="#0f0f12"/>');
    s.push('<rect x="760" y="120" width="80" height="26" rx="4" fill="#0b0b0d"/>');
    // 仪表台
    s.push('<path d="M120 470 Q800 430 1480 470 L1600 560 H0 Z" fill="#131215"/>');
    s.push('<path d="M140 472 Q800 434 1460 472" stroke="#3b3a3f" stroke-width="2" fill="none"/>');
    s.push('<rect x="940" y="452" width="120" height="34" rx="4" fill="#07070a" stroke="#2a2a2e"/><text x="1000" y="477" text-anchor="middle" font-family="monospace" font-size="22" fill="#ff4b33">86.40</text>');
    // 前排座椅（司机在左，副驾在右）
    s.push('<path d="M300 900 V600 Q300 520 380 510 H640 Q720 520 720 600 V900 Z" fill="url(#gfgrt-seat)"/>');
    s.push('<rect x="420" y="380" width="180" height="140" rx="46" fill="url(#gfgrt-head)"/><rect x="480" y="516" width="12" height="20" fill="#3a3a3e"/><rect x="528" y="516" width="12" height="20" fill="#3a3a3e"/>');
    s.push('<path d="M880 900 V610 Q880 530 960 520 H1220 Q1300 530 1300 610 V900 Z" fill="url(#gfgrt-seat)"/>');
    s.push('<rect x="1000" y="392" width="180" height="136" rx="46" fill="url(#gfgrt-head)"/><rect x="1060" y="524" width="12" height="20" fill="#3a3a3e"/><rect x="1108" y="524" width="12" height="20" fill="#3a3a3e"/>');
    s.push('<path d="M720 900 V700 Q800 680 880 700 V900 Z" fill="#0c0c0f"/>');
    // 右后车门：车窗（高速掠过的风景）+ 门板 + 门把手
    s.push('<clipPath id="gfgrt-sw"><path d="M1440 170 H1600 V470 H1470 Z"/></clipPath>');
    s.push('<g clip-path="url(#gfgrt-sw)"><rect x="1400" y="160" width="220" height="320" fill="url(#gfgrt-side)"/>');
    s.push('<g class="gfgrt-streak">');
    for (i = 0; i < 18; i++) {
      var sy = 250 + r() * 210;
      s.push('<rect x="' + f1(1420 + r() * 320) + '" y="' + f1(sy) + '" width="' + f1(60 + r() * 120) + '" height="' + f1(2 + r() * 5) + '" fill="' + (sy > 380 ? '#3a4234' : '#cfd6d2') + '" opacity=".6"/>');
    }
    s.push('</g></g>');
    s.push('<path d="M1420 160 H1600 V180 H1440 L1470 470 H1600 V900 H1360 Q1380 700 1400 520 Z" fill="#141317"/>');
    s.push('<path d="M1392 560 Q1500 540 1600 560 V600 Q1500 585 1388 604 Z" fill="#1f1e23"/>');
    s.push('<path d="M1450 640 h90 a10 10 0 0 1 0 20 h-90 a10 10 0 0 1 0 -20 Z" fill="url(#gfgrt-chrome)"/>');
    s.push('<path d="M1376 520 Q1390 700 1370 900" stroke="#2a292e" stroke-width="3" fill="none"/>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrt-vig)"/>');
    return svgWrap(s.join(''));
  }

  /* ------------------------------------------------------------ 兜底底图：湖畔别墅的浴室（下午） */
  function artBath() {
    var r = rng(907), s = [];
    s.push('<defs>',
      '<linearGradient id="gfgrb-wall" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2d1d13"/><stop offset=".5" stop-color="#5b3b25"/><stop offset="1" stop-color="#2a1b11"/></linearGradient>',
      '<linearGradient id="gfgrb-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9cfe0"/><stop offset="1" stop-color="#eaf2ea"/></linearGradient>',
      '<linearGradient id="gfgrb-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8dbdc2"/><stop offset="1" stop-color="#3f7d86"/></linearGradient>',
      '<linearGradient id="gfgrb-beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c9" stop-opacity=".45"/><stop offset="1" stop-color="#fff2c9" stop-opacity="0"/></linearGradient>',
      '<linearGradient id="gfgrb-tub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4efe6"/><stop offset=".4" stop-color="#d9d1c2"/><stop offset="1" stop-color="#8f8676"/></linearGradient>',
      '<linearGradient id="gfgrb-brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a5a24"/><stop offset=".5" stop-color="#f0cf7a"/><stop offset="1" stop-color="#6b4c1c"/></linearGradient>',
      '<radialGradient id="gfgrb-steam" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>',
      vig('gfgrb-vig', 0.6),
      '</defs>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrb-wall)"/>');
    for (var x = 0; x < 1600; x += 64) s.push('<rect x="' + x + '" y="0" width="2" height="900" fill="#1e140c" opacity=".7"/><rect x="' + (x + 2) + '" y="0" width="2" height="900" fill="#8a5d3a" opacity=".25"/>');
    // 大窗
    s.push('<rect x="360" y="60" width="880" height="430" fill="url(#gfgrb-sky)"/>');
    s.push('<path d="M360 300 L480 250 L560 280 L700 200 L820 262 L940 220 L1060 270 L1160 236 L1240 262 V360 H360 Z" fill="#7f9fb1"/>');
    s.push('<path d="M360 330 L520 300 L640 322 L780 286 L900 318 L1040 296 L1240 330 V380 H360 Z" fill="#5f8196"/>');
    s.push('<rect x="360" y="370" width="880" height="120" fill="url(#gfgrb-lake)"/>');
    for (var i = 0; i < 26; i++) s.push('<rect x="' + f1(380 + r() * 820) + '" y="' + f1(380 + r() * 100) + '" width="' + f1(20 + r() * 50) + '" height="2" fill="#f3fbff" opacity="' + f1(0.3 + r() * 0.5) + '"/>');
    s.push('<path d="M360 372 Q420 350 470 372 Q520 356 560 372 V380 H360 Z" fill="#3e5f3a"/>');
    s.push('<g fill="none" stroke="#3b2616" stroke-width="18"><rect x="360" y="60" width="880" height="430"/><line x1="800" y1="60" x2="800" y2="490"/></g>');
    s.push('<rect x="340" y="490" width="920" height="22" fill="#6d4a2e"/><rect x="340" y="490" width="920" height="4" fill="#b8875a"/>');
    // 光柱
    s.push('<path d="M420 70 L780 70 L1300 900 L760 900 Z" fill="url(#gfgrb-beam)"/><path d="M820 70 L1220 70 L1600 700 L1600 900 L1320 900 Z" fill="url(#gfgrb-beam)" opacity=".7"/>');
    // 绿植
    s.push('<path d="M180 620 Q170 520 120 470 M190 620 Q200 500 260 450 M185 620 Q180 540 200 430" stroke="#3f5a33" stroke-width="10" fill="none" stroke-linecap="round"/>');
    s.push('<ellipse cx="118" cy="466" rx="34" ry="14" fill="#4f6f3d" transform="rotate(-30 118 466)"/><ellipse cx="262" cy="448" rx="36" ry="14" fill="#577a42" transform="rotate(25 262 448)"/><ellipse cx="202" cy="426" rx="30" ry="12" fill="#4b6a3a" transform="rotate(-80 202 426)"/>');
    s.push('<path d="M140 620 H240 L228 700 H152 Z" fill="#3a2a1d"/>');
    // 浴缸远端缸沿 + 黄铜龙头
    s.push('<path d="M60 900 V640 Q60 590 140 588 H1460 Q1540 590 1540 640 V900 Z" fill="url(#gfgrb-tub)"/>');
    s.push('<path d="M120 900 V660 Q120 628 170 626 H1430 Q1480 628 1480 660 V900 Z" fill="#b8ad9a"/>');
    s.push('<path d="M140 900 V670 Q140 646 180 644 H1420 Q1460 646 1460 670 V900 Z" fill="#8f8574"/>');
    s.push('<rect x="770" y="520" width="60" height="30" rx="8" fill="url(#gfgrb-brass)"/><path d="M790 550 V600 Q790 630 820 630 H840 V616 H822 Q808 616 808 600 V550 Z" fill="url(#gfgrb-brass)"/>');
    s.push('<circle cx="720" cy="560" r="16" fill="url(#gfgrb-brass)"/><circle cx="880" cy="560" r="16" fill="url(#gfgrb-brass)"/>');
    // 蒸汽
    for (i = 0; i < 7; i++) s.push('<ellipse cx="' + f1(200 + r() * 1200) + '" cy="' + f1(420 + r() * 260) + '" rx="' + f1(180 + r() * 200) + '" ry="' + f1(60 + r() * 60) + '" fill="url(#gfgrb-steam)"/>');
    s.push('<rect width="1600" height="900" fill="url(#gfgrb-vig)"/>');
    return svgWrap(s.join(''));
  }

  var FALLBACK = { street: artStreet, window: artWindow, taxi: artTaxi, bath: artBath };

  /* ------------------------------------------------------------ 场景专用前景层（与底图一起模糊/倾斜） */
  // 行人信号灯小人
  var MAN_STAND = 'M-6 -8 H6 V6 H3.5 V22 H0.8 V8 H-0.8 V22 H-3.5 V6 H-6 Z';
  var MAN_WALK = 'M-3 -8 L5 -8 L8 2 L12 4 L11 7 L6 5 L5 9 L11 21 L8 23 L2 12 L-3 22 L-6 20 L-2 9 L-2 1 L-6 7 L-9 5 L-5 -3 Z';
  function fxStreet(photo) {
    var cars = '';
    var near = [['#b8352b', 1.55, 0], ['#e8e4da', 2.05, -0.9], ['#1f1f24', 1.8, -1.5], ['#e2b33a', 2.3, -0.4]];
    near.forEach(function (c) {
      cars += '<div class="' + P + 'car" style="top:640px;height:70px;width:400px;--c:' + c[0] + ';animation-duration:' + c[1] + 's;animation-delay:' + c[2] + 's"></div>';
    });
    var far = [['#3a5878', 2.4, -0.2], ['#d8d3c7', 2.9, -1.7], ['#7a2b25', 2.6, -1.1]];
    far.forEach(function (c) {
      cars += '<div class="' + P + 'car ' + P + 'rev" style="top:552px;height:44px;width:260px;opacity:.7;--c:' + c[0] + ';animation-duration:' + c[1] + 's;animation-delay:' + c[2] + 's"></div>';
    });
    var sig = '<svg class="' + P + 'fxsvg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs>' +
      '<radialGradient id="gfgrs-rg"><stop offset="0" stop-color="#ff3b2b" stop-opacity=".75"/><stop offset="1" stop-color="#ff3b2b" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gfgrs-gg"><stop offset="0" stop-color="#3dff9a" stop-opacity=".75"/><stop offset="1" stop-color="#3dff9a" stop-opacity="0"/></radialGradient></defs>' +
      // 照片底图：挂在右侧路口那根灯杆上（照片里自带灯杆）；矢量底图：自带一根杆子
      (photo ? '<g transform="translate(1428 128) scale(1.15)"><rect x="38" y="252" width="72" height="9" fill="#1c1c1e"/><rect x="38" y="252" width="72" height="3" fill="#56534d" opacity=".6"/>' :
      '<g transform="translate(1196 0)">' +
      '<rect x="-6" y="300" width="12" height="226" fill="#3b3a37"/><rect x="-3" y="300" width="3" height="226" fill="#77736a" opacity=".6"/>') +
      '<rect x="-40" y="196" width="80" height="150" rx="9" fill="#1a1a1c" stroke="#0c0c0d" stroke-width="3"/>' +
      '<rect x="-30" y="206" width="60" height="62" rx="6" fill="#200b0a"/><rect x="-30" y="274" width="60" height="62" rx="6" fill="#08170f"/>' +
      '<path d="' + MAN_STAND + '" transform="translate(0 237) scale(1.6)" fill="#3a1512"/>' +
      '<path d="' + MAN_WALK + '" transform="translate(0 305) scale(1.6)" fill="#10281b"/>' +
      '<g id="gfgrs-red"><circle cx="0" cy="237" r="80" fill="url(#gfgrs-rg)"/><path d="' + MAN_STAND + '" transform="translate(0 237) scale(1.6)" fill="#ff5a45"/></g>' +
      '<g id="gfgrs-green" opacity="0"><circle cx="0" cy="305" r="80" fill="url(#gfgrs-gg)"/><path d="' + MAN_WALK + '" transform="translate(0 305) scale(1.6)" fill="#6dffb4"/></g>' +
      '<path d="M-40 204 H40 L34 196 H-34 Z" fill="#0b0b0c"/><path d="M-40 272 H40 L34 266 H-34 Z" fill="#0b0b0c"/>' +
      '</g></svg>';
    return '<div class="' + P + 'cars">' + cars + '</div>' + sig;
  }
  function fxWindow() {
    return '<div class="' + P + 'sheen"></div><div class="' + P + 'fog"></div>';
  }
  function fxTaxi() {
    var st = '';
    var r = rng(33);
    for (var i = 0; i < 26; i++) {
      st += '<i style="top:' + Math.round(80 + r() * 740) + 'px;width:' + Math.round(80 + r() * 220) + 'px;animation-duration:' + (0.22 + r() * 0.3).toFixed(2) + 's;animation-delay:-' + r().toFixed(2) + 's"></i>';
    }
    return '<div class="' + P + 'gap"><div class="' + P + 'gaplight"></div><div class="' + P + 'wind">' + st + '</div></div>';
  }
  function fxBath() {
    var wave = function (amp, len, y0) {
      var d = 'M0 ' + y0;
      for (var x = 0; x <= 3200; x += len / 2) {
        d += ' Q' + (x + len / 4) + ' ' + (y0 + ((x / (len / 2)) % 2 ? amp : -amp)) + ' ' + (x + len / 2) + ' ' + y0;
      }
      return d + ' V1400 H0 Z';
    };
    return '<div class="' + P + 'water"><svg viewBox="0 0 1600 1400" width="1600" height="1400" preserveAspectRatio="none"><defs>' +
      '<linearGradient id="gfgrb-wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc2c4" stop-opacity=".45"/><stop offset=".25" stop-color="#2f6f78" stop-opacity=".72"/><stop offset="1" stop-color="#0b2a31" stop-opacity=".96"/></linearGradient></defs>' +
      '<g class="' + P + 'w1"><path d="' + wave(10, 260, 40) + '" fill="url(#gfgrb-wg)"/></g>' +
      '<g class="' + P + 'w2"><path d="' + wave(7, 180, 52) + '" fill="#5aa6ad" opacity=".28"/></g>' +
      '<g class="' + P + 'w1"><path d="' + wave(10, 260, 40).replace(/ V1400 H0 Z$/, '') + '" fill="none" stroke="#e9fbff" stroke-width="3" opacity=".55"/></g>' +
      '<g class="' + P + 'caus" opacity=".22" stroke="#bff3ff" stroke-width="2" fill="none">' +
      '<path d="M40 160 q60 -20 120 0 t120 0 t120 0"/><path d="M620 230 q50 -18 100 0 t100 0"/><path d="M1100 140 q60 -20 120 0 t120 0 t120 0"/><path d="M300 320 q50 -16 100 0 t100 0"/></g>' +
      '</svg></div><div class="' + P + 'bubbles"></div>';
  }
  // 场景层（随底图一起缩放/倾斜）与近景层（贴着镜头，不缩放，只轻微模糊）
  var FX = { street: fxStreet, window: function () { return '<div class="' + P + 'sheen"></div>'; }, taxi: function () { return ''; }, bath: function () { return ''; } };
  var NEAR = { street: function () { return ''; }, window: function () { return '<div class="' + P + 'fog"></div>'; }, taxi: fxTaxi, bath: fxBath };

  /* ------------------------------------------------------------ 样式 */
  function css() {
    var p = '.' + P;
    return [
      p + 'wrap{position:absolute;inset:0;overflow:hidden;background:#000;font-family:' + FONT + ';opacity:0;transition:opacity .6s}',
      p + 'wrap.on{opacity:1}',
      p + 'shake{position:absolute;inset:0}',
      p + 'world{position:absolute;inset:0;transform-origin:50% 55%;will-change:transform,filter}',
      p + 'bg,' + p + 'fx{position:absolute;inset:0}',
      p + 'near{position:absolute;inset:0;overflow:hidden;pointer-events:none;will-change:filter,transform}',
      p + 'bg svg{display:block;width:100%;height:100%}',
      p + 'photo{display:block;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none}',
      p + 'isphoto~' + p + 'fx ' + p + 'cars{opacity:.6}',
      p + 'isphoto::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,6,12,.25),rgba(8,6,12,0) 30%,rgba(8,6,12,0) 70%,rgba(8,6,12,.3))}',
      p + 'fxsvg{position:absolute;inset:0;width:100%;height:100%}',
      /* 街口车流 */
      p + 'cars{position:absolute;inset:0;overflow:hidden}',
      p + 'car{position:absolute;left:0;border-radius:34px 46px 12px 12px;background:linear-gradient(180deg,rgba(255,255,255,.7) 0,rgba(255,255,255,.2) 12%,var(--c) 30%,var(--c) 62%,rgba(0,0,0,.75) 100%);filter:blur(6px);animation:' + P + 'drive linear infinite;opacity:.9}',
      p + 'car::after{content:"";position:absolute;right:-30px;top:40%;width:90px;height:40%;border-radius:50%;background:radial-gradient(closest-side,rgba(255,250,225,.95),rgba(255,250,225,0))}',
      p + 'rev{animation-direction:reverse}',
      p + 'rev::after{right:auto;left:-30px}',
      '@keyframes ' + P + 'drive{from{transform:translateX(-520px)}to{transform:translateX(1700px)}}',
      /* 落地窗 */
      p + 'sheen{position:absolute;inset:-10%;background:linear-gradient(112deg,transparent 38%,rgba(220,235,255,.09) 46%,rgba(220,235,255,.02) 52%,transparent 60%);animation:' + P + 'sheen 9s ease-in-out infinite alternate}',
      '@keyframes ' + P + 'sheen{from{transform:translateX(-12%)}to{transform:translateX(12%)}}',
      p + 'fog{position:absolute;left:560px;top:250px;width:480px;height:420px;border-radius:50%;background:radial-gradient(closest-side,rgba(235,240,250,.55),rgba(235,240,250,0));opacity:0}',
      p + 'impact{position:absolute;left:800px;top:450px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid rgba(255,255,255,.9);box-shadow:0 0 30px rgba(255,255,255,.8);animation:' + P + 'impact .7s ease-out forwards;pointer-events:none}',
      '@keyframes ' + P + 'impact{from{transform:scale(.3);opacity:1}to{transform:scale(14);opacity:0}}',
      /* 出租车门缝 */
      p + 'gap{position:absolute;right:0;top:0;bottom:0;width:0;overflow:visible}',
      p + 'gaplight{position:absolute;right:0;top:-40px;bottom:-40px;width:100%;background:linear-gradient(90deg,rgba(40,40,44,.9) 0,rgba(245,248,242,.95) 8%,#fff 60%,#dfe6e2 100%);box-shadow:-30px 0 80px 20px rgba(255,255,255,.35)}',
      p + 'wind{position:absolute;right:0;top:0;bottom:0;width:900px;opacity:0;overflow:hidden}',
      p + 'wind i{position:absolute;right:-300px;height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.75));animation:' + P + 'gust linear infinite}',
      '@keyframes ' + P + 'gust{from{transform:translateX(0)}to{transform:translateX(-1300px)}}',
      /* 浴缸水面 */
      p + 'water{position:absolute;left:-40px;width:1680px;height:1400px;top:900px;will-change:transform}',
      p + 'water svg{width:1680px;height:1400px;display:block}',
      p + 'w1{animation:' + P + 'wave 3.2s linear infinite}',
      p + 'w2{animation:' + P + 'wave 2.1s linear infinite reverse}',
      p + 'caus{animation:' + P + 'caus 2.6s ease-in-out infinite alternate}',
      '@keyframes ' + P + 'wave{from{transform:translateX(0)}to{transform:translateX(-260px)}}',
      '@keyframes ' + P + 'caus{from{transform:translateX(-20px)}to{transform:translateX(20px)}}',
      p + 'bubbles{position:absolute;inset:0;pointer-events:none}',
      p + 'bubbles i{position:absolute;bottom:-40px;border-radius:50%;border:2px solid rgba(220,250,255,.7);background:radial-gradient(circle at 35% 35%,rgba(255,255,255,.6),rgba(255,255,255,0) 60%);animation:' + P + 'bub 1.3s ease-in forwards}',
      '@keyframes ' + P + 'bub{to{transform:translateY(-1000px);opacity:.2}}',
      /* 暗角 / 低语 */
      p + 'dark{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 62% 58% at 50% 52%,rgba(0,0,0,0) 30%,rgba(6,4,10,.85) 100%)}',
      p + 'tint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;background:#5b4a7a;opacity:0}',
      p + 'whis{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
      p + 'whis span{position:absolute;white-space:nowrap;color:rgba(214,204,236,.8);text-shadow:0 0 18px rgba(150,120,200,.8),0 0 4px rgba(0,0,0,.8);letter-spacing:.2em;filter:blur(1.2px);animation:' + P + 'whis 2.8s ease-in-out forwards;transition:opacity .25s}',
      p + 'whis span.off{opacity:0 !important;animation-play-state:paused}',
      '@keyframes ' + P + 'whis{0%{opacity:0;transform:translate(0,10px) scale(.94)}25%{opacity:.85}70%{opacity:.6}100%{opacity:0;transform:translate(var(--dx),-26px) scale(1.08)}}',
      /* HUD */
      p + 'hud{position:absolute;left:0;right:0;top:0;height:170px;pointer-events:none;text-align:center;color:#efe6d2;background:linear-gradient(180deg,rgba(0,0,0,.72),rgba(0,0,0,0));opacity:0;transition:opacity .5s;z-index:30}',
      p + 'hud.on{opacity:1}',
      p + 'tip{margin-top:24px;font-size:30px;letter-spacing:.08em;text-shadow:0 2px 10px #000}',
      p + 'tip small{font-size:26px;color:#bfb49d;margin-left:14px;letter-spacing:.04em}',
      p + 'meters{margin-top:16px;display:flex;justify-content:center;align-items:center;gap:12px;font-size:26px}',
      p + 'lab{color:#e0b56a;letter-spacing:.2em;margin-right:4px}',
      p + 'lab.bad{color:#d0685a;margin-left:34px}',
      p + 'pip{width:24px;height:24px;border-radius:50%;border:2px solid rgba(224,181,106,.7);box-sizing:border-box;transition:all .25s}',
      p + 'pip.on{background:#e0b56a;box-shadow:0 0 14px #e0b56a;transform:scale(1.15)}',
      p + 'x{position:relative;width:24px;height:24px;border:2px solid rgba(208,104,90,.55);border-radius:4px;box-sizing:border-box;transform:rotate(45deg);transition:all .25s}',
      p + 'x.on{background:#b8352b;border-color:#ff7b6a;box-shadow:0 0 14px #ff5a45}',
      /* 提示按钮 */
      p + 'prompts{position:absolute;inset:0;pointer-events:none;z-index:40}',
      p + 'prompt{position:absolute;pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:20px;background:radial-gradient(ellipse at 50% 40%,rgba(40,30,18,.92),rgba(12,10,8,.9));box-shadow:0 0 0 1px rgba(0,0,0,.6),0 10px 40px rgba(0,0,0,.7),0 0 40px -6px var(--c);animation:' + P + 'pop .22s cubic-bezier(.2,1.6,.4,1) both}',
      p + 'prompt::before{content:"";position:absolute;inset:-28px}',
      p + 'prompt::after{content:"";position:absolute;inset:-6px;border-radius:24px;border:2px solid var(--c);animation:' + P + 'ping 1s ease-out infinite;pointer-events:none}',
      p + 'ptxt{position:relative;font-size:46px;font-weight:bold;color:#fff4dc;letter-spacing:.1em;text-shadow:0 0 16px var(--c),0 0 3px var(--c);pointer-events:none}',
      p + 'ptag{position:absolute;top:-40px;left:50%;transform:translateX(-50%);font-size:26px;font-style:normal;color:var(--c);letter-spacing:.3em;text-shadow:0 0 10px rgba(0,0,0,.9);pointer-events:none;white-space:nowrap}',
      p + 'ring{position:absolute;inset:0;overflow:visible;pointer-events:none}',
      p + 'ring .trk{fill:none;stroke:rgba(255,255,255,.12);stroke-width:5}',
      p + 'ring .bar{fill:none;stroke:var(--c);stroke-width:5;stroke-linecap:round;stroke-dasharray:100 100;stroke-dashoffset:0;animation:' + P + 'drain linear forwards;filter:drop-shadow(0 0 6px var(--c))}',
      p + 'prompt.late .bar{stroke:#ff6a55}',
      p + 'prompt.late{animation:' + P + 'tremble .09s linear infinite}',
      p + 'prompt.hit{animation:' + P + 'hit .35s ease-out forwards;pointer-events:none}',
      p + 'prompt.miss{animation:' + P + 'miss .45s ease-in forwards;pointer-events:none}',
      '@keyframes ' + P + 'pop{from{opacity:0;transform:scale(1.5)}to{opacity:1;transform:scale(1)}}',
      '@keyframes ' + P + 'ping{from{opacity:.8;transform:scale(1)}to{opacity:0;transform:scale(1.3)}}',
      '@keyframes ' + P + 'drain{to{stroke-dashoffset:100}}',
      '@keyframes ' + P + 'tremble{0%{transform:translate(2px,0)}50%{transform:translate(-2px,1px)}100%{transform:translate(1px,-1px)}}',
      '@keyframes ' + P + 'hit{0%{transform:scale(1);filter:brightness(1)}30%{transform:scale(1.15);filter:brightness(2.2)}100%{transform:scale(1.35);opacity:0;filter:brightness(3)}}',
      '@keyframes ' + P + 'miss{0%{transform:none}100%{transform:translateY(40px) scale(.8) rotate(-6deg);opacity:0;filter:grayscale(1) blur(6px)}}',
      p + 'burst{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:4px solid var(--c);box-shadow:0 0 30px var(--c);pointer-events:none;animation:' + P + 'burst .5s ease-out forwards}',
      '@keyframes ' + P + 'burst{from{transform:scale(1);opacity:1}to{transform:scale(12);opacity:0}}',
      /* 结束演出 */
      p + 'flash{position:absolute;inset:0;pointer-events:none;background:#fff;opacity:0;z-index:60}',
      p + 'black{position:absolute;inset:0;pointer-events:none;background:#000;opacity:0;z-index:61;transition:opacity .7s ease-in}',
      p + 'glare{position:absolute;left:-300px;top:300px;width:700px;height:500px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,rgba(255,252,230,1),rgba(255,240,190,.6) 45%,rgba(255,240,190,0));opacity:0;z-index:55}',
      p + 'center{position:absolute;left:0;right:0;top:320px;padding:40px 0 46px;text-align:center;z-index:70;pointer-events:none;opacity:0;transition:opacity .25s;' +
        'background:radial-gradient(ellipse 46% 58% at 50% 50%,rgba(0,0,0,.62),rgba(0,0,0,.35) 55%,rgba(0,0,0,0) 80%)}',
      p + 'center.on{opacity:1}',
      p + 'center b{display:block;font-size:52px;font-weight:bold;color:#fff6e2;letter-spacing:.08em;text-shadow:0 0 30px rgba(0,0,0,.9),0 2px 6px #000}',
      p + 'center span{display:block;margin-top:20px;font-size:32px;color:#e0b56a;letter-spacing:.1em;text-shadow:0 2px 10px #000}',
      p + 'center.bad b{color:#f0d6cf}',
      p + 'center.bad span{color:#e5836f}'
    ].join('\n');
  }

  /* ------------------------------------------------------------ 主体 */
  GF.games.register('resist', {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var key = SCENES[ctx.arg] ? ctx.arg : 'street';
        var S = SCENES[key];
        var easy = !!ctx.easy;
        var DUR = easy ? 2.0 : 1.4;        // 每个提示的时限（秒）
        var NEED = easy ? 3 : 5;           // 需要点中的次数
        var MAXMISS = easy ? 4 : 3;        // 允许漏掉的上限
        var DRIFT = easy ? 0.028 : 0.045;  // 恍惚度每秒自然上涨

        var timers = [], raf = 0, ended = false, winListeners = [];
        function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
        function on(target, type, fn, opt) { target.addEventListener(type, fn, opt); winListeners.push([target, type, fn, opt]); }
        function au(fn, a) { try { if (ctx.audio && typeof ctx.audio[fn] === 'function') ctx.audio[fn](a); } catch (e) { /* 音频可能未实现 */ } }

        /* ---------- DOM ---------- */
        var root = ctx.root;
        var style = document.createElement('style');
        style.textContent = css();
        root.appendChild(style);

        var wrap = el('div', P + 'wrap');
        var shake = el('div', P + 'shake', wrap);
        var world = el('div', P + 'world', shake);
        var bg = el('div', P + 'bg', world);
        // 底图：AI 插画 → 矢量底图 → 本文件自绘
        var photo = '';
        try { photo = (ctx.bgImage && ctx.bgImage(S.bg)) || ''; } catch (e) { photo = ''; }
        function vectorBg() {
          var art = '';
          try { art = ctx.bgSvg(S.bg) || ''; } catch (e) { art = ''; }
          bg.innerHTML = art || FALLBACK[key]();
        }
        if (photo) {
          var img = el('img', P + 'photo', bg);
          img.alt = ''; img.draggable = false;
          img.onerror = function () {   // 插画加载失败：换矢量底图，信号灯也换回带灯杆的版本
            if (ended) return;
            photo = '';
            bg.innerHTML = ''; bg.classList.remove(P + 'isphoto'); vectorBg();
            fx.innerHTML = FX[key](false);
            sigRed = fx.querySelector('#gfgrs-red'); sigGreen = fx.querySelector('#gfgrs-green');
          };
          img.src = photo;
          bg.classList.add(P + 'isphoto');
        } else vectorBg();
        var fx = el('div', P + 'fx', world);
        fx.innerHTML = FX[key](!!photo);
        var near = el('div', P + 'near', shake);
        near.innerHTML = NEAR[key]();
        var tint = el('div', P + 'tint', shake);
        var dark = el('div', P + 'dark', shake);
        var whis = el('div', P + 'whis', wrap);
        var glare = el('div', P + 'glare', wrap);
        var hud = el('div', P + 'hud', wrap);
        var prompts = el('div', P + 'prompts', wrap);
        var flash = el('div', P + 'flash', wrap);
        var black = el('div', P + 'black', wrap);
        var center = el('div', P + 'center', wrap);
        root.appendChild(wrap);

        var hintSub = '（空格 / 回车 也行 · 每个只有 ' + DUR.toFixed(1) + ' 秒）';
        var pipsHtml = '', xsHtml = '';
        for (var i = 0; i < NEED; i++) pipsHtml += '<i class="' + P + 'pip"></i>';
        for (i = 0; i < MAXMISS; i++) xsHtml += '<i class="' + P + 'x"></i>';
        hud.innerHTML = '<div class="' + P + 'tip">' + S.tip + '<small>' + hintSub + '</small></div>' +
          '<div class="' + P + 'meters"><span class="' + P + 'lab">清醒</span>' + pipsHtml +
          '<span class="' + P + 'lab bad">失控</span>' + xsHtml + '</div>';
        var pipEls = hud.querySelectorAll('.' + P + 'pip');
        var xEls = hud.querySelectorAll('.' + P + 'x');

        // 场景专用元素引用
        var sigRed = fx.querySelector('#gfgrs-red'), sigGreen = fx.querySelector('#gfgrs-green');
        var fog = near.querySelector('.' + P + 'fog');
        var gap = near.querySelector('.' + P + 'gap'), wind = near.querySelector('.' + P + 'wind');
        var water = near.querySelector('.' + P + 'water'), bubbles = near.querySelector('.' + P + 'bubbles');

        function el(tag, cls, parent) {
          var e = document.createElement(tag);
          if (cls) e.className = cls;
          if (parent) parent.appendChild(e);
          return e;
        }

        /* ---------- 状态 ---------- */
        var T = 0.28;           // 恍惚度 0..1（逻辑值）
        var Tv = 0.2;           // 视觉平滑值
        var lurch = 0;          // 漏掉时的猛然一歪
        var shakeAmp = 0;
        var hits = 0, misses = 0;
        var state = 'intro';    // intro | play | end
        var t = 0, last = 0;
        var cur = null;         // 当前提示 {el, t0, x, y}
        var nextAt = 1.7;       // 下一个提示出现的时间
        var nextWhis = 0.8;
        var lastPos = null;
        var hbLast = -1;
        var endMode = null;     // 'win' | 'lose'
        var endT = 0;
        var waterBoost = 0, gapBoost = 0, forwardBoost = 0;

        /* ---------- 提示 ---------- */
        function spawnPrompt() {
          var w = Math.max(250, S.prompt.length * 50 + 80), h = 108;
          var x, y, tries = 0;
          do {
            x = 170 + w / 2 + Math.random() * (1600 - 340 - w);
            y = 230 + Math.random() * 380;
            tries++;
          } while (lastPos && Math.hypot(x - lastPos.x, y - lastPos.y) < 360 && tries < 30);
          lastPos = { x: x, y: y };
          var e = el('div', P + 'prompt');
          e.style.cssText = 'left:' + Math.round(x - w / 2) + 'px;top:' + Math.round(y - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;--c:' + S.color;
          e.innerHTML = '<svg class="' + P + 'ring" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">' +
            '<rect class="trk" x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="18" pathLength="100"/>' +
            '<rect class="bar" x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="18" pathLength="100" style="animation-duration:' + DUR + 's"/></svg>' +
            '<span class="' + P + 'ptxt">' + S.prompt + '</span>' + (S.tag ? '<i class="' + P + 'ptag">' + S.tag + '</i>' : '');
          e.setAttribute('data-prompt', '1');
          e.addEventListener('pointerdown', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
            if (cur && cur.el === e) hit();
          });
          prompts.appendChild(e);
          cur = { el: e, t0: t, x: x, y: y, late: false };
          // 与新提示重叠的低语立刻淡掉，免得压字
          var pr = { l: x - w / 2 - 40, r: x + w / 2 + 40, t: y - h / 2 - 50, b: y + h / 2 + 30 };
          Array.prototype.forEach.call(whis.children, function (sp) {
            var l = sp.offsetLeft, tp = sp.offsetTop, rr = l + sp.offsetWidth, bb = tp + sp.offsetHeight;
            if (l < pr.r && rr > pr.l && tp < pr.b && bb > pr.t) sp.classList.add('off');
          });
          if (key === 'bath') au('sfx', 'whisper');
        }

        function hit() {
          if (!cur || state !== 'play') return;
          var c = cur; cur = null;
          c.el.classList.add('hit');
          c.el.removeAttribute('data-prompt');
          burst(c.x, c.y);
          later(function () { if (c.el.parentNode) c.el.remove(); }, 380);
          hits++;
          if (pipEls[hits - 1]) pipEls[hits - 1].classList.add('on');
          T = Math.max(0, T - 0.16);
          Tv = Math.max(0, Tv - 0.1);
          shakeAmp = Math.max(shakeAmp, 14);
          flashTo(0.28, 260);
          au('sfx', 'heartbeat');
          if (hits >= NEED) { finish('win'); return; }
          nextAt = t + 0.45 + Math.random() * 0.45;
        }

        function miss() {
          if (!cur) return;
          var c = cur; cur = null;
          c.el.classList.add('miss');
          c.el.removeAttribute('data-prompt');
          later(function () { if (c.el.parentNode) c.el.remove(); }, 480);
          misses++;
          if (xEls[misses - 1]) xEls[misses - 1].classList.add('on');
          T = Math.min(1, T + 0.24);
          lurch = 1;
          shakeAmp = Math.max(shakeAmp, 8);
          au('sfx', 'whisper');
          whisper(true);
          if (misses >= MAXMISS) { finish('lose'); return; }
          nextAt = t + 0.5 + Math.random() * 0.4;
        }

        function burst(x, y) {
          var b = el('div', P + 'burst', prompts);
          b.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--c:' + S.color;
          later(function () { if (b.parentNode) b.remove(); }, 520);
        }

        function flashTo(op, ms) {
          flash.style.transition = 'none';
          flash.style.opacity = op;
          void flash.offsetWidth;
          flash.style.transition = 'opacity ' + ms + 'ms ease-out';
          flash.style.opacity = 0;
        }

        function whisper(loud) {
          var w = el('span', null, whis);
          var txt = S.whispers[Math.floor(Math.random() * S.whispers.length)];
          w.textContent = txt;
          var size = loud ? 56 : 34 + Math.random() * 16 + Tv * 14;
          var wx, wy, n = 0;
          do {
            wx = 120 + Math.random() * 1150; wy = 200 + Math.random() * 460; n++;
          } while (cur && n < 30 && wx < cur.x + 220 && wx + txt.length * size * 1.25 > cur.x - 220 && wy < cur.y + 90 && wy + size * 1.4 > cur.y - 110);
          w.style.cssText = 'left:' + Math.round(wx) + 'px;top:' + Math.round(wy) + 'px;font-size:' + Math.round(size) + 'px;--dx:' + Math.round((Math.random() - 0.5) * 80) + 'px';
          later(function () { if (w.parentNode) w.remove(); }, 2900);
        }

        /* ---------- 输入 ---------- */
        on(window, 'keydown', function (e) {
          if (ended) return;
          if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            if (e.repeat) return;
            if (cur && state === 'play') hit();
          }
        });

        if (easy || ctx.failCount >= 2) {
          try { ctx.skipBtn(function () { finish('win', true); }); } catch (e) { /* 忽略 */ }
        }

        /* ---------- 主循环 ---------- */
        function frame(now) {
          raf = requestAnimationFrame(frame);
          if (!last) last = now;
          var dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          t += dt;

          if (state === 'play') {
            T = Math.min(1, T + DRIFT * dt);
            if (!cur && t >= nextAt) spawnPrompt();
            if (cur) {
              var age = t - cur.t0;
              if (!cur.late && age > DUR * 0.62) { cur.late = true; cur.el.classList.add('late'); }
              if (age >= DUR) miss();
            }
            if (t >= nextWhis) { whisper(false); nextWhis = t + 1.7 - Tv * 1.0 + Math.random() * 0.5; if (Math.random() < 0.35) au('sfx', 'whisper'); }
          } else if (state === 'intro') {
            T = Math.min(1, T + DRIFT * 0.6 * dt);
          }
          Tv += (T - Tv) * Math.min(1, dt * 3);
          lurch = Math.max(0, lurch - dt * 1.6);
          shakeAmp = Math.max(0, shakeAmp - dt * 45);

          render();

          var bpm = Math.round(68 + Tv * 64);
          if (state !== 'end' && Math.abs(bpm - hbLast) >= 5) { hbLast = bpm; au('heartbeat', bpm); }
        }

        function render() {
          var k = Tv, L = lurch;
          var wob = Math.sin(t * 0.8) * 0.7 + Math.sin(t * 1.9) * 0.3;
          var rot = k * 4.2 * wob + L * 3.2 * (key === 'taxi' ? 1 : -1);
          var sc = 1.05 + k * 0.1 + L * 0.03;
          var dx = 0, dy = Math.sin(t * 1.3) * k * 10;
          var extra = '';
          if (key === 'street') { sc += k * 0.08 + forwardBoost; dy += k * 36 + forwardBoost * 200; }
          else if (key === 'window') { dy -= k * 50 + forwardBoost * 260; sc += forwardBoost; rot += forwardBoost * 12; }
          else if (key === 'taxi') { dx -= k * 40 + gapBoost * 80; }
          else if (key === 'bath') { dy -= k * 26; }
          if (endMode === 'win') { rot *= 0.2; }
          var blur = (photo ? 0.2 + k * 7 : 0.4 + k * 9) + L * 5;
          if (endMode === 'win') blur = Math.max(0, blur * Math.max(0, 1 - (t - endT) * 3));
          world.style.transform = 'translate(' + f1(dx) + 'px,' + f1(dy) + 'px) rotate(' + (rot).toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
          world.style.filter = 'blur(' + blur.toFixed(1) + 'px) saturate(' + (1 - k * 0.5).toFixed(2) + ') brightness(' + (1 - k * 0.22).toFixed(2) + ')' + extra;
          near.style.filter = 'blur(' + (endMode === 'win' ? 0 : k * 2.5 + L * 2).toFixed(1) + 'px)';
          near.style.transform = 'rotate(' + (rot * 0.35).toFixed(2) + 'deg)';
          var sx = (Math.random() - 0.5) * shakeAmp, sy = (Math.random() - 0.5) * shakeAmp;
          shake.style.transform = 'translate(' + f1(sx) + 'px,' + f1(sy) + 'px)';
          var beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * (68 + k * 64) / 60)), 8);
          dark.style.opacity = (0.3 + k * 0.6 + beat * 0.12 * k).toFixed(3);
          tint.style.opacity = (k * 0.45).toFixed(3);

          // 场景专用
          if (key === 'street' && sigRed) {
            var g;
            if (endMode === 'win') g = 0;
            else {
              var fl = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1) * 0.5;
              g = Math.max(0, Math.min(1, k * 1.5 - 0.25 + fl * 0.35 * k + L * 0.6));
            }
            sigGreen.setAttribute('opacity', g.toFixed(2));
            sigRed.setAttribute('opacity', (1 - g * 0.9).toFixed(2));
          } else if (key === 'window' && fog) {
            fog.style.opacity = (k * 0.55).toFixed(2);
          } else if (key === 'taxi' && gap) {
            var gw = endMode === 'win' ? 0 : 4 + k * 60 + misses * 26 + L * 30 + gapBoost * 1500;
            gap.style.width = Math.round(gw) + 'px';
            wind.style.opacity = Math.min(1, gw / 120).toFixed(2);
          } else if (key === 'bath' && water) {
            var lvl = 700 - k * 360 - misses * 70 - L * 40 - waterBoost * 1200;
            if (endMode === 'win') lvl = 760 + (t - endT) * 400;
            lvl += Math.sin(t * 1.7) * 8;
            water.style.transform = 'translateY(' + Math.round(lvl - 900) + 'px)';
          }
        }

        /* ---------- 结束 ---------- */
        function finish(res, skipped) {
          if (ended) return;
          ended = true;
          state = 'end';
          if (cur) { var c = cur; cur = null; c.el.classList.add(res === 'win' ? 'hit' : 'miss'); }
          if (skipped) { cleanup(); resolve('win'); return; }
          endMode = res; endT = t;
          if (res === 'win') winShow(); else loseShow();
          later(function () { cleanup(); resolve(res); }, res === 'win' ? 1450 : 1550);
        }

        function showCenter(main, sub, bad) {
          center.className = P + 'center' + (bad ? ' bad' : '');
          center.innerHTML = '<b>' + main + '</b><span>' + sub + '</span>';
          void center.offsetWidth;
          center.classList.add('on');
        }

        function winShow() {
          T = 0;
          flashTo(1, 700);
          shakeAmp = 34;
          hud.classList.remove('on');
          whis.innerHTML = '';
          au('sfx', S.winSfx);
          au('heartbeat', 72);
          if (key === 'window') { var im = el('div', P + 'impact', wrap); }
          later(function () { showCenter(S.win, S.winSub, false); }, 180);
        }

        function loseShow() {
          hud.classList.remove('on');
          whis.style.transition = 'opacity .35s'; whis.style.opacity = '0';   // 低语退场，别压住结局字
          au('sfx', S.loseSfx);
          if (key === 'street') {
            glare.style.transition = 'transform 1s ease-in, opacity .3s';
            glare.style.opacity = 1;
            glare.style.transform = 'translateX(900px) scale(3.2)';
            tween(function (p) { forwardBoost = p * 0.25; }, 900);
          } else if (key === 'window') {
            tween(function (p) { forwardBoost = p * 0.3; }, 1100);
          } else if (key === 'taxi') {
            tween(function (p) { gapBoost = p; }, 700);
            shakeAmp = 20;
          } else if (key === 'bath') {
            tween(function (p) { waterBoost = p; }, 800);
            for (var i = 0; i < 16; i++) {
              var b = el('i', null, bubbles), s = 8 + Math.random() * 26;
              b.style.cssText = 'left:' + Math.round(200 + Math.random() * 1200) + 'px;width:' + s + 'px;height:' + s + 'px;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's';
            }
          }
          later(function () { showCenter(S.lose, S.loseSub, true); }, 250);
          later(function () { black.style.opacity = 0.92; }, 650);
        }

        function tween(fn, ms) {
          var t0 = t;
          (function step() {
            if (!raf) return;
            var p = Math.min(1, (t - t0) * 1000 / ms);
            fn(p * p);
            if (p < 1) later(step, 16);
          })();
        }

        function cleanup() {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          timers.forEach(clearTimeout); timers = [];
          winListeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
          winListeners = [];
          au('heartbeat', 0);
        }

        /* ---------- 开场 ---------- */
        raf = requestAnimationFrame(frame);
        requestAnimationFrame(function () { wrap.classList.add('on'); });
        later(function () { hud.classList.add('on'); }, 250);
        later(function () { try { ctx.say(S.open); } catch (e) { /* 忽略 */ } }, 300);
        later(function () { if (!ended) state = 'play'; }, 1400);
      });
    }
  });
})();
