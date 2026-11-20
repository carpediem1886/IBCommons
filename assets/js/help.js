// Step-by-step Help pop-up. Shows one step at a time; the last step (the final answer)
// sits behind its own button so students try each step themselves first.
import { esc, md, renderMath } from "./util.js";

const reached = new Map(); // remembers how far a student got for each question part

export function openHelp(key, title, steps) {
  if (!steps?.length) return;
  let i = Math.min(reached.get(key) ?? 0, steps.length - 1);
  const last = steps.length - 1;
  const opener = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = "help-overlay";
  overlay.innerHTML = `
    <div class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div class="help-head">
        <div><div class="label">Step-by-step help</div><h3 id="help-title">${esc(title)}</h3></div>
        <button class="help-close" aria-label="Close help">×</button>
      </div>
      <div class="progress"><i></i></div>
      <div class="help-body" aria-live="polite"></div>
      <div class="help-nav">
        <button class="btn btn-ghost btn-sm" data-go="back">Back</button>
        <span class="small muted help-count"></span>
        <button class="btn btn-sm" data-go="next"></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const body = overlay.querySelector(".help-body");
  const back = overlay.querySelector('[data-go="back"]');
  const next = overlay.querySelector('[data-go="next"]');

  function draw() {
    reached.set(key, Math.max(reached.get(key) ?? 0, i));
    const s = steps[i];
    const isFinal = i === last;
    body.innerHTML = `
      <div class="help-step ${isFinal ? "final" : ""}">
        <div class="help-step-num">${isFinal ? "Answer" : `Step ${i + 1}`}</div>
        <h4>${esc(s.title || "")}</h4>
        ${md(s.text)}
      </div>
      ${!isFinal ? `<p class="small muted help-tip">Try this step yourself before moving on.</p>` : ""}`;
    renderMath(body);
    overlay.querySelector(".progress i").style.width = `${((i + 1) / steps.length) * 100}%`;
    overlay.querySelector(".help-count").textContent = `${i + 1} of ${steps.length}`;
    back.disabled = i === 0;
    if (isFinal) {
      next.textContent = "Close";
      next.className = "btn btn-primary btn-sm";
    } else if (i === last - 1) {
      next.textContent = "Show the answer";
      next.className = "btn btn-cta btn-sm";
    } else {
      next.textContent = "Next step";
      next.className = "btn btn-primary btn-sm";
    }
    next.focus();
  }

  function close() {
    overlay.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    opener?.focus?.();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight" && i < last - 1) { i++; draw(); }
    if (e.key === "ArrowLeft" && i > 0) { i--; draw(); }
  }

  back.onclick = () => { if (i > 0) { i--; draw(); } };
  next.onclick = () => { if (i === last) close(); else { i++; draw(); } };
  overlay.querySelector(".help-close").onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKey);
  draw();
}
