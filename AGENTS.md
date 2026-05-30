# Codex Studio Agent Rules

This file is the Codex source of truth for `Gorgutc/codex`.
The former Claude Code configuration was migrated into the repo-local plugin at `plugins/codex-studio-codex/`.
This branch also adds the newer audit/orchestration layer under `.codex/`, `.agents/skills/`, and `docs/agent/`; treat those files as supplemental operating docs and evaluation material.

## Repository

- Site: Codex Studio, a static 3D design portfolio and free-assets catalog.
- Stack: vanilla HTML, CSS, and classic JavaScript.
- Runtime: no framework, no bundler, no build step, no Tailwind, no React/Vue/Svelte, no cookies, no `localStorage`, no `sessionStorage`.
- Pages: `index.html` and `free-assets.html`.
- Verification: `npm run verify`; success means the command exits cleanly and reports `0 FAIL`, without relying on a historical pass total.
- Publish flow: every task goes to a `codex/*` branch, is pushed to GitHub, and gets a draft PR.

## Authority

1. Current user request.
2. `verify-frozen.js` and a clean verification run.
3. This `AGENTS.md`.
4. Codex plugin skills in `plugins/codex-studio-codex/skills/`.
5. Supplemental agent docs in `docs/agent/`.
6. Supplemental project-local skills in `.agents/skills/`.
7. Supplemental agent/hook contracts in `.codex/`.
8. Migrated Claude references under `plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.

If old Claude references mention `.claude`, translate that to the Codex plugin paths. `.claude` is no longer an active configuration directory. If any legacy reference disagrees with the live code or tests, the legacy reference is stale.

## Working Rules

- Read before editing; use `rg` for file and text search.
- Keep edits scoped to the requested task.
- Preserve unrelated user changes.
- Do not touch `js/model-data.js` unless explicitly requested.
- Do not commit secrets, personal files, build artifacts, Playwright reports, generated caches, or Google Drive material unless the user explicitly asks for an export and `DO_NOT_PUSH.md` has been checked.
- Preserve the script order, CSS order, metadata, card IDs, filters, i18n behavior, language toggle, lazy 3D loading, and accessibility budgets tested by `verify-frozen.js`.
- Runtime UI is bilingual through `i18n-data.js` and `i18n.js`; Cyrillic is expected in Russian mode.
- Do not add new `font-size: Npx`; the verifier has a frozen grandfathered budget, not blanket permission.
- Preserve `.work-card:not(.tag-card)` behavior anywhere card animation, opacity, transform, hover, cursor, or magnetic logic is involved.

## Current Stack Details

- CSS order: `tokens.css`, `reset.css`, `shared.css`; index also loads `portfolio-core.css` and preloads `portfolio-case.css`; free-assets loads `free-assets.css`.
- JS order is classic and non-module. Index loads Lenis, GSAP, ScrollTrigger, SplitText, i18n data/runtime, `shared-runtime.js`, `main.js`, then `animations.js`. Free-assets loads `fa-data.js`, vendor stack, i18n data/runtime, `shared-runtime.js`, `main.js`, `animations.js`, then `free-assets.js`.
- GSAP, ScrollTrigger, SplitText, and Lenis are self-hosted in `js/vendor/`.
- `model-data.js` and `<model-viewer>` are lazy-loaded from app logic.

## Codex Skills

Primary repo-local plugin skills:

- `codex-studio-rules`: project rules and migrated references.
- `codex-studio-frontend-rules`: frontend implementation and review rules.
- `codex-studio-context-keeper`: narrow read-only code context.
- `codex-studio-spec-guardian`: frozen architecture checks.
- `codex-studio-quality-gate`: craft, a11y, perf, SEO, motion review.
- `codex-studio-5sec-test`: visual first-impression QA.
- `codex-studio-ship`: pre-PR ship workflow.
- `codex-studio-run-5sec`: rendered visual QA workflow.
- `codex-studio-audit-skills`: skill drift audit.

Supplemental skills in `.agents/skills/` are retained as lightweight smoke-test and audit guidance for code, motion, assets, copy, visual review, a11y/SEO/deploy, and instruction drift.

## Orchestration

Use parallel subagents or the contracts in `.codex/agents/` for substantial work:

- broad code audit, dead-code search, or optimization planning
- shipped-code changes touching HTML, CSS, JS, or `verify-frozen.js`
- instruction, skill, hook, plugin, or agent rewrites
- deploy, SEO, accessibility, asset, copy, or visual-quality gates

For docs-only edits, read the relevant docs and keep changes scoped. For shipped-code edits, gather context first, state intent when behavior changes, edit, and verify.

## Commands

Use npm scripts instead of Claude hooks:

```bash
npm run codex:verify-plugin
npm run verify
npm run codex:ship
npm run quality:fast
npm run quality:deep
npm run check:lighthouse
```

`npm run codex:ship` is mandatory before committing or pushing code changes. Use `quality:fast` for broad static checks and `quality:deep` for audit/refactor/PR-readiness work. If Chromium cannot spawn inside a sandbox with `EPERM`, rerun browser-based verification outside the sandbox.

## Done When

- The requested files are changed and unrelated user edits are preserved.
- `npm run codex:ship` passes before commit/push when code or agent infrastructure changed.
- New instructions stay short, current, and tied to the real code.
- Stale Claude-era material remains in the plugin reference archive unless the user explicitly asks to remove it.

## Reference Map

- Plugin source: `plugins/codex-studio-codex/`
- Supplemental orchestration: `docs/agent/orchestration.md`
- Architecture and stack: `docs/agent/architecture.md`
- Code review: `docs/agent/code_review.md`
- Verification: `docs/agent/verification.md`
- Quality tooling: `docs/agent/quality-tooling.md`
- Skill map: `docs/agent/skill-map.md`
- Archive policy: `docs/agent/archive_policy.md`
- Long-task template: `docs/agent/plan_template.md`
- Agent eval prompts: `docs/agent/evals/`
- Decisions: `docs/agent/adrs/`

## GitHub

- Remote: `https://github.com/Gorgutc/codex.git`.
- Default branch: `main`.
- Branch prefix: `codex/`.
- Push changes and open draft PRs through GitHub.
