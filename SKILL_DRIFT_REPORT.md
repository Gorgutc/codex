# Skill Drift Report

This report was reset during the Claude Code to Codex migration.

The old audit targeted the legacy `.claude/skill-*.md` files, which were archived under
`plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`.
`.claude/` itself is now a generated dual-harness mirror (ADR 0008) — do not audit it
directly; run `npm run check:parity` instead.

Current audit target:

```text
plugins/codex-studio-codex/skills/**/*.md
.agents/skills/**/*.md
AGENTS.md
CLAUDE.md
docs/agent/**/*.md
verify-frozen.js
```

Run the `codex-studio-audit-skills` skill when a new drift audit is needed. Do not update migrated methodology files automatically without user approval.
