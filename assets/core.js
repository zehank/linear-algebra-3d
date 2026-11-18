/* core.js — 画布、相机、矩阵工具。所有图形模块共用这一份。 */
(function () {
  "use strict";

  const rootStyle = getComputedStyle(document.documentElement);
  const V = (n) => rootStyle.getPropertyValue(n).trim();
  const C = {
    paper: V("--paper"),
    plate: V("--plate"),
    ink: V("--ink"),
    ink2: V("--ink-2"),
    ink3: V("--ink-3"),
    jade: V("--jade"),
    brick: V("--brick"),
    line: V("--line"),
    line2: V("--line-2"),
  };

  const MONO = '11.5px "SF Mono", ui-monospace, Menlo, monospace';
  const SANS = '12px "Avenir Next", "PingFang SC", -apple-system, sans-serif';
  const MATH = 'italic 13px Charter, Georgia, serif';

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- 画布 */

  function fit(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function camera(w, h, pxPerUnit, ox = 0.5, oy = 0.5) {
    const ax = ox * w;
    const ay = oy * h;
    return {
      px: pxPerUnit,
      ox: ax,
      oy: ay,
      X: (x) => ax + x * pxPerUnit,
      Y: (y) => ay - y * pxPerUnit,
      wx: (sx) => (sx - ax) / pxPerUnit,
      wy: (sy) => (ay - sy) / pxPerUnit,
    };
  }

  /* ---------------------------------------------------------------- 画法 */

  function stroke(ctx, color, width, dash) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width == null ? 1 : width;
    ctx.setLineDash(dash || []);
  }

  function line(ctx, x1, y1, x2, y2, color, width, dash) {
    stroke(ctx, color, width, dash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function arrow(ctx, x1, y1, x2, y2, color, width, head) {
    const h = head == null ? 8 : head;
    stroke(ctx, color, width == null ? 1.6 : width, []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - 0.42), y2 - h * Math.sin(a - 0.42));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a + 0.42), y2 - h * Math.sin(a + 0.42));
    ctx.stroke();
  }

  function poly(ctx, pts, o) {
    o = o || {};
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (o.close) ctx.closePath();
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.stroke) {
      stroke(ctx, o.stroke, o.width == null ? 1.4 : o.width, o.dash);
      ctx.stroke();
    }
  }

  function dot(ctx, x, y, r, fill, ring) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (ring) {
      ctx.beginPath();
      ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
      stroke(ctx, ring, 1.4, []);
      ctx.stroke();
    }
  }

  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.font = o.font || SANS;
    ctx.fillStyle = o.color || C.ink3;
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.baseline || "middle";
    ctx.fillText(str, x, y);
  }

  function grid(ctx, cam, w, h, o) {
    o = o || {};
    const color = o.color || "rgba(22,25,21,0.16)";
    const axis = o.axis || "rgba(22,25,21,0.3)";
    const step = o.step || 1;
    const x0 = Math.floor(cam.wx(0) / step) * step;
    const x1 = Math.ceil(cam.wx(w) / step) * step;
    const y0 = Math.floor(cam.wy(h) / step) * step;
    const y1 = Math.ceil(cam.wy(0) / step) * step;
    stroke(ctx, color, 1, o.dash || []);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      const sx = cam.X(x);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = y0; y <= y1; y += step) {
      if (Math.abs(y) < 1e-9) continue;
      const sy = cam.Y(y);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
    if (o.axes !== false) {
      stroke(ctx, axis, 1, []);
      ctx.beginPath();
      ctx.moveTo(0, cam.Y(0));
      ctx.lineTo(w, cam.Y(0));
      ctx.moveTo(cam.X(0), 0);
      ctx.lineTo(cam.X(0), h);
      ctx.stroke();
    }
  }

  function triGrid(ctx, cam, w, h, M, o) {
    o = o || {};
    const color = o.color || "rgba(14,107,87,0.28)";
    const x0 = Math.floor(cam.wx(0)) - 2;
    const x1 = Math.ceil(cam.wx(w)) + 2;
    const y0 = Math.floor(cam.wy(h)) - 2;
    const y1 = Math.ceil(cam.wy(0)) + 2;
    const span = Math.max(x1 - x0, y1 - y0) * 1.6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    stroke(ctx, color, 1, o.dash || []);
    ctx.beginPath();
    for (let k = -span; k <= span; k++) {
      let a = apply(M, k, -span);
      let b = apply(M, k, span);
      ctx.moveTo(cam.X(a[0]), cam.Y(a[1]));
      ctx.lineTo(cam.X(b[0]), cam.Y(b[1]));
      a = apply(M, -span, k);
      b = apply(M, span, k);
      ctx.moveTo(cam.X(a[0]), cam.Y(a[1]));
      ctx.lineTo(cam.X(b[0]), cam.Y(b[1]));
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------- 矩阵 */

  const apply = (M, x, y) => [M[0] * x + M[1] * y, M[2] * x + M[3] * y];
  const det = (M) => M[0] * M[3] - M[1] * M[2];
  const mul = (A, B) => [
    A[0] * B[0] + A[1] * B[2],
    A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2],
    A[2] * B[1] + A[3] * B[3],
  ];
  const mix = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t), lerp(A[3], B[3], t)];
  const ID = [1, 0, 0, 1];

  function fmt(x, d) {
    d = d == null ? 2 : d;
    if (!isFinite(x)) return "—";
    if (Math.abs(x) < Math.pow(10, -d) / 2) return "0";
    let s = x.toFixed(d);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }

  /* ---------------------------------------------------------------- 动画 */

  function tween(el, dur, onFrame) {
    if (el.__tw) cancelAnimationFrame(el.__tw);
    if (reduce) {
      onFrame(1);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      onFrame(easeOut(t));
      if (t < 1) el.__tw = requestAnimationFrame(step);
      else el.__tw = 0;
    };
    el.__tw = requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------- 交互 */

  function drag(canvas, handlers) {
    let active = -1;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("pointerdown", (e) => {
      const p = pos(e);
      if (handlers.down && handlers.down(p, e) === false) return;
      active = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("dragging");
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = pos(e);
      if (handlers.move) handlers.move(p, e, e.pointerId === active);
    });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = -1;
      canvas.classList.remove("dragging");
      if (handlers.up) handlers.up(e);
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }

  function onResize(fn) {
    let t = 0;
    const run = () => {
      clearTimeout(t);
      t = setTimeout(fn, 120);
    };
    window.addEventListener("resize", run);
    return run;
  }

  window.LA = {
    C,
    MONO,
    SANS,
    MATH,
    clamp,
    lerp,
    easeOut,
    reduce,
    fit,
    camera,
    stroke,
    line,
    arrow,
    poly,
    dot,
    text,
    grid,
    triGrid,
    apply,
    det,
    mul,
    mix,
    ID,
    fmt,
    tween,
    drag,
    onResize,
  };
})();
