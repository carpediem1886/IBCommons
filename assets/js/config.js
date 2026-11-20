// IBCommons configuration.
//
// Leave SUPABASE_URL empty to run in demo mode: accounts are kept only in the
// browser and the AI features (answer checking for written answers, AI tutor)
// are switched off. Fill these in once you have created a free Supabase
// project — see README.md, "Connect Supabase".
//
// The anon key is designed to be public, so it is safe to commit it here.
// NEVER put your Anthropic API key in this file: it lives only in Supabase
// as a secret used by supabase/functions/ai.

export const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Show a "Continue with Google" button (enable the Google provider in Supabase first).
  GOOGLE_SIGN_IN: false,

  // Link shown in the footer.
  REPO_URL: "https://github.com/carpediem1886/IBCommons",
};

export const DEMO_MODE = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
