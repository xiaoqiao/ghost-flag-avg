/*
 * 幽灵旗 AVG —— 剧本 DSL 解析器
 * 浏览器与 Node（tools/validate.js）共用。无依赖，不使用 ES module（需兼容 file:// 打开）。
 *
 * 剧本文件写法：  GF.script(`
 *   == c01_start
 *   [bg newsroom fade]
 *   naduo: 台词
 *   旁白（那多的第一人称叙述）
 * `);
 * 语法详见 DESIGN.md「剧本 DSL」一节。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  GF.sources = GF.sources || [];

  /** 剧本文件调用：登记一段源码 */
  GF.script = function (text, fileHint) {
    var file = fileHint;
    if (!file && typeof document !== 'undefined' && document.currentScript) {
      file = (document.currentScript.getAttribute('src') || '').split('/').pop();
    }
    if (!file && GF.__currentFile) file = GF.__currentFile;
    GF.sources.push({ file: file || ('script' + GF.sources.length), text: String(text) });
  };

  // 以「剩余整行文本」作为参数的指令
  var REST_CMDS = { center: 1, date: 1, note: 1, rename: 1, choice: 1 };

  var RE_LABEL = /^==\s*([a-z0-9_]+)\s*$/;
  var RE_SAY = /^([a-z][a-z0-9_]*)(?:\.([a-z]+))?\s*[:：]\s*(.+)$/;
  var RE_OPTION = /^-(\*?)\s+(?:\{([^}]*)\}\s*)?(.+?)\s*->\s*([a-z0-9_]+)\s*$/;
  var RE_KV = /^([a-z_][a-z0-9_]*)=(\S+)$/;

  function parseCmd(body) {
    // body: 方括号内部
    var cmd = { t: 'cmd', name: '', args: [], kv: {}, rest: '', arrow: null };
    var arrowIdx = body.indexOf('->');
    var main = body;
    if (arrowIdx >= 0) {
      cmd.arrow = body.slice(arrowIdx + 2).trim();
      main = body.slice(0, arrowIdx).trim();
    }
    var tokens = main.trim().split(/\s+/);
    cmd.name = (tokens.shift() || '').toLowerCase();
    // body：指令名之后、箭头之前的原始文本（[if]/[flag] 用它来解析条件表达式）
    cmd.body = tokens.join(' ');
    if (REST_CMDS[cmd.name]) {
      // 先吃掉前置的 key=value 与（rename 的）第一个参数，其余作为 rest
      var restTokens = [];
      var i = 0;
      if (cmd.name === 'rename' && tokens.length) { cmd.args.push(tokens[0]); i = 1; }
      for (; i < tokens.length; i++) {
        var m = RE_KV.exec(tokens[i]);
        if (m && restTokens.length === 0) { cmd.kv[m[1]] = m[2]; continue; }
        restTokens.push(tokens[i]);
      }
      cmd.rest = restTokens.join(' ');
    } else {
      tokens.forEach(function (tk) {
        var m = RE_KV.exec(tk);
        if (m) cmd.kv[m[1]] = m[2];
        else cmd.args.push(tk);
      });
    }
    return cmd;
  }

  /**
   * 解析单个源文件。
   * 返回 { ops: [...], errors: [...] }，ops 中的每条都带 file/line 以便报错。
   */
  GF.parseScript = function (text, file) {
    var ops = [], errors = [];
    var lines = String(text).split(/\r?\n/);
    var pendingChoice = null;
    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n];
      var line = raw.trim();
      var lineNo = n + 1;
      if (!line || line.indexOf('//') === 0) continue;

      // 选项行
      if (line.charAt(0) === '-' && (line.charAt(1) === ' ' || line.charAt(1) === '*')) {
        var om = RE_OPTION.exec(line);
        if (!om) { errors.push({ file: file, line: lineNo, msg: '选项行格式错误，应为 "- 文本 -> 标签"：' + line }); continue; }
        if (!pendingChoice) { errors.push({ file: file, line: lineNo, msg: '选项行前面没有 [choice]：' + line }); continue; }
        pendingChoice.options.push({ text: om[3], cond: om[2] ? om[2].trim() : '', target: om[4], isDefault: om[1] === '*', line: lineNo });
        continue;
      }
      pendingChoice = null;

      var lm = RE_LABEL.exec(line);
      if (lm) { ops.push({ t: 'label', name: lm[1], file: file, line: lineNo }); continue; }
      if (line.indexOf('==') === 0) { errors.push({ file: file, line: lineNo, msg: '标签格式错误（只允许小写字母/数字/下划线）：' + line }); continue; }

      if (line.charAt(0) === '[') {
        if (line.charAt(line.length - 1) !== ']') { errors.push({ file: file, line: lineNo, msg: '指令缺少右方括号：' + line }); continue; }
        var cmd = parseCmd(line.slice(1, -1));
        cmd.file = file; cmd.line = lineNo;
        if (cmd.name === 'choice') {
          var ch = { t: 'choice', prompt: cmd.rest, timer: cmd.kv.timer ? parseInt(cmd.kv.timer, 10) : 0, options: [], file: file, line: lineNo };
          ops.push(ch);
          pendingChoice = ch;
        } else {
          ops.push(cmd);
        }
        continue;
      }

      var sm = RE_SAY.exec(line);
      if (sm) {
        ops.push({ t: 'say', who: sm[1], expr: sm[2] || '', text: sm[3], file: file, line: lineNo });
        continue;
      }
      ops.push({ t: 'narr', text: line, file: file, line: lineNo });
    }
    return { ops: ops, errors: errors };
  };

  /** 把所有已登记的源文件编译成一个程序 */
  GF.compile = function () {
    var program = { ops: [], labels: {}, errors: [], fileRanges: [] };
    GF.sources.forEach(function (src) {
      var res = GF.parseScript(src.text, src.file);
      var start = program.ops.length;
      res.ops.forEach(function (op) {
        if (op.t === 'label') {
          if (program.labels[op.name] !== undefined) {
            program.errors.push({ file: op.file, line: op.line, msg: '标签重复：' + op.name });
          } else {
            program.labels[op.name] = program.ops.length;
          }
        }
        program.ops.push(op);
      });
      program.fileRanges.push({ file: src.file, start: start, end: program.ops.length });
      program.errors = program.errors.concat(res.errors);
    });
    return program;
  };

  /**
   * 条件求值。cond 语法：
   *   name / !name / name>=2 / name<=2 / name==v / name!=v / name>1 / name<1
   *   clue:c_xxx / !clue:c_xxx / item:i_xxx / !item:i_xxx
   * state 需提供 flags / clues / items。
   */
  GF.evalCond = function (cond, state) {
    cond = String(cond || '').trim();
    if (!cond) return true;
    var neg = false;
    if (cond.charAt(0) === '!') { neg = true; cond = cond.slice(1).trim(); }
    var r;
    var m;
    if ((m = /^clue:([a-z0-9_]+)$/.exec(cond))) r = !!(state.clues && state.clues.indexOf(m[1]) >= 0);
    else if ((m = /^item:([a-z0-9_]+)$/.exec(cond))) r = !!(state.items && state.items.indexOf(m[1]) >= 0);
    else if ((m = /^([a-z0-9_]+)\s*(>=|<=|==|!=|>|<)\s*(\S+)$/.exec(cond))) {
      var a = state.flags ? state.flags[m[1]] : undefined;
      var b = m[3];
      var an = Number(a || 0), bn = Number(b);
      var numeric = !isNaN(bn);
      switch (m[2]) {
        case '>=': r = an >= bn; break;
        case '<=': r = an <= bn; break;
        case '>': r = an > bn; break;
        case '<': r = an < bn; break;
        case '==': r = numeric ? an === bn : String(a) === b; break;
        case '!=': r = numeric ? an !== bn : String(a) !== b; break;
      }
    } else if (/^[a-z0-9_]+$/.test(cond)) {
      var v = state.flags ? state.flags[cond] : undefined;
      r = !!v && v !== '0' && v !== 'false';
    } else {
      r = false;
    }
    return neg ? !r : r;
  };

  /** 解析 [flag ...] 的参数，返回 {name, op, value} */
  GF.parseFlagExpr = function (expr) {
    var m = /^([a-z0-9_]+)(?:(\+=|-=|=)(\S+))?$/.exec(String(expr || '').trim());
    if (!m) return null;
    return { name: m[1], op: m[2] || '=', value: m[2] ? m[3] : true };
  };

  /** 文本内联标记：**强调** → <em>；\n → 换行。返回安全 HTML。 */
  GF.renderInline = function (text) {
    var s = String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');
    s = s.replace(/\\n/g, '<br>');
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
