// IBCommons single-page app: routing, layout and the simple pages.
import { CONFIG, DEMO_MODE } from "./config.js";
import * as auth from "./auth.js";
import { loadSubjects, loadSyllabus } from "./data.js";
import { $, esc, emptyState } from "./util.js";
import { renderGenerator } from "./generator.js";
import { renderStudy } from "./study.js";
import { renderRevisionList, renderLesson } from "./revision.js";
import { AI_ENABLED } from "./ai.js";

const view = $("#view");
const PROGRAMS = {
  dp: { id: "dp", short: "DP", name: "Diploma Programme", ages: "Ages 16–19" },
  myp: { id: "myp", short: "MYP", name: "Middle Years Programme", ages: "Ages 11–16" },
};
const TOOLS = [
  {
    id: "generator", name: "Paper Generator",
    blurb: "Build a practice paper from the topics you choose. Download the paper and its markscheme as PDFs.",
    icon: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  },
  {
    id: "study", name: "Open Study",
    blurb: AI_ENABLED
      ? "Work through every question on a topic, check your answers against the markscheme, and ask the AI tutor for hints."
      : "Work through every question on a topic and check your answers against the markscheme as you go.",
    icon: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  },
  {
    id: "revision", name: "Topic Revision",
    blurb: "Step-by-step lessons for each topic and sub-topic, with diagrams and quick checks as you go.",
    icon: '<svg viewBox="0 0 24 24"><path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg>',
  },
];

// ---------- Routing ----------
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  return parts;
}

async function router() {
  const user = auth.getUser();
  const parts = parseRoute();
  renderNav(user, parts);
  window.scrollTo(0, 0);
  const [first, subject, tool, extra] = parts;

  if (!first) return user ? go(user.program ? `/${user.program}` : "/program") : renderLanding();
  if (first === "login" || first === "signup") return user ? go(user.program ? `/${user.program}` : "/program") : renderAuth(first);
  if (!user) return go("/login");
  if (first === "program") return renderProgramPick(user);
  if (!PROGRAMS[first]) return renderNotFound();
  if (user.program !== first) await auth.setProgram(first).catch(() => {});

  const program = PROGRAMS[first];
  if (!subject) return renderSubjects(program);
  const subjects = await loadSubjects();
  const subj = subjects.find((s) => s.id === subject);
  if (!subj) return renderNotFound();
  const syllabus = await loadSyllabus(subject, program.id);
  if (!syllabus) {
    view.innerHTML = emptyState(`${subj.name} for ${program.short} is coming soon`, "Content for this subject has not been added yet.");
    return;
  }
  const ctx = { user, program, subject: subj, syllabus, view };
  if (!tool) return renderSubjectHome(ctx);
  if (tool === "generator") return renderGenerator(ctx);
  if (tool === "study") return renderStudy(ctx);
  if (tool === "revision") return extra ? renderLesson(ctx, extra) : renderRevisionList(ctx);
  return renderNotFound();
}

export function go(path) {
  if (location.hash === "#" + path) router();
  else location.hash = path;
}

// ---------- Layout ----------
function renderNav(user, parts) {
  const nav = $("#nav");
  if (!user) {
    nav.innerHTML = `<a href="#/login">Log in</a><a class="btn btn-primary btn-sm" href="#/signup">Create account</a>`;
    return;
  }
  const prog = PROGRAMS[parts[0]] || PROGRAMS[user.program];
  const subj = parts[1];
  const links = [];
  if (prog && subj) {
    for (const t of TOOLS) {
      links.push(`<a href="#/${prog.id}/${subj}/${t.id}" class="${parts[2] === t.id ? "active" : ""}">${t.name}</a>`);
    }
  }
  nav.innerHTML = `${links.join("")}
    ${prog ? `<a href="#/program" title="Change programme"><span class="chip teal">${prog.short}</span></a>` : ""}
    <a href="#" id="signout" title="${esc(user.email)}">Log out</a>`;
  $("#signout").onclick = async (e) => { e.preventDefault(); await auth.signOut(); go("/"); };
}

