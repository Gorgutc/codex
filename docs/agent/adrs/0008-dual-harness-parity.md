# ADR 0008: Dual Harness Parity (Codex + Claude Code)

## Decision

Run both agent harnesses against one canonical rule set. The Codex layer
(`plugins/codex-studio-codex/skills/`, `.agents/skills/`, `.codex/`) stays
canonical. A generated Claude Code mirror (`.claude/skills/`, `.claude/agents/`)
is produced by `scripts/sync-harness.mjs --write` and committed. Parity is
enforced by `scripts/sync-harness.mjs --check` (`npm run check:parity`) inside
`npm run codex:ship`. `CLAUDE.md` imports `AGENTS.md` via `@AGENTS.md`, and
`.claude/settings.json` registers the same hook scripts that `.codex/hooks.json`
registers (the Node scripts in `.codex/hooks/` are shared, not copied).

This partially supersedes the "do not recreate `.claude`" rule from the original
migration: `.claude` is active again, but only as a generated mirror.

## Context

The owner requires both Claude Code and Codex to work on this repo in
independent sessions with identical skills and instructions. The harnesses
cannot share skill directories natively: Codex reads `.agents/skills/` and its
plugin layer, Claude Code reads only `.claude/skills/`. Both use the same
`SKILL.md` frontmatter format, and the Codex hook protocol (stdin JSON,
`hookSpecificOutput`, exit 2 to surface failures) is compatible with Claude
Code hooks, so scripts are shared and skills are mirrored as generated copies
(content-identical; the parity check tolerates line-ending differences).

## Alternatives rejected

- Hand-maintained duplicates with a diff check: same file count, no one-command
  repair, invites "fixed one copy" drift.
- Dual plugin manifest (`.claude-plugin/plugin.json` next to `.codex-plugin/`):
  Claude Code caches plugins outside the repo, and local marketplace paths
  resolve against the main checkout when working from a git worktree (this
  project works in worktrees), so local skill edits would not be picked up.
- Symlinks: unreliable on Windows without Developer Mode.

## Consequences

- New skills or agent contracts are added on the Codex side first, then
  `npm run sync:harness` regenerates the mirror; `check:parity` fails the ship
  gate when the mirror drifts or is edited directly.
- `.claude/settings.local.json` and `.claude/worktrees/` stay gitignored.
- `scripts/verify-codex-plugin.mjs` asserts the mirror directories and
  `CLAUDE.md` import exist instead of asserting `.claude` is absent.
- Not mirrored (accepted asymmetry): `.codex/config.toml` thread limits
  (Claude Code parallelism is built in) and the Codex marketplace entry in
  `.agents/plugins/marketplace.json` (Claude Code consumes `.claude/skills/`
  directly, not a plugin). Codex `sandbox_mode = "read-only"` maps to
  `tools: Read, Grep, Glob` in mirrored agents — an approximation, since
  Claude Code has no sandbox-level write block; the contract text still says
  "audit only".
- `.claude/` is excluded from prettier and jscpd so formatters cannot
  reformat the mirror away from its canon.
