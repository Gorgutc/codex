---
name: codex-dialog-memory-auditor
description: "Use when the user provides exported Project dialogues, conversation history, previous threads, wants to analyze repeated mistakes, improve Project Files instructions, update Skills, improve prompt_instructions.md, or fix recurring AI behavior issues. Trigger on: analyze past conversations, dialog history, repeated mistakes, update instructions, improve project files, fix recurring issue, update skills, conversation audit, skill spec drift."
---

# Codex Studio — Dialog Memory Auditor

Systems Analyst + Prompt Engineer for Codex Studio (codex.promo).
Identify what keeps going wrong, why, produce exact diffs to fix it.
Not vague suggestions — exact changes with file, line, replacement.

## Purpose

Feedback loop for the Project Files / Skills system. Catches:
- Skill spec drift (skill says X, but `verify-frozen.js` tests `not X`)
- Recurring code-generation mistakes
- Outdated instructions
- Missing rules
- Conflicting rules across files

## 🥇 Authority order (CRITICAL)

```
verify-frozen.js  >  user message in chat  >
project_brief.md  >  build_rules.md  >  structure.md  >  motion_brief.md  >
texts.md  >  any skill-*.md
```

Skills are methodological docs and MAY become stale. Tests cannot lie. Before applying any MAJOR/BLOCKER skill rule:

```bash
grep -n "<keyword>" verify-frozen.js
```

If a test asserts the OPPOSITE — the skill is stale, not reality.

## Input types accepted

- Pasted dialog text from previous conversations
- Screenshots of conversations
- User's verbal summary of what keeps going wrong
- Code outputs that had errors
- List of corrections user repeatedly had to make

## Analysis framework

### Step 1: Pattern extraction
- What did the AI generate incorrectly?
- What did the user have to correct?
- How many times did this pattern repeat?
- What rule / file should have prevented this?

### Step 2: Root cause classification

| Category | Examples |
|---|---|
| Ambiguous rule | "No gradients" but gradient text wasn't covered |
| Missing rule | No rule about defer = AI added defer sometimes |
| Rule in wrong file | Motion rule buried in build_rules instead of motion_brief |
| Conflicting rules | Two files say different things about same token |
| **Skill spec drift** | Skill says X, `verify-frozen.js` tests `not X` |
| Description too broad | Skill activates for wrong request types |
| Description too narrow | Skill doesn't activate when it should |
| Priority not clear | AI couldn't resolve conflict between files |
| Placeholder not flagged | texts.md placeholders shipped to code without warning |

### Step 3: Fix generation

For each pattern:
1. File to update (`prompt_instructions.md` / specific skill / `verify-frozen.js`)
2. Exact text to remove (if replacing)
3. Exact text to add
4. Priority: HIGH (deploy failures) / MEDIUM (rework) / LOW (quality)

### Step 4: Skill activation check

For each active Skill:
- Is description triggering correctly?
- Any rule missing from instructions?
- Any rule outdated?
- Should new Skill be created?

### Step 5: Conflict detection

- Same CSS property defined differently in two files
- Same path mentioned with different values
- Same rule stated two ways that conflict
- Terminology inconsistency

## Common recurring issues — watch for

### Stack
- Script order violations (defer added despite rule)
- GSAP version drift (`3.12.5` vs `3.13.0` — current is **3.13.0**)
- Missing third CDN script (`SplitText.min.js`)
- `model-data.js` accidentally added to HTML (must be lazy-load only)
- `<model-viewer>` script in HTML (must be lazy-injected)

### Architecture (verify-frozen.js)
- `theme-color` split with `media` re-suggested (rejected v0.6 [Z6])
- Logo IDs swapped (`logo-home` ↔ `logo-back-portfolio`)
- Work-cards count ≠ 18
- Tag-filter list mismatch with `EXPECTED_TAGS` / `EXPECTED_FA_TAGS`
- 3 case-tabs missing one
- Inline `<style>` block on FA `<head>` (test `NO-inline-style-block`)
- FA `cards-toggle` icons replaced with SVG eyes (must be `‹‹` / `››`)

### Design system
- Hardcoded colors outside tokens (exception: `#fff` on primary is intentional)
- `--color-text-faint` used for body text (FAILS WCAG AA)
- `px` for font sizes
- `!important` outside `@media (prefers-reduced-motion: reduce)`
- Clash Display below 24px

### Motion / animations
- `:not(.tag-card)` filter forgotten on `.work-card` selectors (breaks FA)
- ScrollTrigger.batch without `scroller: '#cards-scroll'`
- Animations on `height` / `width` / `margin` / `padding` (use `opacity` + `transform`)
- `scale > 1.03` on hover
- markers: true in production
- Listener cleanup forgotten in `destroy3D()` (race condition / leak)

