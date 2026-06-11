# Industrial Editorial Refresh - Next Session Handoff

Date: 2026-05-29  
Repository: `Gorgutc/codex`  
Local checkout: `C:\Users\Junior\Documents\GitHub\codex`  
Source spec rewritten from: `C:\Users\Junior\Downloads\deep-research-report.md`

## What Changed In This Markdown

This file is not a copy of the original research report. It is a portable continuation brief for the next Codex session.

Changes from the original ТЗ:

- Converted the research/audit report into an execution handoff.
- Marked Sprint A as completed and recorded the exact branch, commit, PR, changed files, agents, hooks, and verification evidence.
- Removed external citation clutter from the original report and kept only repo-actionable decisions.
- Updated the verification contract to the current rule: `0 FAIL`, not a historic pass count.
- Added the next recommended work slice: Sprint B, focused on card redesign and free-assets visual parity.
- Added session bootstrap instructions so the next run can start from the same state without re-discovering the repo.

## Current State

Sprint A is implemented and pushed.

- Branch: `codex/industrial-editorial-refresh-sprint-a`
- Commit: `72bf6cb Harden Sprint A preview governance`
- Draft PR: <https://github.com/Gorgutc/codex/pull/27>
- PR state when this file was written: open draft, base `main`, head `codex/industrial-editorial-refresh-sprint-a`, merge state `CLEAN`
- GitHub checks: no status checks were returned by `gh pr view` at write time
- Working tree before this handoff file: clean

Sprint A was intentionally created from `origin/main`, not stacked on the separate 3D lighting PR branch.

## Sprint A - Completed Work

Sprint A scope was the safe product/governance cleanup from the original ТЗ.

Completed:

- Removed hard-coded active verification pass totals.
- Added a guard in `scripts/verify-codex-plugin.mjs` so active instructions cannot reintroduce stale pass-total expectations.
- Cleaned shipped CAD/debug/placeholder/work-in-progress copy in:
  - `index.html`
  - `js/main.js`
  - `js/i18n-data.js`
- Added `docs/agent/preview-contract.md` to define current production-facing preview rules.
- Updated active docs to describe the current Three-first 3D architecture with lazy `<model-viewer>` fallback.
- Added a narrow shipped-copy guard in `verify-frozen.js`.
- Improved the free-assets console check detail so future failures do not show as an empty `CONSOLE-no-internal-errors` line.

Changed files in commit `72bf6cb`:

- `AGENTS.md`
- `README.md`
- `RUN_INSTRUCTIONS.md`
- `docs/agent/README.md`
- `docs/agent/architecture.md`
- `docs/agent/audit-summary.md`
- `docs/agent/code-audit.md`
- `docs/agent/instruction-audit.md`
- `docs/agent/preview-contract.md`
- `index.html`
- `js/i18n-data.js`
- `js/main.js`
- `plugins/codex-studio-codex/skills/codex-studio-rules/SKILL.md`
- `scripts/verify-codex-plugin.mjs`
- `verify-frozen.js`

Explicitly not changed:

- `js/model-data.js`
- legacy Claude reference archive under `plugins/codex-studio-codex/skills/codex-studio-rules/references/claude-original/`
- framework/build/runtime model
- page script order
- CSS order
- card IDs and filter contracts

## Verification Evidence From Sprint A

Use `npm.cmd` on Windows.

Red/green evidence:

- RED: `npm.cmd run codex:verify-plugin` failed before docs cleanup on the stale pass-total guard.
- RED: `npm.cmd run verify` failed before copy cleanup with stale instruction/copy guard failures.
- GREEN: `npm.cmd run verify` passed with `0 FAIL`.
- GREEN: `npm.cmd run quality:fast` passed.
- GREEN: `npm.cmd run codex:ship` passed.
- Pre-commit hook ran `quality:fast` and passed.
- Pre-push hook ran `codex:ship` and passed.

Known non-blocking notes:

