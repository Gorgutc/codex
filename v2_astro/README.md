# Codex Studio — v2 (Astro 5)

Migration of the vanilla portfolio at `codex.promo` to Astro 5. The legacy site
at the repo root continues to ship from `Phase_2` branch; this folder is the
new pipeline, deployed as a separate Netlify site (e.g. `preview.codex.promo`)
until a final domain swap.

See `../README.md` for the legacy stack and `../16_HANDOFF_v0_8.md` for the
v0.8 GOLDEN handoff that this migration is based on.

## Scripts

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # → dist/
npm run preview   # serve dist/
npm run check     # astro check (TypeScript)
npm test          # node tests/verify-v2.mjs (added in Stage 11)
```

## Stack

- Astro 5 (static output, TypeScript strict)
- GSAP 3.13 + ScrollTrigger + SplitText (free since 3.13)
- Lenis 1.1 (smooth scroll)
- `<model-viewer>` 4.0 (lazy-loaded on first 3D-tab click)
- Self-hosted Clash Display + General Sans + JetBrains Mono (woff2)

## Stage status

| Stage | Scope | Status |
|---|---|---|
| 0 | Setup (configs, scaffolding) | ✅ in progress |
| 1 | Fonts + tokens.css + reset.css | — |
| 2 | BaseLayout + global overlays | — |
| 3 | Content Collection + works migration | — |
| 4 | Sidebar + Header + WorkCard | — |
| 5 | CaseView 2D | — |
| 6 | CaseView 3D-tab | — |
| 7 | CaseView Blueprints-tab | — |
| 8 | Animations (GSAP + Lenis) | — |
| 9 | Free-assets page | — |
| 10 | 404 + sitemap + JSON-LD | — |
| 11 | Tests + Lighthouse audit | — |
| 12 | Deploy preview | — |

See `../.claude/` for the frozen project briefs (project_brief, build_rules,
structure, motion_brief, texts, etc.). These remain canonical for the visual
system; only the implementation stack changes.
