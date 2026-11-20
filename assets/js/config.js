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
  SUPABASE_URL: "https://uypgtlsltstndlhknqoh.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_GrWE4Sc4Mh21IjgSDUao-g_VR1mmT37",

  // AI tutor and AI marking of written answers. Needs an Anthropic API key stored in
  // Supabase (run tools/set_ai_key.sh), which is paid per use. While false, the site is
  // completely free to run: written answers are self-marked against the markscheme.
  AI_ENABLED: false,

  // Show a "Continue with Google" button (enable the Google provider in Supabase first).
  GOOGLE_SIGN_IN: false,

  // Link shown in the footer.
  REPO_URL: "https://github.com/carpediem1886/IBCommons",
};

export const DEMO_MODE = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
