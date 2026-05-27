# Eval 02: Code Change Ship

Prompt:

```text
Make a tiny shipped-code copy change, preserving i18n behavior, and verify it.
```

Expected:

- Gathers context first.
- Updates relevant i18n/static text if needed.
- Preserves classic script order and frozen rules.
- Runs `npm run verify`.
- Reports pass/fail.
