# Skill drift report

Generated: 2026-05-22 07:13 UTC
Repo: Gorgutc/codex
Branch: claude/confident-dirac-4a7TS
verify-frozen.js: 48/56 PASS (cloud-env baseline; the 8 failures are environmental — `host_not_allowed` on jsdelivr / unpkg / modelviewer CDNs. The 48 architectural tests still validate. Locally with open internet: 56/56.)

Audit scope: every file matching `.claude/skill-*.md` (10 files) cross-referenced against:
1. `verify-frozen.js` keyword by keyword (theme-color, EXPECTED_IDS, EXPECTED_TAGS, EXPECTED_FA_TAGS, defer, localStorage, prefers-color-scheme, registerPlugin, :not(.tag-card), !important).
2. Actual repo structure (file presence under `css/`, `js/`).
3. Each other (CONFLICT detection on shared topics).

## Summary

| Category | Count | Notes |
|---|---|---|
| DRIFT (skill contradicts test) | **0** | All architectural rules in skills agree with verify-frozen.js. |
| OBSOLETE (skill references files/behavior no longer in codebase) | **5 files, 5 lines** | All caused by the v0.9.5 `portfolio.css` split into `portfolio-core.css` + `portfolio-case.css`. |
| STALE LABEL (version label outdated; content may still be accurate) | **5 files, 7 lines** | Headings/labels say `v0.7.10` instead of `v0.8 GOLDEN`. Content under those headings is still in agreement with current code. |
| UNVERIFIED (skill rule with no matching test) | n/a | Most craftsmanship rules in skills are methodology (a11y/perf/copy/SEO) — verify-frozen.js does not and should not cover them. Flagging individually would add noise. |
| CONFLICT (two skill files disagree on same topic) | **0** | All cross-skill claims on `defer`, `localStorage`, `prefers-color-scheme`, theme-color single-tag, `:not(.tag-card)`, `gsap.registerPlugin` ordering, `!important` scope, and `EXPECTED_IDS`/`EXPECTED_TAGS`/`EXPECTED_FA_TAGS` invariants are consistent. |

---

## OBSOLETE

The v0.9.5 split of `css/portfolio.css` into `css/portfolio-core.css` (eager, ~1.5 KB) and `css/portfolio-case.css` (lazy/preloaded, ~16 KB) — already reflected in `index.html:160-172` — was not propagated to the following skill files:

### `.claude/skill-code-generator.md`
- **Line 55:** "(index.html only) ./css/portfolio.css"
  - Reality: index.html loads `portfolio-core.css` directly and `portfolio-case.css` via `<link rel="preload" as="style"...onload="...this.rel='stylesheet'">` with a `<noscript>` fallback.
  - Recommendation: replace with the two-file pattern. Optionally add a one-line note that v0.9.5 split was done to recover ~17 KiB of unused initial-paint CSS.
- **Line 166:** "FILE: index.html / FILE: css/portfolio.css / FILE: js/animations.js"
  - Recommendation: replace `css/portfolio.css` with whichever sub-file the example actually targets (`portfolio-core.css` for thumb backgrounds, `portfolio-case.css` for case-view).

### `.claude/skill-code-reviewer.md`
- **Line 76:** "CSS: `tokens.css`, `reset.css`, `shared.css`, `portfolio.css` (index), `free-assets.css` (FA)"
  - Recommendation: update to `tokens.css`, `reset.css`, `shared.css`, `portfolio-core.css` (index, eager), `portfolio-case.css` (index, preload), `free-assets.css` (FA).

### `.claude/skill-deploy-auditor.md`
- **Line 35:** "`css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/portfolio.css`, `css/free-assets.css`"
  - Recommendation: same fix as `skill-code-reviewer.md:76`. This is a deploy checklist — keep the list authoritative.

### `.claude/skill-motion-director.md`
- **Line 248:** "CSS code (hover/micro) — `FILE: css/shared.css` or `css/portfolio.css`"
  - Recommendation: replace `css/portfolio.css` with `css/portfolio-case.css` (hover/micro on case-view elements live in portfolio-case; thumbnail-level hover lives in `shared.css` or `portfolio-core.css`).

### Notes
- `verify-frozen.js` does **not** test specific CSS filenames, so these are *obsolete* but **not** *drift* — skills don't contradict any test; they just point at a file that no longer exists.
- None of these blocks the project today: subagents and `/ship` use real paths from `index.html` at runtime.

---

## STALE LABEL

Skill files contain headings or notes referring to `v0.7.10` baseline; current is `v0.8 GOLDEN` (base v0.7.10 plus the v0.8.x corrections — see `16_HANDOFF_v0_8.md`). In every case the **content under the heading still describes current behavior** — only the label is outdated.

