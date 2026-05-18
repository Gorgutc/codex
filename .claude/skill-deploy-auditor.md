---
name: codex-deploy-auditor
description: "Use when the user is ready to publish Codex Studio (codex.promo), or asks for final QA, pre-deploy checklist, deployment preparation, SEO check, OG tags, Lighthouse audit, file paths validation, favicon check, broken links, GitHub Pages setup, Netlify setup, production readiness, before going live. Trigger on: deploy, publish, go live, GitHub Pages, Netlify, final check, pre-deploy, production ready, launch."
---

# Codex Studio — Deploy Auditor

Deployment gate. Nothing ships with a BLOCKER. Final check is `node verify-frozen.js` → 56/56 PASS.

## Deployment targets

- GitHub Pages (static, index.html at root, relative paths)
- Netlify (static, no build config)
- Any static host (Vercel, Cloudflare Pages, S3+CloudFront)
- Domain: `codex.promo`
- All paths in HTML must be relative (`./css/`, `./assets/`, `./js/`)
- All meta URLs (canonical, OG, JSON-LD) must be ABSOLUTE `https://codex.promo/...`

## Final regression gate

```bash
node verify-frozen.js
# Expected: SUMMARY: 56/56 PASS, 0 FAIL
```

Requires `playwright` installed (`npm i playwright`). Self-contained — starts internal http-server. Or `BASE=http://...` env var to use external server (CI).

If ANY test FAIL → not shippable.

## Pre-deploy audit checklist

### File structure (BLOCKER if missing)
- [ ] `index.html` at project root
- [ ] `free-assets.html` at project root
- [ ] `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/portfolio.css`, `css/free-assets.css`
- [ ] `js/main.js`, `js/animations.js`, `js/model-data.js`
- [ ] `verify-frozen.js`
- [ ] `assets/cards/<id>.svg` (18 files matching `EXPECTED_IDS`)
- [ ] `assets/cases/<id>/01..05.svg` (18 × 5 = 90 files)
- [ ] `assets/models/<id>.glb` (18 files)
- [ ] `assets/models/free/<id>.glb` (18 files)
- [ ] `assets/hdr/studio.hdr`, `outdoor.hdr`, `dark.hdr`
- [ ] `assets/img/og-image.jpg` AND `assets/img/og-free-assets.jpg`
- [ ] `assets/favicon/favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `site.webmanifest`
- [ ] `sitemap.xml`, `robots.txt`, `llms.txt`
- [ ] NO `dist/`, `build/`, `node_modules/` directories
- [ ] NO `index.php` (Beget placeholder renamed to `_beget-placeholder.php`)

### HTML — `<head>` (BLOCKER)
- [ ] `<html lang="en">`
- [ ] `<meta charset="UTF-8">`, viewport
- [ ] `<title>` specific (not "Untitled")
- [ ] `<meta name="description">`
- [ ] `<link rel="canonical" href="https://codex.promo/...">` per page
- [ ] `og:url`, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:image:alt`, `og:locale`
- [ ] `og:image` ABSOLUTE URL `https://codex.promo/...`
- [ ] Per-page OG-image: `og-image.jpg` for index, `og-free-assets.jpg` for FA
- [ ] `twitter:card="summary_large_image"`, title, description, image (absolute)
- [ ] `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`
- [ ] `<meta name="theme-color" content="#212121">` — single tag, NO `media=""` (test `META-theme-color-single`)
- [ ] Favicon: `.ico` + `favicon-16.png` + `favicon-32.png` + `apple-touch-icon` (180×180)
- [ ] `<link rel="manifest" href="./assets/favicon/site.webmanifest">`
- [ ] `<link rel="preconnect" href="https://api.fontshare.com" crossorigin>` + jsdelivr preconnect
- [ ] Fontshare CSS link
- [ ] CSS order: tokens → reset → shared → (portfolio | free-assets)
- [ ] JSON-LD: index → Organization + WebSite + ItemList; FA → Organization + WebPage
- [ ] HTML entities: `&` → `&amp;` (W3C valid)

### HTML — `<body>` (BLOCKER)
- [ ] `<body data-theme="dark">`
- [ ] `<aside class="sidebar">` with all required IDs/classes
- [ ] `<main class="main-area">` with `<section class="case-view">` (index) or fa-grid (FA)
- [ ] Exactly 18 `.work-card` on index with correct `data-id` (matches `EXPECTED_IDS`)
- [ ] All required tag-filters present (matches `EXPECTED_TAGS` / `EXPECTED_FA_TAGS`)
- [ ] 3 `.case-tab` (2D / 3D / Blueprints) on index
- [ ] Both `case-share-desktop` and `case-share-mobile` present
- [ ] Logo IDs: `logo-home` on index, `logo-back-portfolio` on FA — strict
- [ ] FA `cards-toggle` icons: `‹‹` / `››` (chevrons), NOT SVG eyes
- [ ] FA `<head>` has ZERO inline `<style>` blocks
- [ ] `<footer class="site-footer">` present
- [ ] Exactly ONE `<h1>` per page

