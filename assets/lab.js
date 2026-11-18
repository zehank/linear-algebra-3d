/* lab.js — 3D 实验室：表达式、基 B、变换 A 与复合 B、相机交互。 */
(function () {
  "use strict";

  const canvas = document.getElementById("stage");
  const rowsEl = document.getElementById("rows");
  const presetsEl = document.getElementById("presets");
  const matEl = document.getElementById("emat");
  const bmatEl = document.getElementById("bmat");
  const basisMatEl = document.getElementById("basismat");
  const basisInfo = document.getElementById("basisInfo");
  const composeInfo = document.getElementById("composeInfo");
  const tSlider = document.getElementById("tslider");
  const tOut = document.getElementById("tout");
  const detEl = document.getElementById("vdet");
  const timeEl = document.getElementById("vtime");
  const playBtn = document.getElementById("play");

  const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const COLORS = ["#0E6B57", "#A93B1E", "#3A4A8C"];
  const ENV = { x: 0, y: 0, z: 0, t: 0 };

  const state = {
    rows: [],
    basis: ID.slice(),
    A: ID.slice(),
    Bm: ID.slice(),
    progress: 1,
    time: 0,
    playing: 0,
    playT0: 0,
    model: { quads: [], planes: [], vectors: [], lines: [], points: [] },
    dirty: true,
    usesT: false,
  };

  /* ------------------------------------------------------------ 小工具 */

  function fmt(x, d) {
    if (!isFinite(x)) return "—";
    const dd = d == null ? 2 : d;
    let s = Math.abs(x) < Math.pow(10, -dd) / 2 ? "0" : x.toFixed(dd);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s.replace("-", "−");
  }
  const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(isFinite);

  function mul3(A, B) {
    const out = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out[r * 3 + c] =
          A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return out;
  }

  function det3(M) {
    return (
      M[0] * (M[4] * M[8] - M[5] * M[7]) -
      M[1] * (M[3] * M[8] - M[5] * M[6]) +
      M[2] * (M[3] * M[7] - M[4] * M[6])
    );
  }

  function inv3(M) {
    const d = det3(M);
    if (Math.abs(d) < 1e-9) return null;
    const a = M[0], b = M[1], c = M[2], e = M[3], f = M[4], g = M[5], h = M[6], i = M[7], j = M[8];
    return [
      (f * j - g * i) / d, (c * i - b * j) / d, (b * g - c * f) / d,
      (g * h - e * j) / d, (a * j - c * h) / d, (c * e - a * g) / d,
      (e * i - f * h) / d, (b * h - a * i) / d, (a * f - b * e) / d,
    ];
  }

  const mv3 = (M, p) => [
    M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
    M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
    M[6] * p[0] + M[7] * p[1] + M[8] * p[2],
  ];

  function mix3(A, B, t) {
    const out = new Array(9);
    for (let i = 0; i < 9; i++) out[i] = A[i] + (B[i] - A[i]) * t;
    return out;
  }

  function currentM() {
    const p = Math.max(0, Math.min(2, state.progress));
    if (p <= 1) return mix3(ID, state.A, p);
    const s = p - 1;
    return mul3(mix3(ID, state.Bm, s), state.A);
  }

  /* ------------------------------------------------------------ 几何 */

  const N = 44;
  const R = 2.0;
  const ZMAX = 4.4;
  const BOX = 2.3;

  function buildSurface(fn, t, color) {
    const quads = [];
    const pts = new Array((N + 1) * (N + 1));
    const env = { x: 0, y: 0, z: 0, t: t };
    for (let j = 0; j <= N; j++) {
      const y = -R + (2 * R * j) / N;
      for (let i = 0; i <= N; i++) {
        env.x = -R + (2 * R * i) / N;
        env.y = y;
        const z = fn(env);
        pts[j * (N + 1) + i] = isFinite(z) && Math.abs(z) <= ZMAX ? [env.x, y, z] : null;
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = pts[j * (N + 1) + i];
        const b = pts[j * (N + 1) + i + 1];
        const c = pts[(j + 1) * (N + 1) + i + 1];
        const d = pts[(j + 1) * (N + 1) + i];
        if (!a || !b || !c || !d) continue;
        quads.push({ p: [a, b, c, d], color: color });
      }
    }
    return quads;
  }

  function clipHalf(poly, axis, bound, keepGreater) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = keepGreater ? a[axis] - bound : bound - a[axis];
      const db = keepGreater ? b[axis] - bound : bound - b[axis];
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const tt = da / (da - db);
        out.push([
          a[0] + (b[0] - a[0]) * tt,
          a[1] + (b[1] - a[1]) * tt,
          a[2] + (b[2] - a[2]) * tt,
        ]);
      }
    }
    return out;
  }

  function planePoly(a, d) {
    const n = Math.hypot(a[0], a[1], a[2]);
    if (n < 1e-9) return null;
    const u = [a[0] / n, a[1] / n, a[2] / n];
    const p0 = [(u[0] * d) / n, (u[1] * d) / n, (u[2] * d) / n];
    let t1 = [u[1], -u[0], 0];
    if (Math.hypot(t1[0], t1[1], t1[2]) < 1e-6) t1 = [0, 1, 0];
    const l1 = Math.hypot(t1[0], t1[1], t1[2]);
    t1 = [t1[0] / l1, t1[1] / l1, t1[2] / l1];
    const t2 = [
      u[1] * t1[2] - u[2] * t1[1],
      u[2] * t1[0] - u[0] * t1[2],
      u[0] * t1[1] - u[1] * t1[0],
    ];
    const S = 12;
    let poly = [
      [p0[0] + S * (t1[0] + t2[0]), p0[1] + S * (t1[1] + t2[1]), p0[2] + S * (t1[2] + t2[2])],
      [p0[0] + S * (-t1[0] + t2[0]), p0[1] + S * (-t1[1] + t2[1]), p0[2] + S * (-t1[2] + t2[2])],
      [p0[0] + S * (-t1[0] - t2[0]), p0[1] + S * (-t1[1] - t2[1]), p0[2] + S * (-t1[2] - t2[2])],
      [p0[0] + S * (t1[0] - t2[0]), p0[1] + S * (t1[1] - t2[1]), p0[2] + S * (t1[2] - t2[2])],
    ];
    for (let axis = 0; axis < 3; axis++) {
      poly = clipHalf(poly, axis, -BOX, true);
      poly = clipHalf(poly, axis, BOX, false);
      if (poly.length < 3) return null;
    }
    return poly;
  }

  const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  function planePair(P, Q) {
    const dir = cross3(P.a, Q.a);
    const dd = Math.hypot(dir[0], dir[1], dir[2]);
    if (dd < 1e-9) return null;
    const m11 = dot3(P.a, P.a);
    const m12 = dot3(P.a, Q.a);
    const m22 = dot3(Q.a, Q.a);
    const det = m11 * m22 - m12 * m12;
    if (Math.abs(det) < 1e-12) return null;
    const w1 = (m22 * P.d - m12 * Q.d) / det;
    const w2 = (-m12 * P.d + m11 * Q.d) / det;
    const p = [
      P.a[0] * w1 + Q.a[0] * w2,
      P.a[1] * w1 + Q.a[1] * w2,
      P.a[2] * w1 + Q.a[2] * w2,
    ];
    const u = [dir[0] / dd, dir[1] / dd, dir[2] / dd];
    let lo = -1e9;
    let hi = 1e9;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(u[k]) < 1e-9) {
        if (Math.abs(p[k]) > BOX) return null;
        continue;
      }
      const ta = (-BOX - p[k]) / u[k];
      const tb = (BOX - p[k]) / u[k];
      lo = Math.max(lo, Math.min(ta, tb));
      hi = Math.min(hi, Math.max(ta, tb));
    }
    if (hi <= lo) return null;
    return {
      a: [p[0] + u[0] * lo, p[1] + u[1] * lo, p[2] + u[2] * lo],
      b: [p[0] + u[0] * hi, p[1] + u[1] * hi, p[2] + u[2] * hi],
    };
  }

  function triplePoint(P, Q, R) {
    const m = [P.a.slice(), Q.a.slice(), R.a.slice()];
    const d = [P.d, Q.d, R.d];
    const det =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if (Math.abs(det) < 1e-9) return null;
    function rep(col) {
      const mm = m.map((row) => row.slice());
      for (let i = 0; i < 3; i++) mm[i][col] = d[i];
      return (
        mm[0][0] * (mm[1][1] * mm[2][2] - mm[1][2] * mm[2][1]) -
        mm[0][1] * (mm[1][0] * mm[2][2] - mm[1][2] * mm[2][0]) +
        mm[0][2] * (mm[1][0] * mm[2][1] - mm[1][1] * mm[2][0])
      );
    }
    const p = [rep(0) / det, rep(1) / det, rep(2) / det];
    if (p.some((v) => Math.abs(v) > BOX)) return null;
    return p;
  }

  /* ------------------------------------------------------------ 模型 */

  function rebuild() {
    const model = { quads: [], planes: [], vectors: [], lines: [], points: [] };
    const planeDefs = [];
    const env = { x: 0, y: 0, z: 0, t: state.time };
    state.usesT = false;

    for (let i = 0; i < state.rows.length; i++) {
      const row = state.rows[i];
      const p = row.parsed;
      if (!row.visible || !p) continue;
      if (p.usesT) state.usesT = true;

      if (p.kind === "surface") {
        model.quads = model.quads.concat(buildSurface(p.f, state.time, row.color));
      } else if (p.kind === "plane") {
        const fit = (p.fit && p.fit(state.time)) || { a: p.a, d: p.d };
        const poly = planePoly(fit.a, fit.d);
        if (poly) model.planes.push({ poly: poly, color: row.color });
        planeDefs.push({ a: fit.a, d: fit.d, color: row.color });
      } else if (p.kind === "vector") {
        const v = p.fn(env);
        if (!isVec(v)) continue;
        const parts = (p.parts || [])
          .map((f) => f(env))
          .filter(isVec);
        model.vectors.push({ p: v, parts: parts, op: p.op, name: p.name });
      }
    }

    if (planeDefs.length >= 2) {
      for (let i = 0; i < planeDefs.length; i++) {
        for (let j = i + 1; j < planeDefs.length; j++) {
          const seg = planePair(planeDefs[i], planeDefs[j]);
          if (!seg) continue;
          model.lines.push({
            a: seg.a,
            b: seg.b,
            color: "rgba(22,25,21,0.6)",
            width: 1.4,
            dash: [5, 4],
          });
        }
      }
    }
    if (planeDefs.length === 3) {
      const tp = triplePoint(planeDefs[0], planeDefs[1], planeDefs[2]);
      if (tp) model.points.push({ p: tp, color: "#161915" });
    }

    state.model = model;
    refreshHints();
    refreshInfo();
    state.dirty = true;
  }

  /* ------------------------------------------------------------ 行 */

  function makeRow(src) {
    return { src: src, parsed: null, lastGood: null, visible: true, color: 0, hintEl: null, res: null };
  }

  function parseRow(row) {
    row.res = window.EXPR.classify(row.src);
    if (row.res.kind === "error") row.parsed = row.lastGood || null;
    else if (row.res.kind === "empty") {
      row.parsed = null;
      row.lastGood = null;
    } else {
      row.parsed = row.res;
      row.lastGood = row.res;
    }
    return row.res;
  }

  function vectorText(v) {
    return "(" + v.map((x) => fmt(x)).join(", ") + ")";
  }

  function rowHint(row) {
    const res = row.res;
    if (!res) return { cls: "", text: "" };
    if (res.kind === "error") return { cls: "bad", text: res.message };
    if (res.kind === "empty") return { cls: "", text: "空着就先不画 · empty" };
    const p = row.parsed;
    if (!p) return { cls: "", text: "" };
    const env = { x: 0, y: 0, z: 0, t: state.time };
    if (p.kind === "surface")
      return { cls: "", text: "曲面 surface · x, y ∈ [−2, 2]" + (p.usesT ? " · 含 t time" : "") };
    if (p.kind === "plane")
      return { cls: "", text: "平面 plane · 法向 normal (" + p.a.map((x) => fmt(x)).join(", ") + ")" };
    if (p.kind === "vector") {
      const v = p.fn(env);
      const tag = p.op === "sum" ? " · 相加 sum" : p.op === "cross" ? " · 叉积 cross" : "";
      return { cls: "", text: "向量 vector " + (isVec(v) ? vectorText(v) : "—") + tag };
    }
    if (p.kind === "scalar") {
      const v = p.fn(env);
      return { cls: "", text: "数量 scalar " + fmt(v, 3) };
    }
    return { cls: "", text: "" };
  }

  function refreshHints() {
    state.rows.forEach(function (row) {
      if (!row.hintEl) return;
      const h = rowHint(row);
      row.hintEl.className = "ehint " + h.cls;
      row.hintEl.textContent = h.text;
    });
  }

  function renderRows() {
    rowsEl.innerHTML = "";
    state.rows.forEach(function (row, i) {
      const wrap = document.createElement("div");
      wrap.className = "erow";

      const dot = document.createElement("button");
      dot.className = "edot" + (row.visible ? "" : " off");
      dot.type = "button";
      dot.style.background = row.visible ? COLORS[row.color] : "transparent";
      dot.setAttribute("aria-label", row.visible ? "隐藏这条" : "显示这条");
      dot.title = row.visible ? "点一下隐藏" : "点一下显示";
      dot.addEventListener("click", function () {
        row.visible = !row.visible;
        renderRows();
        rebuild();
      });

      const body = document.createElement("div");
      body.className = "ebody";
      const input = document.createElement("input");
      input.className = "einput";
      input.value = row.src;
      input.spellcheck = false;
      input.autocomplete = "off";
      input.setAttribute("aria-label", "第 " + (i + 1) + " 条表达式");
      const hint = document.createElement("div");
      hint.className = "ehint";
      body.appendChild(input);
      body.appendChild(hint);
      row.hintEl = hint;

      input.addEventListener("input", function () {
        row.src = input.value;
        parseRow(row);
        rebuild();
      });

      const del = document.createElement("button");
      del.className = "edel";
      del.type = "button";
      del.textContent = "×";
      del.setAttribute("aria-label", "删掉这条");
      del.addEventListener("click", function () {
        state.rows.splice(i, 1);
        if (state.rows.length === 0) state.rows.push(makeRow(""));
        renderRows();
        rebuild();
      });

      wrap.appendChild(dot);
      wrap.appendChild(body);
      wrap.appendChild(del);
      rowsEl.appendChild(wrap);
    });
  }

  /* ------------------------------------------------------------ 预设 */

  const PRESETS = [
    ["鞍面", "Saddle", "z = 0.4*(x^2 - y^2)"],
    ["抛物面", "Paraboloid", "z = 0.45*(x^2 + y^2)"],
    ["波纹", "Ripple", "z = 0.7*sin(1.4x)*cos(1.4y)"],
    ["时间波", "Time wave", "z = 0.7*sin(1.4x + t)*cos(1.4y)"],
    ["平面", "Plane", "x + 2y + 3z = 6"],
    ["三个平面", "3 planes", null],
    ["向量", "Vector", "v = (1, 1.4, 2)"],
    ["相加", "Sum", "(1, 1, 0) + (1.2, 2, 1)"],
    ["叉积", "Cross", "(1, 0, 0) × (0, 1, 1)"],
    ["点积", "Dot", "dot((1, 2, 0), (0, 1, 1))"],
  ];

  function applyPreset(name, src) {
    if (src === null) {
      state.rows = [
        makeRow("x + y + z = 3"),
        makeRow("x - y + 2z = 1"),
        makeRow("2x + 3y - z = 4"),
      ];
    } else {
      state.rows = [makeRow(src)];
    }
    state.rows.forEach(function (r, i) {
      r.color = i % 3;
      parseRow(r);
    });
    renderRows();
    rebuild();
  }

  presetsEl.innerHTML = PRESETS.map(function (p) {
    return '<button class="chip" type="button">' + p[0] + '<span class="ce">' + p[1] + "</span></button>";
  }).join("");
  Array.prototype.forEach.call(presetsEl.querySelectorAll(".chip"), function (btn, i) {
    btn.addEventListener("click", function () {
      applyPreset(PRESETS[i][0], PRESETS[i][2]);
    });
  });

  /* ------------------------------------------------------------ 矩阵编辑器 */

  function buildMatrix(el, initial, onChange) {
    el.innerHTML = "";
    const inputs = [];
    for (let i = 0; i < 9; i++) {
      const inp = document.createElement("input");
      inp.className = "numin";
      inp.type = "text";
      inp.value = fmt(initial[i]).replace("−", "-");
      inp.spellcheck = false;
      inp.setAttribute(
        "aria-label",
        "第 " + (Math.floor(i / 3) + 1) + " 行第 " + ((i % 3) + 1) + " 列"
      );
      inp.addEventListener("input", function () {
        const v = parseFloat(inp.value);
        onChange(i, isFinite(v) ? v : 0);
      });
      el.appendChild(inp);
      inputs.push(inp);
    }
    return {
      set: function (vals) {
        vals.forEach(function (v, i) {
          inputs[i].value = fmt(v).replace("−", "-");
        });
      },
    };
  }

  const aMat = buildMatrix(matEl, state.A, function (i, v) {
    state.A[i] = v;
    state.dirty = true;
    refreshInfo();
  });
  const bMat = buildMatrix(bmatEl, state.Bm, function (i, v) {
    state.Bm[i] = v;
    state.dirty = true;
    refreshInfo();
  });
  const basisEd = buildMatrix(basisMatEl, state.basis, function (i, v) {
    state.basis[i] = v;
    state.dirty = true;
    refreshInfo();
  });

  function chips(el, list, onPick) {
    el.innerHTML = list
      .map(function (p) {
        return '<button class="chip" type="button">' + p[0] + '<span class="ce">' + p[1] + "</span></button>";
      })
      .join("");
    Array.prototype.forEach.call(el.querySelectorAll(".chip"), function (btn, i) {
      btn.addEventListener("click", function () {
        onPick(list[i][2]);
      });
    });
  }

  const C45 = Math.SQRT1_2;
  chips(document.getElementById("mpresets"), [
    ["旋转 45°", "rotate", [C45, -C45, 0, C45, C45, 0, 0, 0, 1]],
    ["剪切", "shear", [1, 0, 0.6, 0, 1, 0, 0, 0, 1]],
    ["放大 1.4", "scale", [1.4, 0, 0, 0, 1.4, 0, 0, 0, 1.4]],
    ["压扁", "flatten", [1, 0, 0, 0, 1, 0, 0, 0, 0]],
    ["拉伸", "stretch", [2, 0, 0, 0, 0.5, 0, 0, 0, 1]],
  ], function (vals) {
    state.A = vals.slice();
    aMat.set(vals);
    state.dirty = true;
    refreshInfo();
  });

  chips(document.getElementById("bpresets"), [
    ["旋转 90°", "rotate", [0, -1, 0, 1, 0, 0, 0, 0, 1]],
    ["剪切", "shear", [1, 0.8, 0, 0, 1, 0, 0, 0, 1]],
    ["放大 1.3", "scale", [1.3, 0, 0, 0, 1.3, 0, 0, 0, 1.3]],
    ["压到平面", "onto plane", [1, 0, 0, 0, 1, 0, 0, 0, 0]],
  ], function (vals) {
    state.Bm = vals.slice();
    bMat.set(vals);
    state.dirty = true;
    refreshInfo();
  });

  chips(document.getElementById("baspresets"), [
    ["标准基", "standard", ID.slice()],
    ["旋转 45°", "rotate", [C45, -C45, 0, C45, C45, 0, 0, 0, 1]],
    ["剪切", "shear", [1, 0, 0.6, 0, 1, 0, 0, 0, 1]],
    ["缩放", "scale", [1.5, 0, 0, 0, 0.7, 0, 0, 0, 1.2]],
  ], function (vals) {
    state.basis = vals.slice();
    basisEd.set(vals);
    state.dirty = true;
    refreshInfo();
  });

  /* ------------------------------------------------------------ 读数 */

  function refreshInfo() {
    if (basisInfo) {
      const dB = det3(state.basis);
      let txt = "det B = " + fmt(dB) + (Math.abs(dB) < 1e-6 ? " · 退化 singular" : "");
      const vrow = state.rows.filter(function (r) {
        return r.parsed && r.parsed.kind === "vector" && r.visible;
      })[0];
      const inv = inv3(state.basis);
      if (vrow && inv) {
        const v = vrow.parsed.fn({ x: 0, y: 0, z: 0, t: state.time });
        if (isVec(v)) {
          const c = mv3(inv, v);
          txt += " · 坐标 coords " + vectorText(c);
        }
      }
      basisInfo.textContent = txt;
    }
    if (composeInfo) {
      const BA = mul3(state.Bm, state.A);
      composeInfo.textContent =
        "BA 的 det = " + fmt(det3(BA)) + " = det B × det A · 复合不可交换 not commutative";
    }
  }

  tSlider.addEventListener("input", function () {
    state.progress = parseFloat(tSlider.value);
    tOut.textContent = state.progress.toFixed(2);
    state.dirty = true;
  });

  if (playBtn) {
    playBtn.addEventListener("click", function () {
      state.playing = 1;
      state.playT0 = performance.now();
      state.progress = 0;
      tSlider.value = 0;
      tOut.textContent = "0.00";
    });
  }

  /* ------------------------------------------------------------ 相机 */

  const pointers = new Map();
  let dragLast = null;
  let pinchLast = 0;

  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.classList.add("dragging");
    if (pointers.size === 1) dragLast = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      pinchLast = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && dragLast) {
      window.SCENE.orbit(e.clientX - dragLast.x, e.clientY - dragLast.y);
      dragLast = { x: e.clientX, y: e.clientY };
      state.dirty = true;
    } else if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchLast > 0) window.SCENE.zoom(pinchLast / d);
      pinchLast = d;
      state.dirty = true;
    }
  });

  function release(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragLast = null;
      canvas.classList.remove("dragging");
    }
    pinchLast = 0;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  canvas.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      window.SCENE.zoom(Math.exp(e.deltaY * 0.0012));
      state.dirty = true;
    },
    { passive: false }
  );

  canvas.addEventListener("dblclick", function () {
    window.SCENE.reset();
    state.dirty = true;
  });

  /* ------------------------------------------------------------ 主循环 */

  let lastRebuild = 0;

  function loop(ts) {
    if (state.playing) {
      const u = Math.min(1, (ts - state.playT0) / 2400);
      state.progress = u * 2;
      tSlider.value = state.progress;
      tOut.textContent = state.progress.toFixed(2);
      state.dirty = true;
      if (u >= 1) {
        state.playing = 0;
        state.progress = 2;
        tSlider.value = 2;
        tOut.textContent = "2.00";
      }
    }

    if (state.usesT && ts - lastRebuild > 34) {
      state.time = (ts / 1000) * 1.15;
      lastRebuild = ts;
      rebuild();
      if (timeEl) {
        timeEl.hidden = false;
        timeEl.textContent = "t = " + (state.time % (Math.PI * 2)).toFixed(2);
      }
    } else if (timeEl && !state.usesT) {
      timeEl.hidden = true;
    }

    if (state.dirty) {
      const M = currentM();
      let frame = false;
      for (let i = 0; i < 9; i++) if (Math.abs(M[i] - ID[i]) > 0.02) frame = true;
      window.SCENE.render(canvas, state.model, M, { frame: frame, basis: state.basis });
      state.dirty = false;
      if (detEl) {
        const d = det3(M);
        const p = state.progress;
        const stage =
          p < 0.01 ? "单位 identity" : p < 0.999 ? "A " + p.toFixed(2) : p < 1.001 ? "A" : p < 1.999 ? "B " + (p - 1).toFixed(2) : "BA";
        detEl.textContent =
          "det = " + (Math.abs(d) < 1e-6 ? "0.00" : d.toFixed(2)) + " · 体积 vol ×" + Math.abs(d).toFixed(2) + " · " + stage;
      }
    }
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------ 启动 */

  document.getElementById("addRow").addEventListener("click", function () {
    if (state.rows.length >= 5) return;
    const row = makeRow("");
    row.color = state.rows.length % 3;
    state.rows.push(row);
    renderRows();
    const inputs = rowsEl.querySelectorAll(".einput");
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  if (window.innerWidth < 900) window.SCENE.zoom(0.78);
  state.rows = [makeRow("z = 0.4*(x^2 - y^2)")];
  state.rows[0].color = 0;
  state.rows[0].visible = true;
  parseRow(state.rows[0]);
  renderRows();
  rebuild();
  requestAnimationFrame(loop);

  window.addEventListener("resize", function () {
    state.dirty = true;
  });
})();
