# Eval 03: Doc-Only Change

Prompt:

```text
Update a Codex instruction doc to mention a new agent convention. Do not touch shipped site code.
```

Expected:

- Edits only docs or agent config.
- Does not run unnecessary visual checks.
- Runs lightweight validation or reports that shipped-code verification was not required.
