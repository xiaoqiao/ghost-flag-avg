/*
 * 角色剪影生成器（全游戏出镜最多的美术）
 * GF.art.char(id, {outfit}) → '<svg viewBox="0 0 400 900">…</svg>'
 *
 * 参数：registry.characters[id].sil（sex/age/build/height/hair/acc/outfits）与 color。
 * 每个角色在 LOOK 表里挑一个姿态（插兜、背手、叉腰、端茶、合十……）与服装；没登记的按配件推断。
 * 画法：
 *  - 腿、躯干、头、发、手臂、手、道具都是贝塞尔轮廓，统一深色渐变填充，放进同一个滤镜组；
 *  - 滤镜按整体 alpha 求出右上方的角色色轮廓光 + 外光晕 + 内侧包裹光 + 左侧冷色反光；
 *  - 挡在身前的手臂用略亮的色阶 + 暗缝线与躯干分开；衬衫、袈裟、领带是更亮/更暗的色阶面；
 *  - 细节线（衣领、口袋、扣子）、镜片反光、烟、蒸汽、发光符号、头盔玻璃放在滤镜组之上。
 * 与引擎的约定：
 *  - 轮廓光色 = CSS 变量 --gf-rim（缺省为角色色），在外层元素上设置即可整体换色（如 angry 变红）；
 *  - 根元素 class="gf-char" data-char=id；人物默认 3/4 侧向画面左方，需要反向时外层 scaleX(-1)；
 *  - 孙辉祖 outfit=flag 的巨旗超出 400 宽画框，根元素带 overflow:visible，外层不裁切时可见全貌。
 */
