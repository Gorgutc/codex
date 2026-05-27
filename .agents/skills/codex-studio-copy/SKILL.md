---
name: codex-studio-copy
description: Use for Codex Studio website copy, CTA text, project descriptions, metadata text, English/Russian i18n copy, tone of voice, and copy review.
---

# Codex Studio Copy

## Current Reality

The source HTML starts in English-oriented structure, but the site is bilingual through `i18n-data.js` and `i18n.js`. Do not enforce an old English-only rule.

## Workflow

- For visible UI copy, update the relevant i18n key rather than only the static DOM text.
- Preserve technical, direct, senior-portfolio tone.
- Mark unknown real links or assets as `REPLACE_WITH_REAL` only when the project already uses that placeholder pattern.
- Run verification after shipped-code copy edits because i18n and meta behavior are tested.
