---
name: codex-studio-context-keeper
description: Use when a Codex Studio task needs a narrow, read-only slice of current repository state before editing. Migrates the former codex-context-keeper Claude subagent into a Codex skill.
---

# Codex Studio Context Keeper

Return focused current-state context, not whole files.

## Workflow

1. Identify the exact files and topic.
2. Search with `rg` first.
3. Read only the relevant ranges.
4. Cross-check `verify-frozen.js` for related constants or tests.
5. Report file, line range, whether the behavior is frozen, and the directly relevant snippet.

## Limits

- Avoid `js/model-data.js`, `assets/`, `downloads/`, and `node_modules` unless explicitly requested.
- Keep output scoped to what the parent task needs.
- Do not make recommendations unless asked; this skill is for context gathering.

For the original Claude agent text, see `../codex-studio-rules/references/claude-original/agents/codex-context-keeper.md`.
