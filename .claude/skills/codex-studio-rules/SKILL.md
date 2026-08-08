---
name: codex-studio-rules
description: Use when working in Gorgutc/codex, the Codex Studio static portfolio site, especially before editing index.html, free-assets.html, css, js, assets, SEO files, or verification logic. Provides the migrated project brief, frozen architecture, setup rules, and Claude-original references.
---

# Codex Studio Rules

## Source of truth

Authoritative order for this repository:

1. Explicit user request in the current chat.
2. `verify-frozen.js` and its current passing baseline.
3. `AGENTS.md`.
4. Active plugin skills in `plugins/codex-studio-codex/skills/`.
5. Supplemental docs in `docs/agent/`.
6. Supplemental skills in `.agents/skills/`.
7. Supplemental contracts in `.codex/`.
8. Generated `.claude/skills/**` and `.claude/agents/**` mirrors, plus shared
   hook configuration in `.claude/settings.json`.
9. Migrated references in `references/claude-original/`.

`AGENTS.md` owns the full authority order. If an active instruction drifts from
live code or tests, repair its canonical source. Migrated Claude references are
archived historical material, never current policy.

## Current verified baseline

`npm run verify` is the project gate. It must exit cleanly and report `0 FAIL`; do not treat any historic pass total as the contract.

Run it outside restricted sandboxes when Chromium cannot spawn.

## Mandatory workflow

For any change touching `index.html`, `free-assets.html`, `css/*.css`, `js/*.js`, `verify-frozen.js`, SEO metadata, assets referenced by pages, or deploy files:

1. Read the relevant parts of `AGENTS.md`.
2. Use focused code search before editing.
3. Preserve the static-site stack: no framework, no runtime build, no bundler.
4. Run `npm run codex:ship` before commit or PR.
5. Push work on a `codex/*` branch and open a draft PR.

For purely documentation-only changes, run at least `npm run codex:verify-plugin`.

## Current routes and archived references

Load only what is needed:

- Asset handling: `.agents/skills/codex-studio-assets/SKILL.md`, canonical byte
  policy in `scripts/asset-budget.mjs`, and runtime proof in
  `docs/agent/verification.md`; run `npm run check:assets` plus the applicable
  `npm run verify` runtime gate.
- `references/claude-original/project_brief.md` for positioning and frozen decisions.
- `references/claude-original/build_rules.md` for design tokens and bans.
- `references/claude-original/prompt_instructions.md` for high-level task rules and anti-drift behavior.
- `references/claude-original/structure.md` for file layout.
- `references/claude-original/motion_brief.md` for animation work.
- `references/claude-original/reference_brief.md` for visual reference interpretation.
- `references/claude-original/texts.md` for copy guidance.
- `references/claude-original/trusted_sources.md` for trusted external references.
- `references/claude-original/skills_brief.md` for how the old skills were intended to work.

The `references/claude-original/` folder is retained as migrated source
material, not as active policy or Claude Code configuration. Never use it to
override live asset budgets, runtime behavior, or current verification.
