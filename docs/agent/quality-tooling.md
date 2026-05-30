# Quality Tooling

This repository uses free, local-first quality tools. The frozen verifier remains the source of truth for shipped behavior; the extra tools catch syntax, lint, dependency, accessibility, duplication, and audit regressions earlier.

## Daily Checks

```bash
npm run quality:fast
```

Runs the plugin verifier, ESLint, Stylelint, HTMLHint, Markdownlint, CSpell, dependency-cruiser, and a production dependency audit.

The production audit is intentional: the site ships no npm runtime bundle, while some dev-only audit tools can carry transitive advisories. Run full `npm audit` during dependency maintenance.

## Deeper Audit

```bash
npm run quality:deep
```

Adds Knip, JSCPD, Playwright smoke tests, and Pa11y accessibility checks. Playwright axe owns the color-contrast gate; Pa11y ignores `color-contrast` because Puppeteer reports false positives on the animated transparent surfaces, and stays strict (`0` budget) for the remaining axe errors.

`test:browser` is intentionally smoke-only and runs `tests/quality/site-smoke.spec.mjs`, including the free-assets preloader smoke that protects lazy tag previews from blocking page readiness. Visual baselines are a separate gate.

## Governance And Visual Gates

```bash
npm run quality:governance
npm run test:visual
npm run test:visual:update
```

`quality:governance` runs the Codex Studio governance checker for stale pass totals, protected script order, shared-runtime drift, storage/import-map/module regressions, and required Sprint D package scripts.

`test:visual` runs reviewed Playwright snapshot baselines for stable desktop/mobile index and free-assets surfaces. Use `test:visual:update` only when intentionally approving a visual baseline change after screenshot review.

## Optional Heavy Checks

```bash
npm run check:format
npm run check:lighthouse
npm run quality:all
```

Use these before major cleanup or release work. `quality:all` includes the deep audit, governance, visual snapshots, Lighthouse, and the Codex ship gate. Formatting is separate to avoid huge mechanical diffs during focused feature fixes. Lighthouse is separate because local Chrome and network conditions can add noise.

## Hooks

```bash
npm run hooks:install
```

Installs Lefthook so `quality:fast` runs before commits and `codex:ship` runs before pushes.

## Notes For Codex

- Prefer `quality:fast` during implementation loops.
- Use `quality:deep` for audit, cleanup, refactor, dead-code, a11y, or PR-readiness work.
- Use `quality:governance` after instruction, script-order, or quality-tooling edits.
- Use `test:visual` after visual, layout, motion, screenshot, or stable-surface changes.
- Keep `npm run codex:ship` mandatory before commit or push.
- Do not auto-format shipped files unless the task is explicitly a formatting cleanup.
