/* scene3d.js — 软件 3D 渲染器：透视相机、按深度排序的多边形、平面着色 + 雾化。
   网格由「基 B」生成：换基就是换格子，空间里的点不动。 */
window.SCENE = (function () {
  "use strict";

  const PAPER = [237, 238, 231];
  const JADE = [14, 107, 87];
  const BRICK = [169, 59, 30];
  const INDIGO = [58, 74, 140];
  const INK = [22, 25, 21];

  const cam = {
    yaw: -0.92,
    pitch: 0.5,
    dist: 9.7,
    target: [0, 0, -0.15],
  };

  /* ------------------------------------------------------------ 颜色 */

  const hex = (c) => "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";

  function mixColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  const LEVELS = 34;
  const FOGS = 14;

  function ramp(base) {
    const light = mixColor(PAPER, base, 0.28);
    const dark = mixColor(base, [0, 0, 0], 0.3);
    const out = [];
    for (let i = 0; i < LEVELS; i++) {
      const t = Math.pow(i / (LEVELS - 1), 0.85);
      const c = mixColor(light, dark, t);
      for (let f = 0; f < FOGS; f++) {
        out.push(hex(mixColor(c, PAPER, (f / (FOGS - 1)) * 0.5)));
      }
    }
    return out;
  }

  const PAL = [ramp(JADE), ramp(BRICK), ramp(INDIGO)];
  const PLANE_STYLES = [
    { fill: "rgba(14,107,87,0.10)", stroke: "rgba(14,107,87,0.55)" },
    { fill: "rgba(169,59,30,0.10)", stroke: "rgba(169,59,30,0.55)" },
    { fill: "rgba(58,74,140,0.10)", stroke: "rgba(58,74,140,0.55)" },
  ];

  /* ------------------------------------------------------------ 向量 */

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function unit(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  const LIGHT = unit([-0.45, -0.62, 0.78]);
  const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  /* ------------------------------------------------------------ 相机 */

  let W = 1;
  let H = 1;
  let EYE = [0, 0, 0];
  let RIGHT = [1, 0, 0];
  let UP = [0, 1, 0];
  let FWD = [0, 0, 1];
  let FOCAL = 1;

  function updateCamera(w, h) {
    W = w;
    H = h;
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    EYE = [
      cam.target[0] + cam.dist * cp * Math.cos(cam.yaw),
      cam.target[1] + cam.dist * cp * Math.sin(cam.yaw),
      cam.target[2] + cam.dist * sp,
    ];
    FWD = unit(sub(cam.target, EYE));
    let r = cross(FWD, [0, 0, 1]);
    if (Math.hypot(r[0], r[1], r[2]) < 1e-6) r = [1, 0, 0];
    RIGHT = unit(r);
    UP = cross(RIGHT, FWD);
    FOCAL = Math.min(w, h) * 1.02;
  }

  function project(p) {
    const d = sub(p, EYE);
    const z = dot(d, FWD);
    if (z < 0.08) return null;
    return [W / 2 + (FOCAL * dot(d, RIGHT)) / z, H / 2 - (FOCAL * dot(d, UP)) / z, z];
  }

  /* ------------------------------------------------------------ 工具 */

  function applyM(M, p) {
    return [
      M[0] * p[0] + M[1] * p[1] + M[2] * p[2],
      M[3] * p[0] + M[4] * p[1] + M[5] * p[2],
      M[6] * p[0] + M[7] * p[1] + M[8] * p[2],
    ];
  }

  function addLine(items, a, b, color, width, head, dash) {
    const pa = project(a);
    const pb = project(b);
    if (!pa || !pb) return;
    items.push({
      k: 1,
      a: pa,
      b: pb,
      color: color,
      width: width,
      head: !!head,
      dash: dash || null,
      depth: (pa[2] + pb[2]) / 2,
    });
  }

  function lineItem(items, a, b, M, color, width, head, dash) {
    addLine(items, applyM(M, a), applyM(M, b), color, width, head, dash);
  }

  function drawSub(ctx, base, subText, x, y, color, size) {
    ctx.font = "italic " + size + 'px "Charter", Georgia, serif';
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(base, x, y);
    const w = ctx.measureText(base).width;
    ctx.font = size * 0.7 + 'px "Charter", Georgia, serif';
    ctx.fillText(subText, x + w + 1, y + size * 0.28);
  }

  /* ------------------------------------------------------------ 基 */

  function basisColumns(B) {
    return [
      [B[0], B[3], B[6]],
      [B[1], B[4], B[7]],
      [B[2], B[5], B[8]],
    ];
  }

  const GRID_UNITS = 3;
  const GRID_SUB = 4;

  function drawLattice(ctx, B) {
    const u = basisColumns(B);
    const n = GRID_UNITS * GRID_SUB;
    ctx.beginPath();
    for (let k = -n; k <= n; k++) {
      const t = k / GRID_SUB;
      /* 沿 u1 的线 */
      const a1 = project([t * u[1][0], t * u[1][1], t * u[1][2]]);
      const b1 = project([
        t * u[1][0] + GRID_UNITS * u[0][0],
        t * u[1][1] + GRID_UNITS * u[0][1],
        t * u[1][2] + GRID_UNITS * u[0][2],
      ]);
      const c1 = project([
        t * u[1][0] - GRID_UNITS * u[0][0],
        t * u[1][1] - GRID_UNITS * u[0][1],
        t * u[1][2] - GRID_UNITS * u[0][2],
      ]);
      if (a1 && b1 && c1) {
        ctx.moveTo(c1[0], c1[1]);
        ctx.lineTo(b1[0], b1[1]);
      }
      /* 沿 u2 的线 */
      const a2 = project([t * u[0][0], t * u[0][1], t * u[0][2]]);
      const b2 = project([
        t * u[0][0] + GRID_UNITS * u[1][0],
        t * u[0][1] + GRID_UNITS * u[1][1],
        t * u[0][2] + GRID_UNITS * u[1][2],
      ]);
      const c2 = project([
        t * u[0][0] - GRID_UNITS * u[1][0],
        t * u[0][1] - GRID_UNITS * u[1][1],
        t * u[0][2] - GRID_UNITS * u[1][2],
      ]);
      if (a2 && b2 && c2) {
        ctx.moveTo(c2[0], c2[1]);
        ctx.lineTo(b2[0], b2[1]);
      }
    }
    ctx.strokeStyle = "rgba(22,25,21,0.11)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* 两条主轴线 */
    ctx.beginPath();
    const A = project([-GRID_UNITS * u[0][0], -GRID_UNITS * u[0][1], -GRID_UNITS * u[0][2]]);
    const Bp = project([GRID_UNITS * u[0][0], GRID_UNITS * u[0][1], GRID_UNITS * u[0][2]]);
    const C = project([-GRID_UNITS * u[1][0], -GRID_UNITS * u[1][1], -GRID_UNITS * u[1][2]]);
    const Dp = project([GRID_UNITS * u[1][0], GRID_UNITS * u[1][1], GRID_UNITS * u[1][2]]);
    if (A && Bp) {
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(Bp[0], Bp[1]);
    }
    if (C && Dp) {
      ctx.moveTo(C[0], C[1]);
      ctx.lineTo(Dp[0], Dp[1]);
    }
    ctx.strokeStyle = "rgba(22,25,21,0.22)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  /* ------------------------------------------------------------ 画 */

  function render(canvas, model, M, opts) {
    opts = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = hex(PAPER);
    ctx.fillRect(0, 0, w, h);

    updateCamera(w, h);

    const B = opts.basis || IDENT;
    const basis = basisColumns(B);

    /* 背景层：基生成的格 */
    drawLattice(ctx, B);

    const items = [];

    /* 曲面 */
    const quads = model.quads || [];
    for (let i = 0; i < quads.length; i++) {
      const q = quads[i];
      const a = applyM(M, q.p[0]);
      const b = applyM(M, q.p[1]);
      const c = applyM(M, q.p[2]);
      const d = applyM(M, q.p[3]);
      const pa = project(a);
      if (!pa) continue;
      const pb = project(b);
      if (!pb) continue;
      const pc = project(c);
      if (!pc) continue;
      const pd = project(d);
      if (!pd) continue;
      const n = cross(sub(b, a), sub(c, a));
      const nn = Math.hypot(n[0], n[1], n[2]) || 1;
      const shade = 0.18 + 0.82 * Math.pow(Math.abs(dot(n, LIGHT)) / nn, 0.75);
      const depth = (pa[2] + pb[2] + pc[2] + pd[2]) / 4;
      const fog = Math.max(0, Math.min(FOGS - 1, Math.round(((depth - 6.5) / 9) * (FOGS - 1))));
      const level = Math.max(0, Math.min(LEVELS - 1, Math.round(shade * (LEVELS - 1))));
      const cx = (pa[0] + pb[0] + pc[0] + pd[0]) / 4;
      const cy = (pa[1] + pb[1] + pc[1] + pd[1]) / 4;
      const pts = [pa, pb, pc, pd].map(function (q2) {
        const dx = q2[0] - cx;
        const dy = q2[1] - cy;
        const dd = Math.hypot(dx, dy) || 1;
        const k = (dd + 0.55) / dd;
        return [cx + dx * k, cy + dy * k];
      });
      items.push({
        k: 0,
        pts: pts,
        fill: PAL[q.color == null ? 0 : q.color % 3][level * FOGS + fog],
        depth: depth,
      });
    }

    /* 平面 */
    const planes = model.planes || [];
    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i];
      const pts = [];
      let ok = true;
      let depth = 0;
      for (let j = 0; j < pl.poly.length; j++) {
        const q = project(applyM(M, pl.poly[j]));
        if (!q) {
          ok = false;
          break;
        }
        pts.push(q);
        depth += q[2];
      }
      if (!ok || pts.length < 3) continue;
      const st = PLANE_STYLES[(pl.color || 0) % 3];
      items.push({
        k: 2,
        pts: pts,
        fill: st.fill,
        stroke: st.stroke,
        depth: depth / pts.length,
      });
    }

    /* 基胞：u1, u2, u3 张成的平行六面体（标准基时不画，省得跟格子重复） */
    const identity = B.every(function (v, i) { return Math.abs(v - IDENT[i]) < 1e-9; });
    const verts = [];
    for (let m = 0; m < 8; m++) {
      verts.push([
        (m & 1 ? basis[0][0] : 0) + (m & 2 ? basis[1][0] : 0) + (m & 4 ? basis[2][0] : 0),
        (m & 1 ? basis[0][1] : 0) + (m & 2 ? basis[1][1] : 0) + (m & 4 ? basis[2][1] : 0),
        (m & 1 ? basis[0][2] : 0) + (m & 2 ? basis[1][2] : 0) + (m & 4 ? basis[2][2] : 0),
      ]);
    }
    const EDGES = [
      [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
    ];
    if (!identity) {
      for (let i = 0; i < EDGES.length; i++) {
        addLine(items, verts[EDGES[i][0]], verts[EDGES[i][1]], "rgba(22,25,21,0.22)", 1);
      }
    }

    /* 单位立方体被 A 搬到哪里 + A 的三列 */
    if (opts.frame) {
      const cv = [
        [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
      ];
      const ce = [
        [0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 4], [2, 6], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7],
      ];
      for (let i = 0; i < ce.length; i++) {
        lineItem(items, cv[ce[i][0]], cv[ce[i][1]], M, "rgba(22,25,21,0.26)", 1);
      }
      const cols = [
        [M[0], M[3], M[6]],
        [M[1], M[4], M[7]],
        [M[2], M[5], M[8]],
      ];
      const colColors = ["rgba(14,107,87,0.95)", "rgba(22,25,21,0.7)", "rgba(169,59,30,0.85)"];
      for (let i = 0; i < 3; i++) {
        const c = cols[i];
        if (Math.hypot(c[0], c[1], c[2]) < 0.02) continue;
        addLine(items, [0, 0, 0], c, colColors[i], 2.2, true);
      }
    }

    /* 基向量：虚线，标 u₁ u₂ u₃ */
    const uColors = ["rgba(14,107,87,0.75)", "rgba(22,25,21,0.55)", "rgba(169,59,30,0.7)"];
    for (let i = 0; i < 3; i++) {
      const u = basis[i];
      if (Math.hypot(u[0], u[1], u[2]) < 0.02) continue;
      addLine(items, [0, 0, 0], u, uColors[i], 1.6, true, [5, 4]);
    }

    /* 向量 */
    const vecs = model.vectors || [];
    for (let i = 0; i < vecs.length; i++) {
      const v = vecs[i];
      const tip = applyM(M, v.p);
      const parts = v.parts || [];
      for (let j = 0; j < parts.length; j++) {
        addLine(items, [0, 0, 0], applyM(M, parts[j]), "rgba(22,25,21,0.34)", 1.3, true, [4, 3]);
      }
      if (parts.length === 2 && v.op === "sum") {
        addLine(items, applyM(M, parts[0]), tip, "rgba(22,25,21,0.24)", 1, false, [4, 4]);
        addLine(items, applyM(M, parts[1]), tip, "rgba(22,25,21,0.24)", 1, false, [4, 4]);
      }
      addLine(items, [0, 0, 0], tip, "rgba(169,59,30,0.92)", 2.4, true);
    }

    items.sort((a, b) => b.depth - a.depth);

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.k === 0) {
        ctx.beginPath();
        ctx.moveTo(it.pts[0][0], it.pts[0][1]);
        ctx.lineTo(it.pts[1][0], it.pts[1][1]);
        ctx.lineTo(it.pts[2][0], it.pts[2][1]);
        ctx.lineTo(it.pts[3][0], it.pts[3][1]);
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
      } else if (it.k === 1) {
        ctx.beginPath();
        ctx.moveTo(it.a[0], it.a[1]);
        ctx.lineTo(it.b[0], it.b[1]);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = it.width;
        ctx.setLineDash(it.dash || []);
        ctx.stroke();
        ctx.setLineDash([]);
        if (it.head) {
          const ang = Math.atan2(it.b[1] - it.a[1], it.b[0] - it.a[0]);
          const len = Math.min(11, Math.max(6, Math.hypot(it.b[0] - it.a[0], it.b[1] - it.a[1]) * 0.2));
          ctx.beginPath();
          ctx.moveTo(it.b[0], it.b[1]);
          ctx.lineTo(it.b[0] - len * Math.cos(ang - 0.42), it.b[1] - len * Math.sin(ang - 0.42));
          ctx.moveTo(it.b[0], it.b[1]);
          ctx.lineTo(it.b[0] - len * Math.cos(ang + 0.42), it.b[1] - len * Math.sin(ang + 0.42));
          ctx.stroke();
        }
      } else if (it.k === 2) {
        ctx.beginPath();
        ctx.moveTo(it.pts[0][0], it.pts[0][1]);
        for (let j = 1; j < it.pts.length; j++) ctx.lineTo(it.pts[j][0], it.pts[j][1]);
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        ctx.strokeStyle = it.stroke;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    /* 平面交线 / 交点 */
    const extraLines = model.lines || [];
    for (let i = 0; i < extraLines.length; i++) {
      const l = extraLines[i];
      const pa = project(applyM(M, l.a));
      const pb = project(applyM(M, l.b));
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.setLineDash(l.dash || [5, 4]);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width || 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const extraPts = model.points || [];
    for (let i = 0; i < extraPts.length; i++) {
      const q = project(applyM(M, extraPts[i].p));
      if (!q) continue;
      ctx.beginPath();
      ctx.arc(q[0], q[1], 4.2, 0, Math.PI * 2);
      ctx.fillStyle = extraPts[i].color || "rgba(22,25,21,0.9)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(q[0], q[1], 4.2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(248,249,245,0.95)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      if (model.points.length === 1 && model.planes.length === 3) {
        ctx.font = '12px "Avenir Next", "PingFang SC", sans-serif';
        ctx.fillStyle = "rgba(22,25,21,0.62)";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("三面交于一点 · solution", q[0] + 11, q[1] - 11);
      }
    }

    /* 标注：基向量名、向量名 */
    for (let i = 0; i < 3; i++) {
      const u = basis[i];
      if (Math.hypot(u[0], u[1], u[2]) < 0.02) continue;
      const q = project(u);
      if (!q) continue;
      drawSub(ctx, "u", String(i + 1), q[0] + 8, q[1] - 10, "rgba(22,25,21,0.5)", 12);
    }
    for (let i = 0; i < vecs.length; i++) {
      const v = vecs[i];
      if (!v.name) continue;
      const q = project(applyM(M, v.p));
      if (!q) continue;
      ctx.font = 'italic 13px "Charter", Georgia, serif';
      ctx.fillStyle = "rgba(169,59,30,0.85)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(v.name, q[0] + 9, q[1] - 12);
    }
  }

  /* ------------------------------------------------------------ 交互 */

  function orbit(dx, dy) {
    cam.yaw -= dx * 0.0045;
    cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch + dy * 0.0045));
  }

  function zoom(factor) {
    cam.dist = Math.max(2.6, Math.min(22, cam.dist * factor));
  }

  function reset() {
    cam.yaw = -0.92;
    cam.pitch = 0.5;
    cam.dist = 9.7;
    cam.target = [0, 0, -0.15];
  }

  return {
    cam: cam,
    render: render,
    orbit: orbit,
    zoom: zoom,
    reset: reset,
    applyM: applyM,
    PAPER: PAPER,
  };
})();
