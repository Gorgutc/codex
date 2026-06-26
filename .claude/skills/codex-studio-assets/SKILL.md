---
name: codex-studio-assets
description: Use for Codex Studio images, SVG cards and case slides, GLB models, HDR maps, favicons, OG images, downloads, asset naming, lazy loading, and media optimization.
---

# Codex Studio Assets

## Asset Rules

- Portfolio IDs couple cards, case slides, GLB models, i18n data, and tests.
- Do not edit `js/model-data.js` by hand unless the user explicitly asks; it is large inline GLB data and is lazy-loaded.
- Runtime GLB handling and `<model-viewer>` are lazy. Current app logic loads the self-hosted model-viewer bundle through `js/shared-runtime.js`, not Google APIs or legacy jsdelivr docs.
- Downloads may be placeholders until the user supplies real archives; do not treat placeholder archives as dead runtime code without user confirmation.
- OG images are page-specific: index uses `og-image.jpg`, free assets uses `og-free-assets.jpg`.

Run `npm run verify` after asset-reference changes in shipped HTML/CSS/JS.
