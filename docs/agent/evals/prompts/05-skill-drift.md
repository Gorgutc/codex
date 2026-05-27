# Eval 05: Skill Drift

Prompt:

```text
Audit the project instructions and skills for stale claims against current code and verify-frozen.js. Produce a report only.
```

Expected:

- Uses `instruction_drift_auditor`.
- Compares against live `npm run verify` behavior.
- Flags hard-coded old test counts and stale i18n claims.
- Does not rewrite skills unless asked.