(function () {
  'use strict';
  var GF = window.GF;
  var U = GF.art.util;
  var seq = 0;

  /* ================= 数学与路径 ================= */
  function n1(v) { return String(Math.round(v * 10) / 10); }
  function pt(p) { return n1(p[0]) + ' ' + n1(p[1]); }
  function add(a, b, k) { if (k == null) k = 1; return [a[0] + b[0] * k, a[1] + b[1] * k]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function len(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1e-6; }
  function unit(v) { var l = len(v); return [v[0] / l, v[1] / l]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function perp(v) { return [-v[1], v[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
  /** 角度 → 方向：0=向下，90=向右，180=向上，-90=向左 */
  function dirOf(deg) { var r = deg * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }

  /** 平滑曲线：切线按弦长缩放（不过冲）；点的第三位为真 = 尖角 */
  function curve(P, closed, k) {
    if (k == null) k = 1;
    var n = P.length, d = 'M' + pt(P[0]), m = closed ? n : n - 1;
    for (var i = 0; i < m; i++) {
      var p1 = P[i], p2 = P[(i + 1) % n];
      if (p1[2] && p2[2]) { d += 'L' + pt(p2); continue; }
      var p0 = (closed || i > 0) ? P[(i - 1 + n) % n] : p1;
      var p3 = (closed || i + 2 < n) ? P[(i + 2) % n] : p2;
      var L = len(sub(p2, p1)) * k / 3;
      var c1 = p1[2] ? lerp(p1, p2, k / 3) : add(p1, unit(sub(p2, p0)), L);
      var c2 = p2[2] ? lerp(p2, p1, k / 3) : add(p2, unit(sub(p3, p1)), -L);
      d += 'C' + pt(c1) + ' ' + pt(c2) + ' ' + pt(p2);
    }
    return d + (closed ? 'Z' : '');
  }

  /** 肢体轮廓：J=[[x,y,宽],…]，c0/c1 = 起/止端圆头程度（0=平头） */
  function limb(J, c0, c1) {
    var n = J.length, A = [], B = [], T = [], i;
    for (i = 0; i < n; i++) {
      var t = unit(sub(J[Math.min(n - 1, i + 1)], J[Math.max(0, i - 1)])), q = perp(t), h = J[i][2] / 2;
      T.push(t);
      A.push([J[i][0] + q[0] * h, J[i][1] + q[1] * h]);
      B.push([J[i][0] - q[0] * h, J[i][1] - q[1] * h]);
    }
    if (!c1) { A[n - 1].push(1); B[n - 1].push(1); }
    if (!c0) { A[0].push(1); B[0].push(1); }
    var P = A.slice();
    if (c1) P.push(add(J[n - 1], T[n - 1], J[n - 1][2] / 2 * c1));
    P = P.concat(B.reverse());
    if (c0) P.push(add(J[0], T[0], -J[0][2] / 2 * c0));
    return curve(P, true);
  }

  /** 两段骨骼 IK：肩/髋 S → 目标 W，返回 [肘/膝, 实际腕/踝]；pref 决定弯向 */
  function ik(S, W, a, b, pref) {
    var d = sub(W, S), D = len(d);
    var Dc = Math.min(Math.max(D, Math.abs(a - b) + 4), a + b - 1);
    var c = Math.acos(Math.max(-1, Math.min(1, (a * a + Dc * Dc - b * b) / (2 * a * Dc))));
    var base = Math.atan2(d[1], d[0]);
    var E1 = [S[0] + a * Math.cos(base + c), S[1] + a * Math.sin(base + c)];
    var E2 = [S[0] + a * Math.cos(base - c), S[1] + a * Math.sin(base - c)];
    var m = lerp(S, W, 0.5);
    var E = dot(sub(E1, m), pref) >= dot(sub(E2, m), pref) ? E1 : E2;
    return [E, add(E, unit(sub(W, E)), b)];
  }

  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ================= 形状库 ================= */
  // 手：局部坐标 u=沿前臂方向（腕=0），v=横向（v>0 为拇指侧，自动朝向身体内侧）
  var HAND = {
    open: [[0, -9.5], [12, -11.5], [26, -11.5], [40, -9.5], [51, -6], [56, -1], [54, 4.5], [46, 8], [34, 9.5], [27, 10.5], [23, 15.5], [16, 17], [9, 14], [3, 10]],
    fist: [[0, -10], [10, -12.5], [22, -13], [31, -9], [34, -1], [32, 7], [24, 12], [13, 13], [4, 11]],
    flat: [[0, -8], [14, -9.5], [30, -9], [46, -7], [56, -4], [57, 0], [48, 1.5], [30, 3], [18, 6], [8, 9], [2, 8]],
    claw: [[0, -10], [12, -13], [22, -17], [35, -24], [38, -21], [30, -12], [44, -13], [47, -9], [35, -4], [48, -1], [48, 3], [35, 4], [43, 10], [40, 13], [28, 9], [23, 15], [16, 18], [9, 14], [3, 10]]
  };
  // 鞋：局部 x=向前（脚尖），y=自踝向下
  var SHOE = {
    shoe: [[-15, -6], [14, -6], [19, 7], [30, 14], [42, 19], [45, 25], [39, 28, 1], [-13, 28, 1], [-17, 21], [-16, 6]],
    snk: [[-16, -6], [15, -6], [21, 6], [33, 12], [45, 17], [48, 24], [43, 28, 1], [-15, 28, 1], [-19, 22], [-18, 6]],
    cloth: [[-13, -3], [12, -3], [20, 9], [34, 16], [43, 21], [42, 27], [35, 28, 1], [-12, 28, 1], [-15, 19]],
    heel: [[-8, -4], [8, -4], [13, 8], [25, 17], [32, 22], [32, 27], [25, 28, 1], [9, 25], [-3, 24], [-5, 28, 1], [-9, 28, 1], [-10, 10]],
    flat: [[-10, -3], [10, -3], [16, 9], [28, 17], [35, 22], [34, 27], [28, 28, 1], [-9, 28, 1], [-12, 18]],
    boot: [[-12, -6], [12, -6], [16, 8], [28, 16], [37, 21], [38, 26], [31, 28, 1], [-11, 28, 1], [-14, 20]],
    big: [[-23, -12], [21, -12], [27, 3], [41, 11], [53, 17], [56, 25], [50, 28, 1], [-21, 28, 1], [-26, 19], [-25, 0]]
  };
  // 发型：u=相对头宽，v=相对头高（头顶 v=0，下巴 v=1）
  var HAIR = {
    short: [[-.53, .45], [-.565, .26], [-.46, .07], [-.26, -.045], [.02, -.075], [.3, -.05], [.5, .08], [.585, .28], [.56, .45], [.49, .43, 1], [.47, .29], [.3, .2], [0, .23], [-.25, .2], [-.44, .27], [-.47, .45, 1]],
    crew: [[-.52, .4], [-.54, .2], [-.47, .045], [-.3, -.035], [0, -.045], [.3, -.035], [.47, .045], [.55, .2], [.545, .4], [.49, .38, 1], [.46, .22], [.25, .17], [0, .2], [-.25, .17], [-.45, .22], [-.47, .4, 1]],
    slick: [[-.5, .36], [-.545, .17], [-.43, .01], [-.15, -.07], [.18, -.065], [.47, .04], [.62, .22], [.62, .43], [.5, .45, 1], [.47, .26], [.2, .14], [-.12, .15], [-.36, .2], [-.47, .34, 1]],
    bun: [[-.52, .42], [-.555, .24], [-.45, .06], [-.22, -.05], [.05, -.07], [.32, -.03], [.5, .1], [.575, .28], [.555, .44], [.49, .42, 1], [.47, .28], [.3, .2], [0, .24], [-.28, .2], [-.45, .28], [-.47, .42, 1]],
    white: [[-.51, .47], [-.55, .3], [-.5, .13], [-.36, .01], [-.1, -.04], [.2, -.035], [.45, .06], [.575, .25], [.57, .46], [.5, .43, 1], [.48, .3], [.36, .13], [.1, .1], [-.2, .12], [-.4, .2], [-.47, .45, 1]],
    bob: [[-.6, 1.02], [-.68, .74], [-.67, .38], [-.52, .07], [-.2, -.08], [.18, -.08], [.5, .04], [.68, .3], [.72, .66], [.69, .97], [.6, 1.05, 1], [.52, .98], [.47, .64], [.42, .36], [.2, .31], [-.1, .34], [-.37, .33], [-.47, .52], [-.5, .9], [-.53, 1.03, 1]],
    longF: [[-.5, 1.1], [-.62, .74], [-.62, .36], [-.49, .06], [-.2, -.08], [.18, -.08], [.5, .05], [.64, .32], [.64, .72], [.58, .92], [.5, .74], [.46, .44], [.3, .3], [0, .31], [-.3, .3], [-.44, .46], [-.45, .86]],
    balR: [[.47, .26], [.56, .29], [.61, .45], [.575, .6], [.5, .6, 1], [.49, .42]],
    balL: [[-.47, .3], [-.545, .36], [-.56, .52], [-.5, .59, 1], [-.49, .42]]
  };

  /* ================= 服装 ================= */
  // hem=下摆 y（0=塞进裤子），long=长袍下摆 y，skirt=裙摆 y，fl=下摆外扩，sw/cw/ww/hp=肩胸腰臀加宽，sq=方肩
  // legs: tr 西裤 | slim 窄裤 | bare 光腿 | bound 绑腿 | puffy 防护服 | none 被袍子盖住
  var GARB = {
    shirt: { legs: 'tr', shoe: 'shoe', sl: 'long', ww: 2 },
    vest: { legs: 'tr', shoe: 'shoe', sl: 'shirt' },
    jacket: { hem: 556, fl: 7, cw: 5, ww: 9, hp: 6, legs: 'tr', shoe: 'snk', sl: 'long' },
    hoodie: { hem: 550, fl: 4, cw: 5, ww: 8, hp: 5, legs: 'tr', shoe: 'snk', sl: 'long' },
    suit: { hem: 574, fl: 3, sw: 5, cw: 2, ww: 5, hp: 6, sq: 1, legs: 'tr', shoe: 'shoe', sl: 'long' },
    uniform: { hem: 562, fl: 4, sw: 4, cw: 2, ww: 6, hp: 5, sq: 1, legs: 'tr', shoe: 'shoe', sl: 'long' },
    gown: { long: 852, fl: 22, ww: 5, hp: 5, legs: 'none', shoe: 'cloth', sl: 'wide1' },
    robe: { long: 866, fl: 38, sw: 3, cw: 6, ww: 12, hp: 12, legs: 'none', shoe: 'cloth', sl: 'wide' },
    tunic: { hem: 560, fl: 9, cw: 3, ww: 7, hp: 7, legs: 'bound', shoe: 'cloth', sl: 'long' },
    cnjacket: { hem: 566, fl: 9, cw: 4, ww: 10, hp: 9, legs: 'tr', shoe: 'cloth', sl: 'long' },
    cardigan: { hem: 566, fl: 5, cw: 3, ww: 7, hp: 6, legs: 'tr', shoe: 'shoe', sl: 'long' },
    tee: { hem: 532, fl: 3, ww: 2, hp: 2, legs: 'slim', shoe: 'snk', sl: 'short' },
    jacketF: { hem: 536, fl: 7, cw: 2, ww: 5, hp: 3, legs: 'slim', shoe: 'boot', sl: 'long' },
    dress: { long: 872, fl: 44, legs: 'none', shoe: 'flat', sl: 'long' },
    skirt: { skirt: 690, fl: 4, legs: 'bare', shoe: 'heel', sl: 'long' },
    sealsuit: { sw: 16, cw: 18, ww: 24, hp: 20, legs: 'puffy', shoe: 'big', sl: 'puffy' },
    night: { sw: -3, cw: -4, ww: -4, hp: -4, legs: 'bound', shoe: 'cloth', sl: 'long' }
  };

  /* ================= 角色造型表 =================
   * pose 姿态；garb 服装（缺省按配件推断）；st 站姿 n|wide|contra|narrow；tilt 头部倾角（负=低头向前）
   * hunch 驼背增减；lean 上身前倾；crouch 下蹲量；rag 衣摆破烂 */
  var LOOK = {
    naduo: { pose: 'naduo', st: 'contra', tilt: -3 },
    'naduo.suit': { pose: 'torch', st: 'wide', tilt: 0 },
    lantou: { pose: 'akimbo', st: 'wide', tilt: 3 },
    zhaowei: { pose: 'books', tilt: 3 },
    yangfzr: { pose: 'talk', tilt: -2 },
    laotai: { pose: 'backhand', st: 'narrow' },
    zhangqing: { pose: 'behind', hunch: -9, tilt: 3, st: 'narrow' },
    'zhangqing.black': { pose: 'crouch', crouch: 70, tilt: 2, garb: 'night' },
    suyicai: { pose: 'beads', garb: 'cnjacket', tilt: -3 },
    yangtie: { pose: 'teacup', garb: 'shirt', hunch: -12, tilt: 2 },
    fuxidi: { pose: 'hanky', garb: 'cardigan', hunch: -6, tilt: 4 },
    zhongshutong: { pose: 'cane', garb: 'cardigan', hunch: 5, tilt: -4 },
    minghui: { pose: 'salute' },
    qianliu: { pose: 'mad', hunch: 16, crouch: 18, tilt: -8, rag: 1, st: 'wide' },
    weixian: { pose: 'strap', garb: 'hoodie', tilt: 4, st: 'contraR' },
    'weixian.suit': { pose: 'rod', st: 'wide', tilt: -2 },
    manager: { pose: 'present', tilt: -2 },
    police: { pose: 'behind', st: 'wide' },
    huangjun: { pose: 'scratch', tilt: 5 },
    oumingde: { pose: 'watch', tilt: -3 },
    luyun: { pose: 'grace', garb: 'dress', st: 'contra', tilt: -4 },
    liangyingwu: { pose: 'pockets', st: 'n', tilt: 2 },
    younike: { pose: 'straps', garb: 'shirt' },
    butler: { pose: 'serve', tilt: -8, lean: 6, tails: 1 },
    xiahouying: { pose: 'hip', st: 'wide', tilt: 3 },
    driver: { pose: 'hip1', lean: 4, tilt: -3 },
    parkkeeper: { pose: 'jar', tilt: 2 },
    clerk: { pose: 'tray', tilt: -2 },
    colleague: { pose: 'folder', garb: 'skirt', st: 'contra', tilt: -4 },
    sunyaozu: { pose: 'sleeves', tilt: -2 },
    sunhuaizu: { pose: 'behind1', tilt: 3 },
    sunhuizu: { pose: 'fists', st: 'wide' },
    'sunhuizu.flag': { pose: 'flag', st: 'wide', tilt: 4 },
    sunnianzu: { pose: 'hat', tilt: -3 },
    zhong37: { pose: 'book', tilt: -3 },
    yuantong: { pose: 'palms', tilt: -6 },
    zhang37: { pose: 'crossed', garb: 'tunic', tilt: -6, st: 'contra' },
    qian37: { pose: 'clasp', garb: 'tunic', tilt: -7, lean: 3 }
  };

  function garbOf(sil, has, look) {
    if (look.garb) return look.garb;
    if (has('sealsuit')) return 'sealsuit';
    if (has('blackclothes')) return 'night';
    if (has('glowshirt')) return 'tee';
    if (has('kasaya')) return 'robe';
    if (has('longgown')) return 'gown';
    if (has('shortcoat')) return 'tunic';
    if (has('suit')) return 'suit';
    if (has('vest')) return 'vest';
    if (has('jacket')) return 'jacket';
    if (has('cap')) return 'uniform';
    if (sil.age === 'elder') return 'cnjacket';
    if (sil.sex === 'f') return 'jacketF';
    return 'shirt';
  }

  /* ================= 体型参数 ================= */
  function params(sil, look) {
    var f = sil.sex === 'f';
    var B = {
      f: f, age: sil.age,
      hh: f ? 95 : 104, hw: f ? 69 : 77, nw: f ? 11.5 : 16,
      sw: f ? 66 : 86, cw: f ? 58 : 76, ww: f ? 43 : 61, hp: f ? 66 : 65,
      ua: 150, fa: 134, hs: f ? 0.84 : 1,
      aw: f ? [26, 18.5, 14] : [35, 27, 20],
      lw: f ? [58, 33, 34, 20] : [66, 43, 42, 33],
      hj: f ? 29 : 33, jaw: f ? 0.3 : 0.41, nl: f ? 34 : 26,
      belly: 0, hunch: 0, drop: 0, hump: 0
    };
    var k = { thin: [0.91, 0.86, 0.87, 0.9, 0.85, 0.88], stout: [1.04, 1.18, 1.42, 1.2, 1.14, 1.32], huge: [1.44, 1.38, 1.3, 1.22, 1.46, 1.8] }[sil.build] || [1, 1, 1, 1, 1, 1];
    B.sw *= k[0]; B.cw *= k[1]; B.ww *= k[2]; B.hp *= k[3]; B.nw *= k[5]; B.hj *= (1 + k[3]) / 2;
    B.aw = B.aw.map(function (v) { return v * k[4]; });
    B.lw = B.lw.map(function (v) { return v * k[4]; });
    B.hs *= Math.sqrt(k[4]);
    if (sil.build === 'stout') { B.belly = 17; B.jaw += 0.06; B.hw *= 1.05; }
    if (sil.build === 'huge') { B.hh *= 0.93; B.jaw += 0.06; B.nl -= 8; }
    if (sil.age === 'elder') { B.hunch = f ? 28 : 23; B.sw *= 0.95; B.ua *= 0.97; B.fa *= 0.97; }
    else if (sil.age === 'old') B.hunch = 8;
    if (look.hunch) B.hunch = Math.max(0, B.hunch + look.hunch);
    B.drop = B.hunch * 1.1;
    B.hump = B.hunch * 0.5;
    return B;
  }

  /* ================= 骨架 ================= */
  function skel(B, look) {
    var f = B.f, cr = look.crouch || 0, K = { cx: 200 };
    K.yN = (f ? 254 : 250) + cr;
    K.ySh = K.yN + (f ? 13 : 12) + B.hump * 0.3;
    K.yCh = K.ySh + 70;
    K.yW = (f ? 440 : 448) + cr;
    K.yHip = (f ? 522 : 512) + cr;
    K.yCr = 546 + cr;
    K.yHJ = 540 + cr;
    K.yKn = 712; K.yAn = 862;
    var hu = B.hunch + (look.lean || 0);
    K.lean = function (y) {
      var t = (K.yW - y) / (K.yW - K.yN);
      if (t <= 0) return 0;
      if (t > 1.35) t = 1.35;
      return -hu * Math.pow(t, 1.5);
    };
    K.bx = function (y) { return K.cx + K.lean(y); };
    K.nx = K.bx(K.yN);
    K.hx = K.cx + K.lean(K.yN) * 1.45;
    K.top = K.yN - B.nl - B.hh + B.drop;
    K.yChin = K.top + B.hh;
    K.sh = function (sd) {
      var y = K.ySh + 20;
      return [K.cx + sd * (B.sw - B.aw[0] * 0.45) + K.lean(y) + (sd > 0 ? B.hump * 0.5 : 0), y];
    };
    return K;
  }

  /* ================= 主体：生成一个角色 ================= */
  function build(id, opts) {
    var reg = GF.registry && GF.registry.characters || {};
    var ch = reg[id] || { color: '#9aa0a6', sil: { sex: 'm', age: 'mid', build: 'normal', height: 1, hair: 'short', acc: [] } };
    var sil = ch.sil, outfit = opts && opts.outfit;
    if (!(outfit && sil.outfits && sil.outfits[outfit])) outfit = null;
    var acc = outfit ? sil.outfits[outfit].acc : (sil.acc || []);
    var has = function (a) { return acc.indexOf(a) >= 0; };
    var look = Object.assign({}, LOOK[id] || { pose: 'hang' }, outfit ? LOOK[id + '.' + outfit] || {} : {});
    if (outfit && !LOOK[id + '.' + outfit] && has('sealsuit')) look.pose = 'hang';
    var p = 'ch-' + id + '-' + (++seq);
    var rim = ch.color || '#9aa0a6';
    var rng = U.rng(hashStr(id));
    var B = params(sil, look);
    var gname = garbOf(sil, has, look);
    var G = Object.assign({ t: gname, sw: 0, cw: 0, ww: 0, hp: 0, fl: 0 }, GARB[gname]);
    var K = skel(B, look);
    var cx = K.cx, bx = K.bx, f = B.f;
    var sealed = gname === 'sealsuit';

    // 图层
    var Lb = [], Lback = [], Llegs = [], Lbody = [], Lmid = [], Lhead = [], Lfront = [], Lov = [], Lhov = [];
    var DL = '', DK = '';      // 细节线：DL=轮廓光色细线，DK=暗缝线
    var anim = '';             // 额外 CSS
    var C1 = '#272931', C2 = '#0b0c0f', ARM = '#1b1c23';

    function path(d, attr) { return '<path d="' + d + '"' + (attr || '') + '/>'; }
    function lp(P) { return P.map(function (q) { return [q[0] + K.lean(q[1]), q[1], q[2]]; }); }   // 套用驼背前倾
    function lineL(P, lean) { DL += curve(lean === false ? P : lp(P), false); }
    function lineK(P, lean) { DK += curve(lean === false ? P : lp(P), false); }
    function at(sd, dx, y) { return [bx(y) + sd * dx, y]; }
    function rect(c, w, h, r, a, fill) {
      return '<rect x="' + n1(c[0] - w / 2) + '" y="' + n1(c[1] - h / 2) + '" width="' + n1(w) + '" height="' + n1(h) + '" rx="' + n1(r) + '"' +
        (a ? ' transform="rotate(' + n1(a) + ' ' + pt(c) + ')"' : '') + (fill ? ' fill="' + fill + '"' : '') + '/>';
    }
    function circ(c, r, attr) { return '<circle cx="' + n1(c[0]) + '" cy="' + n1(c[1]) + '" r="' + n1(r) + '"' + (attr || '') + '/>'; }

    /* ---------- 姿态 ---------- */
    var hpW = B.hp + G.hp, wwW = B.ww + G.ww;
    function hang(sd, dx, hand) {
      var S = K.sh(sd), y = S[1] + (B.ua + B.fa) * 0.975;
      var x = S[0] + sd * (dx == null ? 8 : dx);
      if (B.hunch < 12) {
        var minX = cx + sd * (Math.max(hpW + (G.long ? G.fl * 0.25 : 0), wwW + B.belly) + B.aw[2] * 0.55 + 3);
        if (sd * (x - minX) < 0) x = minX;
      }
      return { w: [x, y], pref: [sd, 0], hand: hand || 'open' };
    }
    function pocket(sd, low) { return { w: at(sd, hpW - (low ? 4 : 12), K.yHip + (low ? 6 : -14)), pref: [sd, 0], hand: 'none' }; }
    function behind(sd) { return { w: at(sd, 14, K.yW + 26), pref: [sd, 0.25], hand: 'none', back: 1 }; }
    function onHip(sd) { return { w: at(sd, wwW + B.belly * (sd < 0 ? 1 : 0.4) + 5, K.yW + 8), pref: [sd, -0.55], hand: 'fist', ha: -sd * 30 }; }

    var A = {}, st = look.st || 'n', prop = {};
    switch (look.pose) {
      case 'naduo': A[1] = pocket(1); A[-1] = { w: at(-1, 30, K.yCh + 6), pref: [-1, 0.6], lf: 0.86, hand: 'fist', ha: 172 }; break;
      case 'torch': A[1] = hang(1, 14); A[-1] = { w: at(-1, 58, K.yW - 16), pref: [-1, 0.5], lf: 0.9, hand: 'fist', ha: -118 }; prop.torch = 1; break;
      case 'akimbo': A[1] = onHip(1); A[-1] = onHip(-1); break;
      case 'books': A[1] = hang(1); A[-1] = { w: at(-1, hpW - 4, K.yHip - 30), pref: [-1, 0.3], hand: 'open', ha: 158 }; prop.books = 1; break;
      case 'talk': A[1] = hang(1); A[-1] = { w: at(-1, wwW + 62, K.yCh - 18), pref: [-0.3, 1], hand: 'open', ha: -152 }; break;
      case 'backhand': A[1] = { w: at(1, 8, K.yW + 16), pref: [1, 0.3], hand: 'none', back: 1 }; A[-1] = hang(-1, 4); break;
      case 'behind': A[1] = behind(1); A[-1] = behind(-1); break;
      case 'beads': A[-1] = { w: at(-1, 14, K.yW - 16), pref: [-1, 0.4], lf: 0.9, hand: 'fist', ha: 50 }; A[1] = { w: at(1, 16, K.yW - 6), pref: [1, 0.4], lf: 0.9, hand: 'fist', ha: -50 }; prop.beads = 1; break;
      case 'teacup': A[1] = behind(1); A[-1] = { w: at(-1, 20, K.yCh + 34), pref: [-1, 0.8], lf: 0.76, hand: 'flat', ha: -96 }; prop.cup = 1; break;
      case 'hanky': A[-1] = { w: at(-1, 40, K.yCh + 2), pref: [-1, 0.8], lf: 0.8, hand: 'fist', ha: 172 }; A[1] = { w: at(1, 4, K.yW + 2), pref: [1, 0.3], lf: 0.9, hand: 'open', ha: -72 }; prop.hanky = 1; break;
      case 'cane': A[-1] = { w: at(-1, hpW + 26, K.yHip + 20), pref: [-0.4, 1], hand: 'fist', ha: 8 }; A[1] = { w: at(1, 30, K.yCh - 24), pref: [1, 0.7], lf: 0.8, hand: 'fist', ha: 166 }; prop.cane = 1; prop.cig = 1; break;
      case 'salute': A[-1] = { w: at(-1, 6, K.yCh + 18), pref: [-1, 0.6], lf: 0.74, hand: 'open', ha: 179 }; A[1] = hang(1, 10, 'fist'); prop.mala = 1; break;
      case 'mad': A[-1] = { w: at(-1, 66, K.yCh + 64), pref: [-0.3, 1], lf: 0.95, hand: 'claw', ha: -135 }; A[1] = { w: at(1, 22, K.yHip + 34), pref: [1, 0], hand: 'claw', ha: -12 }; break;
      case 'strap': A[1] = { w: at(1, 50, K.ySh + 36), pref: [1, 0.6], lf: 0.8, hand: 'fist', ha: 176 }; A[-1] = pocket(-1); prop.pack = 1; break;
      case 'rod': A[1] = { w: at(1, 64, K.yW + 16), pref: [1, 0.3], hand: 'fist', ha: -58 }; A[-1] = { w: at(-1, 76, K.yW - 44), pref: [-0.2, 1], hand: 'fist', ha: -112 }; prop.rod = 1; break;
      case 'present': A[-1] = { w: at(-1, B.sw + 70, K.yW - 24), pref: [0, 1], hand: 'flat', ha: -104 }; A[1] = { w: at(1, 8, K.yW - 34), pref: [1, 0.5], lf: 0.82, hand: 'fist', ha: -80 }; break;
      case 'scratch': A[1] = { w: [K.hx + 24, K.top + 46], pref: [1, -1], hand: 'fist', ha: -150, mid: 1 }; A[-1] = pocket(-1); break;
      case 'watch': A[-1] = { w: at(-1, 52, K.yCh + 14), pref: [-1, 0.7], lf: 0.82, hand: 'fist', ha: 172 }; A[1] = pocket(1); prop.watch = 1; break;
      case 'grace': A[-1] = { w: at(-1, 26, K.yCh + 46), pref: [-1, 0.8], lf: 0.8, hand: 'open', ha: -148 }; A[1] = hang(1, 18); break;
      case 'pockets': A[1] = pocket(1, 1); A[-1] = pocket(-1, 1); break;
      case 'straps': A[1] = { w: at(1, 36, K.ySh + 58), pref: [1, 0.7], lf: 0.8, hand: 'fist', ha: 180 }; A[-1] = { w: at(-1, 36, K.ySh + 58), pref: [-1, 0.7], lf: 0.8, hand: 'fist', ha: 180 }; prop.bigpack = 1; break;
      case 'serve': A[1] = { w: at(1, -26, K.yW - 14), pref: [1, 0.4], lf: 0.86, hand: 'open', ha: -94 }; A[-1] = behind(-1); break;
      case 'hip': A[1] = onHip(1); A[-1] = hang(-1, 10, 'fist'); break;
      case 'hip1': A[1] = onHip(1); A[-1] = hang(-1); break;
      case 'jar': A[1] = hang(1, 12, 'fist'); A[-1] = behind(-1); prop.jar = 1; break;
      case 'tray': A[1] = { w: at(1, B.sw + 4, K.ySh - 8), pref: [1, 0.6], lf: 0.92, hand: 'flat', ha: 176 }; A[-1] = hang(-1); prop.tray = 1; break;
      case 'folder': A[-1] = { w: at(-1, -20, K.yCh + 22), pref: [-1, 0.7], lf: 0.78, hand: 'open', ha: 112 }; A[1] = hang(1); prop.folder = 1; break;
      case 'sleeves': A[-1] = { w: at(-1, -18, K.yW - 30), pref: [-1, 0.5], lf: 0.82, hand: 'none' }; A[1] = { w: at(1, -18, K.yW - 26), pref: [1, 0.5], lf: 0.82, hand: 'none' }; break;
      case 'behind1': A[1] = behind(1); A[-1] = hang(-1); break;
      case 'fists': A[1] = hang(1, 18, 'fist'); A[-1] = hang(-1, 18, 'fist'); break;
      case 'hat': A[-1] = hang(-1, 10, 'fist'); A[1] = hang(1); prop.hat = 1; break;
      case 'book': A[-1] = { w: at(-1, -6, K.yCh + 30), pref: [-1, 0.6], lf: 0.8, hand: 'open', ha: 64 }; A[1] = hang(1); prop.book = 1; break;
      case 'palms': A[-1] = { w: at(-1, 3, K.yCh + 16), pref: [-1, 0.6], lf: 0.72, hand: 'open', ha: 172 }; A[1] = { w: at(1, 3, K.yCh + 16), pref: [1, 0.6], lf: 0.72, hand: 'open', ha: -172 }; break;
      case 'crossed': A[1] = { w: at(1, -40, K.yCh + 36), pref: [1, 0.6], lf: 0.78, hand: 'none' }; A[-1] = { w: at(-1, -42, K.yCh + 24), pref: [-1, 0.6], lf: 0.78, hand: 'fist', ha: 100 }; break;
      case 'clasp': A[1] = { w: at(1, 4, K.yHip - 12), pref: [1, 0.2], lf: 0.95, hand: 'open', ha: -40 }; A[-1] = { w: at(-1, 4, K.yHip - 6), pref: [-1, 0.2], lf: 0.95, hand: 'open', ha: 40 }; break;
      case 'crouch': A[-1] = { w: at(-1, 118, K.yW - 26), pref: [0, 1], hand: 'open', ha: -106 }; A[1] = { w: at(1, 104, K.yHip + 20), pref: [1, -0.2], hand: 'open', ha: 50 }; st = 'crouch'; break;
      case 'flag': prop.flag = 1; break;   // 手臂在巨旗段里另算
      default: A[1] = hang(1); A[-1] = hang(-1);
    }

    /* ---------- 巨旗（孙辉祖） ---------- */
    var poleA, poleB;
    if (prop.flag) {
      poleB = [cx + 92, 520]; poleA = [cx + 60, -300];
      var px = function (y) { return poleB[0] + (poleA[0] - poleB[0]) * (poleB[1] - y) / (poleB[1] - poleA[1]); };
      A[1] = { w: [px(64) + 4, 64], pref: [1, -0.1], hand: 'fist', ha: -96 };
      A[-1] = { w: [px(K.ySh + 74) - 6, K.ySh + 74], pref: [-0.3, 1], lf: 0.92, hand: 'fist', ha: 84 };
      var yA = -300, yB = 290;
      var flagD = function (ph) {
        var s = Math.sin, P = [];
        P.push([px(yA), yA, 1]);
        P.push([px(yA) - 250, yA - 24 + 14 * s(ph)]);
        P.push([-440, yA + 16 + 12 * s(ph + 1), 1]);
        for (var i = 1; i <= 4; i++) P.push([-440 + 22 * s(ph + i * 1.4) + i * 6, yA + 16 + i * 104]);
        P.push([-400 + 16 * s(ph + 2), yB - 44, 1]);
        P.push([-250, yB - 30 + 20 * s(ph + 2.5)]);
        P.push([-90, yB + 4 + 16 * s(ph + 3.3)]);
        P.push([px(yB) - 14, yB + 6]);
        P.push([px(yB), yB, 1]);
        return curve(P, true);
      };
      var fd = [flagD(0), flagD(2.1), flagD(4.2)];
      Lb.push('<linearGradient id="' + p + '-fg" gradientUnits="userSpaceOnUse" x1="-440" y1="0" x2="' + n1(px(0)) + '" y2="0">' +
        '<stop offset="0" stop-color="#c79c16"/><stop offset=".18" stop-color="#f2d03a"/><stop offset=".34" stop-color="#cfa51c"/><stop offset=".52" stop-color="#f0cb34"/>' +
        '<stop offset=".7" stop-color="#d8ad20"/><stop offset=".86" stop-color="#f4d443"/><stop offset="1" stop-color="#b98f14"/></linearGradient>' +
        '<linearGradient id="' + p + '-fv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0" stop-opacity=".25"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a2400" stop-opacity=".45"/></linearGradient>' +
        '<clipPath id="' + p + '-fc"><use href="#' + p + '-fp"/></clipPath>' +
        '<filter id="' + p + '-fb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>');
      Lb.push('<path id="' + p + '-fp" d="' + fd[0] + '" fill="url(#' + p + '-fg)"><animate attributeName="d" dur="4.2s" repeatCount="indefinite" values="' + fd[0] + ';' + fd[1] + ';' + fd[2] + ';' + fd[0] + '"/></path>');
      // 模糊的黑色螭龙纹
      Lb.push('<g clip-path="url(#' + p + '-fc)"><rect x="-440" y="-300" width="' + n1(px(0) + 440) + '" height="600" fill="url(#' + p + '-fv)"/>' +
        '<g filter="url(#' + p + '-fb)" fill="none" stroke="#1d1405" stroke-linecap="round" opacity=".72">' +
        '<path stroke-width="20" d="M-330 60C-250-40-170 150-70 40S120-70 170 70 60 210-40 180"/>' +
        '<path stroke-width="7" d="M-120 90l-30 50m20-50l10 60M60 0l30-50m-10 50l40-20M150 40l40 30m-150 150l-20 40m60-40l10 45M-300 40l-40-50m20 60l-50 0"/>' +
        '<circle cx="-330" cy="58" r="30" fill="#1d1405"/></g>' +
        '<path d="M-200 200C-60 150 60 240 200 200" stroke="#8a6410" stroke-width="3" fill="none" opacity=".35"/></g>');
      Lb.push(path('M' + pt(poleB) + 'L' + pt(poleA), ' stroke="#241a10" stroke-width="10" stroke-linecap="round"'));
      Lb.push(path('M' + pt(add(poleB, [-3, 0])) + 'L' + pt(add(poleA, [-3, 0])), ' stroke="' + rim + '" stroke-opacity=".5" stroke-width="1.6"'));
    }

    /* ---------- 腿与鞋 ---------- */
    var legT = G.legs, lw = B.lw.slice();
    if (legT === 'slim') lw = [lw[0] * 0.98, lw[1] * 1.02, lw[2], lw[3] * 1.15];
    if (legT === 'bare') lw = [lw[0] * 0.92, lw[1] * 0.85, lw[2] * 0.9, lw[3] * 0.8];
    if (legT === 'bound') lw = [lw[0] * 1.04, lw[1], lw[2] * 0.94, lw[3] * 0.72];
    if (legT === 'puffy') lw = lw.map(function (v) { return v * 1.3; });
    var ank = {}, legJ = {};
    [-1, 1].forEach(function (sd) {
      var H = [cx + sd * B.hj, K.yHJ], ax = B.hj + 3, lift = 0, kp = [sd, 0];
      if (st === 'wide') ax = B.hj + 26;
      if (st === 'narrow') ax = B.hj - 3;
      if (st === 'crouch') { ax = B.hj + 50; kp = [sd, -0.25]; }
      if (st === 'contra' || st === 'contraR') {
        var w8 = st === 'contra' ? -1 : 1;
        if (sd === w8) ax = B.hj - 26; else { ax = B.hj + 20; H[1] += 7; lift = 5; }
      }
      if (B.hunch > 12 || look.crouch) kp = [sd * 0.6 - 0.8, -0.2];
      var A0 = [cx + sd * ax, K.yAn - lift];
      var r = ik(H, A0, K.yKn - 540, K.yAn - K.yKn, kp), Kn = r[0], An = r[1];
      ank[sd] = An; legJ[sd] = [H, Kn, An];
      if (legT !== 'none') {
        var J = [[H[0], H[1] - 36, lw[0] * 1.02], [H[0], H[1], lw[0]], lerp(H, Kn, 0.5).concat(lw[0] * 0.86), [Kn[0], Kn[1], lw[1]], lerp(Kn, An, 0.36).concat(lw[2]), [An[0], An[1], lw[3]]];
        Llegs.push(path(limb(J, 0.6, 0), legT === 'puffy' || G.t === 'sealsuit' ? '' : ''));
        if (legT === 'puffy') { var kq = perp(unit(sub(An, Kn))); lineK([add(Kn, kq, lw[1] * 0.55), add(Kn, kq, -lw[1] * 0.55)], false); lineK([add(lerp(Kn, An, 0.75), kq, lw[2] * 0.52), add(lerp(Kn, An, 0.75), kq, -lw[2] * 0.52)], false); }
        if (legT === 'bound') for (var bi = 0; bi < 3; bi++) { var by = An[1] - 16 - bi * 16; lineK([[An[0] - lw[3] * 0.62, by + 6], [An[0] + lw[3] * 0.62, by - 4]], false); }
      }
      if (has('boots') && legT !== 'none') {
        var bt = sub(Kn, An), bq = perp(unit(bt));
        Llegs.push(path(limb([[Kn[0] + bt[0] * 0.08, Kn[1] - 10, lw[1] * 1.3], lerp(Kn, An, 0.36).concat(lw[2] * 1.12), [An[0], An[1], lw[3] * 1.3]], 0, 0), ' fill="' + C2 + '"'));
        lineL([add([Kn[0], Kn[1] - 10], bq, lw[1] * 0.66), add([Kn[0], Kn[1] - 10], bq, -lw[1] * 0.66)], false);
      }
      // 鞋
      var shoe = SHOE[G.shoe] || SHOE.shoe;
      if (has('boots')) shoe = SHOE.boot;
      var fdir = -1, fs = 1;
      if (sd > 0) { fs = 0.45; if (st === 'wide' || st === 'contra' || st === 'crouch') { fdir = 1; fs = 0.55; } }
      if (sd < 0 && st === 'contraR') { fdir = -1; fs = 0.7; }
      var foot = shoe.map(function (q) { return [An[0] + fdir * q[0] * (q[0] > 0 ? fs : 1) * (sd > 0 && q[0] < 0 ? 0.8 : 1), An[1] + q[1] + lift * (q[1] / 28), q[2]]; });
      Llegs.push(path(curve(foot, true), ' fill="' + C2 + '"'));
    });

    /* ---------- 躯干 ---------- */
    var sw = B.sw + G.sw, cw = B.cw + G.cw;
    function side(sg) {
      var a = [], bl = B.belly * (sg < 0 ? 1 : 0.4), hm = sg > 0 ? B.hump : 0;
      a.push([cx + sg * B.nw * 1.1, K.yN - 5]);
      if (hm) a.push([cx + sg * (B.nw + 12) + hm * 0.9, K.yN - 4 - hm * 0.8]);
      a.push([cx + sg * sw * 0.6 + hm * 0.8, K.ySh - 1 - hm * 0.4]);
      a.push([cx + sg * sw * 0.95 + hm * 0.5, K.ySh + 10, G.sq]);
      a.push([cx + sg * (sw + 1) + hm * 0.3, K.ySh + 40]);
      if (f) { a.push([cx + sg * cw, K.yCh + 8]); a.push([cx + sg * (cw - 3), K.yCh + 40]); a.push([cx + sg * (wwW + 7), K.yCh + 76]); }
      else { a.push([cx + sg * (cw + bl * 0.25), K.yCh + 24]); a.push([cx + sg * (wwW + (cw - wwW) * 0.45 + bl * 0.7), K.yW - 46]); }
      a.push([cx + sg * (wwW + bl), K.yW]);
      a.push([cx + sg * (hpW + bl * 0.4), K.yHip]);
      if (G.long) { a.push([cx + sg * (hpW + G.fl * 0.42), K.yKn - 30]); a.push([cx + sg * (hpW + G.fl), G.long, 1]); a.push([cx + sg * hpW * 0.5, G.long + 5]); }
      else if (G.skirt) { a.push([cx + sg * (hpW + 2), K.yHip + 70]); a.push([cx + sg * (hpW - 4 + G.fl), G.skirt, 1]); a.push([cx + sg * hpW * 0.5, G.skirt + 2]); }
      else if (G.hem) {
        var hy = G.hem + (look.crouch || 0);
        a.push([cx + sg * (hpW + G.fl), hy, 1]);
        if (look.rag) { a.push([cx + sg * (hpW * 0.78), hy - 10, 1]); a.push([cx + sg * hpW * 0.6, hy + 8, 1]); a.push([cx + sg * hpW * 0.34, hy - 6, 1]); }
        else a.push([cx + sg * hpW * 0.5, hy + 3]);
      } else { a.push([cx + sg * hpW * 0.96, K.yCr - 22]); a.push([cx + sg * 14, K.yCr + 2]); }
      return a;
    }
    var bot = G.long ? G.long + 6 : G.skirt ? G.skirt + 3 : G.hem ? G.hem + (look.crouch || 0) + (look.rag ? 10 : 4) : K.yCr + 6;
    var torsoPts = lp(side(1).concat([[cx, bot]], side(-1).reverse()));
    var torsoD = curve(torsoPts, true);
    // 背部层：长发、背包、燕尾、气瓶、兜帽
    // 躯干
    Lbody.push('<path id="' + p + '-to" d="' + torsoD + '"/>');

    /* ---------- 服装细节 ---------- */
    var yN = K.yN, yS = K.ySh, yC = K.yCh, yW = K.yW, nw = B.nw;
    var hemY = G.hem ? G.hem + (look.crouch || 0) : G.long || G.skirt || K.yCr;
    function band(y0, y1, w0, w1, fill) {   // 腰带之类的横带
      Lbody.push(path(curve(lp([[cx - w0, y0, 1], [cx + w0, y0, 1], [cx + w1, y1, 1], [cx - w1, y1, 1]]), true), ' fill="' + fill + '"'));
    }
    switch (gname) {
      case 'shirt': case 'vest':
        Lbody.push(path(curve(lp([[cx - nw - 1, yN - 6, 1], [cx - 3, yN + 18, 1], [cx + 3, yN + 18, 1], [cx + nw + 1, yN - 6, 1], [cx + nw + 6, yN + 4, 1], [cx, yN + 26, 1], [cx - nw - 6, yN + 4, 1]]), true), ' fill="' + C1 + '"'));
        band(yW + 30, yW + 42, wwW + B.belly * 0.7 + 1, wwW + B.belly * 0.6 + 3, C2);
        lineK([[cx, yN + 26], [cx - 1, yW + 30]]);
        if (gname === 'vest') {
          Lbody.push(path(curve(lp([[cx - nw - 4, yN - 2, 1], [cx + nw + 4, yN - 2, 1], [cx + 3, yC + 34, 1], [cx - 3, yC + 34, 1]]), true), ' fill="' + C1 + '"'));
          lineL([[cx - nw - 4, yN - 2], [cx - 2, yC + 34]]); lineL([[cx + nw + 4, yN - 2], [cx + 2, yC + 34]]);
          lineL([[cx - wwW - 1, yW + 20], [cx - 20, yW + 40], [cx - 2, yW + 52]]);
          for (var vb = 0; vb < 4; vb++) DL += 'M' + pt(lp([[cx - 1, yC + 50 + vb * 26]])[0]) + 'h.1';
        }
        break;
      case 'jacket': case 'hoodie':
        Lbody.push(path(curve(lp([[cx - 9, yN + 4], [cx + 9, yN + 4], [cx + 13, hemY + 2, 1], [cx - 13, hemY + 2, 1]]), true), ' fill="' + C1 + '"'));
        lineL([[cx - nw - 4, yN - 12], [cx - nw - 7, yN + 2], [cx - 10, yN + 14], [cx - 14, hemY]]);
        lineL([[cx + nw + 5, yN - 12], [cx + nw + 8, yN + 2], [cx + 10, yN + 14], [cx + 13, hemY]]);
        lineL([[cx - hpW + 6, yW + 40], [cx - hpW + 30, yW + 46]]); lineL([[cx + hpW - 6, yW + 40], [cx + hpW - 30, yW + 46]]);
        lineK([[cx - hpW - G.fl + 6, hemY - 14], [cx - 18, hemY - 12]]);
        if (gname === 'hoodie') { lineL([[cx - 7, yN + 10], [cx - 9, yN + 60]]); lineL([[cx + 7, yN + 10], [cx + 9, yN + 56]]); }
        break;
      case 'suit': case 'uniform':
        var vY = gname === 'suit' ? yC + 58 : yN + 22;
        Lbody.push(path(curve(lp([[cx - nw - 1, yN - 7, 1], [cx + nw + 1, yN - 7, 1], [cx + 1, vY, 1], [cx - 1, vY, 1]]), true), ' fill="' + C1 + '"'));
        if (has('bowtie')) Lbody.push(path(curve(lp([[cx, yN + 3], [cx - 17, yN - 5], [cx - 18, yN + 11], [cx, yN + 5], [cx + 18, yN - 5], [cx + 19, yN + 11]]), true), ' fill="' + C2 + '"'));
        else Lbody.push(path(curve(lp([[cx - 5, yN - 1], [cx + 5, yN - 1], [cx + 4, yN + 9], [cx + 8, vY + 30], [cx, vY + 42], [cx - 8, vY + 30], [cx - 4, yN + 9]]), true), ' fill="' + C2 + '"'));
        if (gname === 'suit') {
          lineL([[cx - nw - 3, yN - 6], [cx - nw - 8, yN + 30], [cx - 30, yC - 6], [cx - 20, yC + 4], [cx - 1, vY]]);
          lineL([[cx + nw + 3, yN - 6], [cx + nw + 8, yN + 30], [cx + 30, yC - 6], [cx + 20, yC + 4], [cx + 1, vY]]);
          lineK([[cx, vY], [cx - 3, hemY]]);
          DL += 'M' + pt(lp([[cx - 4, yW - 4]])[0]) + 'h.1';
          lineL([[cx - hpW + 8, yW + 58], [cx - hpW + 36, yW + 58]]); lineL([[cx + hpW - 8, yW + 58], [cx + hpW - 36, yW + 58]]);
          lineL([[cx + cw - 38, yC + 20], [cx + cw - 16, yC + 18]]);
        } else {
          band(yW + 2, yW + 16, wwW + 1, wwW + 2, C2);
          lineK([[cx, vY + 42], [cx - 1, hemY]]);
          for (var ub = 0; ub < 3; ub++) DL += 'M' + pt(lp([[cx - 1, yC + 10 + ub * 42]])[0]) + 'h.1';
          lineL([[cx - cw + 18, yC - 14], [cx - 20, yC - 14], [cx - 20, yC + 16], [cx - cw + 18, yC + 16], [cx - cw + 18, yC - 14]]);
          lineL([[cx + cw - 18, yC - 14], [cx + 20, yC - 14], [cx + 20, yC + 16], [cx + cw - 18, yC + 16], [cx + cw - 18, yC - 14]]);
          [-1, 1].forEach(function (sd) { Lbody.push(path(curve(lp([[cx + sd * (nw + 8), yS - 6, 1], [cx + sd * (sw - 4), yS + 4, 1], [cx + sd * (sw - 4), yS + 14, 1], [cx + sd * (nw + 8), yS + 6, 1]]), true), ' fill="' + C2 + '"')); });
          Lov.push(rect(lp([[cx - 2, yW + 9]])[0], 12, 8, 1, 0, rim) .replace('/>', ' opacity=".55"/>'));
        }
        break;
      case 'gown':
        lineL([[cx - nw - 2, yN - 14], [cx + nw + 2, yN - 14]]);
        lineL([[cx - nw * 0.4, yN - 2], [cx + 14, yN + 6], [cx + cw * 0.72, yC - 18], [cx + cw - 4, yC + 6]]);
        lineK([[cx - hpW - G.fl + 8, G.long], [cx - hpW - 6, G.long - 120]]);
        lineK([[cx + hpW + G.fl - 8, G.long], [cx + hpW + 6, G.long - 120]]);
        for (var gb = 0; gb < 3; gb++) { var gp = lp([[cx + 18 + gb * 16, yN + 10 + gb * 10]])[0]; DL += 'M' + pt(add(gp, [-4, -3])) + 'l8 6'; }
        break;
      case 'robe':
        // 袈裟：从 x+ 肩斜披到 x- 胯下
        Lbody.push(path(curve(lp([[cx + sw * 0.55, yS - 4, 1], [cx + sw + 2, yS + 34], [cx + hpW + 10, yW + 40], [cx + hpW + G.fl * 0.6, K.yKn + 10, 1], [cx - hpW - G.fl * 0.5, K.yKn - 30, 1], [cx - wwW - 8, yW - 10], [cx - cw * 0.3, yC + 10]]), true), ' fill="#2b2119"'));
        lineL([[cx + sw * 0.55, yS - 4], [cx - cw * 0.3, yC + 10], [cx - wwW - 8, yW - 10]]);
        lineK([[cx - 20, yW + 30], [cx + 40, yW + 110]]); lineK([[cx - 60, yW + 90], [cx + 20, K.yKn - 20]]);
        lineK([[cx - 8, yW + 70], [cx + 60, yW + 40]]); lineK([[cx - 70, yW + 20], [cx - 30, K.yKn - 30]]);
        lineL([[cx + nw + 2, yN - 6], [cx - 14, yC + 16]]); lineL([[cx - nw - 2, yN - 6], [cx + 2, yC - 10]]);
        Lov.push(circ(lp([[cx + 30, yC - 16]])[0], 5, ' fill="none" stroke="' + rim + '" stroke-opacity=".6" stroke-width="1.6"'));
        break;
      case 'tunic': case 'cnjacket':
        lineL([[cx - nw - 2, yN - 12], [cx - nw, yN + 2]]); lineL([[cx + nw + 2, yN - 12], [cx + nw, yN + 2]]);
        lineK([[cx, yN + 2], [cx - 1, hemY - 4]]);
        for (var tb = 0; tb < 5; tb++) { var tp = lp([[cx, yN + 18 + tb * (hemY - yN - 40) / 5]])[0]; DL += 'M' + pt(add(tp, [-7, 0])) + 'h14'; }
        if (gname === 'tunic') {
          band(yW - 6, yW + 10, wwW + 1, wwW + 3, C2);
          Lbody.push(path(curve(lp([[cx - 30, yW + 6], [cx - 40, yW + 60, 1], [cx - 30, yW + 62, 1], [cx - 22, yW + 8]]), true), ' fill="' + C2 + '"'));
        } else { lineL([[cx - hpW + 8, yW + 60], [cx - hpW + 34, yW + 62]]); lineL([[cx + hpW - 8, yW + 60], [cx + hpW - 34, yW + 62]]); }
        break;
      case 'cardigan':
        Lbody.push(path(curve(lp([[cx - nw - 2, yN - 6, 1], [cx + nw + 2, yN - 6, 1], [cx + 2, yC + 10, 1], [cx - 2, yC + 10, 1]]), true), ' fill="' + C1 + '"'));
        lineL([[cx - nw - 3, yN - 6], [cx - 2, yC + 10], [cx - 4, hemY]]); lineL([[cx + nw + 3, yN - 6], [cx + 2, yC + 10]]);
        for (var cb = 0; cb < 4; cb++) DL += 'M' + pt(lp([[cx - 7, yC + 24 + cb * 30]])[0]) + 'h.1';
        lineL([[cx - hpW + 8, yW + 56], [cx - hpW + 30, yW + 56], [cx - hpW + 30, yW + 80]]);
        break;
      case 'tee':
        lineL([[cx - nw - 5, yN - 6], [cx, yN + 12], [cx + nw + 5, yN - 6]]);
        break;
      case 'jacketF':
        lineL([[cx - nw - 6, yN - 10], [cx - 4, yN + 22], [cx - 3, hemY]]); lineL([[cx + nw + 6, yN - 10], [cx + 4, yN + 22]]);
        band(yW - 2, yW + 10, wwW + 1, wwW + 2, C2);
        break;
      case 'dress':
        lineL([[cx - nw - 10, yN - 2], [cx, yN + 18], [cx + nw + 10, yN - 2]]);
        band(yW - 6, yW + 4, wwW + 1, wwW + 1, C2);
        lineK([[cx - 10, yW + 30], [cx - 30, K.yKn], [cx - 40, G.long - 4]]); lineK([[cx + 16, yW + 40], [cx + 30, K.yKn + 20], [cx + 38, G.long - 4]]);
        lineL([[cx + hpW - 14, yW + 60], [cx + hpW + 6, K.yKn - 10], [cx + hpW + G.fl - 12, G.long - 2]]);
        break;
      case 'skirt':
        Lbody.push(path(curve(lp([[cx - nw - 1, yN - 4, 1], [cx + nw + 1, yN - 4, 1], [cx + 1, yN + 30, 1], [cx - 1, yN + 30, 1]]), true), ' fill="' + C1 + '"'));
        lineL([[cx - wwW - 1, yW + 4], [cx + wwW + 1, yW + 4]]);
        lineK([[cx - 20, G.skirt], [cx - 22, G.skirt - 60]]);
        break;
      case 'sealsuit':
        lineK([[cx - 1, yN + 4], [cx - 2, K.yCr - 10]]);
        Lbody.push(rect(lp([[cx - 30, yC + 12]])[0], 44, 52, 5, -3, C2));
        Lov.push(circ(lp([[cx - 42, yC + 2]])[0], 2.4, ' fill="#7cff9a" class="' + p + '-bl"') + circ(lp([[cx - 30, yC + 2]])[0], 2.4, ' fill="#ffb347" class="' + p + '-bl" style="animation-delay:-1.3s"'));
        band(yW + 8, yW + 22, wwW + 1, wwW + 3, C2);
        break;
      case 'night':
        band(yW - 4, yW + 14, wwW + 1, wwW + 2, C2);
        lineL([[cx + nw + 2, yN - 6], [cx - 16, yC + 20]]); lineL([[cx - nw - 2, yN - 6], [cx + 2, yC - 6]]);
        break;
    }

    /* ---------- 背后物件 ---------- */
    if (look.tails) {   // 燕尾
      [-1, 1].forEach(function (sd) {
        Lback.push(path(curve(lp([[cx + sd * (hpW - 18), K.yHip - 20], [cx + sd * (hpW + 6), K.yHip + 30], [cx + sd * (hpW + 10), K.yKn - 20, 1], [cx + sd * (hpW - 16), K.yKn - 40], [cx + sd * 12, K.yHip + 40]]), true)));
      });
    }
    if (gname === 'hoodie') Lback.push(path(curve(lp([[cx - nw - 10, yN - 4], [cx - 10, yN - 22], [cx + nw + 30, yN - 20], [cx + sw * 0.72, yS + 8], [cx + 10, yN + 20]]), true)));
    if (prop.pack) Lback.push(rect(lp([[cx + 64, yC + 36]])[0], 76, 150, 20, 7));
    if (prop.bigpack) {
      var pt0 = K.top - 40;
      Lback.push(rect([cx + 14, (pt0 + yW + 30) / 2], sw * 2 + 14, yW + 30 - pt0, 26, 0));
      Lback.push('<ellipse cx="' + n1(cx + 14) + '" cy="' + n1(pt0 + 4) + '" rx="' + n1(sw + 16) + '" ry="20" fill="' + C2 + '"/>');
      Lback.push(rect([cx + sw + 12, yC + 30], 30, 110, 12, 0));
      lineL([[cx + 14 - sw - 10, pt0 + 16], [cx + 14 + sw + 10, pt0 + 16]], false);
    }
    if (sealed) Lback.push(rect(lp([[cx + 52, yS - 12]])[0], 48, 196, 22, 5));

    /* ---------- 头部 ---------- */
    var hh = B.hh, hw = B.hw, hx = K.hx, top = K.top, turn = 0.05;
    function hq(u, v) { return [hx + u * hw, top + v * hh]; }
    var hair = sil.hair;
    var greyHair = sil.age === 'elder' && hair !== 'bald';
    var hairFill = hair === 'white' ? '#666870' : greyHair ? '#4d4f57' : '#0e0f13';
    // 长发的背后部分
    if (hair === 'long') {
      Lback.push(path(curve([hq(-0.45, 0.2), hq(-0.62, 0.9), hq(-0.74, 1.6), hq(-0.66, 2.3), hq(-0.3, 2.9), hq(0.3, 3.05), hq(0.8, 3.2), hq(1.22, 3.35), hq(1.16, 2.8), hq(1.25, 2.2), hq(1.05, 1.5), hq(0.9, 0.9), hq(0.66, 0.3), hq(0.3, -0.05)], true), ' fill="' + hairFill + '"'));
    }
    // 脖子
    var neckTop = [hx + hw * 0.06, K.yChin - 16];
    var neckBase = [K.nx + 2, yN + 12];
    Lhead.push(path(limb([neckBase.concat(nw * 2.25), lerp(neckBase, neckTop, 0.55).concat(nw * 1.95), neckTop.concat(nw * 2.05)], 0, 0.6)));
    if (gname === 'gown' || gname === 'tunic' || gname === 'cnjacket') Lhead.push(path(limb([[neckBase[0], yN - 2, nw * 2.5], [neckBase[0] + 2, yN - 16, nw * 2.35]], 0, 0)));
    if (sealed) Lhead.push('<ellipse cx="' + n1(hx + 4) + '" cy="' + n1(yN - 6) + '" rx="' + n1(hw * 0.78) + '" ry="15"/>');
    if (gname === 'hoodie') Lhead.push(path(curve([[neckBase[0] - nw - 12, yN - 2], [neckBase[0] - 4, yN - 16], [neckBase[0] + nw + 14, yN - 4], [neckBase[0], yN + 14]], true)));
    // 头
    var j = B.jaw;
    var headD = curve([hq(0.02, 0), hq(0.36, 0.055), hq(0.51, 0.24), hq(0.5, 0.41), hq(0.575, 0.45), hq(0.605, 0.56), hq(0.56, 0.67), hq(0.47, 0.7),
      hq(j, 0.86), hq(0.14 - turn, 0.985), hq(-0.04 - turn, 1), hq(-0.2 - turn, 0.965), hq(-j + 0.03 - turn * 0.5, 0.84),
      hq(-0.47, 0.7), hq(-0.54, 0.64), hq(-0.555, 0.53), hq(-0.5, 0.42), hq(-0.51, 0.24), hq(-0.35, 0.055)], true);
    Lhead.push(path(headD));
    // 头发
    function hairPath(pts) { return path(curve(pts.map(function (q) { return hq(q[0], q[1]).concat(q[2] ? [1] : []); }), true), ' fill="' + hairFill + '"'); }
    if (HAIR[hair]) Lhead.push(hairPath(HAIR[hair]));
    if (hair === 'long') Lhead.push(hairPath(HAIR.longF));
    if (hair === 'bun') Lhead.push('<ellipse cx="' + n1(hx + hw * 0.47) + '" cy="' + n1(top + hh * 0.1) + '" rx="' + n1(hw * 0.2) + '" ry="' + n1(hh * 0.16) + '" fill="' + hairFill + '"/>');
    if (hair === 'balding') { Lhead.push(hairPath(HAIR.balR)); Lhead.push(hairPath(HAIR.balL)); }
    if (hair === 'messy') {
      var wild = sil.age === 'elder', mp = [], mn = wild ? 11 : 9, a0 = wild ? 185 : 196, a1 = wild ? 358 : 346;
      for (var mi = 0; mi <= mn; mi++) {
        var ma = (a0 + (a1 - a0) * mi / mn) * Math.PI / 180;
        mp.push([Math.cos(ma) * 0.54, 0.45 + Math.sin(ma) * 0.53]);
        if (mi < mn) {
          var mt = ma + ((a1 - a0) / mn * 0.5 + (wild ? 14 : 18)) * Math.PI / 180, mr = (wild ? 1.3 : 1.17) + rng() * (wild ? 0.34 : 0.12);
          mp.push([Math.cos(mt) * 0.54 * mr, 0.45 + Math.sin(mt) * 0.53 * mr, wild ? 1 : 0]);
        }
      }
      mp.push([0.49, 0.43, 1], [0.46, 0.3], [0.3, 0.22], [0, 0.25], [-0.3, 0.22], [-0.46, 0.3], [-0.49, 0.45, 1]);
      Lhead.push(hairPath(mp));
    }
    // 帽子 / 兜帽
    if (has('cap')) {
      Lhead.push(path(curve([hq(-0.55, 0.32, 1), hq(-0.58, 0.18), hq(-0.72, 0.03), hq(-0.62, -0.12), hq(-0.2, -0.2), hq(0.3, -0.19), hq(0.66, -0.1), hq(0.74, 0.03), hq(0.6, 0.18), hq(0.58, 0.33)].map(function (q, i) { return i === 0 ? q.concat(1) : q; }), true), ' fill="' + C2 + '"'));
      Lhead.push(path(curve([hq(-0.5, 0.25), hq(-0.86, 0.36), hq(-0.8, 0.43), hq(-0.3, 0.39), hq(-0.1, 0.33)], true), ' fill="' + C2 + '"'));
      Lhov.push(path(curve([hq(-0.54, 0.29), hq(0, 0.33), hq(0.57, 0.3)], false), ' fill="none" stroke="' + rim + '" stroke-opacity=".45" stroke-width="1.4"'));
      Lhov.push(circ(hq(-0.02, 0.05), 5, ' fill="' + rim + '" opacity=".7"'));
    }
    if (gname === 'night') {
      Lhead.push(path(curve([hq(-0.56, 0.6), hq(-0.62, 0.3), hq(-0.5, 0.02), hq(-0.18, -0.1), hq(0.22, -0.1), hq(0.55, 0.03), hq(0.64, 0.3), hq(0.62, 0.55), hq(0.8, 0.52), hq(1.02, 0.66, 1), hq(0.82, 0.68), hq(0.98, 0.84, 1), hq(0.66, 0.74), hq(0.5, 0.86), hq(0.1, 1.02), hq(-0.3, 0.98)], true), ' fill="#101116"'));
      lineL([hq(-0.54, 0.46), hq(0, 0.5), hq(0.56, 0.44)], false);
    }

    // 头部叠加：眼镜反光、光头高光、戒疤、头盔
    if (hair === 'bald' || hair === 'balding' || hair === 'monk') {
      Lhov.push(path(curve([hq(0.08, 0.04), hq(0.32, 0.09), hq(0.44, 0.22)], false), ' fill="none" stroke="' + rim + '" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"'));
      if (hair === 'monk') for (var mk = 0; mk < 6; mk++) Lhov.push(circ(hq(-0.16 + (mk % 3) * 0.16, 0.07 + Math.floor(mk / 3) * 0.08), 2, ' fill="' + rim + '" opacity=".35"'));
    }
    if (hair === 'slick') Lhov.push(path(curve([hq(-0.3, 0.06), hq(0.1, 0.0), hq(0.46, 0.14)], false) + curve([hq(-0.2, 0.13), hq(0.15, 0.08), hq(0.5, 0.24)], false), ' fill="none" stroke="' + rim + '" stroke-opacity=".3" stroke-width="1.5" stroke-linecap="round"'));
    if (has('glasses')) {
      [[-0.2 - turn, 0.505, 0.15], [0.19 - turn * 0.5, 0.5, 0.155]].forEach(function (e, i) {
        var c = hq(e[0], e[1]), r = e[2] * hw;
        Lhov.push('<g class="' + p + '-gl"' + (i ? ' style="animation-delay:-.25s"' : '') + '>' + circ(c, r, ' fill="#cfd8e0" fill-opacity=".07" stroke="' + rim + '" stroke-opacity=".3" stroke-width="1.2"') +
          path('M' + pt(add(c, [-r * 0.55, r * 0.25])) + 'L' + pt(add(c, [r * 0.15, -r * 0.55])) + 'M' + pt(add(c, [-r * 0.05, r * 0.45])) + 'L' + pt(add(c, [r * 0.5, -r * 0.1])), ' stroke="#fff" stroke-opacity=".8" stroke-width="2" stroke-linecap="round"') + '</g>');
      });
      Lhov.push(path('M' + pt(hq(-0.05 - turn, 0.5)) + 'L' + pt(hq(0.035 - turn, 0.5)), ' stroke="' + rim + '" stroke-opacity=".35" stroke-width="1.2"'));
    }
    if (has('helmet')) {
      var hc0 = hq(0.02, 0.5), hr = hh * 0.8;
      Lhov.push('<radialGradient id="' + p + '-hg" cx=".42" cy=".38" r=".62"><stop offset=".55" stop-color="#bfe0ee" stop-opacity=".02"/><stop offset=".92" stop-color="#bfe0ee" stop-opacity=".16"/><stop offset="1" stop-color="#e8f6ff" stop-opacity=".32"/></radialGradient>' +
        circ(hc0, hr, ' fill="url(#' + p + '-hg)" stroke="#d6ecf5" stroke-opacity=".4" stroke-width="1.5"') +
        path('M' + pt(add(hc0, [hr * 0.35, -hr * 0.94])) + 'A' + n1(hr) + ' ' + n1(hr) + ' 0 0 1 ' + pt(add(hc0, [hr * 0.88, hr * 0.47])), ' fill="none" stroke="' + rim + '" stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"') +
        path('M' + pt(add(hc0, [-hr * 0.78, -hr * 0.2])) + 'A' + n1(hr * 0.86) + ' ' + n1(hr * 0.86) + ' 0 0 1 ' + pt(add(hc0, [-hr * 0.2, -hr * 0.8])), ' fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"') +
        circ(add(hc0, [-hr * 0.5, -hr * 0.62]), 3.2, ' fill="#fff" opacity=".8"'));
    }

    /* ---------- 手臂 ---------- */
    var HS = B.hs * (sealed ? 1.25 : 1);
    var arms = {};
    function armShape(sd, sp) {
      var S = K.sh(sd), lf = sp.lf || 1, r = ik(S, sp.w, B.ua * lf, B.fa * lf, sp.pref || [sd, 0]);
      var E = r[0], W = r[1], dir = sp.ha != null ? dirOf(sp.ha) : unit(sub(W, E));
      var w = B.aw.slice(), sl = sp.sleeve || G.sl, S0 = [S[0], S[1] - w[0] * 0.28];
      if (sl === 'puffy') w = w.map(function (v) { return v * 1.36; });
      var noHand = sp.hand === 'none', out = [], J;
      if (sl === 'wide' || sl === 'wide1') {
        var k = sl === 'wide' ? 1 : 0.72;
        J = [S0.concat(w[0] * 1.05), lerp(S, E, 0.5).concat(w[0] * (1 + 0.1 * k)), E.concat(w[1] * (1 + 0.45 * k)), lerp(E, W, 0.6).concat(w[2] * (1 + 1.6 * k)), W.concat(w[2] * (1 + 2.2 * k))];
        out.push(limb(J, 1, 0));
      } else if (sl === 'short') {
        out.push(limb([S0.concat(w[0] * 0.8), lerp(S, E, 0.5).concat(w[0] * 0.72), E.concat(w[1] * 0.74), lerp(E, W, 0.5).concat(w[1] * 0.72), W.concat(w[2] * 0.82)], 1, 0.8));
        out.push(limb([S0.concat(w[0] * 1.1), lerp(S, E, 0.44).concat(w[0] * 1.06)], 1, 0));
      } else {
        var sk = sl === 'shirt' ? 1.07 : 1;
        J = [S0.concat(w[0] * sk), lerp(S, E, 0.5).concat(w[0] * 0.94 * sk), E.concat(w[1] * sk), lerp(E, W, 0.5).concat(w[1] * 0.97 * sk), W.concat(w[2] * (noHand ? 1 : 1.08) * sk)];
        out.push(limb(J, 1, noHand ? 0.9 : 0));
      }
      var hand = noHand ? '' : curve(HAND[sp.hand].map(function (q) {
        var qq = perp(dir), s = HS * (f ? 0.96 : 1);
        return [W[0] + (dir[0] * q[0] + qq[0] * q[1] * sd) * s, W[1] + (dir[1] * q[0] + qq[1] * q[1] * sd) * s, q[2]];
      }), true);
      var hc = add(W, dir, (sp.hand === 'fist' ? 17 : 26) * HS);
      // 袖口线、防护服关节环
      var cq = perp(unit(sub(W, E)));
      if (!noHand && sl !== 'short') DK += 'M' + pt(add(W, cq, w[2] * (sl === 'wide' ? 1.5 : sl === 'wide1' ? 1.2 : 0.55))) + 'L' + pt(add(W, cq, -w[2] * (sl === 'wide' ? 1.5 : sl === 'wide1' ? 1.2 : 0.55)));
      if (sl === 'puffy') { var eq = perp(unit(sub(E, S))); DK += 'M' + pt(add(E, eq, w[1] * 0.5)) + 'L' + pt(add(E, eq, -w[1] * 0.5)); }
      arms[sd] = { S: S, E: E, W: W, dir: dir, hc: hc, w: w, sp: sp };
      return { d: out, hand: hand };
    }
    function drawArm(sd) {
      var sp = A[sd]; if (!sp) return;
      var a = armShape(sd, sp);
      var tgt = sp.back ? Lback : sp.mid ? Lmid : Lfront;
      var attr = sp.back ? '' : ' fill="' + (G.sl === 'shirt' ? '#25272f' : ARM) + '" stroke="' + C2 + '" stroke-width="1.6"';
      a.d.forEach(function (d) { tgt.push(path(d, attr)); });
      if (a.hand) tgt.push(path(a.hand, sp.back ? '' : ' fill="' + ARM + '" stroke="' + C2 + '" stroke-width="1.2"'));
    }
    // 背后的手先画；前面的手臂：x+ 先、x- 后（x- 在最前）
    drawArm(1); drawArm(-1);

    /* ---------- 手持道具 ---------- */
    var aR = arms[1], aL = arms[-1];
    if (has('bag')) {   // 斜挎包：背带从 x+ 肩到 x- 胯，包身在 x- 胯侧
      var bc = [bx(K.yHip) - hpW - 12, K.yHip + 14];
      Lmid.push(rect(bc, 70, 58, 9, -6));
      Lmid.push(path('M' + pt(lp([[cx + sw * 0.52, yS - 2]])[0]) + 'L' + pt(add(bc, [22, -26])), ' stroke="' + C2 + '" stroke-width="8" fill="none"'));
      lineL([add(bc, [-33, -12]), add(bc, [31, -18])], false);
      DL += 'M' + pt(lp([[cx + sw * 0.52 - 4, yS]])[0]) + 'L' + pt(add(bc, [17, -28]));
    }
    if (prop.pack) {
      Lmid.push(path('M' + pt(lp([[cx + sw * 0.5, yS - 2]])[0]) + 'Q' + pt(lp([[cx + sw * 0.4, yC]])[0]) + ' ' + pt(aR.hc), ' stroke="' + C2 + '" stroke-width="9" fill="none"'));
    }
    if (prop.bigpack) [-1, 1].forEach(function (sd) {
      Lmid.push(path('M' + pt([cx + sd * sw * 0.5, yS - 4]) + 'L' + pt(arms[sd].hc) + 'L' + pt([cx + sd * (wwW - 4), yW + 10]), ' stroke="' + C2 + '" stroke-width="9" fill="none" stroke-linejoin="round"'));
    });
    if (prop.books) {
      var bk = [bx(K.yHip) - hpW - 8, K.yHip - 44];
      Lmid.push(rect(bk, 34, 124, 3, -9, '#24252c'));
      lineL([add(bk, [-12, -58]), add(bk, [8, 62])], false); lineL([add(bk, [-2, -60]), add(bk, [18, 60])], false);
    }
    if (prop.folder) { var fc = [bx(yC) - 16, yC + 40]; Lmid.push(rect(fc, 66, 92, 3, 8, '#2e2b27')); lineL([add(fc, [-24, -44]), add(fc, [34, -38])], false); }
    if (prop.book) { var bc2 = [bx(yC) - 12, yC + 34]; Lmid.push(rect(bc2, 50, 66, 2, -6, '#2b2923')); lineL([add(bc2, [-27, -30]), add(bc2, [-21, 34])], false); }
    if (prop.cup) {   // 托盘上的茶杯（盖碗）
      var cu = add(aL.hc, [-2, -8]);
      Lfront.push('<ellipse cx="' + n1(cu[0]) + '" cy="' + n1(cu[1]) + '" rx="23" ry="4.5"/>');
      Lfront.push(path(curve([add(cu, [-12, -3]).concat(1), add(cu, [12, -3]).concat(1), add(cu, [15, -22]), add(cu, [0, -25]), add(cu, [-15, -22])], true)));
      Lfront.push('<ellipse cx="' + n1(cu[0]) + '" cy="' + n1(cu[1] - 24) + '" rx="15" ry="3.5"/>' + circ(add(cu, [0, -29]), 3.5));
      DL += 'M' + pt(add(cu, [-14, -20])) + 'Q' + pt(add(cu, [0, -17])) + ' ' + pt(add(cu, [14, -20]));
      prop.steam = add(cu, [0, -34]);
    }
    if (prop.jar) {
      var jc = add(aR.hc, [0, 8]);
      Lov.push(rect(jc, 36, 84, 7, 0, '#c9e0cf').replace('/>', ' fill-opacity=".13" stroke="#d8ece0" stroke-opacity=".4" stroke-width="1.4"/>') +
        rect(add(jc, [0, 16]), 32, 48, 5, 0, '#8c7a34').replace('/>', ' fill-opacity=".38"/>') +
        rect(add(jc, [0, -44]), 38, 10, 3, 0, '#15161c').replace('/>', ' stroke="' + rim + '" stroke-opacity=".5"/>') +
        path('M' + pt(add(jc, [-12, -34])) + 'v74', ' stroke="#fff" stroke-opacity=".25" stroke-width="3"'));
      prop.steam = add(jc, [0, -52]);
    }
    if (prop.hanky) {
      var hk = add(aL.hc, [0, 8]);
      Lfront.push(path(curve([add(hk, [-11, 0]), add(hk, [12, -2]), add(hk, [20, 30]), add(hk, [8, 58]), add(hk, [-4, 44]), add(hk, [-16, 26])], true), ' fill="#6f5a63"'));
      DL += curve([add(hk, [0, 18]), add(hk, [5, 30]), add(hk, [2, 42])], false);
    }
    if (prop.beads || prop.mala || B.age === 'elder' && has('rosary')) {
      var beads = [];
      if (prop.beads) { for (var bi2 = 0; bi2 <= 14; bi2++) { var tt = bi2 / 14; beads.push(add(lerp(aL.hc, aR.hc, tt), [0, Math.sin(tt * Math.PI) * 58 + 4])); } }
      if (prop.mala) { var mc = add(aR.hc, [0, 34]); for (var mb = 0; mb < 16; mb++) { var mang = mb / 16 * Math.PI * 2; beads.push([mc[0] + Math.sin(mang) * 12, mc[1] - Math.cos(mang) * 32]); } }
      beads.forEach(function (b) { Lfront.push(circ(b, 4.6)); Lov.push(circ(add(b, [1.3, -1.5]), 1.3, ' fill="' + rim + '" opacity=".75"')); });
      if (has('rosary')) {   // 胸前长佛珠
        for (var nb = 0; nb <= 18; nb++) {
          var t2 = nb / 18, bp = lp([[cx + (t2 - 0.5) * 2 * (nw + 18) * (1 - Math.sin(t2 * Math.PI) * 0.72), yN + Math.sin(t2 * Math.PI) * (yC - yN + 70)]])[0];
          Lbody.push(circ(bp, 4.4, ' fill="#2c2820"')); Lov.push(circ(add(bp, [1.2, -1.4]), 1.2, ' fill="' + rim + '" opacity=".65"'));
        }
      }
    }
    if (prop.cane) {
      var ct = add(aL.hc, [0, -6]), cf = [aL.hc[0] - 26, 889];
      Lfront.push(path('M' + pt(cf) + 'L' + pt(ct) + 'Q' + pt(add(ct, [-2, -18])) + ' ' + pt(add(ct, [-18, -14])), ' fill="none" stroke="#17181e" stroke-width="7" stroke-linecap="round"'));
    }
    if (prop.tray) {
      var tc = add(aR.hc, [-4, -16]);
      Lfront.push('<ellipse cx="' + n1(tc[0]) + '" cy="' + n1(tc[1]) + '" rx="52" ry="6"/>');
      [-22, 8].forEach(function (dx, i) {
        var g0 = add(tc, [dx, -4]);
        Lfront.push(path(curve([add(g0, [-8, 0]).concat(1), add(g0, [8, 0]).concat(1), add(g0, [1.5, -3]), add(g0, [1.5, -16]), add(g0, [9, -24]), add(g0, [7, -40]).concat(1), add(g0, [-7, -40]).concat(1), add(g0, [-9, -24]), add(g0, [-1.5, -16]), add(g0, [-1.5, -3])], true)));
        Lov.push(path('M' + pt(add(g0, [4, -36])) + 'l1.5 12', ' stroke="#fff" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"'));
      });
    }
    if (prop.hat) {
      var hc2 = add(aL.hc, [-8, 20]);
      Lfront.push('<ellipse cx="' + n1(hc2[0] + 2) + '" cy="' + n1(hc2[1]) + '" rx="11" ry="36" transform="rotate(8 ' + pt(hc2) + ')"/>');
      Lfront.push(path(curve([add(hc2, [-2, -24]), add(hc2, [-26, -18]), add(hc2, [-30, 4]), add(hc2, [-24, 22]), add(hc2, [-2, 24])], true)));
      lineL([add(hc2, [-18, -18]), add(hc2, [-22, 18])], false);
    }
    if (prop.torch) {
      var td = aL.dir, t0 = add(aL.hc, td, -10), t1 = add(aL.hc, td, 34);
      Lfront.push(path('M' + pt(t0) + 'L' + pt(t1), ' stroke="#202229" stroke-width="15" stroke-linecap="round"'));
      Lov.push(circ(add(t1, td, 3), 9, ' fill="#fff4d6" filter="url(#' + p + '-glow)"'));
    }
    if (prop.rod) {   // 三米长金属探杆：穿过两手，伸出画面
      var rdir = unit(sub(aL.hc, aR.hc)), r0 = add(aR.hc, rdir, -70), r1 = add(aR.hc, rdir, 1200);
      Lfront.push(path('M' + pt(r0) + 'L' + pt(r1), ' stroke="#20232a" stroke-width="6" stroke-linecap="round"'));
      var rq = perp(rdir);
      Lov.push(path('M' + pt(add(r0, rq, 2)) + 'L' + pt(add(r1, rq, 2)), ' stroke="' + rim + '" stroke-opacity=".7" stroke-width="1.3"'));
      Lov.push(path('M' + pt(add(r0, rq, -1.5)) + 'L' + pt(add(r1, rq, -1.5)), ' stroke="#fff" stroke-opacity=".22" stroke-width="1"'));
      // 手重画在杆子上面
      [1, -1].forEach(function (sd) { var a = arms[sd]; Lfront.push(path(curve(HAND.fist.map(function (q) { var qq = perp(a.dir), s = HS; return [a.W[0] + (a.dir[0] * q[0] + qq[0] * q[1] * sd) * s, a.W[1] + (a.dir[1] * q[0] + qq[1] * q[1] * sd) * s]; }), true), ' fill="' + ARM + '" stroke="' + C2 + '" stroke-width="1.2"')); });
    }
    if (prop.flag) {   // 两只手压在旗杆上
      [1, -1].forEach(function (sd) { var a = arms[sd]; Lfront.push(circ(a.hc, 13 * HS, ' fill="' + ARM + '" stroke="' + C2 + '" stroke-width="1.2"')); });
    }
    if (prop.watch) {   // 催眠用的怀表，在指间摆动
      var wt = add(aL.hc, [0, 12]);
      Lov.push('<g class="' + p + '-sw">' + path('M' + pt(wt) + 'l0 64', ' stroke="' + rim + '" stroke-opacity=".6" stroke-width="1.4" stroke-dasharray="3 2"') +
        circ(add(wt, [0, 76]), 12, ' fill="#15161c" stroke="' + rim + '" stroke-width="2.2"') + circ(add(wt, [0, 76]), 7, ' fill="none" stroke="' + rim + '" stroke-opacity=".45"') +
        path('M' + pt(add(wt, [-4, 71])) + 'l5-4', ' stroke="#fff" stroke-opacity=".8" stroke-width="1.8" stroke-linecap="round"') + '</g>');
      anim += '.' + p + '-sw{transform-box:fill-box;transform-origin:50% 0;animation:' + p + '-sw 2.4s ease-in-out infinite}@keyframes ' + p + '-sw{0%,100%{transform:rotate(9deg)}50%{transform:rotate(-9deg)}}';
    }
    if (has('armband') && aR) {   // 红袖章（x+ 上臂）
      var ad = unit(sub(aR.E, aR.S)), aq = perp(ad), ah = aR.w[0] * 0.53, s1 = add(aR.S, ad, 42), s2 = add(aR.S, ad, 70);
      Lov.push(path('M' + pt(add(s1, aq, ah)) + 'L' + pt(add(s2, aq, ah * 0.97)) + 'L' + pt(add(s2, aq, -ah * 0.97)) + 'L' + pt(add(s1, aq, -ah)) + 'Z', ' fill="#8e2c22"') +
        path('M' + pt(add(lerp(s1, s2, 0.35), aq, -ah * 0.5)) + 'l' + n1(aq[0] * ah) + ' ' + n1(aq[1] * ah) + 'M' + pt(add(lerp(s1, s2, 0.65), aq, -ah * 0.5)) + 'l' + n1(aq[0] * ah) + ' ' + n1(aq[1] * ah), ' stroke="#e4c25a" stroke-opacity=".75" stroke-width="3"'));
    }
    if (has('lanyard')) {
      var lc = lp([[cx - 2, yC + 36]])[0];
      DL += 'M' + pt(lp([[cx - nw - 4, yN - 4]])[0]) + 'L' + pt(lc) + 'L' + pt(lp([[cx + nw + 4, yN - 4]])[0]);
      Lov.push(rect(add(lc, [0, 20]), 24, 32, 2, 3, '#b5c2c6').replace('/>', ' opacity=".55"/>') + rect(add(lc, [0, 12]), 24, 8, 1, 3, '#3f6b7c').replace('/>', ' opacity=".7"/>'));
    }
    if (prop.cig) {   // 指间香烟 + 一缕上升的淡烟
      var cd = aR.dir, c0 = add(aR.hc, cd, 10), c1 = add(c0, [-12, -4]);
      Lov.push(path('M' + pt(c0) + 'L' + pt(c1), ' stroke="#e6e0d2" stroke-width="3" stroke-linecap="round"') + circ(c1, 2.6, ' fill="#ff9340" class="' + p + '-em" filter="url(#' + p + '-glow)"'));
      prop.smoke = c1;
    }
    if (prop.smoke || prop.steam) {
      var so = prop.smoke || prop.steam, big = prop.smoke ? 1 : 0.6;
      var sp1 = curve([so, add(so, [-6, -40 * big]), add(so, [8, -80 * big]), add(so, [-4, -125 * big]), add(so, [10, -170 * big])], false);
      var sp2 = curve([add(so, [2, 0]), add(so, [10, -35 * big]), add(so, [-2, -75 * big]), add(so, [14, -115 * big])], false);
      Lov.push('<g fill="none" stroke="#d8dce4" stroke-linecap="round" filter="url(#' + p + '-bl)">' + path(sp1, ' class="' + p + '-sm" stroke-width="' + (3 * big + 1) + '"') + path(sp2, ' class="' + p + '-sm" stroke-width="' + (2 * big + 1) + '" style="animation-delay:-2.2s"') + '</g>');
      anim += '.' + p + '-sm{stroke-dasharray:40 26;opacity:.3;animation:' + p + '-sm 4.5s linear infinite}@keyframes ' + p + '-sm{from{stroke-dashoffset:132}to{stroke-dashoffset:0}}' +
        '.' + p + '-em{animation:' + p + '-bl 2.8s ease-in-out infinite}';
    }

    /* ---------- 夏侯婴的发光符号 ---------- */
    if (has('glowshirt')) {
      var gd = '', cnt = 0;
      function glyph(x, y, s, t) {
        switch (t) {
          case 0: return 'M' + pt([x - s, y]) + 'a' + n1(s) + ' ' + n1(s) + ' 0 1 0 ' + n1(2 * s) + ' 0a' + n1(s) + ' ' + n1(s) + ' 0 1 0 ' + n1(-2 * s) + ' 0M' + pt([x, y - s * 0.4]) + 'v' + n1(s * 0.8);
          case 1: return 'M' + pt([x, y - s]) + 'L' + pt([x + s * 0.9, y + s * 0.7]) + 'L' + pt([x - s * 0.9, y + s * 0.7]) + 'Z';
          case 2: return 'M' + pt([x - s, y + s * 0.4]) + 'l' + n1(s * 0.5) + ' ' + n1(-s) + 'l' + n1(s * 0.5) + ' ' + n1(s) + 'l' + n1(s * 0.5) + ' ' + n1(-s) + 'l' + n1(s * 0.5) + ' ' + n1(s);
          case 3: return 'M' + pt([x - s, y]) + 'Q' + pt([x, y - s]) + ' ' + pt([x + s, y]) + 'Q' + pt([x, y + s]) + ' ' + pt([x - s, y]) + 'M' + pt([x, y]) + 'h.1';
          case 4: return 'M' + pt([x, y - s]) + 'v' + n1(2 * s) + 'M' + pt([x - s * 0.7, y - s * 0.3]) + 'h' + n1(s * 1.4) + 'M' + pt([x - s * 0.6, y + s]) + 'l' + n1(s * 0.6) + ' ' + n1(-s * 0.5) + 'l' + n1(s * 0.6) + ' ' + n1(s * 0.5);
          default: return 'M' + pt([x - s, y - s * 0.6]) + 'C' + pt([x + s, y - s * 1.4]) + ' ' + pt([x + s * 1.2, y + s * 0.6]) + ' ' + pt([x, y + s * 0.4]) + 'S' + pt([x - s * 0.6, y - s * 0.2]) + ' ' + pt([x, y - s * 0.2]);
        }
      }
      for (var gy = yN + 22; gy < hemY - 8; gy += 30) for (var gx = -cw + 14; gx < cw - 10; gx += 30) { gd += glyph(bx(gy) + gx + (rng() - 0.5) * 12, gy + (rng() - 0.5) * 10, 7 + rng() * 5, (cnt++ * 7 + (rng() * 6 | 0)) % 6); }
      [-1, 1].forEach(function (sd) {
        var LJ = legJ[sd];
        for (var li = 0; li < 7; li++) { var q = li < 3 ? lerp(LJ[0], LJ[1], 0.2 + li * 0.3) : lerp(LJ[1], LJ[2], (li - 3) * 0.24 + 0.08); gd += glyph(q[0] + (rng() - 0.5) * 14, q[1], 6 + rng() * 4, (cnt++ + li) % 6); }
      });
      var clipId = p + '-cp';
      Lov.push('<clipPath id="' + clipId + '"><use href="#' + p + '-to"/>' + Llegs.filter(function (s, i) { return true; }).map(function (s) { return s.replace('<path ', '<path '); }).join('') + '</clipPath>');
      Lov.push('<path d="' + gd + '" fill="none" stroke="#9dffc4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#' + clipId + ')" filter="url(#' + p + '-glow)" class="' + p + '-gw"/>');
      anim += '.' + p + '-gw{animation:' + p + '-gw 3.6s ease-in-out infinite}@keyframes ' + p + '-gw{0%,100%{opacity:.78}50%{opacity:1}}';
    }

    /* ---------- 路云：似真似幻的微光 ---------- */
    if (id === 'luyun') {
      for (var lz = 0; lz < 9; lz++) Lov.push(circ([cx - 90 + rng() * 190, 300 + rng() * 520], 1.2 + rng() * 1.6, ' fill="' + rim + '" class="' + p + '-mo" style="animation-delay:' + n1(-rng() * 7) + 's"'));
      anim += '.' + p + '-mo{opacity:0;animation:' + p + '-mo 7s linear infinite}@keyframes ' + p + '-mo{0%{opacity:0;transform:translateY(0)}30%{opacity:.8}100%{opacity:0;transform:translateY(-120px)}}';
    }

    /* ---------- 组装 ---------- */
    var s = sil.height || 1;
    if (prop.flag) s = Math.min(s, 1.04);
    s = Math.min(s, 882 / 770);
    var T = s === 1 ? '' : ' transform="matrix(' + n1(s * 1000) / 1000 + ' 0 0 ' + n1(s * 1000) / 1000 + ' ' + n1(200 * (1 - s)) + ' ' + n1(890 * (1 - s)) + ')"';
    var headT = look.tilt ? ' transform="rotate(' + look.tilt + ' ' + pt([hx, K.yChin - 8]) + ')"' : '';
    var shW = Math.max(hpW + G.fl * 0.8, st === 'wide' || st === 'crouch' ? B.hj + 70 : 0) + 40;

    var defs = '<defs>' +
      '<linearGradient id="' + p + '-g" gradientUnits="userSpaceOnUse" x1="300" y1="130" x2="110" y2="880"><stop offset="0" stop-color="#20222a"/><stop offset=".45" stop-color="#17181e"/><stop offset="1" stop-color="#0f1014"/></linearGradient>' +
      '<radialGradient id="' + p + '-sh"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + p + '-f" filterUnits="userSpaceOnUse" x="-60" y="-120" width="520" height="1040" color-interpolation-filters="sRGB">' +
      '<feFlood style="flood-color:var(--gf-rim,' + rim + ')"/><feComposite in2="SourceAlpha" operator="in" result="c"/>' +
      '<feOffset in="SourceAlpha" dx="-2.6" dy="2" result="o1"/><feComposite in="c" in2="o1" operator="out" result="r1"/>' +
      '<feOffset in="SourceAlpha" dx="-11" dy="7" result="o2"/><feComposite in="c" in2="o2" operator="out"/><feGaussianBlur stdDeviation="5"/>' +
      '<feComposite in2="SourceAlpha" operator="in"/><feComponentTransfer result="r2"><feFuncA type="linear" slope=".3"/></feComponentTransfer>' +
      '<feGaussianBlur in="r1" stdDeviation="6"/><feComposite in2="SourceAlpha" operator="out"/><feComponentTransfer result="h"><feFuncA type="linear" slope="1.6"/></feComponentTransfer>' +
      '<feOffset in="SourceAlpha" dx="2.4" result="o3"/><feFlood flood-color="#8ea3c8" flood-opacity=".3"/><feComposite in2="SourceAlpha" operator="in"/><feComposite in2="o3" operator="out" result="k"/>' +
      '<feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/><feMergeNode in="r2"/><feMergeNode in="k"/><feMergeNode in="r1"/></feMerge></filter>' +
      '<filter id="' + p + '-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="' + p + '-bl" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>' +
      '</defs>';
    var css = '<style>.' + p + '-l{fill:none;stroke:var(--gf-rim,' + rim + ');stroke-opacity:.3;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}' +
      '.' + p + '-k{fill:none;stroke:#040506;stroke-opacity:.85;stroke-width:1.6;stroke-linecap:round}' +
      '@media (prefers-reduced-motion:no-preference){' +
      '.' + p + '-gl{animation:' + p + '-gl 7s ease-in-out infinite}@keyframes ' + p + '-gl{0%,84%,100%{opacity:.65}90%{opacity:1}}' +
      '.' + p + '-bl{animation:' + p + '-bl 2.2s ease-in-out infinite}@keyframes ' + p + '-bl{0%,100%{opacity:.55}50%{opacity:1}}' + anim + '}</style>';

    var inner = defs + css +
      '<g' + T + '><ellipse cx="200" cy="888" rx="' + n1(shW) + '" ry="11" fill="url(#' + p + '-sh)"/>' + Lb.join('') + '</g>' +
      '<g filter="url(#' + p + '-f)"><g' + T + ' fill="url(#' + p + '-g)">' +
      Lback.join('') + Llegs.join('') + Lbody.join('') + Lmid.join('') + '<g' + headT + '>' + Lhead.join('') + '</g>' + Lfront.join('') +
      '</g></g>' +
      '<g' + T + '>' + (DK ? '<path class="' + p + '-k" d="' + DK + '"/>' : '') + (DL ? '<path class="' + p + '-l" d="' + DL + '"/>' : '') + Lov.join('') +
      '<g' + headT + '>' + Lhov.join('') + '</g></g>';
    return U.svg(inner, 400, 900, 'class="gf-char" data-char="' + id + '"' + (prop.flag ? ' style="overflow:visible"' : ''))
      .replace('xMidYMid slice', 'xMidYMax meet');
  }

  GF.art.char = function (id, opts) { return build(id, opts || {}); };
  /** 供引擎/调试：本生成器已登记造型的角色 */
  GF.art.char.looks = LOOK;
})();
