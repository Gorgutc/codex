# Codex Run Instructions

Use these steps for a fresh Codex thread in `Gorgutc/codex`.

## Setup

```bash
cd C:\Users\Maxim\Documents\GitHub\codex
npm install
npx playwright install chromium
npm run codex:ship
```

Expected verification: `npm run codex:ship` exits cleanly, and `npm run verify` reports `0 FAIL`. Do not hard-code the pass total.

If Playwright Chromium fails with `spawn EPERM`, rerun the verification outside the filesystem sandbox.

## New Task Workflow

1. Open the thread from the repository root.
2. Let Codex read `AGENTS.md`.
3. Work on a `codex/*` branch.
4. For changes to `index.html`, `free-assets.html`, `css/`, `js/`, `verify-frozen.js`, metadata, assets, or deploy config, use the repo-local Codex skills and run `npm run codex:ship`.
5. For broader cleanup, audit, or PR-readiness work, run `npm run quality:fast`; use `npm run quality:deep` when browser/a11y/dead-code checks matter.
6. For visual, motion, accessibility, Lighthouse, metadata, or SEO changes, run the relevant focused gates: `npm run test:visual`, `npm run check:a11y`, and `npm run check:lighthouse`.
7. Check `DO_NOT_PUSH.md`.
8. Commit, push, and open a draft PR.

## Quality Commands

```bash
npm run quality:fast
npm run quality:deep
npm run test:visual
npm run check:a11y
npm run check:format
npm run check:lighthouse
npm run hooks:install
```

`quality:deep`, `check:a11y`, `test:browser`, and `check:lighthouse` launch Chromium. On Windows they may need to run outside the filesystem sandbox.

## Replacements For Claude Code

- `CLAUDE.md` -> `AGENTS.md`.
- `.claude/agents/*` -> Codex skills under `plugins/codex-studio-codex/skills/`.
- `.claude/commands/ship.md` -> `codex-studio-ship` and `npm run codex:ship`.
- `.claude/commands/run-5sec.md` -> `codex-studio-run-5sec`.
- `.claude/commands/audit-skills.md` -> `codex-studio-audit-skills`.
- `.claude/hooks/session-start.sh` -> `AGENTS.md`.
- `.claude/hooks/user-prompt-nudge.sh` -> `AGENTS.md` workflow rules.
- `.claude/hooks/post-edit-verify.sh` -> explicit `npm run codex:ship`.

## Google Drive

Google Drive is available through the Codex connector. Do not commit Drive files or exports unless the user explicitly requests the export and the file passes `DO_NOT_PUSH.md`.
