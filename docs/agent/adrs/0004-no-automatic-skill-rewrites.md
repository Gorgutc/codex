# ADR 0004: No Automatic Skill Rewrites

## Decision

Skill drift audits report findings first. They do not rewrite or archive legacy skills without explicit user approval.

## Context

Instruction changes can affect every future task. Silent rewrites make regressions harder to trace.

## Consequences

Use KEEP, REWRITE, ARCHIVE, and USER DECISION labels before changing instruction systems.
