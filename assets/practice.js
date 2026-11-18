/* practice.js — 出题器。每题都带一份可展开的解法。 */
window.PRACTICE = (function () {
  "use strict";

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const nn = (x) => String(x).replace("-", "−");
  const sub = (s) => String(s).replace(/-?\d+/g, (m) => nn(m));

  const mat = (rows) => {
    const cols = rows[0].length;
    return (
      '<span class="mat" style="--c:' +
      cols +
      '">' +
      rows
        .map((r) => r.map((v) => "<span>" + nn(v) + "</span>").join(""))
        .join("") +
      "</span>"
    );
  };
  const vec = (a) => mat(a.map((v) => [v]));

  const det2 = (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0];

  function randMat2(lo, hi) {
    return [
      [rnd(lo, hi), rnd(lo, hi)],
      [rnd(lo, hi), rnd(lo, hi)],
    ];
  }

  /* ---------------------------------------------------------------- 生成器 */

  const G = {};

  G.det2 = function () {
    let A;
    do {
      A = randMat2(-4, 4);
    } while (Math.abs(det2(A)) < 2 || det2(A) === 0);
    const d = det2(A);
    return {
      topic: "det",
      prompt: "求行列式 det(" + mat(A) + ")。",
      labels: ["det <var>A</var> ="],
      answers: [d],
      solution:
        "<p>二阶行列式：主对角线相乘，减去副对角线相乘。</p>" +
        "<p><span class=\"step\">det = " +
        nn(A[0][0]) +
        " × " +
        nn(A[1][1]) +
        " − " +
        nn(A[0][1]) +
        " × " +
        nn(A[1][0]) +
        " = " +
        nn(d) +
        "</span></p>" +
        "<p>|det| 是这张矩阵把面积放大的倍数；符号说明朝向有没有翻。</p>",
    };
  };

  G.det3 = function () {
    const A = [
      [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)],
      [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)],
      [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)],
    ];
    const a = A[0][0];
    const b = A[0][1];
    const c = A[0][2];
    const m1 = A[1][1] * A[2][2] - A[1][2] * A[2][1];
    const m2 = A[1][0] * A[2][2] - A[1][2] * A[2][0];
    const m3 = A[1][0] * A[2][1] - A[1][1] * A[2][0];
    const d = a * m1 - b * m2 + c * m3;
    return {
      topic: "det",
      prompt: "求行列式 det(" + mat(A) + ")。",
      labels: ["det <var>A</var> ="],
      answers: [d],
      solution:
        "<p>沿第一行展开：<span class=\"step\">det = a₁₁M₁₁ − a₁₂M₁₂ + a₁₃M₁₃</span>，正负号按 + − + 交替。</p>" +
        "<p><span class=\"step\">= " +
        nn(a) +
        " × (" +
        nn(m1) +
        ") − (" +
        nn(b) +
        ") × (" +
        nn(m2) +
        ") + (" +
        nn(c) +
        ") × (" +
        nn(m3) +
        ") = " +
        nn(d) +
        "</span></p>" +
        "<p>三阶行列式的绝对值是这个矩阵的像把体积放大的倍数。</p>",
    };
  };

  G.mv = function () {
    const A = randMat2(-3, 3);
    const x = [rnd(-2, 3), rnd(-2, 3)];
    const y = [A[0][0] * x[0] + A[0][1] * x[1], A[1][0] * x[0] + A[1][1] * x[1]];
    return {
      topic: "matrix",
      prompt: "计算 " + mat(A) + vec(x) + "。",
      labels: ["<var>y</var><sub>1</sub> =", "<var>y</var><sub>2</sub> ="],
      answers: y,
      solution:
        "<p>按列拼：<span class=\"step\">Ax = " +
        nn(x[0]) +
        " × 第一列 + " +
        nn(x[1]) +
        " × 第二列</span>。</p>" +
        "<p><span class=\"step\">第一行点乘 x： " +
        nn(A[0][0]) +
        "·" +
        nn(x[0]) +
        " + " +
        nn(A[0][1]) +
        "·" +
        nn(x[1]) +
        " = " +
        nn(y[0]) +
        "</span></p>" +
        "<p><span class=\"step\">第二行点乘 x： " +
        nn(A[1][0]) +
        "·" +
        nn(x[0]) +
        " + " +
        nn(A[1][1]) +
        "·" +
        nn(x[1]) +
        " = " +
        nn(y[1]) +
        "</span></p>",
    };
  };

  G.inverse = function () {
    let A;
    let d;
    let tries = 0;
    do {
      A = randMat2(-3, 3);
      d = det2(A);
      tries++;
    } while (Math.abs(d) !== 1 && tries < 500);
    if (Math.abs(d) !== 1) {
      A = [
        [2, 1],
        [1, 1],
      ];
      d = 1;
    }
    const inv = [
      [A[1][1] * d, -A[0][1] * d],
      [-A[1][0] * d, A[0][0] * d],
    ];
    return {
      topic: "matrix",
      prompt: "求逆矩阵 " + mat(A) + "⁻¹ 的四个元素。",
      labels: ["(1,1) =", "(1,2) =", "(2,1) =", "(2,2) ="],
      answers: [inv[0][0], inv[0][1], inv[1][0], inv[1][1]],
      solution:
        "<p>二阶逆矩阵的口诀：主对角线对调，副对角线变号，再除以 det。</p>" +
        "<p><span class=\"step\">det = " +
        nn(A[0][0]) +
        "×" +
        nn(A[1][1]) +
        " − " +
        nn(A[0][1]) +
        "×" +
        nn(A[1][0]) +
        " = " +
        nn(d) +
        "</span></p>" +
        "<p><span class=\"step\">A⁻¹ = (1/" +
        nn(d) +
        ") " +
        mat([
          [A[1][1], -A[0][1]],
          [-A[1][0], A[0][0]],
        ]) +
        " = " +
        mat(inv) +
        "</span></p>" +
        "<p>验算只要看一眼 <b>A·A⁻¹ = I</b> 就行；det 不为零是它存在的唯一前提。</p>",
    };
  };

  G.solve2 = function () {
    let A;
    let x0 = [rnd(-3, 3), rnd(-3, 3)];
    let tries = 0;
    do {
      A = randMat2(-3, 3);
      tries++;
    } while ((Math.abs(det2(A)) < 2 || det2(A) === 0) && tries < 500);
    if (det2(A) === 0) A = [[2, 1], [1, 3]];
    x0 = [rnd(-3, 3), rnd(-3, 3)];
    const b = [A[0][0] * x0[0] + A[0][1] * x0[1], A[1][0] * x0[0] + A[1][1] * x0[1]];
    const d = det2(A);
    return {
      topic: "system",
      prompt:
        "解方程组 " +
        mat([[A[0][0], A[0][1], b[0]], [A[1][0], A[1][1], b[1]]]) +
        "，求 x₁ 与 x₂。",
      labels: ["<var>x</var><sub>1</sub> =", "<var>x</var><sub>2</sub> ="],
      answers: x0,
      solution:
        "<p>det = " +
        nn(d) +
        " ≠ 0，两列不共线，解唯一。</p>" +
        "<p>用克拉默法则（Cramer）：把第 <var>j</var> 列换成 <var>b</var> 再算行列式。</p>" +
        "<p><span class=\"step\">x₁ = det" +
        mat([[b[0], A[0][1]], [b[1], A[1][1]]]) +
        " / " +
        nn(d) +
        " = " +
        nn(x0[0]) +
        "</span></p>" +
        "<p><span class=\"step\">x₂ = det" +
        mat([[A[0][0], b[0]], [A[1][0], b[1]]]) +
        " / " +
        nn(d) +
        " = " +
        nn(x0[1]) +
        "</span></p>" +
        "<p>代回去验一下：把解乘回 <var>A</var>，应该刚好得到 <var>b</var>。</p>",
    };
  };

  G.comb = function () {
    let v;
    let w;
    let d;
    do {
      v = [rnd(-2, 3), rnd(-2, 3)];
      w = [rnd(-2, 3), rnd(-2, 3)];
      d = v[0] * w[1] - v[1] * w[0];
    } while (Math.abs(d) !== 1);
    let c1;
    let c2;
    do {
      c1 = rnd(-3, 3);
      c2 = rnd(-3, 3);
    } while (c1 === 0 && c2 === 0);
    const t = [c1 * v[0] + c2 * w[0], c1 * v[1] + c2 * w[1]];
    return {
      topic: "system",
      prompt:
        "把 " +
        vec(t) +
        " 写成 " +
        vec(v) +
        " 与 " +
        vec(w) +
        " 的线性组合：求系数 c₁、c₂。",
      labels: ["<var>c</var><sub>1</sub> =", "<var>c</var><sub>2</sub> ="],
      answers: [c1, c2],
      solution:
        "<p>要解 <span class=\"step\">c₁v + c₂w = t</span>，也就是一个 2×2 方程组。</p>" +
        "<p>系数矩阵的 det = " +
        nn(d) +
        "，不为零，所以 v、w 是一组基，解唯一。</p>" +
        "<p><span class=\"step\">c₁ = " +
        nn(c1) +
        "，c₂ = " +
        nn(c2) +
        "</span></p>" +
        "<p>换个角度：<var>t</var> 在基 <var>(v, w)</var> 下的坐标就是 (" +
        nn(c1) +
        ", " +
        nn(c2) +
        ")。</p>",
    };
  };

  G.rank = function () {
    const style = pick(["dup", "sum", "scaled"]);
    let A;
    if (style === "dup") {
      const r1 = [rnd(-2, 3), rnd(-2, 3), rnd(-2, 3)];
      const r2 = [rnd(-2, 3), rnd(-2, 3), rnd(-2, 3)];
      A = [r1, r2, r1.slice()];
      if (r1[0] * r2[1] - r1[1] * r2[0] === 0) A[1] = [r2[0] + 1, r2[1], r2[2]];
    } else if (style === "sum") {
      const r1 = [rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)];
      const r2 = [rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)];
      A = [r1, r2, [r1[0] + r2[0], r1[1] + r2[1], r1[2] + r2[2]]];
    } else {
      const r1 = [rnd(-2, 2), rnd(-2, 2), rnd(-2, 2)];
      const k = pick([-2, 2, 3]);
      A = [r1, [r1[0] * 2, r1[1] * 2, r1[2] * 2], [r1[0] * k, r1[1] * k, r1[2] * k]];
    }
    const rank = computeRank(A);
    const ans = rank;
    return {
      topic: "system",
      prompt: "求矩阵 " + mat(A) + " 的秩 rank。",
      labels: ["rank ="],
      answers: [ans],
      solution:
        "<p>秩 = 行最简形里非零行的个数，也等于列空间的维数。</p>" +
        "<p>这题的第三行是前两行的组合，消元后它会整行变成零，所以只剩下 <b>" +
        rank +
        "</b> 个独立的行。</p>" +
        "<p>秩加上零化度 nullity 等于列数 3，所以零空间的维数是 " +
        (3 - rank) +
        "。</p>",
    };
  };

  function computeRank(A) {
    const M = A.map((r) => r.slice());
    let rank = 0;
    for (let col = 0; col < 3 && rank < 3; col++) {
      let piv = -1;
      for (let r = rank; r < 3; r++) if (Math.abs(M[r][col]) > 1e-9) { piv = r; break; }
      if (piv < 0) continue;
      const tmp = M[rank];
      M[rank] = M[piv];
      M[piv] = tmp;
      const pv = M[rank][col];
      for (let c = col; c < 3; c++) M[rank][c] /= pv;
      for (let r = 0; r < 3; r++) {
        if (r === rank) continue;
        const f = M[r][col];
        if (Math.abs(f) < 1e-12) continue;
        for (let c = col; c < 3; c++) M[r][c] -= f * M[rank][c];
      }
      rank++;
    }
    return rank;
  }

  G.eig2 = function () {
    const P = pick([
      [[2, 1], [1, 1]],
      [[1, 1], [1, 2]],
      [[1, 2], [1, 3]],
      [[3, 1], [2, 1]],
    ]);
    const detP = P[0][0] * P[1][1] - P[0][1] * P[1][0];
    const invP = [
      [P[1][1] / detP, -P[0][1] / detP],
      [-P[1][0] / detP, P[0][0] / detP],
    ];
    let l1;
    let l2;
    do {
      l1 = rnd(-3, 4);
      l2 = rnd(-3, 4);
    } while (l1 === l2);
    const PD = [
      [P[0][0] * l1, P[0][1] * l2],
      [P[1][0] * l1, P[1][1] * l2],
    ];
    const A = [
      [Math.round(PD[0][0] * invP[0][0] + PD[0][1] * invP[1][0]), Math.round(PD[0][0] * invP[0][1] + PD[0][1] * invP[1][1])],
      [Math.round(PD[1][0] * invP[0][0] + PD[1][1] * invP[1][0]), Math.round(PD[1][0] * invP[0][1] + PD[1][1] * invP[1][1])],
    ];
    const tr = A[0][0] + A[1][1];
    const dt = det2(A);
    return {
      topic: "eigen",
      prompt: "求矩阵 " + mat(A) + " 的两个特征值。",
      labels: ["<var>λ</var><sub>1</sub> =", "<var>λ</var><sub>2</sub> ="],
      answers: [l1, l2],
      solution:
        "<p>特征值是方程 <span class=\"step\">det(A − λI) = 0</span> 的根，展开就是特征多项式。</p>" +
        "<p>二阶有两个速记关系：<span class=\"step\">λ₁ + λ₂ = tr(A) = " +
        nn(tr) +
        "，λ₁·λ₂ = det(A) = " +
        nn(dt) +
        "</span>。</p>" +
        "<p>解 <var>λ</var>² − " +
        nn(tr) +
        "<var>λ</var> + (" +
        nn(dt) +
        ") = 0，分解得到 <span class=\"step\">λ = " +
        nn(l1) +
        " 或 " +
        nn(l2) +
        "</span>。</p>" +
        "<p>验算：两个根相加等于 " +
        nn(l1 + l2) +
        "，相乘等于 " +
        nn(l1 * l2) +
        "，和 trace、det 对得上。</p>",
    };
  };

  G.proj = function () {
    const a = pick([
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
      [2, 1],
      [1, 2],
    ]);
    const c = pick([-2, -1, 1, 2]);
    const k = pick([-1, 1]);
    const r = [k * -a[1], k * a[0]];
    const b = [c * a[0] + r[0], c * a[1] + r[1]];
    const p = [c * a[0], c * a[1]];
    const aa = a[0] * a[0] + a[1] * a[1];
    const ab = a[0] * b[0] + a[1] * b[1];
    return {
      topic: "orth",
      prompt:
        "求向量 " +
        vec(b) +
        " 在向量 " +
        vec(a) +
        " 上的投影向量 p。",
      labels: ["<var>p</var><sub>1</sub> =", "<var>p</var><sub>2</sub> ="],
      answers: p,
      solution:
        "<p>投影公式：<span class=\"step\">p = (a·b / a·a) a</span>。方向完全交给 <var>a</var>，长度由点积决定。</p>" +
        "<p><span class=\"step\">a·b = " +
        nn(ab) +
        "，a·a = " +
        nn(aa) +
        "，系数 = " +
        nn(c) +
        "</span></p>" +
        "<p>所以 <span class=\"step\">p = " +
        nn(c) +
        " · (" +
        nn(a[0]) +
        ", " +
        nn(a[1]) +
        ") = (" +
        nn(p[0]) +
        ", " +
        nn(p[1]) +
        ")</span>。</p>" +
        "<p>检查：残差 b − p = (" +
        nn(b[0] - p[0]) +
        ", " +
        nn(b[1] - p[1]) +
        ") 应该和 a 点乘为零——它就是那条垂线。</p>",
    };
  };

  const TOPICS = {
    all: ["mv", "inverse", "det2", "det3", "solve2", "comb", "rank", "eig2", "proj"],
    matrix: ["mv", "inverse"],
    det: ["det2", "det3"],
    system: ["solve2", "comb", "rank"],
    eigen: ["eig2"],
    orth: ["proj"],
  };

  function make(topic) {
    const list = TOPICS[topic] || TOPICS.all;
    const key = pick(list);
    const q = G[key]();
    q.key = key;
    return q;
  }

  return { make: make, topics: TOPICS };
})();
