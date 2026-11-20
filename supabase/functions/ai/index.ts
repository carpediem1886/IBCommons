// IBCommons AI backend (Supabase Edge Function, Deno).
//
// Two modes:
//   "mark"  – marks a student's written answer to one question part against the markscheme.
//   "tutor" – a Socratic tutor that guides the student step by step without giving the answer.
//
// Secrets (set with `supabase secrets set ...`):
//   ANTHROPIC_API_KEY   required
//   AI_DAILY_LIMIT      optional, AI requests per student per day (default 60)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.

import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? 60);

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- Prompts ----------
const TUTOR_SYSTEM = `You are the IBCommons tutor, helping an International Baccalaureate (MYP or DP) student work through one practice question.

How you teach:
- Never state the final answer, the final numerical value, or the full worked solution, even if the student asks directly or says they have given up. Explain kindly that working it out themselves is how they will remember it, and give a stronger hint instead.
- Work one small step at a time. Each reply should do one thing: ask a guiding question, point out a relevant principle or equation, or check the student's last step. End most replies with a single question for the student to answer.
- First find out where the student is: what they already know, or what they have tried. Build on their own working.
- When the student makes a mistake, don't just correct it. Ask a question that helps them notice it (for example, about units, signs, directions, or which quantity a symbol stands for).
- When they get a step right, say so briefly and specifically, then move on.
- Use the IB command terms correctly (state, calculate, determine, explain, outline, suggest) and remind the student what the command term requires when that helps.
- Keep replies short: two to five sentences. Plain text only, no Markdown headings or tables. Write maths in LaTeX between $ signs, e.g. $F = ma$, $3.0\\text{ m s}^{-1}$.
- Stay on this question and the physics behind it. If the student goes off topic, steer back gently.
- Once the student reaches the correct final answer by themselves, congratulate them and offer one short follow-up question that checks their understanding.

You are given the question and its markscheme below. The markscheme is for you only: use it to judge the student's steps, but do not quote it or reveal its answers.`;

const MARK_SYSTEM = `You are an experienced IB examiner marking one part of a practice question for a student.
Mark strictly against the markscheme, the way an IB examiner would:
- Award one mark for each marking point the answer clearly meets. Accept equivalent wording, correct alternative methods, and answers that differ only by rounding.
- Do not award marks for vague statements, for a correct final answer that contradicts the student's own working, or for points that are not in the answer.
- Never award more than the maximum marks for the part.
Then write feedback for the student in two or three sentences: say what earned marks, and give a hint about what is missing without writing out the missing answer or the final value.
Write maths in LaTeX between $ signs.`;

type Part = { label?: string; text?: string; marks?: number; markscheme?: string[]; answer?: unknown };
type Question = { stem?: string; options?: string[]; answer?: string; markscheme?: string[]; parts?: Part[]; subtopics?: string[] };

function describeQuestion(q: Question) {
  const lines = [`Sub-topic(s): ${(q.subtopics ?? []).join(", ")}`, `Question: ${q.stem ?? ""}`];
  if (q.options?.length) {
    q.options.forEach((o, i) => lines.push(`${String.fromCharCode(65 + i)}. ${o}`));
    lines.push(`[Markscheme] Correct option: ${q.answer}. ${(q.markscheme ?? []).join(" ")}`);
  }
  for (const p of q.parts ?? []) {
    lines.push(`\nPart (${p.label ?? ""}) [${p.marks ?? "?"} marks]: ${p.text ?? ""}`);
    lines.push(`[Markscheme] ${(p.markscheme ?? []).map((m) => "• " + m).join(" ")}`);
    if (p.answer !== undefined) lines.push(`[Final answer] ${JSON.stringify(p.answer)}`);
  }
  return lines.join("\n");
}

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

// ---------- Handlers ----------
async function tutor(body: { question: Question; studentAttempts?: string[]; messages?: { role: string; content: string }[] }) {
  const history = (body.messages ?? []).slice(-30)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: clip(m.content, 2000) }));
  if (!history.length || history[0].role !== "user") return json({ error: "The conversation must start with the student." }, 400);

  const attempts = (body.studentAttempts ?? []).map((a) => clip(a, 1500)).filter(Boolean);
  const context = describeQuestion(body.question) +
    (attempts.length ? `\n\nWhat the student has written in the answer boxes so far:\n${attempts.map((a) => "- " + a).join("\n")}` : "");

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: TUTOR_SYSTEM },
      { type: "text", text: context },
    ],
    messages: history,
  });

  if (response.stop_reason === "refusal") {
    return json({ reply: "Sorry, I can't help with that one. Let's get back to the physics: which quantities does the question give you?" });
  }
  const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  return json({ reply: reply || "Can you tell me what you've tried so far?" });
}

const MarkResult = z.object({
  marksAwarded: z.number().int(),
  feedback: z.string(),
});

async function mark(body: { question: Question; partIndex: number; studentAnswer: string }) {
  const part = body.question.parts?.[body.partIndex];
  if (!part) return json({ error: "Unknown question part." }, 400);
  const max = Number(part.marks ?? 1);

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium", format: zodOutputFormat(MarkResult) },
    system: MARK_SYSTEM,
    messages: [{
      role: "user",
      content:
        `${describeQuestion(body.question)}\n\nMark ONLY part (${part.label ?? ""}), worth ${max} marks.\n\n` +
        `<student_answer>\n${clip(body.studentAnswer, 4000)}\n</student_answer>`,
    }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return json({ error: "The answer could not be marked automatically. Compare it with the markscheme instead." }, 422);
  }
  const { marksAwarded, feedback } = response.parsed_output;
  return json({ marksAwarded: Math.max(0, Math.min(max, marksAwarded)), max, feedback });
}

// ---------- Entry point ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Only signed-in students may use the AI.
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "Please log in to use the AI tutor." }, 401);

  // Per-student daily limit, so one account can't run up the bill.
  const { data: used, error: usageErr } = await admin.rpc("bump_ai_usage", { p_user: user.id });
  if (usageErr) console.error("usage counter:", usageErr.message);
  if (typeof used === "number" && used > DAILY_LIMIT) {
    return json({ error: `You've reached today's limit of ${DAILY_LIMIT} AI requests. It resets at midnight (UTC).` }, 429);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (!body?.question) return json({ error: "Missing question." }, 400);

  try {
    if (body.mode === "tutor") return await tutor(body);
    if (body.mode === "mark") return await mark(body);
    return json({ error: "Unknown mode." }, 400);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "The tutor is busy right now. Try again in a minute." }, 429);
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return json({ error: "The AI service had a problem. Please try again." }, 502);
    }
    console.error(err);
    return json({ error: "Something went wrong." }, 500);
  }
});
