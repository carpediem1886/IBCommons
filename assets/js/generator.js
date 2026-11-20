// Questionbank Paper Generator.
import { loadIndex, loadQuestions } from "./data.js";
import { segmented, topicTree, paperOptions, levelFilter } from "./picker.js";
import { $, esc, md, renderMath, shuffle, emptyState } from "./util.js";
import { downloadPaperPDF } from "./pdf.js";

export async function renderGenerator({ program, subject, syllabus, view, user }) {
  const index = await loadIndex(subject.id, program.id);
  const isDP = program.id === "dp";
  view.innerHTML = `
    <div class="page-head">
      <div><div class="label">${program.short} · ${esc(subject.name)}</div><h1>Paper Generator</h1></div>
    </div>
    <div class="tool-layout">
      <aside class="card sidebar">
        ${isDP ? `<label class="field"><span>Level</span><div class="seg" id="g-level"></div></label>` : ""}
        <label class="field"><span>Paper type</span><div class="seg" id="g-paper"></div></label>
        <div class="field"><span style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px">Topics and sub-topics</span><div id="g-topics"></div></div>
        <label class="field"><span>Paper length</span><div class="seg" id="g-mode"></div></label>
        <label class="field"><span id="g-num-label">Total marks</span><input type="number" id="g-num" min="1" max="200" value="30"></label>
        <div id="g-msg"></div>
        <button class="btn btn-cta" id="g-go" style="width:100%">Generate paper</button>
      </aside>
      <section id="g-out">${emptyState("Your paper will appear here", "Choose topics on the left, then press <b>Generate paper</b>.")}</section>
    </div>`;

  let level = "HL";
  let tree;
  const drawTree = () => { const keep = tree?.get() || []; tree = topicTree($("#g-topics"), syllabus, { counts: index.questions, level, selected: keep }); };
  if (isDP) segmented($("#g-level"), [{ value: "SL", label: "SL" }, { value: "HL", label: "HL" }], level, (v) => { level = v; drawTree(); });
  else level = "HL"; // MYP has no SL/HL split
  const paper = segmented($("#g-paper"), paperOptions(syllabus), syllabus.papers[0].id);
  const mode = segmented($("#g-mode"), [{ value: "marks", label: "By marks" }, { value: "count", label: "By questions" }], "marks", (v) => {
    $("#g-num-label").textContent = v === "marks" ? "Total marks" : "Number of questions";
    $("#g-num").value = v === "marks" ? 30 : 10;
  });
  drawTree();

  $("#g-go").onclick = async () => {
    const msg = $("#g-msg");
    msg.innerHTML = "";
    const codes = tree.get();
    if (!codes.length) { msg.innerHTML = `<div class="notice info">Pick at least one sub-topic.</div>`; return; }
    const target = Math.max(1, parseInt($("#g-num").value, 10) || 1);
    const paperType = syllabus.papers.find((p) => p.id === paper.get());
    const all = (await loadQuestions(subject.id, program.id, codes))
      .filter((q) => q.paper === paperType.id)
      .filter(levelFilter(level));
    if (!all.length) {
      $("#g-out").innerHTML = emptyState("No questions match yet", `There are no ${esc(paperType.name)} questions for these sub-topics${isDP ? ` at ${level}` : ""}. Try another paper type or more topics.`);
      return;
    }
    const picked = pick(all, mode.get(), target);
    const order = new Map(syllabus.topics.flatMap((t) => t.subtopics.map((s) => s.code)).map((c, i) => [c, i]));
    picked.sort((a, b) => (order.get(a.subtopics[0]) ?? 0) - (order.get(b.subtopics[0]) ?? 0));
    showPaper({ picked, all, target, mode: mode.get(), paperType, codes, level });
  };

  function showPaper({ picked, all, target, mode: m, paperType, codes, level: lv }) {
    const marks = picked.reduce((s, q) => s + q.marks, 0);
    const minutes = Math.round(marks * (paperType.minutesPerMark || 1.2));
    const short = m === "marks" ? marks < target : picked.length < target;
    const meta = {
      subject: subject.name, program: program.short, level: isDP ? lv : null, paper: paperType.name,
      topics: codes.join(", "), marks, minutes, student: user.name,
    };
    $("#g-out").innerHTML = `
      <div class="card">
        <div class="label">${esc(program.short)} ${esc(subject.name)}${isDP ? " " + lv : ""} · ${esc(paperType.name)}</div>
        <h2 style="margin-top:6px">Your practice paper is ready</h2>
        <div class="stat-row">
          <div class="stat"><b>${picked.length}</b><span>questions</span></div>
          <div class="stat"><b>${marks}</b><span>marks</span></div>
          <div class="stat"><b>${minutes}</b><span>minutes (suggested)</span></div>
        </div>
        ${short ? `<div class="notice warn">${m === "marks" && all.reduce((s, q) => s + q.marks, 0) >= target
          ? `The available questions can't add up to exactly ${target} marks, so this is the closest paper below it.`
          : `Only ${all.length} matching question${all.length === 1 ? "" : "s"} available, so the paper is shorter than you asked for.`}</div>` : ""}
        <div class="btn-row">
          <button class="btn btn-cta" id="dl-paper">Download paper (PDF)</button>
          <button class="btn btn-dark" id="dl-ms">Download markscheme (PDF)</button>
          <button class="btn btn-ghost" id="reroll">Shuffle new questions</button>
        </div>
      </div>
      <h3 style="margin:28px 0 12px">Preview</h3>
      <div id="preview">${picked.map((q, i) => previewCard(q, i + 1)).join("")}</div>`;
    renderMath($("#g-out"));
    const run = async (btn, ms) => {
      const label = btn.textContent;
      btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Building PDF…`;
      try { await downloadPaperPDF(meta, picked, { markscheme: ms }); }
      catch (err) { console.error(err); alert("Could not build the PDF: " + err.message); }
      finally { btn.disabled = false; btn.textContent = label; }
    };
    $("#dl-paper").onclick = (e) => run(e.currentTarget, false);
    $("#dl-ms").onclick = (e) => run(e.currentTarget, true);
    $("#reroll").onclick = () => $("#g-go").click();
  }
}

/** Choose questions at random to hit the target number of marks or questions. */
function pick(pool, mode, target) {
  if (mode === "count") return shuffle(pool).slice(0, target);
  // Try many random orders and keep the selection closest to the target without going over.
  let best = [], bestMarks = -1;
  for (let attempt = 0; attempt < 300 && bestMarks !== target; attempt++) {
    const out = [];
    let left = target;
    for (const q of shuffle(pool)) {
      if (q.marks <= left) { out.push(q); left -= q.marks; }
      if (left === 0) break;
    }
    if (target - left > bestMarks) { best = out; bestMarks = target - left; }
  }
  return best;
}

function previewCard(q, n) {
  return `<div class="card q-card">
    <div class="q-meta"><span class="chip">Q${n}</span><span class="chip">${esc(q.subtopics.join(", "))}</span>${q.level === "HL" ? '<span class="hl-tag">HL</span>' : ""}<span class="marks">[${q.marks}]</span></div>
    <div class="q-text">${md(q.stem)}${q.image ? `<img src="${esc(q.image)}" alt="Diagram for question ${n}">` : ""}</div>
    ${q.isMCQ ? `<ol type="A" class="small">${q.options.map((o) => `<li>${md(o).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ol>` : ""}
    ${!q.isMCQ ? q.parts.filter((p) => p.text).map((p) => `<div class="q-part"><div class="q-part-head"><b>(${esc(p.label)})</b><div>${md(p.text)}</div><span class="marks">[${p.marks}]</span></div></div>`).join("") : ""}
  </div>`;
}
