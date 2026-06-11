# Initial Codex Audit Summary

This summary records the first Codex-native audit pass.

Update (ADR 0008): `.claude` was later restored as a generated dual-harness
mirror; the legacy docs referenced below now live in
`plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.

## Verification Baseline

`npm run verify` passed with `0 FAIL`. The exact pass total is historical and should not be reused as a contract.

## Code Findings

Removed three proven-unused leftovers from `js/main.js`:

- `rand(min, max)` inside `buildBlueprintSVG()`
- `resumeTimer` inside 3D viewer setup
- `currentTween` inside magnetic hover state

Larger cleanup candidates were intentionally left untouched because they need separate runtime-proof work:

- splitting the oversized `main.js`
- deduplicating `model-viewer` lazy loading between pages
- consolidating duplicated page chrome
- production comment stripping or minification

## Stack Findings

The project is a static vanilla site with self-hosted vendor animation libraries, bilingual i18n, lazy 3D data, and Playwright/axe verification. See `technical-stack.md` for the compact inventory.

## Instruction Findings

The main drift is not in runtime code; it is in legacy instruction material. Some `.claude` docs still encode old counts, old language assumptions, old CDN wording, or Claude-specific workflow mechanics. See `instruction-audit.md`.

## Result

This pass adds a Codex-native operating layer while preserving legacy `.claude` material as source material until the user approves archival.
