// Calls the IBCommons AI backend (Supabase Edge Function "ai").
// The Anthropic API key never reaches the browser.
import { CONFIG, DEMO_MODE } from "./config.js";
import { getAccessToken } from "./auth.js";

export const AI_ENABLED = !DEMO_MODE;

export async function callAI(body) {
  if (!AI_ENABLED) throw new Error("AI features are off in demo mode.");
  const token = await getAccessToken();
  if (!token) throw new Error("Please log in again.");
  const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: CONFIG.SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The AI service returned an error (${res.status}).`);
  return data;
}

/** The parts of a question the AI needs (no images). */
export function questionForAI(q) {
  return {
    id: q.id,
    subtopics: q.subtopics,
    stem: q.stem || "",
    options: q.isMCQ ? q.options : undefined,
    answer: q.isMCQ ? q.answer : undefined,
    markscheme: q.markscheme,
    parts: q.isMCQ ? undefined : q.parts.map((p) => ({ label: p.label, text: p.text, marks: p.marks, markscheme: p.markscheme, answer: p.answer })),
  };
}
