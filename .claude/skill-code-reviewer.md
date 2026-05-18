---
name: codex-code-reviewer
description: "Use when the user asks to review, audit, validate, debug, check, fix, or improve Codex Studio (codex.promo) code. Trigger on: check code, review, audit, find bugs, fix layout, accessibility check, responsive check, before deploy, Lighthouse, W3C, validate HTML, CSS review, JS debug, performance check, Netlify, GitHub Pages, pre-deploy. Always review code before accepting it into the project. Always cross-check against verify-frozen.js."
---

# Codex Studio — Code Reviewer

Strict QA. Catch all violations before code enters the project. Authority order: `verify-frozen.js` > `project_brief.md` > `build_rules.md` > skill files.

## Review against ALL Project Files

- `prompt_instructions.md` — priorities, technical constants
- `project_brief.md` — goal, audience, immutable decisions
- `build_rules.md` — tokens, prohibitions
- `structure.md` — file structure, CDN order, layout, frozen invariants
- `motion_brief.md` — animation rules, real patterns
- `assets_brief.md` — images, GLB, HDR, naming, dimensions, favicon naming
- `texts.md` — placeholder detection, English-only UI
- `reference_brief.md` — anti-AI-design patterns
- `verify-frozen.js` — **authoritative source of architectural decisions**

## Severity labels

- BLOCKER: must fix before any deploy. Breaks `verify-frozen.js`, accessibility, or stack rule.
- MAJOR: must fix before final delivery. Quality regression.
- MINOR: should fix.
- NICE: optional polish.

## verify-frozen.js — protected invariants (any violation = BLOCKER)

- `BODY-theme-dark-default` — `<body data-theme="dark">`
- `META-theme-color-single` — exactly ONE `<meta name="theme-color">`, no `media=""`
- `META-favicon-16` — `<link rel="icon" sizes="16x16">` present
- `META-manifest` — `<link rel="manifest">` present
- `META-og-image-absolute` — og:image starts with `https?://`
- `META-og-image-fa-specific` — FA og:image ends with `og-free-assets.jpg`
- `META-canonical` / `META-robots` / `META-og-complete` / `META-twitter-complete` / `META-jsonLD`
- `SCRIPTS-no-defer` — no `<script>` has `defer`
- `SCRIPTS-order` — gsap < ScrollTrigger < main.js < animations.js
- `WORK-cards-18` — exactly 18 `.work-card` on index
- `WORK-cards-ids` — all `EXPECTED_IDS` present
- `WORK-cards-game-assets` — ≥2 cards with `data-game-asset="true"` (Nightshard, Recon Drone)
- `TAGS-buttons` — `EXPECTED_TAGS` complete in dropdown
- `CASE-tabs-3` — exactly 3 `.case-tab` (2D/3D/Blueprints)
- `CASE-share-desktop` / `CASE-share-mobile` — both COPY LINK buttons present
- FA: `B1-no-logo-home` / `B1-logo-back-portfolio` — correct logo ID
- FA: `B6-chevron-icons` — `‹‹` / `››`, not SVG eyes
- FA: `NO-inline-style-block` — zero inline `<style>` in `<head>`
- FA: `N4-game-keeps-tag-cards` — game-switch does NOT hide tag-cards
- `CONSOLE-no-internal-errors` — no internal JS errors

Before suggesting any change in `<head>`, DOM IDs, theme-color, scripts, or work-card structure: `grep` the relevant test in `verify-frozen.js`.

## Review checklist

### Stack
- [ ] HTML + CSS + Vanilla JS only (no React/Vue/Next/Tailwind/npm)
- [ ] GSAP **3.13.0** via CDN (gsap + ScrollTrigger + SplitText)
- [ ] Fontshare CDN for fonts only
- [ ] No `localStorage` / `sessionStorage`
- [ ] No `defer` / `type="module"` on any script
- [ ] No hardcoded color values outside CSS custom properties (exception: `#fff` on primary)
- [ ] Domain `codex.promo` (not `codex.studio`)

### Script order (BLOCKER if wrong)
- [ ] gsap.min.js → ScrollTrigger.min.js → SplitText.min.js → main.js → animations.js
- [ ] All before `</body>`
- [ ] No defer, no async (unless intentional), no `type="module"`
- [ ] `model-data.js` lazy-loaded ONLY via `loadModelData()` in main.js — NOT in HTML

### CSS link order (BLOCKER if wrong)
- [ ] preconnect Fontshare + jsdelivr → Fontshare CSS → tokens → reset → shared → portfolio (or free-assets)

### File structure
- [ ] index.html, free-assets.html at project root
- [ ] CSS: `tokens.css`, `reset.css`, `shared.css`, `portfolio.css` (index), `free-assets.css` (FA)
- [ ] JS: `main.js`, `animations.js`, `model-data.js` (lazy)
- [ ] OG images: `./assets/img/og-image.jpg` and `./assets/img/og-free-assets.jpg`
- [ ] Favicon files: `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `site.webmanifest` (NOT `-16x16` / `-32x32`)
- [ ] No `dist/`, `build/`, `node_modules/`

### HTML semantics
- [ ] `<body data-theme="dark">`
- [ ] Exactly ONE `<h1>` (on index — `.case-view__title`)
- [ ] Heading hierarchy unbroken
- [ ] Semantic tags: `<aside>`, `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- [ ] No redundant ARIA: `role="main"`, `role="list"`, `role="navigation"` removed
- [ ] External links: `target="_blank" rel="noopener noreferrer"`
- [ ] No inline `style=""` (exception: card-thumb gradient backgrounds)

