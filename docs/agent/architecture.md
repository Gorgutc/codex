# Codex Studio Architecture

Codex Studio is a static site with two pages: `index.html` for the portfolio and `free-assets.html` for the asset catalog.

## Stack

- Vanilla HTML, CSS, and classic JavaScript.
- No public runtime framework, bundler, build step, Tailwind, cookies, `localStorage`, or `sessionStorage`.
- Admin panel exception: `admin/` may use tab-scoped `sessionStorage` for PAT/session and draft autosave only.
- Dev-only npm dependencies: Playwright and axe for verification.
- Runtime vendor libraries are self-hosted in `js/vendor/`: GSAP, ScrollTrigger, SplitText, Lenis.
- Fontshare remains external. Portfolio 3D mounts through the self-hosted Three viewer first and falls back to lazy `<model-viewer>` only when needed; free-assets mini previews lazy-load through `free-assets.js` near the preview grid.

## CSS

Shared order is `tokens.css`, `reset.css`, `shared.css`.

`index.html` then loads `portfolio-core.css` and preloads `portfolio-case.css` with a noscript fallback.

`free-assets.html` loads `free-assets.css`.

## JavaScript

Scripts are classic and ordered. Do not add `defer` or `type="module"` to shipped page scripts.

Index order: Lenis, GSAP, ScrollTrigger, SplitText, i18n data, i18n runtime, shared runtime, main app, animations.

Free assets order: FA data, vendor libraries, i18n data, i18n runtime, shared runtime, main app, animations, FA app.

## Runtime Coupling

Important globals and events include `window.CARDS_DATA`, `window.FA_DATA`, `window.I18N_DATA`, `window.CodexShared`, `window.CodexCase`, `codex:filter`, `codex:toggle`, `codex:case-open`, `codex:viz-change`, `codex:preloader-done`, and `i18n:changed`.

The app uses DOM state and URL state: `body[data-theme]`, `body.cards-collapsed`, hash-based case selection, and `?lang=` for language.

## Protected Decisions

The test suite protects card IDs, tag sets, script order, meta/SEO, i18n, mobile language controls, image attributes, axe budgets, and more. Treat `verify-frozen.js` as the architecture contract.
