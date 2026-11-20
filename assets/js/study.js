// QuestionBank Open Study: every question on a topic, with answer checking and an AI tutor.
import { loadIndex, loadQuestions } from "./data.js";
import { segmented, topicTree, paperOptions, levelFilter } from "./picker.js";
import { $, $$, esc, md, renderMath, emptyState, progress } from "./util.js";
import { AI_ENABLED, callAI, questionForAI } from "./ai.js";

export async function renderStudy({ program, subject, syllabus, view, user }) {
  const index = await loadIndex(subject.id, program.id);
  const isDP = program.id === "dp";
  view.innerHTML = `
    <div class="page-head">
      <div><div class="label">${program.short} · ${esc(subject.name)}</div><h1>Open Study</h1></div>
      <div id="s-stats" class="small muted"></div>
    </div>
    <div class="tool-layout">
      <aside class="card sidebar">
        ${isDP ? `<label class="field"><span>Level</span><div class="seg" id="s-level"></div></label>` : ""}
        <label class="field"><span>Paper type</span><div class="seg" id="s-paper"></div></label>
        <div class="field"><span style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px">Topic or sub-topic</span><div id="s-topics"></div></div>
        <button class="btn btn-primary" id="s-go" style="width:100%">Show questions</button>
        ${AI_ENABLED ? "" : `<p class="small muted" style="margin-top:12px">Multiple-choice and numerical answers are checked automatically. For written answers, compare yours with the markscheme and mark it yourself.</p>`}
      </aside>
      <section id="s-out">${emptyState("Pick what to study", "Choose a topic or sub-topic and a paper type, then press <b>Show questions</b>.")}</section>
    </div>`;

  let level = "HL";
  let tree;
  const pre = new URLSearchParams(location.hash.split("?")[1] || "").get("topic");
  const drawTree = () => { const keep = tree?.get() || (pre ? [pre] : []); tree = topicTree($("#s-topics"), syllabus, { counts: index.questions, level, selected: keep }); };
  if (isDP) segmented($("#s-level"), [{ value: "SL", label: "SL" }, { value: "HL", label: "HL" }], level, (v) => { level = v; drawTree(); });
  const paper = segmented($("#s-paper"), paperOptions(syllabus, true), "all");
  drawTree();
  updateStats();

  $("#s-go").onclick = async () => {
    const codes = tree.get();
    const out = $("#s-out");
    if (!codes.length) { out.innerHTML = `<div class="notice info">Pick at least one sub-topic.</div>`; return; }
    const p = paper.get();
    const qs = (await loadQuestions(subject.id, program.id, codes))
      .filter((q) => p === "all" || q.paper === p)
      .filter(levelFilter(level));
    if (!qs.length) { out.innerHTML = emptyState("No questions here yet", "Try another paper type or sub-topic."); return; }
    const done = progress.get(user.id).questions;
    out.innerHTML = `<p class="muted">${qs.length} question${qs.length === 1 ? "" : "s"}</p>` +
      qs.map((q, i) => questionCard(q, i + 1, done[q.id], syllabus)).join("");
    renderMath(out);
    qs.forEach((q) => wireQuestion(q, user, updateStats));
  };
  if (pre) $("#s-go").click();

  function updateStats() {
    const d = progress.get(user.id).questions;
    const tried = Object.keys(d).length;
    const right = Object.values(d).filter((x) => x.correct).length;
    $("#s-stats").textContent = tried ? `${right} correct out of ${tried} attempted` : "";
  }
}

function paperName(syllabus, id) { return syllabus.papers.find((p) => p.id === id)?.short || id; }