### CSS / Design system
- [ ] All colors via CSS custom properties only (exception: `#fff` on primary)
- [ ] Font sizes in `rem` or `clamp()`, never `px`
- [ ] No `!important` outside `@media (prefers-reduced-motion: reduce)`
- [ ] Clash Display only at `--text-xl` (24px) and above
- [ ] General Sans for body/nav/buttons
- [ ] `--color-text-faint` only for decorative elements (never body text)
- [ ] Spacing only from 4px-grid tokens (`--space-N`)
- [ ] Dark + light mode both working

### Anti-AI-design patterns (BLOCKER)
- [ ] No gradient buttons
- [ ] No colored `border-left` on cards
- [ ] No icon circles with colored backgrounds
- [ ] No emoji in UI
- [ ] No centered-everything layout
- [ ] No identical-height sections
- [ ] No wavy SVG dividers
- [ ] No floating geometric decorations
- [ ] No aurora / mesh gradient backgrounds

### Responsive / Mobile
- [ ] Mobile-first CSS (base = 375px)
- [ ] 768 / 1024 / 1280px breakpoints present
- [ ] Touch targets ≥ 44×44px
- [ ] No hover-only without touch alternative
- [ ] No horizontal overflow on mobile

### Accessibility
- [ ] `:focus-visible` on all interactive elements
- [ ] `aria-label` on icon-only buttons (theme-toggle, share, nav arrows, etc.)
- [ ] No `aria-label` duplicating visible text
- [ ] No `aria-label` on bare `<span>` / `<p>` without role
- [ ] Images: descriptive `alt` (or `alt=""` if decorative)
- [ ] `prefers-reduced-motion` in CSS
- [ ] `prefers-reduced-motion` early-return in `animations.js`
- [ ] Color contrast WCAG AA: text on bg, text on primary (`#fff` only), text on surfaces

### Images / Assets
- [ ] Every `<img>`: `alt`, `width`, `height`, `loading`, `decoding`
- [ ] No `loading="eager"` unless critical above-the-fold (currently no hero image)
- [ ] No GIF files
- [ ] File names: lowercase, hyphen-separated, no Cyrillic/spaces
- [ ] OG image absolute URL `https://codex.promo/...`
- [ ] Per-page OG-image (not reused)

### GSAP / Motion
- [ ] `gsap.registerPlugin(ScrollTrigger)` — first executable line in `animations.js`
- [ ] SplitText registered with `typeof !== 'undefined'` guard
- [ ] Reduced-motion early-return present
- [ ] `:not(.tag-card)` filter on every `.work-card` selector animating opacity/transform/hover
- [ ] ScrollTrigger.batch uses `scroller: '#cards-scroll'` for sidebar cards (not window)
- [ ] Only `opacity` + `transform` animated (not height/width/margin/padding)
- [ ] Scroll reveal movement ≤ 32px
- [ ] Hover scale ≤ 1.03
- [ ] No bounce easing
- [ ] No infinite UI animations
- [ ] markers: false in production

### Content
- [ ] No Cyrillic in any UI element
- [ ] Telegram link `https://t.me/WhiteCatWeb` (not placeholder email)
- [ ] No "passionate about", "one-stop shop", "500+ clients", "10 years experience"
- [ ] Domain `codex.promo` everywhere (not `codex.studio`)
- [ ] `data-cad-placeholder="true"` on CAD work-cards (mech-link, flex-spine, cad-strut)
- [ ] `data-game-asset="true"` only on `nightshard` + `recon-drone`

### Performance risks
- [ ] No render-blocking scripts in `<head>`
- [ ] Fontshare preconnect present
- [ ] cdn.jsdelivr.net preconnect present
- [ ] All images have explicit `width` + `height`
- [ ] `model-data.js` lazy-loaded (NOT in HTML)
- [ ] `<model-viewer>` script lazy-injected (NOT in HTML)

### Listener cleanup
- [ ] `currentLightDdDocClick` / `currentLightDdDocKey` / `currentWheelListener` removed in `destroy3D()` to prevent leaks on case-switch

## Output format

1. **VERDICT:** READY TO DEPLOY / NOT READY — X BLOCKERS, Y MAJORS
2. **Issues** — only BLOCKER and MAJOR by default (list MINOR only if asked)
3. For each issue: severity label + exact location + exact fix + relevant `verify-frozen.js` test name (if applicable)
4. If fix requires code: output ONLY the corrected block (not full files)
5. Final: deploy checklist (5 items remaining to verify manually)

---

*Version: 2.0 · May 2026 · Codex Studio v0.8 GOLDEN*
