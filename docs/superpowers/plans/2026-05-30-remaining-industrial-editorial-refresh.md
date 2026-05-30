# Remaining Industrial Editorial Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining original industrial editorial refresh scope after merged Sprints A-D by delivering the remaining Sprint E performance/accessibility/motion tightening and Sprint F free-assets SEO depth.

**Architecture:** Preserve the current static vanilla HTML/CSS/classic JavaScript runtime. Add quality gates and focused runtime/content improvements around existing files instead of introducing a framework, bundler, routing layer, storage, first-party modules, import maps, or static Three/model-viewer scripts. Treat `verify-frozen.js` and `AGENTS.md` as active contracts.

**Tech Stack:** Static HTML, CSS, classic JavaScript, self-hosted GSAP/ScrollTrigger/SplitText/Lenis, Playwright, axe, Pa11y, Lighthouse CI, ESLint, Stylelint, HTMLHint, Markdownlint, CSpell, Knip, JSCPD, dependency-cruiser.

---

## Current Baseline

- `main` is synced with `origin/main`.
- PR #27, PR #28, PR #29, and PR #30 are merged.
- Current `main` head when Sprint E/F work started: `a35cf4c Merge pull request #30 from Gorgutc/codex/industrial-editorial-refresh-sprint-d`.
- Current implementation branch: `codex/industrial-editorial-refresh-sprint-e-f`.
- Sprint A-D completed:
  - Sprint A: initial industrial/editorial foundation.
  - Sprint B: card redesign and free-assets visual parity.
  - Sprint C: shared runtime cleanup with `js/shared-runtime.js`.
  - Sprint D: local visual regression baselines and governance gates.

## Global Constraints For All Remaining Sprints

- Do not touch `js/model-data.js` unless the user explicitly requests model metadata work.
- Preserve classic script order:
  - `index.html`: Lenis, GSAP, ScrollTrigger, SplitText, i18n data, i18n runtime, shared runtime, `main.js`, `animations.js`.
  - `free-assets.html`: FA data, vendor stack, i18n data, i18n runtime, shared runtime, `main.js`, `animations.js`, `free-assets.js`.
- Do not add `defer`, first-party `type="module"`, import maps, Tailwind, a bundler, a framework, cookies, `localStorage`, or `sessionStorage`.
- Do not add new `font-size: Npx`.
- Preserve `.work-card:not(.tag-card)` semantics for portfolio motion/cursor/magnetic logic.
- Preserve i18n mirrors for all visible copy changes.
- Success for `npm.cmd run verify` is `0 FAIL`; do not document historical pass totals as a contract.
- Use `npm.cmd` on Windows PowerShell.
- If Chromium fails with `spawn EPERM` inside sandbox, rerun browser-based checks outside sandbox.
- Check `DO_NOT_PUSH.md` before every push.
- Every shipped-code sprint uses a `codex/*` branch, commit, push, and draft PR.

## Agent Setup Per Sprint

- Before implementation:
  - `instruction_drift_auditor`: reject scope creep and stale instruction drift.
  - `tech_stack_cartographer`: refresh current stack and tooling constraints.
  - `runtime_mapper`: required for changes touching runtime, script order, visual browser tests, or page behavior.
  - `codex_infra_architect`: required before adding governance scripts, CI hooks, or quality tooling.
- During/after implementation:
  - `code_deadwood_auditor`: after meaningful diff or new scripts/tests.
  - `verification_reviewer`: before commit/push.
  - Visual review skill/browser screenshots for visual or motion changes.

---

## Sprint D: Visual + Governance Quality Gates

Status: completed in PR #30 and merged into `main`. Keep this section as the implementation record and safety-rail reference for Sprint E/F.

**Branch:** `codex/industrial-editorial-refresh-sprint-d`

**Goal:** Automate stable visual decisions and governance drift detection now that visual card/runtime targets are stable.

**Primary Files**

- Create: `tests/quality/visual-regression.spec.mjs`
- Create: `tests/quality/visual-regression.spec.mjs-snapshots/` after first approved snapshot run
- Create: `scripts/check-governance.mjs`
- Modify: `package.json`
- Modify: `verify-frozen.js` only for runtime contracts that belong in the frozen verifier
- Modify: `docs/agent/quality-tooling.md`
- Modify: `docs/agent/verification.md`
- Conditional: `.github/workflows/quality.yml` if the repository has or approves CI workflow setup in this sprint

