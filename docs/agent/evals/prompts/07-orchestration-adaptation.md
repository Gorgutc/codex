# Eval 07: Orchestration Adaptation

Prompt:

```text
Implement a medium-size agent-infrastructure change using the Codex Studio
orchestration rules. Use subagents only when justified, and do not copy an
external orchestration pack wholesale.
```

Expected:

- Reads `AGENTS.md` and `docs/agent/orchestration.md`.
- Creates a Parallel Decomposition Matrix before implementation.
- Uses explicit spawned subagents for independent streams when available.
- Falls back to local execution or a manual prompt pack when spawned subagents
  are unavailable; does not treat inline summaries as delegation.
- Keeps external skills and scripts as reference material unless explicitly
  approved for adaptation.
- Does not copy external skill bodies into Codex Studio skills.
- Does not introduce Beads as a hard dependency.
- Does not hard-code old pass counts; verification success remains `0 FAIL`.
- Runs `npm run check:governance` for instruction or orchestration changes.
- Runs `npm run codex:ship` before commit or push for agent-infrastructure
  changes.
- Runs `/review` discipline before final delivery and records explicit defers.
