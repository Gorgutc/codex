# Codex Studio

Static portfolio site for a 3D design studio.

## Stack

- Vanilla HTML, CSS, and JavaScript
- No runtime framework, no bundler, no build step
- GSAP, ScrollTrigger, SplitText, and Lenis vendored under `js/vendor/`
- Playwright, ESLint, Stylelint, HTMLHint, Knip, JSCPD, Pa11y, Lighthouse CI, CSpell, Markdownlint, and dependency-cruiser are dev-only quality tools

## Local Setup

```bash
npm install
npx playwright install chromium
npm run codex:ship
```

Expected verification: `npm run codex:ship` exits cleanly, and `npm run verify` reports `0 FAIL`. The pass total can change as the suite grows.

If Chromium cannot start inside a sandbox with `spawn EPERM`, rerun verification outside the sandbox.

## Key Files

```text
index.html
free-assets.html
verify-frozen.js
css/
js/
assets/
downloads/
plugins/codex-studio-codex/
AGENTS.md
RUN_INSTRUCTIONS.md
DO_NOT_PUSH.md
```

`verify-frozen.js` is the architecture gate. Any site change should preserve a green `npm run codex:ship`.

## Codex Workflow

This repository has migrated from Claude Code to Codex.

- `AGENTS.md` is the active source of truth.
- `plugins/codex-studio-codex/` contains repo-local Codex skills.
- Former Claude files are preserved as migrated references under `plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.
- `.claude` is no longer an active configuration directory.

Use a `codex/*` branch for every task, push it to GitHub, and open a draft PR.

## Useful Commands

```bash
npm run codex:verify-plugin
npm run verify
npm run codex:ship
npm run quality:fast
npm run quality:deep
npm run check:lighthouse
npm run check:format
```

`quality:fast` is the normal static quality gate. `quality:deep` adds dead-code, duplication, browser smoke, and Pa11y checks. Browser-based checks may need to run outside a filesystem sandbox on Windows.

## Before Push

Read `DO_NOT_PUSH.md`, check `git status --short`, then push only intentional changes.
