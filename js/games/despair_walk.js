/*
 * 小游戏 despair_walk —— 第九章·“心”字墓室之二：沮丧墓道（卧钩）。
 * 画面：canvas 实时绘制的伪 3D 弯曲大理石墓道（先直、再向左缓弯、末端急折、尽头拱门），卫不回走在前面。
 * 玩法：底部节拍轨约 80 BPM，脚印滑进金圈时按 空格/回车/↑ 或点击屏幕 迈一步（±180ms，简单 ±260ms）。
 *   踩准 → 前进一步、沮丧值下降、颜色回来一点；
 *   漏拍 / 踩空（按得太早太晚）/ 乱按 → 沮丧值上升：画面变灰变暗、节奏拖慢、卫不回越走越远、浮现暗示字样；
 *   距上一次有效迈步超过 2 秒（简单 3 秒）→ 地面机关“咔” → 'lose'；走满 24 步穿过拱门 → 'win'。
 * 只调用 GF.games.register；自带样式类名前缀 gfg-despair_walk-。
 */
(function () {
  'use strict';
  var GF = window.GF;
  if (!GF || !GF.games) return;

  var ID = 'despair_walk', PX = 'gfg-despair_walk-';
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';

  /* ---------------- 常量 ---------------- */
  var STEPS = 24, BEAT = 750, STEP_LEN = 2.2, S0 = 0.6;
  var S_ARCH = S0 + STEPS * STEP_LEN + 2.6;          // 拱门所在的路程（米）
  var HW = 1.6, WALL_H = 3.4, CAM_H = 1.6;           // 墓道半宽、墙高、视高
  var F = 740, CX = 800, HOR = 395;                  // 焦距、视心
  var SEG = 1.1, VIEW = 26;                          // 地砖长度、可视距离
  var LEAD = 1800, SPEED = 0.45, HIT_X = 450;        // 节拍轨：提前量、像素/毫秒、金圈位置
  var TRACK_X0 = 300, TRACK_X1 = 1300, TRACK_Y = 812, TRACK_H = 76;

  /* ---------------- 墓道中线（俯视，x 东 y 北，th 为从正北顺时针的朝向） ---------------- */
  var DS = 0.05, SMAX = 64, PXA = [], PYA = [], PTA = [];
  function kappa(s) { return s < 6 ? 0 : s < 40 ? -0.045 : s < 47 ? -0.17 : 0; }  // 负 = 向左拐
  (function () {
    var x = 0, y = 0, th = Math.PI;                  // 出发时朝正南，向左拐成卧钩
    for (var i = 0; i * DS <= SMAX + DS; i++) {
      PXA.push(x); PYA.push(y); PTA.push(th);
      th += kappa(i * DS) * DS;
      x += Math.sin(th) * DS; y += Math.cos(th) * DS;
    }
  })();
  function pathAt(s, o) {
    o = o || {};
    var f = Math.max(0, Math.min(SMAX, s)) / DS, i = Math.floor(f), t = f - i;
    if (i >= PXA.length - 1) { i = PXA.length - 2; t = 1; }
    o.x = PXA[i] + (PXA[i + 1] - PXA[i]) * t;
    o.y = PYA[i] + (PYA[i + 1] - PYA[i]) * t;
    o.th = PTA[i] + (PTA[i + 1] - PTA[i]) * t;
    return o;
  }

  /* ---------------- 小工具 ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hash(n) { var r = rng(n * 2654435761 + 7); r(); return r(); }

  /* 墙上的暗示符：每块墙板两枚，按编号固定生成（缓存） */
  var glyphCache = {};
  function makeGlyph(r) {
    var strokes = [], n = 3 + Math.floor(r() * 3);
    for (var i = 0; i < n; i++) {
      var gx = Math.floor(r() * 3), gy = Math.floor(r() * 3), pts = [[(gx - 1) * 0.42, (gy - 1) * 0.46]];
      var m = 1 + Math.floor(r() * 2);
      for (var j = 0; j < m; j++) {
        gx = clamp(gx + (r() < 0.5 ? -1 : 1) * (r() < 0.7 ? 1 : 0), 0, 2);
        gy = clamp(gy + (r() < 0.5 ? -1 : 1), 0, 2);
        pts.push([(gx - 1) * 0.42, (gy - 1) * 0.46]);
      }
      strokes.push(pts);
    }
    if (r() < 0.4) {                                 // 偶尔带一个小圈
      var c = [], cx = (r() - 0.5) * 0.4, cy = (r() - 0.5) * 0.4;
      for (var a = 0; a <= 6; a++) c.push([cx + Math.cos(a / 6 * Math.PI * 2) * 0.16, cy + Math.sin(a / 6 * Math.PI * 2) * 0.16]);
      strokes.push(c);
    }
    return strokes;
  }
  function glyphs(key) {
    if (glyphCache[key]) return glyphCache[key];
    var r = rng(key * 7919 + 13), out = [];
    var cols = r() < 0.55 ? [0.5] : [0.3, 0.7];     // 一列或两列，像竖排的符箓
    for (var c = 0; c < cols.length; c++) {
      for (var k = 0; k < 3; k++) {
        out.push({ u: cols[c] + (r() - 0.5) * 0.04, v: 2.15 - k * 0.5 + (r() - 0.5) * 0.06, sz: 0.2 + r() * 0.06, strokes: makeGlyph(r) });
      }
    }
    glyphCache[key] = out;
    return out;
  }

  /* 地上的旧血迹（路程 s、横向 u、半径 r、拉长 k） */
  var STAINS = [[4.4, 0.25, 0.32, 1.6], [9.8, -0.35, 0.22, 1], [15.3, 0.1, 0.42, 2.2], [21.6, -0.2, 0.3, 1.4],
    [27.9, 0.3, 0.26, 1], [33.4, -0.05, 0.45, 2.6], [39.2, 0.2, 0.28, 1.2], [44.8, -0.3, 0.36, 1.8], [50.6, 0.05, 0.3, 1.5]];

  /* 灯：墙上的连珠小灯盏，两侧交替；拱门两侧各一盏；拱门里透出的红光 */
  var LAMPS = [];
  (function () {
    var p = {};
    for (var k = 0, s = 2.4; s < S_ARCH - 2; k++, s += 4.4) {
      pathAt(s, p);
      var side = (k % 2) ? 1 : -1, rx = Math.cos(p.th), ry = -Math.sin(p.th);
      LAMPS.push({ s: s, x: p.x + rx * side * (HW - 0.12), y: p.y + ry * side * (HW - 0.12), h: 2.1, i: 1.45, c: [1, 0.7, 0.4], k: k, draw: true, fl: 1 });
    }
    pathAt(S_ARCH, p);
    var ax = Math.cos(p.th), ay = -Math.sin(p.th), tx = Math.sin(p.th), ty = Math.cos(p.th);
    [-1, 1].forEach(function (sd, n) {
      LAMPS.push({ s: S_ARCH - 0.15, x: p.x + ax * sd * 1.08 - tx * 0.15, y: p.y + ay * sd * 1.08 - ty * 0.15, h: 2.05, i: 1.25, c: [1, 0.7, 0.4], k: 40 + n, draw: true, fl: 1 });
    });
    LAMPS.push({ s: S_ARCH + 0.5, x: p.x + tx * 0.5, y: p.y + ty * 0.5, h: 1.1, i: 1.9, c: [1, 0.26, 0.14], k: 60, draw: false, fl: 1 });
  })();

  var WHISPERS = ['为什么要走下去呢……', '停一下吧，就一下', '反正走不到头的', '卫先已经死了', '钟老也死了',
    '没有用的', '你累了', '蹲下来，歇一歇', '谁也救不了谁', '回去吧……回不去了', '走到头又能怎样'];

  /* 卫不回剪影（背影，瘦小、微驼、一身黑，右侧暗红轮廓光）——角色生成器缺失时的兜底 */
  function fallbackWeiSvg() {
    var body = 'M205 150c-26 0-40 22-40 48 0 20 9 36 22 43l-2 22c-30 6-52 14-62 26-10 12-14 40-18 78l-12 150c-2 22 4 30 14 30l10-2 6-128 8 0 4 96c-2 20-4 44-4 70l-2 250c0 14-8 22-8 34 0 10 8 12 30 12s30-4 30-14l-4-30 8-230 8 0 8 230-4 30c0 10 8 14 30 14s30-2 30-12c0-12-8-20-8-34l-2-250c0-26-2-50-4-70l4-96 8 0 6 128 10 2c10 0 16-8 14-30l-12-150c-4-38-8-66-18-78-10-12-32-20-62-26l-2-22c13-7 22-23 22-43 0-26-14-48-40-48z';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="900" viewBox="0 0 400 900">' +
      '<defs><filter id="' + PX + 'rim" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>' +
      '<g transform="translate(4 0)"><path d="' + body + '" fill="#b5483c" opacity=".8" filter="url(#' + PX + 'rim)"/></g>' +
      '<g transform="translate(3 0)"><path d="' + body + '" fill="#d0604f"/></g>' +
      '<path d="' + body + '" fill="#121217"/>' +
      '<path d="M170 300c20 10 44 12 70 6" stroke="#1d1d24" stroke-width="3" fill="none"/></svg>';
  }
  function sizedSvg(svg, w, h) {
    var m = /<svg\b[^>]*>/i.exec(svg);
    if (!m) return null;
    var tag = m[0].replace(/\s(width|height)="[^"]*"/gi, '');
    if (!/xmlns=/.test(tag)) tag = tag.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    tag = tag.replace(/<svg/i, '<svg width="' + w + '" height="' + h + '"');
    return svg.replace(m[0], tag);
  }
  function svgToCanvas(svg, w, h, cb) {
    var s = sizedSvg(svg, w, h);
    if (!s) { cb(null); return; }
    var img = new Image(), fired = false;
    img.onload = function () {
      if (fired) return; fired = true;
      try {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        cb(c);
      } catch (e) { cb(null); }
    };
    img.onerror = function () { if (!fired) { fired = true; cb(null); } };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  var CSS = [
    '.' + PX + 'root{background:#040505;font-family:' + FONT + ';cursor:pointer}',
    '.' + PX + 'root canvas{position:absolute;left:0;top:0;width:1600px;height:900px}',
    '.' + PX + 'root .gf-game-caption{bottom:190px}',
    '.' + PX + 'playing .gf-game-caption{pointer-events:none}',
    '.' + PX + 'tip{position:absolute;left:50%;top:20px;transform:translateX(-50%);padding:8px 26px 10px;text-align:center;white-space:nowrap;',
    'font:26px/1.55 ' + FONT + ';color:#efe6d2;background:rgba(6,6,8,.62);border:1px solid rgba(224,181,106,.32);border-radius:6px;',
    'letter-spacing:.04em;text-shadow:0 1px 3px #000;transition:opacity .6s;z-index:20;pointer-events:none}',
    '.' + PX + 'tip b{color:#e0b56a;font-weight:normal}',
    '.' + PX + 'tip .' + PX + 'sub{color:#b9b09c}',
    '.' + PX + 'kbd{display:inline-block;padding:0 10px;margin:0 4px;border:1px solid rgba(224,181,106,.7);border-radius:4px;color:#e0b56a;line-height:1.3;box-shadow:inset 0 -2px 0 rgba(224,181,106,.25)}',
    '.' + PX + 'intro{position:absolute;left:0;top:0;width:1600px;height:900px;transition:opacity 1.3s ease;z-index:30;pointer-events:none}',
    '.' + PX + 'intro svg{width:100%;height:100%;display:block}',
    '.' + PX + 'photo{background:#040505;overflow:hidden}',
    '.' + PX + 'photo img{display:block;width:100%;height:100%;object-fit:cover;transform:scaleX(-1) scale(1.02);transition:transform 5s ease-out;filter:saturate(.75) brightness(.85)}',
    '.' + PX + 'photo.push img{transform:scaleX(-1) scale(1.12)}',
    '.' + PX + 'photo::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 70% 65% at 50% 50%,rgba(0,0,0,0) 40%,rgba(0,0,0,.7) 100%)}',
    '.' + PX + 'wlayer{position:absolute;left:0;top:0;width:1600px;height:900px;pointer-events:none;z-index:15;overflow:hidden}',
    '.' + PX + 'whisper{position:absolute;white-space:nowrap;color:#c9c5bb;opacity:0;letter-spacing:.18em;',
    'text-shadow:0 0 14px rgba(0,0,0,.95),0 0 3px rgba(210,205,195,.35);animation:' + PX + 'wh 3.4s ease-in-out forwards}',
    '@keyframes ' + PX + 'wh{0%{opacity:0;filter:blur(6px);transform:translateX(0) scale(.96)}',
    '30%{opacity:.78;filter:blur(.6px)}70%{opacity:.6;filter:blur(1px)}',
    '100%{opacity:0;filter:blur(8px);transform:translateX(-46px) scale(1.04);letter-spacing:.34em}}',
    '.' + PX + 'end{position:absolute;left:0;top:0;width:1600px;height:900px;display:flex;align-items:center;justify-content:center;',
    'flex-direction:column;z-index:60;pointer-events:none;opacity:0;transition:opacity .35s}',
    '.' + PX + 'end.on{opacity:1}',
    '.' + PX + 'end .t1{font:96px/1.2 ' + FONT + ';letter-spacing:.3em;text-shadow:0 0 30px rgba(0,0,0,.9)}',
    '.' + PX + 'end .t2{margin-top:18px;font:34px/1.4 ' + FONT + ';color:#efe6d2;letter-spacing:.12em;text-shadow:0 2px 12px #000}'
  ].join('');

  GF.games.register(ID, {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, easy = !!ctx.easy, audio = ctx.audio || {};
        var W = easy ? 260 : 180, BAD_W = W + 170, STALL = easy ? 3000 : 2000;
        var done = false, raf = 0, timers = [];

        /* ---------- 音频（模块可能是空实现） ---------- */
        function sfx(id) { try { if (audio.sfx) audio.sfx(id); } catch (e) { /* 静默 */ } }
        var hbNow = -1;
        function heartbeat(bpm) { if (Math.abs(bpm - hbNow) < 5 && bpm !== 0) return; hbNow = bpm; try { if (audio.heartbeat) audio.heartbeat(bpm); } catch (e) { /* 静默 */ } }
        function later(fn, ms) { var id = setTimeout(function () { if (!done) fn(); }, ms); timers.push(id); return id; }
        function say(text, who) { try { var p = ctx.say(text, who); return p && p.then ? p : Promise.resolve(); } catch (e) { return Promise.resolve(); } }

        /* ---------- 时间（切到后台再回来时把停掉的时间扣掉，免得一回来就判负） ---------- */
        // 只有页面被切到后台（visibilitychange）才把那段时间“冻结”，免得一回来就判负。
        // 前台的卡顿（哪怕掉帧一两秒）不冻结：冻结会让整条节拍时间线后移，玩家凭节奏按下的下一拍就提前了
        // 几百毫秒，被判“乱了/踩空”。输入的判定用事件自己的时间戳（evtNow），卡顿时排队的按键也按真正按下的时刻判。
        var offset = 0, lastRaw = performance.now(), hiddenAt = document.hidden ? lastRaw : -1;
        function gnow() { return performance.now() - offset; }
        function onVis() {
          var raw = performance.now();
          if (document.hidden) { if (hiddenAt < 0) hiddenAt = raw; }
          else if (hiddenAt >= 0) { offset += raw - hiddenAt; hiddenAt = -1; lastRaw = raw; }
        }
        document.addEventListener('visibilitychange', onVis);
        function evtNow(e) {
          var raw = performance.now(), ts = e && e.timeStamp;
          if (ts > 0 && ts <= raw + 5 && raw - ts < 1000 && ts >= lastRaw - 20) return ts - offset;
          return raw - offset;
        }

        /* ---------- DOM ---------- */
        root.classList.add(PX + 'root');
        var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style);
        var cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; root.appendChild(cv);
        var RS = 1;   // 墓道画布的内部分辨率倍率：机器太慢（每帧绘制 >16ms）时自动降到 0.75，CSS 尺寸不变，HUD 仍是全分辨率
        var hud = document.createElement('canvas'); hud.width = 1600; hud.height = 900; root.appendChild(hud);
        var g = cv.getContext('2d'), h = hud.getContext('2d');
        var wlayer = document.createElement('div'); wlayer.className = PX + 'wlayer'; root.appendChild(wlayer);
        var tip = document.createElement('div'); tip.className = PX + 'tip';
        tip.innerHTML = '脚印滑进<b>金圈</b>的一刻，按<span class="' + PX + 'kbd">空格</span>或<b>点击屏幕</b>迈一步<br>' +
          '<span class="' + PX + 'sub">漏拍、乱按会越来越沮丧 · 停步超过 ' + (easy ? '三' : '两') + ' 秒，地面机关就会发动</span>';
        root.appendChild(tip);
        var endEl = document.createElement('div'); endEl.className = PX + 'end'; root.appendChild(endEl);

        // 章节里刚显示过的背景画（AI 插画）：卫不回开口时先盖在上面缓缓推近，开始数拍时再溶进第一人称视角。
        // 插画里的墓道向右拐、游戏里的墓道向左拐，所以把插画水平翻转。缺图时退回矢量底图（只闪 0.5 秒）。
        var intro = null;
        function dropIntro(delay) {
          if (!intro) return;
          var el = intro; intro = null;
          later(function () { el.style.opacity = '0'; }, delay || 0);
          later(function () { if (el.parentNode) el.remove(); }, (delay || 0) + 1500);
        }
        var photo = '';
        try { photo = (ctx.bgImage && ctx.bgImage('heart_despair')) || ''; } catch (e) { photo = ''; }
        if (photo) {
          intro = document.createElement('div'); intro.className = PX + 'intro ' + PX + 'photo';
          var introImg = document.createElement('img'); introImg.alt = ''; introImg.draggable = false;
          introImg.onerror = function () {   // 插画加载失败：换成矢量底图，仍在开始数拍时溶掉
            if (done || !intro) return;
            var sv = '';
            try { sv = ctx.bgSvg('heart_despair') || ''; } catch (e) { sv = ''; }
            if (/<svg/i.test(sv)) { intro.className = PX + 'intro'; intro.innerHTML = sv; } else dropIntro(0);
          };
          introImg.src = photo;
          intro.appendChild(introImg); root.appendChild(intro);
          later(function () { if (intro) intro.classList.add('push'); }, 30);
        } else {
          var bgSvg = '';
          try { bgSvg = ctx.bgSvg('heart_despair') || ''; } catch (e) { bgSvg = ''; }
          if (bgSvg && /<svg/i.test(bgSvg)) {
            intro = document.createElement('div'); intro.className = PX + 'intro'; intro.innerHTML = bgSvg; root.appendChild(intro);
            dropIntro(500);
          }
        }

        // 卫不回剪影：优先用角色生成器，失败则用兜底
        // 角色生成器首次调用要几百毫秒：放到开场字幕期间异步生成，别卡住开局第一帧（开场时卫不回还在画外）
        var weiImg = null;
        function loadFallbackWei() { svgToCanvas(fallbackWeiSvg(), 200, 450, function (c) { if (!done) weiImg = c; }); }
        later(function () {
          var weiSvg = '';
          try { if (GF.art && typeof GF.art.char === 'function') weiSvg = GF.art.char('zhangqing', { outfit: 'black' }) || ''; } catch (e) { weiSvg = ''; }
          if (typeof weiSvg === 'string' && /<svg/i.test(weiSvg)) svgToCanvas(weiSvg, 200, 450, function (c) { if (done) return; if (c) weiImg = c; else loadFallbackWei(); });
          else loadFallbackWei();
        }, 120);

        /* ---------- 状态 ---------- */
        var st = {
          phase: 'intro', steps: 0, d: 0.22, dv: 0.22,
          sCam: S0, stepFrom: S0, stepTo: S0, stepT0: -1e9, stepSide: 1,
          weiS: S0 + 4.2, weiBeatT: -1e9, weiSide: 1, weiAlpha: 1,
          camDrop: 0, shake: 0, shakeT: -1e9, stumbleUntil: 0,
          beats: [], lastSched: 0, firstRealT: 1e12, lastStepBeatT: 1e12, beatIdx: 0,
          ringPulse: -1e9, pops: [], bursts: [], countText: null, warn: 0, warnSaid: -1e9,
          lastWhisper: -1e9, lastWhisperSfx: -1e9, missCount: 0, saidFirstMiss: false,
          endT: 0, flash: 0, fade: 0, arrows: [], cost: 0, _slow: 0, fdt: 16
        };
        var said = {};

        /* ---------- 粒子（相机空间的浮尘） ---------- */
        var DUST = [], dr = rng(99);
        for (var i = 0; i < 70; i++) DUST.push({ x: (dr() - 0.5) * 3, h: 0.2 + dr() * 3, z: 0.6 + dr() * 9, v: dr() });

        /* ---------- 节拍 ---------- */
        function scheduleUntil(now) {
          while (st.lastSched < now + LEAD + 200) {
            var real = st.beatIdx >= 3;
            var iv = real && st.beatIdx > 3 ? BEAT * (1 + 0.15 * st.d) : BEAT;
            var t = st.lastSched + (st.beatIdx === 0 ? 0 : iv);
            var b = { t: t, real: real, state: 0, sounded: false, idx: st.beatIdx, label: real ? '' : String(3 - st.beatIdx), first: st.beatIdx === 3 };
            if (b.first) { st.firstRealT = t; st.lastStepBeatT = t - BEAT; }
            st.beats.push(b); st.lastSched = t; st.beatIdx++;
          }
        }
        function beginCount() {
          if (done) return;
          st.phase = 'play';
          root.classList.add(PX + 'playing');
          dropIntro(0);
          var now = gnow();
          st.lastSched = now + 1500;               // 第一个“预备”拍在 1.5 秒后落进金圈
          scheduleUntil(now);
          heartbeat(66);
          later(function () { say('他的脚步声落在哪里，我的脚就落在哪里。'); }, 900);
        }

        function pop(text, color, size) { st.pops.push({ text: text, color: color, size: size || 34, t0: gnow() }); }
        function addD(v) { st.d = clamp(st.d + v, 0, 1); }

        function spawnWhisper(force) {
          var now = gnow();
          if (!force && now - st.lastWhisper < 900) return;
          st.lastWhisper = now;
          var el = document.createElement('div'); el.className = PX + 'whisper';
          el.textContent = WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
          var size = Math.round(30 + st.d * 18 + Math.random() * 6);
          el.style.fontSize = size + 'px';
          var x = 140 + Math.random() * 1000, y = 170 + Math.random() * 380;
          if (x > 520 && x < 900 && y > 280) x += 420;   // 尽量别压在卫不回身上
          el.style.left = x + 'px'; el.style.top = y + 'px';
          wlayer.appendChild(el);
          later(function () { if (el.parentNode) el.remove(); }, 3500);
          if (now - st.lastWhisperSfx > 2600) { st.lastWhisperSfx = now; sfx('whisper'); }
        }

        function onBeat(b, now) {
          sfx('footsteps');
          st.weiBeatT = now; st.weiSide = -st.weiSide; st.ringPulse = now;
          if (!b.real) st.countText = { text: b.label, t0: now };
          else if (b.first) st.countText = { text: '走', t0: now };
        }
        function hit(b, dt, now) {
          b.state = 1; st.steps++;
          st.lastStepBeatT = b.t;
          var perfect = Math.abs(dt) <= W * 0.45;
          addD(-(perfect ? 0.1 : 0.07) * (easy ? 1.3 : 1));
          sfx('tap');
          st.stepFrom = st.sCam; st.stepTo = S0 + st.steps * STEP_LEN; st.stepT0 = now; st.stepSide = -st.stepSide;
          st.bursts.push({ t0: now, good: true, perfect: perfect });
          pop(perfect ? '稳' : '好', perfect ? '#e0b56a' : '#efe6d2', perfect ? 40 : 34);
          milestone(st.steps);
          if (st.steps >= STEPS) winSeq(now);
        }
        function miss(now) {
          st.missCount++;
          addD(0.13 * (easy ? 0.7 : 1));
          pop('漏拍', '#8e8a82', 32);
          spawnWhisper(true);
          if (!st.saidFirstMiss) { st.saidFirstMiss = true; say('跟上！别去看墙上的东西。', 'zhangqing'); }
        }
        function badStep(now) {
          addD(0.11 * (easy ? 0.7 : 1));
          pop('踩空', '#c0655a', 34);
          sfx('thud');
          st.stumbleUntil = now + 150; st.shake = 6; st.shakeT = now;
          st.bursts.push({ t0: now, good: false });
          spawnWhisper(false);
        }
        function ghost(now) {
          addD(0.07 * (easy ? 0.7 : 1));
          pop('乱了', '#9b948a', 32);
          sfx('thud');
          st.stumbleUntil = now + 220; st.shake = 5; st.shakeT = now;
          if (Math.random() < 0.5) spawnWhisper(false);
        }
        function milestone(n) {
          var lines = {
            7: ['两条腿越来越沉，像有什么东西在往下拽。'],
            13: ['这条道一直在往左拐，拐了又拐，看不到头。'],
            18: ['前面猛地一折——', 'zhangqing'],
            22: ['拱门！就在前头了。']
          };
          if (lines[n] && !said[n]) { said[n] = true; say(lines[n][0], lines[n][1]); }
        }

        function press(e) {
          if (done) return;
          var now = evtNow(e);
          if (st.phase === 'intro') { skipCaption(); return; }
          if (st.phase !== 'play') return;
          var best = null, bd = 1e9;
          for (var i = 0; i < st.beats.length; i++) {
            var b = st.beats[i];
            if (!b.real || b.state !== 0) continue;
            var dd = Math.abs(now - b.t);
            if (dd < bd) { bd = dd; best = b; }
          }
          // 绊了一下还没站稳：这时贴着拍子按也算踩空（原先直接忽略——乱按时“乱了”的硬直恰好跳过踩空区，
          // 下一下常常正落在判定窗里，于是狂按空格也能一路走下去）
          if (now < st.stumbleUntil) { if (best && bd <= BAD_W) { best.state = 3; badStep(now); } return; }
          if (best && bd <= W) hit(best, now - best.t, now);
          else if (best && bd <= BAD_W) { best.state = 3; badStep(now); }
          else if (now < st.firstRealT - BAD_W) { /* 预备拍期间的空按，不罚 */ }
          else ghost(now);
        }
        function skipCaption() {
          var c = root.querySelector('.gf-game-caption');
          if (c) { try { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } catch (e) { /* 旧浏览器 */ } }
        }

        /* ---------- 结束演出 ---------- */
        function showEnd(t1, color, t2) {
          wlayer.style.transition = 'opacity .35s'; wlayer.style.opacity = '0';   // 暗示字退场，别压住结局字
          endEl.innerHTML = '<div class="t1" style="color:' + color + '">' + t1 + '</div>' + (t2 ? '<div class="t2">' + t2 + '</div>' : '');
          endEl.classList.add('on');
        }
        function winSeq(now) {
          st.phase = 'win'; st.endT = now;
          root.classList.remove(PX + 'playing');
          tip.style.opacity = '0';
          heartbeat(0);
          later(function () { sfx('gust'); showEnd('', '#e0b56a', '一步也没停——我穿过了拱门。'); }, 350);
          later(function () { finish('win'); }, 1450);
        }
        function trapSeq(now) {
          st.phase = 'trap'; st.endT = now;
          root.classList.remove(PX + 'playing');
          tip.style.opacity = '0';
          sfx('stone');
          st.shake = 16; st.shakeT = now;
          showEnd('咔。', '#d9d2c3');
          later(function () {
            sfx('arrows'); st.flash = 1;
            for (var i = 0; i < 26; i++) {
              var left = i % 2 === 0;
              st.arrows.push({ x0: left ? -60 : 1660, y0: 120 + Math.random() * 520, x1: 560 + Math.random() * 480, y1: 300 + Math.random() * 360, d: Math.random() * 260, t0: gnow() });
            }
            showEnd('', '#fff', '只停了一下。');
          }, 380);
          later(function () { heartbeat(0); finish('lose'); }, 1450);
        }

        /* ---------- 输入 ---------- */
        var KEYS = { Space: 1, Enter: 1, NumpadEnter: 1, ArrowUp: 1, KeyW: 1, KeyJ: 1, KeyF: 1 };
        function onKey(e) {
          if (done) return;
          var k = e.code || (e.key === ' ' ? 'Space' : e.key);
          if (!KEYS[k]) return;
          e.preventDefault();
          if (e.repeat) return;
          press(e);
        }
        function onPointer(e) {
          if (done) return;
          if (e.button != null && e.button > 0) return;
          press(e);
        }
        window.addEventListener('keydown', onKey);
        root.addEventListener('pointerdown', onPointer);

        function cleanup() {
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout); timers = [];
          window.removeEventListener('keydown', onKey);
          root.removeEventListener('pointerdown', onPointer);
          document.removeEventListener('visibilitychange', onVis);
          heartbeat(0);
        }
        function finish(r) {
          if (done) return;
          done = true; st.phase = 'done';
          cleanup();
          resolve(r);
        }
        if (easy || (ctx.failCount || 0) >= 2) ctx.skipBtn(function () { finish('win'); });

        // 自动化测试用的只读窥视口（挂在本游戏的根节点上，不污染全局）
        root.__gfgState = {
          get phase() { return st.phase; }, get steps() { return st.steps; }, get despair() { return st.d; }, get cost() { return st.cost; },
          nextBeatIn: function () {
            var now = gnow(), best = null;
            for (var i = 0; i < st.beats.length; i++) {
              var b = st.beats[i];
              if (b.real && b.state === 0 && b.t > now - W * 0.5 && (!best || b.t < best.t)) best = b;
            }
            return best ? best.t - now : null;
          }
        };

        /* =============================== 绘制：墓道 =============================== */
        var TA = [174, 166, 148], TB = [150, 143, 128], WALL = [72, 88, 82], BASE = [44, 52, 50], CEIL = [34, 37, 36], GLY = [44, 16, 12];
        var AMB = [0.075, 0.085, 0.09];
        var SAT = 1, BRIGHT = 1, FOGD = 14;
        var L = [0, 0, 0];
        var cam = {}, camX = 0, camY = 0, camH = CAM_H, tcx = 0, tcy = 1, rcx = 1, rcy = 0;
        var tmpP = {}, tmpQ = {};

        function toCam(wx, wy, o) { var dx = wx - camX, dy = wy - camY; o.x = dx * rcx + dy * rcy; o.z = dx * tcx + dy * tcy; return o; }
        function sx(x, z) { return CX + F * x / z; }
        function sy(hh, z) { return HOR + F * (camH - hh) / z; }
        function light(wx, wy, hh, s) {
          L[0] = AMB[0]; L[1] = AMB[1]; L[2] = AMB[2];
          for (var i = 0; i < LAMPS.length; i++) {
            var lp = LAMPS[i];
            if (Math.abs(lp.s - s) > 10) continue;
            var dx = lp.x - wx, dy = lp.y - wy, dh = lp.h - hh;
            var I = lp.i * lp.fl / (1 + (dx * dx + dy * dy + dh * dh) * 0.42);
            L[0] += I * lp.c[0]; L[1] += I * lp.c[1]; L[2] += I * lp.c[2];
          }
          return L;
        }
        function fogAt(z) { return Math.exp(-z / FOGD) * clamp((VIEW - z) / 5, 0, 1); }
        function shade(base, Lr, fog, mul, alpha) {
          var k = fog * BRIGHT * (mul || 1);
          var r = base[0] * Lr[0] * k, gg = base[1] * Lr[1] * k, b = base[2] * Lr[2] * k;
          var gr = r * 0.3 + gg * 0.59 + b * 0.11;
          r = gr + (r - gr) * SAT; gg = gr + (gg - gr) * SAT; b = gr + (b - gr) * SAT;
          r = r > 255 ? 255 : r | 0; gg = gg > 255 ? 255 : gg | 0; b = b > 255 ? 255 : b | 0;
          return alpha == null ? 'rgb(' + r + ',' + gg + ',' + b + ')' : 'rgba(' + r + ',' + gg + ',' + b + ',' + alpha + ')';
        }
        function quad(ax, ay, bx, by, cx2, cy2, dx, dy) {
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx2, cy2); g.lineTo(dx, dy); g.closePath();
        }
        var US = [-HW, -HW / 2, 0, HW / 2, HW];
        function makeSample(s) {
          var p = pathAt(s, {}), rx = Math.cos(p.th), ry = -Math.sin(p.th), pts = [];
          for (var k = 0; k < 5; k++) pts.push(toCam(p.x + rx * US[k], p.y + ry * US[k], {}));
          return { s: s, x: p.x, y: p.y, rx: rx, ry: ry, pts: pts };
        }
        // 取墙面上的一点（路程 s、哪一侧、离地高度）
        function wallPoint(s, side, o) {
          pathAt(s, tmpP);
          var rx = Math.cos(tmpP.th), ry = -Math.sin(tmpP.th), u = side * HW;
          return toCam(tmpP.x + rx * u, tmpP.y + ry * u, o);
        }

        function drawSegment(A, B) {
          var zA = A.pts[2].z, zB = B.pts[2].z;
          for (var k = 0; k < 5; k++) if (A.pts[k].z < 0.06 || B.pts[k].z < 0.06) return;
          var zm = (zA + zB) / 2, fog = fogAt(zm);
          if (fog <= 0.004) return;
          var sm = (A.s + B.s) / 2, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, rx = (A.rx + B.rx) / 2, ry = (A.ry + B.ry) / 2;
          var segI = Math.floor(sm / SEG);
          var a0 = A.pts[0], a4 = A.pts[4], b0 = B.pts[0], b4 = B.pts[4];
          // 顶
          light(mx, my, WALL_H, sm);
          g.fillStyle = shade(CEIL, L, fog, 0.8);
          quad(sx(a0.x, a0.z), sy(WALL_H, a0.z), sx(a4.x, a4.z), sy(WALL_H, a4.z), sx(b4.x, b4.z), sy(WALL_H, b4.z), sx(b0.x, b0.z), sy(WALL_H, b0.z));
          g.fill();
          // 顶上的石梁：每两块地砖一道
          if (Math.abs(A.s / SEG - Math.round(A.s / SEG)) < 0.01 && (Math.round(A.s / SEG) & 1) === 0) {
            g.strokeStyle = shade([120, 112, 96], L, fog, 1);
            g.lineWidth = Math.max(1, F * 0.07 / zA);
            g.beginPath(); g.moveTo(sx(a0.x, a0.z), sy(WALL_H - 0.02, a0.z)); g.lineTo(sx(a4.x, a4.z), sy(WALL_H - 0.02, a4.z)); g.stroke();
          }
          // 两侧墙
          for (var side = -1; side <= 1; side += 2) {
            var pa = side < 0 ? a0 : a4, pb = side < 0 ? b0 : b4;
            var wx = mx + rx * side * HW, wy = my + ry * side * HW;
            light(wx, wy, 1.7, sm);
            var var1 = 0.9 + hash(segI * 2 + (side > 0 ? 1 : 0)) * 0.2;
            g.fillStyle = shade(WALL, L, fog, var1);
            quad(sx(pa.x, pa.z), sy(0, pa.z), sx(pa.x, pa.z), sy(WALL_H, pa.z), sx(pb.x, pb.z), sy(WALL_H, pb.z), sx(pb.x, pb.z), sy(0, pb.z));
            g.fill();
            light(wx, wy, 0.2, sm);
            g.fillStyle = shade(BASE, L, fog, 1);
            quad(sx(pa.x, pa.z), sy(0, pa.z), sx(pa.x, pa.z), sy(0.3, pa.z), sx(pb.x, pb.z), sy(0.3, pb.z), sx(pb.x, pb.z), sy(0, pb.z));
            g.fill();
            // 墙板缝、檐线
            g.strokeStyle = 'rgba(8,10,10,' + (0.55 * fog).toFixed(3) + ')';
            g.lineWidth = Math.max(0.6, F * 0.012 / pa.z);
            g.beginPath();
            if (Math.abs(A.s / SEG - Math.round(A.s / SEG)) < 0.01) { g.moveTo(sx(pa.x, pa.z), sy(0, pa.z)); g.lineTo(sx(pa.x, pa.z), sy(WALL_H, pa.z)); }
            g.moveTo(sx(pa.x, pa.z), sy(2.95, pa.z)); g.lineTo(sx(pb.x, pb.z), sy(2.95, pb.z));
            g.stroke();
          }
          // 地砖
          for (var k2 = 0; k2 < 4; k2++) {
            var p1 = A.pts[k2], p2 = A.pts[k2 + 1], p3 = B.pts[k2 + 1], p4 = B.pts[k2];
            var uc = (US[k2] + US[k2 + 1]) / 2;
            light(mx + rx * uc, my + ry * uc, 0, sm);
            var base = ((segI + k2) & 1) ? TA : TB;
            g.fillStyle = shade(base, L, fog, 0.92 + hash(segI * 5 + k2) * 0.16);
            quad(sx(p1.x, p1.z), sy(0, p1.z), sx(p2.x, p2.z), sy(0, p2.z), sx(p3.x, p3.z), sy(0, p3.z), sx(p4.x, p4.z), sy(0, p4.z));
            g.fill();
            g.strokeStyle = 'rgba(20,18,15,' + (0.5 * fog).toFixed(3) + ')';
            g.lineWidth = Math.max(0.5, F * 0.01 / zm);
            g.stroke();
            // 大理石纹
            if (zm < 13) {
              var hv = hash(segI * 11 + k2 * 3);
              if (hv < 0.7) {
                var t1 = hash(segI * 13 + k2), t2 = hash(segI * 17 + k2);
                var ax = lerp(p1.x, p2.x, t1), az = lerp(p1.z, p2.z, t1), bx = lerp(p4.x, p3.x, t2), bz = lerp(p4.z, p3.z, t2);
                g.strokeStyle = shade([230, 225, 210], L, fog, 0.55, 0.35);
                g.lineWidth = Math.max(0.5, F * 0.008 / zm);
                g.beginPath(); g.moveTo(sx(ax, az), sy(0, az));
                g.quadraticCurveTo(sx(lerp(ax, bx, 0.5) + 0.12, (az + bz) / 2), sy(0, (az + bz) / 2), sx(bx, bz), sy(0, bz));
                g.stroke();
              }
            }
          }
          // 血迹
          for (var si = 0; si < STAINS.length; si++) {
            var sd = STAINS[si];
            if (sd[0] < Math.min(A.s, B.s) || sd[0] >= Math.max(A.s, B.s)) continue;
            pathAt(sd[0], tmpP);
            var q = toCam(tmpP.x + Math.cos(tmpP.th) * sd[1], tmpP.y - Math.sin(tmpP.th) * sd[1], tmpQ);
            if (q.z < 0.5) continue;
            var ex = sx(q.x, q.z), ey = sy(0, q.z), rr = F * sd[2] / q.z;
            g.fillStyle = shade([92, 18, 12], light(tmpP.x, tmpP.y, 0, sd[0]), fogAt(q.z), 1, 0.62);
            g.beginPath(); g.ellipse(ex, ey, rr, Math.max(1, rr * camH / q.z * sd[3]), 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.ellipse(ex + rr * 0.8, ey + rr * 0.1, rr * 0.35, Math.max(1, rr * 0.35 * camH / q.z), 0, 0, Math.PI * 2); g.fill();
          }
          // 墙上的暗示符
          if (zm < 17) {
            for (var sd2 = -1; sd2 <= 1; sd2 += 2) {
              var gl = glyphs(segI * 2 + (sd2 > 0 ? 1 : 0));
              var s1 = segI * SEG, s2 = s1 + SEG;
              var w1 = wallPoint(s1, sd2, {}), w2 = wallPoint(s2, sd2, {});
              if (w1.z < 0.3 || w2.z < 0.3) continue;
              light(mx + rx * sd2 * HW, my + ry * sd2 * HW, 1.8, sm);
              var breathe = 0.75 + 0.25 * Math.sin(gnow() / 700 + segI) * st.dv;
              var hiCol = shade([200, 190, 170], L, fog, 0.45, (0.4 * breathe).toFixed(3));
              var loCol = shade(GLY, [L[0] * 0.8 + 0.25, L[1] * 0.8 + 0.12, L[2] * 0.8 + 0.1], fog, 1, (0.9 * breathe).toFixed(3));
              for (var pass = 0; pass < 2; pass++) {
                g.strokeStyle = pass ? loCol : hiCol;
                for (var gi = 0; gi < gl.length; gi++) {
                  var G = gl[gi];
                  var gz = lerp(w1.z, w2.z, G.u);
                  var lw = Math.max(0.7, F * 0.016 / gz), off = pass ? 0 : Math.max(0.6, lw * 0.45);
                  g.lineWidth = lw;
                  g.beginPath();
                  for (var sk = 0; sk < G.strokes.length; sk++) {
                    var stp = G.strokes[sk];
                    for (var pi = 0; pi < stp.length; pi++) {
                      var uu = clamp(G.u + stp[pi][0] * G.sz / SEG, 0, 1);
                      var px = lerp(w1.x, w2.x, uu), pz = lerp(w1.z, w2.z, uu), ph = G.v - stp[pi][1] * G.sz * 1.3;
                      if (pi === 0) g.moveTo(sx(px, pz) + off, sy(ph, pz) + off); else g.lineTo(sx(px, pz) + off, sy(ph, pz) + off);
                    }
                  }
                  g.stroke();
                }
              }
            }
          }
          // 灯盏
          for (var li = 0; li < LAMPS.length; li++) {
            var lp = LAMPS[li];
            if (!lp.draw || lp.s < Math.min(A.s, B.s) || lp.s >= Math.max(A.s, B.s)) continue;
            drawLamp(lp);
          }
          // 卫不回
          if (st.weiS >= Math.min(A.s, B.s) && st.weiS < Math.max(A.s, B.s)) drawWei();
        }

        function drawLamp(lp) {
          var q = toCam(lp.x, lp.y, tmpQ);
          if (q.z < 0.3) return;
          var fog = fogAt(q.z), x = sx(q.x, q.z), y = sy(lp.h, q.z), u = F / q.z;
          var glowA = 0.42 * lp.fl * fog * (1 - st.dv * 0.45);
          var gr = g.createRadialGradient(x, y, 0, x, y, u * 1.5);
          gr.addColorStop(0, 'rgba(255,190,110,' + glowA.toFixed(3) + ')');
          gr.addColorStop(0.35, 'rgba(255,140,60,' + (glowA * 0.35).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(255,120,40,0)');
          g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr;
          g.fillRect(x - u * 1.5, y - u * 1.5, u * 3, u * 3); g.restore();
          // 铜盏
          g.fillStyle = shade([150, 104, 50], [0.9, 0.8, 0.7], fog, 1);
          g.beginPath(); g.ellipse(x, y + u * 0.035, u * 0.1, u * 0.036, 0, 0, Math.PI); g.fill();
          g.fillRect(x - u * 0.016, y + u * 0.04, u * 0.032, u * 0.1);
          g.fillRect(x - u * 0.05, y + u * 0.13, u * 0.1, u * 0.018);
          // 火苗
          var fh = u * (0.1 + 0.016 * Math.sin(gnow() / 90 + lp.k * 3)) * lp.fl;
          g.fillStyle = 'rgba(255,170,70,' + (0.95 * fog + 0.05).toFixed(3) + ')';
          g.beginPath(); g.moveTo(x, y - fh); g.quadraticCurveTo(x + u * 0.04, y - fh * 0.15, x, y + u * 0.01); g.quadraticCurveTo(x - u * 0.04, y - fh * 0.15, x, y - fh); g.fill();
          g.fillStyle = 'rgba(255,244,210,' + (0.9 * fog).toFixed(3) + ')';
          g.beginPath(); g.ellipse(x, y - fh * 0.25, u * 0.013, fh * 0.24, 0, 0, Math.PI * 2); g.fill();
        }

        function drawWei() {
          if (!weiImg) return;
          pathAt(st.weiS, tmpP);
          var q = toCam(tmpP.x + Math.cos(tmpP.th) * 0.12, tmpP.y - Math.sin(tmpP.th) * 0.12, tmpQ);
          if (q.z < 0.8) return;
          var fog = fogAt(q.z), now = gnow();
          var bp = clamp((now - st.weiBeatT) / 380, 0, 1);
          var bob = Math.sin(bp * Math.PI) * 0.035;
          var hh = F * 1.9 / q.z, ww = hh * 200 / 450;
          var x = sx(q.x, q.z), y = sy(0, q.z) - F * bob / q.z;
          // 脚下的影子
          g.fillStyle = 'rgba(0,0,0,' + (0.45 * fog).toFixed(3) + ')';
          g.beginPath(); g.ellipse(x, sy(0, q.z), ww * 0.42, ww * 0.08, 0, 0, Math.PI * 2); g.fill();
          g.save();
          g.globalAlpha = clamp(fog * 1.35, 0, 1) * st.weiAlpha * (1 - st.dv * 0.35);
          g.translate(x, y); g.rotate(st.weiSide * 0.018 * Math.sin(bp * Math.PI));
          g.drawImage(weiImg, -ww / 2, -hh, ww, hh);
          g.restore();
        }

        function drawArchWall() {
          var dist = S_ARCH - st.sCam;
          if (dist > VIEW + 0.5 || dist < 0.12) return;
          pathAt(S_ARCH, tmpP);
          var ax = tmpP.x, ay = tmpP.y, rx = Math.cos(tmpP.th), ry = -Math.sin(tmpP.th);
          var pl = toCam(ax - rx * HW, ay - ry * HW, {}), pr = toCam(ax + rx * HW, ay + ry * HW, {});
          if (pl.z < 0.06 || pr.z < 0.06) return;
          var zc = (pl.z + pr.z) / 2, fog = fogAt(zc);
          light(ax, ay, 1.6, S_ARCH - 0.3);
          g.fillStyle = shade(WALL, L, fog, 0.95);
          quad(sx(pl.x, pl.z), sy(0, pl.z), sx(pl.x, pl.z), sy(WALL_H, pl.z), sx(pr.x, pr.z), sy(WALL_H, pr.z), sx(pr.x, pr.z), sy(0, pr.z));
          g.fill();
          // 门洞轮廓
          var outline = [], q = {};
          function add(u, hh) { toCam(ax + rx * u, ay + ry * u, q); outline.push([sx(q.x, q.z), sy(hh, q.z)]); }
          add(-0.66, 0);
          for (var a = 0; a <= 12; a++) { var an = Math.PI - a / 12 * Math.PI; add(Math.cos(an) * 0.66, 1.75 + Math.sin(an) * 0.66); }
          add(0.66, 0);
          // 门框
          g.strokeStyle = shade([150, 146, 132], L, fog, 1);
          g.lineWidth = Math.max(2, F * 0.09 / zc);
          g.beginPath(); outline.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke();
          // 门里透出的暗红光（愤怒的墓室）
          var cxp = (outline[0][0] + outline[outline.length - 1][0]) / 2, byp = outline[0][1], hgt = byp - outline[7][1];
          var gr = g.createRadialGradient(cxp, byp - hgt * 0.2, 0, cxp, byp - hgt * 0.3, hgt * 1.1);
          var pulse = 0.85 + 0.15 * Math.sin(gnow() / 420);
          gr.addColorStop(0, 'rgba(' + Math.round(200 * pulse) + ',64,36,1)');
          gr.addColorStop(0.55, 'rgba(120,26,16,1)');
          gr.addColorStop(1, 'rgba(38,8,6,1)');
          g.fillStyle = gr;
          g.beginPath(); outline.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); g.fill();
          // 门楣四周密密的符
          var gl = glyphs(777);
          g.strokeStyle = shade(GLY, [L[0] + 0.3, L[1] + 0.12, L[2] + 0.1], fog, 1, 0.8);
          g.lineWidth = Math.max(0.8, F * 0.022 / zc);
          for (var gg2 = 0; gg2 < 10; gg2++) {
            var G = gl[gg2 % 2], uu0 = (gg2 < 5 ? -1.3 : 1.3) + (hash(gg2 + 50) - 0.5) * 0.35, vv0 = 0.6 + (gg2 % 5) * 0.52;
            g.beginPath();
            G.strokes.forEach(function (stp) {
              stp.forEach(function (pt, i) {
                toCam(ax + rx * (uu0 + pt[0] * 0.3), ay + ry * (uu0 + pt[0] * 0.3), q);
                var X = sx(q.x, q.z), Y = sy(vv0 - pt[1] * 0.36, q.z);
                if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
              });
            });
            g.stroke();
          }
        }

        function renderScene(now) {
          var dv = st.dv;
          SAT = 1 - 0.88 * dv; BRIGHT = 1 - 0.42 * dv; FOGD = 14 - 6.5 * dv;
          for (var i = 0; i < LAMPS.length; i++) {
            var lp = LAMPS[i];
            lp.fl = 0.86 + 0.08 * Math.sin(now * 0.011 + lp.k * 1.7) + 0.06 * Math.sin(now * 0.029 + lp.k * 5.1);
          }
          pathAt(st.sCam, cam);
          var yaw = 0.012 * Math.sin(now / 2300) * (1 - dv * 0.5);
          var th = cam.th + yaw;
          tcx = Math.sin(th); tcy = Math.cos(th); rcx = Math.cos(th); rcy = -Math.sin(th);
          camX = cam.x; camY = cam.y;
          var sp = clamp((now - st.stepT0) / 330, 0, 1);
          camH = CAM_H - 0.07 * Math.sin(sp * Math.PI) + 0.012 * Math.sin(now / 1100 * (1 - dv * 0.4)) - st.camDrop;
          var roll = st.stepSide * 0.012 * Math.sin(sp * Math.PI) + 0.004 * Math.sin(now / 1500);
          var sh = 0;
          if (st.shake > 0) { var se = (now - st.shakeT) / 380; if (se < 1) sh = st.shake * (1 - se); }

          g.setTransform(RS, 0, 0, RS, 0, 0);
          g.fillStyle = '#030404'; g.fillRect(0, 0, 1600, 900);
          g.save();
          g.translate(800 + (Math.random() - 0.5) * sh, 450 + (Math.random() - 0.5) * sh);
          g.rotate(roll); g.scale(1.05, 1.05); g.translate(-800, -450);

          drawArchWall();
          var sNear = st.sCam + 0.32, sFar = Math.min(st.sCam + VIEW, S_ARCH);
          var samples = [];
          if (sNear < sFar) {
            samples.push(makeSample(sNear));
            for (var k = Math.floor(sNear / SEG) + 1; k * SEG < sFar - 0.02; k++) samples.push(makeSample(k * SEG));
            samples.push(makeSample(sFar));
          }
          var weiDrawn = false;
          for (var j = samples.length - 2; j >= 0; j--) drawSegment(samples[j], samples[j + 1]);
          if (!weiDrawn && st.weiS < sNear) { /* 太近或已穿门，不画 */ }

          // 浮尘
          g.globalCompositeOperation = 'lighter';
          for (var d = 0; d < DUST.length; d++) {
            var p = DUST[d];
            if (p.z < 0.3) continue;
            var X = CX + F * p.x / p.z, Y = HOR + F * (camH - p.h) / p.z;
            if (X < -10 || X > 1610 || Y < -10 || Y > 910) continue;
            var a = (0.1 + p.v * 0.22) * fogAt(p.z) * (1 - dv * 0.6);
            g.fillStyle = 'rgba(255,214,160,' + a.toFixed(3) + ')';
            var r = Math.max(0.8, 2.6 / p.z * (0.6 + p.v));
            g.fillRect(X - r / 2, Y - r / 2, r, r);
          }
          g.globalCompositeOperation = 'source-over';
          g.restore();

          // 暗角 + 沮丧的灰冷 + 停步警告的红边
          var vg = g.createRadialGradient(800, 420, 260, 800, 450, 980);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(1, 'rgba(0,0,0,' + (0.72 + dv * 0.25).toFixed(3) + ')');
          g.fillStyle = vg; g.fillRect(0, 0, 1600, 900);
          if (dv > 0.02) { g.fillStyle = 'rgba(70,78,86,' + (dv * 0.16).toFixed(3) + ')'; g.fillRect(0, 0, 1600, 900); }
          if (st.warn > 0) {
            var wg = g.createRadialGradient(800, 450, 380, 800, 450, 950);
            var wa = st.warn * (0.45 + 0.25 * Math.sin(now / 90));
            wg.addColorStop(0, 'rgba(150,20,10,0)'); wg.addColorStop(1, 'rgba(170,24,12,' + wa.toFixed(3) + ')');
            g.fillStyle = wg; g.fillRect(0, 0, 1600, 900);
          }
          // 胜利：拱门里的红光铺满
          if (st.phase === 'win') {
            var wp = clamp((now - st.endT) / 1300, 0, 1);
            g.fillStyle = 'rgba(40,6,4,' + clamp((wp - 0.7) / 0.3, 0, 1).toFixed(3) + ')'; g.fillRect(0, 0, 1600, 900);
          }
          // 机关：箭、红闪、黑场
          if (st.phase === 'trap' || st.phase === 'done') drawTrap(now);
        }

        function drawTrap(now) {
          g.lineCap = 'round';
          for (var i = 0; i < st.arrows.length; i++) {
            var a = st.arrows[i], t = (now - a.t0 - a.d) / 170;
            if (t < 0) continue;
            var tt = clamp(t, 0, 1);
            var x = lerp(a.x0, a.x1, tt), y = lerp(a.y0, a.y1, tt), ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
            var len = 70, tx = Math.cos(ang) * len, ty = Math.sin(ang) * len;
            if (t < 1) {
              g.strokeStyle = 'rgba(220,200,170,.25)'; g.lineWidth = 2;
              g.beginPath(); g.moveTo(x - tx * 3, y - ty * 3); g.lineTo(x, y); g.stroke();
            }
            g.strokeStyle = '#1b1a18'; g.lineWidth = 7;
            g.beginPath(); g.moveTo(x - tx, y - ty); g.lineTo(x, y); g.stroke();
            g.strokeStyle = '#8b8479'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(x - tx * 0.3, y - ty * 0.3); g.lineTo(x, y); g.stroke();
          }
          g.lineCap = 'butt';
          if (st.flash > 0) {
            g.fillStyle = 'rgba(190,20,10,' + (st.flash * 0.55).toFixed(3) + ')'; g.fillRect(0, 0, 1600, 900);
            st.flash = Math.max(0, st.flash - 0.035);
          }
          var fp = clamp((now - st.endT - 820) / 500, 0, 1);
          if (fp > 0) { g.fillStyle = 'rgba(0,0,0,' + fp.toFixed(3) + ')'; g.fillRect(0, 0, 1600, 900); }
        }

        /* =============================== 绘制：HUD =============================== */
        // 小地图底图（离屏预渲染）
        var mm = document.createElement('canvas'); mm.width = 320; mm.height = 190;
        var MM = { x0: 30, y0: 66, w: 170, h: 116 }, mmMap;
        (function () {
          var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, p = {};
          for (var s = 0; s <= S_ARCH + 0.6; s += 0.5) { pathAt(s, p); minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
          var sc = Math.min((MM.w - 16) / (maxx - minx), (MM.h - 16) / (maxy - miny));
          var ox = MM.x0 + (MM.w - (maxx - minx) * sc) / 2, oy = MM.y0 + (MM.h - (maxy - miny) * sc) / 2;
          mmMap = function (s) { pathAt(s, p); return [ox + (p.x - minx) * sc, oy + (maxy - p.y) * sc]; };
          var c = mm.getContext('2d');
          c.fillStyle = 'rgba(6,6,8,.82)'; roundRect(c, 2, 2, 316, 186, 8); c.fill();
          c.strokeStyle = 'rgba(224,181,106,.35)'; c.lineWidth = 1; c.stroke();
          c.font = '26px ' + FONT; c.fillStyle = '#e0b56a'; c.textBaseline = 'alphabetic';
          c.fillText('沮丧墓道', 22, 42);
          c.lineCap = 'round'; c.lineJoin = 'round';
          c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 13; tracePath(c);
          c.strokeStyle = 'rgba(160,152,134,.55)'; c.lineWidth = 9; tracePath(c);
          c.strokeStyle = 'rgba(40,38,34,.9)'; c.lineWidth = 5; tracePath(c);
          for (var k = 1; k <= STEPS; k++) {
            var q = mmMap(S0 + k * STEP_LEN);
            c.fillStyle = 'rgba(200,190,170,.45)'; c.beginPath(); c.arc(q[0], q[1], 1.4, 0, Math.PI * 2); c.fill();
          }
          var e = mmMap(S_ARCH), e0 = mmMap(S_ARCH - 1);
          var an = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
          c.save(); c.translate(e[0], e[1]); c.rotate(an + Math.PI / 2);
          c.strokeStyle = '#c25a3c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-7, 3); c.lineTo(-7, -3); c.arc(0, -3, 7, Math.PI, 0); c.lineTo(7, 3); c.stroke();
          c.restore();
          function tracePath(cc) { cc.beginPath(); for (var s2 = 0; s2 <= S_ARCH; s2 += 0.5) { var q2 = mmMap(s2); if (s2) cc.lineTo(q2[0], q2[1]); else cc.moveTo(q2[0], q2[1]); } cc.stroke(); }
        })();
        function roundRect(c, x, y, w, hh, r) {
          c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
          c.lineTo(x + w, y + hh - r); c.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); c.lineTo(x + r, y + hh);
          c.quadraticCurveTo(x, y + hh, x, y + hh - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
        }
        // 节拍轨上的脚印（朝上；左右脚交替）
        function footprint(c, x, y, s, mirror) {
          c.save(); c.translate(x, y); c.scale(mirror ? -s : s, s);
          c.beginPath();
          c.moveTo(0, -24); c.bezierCurveTo(9, -24, 11, -12, 10, -4); c.bezierCurveTo(9, 4, 6, 6, 5, 8);
          c.lineTo(-5, 8); c.bezierCurveTo(-8, 4, -10, -2, -9, -10); c.bezierCurveTo(-8, -20, -5, -24, 0, -24); c.closePath();
          c.moveTo(-6, 13); c.lineTo(5, 13); c.bezierCurveTo(7, 13, 7, 23, 0, 24); c.bezierCurveTo(-7, 23, -7, 13, -6, 13); c.closePath();
          c.restore();
        }

        // HUD 发光：预渲染的径向光斑贴图（代替逐帧 shadowBlur——软件渲染时 shadowBlur 极慢，会拖垮节拍判定）
        function glowSprite(rgb, r) {
          var c = document.createElement('canvas'); c.width = c.height = r * 2;
          var x = c.getContext('2d'), gr = x.createRadialGradient(r, r, 0, r, r, r);
          gr.addColorStop(0, 'rgba(' + rgb + ',.9)'); gr.addColorStop(0.35, 'rgba(' + rgb + ',.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
          x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
          return c;
        }
        var GLOW_AMBER = glowSprite('224,181,106', 64), GLOW_DARK = glowSprite('0,0,0', 128);
        function glow(spr, x, y, r, a) {
          var ga = h.globalAlpha; h.globalAlpha = ga * a;
          h.drawImage(spr, x - r, y - r, r * 2, r * 2);
          h.globalAlpha = ga;
        }
        function renderHUD(now) {
          h.clearRect(0, 0, 1600, 900);
          var fadeHud = st.phase === 'win' || st.phase === 'trap' || st.phase === 'done' ? clamp(1 - (now - st.endT) / 400, 0, 1) : 1;
          h.globalAlpha = fadeHud;
          // 小地图
          h.drawImage(mm, 22, 18);
          var me = mmMap(st.sCam), wv = mmMap(Math.min(st.weiS, S_ARCH));
          h.fillStyle = '#b5483c'; h.beginPath(); h.arc(22 + wv[0], 18 + wv[1], 4, 0, Math.PI * 2); h.fill();
          glow(GLOW_AMBER, 22 + me[0], 18 + me[1], 16, 0.8);
          h.fillStyle = '#f3d08c';
          h.beginPath(); h.arc(22 + me[0], 18 + me[1], 5.5, 0, Math.PI * 2); h.fill();
          h.textAlign = 'right'; h.textBaseline = 'alphabetic';
          h.font = '54px ' + FONT; h.fillStyle = '#efe6d2'; h.fillText(String(st.steps), 300, 142);
          h.font = '26px ' + FONT; h.fillStyle = '#a79f8c'; h.fillText('/ ' + STEPS + ' 步', 318, 180);
          h.textAlign = 'left';

          // 轨道
          var ty = TRACK_Y, top = ty - TRACK_H / 2;
          h.fillStyle = 'rgba(8,8,10,.8)'; roundRect(h, TRACK_X0, top, TRACK_X1 - TRACK_X0, TRACK_H, 38); h.fill();
          var warnCol = st.warn > 0 ? 'rgba(210,60,40,' + (0.35 + st.warn * 0.5).toFixed(3) + ')' : 'rgba(224,181,106,.38)';
          h.strokeStyle = warnCol; h.lineWidth = 1.5; h.stroke();
          h.strokeStyle = 'rgba(224,181,106,.1)'; h.lineWidth = 1;
          h.beginPath(); h.moveTo(TRACK_X0 + 40, ty); h.lineTo(TRACK_X1 - 40, ty); h.stroke();
          // 判定窗口
          var bw = W * SPEED;
          var wg = h.createLinearGradient(HIT_X - bw, 0, HIT_X + bw, 0);
          wg.addColorStop(0, 'rgba(224,181,106,0)'); wg.addColorStop(0.5, 'rgba(224,181,106,.2)'); wg.addColorStop(1, 'rgba(224,181,106,0)');
          h.fillStyle = wg; h.fillRect(HIT_X - bw, top + 5, bw * 2, TRACK_H - 10);
          h.strokeStyle = 'rgba(224,181,106,.35)'; h.setLineDash([4, 5]);
          h.beginPath(); h.moveTo(HIT_X - bw, top + 8); h.lineTo(HIT_X - bw, top + TRACK_H - 8); h.moveTo(HIT_X + bw, top + 8); h.lineTo(HIT_X + bw, top + TRACK_H - 8); h.stroke();
          h.setLineDash([]);

          // 音符
          var noteAlpha = 1 - st.dv * 0.4;
          for (var i = 0; i < st.beats.length; i++) {
            var b = st.beats[i];
            var x = HIT_X + (b.t - now) * SPEED;
            if (x > TRACK_X1 - 22 || x < TRACK_X0 + 24) continue;
            var edge = clamp((TRACK_X1 - 22 - x) / 90, 0, 1) * clamp((x - TRACK_X0 - 24) / 60, 0, 1);
            var mirror = b.idx % 2 === 1, yy = ty + (mirror ? 6 : -6);
            if (b.state === 1) continue;
            h.globalAlpha = fadeHud * edge * noteAlpha;
            if (!b.real) {
              footprint(h, x, yy, 1, mirror); h.strokeStyle = 'rgba(239,230,210,.75)'; h.lineWidth = 2; h.stroke();
              h.font = '26px ' + FONT; h.fillStyle = '#e0b56a'; h.textAlign = 'center';
              h.fillText(b.label, x, top - 10); h.textAlign = 'left';
            } else if (b.state === 0) {
              glow(GLOW_AMBER, x, yy, x < HIT_X + bw * 1.5 ? 34 : 24, x < HIT_X + bw * 1.5 ? 0.75 : 0.4);
              footprint(h, x, yy, 1, mirror); h.fillStyle = '#efe6d2'; h.fill();
              if (b.first) { h.font = '26px ' + FONT; h.fillStyle = '#e0b56a'; h.textAlign = 'center'; h.fillText('走', x, top - 10); h.textAlign = 'left'; }
            } else {
              footprint(h, x, yy, 1, mirror);
              h.fillStyle = b.state === 3 ? 'rgba(170,70,58,.75)' : 'rgba(110,106,100,.7)'; h.fill();
            }
          }
          h.globalAlpha = fadeHud;

          // 金圈 + 停步计时弧
          var pulse = clamp(1 - (now - st.ringPulse) / 260, 0, 1);
          var rr = 31 + pulse * 5;
          h.strokeStyle = 'rgba(224,181,106,' + (0.12 + pulse * 0.18).toFixed(3) + ')'; h.lineWidth = 12 + pulse * 10;
          h.beginPath(); h.arc(HIT_X, ty, rr, 0, Math.PI * 2); h.stroke();          // 光晕（代替 shadowBlur）
          h.strokeStyle = 'rgba(224,181,106,' + (0.75 + pulse * 0.25).toFixed(3) + ')'; h.lineWidth = 3;
          h.beginPath(); h.arc(HIT_X, ty, rr, 0, Math.PI * 2); h.stroke();
          if (st.phase === 'play' && now > st.firstRealT - BEAT) {
            var el = clamp((now - st.lastStepBeatT) / STALL, 0, 1);
            h.strokeStyle = el > 0.6 ? 'rgba(220,70,50,.95)' : 'rgba(239,230,210,.35)'; h.lineWidth = 4;
            h.beginPath(); h.arc(HIT_X, ty, 42, -Math.PI / 2, -Math.PI / 2 + el * Math.PI * 2); h.stroke();
          }
          // 命中/失误的光效
          for (var bi = st.bursts.length - 1; bi >= 0; bi--) {
            var bu = st.bursts[bi], bp = Math.max(0, (now - bu.t0) / 420);
            if (bp >= 1) { st.bursts.splice(bi, 1); continue; }
            h.strokeStyle = bu.good ? 'rgba(243,208,140,' + (1 - bp).toFixed(3) + ')' : 'rgba(200,80,60,' + (1 - bp).toFixed(3) + ')';
            h.lineWidth = bu.perfect ? 4 : 2.5;
            h.beginPath(); h.arc(HIT_X, ty, 32 + bp * (bu.perfect ? 46 : 30), 0, Math.PI * 2); h.stroke();
          }
          // 文字反馈
          h.textAlign = 'center';
          for (var pi = st.pops.length - 1; pi >= 0; pi--) {
            var pp = st.pops[pi], pt = (now - pp.t0) / 700;
            if (pt >= 1) { st.pops.splice(pi, 1); continue; }
            h.globalAlpha = fadeHud * (1 - pt * pt);
            h.font = pp.size + 'px ' + FONT; h.fillStyle = pp.color;
            h.fillText(pp.text, HIT_X, top - 14 - pt * 26);
          }
          h.globalAlpha = fadeHud;
          if (st.warn > 0.05 && st.phase === 'play') {
            h.font = '34px ' + FONT; h.fillStyle = 'rgba(235,90,70,' + (0.5 + st.warn * 0.5).toFixed(3) + ')';
            h.fillText('别停！', HIT_X + 150, top - 16);
          }
          // 沮丧值（轨道右侧）
          h.font = '26px ' + FONT; h.fillStyle = st.d > 0.66 ? '#8e8a82' : '#b9b09c'; h.textAlign = 'left';
          h.fillText('沮丧', 1330, ty - 8);
          h.fillStyle = 'rgba(255,255,255,.08)'; roundRect(h, 1330, ty + 8, 230, 12, 6); h.fill();
          var dcol = st.d > 0.66 ? '#77746e' : st.d > 0.33 ? '#9d968a' : '#c9b58a';
          h.fillStyle = dcol; roundRect(h, 1330, ty + 8, Math.max(12, 230 * st.dv), 12, 6); h.fill();
          // 倒数大字
          if (st.countText) {
            var ct = (now - st.countText.t0) / 650;
            if (ct < 1) {
              h.globalAlpha = fadeHud * (1 - ct);
              h.font = (st.countText.text === '走' ? 110 : 92) + 'px ' + FONT; h.textAlign = 'center';
              h.fillStyle = st.countText.text === '走' ? '#e0b56a' : '#efe6d2';
              glow(GLOW_DARK, 800, 330 - ct * 20 - 35, 110, 0.7);
              h.fillText(st.countText.text, 800, 330 - ct * 20);
              h.textAlign = 'left';
            } else st.countText = null;
          }
          h.globalAlpha = 1;
        }

        /* =============================== 主循环 =============================== */
        var lastT = gnow();
        var frameErr = 0;
        function frame() {
          if (done) return;
          raf = requestAnimationFrame(frame);   // 先排下一帧：本帧就算出错也不会让游戏卡死
          var raw = performance.now();
          if (raw - lastRaw > 5000) offset += raw - lastRaw - 16;   // 兜底：电脑休眠等没有 visibilitychange 的长停顿
          else st.fdt = st.fdt * 0.92 + Math.min(200, raw - lastRaw) * 0.08;   // 实际帧间隔（含光栅化），用来判断机器跟不跟得上
          lastRaw = raw;
          try { step(); } catch (e) { if (frameErr++ < 3 && window.console) console.error('[despair_walk] frame error', e); }
        }
        function step() {
          var now = gnow(), dt = Math.max(0, Math.min(0.05, (now - lastT) / 1000)); lastT = now;

          if (st.phase === 'play') {
            scheduleUntil(now);
            for (var i = 0; i < st.beats.length; i++) {
              var b = st.beats[i];
              if (!b.sounded && now >= b.t) { b.sounded = true; onBeat(b, now); }
              if (b.real && b.state === 0 && now > b.t + W) { b.state = 2; miss(now); }
            }
            while (st.beats.length && now - st.beats[0].t > 1600) st.beats.shift();
            if (now > st.firstRealT) addD(0.012 * dt);                      // 暗示一直在往下压
            if (st.d > 0.45 && now - st.lastWhisper > 3200 - st.d * 1600) spawnWhisper(false);
            var el = now - st.lastStepBeatT;
            st.warn = clamp((el - (STALL - 900)) / 900, 0, 1);
            if (st.warn > 0.3 && now - st.warnSaid > 4000) { st.warnSaid = now; say('别站着！', 'zhangqing'); }
            heartbeat(st.warn > 0.2 ? 124 : Math.round(62 + st.d * 46));
            if (el > STALL) trapSeq(now);
          } else st.warn = Math.max(0, st.warn - dt * 3);

          // 迈步动画
          var sp = easeOut((now - st.stepT0) / 330);
          st.sCam = lerp(st.stepFrom, st.stepTo, sp);
          if (st.phase === 'win') {
            var wp = easeInOut((now - st.endT - 150) / 1150);
            st.sCam = lerp(S0 + STEPS * STEP_LEN, S_ARCH - 0.2, wp);
            st.d = Math.max(0, st.d - dt * 1.5);
          }
          if (st.phase === 'trap') st.camDrop = Math.min(0.2, st.camDrop + dt * 0.9);
          st.dv += (st.d - st.dv) * Math.min(1, dt * 3.2);
          // 卫不回：沮丧越重，他越远越淡
          var gap = 4.2 + st.dv * 3.4;
          st.weiS += (st.sCam + gap - st.weiS) * Math.min(1, dt * 2.2);
          if (st.weiS > S_ARCH - 0.4) st.weiAlpha = Math.max(0, st.weiAlpha - dt * 2.5);
          // 浮尘随前进后退，沮丧时变慢
          var adv = st.sCam - (st._lastS == null ? st.sCam : st._lastS); st._lastS = st.sCam;
          for (var d = 0; d < DUST.length; d++) {
            var p = DUST[d];
            p.z -= adv; p.x += Math.sin(now / 1700 + d) * dt * 0.05 * (1 - st.dv * 0.6); p.h += Math.cos(now / 2100 + d * 2) * dt * 0.04 * (1 - st.dv * 0.6);
            if (p.z < 0.4) { p.z = 7 + Math.random() * 3; p.x = (Math.random() - 0.5) * 3; p.h = 0.2 + Math.random() * 3; }
          }
          // 画面：沮丧越重越模糊
          var blur = st.dv > 0.55 ? Math.round((st.dv - 0.55) * 8) / 2.5 : 0;
          if (blur !== st._blur) { st._blur = blur; cv.style.filter = blur ? 'blur(' + blur.toFixed(2) + 'px)' : ''; }

          var c0 = performance.now();
          renderScene(now);
          renderHUD(now);
          st.cost = st.cost * 0.9 + (performance.now() - c0) * 0.1;
          // 机器跟不上（绘制 >16ms 或实际不到 ~35 帧/秒）时降低墓道画布的内部分辨率：1 → 0.75 → 0.6，每级至少观察 45 帧
          if (RS > 0.6 && (st.cost > 16 || st.fdt > 28) && ++st._slow > 45) {
            st._slow = 0; st.cost = 0; st.fdt = 16; RS = RS === 1 ? 0.75 : 0.6; cv.width = 1600 * RS; cv.height = 900 * RS;
          }
        }
        raf = requestAnimationFrame(frame);

        /* =============================== 开场 =============================== */
        say('这里不能停。跟着我的脚步声，一步一步走。', 'zhangqing').then(function () {
          if (done) return;
          beginCount();
        });
      });
    }
  });
})();
