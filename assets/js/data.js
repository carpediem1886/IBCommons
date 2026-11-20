// Loads subject content from the /content folder (plain JSON files).
const cache = new Map();

async function getJSON(path, fallback) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : fallback))
    .catch(() => fallback);
  cache.set(path, p);
  return p;
}

const base = (subject, program) => `content/${subject}/${program}`;

export const loadSubjects = () => getJSON("content/subjects.json", []);
export const loadSyllabus = (subject, program) => getJSON(`${base(subject, program)}/syllabus.json`, null);
export const loadIndex = (subject, program) =>
  getJSON(`${base(subject, program)}/index.json`, { questions: {}, revision: {} });

/** All questions tagged with any of the given sub-topic codes (deduplicated by id). */
export async function loadQuestions(subject, program, codes) {
  const index = await loadIndex(subject, program);
  const files = [...new Set(codes)].filter((c) => index.questions?.[c]);
  const lists = await Promise.all(files.map((c) => getJSON(`${base(subject, program)}/questions/${c}.json`, [])));
  const wanted = new Set(codes);
  const seen = new Map();
  for (const q of lists.flat()) {
    if (!q || seen.has(q.id)) continue;
    if ((q.subtopics || []).some((c) => wanted.has(c))) seen.set(q.id, normaliseQuestion(q));
  }
  return [...seen.values()];
}

export const loadLesson = (subject, program, code) =>
  getJSON(`${base(subject, program)}/revision/${code}.json`, null);

/** Fill in totals so every question has .marks and .parts. */
export function normaliseQuestion(q) {
  const out = { level: "SL", ...q };
  out.isMCQ = Array.isArray(q.options) && q.options.length > 0;
  if (!out.isMCQ && (!q.parts || q.parts.length === 0)) {
    out.parts = [{ label: "", text: "", marks: q.marks || 1, answer: q.answer, markscheme: q.markscheme || [] }];
  }
  if (!out.marks) out.marks = out.isMCQ ? 1 : out.parts.reduce((s, p) => s + (p.marks || 0), 0);
  return out;
}

/** Flatten a syllabus into [{code, title, topic, hl}] */
export function allSubtopics(syllabus) {
  return syllabus.topics.flatMap((t) => t.subtopics.map((s) => ({ ...s, topic: t })));
}
