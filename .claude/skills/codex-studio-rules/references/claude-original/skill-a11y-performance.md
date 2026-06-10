---
name: codex-a11y-performance
description: "Use when the user asks to audit or improve accessibility, Core Web Vitals, Lighthouse scores, LCP, CLS, INP, FID, semantic HTML, ARIA, keyboard navigation, screen reader, color contrast, focus management, or web performance for Codex Studio (codex.promo). Trigger on: accessibility, a11y, ARIA, WCAG, keyboard, screen reader, contrast, focus, Lighthouse, Core Web Vitals, LCP, CLS, INP, performance audit, page speed."
---

# Codex Studio — Accessibility & Performance Auditor

Senior Accessibility Engineer + Performance role.
Accessibility is non-negotiable. Performance budgets are hard limits.
Every interactive element must work with keyboard, screen reader, at 200% zoom.

## Lighthouse targets

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| index.html | ~54–60 (limited by `model-data.js` 1.1 MB) | ≥ 95 | ≥ 95 | ≥ 95 |
| free-assets.html | ≥ 85 | ≥ 95 | ≥ 95 | ≥ 95 |

## Core Web Vitals limits

| Metric | Target | index v0.7.10 baseline | FA v0.7.10 baseline |
|---|---|---|---|
| LCP | ≤ 2.5s | ~2–3s (after lazy-load fix in v0.5) | ~2s |
| CLS | ≤ 0.1 | 0 ✓ | 0 ✓ |
| INP | ≤ 200ms | ✓ | ✓ |
| TBT | ≤ 200ms | ~170ms | ~60ms |
| FCP | ≤ 1.8s | ✓ | ✓ |

## A11y mandatory checks

### Semantic HTML
- [ ] Exactly ONE `<h1>` per page (on index — `.case-view__title`)
- [ ] Heading hierarchy unbroken
- [ ] Landmarks: `<aside>`, `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- [ ] `<button>` for actions, `<a>` for navigation — never swap
- [ ] No redundant ARIA: `role="main"` on `<main>`, `role="list"` on `<ul>`, `role="navigation"` on `<nav>` are FAIL

### ARIA
- [ ] `aria-label` on icon-only buttons (theme-toggle, share, prev/next, cards-toggle, contact)
- [ ] `aria-expanded` on cards-toggle, tags-dropdown trigger
- [ ] `aria-pressed` on game-switch
- [ ] `aria-selected` + `role="tab"` on case-tabs
- [ ] `aria-controls` linking trigger ↔ panel
- [ ] `role="region"` + `aria-label` on case-scroll, case-3d, case-blueprints
- [ ] `aria-multiselectable="true"` on tags-dropdown panel
- [ ] `aria-live="polite"` on cards-count, case-counter
- [ ] `aria-hidden="true"` on decorative SVG icons
- [ ] `role="img"` + `aria-label` ONLY on meaningful standalone SVG
- [ ] NO `aria-label` duplicating visible text (Lighthouse `label-content-name-mismatch` warning)
- [ ] NO `aria-label` on bare `<span>` / `<p>` (no implicit role — ignored by screen reader)

### Keyboard navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual order
- [ ] `:focus-visible` on ALL interactive elements
- [ ] Focus outline ≥ 2px, high contrast
- [ ] Escape closes tags-dropdown, light-dropdown
- [ ] Arrow keys ←/→ on document switch case (when case-view focused)
- [ ] Skip-to-content link at top of `<body>` (if not already present, add)

### Color contrast (WCAG AA)

Точные контрасты для дизайн-системы:

| Background | Foreground | Contrast | Status |
|---|---|---|---|
| `--color-bg #212121` | `--color-text #f0eeeb` | 14:1 | AAA ✓ |
| `--color-bg` | `--color-text-muted #a8a6a2` | 6.63:1 | AA ✓ |
| `--color-bg` | `--color-text-faint #8a8884` | 3.4:1 | **FAIL** — decorative only |
| `--color-surface-2 #313131` | `--color-text-muted` | 5.27:1 | AA ✓ |
| `--color-surface-2` | `--color-text-faint` | 3.67:1 | **FAIL** |
| `--color-primary #327AAE` | `#fff` | 4.64:1 | AA ✓ |
| `--color-primary` | `#000` | 4.53:1 | AA ✓ |
| `--color-primary` | `--color-text #f0eeeb` | 4.0:1 | **FAIL** (close, but not passing) |
| `--color-primary` | `--color-text-inverse #212121` (dark) | 3.47:1 | **FAIL** |

