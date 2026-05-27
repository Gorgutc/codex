# Technical Stack Inventory

## Runtime

- Static site: `index.html` and `free-assets.html`.
- Vanilla HTML, CSS, classic JavaScript.
- Self-hosted GSAP, ScrollTrigger, SplitText, Lenis.
- Lazy `<model-viewer>` and lazy `model-data.js`.
- Fontshare external font CSS.

## Dev Tooling

- `npm run verify`
- Playwright
- `@axe-core/playwright`

## Architecture

- CSS tokens first, page CSS split by responsibility.
- Global JS and custom events instead of module imports.
- DOM and URL state, no browser storage.
- Bilingual i18n through data files and runtime walker.
- Static-host deployment.

## Decisions To Preserve

- No runtime build pipeline.
- Verify by green test suite and `0 FAIL`.
- Keep 3D and large model data lazy.
- Keep SEO/a11y checks in the regression contract.
