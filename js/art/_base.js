/*
 * 美术公共基础：命名空间 + 小工具。必须在所有 js/art/*.js 之前加载。
 */
(function (root) {
  'use strict';
  var GF = root.GF = root.GF || {};
  GF.art = GF.art || {};
  GF.art.bg = GF.art.bg || {};
  GF.art.cg = GF.art.cg || {};
  GF.art.doc = GF.art.doc || {};

  var U = GF.art.util = GF.art.util || {};

  /** 可复现的伪随机数（同一 seed 每次画出来一样） */
  U.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  /** 包一层标准背景 SVG 外壳 */
  U.svg = function (inner, w, h, extraAttr) {
    w = w || 1600; h = h || 900;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" ' + (extraAttr || '') + '>' + inner + '</svg>';
  };

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r) {
    return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  /** 颜色插值：mix('#000','#fff',0.5) */
  U.mix = function (a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  };
  U.rgba = function (hex, alpha) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  };

  /** 屏幕暗角遮罩（常用） */
  U.vignette = function (prefix, strength) {
    strength = strength == null ? 0.65 : strength;
    return '<defs><radialGradient id="' + prefix + '-vig" cx="50%" cy="50%" r="75%">' +
      '<stop offset="55%" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="#000" stop-opacity="' + strength + '"/></radialGradient></defs>' +
      '<rect width="1600" height="900" fill="url(#' + prefix + '-vig)"/>';
  };

  /** 老照片滤镜用的褐色遮罩 */
  U.sepiaWash = function (prefix, alpha) {
    return '<rect width="1600" height="900" fill="#704214" opacity="' + (alpha == null ? 0.18 : alpha) + '" style="mix-blend-mode:multiply"/>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
