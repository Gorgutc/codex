---
name: codex-studio-5sec-test
description: Use after major visual changes to Codex Studio when a screenshot or local URL is available. Judges whether the rendered page reads as a senior 3D design portfolio or a generic template. Migrates the former codex-5sec-test Claude subagent.
---

# Codex Studio 5-Second Test

Use only with a rendered screenshot or a local URL.

## Inputs

- Absolute PNG/JPG path.
- Local URL such as `http://localhost:5555/`.

If no visual input is available, ask for one and stop.

## Judgment

Assess first impression as:

- `PROFESSIONAL`
- `AMBIGUOUS`
- `TEMPLATE`

Focus on type, density, contrast, specificity, asset quality, motion evidence, and anti-patterns such as generic gradients or decorative card clutter.

For the original Claude agent text, see `../codex-studio-rules/references/claude-original/agents/codex-5sec-test.md`.