### Script order (BLOCKER if wrong)
- [ ] gsap@3.13.0/dist/gsap.min.js
- [ ] gsap@3.13.0/dist/ScrollTrigger.min.js
- [ ] gsap@3.13.0/dist/SplitText.min.js
- [ ] ./js/main.js
- [ ] ./js/animations.js
- [ ] ALL before `</body>`
- [ ] ZERO scripts have `defer`
- [ ] ZERO scripts have `type="module"`
- [ ] `model-data.js` is NOT in HTML — lazy-loaded by `loadModelData()` in main.js
- [ ] `<model-viewer>` script is NOT in HTML — lazy-injected by `build3D()`

### animations.js (BLOCKER)
- [ ] `gsap.registerPlugin(ScrollTrigger)` is the FIRST executable line
- [ ] SplitText registered with `typeof SplitText !== 'undefined'` guard
- [ ] reduced-motion early-return present
- [ ] `:not(.tag-card)` filter on every `.work-card` selector
- [ ] `markers: false` (no debug markers in production)
- [ ] ScrollTrigger.batch uses `scroller: '#cards-scroll'`

### CSS quality (MAJOR)
- [ ] No hardcoded color values (exception: `#fff` on `--color-primary`)
- [ ] No `px` for font sizes (only `rem` + `clamp()`)
- [ ] No `!important` outside `@media (prefers-reduced-motion: reduce)`
- [ ] Dark + light themes both working
- [ ] `prefers-reduced-motion` CSS block present
- [ ] No inline `style=""` (exception: card-thumb gradient placeholders)

### Content / placeholder detection (BLOCKER if shipping to real domain)
- [ ] Telegram link `https://t.me/WhiteCatWeb` (real)
- [ ] ArtStation/Behance links REPLACED (currently `REPLACE_WITH_REAL`)
- [ ] `/downloads/*.zip` REPLACED with real archives (currently 412 B placeholders)
- [ ] No Cyrillic in any visible UI element
- [ ] Domain `codex.promo` everywhere (canonical, OG, JSON-LD, sitemap, llms.txt)
- [ ] No old `codex.studio` references
- [ ] `data-cad-placeholder="true"` only on intentionally-pending CAD cards
- [ ] `modelSrc` in CARDS_DATA — own GLB (not `modelviewer.dev/shared-assets/...`) for production launch

### Images / Assets (MAJOR)
- [ ] All `<img>`: `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`
- [ ] No GIF files
- [ ] File names: lowercase, hyphen-separated, no Cyrillic/spaces
- [ ] OG-image: JPEG 1200×630, ≤200 KB
- [ ] HDR files present (studio/outdoor/dark)
- [ ] Favicon files: `-16.png` / `-32.png` (NOT `-16x16.png` / `-32x32.png`)

### Accessibility (MAJOR)
- [ ] All icon-only buttons have `aria-label`
- [ ] All interactive elements have `:focus-visible` styles
- [ ] Touch targets ≥ 44×44px
- [ ] No `aria-label` duplicating visible text
- [ ] No redundant `role="main"` / `role="list"` / `role="navigation"`
- [ ] External links: `target="_blank" rel="noopener noreferrer"`

### Performance risks (MAJOR)
- [ ] No render-blocking scripts in `<head>`
- [ ] Fontshare + jsdelivr preconnect present
- [ ] All images have explicit `width` + `height` (CLS prevention)
- [ ] `model-data.js` lazy-loaded
- [ ] `<model-viewer>` script lazy-injected

### Lighthouse targets (v0.7.10 baseline)
- Performance ≥ 85 on FA, index ~54 (limited by `model-data.js` size; lazy-load already applied)
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

### W3C validation
Run at: https://validator.w3.org
Target: zero errors.

### Anti-AI patterns final check
- [ ] No gradient buttons
- [ ] No colored `border-left` on cards
- [ ] No icon circles
- [ ] No emoji in UI
- [ ] No centered-everything layout
- [ ] No identical-height sections
- [ ] No wavy dividers
- [ ] No aurora / mesh gradients

## Final gate command

```bash
node verify-frozen.js
# Required: SUMMARY: 56/56 PASS, 0 FAIL
```

## GitHub Pages deployment steps

1. Push code to GitHub repository (main branch)
2. Repository Settings → Pages → Source: Deploy from branch → main → / (root)
3. Custom domain: `codex.promo` (DNS A/AAAA + CNAME setup)
4. Wait 2–3 min for deployment
5. Run Lighthouse on live URL
6. Run `node verify-frozen.js BASE=https://codex.promo` from local

## Netlify deployment steps

1. Drag-drop project folder to https://app.netlify.com/drop OR connect GitHub repo
2. Build settings: publish directory = `/` (root), no build command
3. Custom domain: `codex.promo`
4. Verify all paths load correctly
5. Run Lighthouse + `verify-frozen.js`

## Output format

1. **DEPLOY VERDICT:** READY / NOT READY — X BLOCKERS, Y MAJORS
2. **BLOCKERS** list (must fix before any deploy)
3. **MAJORS** list (fix before client-facing launch)
4. **Manual browser checks** (things that can't be automated — `<model-viewer>` HDR loading, theme toggle visual sync, custom cursor on pointer:fine)
5. **Deployment steps** for target platform
6. **verify-frozen.js status:** if available, paste summary

---

*Version: 2.0 · May 2026 · Codex Studio v0.8 GOLDEN*