function questionCard(q, n, record, syllabus) {
  const status = record ? (record.correct ? '<span class="chip teal">Done ✓</span>' : '<span class="chip">Attempted</span>') : "";
  const body = q.isMCQ
    ? `<div class="options">${q.options.map((o, k) => {
        const L = String.fromCharCode(65 + k);
        return `<label data-letter="${L}"><input type="radio" name="mcq-${esc(q.id)}" value="${L}"><span class="letter">${L}</span><span>${md(o).replace(/^<p>|<\/p>$/g, "")}</span></label>`;
      }).join("")}</div>
      <div class="answer-actions"><button class="btn btn-primary btn-sm" data-act="check-mcq">Check answer</button>
      ${AI_ENABLED ? `<button class="btn btn-ghost btn-sm" data-act="tutor">Ask the AI tutor</button>` : ""}</div>
      <div class="feedback" data-fb="mcq"></div>`
    : q.parts.map((p, k) => `
      <div class="q-part" data-part="${k}">
        ${p.label || p.text ? `<div class="q-part-head">${p.label ? `<b>(${esc(p.label)})</b>` : ""}<div>${md(p.text)}</div><span class="marks">[${p.marks}]</span></div>` : ""}
        ${p.image ? `<img src="${esc(p.image)}" alt="">` : ""}
        <div class="answer-area">
          <textarea placeholder="Write your answer${p.answer?.unit ? " (include units)" : ""}…" data-input="${k}"></textarea>
          <div class="answer-actions">
            <button class="btn btn-primary btn-sm" data-act="check" data-k="${k}">Check answer</button>
            <button class="btn btn-ghost btn-sm" data-act="ms" data-k="${k}">Show markscheme</button>
          </div>
          <div class="feedback" data-fb="${k}"></div>
        </div>
      </div>`).join("") + (AI_ENABLED ? `<div class="answer-actions" style="margin-top:16px"><button class="btn btn-ghost btn-sm" data-act="tutor">Ask the AI tutor</button></div>` : "");
  return `<article class="card q-card" id="q-${esc(q.id)}">
    <div class="q-meta"><span class="chip">Q${n}</span><span class="chip">${esc(q.subtopics.join(", "))}</span><span class="chip">${esc(paperName(syllabus, q.paper))}</span>${q.level === "HL" ? '<span class="hl-tag">HL</span>' : ""}${status}<span class="marks">${q.marks} mark${q.marks === 1 ? "" : "s"}</span></div>
    <div class="q-text">${md(q.stem)}${q.image ? `<img src="${esc(q.image)}" alt="Diagram">` : ""}</div>
    ${body}
    <div data-tutor></div>
  </article>`;
}

function wireQuestion(q, user, onProgress) {
  const card = document.getElementById(`q-${q.id}`);
  const record = (ok) => { progress.recordQuestion(user.id, q.id, ok); onProgress(); };
  const msBlock = (points, extra = "") => `<div class="markscheme"><b>Markscheme</b><ul>${(points || []).map((m) => `<li>${md(m).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul>${extra}</div>`;

  card.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "check-mcq") {
      const chosen = card.querySelector(`input[name="mcq-${CSS.escape(q.id)}"]:checked`)?.value;
      const fb = card.querySelector('[data-fb="mcq"]');
      if (!chosen) { fb.innerHTML = `<div class="notice info">Choose an option first.</div>`; return; }
      const ok = chosen === q.answer;
      $$(".options label", card).forEach((l) => {
        l.classList.remove("right", "wrong");
        if (l.dataset.letter === chosen) l.classList.add(ok ? "right" : "wrong");
        if (ok && l.dataset.letter === q.answer) l.classList.add("right");
      });
      fb.innerHTML = ok
        ? `<div class="notice ok"><b>Correct.</b></div>${q.markscheme?.length ? msBlock(q.markscheme) : ""}`
        : `<div class="notice bad"><b>Not quite.</b> Have another go${AI_ENABLED ? ", or ask the tutor for a hint" : ""}.</div>`;
      renderMath(fb);
      record(ok);
    }

    if (act === "ms") {
      const k = +btn.dataset.k, p = q.parts[k];
      const fb = card.querySelector(`[data-fb="${k}"]`);
      fb.innerHTML = msBlock(p.markscheme, finalAnswer(p));
      renderMath(fb);
    }

    if (act === "check") {
      const k = +btn.dataset.k, p = q.parts[k];
      const fb = card.querySelector(`[data-fb="${k}"]`);
      const text = card.querySelector(`[data-input="${k}"]`).value.trim();
      if (!text) { fb.innerHTML = `<div class="notice info">Write an answer first.</div>`; return; }

      // 1. Numerical answers are checked instantly in the browser.
      if (p.answer && typeof p.answer === "object" && typeof p.answer.value === "number") {
        const got = parseNumber(text);
        const tol = p.answer.tolerance ?? 0.02;
        const ok = got !== null && Math.abs(got - p.answer.value) <= Math.abs(p.answer.value) * tol + 1e-12;
        fb.innerHTML = ok
          ? `<div class="notice ok"><b>Correct.</b> ${p.answer.unit ? "Check you gave the unit too." : ""}</div>${msBlock(p.markscheme)}`
          : `<div class="notice bad"><b>${got === null ? "I couldn't find a number in your answer." : "That value doesn't match the markscheme."}</b> Try again${AI_ENABLED ? ", show the markscheme, or ask the tutor to guide you" : " or show the markscheme"}.</div>`;
        renderMath(fb);
        record(ok);
        return;
      }

      // 2. Written answers: AI marking against the markscheme.
      if (AI_ENABLED) {
        btn.disabled = true;
        fb.innerHTML = `<div class="notice info">Checking against the markscheme…</div>`;
        try {
          const r = await callAI({ mode: "mark", question: questionForAI(q), partIndex: k, studentAnswer: text });
          const full = r.marksAwarded >= p.marks;
          fb.innerHTML = `<div class="notice ${full ? "ok" : r.marksAwarded > 0 ? "warn" : "bad"}">
              <span class="score">${r.marksAwarded} / ${p.marks} marks</span><br>${esc(r.feedback)}</div>
            <button class="btn btn-ghost btn-sm" data-act="ms" data-k="${k}">Show markscheme</button>`;
          record(full);
        } catch (err) {
          fb.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`;
        } finally { btn.disabled = false; }
        renderMath(fb);
        return;
      }

      // 3. Demo mode: self-assessment.
      fb.innerHTML = `${msBlock(p.markscheme, finalAnswer(p))}
        <p class="small" style="margin-top:10px">Compare your answer with the markscheme. Did you get it?</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-self="1">Yes, I got it</button><button class="btn btn-ghost btn-sm" data-self="0">Not yet</button></div>`;
      renderMath(fb);
      fb.querySelectorAll("[data-self]").forEach((b) => {
        b.onclick = () => { record(b.dataset.self === "1"); b.parentElement.innerHTML = `<span class="small muted">Saved.</span>`; };
      });
    }

    if (act === "tutor") openTutor(card, q);
  });
}

