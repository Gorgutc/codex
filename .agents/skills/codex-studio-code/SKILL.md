---
name: codex-studio-code
description: Use for Codex Studio HTML, CSS, or vanilla JS generation, review, refactor, dead-code audit, bug fixing, and shipped-code quality gates. Trigger on code changes, cleanup, optimize, review, audit, dead code, sidebar, work cards, case view, free assets, i18n, theme, filters, or 3D behavior.
---

# Codex Studio Code

## Quick Workflow

1. Read `AGENTS.md`, then `docs/agent/architecture.md`, `docs/agent/code_review.md`, and `docs/agent/verification.md`.
2. For broad work, use the agent contracts in `.codex/agents/`.
3. Identify whether the change touches shipped code: `index.html`, `free-assets.html`, `verify-frozen.js`, `css/*.css`, non-vendor `js/*.js`, or `js/vendor/codex-three-viewer.js`.
4. Preserve frozen behavior unless the user explicitly requests an architecture change.
5. Run `npm run verify` after shipped-code edits.

## Non-Negotiables

- Vanilla HTML/CSS/JS only.
- Classic scripts only; no `defer`, no `type="module"` for first-party page scripts.
- No browser storage.
- Keep `model-data.js` and `<model-viewer>` lazy-loaded.
- Keep bilingual i18n intact; Russian UI is expected after runtime language switching.
- Do not add new `font-size: Npx`; respect the frozen budget.
- Do not delete code merely because static search looks quiet; prove it is unreachable or mark it for runtime validation.

## Output

For reviews, lead with findings and file references. For implementation, keep edits scoped and report verification status.
