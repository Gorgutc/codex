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

## Agent Workflow

This repository runs a dual agent harness: OpenAI Codex (canonical) and Claude Code.

- `AGENTS.md` is the source of truth for both harnesses; `CLAUDE.md` imports it for Claude Code.
- `plugins/codex-studio-codex/` and `.agents/skills/` contain the canonical repo-local skills.
- `.claude/skills/` and `.claude/agents/` are a generated mirror maintained by `npm run sync:harness` and checked by `npm run check:parity` (part of `npm run codex:ship`). Never edit the mirror by hand.
- Pre-migration Claude files are preserved as references under `plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.

Use a `codex/*` branch for every task, push it to GitHub, and open a draft PR.

## Admin Panel

The site content lives in `content/*.json` and is managed through a custom no-build admin panel at `/admin/` (GitHub OAuth or PAT login). Publishing creates one commit to `main`; the `content-publish` workflow regenerates the shipped files and deploys via Netlify. Owner guide (Russian, with screenshots): [docs/admin-guide.md](docs/admin-guide.md). Agent-facing spec, research, and session journal: [docs/agent/admin-panel/](docs/agent/admin-panel/).

## Useful Commands

```bash
npm run codex:verify-plugin
npm run verify
npm run codex:ship
npm run sync:harness
npm run check:parity
npm run quality:fast
npm run quality:deep
npm run check:lighthouse
npm run check:format
```

`quality:fast` is the normal static quality gate. `quality:deep` adds dead-code, duplication, browser smoke, and Pa11y checks. Browser-based checks may need to run outside a filesystem sandbox on Windows.

## Before Push

Read `DO_NOT_PUSH.md`, check `git status --short`, then push only intentional changes.
