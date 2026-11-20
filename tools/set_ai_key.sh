#!/bin/zsh
# Stores the Anthropic API key as a Supabase secret for the "ai" function.
# The key is read with hidden input and is never written to disk or shell history.
set -e
cd "$(dirname "$0")/.."
SUPABASE="${SUPABASE:-$HOME/.local/bin/supabase}"

read -rs "KEY?Paste your Anthropic API key (input is hidden) and press Enter: "
echo
if [[ "$KEY" != sk-ant-* ]]; then
  echo "That doesn't look like an Anthropic API key (it should start with sk-ant-). Nothing was saved."
  exit 1
fi
read -r "LIMIT?Daily AI requests per student [60]: "
LIMIT=${LIMIT:-60}

"$SUPABASE" secrets set --yes --env-file <(printf 'ANTHROPIC_API_KEY=%s\nAI_DAILY_LIMIT=%s\n' "$KEY" "$LIMIT")
unset KEY
echo "Done. The AI tutor can now use your key."
