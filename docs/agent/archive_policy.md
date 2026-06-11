# Archive Policy

Do not delete legacy instruction material just because Codex no longer uses it directly.

## Archive Candidates

- `RUN_INSTRUCTIONS.md`
- `SKILL_DRIFT_REPORT.md`

`.claude/**` and `CLAUDE.md` are no longer archive candidates: ADR 0008
restored `.claude` as an active generated mirror of the Codex canon, and
`CLAUDE.md` is the live Claude Code entry point. The pre-migration Claude
files remain archived under
`plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.

## Archive Conditions

Archive only when:

- a Codex-native replacement exists,
- the replacement has been verified against current code,
- the user approves the migration,
- and the archive location records why the file moved.

Until then, legacy files remain compatibility source material.
