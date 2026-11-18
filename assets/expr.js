/* expr.js — 把一行式子变成可以反复求值的函数。
   值有两种：数，和三元向量 (x, y, z)。
   支持：+ - * / ^、括号、隐式乘法（2x）、x y z t、常数 pi e、
     sin cos tan asin acos atan sinh cosh tanh sqrt abs exp log ln
     floor ceil round sign min max pow atan2、
     向量运算 dot cross norm unit（也可以写 a · b、a × b）、
     向量字面量 (1, 2, 3)、以及 "z = ..." / "ax + by + cz = d" 方程。 */
window.EXPR = (function () {
  "use strict";

  const FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    exp: Math.exp,
    log: Math.log,
    ln: Math.log,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    abs: Math.abs,
  };
  const VFUNCS = ["dot", "cross", "norm", "unit", "length"];
  const CONSTS = { pi: Math.PI, "π": Math.PI, e: Math.E, tau: Math.PI * 2 };
  const VARS = { x: 1, y: 1, z: 1, t: 1 };

  const isVec = (v) => Array.isArray(v);
  const mk = (a, b, c) => [a, b, c];

  /* ------------------------------------------------------------- 词法 */

  function tokenize(src) {
    const s = src
      .replace(/[×✕⨯]/g, "×")
      .replace(/[·⋅∙]/g, "·")
      .replace(/[−–—]/g, "-")
      .replace(/÷/g, "/")
      .replace(/π/g, "pi");
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if ((s[j] === "e" || s[j] === "E") && /[0-9+\-]/.test(s[j + 1] || "")) {
          let k = j + 1;
          if (s[k] === "+" || s[k] === "-") k++;
          if (/[0-9]/.test(s[k] || "")) {
            j = k;
            while (j < s.length && /[0-9]/.test(s[j])) j++;
          }
        }
        const v = parseFloat(s.slice(i, j));
        if (!isFinite(v)) throw new Error("数字写错了 · bad number");
        out.push({ t: "num", v: v });
        i = j;
        continue;
      }
      if (/[a-zA-Z_]/.test(c)) {
        let j = i;
        while (j < s.length && /[a-zA-Z_0-9]/.test(s[j])) j++;
        out.push({ t: "id", v: s.slice(i, j) });
        i = j;
        continue;
      }
      if ("+-*/^(),=·×".indexOf(c) >= 0) {
        out.push({ t: "op", v: c === "·" ? "dot" : c === "×" ? "x" : c });
        i++;
        continue;
      }
      throw new Error("看不懂这个符号 · bad symbol: " + c);
    }
    out.push({ t: "end" });
    return out;
  }

  /* ------------------------------------------------------------- 语法 */

  function parse(src) {
    const toks = tokenize(src);
    let i = 0;
    const peek = () => toks[i];
    const isOp = (v) => toks[i].t === "op" && toks[i].v === v;

    function parseEq() {
      const l = parseSum();
      if (isOp("=")) {
        i++;
        return { t: "eq", l: l, r: parseSum() };
      }
      return l;
    }

    function parseSum() {
      let left = parseTerm();
      for (;;) {
        if (isOp("+") || isOp("-")) {
          const op = toks[i].v;
          i++;
          left = { t: "bin", op: op, l: left, r: parseTerm() };
        } else break;
      }
      return left;
    }

    function startsPrimary(t) {
      return t.t === "num" || t.t === "id" || (t.t === "op" && t.v === "(");
    }

    function parseTerm() {
      let left = parseUnary();
      for (;;) {
        if (isOp("*") || isOp("/") || isOp("dot") || isOp("x")) {
          const op = toks[i].v;
          i++;
          const node = { t: "bin", op: op, l: left, r: parseUnary() };
          left = op === "dot" ? { t: "call", name: "dot", args: [node.l, node.r] } : op === "x" ? { t: "call", name: "cross", args: [node.l, node.r] } : node;
          continue;
        }
        if (startsPrimary(peek())) {
          /* 隐式乘法：2x、3(x+1)、(x+1)(x-1) */
          left = { t: "bin", op: "*", l: left, r: parseUnary() };
          continue;
        }
        break;
      }
      return left;
    }

    function parseUnary() {
      if (isOp("-")) {
        i++;
        return { t: "neg", a: parseUnary() };
      }
      if (isOp("+")) {
        i++;
        return parseUnary();
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (isOp("^")) {
        i++;
        return { t: "bin", op: "^", l: base, r: parseUnary() };
      }
      return base;
    }

    function parseArgs() {
      const args = [parseSum()];
      while (isOp(",")) {
        i++;
        args.push(parseSum());
      }
      if (!isOp(")")) throw new Error("括号没关上 · missing )");
      i++;
      return args;
    }

    function parsePrimary() {
      const t = peek();
      if (t.t === "num") {
        i++;
        return { t: "num", v: t.v };
      }
      if (t.t === "id") {
        i++;
        if (isOp("(")) {
          const isFn = FUNCS[t.v] !== undefined || VFUNCS.indexOf(t.v) >= 0;
          if (isFn) {
            i++;
            return { t: "call", name: t.v, args: parseArgs() };
          }
          /* 不是函数名：当成隐式乘法 a(b) */
          i++;
          const inner = parseSum();
          if (!isOp(")")) throw new Error("括号没关上 · missing )");
          i++;
          return { t: "bin", op: "*", l: { t: "var", name: t.v }, r: inner };
        }
        return { t: "var", name: t.v };
      }
      if (t.t === "op" && t.v === "(") {
        i++;
        const first = parseSum();
        if (isOp(",")) {
          const items = [first];
          while (isOp(",")) {
            i++;
            items.push(parseSum());
          }
          if (!isOp(")")) throw new Error("括号没关上 · missing )");
          i++;
          return { t: "tuple", items: items };
        }
        if (!isOp(")")) throw new Error("括号没关上 · missing )");
        i++;
        return first;
      }
      if (t.t === "end") throw new Error("式子没写完 · incomplete");
      throw new Error("这里应该是一个数或者变量 · expected a value");
    }

    const ast = parseEq();
    if (peek().t !== "end") throw new Error("后面还有多余的符号 · extra symbols");
    return ast;
  }

  /* ------------------------------------------------------------- 求值 */

  function dotv(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }
  function crossv(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

  function ev(n, env) {
    switch (n.t) {
      case "num":
        return n.v;
      case "var": {
        if (CONSTS[n.name] !== undefined) return CONSTS[n.name];
        const v = env[n.name];
        return v === undefined ? NaN : v;
      }
      case "neg": {
        const a = ev(n.a, env);
        return isVec(a) ? scale(a, -1) : -a;
      }
      case "bin": {
        const a = ev(n.l, env);
        const b = ev(n.r, env);
        switch (n.op) {
          case "+":
            if (isVec(a) && isVec(b)) return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
            return isVec(a) || isVec(b) ? NaN : a + b;
          case "-":
            if (isVec(a) && isVec(b)) return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
            return isVec(a) || isVec(b) ? NaN : a - b;
          case "*":
            if (isVec(a) && !isVec(b)) return scale(a, b);
            if (!isVec(a) && isVec(b)) return scale(b, a);
            return isVec(a) ? NaN : a * b;
          case "/":
            if (isVec(a) && !isVec(b)) return scale(a, 1 / b);
            return isVec(a) || isVec(b) ? NaN : a / b;
          default:
            return isVec(a) || isVec(b) ? NaN : Math.pow(a, b);
        }
      }
      case "tuple": {
        const items = n.items.map((x) => ev(x, env));
        if (items.length !== 3) return NaN;
        if (items.some((v) => isVec(v) || !isFinite(v))) return NaN;
        return [items[0], items[1], items[2]];
      }
      case "call":
        return callFn(n, env);
      default:
        return NaN;
    }
  }

  function callFn(n, env) {
    const args = n.args.map((x) => ev(x, env));
    const a = args[0];
    const b = args[1];
    if (n.name === "dot") return isVec(a) && isVec(b) ? dotv(a, b) : NaN;
    if (n.name === "cross") return isVec(a) && isVec(b) ? crossv(a, b) : NaN;
    if (n.name === "norm" || n.name === "length") return isVec(a) ? Math.hypot(a[0], a[1], a[2]) : Math.abs(a);
    if (n.name === "unit") {
      if (!isVec(a)) return NaN;
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    }
    if (n.name === "abs" && isVec(a)) return Math.hypot(a[0], a[1], a[2]);
    const f = FUNCS[n.name];
    if (!f) return NaN;
    return f.apply(null, args);
  }

  function compile(n) {
    return function (env) {
      return ev(n, env);
    };
  }

  function walk(n, fn) {
    fn(n);
    if (n.t === "bin" || n.t === "eq") {
      walk(n.l, fn);
      walk(n.r, fn);
    } else if (n.t === "neg") walk(n.a, fn);
    else if (n.t === "call") n.args.forEach((a) => walk(a, fn));
    else if (n.t === "tuple") n.items.forEach((a) => walk(a, fn));
  }

  function vars(n) {
    const set = new Set();
    walk(n, function (x) {
      if (x.t === "var" && CONSTS[x.name] === undefined && VARS[x.name]) set.add(x.name);
    });
    return set;
  }

  function unknown(n) {
    let bad = null;
    walk(n, function (x) {
      if (x.t === "var" && CONSTS[x.name] === undefined && !VARS[x.name] && !bad) bad = x.name;
      if (x.t === "call" && FUNCS[x.name] === undefined && VFUNCS.indexOf(x.name) < 0 && !bad) bad = x.name + "()";
    });
    return bad;
  }

  function hasVector(n) {
    let found = false;
    walk(n, function (x) {
      if (x.t === "tuple") found = true;
      if (x.t === "call" && VFUNCS.indexOf(x.name) >= 0) found = true;
    });
    return found;
  }

  const ENV0 = { x: 0, y: 0, z: 0, t: 0 };
  const isCoord = (name) => name === "x" || name === "y" || name === "z" || name === "t";

  /* 画「相加」和「叉积」时要知道加数/乘数是谁 */
  function partsOf(node) {
    if (node.t === "bin" && node.op === "+") {
      return { op: "sum", fns: [compile(node.l), compile(node.r)] };
    }
    if (node.t === "call" && node.name === "cross" && node.args.length === 2) {
      return { op: "cross", fns: [compile(node.args[0]), compile(node.args[1])] };
    }
    if (node.t === "bin" && node.op === "-") {
      return { op: "sum", fns: [compile(node.l), compile({ t: "neg", a: node.r })] };
    }
    return { op: null, fns: [] };
  }

  /* ------------------------------------------------------------- 分类 */

  function affineOf(fn) {
    const F0 = fn(0, 0, 0);
    if (!isFinite(F0)) return null;
    const a = [fn(1, 0, 0) - F0, fn(0, 1, 0) - F0, fn(0, 0, 1) - F0];
    if (!a.every(isFinite)) return null;
    const probes = [
      [0.37, -1.21, 0.64],
      [-1.7, 0.43, 1.11],
      [2.3, 1.9, -0.72],
      [-0.5, -0.5, -0.5],
    ];
    for (let i = 0; i < probes.length; i++) {
      const p = probes[i];
      const want = a[0] * p[0] + a[1] * p[1] + a[2] * p[2] + F0;
      const got = fn(p[0], p[1], p[2]);
      if (!isFinite(got)) return null;
      const tol = 1e-6 * Math.max(1, Math.abs(want), Math.abs(got));
      if (Math.abs(got - want) > tol) return null;
    }
    return { a: a, d: F0 };
  }

  function classify(src) {
    const text = String(src || "").trim();
    if (!text) return { kind: "empty" };
    let ast;
    try {
      ast = parse(text);
    } catch (err) {
      return { kind: "error", message: err.message || String(err) };
    }
    /* 起名字的向量：v = (1, 2, 3)（左边是名字，不当成未知变量） */
    if (ast.t === "eq" && ast.l.t === "var" && !isCoord(ast.l.name)) {
      const badR = unknown(ast.r);
      if (badR) return { kind: "error", message: "不认识的变量或函数 · unknown: " + badR };
      const val = ev(ast.r, ENV0);
      if (!isVec(val)) return { kind: "error", message: "等号左边是名字，右边要写向量 · a name needs a vector" };
      return vectorKind(ast.r, vars(ast.r).has("t"), text, ast.l.name);
    }

    const bad = unknown(ast);
    if (bad) return { kind: "error", message: "不认识的变量或函数 · unknown: " + bad };

    const vs = vars(ast);
    const usesT = vs.has("t");

    if (ast.t === "eq") {
      /* z = f(x, y) */
      if (ast.l.t === "var" && ast.l.name === "z") {
        const val = ev(ast.r, ENV0);
        if (isVec(val)) return { kind: "error", message: "z = 后面要一个数 · z needs a scalar" };
        if (!vars(ast.r).has("z")) {
          return { kind: "surface", f: compile(ast.r), usesT: usesT, label: "曲面 z = f(x, y)" };
        }
      }
      /* 其余方程：试着当成平面 */
      const fn = compile({ t: "bin", op: "-", l: ast.l, r: ast.r });
      const fit = function (t) {
        const aff = affineOf(function (x, y, z) {
          return fn({ x: x, y: y, z: z, t: t });
        });
        return aff ? { a: aff.a, d: -aff.d } : null;
      };
      const now = fit(0);
      if (!now) return { kind: "error", message: "这不是平面 · not a plane; write z = f(x, y)" };
      if (!now.a.some((v) => Math.abs(v) > 1e-9))
        return { kind: "error", message: "方程里没有 x、y、z · nothing to plot" };
      return { kind: "plane", fit: fit, a: now.a, d: now.d, usesT: usesT, label: "平面 " + text };
    }

    const val = ev(ast, ENV0);
    if (isVec(val)) return vectorKind(ast, usesT, text);
    if (hasVector(ast)) {
      if (!isFinite(val)) return { kind: "error", message: "这个向量式子算不出数 · not a scalar" };
      return { kind: "scalar", fn: compile(ast), value: val, usesT: usesT, label: "数值 " + text };
    }

    if (!vs.has("z")) {
      return { kind: "surface", f: compile(ast), usesT: usesT, label: "曲面 z = f(x, y)" };
    }
    const fn2 = compile(ast);
    const fit2 = function (t) {
      const aff = affineOf(function (x, y, z) {
        return fn2({ x: x, y: y, z: z, t: t });
      });
      return aff ? { a: aff.a, d: -aff.d } : null;
    };
    const now2 = fit2(0);
    if (!now2) return { kind: "error", message: "含 z 只支持线性方程 · only linear in z" };
    if (!now2.a.some((v) => Math.abs(v) > 1e-9))
      return { kind: "error", message: "这里没有真正的方程 · empty equation" };
    return { kind: "plane", fit: fit2, a: now2.a, d: now2.d, usesT: usesT, label: "平面 " + text };
  }

  function vectorKind(node, usesT, text, name) {
    const parts = partsOf(node);
    return {
      kind: "vector",
      name: name || "",
      fn: compile(node),
      parts: parts.fns,
      op: parts.op,
      usesT: usesT,
      text: text,
      label: "向量 " + text,
    };
  }

  return {
    classify: classify,
    parse: parse,
    compile: compile,
    ev: ev,
  };
})();
