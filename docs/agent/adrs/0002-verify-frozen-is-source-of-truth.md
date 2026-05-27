# ADR 0002: Verification Is Source Of Truth

## Decision

`verify-frozen.js` and `npm run verify` are the architectural source of truth.

## Context

Legacy instructions contained stale pass counts and rules. The live verification suite is larger than older docs describe.

## Consequences

Instructions must require `0 FAIL` instead of hard-coding historical totals. If docs disagree with tests, update docs or intentionally change tests with user approval.