### Task D1: Bootstrap And Baseline

- [ ] Run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/industrial-editorial-refresh-sprint-d
git status --short --branch
npm.cmd run verify
npm.cmd run quality:deep
```

Expected:

- Branch is `codex/industrial-editorial-refresh-sprint-d`.
- `verify` reports `0 FAIL`.
- `quality:deep` passes; existing ESLint warnings are acceptable only if unchanged.

- [ ] Capture baseline screenshots before changes:

```powershell
New-Item -ItemType Directory -Force C:\tmp\codex-sprint-d\baseline
```

Use Playwright or Browser to capture:

- `index.html` desktop `1440x900`
- `index.html` mobile `375x667`
- `free-assets.html` desktop `1440x900`
- `free-assets.html` mobile `375x667`

### Task D2: Add Deterministic Visual Regression Tests

- [ ] Create `tests/quality/visual-regression.spec.mjs`.

Test behavior:

- Serve local static files through the existing Playwright test server pattern from `tests/quality/site-smoke.spec.mjs`.
- Use deterministic options:
  - viewport `1440x900` and `375x667`
  - `reducedMotion: "reduce"`
  - dark theme default
  - English default
  - wait for preloader to be gone on index
  - wait for `.work-card` and `.fa-card` surfaces before screenshots
- Screenshot targets:
  - `index-desktop-full`
  - `index-mobile-sidebar`
  - `free-assets-desktop-full`
  - `free-assets-mobile-sidebar`

Skeleton:

```js
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.glb')) return 'model/gltf-binary';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  return 'application/octet-stream';
}

