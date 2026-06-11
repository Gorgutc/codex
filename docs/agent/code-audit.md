# Code Audit Baseline

Generated during the Codex-native orchestration implementation.

## Baseline Result

`npm run verify` passed with `0 FAIL`. The exact pass total is historical and should not be reused as a contract.

## Safe Cleanup Decision

No runtime HTML/CSS/JS deletion was made in this pass. The available evidence was enough to identify instruction drift, but not enough to prove safe removal of shipped runtime code.

## Known Non-Runtime Or Stale Areas

- `_beget-placeholder.php` is a hosting artifact, not app runtime.
- `downloads/*.zip` are placeholder archives and should not be removed without a product decision.
- `RUN_INSTRUCTIONS.md` and `SKILL_DRIFT_REPORT.md` contain legacy context. `.claude/**` is an active generated mirror and `CLAUDE.md` is the live Claude Code entry point (ADR 0008) — never propose them for deletion.

## Next Deadwood Audit

Run `code_deadwood_auditor` and require evidence for each proposed deletion:

- reference search,
- runtime path analysis,
- frozen-test coverage check,
- and verification after removal.
