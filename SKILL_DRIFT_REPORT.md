# Skill Drift Report

This report was reset during the Claude Code to Codex migration.

The old audit targeted `.claude/skill-*.md`. That directory is no longer active. The migrated source material is preserved under:

```text
plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/
```

Current audit target:

```text
plugins/codex-studio-codex/skills/**/*.md
AGENTS.md
verify-frozen.js
```

Run the `codex-studio-audit-skills` skill when a new drift audit is needed. Do not update migrated methodology files automatically without user approval.
