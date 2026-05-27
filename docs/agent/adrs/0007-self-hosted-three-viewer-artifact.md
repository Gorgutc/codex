# ADR 0007: Self-Hosted Three.js Viewer Artifact

## Decision

Three.js may replace the case-view renderer only as a self-hosted viewer
artifact loaded behind the existing `window.CodexViewer` adapter.

The artifact must be pinned, repo-local, lazy-loaded, and owned by the adapter.
Page HTML stays classic and unchanged: no static Three.js scripts, no import
maps, no first-party page `type="module"` scripts, and no runtime bundler.

## Constraints

- Keep the site vanilla HTML, CSS, and classic JavaScript.
- Do not add React, Vue, Svelte, Next, Tailwind, cookies, `localStorage`, or
  `sessionStorage`.
- Do not expose Three.js scene, camera, renderer, loaders, controls, or material
  internals as globals.
- Preserve the public `window.CodexViewer` API:
  `mount3D`, `destroy3D`, `resetCamera`, and `openFullscreen`.
- Keep `js/model-data.js` lazy and untouched unless the user explicitly asks for
  a data migration.
- Load the Three viewer only after an explicit 3D/fullscreen action. Initial
  page load must not fetch Three.js, GLB, HDR, or `js/model-data.js`.
- Preserve current DOM IDs/classes, tab behavior, `codex:case-open`,
  `codex:viz-change`, `i18n:changed`, theme state, language state, and the
  shared `.media-fs` overlay.
- Use WebGL2 as the default renderer path. WebGPU, TSL/Node Materials,
  post-processing, annotations, and material inspectors are later enhancement
  decisions, not part of the MVP swap.
- On `file://`, keep the current degraded behavior: GLB may use the existing
  `CODEX_LOCAL_GLB` data-URI path, and HDR must fall back to neutral/local
  lighting without console errors.
- Respect `prefers-reduced-motion`: no auto-rotation and no nonessential render
  loop work.
- Dispose renderers, animation loops, controls, geometries, materials, textures,
  loaders, listeners, and WebGL contexts during `destroy3D`.

## Artifact Shape

The implementation slice should produce a single internal viewer entrypoint
rather than letting page scripts import Three.js directly. The entrypoint may be
a local prebuilt module or classic-loadable artifact, but it must not require a
runtime build step in the deployed site.

The first implementation should keep `<model-viewer>` fallback available until
Three.js reaches screenshot and interaction parity.

## Acceptance

- `npm run verify` passes with `0 FAIL`.
- Static verification rejects static Three.js scripts, import maps, and
  first-party page module scripts.
- Initial page load proves no Three artifact, GLB, HDR, or `js/model-data.js`
  has loaded before the first 3D action.
- 3D tab mounts a canvas that is not blank or falls back to the existing model
  fallback.
- Reset camera, auto-rotation, lighting controls, info panel, i18n, theme toggle,
  case switching, and `.media-fs` fullscreen still work.
- No new storage, cookies, framework, Tailwind, import-map architecture, engine
  registry, or global Three scene API is introduced.
