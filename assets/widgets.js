/* widgets.js — 每一张图一个函数。全部手画在 canvas 上，不依赖任何库。 */
(function () {
  "use strict";
  const L = window.LA;
  const C = L.C;
  const fmt = L.fmt;
  const clamp = L.clamp;

  function setOut(el, html) {
    if (el) el.innerHTML = html;
  }

  function stopTw(el) {
    if (el.__tw) {
      cancelAnimationFrame(el.__tw);
      el.__tw = 0;
    }
  }

  function handleAt(ctx, cam, p, color, r) {
    r = r || 5;
    const x = cam.X(p[0]);
    const y = cam.Y(p[1]);
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(248,249,245,0.92)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    L.stroke(ctx, "rgba(22,25,21,0.35)", 1, []);
    ctx.stroke();
  }

  function subLabel(ctx, main, sub, x, y, color, size) {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "italic " + (size || 13) + "px Charter, Georgia, serif";
    ctx.fillStyle = color;
    ctx.fillText(main, x, y);
    const wid = ctx.measureText(main).width;
    ctx.font = (size || 13) * 0.72 + "px Charter, Georgia, serif";
    ctx.fillText(sub, x + wid + 1, y + (size || 13) * 0.3);
  }

  function nearest(p, cam, pts, radius) {
    let best = -1;
    let bd = radius;
    pts.forEach((q, i) => {
      const d = Math.hypot(cam.X(q[0]) - p.x, cam.Y(q[1]) - p.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /* ==================================================================
     首页：整页的格子就是它的画布
     ================================================================== */
  function hero() {
    const canvas = document.getElementById("hero");
    if (!canvas) return;
    const matEls = Array.prototype.slice.call(document.querySelectorAll("#heroMat span"));
    const detEl = document.getElementById("heroDet");
    const noteEl = document.getElementById("heroNote");
    const presets = Array.prototype.slice.call(document.querySelectorAll("#heroPresets .chip"));

    let M = [1.05, 0.55, -0.35, 1.15];
    let cur = M.slice();
    let view = null;

    const cols = () => [[cur[0], cur[2]], [cur[1], cur[3]]];

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = clamp(Math.min(w, h) / 8.2, 30, 72);
      const cam = L.camera(w, h, px, w < 700 ? 0.5 : 0.66, w < 700 ? 0.57 : 0.5);
      view = cam;

      L.grid(ctx, cam, w, h, { color: "rgba(22,25,21,0.07)", axis: "rgba(22,25,21,0.16)" });
      L.triGrid(ctx, cam, w, h, cur, { color: "rgba(14,107,87,0.26)" });

      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      L.poly(ctx, sq.map((p) => [cam.X(p[0]), cam.Y(p[1])]), {
        stroke: "rgba(22,25,21,0.16)",
        width: 1,
        dash: [4, 4],
      });
      L.poly(ctx, sq.map((p) => {
        const q = L.apply(cur, p[0], p[1]);
        return [cam.X(q[0]), cam.Y(q[1])];
      }), {
        fill: "rgba(14,107,87,0.12)",
        stroke: "rgba(14,107,87,0.9)",
        width: 1.6,
        close: true,
      });

      const c = cols();
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(c[0][0]), cam.Y(c[0][1]), "rgba(22,25,21,0.6)", 1.6);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(c[1][0]), cam.Y(c[1][1]), "rgba(22,25,21,0.4)", 1.4);
      handleAt(ctx, cam, c[0], C.jade);
      handleAt(ctx, cam, c[1], C.ink2);
      subLabel(ctx, "Ae", "1", cam.X(c[0][0]) + 13, cam.Y(c[0][1]) - 15, C.ink2);
      subLabel(ctx, "Ae", "2", cam.X(c[1][0]) + 13, cam.Y(c[1][1]) - 15, C.ink2);
      L.dot(ctx, cam.X(0), cam.Y(0), 2.4, C.ink);

      const d = L.det(cur);
      matEls.forEach((el, i) => (el.textContent = fmt(cur[i], 2)));
      detEl.textContent = "det " + fmt(d, 2);
      noteEl.textContent =
        Math.abs(d) < 0.02
          ? "面积归零 · 不可逆"
          : d < 0
          ? "面积 ×" + fmt(Math.abs(d)) + " · 朝向翻转"
          : "面积 ×" + fmt(d);
    }

    let dragIdx = -1;
    L.drag(canvas, {
      down(p) {
        if (!view) return false;
        dragIdx = nearest(p, view, cols(), 34);
        return dragIdx >= 0;
      },
      move(p, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        const x = clamp(view.wx(p.x), -4, 4);
        const y = clamp(view.wy(p.y), -3, 3);
        stopTw(canvas);
        M = M.slice();
        if (dragIdx === 0) {
          M[0] = x;
          M[2] = y;
        } else {
          M[1] = x;
          M[3] = y;
        }
        cur = M.slice();
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    const PRESET = {
      rot: (function () {
        const t = Math.PI / 6;
        return [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];
      })(),
      shear: [1, 0.9, 0, 1],
      flatten: [1.15, 0, 0, 0.03],
      flip: [-1, 0, 0, 1],
    };

    presets.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = PRESET[btn.dataset.m].slice();
        const start = cur.slice();
        M = target;
        stopTw(canvas);
        L.tween(canvas, 460, (t) => {
          cur = L.mix(start, target, t);
          draw();
        });
      });
    });

    L.onResize(draw);
    draw();
  }

  /* ==================================================================
     1 · 张成
     ================================================================== */
  function spanWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const s1 = fig.querySelector('[data-k="c1"]');
    const s2 = fig.querySelector('[data-k="c2"]');
    const o1 = s1.parentElement.querySelector("output");
    const o2 = s2.parentElement.querySelector("output");
    const toggle = fig.querySelector('[data-act="lattice"]');

    let vV = [1.55, 0.55];
    let wV = [-0.35, 1.5];
    let c1 = 1;
    let c2 = 1;
    let lattice = false;
    let view = null;
    let dragIdx = -1;

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = Math.min(w, h) / 7.4;
      const cam = L.camera(w, h, px, 0.5, 0.5);
      view = cam;

      L.grid(ctx, cam, w, h);

      if (lattice) {
        for (let i = -7; i <= 7; i++) {
          for (let j = -7; j <= 7; j++) {
            const x = i * vV[0] + j * wV[0];
            const y = i * vV[1] + j * wV[1];
            const sx = cam.X(x);
            const sy = cam.Y(y);
            if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
            const r = Math.abs(i) + Math.abs(j);
            ctx.beginPath();
            ctx.arc(sx, sy, r === 0 ? 3.4 : 2.4, 0, Math.PI * 2);
            ctx.fillStyle = r === 0 ? C.jade : "rgba(14,107,87," + (0.5 - r * 0.035) + ")";
            ctx.fill();
          }
        }
      }

      const P = [c1 * vV[0] + c2 * wV[0], c1 * vV[1] + c2 * wV[1]];
      if (!lattice) {
        const walk = (a, b, alpha) => {
          L.line(ctx, cam.X(0), cam.Y(0), cam.X(a[0]), cam.Y(a[1]), "rgba(22,25,21," + alpha + ")", 1, [4, 4]);
          L.line(ctx, cam.X(a[0]), cam.Y(a[1]), cam.X(b[0]), cam.Y(b[1]), "rgba(22,25,21," + alpha + ")", 1, [4, 4]);
        };
        walk([c1 * vV[0], c1 * vV[1]], P, 0.26);
        walk([c2 * wV[0], c2 * wV[1]], P, 0.18);
      }

      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(vV[0]), cam.Y(vV[1]), "rgba(22,25,21,0.55)", 1.6);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(wV[0]), cam.Y(wV[1]), "rgba(22,25,21,0.4)", 1.6);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(P[0]), cam.Y(P[1]), C.jade, 2.1);
      L.dot(ctx, cam.X(P[0]), cam.Y(P[1]), 4, C.jade);

      handleAt(ctx, cam, vV, C.ink, 4.5);
      handleAt(ctx, cam, wV, C.ink2, 4.5);
      subLabel(ctx, "v", "", cam.X(vV[0]) + 12, cam.Y(vV[1]) - 14, C.ink2, 14);
      subLabel(ctx, "w", "", cam.X(wV[0]) + 12, cam.Y(wV[1]) - 14, C.ink2, 14);

      const d = vV[0] * wV[1] - vV[1] * wV[0];
      const span =
        Math.abs(d) < 0.06 ? "张成：一条直线" : "张成：整个平面";
      setOut(outEl, span + " · det " + fmt(d));
    }

    function update() {
      c1 = parseFloat(s1.value);
      c2 = parseFloat(s2.value);
      o1.textContent = c1.toFixed(2);
      o2.textContent = c2.toFixed(2);
      draw();
    }

    s1.addEventListener("input", update);
    s2.addEventListener("input", update);

    toggle.addEventListener("click", () => {
      lattice = !lattice;
      toggle.setAttribute("aria-pressed", String(lattice));
      draw();
    });

    L.drag(canvas, {
      down(p) {
        if (!view) return false;
        dragIdx = nearest(p, view, [vV, wV], 26);
        return dragIdx >= 0;
      },
      move(p, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        const x = clamp(view.wx(p.x), -3.4, 3.4);
        const y = clamp(view.wy(p.y), -3.4, 3.4);
        if (dragIdx === 0) vV = [x, y];
        else wV = [x, y];
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    L.onResize(draw);
    update();
  }

  /* ==================================================================
     2 · 线性变换
     ================================================================== */
  function transformWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const inputs = Array.prototype.slice.call(fig.querySelectorAll(".numin"));
    const chips = Array.prototype.slice.call(fig.querySelectorAll("[data-preset]"));

    let M = inputs.map((el) => parseFloat(el.value) || 0);
    let cur = M.slice();
    let view = null;
    let dragIdx = -1;

    const cols = () => [[cur[0], cur[2]], [cur[1], cur[3]]];

    function circle(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        out.push([Math.cos(t), Math.sin(t)]);
      }
      return out;
    }
    const CIRC = circle(48);

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = Math.min(w, h) / 5.8;
      const cam = L.camera(w, h, px, 0.5, 0.5);
      view = cam;

      L.grid(ctx, cam, w, h, {
        color: "rgba(22,25,21,0.18)",
        axis: "rgba(22,25,21,0.28)",
        dash: [3, 4],
      });
      L.triGrid(ctx, cam, w, h, cur, { color: "rgba(14,107,87,0.26)" });

      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      L.poly(
        ctx,
        sq.map((p) => {
          const q = L.apply(cur, p[0], p[1]);
          return [cam.X(q[0]), cam.Y(q[1])];
        }),
        { fill: "rgba(14,107,87,0.13)", stroke: "rgba(14,107,87,0.9)", width: 1.6, close: true }
      );

      const c = cols();
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(c[0][0]), cam.Y(c[0][1]), "rgba(22,25,21,0.62)", 1.6);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(c[1][0]), cam.Y(c[1][1]), "rgba(22,25,21,0.42)", 1.4);
      handleAt(ctx, cam, c[0], C.jade);
      handleAt(ctx, cam, c[1], C.ink2);
      subLabel(ctx, "Ae", "1", cam.X(c[0][0]) + 12, cam.Y(c[0][1]) - 14, C.ink2);
      subLabel(ctx, "Ae", "2", cam.X(c[1][0]) + 12, cam.Y(c[1][1]) - 14, C.ink2);
      L.dot(ctx, cam.X(0), cam.Y(0), 2.4, C.ink);

      const d = L.det(cur);
      setOut(
        outEl,
        "det " + fmt(d, 2) + " · 面积 ×" + fmt(Math.abs(d), 2) + (Math.abs(d) < 0.02 ? " · 不可逆" : "")
      );
    }

    function readInputs() {
      M = inputs.map((el) => {
        const v = parseFloat(el.value);
        return isFinite(v) ? v : 0;
      });
    }

    function animateTo(target) {
      readInputs();
      const start = cur.slice();
      stopTw(canvas);
      L.tween(canvas, 380, (t) => {
        cur = L.mix(start, target, t);
        draw();
      });
    }

    inputs.forEach((el) =>
      el.addEventListener("input", () => {
        readInputs();
        animateTo(M.slice());
      })
    );

    const PRESET = {
      rot90: [0, -1, 1, 0],
      shear: [1, 0.85, 0, 1],
      scale: [2, 0, 0, 2],
      project: [1, 0, 0, 0],
      reflect: [-1, 0, 0, 1],
    };

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = PRESET[btn.dataset.preset].slice();
        inputs.forEach((el, i) => (el.value = target[i]));
        animateTo(target);
      });
    });

    L.drag(canvas, {
      down(p) {
        if (!view) return false;
        dragIdx = nearest(p, view, cols(), 30);
        return dragIdx >= 0;
      },
      move(p, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        stopTw(canvas);
        const x = clamp(view.wx(p.x), -3.4, 3.4);
        const y = clamp(view.wy(p.y), -3.4, 3.4);
        M = M.slice();
        if (dragIdx === 0) {
          M[0] = x;
          M[2] = y;
        } else {
          M[1] = x;
          M[3] = y;
        }
        inputs.forEach((el, i) => (el.value = fmt(M[i], 2)));
        cur = M.slice();
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    L.onResize(draw);
    draw();
  }

  /* ==================================================================
     3 · 方程组：行图像 / 列图像
     ================================================================== */
  function systemWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const inputs = Array.prototype.slice.call(fig.querySelectorAll(".numin"));
    const sx1 = fig.querySelector('[data-k="x1"]');
    const sx2 = fig.querySelector('[data-k="x2"]');
    const ox1 = sx1.parentElement.querySelector("output");
    const ox2 = sx2.parentElement.querySelector("output");
    const solveBtn = fig.querySelector('[data-act="solve"]');

    let D = inputs.map((el) => parseFloat(el.value) || 0);
    let x1 = 0;
    let x2 = 0;
    let viewL = null;
    let viewR = null;

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const half = w / 2;
      const px = Math.min(half, h) / 7;

      /* 左：行图像 */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, half - 0.5, h);
      ctx.clip();
      const camL = L.camera(half, h, px, 0.5, 0.5);
      viewL = camL;
      L.grid(ctx, camL, half, h, { color: "rgba(22,25,21,0.15)", axis: "rgba(22,25,21,0.28)" });

      const a = D[0];
      const b = D[1];
      const e = D[2];
      const c = D[3];
      const d = D[4];
      const g = D[5];
      const xMin = camL.wx(0) - 1;
      const xMax = camL.wx(half) + 1;

      function drawLine(A, B, K, color, width) {
        if (Math.abs(B) > 1e-9) {
          const ya = (K - A * xMin) / B;
          const yb = (K - A * xMax) / B;
          L.line(ctx, camL.X(xMin), camL.Y(ya), camL.X(xMax), camL.Y(yb), color, width);
        } else if (Math.abs(A) > 1e-9) {
          const xv = K / A;
          L.line(ctx, camL.X(xv), 0, camL.X(xv), h, color, width);
        }
      }
      drawLine(a, b, e, "rgba(22,25,21,0.72)", 1.6);
      drawLine(c, d, g, "rgba(14,107,87,0.85)", 1.6);

      const sol = solve();
      if (sol.kind === "one") {
        const p = [sol.x[0], sol.x[1]];
        L.dot(ctx, camL.X(p[0]), camL.Y(p[1]), 5, C.jade, C.plate);
        L.text(ctx, "x = (" + fmt(p[0], 2) + ", " + fmt(p[1], 2) + ")", camL.X(p[0]) + 14, camL.Y(p[1]) - 16, {
          font: "italic 12px Charter, Georgia, serif",
          color: C.ink2,
          align: "left",
        });
      }
      L.text(ctx, "行图像 row picture", 12, 16, { font: L.SANS, color: C.ink3, align: "left" });
      ctx.restore();

      /* 右：列图像 */
      ctx.save();
      ctx.translate(half, 0);
      ctx.beginPath();
      ctx.rect(0, 0, half, h);
      ctx.clip();
      const camR = L.camera(half, h, px, 0.5, 0.5);
      viewR = camR;
      L.grid(ctx, camR, half, h, { color: "rgba(22,25,21,0.15)", axis: "rgba(22,25,21,0.28)" });

      const c1 = [a, c];
      const c2 = [b, d];
      const bb = [e, g];
      L.arrow(ctx, camR.X(0), camR.Y(0), camR.X(c1[0]), camR.Y(c1[1]), "rgba(22,25,21,0.62)", 1.6);
      L.arrow(ctx, camR.X(0), camR.Y(0), camR.X(c2[0]), camR.Y(c2[1]), "rgba(22,25,21,0.42)", 1.6);
      L.arrow(ctx, camR.X(0), camR.Y(0), camR.X(bb[0]), camR.Y(bb[1]), C.brick, 1.8);

      const s1p = [x1 * c1[0], x1 * c1[1]];
      const P = [s1p[0] + x2 * c2[0], s1p[1] + x2 * c2[1]];
      L.line(ctx, camR.X(0), camR.Y(0), camR.X(s1p[0]), camR.Y(s1p[1]), "rgba(22,25,21,0.32)", 1, [4, 4]);
      L.line(ctx, camR.X(s1p[0]), camR.Y(s1p[1]), camR.X(P[0]), camR.Y(P[1]), "rgba(14,107,87,0.5)", 1, [4, 4]);
      L.arrow(ctx, camR.X(0), camR.Y(0), camR.X(P[0]), camR.Y(P[1]), C.jade, 2.1);
      L.dot(ctx, camR.X(P[0]), camR.Y(P[1]), 4, C.jade);
      L.dot(ctx, camR.X(bb[0]), camR.Y(bb[1]), 4.4, C.brick);

      if (Math.hypot(P[0] - bb[0], P[1] - bb[1]) > 0.02) {
        L.line(ctx, camR.X(P[0]), camR.Y(P[1]), camR.X(bb[0]), camR.Y(bb[1]), "rgba(169,59,30,0.35)", 1, [3, 4]);
      }

      subLabel(ctx, "b", "", camR.X(bb[0]) + 10, camR.Y(bb[1]) - 12, C.brick, 14);
      subLabel(ctx, "col", "1", camR.X(c1[0]) + 10, camR.Y(c1[1]) - 12, C.ink2, 12);
      subLabel(ctx, "col", "2", camR.X(c2[0]) + 10, camR.Y(c2[1]) - 12, C.ink2, 12);
      L.text(ctx, "列图像 column picture", 12, 16, { font: L.SANS, color: C.ink3, align: "left" });
      ctx.restore();

      /* 中间分隔 */
      L.line(ctx, half, 0, half, h, "rgba(22,25,21,0.1)", 1);

      const label =
        sol.kind === "one"
          ? "唯一解 x = (" + fmt(sol.x[0], 2) + ", " + fmt(sol.x[1], 2) + ")"
          : sol.kind === "inf"
          ? "无穷多解 · 秩 1"
          : "无解 · b 不在列空间";
      setOut(outEl, label + " · det " + fmt(a * d - b * c, 2));
    }

    function solve() {
      const det = D[0] * D[4] - D[1] * D[3];
      if (Math.abs(det) > 1e-9) {
        return {
          kind: "one",
          x: [(D[4] * D[2] - D[1] * D[5]) / det, (D[0] * D[5] - D[3] * D[2]) / det],
        };
      }
      const c1 = [D[0], D[3]];
      const c2 = [D[1], D[4]];
      const bb = [D[2], D[5]];
      const n1 = c1[0] * c1[0] + c1[1] * c1[1];
      if (n1 > 1e-9) {
        const k = (c1[0] * bb[0] + c1[1] * bb[1]) / n1;
        const res = [bb[0] - k * c1[0], bb[1] - k * c1[1]];
        return Math.hypot(res[0], res[1]) < 1e-6
          ? { kind: "inf", x: [k, 0] }
          : { kind: "none", x: [0, 0] };
      }
      const n2 = c2[0] * c2[0] + c2[1] * c2[1];
      if (n2 > 1e-9) {
        const k = (c2[0] * bb[0] + c2[1] * bb[1]) / n2;
        const res = [bb[0] - k * c2[0], bb[1] - k * c2[1]];
        return Math.hypot(res[0], res[1]) < 1e-6
          ? { kind: "inf", x: [0, k] }
          : { kind: "none", x: [0, 0] };
      }
      return Math.hypot(bb[0], bb[1]) < 1e-9
        ? { kind: "inf", x: [0, 0] }
        : { kind: "none", x: [0, 0] };
    }

    function sync() {
      x1 = parseFloat(sx1.value);
      x2 = parseFloat(sx2.value);
      ox1.textContent = x1.toFixed(1);
      ox2.textContent = x2.toFixed(1);
      draw();
    }

    sx1.addEventListener("input", sync);
    sx2.addEventListener("input", sync);

    inputs.forEach((el) =>
      el.addEventListener("input", () => {
        D = inputs.map((inp) => {
          const v = parseFloat(inp.value);
          return isFinite(v) ? v : 0;
        });
        draw();
      })
    );

    solveBtn.addEventListener("click", () => {
      const sol = solve();
      const tx1 = clamp(sol.x[0], -3, 3);
      const tx2 = clamp(sol.x[1], -3, 3);
      const a1 = parseFloat(sx1.value);
      const a2 = parseFloat(sx2.value);
      stopTw(canvas);
      L.tween(canvas, 420, (t) => {
        sx1.value = L.lerp(a1, tx1, t);
        sx2.value = L.lerp(a2, tx2, t);
        x1 = parseFloat(sx1.value);
        x2 = parseFloat(sx2.value);
        ox1.textContent = x1.toFixed(2);
        ox2.textContent = x2.toFixed(2);
        draw();
      });
    });

    L.onResize(draw);
    sync();
  }

  /* ==================================================================
     4 · 行列式
     ================================================================== */
  function detWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const chips = Array.prototype.slice.call(fig.querySelectorAll("[data-preset]"));

    let p = [1.55, 0.35];
    let q = [-0.3, 1.4];
    let view = null;
    let dragIdx = -1;

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = Math.min(w, h) / 7;
      const cam = L.camera(w, h, px, 0.5, 0.5);
      view = cam;

      const M = [p[0], q[0], p[1], q[1]];
      const d = L.det(M);
      const area = Math.abs(d);

      L.grid(ctx, cam, w, h);

      /* 单位圆的像：所有面积按 |det| 缩放 */
      const ell = [];
      for (let i = 0; i < 56; i++) {
        const t = (i / 56) * Math.PI * 2;
        const u = L.apply(M, Math.cos(t), Math.sin(t));
        ell.push([cam.X(u[0]), cam.Y(u[1])]);
      }
      L.poly(ctx, ell, { stroke: "rgba(22,25,21,0.2)", width: 1, close: true, dash: [5, 4] });

      /* 单位正方形 → 平行四边形 */
      const para = [[0, 0], p, [p[0] + q[0], p[1] + q[1]], q];
      L.poly(ctx, [[0, 0], [1, 0], [1, 1], [0, 1]].map((t) => [cam.X(t[0]), cam.Y(t[1])]), {
        stroke: "rgba(22,25,21,0.2)",
        width: 1,
        dash: [4, 4],
      });
      L.poly(ctx, para.map((t) => [cam.X(t[0]), cam.Y(t[1])]), {
        fill: d < 0 ? "rgba(169,59,30,0.10)" : "rgba(14,107,87,0.12)",
        stroke: d < 0 ? "rgba(169,59,30,0.8)" : "rgba(14,107,87,0.85)",
        width: 1.6,
        close: true,
      });

      /* 朝向弧 */
      const a1 = Math.atan2(p[1], p[0]);
      const a2 = Math.atan2(q[1], q[0]);
      const R = 0.52 * px;
      const ox = cam.X(0);
      const oy = cam.Y(0);
      ctx.beginPath();
      ctx.arc(ox, oy, R, -a2, -a1, d < 0);
      L.stroke(ctx, d < 0 ? "rgba(169,59,30,0.55)" : "rgba(14,107,87,0.55)", 1.4, [3, 3]);
      ctx.stroke();

      L.arrow(ctx, ox, oy, cam.X(p[0]), cam.Y(p[1]), d < 0 ? "rgba(169,59,30,0.9)" : "rgba(14,107,87,0.9)", 2);
      L.arrow(ctx, ox, oy, cam.X(q[0]), cam.Y(q[1]), "rgba(22,25,21,0.62)", 1.8);
      handleAt(ctx, cam, p, d < 0 ? C.brick : C.jade);
      handleAt(ctx, cam, q, C.ink2);
      L.dot(ctx, ox, oy, 2.6, C.ink);

      const cx = cam.X((p[0] + q[0]) / 2);
      const cy = cam.Y((p[1] + q[1]) / 2);
      L.text(ctx, "面积 " + fmt(area, 2), cx, cy, { font: L.MONO, color: C.ink2 });

      setOut(
        outEl,
        "det " + fmt(d, 2) + (area < 0.02 ? " · 压成一条线" : d < 0 ? " · 朝向翻转" : " · 朝向不变")
      );
    }

    L.drag(canvas, {
      down(pt) {
        if (!view) return false;
        dragIdx = nearest(pt, view, [p, q], 28);
        return dragIdx >= 0;
      },
      move(pt, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        const x = clamp(view.wx(pt.x), -3.2, 3.2);
        const y = clamp(view.wy(pt.y), -3.2, 3.2);
        if (dragIdx === 0) p = [x, y];
        else q = [x, y];
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    const PRESET = {
      unit: [[1, 0], [0, 1]],
      shear: [[1.4, 0.2], [0.1, 1.2]],
      stretch: [[2.1, 0], [0, 0.6]],
      collapse: [[1.3, 0.5], [0.65, 0.25]],
      flip: [[1.2, 0.3], [0.4, -1.1]],
    };

    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tgt = PRESET[btn.dataset.preset];
        const s1 = p.slice();
        const s2 = q.slice();
        stopTw(canvas);
        L.tween(canvas, 420, (t) => {
          p = [L.lerp(s1[0], tgt[0][0], t), L.lerp(s1[1], tgt[0][1], t)];
          q = [L.lerp(s2[0], tgt[1][0], t), L.lerp(s2[1], tgt[1][1], t)];
          draw();
        });
      });
    });

    L.onResize(draw);
    draw();
  }

  /* ==================================================================
     5 · 特征向量
     ================================================================== */
  function eigenSpectrum(A) {
    const a = A[0];
    const b = A[1];
    const c = A[2];
    const d = A[3];
    const tr = a + d;
    const dt = a * d - b * c;
    const disc = tr * tr - 4 * dt;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const l1 = (tr + s) / 2;
      const l2 = (tr - s) / 2;
      return { real: true, l1, l2, v1: eigvec(A, l1), v2: eigvec(A, l2) };
    }
    return { real: false, re: tr / 2, im: Math.sqrt(-disc) / 2 };
  }

  function eigvec(A, l) {
    const a = A[0];
    const b = A[1];
    const c = A[2];
    const d = A[3];
    let x = b;
    let y = l - a;
    if (Math.hypot(x, y) < 1e-9) {
      x = l - d;
      y = c;
    }
    if (Math.hypot(x, y) < 1e-9) {
      x = 1;
      y = 0;
    }
    const n = Math.hypot(x, y);
    return [x / n, y / n];
  }

  function eigenWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const inputs = Array.prototype.slice.call(fig.querySelectorAll(".numin"));
    const nSlider = fig.querySelector('[data-k="n"]');
    const nOut = nSlider.parentElement.querySelector("output");
    const playBtn = fig.querySelector('[data-act="play"]');

    let A = inputs.map((el) => parseFloat(el.value) || 0);
    let v0 = [1, 0.45];
    let n = 6;
    let view = null;
    let dragIdx = -1;

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      /* 轨道 A^n v0：先算路径，再按它定视野 */
      let v = v0.slice();
      const path = [v.slice()];
      for (let i = 0; i < n; i++) {
        v = [A[0] * v[0] + A[1] * v[1], A[2] * v[0] + A[3] * v[1]];
        path.push(v.slice());
        if (Math.hypot(v[0], v[1]) > 60) break;
      }
      let maxLen = 1.7;
      path.forEach((q) => {
        maxLen = Math.max(maxLen, Math.hypot(q[0], q[1]));
      });
      const base = Math.min(w, h) / 7.4;
      const zoom = Math.min(1.85, Math.max(1, Math.sqrt(maxLen / 3.4)));
      const px = base / zoom;
      const cam = L.camera(w, h, px, 0.5, 0.5);
      view = cam;

      L.grid(ctx, cam, w, h);

      /* 单位圆的像 */
      const ell = [];
      for (let i = 0; i < 56; i++) {
        const t = (i / 56) * Math.PI * 2;
        const u = L.apply(A, Math.cos(t), Math.sin(t));
        ell.push([cam.X(u[0]), cam.Y(u[1])]);
      }
      L.poly(ctx, ell, { stroke: "rgba(22,25,21,0.26)", width: 1, close: true });

      const sp = eigenSpectrum(A);

      if (sp.real) {
        [sp.v1, sp.v2].forEach((vec, i) => {
          if (i === 1 && Math.hypot(vec[0] - sp.v1[0], vec[1] - sp.v1[1]) < 1e-6) return;
          const k = 6;
          L.line(
            ctx,
            cam.X(-vec[0] * k),
            cam.Y(-vec[1] * k),
            cam.X(vec[0] * k),
            cam.Y(vec[1] * k),
            "rgba(14,107,87,0.3)",
            1,
            [6, 5]
          );
        });
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        L.line(
          ctx,
          cam.X(a[0]),
          cam.Y(a[1]),
          cam.X(b[0]),
          cam.Y(b[1]),
          "rgba(14,107,87," + (0.18 + 0.5 * (i / path.length)) + ")",
          1.4
        );
        L.dot(ctx, cam.X(b[0]), cam.Y(b[1]), 2.6, "rgba(14,107,87,0.75)");
      }
      const last = path[path.length - 1];
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(last[0]), cam.Y(last[1]), C.jade, 2.1);
      ctx.restore();

      handleAt(ctx, cam, v0, C.ink2);
      L.dot(ctx, cam.X(0), cam.Y(0), 2.6, C.ink);

      const lastLen = Math.hypot(last[0], last[1]);
      if (sp.real) {
        setOut(
          outEl,
          "λ₁ " + fmt(sp.l1, 2) + " · λ₂ " + fmt(sp.l2, 2) + " · n " + (path.length - 1) + " · |v| " + fmt(lastLen, 2)
        );
      } else {
        const mag = Math.hypot(sp.re, sp.im);
        const ang = (Math.atan2(sp.im, sp.re) * 180) / Math.PI;
        setOut(
          outEl,
          "复特征值 " + fmt(sp.re, 2) + " ± " + fmt(sp.im, 2) + "i · 每步转 " + fmt(ang, 0) + "° · 长度 ×" + fmt(mag, 2)
        );
      }
    }

    inputs.forEach((el) =>
      el.addEventListener("input", () => {
        A = inputs.map((inp) => {
          const v = parseFloat(inp.value);
          return isFinite(v) ? v : 0;
        });
        draw();
      })
    );

    nSlider.addEventListener("input", () => {
      n = parseInt(nSlider.value, 10);
      nOut.textContent = String(n);
      draw();
    });

    playBtn.addEventListener("click", () => {
      const from = 0;
      const to = parseInt(nSlider.value, 10) || 8;
      nSlider.value = from;
      stopTw(canvas);
      L.tween(canvas, 900, (t) => {
        const k = Math.round(L.lerp(from, to, t));
        nSlider.value = k;
        n = k;
        nOut.textContent = String(k);
        draw();
      });
    });

    L.drag(canvas, {
      down(pt) {
        if (!view) return false;
        dragIdx = nearest(pt, view, [v0], 26);
        return dragIdx >= 0;
      },
      move(pt, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        v0 = [clamp(view.wx(pt.x), -3.2, 3.2), clamp(view.wy(pt.y), -3.2, 3.2)];
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    L.onResize(draw);
    draw();
  }

  /* ==================================================================
     6a · 正交投影
     ================================================================== */
  function projWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    let aV = [1.75, 0.35];
    let bV = [0.75, 1.75];
    let view = null;
    let dragIdx = -1;

    function geom() {
      const n2 = aV[0] * aV[0] + aV[1] * aV[1];
      const c = n2 > 1e-9 ? (aV[0] * bV[0] + aV[1] * bV[1]) / n2 : 0;
      return { c, P: [c * aV[0], c * aV[1]], n2 };
    }

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = Math.min(w, h) / 6.8;
      const cam = L.camera(w, h, px, 0.5, 0.52);
      view = cam;
      L.grid(ctx, cam, w, h);

      const g = geom();

      /* 方向向量所在的整条直线 */
      const u = Math.hypot(aV[0], aV[1]) || 1;
      const dir = [aV[0] / u, aV[1] / u];
      L.line(ctx, cam.X(-dir[0] * 9), cam.Y(-dir[1] * 9), cam.X(dir[0] * 9), cam.Y(dir[1] * 9), "rgba(14,107,87,0.25)", 1.2, [6, 5]);

      /* 残差 */
      L.line(ctx, cam.X(g.P[0]), cam.Y(g.P[1]), cam.X(bV[0]), cam.Y(bV[1]), "rgba(169,59,30,0.55)", 1.4, [4, 4]);

      /* 直角标记 */
      const nx = bV[0] - g.P[0];
      const ny = bV[1] - g.P[1];
      const nn = Math.hypot(nx, ny) || 1;
      const s = 0.22;
      const e1x = dir[0] * s * Math.sign(g.c || 1);
      const e1y = dir[1] * s * Math.sign(g.c || 1);
      const e2x = (nx / nn) * s;
      const e2y = (ny / nn) * s;
      L.poly(
        ctx,
        [
          [cam.X(g.P[0] + e1x), cam.Y(g.P[1] + e1y)],
          [cam.X(g.P[0] + e1x + e2x), cam.Y(g.P[1] + e1y + e2y)],
          [cam.X(g.P[0] + e2x), cam.Y(g.P[1] + e2y)],
        ],
        { stroke: "rgba(22,25,21,0.3)", width: 1 }
      );

      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(aV[0]), cam.Y(aV[1]), "rgba(22,25,21,0.62)", 1.8);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(bV[0]), cam.Y(bV[1]), C.brick, 1.8);
      L.arrow(ctx, cam.X(0), cam.Y(0), cam.X(g.P[0]), cam.Y(g.P[1]), C.jade, 2.2);

      handleAt(ctx, cam, aV, C.ink2, 4.5);
      handleAt(ctx, cam, bV, C.brick, 4.5);
      subLabel(ctx, "a", "", cam.X(aV[0]) + 11, cam.Y(aV[1]) - 13, C.ink2, 14);
      subLabel(ctx, "b", "", cam.X(bV[0]) + 11, cam.Y(bV[1]) - 13, C.brick, 14);
      subLabel(ctx, "p", "", cam.X(g.P[0]) + 10, cam.Y(g.P[1]) + 14, C.jade, 13);

      const res = Math.hypot(bV[0] - g.P[0], bV[1] - g.P[1]);
      setOut(outEl, "a·b " + fmt(aV[0] * bV[0] + aV[1] * bV[1], 2) + " · |a|² " + fmt(g.n2, 2) + " · 残差 " + fmt(res, 2));
    }

    L.drag(canvas, {
      down(pt) {
        if (!view) return false;
        dragIdx = nearest(pt, view, [aV, bV], 28);
        return dragIdx >= 0;
      },
      move(pt, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        const x = clamp(view.wx(pt.x), -3, 3);
        const y = clamp(view.wy(pt.y), -3, 3);
        if (dragIdx === 0) aV = [x, y];
        else bV = [x, y];
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    L.onResize(draw);
    draw();
  }

  /* ==================================================================
     6b · 最小二乘
     ================================================================== */
  function lsWidget(fig) {
    const canvas = fig.querySelector("canvas");
    const outEl = fig.querySelector("[data-out]");
    const sm = fig.querySelector('[data-k="m"]');
    const sk = fig.querySelector('[data-k="k"]');
    const om = sm.parentElement.querySelector("output");
    const ok = sk.parentElement.querySelector("output");
    const fitBtn = fig.querySelector('[data-act="fit"]');

    const xs = [1, 2, 3, 4, 5, 6];
    let ys = [1.35, 2.25, 1.65, 3.35, 2.5, 3.95];
    let m = 0.35;
    let k = 0.9;
    let view = null;
    let dragIdx = -1;

    function sse(mm, kk) {
      let s = 0;
      for (let i = 0; i < xs.length; i++) {
        const e = ys[i] - (mm * xs[i] + kk);
        s += e * e;
      }
      return s;
    }

    function optimal() {
      const nn = xs.length;
      let Sx = 0;
      let Sy = 0;
      let Sxx = 0;
      let Sxy = 0;
      for (let i = 0; i < nn; i++) {
        Sx += xs[i];
        Sy += ys[i];
        Sxx += xs[i] * xs[i];
        Sxy += xs[i] * ys[i];
      }
      const det = nn * Sxx - Sx * Sx;
      if (Math.abs(det) < 1e-9) return { m: 0, k: Sy / nn };
      return {
        m: (nn * Sxy - Sx * Sy) / det,
        k: (Sxx * Sy - Sx * Sxy) / det,
      };
    }

    function draw() {
      const f = L.fit(canvas);
      const ctx = f.ctx;
      const w = f.w;
      const h = f.h;
      const px = Math.min(w / 8.2, h / 5.6);
      const cam = L.camera(w, h, px, 0.09, 0.9);
      view = cam;

      L.grid(ctx, cam, w, h, { color: "rgba(22,25,21,0.14)", axis: "rgba(22,25,21,0.3)" });

      for (let i = 1; i <= 6; i++) {
        L.text(ctx, String(i), cam.X(i), cam.Y(0) + 12, { font: L.MONO, color: C.ink3 });
      }
      for (let j = 1; j <= 4; j++) {
        L.text(ctx, String(j), cam.X(0) - 12, cam.Y(j), { font: L.MONO, color: C.ink3 });
      }

      /* 残差 */
      for (let i = 0; i < xs.length; i++) {
        const yh = m * xs[i] + k;
        L.line(ctx, cam.X(xs[i]), cam.Y(ys[i]), cam.X(xs[i]), cam.Y(yh), "rgba(169,59,30,0.35)", 1.1, [3, 3]);
      }

      /* 拟合直线 */
      L.line(ctx, cam.X(0.6), cam.Y(m * 0.6 + k), cam.X(6.6), cam.Y(m * 6.6 + k), C.jade, 2);

      /* 数据点 */
      for (let i = 0; i < xs.length; i++) {
        L.dot(ctx, cam.X(xs[i]), cam.Y(ys[i]), 4.2, C.brick, C.plate);
      }

      setOut(outEl, "m " + fmt(m, 2) + " · k " + fmt(k, 2) + " · SSE " + fmt(sse(m, k), 2));
    }

    function sync() {
      m = parseFloat(sm.value);
      k = parseFloat(sk.value);
      om.textContent = m.toFixed(2);
      ok.textContent = k.toFixed(2);
      draw();
    }

    sm.addEventListener("input", sync);
    sk.addEventListener("input", sync);

    fitBtn.addEventListener("click", () => {
      const best = optimal();
      const a1 = parseFloat(sm.value);
      const a2 = parseFloat(sk.value);
      stopTw(canvas);
      L.tween(canvas, 520, (t) => {
        sm.value = L.lerp(a1, best.m, t);
        sk.value = L.lerp(a2, best.k, t);
        sync();
      });
    });

    L.drag(canvas, {
      down(pt) {
        if (!view) return false;
        dragIdx = -1;
        let bd = 18;
        xs.forEach((x, i) => {
          const d = Math.hypot(view.X(x) - pt.x, view.Y(ys[i]) - pt.y);
          if (d < bd) {
            bd = d;
            dragIdx = i;
          }
        });
        return dragIdx >= 0;
      },
      move(pt, e, active) {
        if (!active || dragIdx < 0 || !view) return;
        ys[dragIdx] = clamp(view.wy(pt.y), 0, 5.2);
        draw();
      },
      up() {
        dragIdx = -1;
      },
    });

    L.onResize(draw);
    sync();
  }

  /* ================================================================== */

  const MAP = {
    span: spanWidget,
    transform: transformWidget,
    system: systemWidget,
    det: detWidget,
    eigen: eigenWidget,
    proj: projWidget,
    ls: lsWidget,
  };

  hero();
  Array.prototype.forEach.call(document.querySelectorAll("[data-widget]"), (fig) => {
    const fn = MAP[fig.getAttribute("data-widget")];
    if (fn) fn(fig);
  });
})();
