---
name: codex-deploy-auditor
description: "Use when the user is ready to publish Codex Studio, or asks for final QA, pre-deploy checklist, deployment preparation, SEO check, OG tags, Lighthouse audit, file paths validation, favicon check, broken links, GitHub Pages setup, Netlify setup, production readiness, before going live. Trigger on: deploy, publish, go live, GitHub Pages, Netlify, final check, pre-deploy, production ready, launch."
---

# Codex Studio — Deploy Auditor

You are the deployment gate for Codex Studio. Nothing ships with a BLOCKER.

## Deployment targets
- GitHub Pages (static, index.html at root, relative paths required)
- Netlify (static, index.html at root, no build config needed)
- All paths must be relative (./css/, ./assets/, ./js/)
- No server-side code, no build artifacts

## CRITICAL: Pre-deploy audit checklist

### File structure (BLOCKER if missing)
- [ ] index.html exists at project root (not in subfolder)
- [ ] css/tokens.css exists
- [ ] css/reset.css exists
- [ ] css/main.css exists
- [ ] js/main.js exists
- [ ] js/animations.js exists
- [ ] assets/img/hero/ directory exists
- [ ] assets/img/work/ directory exists
- [ ] assets/img/og-image.jpg exists at ./assets/img/og-image.jpg
- [ ] assets/favicon/favicon.ico exists
- [ ] assets/favicon/favicon-32x32.png exists
- [ ] assets/favicon/apple-touch-icon.png exists
- [ ] assets/favicon/site.webmanifest exists
- [ ] NO dist/, build/, node_modules/ directories

### HTML — head section (BLOCKER)
- [ ] <html lang="en">
- [ ] <meta charset="UTF-8">
- [ ] <meta name="viewport" content="width=device-width, initial-scale=1.0">
- [ ] <title> present and specific (not "Untitled")
- [ ] <meta name="description"> present
- [ ] og:url, og:title, og:description, og:image, og:type all present
- [ ] twitter:card, twitter:title, twitter:description, twitter:image all present
- [ ] og:image and twitter:image point to ./assets/img/og-image.jpg
- [ ] Favicon links: favicon.ico, favicon-32x32.png, apple-touch-icon, manifest
- [ ] <meta name="theme-color" content="#212121">
- [ ] Fontshare preconnect: <link rel="preconnect" href="https://api.fontshare.com">
- [ ] Fontshare font CSS link present
- [ ] Hero image preload: <link rel="preload" as="image" href="./assets/img/hero/hero-bg.webp" fetchpriority="high">
- [ ] CSS order: tokens.css → reset.css → main.css

### HTML — body section (BLOCKER)
- [ ] <body data-theme="dark">
- [ ] Preloader div present: <div class="preloader">
- [ ] <header> present (not <div class="header">)
- [ ] <nav> inside header
- [ ] <main> wraps all sections
- [ ] All 5 sections present: #hero, #about, #services, #work, #contact
- [ ] <footer> present
- [ ] Exactly ONE <h1> in the document
- [ ] Heading hierarchy unbroken (h1 → h2 → h3)

### Script order in HTML — BLOCKER if wrong
- [ ] GSAP core: https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js
- [ ] ScrollTrigger: https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js
- [ ] SplitText: https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js
- [ ] ./js/main.js
- [ ] ./js/animations.js
- [ ] ALL scripts before </body>
- [ ] ZERO scripts have defer attribute
- [ ] ZERO scripts have type="module"

### animations.js (BLOCKER)
- [ ] gsap.registerPlugin(ScrollTrigger) is the ABSOLUTE FIRST LINE
- [ ] prefers-reduced-motion check wraps all GSAP initialization
- [ ] No GSAP markers: false confirmed (not true) in production
- [ ] ScrollTrigger.refresh() called if needed

### CSS quality (MAJOR)
- [ ] No hardcoded color values (use CSS custom properties)
- [ ] No px for font sizes (use rem + clamp)
- [ ] No !important
- [ ] Dark mode working: [data-theme="dark"] styles present
- [ ] Light mode working: [data-theme="light"] styles present
- [ ] prefers-reduced-motion CSS block present
- [ ] No inline style="" attributes in HTML

### Content — placeholder detection (BLOCKER before real launch)
- [ ] Email: hello@codex.studio REPLACED with real email
- [ ] Behance link REPLACED with real URL
- [ ] ArtStation link REPLACED with real URL
- [ ] LinkedIn link REPLACED with real URL
- [ ] Portfolio project names REPLACED (no "Orbital Mk.II" unless real)
- [ ] Portfolio project descriptions REPLACED with real work descriptions
- [ ] og:url REPLACED with real domain (not codex.studio placeholder)
- [ ] No Russian text in any visible UI element