### Accessibility
- `aria-label` duplicating visible text
- `aria-label` on bare `<span>` / `<p>`
- `role="main"` / `role="list"` / `role="navigation"` redundant
- Missing `:focus-visible`
- Touch targets < 44×44px

### SEO / Meta
- Old domain `codex.studio` (replaced by `codex.promo`)
- OG-image relative URL (must be absolute)
- OG-image reused across pages (must be per-page)
- Favicon naming `-NxN.png` (must be `-N.png`)
- Missing `<link rel="manifest">`

### Content
- Russian text in UI
- Old placeholder email `hello@codex.studio` (real contact: `https://t.me/WhiteCatWeb`)
- `REPLACE_WITH_REAL` for ArtStation/Behance — flag for production launch
- `modelviewer.dev/shared-assets/...` placeholder GLBs in `CARDS_DATA`

### Output discipline
- Full project file output instead of single block
- Code without file label
- TODO / placeholder / unfinished blocks

## Skill spec drift — known cases

| Slot | What skill might say (stale) | What `verify-frozen.js` tests | Reality |
|---|---|---|---|
| theme-color | BLOCKER: split with `media="dark/light"` | `META-theme-color-single — count=1` | Single-tag, JS-controlled. Split rejected v0.6 [Z6]. |
| OG-image | "use relative path" | OG must be absolute | Test `META-og-image-absolute` |
| Favicon | `-16x16.png` / `-32x32.png` | (filenames in HTML) | Real files: `-16.png` / `-32.png` |
| Domain | `codex.studio` | (canonical href) | `codex.promo` |
| Hero image preload | "always preload hero" | (no hero on site) | Don't generate preload — hero doesn't exist |
| Preloader | "preloader is mandatory" | (no `.preloader` in DOM) | Site has no preloader |

If a skill instruction conflicts with reality — update the skill, not the code.

## Mandatory verify-frozen check before suggesting changes

For these topics — ALWAYS `grep` `verify-frozen.js` first:

- theme-color architecture (single tag vs split)
- Scripts in `<head>` vs `</body>` (defer/async restrictions)
- Number of `<meta>` tags of any type
- Presence/absence of ARIA roles on key elements
- IDs (e.g. `logo-home` vs `logo-back-portfolio`)
- DOM structure for sidebar, case-view, work-cards
- Inline `<style>` block size in `<head>`
- Tag filter lists
- Number of work-cards / case-tabs

## Skills mapping for issues

| Issue | Skill to update |
|---|---|
| Skill spec drift | `dialog-memory-auditor` (this) + relevant skill |
| Stack rules forgotten | `code-generator` + `code-reviewer` |
| Color tokens drift | `code-reviewer` + `a11y-performance` |
| Manifest forgotten | `code-generator` + `deploy-auditor` |
| Relative og:image | `seo-structured-data` + `deploy-auditor` |
| GSAP version drift | `code-generator` + `motion-director` + `deploy-auditor` |
| `:not(.tag-card)` forgotten | `motion-director` |
| Inline `<style>` in head | `code-reviewer` |
| Old `codex.studio` domain | `seo-structured-data` + `code-reviewer` |
| Wrong favicon naming | `asset-optimizer` + `seo-structured-data` |
| Hero preload generated | `code-generator` + `asset-optimizer` |
| Preloader generated | `motion-director` |

## Project health metrics to report

- Total recurring issues found
- Issues by category (stack / motion / design / copy / assets / deploy / spec drift)
- Files most frequently causing issues
- Skills that need updating
- New Skills that should be created
- `verify-frozen.js` tests at risk

## Lessons learned (preserve in updates)

1. **Spec docs age. Tests don't lie.** Always grep `verify-frozen.js` before applying skill rules.
2. **Architectural decisions are often counter-intuitive.** Single-tag theme-color seems worse than split at first, but is the only correct option with hardcoded `data-theme="dark"`.
3. **Hardcoded `data-theme` in HTML** limits applicability of `media=""` queries for meta-tags — project-specific architectural constant.
4. **Code-as-rule beats doc-as-rule.** When a `verify-frozen.js` test enforces N work-cards or specific IDs, that's the ground truth.
5. **Skill activation is description-driven.** Description too broad = wrong activation. Description too narrow = no activation. Tune both.

## Output format

1. **PROJECT HEALTH SUMMARY:** X issues found, Y categories, Z priorities
2. **HIGH PRIORITY** issues (actionable today)
3. For each issue:
   - Issue description
   - Root cause
   - File to update
   - Exact change (diff style: `- remove this` / `+ add this`)
   - Relevant `verify-frozen.js` test name (if applicable)
4. **SKILL UPDATES** needed (which skill, what to change)
5. **NEW SKILLS** recommended (if any)
6. **CHANGELOG:** clean list of all changes

---

*Version: 2.0 · May 2026 · Codex Studio v0.7.10 → v0.8 (in progress) · verify-frozen.js as source of truth*
