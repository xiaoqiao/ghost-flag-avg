/*
 * 小游戏 shout —— 墓道里，喊住卫先。
 * 画面：墓道插画（ctx.bgImage('corridor')）压暗，心跳 130；前方卫先的背影剪影一步步走远。
 * 玩法：按住屏幕下方“喊出来”区域（鼠标 / 触摸 / 空格）蓄力。蓄力条被“无形的压力”持续往回推，
 *       松手快速回落；连续按住约 2.5 秒（简单模式 1.5 秒）蓄满。屏幕中央的“别……”随蓄力变大、抖动，
 *       蓄满后爆成“别过去！”（大字 + 震屏 + 白闪）→ heartbeat(0) → 'win'。只会赢。
 * 测试钩子：.gfg-shout-stage 上的 data-state（intro/play/burst/done）、data-charge（0–1）、data-holding。
 */
(function () {
  'use strict';
  var GF = window.GF;
  var ID = 'shout', P = 'gfg-shout-';
  var W = 1600, H = 900;
  var FONT = '"Songti SC","STSong","SimSun","Noto Serif SC",serif';

  var CSS = [
    '.P-stage{position:absolute;inset:0;overflow:hidden;background:#050404;font-family:' + FONT + ';color:#efe6d2;cursor:default}',
    '.P-scene{position:absolute;left:-40px;top:-30px;width:1680px;height:960px;will-change:transform}',
    '.P-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.56) saturate(.6) contrast(1.06)}',
    '.P-bgsvg{position:absolute;inset:0;filter:brightness(.5) saturate(.6)}.P-bgsvg svg{width:100%;height:100%}',
    '.P-bgdraw{position:absolute;inset:0;background:radial-gradient(ellipse 30% 40% at 50% 52%,#3a3024 0%,#16120e 55%,#050404 100%)}',
    '.P-beam{position:absolute;inset:0;background:radial-gradient(ellipse 26% 44% at 50% 58%,rgba(255,214,150,.20),rgba(255,200,130,.06) 55%,transparent 75%);mix-blend-mode:screen}',
    '.P-wx{position:absolute;left:0;top:0;width:190px;height:428px;transform-origin:50% 100%;will-change:transform}',
    '.P-wx svg{width:100%;height:100%;display:block;overflow:visible}',
    '.P-wxin{width:100%;height:100%;filter:brightness(0) drop-shadow(0 0 2px rgba(224,181,106,.55)) drop-shadow(0 0 16px rgba(224,181,106,.18));opacity:.93}',
    '.P-shadow{position:absolute;left:50%;bottom:-8px;width:150px;height:22px;margin-left:-75px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.75),transparent 70%)}',
    '.P-dark{position:absolute;inset:0;pointer-events:none}',
    '.P-pulse{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 70% at 50% 50%,transparent 55%,rgba(90,6,6,.55) 100%);opacity:0}',
    '.P-flash{position:absolute;inset:0;background:#fffaf0;opacity:0;pointer-events:none;z-index:60}',
    '.P-word{position:absolute;left:0;top:0;opacity:0;white-space:nowrap;pointer-events:none;z-index:30;letter-spacing:.08em;will-change:transform,font-size;' +
      'text-shadow:0 0 18px rgba(0,0,0,.95),0 0 3px #000}',
    '.P-word.P-boom{color:#fff7e6;text-shadow:0 0 30px rgba(224,181,106,.95),0 0 80px rgba(224,181,106,.6),0 4px 0 #3a1e0a}',
    '.P-hint{position:absolute;left:0;right:0;top:548px;text-align:center;font-size:30px;color:#cfc3a8;letter-spacing:.14em;opacity:0;transition:opacity .45s;pointer-events:none;z-index:30;text-shadow:0 0 12px #000,0 0 3px #000}',
    '.P-hint.P-on{opacity:1}',
    '.P-ui{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:40;opacity:0;transition:opacity .6s}',
    '.P-ui.P-on{opacity:1}',
    '.P-bar{position:absolute;left:420px;top:628px;width:760px;height:30px;border:2px solid rgba(224,181,106,.7);border-radius:16px;background:rgba(8,6,5,.82);overflow:hidden;box-shadow:0 0 24px rgba(0,0,0,.8)}',
    '.P-push{position:absolute;top:0;bottom:0;right:0;background:repeating-linear-gradient(-60deg,rgba(150,30,24,.0) 0 14px,rgba(150,30,24,.42) 14px 22px);background-size:52px 100%;animation:' + P + 'push .6s linear infinite}',
    '@keyframes ' + P + 'push{from{background-position:0 0}to{background-position:-52px 0}}',
    '.P-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#7a5424,#e0b56a 70%,#fff1cf);box-shadow:0 0 18px rgba(224,181,106,.7)}',
    '.P-edge{position:absolute;top:-6px;bottom:-6px;width:40px;margin-left:-4px;background:radial-gradient(ellipse at 0 50%,rgba(170,24,18,.85),transparent 70%);opacity:0}',
    '.P-barlab{position:absolute;left:420px;top:590px;width:760px;display:flex;justify-content:space-between;font-size:26px;color:#a99d86;letter-spacing:.1em;text-shadow:0 0 8px #000}',
    '.P-zone{position:absolute;left:470px;top:696px;width:660px;height:166px;border:2px solid rgba(224,181,106,.55);border-radius:14px;' +
      'background:linear-gradient(rgba(30,22,14,.86),rgba(12,9,6,.92));box-shadow:0 0 0 1px rgba(0,0,0,.6),0 10px 40px rgba(0,0,0,.7);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;touch-action:none;' +
      'transition:transform .12s,border-color .2s,box-shadow .2s;outline:none}',
    '.P-zone:hover,.P-zone:focus-visible{border-color:rgba(224,181,106,.9)}',
    '.P-zone.P-hold{transform:scale(.975);border-color:#e0b56a;box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 46px rgba(224,181,106,.45),inset 0 0 40px rgba(224,181,106,.18)}',
    '.P-zt{font-size:58px;letter-spacing:.5em;margin-left:.5em;color:#efe6d2;text-shadow:0 0 16px rgba(224,181,106,.35)}',
    '.P-zs{font-size:26px;color:#a99d86;letter-spacing:.12em;margin-top:8px}',
    '.P-zone.P-hold .P-zt{color:#fff3d6}'
  ].join('\n').replace(/\.P-/g, '.' + P);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** 卫先的背影：优先用剪影生成器（压成纯黑、留一圈手电的琥珀色轮廓光），没有就画一个简单人影 */
  function silhouetteSvg() {
    try {
      if (GF.art && GF.art.char) {
        var s = GF.art.char('weixian', {});
        if (s && s.indexOf('<svg') >= 0) return s;
      }
    } catch (e) { /* 退回自绘 */ }
    return '<svg viewBox="0 0 400 900" xmlns="http://www.w3.org/2000/svg"><g fill="#000">' +
      '<ellipse cx="200" cy="120" rx="52" ry="62"/>' +
      '<path d="M120 200 Q200 170 280 200 L300 470 Q292 500 268 500 L262 880 L214 880 L204 540 L196 540 L186 880 L138 880 L132 500 Q108 500 100 470 Z"/>' +
      '<rect x="138" y="230" width="124" height="170" rx="22"/></g></svg>';
  }

  GF.games.register(ID, {
    start: function (ctx) {
      return new Promise(function (resolve) {
        var root = ctx.root, audio = ctx.audio || {};
        var NEED = ctx.easy ? 1.5 : 2.5;             // 连续按住所需秒数（压力平均抵消后）
        var rafId = 0, timers = [], ended = false;
        function later(fn, ms) { var t = setTimeout(function () { if (!ended) fn(); }, ms); timers.push(t); return t; }
        function au(fn, a) { try { if (audio[fn]) audio[fn](a); } catch (e) { /* 静默 */ } }

        /* ---------- DOM ---------- */
        var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
        var stage = document.createElement('div');
        stage.className = P + 'stage';
        stage.setAttribute('data-state', 'intro'); stage.setAttribute('data-charge', '0'); stage.setAttribute('data-holding', '0');
        stage.innerHTML =
          '<div class="' + P + 'scene">' +
            '<div class="' + P + 'bgwrap"></div>' +
            '<div class="' + P + 'beam"></div>' +
            '<div class="' + P + 'wx"><div class="' + P + 'shadow"></div><div class="' + P + 'wxin"></div></div>' +
            '<div class="' + P + 'dark"></div>' +
            '<div class="' + P + 'pulse"></div>' +
          '</div>' +
          '<div class="' + P + 'word">别……</div>' +
          '<div class="' + P + 'hint">喉咙像被什么掐住了……</div>' +
          '<div class="' + P + 'ui">' +
            '<div class="' + P + 'barlab"><span>声音</span><span>无形的压力 ◂◂</span></div>' +
            '<div class="' + P + 'bar"><div class="' + P + 'push"></div><div class="' + P + 'fill"></div><div class="' + P + 'edge"></div></div>' +
            '<div class="' + P + 'zone" tabindex="0" role="button" aria-label="按住喊出来">' +
              '<div class="' + P + 'zt">喊出来</div><div class="' + P + 'zs">按住不放 · 鼠标 / 触摸 / 空格</div>' +
            '</div>' +
          '</div>' +
          '<div class="' + P + 'flash"></div>';
        root.appendChild(stage);
        function $(n) { return stage.querySelector('.' + P + n); }
        var scene = $('scene'), bgwrap = $('bgwrap'), wx = $('wx'), wxin = $('wxin'), dark = $('dark'), pulse = $('pulse');
        var word = $('word'), hint = $('hint'), ui = $('ui'), fill = $('fill'), push = $('push'), edge = $('edge'), zone = $('zone'), flash = $('flash');

        // 底图：AI 插画 → 矢量底图 → 自绘渐变
        var bgUrl = ctx.bgImage ? ctx.bgImage('corridor') : '';
        function useSvgBg() {
          var svg = ctx.bgSvg ? ctx.bgSvg('corridor') : '';
          bgwrap.innerHTML = svg ? '<div class="' + P + 'bgsvg">' + svg + '</div>' : '<div class="' + P + 'bgdraw"></div>';
        }
        if (bgUrl) {
          var img = document.createElement('img');
          img.className = P + 'bg'; img.alt = ''; img.draggable = false;
          img.onerror = function () { if (!ended) useSvgBg(); };
          img.src = bgUrl;
          bgwrap.appendChild(img);
        } else useSvgBg();
        wxin.innerHTML = silhouetteSvg();

        /* ---------- 状态 ---------- */
        var state = 'intro', charge = 0, holding = false, holdSrc = null, T = 0, lastT = 0;
        var idleT = 0, hintOn = false, recede = 0, shake = 0, flashA = 0, boomT = -1;
        var surge = 0, nextSurge = 0.7, wordStage = -1;
        var WORDS = ['别……', '别……过', '别……过……', '别过——'];

        function setHold(on, src) {
          if (state !== 'play') { holding = false; holdSrc = null; zone.classList.remove(P + 'hold'); return; }
          if (on && holding) return;
          if (!on && src && holdSrc && src !== holdSrc) return;   // 另一个输入源松开，不影响
          holding = on; holdSrc = on ? src : null;
          zone.classList.toggle(P + 'hold', on);
          stage.setAttribute('data-holding', on ? '1' : '0');
          if (on) { idleT = 0; showHint(false); au('sfx', 'gust'); }
          else if (charge > 0.08) showHint(true);
        }
        function showHint(on) { if (on !== hintOn) { hintOn = on; hint.classList.toggle(P + 'on', on); } }

        /* ---------- 输入 ---------- */
        function onZoneDown(e) {
          if (ended) return;
          if (e.button != null && e.button > 0) return;
          e.preventDefault(); e.stopPropagation();
          try { zone.setPointerCapture(e.pointerId); } catch (er) { /* 合成事件无 pointerId */ }
          setHold(true, 'p');
        }
        function onZoneUp(e) { if (!ended) setHold(false, 'p'); }
        zone.addEventListener('pointerdown', onZoneDown);
        zone.addEventListener('pointerup', onZoneUp);
        zone.addEventListener('pointercancel', onZoneUp);
        zone.addEventListener('lostpointercapture', onZoneUp);
        zone.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        function isHoldKey(e) { return e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter' || e.code === 'Space'; }
        function onKeyDown(e) {
          if (ended || !isHoldKey(e)) return;
          e.preventDefault();
          if (state === 'play') setHold(true, 'k');
        }
        function onKeyUp(e) {
          if (ended || !isHoldKey(e)) return;
          e.preventDefault();
          setHold(false, 'k');
        }
        function onBlur() { if (!ended) setHold(false); }
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);

        /* ---------- 主循环 ---------- */
        var HB = 60 / 130;   // 心跳周期（秒）
        function frame(now) {
          if (ended) return;
          rafId = requestAnimationFrame(frame);
          var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016; lastT = now; T += dt;

          if (state === 'play') {
            // 无形的压力：持续的回推 + 不定时的一阵猛推（按住时条会被推回一截）
            if (T > nextSurge) { surge = 1; nextSurge = T + 0.75 + Math.random() * 0.6; }
            surge = Math.max(0, surge - dt * 4.2);
            var press = 0.34 + 0.18 * Math.sin(T * 7.3) + surge * 1.25;      // 平均约 0.48（猛推摊下来约 0.14）
            if (holding) {
              charge += dt * (1 / NEED + 0.54 - press);
              idleT = 0;
            } else {
              charge -= dt * (1.9 + press);
              idleT += dt;
              if (idleT > (charge > 0.02 ? 0.25 : 1.3)) showHint(true);
            }
            charge = clamp(charge, 0, 1);
            if (charge >= 1) { burst(); }
            // 蓄力条
            fill.style.width = (charge * 100).toFixed(2) + '%';
            push.style.left = (charge * 100).toFixed(2) + '%';
            edge.style.left = (charge * 100).toFixed(2) + '%';
            edge.style.opacity = holding ? (0.35 + surge * 0.65).toFixed(2) : '0';
            stage.setAttribute('data-charge', charge.toFixed(3));
            // 中央的字：越憋越大、越抖
            var ws = charge < 0.3 ? 0 : charge < 0.58 ? 1 : charge < 0.82 ? 2 : 3;
            if (ws !== wordStage) { wordStage = ws; word.textContent = WORDS[ws]; }
            var c = Math.pow(charge, 1.15);
            var fs = lerp(17, 118, c);
            var jit = holding ? 1 + 16 * c + surge * 10 : 0.6;
            var jx = (Math.random() - 0.5) * jit, jy = (Math.random() - 0.5) * jit;
            word.style.fontSize = fs.toFixed(1) + 'px';
            var ww = word.offsetWidth, wh = word.offsetHeight;
            word.style.transform = 'translate(' + (W / 2 - ww / 2 + jx).toFixed(1) + 'px,' + (400 - wh / 2 + jy).toFixed(1) + 'px) rotate(' + ((Math.random() - 0.5) * c * (holding ? 3 : 0)).toFixed(2) + 'deg)';
            word.style.opacity = (0.4 + 0.6 * Math.min(1, charge * 1.6)).toFixed(2);
            var red = Math.round(lerp(239, 255, c)), gb = Math.round(lerp(230, 150, c * surge));
            word.style.color = 'rgb(' + red + ',' + gb + ',' + Math.round(lerp(210, 140, c * surge)) + ')';
            // 压迫感：四周黑暗往里挤
            recede = Math.min(1, recede + dt / 22);
            shake = holding ? c * 2.2 + surge * 3 : 0;
          } else if (state === 'burst') {
            shake = Math.max(0, shake - dt * 36);
            if (boomT >= 0) {
              boomT += dt;
              var k = Math.min(1, boomT / 0.35), ov = 1 + 0.35 * Math.sin(k * Math.PI) * (1 - k);
              word.style.fontSize = (lerp(118, 190, 1 - Math.pow(1 - k, 3)) * ov).toFixed(1) + 'px';
              var bw = word.offsetWidth, bh = word.offsetHeight;
              var bj = shake * 0.6;
              word.style.transform = 'translate(' + (W / 2 - bw / 2 + (Math.random() - 0.5) * bj).toFixed(1) + 'px,' + (400 - bh / 2 + (Math.random() - 0.5) * bj).toFixed(1) + 'px)';
            }
          }
          flashA = Math.max(0, flashA - dt * 1.5);
          flash.style.opacity = flashA.toFixed(3);

          // 心跳：暗红的脉冲 + 画面轻微收缩
          var ph = (T % HB) / HB, beat = Math.exp(-ph * 9) + 0.55 * Math.exp(-Math.max(0, ph - 0.22) * 11) * (ph > 0.22 ? 1 : 0);
          var hbAmp = state === 'play' || state === 'intro' ? 1 : Math.max(0, 1 - (boomT < 0 ? 0 : boomT));
          pulse.style.opacity = (beat * 0.55 * hbAmp + (state === 'play' ? charge * 0.25 : 0)).toFixed(3);
          var dk = state === 'play' ? charge : state === 'burst' ? 0.2 : 0;
          var r0 = lerp(40, 20, dk), r1 = lerp(72, 44, dk);
          dark.style.background = 'radial-gradient(ellipse ' + r0.toFixed(1) + '% ' + (r0 * 1.3).toFixed(1) + '% at 50% 55%,transparent 0%,rgba(0,0,0,.55) ' + ((r0 + r1) / 2).toFixed(1) + '%,rgba(0,0,0,.94) ' + r1.toFixed(1) + '%)';
          var sx = (Math.random() - 0.5) * shake * 2, sy = (Math.random() - 0.5) * shake * 2;
          scene.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) scale(' + (1 + beat * 0.006 * hbAmp).toFixed(4) + ')';

          // 卫先：一步一步往墓道深处走（缩小、上下起伏）；喊出来之后猛地站住
          var walking = state === 'intro' || state === 'play';
          var sc = lerp(1, 0.72, recede), bob = walking ? Math.abs(Math.sin(T * 3.4)) * 5 : 0, sway = walking ? Math.sin(T * 1.7) * 3 : 0;
          wx.style.transform = 'translate(' + (W / 2 + 40 - 95 + sway).toFixed(1) + 'px,' + (598 - 428 - bob).toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')';
        }

        function burst() {
          if (state !== 'play') return;
          state = 'burst'; stage.setAttribute('data-state', 'burst'); stage.setAttribute('data-charge', '1');
          holding = false; holdSrc = null; zone.classList.remove(P + 'hold'); stage.setAttribute('data-holding', '0');
          fill.style.width = '100%'; push.style.left = '100%';
          showHint(false);
          ui.classList.remove(P + 'on');
          word.textContent = '别过去！'; word.classList.add(P + 'boom'); word.style.opacity = '1'; word.style.color = '';
          boomT = 0; shake = 30; flashA = 1;
          au('sfx', 'crack'); au('sfx', 'thud'); au('heartbeat', 0);
          later(function () {
            ctx.say('声音终于从喉咙里炸了出来，在墓道里撞出一连串回声。前面那个背影，猛地钉在了原地。').then(function () {
              if (ended) return;
              state = 'done'; stage.setAttribute('data-state', 'done');
              finish('win');
            });
          }, 1100);
        }

        function finish(r) {
          if (ended) return;
          ended = true;
          cancelAnimationFrame(rafId);
          timers.forEach(clearTimeout); timers = [];
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', onBlur);
          au('heartbeat', 0);
          resolve(r);
        }

        /* ---------- 开场 ---------- */
        au('heartbeat', 130);
        rafId = requestAnimationFrame(frame);
        ctx.say('卫先的背影在光圈边上一晃一晃，越走越远。我想叫住他，嗓子眼却像被一只手死死摁着。').then(function () {
          if (ended) return;
          state = 'play'; stage.setAttribute('data-state', 'play');
          ui.classList.add(P + 'on');
          T = 0; nextSurge = 0.7;
          try { zone.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
        });
      });
    }
  });
})();
