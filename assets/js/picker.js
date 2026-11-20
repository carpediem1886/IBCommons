// Shared sidebar controls: level, paper type and topic / sub-topic selection.
import { esc, $$ } from "./util.js";

/** Segmented control. Returns { get() }. */
export function segmented(el, options, initial, onChange) {
  let value = initial;
  el.innerHTML = options.map((o) => `<button type="button" data-v="${esc(o.value)}" class="${o.value === value ? "on" : ""}">${esc(o.label)}</button>`).join("");
  el.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      value = b.dataset.v;
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onChange?.(value);
    };
  });
  return { get: () => value };
}

/**
 * Topic tree with checkboxes (multi) or radio buttons (single).
 * counts: { "A.1": 12, ... } from index.json.
 */
export function topicTree(el, syllabus, { multi = true, counts = {}, level = "HL", selected = [] } = {}) {
  const chosen = new Set(selected);
  const type = multi ? "checkbox" : "radio";
  const visible = (s) => level === "HL" || !s.hl;
  el.innerHTML = syllabus.topics.map((t) => {
    const subs = t.subtopics.filter(visible);
    if (!subs.length) return "";
    const open = subs.some((s) => chosen.has(s.code));
    return `<details class="topic-group" ${open ? "open" : ""}>
      <summary><span class="topic-letter">${esc(t.code)}</span><span>${esc(t.title)}</span></summary>
      <div class="check-list">
        ${multi ? `<label><input type="checkbox" data-all="${esc(t.code)}"><b>All of ${esc(t.code)}</b></label>` : ""}
        ${subs.map((s) => `
          <label><input type="${type}" name="subtopic" value="${esc(s.code)}" data-topic="${esc(t.code)}" ${chosen.has(s.code) ? "checked" : ""}>
          <span>${esc(s.code)} ${esc(s.title)}${s.hl ? '<span class="hl-tag">HL</span>' : ""}
          <span class="muted small"> · ${counts[s.code] || 0} q</span></span></label>`).join("")}
      </div>
    </details>`;
  }).join("");

  const boxes = () => $$('input[name="subtopic"]', el);
  const syncAll = () => {
    $$("[data-all]", el).forEach((all) => {
      const mine = boxes().filter((b) => b.dataset.topic === all.dataset.all);
      all.checked = mine.length > 0 && mine.every((b) => b.checked);
      all.indeterminate = !all.checked && mine.some((b) => b.checked);
    });
  };
  $$("[data-all]", el).forEach((all) => {
    all.onchange = () => {
      boxes().filter((b) => b.dataset.topic === all.dataset.all).forEach((b) => { b.checked = all.checked; });
      el.dispatchEvent(new Event("change"));
    };
  });
  boxes().forEach((b) => b.addEventListener("change", syncAll));
  syncAll();
  return { get: () => boxes().filter((b) => b.checked).map((b) => b.value) };
}

export function paperOptions(syllabus, withAll = false) {
  const opts = syllabus.papers.map((p) => ({ value: p.id, label: p.short || p.name }));
  return withAll ? [{ value: "all", label: "All" }, ...opts] : opts;
}

export function levelFilter(level) {
  return (q) => level === "HL" || q.level !== "HL";
}
