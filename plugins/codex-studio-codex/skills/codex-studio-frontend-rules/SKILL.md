---
name: codex-studio-frontend-rules
description: Use when implementing or reviewing Codex Studio frontend changes in vanilla HTML, CSS, and JavaScript. Migrates the former Claude skill-a11y-performance, asset-optimizer, code-generator, code-reviewer, copy-polisher, deploy-auditor, dialog-memory-auditor, motion-director, reference-analyzer, and seo-structured-data guides.
---

# Codex Studio Frontend Rules

Use this skill for user-facing site work. Keep `SKILL.md` light and load migrated Claude references only when the change needs them.

## Reference map

- Code generation: `../codex-studio-rules/references/claude-original/skill-code-generator.md`
- Code review: `../codex-studio-rules/references/claude-original/skill-code-reviewer.md`
- Accessibility and performance: `../codex-studio-rules/references/claude-original/skill-a11y-performance.md`
- Assets: `../codex-studio-rules/references/claude-original/skill-asset-optimizer.md`
- Motion: `../codex-studio-rules/references/claude-original/skill-motion-director.md`
- SEO and structured data: `../codex-studio-rules/references/claude-original/skill-seo-structured-data.md`
- Copy: `../codex-studio-rules/references/claude-original/skill-copy-polisher.md`
- Reference analysis: `../codex-studio-rules/references/claude-original/skill-reference-analyzer.md`
- Deploy: `../codex-studio-rules/references/claude-original/skill-deploy-auditor.md`
- Dialog memory: `../codex-studio-rules/references/claude-original/skill-dialog-memory-auditor.md`

## Non-negotiables

- Vanilla HTML, CSS, and JS only.
- Keep all runtime dependencies self-hosted or already approved by the existing site.
- Preserve script order, theme handling, i18n behavior, cards, filters, metadata, and accessibility budgets enforced by `verify-frozen.js`.
- Use CSS variables from `css/tokens.css`; do not introduce loose colors, fonts, or spacing systems.
- Do not edit `js/model-data.js` unless the user explicitly requests it.
- Run `npm run codex:ship` before publishing.