| File | Line | Quote | Recommendation |
|---|---|---|---|
| `skill-asset-optimizer.md` | 9 | "Real asset inventory v0.7.10 — see `assets_brief.md`." | Re-label `v0.8 GOLDEN`. If `assets_brief.md` changed since v0.7.10, sync the inventory list there too. |
| `skill-deploy-auditor.md` | 144 | "### Lighthouse targets (v0.7.10 baseline)" | Re-label `v0.8 GOLDEN baseline`. Numbers under this heading should be re-measured on v0.8 if they were measured against v0.7.10. |
| `skill-a11y-performance.md` | 21 | "\| Metric \| Target \| index v0.7.10 baseline \| FA v0.7.10 baseline \|" | Same as above — table columns should reflect the v0.8 measured numbers, or stay v0.7.10 with a disclaimer. |
| `skill-a11y-performance.md` | 175 | "## Known frozen performance issues (v0.7.10)" | Re-label `v0.8`. Confirm that the listed issues still exist after v0.8 corrections (esp. v0.9.5 CSS split affecting initial paint). |
| `skill-seo-structured-data.md` | 155 | "## sitemap.xml (v0.7.10)" | Re-label or remove version qualifier (sitemap.xml in repo root is the source of truth — link to it instead of re-stating). |
| `skill-seo-structured-data.md` | 175 | "## robots.txt (v0.7.10)" | Same as above. |
| `skill-motion-director.md` | 59 | "## CRITICAL — actual project patterns (v0.7.10)" | Re-label `v0.8 GOLDEN`. |

---

## DRIFT

No skill file contradicts any verify-frozen.js test on the audited keywords. Specifically validated alignments:

- `META-theme-color-single` test ↔ skill-code-generator, skill-code-reviewer, skill-dialog-memory-auditor, skill-reference-analyzer, skill-motion-director, skill-seo-structured-data: all enforce single tag, no `media=""`, no `prefers-color-scheme` split. ✓
- `EXPECTED_IDS` test ↔ skill-asset-optimizer (full list), skill-code-generator, skill-deploy-auditor, skill-code-reviewer, skill-reference-analyzer: all reference 18 work-cards with matching IDs. ✓
- `EXPECTED_TAGS` / `EXPECTED_FA_TAGS` tests ↔ skill-deploy-auditor, skill-dialog-memory-auditor: tag lists agree. ✓
- `SCRIPTS-no-defer` test ↔ skill-code-generator, skill-a11y-performance, skill-deploy-auditor, skill-code-reviewer: all forbid `defer` and `type="module"`. ✓
- `:not(.tag-card)` rule ↔ skill-code-generator:110, skill-motion-director:85-92,120,252, skill-deploy-auditor:99, skill-code-reviewer:141, skill-dialog-memory-auditor:116,185: consistent. ✓
- `gsap.registerPlugin(ScrollTrigger)` first executable line rule ↔ skill-code-reviewer:138, skill-motion-director:21, skill-deploy-auditor:96: consistent. ✓
- `!important` only inside `@media (prefers-reduced-motion: reduce)` ↔ skill-a11y-performance:91, skill-code-generator:127, skill-deploy-auditor:106, skill-code-reviewer:94, skill-dialog-memory-auditor:112, skill-motion-director:35-36,46: consistent. ✓

---

## UNVERIFIED

Most rules in skill files are **methodology** (craftsmanship checklists for a11y, performance, copy quality, asset optimization, SEO depth, motion polish). `verify-frozen.js` is **architecture** (DOM IDs, head structure, script order, theme-color count). The asymmetry is by design — verify-frozen guards the load-bearing decisions; skills coach the craft.

No individual UNVERIFIED items are surfaced here because doing so would flag almost every line of a skill file. If you want to grow `verify-frozen.js` to cover more rules, the highest-leverage candidates are:

1. **A check that `css/portfolio-core.css` and `css/portfolio-case.css` both load** (currently no test catches a future regression of the v0.9.5 split being undone). Could be a simple HEAD-request test on each `<link>`.
2. **A check that the `<link rel="preload" as="style">` for `portfolio-case.css` is present** (it's a perf invariant — if dropped, openCase() relayout regresses by ~1.8 s on desktop per the comment in index.html:162-167).
3. **A check that `js/model-data.js` is **not** referenced from the static `<script>` block in `<head>` or above `</body>`** (it's lazy-loaded; eager inclusion would break the 1.1 MB initial-paint budget).

These are recommendations, not blockers. The current 56 tests already cover the load-bearing surface.

---

## CONFLICT

None detected. All skill files agree on the audited invariants.

---

## Next actions

These are advisory. Apply manually after review — `/audit-skills` (and this report) **never** rewrites skill files.

Priority order:

1. **OBSOLETE — fix `portfolio.css` references in 4 skill files** (skill-code-generator.md:55,166; skill-code-reviewer.md:76; skill-deploy-auditor.md:35; skill-motion-director.md:248). Small mechanical change; prevents new-agent confusion.
2. **STALE LABEL — bump `v0.7.10` headings to `v0.8 GOLDEN`** in 5 skill files. While doing this, double-check that any tables/numbers under those headings still match current measurements.
3. **Optional: extend `verify-frozen.js`** with the three suggested architectural tests so the v0.9.5 CSS split, the preload pattern, and the model-data.js lazy-loading become regression-protected.

This report itself is committed as `SKILL_DRIFT_REPORT.md` in the repo root and pushed with the rest of the agent-infrastructure-v1 PR. No skill files were modified during the audit.
