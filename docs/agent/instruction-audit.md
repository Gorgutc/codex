# Instruction Audit Findings

## Current Reality

- Verification baseline is `96/96 PASS, 0 FAIL`; future instructions should require `0 FAIL`, not a historic count.
- Runtime UI is bilingual through `i18n-data.js` and `i18n.js`; Russian text is expected after language switching.
- GSAP, ScrollTrigger, SplitText, and Lenis are self-hosted in `js/vendor/`.
- `<model-viewer>` is lazy-loaded by app logic from Google APIs.
- Preloader and anti-flicker behavior exist in current shipped pages.
- `font-size: Npx` is controlled by a frozen budget; the rule is no new px font-size, not a blind claim that none exist.

## Keep As Source Material

- Project positioning and design tone.
- Asset naming and card ID rules.
- The verify-first authority model.
- Copy, visual reference, asset, and deploy methodology after updating stale facts.

## Rewrite For Codex

- Root session bootstrap should be `AGENTS.md`.
- Codex agent contracts should live in `.codex/agents/*.toml`.
- Codex skills should live in `.agents/skills/*/SKILL.md`.
- Hooks should live in `.codex/hooks.json` and avoid hard-coded old pass counts.

## Archive Later With User Approval

- `.claude/settings.json`
- `.claude/hooks/*.sh`
- `.claude/commands/*.md`
- `.claude/agents/*.md`
- `RUN_INSTRUCTIONS.md`
- `SKILL_DRIFT_REPORT.md`
- `CLAUDE.md`

Until then, these files remain compatibility docs and historical source material.
