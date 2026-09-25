/*
 * 小游戏 madness_palm：“心”字墓室之四——疯狂（第九章）。
 * 圆形墓室，画面持续扭曲（canvas 分条波动 + 色相偏移 + 重影），幻听字幕“扯下来……”。
 * “疯狂值”持续上涨，按住（或连点）屏幕下方那多掌心里夏侯婴画的红符让它回落；手掌会随脚步摇晃，要跟住。
 * 同时自动向前走，10 秒（简单 8 秒）后穿过拱门 → win。疯狂值满 → 画面炸红、“重来”，从头再走（不会输）。
 * 键盘：按住空格 / 回车 = 按住掌心。
 */
(function () {
  'use strict';
  var GF = window.GF;
  if (!GF || !GF.games) return;

  var ID = 'madness_palm';
  var P = 'gfg-madness_palm-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';
  var W = 1600, H = 900;
  var CX = 800, CY = 440;          // 前进（缩放）中心 = 拱门方向

  /* ------------------------------------------------------------ 工具 */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  /** 随机扭曲符号（局部坐标约 ±50） */
  function glyph(r) {
    var d = '', n = 3 + Math.floor(r() * 3);
    function p() { return f1((r() - 0.5) * 90); }
    for (var i = 0; i < n; i++) {
      var k = r();
      if (k < 0.35) d += 'M' + p() + ' ' + p() + 'Q' + p() + ' ' + p() + ' ' + p() + ' ' + p();
      else if (k < 0.6) d += 'M' + p() + ' ' + p() + 'L' + p() + ' ' + p() + 'L' + p() + ' ' + p();
      else if (k < 0.8) { var x = p(), y = p(), rr = f1(5 + r() * 12); d += 'M' + (x - rr) + ' ' + y + 'a' + rr + ' ' + rr + ' 0 1 0 ' + (2 * rr) + ' 0a' + rr + ' ' + rr + ' 0 1 0 ' + (-2 * rr) + ' 0'; }
      else d += 'M' + p() + ' ' + p() + 'C' + p() + ' ' + p() + ' ' + p() + ' ' + p() + ' ' + p() + ' ' + p();
    }
    return d;
  }

  /* ------------------------------------------------------------ 兜底底图：圆形墓室（第一人称，正对拱门） */
  // 墙顶线（U 形，近处高、远处低）与墙脚线（∩ 形，近处低、远处高）
  function wallY(x, f) {
    var u = (x - 800) / 800;           // -1..1
    var top = 190 - 190 * u * u;       // 中间 190，两侧 0
    var bot = 592 + 330 * u * u;       // 中间 592，两侧 922
    return top + (bot - top) * f;
  }
  function artMadness() {
    var r = rng(4242), s = [];
    s.push('<defs>',
      '<radialGradient id="gfgmp-wall" cx="800" cy="400" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4a4533"/><stop offset=".35" stop-color="#2a2a1e"/><stop offset=".75" stop-color="#12130e"/><stop offset="1" stop-color="#070806"/></radialGradient>',
      '<linearGradient id="gfgmp-floor" x1="0" y1="590" x2="0" y2="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2c281b"/><stop offset=".4" stop-color="#1c1a12"/><stop offset="1" stop-color="#0d0c08"/></linearGradient>',
      '<radialGradient id="gfgmp-ceil" cx="800" cy="0" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#16150f"/><stop offset="1" stop-color="#040404"/></radialGradient>',
      '<radialGradient id="gfgmp-lamp"><stop offset="0" stop-color="#ffd58a" stop-opacity=".95"/><stop offset=".2" stop-color="#ff9a3a" stop-opacity=".45"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="gfgmp-pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d8913f" stop-opacity=".35"/><stop offset="1" stop-color="#d8913f" stop-opacity="0"/></radialGradient>',
      '<radialGradient id="gfgmp-archin" cx="800" cy="520" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1e2c30"/><stop offset=".6" stop-color="#0a1012"/><stop offset="1" stop-color="#020303"/></radialGradient>',
      '<linearGradient id="gfgmp-stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3628"/><stop offset=".45" stop-color="#6a6248"/><stop offset="1" stop-color="#2c291e"/></linearGradient>',
      '<radialGradient id="gfgmp-vig" cx=".5" cy=".5" r=".72"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".82"/></radialGradient>',
      '</defs>');
    s.push('<rect width="1600" height="900" fill="#050605"/>');
    // 穹顶
    s.push('<path d="M0 0 H1600 V0 Q800 380 0 0 Z" fill="url(#gfgmp-ceil)"/>');
    for (var i = 1; i < 5; i++) s.push('<path d="M0 ' + (-i * 30) + ' Q800 ' + (380 - i * 70) + ' 1600 ' + (-i * 30) + '" stroke="#2a281e" stroke-width="2" fill="none" opacity=".5"/>');
    // 墙面
    s.push('<path d="M0 0 Q800 380 1600 0 V922 Q800 262 0 922 Z" fill="url(#gfgmp-wall)"/>');
    // 石砌层线 + 竖缝（越远越密）
    var courses = 9;
    for (i = 1; i < courses; i++) {
      var f = i / courses;
      s.push('<path d="M0 ' + f1(wallY(0, f)) + ' Q800 ' + f1(2 * wallY(800, f) - (wallY(0, f) + wallY(1600, f)) / 2) + ' 1600 ' + f1(wallY(1600, f)) + '" stroke="#0b0b08" stroke-width="2.2" fill="none" opacity=".65"/>');
    }
    for (i = 0; i < courses; i++) {
      var fa = i / courses, fb = (i + 1) / courses, off = (i % 2) * 0.5;
      for (var u = -1 + off * 0.12; u < 1; u += 0.12) {
        var xx = 800 + Math.sign(u) * Math.pow(Math.abs(u), 0.8) * 800;
        s.push('<line x1="' + f1(xx) + '" y1="' + f1(wallY(xx, fa)) + '" x2="' + f1(xx) + '" y2="' + f1(wallY(xx, fb)) + '" stroke="#0b0b08" stroke-width="1.6" opacity=".5"/>');
      }
    }
    // 墙上密密麻麻的符号（近大远小，扭曲）
    s.push('<g fill="none" stroke-linecap="round" stroke-linejoin="round">');
    for (i = 0; i < 170; i++) {
      var gx = r() * 1600, gf = 0.08 + r() * 0.84;
      if (Math.abs(gx - 800) < 140 && gf > 0.35) continue;        // 给拱门留位置
      var gy = wallY(gx, gf), dist = Math.abs(gx - 800) / 800;
      var sc = 0.18 + dist * dist * 0.55 + r() * 0.08;
      var col = r() < 0.7 ? '#6e2419' : '#8a7446';
      s.push('<path d="' + glyph(r) + '" transform="translate(' + f1(gx) + ' ' + f1(gy) + ') rotate(' + f1((r() - 0.5) * 50) + ') skewX(' + f1((r() - 0.5) * 30) + ') scale(' + sc.toFixed(2) + ')" stroke="' + col + '" stroke-width="' + f1(4 / sc * 0.6) + '" opacity="' + f1(0.45 + r() * 0.4) + '"/>');
    }
    s.push('</g>');
    // 油灯
    [150, 400, 620, 980, 1200, 1450].forEach(function (lx) {
      var ly = wallY(lx, 0.52), d = Math.abs(lx - 800) / 800, sz = 0.6 + d * 0.8;
      s.push('<circle cx="' + lx + '" cy="' + f1(ly - 10 * sz) + '" r="' + f1(170 * sz) + '" fill="url(#gfgmp-lamp)"/>');
      s.push('<path d="M' + f1(lx - 16 * sz) + ' ' + f1(ly) + ' h' + f1(32 * sz) + ' l' + f1(-6 * sz) + ' ' + f1(8 * sz) + ' h' + f1(-20 * sz) + ' Z" fill="#2a2418"/>');
      s.push('<path d="M' + lx + ' ' + f1(ly - 26 * sz) + ' q' + f1(8 * sz) + ' ' + f1(14 * sz) + ' 0 ' + f1(24 * sz) + ' q' + f1(-8 * sz) + ' ' + f1(-10 * sz) + ' 0 ' + f1(-24 * sz) + ' Z" fill="#ffe2a0"/>');
    });
    // 拱门
    s.push('<path d="M694 594 V405 A106 106 0 0 1 906 405 V594 Z" fill="url(#gfgmp-stone)"/>');
    for (i = 0; i <= 10; i++) {
      var a = Math.PI + i * Math.PI / 10;
      s.push('<line x1="' + f1(800 + Math.cos(a) * 80) + '" y1="' + f1(405 + Math.sin(a) * 80) + '" x2="' + f1(800 + Math.cos(a) * 106) + '" y2="' + f1(405 + Math.sin(a) * 106) + '" stroke="#1d1b13" stroke-width="2"/>');
    }
    s.push('<path d="M720 594 V408 A80 80 0 0 1 880 408 V594 Z" fill="url(#gfgmp-archin)"/>');
    s.push('<path d="M786 300 L814 300 L808 322 L792 322 Z" fill="#7a7152"/>');
    // 地面
    s.push('<path d="M0 922 Q800 262 1600 922 V900 H0 Z" fill="url(#gfgmp-floor)"/>');
    for (i = 1; i < 6; i++) {
      var ry = 596 + i * i * 12;
      s.push('<path d="M' + f1(800 - i * 300) + ' ' + f1(ry + i * 40) + ' Q800 ' + f1(ry - 10) + ' ' + f1(800 + i * 300) + ' ' + f1(ry + i * 40) + '" stroke="#0a0906" stroke-width="2" fill="none" opacity=".6"/>');
    }
    for (i = -8; i <= 8; i++) s.push('<line x1="' + (800 + i * 18) + '" y1="596" x2="' + (800 + i * 260) + '" y2="900" stroke="#0a0906" stroke-width="1.6" opacity=".45"/>');
    s.push('<ellipse cx="400" cy="720" rx="360" ry="90" fill="url(#gfgmp-pool)"/><ellipse cx="1200" cy="720" rx="360" ry="90" fill="url(#gfgmp-pool)"/><ellipse cx="800" cy="640" rx="260" ry="50" fill="url(#gfgmp-pool)"/>');
    // 满地短铁矢
    for (i = 0; i < 260; i++) {
      var bx = r() * 1600, by = 600 + Math.pow(r(), 0.8) * 300;
      var floorTop = wallY(bx, 1) + 6;
      if (by < floorTop) continue;
      var pz = clamp((by - 590) / 310, 0.05, 1), len = 8 + pz * 46, ang = r() * Math.PI * 2;
      var dx = Math.cos(ang) * len, dy = Math.sin(ang) * len * 0.35;
      s.push('<line x1="' + f1(bx) + '" y1="' + f1(by) + '" x2="' + f1(bx + dx) + '" y2="' + f1(by + dy) + '" stroke="#16130f" stroke-width="' + f1(1.2 + pz * 3) + '" stroke-linecap="round"/>');
      if (r() < 0.5) s.push('<line x1="' + f1(bx) + '" y1="' + f1(by - 1) + '" x2="' + f1(bx + dx * 0.7) + '" y2="' + f1(by + dy * 0.7 - 1) + '" stroke="#9a7f55" stroke-width="' + f1(0.5 + pz) + '" opacity=".55"/>');
    }
    s.push('<rect width="1600" height="900" fill="url(#gfgmp-vig)"/>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice">' + s.join('') + '</svg>';
  }

  /** 在底图上叠一串卫不回留下的红脚印（透视） */
  function drawFootprints(g, photo) {
    g.save();
    if (photo) g.globalAlpha = 0.7;
    for (var i = 0; i < 16; i++) {
      var f = i / 15;                              // 0 近 → 1 远
      var y = 900 - (900 - 604) * Math.pow(f, 0.62);
      var sc = 1 - f * 0.86;
      var x = 800 + Math.sin(f * 5.2) * 90 * sc + (i % 2 ? 26 : -26) * sc;
      g.save();
      g.translate(x, y);
      g.scale(sc, sc * 0.42);
      g.rotate((i % 2 ? 0.12 : -0.12));
      g.fillStyle = 'rgba(150,28,18,0.78)';
      g.shadowColor = 'rgba(255,60,30,0.5)';
      g.shadowBlur = 12;
      g.beginPath(); g.ellipse(0, -26, 22, 36, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0, 34, 17, 22, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();
  }

  /* ------------------------------------------------------------ 那多的手掌（掌心朝向自己，右手） */
  var SIGIL = 'M0 -62C22 -58 30 -40 18 -26C6 -12 -20 -18 -18 -36C-16 -52 8 -52 10 -38' +
    'M-46 -18C-20 -6 20 -6 46 -18M0 -12L0 60M-34 10Q0 28 34 10M-40 42L-18 30L-26 60M40 42L18 30L26 60' +
    'M-58 -48Q-68 -10 -52 24M58 -48Q68 -10 52 24M-12 66Q0 76 12 66';
  function palmSvg() {
    var fingers = [
      // [基点x, 基点y, 角度, 长, 宽]
      [124, 268, -9, 128, 44],
      [174, 244, -3, 172, 50],
      [228, 238, 1, 190, 52],
      [282, 250, 7, 166, 50]
    ];
    var shapes = '';
    fingers.forEach(function (fg) {
      shapes += '<rect x="' + (fg[0] - fg[4] / 2) + '" y="' + (fg[1] - fg[3]) + '" width="' + fg[4] + '" height="' + (fg[3] + 40) + '" rx="' + (fg[4] / 2) + '" transform="rotate(' + fg[2] + ' ' + fg[0] + ' ' + fg[1] + ')"/>';
    });
    shapes += '<rect x="292" y="238" width="60" height="170" rx="30" transform="rotate(42 322 390)"/>';
    shapes += '<path d="M104 300Q98 240 150 236L304 238Q340 244 338 300L350 382Q358 446 322 500L306 560H132L120 500Q92 430 104 300Z"/>';
    var creases = '';
    fingers.forEach(function (fg) {
      for (var j = 1; j <= 2; j++) {
        var yy = fg[1] - fg[3] * (j === 1 ? 0.3 : 0.62);
        creases += '<line x1="' + (fg[0] - fg[4] * 0.32) + '" y1="' + yy + '" x2="' + (fg[0] + fg[4] * 0.32) + '" y2="' + (yy + 2) + '" transform="rotate(' + fg[2] + ' ' + fg[0] + ' ' + fg[1] + ')"/>';
      }
    });
    return '<svg viewBox="0 0 440 560" width="374" height="476" overflow="visible">' +
      '<defs>' +
      '<radialGradient id="gfgmp-skin" cx="210" cy="360" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b8805c"/><stop offset=".45" stop-color="#8d5b3e"/><stop offset=".85" stop-color="#4d2f20"/><stop offset="1" stop-color="#2e1c13"/></radialGradient>' +
      '<linearGradient id="gfgmp-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".22"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>' +
      '<filter id="gfgmp-rim" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>' +
      '<filter id="gfgmp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '</defs>' +
      '<g filter="url(#gfgmp-rim)" fill="#ffae55" opacity=".55" transform="translate(-6 -6)">' + shapes + '</g>' +
      '<g fill="url(#gfgmp-skin)">' + shapes + '</g>' +
      '<g fill="url(#gfgmp-shade)">' + shapes + '</g>' +
      '<g stroke="#4a2a1a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5">' + creases +
      '<path d="M108 332Q190 352 300 296"/><path d="M116 372Q200 382 296 352"/><path d="M300 306Q246 390 272 506"/></g>' +
      '<g class="' + P + 'sigil" transform="translate(214 392) scale(1.15)">' +
      '<path class="' + P + 'sglow" d="' + SIGIL + '" stroke="#ff4a2a" stroke-width="12" fill="none" stroke-linecap="round" filter="url(#gfgmp-glow)"/>' +
      '<path d="' + SIGIL + '" stroke="#c0231a" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + SIGIL + '" stroke="#ff8a6a" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>' +
      '</g></svg>';
  }

  /* ------------------------------------------------------------ 飘动的墙上符号层 */
  function glyphLayer() {
    var r = rng(99), out = '';
    var spots = [[170, 260], [300, 520], [120, 700], [1430, 250], [1300, 520], [1480, 690], [520, 200], [1080, 190]];
    spots.forEach(function (sp, i) {
      var size = 130 + r() * 110;
      out += '<svg class="' + P + 'g" viewBox="-60 -60 120 120" width="' + Math.round(size) + '" height="' + Math.round(size) + '" style="left:' + Math.round(sp[0] - size / 2) + 'px;top:' + Math.round(sp[1] - size / 2) + 'px;animation-duration:' + (2.4 + r() * 2.2).toFixed(1) + 's;animation-delay:-' + (r() * 2).toFixed(1) + 's">' +
        '<path d="' + glyph(r) + '" fill="none" stroke="#b83a26" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    });
    return out;
  }

  /* ------------------------------------------------------------ 拱门前景（最后一段路：拱门越来越大，穿过去） */
  function archSvg() {
    return '<svg viewBox="0 0 1600 900" width="1600" height="900">' +
      '<defs><radialGradient id="gfgmp-ain" cx="800" cy="520" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#16222a"/><stop offset="1" stop-color="#010202"/></radialGradient>' +
      '<linearGradient id="gfgmp-ast" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a271c"/><stop offset=".5" stop-color="#5d563f"/><stop offset="1" stop-color="#211f16"/></linearGradient></defs>' +
      '<path d="M694 700 V405 A106 106 0 0 1 906 405 V700 Z" fill="url(#gfgmp-ast)"/>' +
      '<path d="M720 700 V408 A80 80 0 0 1 880 408 V700 Z" fill="url(#gfgmp-ain)"/></svg>';
  }

  /* ------------------------------------------------------------ 样式 */
  function css() {
    var p = '.' + P;
    return [
      p + 'wrap{position:absolute;inset:0;overflow:hidden;background:#000;font-family:' + FONT + ';opacity:0;transition:opacity .7s}',
      p + 'wrap.on{opacity:1}',
      p + 'shake{position:absolute;inset:0}',
      p + 'cv{position:absolute;left:0;top:0;width:1600px;height:900px;will-change:filter}',
      p + 'glyphs{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen}',
      p + 'g{position:absolute;overflow:visible;filter:drop-shadow(0 0 8px rgba(255,70,40,.8));animation:' + P + 'writhe ease-in-out infinite alternate}',
      '@keyframes ' + P + 'writhe{0%{transform:rotate(-10deg) skewX(-12deg) scale(.9)}50%{transform:rotate(6deg) skewY(10deg) scale(1.12)}100%{transform:rotate(12deg) skewX(14deg) scale(.95)}}',
      p + 'arch{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;opacity:0;transform-origin:800px 440px}',
      p + 'red{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 65% at 50% 50%,rgba(120,0,0,0) 20%,rgba(150,10,5,.9) 100%);mix-blend-mode:multiply;opacity:0}',
      p + 'focus{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .25s}',
      p + 'voices{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
      p + 'voices span{position:absolute;white-space:nowrap;color:#e0473a;letter-spacing:.18em;text-shadow:0 0 22px rgba(255,40,20,.75),0 0 2px #300;animation:' + P + 'voice 2.2s ease-out forwards}',
      '@keyframes ' + P + 'voice{0%{opacity:0;transform:scale(1.4) rotate(var(--r));filter:blur(8px)}15%{opacity:.95;transform:scale(1) rotate(var(--r));filter:blur(0)}30%{transform:translate(4px,-2px) scale(1.02) rotate(var(--r))}45%{transform:translate(-4px,2px) scale(1) rotate(var(--r))}100%{opacity:0;transform:translate(0,-30px) scale(1.1) rotate(var(--r));filter:blur(4px)}}',
      p + 'palm{position:absolute;left:0;top:0;width:374px;height:476px;cursor:pointer;will-change:transform;filter:drop-shadow(0 -10px 30px rgba(0,0,0,.6))}',
      p + 'palm svg{display:block;overflow:visible}',
      p + 'sglow{opacity:.55;transition:opacity .15s}',
      p + 'palm.hold ' + p + 'sglow{opacity:1}',
      p + 'pulse{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #ff5a3a;box-shadow:0 0 24px #ff3a1a;pointer-events:none;animation:' + P + 'pulse .6s ease-out forwards}',
      '@keyframes ' + P + 'pulse{from{transform:scale(1);opacity:1}to{transform:scale(7);opacity:0}}',
      p + 'miss{position:absolute;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:2px dashed rgba(255,220,200,.6);pointer-events:none;animation:' + P + 'fade .5s ease-out forwards}',
      '@keyframes ' + P + 'fade{from{opacity:1}to{opacity:0;transform:scale(1.6)}}',
      /* HUD */
      p + 'hud{position:absolute;left:0;right:0;top:0;height:190px;pointer-events:none;text-align:center;color:#efe6d2;background:linear-gradient(180deg,rgba(0,0,0,.78),rgba(0,0,0,0));opacity:0;transition:opacity .5s;z-index:30}',
      p + 'hud.on{opacity:1}',
      p + 'tip{margin-top:22px;font-size:30px;letter-spacing:.08em;text-shadow:0 2px 10px #000;transition:color .15s}',
      p + 'tip small{font-size:26px;color:#bfb49d;margin-left:14px;letter-spacing:.04em}',
      p + 'tip.warn{color:#ff7a66}',
      p + 'bars{display:inline-grid;grid-template-columns:auto 560px auto;gap:10px 16px;align-items:center;margin-top:16px}',
      p + 'lab{font-size:26px;letter-spacing:.3em;color:#e0b56a;text-align:right}',
      p + 'lab.mad{color:#e0584a}',
      p + 'track{position:relative;height:14px;border-radius:8px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(224,181,106,.35)}',
      p + 'track.madt{height:18px;box-shadow:inset 0 0 0 1px rgba(224,88,74,.5)}',
      p + 'fill{position:absolute;left:0;top:0;bottom:0;border-radius:8px;width:0}',
      p + 'pfill{background:linear-gradient(90deg,rgba(224,181,106,.3),#e0b56a)}',
      p + 'mfill{background:linear-gradient(90deg,#5a1a14,#b8352b 60%,#ff5a3a);box-shadow:0 0 14px rgba(255,60,40,.6)}',
      p + 'madt.hot{animation:' + P + 'hot .25s linear infinite}',
      '@keyframes ' + P + 'hot{0%{transform:translate(1px,0)}50%{transform:translate(-2px,1px)}100%{transform:translate(1px,-1px)}}',
      p + 'dot{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff3d6;box-shadow:0 0 12px #e0b56a}',
      p + 'archico{font-size:24px;color:#bfb49d;letter-spacing:.1em;text-align:left}',
      p + 'pct{font-size:26px;color:#e0584a;text-align:left;min-width:64px}',
      /* 结束与重来 */
      p + 'flash{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:60}',
      p + 'center{position:absolute;left:0;right:0;top:330px;text-align:center;z-index:70;pointer-events:none;opacity:0;transition:opacity .25s}',
      p + 'center.on{opacity:1}',
      p + 'center b{display:block;font-size:72px;font-weight:bold;letter-spacing:.3em;color:#fff1e6;text-shadow:0 0 40px rgba(255,40,20,.9),0 2px 8px #000}',
      p + 'center span{display:block;margin-top:18px;font-size:32px;color:#f0c9a8;letter-spacing:.08em;text-shadow:0 2px 10px #000}',
      p + 'center.calm b{font-size:52px;letter-spacing:.12em;text-shadow:0 0 30px rgba(160,200,220,.6),0 2px 8px #000}',
      p + 'center.calm span{color:#e0b56a}',
      p + 'intro{position:absolute;left:0;right:0;top:210px;text-align:center;font-size:34px;color:#efe6d2;letter-spacing:.1em;text-shadow:0 2px 12px #000;opacity:0;transition:opacity .4s;pointer-events:none;z-index:31}',
      p + 'intro b{font-weight:normal;color:#7fc3a0;margin-right:.6em;font-size:28px;letter-spacing:.2em}',
      p + 'intro.on{opacity:1}'
    ].join('\n');
  }

  /* ------------------------------------------------------------ 主体 */
  GF.games.register(ID, {
    fallbackArt: artMadness,   // 兜底底图（调试/预览用）
    start: function (ctx) {
      return new Promise(function (resolve) {
        var easy = !!ctx.easy;
        var DUR = easy ? 8 : 10;             // 走到拱门的时间（秒）
        var RISE = easy ? 11 : 17;           // 疯狂值每秒基础上涨
        var RISE_P = easy ? 5 : 8;           // 越往里涨得越快
        var HOLD = easy ? 76 : 62;           // 按住掌心时每秒回落
        var TAP = easy ? 8 : 6;              // 点一下掌心立刻回落
        var SURGE = easy ? 11 : 18;          // 幻听爆发的冲击
        var VOICES = ['扯下来……', '扯下来……扯下来……', '扯下来！', '拧下来……', '撕开它……', '喊出来啊……', '扯下来……'];

        var timers = [], raf = 0, ended = false, listeners = [];
        function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
        function on(target, type, fn, opt) { target.addEventListener(type, fn, opt); listeners.push([target, type, fn, opt]); }
        function au(fn, a) { try { if (ctx.audio && typeof ctx.audio[fn] === 'function') ctx.audio[fn](a); } catch (e) { /* 音频可能未实现 */ } }
        function el(tag, cls, parent) {
          var e = document.createElement(tag);
          if (cls) e.className = cls;
          if (parent) parent.appendChild(e);
          return e;
        }

        /* ---------- DOM ---------- */
        var root = ctx.root;
        var style = el('style', null, root);
        style.textContent = css();
        var wrap = el('div', P + 'wrap');
        var shake = el('div', P + 'shake', wrap);
        var cv = el('canvas', P + 'cv', shake);
        cv.width = W; cv.height = H;
        var g = cv.getContext('2d');
        var base = document.createElement('canvas');
        base.width = W; base.height = H;
        var bg2 = base.getContext('2d');
        var glyphs = el('div', P + 'glyphs', shake);
        glyphs.innerHTML = glyphLayer();
        var arch = el('div', P + 'arch', shake);
        arch.innerHTML = archSvg();
        var red = el('div', P + 'red', shake);
        var focus = el('div', P + 'focus', wrap);
        var voices = el('div', P + 'voices', wrap);
        var palm = el('div', P + 'palm', wrap);
        palm.innerHTML = palmSvg();
        var hud = el('div', P + 'hud', wrap);
        hud.innerHTML = '<div class="' + P + 'tip">按住掌心的红符，让“疯狂”退下去<small>（也可以连点 · 或按住空格）</small></div>' +
          '<div class="' + P + 'bars">' +
          '<span class="' + P + 'lab">前行</span><div class="' + P + 'track"><i class="' + P + 'fill ' + P + 'pfill"></i><b class="' + P + 'dot"></b></div><span class="' + P + 'archico">拱门</span>' +
          '<span class="' + P + 'lab mad">疯狂</span><div class="' + P + 'track ' + P + 'madt"><i class="' + P + 'fill ' + P + 'mfill"></i></div><span class="' + P + 'pct"></span>' +
          '</div>';
        var tipEl = hud.querySelector('.' + P + 'tip');
        var pfill = hud.querySelector('.' + P + 'pfill'), pdot = hud.querySelector('.' + P + 'dot');
        var mfill = hud.querySelector('.' + P + 'mfill'), mtrack = hud.querySelector('.' + P + 'madt'), pct = hud.querySelector('.' + P + 'pct');
        var intro = el('div', P + 'intro', wrap);
        intro.innerHTML = '<b>夏侯婴</b>盯着手心往前走，别去看墙。';
        var flash = el('div', P + 'flash', wrap);
        var center = el('div', P + 'center', wrap);
        root.appendChild(wrap);
        var glyphEls = glyphs.querySelectorAll('.' + P + 'g');

        /* ---------- 状态 ---------- */
        var state = 'load';      // load | intro | play | reset | end
        var t = 0, last = 0;
        var m = 15, mv = 15;     // 疯狂值（逻辑 / 视觉）
        var prog = 0;            // 前进进度 0..1
        var restarts = 0;
        var rise = RISE;
        var palmUp = 0;          // 手掌抬起 0..1
        var swayJerk = 0, jerkDir = 1;
        var nextSurge = 2.4, surgeLeft = 0;
        var nextVoice = 0.6;
        var shakeAmp = 0;
        var pointer = { down: false, x: 0, y: 0, id: null };
        var keyHold = false;
        var holding = false, wasHolding = false;
        var palmX = 900, palmY = 787;   // 掌心符号中心（舞台坐标）
        var hbLast = -1;
        var warnT = 0;

        /* ---------- 底图 ---------- */
        var isPhoto = false;
        function buildBase(img) {
          if (ended) return;
          bg2.fillStyle = '#060705';
          bg2.fillRect(0, 0, W, H);
          if (img) {
            try {   // object-fit: cover
              var iw = img.naturalWidth || W, ih = img.naturalHeight || H, s = Math.max(W / iw, H / ih);
              bg2.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
            } catch (e) { /* 忽略 */ }
          }
          if (isPhoto) {
            // 照片偏亮：压一点暗角，让掌心红符和幻听字更醒目
            var vg = bg2.createRadialGradient(CX, CY + 60, 200, CX, CY + 60, 1000);
            vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
            bg2.fillStyle = vg; bg2.fillRect(0, 0, W, H);
          }
          drawFootprints(bg2, isPhoto);
          wrap.setAttribute('data-bg', img ? (isPhoto ? 'photo' : 'vector') : 'none');
          if (state === 'load') startIntro();
        }
        function loadImg(src, cb) {
          var img = new Image(), done = false;
          function fin(ok) { if (done) return; done = true; cb(ok ? img : null); }
          img.onload = function () { fin(true); };
          img.onerror = function () { fin(false); };
          img.src = src;
          later(function () { fin(false); }, 4000);
        }
        function loadSvg(svg, cb) {
          var img = new Image(), done = false;
          function fin(ok) { if (done) return; done = true; cb(ok ? img : null); }
          img.onload = function () { fin(true); };
          img.onerror = function () { fin(false); };
          svg = svg.replace(/<svg\b([^>]*)>/, function (all, attrs) {
            attrs = attrs.replace(/\s(width|height)="[^"]*"/g, '');
            if (!/xmlns=/.test(attrs)) attrs += ' xmlns="http://www.w3.org/2000/svg"';
            return '<svg' + attrs + ' width="1600" height="900">';
          });
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          later(function () { fin(false); }, 2500);
        }
        // 底图：AI 插画 → 矢量底图 → 本文件自绘
        function vectorBase() {
          isPhoto = false;
          var art = '';
          try { art = ctx.bgSvg('heart_madness') || ''; } catch (e) { art = ''; }
          if (art) {
            loadSvg(art, function (img) {
              if (img) buildBase(img);
              else loadSvg(artMadness(), buildBase);
            });
          } else {
            loadSvg(artMadness(), buildBase);
          }
        }
        var photo = '';
        try { photo = (ctx.bgImage && ctx.bgImage('heart_madness')) || ''; } catch (e) { photo = ''; }
        if (photo) {
          isPhoto = true;
          loadImg(photo, function (img) { if (img) buildBase(img); else vectorBase(); });
        } else vectorBase();

        /* ---------- 输入 ---------- */
        function onPalm(x, y) {
          var dx = (x - palmX) / 200, dy = (y - palmY) / 200;
          return dx * dx + dy * dy <= 1;
        }
        on(root, 'pointerdown', function (e) {
          if (ended) return;
          var p = ctx.toLocal(e);
          pointer.down = true; pointer.x = p.x; pointer.y = p.y; pointer.id = e.pointerId;
          if (state !== 'play') return;
          if (onPalm(p.x, p.y)) {
            m = Math.max(0, m - TAP);
            pulse(palmX, palmY);
          } else {
            var mk = el('div', P + 'miss', wrap);
            mk.style.left = Math.round(p.x) + 'px'; mk.style.top = Math.round(p.y) + 'px';
            later(function () { if (mk.parentNode) mk.remove(); }, 520);
            warnT = 0.9;
          }
        });
        on(root, 'pointermove', function (e) {
          if (!pointer.down) return;
          var p = ctx.toLocal(e);
          pointer.x = p.x; pointer.y = p.y;
        });
        function up() { pointer.down = false; pointer.id = null; }
        on(window, 'pointerup', up);
        on(window, 'pointercancel', up);
        on(window, 'blur', function () { up(); keyHold = false; });
        on(window, 'keydown', function (e) {
          if (ended) return;
          if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            if (!e.repeat && state === 'play') { m = Math.max(0, m - TAP); pulse(palmX, palmY); }
            keyHold = true;
          }
        });
        on(window, 'keyup', function (e) {
          if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') keyHold = false;
        });

        function pulse(x, y) {
          var pl = el('div', P + 'pulse', wrap);
          pl.style.left = Math.round(x) + 'px'; pl.style.top = Math.round(y) + 'px';
          later(function () { if (pl.parentNode) pl.remove(); }, 650);
        }

        function voice(loud) {
          var v = el('span', null, voices);
          v.textContent = loud ? '扯下来！' : VOICES[Math.floor(Math.random() * VOICES.length)];
          var size = loud ? 88 : 40 + mv * 0.4 + Math.random() * 12;
          var x = 90 + Math.random() * 1150, y = 200 + Math.random() * 320;
          if (loud) { x = 400 + Math.random() * 500; y = 260 + Math.random() * 180; }
          v.style.cssText = 'left:' + Math.round(x) + 'px;top:' + Math.round(y) + 'px;font-size:' + Math.round(size) + 'px;--r:' + ((Math.random() - 0.5) * 16).toFixed(1) + 'deg';
          later(function () { if (v.parentNode) v.remove(); }, 2300);
        }

        /* ---------- 流程 ---------- */
        // 不会真正失败，但简单模式 / 引擎记录失败过 / 本局已“重来”两次时给个跳过
        var skipShown = false;
        function showSkip() {
          if (skipShown || ended) return;
          skipShown = true;
          try { ctx.skipBtn(function () { if (ended) return; ended = true; state = 'end'; cleanup(); resolve('win'); }); } catch (e) { /* 忽略 */ }
        }
        function startIntro() {
          state = 'intro';
          if (easy || ctx.failCount >= 2) showSkip();
          raf = requestAnimationFrame(frame);
          requestAnimationFrame(function () { wrap.classList.add('on'); });
          later(function () { intro.classList.add('on'); hud.classList.add('on'); }, 250);
          later(function () { if (state === 'intro') { state = 'play'; au('sfx', 'footsteps'); } }, 1700);
          later(function () { intro.classList.remove('on'); }, 3200);
        }

        function doReset() {
          state = 'reset';
          restarts++;
          if (restarts >= 2) showSkip();
          wrap.setAttribute('data-restarts', restarts);
          au('sfx', 'thud');
          au('sfx', 'whisper');
          shakeAmp = 34;
          flash.style.transition = 'none';
          flash.style.background = 'radial-gradient(ellipse at 50% 50%,rgba(255,60,30,.95),rgba(120,0,0,.98))';
          flash.style.opacity = 1;
          void flash.offsetWidth;
          flash.style.transition = 'opacity 1.1s ease-out';
          flash.style.opacity = 0.35;
          for (var i = 0; i < 5; i++) later(function () { voice(false); }, i * 90);
          center.className = P + 'center';
          center.innerHTML = '<b>重来</b><span>差一点，就伸手去扯了。盯住掌心，再走一遍。</span>';
          void center.offsetWidth;
          center.classList.add('on');
          var p0 = prog, t0 = t;
          later(function rewind() {
            var k = clamp((t - t0 - 0.5) / 0.7, 0, 1);
            prog = p0 * (1 - smooth(k));
            if (k < 1) later(rewind, 16);
          }, 500);
          later(function () { flash.style.opacity = 0; }, 900);
          later(function () {
            center.classList.remove('on');
            m = 28; prog = 0;
            rise = RISE * Math.max(0.6, 1 - restarts * 0.15);
            nextSurge = t + 2.6;
            if (!ended) state = 'play';
          }, 1750);
        }

        function doWin() {
          if (ended) return;
          ended = true;
          state = 'end';
          hud.classList.remove('on');
          au('heartbeat', 0);
          au('sfx', 'stone');
          voices.innerHTML = '';
          palm.style.transition = 'opacity .4s';
          palm.style.opacity = 0;
          flash.style.transition = 'none';
          flash.style.background = '#cfd8dc';
          flash.style.opacity = 0.9;
          void flash.offsetWidth;
          flash.style.transition = 'opacity 1.1s ease-out';
          flash.style.opacity = 0;
          later(function () {
            center.className = P + 'center calm';
            center.innerHTML = '<b>穿过去了。</b><span>耳边的声音，一下子全停了。</span>';
            void center.offsetWidth;
            center.classList.add('on');
          }, 150);
          later(function () { cleanup(); resolve('win'); }, 1450);
        }

        function cleanup() {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          timers.forEach(clearTimeout); timers = [];
          listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
          listeners = [];
          au('heartbeat', 0);
        }

        /* ---------- 主循环 ---------- */
        function frame(now) {
          raf = requestAnimationFrame(frame);
          if (!last) last = now;
          var dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          t += dt;

          // 手掌抬起
          var wantUp = (state === 'play' || state === 'reset' || state === 'intro' && t > 0.7) ? 1 : 0;
          if (state === 'end') wantUp = 1;
          palmUp += (wantUp - palmUp) * Math.min(1, dt * 5);

          // 手掌位置（随脚步摇晃，疯狂越高抖得越厉害，幻听爆发时猛地一甩）
          var swayAmp = 70 + mv * 1.5;
          var sway = Math.sin(t * 1.25) * swayAmp + Math.sin(t * 2.9) * swayAmp * 0.25 + swayJerk * jerkDir;
          var bob = Math.abs(Math.sin(t * 4.2)) * 12;
          var trem = (Math.random() - 0.5) * mv * 0.08;
          palmX = 900 + sway + trem;
          palmY = 787 + bob + (1 - palmUp) * 520;

          holding = false;
          if (state === 'play') {
            holding = keyHold || (pointer.down && onPalm(pointer.x, pointer.y));
            var r = rise + RISE_P * prog;
            m += r * dt;
            if (holding) m -= HOLD * dt;
            if (t >= nextSurge) {
              surgeLeft = 0.4; nextSurge = t + 2.0 + Math.random() * 1.2;
              jerkDir = Math.random() < 0.5 ? -1 : 1; swayJerk = 110 + Math.random() * 60;
              shakeAmp = Math.max(shakeAmp, 10);
              voice(true);
              au('sfx', 'whisper');
            }
            if (surgeLeft > 0) { var ds = Math.min(dt, surgeLeft); m += SURGE / 0.4 * ds; surgeLeft -= ds; }
            m = clamp(m, 0, 100);
            prog = Math.min(1, prog + dt / DUR);
            if (t >= nextVoice) { voice(false); nextVoice = t + Math.max(0.35, 1.5 - mv * 0.012) + Math.random() * 0.3; }
            if (m >= 100) doReset();
            else if (prog >= 1) doWin();
          }
          swayJerk = Math.max(0, swayJerk - dt * 260);
          shakeAmp = Math.max(0, shakeAmp - dt * 40);
          warnT = Math.max(0, warnT - dt);
          mv += (m - mv) * Math.min(1, dt * 6);

          render();

          if (state !== 'end') {
            var bpm = Math.round(72 + mv * 0.8);
            if (Math.abs(bpm - hbLast) >= 5) { hbLast = bpm; au('heartbeat', bpm); }
          }
        }

        function zoomAt(p) {
          if (p < 0.85) return 1.1 + 1.1 * smooth(p / 0.85);
          return 2.2 * Math.pow(5, (p - 0.85) / 0.15);
        }

        function render() {
          var k = mv / 100;
          var z = zoomAt(prog);
          var walkBob = Math.sin(t * 4.2) * 5 * (state === 'play' ? 1 : 0.3);
          var amp = (2 + mv * 0.3) * (holding ? 0.5 : 1);
          var rot = Math.sin(t * 0.7) * k * 0.045 * (holding ? 0.5 : 1);

          // 画面：分条波动 + 旋转 + 前进缩放
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = '#000';
          g.fillRect(0, 0, W, H);
          g.translate(W / 2, H / 2); g.rotate(rot); g.translate(-W / 2, -H / 2);
          var SH = 6, pad = 70;
          var sw = (W + pad * 2) / z, sx0 = CX + (-pad - CX) / z;
          for (var y = 0; y < H; y += SH) {
            var off = Math.sin(y * 0.017 + t * 2.3) * amp + Math.sin(y * 0.051 - t * 3.4) * amp * 0.35;
            var sy = CY + (y - CY + walkBob) / z;
            g.drawImage(base, sx0, sy, sw, SH / z, off - pad, y, W + pad * 2, SH + 0.6);
          }
          // 重影
          if (k > 0.2) {
            var z2 = z * (1.03 + Math.sin(t * 3) * 0.015);
            g.globalAlpha = (k - 0.2) * 0.4;
            g.globalCompositeOperation = 'screen';
            g.drawImage(base, CX - CX / z2 + Math.sin(t * 1.7) * 14 / z2, CY - CY / z2, W / z2, H / z2, 0, 0, W, H);
          }
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';

          var hue = mv * 0.9 * (holding ? 0.6 : 1);
          cv.style.filter = 'hue-rotate(' + hue.toFixed(1) + 'deg) saturate(' + (1 + k * 0.9).toFixed(2) + ') contrast(' + (1 + k * 0.25).toFixed(2) + ')';

          // 符号层、红晕、拱门
          var beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * (72 + mv * 0.8) / 60)), 6);
          glyphs.style.opacity = ((0.12 + k * 0.75) * (holding ? 0.45 : 1)).toFixed(2);
          var gs = 1 + (z - 1.1) * 0.25;
          glyphs.style.transform = 'scale(' + gs.toFixed(3) + ')';
          red.style.opacity = (Math.max(0, (mv - 35) / 65) * 0.8 + beat * k * 0.25).toFixed(3);
          var ao = clamp((prog - 0.55) / 0.2, 0, 1);
          arch.style.opacity = ao.toFixed(2);
          arch.style.transform = 'translateY(' + f1(walkBob) + 'px) scale(' + z.toFixed(3) + ')';

          // 专注：以掌心为中心压暗四周
          focus.style.opacity = holding ? 1 : 0;
          focus.style.background = 'radial-gradient(circle at ' + Math.round(palmX) + 'px ' + Math.round(palmY - 60) + 'px,rgba(0,0,0,0) 180px,rgba(0,0,0,.55) 520px)';
          voices.style.opacity = holding ? 0.45 : 1;

          // 手掌
          palm.style.transform = 'translate(' + Math.round(palmX - 214 * 0.85) + 'px,' + Math.round(palmY - 392 * 0.85) + 'px) rotate(' + (Math.sin(t * 1.25) * 4 + (palmX - 900) * 0.02).toFixed(2) + 'deg)';
          if (holding !== wasHolding) { palm.classList.toggle('hold', holding); wasHolding = holding; }

          // 抖屏
          var sx = (Math.random() - 0.5) * (shakeAmp + (mv > 80 ? (mv - 80) * 0.4 : 0));
          var sy2 = (Math.random() - 0.5) * (shakeAmp + (mv > 80 ? (mv - 80) * 0.4 : 0));
          shake.style.transform = 'translate(' + f1(sx) + 'px,' + f1(sy2) + 'px)';

          // HUD
          pfill.style.width = (prog * 100).toFixed(1) + '%';
          pdot.style.left = (prog * 100).toFixed(1) + '%';
          mfill.style.width = mv.toFixed(1) + '%';
          pct.textContent = Math.round(mv) + '%';
          mtrack.classList.toggle('hot', mv > 75);
          tipEl.classList.toggle('warn', warnT > 0 || mv > 80);

          wrap.setAttribute('data-m', Math.round(m));
          wrap.setAttribute('data-prog', prog.toFixed(3));
          wrap.setAttribute('data-palm', Math.round(palmX) + ',' + Math.round(palmY));
          wrap.setAttribute('data-state', state);
          wrap.setAttribute('data-hold', holding ? '1' : '0');
        }
      });
    }
  });
})();
