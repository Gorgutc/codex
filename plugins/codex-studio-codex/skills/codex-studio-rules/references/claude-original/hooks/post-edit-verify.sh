#!/usr/bin/env bash
# After any Edit/Write/MultiEdit to shipped code, auto-run verify-frozen.js.
#
# Baseline-aware logic (v0.8.x):
#   - If verify-frozen exits clean → PASS, print summary.
#   - If verify-frozen exits with FAILs → compare to KNOWN_BASELINE set
#     (8 cloud-env CDN/TLS failures documented in SessionStart hook).
#     If every FAIL is in the baseline → PASS (warn only, no block).
#     If any FAIL is NOT in the baseline → BLOCK (exit 2) and print the
#     regression(s) so Claude must fix.
#
# In CI / local dev where the CDN allowlist is open, all 56/56 PASS and the
# old fast-path runs unchanged. The baseline check only matters in sandboxed
# cloud environments.

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

# Known cloud-env baseline failures (closed CDN allowlist + TLS interception).
# Format: "[scope] TEST-NAME" (must match the "Failures:" block in verify-frozen
# output exactly, minus the trailing colon and any reason text).
#
# v0.8.x — baseline is empty: GSAP / ScrollTrigger / SplitText / Lenis are now
# vendored in ./js/vendor/ (npm registry was the only CDN-style host in the
# allowlist), and verify-frozen.js CONSOLE filter was widened to ignore
# fontshare / cloudflare / ERR_CERT_AUTHORITY_INVALID TLS noise. The mechanism
# stays in place so any future cloud-env shift (e.g. fontshare lockdown) can
# be added here without changing the regression itself.
KNOWN_BASELINE=''

# Run the regression. Capture output.
cd "$CLAUDE_PROJECT_DIR"
if OUTPUT=$(node verify-frozen.js 2>&1); then
  SUMMARY=$(printf '%s' "$OUTPUT" | grep -oE 'SUMMARY:[[:space:]]+[0-9]+/[0-9]+[[:space:]]+PASS' | tail -1 || echo "PASS (count unknown)")
  echo "verify-frozen.js: $SUMMARY"
  exit 0
fi

# Some tests failed. Parse the "Failures:" block to get exact [scope] testName lines.
ACTUAL=$(printf '%s\n' "$OUTPUT" \
  | awk '/^Failures:/{flag=1; next} flag {print}' \
  | sed -E 's/^[[:space:]]*//; s/:[[:space:]].*$//; s/:$//' \
  | grep -E '^\[(index|fa)\] ' || true)

if [ -z "$ACTUAL" ]; then
  # Verify-frozen exited non-zero but we couldn't parse a Failures block —
  # likely a runtime crash. Block with full output.
  echo "verify-frozen.js FAILED after editing $FILE (no parseable Failures block)" >&2
  printf '%s\n' "$OUTPUT" | tail -20 >&2
  echo "" >&2
  echo "Revert the change or fix the failing tests before continuing." >&2
  exit 2
fi

# Diff ACTUAL against KNOWN_BASELINE. Anything in ACTUAL not in baseline = regression.
REGRESSIONS=$(printf '%s\n' "$ACTUAL" | grep -vxF -f <(printf '%s\n' "$KNOWN_BASELINE") || true)

if [ -z "$REGRESSIONS" ]; then
  # All FAILs are documented baseline. Emit a warning summary, do NOT block.
  SUMMARY=$(printf '%s' "$OUTPUT" | grep -oE 'SUMMARY:[[:space:]]+[0-9]+/[0-9]+[[:space:]]+PASS,[[:space:]]+[0-9]+[[:space:]]+FAIL' | tail -1 || echo "")
  COUNT=$(printf '%s\n' "$ACTUAL" | wc -l | tr -d ' ')
  echo "verify-frozen.js: ${SUMMARY:-baseline-only} — ${COUNT} cloud-env baseline fails, NO regressions"
  exit 0
fi

# Real regression detected. Block.
echo "verify-frozen.js REGRESSION after editing $FILE" >&2
echo "Tests that are FAILing but are NOT in the documented cloud-env baseline:" >&2
printf '%s\n' "$REGRESSIONS" | sed 's/^/  /' >&2
echo "" >&2
echo "Revert the change or fix these tests before continuing." >&2
exit 2
