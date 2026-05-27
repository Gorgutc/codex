# Archive Policy

Do not delete legacy instruction material just because Codex no longer uses it directly.

## Archive Candidates

- `.claude/settings.json`
- `.claude/hooks/*.sh`
- `.claude/commands/*.md`
- `.claude/agents/*.md`
- `RUN_INSTRUCTIONS.md`
- `SKILL_DRIFT_REPORT.md`
- `CLAUDE.md` after the user approves a full Codex-only migration

## Archive Conditions

Archive only when:

- a Codex-native replacement exists,
- the replacement has been verified against current code,
- the user approves the migration,
- and the archive location records why the file moved.

Until then, legacy files remain compatibility source material.
