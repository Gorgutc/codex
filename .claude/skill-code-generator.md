---
name: codex-code-generator
description: "Use when the user asks to generate or modify production-ready HTML, CSS, or Vanilla JS for the Codex Studio website (codex.promo). Trigger on: create section, build block, write code, update HTML, update CSS, update JS, sidebar, work-card, case-view, case-3d, case-blueprints, model-viewer, free-assets, fa-card, tag-card, GSAP animation, ScrollTrigger, theme toggle, dark mode, light mode, static website, Codex Studio code. Must follow Codex Studio Project Files, fixed vanilla stack, GSAP CDN rules, mobile-first, dark mode default, no frameworks, no placeholders, no defer, NO theme-color split."
---

# Codex Studio — Code Generator

Senior Frontend Developer role. Production-ready code first try. No placeholders, no TODOs.

## MANDATORY: read in this order before any code generation

1. `prompt_instructions.md`
2. `project_brief.md`
3. `build_rules.md`
4. `structure.md`
5. `motion_brief.md`
6. `assets_brief.md`
7. `texts.md`
8. `verify-frozen.js` — if change touches `<head>`, DOM IDs, work-card count/IDs, tabs, theme-color, scripts

## Stack — immutable, NEVER change without explicit user permission

- HTML + CSS + Vanilla JS ONLY
- GSAP **3.13.0** + ScrollTrigger + SplitText via CDN ONLY
- Clash Display + General Sans via Fontshare CDN ONLY
- `<model-viewer>` 4.0.0 (Google) via CDN, lazy-loaded
- NO React / Vue / Next / Tailwind / npm / build tools / bundlers / PostCSS
- NO `localStorage` / `sessionStorage`
- NO `defer` / `type="module"` on any script tag
- NO hardcoded colors outside CSS custom properties (exception: `#fff` on `--color-primary` for WCAG AA)
- Domain in canonical/OG/JSON-LD: `https://codex.promo/`

## Script order — strictly before `</body>`, ALL without defer

```
1. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js
2. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js
3. https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js
4. ./js/main.js
5. ./js/animations.js
```

`model-data.js` — lazy-load only via `loadModelData()` in `main.js` on first 3D-tab click. NEVER include eagerly.
`<model-viewer>` script — lazy-injected in `build3D()` from `main.js`.

## CSS link order — strictly in `<head>`

```
1. preconnect: api.fontshare.com (crossorigin)
2. preconnect: cdn.jsdelivr.net (crossorigin)
3. Fontshare stylesheet
4. ./css/tokens.css
5. ./css/reset.css
6. ./css/shared.css
7. (index.html only) ./css/portfolio.css
   (free-assets.html only) ./css/free-assets.css
```

## Theme

- `<body data-theme="dark">` — hardcoded
- Light mode via `data-theme="light"` set by JS (`applyTheme()`)
- Theme-color: **single tag** `<meta name="theme-color" content="#212121">` — NO `media="(prefers-color-scheme: ...)"` (rejected v0.6 [Z6])
- JS updates `<meta theme-color>` content on toggle
- No localStorage — toggle state lost on reload (acceptable)

## Typography rules

- Clash Display: only at `--text-xl` (24px) and above
- General Sans: body, nav, buttons, labels, anything below 24px
- Body text: always `--text-base`
- Max 4–5 unique font/size/weight combos per page

## Color tokens — use ONLY CSS variables from tokens.css

Dark (defaults):
- Surface: `--color-bg #212121`, `--color-surface #2a2a2a`, `--color-surface-2 #313131`, `--color-surface-offset #3a3a3a`, `--color-divider #404040`, `--color-border #4a4a4a`
- Text: `--color-text #f0eeeb`, `--color-text-muted #a8a6a2`, `--color-text-faint #8a8884` (decorative only — FAILS WCAG AA), `--color-text-inverse #212121`
- Primary: `--color-primary #327AAE`, `--color-primary-hover #2a6695`, `--color-primary-active #225380`, `--color-primary-highlight rgba(50,122,174,0.12)`
- Text accent on bg/surface: `--color-accent-text #4a94cf`
- Secondary (teal): `--color-secondary #2E8B8F`
- Component tokens: `--color-work-card-bg/-hover/-border/-border-hov`, `--color-3d-canvas-bg/-glow`, `--color-case-bar-bg`, `--color-ctrl-bg`
- Blueprint: `--bp-grid-minor`, `--bp-grid-major`