// ---------- Pages ----------
function renderLanding() {
  view.innerHTML = `
    <section class="hero">
      <div>
        <div class="label">Open-source · Free · Built by students</div>
        <h1>Practise IB Physics with a questionbank everyone can use.</h1>
        <p class="lead">Generate practice papers with markschemes, work through questions with instant checking${AI_ENABLED ? " and an AI tutor that guides you step by step" : ""}, and revise each topic with visual lessons.</p>
        <div class="btn-row">
          <a class="btn btn-cta" href="#/signup">Get started free</a>
          <a class="btn btn-ghost" href="#/login">I have an account</a>
        </div>
        <p class="small muted" style="margin-top:14px">For MYP and DP students. More subjects coming soon.</p>
      </div>
      <div class="hero-art"><img src="assets/brand/IBCommons-mark-color.svg" alt="" width="300" height="300"></div>
    </section>
    <section class="grid grid-3">
      ${TOOLS.map((t) => `
        <div class="card feature-card">
          <div class="feature-icon">${t.icon}</div>
          <h3>${t.name}</h3>
          <p class="muted">${t.blurb}</p>
        </div>`).join("")}
    </section>`;
}

function renderAuth(mode) {
  const isSignup = mode === "signup";
  view.innerHTML = `
    <div class="auth-box card">
      <img class="stack-logo" src="assets/brand/IBCommons-stacked-color.svg" alt="IBCommons">
      <h2 style="text-align:center">${isSignup ? "Create your account" : "Welcome back"}</h2>
      ${DEMO_MODE ? `<div class="notice warn small">Demo mode: any email works and nothing leaves this browser.</div>` : ""}
      <form id="auth-form">
        ${isSignup ? `<label class="field"><span>Your name</span><input type="text" name="name" required autocomplete="name"></label>` : ""}
        <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
        <label class="field"><span>Password</span><input type="password" name="password" required minlength="8" autocomplete="${isSignup ? "new-password" : "current-password"}"></label>
        <div id="auth-msg"></div>
        <button class="btn btn-primary" style="width:100%" type="submit">${isSignup ? "Create account" : "Log in"}</button>
      </form>
      ${CONFIG.GOOGLE_SIGN_IN && !DEMO_MODE ? `<button class="btn btn-ghost" id="google" style="width:100%;margin-top:10px">Continue with Google</button>` : ""}
      <p class="small muted" style="text-align:center;margin-top:16px">
        ${isSignup ? `Already have an account? <a href="#/login">Log in</a>` : `New here? <a href="#/signup">Create an account</a>${DEMO_MODE ? "" : ` · <a href="#" id="forgot">Forgot password?</a>`}`}
      </p>
    </div>`;
  const form = $("#auth-form");
  const msg = $("#auth-msg");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector("button");
    btn.disabled = true;
    msg.innerHTML = "";
    try {
      const res = isSignup ? await auth.signUp(data) : await auth.signIn(data);
      if (res.needsConfirmation) {
        msg.innerHTML = `<div class="notice ok">Check your inbox to confirm your email, then log in.</div>`;
      } else {
        go(res.user.program ? `/${res.user.program}` : "/program");
      }
    } catch (err) {
      msg.innerHTML = `<div class="notice bad">${esc(err.message || "Something went wrong.")}</div>`;
    } finally { btn.disabled = false; }
  };
  const g = $("#google");
  if (g) g.onclick = () => auth.signInWithGoogle().catch((err) => { msg.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; });
  const f = $("#forgot");
  if (f) f.onclick = async (e) => {
    e.preventDefault();
    const email = form.email.value;
    if (!email) { msg.innerHTML = `<div class="notice info">Type your email above first.</div>`; return; }
    try { await auth.resetPassword(email); msg.innerHTML = `<div class="notice ok">We sent you a reset link.</div>`; }
    catch (err) { msg.innerHTML = `<div class="notice bad">${esc(err.message)}</div>`; }
  };
}

