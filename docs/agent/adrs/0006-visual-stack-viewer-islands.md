# ADR 0006: Visual Stack Viewer Islands

## Decision

Modern visual work must enter Codex Studio as lazy viewer islands inside the
existing static site shell.

The approved first step is a narrow `<model-viewer>` wrapper around the current
3D and media viewer surfaces. Future Three.js or WebGPU work requires a separate
implementation decision after the current `<model-viewer>` behavior has
screenshot and verifier parity.

## Constraints

- Keep the site vanilla HTML, CSS, and classic JavaScript.
- Do not add a framework, Tailwind, a runtime bundler, cookies, `localStorage`,
  or `sessionStorage`.
- Do not convert first-party page scripts to `type="module"` or `defer`.
- Keep `js/model-data.js` and heavyweight viewer code lazy-loaded.
- Do not add an engine registry, import maps, direct Three.js scene access, or
  an effects pipeline as part of the wrapper step.
- Preserve the existing DOM, CSS, events, i18n, theme, filters, tabs,
  full-screen overlay, and visual layout unless the user approves a specific
  drift.
- Keep free-assets grid previews lightweight. Do not instantiate one active 3D
  viewer per catalog card; any catalog 3D preview must use a single lazy viewer
  created only on explicit fullscreen/open action.
- Treat `verify-frozen.js` and `0 FAIL` as the runtime contract.

## Consequences

The first implementation layer should be a thin `window.CodexViewer` adapter
that preserves the current `<model-viewer>` implementation. A future renderer
swap must not change the public viewer shell, eager-load 3D assets, or bypass the
existing `codex:case-open`, `codex:viz-change`, and `i18n:changed` behavior.
