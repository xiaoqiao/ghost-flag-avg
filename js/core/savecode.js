/*
 * 幽灵旗 AVG —— 存档码（跨设备手动搬存档）
 * 导出：把本机的存档位 + 全局进度（已读、章节、结局、图鉴）压缩成一串文字 / 一个文件。
 * 导入：粘贴或选择文件；存档位按时间保留较新的，全局进度取并集。设置不随存档码走（各设备自己的偏好）。
 * 云存档（cloud.js）也用这里的 pack / merge，并额外启用删除记录：删掉的存档位不会被更旧的副本复活。
 * 格式：GFSAVE1-<z|p>-<base64>-<校验码>，z = deflate 压缩，p = 未压缩（老浏览器回退）。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  var E = GF.E, UI = GF.UI;
  var esc = E.esc;
  var PREFIX = 'GFSAVE1';

  /* ------------------------------------------------------------ 编解码 */
  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function bytesToB64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function streamBytes(bytes, stream) {
    var blob = new Blob([bytes]);
    return new Response(blob.stream().pipeThrough(stream)).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  // 实际构造一次：有些浏览器有 CompressionStream 但不支持 deflate-raw
  var canZip = (function () {
    try { new CompressionStream('deflate-raw'); new DecompressionStream('deflate-raw'); return true; } catch (e) { return false; }
  })();

  function encode(obj) {
    var json = new TextEncoder().encode(JSON.stringify(obj));
    var p = canZip ? streamBytes(json, new CompressionStream('deflate-raw')).then(function (b) { return ['z', b]; })
                   : Promise.resolve(['p', json]);
    return p.then(function (r) {
      var body = bytesToB64(r[1]);
      return PREFIX + '-' + r[0] + '-' + body + '-' + fnv(body);
    });
  }
  function decode(code) {
    code = String(code || '').replace(/\s+/g, '');
    var m = /^GFSAVE1-([zp])-([A-Za-z0-9+/=]+)-([0-9a-f]{8})$/.exec(code);
    if (!m) return Promise.reject(new Error('这不是完整的幽灵旗存档码（可能复制时少了开头或结尾）。'));
    if (fnv(m[2]) !== m[3]) return Promise.reject(new Error('存档码不完整或被改动过，请重新复制一次。'));
    var bytes;
    try { bytes = b64ToBytes(m[2]); } catch (e) { return Promise.reject(new Error('存档码无法解析。')); }
    var p;
    if (m[1] === 'z') {
      if (!canZip) return Promise.reject(new Error('这个浏览器太旧，无法解压存档码，请换用新版 Chrome / Safari / Edge。'));
      p = streamBytes(bytes, new DecompressionStream('deflate-raw'));
    } else p = Promise.resolve(bytes);
    return p.then(function (b) {
      var obj = JSON.parse(new TextDecoder().decode(b));
      if (!obj || obj.game !== 'ghostflag') throw new Error('这不是幽灵旗的存档码。');
      return obj;
    });
  }

  /* ------------------------------------------------------------ 打包 / 合并 */
  /* 剧本里本来就有的文字（手册日志、回看）在存档码中只记“文件:行号”，导入时再从剧本还原 */
  var maps = null;
  function textMaps() {
    if (maps) return maps;
    maps = { note: {}, line: {}, byRef: {} };
    (E.program ? E.program.ops : []).forEach(function (op) {
      var ref = op.file + ':' + op.line;
      if (op.t === 'cmd' && op.name === 'note') { maps.note[op.rest] = ref; maps.byRef[ref] = op.rest; }
      if (op.t === 'say' || op.t === 'narr') { if (!maps.line[op.text]) maps.line[op.text] = ref; maps.byRef[ref] = op.text; }
    });
    return maps;
  }
  function shrinkState(state, keepBacklog) {
    if (!state) return state;
    var m = textMaps();
    (state.notes || []).forEach(function (n) { var r = m.note[n.text]; if (r) { n.r = r; delete n.text; } });
    state.backlog = (state.backlog || []).slice(-keepBacklog).map(function (b) {
      var r = !b.choice && m.line[b.text];
      return r ? { r: r, who: b.who, name: b.name } : b;
    });
    return state;
  }
  function expandState(state) {
    if (!state) return state;
    var m = textMaps(), R = GF.registry;
    (state.notes || []).forEach(function (n) { if (n.r && !n.text) n.text = m.byRef[n.r] || ''; delete n.r; });
    (state.backlog || []).forEach(function (b) {
      if (b.r) { b.text = m.byRef[b.r] || ''; delete b.r; }
      if (b.who && !b.color && R.characters[b.who]) b.color = R.characters[b.who].color;
    });
    if (state.checkpoint) expandState(state.checkpoint);
    return state;
  }
  function slim(state) {
    if (!state) return state;
    shrinkState(state, 12);
    // 回档点是第二份完整状态；它们都设在危险选项之前，导入后走到下一处时会重新生成，存档码里不带
    state.checkpoint = null;
    return state;
  }
  // 已读记录 {"ch01.js:12":1,...} ⇄ 按文件的行号区间 {"ch01.js":"12-40,43"}，大幅缩短存档码
  function readToRanges(read) {
    var byFile = {};
    Object.keys(read || {}).forEach(function (k) {
      var i = k.lastIndexOf(':'); if (i < 0) return;
      (byFile[k.slice(0, i)] = byFile[k.slice(0, i)] || []).push(parseInt(k.slice(i + 1), 10));
    });
    var out = {};
    Object.keys(byFile).forEach(function (f) {
      var a = byFile[f].sort(function (x, y) { return x - y; }), parts = [], st = a[0], pr = a[0];
      for (var j = 1; j <= a.length; j++) {
        if (j < a.length && a[j] <= pr + 3) { pr = a[j]; continue; } // 允许中间隔几行（指令行），解码时只取真实文本行
        parts.push(st === pr ? String(st) : st + '-' + pr);
        st = pr = a[j];
      }
      out[f] = parts.join(',');
    });
    return out;
  }
  function rangesToRead(ranges) {
    var valid = {};
    (E.program ? E.program.ops : []).forEach(function (op) { if (op.t === 'say' || op.t === 'narr') valid[op.file + ':' + op.line] = 1; });
    var read = {};
    Object.keys(ranges || {}).forEach(function (f) {
      String(ranges[f]).split(',').forEach(function (part) {
        var ab = part.split('-'), a = parseInt(ab[0], 10), bnd = parseInt(ab[1] || ab[0], 10);
        for (var n = a; n <= bnd; n++) { var key = f + ':' + n; if (valid[key]) read[key] = 1; }
      });
    });
    return read;
  }
  function pack() {
    var saves = E.clone(E.getSaves());
    Object.keys(saves).forEach(function (k) { slim(saves[k].state); });
    var g = E.clone(E.global); // 内存里的全局进度就是最新的
    g.readRanges = readToRanges(g.read);
    delete g.read;
    return { game: 'ghostflag', v: 1, time: Date.now(), saves: saves, deleted: E.LS.get('deleted', {}), global: g };
  }
  function summary(obj) {
    var n = Object.keys(obj.saves || {}).length;
    var g = obj.global || {};
    var read = g.read || rangesToRead(g.readRanges); // 只用于计数，不改动 obj
    return n + ' 个存档 · 已读 ' + Object.keys(read || {}).length + ' 行 · 解锁 ' + (g.chapters || []).length + ' 章 · 结局 ' + (g.endings || []).length + ' 个';
  }
  /* opts.tombstones：启用删除记录（云同步用；手动导入存档码不用，避免误删本机存档）
     opts.replaced：传入数组时，收集被云端 / 导入内容替换的存档位 */
  function merge(obj, opts) {
    opts = opts || {};
    var local = E.getSaves();
    var changed = 0;
    var del = opts.tombstones ? E.LS.get('deleted', {}) : {};
    if (opts.tombstones) {
      // 删除记录取并集（同一存档位取较晚的记录）
      var incDel = obj.deleted || {};
      Object.keys(incDel).forEach(function (k) { if (typeof incDel[k] === 'number' && !(del[k] >= incDel[k])) del[k] = incDel[k]; });
    }
    Object.keys(obj.saves || {}).forEach(function (k) {
      var inc = obj.saves[k];
      if (!inc || !inc.meta || !inc.state) return;
      if (del[k] && inc.meta.time <= del[k]) return; // 删除之后没有再存过：不复活
      if (!local[k] || (local[k].meta && inc.meta.time > local[k].meta.time)) {
        expandState(inc.state); local[k] = inc; changed++;
        if (opts.replaced) opts.replaced.push(k);
      }
    });
    Object.keys(local).forEach(function (k) {
      if (del[k] && local[k].meta && local[k].meta.time <= del[k]) { delete local[k]; changed++; }
    });
    // 写不进本机存储时必须中止，否则后续打包上传会用旧数据覆盖云端
    if (!E.LS.set('saves', local)) throw new Error('本机存储不可用（浏览器可能禁止了网站存储），无法合并存档');
    if (opts.tombstones) E.LS.set('deleted', del);
    var G = E.global, g = obj.global || {};
    if (!g.read && g.readRanges) g.read = rangesToRead(g.readRanges);
    ['chapters', 'endings', 'clues', 'docs', 'persons'].forEach(function (key) {
      (g[key] || []).forEach(function (v) { if (G[key].indexOf(v) < 0) G[key].push(v); });
    });
    Object.keys(g.read || {}).forEach(function (k) { G.read[k] = 1; });
    E.saveGlobal();
    return changed;
  }

  /* 内容指纹：对象键排序、全局列表排序、忽略打包时间。两台设备内容相同则指纹相同，用来跳过无意义的上传 */
  function canon(obj) {
    function norm(x, depth) {
      if (Array.isArray(x)) return x.map(function (v) { return norm(v, depth + 1); });
      if (!x || typeof x !== 'object') return x;
      var o = {};
      Object.keys(x).sort().forEach(function (k) { if (!(depth === 0 && k === 'time')) o[k] = norm(x[k], depth + 1); });
      return o;
    }
    var c = norm(obj, 0);
    if (c.global) ['chapters', 'endings', 'clues', 'docs', 'persons'].forEach(function (k) { if (Array.isArray(c.global[k])) c.global[k] = c.global[k].slice().sort(); });
    return JSON.stringify(c);
  }

  /* ------------------------------------------------------------ 界面 */
  function panelOf(title, html) {
    var p = UI.panel('savecode', title, html);
    p.close = function () { UI.closePanel(p); };
    return p;
  }
  function copyText(text, ta) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return fallback(); });
    }
    return fallback();
    function fallback() {
      return new Promise(function (resolve, reject) {
        try { ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); if (document.execCommand('copy')) resolve(); else reject(); } catch (e) { reject(e); }
      });
    }
  }
  function download(text) {
    var d = new Date();
    var name = 'ghostflag-存档-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.txt';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  UI.exportCode = function () {
    var obj = pack();
    var p = panelOf('导出存档码',
      '<p class="sc-tip">把下面这串文字发到另一台设备（微信、备忘录、隔空投送都行），在那边的「读取存档 → 导入存档码」里粘贴即可接着玩。</p>' +
      '<div class="sc-sum">' + esc(summary(obj)) + '</div>' +
      '<textarea class="sc-code" readonly>正在生成……</textarea>' +
      '<div class="btn-row"><button class="btn sc-copy">复制存档码</button><button class="btn sc-dl">下载为文件</button></div>' +
      '<p class="sc-note">存档码里只有游戏进度，没有任何个人信息。设置（音量、文字速度等）不会带过去。</p>');
    var ta = p.querySelector('.sc-code');
    encode(obj).then(function (code) {
      ta.value = code;
      p.querySelector('.sc-sum').textContent = summary(obj) + ' · 共 ' + code.length + ' 个字符';
      p.querySelector('.sc-copy').addEventListener('click', function () {
        copyText(code, ta).then(function () { E.toast('<b>存档码</b>已复制，可以粘贴到另一台设备了', 'item'); },
          function () { ta.focus(); ta.select(); E.toast('<b>存档码</b>请长按 / 右键手动复制选中的文字', 'item'); });
      });
      p.querySelector('.sc-dl').addEventListener('click', function () { download(code); });
      ta.addEventListener('focus', function () { ta.select(); });
    }).catch(function (e) { ta.value = '生成失败：' + e.message; });
  };

  UI.importCode = function () {
    var p = panelOf('导入存档码',
      '<p class="sc-tip">把另一台设备上导出的存档码粘贴到下面，或选择导出的存档文件。</p>' +
      '<textarea class="sc-code" placeholder="在这里粘贴以 GFSAVE1 开头的存档码"></textarea>' +
      '<div class="btn-row"><button class="btn sc-file">选择存档文件</button><button class="btn sc-go">导入</button></div>' +
      '<input type="file" class="sc-input" accept=".txt,text/plain" hidden>' +
      '<p class="sc-note">同一个存档位按时间保留较新的一份；已读记录、章节、结局和手册图鉴会合并，不会丢失本机的进度。</p>' +
      '<div class="sc-msg"></div>');
    var ta = p.querySelector('.sc-code'), msg = p.querySelector('.sc-msg'), input = p.querySelector('.sc-input');
    function run(code) {
      msg.textContent = '正在读取……';
      decode(code).then(function (obj) {
        var n = merge(obj);
        msg.innerHTML = '<span class="ok">导入成功</span>' + esc(summary(obj)) + (n ? '，更新了 ' + n + ' 个存档位。' : '（本机的存档都比它新，存档位没有变化）。');
        E.toast('<b>存档码</b>导入成功', 'item');
        if (!E.running && UI.title) setTimeout(function () { p.close(); UI.title(); }, 1400);
      }).catch(function (e) { msg.innerHTML = '<span class="no">导入失败</span>' + esc(e.message); });
    }
    p.querySelector('.sc-go').addEventListener('click', function () { run(ta.value); });
    p.querySelector('.sc-file').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { ta.value = String(r.result || '').trim(); run(ta.value); };
      r.readAsText(f);
    });
    if (!E.D.stage.classList.contains('touch')) setTimeout(function () { ta.focus(); }, 300);
  };

  // 供测试使用
  GF.saveCode = { encode: encode, decode: decode, pack: pack, merge: merge, canon: canon };
})(typeof window !== 'undefined' ? window : globalThis);
