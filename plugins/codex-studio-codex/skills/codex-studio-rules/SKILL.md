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
4. Migrated references in `references/claude-original/`.
5. Older docs such as `README.md`, `RUN_INSTRUCTIONS.md`, and historical handoff files.

If a migrated Claude reference contradicts `verify-frozen.js`, treat the reference as stale and preserve the test unless the user explicitly asks to change the architecture.

## Current verified baseline

`npm run verify` is the project gate. On this branch it is expected to report:

```text
SUMMARY: 96/96 PASS, 0 FAIL
```

Run it outside restricted sandboxes when Chromium cannot spawn.

## Mandatory workflow

For any change touching `index.html`, `free-assets.html`, `css/*.css`, `js/*.js`, `verify-frozen.js`, SEO metadata, assets referenced by pages, or deploy files:

1. Read the relevant parts of `AGENTS.md`.
2. Use focused code search before editing.
3. Preserve the static-site stack: no framework, no runtime build, no bundler.
4. Run `npm run codex:ship` before commit or PR.
5. Push work on a `codex/*` branch and open a draft PR.

For purely documentation-only changes, run at least `npm run codex:verify-plugin`.

## Migrated references

Load only what is needed:

- `references/claude-original/project_brief.md` for positioning and frozen decisions.
- `references/claude-original/build_rules.md` for design tokens and bans.
- `references/claude-original/prompt_instructions.md` for high-level task rules and anti-drift behavior.
- `references/claude-original/structure.md` for file layout.
- `references/claude-original/motion_brief.md` for animation work.
- `references/claude-original/assets_brief.md` for asset handling.
- `references/claude-original/reference_brief.md` for visual reference interpretation.
- `references/claude-original/texts.md` for copy guidance.
- `references/claude-original/trusted_sources.md` for trusted external references.
- `references/claude-original/skills_brief.md` for how the old skills were intended to work.

The `references/claude-original/` folder is retained as migrated source material, not as active Claude Code configuration.
