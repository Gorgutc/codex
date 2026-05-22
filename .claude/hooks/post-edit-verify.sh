#!/usr/bin/env bash
# After any Edit/Write/MultiEdit to shipped code, auto-run verify-frozen.js.
# On test failure: exit 2 with the failure summary so Claude must fix.

set -euo pipefail

INPUT="$(cat)"

TOOL=""
FILE=""

if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
  FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || echo "")
fi

# Only fire on actual file-writing tools
case "$TOOL" in
  Edit|Write|MultiEdit) ;;
  *) exit 0 ;;
esac

# Skip the giant base64 GLB blob — it's lazy-loaded data, never touched by hand.
case "$FILE" in
  *model-data.js) exit 0 ;;
esac

# Only fire on shipped code paths. Patterns cover both absolute paths
# (Edit/Write give absolute file_path in real use) and relative ones (used in tests).
SHIPPED=0
case "$FILE" in
  *index.html|*free-assets.html|*verify-frozen.js) SHIPPED=1 ;;
  */css/*.css|css/*.css) SHIPPED=1 ;;
  */js/*.js|js/*.js) SHIPPED=1 ;;
esac

if [ "$SHIPPED" -eq 0 ]; then
  exit 0
fi

# Make sure node + verify-frozen.js are present
if ! command -v node >/dev/null 2>&1; then
  echo "node not found; skipping verify-frozen.js" >&2
  exit 0
fi

if [ ! -f "$CLAUDE_PROJECT_DIR/verify-frozen.js" ]; then
  echo "verify-frozen.js not in project root; skipping" >&2
  exit 0
fi

# Run the regression. Capture output.
cd "$CLAUDE_PROJECT_DIR"
if OUTPUT=$(node verify-frozen.js 2>&1); then
  # verify-frozen.js prints "SUMMARY: N/N PASS, M FAIL" — match that.
  SUMMARY=$(printf '%s' "$OUTPUT" | grep -oE 'SUMMARY:[[:space:]]+[0-9]+/[0-9]+[[:space:]]+PASS' | tail -1 || echo "PASS (count unknown)")
  echo "verify-frozen.js: $SUMMARY"
  exit 0
fi

# Test failed. Surface a compact failure summary to Claude.
echo "verify-frozen.js FAILED after editing $FILE" >&2
printf '%s\n' "$OUTPUT" | grep -E "^\s*\[FAIL\]|FAIL\]" | head -10 >&2
echo "" >&2
echo "Revert the change or fix the failing tests before continuing." >&2
exit 2
