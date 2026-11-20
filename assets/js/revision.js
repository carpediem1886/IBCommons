// Topic Revision: step-by-step lessons per sub-topic.
import { loadIndex, loadLesson } from "./data.js";
import { $, esc, md, renderMath, emptyState, progress } from "./util.js";

export async function renderRevisionList({ program, subject, syllabus, view, user }) {
  const index = await loadIndex(subject.id, program.id);
  const done = progress.get(user.id).lessons;
  view.innerHTML = `
    <div class="page-head">
      <div><div class="label">${program.short} · ${esc(subject.name)}</div><h1>Topic Revision</h1>
      <p class="muted" style="margin:6px 0 0">Short, visual lessons. Each one ends with practice questions on the same sub-topic.</p></div>
    </div>
    ${syllabus.topics.map((t) => `
      <section class="rev-topic">
        <h2><span class="topic-letter">${esc(t.code)}</span>${esc(t.title)}</h2>
        <div class="rev-list">
          ${t.subtopics.map((s) => {
            const lesson = index.revision?.[s.code];
            const p = done[s.code];
            const pct = p ? Math.round((p.step / p.total) * 100) : 0;
            const inner = `<span class="code">${esc(s.code)}${s.hl ? ' <span class="hl-tag">HL</span>' : ""}</span>
              <b>${esc(s.title)}</b>
              <span class="small muted">${lesson ? `${lesson.steps} steps · ~${lesson.minutes || 15} min` : "Lesson coming soon"}</span>
              ${lesson ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ""}`;
            return lesson
              ? `<a class="rev-item" href="#/${program.id}/${subject.id}/revision/${encodeURIComponent(s.code)}">${inner}</a>`
              : `<div class="rev-item empty">${inner}</div>`;
          }).join("")}
        </div>
      </section>`).join("")}`;
}

export async function renderLesson({ program, subject, syllabus, view, user }, code) {
  const lesson = await loadLesson(subject.id, program.id, code);
  const back = `#/${program.id}/${subject.id}/revision`;
  if (!lesson) { view.innerHTML = emptyState("This lesson isn't written yet", `<a href="${back}">Back to all topics</a>`); return; }

  const sub = syllabus.topics.flatMap((t) => t.subtopics).find((s) => s.code === code);
  const steps = [
    {
      title: "What you'll learn",
      body: lesson.intro || "",
      list: lesson.objectives || [],
    },
    ...lesson.steps,
  ];
  let i = 0;
  const answered = new Set();

  function draw() {
    const s = steps[i];
    const last = i === steps.length - 1;
    progress.recordLesson(user.id, code, i + 1, steps.length);
    view.innerHTML = `
      <div class="lesson">
        <a href="${back}" class="small">← All topics</a>
        <div class="label" style="margin-top:14px">${esc(code)}${sub?.hl ? " · HL" : ""} · Step ${i + 1} of ${steps.length}</div>
        <h1 style="font-size:2rem;margin-top:4px">${esc(lesson.title)}</h1>
        <div class="progress" style="margin:12px 0 20px"><i style="width:${((i + 1) / steps.length) * 100}%"></i></div>
        <article class="card lesson-step">
          <h2>${esc(s.title)}</h2>
          ${md(s.body)}
          ${s.list?.length ? `<div class="key-box"><ul style="margin:0;padding-left:18px">${s.list.map((o) => `<li>${md(o).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul></div>` : ""}
          ${s.formula ? `<div class="formula">${esc(s.formula)}</div>` : ""}
          ${s.figure ? figure(s.figure) : ""}
          ${s.key ? `<div class="key-box"><b>Key idea.</b> ${md(s.key).replace(/^<p>|<\/p>$/g, "")}</div>` : ""}
          ${s.example ? `<div class="markscheme"><b>Worked example</b>${md(s.example)}</div>` : ""}
          ${s.check ? checkBlock(s.check) : ""}
        </article>
        <div class="lesson-nav">
          <button class="btn btn-ghost" id="prev" ${i === 0 ? "disabled" : ""}>Back</button>
          <div class="step-dots">${steps.map((_, k) => `<i class="${k < i ? "done" : k === i ? "here" : ""}"></i>`).join("")}</div>
          ${last
            ? `<a class="btn btn-cta" href="#/${program.id}/${subject.id}/study?topic=${encodeURIComponent(code)}">Practise ${esc(code)} questions</a>`
            : `<button class="btn btn-primary" id="next">Next</button>`}
        </div>
      </div>`;
    renderMath(view);
    $("#prev").onclick = () => { i--; draw(); };
    const next = $("#next");
    if (next) {
      if (s.check && !answered.has(i)) { next.disabled = true; next.title = "Answer the quick check first"; }
      next.onclick = () => { i++; draw(); };
    }
    if (s.check) wireCheck(s.check);
  }

  function wireCheck(c) {
    const box = $("#check");
    box.querySelectorAll("[data-opt]").forEach((b) => {
      b.onclick = () => {
        const ok = b.dataset.opt === c.answer;
        box.querySelectorAll("[data-opt]").forEach((x) => x.classList.remove("right", "wrong"));
        b.classList.add(ok ? "right" : "wrong");
        const fb = box.querySelector(".feedback");
        fb.innerHTML = `<div class="notice ${ok ? "ok" : "bad"}"><b>${ok ? "Correct." : "Not quite — try again."}</b> ${ok && c.explain ? md(c.explain).replace(/^<p>|<\/p>$/g, "") : ""}</div>`;
        renderMath(fb);
        if (ok) { answered.add(i); const n = $("#next"); if (n) { n.disabled = false; n.title = ""; } }
      };
    });
  }
  draw();
}

function figure(f) {
  // Lesson SVGs come from the repository's own content files (reviewed in pull requests).
  const art = f.svg ? f.svg : `<img src="${esc(f.src)}" alt="${esc(f.alt || f.caption || "")}">`;
  return `<figure class="figure">${art}${f.caption ? `<figcaption>${esc(f.caption)}</figcaption>` : ""}</figure>`;
}

function checkBlock(c) {
  return `<div id="check" style="margin-top:20px">
    <div class="label">Quick check</div>
    <p style="margin-top:6px"><b>${md(c.question).replace(/^<p>|<\/p>$/g, "")}</b></p>
    <div class="options">${c.options.map((o, k) => {
      const L = String.fromCharCode(65 + k);
      return `<label data-opt="${L}"><span class="letter">${L}</span><span>${md(o).replace(/^<p>|<\/p>$/g, "")}</span></label>`;
    }).join("")}</div>
    <div class="feedback"></div>
  </div>`;
}