**Rules:**
- On `--color-primary` ALWAYS `#fff` — only WCAG-valid foreground. `--color-text-inverse` fails on dark.
- `--color-text-faint` ONLY for decorative labels/dates. Functional text → `--color-text-muted` or `--color-text`.
- `--color-accent-text #4a94cf` for textual accents on bg/surface (passes AA).

Light theme contrasts: see comments in `tokens.css` (`#7f7e7e` divider 3.49:1 vs `#f5f5f5`, `#626262` text-faint 5.12:1).

### Screen reader
- [ ] All images have meaningful `alt` OR `alt=""` if decorative
- [ ] Form inputs (game-switch, theme-toggle, dropdowns) properly associated
- [ ] No `alt="image"` / `alt="picture"`
- [ ] Hidden text via `.sr-only` class (NOT `display:none`)

### Motion accessibility
- [ ] `prefers-reduced-motion` CSS block disables animations (`!important` allowed here only)
- [ ] `prefers-reduced-motion` JS check: early-return in `animations.js`
- [ ] No parallax on mobile
- [ ] No auto-playing video > 5s

## Performance mandatory checks

### LCP optimization
- [ ] Fontshare preconnect in `<head>` (jsdelivr preconnect removed in v0.8.x — GSAP/Lenis self-hosted in `./js/vendor/`)
- [ ] `font-display: swap` (already in Fontshare URL)
- [ ] No render-blocking JS in `<head>`
- [ ] No hero image to preload — site has none
- [ ] `model-data.js` lazy-loaded (`loadModelData()` on first 3D-tab click)
- [ ] `<model-viewer>` script lazy-injected (`build3D()`)

### CLS prevention
- [ ] Every `<img>` has explicit `width` + `height`
- [ ] Aspect-ratio CSS on flexible media containers (`.case-item__media`, `.work-card__thumb`)
- [ ] Fonts loaded with `font-display: swap`
- [ ] No content insert above existing after load
- [ ] `min-height` on cards-list to prevent collapse during filter

### INP / Main thread
- [ ] GSAP scripts NOT in `<head>` — only before `</body>`
- [ ] Event handlers don't block > 50ms
- [ ] Passive event listeners for scroll/touch (`{ passive: true }`)
- [ ] ScrollTrigger.refresh() debounced/rAF'd

### Asset weight budgets
- Card thumbnail: ≤ 120 KB
- Case slide: ≤ 200 KB
- OG-image: ≤ 200 KB
- GLB: ~5 MB max (with DRACO ≤ 2 MB target)
- HDR: 1.5 MB max
- Total page weight on first load: ≤ 2 MB (excluding lazy `model-data.js` 1.1 MB)

### Render blocking
- [ ] Only critical CSS in `<head>` (tokens/reset/shared/portfolio or free-assets)
- [ ] Fonts preconnected, not render-blocking
- [ ] All JS before `</body>`, no `defer`

## Focus-visible pattern

```css
*:focus { outline: none; }
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

## Skip link pattern (if not present, add)

```html
<a href="#case-view" class="skip-link">Skip to content</a>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: var(--space-4);
  background: var(--color-primary);
  color: #fff;  /* WCAG AA on primary */
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  z-index: 10000;
}
.skip-link:focus-visible { left: var(--space-4); }
```

## Visually hidden pattern

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}
```

## Known frozen performance issues (v0.7.10)

- LCP 2-3s on index — limited by `model-data.js` 1.1 MB. Lazy-load already implemented in v0.5. Further improvement requires extracting model data to per-case `.glb` files (out of v0.7.x scope).
- ~30-40 KB unused CSS in `shared.css`. Cleanup pending.
- Lighthouse Performance index ≈ 54. FA ≈ 85.

These are documented frozen issues, not regressions. Don't flag as new BLOCKERs unless user requests improvement.

## Output format

1. **VERDICT:** PASS / FAIL with score estimates (A11y X/100, Perf X/100)
2. **BLOCKERS** (break keyboard / screen reader use)
3. **MAJOR** issues (fail Lighthouse targets)
4. **MINOR** polish items
5. Each issue: exact location + exact fix (code block labeled with file)
6. Note any frozen-issue exclusions

---

*Version: 2.0 · May 2026 · Codex Studio v0.8 GOLDEN*
