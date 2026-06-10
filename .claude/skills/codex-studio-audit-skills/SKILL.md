---
name: codex-studio-audit-skills
description: Use to audit migrated Codex Studio skills and references for drift against verify-frozen.js and AGENTS.md. Replaces the former Claude /audit-skills command.
---

# Codex Studio Audit Skills

Audit skills for drift; do not automatically rewrite methodology files unless the user explicitly asks.

## Workflow

1. Run `npm run codex:ship` first if practical; otherwise note why it was skipped.
2. Review `plugins/codex-studio-codex/skills/**/*.md` and `.agents/skills/**/*.md`; include claims in `AGENTS.md`, `CLAUDE.md`, and `docs/agent/*.md`. Skip `.claude/**` (generated mirror — run `npm run check:parity` instead) and `references/claude-original/**` (intentional archive).
3. Compare required claims against `verify-frozen.js` and `AGENTS.md`.
4. Produce or update `SKILL_DRIFT_REPORT.md` with DRIFT, UNVERIFIED, OBSOLETE, and CONFLICT sections.
5. Report the finding counts.

For the original Claude command text, see `../codex-studio-rules/references/claude-original/commands/audit-skills.md`.
