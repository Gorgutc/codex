# Codex Studio Agent Guide

Codex Studio is a static two-page 3D portfolio and asset catalog for `codex.promo`.
Treat this file as the Codex-first entrypoint. The older `.claude/` files are source material and compatibility docs, not the primary operating manual for Codex.

## Authority Order

1. `verify-frozen.js` and a clean verification run
2. The user's latest message
3. `AGENTS.md`
4. `docs/agent/*`
5. `.agents/skills/*/SKILL.md`
6. Legacy `.claude/*`

If legacy docs disagree with the live test suite or current code, the legacy doc is stale.

## Current Stack

- Runtime: vanilla HTML, CSS, and classic scripts. No React, Vue, Tailwind, bundler, transpiler, server app, cookies, `localStorage`, or `sessionStorage`.
- Dev tooling: `npm run verify`, backed by Playwright and axe.
- Pages: `index.html` and `free-assets.html`.
- CSS order: `tokens.css`, `reset.css`, `shared.css`; index also loads `portfolio-core.css` and preloads `portfolio-case.css`; free assets loads `free-assets.css`.
- JS is ordered and non-module. Index loads `lenis`, `gsap`, `ScrollTrigger`, `SplitText`, `i18n-data`, `i18n`, `main`, `animations`. Free assets loads `fa-data`, vendor/i18n/shared logic, then `free-assets`.
- Runtime libraries: GSAP, ScrollTrigger, SplitText, and Lenis are self-hosted in `js/vendor/`. `model-data.js` and `<model-viewer>` are lazy-loaded from app logic.
- Content is bilingual through `i18n-data.js` and `i18n.js`; Cyrillic in runtime UI is expected in Russian mode.

## Frozen Rules

- Run `npm run verify` after shipped-code changes. The expected contract is `0 FAIL`, not a hard-coded historical test count.
- Do not change stack, script order, tag sets, card IDs, `theme-color`, CSS file order, lazy 3D loading, or i18n shape unless the user explicitly requests an architecture change.
- Keep colors, spacing, and typography in `css/tokens.css` unless a current test or existing exception proves otherwise.
- Do not add new `font-size: Npx`; the suite has a grandfathered budget, not a permission slip.
- Preserve `:not(.tag-card)` behavior around `.work-card` selectors that affect animation, opacity, transform, or hover.

## When To Orchestrate

Use parallel subagents or the contracts in `.codex/agents/` for substantial work:

- broad code audit, dead-code search, or optimization planning
- shipped-code changes touching HTML, CSS, JS, or `verify-frozen.js`
- instruction, skill, hook, or agent rewrites
- deploy, SEO, accessibility, or visual-quality gates

For docs-only edits, read the relevant docs and keep changes scoped. For shipped-code edits, gather context first, state intent when behavior changes, edit, and verify.

## Done When

- The requested files are changed and unrelated user edits are preserved.
- `npm run verify` passes, or any inability to run it is clearly reported.
- New instructions stay short, current, and tied to the real code.
- Stale Claude-era material is either left as compatibility source material or archived according to `docs/agent/archive_policy.md`.

## Reference Map

- Orchestration: `docs/agent/orchestration.md`
- Architecture and stack: `docs/agent/architecture.md`
- Code review: `docs/agent/code_review.md`
- Verification: `docs/agent/verification.md`
- Skill map: `docs/agent/skill-map.md`
- Archive policy: `docs/agent/archive_policy.md`
- Long-task template: `docs/agent/plan_template.md`
- Agent eval prompts: `docs/agent/evals/`
- Decisions: `docs/agent/adrs/`