- ESLint still reports the existing baseline of 8 warnings and 0 errors.
- `git diff --check` reported no whitespace errors; Windows line-ending warnings are expected in this checkout.
- One diagnostic Playwright launch inside the sandbox hit `spawn EPERM`; rerunning browser diagnostics outside the sandbox worked and only showed external `cloudflare.com/cdn-cgi/trace net::ERR_ABORTED` noise.

## Agents Used

Agents used during Sprint A:

- `Kepler` - `instruction_drift_auditor`, original ТЗ keeper/checklist holder.
- `Wegener` - `runtime_mapper`, mapped card, i18n, free-assets, and viewer surfaces.
- `Averroes` - `instruction_drift_auditor`, found stale active verification counts and archive boundaries.
- `Boyle` - `verification_reviewer`, recommended moving stale pass-total guard to `scripts/verify-codex-plugin.mjs`.
- `Godel` - `instruction_drift_auditor`, final spec review; found remaining `work in progress`, live-render copy, and stale model-viewer-only docs.
- `Avicenna` - `code_deadwood_auditor`, code-quality review; found EN baseline/i18n sync gaps and guard false-negative holes.
- `Herschel` - `verification_reviewer`, final verification review; recommended targeted copy grep plus `quality:fast` and `codex:ship`.

Next session should start equivalent agents again; do not rely on old agent IDs being available.

Recommended agent pack for the next session:

- `instruction_drift_auditor` as ТЗ keeper and checklist reviewer.
- `runtime_mapper` before touching card/free-assets runtime.
- `code_deadwood_auditor` or code-quality reviewer after each meaningful diff.
- `verification_reviewer` before commit/push.
- Use visual review/browser tooling for Sprint B because the next slice is visual.

## Hooks And Automation Observed

Repo hooks/config visible:

- `.codex/hooks/session-start.js`
- `.codex/hooks/user-prompt-nudge.js`
- `.codex/hooks/post-tool-verify.js`
- `lefthook.yml`

Hooks that actually ran during Sprint A delivery:

- Lefthook `pre-commit`: ran `quality:fast`.
- Lefthook `pre-push`: ran `codex:ship`.

Important operational rule:

- The archived Claude-era `.sh` hooks are gone; both harnesses now share the Node hooks in `.codex/hooks/` (ADR 0008). The gate path is npm scripts, Lefthook, and `npm run codex:ship`.

## Original Roadmap Status

From the original ТЗ:

- Sprint A - safe product cleanup and governance: completed in PR #27.
- Sprint B - card redesign and free-assets visual parity: next recommended work.
- Sprint C - shared loader/shell-controls extraction and naming cleanup: pending.
- Sprint D - visual regression suite, governance checker, CI blockers: pending.
- Sprint E - Lighthouse tightening plus preloader/custom-cursor simplification: pending.
- Sprint F - richer free-assets SEO/image metadata and optional asset pages: pending.

## Start The Next Session Here

First prompt for the next session can be:

```text
Read AGENTS.md and docs/agent/industrial-editorial-refresh-next-session.md.
Check PR #27 and current branch state.
If PR #27 is merged, branch Sprint B from updated main.
If PR #27 is still open, either wait or explicitly create a stacked Sprint B branch from codex/industrial-editorial-refresh-sprint-a.
Continue with Sprint B: card redesign and free-assets visual parity.
Use agents for runtime mapping, spec drift, visual/code review, and verification.
Do not touch js/model-data.js unless explicitly requested.
```

Preflight commands:

```powershell
cd C:\Users\Junior\Documents\GitHub\codex
git fetch origin
git status --short --branch
gh pr view 27 --repo Gorgutc/codex --json number,title,state,isDraft,headRefName,baseRefName,url,mergeStateStatus,statusCheckRollup
npm.cmd run verify
```

Branch decision:

- If PR #27 is merged: create `codex/industrial-editorial-refresh-sprint-b` from updated `origin/main`.
- If PR #27 is not merged: either wait for merge or create a stacked branch from `codex/industrial-editorial-refresh-sprint-a` and clearly mark the PR dependency.

## Sprint B - Next Work Slice

