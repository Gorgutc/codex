# Claude Code Entry Point

This repository runs a dual agent harness: OpenAI Codex and Claude Code share one
canonical rule set. The full project rules are imported below from `AGENTS.md`
(the single source of truth for both harnesses).

@AGENTS.md

## Claude Code specifics

- `.claude/skills/**` and `.claude/agents/**` are GENERATED mirrors of the Codex
  canon (`plugins/codex-studio-codex/skills/`, `.agents/skills/`,
  `.codex/agents/*.toml`). Never edit the mirrors by hand. Edit the canonical
  file, then run `npm run sync:harness`. Parity is enforced by
  `npm run check:parity`, which is part of `npm run codex:ship`.
- Hooks in `.claude/settings.json` reuse the shared Node scripts in
  `.codex/hooks/` (same scripts the Codex harness registers in
  `.codex/hooks.json`). Both harnesses get the same session context,
  prompt nudge, and post-edit verification behavior.
- `npm run codex:ship` is mandatory before committing or pushing code or
  agent-infrastructure changes, exactly as for Codex sessions.
- Branch prefix is `codex/*` with draft PRs, regardless of which harness
  authored the change.

## Cross-review with Codex

Use the OpenAI Codex plugin for an independent second review of Claude-authored
changes (and vice versa, Codex sessions review Claude-authored changes):

1. One-time setup: `/plugin marketplace add openai/codex-plugin-cc`, then
   `/plugin install codex@openai-codex`, `/reload-plugins`, `/codex:setup`
   (requires OpenAI auth). This repo also declares the marketplace in
   `.claude/settings.json`, so Claude Code may offer the install automatically.
2. Per change: run `/codex:review` after each iteration; run
   `/codex:adversarial-review` additionally for changes that touch frozen
   architecture (`verify-frozen.js`, script order, data contracts).

## Active project

Admin-panel project: spec, research, and session journal live in
`docs/agent/admin-panel/` (`tz.md`, `research.md`, `handoff.md`). Read the
handoff before continuing that work.
