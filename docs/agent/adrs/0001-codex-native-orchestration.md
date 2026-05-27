# ADR 0001: Codex-Native Orchestration

## Decision

Use `AGENTS.md`, `.codex/agents`, `.codex/hooks`, `.agents/skills`, and `docs/agent` as the primary Codex operating layer.

## Context

The project had a mature `.claude` setup, but Codex needs a shorter native bootstrap and skill format.

## Consequences

Legacy `.claude` files remain source material until the user approves archival. New work should update the Codex-native layer first.
