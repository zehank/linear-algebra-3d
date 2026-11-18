/* app.js — 目录高亮、阅读进度、练习面板、术语检索。 */
(function () {
  "use strict";

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* 隐私模式下不可写，忽略 */
      }
    },
  };

  /* ---------------------------------------------------------- 目录与进度 */

  const tocLinks = Array.prototype.slice.call(document.querySelectorAll("#toc a"));
  const chapters = Array.prototype.slice.call(
    document.querySelectorAll('section.chapter[id^="ch"]')
  );
  const sections = Array.prototype.slice.call(document.querySelectorAll("section[id]")).filter(
    (sec) => document.querySelector('#toc a[href="#' + sec.id + '"]')
  );
  const readSet = new Set(store.get("la-read", []));
  const progressEl = document.getElementById("progress");

  function paintProgress() {
    tocLinks.forEach((a) => {
      const id = a.getAttribute("href").slice(1);
      a.classList.toggle("read", readSet.has(id));
    });
    if (progressEl) {
      const n = chapters.filter((c) => readSet.has(c.id)).length;
      progressEl.textContent = n + " / " + chapters.length;
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      const mid = window.innerHeight * 0.38;
      let activeId = "";
      sections.forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) activeId = sec.id;
        if (sec.id.indexOf("ch") === 0 && r.bottom < window.innerHeight * 0.88 && r.top < window.innerHeight) {
          if (!readSet.has(sec.id)) {
            readSet.add(sec.id);
            store.set("la-read", Array.from(readSet));
            paintProgress();
          }
        }
      });
      tocLinks.forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === "#" + activeId);
      });
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  paintProgress();
  onScroll();

  /* 左右方向键翻章 */
  document.addEventListener("keydown", function (e) {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const anchors = tocLinks.filter((a) => !a.closest("li.sep"));
    const idx = anchors.findIndex((a) => a.classList.contains("active"));
    const next = e.key === "ArrowRight" ? idx + 1 : idx - 1;
    if (next >= 0 && next < anchors.length) {
      const id = anchors[next].getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        e.preventDefault();
      }
    }
  });

  /* ---------------------------------------------------------------- 练习 */

  const card = document.getElementById("qcard");
  if (card && window.PRACTICE) {
    const promptEl = document.getElementById("qprompt");
    const inputsEl = document.getElementById("qinputs");
    const feedEl = document.getElementById("qfeed");
    const solEl = document.getElementById("qsol");
    const checkBtn = document.getElementById("check");
    const nextBtn = document.getElementById("next");
    const revealBtn = document.getElementById("reveal");
    const statsEl = document.getElementById("pstats");
    const topicBar = document.getElementById("topics");

    const stats = store.get("la-practice", { total: 0, correct: 0, streak: 0, best: 0 });
    let topic = "all";
    let cur = null;
    let solved = false;

    const TOPIC_NAMES = [
      ["all", "全部"],
      ["matrix", "矩阵"],
      ["det", "行列式"],
      ["system", "方程组"],
      ["eigen", "特征值"],
      ["orth", "正交"],
    ];

    function paintStats() {
      if (!statsEl) return;
      statsEl.innerHTML =
        "答对 <b>" +
        stats.correct +
        "</b> / " +
        stats.total +
        " · 连对 <b>" +
        stats.streak +
        "</b>" +
        (stats.best > 0 ? " · 最高 " + stats.best : "");
    }

    function buildTopics() {
      if (!topicBar) return;
      topicBar.innerHTML = TOPIC_NAMES.map(
        (t) =>
          '<button class="chip" data-topic="' +
          t[0] +
          '" aria-pressed="' +
          (t[0] === "all") +
          '">' +
          t[1] +
          "</button>"
      ).join("");
      Array.prototype.forEach.call(topicBar.querySelectorAll(".chip"), (btn) => {
        btn.addEventListener("click", () => {
          topic = btn.getAttribute("data-topic");
          Array.prototype.forEach.call(topicBar.querySelectorAll(".chip"), (b) => {
            b.setAttribute("aria-pressed", String(b === btn));
          });
          newQuestion();
        });
      });
    }

    function newQuestion() {
      cur = window.PRACTICE.make(topic);
      solved = false;
      promptEl.innerHTML = cur.prompt;
      inputsEl.innerHTML = cur.labels
        .map(
          (l, i) =>
            '<span class="field"><span class="lbl">' +
            l +
            '</span><input class="blank" data-i="' +
            i +
            '" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="第 ' +
            (i + 1) +
            ' 个答案"></span>'
        )
        .join("");
      feedEl.textContent = "填完按 Enter 检查。";
      feedEl.className = "qfeed";
      solEl.hidden = true;
      solEl.innerHTML = "";
    }

    function check() {
      if (!cur || solved) return;
      const boxes = Array.prototype.slice.call(inputsEl.querySelectorAll(".blank"));
      const vals = boxes.map((b) => b.value.trim());
      if (vals.some((v) => v === "")) {
        feedEl.textContent = "还有空没填。";
        feedEl.className = "qfeed";
        return;
      }
      const ok = cur.answers.every((a, i) => {
        const v = parseFloat(vals[i].replace("−", "-"));
        return isFinite(v) && Math.abs(v - a) < 1e-6;
      });
      stats.total += 1;
      if (ok) {
        stats.correct += 1;
        stats.streak += 1;
        stats.best = Math.max(stats.best, stats.streak);
        solved = true;
        feedEl.textContent = "对。" + (stats.streak > 1 ? "连对 " + stats.streak + " 题。" : "");
        feedEl.className = "qfeed ok";
        boxes.forEach((b) => b.classList.remove("bad"));
      } else {
        stats.streak = 0;
        feedEl.textContent = "还不对。别急着重算，先想清楚每个数的来源。";
        feedEl.className = "qfeed no";
        boxes.forEach((b, i) => {
          const v = parseFloat(vals[i].replace("−", "-"));
          b.classList.toggle("bad", !(isFinite(v) && Math.abs(v - cur.answers[i]) < 1e-6));
        });
      }
      store.set("la-practice", stats);
      paintStats();
    }

    function reveal() {
      if (!cur) return;
      solEl.innerHTML = cur.solution;
      solEl.hidden = false;
      if (!solved) feedEl.textContent = "解法在下面。看懂之后按「下一题」。";
    }

    checkBtn.addEventListener("click", check);
    nextBtn.addEventListener("click", newQuestion);
    revealBtn.addEventListener("click", reveal);

    inputsEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (solved) newQuestion();
      else check();
    });

    buildTopics();
    paintStats();
    newQuestion();
  }

  /* -------------------------------------------------------------- 术语表 */

  const search = document.getElementById("glossary-search");
  if (search) {
    const items = Array.prototype.slice.call(document.querySelectorAll(".gl"));
    const groups = Array.prototype.slice.call(document.querySelectorAll(".gl-group"));
    const empty = document.getElementById("gl-empty");
    search.addEventListener("input", function () {
      const q = search.value.trim().toLowerCase();
      let hits = 0;
      items.forEach((it) => {
        const txt = it.textContent.toLowerCase();
        const show = !q || txt.indexOf(q) >= 0;
        it.classList.toggle("gl-hidden", !show);
        if (show) hits++;
      });
      groups.forEach((g) => {
        const any = Array.prototype.some.call(g.querySelectorAll(".gl"), (it) => !it.classList.contains("gl-hidden"));
        g.classList.toggle("gl-hidden", !any);
      });
      if (empty) empty.hidden = hits !== 0;
    });
  }
})();
