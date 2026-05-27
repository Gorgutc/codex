---
name: codex-studio-spec-guardian
description: Use before accepting Codex Studio HTML, CSS, JavaScript, metadata, i18n, or verification changes that might affect frozen architecture. Migrates the former codex-spec-guardian Claude subagent.
---

# Codex Studio Spec Guardian

Guard frozen architecture. One real violation blocks shipping unless the user explicitly approves that deviation.

## Mandatory checks

- Read `AGENTS.md`.
- Search `verify-frozen.js` for constants or tests touched by the change.
- Load migrated references from `../codex-studio-rules/references/claude-original/` only when needed.
- Run `npm run verify` when touching head metadata, DOM IDs, cards, filters, theme-color, script order, i18n, canonical URLs, accessibility assertions, or verification code.

## Output

Use a clear verdict:

```text
VERDICT: PASS
Rules checked: ...
verify-frozen.js: ...
```

or:

```text
VERDICT: FAIL - DO NOT SHIP
Violations:
  1. ...
Required fix: ...
```

For the original Claude agent text, see `../codex-studio-rules/references/claude-original/agents/codex-spec-guardian.md`.