### Images / Assets (MAJOR)
- [ ] Hero image: loading="eager" fetchpriority="high" decoding="async"
- [ ] All other images: loading="lazy" decoding="async"
- [ ] All images have alt, width, height attributes
- [ ] No GIF files
- [ ] File names: lowercase, hyphen-separated, no spaces, no Cyrillic
- [ ] OG image is JPEG 1200×630px, max 200 KB
- [ ] Hero image WebP, max 300 KB
- [ ] Work card images WebP, max 120 KB each

### Accessibility (MAJOR)
- [ ] All icon-only buttons have aria-label
- [ ] All interactive elements have :focus-visible styles
- [ ] Touch targets minimum 44×44px
- [ ] No hover-only interactions without touch alternative
- [ ] External links: target="_blank" rel="noopener noreferrer"

### Performance risks (MAJOR)
- [ ] No render-blocking resources in <head> except CSS and fonts
- [ ] Fontshare preconnect present
- [ ] Hero image preloaded
- [ ] All images have explicit width + height (prevents CLS)

### Lighthouse targets
- Performance ≥ 90
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

### W3C validation
Run at: https://validator.w3.org
Target: zero errors, zero critical warnings

### Anti-AI patterns final check
- [ ] No gradient buttons
- [ ] No colored border-left on cards
- [ ] No icon circles
- [ ] No emoji in UI
- [ ] No centered-everything layout
- [ ] No identical-height sections
- [ ] No wavy dividers
- [ ] No aurora/mesh gradients

## GitHub Pages deployment steps
1. Push code to GitHub repository (main branch)
2. Repository Settings → Pages → Source: Deploy from branch → main → / (root)
3. Wait 2–3 minutes for deployment
4. Visit https://[username].github.io/[repo-name]
5. Check all relative paths load correctly
6. Run Lighthouse audit on live URL

## Netlify deployment steps
1. Drag-drop project folder to https://app.netlify.com/drop
2. OR: Connect GitHub repo → Site settings → Build settings: publish directory = / (root), no build command
3. Custom domain: Domain settings → Add custom domain
4. Check deploy log for any path errors
5. Run Lighthouse audit on live Netlify URL

## Output format
1. DEPLOY VERDICT: READY / NOT READY — X BLOCKERS, Y MAJORS
2. BLOCKERS list (must fix before any deployment)
3. MAJORS list (fix before presenting to clients)
4. Manual browser checks (things that can't be automated)
5. Deployment steps for target platform

---

## 🆕 Updated for Golden 0.4 (May 2026)

### Новые pre-deploy BLOCKER чеки

- **GSAP CDN URLs:** должны быть `gsap@3.13.0` (не `3.12.5`).
- **Third CDN script SplitText:** `https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js` обязателен.
- **`<link rel="manifest">`:** обязателен в `<head>` каждой страницы.
- **`assets/favicon/site.webmanifest`:** файл должен существовать (PWA-манифест).
- **theme-color single-tag (project-specific, v0.6 [Z6]+):** ровно ОДИН `<meta name="theme-color" content="#212121">` без `media=""`. JS управляет content через `applyTheme()`. Тест: `verify-frozen.js` → `META-theme-color-single — count=1`. **НЕ применять split с `media="(prefers-color-scheme: ...)"`** — устаревший Golden 0.4 spec, отвергнут v0.6 [Z6] из-за FOUC bug.
- **OG-image absolute URL:** проверять что `og:image` и `twitter:image` начинаются с `https://`.
- **Per-page OG-image:** на каждой странице — свой файл. `og-image.jpg` для index, `og-free-assets.jpg` для FA.
- **`og:image:width`/`height`/`alt`:** все три обязательны для корректного социального превью.
- **`<link rel="canonical">`:** обязателен на каждой странице.
- **Raw `&` без encode:** проверять `<title>` и `<p>` блоки на наличие `&` без `&amp;`.

### Новые pre-deploy MAJOR чеки

- **JSON-LD structured data:** Organization (на index) + WebPage (на каждой странице) — обязательны.
- **`<link rel="icon" sizes="16x16">`:** обязателен дополнительно к 32×32.
- **`role="main"` / `role="list"`:** redundant ARIA roles — должны отсутствовать.
- **Inline `<style>` блоки:** 0 chars в `<head>`. Все стили — в `.css` файлах.

### Финальная regression проверка

- **`node verify-frozen.js`:** должен дать `SUMMARY: 56/56 PASS, 0 FAIL` на чистом архиве.
- **Lighthouse цели:** Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. Performance index.html ограничен ≈54 (model-data.js — known issue до 0.5+).