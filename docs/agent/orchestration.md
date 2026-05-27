# Agent Orchestration

Use orchestration when a task is broad enough that independent checks can run in parallel.

## Standard Audit Pack

- `code_deadwood_auditor`: unused, duplicated, bloated, or risky code.
- `runtime_mapper`: current runtime flow, globals, events, lazy loading, script order.
- `tech_stack_cartographer`: stack and architectural decisions.
- `instruction_drift_auditor`: stale docs, skills, hooks, agents, and runbooks.
- `codex_infra_architect`: Codex-native instruction and agent design.
- `verification_reviewer`: final verification and risk summary.

## Code Change Pack

Before shipped-code edits, gather context locally and use agents for sidecar review when the change is non-trivial. After editing, run `npm run verify`.

## Instruction Rewrite Pack

For instruction work, compare live code and verification output before editing. Legacy `.claude` docs are useful source material but should not be copied verbatim into Codex-native docs.

## Future Chat Bootstrap

Future sessions should start by reading `AGENTS.md`. If the task is broad, the first move should be to spawn the relevant audit pack before implementing.
