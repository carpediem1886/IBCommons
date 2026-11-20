// Accounts. Uses Supabase Auth when configured, otherwise a browser-only demo account.
import { CONFIG, DEMO_MODE } from "./config.js";

let supabase = null;
let currentUser = null; // { id, email, name, program }
const listeners = new Set();
const DEMO_KEY = "ibc:demo-user";

export function onAuthChange(fn) { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn(currentUser)); }

function fromSupabaseUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name || u.email?.split("@")[0] || "Student",
    program: u.user_metadata?.program || null,
  };
}

export async function initAuth() {
  if (DEMO_MODE) {
    try { currentUser = JSON.parse(localStorage.getItem(DEMO_KEY)) || null; } catch { currentUser = null; }
    return currentUser;
  }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  const { data } = await supabase.auth.getSession();
  currentUser = fromSupabaseUser(data.session?.user);
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = fromSupabaseUser(session?.user);
    emit();
  });
  return currentUser;
}

export function getUser() { return currentUser; }
export function getSupabase() { return supabase; }

export async function getAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function signUp({ name, email, password }) {
  if (DEMO_MODE) return demoLogin(name, email);
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name }, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
  if (!data.session) return { needsConfirmation: true };
  currentUser = fromSupabaseUser(data.user);
  emit();
  return { user: currentUser };
}

export async function signIn({ email, password }) {
  if (DEMO_MODE) return demoLogin(null, email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = fromSupabaseUser(data.user);
  emit();
  return { user: currentUser };
}

export async function signInWithGoogle() {
  if (DEMO_MODE) throw new Error("Google sign-in needs Supabase to be configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function resetPassword(email) {
  if (DEMO_MODE) throw new Error("Password reset needs Supabase to be configured.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}

export async function signOut() {
  if (DEMO_MODE) localStorage.removeItem(DEMO_KEY);
  else await supabase.auth.signOut();
  currentUser = null;
  emit();
}

export async function setProgram(program) {
  if (!currentUser) return;
  if (DEMO_MODE) {
    currentUser = { ...currentUser, program };
    localStorage.setItem(DEMO_KEY, JSON.stringify(currentUser));
  } else {
    const { data, error } = await supabase.auth.updateUser({ data: { program } });
    if (error) throw error;
    currentUser = fromSupabaseUser(data.user);
  }
  emit();
}

function demoLogin(name, email) {
  // Demo accounts are not secure and exist only in this browser.
  let existing = null;
  try { existing = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { /* ignore */ }
  const keep = existing && existing.email === email ? existing : null;
  currentUser = keep || { id: "demo-" + btoa(email).replace(/=/g, ""), email, name: name || email.split("@")[0], program: null };
  if (name) currentUser.name = name;
  localStorage.setItem(DEMO_KEY, JSON.stringify(currentUser));
  emit();
  return { user: currentUser };
}
