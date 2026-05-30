# Agent Orchestration

Use orchestration when a task is broad enough that independent checks can run in parallel.
Simple work stays local. Orchestration exists to make broad work safer, not to add ceremony.

## Standard Audit Pack

- `code_deadwood_auditor`: unused, duplicated, bloated, or risky code.
- `runtime_mapper`: current runtime flow, globals, events, lazy loading, script order.
- `tech_stack_cartographer`: stack and architectural decisions.
- `instruction_drift_auditor`: stale docs, skills, hooks, agents, and runbooks.
- `codex_infra_architect`: Codex-native instruction and agent design.
- `verification_reviewer`: final verification and risk summary.

## Parallel Decomposition Matrix

For medium or complex work, write a compact matrix before implementation.
Use it to decide what can run in parallel, what must stay sequential, and what
should stay local.

| Field | Purpose |
| --- | --- |
| `stream` | Short stream id or name. |
| `goal` | Finished outcome for that stream. |
| `agent` | Local, built-in subagent, or custom `.codex/agents` role. |
| `write zone` | Files or modules the stream owns; use read-only when applicable. |
| `dependencies` | Upstream streams, shared resources, or ordering limits. |
| `verification` | Targeted command or review that proves the stream. |
| `decision` | `parallel`, `sequential`, or `local`. |
| `reason` | Concrete reason for that decision. |

Parallel streams need disjoint write zones or read-only scopes, no blocking
dependency chain, and a verification loop that can be reviewed independently.
Sequential execution needs a concrete reason such as write conflict, dependency
chain, shared verification bottleneck, unavailable subagents, or unclear scope.

## Code Change Pack

Before shipped-code edits, gather context locally and use agents for sidecar review when the change is non-trivial. After editing, run `npm run verify`.

## Instruction Rewrite Pack

For instruction work, compare live code and verification output before editing. Legacy `.claude` docs are useful source material but should not be copied verbatim into Codex-native docs.

Use external orchestration packs as reference material, not as a wholesale import.
Do not add Beads as a required task ledger for this repository unless the user
explicitly approves that process change. The current Codex Studio task truth is:
the active chat goal, git state, `AGENTS.md`, `docs/agent/*`, `verify-frozen.js`,
and the draft-PR delivery flow.

Do not copy external Google Drive orchestration pack scripts, Unix-only
orchestration scripts, or branch/worktree cleanup tools into this repo without a
separate Windows-safe implementation decision. Cleanup that can delete branches
or worktree directories needs explicit user approval and dirty-state guards.

## Subagent Prompt Contract

When delegated work is justified, spawn a visible Codex subagent thread or run.
Inline summaries are not a substitute for spawned subagents. If the runtime
cannot spawn subagents, either execute locally or provide a manual prompt pack
for the user to launch elsewhere. At closeout, disclose the fallback used:
`spawn unavailable; executed locally` or `manual prompt pack provided`.

Every delegated prompt must use this block:

```text
Documentation: exact source used, or No dependency documentation lookup needed.
Selected skills: relevant skill names, or none - <reason>.
Selected agents: relevant .codex/agents roles, or none - <reason>.
Write zone: owned files/modules, or read-only.
Verification: exact command, screenshot, or review expected from the stream.
Stop rules: when to return blocked instead of expanding scope.
Expected output: changed files, findings, verification evidence, blockers, and explicit defers.
```

Workers are not alone in the codebase. Tell them to preserve unrelated edits and
to stop if ownership boundaries conflict with another stream.

## Closeout

Before final delivery, run `/review` when available. If `/review` is unavailable,
perform the equivalent diff and requirements review and label it as a fallback.
Record relevant verification and state explicit defers. Use `none` only when
there are no intentional defers.

Do not treat `.codex` `PostToolUse` hooks as a complete safety gate. They are
nudges and fast checks. Use the relevant npm commands from `docs/agent/verification.md`
and `docs/agent/quality-tooling.md`, and run `npm run codex:ship` before commit
or push for code or agent-infrastructure changes.

## Future Chat Bootstrap

Future sessions should start by reading `AGENTS.md`. If the task is broad, the
first move should be to use the relevant audit pack when spawned subagents are
available and justified; otherwise execute the checks locally or provide a
manual prompt pack.
