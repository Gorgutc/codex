---
name: codex-studio-a11y-seo-deploy
description: Use for Codex Studio accessibility, axe, keyboard navigation, semantic HTML, SEO, meta tags, JSON-LD, Open Graph, sitemap, robots, llms.txt, deploy readiness, and final release checks.
---

# Codex Studio A11y, SEO, Deploy

## Current Contract

- Verification success means `npm run verify` exits cleanly with `0 FAIL`.
- The suite currently covers SEO/meta, image attributes, font display, zero axe budgets, skip links, i18n, script order, and mobile language controls.
- Index and free-assets should both stay clean in axe and Pa11y checks.

## Check Before Shipping

- Canonical, robots, OG, Twitter, JSON-LD, manifest, favicon set.
- Single `theme-color`.
- Image `alt`, `width`, `height`, `loading`, and `decoding`.
- No new hard-coded colors or low-contrast functional text.
- No new runtime dependency or build step.

Deploy targets are static hosts such as Netlify, GitHub Pages, or Beget-compatible static hosting.