function finalAnswer(p) {
  if (!(p.answer && typeof p.answer === "object" && p.answer.value !== undefined)) return "";
  return `<p style="margin:8px 0 0"><b>Final answer:</b> ${esc(p.answer.value)} ${p.answer.unit ? `$\\mathrm{${esc(p.answer.unit)}}$` : ""}</p>`;
}

/**
 * Reads the student's final number: the first number after the last "=", otherwise the last number.
 * Understands 2.5, 2,5, 3e8, 3 × 10^8, 3x10^-4, −4.2 and ignores unit powers such as m/s2 or s^-1.
 */
export function parseNumber(text) {
  const SUPS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
  const t = text.replace(/−/g, "-").replace(/\s+/g, " ")
    .replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPS[c]).join(""));
  const re = /[-+]?\d+(?:[.,]\d+)?(?:\s*(?:[eE]|[x×*·]\s*10\s*\^\s*|[x×*·]\s*10(?=[-+]?\d))\s*[-+]?\d+)?/g;
  const found = [];
  for (const m of t.matchAll(re)) {
    const before = t.slice(0, m.index).trimEnd().slice(-1);
    if (/[A-Za-z^]/.test(t[m.index - 1] || "") || before === "^") continue; // unit exponent
    found.push(m);
  }
  if (!found.length) return null;
  const lastEq = t.lastIndexOf("=");
  const m = (lastEq >= 0 && found.find((f) => f.index > lastEq)) || found[found.length - 1];
  const s = m[0].replace(",", ".").replace(/\s/g, "").replace(/[x×*·]10\^?/, "e");
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

// ---------- AI tutor ----------
function openTutor(card, q) {
  const slot = card.querySelector("[data-tutor]");
  if (slot.firstChild) { slot.innerHTML = ""; return; }
  if (!AI_ENABLED) {
    slot.innerHTML = `<div class="notice warn">The AI tutor is switched off on this site.</div>`;
    return;
  }
  slot.innerHTML = `
    <div class="tutor">
      <div class="tutor-head"><span class="dot"></span>AI tutor — I'll guide you, not give you the answer<button title="Close">×</button></div>
      <div class="tutor-log"></div>
      <form class="tutor-form"><textarea placeholder="Reply to your tutor…" required></textarea><button class="btn btn-primary btn-sm">Send</button></form>
    </div>`;
  const log = slot.querySelector(".tutor-log");
  const form = slot.querySelector("form");
  const input = form.querySelector("textarea");
  const messages = [];
  slot.querySelector(".tutor-head button").onclick = () => { slot.innerHTML = ""; };

  const add = (role, text) => {
    const div = document.createElement("div");
    div.className = `msg ${role === "user" ? "me" : "ai"}`;
    div.textContent = text;
    log.appendChild(div);
    renderMath(div);
    log.scrollTop = log.scrollHeight;
    return div;
  };

  const attempts = () => [...card.querySelectorAll("[data-input]")].map((t) => t.value.trim()).filter(Boolean);

  async function send(text, showUser = true) {
    if (showUser) add("user", text);
    messages.push({ role: "user", content: text });
    const typing = add("assistant", "Thinking…");
    typing.classList.add("typing");
    form.querySelector("button").disabled = true;
    try {
      const r = await callAI({ mode: "tutor", question: questionForAI(q), studentAttempts: attempts(), messages });
      typing.remove();
      add("assistant", r.reply);
      messages.push({ role: "assistant", content: r.reply });
    } catch (err) {
      typing.textContent = err.message;
      messages.pop();
    } finally { form.querySelector("button").disabled = false; input.focus(); }
  }

  form.onsubmit = (e) => { e.preventDefault(); const t = input.value.trim(); if (!t) return; input.value = ""; send(t); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  send("Hi! I'm stuck on this question. Can you help me work through it?", false);
}
