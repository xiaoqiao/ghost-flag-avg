/*
 * 小游戏运行环境：注册表 + ctx 构造。引擎与 tools/gametest 共用。
 * 小游戏写法：
 *   GF.games.register('shout', { start: function (ctx) { return new Promise(function (resolve) { ... resolve('win'); }); } });
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var games = {};
  GF.games = GF.games || {};
  GF.games.register = function (id, def) { games[id] = def; };
  GF.games.get = function (id) { return games[id]; };
  GF.games.list = function () { return Object.keys(games); };

  var STYLE_ID = 'gf-gamectx-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.gf-game-root{position:absolute;left:0;top:0;width:1600px;height:900px;overflow:hidden;z-index:40;user-select:none;-webkit-user-select:none;touch-action:none;}' +
      '.gf-game-caption{position:absolute;left:50%;bottom:42px;transform:translateX(-50%);max-width:1180px;min-width:420px;padding:18px 34px;' +
      'background:rgba(12,12,16,.82);border:1px solid rgba(224,181,106,.45);border-radius:6px;color:#efe6d2;font:28px/1.6 "Songti SC","STSong","SimSun","Noto Serif SC",serif;' +
      'letter-spacing:.04em;box-shadow:0 8px 30px rgba(0,0,0,.5);z-index:90;cursor:pointer;opacity:0;transition:opacity .25s;}' +
      '.gf-game-caption.show{opacity:1}' +
      '.gf-game-caption b{display:block;font-size:22px;color:#e0b56a;margin-bottom:4px;font-weight:normal;letter-spacing:.12em}' +
      '.gf-game-skip{position:absolute;right:28px;top:24px;z-index:95;padding:10px 22px;font:22px "Songti SC","STSong",serif;color:#cfc6b3;' +
      'background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);border-radius:4px;cursor:pointer}' +
      '.gf-game-skip:hover{color:#fff;border-color:#e0b56a}';
    document.head.appendChild(st);
  }

  var stubAudio = { sfx: function () {}, bgm: function () {}, amb: function () {}, heartbeat: function () {}, tick: function () {} };

  /**
   * opts: { stage: 1600×900 舞台元素, arg, easy, failCount, audio }
   * 返回 ctx；ctx.destroy() 由调用方在游戏结束后调用。
   */
  GF.makeGameCtx = function (opts) {
    ensureStyle();
    var stage = opts.stage;
    var rootEl = document.createElement('div');
    rootEl.className = 'gf-game-root';
    stage.appendChild(rootEl);
    var caption = null;
    var ctx = {
      root: rootEl,
      arg: opts.arg,
      easy: !!opts.easy,
      failCount: opts.failCount || 0,   // 本次游戏会话中该小游戏已失败的次数（>=2 时建议显示跳过按钮）
      audio: opts.audio || GF.audio || stubAudio,
      toLocal: function (evt) {
        var r = stage.getBoundingClientRect();
        var t = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]) || evt;
        return { x: (t.clientX - r.left) * 1600 / r.width, y: (t.clientY - r.top) * 900 / r.height };
      },
      say: function (text, who) {
        return new Promise(function (resolve) {
          if (caption) caption.remove();
          var c = caption = document.createElement('div');
          c.className = 'gf-game-caption';
          var name = '';
          if (who && GF.registry && GF.registry.characters[who]) {
            // 跟随剧情改名（如 张轻 → 卫不回）
            var nm = (GF.E && GF.E.displayName) ? GF.E.displayName(who) : GF.registry.characters[who].name;
            name = '<b style="color:' + GF.registry.characters[who].color + '">' + nm + '</b>';
          }
          c.innerHTML = name + (GF.renderInline ? GF.renderInline(text) : text);
          rootEl.appendChild(c);
          requestAnimationFrame(function () { c.classList.add('show'); });
          var done = false;
          function finish() {
            if (done) return; done = true;
            c.classList.remove('show');
            setTimeout(function () { if (c.parentNode) c.remove(); if (caption === c) caption = null; }, 250);
            resolve();
          }
          c.addEventListener('pointerdown', function (e) { e.stopPropagation(); finish(); });
          setTimeout(finish, Math.max(2500, String(text).length * 110));
        });
      },
      /** AI 插画的 URL（没有则返回 ''）。不依赖 SVG 几何坐标的小游戏优先用它作底图 */
      bgImage: function (id) { var a = GF.assets && GF.assets.bg && GF.assets.bg[id]; return a ? (GF.assetBase || '') + a : ''; },
      cgImage: function (id) { var a = GF.assets && GF.assets.cg && GF.assets.cg[id]; return a ? (GF.assetBase || '') + a : ''; },
      bgSvg: function (id) { return (GF.art && GF.art.bg && GF.art.bg[id]) ? GF.art.bg[id]() : ''; },
      cgSvg: function (id) { return (GF.art && GF.art.cg && GF.art.cg[id]) ? GF.art.cg[id]() : ''; },
      skipBtn: function (onSkip) {
        var b = document.createElement('div');
        b.className = 'gf-game-skip';
        b.textContent = '跳过 ▸';
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); b.remove(); onSkip(); });
        rootEl.appendChild(b);
        return b;
      },
      destroy: function () { if (rootEl.parentNode) rootEl.remove(); }
    };
    return ctx;
  };

  /** 运行一个小游戏，返回 Promise<'win'|'lose'> */
  GF.games.run = function (id, opts) {
    var def = games[id];
    var ctx = GF.makeGameCtx(opts);
    if (!def) {
      return ctx.say('（小游戏 ' + id + ' 尚未实现，自动通过）').then(function () { ctx.destroy(); return 'win'; });
    }
    var p;
    try { p = Promise.resolve(def.start(ctx)); } catch (e) { console.error(e); p = Promise.resolve('win'); }
    return p.then(function (r) { ctx.destroy(); return r === 'lose' ? 'lose' : 'win'; },
                  function (e) { console.error(e); ctx.destroy(); return 'win'; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
