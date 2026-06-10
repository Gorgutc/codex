---
name: codex-studio-ship
description: Use before publishing, committing, pushing, or opening a PR for any Codex Studio code change. Replaces the former Claude /ship command with Codex-native review plus `npm run codex:ship`.
---

# Codex Studio Ship

This is the replacement for Claude `/ship`.

## Workflow

1. Inspect `git status --short --branch`.
2. Confirm the change scope is only the intended task.
3. Apply `codex-studio-spec-guardian` for frozen architecture.
4. Apply `codex-studio-quality-gate` for craft and regressions.
5. Run:

```bash
npm run codex:ship
```

6. Check `DO_NOT_PUSH.md` before staging.
7. Commit on a `codex/*` branch, push to GitHub, and open a draft PR.

## Hooks and harness parity

Hooks run automatically in both harnesses from the shared `.codex/hooks/`
scripts (registered in `.codex/hooks.json` and `.claude/settings.json`). They
are nudges, not the gate: `npm run codex:ship` (which includes
`npm run check:parity`) stays mandatory before commit/push/PR.

If canonical skills or `.codex/agents/*.toml` contracts changed, run
`npm run sync:harness` first — otherwise `check:parity` fails the ship gate.

For the original Claude command text, see `../codex-studio-rules/references/claude-original/commands/ship.md`.