Text on `--color-primary`: ALWAYS `#fff` (only `#fff` passes WCAG AA = 4.64:1; `--color-text-inverse` fails on dark).

## Mobile-first breakpoints

`375px` (base) → `768px` (tablet) → `1024px` (small desktop) → `1280px` (desktop)
Touch targets ≥ 44×44px. `:focus-visible` on all interactive elements.

## Images — every `<img>` requires

- `alt` (descriptive, never "image")
- `width` + `height` (prevents CLS)
- `loading="lazy"` (default for non-critical)
- `decoding="async"`

NO hero image on this site — do NOT generate `<link rel="preload" as="image">` for non-existent file.

## Architecture constraints (frozen — verify-frozen.js)

- 18 work-cards on index.html with exact `data-id` from `EXPECTED_IDS`
- Tag filters index: `all / hard-surface / product / organic / prototyping / animations / cad`
- Tag filters FA: `hard-surface / product / game / organic / animation / cad`
- 3 case-tabs: `2D / 3D / Blueprints`
- Logo IDs: `logo-home` (index) / `logo-back-portfolio` (FA) — DO NOT swap
- FA `cards-toggle` icons: `‹‹` and `››` (chevrons) — NOT SVG eyes
- FA `<head>` must have ZERO inline `<style>` blocks
- `:not(.tag-card)` filter on every `.work-card` selector in `animations.js`

## Prohibitions — NEVER generate

- Theme-color split with `media="(prefers-color-scheme: ...)"`
- Gradient buttons
- Colored `border-left` on cards
- Icon circles with colored backgrounds
- Emoji as UI elements
- Centered-everything layout
- Sections of identical height
- Wavy SVG dividers
- Floating geometric decorations
- Aurora / mesh gradient backgrounds
- Stock photos of people
- Fake counters ("500+ clients")
- Cyrillic in any UI element
- `!important` outside `@media (prefers-reduced-motion: reduce)`
- `px` for font sizes (use `rem` + `clamp()`)
- Inline `style=""` (exception: card-thumb gradient placeholder backgrounds)
- `<div>` instead of semantic tags
- More than 3 font families
- `role="main"` / `role="list"` / `role="navigation"` (redundant ARIA on native tags)
- `aria-label` duplicating visible text
- `aria-label` on bare `<span>` / `<p>` (no implicit ARIA role)

## CSS class naming

BEM-style descriptive (`.case-view__title`, `.work-card__thumb`). No global utility classes.

## Accessibility (mandatory)

- One `<h1>` per page (on index — `.case-view__title`)
- Heading hierarchy unbroken
- Semantic HTML: `<aside>`, `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- `aria-label` on icon-only buttons
- `:focus-visible` on all interactive elements
- `prefers-reduced-motion` in CSS AND in JS (early-return in `animations.js`)
- ARIA: `role="tab"`/`tablist`, `aria-selected`, `aria-controls`, `aria-expanded`, `aria-pressed` on toggles, `role="region"` on case-scroll/case-3d/case-blueprints, `aria-multiselectable="true"` on tags-dropdown panel

## SEO/Meta (per page)

- `<link rel="canonical" href="https://codex.promo/...">` absolute
- `og:url`, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image` (absolute URL), `og:image:width=1200`, `og:image:height=630`, `og:image:alt`, `og:locale`
- Twitter: `twitter:card="summary_large_image"`, title, description, image
- Per-page OG-image — NEVER reuse `og-image.jpg` for FA
- `<meta name="theme-color" content="#212121">` single tag
- Favicon: `.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180×180), `site.webmanifest`
- `<link rel="manifest">` always
- JSON-LD on index: Organization + WebSite + ItemList; on FA: Organization + WebPage
- `&` in HTML entities → `&amp;` (W3C valid)

## Output format

1. One-line decision: what exactly will be generated/changed
2. Code only for the requested block or file
3. Label each code block: `FILE: index.html` / `FILE: css/portfolio.css` / `FILE: js/animations.js`
4. If modifying a single block — output ONLY that block, never the full project
5. After code: short compliance checklist (5 items max), referencing relevant `verify-frozen.js` test names if applicable

---

*Version: 2.0 · May 2026 · Codex Studio v0.8 GOLDEN*
