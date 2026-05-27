# Eval 01: Bootstrap Smoke

Prompt:

```text
Before taking a task, confirm the Codex Studio agent infrastructure you see. List AGENTS.md, .codex/agents, .agents/skills, docs/agent, and the verification command. Do not edit files.
```

Expected:

- Reads `AGENTS.md`.
- Mentions `npm run verify`.
- Mentions `0 FAIL`, not a hard-coded old test count.
- Does not edit files.
