---
name: codex-studio-quality-gate
description: Use to review Codex Studio frontend changes for bugs, accessibility, performance, motion quality, SEO metadata, token discipline, and visual craft before publishing. Migrates the former codex-quality-gate Claude subagent.
---

# Codex Studio Quality Gate

Review craftsmanship after the spec is satisfied.

## Always check

- Broken UI behavior or console errors.
- A11y regressions, missing image attributes, broken heading order, or keyboard traps.
- Hardcoded colors, font sizes in `px`, token drift, or new visual systems outside `css/tokens.css`.
- Motion regressions and missing reduced-motion handling.
- SEO, JSON-LD, canonical, OG, Twitter, robots, sitemap, and manifest changes.
- Mobile layout, language toggle, card filters, case view, and free-assets catalog behavior.

## Output

```text
QUALITY GATE: PASS | FIX REQUIRED

BLOCKER (N):
MAJOR (N):
MINOR (N):
SKILLS APPLIED:
SKIPPED CHECKS:
```

PASS means zero BLOCKER and zero MAJOR.

For the original Claude agent text, see `../codex-studio-rules/references/claude-original/agents/codex-quality-gate.md`.
