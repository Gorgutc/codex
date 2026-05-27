#!/usr/bin/env bash
# Injects a compact frozen-rules summary into the session context at start.
# Output schema: hookSpecificOutput.additionalContext (per current Claude Code spec).

set -euo pipefail

# Consume stdin if any; ignore content. `read` returns 1 on EOF — `|| true` swallows it.
IFS= read -r _STDIN || true

cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Codex Studio v0.8 GOLDEN. Source of truth: verify-frozen.js (56 tests; in cloud envs with closed CDN allowlist baseline may show 48/56 — see PR for details). Stack frozen: vanilla HTML+CSS+JS, GSAP 3.13.0 via CDN, no frameworks/npm-runtime. All scripts before </body>, no defer, no type=module. Script order: gsap → ScrollTrigger → SplitText → main.js → animations.js. Exactly 1 <meta name=theme-color> without media=. 18 work-cards with fixed data-id (EXPECTED_IDS). CSS files: tokens.css, reset.css, shared.css, portfolio-core.css + portfolio-case.css (index), free-assets.css (FA). Colors only via tokens.css. Dark mode hardcoded via <body data-theme=dark>. No localStorage/sessionStorage. No px for font-size. Mobile-first. For any change touching index.html / free-assets.html / css / js / verify-frozen.js: invoke /ship before writing files. Full rules: CLAUDE.md and .claude/prompt_instructions.md."
  }
}
JSON

exit 0
