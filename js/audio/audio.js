/*
 * 幽灵旗 AVG —— 程序化音频 GF.audio（不带任何音频文件，全部 WebAudio 合成）
 *
 *   Engine(ctx)  母带链（压缩 + 软削波，峰值 < 0.97）、bgm/amb/sfx 三条总线、
 *                程序生成冲激响应的卷积混响、节拍同步延迟、噪声缓存、并发声部计数。
 *                可接收任意 BaseAudioContext —— 在线 AudioContext 与离线 OfflineAudioContext 共用同一套合成代码。
 *   INS.*        迷你合成器：钢琴、八音盒、FM 钟、Karplus-Strong 拨弦、宽声场 Pad、贝斯、带颤音主奏、鼓、滴水、颂钵。
 *   BGM.*        13 首：调性 + 和声进行 + 旋律动机 + 分层；16 小节循环；前瞻调度（25ms 轮询，提前 0.1s 排程）。
 *   AMB.*        13 种环境音：滤波噪声 + LFO 调制 + 随机事件。
 *   SFX.*        36 个一次性音效。
 *
 * 对外：GF.audio = { init, bgm, amb, sfx, heartbeat, tick, setVolume, mute, current }
 * 自检：GF.audio.renderOffline(kind, id, seconds) → Promise<AudioBuffer>；GF.audio.ids()；GF.audio._debug()
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var AC = root.AudioContext || root.webkitAudioContext;
  var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;

  /* ================================================================== 工具 */
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function nm(s) {
    var r = /^([a-g])(#|b)?(-?\d)$/.exec(s);
    if (!r) throw new Error('bad note ' + s);
    return 12 * (+r[3] + 1) + NOTE[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0);
  }
  function ns(str) { return str.split(/\s+/).filter(Boolean).map(nm); }
  /* 旋律串 'e5/4 a5/4 r/8 | …'（长度单位：16 分音符）→ { step: [[midi, len]] } */
  function seq(str) {
    var map = {}, pos = 0;
    str.split(/[\s|]+/).filter(Boolean).forEach(function (tok) {
      var p = tok.split('/'), len = +p[1] || 1;
      if (p[0] !== 'r') (map[pos] = map[pos] || []).push([nm(p[0]), len]);
      pos += len;
    });
    map._len = pos;
    return map;
  }
  /* 和弦串：小节用 | 分隔，'=' 表示同上，';' 把一小节分成前后两半 */
  function parseChords(str) {
    var prev = null;
    return str.split('|').map(function (b) {
      b = b.trim();
      if (b === '=' || !b) return prev;
      var h = b.split(';').map(function (x) { return ns(x.trim()); });
      prev = [h[0], h[1] || h[0]];
      return prev;
    });
  }
  var CURVES = {};
  function softClip() {
    if (CURVES.soft) return CURVES.soft;
    var n = 4096, cv = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1, a = Math.abs(2 * x);
      var y = a <= 0.6 ? a : 0.6 + 0.37 * Math.tanh((a - 0.6) / 0.37);
      cv[i] = x < 0 ? -y : y;
    }
    return (CURVES.soft = cv);
  }
  /* 把 -1..1 的正弦 LFO 变成 0..1 的圆滑脉冲 */
  function pulseCurve(pow, thr) {
    var k = 'p' + pow + '_' + thr;
    if (CURVES[k]) return CURVES[k];
    var n = 1024, cv = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = (i / (n - 1)) * 2 - 1, y = Math.max(0, (x - thr) / (1 - thr)); cv[i] = Math.pow(y, pow); }
    return (CURVES[k] = cv);
  }
  /* 包络：线性起音 → 保持 → 指数衰减。返回可安全 stop 的时间 */
  function env(p, t, v, a, h, d) {
    a = a || 0.003; h = h || 0; d = d || 0.2;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(v, t + a);
    if (h) p.setValueAtTime(v, t + a + h);
    p.setTargetAtTime(0, t + a + h, d / 4.5);
    return t + a + h + d * 1.5 + 0.01;
  }

  /* ================================================================== Engine */
  function Engine(ctx, opt) {
    opt = opt || {};
    var E = this, c = ctx;
    E.ctx = c; E.sr = c.sampleRate; E.offline = !!opt.offline;
    E.maxVoices = E.offline ? 1e9 : (opt.maxVoices || 90);
    E.ends = []; E.cache = {}; E.players = []; E.hb = null; E.serial = 0; E.lastSfx = {}; E.sfxEnds = [];
    E.r = rng(opt.seed || 20040917);
    var v = opt.vol || {};
    // 母带：master → 压缩 → ×0.5 → 软削波曲线（等效单位增益，绝对上限 0.97）
    E.master = E.gain(v.master == null ? 1 : v.master);
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 9; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    var pre = E.gain(0.5), sh = c.createWaveShaper();
    sh.curve = softClip(); sh.oversample = '2x';
    E.master.connect(comp); comp.connect(pre); pre.connect(sh); sh.connect(c.destination);
    var bg = v.bgm == null ? 0.5 : v.bgm;
    E.bus = { bgm: E.gain(bg), amb: E.gain(v.amb != null ? v.amb : bg * 0.7), sfx: E.gain(v.sfx == null ? 0.8 : v.sfx) };
    E.bus.bgm.connect(E.master); E.bus.amb.connect(E.master); E.bus.sfx.connect(E.master);
    E.rev = { bgm: E.reverb(3.4, 2.4, E.bus.bgm, 11), amb: E.reverb(2.2, 2.8, E.bus.amb, 12), sfx: E.reverb(2.6, 2.6, E.bus.sfx, 13) };
    // BGM 延迟：左右交替的回声
    var di = E.gain(1), d1 = c.createDelay(2), lp = E.filter('lowpass', 2800, 0.5), fb = E.gain(0.36), d2 = c.createDelay(2);
    var pl = E.pan(-0.55), pr = E.pan(0.55), dr = E.gain(0.8);
    d1.delayTime.value = 0.45; d2.delayTime.value = 0.45;
    di.connect(d1); d1.connect(lp); lp.connect(fb); fb.connect(d1);
    lp.connect(pl); pl.connect(E.bus.bgm); lp.connect(d2); d2.connect(dr); dr.connect(pr); pr.connect(E.bus.bgm);
    E.dly = di; E.dlyT = [d1, d2];
    // 波表
    E.waves = {
      piano: E.wave([0, 1, 0.55, 0.32, 0.22, 0.13, 0.09, 0.055, 0.035, 0.02, 0.015, 0.01]),
      reed: E.wave([0, 1, 0.06, 0.5, 0.04, 0.3, 0.03, 0.17, 0.02, 0.1, 0.01, 0.06]),
      horn: E.wave([0, 1, 0.7, 0.45, 0.3, 0.18, 0.1, 0.06, 0.03])
    };
  }
  var EP = Engine.prototype;
  EP.gain = function (v) { var g = this.ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; };
  EP.filter = function (type, f, q) { var b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
  EP.osc = function (type, f) { var o = this.ctx.createOscillator(); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; return o; };
  EP.pan = function (p) {
    if (!this.ctx.createStereoPanner) return this.gain(1);
    var n = this.ctx.createStereoPanner(); n.pan.value = clamp(p || 0, -1, 1); return n;
  };
  EP.shaper = function (curve) { var s = this.ctx.createWaveShaper(); s.curve = curve; return s; };
  EP.wave = function (h) {
    var re = new Float32Array(h.length), im = new Float32Array(h);
    return this.ctx.createPeriodicWave(re, im);
  };
  EP.reverb = function (secs, pow, dest, seed) {
    var c = this.ctx, sr = this.sr, n = Math.floor(sr * secs), b = c.createBuffer(2, n, sr), r = rng(seed), pre = Math.floor(sr * 0.014);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), lp = 0;
      for (var i = pre; i < n; i++) {
        var k = (i - pre) / (n - pre), a = 0.15 + 0.75 * k;           // 尾部越来越暗
        lp += (1 - a) * ((r() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - k, pow);
      }
      for (var e = 0; e < 7; e++) { var p = pre + Math.floor(sr * (0.004 + r() * 0.07)); if (p < n) d[p] += (r() > 0.5 ? 1 : -1) * (0.5 - e * 0.05); }
    }
    var cv = c.createConvolver(), inp = this.gain(1);
    cv.buffer = b; inp.connect(cv); cv.connect(dest);
    return inp;
  };
  /* 噪声缓存：4 秒、首尾无缝（滤波器跑两遍），RMS 归一 */
  EP.nbuf = function (kind) {
    var key = 'n_' + kind;
    if (this.cache[key]) return this.cache[key];
    var sr = this.sr, n = sr * 4, b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(hash(kind) + 5), w = new Float32Array(n), i, pass;
    for (i = 0; i < n; i++) w[i] = r() * 2 - 1;
    if (kind === 'pink') {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (pass = 0; pass < 2; pass++) for (i = 0; i < n; i++) {
        var x = w[i];
        b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362; b6 = x * 0.115926;
      }
    } else if (kind === 'brown') {
      var l = 0;
      for (pass = 0; pass < 2; pass++) for (i = 0; i < n; i++) { l = (l + 0.02 * w[i]) / 1.02; d[i] = l; }
    } else d.set(w);
    var s = 0, m = 0;
    for (i = 0; i < n; i++) m += d[i];
    m /= n;
    for (i = 0; i < n; i++) { d[i] -= m; s += d[i] * d[i]; }
    var k = 0.3 / Math.sqrt(s / n);
    for (i = 0; i < n; i++) d[i] *= k;
    return (this.cache[key] = b);
  };
  EP.noise = function (kind) {
    var s = this.ctx.createBufferSource(); s.buffer = this.nbuf(kind || 'white'); s.loop = true; s._off = this.r() * 3.5; return s;
  };
  /* 稀疏脉冲缓存（雨滴、火星、唱片噼啪），循环无缝 */
  EP.sparse = function (key, rate, l0, l1, pw, col) {
    if (this.cache[key]) return this.cache[key];
    var sr = this.sr, n = sr * 3, b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0), r = rng(hash(key)), cnt = Math.floor(rate * 3), mx = 0, i;
    for (var k = 0; k < cnt; k++) {
      var p = Math.floor(r() * n), L = Math.max(2, Math.floor(sr * (l0 + r() * (l1 - l0)))), A = Math.pow(r(), pw), lp = 0;
      for (var j = 0; j < L; j++) { lp += col * ((r() * 2 - 1) - lp); d[(p + j) % n] += A * lp * Math.exp(-5 * j / L); }
    }
    for (i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
    if (mx > 0) for (i = 0; i < n; i++) d[i] *= 0.9 / mx;
    return (this.cache[key] = b);
  };
  /* 并发声部限制：统计仍在发声的声部 */
  EP.ok = function (mult) {
    if (this.offline) return true;
    var now = this.ctx.currentTime, a = this.ends, j = 0;
    for (var i = 0; i < a.length; i++) if (a[i] > now) a[j++] = a[i];
    a.length = j;
    return j < this.maxVoices * (mult || 1);
  };
  /* 启动一组声源，统一在 t1 停止；播完自动 disconnect */
  EP.voice = function (t0, t1, srcs, nodes) {
    this.ends.push(t1);
    for (var i = 0; i < srcs.length; i++) {
      var s = srcs[i];
      if (s._off != null) s.start(t0, s._off); else s.start(t0);
      s.stop(t1);
    }
    var all = srcs.concat(nodes);
    srcs[0].onended = function () { for (var j = 0; j < all.length; j++) { try { all[j].disconnect(); } catch (e) { /* 已断开 */ } } };
  };
  /* 输出：可选声像（静态或自动化），dest 可为数组 */
  EP.out = function (node, dest, o, t, dur, nodes) {
    if (o && ((o.pan != null && o.pan !== 0) || o.pan1 != null)) {
      var p = this.pan(o.pan || 0);
      if (o.pan1 != null && p.pan) { p.pan.setValueAtTime(clamp(o.pan || 0, -1, 1), t); p.pan.linearRampToValueAtTime(clamp(o.pan1, -1, 1), t + (o.pt || dur)); }
      node.connect(p); nodes.push(p); node = p;
    }
    if (Array.isArray(dest)) { for (var i = 0; i < dest.length; i++) if (dest[i]) node.connect(dest[i]); }
    else node.connect(dest);
  };
  function freqAuto(prm, t, o) {
    prm.setValueAtTime(o.f, t);
    if (o.f1) prm.exponentialRampToValueAtTime(o.f1, t + (o.ft || ((o.a || 0) + (o.h || 0) + (o.d || 0.1))));
    if (o.fpts) for (var i = 0; i < o.fpts.length; i++) prm.exponentialRampToValueAtTime(o.fpts[i][1], t + o.fpts[i][0]);
  }
  /* AM：源 → am 增益（1-depth ± depth）→ 下游 */
  EP.amNode = function (o, srcs, nodes) {
    var g = this.gain(1 - o.am[1]), l = this.osc('sine', o.am[0]), lg = this.gain(o.am[1]);
    l.connect(lg); lg.connect(g.gain); srcs.push(l); nodes.push(g, lg);
    return g;
  };
  /* 通用音：{type,f,f1,ft,fpts,v,a,h,d,pan,pan1,lp,q,am,det} */
  EP.tone = function (dest, t, o) {
    var os = this.osc(o.type || 'sine', o.f), g = this.gain(0), srcs = [os], nodes = [g], node = os;
    freqAuto(os.frequency, t, o);
    if (o.det) os.detune.value = o.det;
    if (o.lp) { var f = this.filter('lowpass', o.lp, o.q); node.connect(f); node = f; nodes.push(f); }
    if (o.am) { var am = this.amNode(o, srcs, nodes); node.connect(am); node = am; }
    node.connect(g);
    var end = env(g.gain, t, o.v, o.a, o.h, o.d);
    this.out(g, dest, o, t, end - t, nodes);
    this.voice(t, end, srcs, nodes);
  };
  /* 滤波噪声爆发：{k,type,f,f1,ft,fpts,q,v,a,h,d,pan,pan1,am}；带通按 √Q 补偿响度 */
  EP.nb = function (dest, t, o) {
    var type = o.type || 'bandpass', q = o.q, s = this.noise(o.k), f = this.filter(type, o.f || 1000, q), g = this.gain(0), srcs = [s], nodes = [f, g], node = f;
    freqAuto(f.frequency, t, { f: o.f || 1000, f1: o.f1, ft: o.ft, fpts: o.fpts, a: o.a, h: o.h, d: o.d });
    s.connect(f);
    if (o.am) { var am = this.amNode(o, srcs, nodes); node.connect(am); node = am; }
    node.connect(g);
    var comp = (type === 'bandpass' && q > 1) ? Math.sqrt(q) : 1;
    var end = env(g.gain, t, o.v * comp, o.a, o.h, o.d);
    this.out(g, dest, o, t, end - t, nodes);
    this.voice(t, end, srcs, nodes);
  };
  EP.setDelay = function (sec, t) { this.dlyT.forEach(function (d) { d.delayTime.setTargetAtTime(clamp(sec, 0.05, 1.9), t, 0.25); }); };
  EP.setVol = function (v, muted) {
    var t = this.ctx.currentTime;
    function set(p, x) { p.cancelScheduledValues(t); p.setTargetAtTime(x, t, 0.04); }
    set(this.master.gain, muted ? 0 : (v.master == null ? 1 : v.master));
    set(this.bus.bgm.gain, v.bgm);
    set(this.bus.amb.gain, v.amb != null ? v.amb : v.bgm * 0.7);
    set(this.bus.sfx.gain, v.sfx);
  };
  /* 音效通道：干声 + 混响发送，寿命到了断开 */
  EP.strip = function (wet, life, gain) {
    var g = this.gain(gain || 1), w = null;
    g.connect(this.bus.sfx);
    if (wet) { w = this.gain(wet); g.connect(w); w.connect(this.rev.sfx); }
    return { g: g, w: w, life: life };
  };
  EP.sfx = function (id, t) {
    var s = SFX[id], last = this.lastSfx[id];
    if (!s || !this.ok(1.2)) return false;
    if (!this.offline) {
      if (last != null && t - last < 0.03) return false;                     // 同一帧重复触发只响一次
      var live = this.sfxEnds.filter(function (e) { return e > t; });
      if (live.length >= 10) return false;                                  // 同时最多 10 个音效实例
      live.push(t + Math.min(s.len, 3)); this.sfxEnds = live;
    }
    this.lastSfx[id] = t;
    var st = this.strip(s.wet, s.len, s.gain);
    var extra = s.fn(this, st.g, t) || [];
    if (!this.offline) {
      var ns_ = [st.g, st.w].concat(extra), ms = (s.len + 1) * 1000;
      setTimeout(function () { ns_.forEach(function (n) { try { n && n.disconnect(); } catch (e) { /* 忽略 */ } }); }, ms);
    }
    return true;
  };
  EP.tick = function (t) {
    this.nb(this.bus.sfx, t, { type: 'bandpass', f: 2800 + this.r() * 1400, q: 1.2, v: 0.09, a: 0.0006, d: 0.014 });
  };
  EP.start = function (kind, id, t, fade) {
    var def = kind === 'bgm' ? BGM[id] : AMB[id];
    if (!def) return null;
    var P = new Player(this, def, kind, id, t);
    P.fadeIn(t, fade);
    if (kind === 'bgm' && def.bpm) this.setDelay(60 / def.bpm * 0.75, t);
    this.players.push(P);
    return P;
  };
  EP.heart = function (bpm, t) {
    bpm = +bpm || 0;
    if (this.hb && this.hb.endAt === Infinity) {
      if (bpm > 0) { this.hb.sd = 60 / clamp(bpm, 30, 220); return this.hb; }
      this.hb.fadeOut(t, 0.4); this.hb = null; return null;
    }
    if (bpm > 0) {
      var P = new Player(this, HEART, 'sfx', 'heartbeat', t);
      P.sd = 60 / clamp(bpm, 30, 220); P.fadeIn(t, 0.2);
      this.players.push(P); this.hb = P;
      return P;
    }
    return null;
  };
  EP.pump = function (now, until) {
    var ps = this.players;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      if (now > p.killAt) { p.dispose(); ps.splice(i, 1); } else p.pump(now, until);
    }
  };

  /* ================================================================== Player（BGM / 环境音 / 心跳层） */
  function Player(E, def, kind, id, t) {
    this.E = E; this.def = def; this.kind = kind; this.id = id; this.t0 = t;
    this.nodes = []; this.srcs = [];
    this.out = this.node(E.gain(0)); this.out.connect(E.bus[kind]);
    this.inp = this.out; this.fades = [this.out];
    if (def.rev) { var w = this.node(E.gain(def.rev)); this.out.connect(w); w.connect(E.rev[kind]); }
    this.echo = null;
    if (kind === 'bgm') {
      this.echo = this.node(E.gain(def.echo || 0));
      var ef = this.node(E.gain(0)); this.echo.connect(ef); ef.connect(E.dly); this.fades.push(ef);
    }
    this.sd = def.stepDur || 60 / def.bpm / 4;
    this.step = 0; this.next = t + 0.03; this.loop = 0; this.endAt = Infinity; this.killAt = Infinity;
    this.rand = rng(hash(id) ^ Math.imul(++E.serial, 7919));
    this.st = {};
    if (def.chords) this.ch = parseChords(def.chords);
    if (def.mel) this.mel = seq(def.mel);
    if (def.setup) def.setup(this, t);
  }
  var PP = Player.prototype;
  PP.node = function (n) { this.nodes.push(n); return n; };
  PP.src = function (s) { this.srcs.push(s); return s; };
  PP.chord = function (bar, s) { var c = this.ch[bar % this.ch.length]; return c[s >= 8 ? 1 : 0]; };
  PP.fadeIn = function (t, f) {
    var L = this.def.level || 1;
    this.fades.forEach(function (g) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(L, t + Math.max(0.01, f)); });
  };
  PP.fadeOut = function (t, f) {
    if (this.endAt !== Infinity) return;
    this.fades.forEach(function (g) {
      var p = g.gain;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
      else { var v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
      p.linearRampToValueAtTime(0, t + f);
    });
    this.endAt = t + f;
    this.killAt = t + f + (this.def.tail || 1);
    var stop = t + f + 0.05;
    this.srcs.forEach(function (s) { try { s.stop(stop); } catch (e) { /* 已停止 */ } });
  };
  PP.dispose = function () {
    this.nodes.concat(this.srcs).forEach(function (n) { try { n.disconnect(); } catch (e) { /* 忽略 */ } });
    this.nodes = []; this.srcs = [];
  };
  PP.pump = function (now, until) {
    var d = this.def, sd = this.sd;
    if (!this.E.offline && this.next < now - 0.2) {           // 标签页被节流后追上，不补发旧音符
      var skip = Math.ceil((now - this.next) / sd);
      this.step += skip; this.next += skip * sd;
    }
    var lim = Math.min(until, this.endAt), guard = 0;
    if (!d.play) { this.next = Math.max(this.next, lim); return; }
    while (this.next < lim && guard++ < 5000) {
      if (d.bars) {
        var total = d.bars * 16, st = this.step % total;
        if (st === 0 && this.step > 0) this.loop++;
        var t = this.next + ((d.swing && (st & 3) === 2) ? d.swing * sd : 0);
        d.play(this, st >> 4, st & 15, t, st);
      } else d.play(this, this.step, this.next);
      this.step++; this.next += this.sd;
    }
  };

  /* ================================================================== 乐器 */
  var INS = {};
  INS.piano = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var f = mtof(m), a = E.osc(E.waves.piano, f), b = E.osc('sine', f * 2), bg = E.gain(0.12), lp = E.filter('lowpass', 8000, 0.5), g = E.gain(0);
    b.detune.value = 5;
    lp.frequency.setValueAtTime(Math.min(f * (o.bright || 7), 12000), t);
    lp.frequency.setTargetAtTime(Math.min(f * 2.5 + 300, 6000), t + 0.005, 0.3);
    var tc = 0.35 + 1.4 * clamp((90 - m) / 50, 0, 1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.setTargetAtTime(v * 0.4, t + 0.004, 0.08);
    g.gain.setTargetAtTime(0, t + 0.12, tc);
    var off = t + Math.max(0.13, Math.min(dur, 5));
    g.gain.setTargetAtTime(0, off, 0.07);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g);
    var nodes = [bg, lp, g];
    E.out(g, d, o, t, off - t, nodes); E.voice(t, off + 0.45, [a, b], nodes);
  };
  INS.pchord = function (E, d, t, notes, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var cut = o.cut || 3800, lp = E.filter('lowpass', cut, 0.4), g = E.gain(0), srcs = [];
    notes.forEach(function (m) { var s = E.osc(E.waves.piano, mtof(m)); s.detune.value = (E.r() - 0.5) * 7; s.connect(lp); srcs.push(s); });
    lp.frequency.setValueAtTime(cut, t); lp.frequency.setTargetAtTime(cut * 0.35, t, 0.25);
    var pk = v / Math.sqrt(notes.length);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.005);
    g.gain.setTargetAtTime(pk * 0.45, t + 0.005, 0.1); g.gain.setTargetAtTime(0, t + 0.15, 0.9);
    var off = t + Math.max(0.16, Math.min(dur, 4));
    g.gain.setTargetAtTime(0, off, 0.06);
    lp.connect(g);
    var nodes = [lp, g];
    E.out(g, d, o, t, off - t, nodes); E.voice(t, off + 0.4, srcs, nodes);
  };
  INS.mbox = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var f = mtof(m), g = E.gain(1), srcs = [], nodes = [g];
    [[1, 1, 1.8], [3.01, 0.22, 0.5], [5.93, 0.07, 0.18]].forEach(function (p) {
      var s = E.osc('sine', f * p[0]), pg = E.gain(0);
      pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(v * p[1], t + 0.002); pg.gain.setTargetAtTime(0, t + 0.002, p[2] / 5);
      s.connect(pg); pg.connect(g); srcs.push(s); nodes.push(pg);
    });
    E.out(g, d, o, t, 2, nodes); E.voice(t, t + 2.3, srcs, nodes);
  };
  function fmBell(E, d, t, f, v, ratio, index, dec, pan) {
    var car = E.osc('sine', f), mod = E.osc('sine', f * ratio), mg = E.gain(0), g = E.gain(0), nodes = [mg, g];
    mg.gain.setValueAtTime(f * index, t); mg.gain.setTargetAtTime(f * index * 0.04, t, dec / 5);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, dec / 5);
    E.out(g, d, { pan: pan }, t, dec, nodes); E.voice(t, t + dec * 1.3 + 0.05, [car, mod], nodes);
  }
  INS.bell = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    fmBell(E, d, t, o.hz || mtof(m), v, o.ratio || 3.5, o.index == null ? 2 : o.index, o.decay || 2.5, o.pan);
  };
  /* Karplus-Strong 拨弦：分数延迟 + 平均滤波，按音高缓存波形 */
  function ksBuf(E, m, bright, sus) {
    var key = 'ks' + m + '_' + bright + '_' + sus;
    if (E.cache[key]) return E.cache[key];
    var sr = E.sr, f = mtof(m), len = clamp(sus * 1.15, 0.6, 4), n = Math.floor(sr * len);
    var b = E.ctx.createBuffer(1, n, sr), y = b.getChannelData(0), r = rng(m * 131 + 7);
    var D = sr / f - 0.5, N0 = Math.min(n, Math.ceil(D) + 2), lp = 0, i, mean = 0, mx = 0;
    var rho = Math.pow(0.001, (1 / f) / sus);
    for (i = 0; i < N0; i++) { lp += bright * ((r() * 2 - 1) - lp); y[i] = lp; mean += lp; }
    mean /= N0;
    for (i = 0; i < N0; i++) y[i] -= mean;
    for (i = N0; i < n; i++) {
      var p = i - D, i0 = Math.floor(p), fr = p - i0;
      var a1 = y[i0] + (y[i0 + 1] - y[i0]) * fr, a0 = y[i0 - 1] + (y[i0] - y[i0 - 1]) * fr;
      y[i] = rho * 0.5 * (a1 + a0);
    }
    for (i = 0; i < n; i++) mx = Math.max(mx, Math.abs(y[i]));
    var k = mx > 0 ? 0.9 / mx : 1, fade = Math.floor(sr * 0.03);
    for (i = 0; i < n; i++) y[i] *= k * (i > n - fade ? (n - i) / fade : 1);
    return (E.cache[key] = b);
  }
  INS.pluck = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var s = E.ctx.createBufferSource(), g = E.gain(v), nodes = [g];
    s.buffer = ksBuf(E, m, o.bright || 0.5, o.sus || 1.6);
    s.connect(g);
    E.out(g, d, o, t, 1, nodes); E.voice(t, t + s.buffer.duration, [s], nodes);
  };
  INS.pad = function (E, d, t, notes, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var a = o.a || 1.2, r = o.r || 2, cut = o.cut || 1400, type = o.type || 'sawtooth', det = o.det == null ? 8 : o.det;
    var lpL = E.filter('lowpass', cut, o.q || 0.7), lpR = E.filter('lowpass', cut, o.q || 0.7), pL = E.pan(-0.55), pR = E.pan(0.55), g = E.gain(0), srcs = [];
    notes.forEach(function (m) {
      var f = mtof(m), s1 = E.osc(type, f), s2 = E.osc(type, f);
      s1.detune.value = -det; s2.detune.value = det; s1.connect(lpL); s2.connect(lpR); srcs.push(s1, s2);
    });
    if (o.sweep) [lpL, lpR].forEach(function (l) { l.frequency.setValueAtTime(cut * 0.35, t); l.frequency.linearRampToValueAtTime(cut, t + dur * 0.8); });
    lpL.connect(pL); lpR.connect(pR); pL.connect(g); pR.connect(g);
    var pk = v / Math.sqrt(notes.length), off = t + Math.max(dur, a + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a); g.gain.setTargetAtTime(0, off, r / 5);
    var nodes = [lpL, lpR, pL, pR, g];
    E.out(g, d, null, t, dur, nodes); E.voice(t, off + r * 1.3, srcs, nodes);
  };
  INS.bass = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var f = mtof(m), cut = o.cut || 700, s = E.osc(o.type || 'triangle', f), sub = E.osc('sine', f), lp = E.filter('lowpass', cut, o.q || 1), g = E.gain(0), sg = E.gain(o.sub == null ? 0.5 : o.sub);
    if (o.env) { lp.frequency.setValueAtTime(cut * o.env, t); lp.frequency.setTargetAtTime(cut, t, 0.07); }
    s.connect(lp); sub.connect(sg); sg.connect(lp); lp.connect(g);
    var a = o.a || 0.006, rel = o.r || 0.05, off = t + Math.max(dur, a + 0.02);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(v * (o.s == null ? 0.55 : o.s), t + a, o.dk || 0.25);
    g.gain.setTargetAtTime(0, off, rel / 4.5);
    var nodes = [lp, g, sg];
    E.out(g, d, null, t, dur, nodes); E.voice(t, off + rel * 1.6 + 0.01, [s, sub], nodes);
  };
  INS.lead = function (E, d, t, m, dur, v, o) {
    if (!E.ok()) return; o = o || {};
    var f = mtof(m), s = E.osc(o.type || 'sawtooth', f), lp = E.filter('lowpass', o.cut || 2000, o.q || 0.8), g = E.gain(0);
    var vib = E.osc('sine', o.vr || 5.2), vg = E.gain(0), srcs = [s, vib], nodes = [lp, g, vg];
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * (o.vd || 0.006), t + Math.min(0.5, dur * 0.5) + 0.05);
    vib.connect(vg); vg.connect(s.frequency);
    if (o.slide) { s.frequency.setValueAtTime(f * Math.pow(2, -o.slide / 12), t); s.frequency.exponentialRampToValueAtTime(f, t + 0.09); }
    s.connect(lp);
    if (o.breath) {
      var n = E.noise('white'), bf = E.filter('bandpass', Math.min(f * 2, 9000), 1.5), bgn = E.gain(o.breath);
      n.connect(bf); bf.connect(bgn); bgn.connect(lp); srcs.push(n); nodes.push(bf, bgn);
    }
    lp.connect(g);
    var a = o.a || 0.06, r = o.r || 0.25, off = t + Math.max(dur, a + 0.02);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(v * 0.8, t + a, 0.3); g.gain.setTargetAtTime(0, off, r / 5);
    E.out(g, d, o, t, dur, nodes); E.voice(t, off + r * 1.3, srcs, nodes);
  };
  INS.stac = function (E, d, t, m, dur, v) {
    if (!E.ok()) return;
    E.tone(d, t, { type: 'sawtooth', f: mtof(m), v: v, a: 0.004, h: dur * 0.5, d: 0.08, lp: 2400 });
  };
  INS.drum = function (E, d, t, f0, f1, dec, v, o) {
    if (!E.ok(1.2)) return; o = o || {};
    E.tone(d, t, { type: o.type || 'sine', f: f0, f1: f1, ft: dec * 0.5, v: v, a: 0.002, d: dec, pan: o.pan });
    if (o.nv) E.nb(d, t, { k: o.nk || 'white', type: 'lowpass', f: o.nf || 1200, v: o.nv, a: 0.001, d: o.nd || 0.06 });
  };
  INS.hat = function (E, d, t, v) { if (E.ok()) E.nb(d, t, { type: 'highpass', f: 7500, v: v, a: 0.001, d: 0.04 }); };
  INS.drip = function (E, d, t, f, v, o) {
    if (!E.ok()) return; o = o || {};
    E.tone(d, t, { f: f, fpts: [[0.05, f * 1.7]], v: v, a: 0.0015, d: 0.16, pan: o.pan });
  };
  INS.scrape = function (E, d, t, f, dur, v, o) {
    if (!E.ok()) return;
    E.nb(d, t, { type: 'bandpass', f: f, fpts: [[dur * 0.5, f * 1.06], [dur, f * 0.96]], q: 40, v: v, a: dur * 0.4, h: dur * 0.2, d: dur * 0.5, pan: o && o.pan });
  };
  /* 颂钵：成对微差的非谐分音产生拍频，长余音 */
  INS.bowl = function (E, d, t, m, v, o) {
    if (!E.ok()) return; o = o || {};
    var f = mtof(m), g = E.gain(1), srcs = [], nodes = [g];
    [[1, 1, 8, 0.9], [2.76, 0.45, 5.5, 1.4], [5.1, 0.2, 3.4, 1.9], [8.2, 0.08, 2.2, 2.6]].forEach(function (p) {
      for (var k = 0; k < 2; k++) {
        var s = E.osc('sine', f * p[0] + (k ? p[3] : 0)), pg = E.gain(0);
        pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(v * p[1] * 0.5, t + 0.012); pg.gain.setTargetAtTime(0, t + 0.012, p[2] / 5);
        s.connect(pg); pg.connect(g); srcs.push(s); nodes.push(pg);
      }
    });
    E.out(g, d, o, t, 8, nodes); E.voice(t, t + 10, srcs, nodes);
    E.nb(d, t, { type: 'bandpass', f: f * 2.76, q: 3, v: v * 0.25, a: 0.001, d: 0.04 });
  };
  function lubdub(E, d, t, v) {
    E.tone(d, t, { type: 'triangle', f: 64, f1: 38, ft: 0.12, v: 0.85 * v, a: 0.006, d: 0.17, lp: 260 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 190, v: 0.55 * v, a: 0.004, d: 0.08 });
    E.tone(d, t + 0.2, { type: 'triangle', f: 56, f1: 36, ft: 0.1, v: 0.6 * v, a: 0.006, d: 0.14, lp: 240 });
    E.nb(d, t + 0.2, { k: 'brown', type: 'lowpass', f: 170, v: 0.38 * v, a: 0.004, d: 0.06 });
  }

  /* ================================================================== 环境音助手 */
  function loopN(P, t, src, filters, v, pan, dest) {
    var E = P.E, s;
    if (typeof src === 'string') s = E.noise(src);
    else { s = E.ctx.createBufferSource(); s.buffer = src; s.loop = true; s._off = E.r() * src.duration * 0.9; }
    var node = s, fl = [], comp = 1;
    filters.forEach(function (x) {
      var f = E.filter(x[0], x[1], x[2]); node.connect(f); node = f; fl.push(P.node(f));
      if (x[0] === 'bandpass' && x[2] > 1) comp *= Math.sqrt(x[2]);
    });
    var g = P.node(E.gain(v * comp)); node.connect(g); node = g;
    if (pan) { var p = P.node(E.pan(pan)); g.connect(p); node = p; }
    node.connect(dest || P.inp);
    s.start(t, s._off); P.src(s);
    return { s: s, f: fl, g: g };
  }
  function lfo(P, t, rate, depth, param, type) {
    var E = P.E, o = P.src(E.osc(type || 'sine', rate)), g = P.node(E.gain(depth));
    o.connect(g); g.connect(param); o.start(t);
    return o;
  }
  function passCar(E, d, t, dur, dir, v) {
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 420, fpts: [[dur * 0.5, 900], [dur, 380]], q: 0.8, v: v, a: dur * 0.48, h: 0.05, d: dur * 0.45, pan: -0.8 * dir, pan1: 0.8 * dir, pt: dur });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 220, v: v * 0.8, a: dur * 0.48, h: 0.05, d: dur * 0.45, pan: -0.6 * dir, pan1: 0.6 * dir, pt: dur });
  }
  function babble(P, t, list, v) {
    list.forEach(function (x, i) {
      var l = loopN(P, t, 'pink', [['bandpass', x[0], 2.2]], v, x[2]);
      lfo(P, t, x[1], v * 0.7, l.g.gain);
      lfo(P, t, x[1] * 0.37 + 0.13, v * 0.35, l.g.gain);
      lfo(P, t, 0.23 + i * 0.11, x[0] * 0.28, l.f[0].frequency);
    });
  }
  function voiceBlip(E, d, t, r, v) {   // 人声片段（惊叹/笑）
    var f0 = 150 + r() * 200, L = 0.15 + r() * 0.3, o = E.osc('sawtooth', f0), b1 = E.filter('bandpass', 650 + r() * 300, 5), b2 = E.filter('bandpass', 1100 + r() * 500, 7), g = E.gain(0), nodes = [b1, b2, g];
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (1.05 + r() * 0.25), t + L * 0.4); o.frequency.linearRampToValueAtTime(f0 * 0.85, t + L);
    o.connect(b1); o.connect(b2); b1.connect(g); b2.connect(g);
    var end = env(g.gain, t, v, 0.04, L * 0.6, L * 0.6);
    E.out(g, d, { pan: (r() - 0.5) * 1.4 }, t, end - t, nodes); E.voice(t, end, [o], nodes);
  }
  function bird(E, d, t, r) {
    var kind = Math.floor(r() * 3), v = 0.05 + r() * 0.06, o = E.osc('sine', 3000), g = E.gain(0), nodes = [g], f = o.frequency, gg = g.gain, tt = t, k, base;
    f.setValueAtTime(3000, t); gg.setValueAtTime(0, t);
    if (kind === 0) {           // 急促颤音
      var n = 4 + Math.floor(r() * 6); base = 2800 + r() * 1800;
      for (k = 0; k < n; k++) { f.setValueAtTime(base, tt); f.exponentialRampToValueAtTime(base * 1.45, tt + 0.035); gg.setValueAtTime(0, tt); gg.linearRampToValueAtTime(v, tt + 0.008); gg.linearRampToValueAtTime(0, tt + 0.04); tt += 0.065; }
    } else if (kind === 1) {    // 两声口哨
      base = 2000 + r() * 900;
      f.setValueAtTime(base, tt); f.exponentialRampToValueAtTime(base * 1.3, tt + 0.25); gg.linearRampToValueAtTime(v, tt + 0.05); gg.setValueAtTime(v, tt + 0.2); gg.linearRampToValueAtTime(0, tt + 0.27);
      tt += 0.36;
      f.setValueAtTime(base * 1.12, tt); f.exponentialRampToValueAtTime(base * 0.9, tt + 0.3); gg.setValueAtTime(0, tt); gg.linearRampToValueAtTime(v * 0.9, tt + 0.04); gg.setValueAtTime(v * 0.9, tt + 0.24); gg.linearRampToValueAtTime(0, tt + 0.31);
      tt += 0.32;
    } else {                    // 下滑啁啾
      var cnt = 1 + Math.floor(r() * 3); base = 4200 + r() * 1500;
      for (k = 0; k < cnt; k++) { f.setValueAtTime(base, tt); f.exponentialRampToValueAtTime(base * 0.55, tt + 0.09); gg.setValueAtTime(0, tt); gg.linearRampToValueAtTime(v, tt + 0.01); gg.linearRampToValueAtTime(0, tt + 0.1); tt += 0.16; }
    }
    o.connect(g);
    E.out(g, d, { pan: (r() - 0.5) * 1.5 }, t, tt - t, nodes); E.voice(t, tt + 0.05, [o], nodes);
  }
  function cricket(P, t, f, pr, cr, pan, v) {
    var E = P.E, o = P.src(E.osc('sine', f)), gA = P.node(E.gain(0)), gB = P.node(E.gain(0)), gC = P.node(E.gain(v)), p = P.node(E.pan(pan));
    var l1 = P.src(E.osc('sine', pr)), s1 = P.node(E.shaper(pulseCurve(2, 0.1))), l2 = P.src(E.osc('sine', cr)), s2 = P.node(E.shaper(pulseCurve(1, 0.55)));
    l1.connect(s1); s1.connect(gA.gain); l2.connect(s2); s2.connect(gB.gain);
    o.connect(gA); gA.connect(gB); gB.connect(gC); gC.connect(p); p.connect(P.inp);
    var t0 = t + E.r() * 0.4;
    o.start(t0); l1.start(t0); l2.start(t0);
  }

  /* ================================================================== BGM */
  var BGM = {};

  /* 标题：a 小调。低沉弦乐长音 + 八音盒动机（E7 上的 c6 是 b9，诡秘） + 稀疏钢琴 */
  BGM.title = {
    bpm: 60, bars: 16, rev: 0.55, echo: 0.28, tail: 5,
    chords: 'a2 e3 a3 c4|=|f2 c3 e3 a3|=|d2 a2 d3 f3|=|e2 b2 e3 g#3|=|a2 e3 a3 c4|=|bb1 f2 bb2 d3|=|f2 a2 d3 f3|=|e2 b2 d3 g#3|=',
    mel: 'e5/4 a5/4 b5/2 c6/6 | b5/4 a5/4 e5/8 | e5/4 a5/4 b5/2 c6/6 | e6/8 c6/8 | f5/4 a5/4 d6/2 c6/6 | a5/8 r/8 | g#5/4 b5/4 d6/2 c6/6 | b5/4 g#5/4 e5/8 |' +
         'e5/4 a5/4 b5/2 c6/6 | b5/4 a5/4 e5/8 | f5/4 bb5/4 d6/2 c6/6 | bb5/4 a5/4 f5/8 | a5/4 d6/4 f6/2 e6/6 | d6/4 c6/4 a5/8 | g#5/4 b5/4 d6/2 c6/6 | b5/8 g#5/4 r/4',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand;
      if (s === 0 && bar % 2 === 0) {
        INS.pad(E, o, t, ch.slice(1), sd * 32, 0.1, { a: 3, r: 3.5, cut: 850, det: 6 });
        INS.bass(E, o, t, ch[0], sd * 30, 0.16, { type: 'sine', sub: 0.3, cut: 300, a: 1.2, s: 0.8, dk: 2, r: 1.5 });
      }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.mbox(E, [o, P.echo], t, e[0], e[1] * sd, 0.2); });
      if (s === 8 && bar % 2 === 1 && r() < 0.75) INS.piano(E, o, t, ch[1 + Math.floor(r() * 3)], sd * 8, 0.14, { bright: 4 });
      if (P.loop > 0 && s === 12 && r() < 0.25) INS.piano(E, [o, P.echo], t, ch[3] + 24, sd * 4, 0.06);
    }
  };

  /* 悬疑：d 小调。D/A 低频长音 + 暗弦 + 零星钢琴单音（带延迟回声） */
  BGM.mystery = {
    bpm: 72, bars: 16, rev: 0.5, echo: 0.4, tail: 5,
    chords: 'd2 a2 d3 f3|=|bb1 f2 a2 d3|=|g1 d2 bb2 e3|=|a1 e2 g2 c#3|=|d2 a2 d3 f3|=|eb2 bb2 d3 g3|=|g1 d2 g2 bb2|=|a1 e2 a2 c#3|=',
    mel: 'r/4 d5/6 a4/6 | f5/8 e5/8 | r/4 d5/6 bb4/6 | a4/16 | r/4 g5/6 e5/6 | d5/8 bb4/8 | r/4 c#5/6 e5/6 | g5/8 r/8 |' +
         'r/16 | r/8 a5/8 | r/4 g5/6 bb4/6 | d5/16 | r/8 bb4/8 | d5/4 g4/12 | r/4 e5/4 c#5/8 | a4/16',
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 260, 1)), g = P.node(E.gain(0.07));
      [[38, 0], [38, 7], [45, -5]].forEach(function (x) { var s = P.src(E.osc('triangle', mtof(x[0]))); s.detune.value = x[1]; s.connect(lp); s.start(t); });
      lp.connect(g); g.connect(P.inp);
      lfo(P, t, 0.07, 0.03, g.gain); lfo(P, t, 0.05, 90, lp.frequency);
    },
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand;
      if (s === 0 && bar % 2 === 0) INS.pad(E, o, t, ch, sd * 32, 0.08, { a: 2.5, r: 3, cut: 600, det: 5 });
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.piano(E, [o, P.echo], t, e[0], e[1] * sd, 0.2, { bright: 5 }); });
      if (s % 4 === 2 && r() < 0.06) INS.piano(E, [o, P.echo], t, ch[1 + Math.floor(r() * 3)] + 24, sd * 3, 0.07, { bright: 3 });
    }
  };

  /* 日常：F 大调爵士色彩（maj9/m9/13），摇摆切分钢琴 + 贝斯 + 刷子 */
  BGM.daily = {
    bpm: 96, bars: 16, swing: 0.33, rev: 0.2, echo: 0.1,
    chords: 'f2 a3 c4 e4 g4|d2 f3 a3 c4 e4|g2 bb3 d4 f4 a4|c2 bb3 d4 e4 a4|f2 a3 c4 e4 g4|a1 g3 c4 e4|bb1 a3 d4 f4|c2 bb3 c4 f4 g4|' +
            'd2 f3 a3 c4 e4|a1 g3 c4 e4|bb1 a3 d4 f4|a1 a3 c4 f4|g2 bb3 d4 f4 a4|c2 bb3 d4 e4 a4|f2 a3 c4 e4 g4|c2 bb3 c4 f4 g4',
    mel: 'r/4 a4/2 c5/2 e5/6 d5/2 | c5/4 a4/4 f4/8 | r/4 bb4/2 d5/2 f5/6 e5/2 | d5/4 c5/4 g4/8 | r/2 a5/2 g5/2 f5/2 e5/4 c5/4 | e5/12 r/4 | r/4 d5/2 f5/2 a5/4 g5/4 | f5/4 e5/4 d5/2 c5/6 |' +
         'r/8 f5/2 e5/2 d5/4 | c5/8 e5/8 | d5/4 f5/4 a5/8 | g5/2 f5/2 e5/4 c5/8 | r/4 bb4/4 d5/4 f5/4 | e5/6 g5/2 bb5/8 | a5/12 g5/4 | f5/4 r/12',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand, root = ch[0], vo = ch.slice(1);
      var pat = (bar + P.loop) % 2 ? [[0, 5, 0.16], [6, 2, 0.11], [10, 5, 0.14]] : [[0, 3, 0.16], [3, 3, 0.11], [8, 2, 0.1], [12, 4, 0.13]];
      pat.forEach(function (p) { if (p[0] === s) INS.pchord(E, o, t, vo, p[1] * sd, p[2]); });
      var bo = { type: 'triangle', cut: 520, env: 2.5, sub: 0.7, s: 0.45, dk: 0.2, r: 0.06 };
      var nx = P.chord((bar + 1) % 16, 0)[0];
      if (s === 0) INS.bass(E, o, t, root, sd * 6, 0.32, bo);
      if (s === 8) INS.bass(E, o, t, root + 7, sd * 4, 0.26, bo);
      if (s === 14) INS.bass(E, o, t, nx + (nx > root ? -1 : 1), sd * 2, 0.22, bo);
      if (s === 12 && r() < 0.5) INS.bass(E, o, t, root + 12, sd * 2, 0.2, bo);
      if (s % 4 === 2) INS.hat(E, o, t, 0.05);
      if (s === 4 || s === 12) { if (E.ok()) E.nb(o, t, { type: 'bandpass', f: 2200, q: 0.8, v: 0.07, a: 0.004, d: 0.13 }); }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.piano(E, [o, P.echo], t, e[0] + (P.loop % 2 && bar >= 8 ? 12 : 0), e[1] * sd, 0.21, { bright: 6 }); });
    }
  };

  /* 图书馆：e 小调。钟表般均匀的八分拨弦琶音 + 滴答 + 高音拨弦旋律 */
  BGM.library = {
    bpm: 84, bars: 16, rev: 0.35, echo: 0.2,
    chords: 'e3 b3 f#4 g4|c3 g3 b3 e4|a2 e3 g3 c4|b2 f#3 a3 e4|e3 b3 d4 g4|d3 g3 b3 d4|c3 e3 a3 c4|b2 d#3 a3 f#4|' +
            'e3 b3 f#4 g4|c3 g3 b3 e4|a2 e3 g3 c4|b2 f#3 a3 e4|e3 b3 d4 g4|d3 g3 b3 d4|c3 e3 a3 c4|b2 d#3 a3 f#4',
    mel: 'r/8 b5/4 a5/4 | g5/12 e5/4 | c6/8 b5/4 a5/4 | f#5/16 | r/8 b5/4 a5/4 | g5/8 b5/8 | e6/8 c6/4 a5/4 | b5/16 |' +
         'r/16 | e5/8 g5/8 | a5/12 g5/4 | f#5/8 e5/4 d#5/4 | e5/16 | d5/8 g5/8 | c5/4 e5/4 a5/8 | b5/16',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s);
      if (s === 0) INS.pluck(E, o, t, ch[0] - 12, sd * 16, 0.34, { bright: 0.3, sus: 2.5 });
      if (s % 2 === 0) { var ix = [0, 1, 2, 3, 2, 1, 3, 2][s >> 1]; INS.pluck(E, o, t, ch[ix], sd * 2, s === 0 ? 0.2 : 0.15, { bright: 0.5, sus: 1.4, pan: (ix - 1.5) * 0.25 }); }
      if (s % 4 === 0 && E.ok()) E.nb(o, t, { type: 'bandpass', f: s % 8 === 0 ? 3300 : 2500, q: 5, v: 0.05, a: 0.0005, d: 0.02 });
      if (s === 0 && bar % 4 === 0) INS.pad(E, o, t, ch.slice(1), sd * 64, 0.04, { type: 'triangle', a: 3, r: 3, cut: 900 });
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.pluck(E, [o, P.echo], t, e[0], e[1] * sd, 0.26, { bright: 0.75, sus: 2 }); });
    }
  };

  /* 回忆：G 大调五声 + 副属和弦的老上海时代曲。整体经过带通 + 抖晃（wow/flutter），叠唱片噼啪与转盘隆隆 */
  BGM.oldtimes = {
    bpm: 76, bars: 16, swing: 0.2, rev: 0.3, echo: 0.05, tail: 3,
    chords: 'g2 b3 d4|e2 g3 b3|c3 e3 g3|d2 f#3 c4|g2 b3 d4|e2 g3 b3|a2 g3 c4|d2 f#3 c4|b2 a3 d4|e2 g#3 d4|a2 g3 c4|d2 f#3 c4|g2 b3 d4|e2 g3 d4|a2 g3 c4;d2 f#3 c4|g2 b3 d4',
    mel: 'd5/6 e5/2 d5/4 b4/4 | g4/6 a4/2 b4/8 | e5/6 g5/2 e5/4 d5/4 | a4/12 r/4 | b4/6 d5/2 e5/4 g5/4 | a5/6 g5/2 e5/8 | d5/4 e5/4 g5/4 e5/4 | d5/12 r/4 |' +
         'd5/6 f#5/2 a5/4 f#5/4 | g#5/6 e5/2 d5/8 | c5/6 e5/2 a5/4 g5/4 | f#5/8 a5/4 r/4 | b5/6 a5/2 g5/4 e5/4 | d5/6 e5/2 g5/8 | a4/4 c5/4 b4/4 a4/4 | g4/12 r/4',
    setup: function (P, t) {
      var E = P.E, inp = P.node(E.gain(1)), hp = P.node(E.filter('highpass', 160, 0.7)), lp = P.node(E.filter('lowpass', 3000, 0.9)), dl = P.node(E.ctx.createDelay(0.1));
      dl.delayTime.value = 0.012;
      inp.connect(hp); hp.connect(lp); lp.connect(dl); dl.connect(P.out);
      lfo(P, t, 0.55, 0.0018, dl.delayTime); lfo(P, t, 6.3, 0.00008, dl.delayTime);
      P.inp = inp;
      loopN(P, t, E.sparse('crackle', 14, 0.0003, 0.0016, 2.5, 1), [['highpass', 900, 0.7]], 0.2, 0, P.out);
      loopN(P, t, E.sparse('dust', 600, 0.0002, 0.0008, 5, 1), [['highpass', 2000, 0.7]], 0.06, 0, P.out);
      loopN(P, t, 'white', [['bandpass', 4500, 0.8]], 0.012, 0, P.out);
      var rum = loopN(P, t, 'brown', [['lowpass', 90]], 0.06, 0, P.out);
      lfo(P, t, 1.3, 0.03, rum.g.gain);
    },
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand;
      var bo = { type: 'triangle', cut: 900, s: 0.3, dk: 0.12, r: 0.08 };
      if (s === 0) INS.bass(E, o, t, ch[0], sd * 3.5, 0.34, bo);
      if (s === 8) INS.bass(E, o, t, ch[0] + 7, sd * 3.5, 0.28, bo);
      if (s === 4 || s === 12) {
        INS.pchord(E, o, t, ch.slice(1), sd * 1.6, 0.17, { cut: 2600 });
        if (E.ok()) E.nb(o, t, { type: 'bandpass', f: 3000, q: 0.7, v: 0.04, a: 0.003, d: 0.1 });
      }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.lead(E, o, t, e[0], e[1] * sd * 0.95, 0.13, { type: E.waves.reed, cut: 2400, vd: 0.009, vr: 5.6, a: 0.05, r: 0.2, slide: r() < 0.3 ? 1 : 0 }); });
      if (P.loop % 2 === 1 && s === 0) INS.lead(E, o, t, ch[ch.length - 1] + 12, sd * 15, 0.05, { type: 'sawtooth', cut: 1800, vd: 0.012, a: 0.4, r: 0.5 });
    }
  };

  /* 紧张：c 小调。八分脉冲低音（末拍半音上行）、小二度弦乐颤奏、逐步加入定音鼓与心跳，整段渐强 */
  BGM.tension = {
    bpm: 120, bars: 16, rev: 0.3, echo: 0.08,
    chords: 'c2 g2 c3 eb3|=|=|=|ab1 eb2 ab2 c3|=|f1 c2 f2 ab2|=|c2 g2 c3 eb3|=|db2 ab2 db3 f3|=|g1 d2 g2 b2|=|g1 b1 f2 ab2|=',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s);
      var k = (P.loop ? 0.55 : 0.3) + (P.loop ? 0.45 : 0.7) * bar / 15;
      if (s % 2 === 0) {
        var m = ch[0] + (s === 14 ? 1 : 0) + (s === 6 && bar % 2 ? 12 : 0);
        INS.bass(E, o, t, m, sd * 1.5, (s === 0 ? 0.36 : 0.26) * (0.7 + 0.3 * k), { type: 'sawtooth', cut: 180 + 700 * k, env: 3, q: 4, s: 0.2, dk: 0.08, r: 0.04, sub: 0.6 });
      }
      if (s === 0 && bar % 2 === 0) INS.pad(E, o, t, ch.slice(1).map(function (x) { return x + 12; }), sd * 32, 0.05 + 0.05 * k, { a: 1.5, r: 1.5, cut: 700 + 1500 * k, sweep: true });
      if (bar >= 4) INS.stac(E, o, t, ch[3] + 12 - (s % 2), sd * 0.8, 0.02 + 0.035 * k);
      if (bar >= 8 && (s === 0 || s === 8)) INS.drum(E, o, t, 95, 48, 0.45, 0.4 * k, { nv: 0.14, nf: 600 });
      if (bar === 15 && s >= 8) INS.drum(E, o, t, 120, 60, 0.18, 0.1 + 0.035 * (s - 8), { nv: 0.05 });
      if (bar >= 12 && s % 4 === 0) lubdub(E, o, t, 0.55 * k);
      if (bar >= 12 && s === 0) INS.pad(E, o, t, [ch[1] + 24, ch[1] + 25, ch[2] + 24], sd * 12, 0.035, { a: 0.8, r: 1, cut: 3000, det: 12 });
    }
  };

  /* 恐怖：不协和音簇（小二度 + 三全音）缓慢换位，66bpm 心跳，金属刮擦，次声重击 */
  BGM.dread = {
    bpm: 66, bars: 16, rev: 0.6, echo: 0.2, tail: 6,
    chords: 'c2 db2 g2 ab2|=|=|=|b1 c2 f#2 g2|=|=|=|d2 eb2 ab2 a2|=|=|=|c2 db2 f#2 g2|=|=|=',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand;
      if (s === 0 && bar % 4 === 0) {
        INS.pad(E, o, t, ch, sd * 64, 0.14, { a: 4, r: 4, cut: 520, det: 14, q: 3 });
        INS.pad(E, o, t, [ch[0] + 48, ch[1] + 48], sd * 60, 0.02, { type: 'sine', a: 6, r: 4, cut: 6000, det: 9 });
        INS.drum(E, o, t, 58, 28, 2.2, 0.5, { nv: 0.2, nf: 200, nd: 0.5, nk: 'brown' });
      }
      if (s % 4 === 0) lubdub(E, o, t + 0.02, 0.6);
      if (bar % 4 === 3 && s === 4) INS.scrape(E, o, t, 600 + r() * 900, 3.5, 0.22, { pan: (r() - 0.5) * 1.2 });
      if ((s === 6 || s === 14) && r() < 0.14) {
        var b = ch[0] + 24;
        INS.piano(E, [o, P.echo], t, b, sd * 4, 0.1, { bright: 3 }); INS.piano(E, [o, P.echo], t, b + 1, sd * 4, 0.08, { bright: 3 });
      }
      if (bar === 15 && s === 0 && E.ok()) E.nb(o, t, { k: 'pink', type: 'bandpass', f: 300, f1: 3000, ft: 3.6, q: 2, v: 0.12, a: 3.4, d: 0.3 });
    }
  };

  /* 地下：a 小调 ↔ f 小调（半音中音关系），深沉嗡鸣 + 远处滴水点音 + 低沉 FM 钟 */
  BGM.underground = {
    bpm: 50, bars: 16, rev: 0.7, echo: 0.45, tail: 6,
    chords: 'a2 e3 c4|=|=|=|f2 c3 ab3|=|=|=|d2 a2 f3|=|=|=|e2 b2 g#3|=|=|=',
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 180, 2)), g = P.node(E.gain(0.13));
      [[33, -5, 'sawtooth'], [33, 5, 'sawtooth'], [45, 0, 'sine'], [40, 0, 'triangle']].forEach(function (x) {
        var s = P.src(E.osc(x[2], mtof(x[0]))); s.detune.value = x[1]; s.connect(lp); s.start(t);
      });
      lp.connect(g); g.connect(P.inp);
      lfo(P, t, 0.05, 60, lp.frequency); lfo(P, t, 0.08, 0.04, g.gain);
    },
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand;
      if (s === 0 && bar % 4 === 0) INS.pad(E, o, t, ch, sd * 64, 0.08, { a: 5, r: 5, cut: 480, det: 6 });
      if (r() < 0.07) INS.drip(E, [o, P.echo], t + r() * sd, mtof([81, 84, 86, 88, 91, 93][Math.floor(r() * 6)]), 0.07 + r() * 0.08, { pan: (r() - 0.5) * 1.4 });
      if (s === 0 && bar % 2 === 1) INS.bell(E, [o, P.echo], t, ch[0] + 12, 0, 0.06, { ratio: 1.41, index: 1.2, decay: 5 });
      if (s === 8 && bar % 4 === 2) INS.bell(E, o, t, ch[1] + 12, 0, 0.04, { ratio: 2.76, index: 0.8, decay: 4 });
    }
  };

  /* 心字墓室：D 弗里几亚。空五度嗡鸣 + 仪式低鼓（每四小节滚奏）+ 号角式圣咏（平行五度）+ 青铜钟 */
  BGM.tomb = {
    bpm: 70, bars: 16, rev: 0.6, echo: 0.15, tail: 5,
    mel: 'd4/16 | eb4/8 d4/8 | f4/16 | eb4/8 d4/8 | c4/16 | bb3/8 c4/8 | d4/16 | r/16 | a4/16 | bb4/8 a4/8 | g4/16 | f4/8 eb4/8 | d4/16 | eb4/8 c4/8 | d4/16 | r/16',
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 380, 1.5)), g = P.node(E.gain(0.06));
      [[38, -4], [38, 4], [45, 0]].forEach(function (x) { var s = P.src(E.osc('sawtooth', mtof(x[0]))); s.detune.value = x[1]; s.connect(lp); s.start(t); });
      lp.connect(g); g.connect(P.inp);
      lfo(P, t, 0.04, 120, lp.frequency);
    },
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd;
      if (s === 0) INS.drum(E, o, t, 85, 42, 0.9, 0.6, { nv: 0.28, nf: 400, nd: 0.12, nk: 'brown' });
      if (s === 6) INS.drum(E, o, t, 110, 60, 0.4, 0.24, { nv: 0.1, nf: 700 });
      if (s === 10) INS.drum(E, o, t, 100, 55, 0.5, 0.32, { nv: 0.12, nf: 600 });
      if (bar % 4 === 3 && s >= 12) INS.drum(E, o, t, 120, 70, 0.2, 0.12 + (s - 12) * 0.05, { nv: 0.06 });
      if (s === 8 && E.ok()) { E.tone(o, t, { f: 1100, v: 0.05, a: 0.0008, d: 0.05 }); E.nb(o, t, { type: 'bandpass', f: 1800, q: 4, v: 0.08, a: 0.0006, d: 0.03 }); }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) {
        var hl = { type: E.waves.horn, cut: 900, vd: 0.004, vr: 4.5, a: 0.5, r: 0.9 };
        INS.lead(E, o, t, e[0], e[1] * sd, 0.1, hl); INS.lead(E, o, t, e[0] - 7, e[1] * sd, 0.06, hl); INS.lead(E, o, t, e[0] - 12, e[1] * sd, 0.05, hl);
      });
      if (s === 0 && bar % 4 === 0) INS.bell(E, [o, P.echo], t, 62, 0, 0.1, { ratio: 1.41, index: 3, decay: 5 });
      if (s === 0 && bar % 4 === 2) INS.bell(E, [o, P.echo], t, 69, 0, 0.06, { ratio: 1.41, index: 2.5, decay: 4 });
    }
  };

  /* 尼泊尔：D 多利亚。持续音 + 颂钵（成对拍频分音）+ 竹笛式气声旋律 + 铃 */
  BGM.nepal = {
    bpm: 60, bars: 16, rev: 0.65, echo: 0.35, tail: 8,
    mel: 'a4/8 d5/8 | e5/16 | f5/4 e5/4 d5/8 | a4/16 | c5/8 d5/8 | e5/8 g5/4 f5/4 | e5/16 | d5/16 | r/16 | r/16 | r/16 | r/16 | r/16 | r/16 | r/16 | r/16',
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 1400, 0.7)), g = P.node(E.gain(0.05));
      [50, 57, 62].forEach(function (m, i) { var s = P.src(E.osc('triangle', mtof(m))); s.detune.value = (i - 1) * 3; s.connect(lp); s.start(t); });
      lp.connect(g); g.connect(P.inp);
      lfo(P, t, 0.1, 0.02, g.gain);
      var bp = P.node(E.filter('bandpass', 900, 6)), sg = P.node(E.gain(0.05)), sw = P.src(E.osc('sawtooth', mtof(38)));
      sw.connect(bp); bp.connect(sg); sg.connect(P.inp); sw.start(t);
      lfo(P, t, 0.07, 400, bp.frequency);
    },
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, r = P.rand;
      if (s === 0 && bar % 2 === 0) INS.bowl(E, [o, P.echo], t, [62, 69, 57, 64, 62, 67, 57, 69][(bar >> 1) % 8], 0.16);
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.lead(E, o, t, e[0], e[1] * sd, 0.1, { type: 'triangle', breath: 0.25, cut: 3500, vd: 0.008, vr: 5, a: 0.12, r: 0.4, slide: 0.5 }); });
      if (bar >= 8 && s % 4 === 0 && r() < 0.14) INS.pluck(E, [o, P.echo], t, [74, 76, 81, 83, 86][Math.floor(r() * 5)], sd * 8, 0.09, { bright: 0.8, sus: 2.5 });
      if ((bar === 8 || bar === 12) && s === 0) { INS.bell(E, [o, P.echo], t, 93, 0, 0.05, { ratio: 3.51, index: 1.5, decay: 4 }); INS.bell(E, o, t, 0, 0, 0.04, { hz: mtof(93) + 3.5, ratio: 3.51, index: 1.5, decay: 4 }); }
    }
  };

  /* 仙境：D 利底亚。十六分竖琴琶音（两个八度上下行）+ 暖 pad + 钢片琴旋律 + 高音闪光 */
  BGM.paradise = {
    bpm: 90, bars: 16, rev: 0.5, echo: 0.3,
    chords: 'd2 d4 f#4 a4 c#5 e5|d2 d4 e4 g#4 b4 e5|b1 b3 d4 f#4 a4 c#5|g1 g3 b3 d4 f#4 c#5|d2 d4 f#4 a4 c#5 e5|d2 d4 e4 g#4 b4 e5|f#2 f#3 a3 c#4 e4 a4|g1 g3 b3 d4 f#4 a4|' +
            'e2 e3 g3 b3 d4 f#4|a1 a3 c#4 e4 a4 c#5|f#2 f#3 a3 c#4 e4 a4|b1 b3 d4 f#4 a4 c#5|g1 g3 b3 d4 f#4 a4|a1 a3 d4 e4 a4 b4|g1 g3 b3 d4 f#4 a4|d2 d4 f#4 a4 e5 f#5',
    mel: 'a5/8 f#5/4 a5/4 | b5/8 g#5/8 | f#5/12 d5/4 | d5/8 f#5/8 | a5/8 f#5/4 a5/4 | b5/8 e6/8 | c#6/12 a5/4 | b5/16 |' +
         'b5/8 a5/4 g5/4 | a5/8 e5/8 | c#6/8 a5/8 | d6/8 f#5/8 | g5/4 b5/4 d6/8 | e6/8 d6/4 a5/4 | b5/8 f#5/8 | a5/16',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s), r = P.rand, ar = ch.slice(1), n = ar.length;
      var ix = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3][s], m = ix < n ? ar[ix] : ar[ix - n] + 12;
      INS.pluck(E, o, t, m, sd * 2, s === 0 ? 0.15 : 0.1, { bright: 0.8, sus: 1.3, pan: Math.sin(s / 16 * 6.283) * 0.5 });
      if (s === 0) {
        INS.pad(E, o, t, ar.slice(0, 4), sd * 16, 0.06, { type: 'triangle', a: 0.8, r: 1.5, cut: 2600, det: 10 });
        INS.bass(E, o, t, ch[0], sd * 14, 0.2, { type: 'sine', sub: 0.4, cut: 400, a: 0.05, s: 0.7, dk: 1.5, r: 0.4 });
      }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) { INS.bell(E, [o, P.echo], t, e[0], 0, 0.12, { ratio: 4, index: 1.1, decay: 1.8 }); });
      if (s === 8 && r() < 0.4) INS.bell(E, [o, P.echo], t, ar[n - 1] + 12, 0, 0.035, { ratio: 3.01, index: 0.8, decay: 2.5, pan: (r() - 0.5) });
    }
  };

  /* 哀伤：c 小调慢板。钢琴分解和弦 + 弦乐 pad；前半大提琴、后半小提琴高八度 */
  BGM.sorrow = {
    bpm: 58, bars: 16, rev: 0.5, echo: 0.1, tail: 4,
    chords: 'c3 g3 c4 eb4|ab2 eb3 ab3 c4|eb3 g3 bb3 eb4|bb2 f3 bb3 d4|f2 c3 f3 ab3|g2 c3 eb3 g3|d3 f3 ab3 c4;g2 f3 b3 d4|c3 g3 c4 eb4|' +
            'c3 g3 c4 eb4|ab2 eb3 ab3 c4|eb3 g3 bb3 eb4|bb2 f3 bb3 d4|f2 c3 f3 ab3|g2 c3 eb3 g3|d3 f3 ab3 c4;g2 f3 b3 d4|c3 g3 c4 eb4',
    mel: 'c5/6 d5/2 eb5/8 | c5/12 ab4/4 | bb4/6 c5/2 g4/8 | f4/12 r/4 | ab4/6 bb4/2 c5/8 | eb5/6 d5/2 c5/8 | d5/6 f5/2 b4/8 | c5/16 |' +
         'eb5/6 f5/2 g5/8 | ab5/8 g5/4 f5/4 | g5/6 f5/2 eb5/8 | d5/12 r/4 | c5/6 d5/2 eb5/4 f5/4 | g5/8 eb5/8 | f5/6 eb5/2 d5/8 | c5/16',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s);
      if (s % 2 === 0) INS.piano(E, o, t, ch[[0, 1, 2, 3, 2, 1, 2, 1][s >> 1]], sd * 3, 0.11, { bright: 3.5 });
      if (s === 0) {
        INS.pad(E, o, t, ch.slice(1), sd * 16, 0.05, { a: 1.2, r: 2, cut: 1000 });
        INS.bass(E, o, t, ch[0] - 12, sd * 15, 0.16, { type: 'sine', sub: 0.3, cut: 300, a: 0.3, s: 0.8, dk: 2, r: 0.8 });
      }
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) {
        if (bar < 8) INS.lead(E, o, t, e[0] - 12, e[1] * sd, 0.15, { type: 'sawtooth', cut: 1300, vd: 0.007, vr: 5, a: 0.18, r: 0.5, slide: 0.3 });
        else INS.lead(E, o, t, e[0], e[1] * sd, 0.1, { type: 'sawtooth', cut: 2600, vd: 0.008, vr: 5.6, a: 0.15, r: 0.5, slide: 0.3 });
      });
    }
  };

  /* 真相：D 大调，温暖释然。暖 pad + 钢琴分解 + 钢琴旋律（第二遍八音盒高八度叠加） */
  BGM.truth = {
    bpm: 72, bars: 16, rev: 0.45, echo: 0.25,
    chords: 'd3 a3 d4 f#4|c#3 a3 c#4 e4|b2 f#3 b3 d4|g2 d3 g3 b3|f#2 a3 d4 f#4|g2 d3 g3 b3|e3 b3 d4 g4|a2 e3 a3 c#4|' +
            'g2 d3 g3 b3|a2 e3 a3 c#4|f#2 c#3 f#3 a3|b2 f#3 b3 d4|g2 d3 g3 b3|f#2 a3 d4 f#4|e3 b3 d4 g4;a2 e3 g3 c#4|d3 a3 d4 f#4',
    mel: 'f#5/6 e5/2 d5/8 | e5/6 c#5/2 a4/8 | d5/6 c#5/2 b4/4 d5/4 | d5/12 r/4 | a5/6 f#5/2 d5/8 | g5/6 f#5/2 e5/4 d5/4 | e5/6 f#5/2 g5/8 | e5/12 r/4 |' +
         'b5/6 a5/2 g5/8 | a5/6 g5/2 e5/8 | f#5/6 e5/2 c#5/8 | d5/12 f#5/4 | g5/6 f#5/2 e5/4 d5/4 | f#5/6 e5/2 d5/8 | e5/6 d5/2 c#5/8 | d5/16',
    play: function (P, bar, s, t, st) {
      var E = P.E, o = P.inp, sd = P.sd, ch = P.chord(bar, s);
      var bo = { type: 'triangle', cut: 500, sub: 0.6, a: 0.02, s: 0.7, dk: 1, r: 0.3 };
      if (s === 0) {
        INS.pad(E, o, t, ch.slice(1), sd * 16, 0.06, { a: 1, r: 2, cut: 1600, det: 6 });
        INS.bass(E, o, t, ch[0] - 12, sd * 7, 0.22, bo);
      }
      if (s === 8) INS.bass(E, o, t, ch[0] - 5, sd * 7, 0.16, bo);
      if (s % 2 === 0) INS.piano(E, o, t, ch[[1, 2, 3, 2, 1, 2, 3, 2][s >> 1]], sd * 3, 0.08, { bright: 4 });
      var ev = P.mel[st];
      if (ev) ev.forEach(function (e) {
        INS.piano(E, [o, P.echo], t, e[0], e[1] * sd, 0.21, { bright: 6 });
        if (P.loop % 2 === 1) INS.mbox(E, [o, P.echo], t, e[0] + 12, 0, 0.05);
      });
    }
  };

  /* 心跳层 */
  var HEART = { stepDur: 1, rev: 0.08, tail: 1, play: function (P, i, t) { lubdub(P.E, P.inp, t, 0.6); } };

  /* ================================================================== 环境音 */
  var AMB = {};
  var AS = 0.05;   // 环境音事件步长（秒）

  AMB.city = {
    stepDur: AS, rev: 0.15,
    setup: function (P, t) {
      var a = loopN(P, t, 'brown', [['lowpass', 320, 0.7]], 0.55); lfo(P, t, 0.06, 0.15, a.g.gain);
      var b = loopN(P, t, 'pink', [['bandpass', 850, 0.6]], 0.14, -0.35); lfo(P, t, 0.11, 0.05, b.g.gain);
      var c = loopN(P, t, 'pink', [['bandpass', 1500, 0.8]], 0.08, 0.4); lfo(P, t, 0.083, 0.04, c.g.gain);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if (i === 4 || (i % 20 === 0 && r() < 0.3)) passCar(E, d, t + r() * 0.5, 2.5 + r() * 2.5, r() < 0.5 ? -1 : 1, 0.3 + r() * 0.2);
      if (r() < 0.0025) {
        var p = (r() - 0.5) * 1.4, f = 360 + r() * 80;
        [0, 0.28].forEach(function (dt) { E.tone(d, t + dt, { type: 'square', f: f, v: 0.03, a: 0.01, h: 0.16, d: 0.05, lp: 1600, pan: p }); E.tone(d, t + dt, { type: 'square', f: f * 1.26, v: 0.02, a: 0.01, h: 0.16, d: 0.05, lp: 1600, pan: p }); });
      }
      if (r() < 0.0008) [0, 0.13].forEach(function (dt) { fmBell(E, d, t + dt, 2900, 0.02, 2.4, 1.2, 0.7, 0.5); });
    }
  };
  AMB.office = {
    stepDur: AS, rev: 0.12,
    setup: function (P, t) {
      loopN(P, t, 'pink', [['lowpass', 450, 0.7]], 0.18);
      babble(P, t, [[420, 3.1, -0.4], [900, 4.3, 0.3], [1900, 5.7, 0]], 0.05);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if ((P.st.typeUntil || 0) < t && (i === 10 || r() < 0.012)) {
        var tt = t, n = 5 + Math.floor(r() * 15), p = (r() - 0.5) * 1.2;
        for (var k = 0; k < n; k++) {
          tt += 0.07 + r() * 0.13;
          E.nb(d, tt, { type: 'bandpass', f: 2600 + r() * 1500, q: 1.5, v: 0.07, a: 0.0005, d: 0.018, pan: p });
          E.nb(d, tt, { k: 'pink', type: 'lowpass', f: 500, v: 0.05, a: 0.001, d: 0.03, pan: p });
        }
        P.st.typeUntil = tt;
      }
      if (r() < 0.003) [0, 0.09].forEach(function (dt) { E.nb(d, t + dt, { type: 'bandpass', f: 4000, q: 2, v: 0.04, a: 0.0005, d: 0.006 }); });
      if (r() < 0.0006) [0, 0.4].forEach(function (dt) { E.tone(d, t + dt, { f: 1250, v: 0.012, a: 0.01, h: 0.3, d: 0.05, am: [22, 1], pan: 0.6 }); });
    }
  };
  AMB.rain = {
    stepDur: AS, rev: 0.1,
    setup: function (P, t) {
      var E = P.E, drops = E.sparse('rain', 900, 0.001, 0.004, 3, 0.6);
      loopN(P, t, 'white', [['highpass', 1800, 0.5], ['lowpass', 9000, 0.5]], 0.1, -0.5);
      loopN(P, t, 'white', [['highpass', 1800, 0.5], ['lowpass', 9000, 0.5]], 0.1, 0.5);
      loopN(P, t, 'pink', [['lowpass', 1100, 0.6]], 0.16);
      loopN(P, t, drops, [['bandpass', 2800, 0.6]], 0.35, -0.6);
      loopN(P, t, drops, [['bandpass', 2200, 0.6]], 0.3, 0.6);
      loopN(P, t, 'brown', [['lowpass', 200, 0.7]], 0.1);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if (r() < 0.0005) { E.nb(d, t, { k: 'brown', type: 'lowpass', f: 140, v: 0.6, a: 1.2, h: 0.5, d: 3 }); E.nb(d, t, { k: 'pink', type: 'lowpass', f: 600, v: 0.12, a: 0.05, d: 0.6 }); }
      if (r() < 0.02) INS.drip(E, d, t, 1500 + r() * 1500, 0.03 + r() * 0.03, { pan: (r() - 0.5) * 1.6 });
    }
  };
  AMB.wind = {
    stepDur: AS, rev: 0.15,
    setup: function (P, t) {
      var a = loopN(P, t, 'pink', [['bandpass', 500, 1.2]], 0.28); lfo(P, t, 0.06, 250, a.f[0].frequency); lfo(P, t, 0.09, 0.14, a.g.gain);
      var b = loopN(P, t, 'white', [['bandpass', 1200, 6]], 0.045, 0.4); lfo(P, t, 0.045, 400, b.f[0].frequency); lfo(P, t, 0.13, 0.03, b.g.gain);
      var c = loopN(P, t, 'brown', [['lowpass', 200, 0.7]], 0.22); lfo(P, t, 0.13, 0.1, c.g.gain);
    },
    play: function (P, i, t) {
      var r = P.rand;
      if (r() < 0.004) P.E.nb(P.inp, t, { k: 'pink', type: 'bandpass', f: 300, fpts: [[0.7, 950], [1.6, 380]], q: 1.3, v: 0.25, a: 0.6, h: 0.2, d: 0.8, pan: (r() - 0.5) });
    }
  };
  AMB.drip = {
    stepDur: AS, rev: 0.7,
    setup: function (P, t) {
      loopN(P, t, 'brown', [['lowpass', 150, 0.7]], 0.14);
      loopN(P, t, 'pink', [['bandpass', 300, 0.8]], 0.025);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if (i === 3 || r() < 0.03) {
        var f = 900 + r() * 1300, v = 0.1 + r() * 0.15, p = (r() - 0.5) * 1.4;
        INS.drip(E, d, t, f, v, { pan: p });
        INS.drip(E, d, t + 0.23, f, v * 0.3, { pan: -p });
        INS.drip(E, d, t + 0.47, f, v * 0.1, { pan: p });
        if (r() < 0.2) INS.drip(E, d, t + 0.09, f * 1.3, v * 0.6, { pan: p });
      }
    }
  };
  AMB.crowd = {
    stepDur: AS, rev: 0.15,
    setup: function (P, t) {
      babble(P, t, [[350, 2.7, -0.5], [700, 3.9, 0.4], [1300, 5.1, -0.2], [2600, 6.3, 0.3]], 0.07);
      loopN(P, t, 'pink', [['lowpass', 1500, 0.7]], 0.12);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand;
      if (r() < 0.01) voiceBlip(E, P.inp, t, r, 0.06 + r() * 0.05);
    }
  };
  AMB.siren = {
    stepDur: AS, rev: 0.45,
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 2200, 0.7)), g = P.node(E.gain(0.05)), trem = P.node(E.gain(1)), g2 = P.node(E.gain(0.6));
      var o1 = P.src(E.osc('sawtooth', 140)), o2 = P.src(E.osc('sawtooth', 140 * 1.19)), o3 = P.src(E.osc('triangle', 140));
      o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(lp); lp.connect(trem); trem.connect(g); g.connect(P.inp);
      o1.start(t); o2.start(t); o3.start(t);
      lfo(P, t, 4.2, 0.15, trem.gain);
      P.st.osc = [[o1, 1], [o2, 1.19], [o3, 1]]; P.st.g = g;
      loopN(P, t, 'brown', [['lowpass', 250, 0.7]], 0.1);
    },
    play: function (P, i, t) {
      if (i % 260 !== 0) return;         // 13 秒一个上下滑音周期
      P.st.osc.forEach(function (x) {
        var f = x[0].frequency, k = x[1];
        f.setValueAtTime(140 * k, t); f.exponentialRampToValueAtTime(540 * k, t + 4.2); f.setValueAtTime(540 * k, t + 7); f.exponentialRampToValueAtTime(140 * k, t + 12.9);
      });
      var g = P.st.g.gain;
      g.setValueAtTime(0.05, t); g.linearRampToValueAtTime(0.16, t + 4.2); g.setValueAtTime(0.16, t + 7); g.linearRampToValueAtTime(0.05, t + 12.9);
    }
  };
  AMB.insects = {
    stepDur: AS, rev: 0.2,
    setup: function (P, t) {
      loopN(P, t, 'brown', [['lowpass', 250, 0.7]], 0.06);
      var k = loopN(P, t, 'white', [['bandpass', 6800, 3]], 0.03, 0.2); lfo(P, t, 0.2, 0.012, k.g.gain);
      [[4300, 31, 2.1, -0.6, 0.06], [4750, 27, 1.6, 0.5, 0.05], [5200, 36, 2.9, 0.1, 0.035], [3900, 24, 0.9, -0.2, 0.03]].forEach(function (c) { cricket(P, t, c[0], c[1], c[2], c[3], c[4]); });
    }
  };
  AMB.forest = {
    stepDur: AS, rev: 0.3,
    setup: function (P, t) {
      var l = loopN(P, t, 'pink', [['bandpass', 2500, 0.6]], 0.05); lfo(P, t, 0.1, 0.025, l.g.gain);
      loopN(P, t, 'brown', [['lowpass', 300, 0.7]], 0.06);
    },
    play: function (P, i, t) {
      var r = P.rand;
      if (i === 2 || r() < 0.02) bird(P.E, P.inp, t, r);
    }
  };
  AMB.waterfall = {
    stepDur: AS, rev: 0.15,
    setup: function (P, t) {
      loopN(P, t, 'white', [['lowpass', 5000, 0.5]], 0.14, -0.45);
      loopN(P, t, 'white', [['lowpass', 4000, 0.5]], 0.14, 0.45);
      loopN(P, t, 'pink', [['lowpass', 800, 0.6]], 0.28);
      var b = loopN(P, t, 'brown', [['lowpass', 150, 0.7]], 0.38); lfo(P, t, 0.05, 0.06, b.g.gain);
    },
    play: function (P, i, t) {
      var r = P.rand;
      if (r() < 0.01) INS.drip(P.E, P.inp, t, 2000 + r() * 1500, 0.02, { pan: (r() - 0.5) * 1.6 });
    }
  };
  AMB.tunnel = {
    stepDur: AS, rev: 0.5,
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 140, 2)), g = P.node(E.gain(0.13));
      [[48, 'sawtooth'], [48.4, 'sawtooth'], [96, 'sine']].forEach(function (x) { var s = P.src(E.osc(x[1], x[0])); s.connect(lp); s.start(t); });
      lp.connect(g); g.connect(P.inp);
      lfo(P, t, 0.03, 40, lp.frequency);
      loopN(P, t, 'brown', [['lowpass', 90, 0.7]], 0.3);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if (r() < 0.002) E.nb(d, t, { k: 'brown', type: 'lowpass', f: 100, v: 0.35, a: 1.5, d: 2 });
      if (r() < 0.002) INS.scrape(E, d, t, 400 + r() * 500, 2.5, 0.06, { pan: (r() - 0.5) * 1.4 });
      if (r() < 0.006) INS.drip(E, d, t, 800 + r() * 900, 0.05, { pan: (r() - 0.5) * 1.4 });
    }
  };
  AMB.engine = {
    stepDur: AS, rev: 0.08,
    setup: function (P, t) {
      var E = P.E, lp = P.node(E.filter('lowpass', 420, 2)), am = P.node(E.gain(0.55)), g = P.node(E.gain(0.2)), g3 = P.node(E.gain(0.3));
      var o1 = P.src(E.osc('sawtooth', 43)), o2 = P.src(E.osc('sawtooth', 86.6)), o3 = P.src(E.osc('square', 21.5));
      o1.connect(lp); o2.connect(lp); o3.connect(g3); g3.connect(lp); lp.connect(am); am.connect(g); g.connect(P.inp);
      var l = P.src(E.osc('sine', 21.5)), lg = P.node(E.gain(0.35)); l.connect(lg); lg.connect(am.gain);
      var dr = P.src(E.osc('sine', 0.09)), dg = P.node(E.gain(60));
      dr.connect(dg); [o1, o2, o3].forEach(function (o) { dg.connect(o.detune); });
      [o1, o2, o3, l, dr].forEach(function (o) { o.start(t); });
      loopN(P, t, 'brown', [['lowpass', 260, 0.7]], 0.3);
      loopN(P, t, 'pink', [['bandpass', 1200, 1]], 0.03);
    }
  };
  AMB.fire = {
    stepDur: AS, rev: 0.12,
    setup: function (P, t) {
      var E = P.E, cb = E.sparse('fire', 30, 0.0005, 0.006, 2.5, 0.9);
      var roar = loopN(P, t, 'brown', [['lowpass', 380, 0.7]], 0.35); lfo(P, t, 0.7, 0.1, roar.g.gain); lfo(P, t, 1.9, 0.06, roar.g.gain);
      loopN(P, t, 'white', [['highpass', 5000, 0.5]], 0.012);
      loopN(P, t, cb, [['highpass', 700, 0.5]], 0.45, -0.25);
      loopN(P, t, cb, [['highpass', 1500, 0.5]], 0.3, 0.3);
    },
    play: function (P, i, t) {
      var E = P.E, r = P.rand, d = P.inp;
      if (r() < 0.05) E.nb(d, t + r() * 0.05, { type: 'bandpass', f: 1200 + r() * 3500, q: 1.5, v: 0.1 + r() * 0.25, a: 0.0005, d: 0.006 + r() * 0.02, pan: (r() - 0.5) });
      if (r() < 0.003) E.nb(d, t, { k: 'brown', type: 'lowpass', f: 300, v: 0.3, a: 0.05, d: 0.5 });
    }
  };

  /* ================================================================== 音效 */
  var SFX = {};
  function S(name, len, wet, fn) { SFX[name] = { len: len, wet: wet, fn: fn }; }

  S('click', 0.1, 0, function (E, d, t) {
    E.tone(d, t, { f: 1400, f1: 700, ft: 0.018, v: 0.16, a: 0.001, d: 0.03 });
    E.nb(d, t, { type: 'highpass', f: 4500, v: 0.05, a: 0.0005, d: 0.008 });
  });
  S('page', 0.6, 0.15, function (E, d, t) {
    var r = E.r;
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 1600, f1: 4200, ft: 0.28, q: 0.9, v: 0.35, a: 0.09, h: 0.1, d: 0.16 });
    for (var i = 0; i < 6; i++) E.nb(d, t + 0.03 + r() * 0.26, { type: 'bandpass', f: 2500 + r() * 4000, q: 2, v: 0.1 + r() * 0.1, a: 0.002, d: 0.02 + r() * 0.03, pan: (r() - 0.5) * 0.4 });
    E.nb(d, t + 0.3, { k: 'brown', type: 'lowpass', f: 500, v: 0.35, a: 0.004, d: 0.08 });
  });
  S('knock', 0.9, 0.3, function (E, d, t) {
    [0, 0.2, 0.37].forEach(function (dt, i) {
      var v = i === 2 ? 0.85 : 1;
      E.tone(d, t + dt, { f: 200, f1: 115, ft: 0.05, v: 0.55 * v, a: 0.001, d: 0.1 });
      E.nb(d, t + dt, { k: 'pink', type: 'bandpass', f: 750, q: 1.4, v: 0.5 * v, a: 0.001, d: 0.06 });
      E.nb(d, t + dt, { type: 'bandpass', f: 2600, q: 1, v: 0.12 * v, a: 0.0005, d: 0.012 });
    });
  });
  S('door_open', 1.8, 0.3, function (E, d, t) {
    E.nb(d, t, { type: 'bandpass', f: 3200, q: 3, v: 0.3, a: 0.001, d: 0.025 });
    E.tone(d, t + 0.01, { type: 'square', f: 1900, v: 0.04, a: 0.001, d: 0.02 });
    // 门轴吱呀：粘滑摩擦的锯齿 + 两个共振带通
    var c = t + 0.12, dur = 1.25, s = E.osc('sawtooth', 85), b1 = E.filter('bandpass', 1150, 7), b2 = E.filter('bandpass', 2350, 9), g = E.gain(0), sl = E.gain(0.6), k;
    s.frequency.setValueAtTime(85, c); sl.gain.setValueAtTime(0.6, c);
    for (k = 1; k <= 24; k++) s.frequency.linearRampToValueAtTime(70 + E.r() * 75 + k * 1.5, c + dur * k / 24);
    for (k = 1; k <= 30; k++) sl.gain.linearRampToValueAtTime(0.3 + E.r() * 0.7, c + dur * k / 30);
    s.connect(sl); sl.connect(b1); sl.connect(b2); b1.connect(g); b2.connect(g);
    g.gain.setValueAtTime(0, c); g.gain.linearRampToValueAtTime(1.1, c + 0.18); g.gain.setValueAtTime(1.1, c + dur - 0.3); g.gain.linearRampToValueAtTime(0, c + dur);
    var nodes = [b1, b2, g, sl];
    E.out(g, d, null, c, dur, nodes); E.voice(c, c + dur + 0.05, [s], nodes);
  });
  S('door_close', 0.8, 0.3, function (E, d, t) {
    E.tone(d, t, { f: 115, f1: 58, ft: 0.12, v: 0.55, a: 0.002, d: 0.28 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 700, v: 0.5, a: 0.002, d: 0.16 });
    E.nb(d, t + 0.035, { type: 'bandpass', f: 2800, q: 4, v: 0.22, a: 0.0008, d: 0.02 });
    E.tone(d, t + 0.035, { type: 'square', f: 1750, v: 0.025, a: 0.0005, d: 0.02 });
  });
  S('door_slam', 1.6, 0.5, function (E, d, t) {
    E.tone(d, t, { f: 95, f1: 36, ft: 0.25, v: 0.9, a: 0.002, d: 0.55 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 1600, f1: 250, ft: 0.3, v: 0.9, a: 0.001, d: 0.4 });
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 1600, q: 1.2, v: 0.4, a: 0.0008, d: 0.07 });
    E.nb(d, t + 0.04, { type: 'bandpass', f: 3300, q: 3, v: 0.08, a: 0.01, h: 0.12, d: 0.15, am: [38, 0.8] });
  });
  S('footsteps', 2.2, 0.35, function (E, d, t) {
    for (var i = 0; i < 4; i++) {
      var tt = t + i * 0.47 + (E.r() - 0.5) * 0.03, v = 0.8 + E.r() * 0.2, p = i % 2 ? 0.15 : -0.15;
      E.tone(d, tt, { f: 130, f1: 70, ft: 0.05, v: 0.35 * v, a: 0.002, d: 0.09, pan: p });
      E.nb(d, tt, { k: 'pink', type: 'lowpass', f: 1300, v: 0.35 * v, a: 0.002, d: 0.07, pan: p });
      E.nb(d, tt + 0.05, { type: 'bandpass', f: 2300, q: 1.2, v: 0.08 * v, a: 0.004, d: 0.05, pan: p });
    }
  });
  /* 金属棒敲大理石“笃”：尖锐瞬态 + 石头的短促共鸣（高 Q 带通噪声）+ 金属棒的细微余振 */
  S('tap', 1.0, 0.45, function (E, d, t) {
    E.nb(d, t, { type: 'highpass', f: 3500, v: 0.4, a: 0.0005, d: 0.008 });
    E.tone(d, t, { f: 1150, f1: 1090, ft: 0.05, v: 0.4, a: 0.001, d: 0.07 });
    E.tone(d, t, { f: 560, v: 0.22, a: 0.001, d: 0.05 });
    E.tone(d, t, { f: 2630, v: 0.12, a: 0.001, d: 0.05 });
    E.nb(d, t, { type: 'bandpass', f: 1900, q: 25, v: 0.5, a: 0.001, d: 0.12 });
    E.nb(d, t, { type: 'bandpass', f: 3300, q: 30, v: 0.3, a: 0.001, d: 0.09 });
    E.tone(d, t, { f: 4170, v: 0.04, a: 0.001, d: 0.35 });
    E.tone(d, t, { f: 6810, v: 0.025, a: 0.001, d: 0.25 });
  });
  S('heartbeat', 0.8, 0.05, function (E, d, t) { lubdub(E, d, t, 1); });
  S('crack', 1.4, 0.4, function (E, d, t) {
    var r = E.r;
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 1100, v: 0.8, a: 0.001, d: 0.3 });
    E.tone(d, t, { f: 85, f1: 45, ft: 0.15, v: 0.5, a: 0.002, d: 0.25 });
    E.nb(d, t, { type: 'highpass', f: 2500, v: 0.35, a: 0.0005, d: 0.02 });
    for (var i = 0; i < 16; i++) E.nb(d, t + Math.pow(r(), 1.6) * 0.8, { type: 'bandpass', f: 700 + r() * 3200, q: 1.5 + r() * 3, v: 0.12 + r() * 0.3, a: 0.0005, d: 0.01 + r() * 0.04, pan: (r() - 0.5) * 1.2 });
    E.nb(d, t + 0.15, { k: 'pink', type: 'bandpass', f: 2600, q: 0.8, v: 0.07, a: 0.15, h: 0.3, d: 0.5 });
  });
  S('fall', 1.9, 0.2, function (E, d, t) {
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 300, f1: 1400, ft: 1.4, q: 1.2, v: 0.5, a: 1.2, h: 0.1, d: 0.3, am: [7, 0.3] });
    E.nb(d, t, { type: 'bandpass', f: 800, f1: 2500, ft: 1.4, q: 3, v: 0.1, a: 1.2, d: 0.2 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 250, v: 0.3, a: 1.1, h: 0.1, d: 0.3 });
  });
  S('thud', 0.8, 0.3, function (E, d, t) {
    E.tone(d, t, { f: 95, f1: 42, ft: 0.18, v: 0.8, a: 0.002, d: 0.35 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 400, v: 0.6, a: 0.002, d: 0.2 });
    E.nb(d, t, { k: 'pink', type: 'lowpass', f: 1200, v: 0.15, a: 0.001, d: 0.04 });
  });
  S('glass', 0.9, 0.3, function (E, d, t) {
    E.tone(d, t, { f: 120, f1: 80, ft: 0.1, v: 0.5, a: 0.002, d: 0.15 });
    E.nb(d, t, { k: 'pink', type: 'lowpass', f: 900, v: 0.35, a: 0.001, d: 0.08 });
    E.tone(d, t, { f: 1320, v: 0.07, a: 0.001, d: 0.4 });
    E.tone(d, t, { f: 2870, v: 0.04, a: 0.001, d: 0.3 });
    E.tone(d, t, { f: 4410, v: 0.022, a: 0.001, d: 0.2 });
    E.nb(d, t, { type: 'bandpass', f: 700, q: 8, v: 0.12, a: 0.002, d: 0.25, am: [31, 0.6] });
  });
  /* 2004 年和弦铃声：方波 + 正弦的小喇叭音色，原创旋律，响两遍 */
  S('phone_ring', 3.8, 0.1, function (E, d, t) {
    var hp = E.filter('highpass', 550, 0.7), pk = E.filter('peaking', 2200, 1.2);
    pk.gain.value = 6; hp.connect(pk); pk.connect(d);
    var mel = [84, 88, 91, 88, 86, 83, 79, 83, 84, 88, 91, 96, 95, 91, 88, 91], bl = [48, 48, 55, 55, 53, 53, 55, 55];
    for (var rep = 0; rep < 2; rep++) {
      var t0 = t + rep * 1.85;
      mel.forEach(function (m, i) {
        E.tone(hp, t0 + i * 0.1, { type: 'square', f: mtof(m), v: 0.07, a: 0.004, h: 0.05, d: 0.05, lp: 3800 });
        E.tone(hp, t0 + i * 0.1, { f: mtof(m - 12), v: 0.05, a: 0.004, h: 0.05, d: 0.05 });
      });
      bl.forEach(function (m, i) { E.tone(hp, t0 + i * 0.2, { type: 'triangle', f: mtof(m + 12), v: 0.08, a: 0.005, h: 0.13, d: 0.05 }); });
    }
    return [hp, pk];
  });
  S('phone_buzz', 1.4, 0.05, function (E, d, t) {
    [0, 0.65].forEach(function (dt) {
      E.tone(d, t + dt, { type: 'sawtooth', f: 155, v: 0.22, a: 0.02, h: 0.4, d: 0.05, lp: 420, am: [31, 0.35] });
      E.nb(d, t + dt, { type: 'bandpass', f: 210, q: 3, v: 0.3, a: 0.02, h: 0.4, d: 0.05, am: [31, 0.5] });
      E.nb(d, t + dt, { type: 'bandpass', f: 1800, q: 2, v: 0.05, a: 0.02, h: 0.4, d: 0.05, am: [155, 0.9] });
    });
  });
  S('camera', 0.8, 0.15, function (E, d, t) {
    E.nb(d, t, { type: 'bandpass', f: 2600, q: 1, v: 0.45, a: 0.0005, d: 0.018 });
    E.tone(d, t, { type: 'square', f: 1200, f1: 500, ft: 0.02, v: 0.06, a: 0.0005, d: 0.025, lp: 3000 });
    E.nb(d, t + 0.055, { type: 'bandpass', f: 3600, q: 1.4, v: 0.4, a: 0.0005, d: 0.022 });
    E.tone(d, t + 0.055, { f: 190, f1: 90, ft: 0.03, v: 0.25, a: 0.001, d: 0.05 });
    E.tone(d, t + 0.16, { type: 'sawtooth', f: 105, fpts: [[0.24, 135]], v: 0.09, a: 0.02, h: 0.2, d: 0.04, lp: 1600, q: 3 });
    E.nb(d, t + 0.16, { type: 'bandpass', f: 4200, q: 2, v: 0.06, a: 0.02, h: 0.2, d: 0.04, am: [70, 0.6] });
    E.nb(d, t + 0.43, { type: 'bandpass', f: 3000, q: 2, v: 0.2, a: 0.0005, d: 0.015 });
  });
  /* 连珠灯依次腾起：四团火焰由左到右 */
  S('whoosh', 2.2, 0.3, function (E, d, t) {
    var r = E.r;
    [0, 0.22, 0.44, 0.66].forEach(function (dt, i) {
      var v = i === 0 ? 1 : 0.55, p = -0.6 + i * 0.4;
      E.nb(d, t + dt, { k: 'pink', type: 'lowpass', f: 250, fpts: [[0.25, 3200], [1.0, 700]], q: 2, v: 0.5 * v, a: 0.14, h: 0.12, d: 0.8, pan: p });
      E.nb(d, t + dt, { k: 'brown', type: 'lowpass', f: 380, v: 0.45 * v, a: 0.1, h: 0.2, d: 0.8, pan: p });
    });
    for (var k = 0; k < 10; k++) E.nb(d, t + 0.1 + r() * 1.3, { type: 'bandpass', f: 1800 + r() * 3500, q: 2, v: 0.08 + r() * 0.15, a: 0.0005, d: 0.01 + r() * 0.02, pan: (r() - 0.5) * 1.4 });
  });
  function arrowOne(E, d, t, v, pan, hit) {
    var fl = 0.18 + E.r() * 0.12, f0 = 3800 + E.r() * 1400, ti = t + fl;
    E.nb(d, t, { type: 'bandpass', f: f0, f1: f0 * 0.45, ft: fl, q: 5, v: 0.3 * v, a: fl * 0.85, d: 0.04, pan: pan, pan1: pan * 0.3, pt: fl });
    E.tone(d, t, { f: f0 * 0.5, f1: f0 * 0.3, ft: fl, v: 0.02 * v, a: fl * 0.85, d: 0.03, pan: pan });
    if (hit === 1) {          // 钉入木头：闷响 + 箭杆颤动
      E.tone(d, ti, { f: 260, f1: 110, ft: 0.04, v: 0.55 * v, a: 0.0008, d: 0.08, pan: pan * 0.3 });
      E.nb(d, ti, { k: 'pink', type: 'bandpass', f: 1300, q: 1.3, v: 0.45 * v, a: 0.0005, d: 0.05, pan: pan * 0.3 });
      E.tone(d, ti + 0.004, { type: 'triangle', f: 170 + E.r() * 40, v: 0.13 * v, a: 0.002, d: 0.45, am: [26, 0.9], pan: pan * 0.3 });
    } else if (hit === 2) {   // 打在石头上
      E.nb(d, ti, { type: 'bandpass', f: 3200, q: 3, v: 0.3 * v, a: 0.0005, d: 0.03, pan: pan * 0.3 });
      E.tone(d, ti, { f: 1700, v: 0.06 * v, a: 0.0005, d: 0.05, pan: pan * 0.3 });
    }
  }
  S('arrow', 1.2, 0.25, function (E, d, t) { arrowOne(E, d, t, 1, -0.5, 1); });
  S('arrows', 2.4, 0.3, function (E, d, t) {
    for (var i = 0; i < 9; i++) arrowOne(E, d, t + i * 0.1 + E.r() * 0.08, 0.55 + E.r() * 0.3, (E.r() - 0.5) * 1.6, i % 3 === 2 ? 2 : (i % 4 === 3 ? 0 : 1));
  });
  /* 轰炸机群：多台螺旋桨发动机的拍频低吼，由远及近再远去（滤波打开、多普勒下滑、声像横移） */
  S('bomber', 8, 0.35, function (E, d, t) {
    var lp = E.filter('lowpass', 140, 1), am = E.gain(0.75), g = E.gain(0), p = E.pan(-0.7), srcs = [], nodes = [lp, am, g, p];
    [51, 54.5, 57.8, 103].forEach(function (f, i) {
      var o = E.osc('sawtooth', f);
      o.frequency.setValueAtTime(f, t); o.frequency.setValueAtTime(f, t + 4); o.frequency.linearRampToValueAtTime(f * 0.93, t + 5.5);
      if (i === 3) { var og = E.gain(0.3); o.connect(og); og.connect(lp); nodes.push(og); } else o.connect(lp);
      srcs.push(o);
    });
    var l = E.osc('sine', 11.5), lg = E.gain(0.25); l.connect(lg); lg.connect(am.gain); srcs.push(l); nodes.push(lg);
    lp.frequency.setValueAtTime(140, t); lp.frequency.exponentialRampToValueAtTime(950, t + 4.2); lp.frequency.exponentialRampToValueAtTime(260, t + 7.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 4.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 7.8);
    if (p.pan) { p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + 7.8); }
    lp.connect(am); am.connect(g); g.connect(p); p.connect(d);
    E.voice(t, t + 7.9, srcs, nodes);
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 200, fpts: [[4.2, 700], [7.6, 180]], v: 0.6, a: 4.2, d: 3.6, pan: -0.5, pan1: 0.5, pt: 7.8 });
  });
  S('explosion', 3.5, 0.5, function (E, d, t) {
    var r = E.r;
    E.tone(d, t, { f: 72, f1: 24, ft: 0.9, v: 1, a: 0.004, d: 1.4 });
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 4000, fpts: [[0.15, 1200], [1.6, 160]], v: 1.1, a: 0.003, d: 1.8 });
    E.nb(d, t, { type: 'lowpass', f: 7000, f1: 900, ft: 0.3, v: 0.5, a: 0.001, d: 0.3 });
    for (var i = 0; i < 12; i++) E.nb(d, t + 0.25 + r() * 1.6, { type: 'bandpass', f: 900 + r() * 2800, q: 2, v: 0.05 + r() * 0.1, a: 0.001, d: 0.02 + r() * 0.05, pan: (r() - 0.5) * 1.6 });
  });
  S('gust', 1.9, 0.2, function (E, d, t) {
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 300, fpts: [[0.7, 950], [1.6, 380]], q: 1.3, v: 0.55, a: 0.6, h: 0.2, d: 0.8, pan: -0.4, pan1: 0.4, pt: 1.6 });
    E.nb(d, t + 0.2, { type: 'bandpass', f: 900, fpts: [[0.6, 1700], [1.3, 1100]], q: 8, v: 0.06, a: 0.5, d: 0.6 });
  });
  S('car_door', 0.7, 0.2, function (E, d, t) {
    E.tone(d, t, { f: 130, f1: 65, ft: 0.1, v: 0.6, a: 0.002, d: 0.22 });
    E.nb(d, t, { k: 'pink', type: 'bandpass', f: 420, q: 3, v: 0.4, a: 0.001, d: 0.15 });
    E.nb(d, t + 0.01, { type: 'bandpass', f: 2400, q: 2, v: 0.15, a: 0.0005, d: 0.03 });
    E.tone(d, t + 0.01, { type: 'square', f: 820, v: 0.02, a: 0.001, d: 0.1, lp: 2000 });
    E.nb(d, t + 0.02, { type: 'bandpass', f: 1600, q: 4, v: 0.08, a: 0.002, h: 0.06, d: 0.1, am: [45, 0.8] });   // 车窗与钣金震颤
    E.tone(d, t, { f: 610, v: 0.05, a: 0.001, d: 0.18 });
  });
  S('splash', 1.2, 0.25, function (E, d, t) {
    var r = E.r;
    E.nb(d, t, { type: 'bandpass', f: 2600, f1: 900, ft: 0.35, q: 0.8, v: 0.55, a: 0.004, d: 0.4 });
    E.nb(d, t, { k: 'pink', type: 'lowpass', f: 650, v: 0.4, a: 0.004, d: 0.22 });
    for (var i = 0; i < 9; i++) { var f = 280 + r() * 500; E.tone(d, t + 0.05 + r() * 0.7, { f: f, fpts: [[0.05, f * 2.3]], v: 0.07 + r() * 0.07, a: 0.002, d: 0.07, pan: (r() - 0.5) }); }
  });
  S('cable', 2.4, 0.25, function (E, d, t) {
    E.tone(d, t, { f: 90, f1: 55, ft: 0.15, v: 0.5, a: 0.002, d: 0.2 });
    E.nb(d, t, { k: 'pink', type: 'lowpass', f: 1000, v: 0.3, a: 0.001, d: 0.08 });
    E.tone(d, t + 0.1, { type: 'sawtooth', f: 60, fpts: [[1.6, 140]], v: 0.14, a: 0.8, h: 0.6, d: 0.5, lp: 600 });
    E.tone(d, t + 0.1, { f: 400, fpts: [[1.6, 930]], v: 0.02, a: 0.8, h: 0.6, d: 0.5 });
    var n = E.noise('white'), bp = E.filter('bandpass', 1800, 2), am = E.gain(0.5), l = E.osc('sine', 8), lg = E.gain(0.5), g = E.gain(0), nodes = [bp, am, lg, g];
    l.frequency.setValueAtTime(8, t + 0.1); l.frequency.linearRampToValueAtTime(22, t + 1.9);
    n.connect(bp); bp.connect(am); l.connect(lg); lg.connect(am.gain); am.connect(g);
    var end = env(g.gain, t + 0.1, 0.12, 0.9, 0.5, 0.5);
    E.out(g, d, null, t, end - t, nodes); E.voice(t + 0.1, end, [n, l], nodes);
  });
  S('helicopter', 3.4, 0.2, function (E, d, t) {
    var dur = 3.2, am = E.gain(0.15), g = E.gain(0), p = E.pan(0.6), l = E.osc('sine', 12), sh = E.shaper(pulseCurve(3, 0));
    var n1 = E.noise('brown'), f1 = E.filter('lowpass', 700, 1), n2 = E.noise('white'), f2 = E.filter('bandpass', 1100, 1.2), g2 = E.gain(0.5), tur = E.osc('sine', 2150), tg = E.gain(0.012);
    l.connect(sh); sh.connect(am.gain);
    n1.connect(f1); f1.connect(am); n2.connect(f2); f2.connect(g2); g2.connect(am); am.connect(g); tur.connect(tg); tg.connect(g); g.connect(p); p.connect(d);
    l.frequency.setValueAtTime(12, t); l.frequency.linearRampToValueAtTime(14, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.2, t + 1); g.gain.setValueAtTime(1.2, t + 2.2); g.gain.linearRampToValueAtTime(0, t + dur);
    if (p.pan) { p.pan.setValueAtTime(0.6, t); p.pan.linearRampToValueAtTime(-0.6, t + dur); }
    E.voice(t, t + dur + 0.05, [n1, n2, tur, l], [am, g, p, sh, f1, f2, g2, tg]);
  });
  /* 获得线索：E6-B6-E7 玻璃钟琶音 + 高频闪光 */
  S('clue', 1.8, 0.35, function (E, d, t) {
    [[88, 0, 0.2], [95, 0.085, 0.17], [100, 0.17, 0.14]].forEach(function (x, i) { fmBell(E, d, t + x[1], mtof(x[0]), x[2], 2, 0.9, 1.3, (i - 1) * 0.3); });
    E.tone(d, t, { f: mtof(76), v: 0.06, a: 0.005, d: 0.5 });
    E.nb(d, t + 0.17, { type: 'highpass', f: 9000, v: 0.05, a: 0.01, d: 0.4 });
  });
  S('stamp', 0.6, 0.15, function (E, d, t) {
    E.tone(d, t, { f: 900, v: 0.05, a: 0.0005, d: 0.025 });
    E.nb(d, t + 0.03, { k: 'pink', type: 'lowpass', f: 1500, v: 0.6, a: 0.002, d: 0.08 });
    E.tone(d, t + 0.03, { f: 170, f1: 75, ft: 0.06, v: 0.6, a: 0.002, d: 0.14 });
    E.nb(d, t + 0.1, { type: 'bandpass', f: 4200, q: 1.5, v: 0.05, a: 0.01, d: 0.08 });
  });
  S('pen', 1.1, 0.05, function (E, d, t) {
    var r = E.r, tt = t;
    for (var i = 0; i < 6; i++) {
      var L = 0.05 + r() * 0.1, f = 2800 + r() * 2400;
      E.nb(d, tt, { type: 'bandpass', f: f, f1: f * (0.75 + r() * 0.5), ft: L, q: 2.5, v: 0.12 + r() * 0.06, a: 0.015, h: L, d: 0.03, am: [45 + r() * 40, 0.4] });
      tt += L + 0.03 + r() * 0.07;
    }
  });
  /* 低语：带共振峰的气声音节，在声场里游走，大混响 */
  S('whisper', 2.4, 0.6, function (E, d, t) {
    var r = E.r, tt = t;
    for (var i = 0; i < 8; i++) {
      var L = 0.08 + r() * 0.14, pan = Math.sin(i * 0.9) * 0.7, v = 0.18 + r() * 0.12;
      if (r() < 0.25) E.nb(d, tt, { type: 'highpass', f: 5200, v: v * 0.35, a: 0.03, h: L * 0.6, d: 0.08, pan: pan });
      else {
        var F1 = 450 + r() * 450;
        E.nb(d, tt, { k: 'pink', type: 'bandpass', f: F1, f1: F1 * (0.8 + r() * 0.4), ft: L + 0.1, q: 5, v: v, a: 0.04, h: L, d: 0.12, pan: pan });
        E.nb(d, tt, { type: 'bandpass', f: 1300 + r() * 1300, q: 6, v: v * 0.6, a: 0.04, h: L, d: 0.12, pan: pan });
      }
      tt += L + 0.06 + r() * 0.1;
    }
  });
  /* 寺钟：撞木闷击 + 十个非谐分音（低音分音成对拍频），最长余音约 10 秒 */
  S('bell', 10.5, 0.45, function (E, d, t) {
    E.nb(d, t, { k: 'brown', type: 'lowpass', f: 350, v: 0.45, a: 0.002, d: 0.1 });
    var f = 140, g = E.gain(1), srcs = [], nodes = [g];
    [[0.5, 0.3, 9, 0.35], [1, 0.45, 7.5, 0.8], [1.19, 0.28, 5.5, 0.5], [1.5, 0.2, 4.5, 0], [2, 0.24, 4, 0.9], [2.51, 0.13, 3, 0], [2.66, 0.12, 2.6, 0], [3.01, 0.1, 2.2, 0], [4.17, 0.06, 1.5, 0], [5.43, 0.04, 1, 0]].forEach(function (p) {
      var n = p[3] ? 2 : 1;
      for (var k = 0; k < n; k++) {
        var o = E.osc('sine', f * p[0] + k * p[3]), pg = E.gain(0);
        pg.gain.setValueAtTime(0, t); pg.gain.linearRampToValueAtTime(p[1] / n, t + 0.004); pg.gain.setTargetAtTime(0, t + 0.004, p[2] / 5);
        o.connect(pg); pg.connect(g); srcs.push(o); nodes.push(pg);
      }
    });
    E.out(g, d, null, t, 10, nodes); E.voice(t, t + 10.5, srcs, nodes);
  });
  S('woodfish', 0.8, 0.35, function (E, d, t) {
    E.tone(d, t, { f: 820, f1: 760, ft: 0.03, v: 0.45, a: 0.0008, d: 0.13 });
    E.tone(d, t, { f: 1710, v: 0.1, a: 0.0008, d: 0.05 });
    E.nb(d, t, { type: 'bandpass', f: 1150, q: 6, v: 0.35, a: 0.0006, d: 0.07 });
    E.nb(d, t, { type: 'highpass', f: 4000, v: 0.12, a: 0.0003, d: 0.006 });
  });
  S('match', 1.2, 0.15, function (E, d, t) {
    E.nb(d, t, { type: 'bandpass', f: 3300, f1: 2100, ft: 0.1, q: 1.5, v: 0.35, a: 0.01, h: 0.07, d: 0.04, am: [90, 0.6] });
    E.nb(d, t + 0.09, { k: 'pink', type: 'lowpass', f: 400, f1: 2600, ft: 0.12, v: 0.5, a: 0.03, d: 0.35 });
    E.nb(d, t + 0.12, { type: 'bandpass', f: 6000, q: 1, v: 0.05, a: 0.05, h: 0.3, d: 0.4 });
    for (var i = 0; i < 4; i++) E.nb(d, t + 0.12 + E.r() * 0.5, { type: 'bandpass', f: 2500 + E.r() * 2500, q: 2, v: 0.1, a: 0.0005, d: 0.008 });
  });
  S('stone', 2.6, 0.4, function (E, d, t) {
    var r = E.r, dur = 1.7, sl = E.gain(0.6), g = E.gain(0), n = E.noise('brown'), b = E.filter('bandpass', 240, 1.4), n2 = E.noise('white'), b2 = E.filter('bandpass', 1300, 1), g2 = E.gain(0.08), nodes = [sl, g, b, b2, g2];
    sl.gain.setValueAtTime(0.6, t);
    for (var k = 1; k <= 28; k++) sl.gain.linearRampToValueAtTime(0.3 + r() * 0.9, t + dur * k / 28);
    n.connect(b); b.connect(sl); n2.connect(b2); b2.connect(g2); g2.connect(sl); sl.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.3, t + 0.2); g.gain.setValueAtTime(1.3, t + dur - 0.25); g.gain.linearRampToValueAtTime(0, t + dur);
    E.out(g, d, null, t, dur, nodes); E.voice(t, t + dur + 0.05, [n, n2], nodes);
    E.tone(d, t, { f: 46, v: 0.25, a: 0.2, h: dur - 0.4, d: 0.3 });
    E.tone(d, t + dur - 0.05, { f: 85, f1: 45, ft: 0.15, v: 0.55, a: 0.002, d: 0.3 });
    E.nb(d, t + dur - 0.05, { k: 'brown', type: 'lowpass', f: 450, v: 0.45, a: 0.002, d: 0.2 });
  });
  S('gasp', 1.2, 0.3, function (E, d, t) {
    var r = E.r;
    for (var i = 0; i < 9; i++) {
      var tt = t + r() * 0.12, f0 = 160 + r() * 200, L = 0.12 + r() * 0.15, v = 0.06 + r() * 0.05;
      var o = E.osc('sawtooth', f0), n = E.noise('pink'), ng = E.gain(1.6), b1 = E.filter('bandpass', 650 + r() * 250, 5), b2 = E.filter('bandpass', 1050 + r() * 350, 7), g = E.gain(0), nodes = [ng, b1, b2, g];
      o.frequency.setValueAtTime(f0, tt); o.frequency.linearRampToValueAtTime(f0 * 1.18, tt + 0.08); o.frequency.linearRampToValueAtTime(f0 * 0.95, tt + L + 0.2);
      o.connect(b1); o.connect(b2); n.connect(ng); ng.connect(b1); ng.connect(b2); b1.connect(g); b2.connect(g);
      var end = env(g.gain, tt, v * 2.5, 0.03 + r() * 0.04, L, 0.25);
      E.out(g, d, { pan: (r() - 0.5) * 1.6 }, tt, end - tt, nodes); E.voice(tt, end, [o, n], nodes);
    }
  });
  S('typewriter', 2.4, 0.2, function (E, d, t) {
    var r = E.r, tt = t;
    for (var i = 0; i < 7; i++) {
      var v = 0.8 + r() * 0.3;
      E.nb(d, tt, { type: 'bandpass', f: 2400 + r() * 800, q: 1.2, v: 0.45 * v, a: 0.0005, d: 0.022 });
      E.tone(d, tt, { f: 1900, f1: 900, ft: 0.01, v: 0.06 * v, a: 0.0005, d: 0.018 });
      E.nb(d, tt + 0.008, { k: 'pink', type: 'lowpass', f: 450, v: 0.35 * v, a: 0.001, d: 0.045 });
      tt += 0.09 + r() * 0.12;
    }
    fmBell(E, d, tt + 0.12, 2630, 0.1, 2.76, 0.5, 1.0, 0.3);
  });

  /* ================================================================== 响度校准
   * 依据 tools/audiotest.py 的离线测量：BGM ≈ -20 dBFS RMS，环境音 ≈ -30 dBFS（明显低于 BGM），
   * 音效按峰值与听感类别调整（UI 音轻，爆炸/寺钟重）。 */
  (function () {
    var b = { title: 0.87, mystery: 1.1, daily: 0.75, library: 2.5, oldtimes: 1.3, tension: 1.2, dread: 1.3, underground: 0.7, tomb: 1, nepal: 1.5, paradise: 0.72, sorrow: 0.95, truth: 0.8 };
    var a = { city: 0.4, office: 1.3, rain: 1.2, wind: 0.9, drip: 1.2, crowd: 1.8, siren: 0.7, insects: 2.5, forest: 2.2, waterfall: 0.55, tunnel: 0.5, engine: 0.6, fire: 0.75 };
    var x = { click: 1.4, tap: 1.8, crack: 1.4, glass: 1.5, camera: 1.3, gust: 1.3, splash: 2, helicopter: 0.6, clue: 1.15, pen: 1.5, whisper: 1.3, bell: 0.75, woodfish: 1.6, stone: 0.55 };
    Object.keys(b).forEach(function (k) { BGM[k].level = b[k]; });
    Object.keys(a).forEach(function (k) { AMB[k].level = a[k]; });
    Object.keys(x).forEach(function (k) { SFX[k].gain = x[k]; });
  })();

  /* ================================================================== 对外接口 */
  var A = {
    ctx: null, E: null, timer: null, P: { bgm: null, amb: null }, hb: 0, muted: false, lastTick: -1, pumpErr: false, warned: {},
    vol: { master: 1, bgm: 0.5, sfx: 0.8, amb: null },
    want: { bgm: null, amb: null, hb: 0 }
  };
  function ready() { return !!(A.E && A.ctx && A.ctx.state !== 'closed'); }
  function warnOnce(k, msg) { if (!A.warned[k]) { A.warned[k] = 1; try { console.warn('[audio] ' + msg); } catch (e) { /* 忽略 */ } } }
  function pumpLive() {
    if (!ready() || A.ctx.state !== 'running') return;
    var now = A.ctx.currentTime, hidden = typeof document !== 'undefined' && document.hidden;
    try { A.E.pump(now, now + (hidden ? 1.5 : 0.1)); } catch (e) { if (!A.pumpErr) { A.pumpErr = true; console.warn('[audio] scheduler', e); } }
  }
  function layer(kind, id) {
    id = (id == null || id === '' || id === 'stop') ? null : String(id);
    A.want[kind] = id;
    if (!ready()) return;
    var E = A.E, t = A.ctx.currentTime, cur = A.P[kind];
    if (id && cur && cur.id === id && cur.endAt === Infinity) return;         // 同 id 不重启
    if (id && !(kind === 'bgm' ? BGM : AMB)[id]) { warnOnce(kind + id, 'unknown ' + kind + ' id: ' + id); return; }
    if (cur) cur.fadeOut(t, 1.5);
    A.P[kind] = id ? E.start(kind, id, t + 0.02, 1.5) : null;
    pumpLive();
  }

  GF.audio = {
    init: function () {
      try {
        if (!AC) { warnOnce('noac', 'WebAudio unavailable'); return false; }
        if (!A.ctx) {
          try { A.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { A.ctx = new AC(); }
          A.E = new Engine(A.ctx, { vol: { master: A.vol.master, bgm: A.vol.bgm, sfx: A.vol.sfx, amb: A.vol.amb } });
          if (A.muted) A.E.setVol(A.vol, true);
          A.timer = setInterval(pumpLive, 25);
          if (A.want.bgm) layer('bgm', A.want.bgm);
          if (A.want.amb) layer('amb', A.want.amb);
          if (A.want.hb) GF.audio.heartbeat(A.want.hb);
        }
        if (A.ctx.state === 'suspended' && A.ctx.resume) { var p = A.ctx.resume(); if (p && p.catch) p.catch(function () { /* 需要用户手势 */ }); }
        return true;
      } catch (e) { warnOnce('init', 'init failed: ' + e); return false; }
    },
    bgm: function (id) { try { layer('bgm', id); } catch (e) { warnOnce('bgmx', e); } },
    amb: function (id) { try { layer('amb', id); } catch (e) { warnOnce('ambx', e); } },
    sfx: function (id) {
      try {
        if (!ready() || A.ctx.state !== 'running') return;
        if (!SFX[id]) { warnOnce('sfx' + id, 'unknown sfx id: ' + id); return; }
        A.E.sfx(id, A.ctx.currentTime + 0.005);
      } catch (e) { warnOnce('sfxx', e); }
    },
    heartbeat: function (bpm) {
      try {
        bpm = Math.max(0, +bpm || 0);
        A.want.hb = bpm; A.hb = bpm;
        if (!ready()) return;
        A.E.heart(bpm, A.ctx.currentTime + 0.02);
        pumpLive();
      } catch (e) { warnOnce('hbx', e); }
    },
    tick: function () {
      try {
        if (!ready() || A.ctx.state !== 'running') return;
        var t = A.ctx.currentTime;
        if (t - A.lastTick < 0.03) return;
        A.lastTick = t;
        if (A.E.ok(1.2)) A.E.tick(t + 0.003);
      } catch (e) { warnOnce('tickx', e); }
    },
    setVolume: function (o) {
      try {
        o = o || {};
        ['master', 'bgm', 'sfx', 'amb'].forEach(function (k) { if (o[k] != null && isFinite(o[k])) A.vol[k] = clamp(+o[k], 0, 1); });
        if (ready()) A.E.setVol(A.vol, A.muted);
      } catch (e) { warnOnce('volx', e); }
    },
    mute: function (b) {
      try { A.muted = b === undefined ? true : !!b; if (ready()) A.E.setVol(A.vol, A.muted); } catch (e) { warnOnce('mutex', e); }
    },
    current: function () {
      return {
        state: A.ctx ? A.ctx.state : 'uninit',
        bgm: A.P.bgm && A.P.bgm.endAt === Infinity ? A.P.bgm.id : null,
        amb: A.P.amb && A.P.amb.endAt === Infinity ? A.P.amb.id : null,
        heartbeat: A.hb, muted: A.muted,
        volume: { master: A.vol.master, bgm: A.vol.bgm, sfx: A.vol.sfx, amb: A.vol.amb != null ? A.vol.amb : A.vol.bgm * 0.7 }
      };
    },
    /* —— 以下供自检 / 调试 —— */
    ids: function () { return { bgm: Object.keys(BGM), amb: Object.keys(AMB), sfx: Object.keys(SFX) }; },
    renderOffline: function (kind, id, secs, opt) {
      opt = opt || {};
      if (!OAC) return Promise.reject(new Error('OfflineAudioContext unavailable'));
      var sr = opt.sampleRate || 44100, ctx = new OAC(2, Math.ceil(secs * sr), sr);
      var E = new Engine(ctx, { offline: true, vol: opt.vol });
      if (kind === 'bgm' || kind === 'amb') { if (!E.start(kind, id, 0, opt.fade == null ? 1.5 : opt.fade)) return Promise.reject(new Error('no ' + kind + ' ' + id)); }
      else if (kind === 'sfx') { if (!E.sfx(id, 0.01)) return Promise.reject(new Error('no sfx ' + id)); }
      else if (kind === 'heartbeat') E.heart(+id || 80, 0);
      else if (kind === 'tick') { for (var i = 0; i < secs * 20; i++) E.tick(i * 0.05); }
      E.pump(0, secs);
      return ctx.startRendering();
    },
    _debug: function () {
      if (!A.E) return null;
      A.E.ok();
      return { voices: A.E.ends.length, players: A.E.players.map(function (p) { return p.kind + ':' + p.id + (p.endAt === Infinity ? '' : '(fading)'); }), bgmStart: A.P.bgm ? A.P.bgm.t0 : null, time: A.ctx.currentTime, state: A.ctx.state };
    },
    _meter: function () {
      if (!ready()) return null;
      if (!A.an) { A.an = A.ctx.createAnalyser(); A.an.fftSize = 2048; A.E.master.connect(A.an); }
      var b = new Float32Array(A.an.fftSize), s = 0;
      A.an.getFloatTimeDomainData(b);
      for (var i = 0; i < b.length; i++) s += b[i] * b[i];
      return Math.sqrt(s / b.length);
    },
    _engine: Engine
  };

  /* 登记表一致性提示 */
  try {
    var reg = GF.registry && GF.registry.audio;
    if (reg) [['bgm', BGM], ['amb', AMB], ['sfx', SFX]].forEach(function (x) {
      Object.keys(reg[x[0]] || {}).forEach(function (id) { if (!x[1][id]) console.warn('[audio] registry ' + x[0] + ' id not implemented: ' + id); });
    });
  } catch (e) { /* 忽略 */ }
})(typeof window !== 'undefined' ? window : globalThis);