async function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const route = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const full = path.normalize(path.join(ROOT, route));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    try {
      const body = await readFile(full);
      res.writeHead(200, { 'Content-Type': contentType(full) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test.describe('visual regression', () => {
  let server;
  let base;

  test.beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    base = started.base;
  });

  test.afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  test.use({ reducedMotion: 'reduce' });

  test('index desktop visual baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.work-card');
    await page.locator('html').evaluate(node => node.classList.remove('is-loading'));
    await expect(page).toHaveScreenshot('index-desktop-full.png', {
      fullPage: false,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
});
```

- [ ] Expand the skeleton with the three remaining screenshot tests.
- [ ] Run visual tests once to create snapshots:

```powershell
npm.cmd exec playwright test tests/quality/visual-regression.spec.mjs --update-snapshots
```

Expected:

- Snapshots are created under Playwright snapshot folders.
- Review screenshots manually before accepting.

### Task D3: Add Governance Drift Checker

- [ ] Create `scripts/check-governance.mjs`.

Rules to enforce:

- `AGENTS.md` and `docs/agent/architecture.md` mention `shared-runtime.js`.
- No active docs contain stale hard-coded historical pass totals.
- No shipped files contain visible placeholder/debug claims.
- `index.html` and `free-assets.html` do not use first-party `defer`, import maps, or first-party module scripts.
- `free-assets.html` does not statically load model-viewer or Three scripts.

Implementation shape:

```js
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ''}`);
    return;
  }
  failures += 1;
  console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
}

const activeDocs = ['AGENTS.md', 'docs/agent/architecture.md', 'docs/agent/verification.md', 'docs/agent/quality-tooling.md'];
const stalePassTotal = /\b(?:56|113|115)\/(?:56|113|115)\b/;

for (const rel of activeDocs) {
  const text = read(rel);
  check(`${rel}: no stale pass totals`, !stalePassTotal.test(text));
}

check('AGENTS.md mentions shared-runtime', read('AGENTS.md').includes('shared-runtime.js'));
check('architecture mentions shared-runtime', read('docs/agent/architecture.md').includes('shared runtime'));

const freeAssets = read('free-assets.html');
check('free-assets has no static model-viewer', !/model-viewer\.min\.js/.test(freeAssets));
check('free-assets has no static Three scripts', !/three(?:\.module|\.core)?\.js/.test(freeAssets));

if (failures) {
  console.error(`SUMMARY: ${failures} governance failure(s)`);
  process.exit(1);
}
console.log('SUMMARY: 0 governance failures');
```

- [ ] Add script to `package.json`:

```json
"check:governance": "node scripts/check-governance.mjs"
```

- [ ] Update `quality:deep` or add `quality:governance` conservatively:

Preferred Sprint D default:

```json
"quality:governance": "npm run check:governance"
```

Do not put visual snapshots into `quality:fast`. Add visual/governance to `quality:all` only after snapshots are stable.

### Task D4: Wire Visual And Governance Commands

- [ ] Add scripts:

```json
"test:visual": "playwright test tests/quality/visual-regression.spec.mjs",
"test:visual:update": "playwright test tests/quality/visual-regression.spec.mjs --update-snapshots",
"quality:governance": "npm run check:governance",
"quality:all": "npm run quality:deep && npm run quality:governance && npm run test:visual && npm run check:lighthouse && npm run codex:ship"
```

- [ ] Run:

```powershell
npm.cmd run quality:governance
npm.cmd run test:visual
npm.cmd run quality:deep
npm.cmd run codex:ship
```

Expected:

- Governance checker reports `SUMMARY: 0 governance failures`.
- Visual tests pass against reviewed snapshots.
- `quality:deep` and `codex:ship` pass.

### Task D5: CI Blocker Decision

- [ ] Inspect current workflow state:

```powershell
Get-ChildItem -Force .github -Recurse
```

- [ ] If no workflow exists, create `.github/workflows/quality.yml` only after confirming CI is in scope for Sprint D.

Workflow should run:

```yaml
name: quality

on:
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run quality:governance
      - run: npm run quality:deep
      - run: npm run test:visual
      - run: npm run codex:ship
```

- [ ] If CI is not approved yet, document that Sprint D delivered local gates and left CI wiring as the first Sprint D follow-up PR.

### Task D6: Sprint D Final Review And PR

- [ ] Run:

```powershell
git diff --check
npm.cmd run verify
npm.cmd run quality:fast
npm.cmd run quality:deep
npm.cmd run quality:governance
npm.cmd run test:visual
npm.cmd run codex:ship
```

- [ ] Run final `/review` agents:

```text
verification_reviewer
instruction_drift_auditor
runtime_mapper
code_deadwood_auditor
codex_infra_architect
```

- [ ] Check `DO_NOT_PUSH.md`.
- [ ] Commit:

```powershell
git add package.json verify-frozen.js free-assets.html js/i18n.js scripts/check-governance.mjs tests/quality/visual-regression.spec.mjs tests/quality/visual-regression.spec.mjs-snapshots docs/agent/quality-tooling.md docs/agent/technical-stack.md docs/agent/verification.md docs/superpowers/plans/2026-05-30-remaining-industrial-editorial-refresh.md
git commit -m "Add visual and governance quality gates"
git push -u origin codex/industrial-editorial-refresh-sprint-d
```

- [ ] Open a draft PR.

---

## Sprint E: Performance, Accessibility, Motion Tightening

**Branch:** `codex/industrial-editorial-refresh-sprint-e`, or combined branch `codex/industrial-editorial-refresh-sprint-e-f` when Sprint E and F are implemented together.

**Goal:** Reduce runtime friction and tighten budgets after Sprint D gives reliable visual/governance safety nets.

**Primary Files**

- Modify: `js/main.js`
- Modify: `js/animations.js`
- Modify: `css/shared.css`
- Modify: `css/portfolio-core.css`
- Modify: `css/free-assets.css`
- Modify: `scripts/run-lhci.mjs`
- Modify: `scripts/run-pa11y.mjs` only if budgets/checks need intentional updates
- Modify: `verify-frozen.js` only for stable new contracts
- Conditional: `docs/agent/quality-tooling.md`

### Task E1: Measure Before Changing

- [ ] Start from merged Sprint D:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/industrial-editorial-refresh-sprint-e
```

- [ ] Run:

```powershell
npm.cmd run verify
npm.cmd run quality:deep
npm.cmd run check:lighthouse
npm.cmd run check:a11y
```

- [ ] Capture before screenshots and Lighthouse output under `C:\tmp\codex-sprint-e\baseline`.

### Task E2: Preloader Tightening

- [ ] Map current preloader flow in `js/main.js`:
  - `html.is-loading`
  - first card image waiting
  - `codex:preloader-done`
  - Lenis lock/unlock behavior
- [ ] Add a narrow verifier/browser check if changing behavior:
  - page becomes interactive after preloader completes
  - `codex:preloader-done` still dispatches
  - reduced-motion path does not delay user control
- [ ] Implement smallest change:
  - shorten waiting where safe
  - avoid blocking on non-critical images
  - preserve event name and body/html state contract

Acceptance:

- No visual overlap on first viewport.
- No console errors.
- `codex:preloader-done` still fires once.

### Task E3: Custom Cursor Friction Review

- [ ] Browser-check desktop fine pointer:
  - sidebar controls
  - card hover
  - case tabs
  - fullscreen controls
  - free-assets preview/download buttons
- [ ] Keep custom cursor active only where it adds signal:
  - portfolio cards
  - tag cards only if not conflicting with `.tag-card.work-card`
  - primary interactive case controls
- [ ] Do not alter `.work-card:not(.tag-card)` magnetic target contract unless verifier is updated first.

Acceptance:

- Native pointer behavior remains clear on buttons/inputs.
- Custom cursor does not obscure text or critical controls.
- Mobile/touch behavior unaffected.

### Task E4: Accessibility Tightening

- [ ] Run manual keyboard path:
  - skip link
  - language toggle
  - theme toggle
  - filter dropdown
  - game switch
  - portfolio cards
  - case tabs/nav/share/fullscreen
  - free-assets tag cards/preview/download
- [ ] Fix only concrete issues found:
  - missing focus visibility
  - incorrect `aria-current` or `aria-selected`
  - trap/restore focus for fullscreen if broken
- [ ] Preserve bilingual i18n for any visible labels.

Acceptance:

- `npm.cmd run check:a11y` passes.
- Playwright axe remains within current budget.
- Keyboard path is usable without pointer.

### Task E5: Lighthouse Budget Tightening

- [ ] Inspect `scripts/run-lhci.mjs`.
- [ ] Run `npm.cmd run check:lighthouse` twice to identify noise.
- [ ] Only tighten budgets that pass consistently on local baseline.
- [ ] If budgets are noisy, document measured values in PR body and leave strict budget changes for a separate perf-only PR.

Acceptance:

- `check:lighthouse` passes on current machine.
- No broad visual redesign.
- No removal of identity motion unless it improves measured friction.

### Task E6: Sprint E Final Gates

- [ ] Run:

```powershell
git diff --check
npm.cmd run verify
npm.cmd run quality:fast
npm.cmd run quality:deep
npm.cmd run check:lighthouse
npm.cmd run check:a11y
npm.cmd run codex:ship
```

- [ ] Browser screenshots:
  - index desktop/mobile
  - free-assets desktop/mobile
  - fullscreen overlay
  - reduced-motion emulation

- [ ] Final `/review` agents:
  - `verification_reviewer`
  - `instruction_drift_auditor`
  - `runtime_mapper`
  - `code_deadwood_auditor`

- [ ] Commit, push, draft PR.

---

## Sprint F: Free-Assets Growth And SEO Depth

**Branch:** `codex/industrial-editorial-refresh-sprint-f`, or combined branch `codex/industrial-editorial-refresh-sprint-e-f` when Sprint E and F are implemented together.

**Goal:** Make free-assets a stronger acquisition surface with richer metadata, trust signals, and static SEO depth without adding routing/build infrastructure.

**Primary Files**

- Modify: `free-assets.html`
- Modify: `js/fa-data.js`
- Modify: `js/i18n-data.js` if visible shared copy changes
- Modify: `js/free-assets.js` if card rendering needs new metadata fields
- Modify: `assets/img/og-free-assets.jpg` only if a new approved OG asset is created
- Modify: `sitemap.xml` if present or create if absent and approved
- Modify: `robots.txt` if present or create if absent and approved
- Conditional create: static asset detail pages only if explicitly approved after card SEO work is stable

### Task F1: SEO Inventory

- [ ] Inspect current free-assets metadata:

```powershell
rg -n "canonical|og:|twitter:|json-ld|application/ld\\+json|sitemap|robots|download|FA_DATA|FA_LOCALES" free-assets.html index.html js/fa-data.js js/i18n-data.js .
```

- [ ] List:
  - current title/description
  - canonical
  - OG/Twitter tags
  - JSON-LD entities
  - asset count consistency
  - download trust copy
  - sitemap/robots presence

### Task F2: Enrich `FA_DATA` Metadata

- [ ] Add structured fields only where they will be used:

```js
{
  seoTitle: 'Orbital Mk.II free hard-surface 3D asset',
  seoDesc: 'CC0 Blender and FBX hard-surface prop with PBR textures for real-time scenes.',
  formats: ['.FBX', '.BLEND', '4K PBR textures'],
  license: 'CC0',
  useCases: ['game props', 'product visualization', 'look development']
}
```

- [ ] Keep existing fields and IDs stable:
  - `id`
  - `title`
  - `desc`
  - `cat`
  - `badge`
  - `file`
  - `size`
  - `thumb`
  - `model`
  - `contents`

Acceptance:

- Initial hard-surface grid still renders 8 cards.
- `FA_LOCALES` remains aligned for Russian descriptions where applicable.

### Task F3: JSON-LD Depth

- [ ] Update `free-assets.html` JSON-LD to describe:
  - Codex Studio free asset catalog
  - dataset or collection of downloadable creative works
  - license as CC0
  - representative asset list from `FA_DATA`
- [ ] Add verifier checks if static JSON-LD is changed:
  - valid JSON parse
  - expected entity count
  - free-assets-specific image remains present

Acceptance:

- `verify-frozen.js` still passes `0 FAIL`.
- No visible copy regression.

### Task F4: Download Trust Signals

- [ ] Add concise production-facing trust signals on free-assets:
  - license clarity
  - included formats
  - no account required, if true for current download behavior
- [ ] Mirror visible copy in i18n data if the text appears in both languages.
- [ ] Avoid explanatory UI walls; keep text compact and functional.

Acceptance:

- Cards remain scannable.
- Mobile layout has no overlap.
- Russian toggle does not restore stale copy.

### Task F5: Sitemap And Robots Review

- [ ] Check existing files:

```powershell
Get-ChildItem -Force sitemap.xml,robots.txt -ErrorAction SilentlyContinue
```

- [ ] If absent and approved, create:
  - `sitemap.xml` with `index.html` and `free-assets.html`
  - `robots.txt` allowing crawl and pointing to sitemap
- [ ] Add governance/verifier checks only if these files become part of shipped contract.

Acceptance:

- URLs match current production domain.
- No generated build step introduced.

### Task F6: Static Asset Pages Decision

- [ ] Do not add asset pages by default.
- [ ] Present a separate decision point after F1-F5:
  - Option A: keep single static catalog page.
  - Option B: add a limited set of hand-authored static detail pages for the highest-value assets.
- [ ] If Option B is approved later, create a separate Sprint F2 plan with page template, i18n, sitemap, verifier coverage, and visual checks.

### Task F7: Sprint F Final Gates

- [ ] Run:

```powershell
git diff --check
npm.cmd run verify
npm.cmd run quality:fast
npm.cmd run quality:deep
npm.cmd run check:lighthouse
npm.cmd run codex:ship
```

- [ ] Browser screenshots:
  - free-assets desktop/mobile
  - RU language mode
  - download button after click
  - representative tag filters

- [ ] Final `/review` agents:
  - `verification_reviewer`
  - `instruction_drift_auditor`
  - `codex_infra_architect` if sitemap/robots/governance changed
  - `code_deadwood_auditor`

- [ ] Commit, push, draft PR.

---

## Recommended Execution Order

1. Sprint D is complete and provides the visual/governance safety rails.
2. Sprint E and Sprint F may be delivered together on `codex/industrial-editorial-refresh-sprint-e-f` if changes remain scoped and all final gates pass.
3. Do not start any asset-page expansion or routing/build work without a separate approved plan.

## Cross-Sprint Completion Checklist

- [x] Sprint D PR merged to `main`.
- [ ] Sprint E/F PR merged to `main`.
- [ ] `main` is synced locally after each merge.
- [ ] Final `npm.cmd run verify` reports `0 FAIL` on `main`.
- [ ] Final `npm.cmd run quality:deep` passes on `main`.
- [ ] Final `npm.cmd run codex:ship` passes on `main`.
- [ ] No remaining active docs describe stale script order, stale pass totals, stale stack assumptions, or old Sprint A/B/C handoff state as current work.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-05-30-remaining-industrial-editorial-refresh.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, with checkpoints for review.
