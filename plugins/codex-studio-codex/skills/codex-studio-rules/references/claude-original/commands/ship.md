---
description: Final quality gate for Codex Studio. Runs codex-context-keeper + codex-spec-guardian + codex-quality-gate in PARALLEL, then verifies with `node verify-frozen.js`. Use before showing any generated code to the user. Blocks output on any FAIL.
---

You are about to ship a code change to the Codex Studio user. Before responding to the user, you MUST run all three gates in parallel and only proceed if every gate passes.

## Step 1 — Spawn the three subagents IN PARALLEL

In a single tool turn, invoke all three with the proposed change:

1. codex-context-keeper — prompt: `Return current state of <files this change touches> for <topic>. Cite line ranges only. Flag if any block is frozen by verify-frozen.js.`
2. codex-spec-guardian — prompt: `Validate this proposed change against frozen architecture and verify-frozen.js. Run the test only if the change touches <head>, DOM IDs, work-cards, tag filters, theme-color, script order, or canonical. <paste proposed change>`
3. codex-quality-gate — prompt: `Review this proposed change. Apply skill-code-reviewer + relevant skills. Read /mnt/skills/public/frontend-design/SKILL.md if available. <paste proposed change>`

Wait for all three to return before deciding. Do not sequence them — parallelism is the point.

## Step 2 — Decide

| spec-guardian | quality-gate | context-keeper | Action |
|---|---|---|---|
| PASS | PASS | clean | Ship. Go to Step 3. |
| FAIL | any | any | Do not ship. Show violations + required fix. Iterate, re-run /ship. |
| PASS | FIX REQUIRED (BLOCKER ≥ 1) | any | Do not ship. Show BLOCKERs + fix. Iterate. |
| PASS | FIX REQUIRED (BLOCKER = 0, MAJOR ≥ 1) | any | Do not ship by default. Ask user: "Quality gate has N MAJOR issues. Fix or ship?" |
| PASS | PASS | conflict with existing code (duplicate selector, dead handler) | Flag. Ask user before shipping. |

## Step 3 — Write the file

Only after gates pass, write the change using Edit/Write/MultiEdit. The PostToolUse hook will automatically run `node verify-frozen.js`. If the hook returns exit 2 with a failure summary, treat that as ground truth: revert immediately, debug, re-run /ship.

Note: in cloud environments with a closed CDN allowlist, verify-frozen.js may show known environmental failures (8 tests that depend on jsdelivr/unpkg/modelviewer). Those are not regressions — the architectural tests (theme-color, EXPECTED_IDS, EXPECTED_TAGS, head-order, JSON-LD) are what matter. Locally with open internet the suite returns 56/56.

## Step 4 — User-facing output

The user sees, in this order:

1. One-line summary: `Quality gate: 0 BLOCKER, N MAJOR, M MINOR. verify-frozen.js: 56/56 PASS.`
2. The applied change (file paths + diff or full block).
3. Two-line footer:
   - `Frozen rules: <comma list>`
   - `Skills applied: <comma list>`

Never paste raw subagent output. Gate output is for your decision, not the user.

## Failure recovery

If any subagent fails to return or returns malformed output: default to FAIL. Tell the user `<agent> did not return a valid verdict, not shipping`. Retry once. If still failing, run the checks inline in the main agent and log the subagent failure.

## When NOT to run /ship

- Pure reads or questions (no code change).
- Documentation-only edits inside `.claude/` skill files.
- README / CHANGELOG / HANDOFF updates.

For everything else touching `index.html`, `free-assets.html`, `css/`, `js/`, or `verify-frozen.js` itself — /ship is mandatory.
