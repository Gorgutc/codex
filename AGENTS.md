# Codex Studio Agent Rules

This file is the Codex source of truth for `Gorgutc/codex`. The former Claude Code configuration was migrated into the repo-local plugin at `plugins/codex-studio-codex/`.

## Repository

- Site: Codex Studio, a static 3D design portfolio and free-assets catalog.
- Stack: vanilla HTML, CSS, and JavaScript.
- Runtime: no framework, no bundler, no build step, no Tailwind, no React/Vue/Svelte.
- Verification: `npm run verify`, currently expected to end with `SUMMARY: 96/96 PASS, 0 FAIL`.
- Publish flow: every task goes to a `codex/*` branch, is pushed to GitHub, and gets a draft PR.

## Authority

1. Current user request.
2. `verify-frozen.js`.
3. This `AGENTS.md`.
4. Codex plugin skills in `plugins/codex-studio-codex/skills/`.
5. Migrated Claude references under `plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.

If old Claude references mention `.claude`, translate that to the Codex plugin paths. `.claude` is no longer an active configuration directory.

## Working Rules

- Read before editing; use `rg` for file and text search.
- Keep edits scoped to the requested task.
- Do not touch `js/model-data.js` unless explicitly requested.
- Do not commit secrets, personal files, build artifacts, Playwright reports, or generated caches.
- Do not commit Google Drive material unless the user explicitly asks for an export and `DO_NOT_PUSH.md` has been checked.
- Preserve English UI copy unless the task is explicitly about localization.
- Maintain the current i18n behavior and language toggle.
- Preserve the script order, CSS order, metadata, card IDs, filters, and accessibility budgets tested by `verify-frozen.js`.

## Codex Skills

Use these repo-local skills when relevant:

- `codex-studio-rules`: project rules and migrated references.
- `codex-studio-frontend-rules`: frontend implementation and review rules.
- `codex-studio-context-keeper`: narrow read-only code context.
- `codex-studio-spec-guardian`: frozen architecture checks.
- `codex-studio-quality-gate`: craft, a11y, perf, SEO, motion review.
- `codex-studio-5sec-test`: visual first-impression QA.
- `codex-studio-ship`: pre-PR ship workflow.
- `codex-studio-run-5sec`: rendered visual QA workflow.
- `codex-studio-audit-skills`: skill drift audit.

## Commands

Use npm scripts instead of Claude hooks:

```bash
npm run codex:verify-plugin
npm run verify
npm run codex:ship
```

`npm run codex:ship` is mandatory before committing or pushing code changes.

## Local Setup

```bash
npm install
npx playwright install chromium
npm run codex:ship
```

If Chromium cannot spawn inside a sandbox with `EPERM`, rerun verification outside the sandbox.

## GitHub

- Remote: `https://github.com/Gorgutc/codex.git`.
- Default branch: `main`.
- Branch prefix: `codex/`.
- Push changes and open draft PRs through GitHub.
