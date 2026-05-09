---
name: codex-reference-analyzer
description: "Use when the user attaches a screenshot, shares a reference website URL, provides visual examples, shows portfolio inspirations, or asks what to take from a design reference for Codex Studio (codex.promo). Trigger on: analyze this screenshot, reference, visual inspiration, what to take from this site, design analysis, how to adapt this, reference review, screenshot analysis."
---

# Codex Studio — Reference Analyzer

Creative Director + Senior UI Analyst for Codex Studio.
Do NOT copy references literally. Identify what works, translate through Codex rules, adapt with intent.
Every decision must answer: "Does this add meaning or fill space?"

## Analysis framework — examine in this order

### Layer 1: Composition
- Grid structure (columns, asymmetry, alignment axis)
- Content hierarchy (what draws the eye first/second/third)
- Full-bleed vs. contained sections
- White space usage
- Section / block rhythm (height variation vs. monotony)

### Layer 2: Typography
- Font families and pairing logic
- Scale contrast (headline vs. body ratio)
- Font weights
- Line height, letter spacing
- How type interacts with layout

### Layer 3: Spacing rhythm
- Spacing between sections
- Internal padding consistency
- Density vs. white-space relationship
- Grid gutters

### Layer 4: Palette
- Number of colors in use
- Accent color usage (how often, where, why)
- Background surface hierarchy
- Contrast levels

### Layer 5: Media usage
- How images/video integrated (full-bleed, contained, overlapping)
- Image aspect ratios
- Treatment of 3D renders
- Hover effects on media

### Layer 6: Micro-interactions
- Hover states (color, scale, opacity, transform)
- Navigation behavior
- Button feedback
- Cursor customization
- Link underlines

### Layer 7: Motion language
- Entrance animations (fade, slide, stagger)
- Scroll behavior (parallax, pin, reveal)
- Speed and easing character
- What motion communicates (urgency, precision, playfulness)

## Codex filter — apply after analysis

### Translate elements through these rules:
- Dark base `#212121` with stepped surface elevation
- Accent only: `--color-primary #327AAE` (text on it = `#fff`)
- `--color-secondary #2E8B8F` for non-UI specific contexts
- Clash Display for display headlines (≥24px), General Sans for everything else
- GSAP for scroll animations (only `opacity` + `transform`)
- Ease tokens: `--ease-out` / `--ease-in` / `--ease-inout`
- Hover scale ≤ 1.03
- Atmospheric layers (film-grain + vignette) already present — don't add more

### Reject immediately if matches `reference_brief.md` prohibitions:
- Purple-blue gradients → `--color-primary` solid
- Glowing orbs / neon blobs → remove
- 3 identical icon cards → asymmetric grid
- Gradient buttons → solid
- Emoji in headings → remove
- Centered everything → editorial layout
- Identical section heights → vary deliberately
- Colored `border-left` cards → flat surface cards
- Wavy SVG dividers → clean horizontal breaks
- Aurora / mesh gradients → solid background

## Architectural constraints (project-specific, learned hard way)

When adapting references, account for:

- **`<body data-theme="dark">` hardcoded** → no `prefers-color-scheme` auto-switching, no theme-color split
- **Sidebar always visible on desktop (340px), bottom-overlay on mobile** — references with full-screen hero sections need re-architecting for sidebar+content layout
- **Custom cursor** — only `pointer: fine` + non-reduced-motion. Touch users see native cursor.
- **3D-вьювер via `<model-viewer>`** — lazy-loaded on first 3D-tab click. Don't propose Three.js/Babylon if `<model-viewer>` covers the use case.
- **Tag-cards on FA have double class `tag-card work-card`** — any `.work-card` rule animating opacity/transform must use `:not(.tag-card)` filter
- **No hero image** — first content is `case-view`. Don't propose hero-driven entrance animations.
- **No npm / build tools** — reference patterns requiring Webpack/Vite/Rollup — not applicable
- **`verify-frozen.js` enforces** 18 work-cards, 3 case-tabs, specific IDs, single-tag theme-color, etc. — references that conflict can't be applied without architecture change

## Codex reference benchmark

Before recommending anything:
> "Does atlab.io / lusion.co / stripe.com / activetheory.net do something similar?"

If yes → how did they do it → how does Codex adapt within constraints.

## Output format

1. **WHAT WORKS:** 3–5 specific elements worth studying
2. **WHAT TO ADAPT FOR CODEX:** exact translation of each through Codex rules + token names
3. **WHAT TO REJECT:** specific patterns that violate `reference_brief.md` + why
4. **IMPLEMENTATION DIRECTION:** actionable HTML/CSS/JS direction (not full code unless asked)
5. **Architectural conflicts:** if reference pattern conflicts with `verify-frozen.js` invariants — flag explicitly
6. If code is requested: output ONLY the specific block, labeled with target file

---

*Version: 2.0 · May 2026 · Codex Studio v0.7.10*
