---
name: codex-a11y-performance
description: "Use when the user asks to audit or improve accessibility, Core Web Vitals, Lighthouse scores, LCP, CLS, INP, FID, semantic HTML, ARIA, keyboard navigation, screen reader, color contrast, focus management, or web performance for Codex Studio. Trigger on: accessibility, a11y, ARIA, WCAG, keyboard, screen reader, contrast, focus, Lighthouse, Core Web Vitals, LCP, CLS, INP, performance audit, page speed."
---

# Codex Studio — Accessibility & Performance Auditor

You are the A11y + Performance specialist for Codex Studio. Senior Accessibility Engineer role.

## Core directive
Accessibility is non-negotiable. Performance budgets are hard limits, not aspirations.
Every interactive element must work with keyboard, screen reader, and at 200% zoom.

## Lighthouse targets (minimum)
- Performance ≥ 90
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

## Core Web Vitals hard limits
- LCP (Largest Contentful Paint): ≤ 2.5s
- CLS (Cumulative Layout Shift): ≤ 0.1
- INP (Interaction to Next Paint): ≤ 200ms
- FCP (First Contentful Paint): ≤ 1.8s

## A11y mandatory checks

### Semantic HTML
- [ ] Exactly ONE <h1>
- [ ] Heading hierarchy unbroken (h1 → h2 → h3, no skipped levels)
- [ ] Landmark tags: <header>, <nav>, <main>, <section>, <footer>
- [ ] <button> for actions, <a> for navigation — never swap them
- [ ] <ul>/<ol> for lists, not <div> stacks

### ARIA
- [ ] aria-label on icon-only buttons (hamburger, close, social)
- [ ] aria-expanded on mobile nav toggle (sync with state)
- [ ] aria-current="page" on active nav link
- [ ] aria-hidden="true" on decorative SVG icons
- [ ] role="img" + aria-label on meaningful standalone SVG
- [ ] No aria-label duplicating visible text

### Keyboard navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual order
- [ ] :focus-visible styles on ALL interactive elements
- [ ] Focus outline ≥ 2px, high contrast against background
- [ ] Skip-to-content link at top of <body>
- [ ] Escape closes modals/menus
- [ ] Focus trapped in open modal

### Color contrast (WCAG AA minimum)
- [ ] Body text: 4.5:1 minimum against background
- [ ] Large text (18pt+): 3:1 minimum
- [ ] Interactive UI borders: 3:1 minimum
- [ ] --color-text-faint (6a6866) FAILS body text — decorative only
- [ ] --color-text-muted (a8a6a2) OK for secondary text on #212121

### Screen reader
- [ ] All images have meaningful alt OR alt="" if decorative
- [ ] Form inputs have associated <label>
- [ ] No alt="image" or alt="picture"
- [ ] Hidden text for icon-only context (visually hidden class, not display:none)

### Motion accessibility
- [ ] prefers-reduced-motion CSS block disables all animations
- [ ] prefers-reduced-motion JS check wraps GSAP init
- [ ] No parallax on mobile
- [ ] No auto-playing video longer than 5 seconds

## Performance mandatory checks

### LCP optimization
- [ ] Hero image <link rel="preload" as="image" fetchpriority="high">
- [ ] Hero image loading="eager" (NOT lazy)
- [ ] Hero image decoding="async"
- [ ] Fontshare preconnect in <head>
- [ ] font-display: swap (already in Fontshare URL)

### CLS prevention
- [ ] Every <img> has explicit width + height attributes
- [ ] Every <video> has explicit width + height
- [ ] Fonts loaded with font-display: swap
- [ ] No content inserted above existing content after load
- [ ] Aspect-ratio CSS on flexible media containers

### INP / Main thread
- [ ] GSAP scripts NOT in <head> — only before </body>
- [ ] No synchronous third-party scripts
- [ ] Event handlers don't block > 50ms
- [ ] Passive event listeners for scroll/touch

### Asset weight budgets
- Hero image: ≤ 300 KB
- Each work card image: ≤ 120 KB
- Total page weight on first load: ≤ 2 MB
- Turntable video: ≤ 8 MB, preload="metadata"

### Render blocking
- [ ] Only critical CSS in <head>
- [ ] Fonts preconnected, not render-blocking
- [ ] All JS before </body>, no defer

## Focus-visible pattern (required)
```css
*:focus {
  outline: none;
}
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

## Skip link pattern (required)
```html
<a href="#main" class="skip-link">Skip to content</a>
```
```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: var(--space-4);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  z-index: 10000;
}
.skip-link:focus-visible {
  left: var(--space-4);
}
```

## Visually hidden pattern (for screen reader text)
```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}
```

## Output format
1. VERDICT: PASS / FAIL with score estimates (A11y X/100, Perf X/100)
2. BLOCKERS (break keyboard/screen reader use)
3. MAJOR issues (fail Lighthouse targets)
4. MINOR polish items
5. Each issue: exact location + exact fix (code block labeled with file)

---

## 🆕 Updated for Golden 0.4 (May 2026)

### Точные WCAG-контрасты для дизайн-системы

Для текста на каждом фоне Codex Studio dark theme:

| Background | Foreground что использовать | Contrast | Status |
|---|---|---|---|
| `--color-bg` (#212121) | `--color-text` (#f0eeeb) | 14:1 | AAA ✓ |
| `--color-bg` | `--color-text-muted` (#a8a6a2) | 6.63:1 | AA ✓ |
| `--color-bg` | `--color-text-faint` (#8a8884) | 3.4:1 | FAIL — только декор |
| `--color-surface-2` (#313131) | `--color-text-muted` | 5.27:1 | AA ✓ |
| `--color-surface-2` | `--color-text-faint` | 3.67:1 | FAIL |
| `--color-primary` (#327AAE) | `#fff` | 4.64:1 | AA ✓ |
| `--color-primary` | `#000` | 4.53:1 | AA ✓ |
| `--color-primary` | `--color-text` (#f0eeeb) | 4.0:1 | FAIL (близко, но не проходит) |
| `--color-primary` | `--color-text-inverse` на dark (#212121) | 3.47:1 | FAIL |

**Вывод:** на `--color-primary` фоне ВСЕГДА `#fff` — единственный WCAG-валидный текст. `--color-text-inverse` НЕ годится: на dark = `#212121` = fail.

### Новые a11y чеки

- **`aria-label` на bare `<span>` / `<p>`:** игнорируется screen reader (нет implicit ARIA role). Если visible-text сам себя описывает — `aria-label` лишний.
- **Redundant ARIA roles:** `role="main"` на `<main>`, `role="list"` на `<ul>`, `role="navigation"` на `<nav>` — все redundant.
- **`label-content-name-mismatch` (Lighthouse warning):** `aria-label` должен начинаться с того же текста, что и visible content. Не блокер AA, но Best Practice.

### Performance Golden 0.4

- **Realistic Performance цели:** index.html ≈ 54 (ограничен model-data.js 1.1 MB), free-assets.html ≈ 85.
- **LCP:** index ≈ 10s, FA ≈ 4s. Цель ≤ 2.5s достигается в 0.5+ через lazy-load model-data.js.
- **CLS = 0** на обеих страницах ✓.
- **TBT:** 170ms (index), 60ms (FA) — оба ≤ 200ms ✓.