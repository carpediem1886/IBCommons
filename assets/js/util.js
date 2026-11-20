// Small shared helpers.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Minimal Markdown for questions and lessons: paragraphs, "- " lists, **bold**, *italic*.
 * HTML is escaped. Maths in $...$ is left for KaTeX.
 */
export function md(text) {
  if (!text) return "";
  const blocks = String(text).trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      return "<ul>" + lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("") + "</ul>";
    }
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("");
}
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>");
}

export function renderMath(el) {
  if (!el || !window.renderMathInElement) return;
  window.renderMathInElement(el, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  });
}

/** Turn simple LaTeX into plain Unicode for the PDFs. */
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", "n": "ⁿ" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε", theta: "θ", lambda: "λ",
  mu: "μ", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", Phi: "Φ", omega: "ω", Omega: "Ω",
  times: "×", cdot: "·", approx: "≈", leq: "≤", geq: "≥", neq: "≠", pm: "±", degree: "°", circ: "°",
  rightarrow: "→", to: "→", infty: "∞", propto: "∝",
};
const mapChars = (s, table) => [...s].map((c) => table[c] ?? c).join("");
export function texToPlain(text) {
  if (!text) return "";
  return String(text).replace(/\$\$?([^$]+)\$\$?/g, (_, m) => {
    let s = m;
    s = s.replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}/g, (_x, a, b) => a ?? b);
    s = s.replace(/\\[dt]?frac\{([^}]*)\}\{([^}]*)\}/g, (_x, a, b) => {
      if (a === "1" && b === "2") return "½";
      const wrap = (t) => (/^[\w.\\]+$/.test(t) ? t : `(${t})`);
      return `${wrap(a)}/${wrap(b)}`;
    });
    s = s.replace(/\\sqrt\{([^}]*)\}/g, "√($1)");
    s = s.replace(/\\([A-Za-z]+)/g, (x, name) => GREEK[name] ?? name);
    s = s.replace(/\^\{([^}]*)\}/g, (_x, a) => mapChars(a, SUP)).replace(/\^(\S)/g, (_x, a) => mapChars(a, SUP));
    s = s.replace(/_\{([^}]*)\}/g, (_x, a) => mapChars(a, SUB)).replace(/_(\S)/g, (_x, a) => mapChars(a, SUB));
    s = s.replace(/\\[,;! ]/g, " ").replace(/[{}]/g, "").replace(/([ΔΣ]) +/g, "$1");
    return s.replace(/\s+/g, " ").trim();
  }).replace(/\*\*(.+?)\*\*/g, "$1");
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Per-user progress kept in the browser. */
export const progress = {
  key(uid) { return `ibc:progress:${uid}`; },
  get(uid) {
    try { return JSON.parse(localStorage.getItem(this.key(uid))) || { questions: {}, lessons: {} }; }
    catch { return { questions: {}, lessons: {} }; }
  },
  save(uid, data) { try { localStorage.setItem(this.key(uid), JSON.stringify(data)); } catch { /* ignore */ } },
  recordQuestion(uid, qid, ok) {
    const d = this.get(uid);
    const prev = d.questions[qid] || { tries: 0, correct: false };
    d.questions[qid] = { tries: prev.tries + 1, correct: prev.correct || ok };
    this.save(uid, d);
  },
  recordLesson(uid, code, step, total) {
    const d = this.get(uid);
    const prev = d.lessons[code] || { step: 0, total };
    d.lessons[code] = { step: Math.max(prev.step, step), total };
    this.save(uid, d);
  },
};

export function emptyState(title, body = "") {
  return `<div class="empty-state">
    <img src="assets/brand/IBCommons-mark-color.svg" alt="" width="64" height="64" style="opacity:.85;margin-bottom:12px">
    <h3>${esc(title)}</h3><p>${body}</p></div>`;
}

export function toast(el, kind, html) {
  el.innerHTML = `<div class="notice ${kind}">${html}</div>`;
}
