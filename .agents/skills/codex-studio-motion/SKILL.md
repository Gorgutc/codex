---
name: codex-studio-motion
description: Use for Codex Studio GSAP, ScrollTrigger, SplitText, Lenis, animation, preloader, custom cursor, hover, reduced-motion, case-view reveal, and motion bug work.
---

# Codex Studio Motion

Read `AGENTS.md`, `docs/agent/architecture.md`, and the current motion owners before changing motion:
`js/animations.js` for GSAP page animation, `js/main.js` for Lenis/preloader/custom cursor/case motion, and `js/free-assets.js` for free-assets grid and 3D preview motion.

## Rules

- `gsap.registerPlugin(ScrollTrigger)` must remain the first executable line of `animations.js`.
- Respect both motion layers: JS early-return and CSS `prefers-reduced-motion`.
- Preserve `.work-card:not(.tag-card)` filtering where animation touches cards.
- The preloader and anti-flicker behavior are real current runtime features; do not remove or document them as absent.
- Lenis is self-hosted and used only where the page loads it.

## Verification

Run `npm run verify` after shipped-code edits. Use visual review only after rendering a screenshot or local page; do not judge visual quality from source alone.
