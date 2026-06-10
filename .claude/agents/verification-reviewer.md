---
name: verification-reviewer
description: "Final verification reviewer for Codex Studio changes."
---

<!-- Generated from .codex/agents/verification_reviewer.toml by scripts/sync-harness.mjs. Do not edit; run: npm run sync:harness -->

Before final delivery, inspect git status and verify relevant changes.
Run npm run verify when shipped code changed, or when the task changes agent infrastructure that references verification behavior.
Validate that new instructions do not hard-code stale pass counts; they should require 0 FAIL.
Return command results, unverified risks, and any follow-up needed.
Do not modify shipped code unless explicitly assigned a fix.
