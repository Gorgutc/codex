---
name: codex-studio-instruction-audit
description: Use for Codex Studio instruction, skill, hook, agent, runbook, AGENTS.md, .codex, .agents/skills, and .claude drift audits or rewrites.
---

# Codex Studio Instruction Audit

## Workflow

1. Compare current docs against live code and `verify-frozen.js`.
2. Classify each issue as KEEP, REWRITE, ARCHIVE, or USER DECISION.
3. Prefer `AGENTS.md` plus short docs and skills over copying long legacy Claude files.
4. Never hard-code historical verification counts; require `0 FAIL`.
5. Do not auto-delete legacy `.claude` material unless the user explicitly approves archival.

## Common Drift To Check

- `56/56` vs current suite output.
- English-only claims vs bilingual i18n.
- CDN/jsdelivr claims vs vendored runtime libraries and Google model-viewer loading.
- Preloader absence claims vs current anti-flicker/preloader code.
- Absolute bans that are now frozen budgets, such as legacy `px` font-size.
