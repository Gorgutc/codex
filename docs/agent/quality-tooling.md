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

## Optional Heavy Checks

```bash
npm run check:format
npm run check:lighthouse
npm run quality:all
```

Use these before major cleanup or release work. Formatting is separate to avoid huge mechanical diffs during focused feature fixes. Lighthouse is separate because local Chrome and network conditions can add noise.

## Hooks

```bash
npm run hooks:install
```

Installs Lefthook so `quality:fast` runs before commits and `codex:ship` runs before pushes.

## Notes For Codex

- Prefer `quality:fast` during implementation loops.
- Use `quality:deep` for audit, cleanup, refactor, dead-code, a11y, or PR-readiness work.
- Keep `npm run codex:ship` mandatory before commit or push.
- Do not auto-format shipped files unless the task is explicitly a formatting cleanup.