Goal: make the visible card system feel production-first and visually consistent without changing the vanilla/static runtime model.

Sprint B should cover:

- Work-card anatomy: poster -> metadata -> title/description -> interaction hint.
- Stronger first-frame treatment for portfolio cards.
- Free-assets card visual parity with the portfolio card system.
- Better preview-state clarity without claiming missing assets are final.
- Browser screenshot review across desktop and mobile.

Recommended files to inspect before editing:

- `index.html`
- `free-assets.html`
- `css/shared.css`
- `css/portfolio-core.css`
- `css/free-assets.css`
- `js/i18n-data.js`
- `js/main.js`
- `js/free-assets.js`
- `js/fa-data.js`
- `verify-frozen.js`
- `docs/agent/preview-contract.md`

Hard constraints for Sprint B:

- Keep vanilla HTML/CSS/classic JS.
- No framework, bundler, production build step, Tailwind, cookies, `localStorage`, or `sessionStorage`.
- Do not touch `js/model-data.js` unless the user explicitly asks.
- Preserve script order and CSS order.
- Preserve card IDs, filters, i18n behavior, language toggle, lazy 3D loading, and accessibility budgets.
- Do not add new `font-size: Npx`.
- Preserve `.work-card:not(.tag-card)` behavior for animation, opacity, transform, hover, cursor, and magnetic logic.
- Do not edit the legacy Claude archive unless the user explicitly asks.

Suggested Sprint B steps:

1. Spawn agents:
   - ТЗ keeper: `instruction_drift_auditor`
   - runtime map: `runtime_mapper`
   - visual/code reviewer: `code_deadwood_auditor` plus visual-review skill/browser screenshots
   - final verification: `verification_reviewer`
2. Capture baseline screenshots for:
   - `index.html` desktop
   - `index.html` mobile
   - `free-assets.html` desktop
   - `free-assets.html` mobile
3. Inventory current portfolio cards:
   - all 18 `data-id` values
   - SVG preview availability
   - visible fallback text
   - i18n mirrors
4. Inventory current free-assets cards:
   - rendered 8-card state
   - `thumb:null` entries
   - GLB preview contract
   - fallback button/fullscreen behavior
5. Design the minimal CSS/HTML changes for poster-first cards.
6. Implement the smallest coherent visual slice.
7. Update i18n mirrors whenever visible copy changes.
8. Add or update narrow verifier checks only where they protect a real regression.
9. Run rendered screenshot review.
10. Run final gates:
    - `npm.cmd run verify`
    - `npm.cmd run quality:fast`
    - `npm.cmd run codex:ship`

Sprint B acceptance:

- Cards look more premium and production-led at first glance.
- Portfolio and free-assets cards feel like the same product system.
- No card presents missing work as final, and no production card uses visible placeholder/debug copy.
- i18n toggles do not restore stale card/case text.
- `verify-frozen.js` still exits with `0 FAIL`.
- `codex:ship` passes before commit/push.

## Deferred Work After Sprint B

Sprint C:

- Split `main.js` into shared/page responsibilities without changing the runtime model.
- Extract shared viewer/shell logic.
- Reduce string-based DOM generation in `free-assets.js`.
- Improve shared-runtime naming clarity.

Sprint D:

- Add Playwright visual baselines.
- Add CI visual PR blocker.
- Expand governance drift checks beyond pass totals and shipped-copy phrases.

Sprint E:

- Tighten Lighthouse/a11y budgets.
- Simplify preloader behavior.
- Limit custom cursor to meaningful zones.

Sprint F:

- Add richer free-assets SEO/image metadata.
- Consider separate asset pages only after card and preview quality are stable.

## Do Not Forget

- `npm.cmd` is safer than `npm` in this Windows PowerShell environment.
- Browser checks can hit sandbox launch issues; rerun outside sandbox when Chromium fails with `spawn EPERM`.
- `quality:fast` may show ESLint warnings from the existing baseline; warnings are not current blockers unless new errors appear.
- `DO_NOT_PUSH.md` must be checked before push.
- Draft PR flow is the default for this repo.
