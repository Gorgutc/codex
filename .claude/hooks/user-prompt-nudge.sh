#!/usr/bin/env bash
# If the user's prompt looks like a code-generation request, inject a /ship reminder.
# Detects EN + RU keywords. Conservative: only nudges, never blocks.
# Output schema: hookSpecificOutput.additionalContext (per current Claude Code spec).

set -euo pipefail

INPUT="$(cat)"

# Extract user prompt text. Fall back to empty if jq absent or field missing.
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // .user_prompt // empty' 2>/dev/null || echo "")
fi

# Lowercase for case-insensitive match
LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Match common code-task verbs in EN and RU. False positives are cheap; false negatives cost quality.
NEEDS_NUDGE=0
for word in "create" "build" "write code" "add a" "add the" "implement" "refactor" "сверста" "напиши" "создай" "добавь" "верстай" "сделай блок" "сделай секци" "поправь" "ship" "deploy"; do
  case "$LOWER" in
    *"$word"*) NEEDS_NUDGE=1; break ;;
  esac
done

if [ "$NEEDS_NUDGE" -eq 1 ]; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[automated reminder] This task looks like a code change. Before showing the result to the user, invoke /ship to run codex-spec-guardian + codex-quality-gate + codex-context-keeper in parallel. The PostToolUse hook will then auto-run verify-frozen.js. Do not skip /ship for code touching index.html, free-assets.html, css/, js/, or verify-frozen.js."
  }
}
JSON
fi

exit 0
