# Codex Studio — Claude Code session bootstrap

This file is read automatically at every session start. The full briefs and skill files live in `.claude/`.

> **For the human operator launching this session:** see `RUN_INSTRUCTIONS.md` in the repo root — it has the copy-paste blocks for smoke-testing the infrastructure (block **[A]**) and for pre-task headers that enforce the workflow (block **[B]**). The pre-task header tells Claude to spawn `codex-spec-guardian` + `codex-quality-gate` + `codex-context-keeper` in parallel before any code write. **Always paste block [B] before a real task** — without it, the gate-agent workflow becomes Claude-best-effort instead of guaranteed.

## Project in one paragraph

Codex Studio is a Senior-level 3D-designer portfolio (Hard Surface, Product Viz, Game Assets). Two pages: `index.html` (portfolio) + `free-assets.html` (CC0 catalog). Vanilla HTML/CSS/JS, GSAP 3.13.0 from CDN, `<model-viewer>` lazy-loaded on the 3D tab. Domain `codex.promo`. Currently **v0.8 GOLDEN** — architecture is locked; only content and incremental quality updates are allowed without an explicit refactor request.

## Source of truth

`verify-frozen.js` in the repo root is a Playwright regression with **56 tests** across both pages. **It is authoritative.** A skill file that contradicts this test is stale, not correct.

```bash
node verify-frozen.js
```

Expected: `SUMMARY: 56/56 PASS, 0 FAIL`.

Cloud-environment note: in sandboxed environments where outbound CDN access is restricted (e.g. `jsdelivr`, `unpkg`, `modelviewer.dev`), the suite caps at 48/56 with the missing 8 always being the GSAP / cursor / console-noise tests. The 48 architectural tests still validate.

## Authority order on conflicts

```
verify-frozen.js  >  user message in chat  >
.claude/project_brief.md  >  .claude/build_rules.md  >  .claude/structure.md  >
.claude/prompt_instructions.md  >  any .claude/skill-*.md
```

## Frozen rules (top 12)

The full set is in `.claude/prompt_instructions.md` and is cross-tested by `verify-frozen.js`. The 12 you must keep top-of-mind:

1. Stack is vanilla HTML/CSS/JS. No React, Vue, Tailwind, npm-runtime, build tools. (`playwright` is dev-only and allowed.)
2. All scripts before `</body>`. No `defer`. No `type="module"`.
3. Script order: gsap → ScrollTrigger → SplitText → main.js → animations.js.
4. Exactly one `<meta name="theme-color">` tag, without `media=""`.
5. 18 work-cards with fixed `data-id` values. See `EXPECTED_IDS` in `verify-frozen.js`.
6. Tag filters frozen: index `all / hard-surface / product / organic / prototyping / animations / cad`; FA `hard-surface / product / game / organic / animation / cad`.
7. Colors only via CSS variables from `css/tokens.css`. Exception: `#fff` on `--color-primary`.
8. Fonts: Clash Display + General Sans via Fontshare CDN only.
9. Dark mode via `<body data-theme="dark">` hardcoded. Light via JS toggle. Never via `prefers-color-scheme`.
10. No `localStorage` / `sessionStorage`.
11. `:not(.tag-card)` filter on every `.work-card` selector that sets opacity / transform / hover.
12. `gsap.registerPlugin(ScrollTrigger)` is the first executable line of `animations.js`.

## Workflow

For any change to `index.html`, `free-assets.html`, `css/*.css`, `js/*.js`, or `verify-frozen.js`:

1. Generate the change.
2. **Spawn three subagents in parallel via the Agent tool in a single tool-turn**: `codex-context-keeper`, `codex-spec-guardian`, `codex-quality-gate`. Wait for all three.
   - Equivalent slash command (user-typed only): `/ship`.
3. If all gates PASS, write the file. The PostToolUse hook auto-runs `verify-frozen.js`.
4. If the hook reports FAIL, revert and iterate.

For visual-feel checks (hero, cards, typography), the user invokes `/run-5sec` after starting a local server. Claude on its own can spawn `codex-5sec-test` directly with a screenshot path.

For skill-drift suspicion, the user invokes `/audit-skills`. Never auto-rewrite skill files — produce a report and let the user decide.

**Important — slash commands** (`/ship`, `/run-5sec`, `/audit-skills`) can only be typed by the user. Claude cannot trigger them. The workflow above achieves the same effect by spawning the agents directly. Operator pre-task header in `RUN_INSTRUCTIONS.md` (block **[B]**) makes this explicit per session.

## File map

```
codex/
├── index.html                     ← entry page, portfolio
├── free-assets.html               ← entry page, CC0 catalog
├── verify-frozen.js               ← Playwright regression, source of truth
├── package.json                   ← dev dep: playwright (test runner only)
├── css/
│   ├── tokens.css                 ← design tokens (only place for color/font/spacing values)
│   ├── reset.css                  ← Andy-Bell-style modern reset
│   ├── shared.css                 ← shared components (sidebar, cursor, theme, work-card base)
│   ├── portfolio-core.css         ← index only, initial paint (work-card thumb backgrounds, ~1.5 KB)
│   ├── portfolio-case.css         ← index only, lazy/preloaded (case-view, 3D, gallery, ~16 KB)
│   └── free-assets.css            ← free-assets.html only (fa-grid, fa-card, tag-cards)
├── js/
│   ├── main.js                    ← CARDS_DATA + UI logic + 3D + theme + filters
│   ├── animations.js              ← all GSAP animations
│   ├── free-assets.js             ← FA page logic
│   ├── fa-data.js                 ← FA catalog data
│   └── model-data.js              ← inline GLB base64 (1.1 MB), LAZY-LOADED only
└── .claude/
    ├── agents/                    ← subagent definitions
    ├── commands/                  ← slash commands
    ├── hooks/                     ← lifecycle scripts
    └── skill-*.md                 ← methodology guides
```

CSS-link order in `<head>` (strict):
1. `tokens.css` → `reset.css` → `shared.css`
2. Per-page: index → `portfolio-core.css` + `<link rel="preload" as="style" href="portfolio-case.css">`; FA → `free-assets.css`

## What this repo does NOT use

- `npm install` for runtime (only for dev: `playwright`)
- Build tools, bundlers, transpilers
- Server-side code
- Tailwind, Bootstrap, any CSS framework
- React, Vue, Svelte, Alpine, any JS framework
- Cookies, localStorage, sessionStorage
- Tracking pixels (analytics intentionally out of scope for v0.8.x)

## Reminders

- English content only. No Cyrillic in UI text.
- `px` for font-size is forbidden — `rem` and `clamp()` only.
- Mobile-first media queries: 375 → 768 → 1024 → 1280.
- Every `<img>` needs `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`.

If you are uncertain about a rule, grep `verify-frozen.js` for the keyword. The test is the truth.