function renderProgramPick(user) {
  view.innerHTML = `
    <div style="max-width:640px;margin:0 auto">
      <div class="label">Hi ${esc(user.name)}</div>
      <h1>Which programme are you in?</h1>
      <p class="muted">You can switch at any time from the menu.</p>
      <div class="program-pick">
        ${Object.values(PROGRAMS).reverse().map((p) => `
          <button data-p="${p.id}" class="${user.program === p.id ? "on" : ""}">
            <b>${p.short}</b><span>${p.name}</span><br><span class="small muted">${p.ages}</span>
          </button>`).join("")}
      </div>
    </div>`;
  view.querySelectorAll("[data-p]").forEach((b) => {
    b.onclick = async () => { await auth.setProgram(b.dataset.p); go(`/${b.dataset.p}`); };
  });
}

async function renderSubjects(program) {
  const subjects = await loadSubjects();
  const list = subjects.filter((s) => s.programs.includes(program.id));
  // With only one live subject, go straight to it.
  const live = list.filter((s) => s.status === "live");
  if (live.length === 1 && !sessionStorage.getItem("ibc:show-subjects")) {
    sessionStorage.setItem("ibc:show-subjects", "1");
    return go(`/${program.id}/${live[0].id}`);
  }
  view.innerHTML = `
    <div class="page-head"><div><div class="label">${program.name}</div><h1>Choose a subject</h1></div></div>
    <div class="grid grid-3">
      ${list.map((s) => s.status === "live"
        ? `<a class="card feature-card" href="#/${program.id}/${s.id}"><div class="label">${esc(s.group)}</div><h3>${esc(s.name)}</h3><p class="muted small">Questionbank, paper generator and revision.</p></a>`
        : `<div class="card" style="opacity:.6"><div class="label">${esc(s.group)}</div><h3>${esc(s.name)}</h3><p class="small muted">Coming soon</p></div>`).join("")}
    </div>`;
}

function renderSubjectHome({ program, subject, syllabus }) {
  view.innerHTML = `
    <div class="page-head">
      <div><div class="label">${program.short} · ${esc(subject.name)}</div><h1>What do you want to do?</h1></div>
      <a class="btn btn-ghost btn-sm" href="#/${program.id}" onclick="sessionStorage.setItem('ibc:show-subjects','1')">All subjects</a>
    </div>
    <div class="grid grid-3">
      ${TOOLS.map((t) => `
        <a class="card feature-card" href="#/${program.id}/${subject.id}/${t.id}">
          <div class="feature-icon">${t.icon}</div>
          <h3>${t.name}</h3>
          <p class="muted">${t.blurb}</p>
        </a>`).join("")}
    </div>
    <h3 style="margin-top:40px">Syllabus</h3>
    <p class="muted small">${esc(syllabus.note || "")}</p>
    <div class="grid grid-3">
      ${syllabus.topics.map((tp) => `
        <div class="card" style="padding:18px">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><span class="topic-letter">${esc(tp.code)}</span><b>${esc(tp.title)}</b></div>
          <div class="small muted">${tp.subtopics.map((s) => `${esc(s.code)} ${esc(s.title)}${s.hl ? ' <span class="hl-tag">HL</span>' : ""}`).join("<br>")}</div>
        </div>`).join("")}
    </div>`;
}

function renderNotFound() {
  view.innerHTML = emptyState("Page not found", `<a href="#/">Go home</a>`);
}

// ---------- Start ----------
(async function start() {
  if (DEMO_MODE) $("#demo-banner").classList.remove("hidden");
  $("#repo-link").href = CONFIG.REPO_URL;
  try { await auth.initAuth(); } catch (err) { console.error(err); }
  // Re-render only when someone logs in or out (not on every profile update).
  let loggedIn = !!auth.getUser();
  auth.onAuthChange((u) => { if (!!u !== loggedIn) { loggedIn = !!u; router(); } });
  window.addEventListener("hashchange", router);
  router();
})();
