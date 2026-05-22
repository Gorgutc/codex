---
description: Audits .claude/skill-*.md files for drift against verify-frozen.js and project_brief.md. Produces SKILL_DRIFT_REPORT.md in the repo root. NEVER auto-rewrites skill files — that is a user decision.
---

You are running a skill-drift audit. Skill files document methodology. They can fall out of sync with `verify-frozen.js` (the source of truth). Your job is to detect that and report it.

## Step 1 — Collect skill files

```bash
ls -1 .claude/skill-*.md
```

## Step 2 — For each skill file

Read it. Extract its BLOCKER and MAJOR claims (the rules it says you must follow).

For each claim:
1. Identify the keyword (e.g. `theme-color`, `data-id`, `defer`, `localStorage`, `mobile-first`, `EXPECTED_IDS`, `portfolio.css`).
2. Grep `verify-frozen.js` for that keyword.
3. Compare:
   - Skill claim agrees with test → OK
   - Skill claim contradicts test → DRIFT
   - Skill claim has no corresponding test → UNVERIFIED
   - Skill claim refers to behavior no longer in the codebase → OBSOLETE

## Step 3 — Cross-check skill files against each other

If two skill files give contradictory rules on the same topic, flag CONFLICT.

## Step 4 — Cross-check against current file structure

Grep both `index.html` and `free-assets.html` for what CSS / JS files they actually load. If a skill file references a CSS/JS file that no longer exists (e.g. legacy `portfolio.css` after the v0.9.5 split into `portfolio-core.css` + `portfolio-case.css`), flag OBSOLETE.

## Step 5 — Write SKILL_DRIFT_REPORT.md

Template:

```markdown
# Skill drift report

Generated: <UTC timestamp>
Repo: Gorgutc/codex
Branch: <current branch>
verify-frozen.js: <Tests: N/N PASS at this moment, with env-baseline note if applicable>

## Summary

- Total skills audited: <N>
- DRIFT (skill contradicts test): <N>
- UNVERIFIED (skill not tested): <N>
- OBSOLETE (skill references gone behavior or removed files): <N>
- CONFLICT (skills disagree with each other): <N>

## DRIFT

### `.claude/skill-X.md`
- Line <L>: "<quoted skill text>"
- verify-frozen.js says: <test name + what it checks>
- Recommendation: <update skill to match test | open ADR if test should change>

### ...

## UNVERIFIED

### `.claude/skill-Y.md`
- Line <L>: "<quoted skill text>"
- No matching test found.
- Recommendation: <write a test if the rule matters | downgrade severity in skill if speculative>

## OBSOLETE

### `.claude/skill-Z.md`
- Line <L>: "<quoted skill text>"
- Codebase no longer contains: <what>
- Recommendation: <remove from skill | rewrite to current reality>

## CONFLICT

### `.claude/skill-A.md` vs `.claude/skill-B.md`
- Topic: <topic>
- skill-A says: "<quote>"
- skill-B says: "<quote>"
- Recommendation: <reconcile to verify-frozen.js | open ADR if both valid in different contexts>

---

## Next actions

These are recommendations only. Apply manually after review:

1. <highest-priority skill update>
2. <next>
3. ...

Do NOT auto-apply. Skills are methodology documents — user reviews before changes.
```

## Step 6 — Surface the report path

After writing the report, show the user:

```
Skill drift audit complete.
Report: SKILL_DRIFT_REPORT.md
Findings: <N> drift, <N> unverified, <N> obsolete, <N> conflict.
Open the report to review. No skill files were modified.
```

## Hard rules

- Never modify any .claude/skill-*.md file.
- Never modify verify-frozen.js based on this audit.
- The report is advisory. The user decides.
- If verify-frozen.js is not 56/56 PASS at audit time (or 48/56 in a CDN-restricted cloud env), note this prominently — drift findings against a broken baseline are unreliable.
