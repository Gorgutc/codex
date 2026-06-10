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
5. `.claude/skills/**` and `.claude/agents/**` are a generated mirror — never edit or delete them by hand; fix the canonical file and run `npm run sync:harness`. Claude-era legacy lives only in `references/claude-original/` (archive; do not modify without user approval).

## Common Drift To Check

- Claims that `.claude` is inactive or that Codex is the only harness; command lists missing `sync:harness` / `check:parity`.
- `56/56` vs current suite output.
- English-only claims vs bilingual i18n.
- CDN/jsdelivr claims vs vendored runtime libraries and Google model-viewer loading.
- Preloader absence claims vs current anti-flicker/preloader code.
- Absolute bans that are now frozen budgets, such as legacy `px` font-size.
