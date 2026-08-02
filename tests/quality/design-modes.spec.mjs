import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { visibleCaseIds, visibleFaCategories } from '../../scripts/content-expectations.mjs';
import { startStaticServer } from './fixtures/admin-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VISIBLE_CASES = visibleCaseIds(ROOT).map((id) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cases', `${id}.json`), 'utf8'))
);
const CASE_BY_ID = new Map(VISIBLE_CASES.map((project) => [project.id, project]));
const PRIMARY_CASE = VISIBLE_CASES[0] || null;
const SECOND_CASE = VISIBLE_CASES[1] || null;
const THIRD_CASE = VISIBLE_CASES[2] || null;
const THREE_D_CASE = VISIBLE_CASES.find((project) => project.case?.modelSrc) || null;
const POSTER_CASE = VISIBLE_CASES.find((project) => project.card?.thumb) || null;
const CONTROLLED_MOTION_CASE =
  VISIBLE_CASES.find(
    (project) =>
      project.case?.modelSrc &&
      project.case?.motionBlocks?.some(
        (block) => block?.source === 'vimeo' && block.playback === 'controlled'
      )
  ) || null;
// Тест меряет геометрию подписи внутри inline-stage, поэтому носителем должен
// быть кейс, у которого высокий блок НЕСЁТ подпись: с раунда C подписи
// необязательны, и кейс без них — валидный контент, а не повод падать.
const INLINE_CASE =
  VISIBLE_CASES.find(
    (project) =>
      project.case?.inline?.title?.en &&
      project.case?.media?.some(
        (media) => media?.format === 'tall' && media.src && media.caption?.label?.en && media.caption?.desc?.en
      )
  ) || null;
const VISIBLE_FA_CATEGORIES = visibleFaCategories(ROOT);
const NON_GAME_FA_CATEGORY = VISIBLE_FA_CATEGORIES.find((category) => !category.gameAsset) || null;
const SHOWCASE_FA_CATEGORY = VISIBLE_FA_CATEGORIES.find(
  (category) => !category.gameAsset && category.items.length >= 3
) || null;
function hasFreeAssetModel(item) {
  const model = Object.hasOwn(item, 'model') ? item.model : item.id;
  return typeof model === 'string' && fs.existsSync(path.join(ROOT, 'assets', 'models', 'free', `${model}.glb`));
}

const VISIBLE_MODEL_FA = VISIBLE_FA_CATEGORIES
  .flatMap((category) => category.items.map((item) => ({ category, item })))
  .find(({ item }) => hasFreeAssetModel(item));
const MODEL_ARCHIVE_FA = VISIBLE_FA_CATEGORIES
  .flatMap((category) => category.items.map((item) => ({ category, item })))
  .find(({ item }) => hasFreeAssetModel(item) && item.file && fs.existsSync(path.join(ROOT, 'downloads', item.file)));

const server = startStaticServer();
const MODES = ['specimen', 'chamber'];
const PROTOTYPE_KEYS = ['constructor', 'toString', '__proto__'];

function requireFixture(fixture, reason) {
  test.skip(!fixture, reason);
  return fixture;
}

function assetPath(value) {
  return String(value || '').replace(/^\.\//, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assetPathPattern(value) {
  return new RegExp(`${escapeRegExp(assetPath(value))}$`);
}

function collectConsoleErrors(page) {
  const errors = [];
  const localOrigin = new URL(server.base).origin;
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    const source = location.url ? ` @ ${location.url}` : '';
    errors.push(`${message.text()}${source}`);
  });
  page.on('response', (response) => {
    if (new URL(response.url()).origin === localOrigin && !response.ok()) {
      errors.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

function internalConsoleErrors(errors) {
  return errors.filter((error) => !/(ERR_CERT_AUTHORITY_INVALID|fontshare|og-image\.jpg)/i.test(error));
}

function formatAxeViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => (Array.isArray(node.target) ? node.target.join(' ') : String(node.target)))
        .join(', ');
      return `${violation.id} (${violation.impact || 'unknown'}): ${targets}`;
    })
    .join('\n');
}

async function expectReducedMotionStyles(page, selector) {
  const state = await page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const toMilliseconds = (value) =>
        Math.max(
          ...value.split(',').map((part) => {
            const duration = part.trim();
            return duration.endsWith('ms') ? Number.parseFloat(duration) : Number.parseFloat(duration) * 1000;
          })
        );
      const style = getComputedStyle(node);
      return {
        mediaMatches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        transitionMilliseconds: toMilliseconds(style.transitionDuration),
        animationMilliseconds: toMilliseconds(style.animationDuration),
        scrollBehavior: style.scrollBehavior
      };
    });

  expect(state.mediaMatches).toBe(true);
  expect(state.transitionMilliseconds).toBeLessThanOrEqual(0.02);
  expect(state.animationMilliseconds).toBeLessThanOrEqual(0.02);
  expect(state.scrollBehavior).toBe('auto');
}

async function waitForDesign(page, mode, surface) {
  await page.waitForFunction(
    ({ expectedMode, expectedSurface }) => {
      const htmlReady = document.documentElement.getAttribute('data-design') === expectedMode;
      const loadingDone = !document.documentElement.classList.contains('is-loading');
      const style = document.querySelector('link[data-codex-design-asset="style"]');
      const runtime = document.querySelector('script[data-codex-design-asset="runtime"]');
      const assetsReady = Boolean(style && style.sheet && runtime);
      const surfaceReady =
        expectedSurface === 'index'
          ? Boolean(
              document.querySelector(`[data-design-home="${expectedMode}"]`) &&
              document.body.classList.contains(
                expectedMode === 'specimen' ? 'specimen-index-page' : 'chamber-page-portfolio'
              )
            )
          : document.body.classList.contains(expectedMode === 'specimen' ? 'specimen-fa-page' : 'chamber-page-assets');
      return htmlReady && loadingDone && assetsReady && surfaceReady;
    },
    { expectedMode: mode, expectedSurface: surface }
  );
}

// timeout: сценарии, которые НАМЕРЕННО тормозят загрузку (watchdog-тест держит
// базовый рантайм 4.3с), под нагрузкой полного прогона не укладываются в
// дефолтные 10с — им передаётся запас.
async function waitForHybridHome(page, timeout = 10000) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    const styles = Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]'));
    const runtimes = Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]'));
    return (
      root.getAttribute('data-design') === 'hybrid' &&
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'home' &&
      root.classList.contains('design-chamber-home') &&
      !root.classList.contains('is-loading') &&
      styles.length === 2 &&
      styles.every((style) => Boolean(style.sheet)) &&
      runtimes.length === 2 &&
      Boolean(document.querySelector('[data-design-home="hybrid"]')) &&
      document.body.classList.contains('chamber-page-portfolio')
    );
  }, null, { timeout });
}

async function waitForHybridCase(page, projectId) {
  await page.waitForFunction((expectedProjectId) => {
    const root = document.documentElement;
    const caseView = document.getElementById('case-view');
    return (
      root.getAttribute('data-design') === 'hybrid' &&
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'case' &&
      !root.classList.contains('design-chamber-home') &&
      document.body.classList.contains('chamber-page-portfolio') &&
      document.body.classList.contains('chamber-route-case') &&
      Boolean(caseView && !caseView.hidden && caseView.getAttribute('data-hybrid-case-ready') === expectedProjectId) &&
      Boolean(caseView && caseView.querySelector('.hybrid-case-dossier')) &&
      Boolean(caseView && caseView.querySelector('.hybrid-case-hero'))
    );
  }, projectId);
}

async function waitForHybridFreeAssets(page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    const grid = document.getElementById('fa-grid');
    const cards = grid ? Array.from(grid.querySelectorAll('.fa-card')) : [];
    const layout = document.querySelector('.layout');
    return (
      root.getAttribute('data-design') === 'hybrid' &&
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'free-assets' &&
      !root.classList.contains('design-chamber-home') &&
      document.body.classList.contains('chamber-page-assets') &&
      cards.length > 0 &&
      cards.every((card) => Boolean(card.dataset.chamberIndex)) &&
      Boolean(layout && getComputedStyle(layout).visibility === 'visible')
    );
  });
}

test('Original stays the default and unknown design values fail closed', async ({ page }) => {
  const variantRequests = [];
  page.on('request', (request) => {
    if (/design-(?:specimen|chamber|hybrid)\.(?:css|js)(?:\?|$)/.test(request.url())) {
      variantRequests.push(request.url());
    }
  });

  await page.goto(`${server.base}/index.html`, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-design', 'original');
  expect(variantRequests).toEqual([]);

  await page.goto(`${server.base}/index.html?design=not-a-real-mode`, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-design', 'original');
  expect(variantRequests).toEqual([]);

  for (const value of PROTOTYPE_KEYS) {
    await page.goto(`${server.base}/index.html?design=${encodeURIComponent(value)}`, { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-design', 'original');
    expect(variantRequests).toEqual([]);
  }
});

test('language stays provisional until geo detection settles', async ({ page }) => {
  let releaseTrace;
  const traceGate = new Promise((resolve) => {
    releaseTrace = resolve;
  });
  await page.route('https://www.cloudflare.com/cdn-cgi/trace', async (route) => {
    await traceGate;
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=RU\n' });
  });

  const traceResponse = page.waitForResponse('https://www.cloudflare.com/cdn-cgi/trace');
  await page.goto(`${server.base}/index.html?design=specimen`, { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).searchParams.has('lang')).toBe(false);
  expect(
    new URL(await page.locator('#free-assets-footer').getAttribute('href'), server.base).searchParams.has('lang')
  ).toBe(false);

  releaseTrace();
  const response = await traceResponse;
  expect(await response.finished()).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('ru');
  await expect
    .poll(async () =>
      new URL(await page.locator('#free-assets-footer').getAttribute('href'), server.base).searchParams.get('lang')
    )
    .toBe('ru');
});

test('Design Lab rejects prototype-key case hashes', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  for (const mode of MODES) {
    for (const value of PROTOTYPE_KEYS) {
      await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${encodeURIComponent(value)}`, {
        waitUntil: 'networkidle'
      });
      await waitForDesign(page, mode, 'index');
      await expect(page.locator(`[data-design-home="${mode}"]`)).toBeVisible();
      await expect(page.locator('#case-view')).toBeHidden();
    }
  }
  expect(internalConsoleErrors(errors)).toEqual([]);
});

test('manual language choice wins over late geo detection', async ({ page }) => {
  let releaseTrace;
  let resolveTraceHandled;
  let rejectTraceHandled;
  const traceGate = new Promise((resolve) => {
    releaseTrace = resolve;
  });
  const traceHandled = new Promise((resolve, reject) => {
    resolveTraceHandled = resolve;
    rejectTraceHandled = reject;
  });
  await page.route('https://www.cloudflare.com/cdn-cgi/trace', async (route) => {
    try {
      await traceGate;
      await route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' });
      resolveTraceHandled();
    } catch (error) {
      rejectTraceHandled(error);
      throw error;
    }
  });

  const traceRequest = page.waitForRequest('https://www.cloudflare.com/cdn-cgi/trace');
  await page.goto(`${server.base}/index.html?design=specimen`, { waitUntil: 'domcontentloaded' });
  await traceRequest;
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  releaseTrace();
  await traceHandled;
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  expect(new URL(page.url()).searchParams.get('lang')).toBe('ru');
});

test('Original Free Assets game filter hides non-game cards in the rendered layout', async ({ page }) => {
  const category = requireFixture(
    NON_GAME_FA_CATEGORY,
    'skipped: no visible non-game Free Assets category for the game filter'
  );
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/free-assets.html?lang=en`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#fa-grid .fa-card').length > 0);

  await page.locator(`.tag-card[data-tag="${category.key}"]`).click();
  await page.locator('#game-switch-label').click();
  await expect(page.locator('#game-switch')).toBeChecked();
  await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(0);
  await expect(page.locator('#fa-grid .fa-grid__empty')).toBeVisible();
});

for (const mode of MODES) {
  test(`${mode}: direct case deep links survive bootstrap`, async ({ page }) => {
    const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
    const next = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases');
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${primary.id}`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    expect(new URL(page.url()).hash).toBe(`#${primary.id}`);
    await expect(page.locator(`[data-design-home="${mode}"]`)).toBeHidden();
    await expect(page.locator('#case-view')).toBeVisible();
    await expect(page.locator('#case-title')).toContainText(primary.card.title.en);
    const firstCaseItem = page
      .locator(
        mode === 'chamber'
          ? '#case-scroll-track > .case-row:not(.chamber-case-poster) .case-item'
          : '#case-scroll-track .case-item'
      )
      .first();
    await expect(firstCaseItem).toBeVisible();
    await expect
      .poll(async () => Number(await firstCaseItem.evaluate((node) => getComputedStyle(node).opacity)))
      .toBeGreaterThan(0.99);

    await page.locator('#case-tab-bp').click();
    await expect(page.locator('#case-tab-bp')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#case-blueprints')).toBeVisible();
    await page.locator('#case-tab-2d').click();
    await page.locator('#case-next').click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${next.id}`);
    expect(new URL(page.url()).searchParams.get('design')).toBe(mode);
    await expect(page.locator('#case-title')).toContainText(next.card.title.en);

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${next.id}`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    expect(new URL(page.url()).hash).toBe(`#${next.id}`);
    await expect(page.locator(`[data-design-home="${mode}"]`)).toBeHidden();
    await expect(page.locator('#case-title')).toContainText(next.card.title.en);
  });

  test(`${mode}: Home, Case and Back share the opt-in URL`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.base });
    await page.goto(`${server.base}/index.html?design=${mode}&lang=ru&utm_source=qa&token=secret`, {
      waitUntil: 'networkidle'
    });
    await waitForDesign(page, mode, 'index');

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/noindex/i);

    const home = page.locator(`[data-design-home="${mode}"]`);
    await expect(home).toBeVisible();
    if (mode === 'specimen') {
      await page.locator('.specimen-filter[data-filter="all"]').press('ArrowRight');
      expect(new URL(page.url()).hash).toBe('');
      await expect(home).toBeVisible();
    }
    const inventory = await page.evaluate(
      (expectedMode) => ({
        source: Array.from(document.querySelectorAll('.work-card[data-id]:not(.tag-card)')).map((card) => ({
          id: card.getAttribute('data-id'),
          title: card.querySelector('.work-card__title')?.textContent.trim() || ''
        })),
        variantIds: Array.from(
          document.querySelectorAll(`[data-design-home="${expectedMode}"] [data-design-project]`)
        ).map((control) => control.getAttribute('data-design-project'))
      }),
      mode
    );
    expect(inventory.variantIds).toEqual(inventory.source.map((project) => project.id));

    for (const [index, project] of inventory.source.entries()) {
      const projectLink = home.locator(`[data-design-project="${project.id}"]`);
      await expect(projectLink).toHaveAttribute('href', `#${project.id}`);
      await projectLink.click();
      await expect.poll(() => new URL(page.url()).hash).toBe(`#${project.id}`);
      expect(new URL(page.url()).searchParams.get('design')).toBe(mode);
      await expect(home).toBeHidden();
      await expect(page.locator('#case-view')).toBeVisible();
      await expect(page.locator('#case-title')).toHaveText(project.title);
      await expect(page.locator('#case-title')).toBeFocused();

      const caseScroll = page.locator('#case-scroll');
      if (index === 1) await expect.poll(() => caseScroll.evaluate((node) => node.scrollTop)).toBe(0);

      if (index === 0) {
        await expect(page.locator('#case-tab-2d')).toBeVisible();
        await expect(page.locator('#case-tab-3d')).toBeVisible();
        await expect(page.locator('#case-tab-bp')).toBeVisible();
        await page.locator('#case-share-desktop').click();
        const copiedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
        expect(copiedUrl.searchParams.get('design')).toBe(mode);
        expect(copiedUrl.searchParams.get('lang')).toBe('ru');
        expect(Array.from(copiedUrl.searchParams.keys()).sort()).toEqual(['design', 'lang']);
        expect(copiedUrl.hash).toBe(`#${project.id}`);

        const modifiedLogo = await page.locator('#logo-home').evaluate((link) => {
          const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            button: 0,
            ctrlKey: true
          });
          return { allowed: link.dispatchEvent(event), href: link.href };
        });
        expect(modifiedLogo.allowed).toBe(true);
        expect(new URL(modifiedLogo.href).searchParams.get('design')).toBe(mode);
        expect(new URL(page.url()).hash).toBe(`#${project.id}`);

        await caseScroll.evaluate((node) => {
          node.scrollTop = 500;
        });
        await expect.poll(() => caseScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
        if (mode === 'specimen') {
          await page.locator('#case-tab-3d').click();
          await expect(page.locator('#case-tab-3d')).toHaveAttribute('aria-selected', 'true');
        }
      }

      const backControls = page.locator('[data-design-back]:visible');
      expect(await backControls.count()).toBeGreaterThan(0);
      await backControls.first().click();
      await expect.poll(() => new URL(page.url()).hash).toBe('');
      expect(new URL(page.url()).searchParams.get('design')).toBe(mode);
      await expect(home).toBeVisible();
      if (mode === 'specimen') {
        await expect(page.locator('#case-tab-2d')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#case-3d')).toBeHidden();
        await expect(projectLink).toBeFocused();
      }
    }
    expect(internalConsoleErrors(errors)).toEqual([]);
  });

  test(`${mode}: Case media stops on Back and resumes for the same id`, async ({ page }) => {
    const motionCase = requireFixture(
      CONTROLLED_MOTION_CASE,
      'skipped: no visible case has a controlled Vimeo motion block'
    );
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${motionCase.id}`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    const home = page.locator(`[data-design-home="${mode}"]`);
    const controlledVimeo = page.locator(
      '.case-motion[data-motion-source="vimeo"][data-motion-playback="controlled"] [data-motion-toggle]'
    );
    await expect(controlledVimeo).toHaveCount(1);
    await controlledVimeo.scrollIntoViewIfNeeded();
    await controlledVimeo.evaluate((button) => {
      const card = button.closest('.case-motion');
      if (card?.getAttribute('data-motion-playing') === 'true') button.click();
      button.click();
    });
    await expect(controlledVimeo).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.case-motion__vimeo iframe')).not.toHaveCount(0);

    const backControls = page.locator('[data-design-back]:visible');
    expect(await backControls.count()).toBeGreaterThan(0);
    await backControls.first().click();
    await expect(home).toBeVisible();
    await expect(page.locator('.case-motion__vimeo iframe')).toHaveCount(0);
    await expect(controlledVimeo).toHaveAttribute('aria-pressed', 'false');

    await home.locator(`[data-design-project="${motionCase.id}"]`).click();
    await expect(home).toBeHidden();
    await controlledVimeo.scrollIntoViewIfNeeded();
    await expect(controlledVimeo).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.case-motion__vimeo iframe')).not.toHaveCount(0);

    await page.locator('#case-tab-3d').click();
    await expect(page.locator('#case-3d canvas, #case-3d model-viewer')).toHaveCount(1, { timeout: 15_000 });
    const secondBackControls = page.locator('[data-design-back]:visible');
    expect(await secondBackControls.count()).toBeGreaterThan(0);
    await secondBackControls.first().click();
    await expect(home).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(page.locator('#case-3d model-viewer, #case-3d canvas')).toHaveCount(0);
  });

  test(`${mode}: browser Back tears down Case fullscreen before showing Home`, async ({ page }) => {
    const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    const home = page.locator(`[data-design-home="${mode}"]`);
    await home.locator(`[data-design-project="${primary.id}"]`).first().click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${primary.id}`);
    await expect(page.locator('#case-view')).toBeVisible();

    const galleryImage = page
      .locator('#case-scroll-track [data-gallery] img, #case-scroll-track[data-gallery] img')
      .first();
    await expect(galleryImage).toBeVisible();
    await galleryImage.click();
    await expect(page.locator('.media-fs')).toBeVisible();

    await page.goBack();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await expect(home).toBeVisible();
    await expect(page.locator('.media-fs')).toBeHidden();
    await expect(page.locator('.media-fs__stage')).toBeEmpty();
  });

  test(`${mode}: explicit RU reaches custom Free Assets CTA`, async ({ page }) => {
    await page.goto(`${server.base}/index.html?design=${mode}&lang=ru`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    const selector = mode === 'specimen' ? '.specimen-dossier__links a[href*="free-assets"]' : '.chamber-home__assets';
    const href = await page.locator(selector).getAttribute('href');
    const target = new URL(href, server.base);
    expect(target.searchParams.get('design')).toBe(mode);
    expect(target.searchParams.get('lang')).toBe('ru');
  });

  test(`${mode}: Free Assets keeps the design and remains responsive`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.base}/free-assets.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'free-assets');
    await page.waitForFunction(() => document.querySelectorAll('#fa-grid .fa-card').length > 0);

    await expect(page.locator('#fa-view')).toBeVisible();
    await expect(page.locator('#logo-back-portfolio')).toHaveAttribute('href', new RegExp(`design=${mode}`));
    await expect(page.locator('.fa-card__thumb-mv[data-codex-preview-enabled="true"]')).toHaveCount(0);
    await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(0);
    const fixture = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.tag-card[data-tag]'));
      const fixtures = cards
        .map((card) => {
          const tag = card.getAttribute('data-tag');
          const items = window.FA_DATA && Array.isArray(window.FA_DATA[tag]) ? window.FA_DATA[tag] : [];
          const downloadable = items.find((item) => item && item.hasFile !== false && item.file);
          return items.length ? { tag, count: items.length, file: downloadable ? downloadable.file : null } : null;
        })
        .filter(Boolean);
      return fixtures.find((entry) => entry.file) || fixtures[0] || null;
    });
    expect(fixture).not.toBeNull();
    await page.locator(`.tag-card[data-tag="${fixture.tag}"]`).click();
    await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(fixture.count);
    const modelPreviewCard = page
      .locator('#fa-grid .fa-card:visible')
      .filter({
        has: page.locator('.fa-card__thumb-mv')
      })
      .first();
    if (await modelPreviewCard.count()) {
      const viewerRequest = page.waitForRequest((request) => request.url().endsWith('/js/vendor/model-viewer.min.js'));
      await modelPreviewCard.locator('.fa-card__preview-btn').click();
      await viewerRequest;
      await expect(page.locator('.media-fs')).toBeVisible();
      await page.locator('.media-fs__close').click();
      await expect(page.locator('.media-fs')).toBeHidden();
    }
    if (fixture.file) {
      const downloadButton = page.locator(`#fa-grid .fa-card:visible .fa-card__download[data-file="${fixture.file}"]`);
      await expect(downloadButton).toHaveCount(1);
      const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
      expect(download.suggestedFilename()).toBe(fixture.file);
    } else {
      await expect(page.locator('#fa-grid .fa-card:visible .fa-card__download')).toHaveCount(0);
    }
    await expect(page.locator('#game-switch-label')).toBeVisible();
    const nonGameFixture = await page.evaluate(() => {
      const card = document.querySelector('.tag-card[data-game-asset="false"][data-tag]');
      if (!card) return null;
      const tag = card.getAttribute('data-tag');
      const count = window.FA_DATA && Array.isArray(window.FA_DATA[tag]) ? window.FA_DATA[tag].length : 0;
      return count ? { tag, count } : null;
    });
    if (nonGameFixture) {
      await page.locator(`.tag-card[data-tag="${nonGameFixture.tag}"]`).click();
      await page.locator('#game-switch-label').click();
      await expect(page.locator('#game-switch')).toBeChecked();
      await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(0);
      await expect(page.locator('#fa-grid .fa-grid__empty')).toBeVisible();
      await page.locator('#game-switch-label').click();
      await expect(page.locator('#game-switch')).not.toBeChecked();
      await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(nonGameFixture.count);
    }
    const gameFixture = await page.evaluate(() => {
      const card = document.querySelector('.tag-card[data-game-asset="true"][data-tag]');
      if (!card) return null;
      const tag = card.getAttribute('data-tag');
      const count = window.FA_DATA && Array.isArray(window.FA_DATA[tag]) ? window.FA_DATA[tag].length : 0;
      return { tag, count };
    });
    if (gameFixture) {
      expect(gameFixture.count).toBeGreaterThan(0);
      await page.locator(`.tag-card[data-tag="${gameFixture.tag}"]`).click();
      await page.locator('#game-switch-label').click();
      await expect(page.locator('#game-switch')).toBeChecked();
      await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(gameFixture.count);
      await page.locator('#game-switch-label').click();
      await expect(page.locator('#game-switch')).not.toBeChecked();
    }
    await page.locator('#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('body')).toHaveClass(mode === 'specimen' ? /specimen-fa-page/ : /chamber-page-assets/);
    const faTargetSizes = await page
      .locator(
        '.site-header a:visible, .site-header button:visible, #game-switch-label:visible, .fa-card__download:visible'
      )
      .evaluateAll((controls) =>
        controls.map((control) => {
          const rect = control.getBoundingClientRect();
          return {
            target: `${control.tagName.toLowerCase()}#${control.id}.${control.className}`,
            width: rect.width,
            height: rect.height
          };
        })
      );
    expect(faTargetSizes.length).toBeGreaterThan(0);
    expect(faTargetSizes.filter((size) => Math.round(size.width) < 44 || Math.round(size.height) < 44)).toEqual([]);
    const faAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(faAxe.violations, formatAxeViolations(faAxe.violations)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(internalConsoleErrors(errors)).toEqual([]);
  });

  test(`${mode}: mobile Home and Case keep controls inside the viewport`, async ({ page }) => {
    const posterCase = requireFixture(POSTER_CASE, 'skipped: no visible case with a card poster');
    const errors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(homeOverflow).toBeLessThanOrEqual(1);

    if (mode === 'specimen') {
      const toggle = page.locator('.specimen-index__mobile-toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();
      const filterSizes = await page.locator('.specimen-filter').evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        })
      );
      expect(filterSizes.every((size) => size.height >= 44 && size.width >= 44)).toBe(true);
    } else {
      await expect(page.locator('#contact-btn')).toBeVisible();
      await expect(page.locator('.chamber-home__assets')).toBeVisible();
    }

    const homeTargetSizes = await page
      .locator(
        '.site-header a:visible, .site-header button:visible, [data-design-home] a:visible, [data-design-home] button:visible'
      )
      .evaluateAll((controls) =>
        controls.map((control) => {
          const rect = control.getBoundingClientRect();
          return {
            target: `${control.tagName.toLowerCase()}#${control.id}.${control.className}`,
            width: rect.width,
            height: rect.height
          };
        })
      );
    expect(homeTargetSizes.length).toBeGreaterThan(0);
    expect(homeTargetSizes.filter((size) => Math.round(size.width) < 44 || Math.round(size.height) < 44)).toEqual([]);
    const homeAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(homeAxe.violations, formatAxeViolations(homeAxe.violations)).toEqual([]);

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${posterCase.id}`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    await expect(page.locator(`[data-design-home="${mode}"]`)).toBeHidden();
    await expect(page.locator('#case-share-desktop')).toBeVisible();

    const headerLayout = await page.evaluate(() => {
      const logo = document.querySelector('#logo-home')?.getBoundingClientRect();
      const controls = document.querySelector('.header-top__controls')?.getBoundingClientRect();
      return {
        logoVisible: Boolean(logo && logo.width > 0 && logo.height > 0),
        controlsVisible: Boolean(controls && controls.width > 0 && controls.height > 0),
        logoInside: Boolean(
          logo &&
          logo.left >= 0 &&
          logo.right <= window.innerWidth &&
          logo.top >= 0 &&
          logo.bottom <= window.innerHeight
        ),
        controlsInside: Boolean(
          controls &&
          controls.left >= 0 &&
          controls.right <= window.innerWidth &&
          controls.top >= 0 &&
          controls.bottom <= window.innerHeight
        ),
        overlap: Boolean(
          logo &&
          controls &&
          logo.right > controls.left &&
          logo.left < controls.right &&
          logo.bottom > controls.top &&
          logo.top < controls.bottom
        )
      };
    });
    expect(headerLayout.logoVisible).toBe(true);
    expect(headerLayout.controlsVisible).toBe(true);
    expect(headerLayout.logoInside).toBe(true);
    expect(headerLayout.controlsInside).toBe(true);
    expect(headerLayout.overlap).toBe(false);

    const caseTargetSizes = await page
      .locator(
        '.site-header a:visible, .site-header button:visible, #case-view .case-view__actions button:visible, [data-design-back]:visible'
      )
      .evaluateAll((controls) =>
        controls.map((control) => {
          const rect = control.getBoundingClientRect();
          return {
            target: `${control.tagName.toLowerCase()}#${control.id}.${control.className}`,
            width: rect.width,
            height: rect.height
          };
        })
      );
    expect(caseTargetSizes.length).toBeGreaterThan(0);
    expect(caseTargetSizes.filter((size) => Math.round(size.width) < 44 || Math.round(size.height) < 44)).toEqual([]);

    const caseLayout = await page.evaluate((expectedMode) => {
      const actions = document.querySelector('.case-view__actions');
      const title = document.querySelector('#case-title')?.getBoundingClientRect();
      const caption = document.querySelector('.chamber-case-hero .case-item__caption')?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        actionsOverflow: actions ? actions.scrollWidth - actions.clientWidth : 0,
        titleCaptionOverlap:
          expectedMode === 'chamber' && title && caption
            ? title.bottom > caption.top && title.top < caption.bottom
            : false,
        posterSrc: document.querySelector('.chamber-case-poster__image')?.getAttribute('src') || '',
        specimenFirstMedia:
          document.querySelector('#case-scroll-track')?.firstElementChild?.classList.contains('specimen-case-hero') ||
          false
      };
    }, mode);
    expect(caseLayout.documentOverflow).toBeLessThanOrEqual(1);
    expect(caseLayout.actionsOverflow).toBeLessThanOrEqual(1);
    expect(caseLayout.titleCaptionOverlap).toBe(false);
    if (mode === 'chamber') expect(caseLayout.posterSrc).toMatch(assetPathPattern(posterCase.card.thumb));
    else {
      expect(caseLayout.specimenFirstMedia).toBe(true);
      await expect(page.locator('#logo-home')).toContainText('CODEX');
      await expect(page.locator('#logo-home')).toBeVisible();
      await expect(page.locator('#lang-toggle')).toBeVisible();
      await expect(page.locator('#theme-toggle')).toBeVisible();
      await expect(page.locator('#case-share-desktop')).toBeVisible();
      await expect(page.locator('.specimen-case-dossier__label')).toBeHidden();
    }
    const caseAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(caseAxe.violations, formatAxeViolations(caseAxe.violations)).toEqual([]);
    expect(internalConsoleErrors(errors)).toEqual([]);
  });

  for (const path of ['index.html', 'free-assets.html']) {
    test(`${mode}: ${path} has no axe violations`, async ({ page }) => {
      await page.goto(`${server.base}/${path}?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
      await waitForDesign(page, mode, path === 'index.html' ? 'index' : 'free-assets');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(result.violations, formatAxeViolations(result.violations)).toEqual([]);
    });
  }

  test(`${mode}: Case has no axe violations`, async ({ page }) => {
    const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${primary.id}`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    await expect(page.locator('#case-view')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, formatAxeViolations(result.violations)).toEqual([]);
  });

  test(`${mode}: reduced motion covers Home, Case and Free Assets`, async ({ page }) => {
    const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    await expectReducedMotionStyles(page, 'body');

    if (mode === 'chamber') {
      const next = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases');
      const home = page.locator('[data-design-home="chamber"]');
      await page.locator(`.chamber-home__index-button[data-design-project="${next.id}"]`).click();
      await expect(home).not.toHaveClass(/is-changing/);
    }

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#${primary.id}`, {
      waitUntil: 'networkidle'
    });
    await waitForDesign(page, mode, 'index');
    await expect(page.locator('#case-view')).toBeVisible();
    await expectReducedMotionStyles(page, '#case-view');

    await page.goto(`${server.base}/free-assets.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'free-assets');
    await expectReducedMotionStyles(page, 'body');
  });
}

test('hybrid: strict opt-in keeps canonical Original and preserves the content-derived project order', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  await expect(page.locator('html')).toHaveAttribute('data-design', 'hybrid');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://codex.promo/');

  const assets = await page.evaluate(() => ({
    css: Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]')).map((asset) => ({
      path: new URL(asset.href).pathname,
      order: asset.getAttribute('data-codex-design-order')
    })),
    js: Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]')).map((asset) => ({
      path: new URL(asset.src).pathname,
      order: asset.getAttribute('data-codex-design-order')
    }))
  }));
  expect(assets).toEqual({
    css: [
      { path: '/css/design-chamber.css', order: '0' },
      { path: '/css/design-hybrid.css', order: '1' }
    ],
    js: [
      { path: '/js/design-chamber.js', order: '0' },
      { path: '/js/design-hybrid.js', order: '1' }
    ]
  });

  const inventory = await page.evaluate(() => ({
    source: Array.from(document.querySelectorAll('.work-card[data-id]:not(.tag-card)')).map((card) =>
      card.getAttribute('data-id')
    ),
    hybrid: Array.from(document.querySelectorAll('[data-design-home="hybrid"] [data-design-project]')).map((control) =>
      control.getAttribute('data-design-project')
    ),
    hrefs: Array.from(document.querySelectorAll('[data-design-home="hybrid"] [data-design-project]')).map((control) =>
      control.getAttribute('href')
    )
  }));
  expect(inventory.source).toEqual(VISIBLE_CASES.map((project) => project.id));
  expect(inventory.hybrid).toEqual(inventory.source);
  expect(inventory.hrefs).toEqual(inventory.source.map((id) => `#${id}`));

  const freeAssetsUrl = new URL(await page.locator('.chamber-home__assets').getAttribute('href'), server.base);
  expect(freeAssetsUrl.searchParams.get('design')).toBe('hybrid');
  expect(freeAssetsUrl.searchParams.get('lang')).toBe('en');

  await page.goto(`${server.base}/index.html?design=hybrid&lang=en#constructor`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);
  await expect(page.locator('[data-design-home="hybrid"]')).toBeVisible();
  await expect(page.locator('#case-view')).toBeHidden();
  expect(internalConsoleErrors(errors)).toEqual([]);
});

test('hybrid: static image grade is isolated from lightweight transition layers', async ({ page }) => {
  requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for an image transition');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  const settled = await page.evaluate(() => {
    const stack = document.querySelector('.chamber-home__image-stack');
    const layers = Array.from(stack.querySelectorAll(':scope > .chamber-home__image-layer'));
    const images = layers.map((layer) => layer.querySelector(':scope > .chamber-home__image'));
    const activeLayer = layers.find((layer) => layer.classList.contains('chamber-home__image-layer--active'));
    const activeImage = activeLayer && activeLayer.querySelector(':scope > .chamber-home__image');
    const standbyLayer = layers.find((layer) => layer !== activeLayer);
    const rect = (node) => {
      const bounds = node.getBoundingClientRect();
      return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left };
    };
    return {
      layerCount: layers.length,
      imagesPerLayer: layers.map((layer) => layer.querySelectorAll(':scope > .chamber-home__image').length),
      activeLayerCount: layers.filter((layer) => layer.classList.contains('chamber-home__image-layer--active')).length,
      activeImageCount: images.filter((image) => image.classList.contains('chamber-home__image--active')).length,
      activePairMatches: !!activeImage && activeImage.classList.contains('chamber-home__image--active'),
      standbyHidden: !!standbyLayer && standbyLayer.hidden && standbyLayer.querySelector('img').hidden,
      geometry: {
        media: rect(document.querySelector('.chamber-home__media')),
        stack: rect(stack),
        layer: rect(activeLayer),
        image: rect(activeImage)
      },
      stackFilter: getComputedStyle(stack).filter,
      stackTransform: getComputedStyle(stack).transform,
      imageFilters: images.map((image) => getComputedStyle(image).filter),
      imageTransitions: images.map((image) => getComputedStyle(image).transitionProperty),
      layerTransitions: layers.map((layer) => getComputedStyle(layer).transitionProperty),
      layerWillChange: layers.map((layer) => getComputedStyle(layer).willChange)
    };
  });
  expect(settled.layerCount).toBe(2);
  expect(settled.imagesPerLayer).toEqual([1, 1]);
  expect(settled.activeLayerCount).toBe(1);
  expect(settled.activeImageCount).toBe(1);
  expect(settled.activePairMatches).toBe(true);
  expect(settled.standbyHidden).toBe(true);
  for (const surface of ['stack', 'layer', 'image']) {
    for (const edge of ['top', 'right', 'bottom', 'left']) {
      expect(Math.abs(settled.geometry[surface][edge] - settled.geometry.media[edge])).toBeLessThanOrEqual(1);
    }
  }
  expect(settled.stackFilter).toBe('none');
  expect(settled.stackTransform).toBe('none');
  expect(settled.imageFilters.every((filter) => filter.includes('saturate(0.78)'))).toBe(true);
  expect(settled.imageFilters.every((filter) => filter.includes('contrast(1.06)'))).toBe(true);
  expect(settled.imageTransitions).toEqual(['none', 'none']);
  expect(settled.layerTransitions.every((transition) => transition.includes('opacity'))).toBe(true);
  expect(settled.layerTransitions.every((transition) => transition.includes('transform'))).toBe(true);
  expect(settled.layerWillChange).toEqual(['auto', 'auto']);

  const home = page.locator('[data-design-home="hybrid"]');
  await page.locator('.chamber-home__pager-button').last().click();
  await expect(home).toHaveAttribute('data-transition-state', 'crossfade');
  const moving = await page.evaluate(() => ({
    stackTransform: getComputedStyle(document.querySelector('.chamber-home__image-stack')).transform,
    layerWillChange: Array.from(document.querySelectorAll('.chamber-home__image-layer')).map(
      (layer) => getComputedStyle(layer).willChange
    ),
    imageWillChange: Array.from(document.querySelectorAll('.chamber-home__image')).map(
      (image) => getComputedStyle(image).willChange
    )
  }));
  expect(moving.stackTransform).toBe('none');
  expect(moving.layerWillChange.every((value) => value.includes('opacity') && value.includes('transform'))).toBe(true);
  expect(moving.imageWillChange).toEqual(['auto', 'auto']);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
});

test('hybrid: readiness gate prevents Original flash and fails open when the adapter is unavailable', async ({
  page
}) => {
  const inlineCase = requireFixture(
    INLINE_CASE,
    'skipped: no visible case has an inline note with tall media'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseAdapter;
  const adapterGate = new Promise((resolve) => {
    releaseAdapter = resolve;
  });
  await page.route('**/js/design-hybrid.js', async (route) => {
    await adapterGate;
    await route.continue();
  });

  await page.goto(`${server.base}/index.html?design=hybrid&lang=ru`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'pending');
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.design-runtime-gate')).toBeVisible();
  await expect(page.locator('.design-runtime-gate')).toHaveAttribute('role', 'status');
  await expect(page.locator('.design-runtime-gate')).toHaveAttribute('aria-label', 'Загрузка варианта Hybrid');
  await expect(page.locator('.design-runtime-gate__status')).toHaveText('ИНИЦИАЛИЗАЦИЯ HYBRID');
  await expect(page.locator('[role="status"]')).toHaveCount(1);
  const pendingAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(pendingAxe.violations, formatAxeViolations(pendingAxe.violations)).toEqual([]);
  await expect(page.locator('[data-design-home="hybrid"]')).toHaveCount(0);

  await page.evaluate(() => {
    window.__hybridReadySnapshot = null;
    new MutationObserver((records, observer) => {
      if (
        records.some((record) => record.attributeName === 'data-design-runtime-state') &&
        document.documentElement.getAttribute('data-design-runtime-state') === 'ready'
      ) {
        const home = document.querySelector('[data-design-home="hybrid"]');
        const caseView = document.getElementById('case-view');
        window.__hybridReadySnapshot = {
          surface: document.documentElement.getAttribute('data-design-surface'),
          homeHidden: home ? home.hidden : null,
          caseHidden: caseView ? caseView.hidden : null
        };
        observer.disconnect();
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-design-runtime-state']
    });
  });

  releaseAdapter();
  await waitForHybridHome(page);
  await page.unroute('**/js/design-hybrid.js');
  expect(await page.evaluate(() => window.__hybridReadySnapshot)).toEqual({
    surface: 'home',
    homeHidden: false,
    caseHidden: true
  });
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('.design-runtime-gate')).toHaveCount(0);
  await page.locator(`[data-design-project="${inlineCase.id}"]`).click();
  await waitForHybridCase(page, inlineCase.id);
  await expect(page.locator('#case-scroll-track > .case-row--wide-text')).toHaveCount(1);
  await expect(page.locator('#case-scroll-track .case-text--overlay')).toHaveCount(1);

  await page.route('**/js/design-hybrid.js', (route) => route.abort());
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${inlineCase.id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback');
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('.design-runtime-gate')).toHaveCount(0);
  await expect(page.locator('[data-design-home="hybrid"]')).toHaveCount(0);
  await expect(page.locator('#main')).toBeVisible();
  await expect(page.locator('#theme-toggle')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-design-surface', /.+/);
  await expect(page.locator('body')).not.toHaveClass(/chamber-page-|specimen-/);
  const fallbackTallText = page.locator('.case-row--tall-text');
  await expect(fallbackTallText).toHaveCount(1);
  await expect(page.locator('.case-row--wide-text, .case-item--inline-stage, .case-text--overlay')).toHaveCount(0);
  await expect(fallbackTallText.locator(':scope > .case-item')).toHaveCount(2);
  await expect(fallbackTallText.locator(':scope > .case-item--text-inline')).toHaveCount(1);

  await page.unroute('**/js/design-hybrid.js');
  await page.route('**/css/design-hybrid.css', (route) => route.abort());
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback');
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('.design-runtime-gate')).toHaveCount(0);
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('script[data-codex-design-asset="runtime"]')).toHaveCount(0);

  await page.unroute('**/css/design-hybrid.css');
  await page.route('**/js/design-loader.js', (route) => route.abort());
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('html')).not.toHaveAttribute('data-design-runtime-state', /.+/);
  await expect(page.locator('.design-runtime-gate')).toHaveCount(0);
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('[data-codex-design-asset]')).toHaveCount(0);
});

test('hybrid: a loaded adapter that does not start falls back to Original within the watchdog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/js/design-hybrid.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* intentional no-op */' })
  );
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'pending');
  await expect(page.locator('.design-runtime-gate')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback', { timeout: 6000 });
  await expect(page.locator('.design-runtime-gate')).toHaveCount(0);
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('[data-design-home="hybrid"]')).toHaveCount(0);
});

test('hybrid: an adapter arriving after watchdog fallback cannot reactivate the presentation', async ({ page }) => {
  const inlineCase = requireFixture(
    INLINE_CASE,
    'skipped: no visible case has an inline note with tall media'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseAdapter;
  const adapterGate = new Promise((resolve) => {
    releaseAdapter = resolve;
  });
  await page.route('**/js/design-hybrid.js', async (route) => {
    await adapterGate;
    await route.continue();
  });

  await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${inlineCase.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-loading'));
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'pending');
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback', { timeout: 6000 });

  const lateAdapterResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/js/design-hybrid.js')
  );
  releaseAdapter();
  await lateAdapterResponse;
  await page.waitForTimeout(100);

  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback');
  await expect(page.locator('html')).not.toHaveAttribute('data-design-surface', /.+/);
  await expect(page.locator('body')).not.toHaveClass(/chamber-page-|specimen-/);
  await expect(page.locator('.case-row--wide-text, .case-item--inline-stage, .case-text--overlay')).toHaveCount(0);
  const fallbackTallText = page.locator('.case-row--tall-text');
  await expect(fallbackTallText).toHaveCount(1);
  await expect(fallbackTallText.locator(':scope > .case-item')).toHaveCount(2);
});

test('hybrid: Free Assets fail-open restores Original near-viewport 3D previews', async ({ page }) => {
  const modelAsset = requireFixture(
    VISIBLE_MODEL_FA,
    'skipped: no visible Free Assets item has a local 3D preview model'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1024 });
  let releaseAdapter;
  const adapterGate = new Promise((resolve) => {
    releaseAdapter = resolve;
  });
  await page.route('**/js/design-hybrid.js', async (route) => {
    await adapterGate;
    await route.abort();
  });

  await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'pending');
  await page.waitForFunction(() => document.querySelectorAll('#fa-grid .fa-card').length > 0);

  // Кликать по категории нельзя: перерендер грида в pending-состоянии — не
  // сценарий этого теста (он проверяет подавление превью ДО фолбэка). Модельный
  // ассет обязан быть в дефолтной (первой видимой) категории — иначе skip.
  const defaultTag = await page.evaluate(() => {
    const card = document.querySelector('.tag-card[data-tag]');
    return card ? card.getAttribute('data-tag') : null;
  });
  test.skip(
    modelAsset.category.key !== defaultTag,
    'skipped: the default Free Assets category has no local 3D preview model'
  );
  // У .fa-card нет data-id — якоримся на уникальный alt model-viewer'а
  // (createPreviewThumb: `${title} — 3D preview`).
  const preview = page.locator(
    `#fa-grid model-viewer.fa-card__thumb-mv[alt="${modelAsset.item.title} — 3D preview"]`
  );
  await expect(preview).toHaveCount(1);
  await expect(page.locator('.fa-card__thumb-mv[data-codex-preview-enabled="true"]')).toHaveCount(0);
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(0);

  const viewerRequest = page.waitForRequest((request) => request.url().endsWith('/js/vendor/model-viewer.min.js'));
  releaseAdapter();
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-state', 'fallback');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-codex-preview-enabled', 'true');
  await viewerRequest;
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(1);
  await expect(page.locator('.layout')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('html')).not.toHaveAttribute('data-design-surface', /.+/);
  await expect(page.locator('body')).not.toHaveClass(/chamber-page-assets|specimen-fa-page/);
});

test('hybrid: Free Assets keeps Original 3D previews when the optional loader is unavailable', async ({ page }) => {
  const modelAsset = requireFixture(
    VISIBLE_MODEL_FA,
    'skipped: no visible Free Assets item has a local 3D preview model'
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.route('**/js/design-loader.js', (route) => route.abort());

  await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#fa-grid .fa-card').length > 0);
  await expect(page.locator('html')).not.toHaveAttribute('data-design-runtime-state', /.+/);

  await page.locator(`.tag-card[data-tag="${modelAsset.category.key}"]`).click();
  // У .fa-card нет data-id — якоримся на уникальный alt model-viewer'а
  // (createPreviewThumb: `${title} — 3D preview`).
  const preview = page.locator(
    `#fa-grid model-viewer.fa-card__thumb-mv[alt="${modelAsset.item.title} — 3D preview"]`
  );
  await expect(preview).toHaveCount(1);
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-codex-preview-enabled', 'true');
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(1);
  await expect(page.locator('html')).not.toHaveAttribute('data-design-surface', /.+/);
  await expect(page.locator('body')).not.toHaveClass(/chamber-page-assets|specimen-fa-page/);
});

test('hybrid: slow base bootstrap does not consume the optional-runtime watchdog', async ({ page }) => {
  let releaseBaseRuntime;
  const baseRuntimeGate = new Promise((resolve) => {
    releaseBaseRuntime = resolve;
  });
  await page.route('**/js/i18n-data.js', async (route) => {
    await baseRuntimeGate;
    await route.continue();
  });
  // Окно «watchdog ещё не выстрелил» меряем часами СТРАНИЦЫ, а не раннера:
  // под CPU-контеншном параллельных воркеров wall-clock ожидание теста
  // уезжает за прелоадер-failsafe + 4000мс и даёт ложный fallback.
  await page.addInitScript(() => {
    window.__designStates = [];
    // Init-скрипт исполняется до парсинга — documentElement ещё нет, поэтому
    // наблюдаем document с subtree: ловим атрибут на корне, когда он появится.
    new MutationObserver(() => {
      const root = document.documentElement;
      if (!root) return;
      window.__designStates.push({
        state: root.getAttribute('data-design-runtime-state'),
        at: performance.now()
      });
    }).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-design-runtime-state']
    });
  });

  const navigation = page.goto(`${server.base}/index.html?design=hybrid&lang=en`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-design-runtime-state') === 'pending',
    null,
    { timeout: 15000 }
  );
  await page.waitForFunction(
    () => {
      const pending = window.__designStates.find((entry) => entry.state === 'pending');
      if (!pending) return false;
      const fallback = window.__designStates.find((entry) => entry.state === 'fallback');
      return Boolean(fallback) || performance.now() - pending.at >= 4300;
    },
    null,
    { timeout: 15000 }
  );
  const timeline = await page.evaluate(() => window.__designStates);
  const pendingAt = timeline.find((entry) => entry.state === 'pending').at;
  const fallbackEntry = timeline.find((entry) => entry.state === 'fallback');
  // Контракт: пока базовый рантайм грузится, watchdog не расходуется — fallback
  // не имеет права наступить раньше 4300мс от pending (по часам страницы).
  if (fallbackEntry) {
    expect(fallbackEntry.at - pendingAt).toBeGreaterThanOrEqual(4300);
  }

  releaseBaseRuntime();
  await navigation;
  await page.unroute('**/js/i18n-data.js');
  // Оба исхода законны, и снимок timeline выше не может их различить надёжно:
  // watchdog срабатывает ровно на границе измеряемого окна, поэтому fallback
  // может наступить уже ПОСЛЕ снятия снимка. Ждём, пока состояние осядет, и
  // проверяем контракт по финальному timeline, а не по промежуточному.
  await page.waitForFunction(
    () => {
      const state = document.documentElement.getAttribute('data-design-runtime-state');
      return state === 'ready' || state === 'fallback';
    },
    null,
    { timeout: 20000 }
  );
  const finalState = await page.locator('html').getAttribute('data-design-runtime-state');
  if (finalState === 'fallback') {
    // hybrid из fallback не поднимается by design; fail-open покрыт соседними
    // тестами. Контракт watchdog'а проверяем по финальному timeline.
    const finalTimeline = await page.evaluate(() => window.__designStates);
    const finalFallback = finalTimeline.find((entry) => entry.state === 'fallback');
    expect(finalFallback.at - pendingAt).toBeGreaterThanOrEqual(4300);
  } else {
    await waitForHybridHome(page, 20000);
  }
});

test('hybrid: waits for both stylesheets before starting its ordered runtimes', async ({ page }) => {
  let releaseStyles;
  const styleGate = new Promise((resolve) => {
    releaseStyles = resolve;
  });
  const runtimeRequests = [];
  page.on('request', (request) => {
    if (/\/js\/design-(?:chamber|hybrid)\.js(?:\?|$)/.test(request.url())) {
      runtimeRequests.push(new URL(request.url()).pathname);
    }
  });
  await page.route('**/css/design-hybrid.css', async (route) => {
    await styleGate;
    await route.continue();
  });

  const navigation = page.goto(`${server.base}/index.html?design=hybrid&lang=en`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForFunction(() => document.documentElement.getAttribute('data-design-runtime-state') === 'pending');
  await page.waitForTimeout(150);
  expect(runtimeRequests).toEqual([]);

  releaseStyles();
  await navigation;
  await page.unroute('**/css/design-hybrid.css');
  await waitForHybridHome(page);
  expect(runtimeRequests).toEqual(['/js/design-chamber.js', '/js/design-hybrid.js']);
});

test('hybrid: immediate View Case follows the requested project before motion settles', async ({ page }) => {
  const nextCase = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for an image transition');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  await page.evaluate(() => {
    document.querySelectorAll('.chamber-home__pager-button')[1].click();
    document.querySelector('.chamber-home__view').click();
  });

  await expect.poll(() => new URL(page.url()).hash).toBe(`#${nextCase.id}`);
  await expect(page.locator('html')).toHaveAttribute('data-design-surface', 'case');
  await expect(page.locator('#case-title')).toHaveText(
    await page.locator(`.work-card[data-id="${nextCase.id}"] .work-card__title`).textContent()
  );
});

test('hybrid: a newer crossfade request retains CTA ownership through the stale visual commit', async ({ page }) => {
  const second = requireFixture(SECOND_CASE, 'skipped: fewer than 3 visible cases for stale crossfade');
  const third = requireFixture(THIRD_CASE, 'skipped: fewer than 3 visible cases for stale crossfade');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  await page.evaluate(() => {
    const home = document.querySelector('[data-design-home="hybrid"]');
    const next = document.querySelectorAll('.chamber-home__pager-button')[1];
    new MutationObserver((records, observer) => {
      if (
        records.some((record) => record.attributeName === 'data-transition-state') &&
        home.getAttribute('data-transition-state') === 'crossfade'
      ) {
        observer.disconnect();
        next.click();
      }
    }).observe(home, { attributes: true, attributeFilter: ['data-transition-state'] });
    next.click();
  });

  const home = page.locator('[data-design-home="hybrid"]');
  await expect(home).toHaveAttribute('data-requested-project', third.id);
  await expect(home).toHaveAttribute('data-active-project', second.id);
  await expect(page.locator('.chamber-home__view')).toHaveAttribute('href', `#${third.id}`);
  await expect(page.locator('.chamber-home__counter')).toHaveText(
    `${String(VISIBLE_CASES.indexOf(third) + 1).padStart(2, '0')} / ${String(VISIBLE_CASES.length).padStart(2, '0')}`
  );
  await page.locator('.chamber-home__view').click();
  await expect.poll(() => new URL(page.url()).hash).toBe(`#${third.id}`);
  await expect(page.locator('#case-title')).toHaveText(
    await page.locator(`.work-card[data-id="${third.id}"] .work-card__title`).textContent()
  );
});

test('hybrid: Home opens every Hybrid Case dossier and Back and share preserve the opt-in query', async ({ page }) => {
  const nextCase = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for Home navigation');
  const errors = collectConsoleErrors(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(server.base).origin
  });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=ru&utm_source=qa&token=secret`, {
    waitUntil: 'networkidle'
  });
  await waitForHybridHome(page);

  const home = page.locator('[data-design-home="hybrid"]');
  const next = page.locator('.chamber-home__pager-button').last();
  await next.click();
  await expect(home).toHaveAttribute('data-active-project', nextCase.id);
  await expect
    .poll(async () => {
      const title = await page.locator('.chamber-home__title').textContent();
      const card = await page.locator(`.work-card[data-id="${nextCase.id}"] .work-card__title`).textContent();
      return `${(title || '').trim()}|${(card || '').trim()}`;
    })
    .toMatch(/^(.+)\|\1$/);
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(home).toHaveAttribute('data-requested-project', nextCase.id);
  await expect(home).toHaveAttribute('data-active-project', nextCase.id);
  // Обе стороны читаются заново на каждой попытке: заголовок Hybrid-главной и
  // карточка обновляются разными подписчиками i18n:changed, и захват ожидаемого
  // значения ОДИН раз делал ассерт гонкой (проявилось, когда у кейса появились
  // реально разные EN/RU-заголовки — до этого сравнение было пустым).
  await expect
    .poll(async () => {
      const title = await page.locator('.chamber-home__title').textContent();
      const card = await page.locator(`.work-card[data-id="${nextCase.id}"] .work-card__title`).textContent();
      return `${(title || '').trim()}|${(card || '').trim()}`;
    })
    .toMatch(/^(.+)\|\1$/);
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(home).toHaveAttribute('data-active-project', nextCase.id);

  const inventory = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.work-card[data-id]:not(.tag-card)')).map((card) => ({
      id: card.getAttribute('data-id'),
      title: card.querySelector('.work-card__title').textContent.trim(),
      description: card.querySelector('.work-card__desc').textContent.trim()
    }))
  );
  expect(inventory.map((project) => project.id)).toEqual(VISIBLE_CASES.map((project) => project.id));

  for (const [index, project] of inventory.entries()) {
    const contentProject = CASE_BY_ID.get(project.id);
    const projectLink = home.locator(`[data-design-project="${project.id}"]`);
    await projectLink.click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${project.id}`);
    await waitForHybridCase(page, project.id);
    await expect(home).toBeHidden();
    await expect(page.locator('#case-view')).toBeVisible();
    await expect(page.locator('#case-view')).toHaveAttribute('data-hybrid-case-ready', project.id);
    await expect(page.locator('#case-title')).toHaveText(project.title);
    await expect(page.locator('#case-title')).toBeFocused();
    await expect(page.locator('.hybrid-case-dossier')).toBeVisible();
    await expect(page.locator('.hybrid-case-dossier__description')).toHaveText(project.description);
    await expect(page.locator('.hybrid-case-dossier__facts dt')).toHaveCount(2);
    await expect(page.locator('.hybrid-case-dossier__facts dd')).toHaveCount(2);
    await expect(page.locator('.hybrid-case-dossier__back')).toBeVisible();
    const caseAnatomy = await page.locator('#case-view').evaluate((caseView) => {
      const track = caseView.querySelector('#case-scroll-track');
      const hero = track && track.querySelector('.hybrid-case-hero');
      const mediaRows = track
        ? Array.from(track.querySelectorAll(':scope > .case-row')).filter((row) =>
            row.querySelector('.case-item__media')
          )
        : [];
      const inlineOverlays = track
        ? Array.from(track.querySelectorAll(':scope > .case-row--wide-text .case-text--overlay'))
        : [];
      return {
        heroCount: track ? track.querySelectorAll('.hybrid-case-hero').length : 0,
        heroIsFirstMedia: Boolean(hero && hero === mediaRows[0]),
        heroOrder: hero ? getComputedStyle(hero).order : null,
        mediaCount: track ? track.querySelectorAll('.case-item__media').length : 0,
        inlineOverlayCount: inlineOverlays.length,
        inlineOverlaysFit: inlineOverlays.every((note) => {
          const media = note.parentElement && note.parentElement.querySelector(':scope > .case-item__media');
          if (!media) return false;
          const noteRect = note.getBoundingClientRect();
          const mediaRect = media.getBoundingClientRect();
          return noteRect.top >= mediaRect.top - 1 && noteRect.right <= mediaRect.right + 1 &&
            noteRect.bottom <= mediaRect.bottom + 1 && noteRect.left >= mediaRect.left - 1;
        }),
        populatedFacts: Array.from(caseView.querySelectorAll('.hybrid-case-dossier__facts dd')).every(
          (fact) => fact.textContent.trim().length > 0
        )
      };
    });
    expect(caseAnatomy).toEqual({
      heroCount: 1,
      heroIsFirstMedia: true,
      heroOrder: '-1',
      mediaCount: contentProject.case.media.length,
      inlineOverlayCount:
        contentProject.case.inline && contentProject.case.media.some((media) => media?.format === 'tall') ? 1 : 0,
      inlineOverlaysFit: true,
      populatedFacts: true
    });
    await expect(page.locator('.chamber-case-back, .chamber-case-poster, .specimen-case-hero')).toHaveCount(0);

    if (index === 0) {
      await expect(page.locator('#case-tab-2d')).toBeVisible();
      await expect(page.locator('#case-tab-3d')).toBeVisible();
      await expect(page.locator('#case-tab-bp')).toBeVisible();
      await page.locator('#case-share-desktop').click();
      const copiedUrl = new URL(await page.evaluate(() => navigator.clipboard.readText()));
      expect(copiedUrl.searchParams.get('design')).toBe('hybrid');
      expect(copiedUrl.searchParams.get('lang')).toBe('ru');
      expect(Array.from(copiedUrl.searchParams.keys()).sort()).toEqual(['design', 'lang']);
      expect(copiedUrl.hash).toBe(`#${project.id}`);

      const modifiedLogo = await page.locator('#logo-home').evaluate((link) => {
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          ctrlKey: true
        });
        return { allowed: link.dispatchEvent(event), href: link.href };
      });
      expect(modifiedLogo.allowed).toBe(true);
      expect(new URL(modifiedLogo.href).searchParams.get('design')).toBe('hybrid');
      expect(new URL(page.url()).hash).toBe(`#${project.id}`);
    }

    const backControls = page.locator('[data-design-back]:visible');
    expect(await backControls.count()).toBeGreaterThan(0);
    await backControls.first().click();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    expect(new URL(page.url()).searchParams.get('design')).toBe('hybrid');
    expect(new URL(page.url()).searchParams.get('lang')).toBe('ru');
    expect(new URL(page.url()).searchParams.get('utm_source')).toBe('qa');
    expect(new URL(page.url()).searchParams.get('token')).toBe('secret');
    await expect(page.locator('html')).toHaveAttribute('data-design-surface', 'home');
    await expect(page.locator('html')).toHaveClass(/design-chamber-home/);
    await expect(home).toBeVisible();
    await expect(page.locator('.chamber-home__title')).toBeFocused();
  }
  expect(internalConsoleErrors(errors)).toEqual([]);
});

test('hybrid: Case media modes tear down before returning to Home', async ({ page }) => {
  const modelCase = requireFixture(THREE_D_CASE, 'skipped: no visible case has a 3D model');
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  const home = page.locator('[data-design-home="hybrid"]');
  const projectLink = home.locator(`[data-design-project="${modelCase.id}"]`).first();
  await projectLink.click();
  await waitForHybridCase(page, modelCase.id);

  await page.locator('#case-tab-bp').click();
  await expect(page.locator('#case-tab-bp')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#case-blueprints')).toBeVisible();
  await expect(page.locator('#case-scroll')).toBeHidden();

  await page.locator('#case-tab-2d').click();
  await expect(page.locator('#case-tab-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#case-scroll')).toBeVisible();
  await expect(page.locator('#case-blueprints')).toBeHidden();

  await page.locator('#case-tab-3d').click();
  await expect(page.locator('#case-tab-3d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#case-3d canvas, #case-3d model-viewer')).toHaveCount(1, { timeout: 15_000 });

  const backControl = page.locator('[data-design-back]:visible').first();
  await backControl.click();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await expect(home).toBeVisible();
  await expect(page.locator('#case-tab-2d')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#case-3d')).toBeHidden();
  await expect(page.locator('#case-3d model-viewer, #case-3d canvas')).toHaveCount(0);
  await expect(page.locator('.media-fs')).toBeHidden();
  await expect(page.locator('.media-fs__stage > *')).toHaveCount(0);
  await expect(page.locator('.chamber-home__title')).toBeFocused();
  expect(internalConsoleErrors(errors)).toEqual([]);
});

for (const exit of [
  { label: 'Project Index', selector: '.hybrid-case-dossier__back' },
  { label: 'logo', selector: '#logo-home' }
]) {
  test(`hybrid: ${exit.label} Case exit restores the Home header controls`, async ({ page }) => {
    const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
    await waitForHybridHome(page);

    const baseline = await page.evaluate(() => {
      const header = document.querySelector('.header-top').getBoundingClientRect();
      const controls = document.querySelector('.header-top__controls').getBoundingClientRect();
      return {
        headerRight: header.right,
        controlsLeft: controls.left,
        controlsRight: controls.right
      };
    });

    await page.locator('.chamber-home__view').click();
    await waitForHybridCase(page, primary.id);
    await expect(page.locator('.hybrid-case-file')).toBeVisible();
    await page.locator(exit.selector).click();
    await waitForHybridHome(page);

    await expect.poll(() => new URL(page.url()).hash).toBe('');
    await expect(page.locator('#contact-btn')).toBeVisible();
    await expect(page.locator('#lang-toggle')).toBeVisible();
    await expect(page.locator('.hybrid-case-file')).toHaveCount(1);
    const state = await page.evaluate(() => {
      const header = document.querySelector('.header-top').getBoundingClientRect();
      const controls = document.querySelector('.header-top__controls').getBoundingClientRect();
      const contact = document.getElementById('contact-btn').getBoundingClientRect();
      const language = document.getElementById('lang-toggle').getBoundingClientRect();
      const caseFile = document.querySelector('.hybrid-case-file');
      const caseFileRect = caseFile.getBoundingClientRect();
      return {
        headerRight: header.right,
        controlsLeft: controls.left,
        controlsRight: controls.right,
        contactRight: contact.right,
        languageLeft: language.left,
        languageRight: language.right,
        caseFileDisplay: getComputedStyle(caseFile).display,
        caseFileWidth: caseFileRect.width,
        caseFileHeight: caseFileRect.height
      };
    });
    expect(state.caseFileDisplay).toBe('none');
    expect(state.caseFileWidth).toBe(0);
    expect(state.caseFileHeight).toBe(0);
    expect(Math.abs(state.controlsLeft - baseline.controlsLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.controlsRight - baseline.controlsRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.headerRight - baseline.headerRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.controlsRight - state.headerRight)).toBeLessThanOrEqual(1);
    expect(state.contactRight).toBeLessThanOrEqual(state.languageLeft);
    expect(Math.abs(state.languageRight - state.controlsRight)).toBeLessThanOrEqual(1);
  });
}

test('hybrid: Free Assets filter panel stays opaque above category cards', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 1024 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
    await waitForHybridFreeAssets(page);

    await page.locator('#tags-dropdown-trigger').click();
    await expect(page.locator('#tags-dropdown-trigger')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tags-dropdown')).toHaveAttribute('data-open', 'true');
    await expect(page.locator('#tags-dropdown-panel')).toBeVisible();
    const layer = await page.locator('#tags-dropdown-panel').evaluate((panel) => {
      const style = getComputedStyle(panel);
      const channels = style.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
      const alpha = channels.length === 4 ? channels[3] : channels.length === 3 ? 1 : 0;
      const panelRect = panel.getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll('.tag-card')).filter((card) => {
        const cardRect = card.getBoundingClientRect();
        return cardRect.width > 0 && cardRect.height > 0;
      });
      const overlap = cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const left = Math.max(panelRect.left, cardRect.left);
        const top = Math.max(panelRect.top, cardRect.top);
        const right = Math.min(panelRect.right, cardRect.right);
        const bottom = Math.min(panelRect.bottom, cardRect.bottom);
        return { left, top, right, bottom, area: Math.max(0, right - left) * Math.max(0, bottom - top) };
      }).sort((a, b) => b.area - a.area)[0];
      const paintedNode = overlap && overlap.area > 0
        ? document.elementFromPoint((overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2)
        : null;
      return {
        alpha,
        overlapsCard: Boolean(overlap && overlap.area > 0),
        panelOwnsOverlap: Boolean(paintedNode && (paintedNode === panel || panel.contains(paintedNode))),
        insideViewport: panelRect.left >= 0 && panelRect.top >= 0 &&
          panelRect.right <= window.innerWidth && panelRect.bottom <= window.innerHeight
      };
    });
    expect(layer.alpha).toBe(1);
    expect(layer.overlapsCard).toBe(true);
    expect(layer.panelOwnsOverlap).toBe(true);
    expect(layer.insideViewport).toBe(true);
  }
});

test('hybrid: Free Assets uses the Black Chamber shell, equal cards, and poster-first previews', async ({ page }) => {
  const category = requireFixture(
    SHOWCASE_FA_CATEGORY,
    'skipped: no visible non-game Free Assets category has the 3 items needed for the responsive grid'
  );
  const modelArchive = requireFixture(
    MODEL_ARCHIVE_FA,
    'skipped: no visible Free Assets item has both an archive and a 3D preview'
  );
  const errors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridFreeAssets(page);

  await expect(page.locator('html')).toHaveAttribute('data-design', 'hybrid');
  await expect(page.locator('html')).toHaveAttribute('data-design-surface', 'free-assets');
  await expect(page.locator('html')).not.toHaveClass(/design-chamber-home/);
  await expect(page.locator('body')).toHaveClass(/chamber-page-assets/);
  await expect(page.locator('body')).not.toHaveClass(/specimen-fa-page/);
  await expect(page.locator(`a.tag-card[data-tag="${category.key}"]`)).toBeVisible();
  await page.locator(`a.tag-card[data-tag="${category.key}"]`).click();
  await expect(page.locator('#fa-view')).toBeVisible();
  await expect(page.locator('#logo-back-portfolio')).toHaveAttribute('href', /design=hybrid/);
  await expect(page.locator('#fa-grid .fa-card').first()).toHaveAttribute('data-chamber-index', '01');
  expect(
    await page
      .locator('#fa-grid .fa-card')
      .evaluateAll((cards) =>
        cards.every((card, index) => card.dataset.chamberIndex === String(index + 1).padStart(2, '0'))
      )
  ).toBe(true);
  await expect(page.locator('.fa-card__thumb-mv[data-codex-preview-enabled="true"]')).toHaveCount(0);
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(0);

  const assets = await page.evaluate(() => ({
    css: Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]')).map(
      (asset) => new URL(asset.href).pathname
    ),
    js: Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]')).map(
      (asset) => new URL(asset.src).pathname
    )
  }));
  expect(assets.css).toEqual(['/css/design-chamber.css', '/css/design-hybrid.css']);
  expect(assets.js).toEqual(['/js/design-chamber.js', '/js/design-hybrid.js']);

  await page.locator('#game-switch-label').click();
  await expect(page.locator('#game-switch')).toBeChecked();
  await expect(page.locator('#fa-grid .fa-grid__empty')).toBeVisible();
  await page.locator('#game-switch-label').click();
  await expect(page.locator('#game-switch')).not.toBeChecked();
  await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(category.items.length);

  const englishDescription = await page.locator('#fa-grid .fa-card').first().locator('.fa-card__desc').textContent();
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#fa-grid .fa-card').first().locator('.fa-card__desc')).not.toHaveText(
    englishDescription.trim()
  );
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const geometryFixtures = [
    { width: 1440, height: 1024, columns: 3 },
    { width: 1024, height: 768, columns: 2 },
    { width: 768, height: 1024, columns: 2 },
    { width: 390, height: 844, columns: 1 }
  ];
  for (const fixture of geometryFixtures) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    await page.waitForFunction((expectedColumns) => {
      const grid = document.getElementById('fa-grid');
      return grid && getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length === expectedColumns;
    }, fixture.columns);
    const geometry = await page.locator('#fa-grid').evaluate((grid) => {
      const cards = Array.from(grid.querySelectorAll('.fa-card')).filter((card) => {
        const style = getComputedStyle(card);
        return !card.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      });
      const widths = cards.map((card) => card.getBoundingClientRect().width);
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        cardCount: cards.length,
        featuredSpans: cards.filter((card) => getComputedStyle(card).gridColumnEnd !== 'auto').length,
        widthDelta: widths.length ? Math.max(...widths) - Math.min(...widths) : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    expect(geometry.columns).toBe(fixture.columns);
    expect(geometry.cardCount).toBeGreaterThanOrEqual(fixture.columns);
    expect(geometry.featuredSpans).toBe(0);
    expect(geometry.widthDelta).not.toBeNull();
    expect(geometry.widthDelta).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }

  await page.locator(`a.tag-card[data-tag="${modelArchive.category.key}"]`).click();
  // У .fa-card нет data-id — карточка находится по data-file её download-кнопки.
  const modelPreviewCard = page
    .locator('#fa-grid .fa-card')
    .filter({ has: page.locator(`.fa-card__download[data-file="${modelArchive.item.file}"]`) });
  await expect(modelPreviewCard.locator('.fa-card__thumb-mv')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await modelPreviewCard.locator('.fa-card__download').click();
  expect((await download).suggestedFilename()).toBe(modelArchive.item.file);
  const previewButton = modelPreviewCard.locator('.fa-card__preview-btn');
  await page.keyboard.press('Tab');
  await previewButton.focus();
  await expect(previewButton).toBeFocused();
  const previewFocus = await previewButton.evaluate((button) => {
    const style = getComputedStyle(button);
    return {
      visible: button.matches(':focus-visible'),
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset)
    };
  });
  expect(previewFocus.visible).toBe(true);
  expect(previewFocus.width).toBeGreaterThanOrEqual(2);
  expect(previewFocus.offset).toBeLessThan(0);
  const viewerRequest = page.waitForRequest((request) => request.url().endsWith('/js/vendor/model-viewer.min.js'));
  await previewButton.click();
  await viewerRequest;
  await expect(modelPreviewCard.locator('.fa-card__thumb-mv')).toHaveAttribute('data-codex-preview-enabled', 'true');
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(1);
  await expect(page.locator('.media-fs')).toBeVisible();
  const closeButton = page.locator('.media-fs__close');
  const closeTarget = await closeButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(closeTarget.width).toBeGreaterThanOrEqual(44);
  expect(closeTarget.height).toBeGreaterThanOrEqual(44);
  await closeButton.click();
  await expect(page.locator('.media-fs')).toBeHidden();
  await expect(page.locator('.media-fs__stage')).toBeEmpty();
  await expect(previewButton).toBeFocused();
  expect(internalConsoleErrors(errors)).toEqual([]);
});

test('hybrid: approved Home safe insets and mobile controls stay frozen', async ({ page }) => {
  const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
  const desktopFixtures = [
    { width: 1440, height: 1024, inset: 48 },
    { width: 1600, height: 1050, inset: 64 }
  ];

  for (const fixture of desktopFixtures) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
    await waitForHybridHome(page);
    const gaps = await page.evaluate(() => {
      const media = document.querySelector('.chamber-home__media').getBoundingClientRect();
      const content = document.querySelector('.chamber-home__content').getBoundingClientRect();
      const pager = document.querySelector('.chamber-home__pager').getBoundingClientRect();
      return {
        contentLeft: content.left - media.left,
        contentBottom: media.bottom - content.bottom,
        pagerRight: media.right - pager.right,
        pagerBottom: media.bottom - pager.bottom
      };
    });
    for (const value of Object.values(gaps)) expect(Math.abs(value - fixture.inset)).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);
  const mobileInset = await page.evaluate(() => {
    const media = document.querySelector('.chamber-home__media').getBoundingClientRect();
    return ['.chamber-home__meta', '.chamber-home__title', '.chamber-home__description'].map(
      (selector) => document.querySelector(selector).getBoundingClientRect().left - media.left
    );
  });
  expect(mobileInset).toHaveLength(3);
  mobileInset.forEach((value) => expect(Math.abs(value - 24)).toBeLessThanOrEqual(1));

  const homeTargets = await page
    .locator(
      '.site-header a:visible, .site-header button:visible, [data-design-home] a:visible, [data-design-home] button:visible'
    )
    .evaluateAll((controls) =>
      controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    );
  expect(homeTargets.length).toBeGreaterThan(0);
  expect(homeTargets.filter((size) => Math.round(size.width) < 44 || Math.round(size.height) < 44)).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ).toBeLessThanOrEqual(1);

  await page.locator(`[data-design-project="${primary.id}"]`).click();
  await waitForHybridCase(page, primary.id);
  await expect(page.locator('body')).toHaveClass(/cards-collapsed/);
  await expect(page.locator('[data-design-back]:visible').first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ).toBeLessThanOrEqual(1);
});

test('hybrid: Case keeps frozen narrative padding and compact mobile dossier geometry', async ({ page }) => {
  const modelCase = requireFixture(THREE_D_CASE, 'skipped: no visible case has a 3D model');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const desktopFixtures = [
    { width: 1440, height: 1024, narrativePadding: 48 },
    { width: 1600, height: 1050, narrativePadding: 64 }
  ];

  for (const fixture of desktopFixtures) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    // Промежуточный about:blank: goto на идентичный URL с hash — это
    // same-document навигация, и вторая итерация мерила бы макет с JS-геометрией
    // предыдущего вьюпорта. Контракт фикстур — свежая загрузка на каждом размере.
    await page.goto('about:blank');
    await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${modelCase.id}`, {
      waitUntil: 'networkidle'
    });
    await waitForHybridCase(page, modelCase.id);
    const geometry = await page.locator('#case-view').evaluate((caseView) => {
      const header = caseView.querySelector('.case-view__header').getBoundingClientRect();
      const scroll = caseView.querySelector('.case-scroll').getBoundingClientRect();
      // Не оверлей inline-stage (.case-text--overlay), а нарративный блок:
      // порядок рядов seeded-раскладки зависит от кейса.
      const narrative = caseView.querySelector('.case-text:not(.case-text--overlay)');
      return {
        narrativePadding: Number.parseFloat(getComputedStyle(narrative).paddingLeft),
        horizontalGap: header.left - scroll.right,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    expect(Math.abs(geometry.narrativePadding - fixture.narrativePadding)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.horizontalGap)).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('about:blank');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${modelCase.id}`, { waitUntil: 'networkidle' });
  await waitForHybridCase(page, modelCase.id);
  const mobileGeometry = await page.locator('#case-view').evaluate((caseView) => {
    const header = caseView.querySelector('.case-view__header').getBoundingClientRect();
    const scroll = caseView.querySelector('.case-scroll').getBoundingClientRect();
    const narrative = caseView.querySelector('.case-text');
    return {
      dossierHeight: header.height,
      narrativePadding: Number.parseFloat(getComputedStyle(narrative).paddingLeft),
      verticalGap: scroll.top - header.bottom,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(Math.abs(mobileGeometry.dossierHeight - 304)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileGeometry.narrativePadding - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileGeometry.verticalGap)).toBeLessThanOrEqual(1);
  expect(mobileGeometry.overflow).toBeLessThanOrEqual(1);

  const caseTargets = await page
    .locator('.site-header a, .site-header button, .case-view__header button')
    .evaluateAll((controls) =>
      controls
        .map((control) => {
          const rect = control.getBoundingClientRect();
          return {
            target: `${control.tagName.toLowerCase()}#${control.id}.${control.className}`,
            width: rect.width,
            height: rect.height
          };
        })
        .filter((size) => size.width > 0 && size.height > 0)
    );
  expect(caseTargets.length).toBeGreaterThan(0);
  expect(caseTargets.filter((size) => Math.round(size.width) < 44 || Math.round(size.height) < 44)).toEqual([]);
});

test('hybrid: Case inline notes share one wide desktop stage and keep mobile flow', async ({ page }) => {
  const inlineCase = requireFixture(
    INLINE_CASE,
    'skipped: no visible case pairs an inline note with a captioned tall block'
  );
  const tallMediaPaths = inlineCase.case.media
    .filter((media) => media?.format === 'tall' && media.src && media.caption?.label?.en)
    .map((media) => assetPath(media.src));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of [
    { width: 1440, height: 1024 },
    { width: 1600, height: 1050 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${inlineCase.id}`, { waitUntil: 'networkidle' });
    await waitForHybridCase(page, inlineCase.id);

    const geometry = await page.locator('.case-row--wide-text').evaluate((row) => {
      const item = row.querySelector(':scope > .case-item--inline-stage');
      const media = item.querySelector(':scope > .case-item__media');
      const caption = item.querySelector(':scope > .case-item__caption');
      const note = item.querySelector(':scope > .case-text--overlay');
      const image = media.querySelector('.case-item__img');
      // Подписи блоков стали необязательными: без узла подписи мерить нечего,
      // и молчаливый TypeError внутри evaluate прятал бы причину падения.
      if (!caption) throw new Error('inline-stage fixture must carry a caption block (case.media caption is empty)');
      const rowRect = row.getBoundingClientRect();
      const mediaRect = media.getBoundingClientRect();
      const captionRect = caption.getBoundingClientRect();
      const noteRect = note.getBoundingClientRect();
      return {
        mediaLeftGap: mediaRect.left - rowRect.left,
        mediaRightGap: rowRect.right - mediaRect.right,
        noteRightGap: mediaRect.right - noteRect.right,
        noteBottomGap: mediaRect.bottom - noteRect.bottom,
        noteWidth: noteRect.width,
        noteHeight: noteRect.height,
        noteOverflow: note.scrollHeight - note.clientHeight,
        captionGap: captionRect.top - mediaRect.bottom,
        itemCount: row.querySelectorAll('.case-item').length,
        imageSrc: image.getAttribute('src'),
        noteTitle: note.querySelector('.case-text__title').textContent.trim(),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    expect(Math.abs(geometry.mediaLeftGap)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.mediaRightGap)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.noteRightGap - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.noteBottomGap - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.noteWidth - 320)).toBeLessThanOrEqual(1);
    expect(geometry.noteHeight).toBeGreaterThanOrEqual(205);
    expect(geometry.noteOverflow).toBeLessThanOrEqual(1);
    expect(geometry.captionGap).toBeGreaterThanOrEqual(-1);
    expect(geometry.itemCount).toBe(1);
    expect(tallMediaPaths.some((path) => assetPath(geometry.imageSrc).endsWith(path))).toBe(true);
    expect(geometry.noteTitle).toBe(inlineCase.case.inline.title.en);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=ru#${inlineCase.id}`, { waitUntil: 'networkidle' });
  await waitForHybridCase(page, inlineCase.id);
  const mobile = await page.locator('.case-row--wide-text').evaluate((row) => {
    const item = row.querySelector(':scope > .case-item--inline-stage');
    const media = item.querySelector(':scope > .case-item__media');
    const caption = item.querySelector(':scope > .case-item__caption');
    const note = item.querySelector(':scope > .case-text--overlay');
    if (!caption) throw new Error('inline-stage fixture must carry a caption block (case.media caption is empty)');
    const rowRect = row.getBoundingClientRect();
    const noteRect = note.getBoundingClientRect();
    const captionRect = caption.getBoundingClientRect();
    return {
      itemDisplay: getComputedStyle(item).display,
      notePosition: getComputedStyle(note).position,
      notePadding: Number.parseFloat(getComputedStyle(note).paddingLeft),
      noteWidthGap: rowRect.width - noteRect.width,
      noteFlowGap: noteRect.top - captionRect.bottom,
      noteOverflow: note.scrollHeight - note.clientHeight,
      mediaBeforeNote: Boolean(media.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(mobile.itemDisplay).toBe('block');
  expect(mobile.notePosition).toBe('static');
  expect(Math.abs(mobile.notePadding - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobile.noteWidthGap)).toBeLessThanOrEqual(1);
  expect(mobile.noteFlowGap).toBeGreaterThanOrEqual(15);
  expect(mobile.noteOverflow).toBeLessThanOrEqual(1);
  expect(mobile.mediaBeforeNote).toBe(true);
  expect(mobile.overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/index.html?design=original&lang=en#${inlineCase.id}`, { waitUntil: 'networkidle' });
  await expect(page.locator('#case-view')).toBeVisible();
  await expect(page.locator('.case-row--wide-text')).toHaveCount(0);
  await expect(page.locator('.case-row--tall-text > .case-item--text-inline')).toHaveCount(1);
  const originalTallMediaPaths = await page
    .locator('.case-row--tall-text .case-item__img')
    .evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  expect(originalTallMediaPaths).toHaveLength(1);
  expect(tallMediaPaths.some((path) => assetPath(originalTallMediaPaths[0]).endsWith(path))).toBe(true);
});

test('hybrid: short mobile landscape keeps Case media and Free Assets grid scrollable', async ({ page }) => {
  const modelCase = requireFixture(THREE_D_CASE, 'skipped: no visible case has a 3D model');
  await page.setViewportSize({ width: 667, height: 375 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en#${modelCase.id}`, { waitUntil: 'networkidle' });
  await waitForHybridCase(page, modelCase.id);

  const caseGeometry = await page.locator('#case-view').evaluate((caseView) => {
    const header = caseView.querySelector('.case-view__header').getBoundingClientRect();
    const scroll = caseView.querySelector('.case-scroll').getBoundingClientRect();
    const narrative = caseView.querySelector('.case-text');
    return {
      dossierHeight: header.height,
      galleryHeight: scroll.height,
      narrativePadding: Number.parseFloat(getComputedStyle(narrative).paddingLeft),
      verticalGap: scroll.top - header.bottom,
      viewportRemainder: window.innerHeight - scroll.bottom,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(Math.abs(caseGeometry.dossierHeight - 144)).toBeLessThanOrEqual(1);
  expect(Math.abs(caseGeometry.galleryHeight - 167)).toBeLessThanOrEqual(1);
  expect(Math.abs(caseGeometry.narrativePadding - 24)).toBeLessThanOrEqual(1);
  expect(Math.abs(caseGeometry.verticalGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(caseGeometry.viewportRemainder)).toBeLessThanOrEqual(1);
  expect(caseGeometry.overflow).toBeLessThanOrEqual(1);

  await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridFreeAssets(page);
  const assetGeometry = await page.locator('#fa-view').evaluate((view) => {
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    const main = document.querySelector('.main-area').getBoundingClientRect();
    const scrollElement = view.querySelector('.fa-scroll');
    const scroll = scrollElement.getBoundingClientRect();
    return {
      sidebarHeight: sidebar.height,
      mainHeight: main.height,
      scrollHeight: scroll.height,
      scrollableOverflow: scrollElement.scrollHeight - scrollElement.clientHeight,
      chromeGap: main.top - sidebar.bottom,
      viewportRemainder: window.innerHeight - main.bottom,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(Math.abs(assetGeometry.sidebarHeight - 136)).toBeLessThanOrEqual(1);
  expect(Math.abs(assetGeometry.mainHeight - 239)).toBeLessThanOrEqual(1);
  expect(assetGeometry.scrollHeight).toBeGreaterThanOrEqual(64);
  expect(assetGeometry.scrollableOverflow).toBeGreaterThan(0);
  expect(Math.abs(assetGeometry.chromeGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(assetGeometry.viewportRemainder)).toBeLessThanOrEqual(1);
  expect(assetGeometry.overflow).toBeLessThanOrEqual(1);
});

test('hybrid: decode barrier coalesces rapid requests and commits only the latest project', async ({ page }) => {
  const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
  const second = requireFixture(SECOND_CASE, 'skipped: fewer than 3 visible cases for decode coalescing');
  const third = requireFixture(THIRD_CASE, 'skipped: fewer than 3 visible cases for decode coalescing');
  await page.addInitScript((delayedImage) => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    window.__hybridDecodeCalls = [];
    window.__hybridDelayTarget = true;
    window.__hybridTargetReleases = [];
    HTMLImageElement.prototype.decode = function () {
      const source = this.currentSrc || this.getAttribute('src') || '';
      if (!this.classList.contains('chamber-home__image')) {
        return nativeDecode ? nativeDecode.call(this) : Promise.resolve();
      }
      window.__hybridDecodeCalls.push(source);
      if (window.__hybridDelayTarget && source.includes(delayedImage)) {
        return new Promise((resolve) => {
          window.__hybridTargetReleases.push(resolve);
        });
      }
      return Promise.resolve();
    };
  }, assetPath(second.card.thumb));
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  const home = page.locator('[data-design-home="hybrid"]');
  const next = page.locator('.chamber-home__pager-button').last();

  /* i18n rebuilds the source cards while the delayed target is still pending. The latest
     selection must survive, and its replacement image must pass decode again. */
  await next.click();
  await expect(home).toHaveAttribute('data-requested-project', second.id);
  await expect(home).toHaveAttribute('data-transition-state', 'decoding');
  await expect.poll(() => page.evaluate(() => window.__hybridTargetReleases.length)).toBeGreaterThanOrEqual(1);
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(home).toHaveAttribute('data-requested-project', second.id);
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await expect(home).toHaveAttribute('data-transition-state', 'decoding');
  await expect.poll(() => page.evaluate(() => window.__hybridTargetReleases.length)).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.__hybridTargetReleases.splice(0).forEach((release) => release()));
  await expect(home).toHaveAttribute('data-active-project', second.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  // Обе стороны читаются заново на каждой попытке (см. тот же приём выше):
  // заголовок Hybrid-главной и карточка — разные подписчики i18n:changed.
  await expect
    .poll(async () => {
      const title = await page.locator('.chamber-home__title').textContent();
      const card = await page.locator(`.work-card[data-id="${second.id}"] .work-card__title`).textContent();
      return `${(title || '').trim()}|${(card || '').trim()}`;
    })
    .toMatch(/^(.+)\|\1$/);

  await page.locator(`[data-design-project="${primary.id}"]`).dispatchEvent('mouseenter');
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await page.evaluate(() => {
    window.__hybridTargetReleases = [];
  });

  await next.click();
  await expect(home).toHaveAttribute('data-requested-project', second.id);
  await expect(home).toHaveAttribute('data-transition-state', 'decoding');
  await expect.poll(() => page.evaluate(() => window.__hybridTargetReleases.length)).toBeGreaterThanOrEqual(1);
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  // Страница переключена на RU выше по сценарию, поэтому и ожидание — из
  // RU-локали. Раньше здесь стояло title.en и проходило лишь потому, что
  // русские названия кейсов были копией английских (плейсхолдеры).
  await expect(page.locator('.chamber-home__title')).toHaveText(primary.card.title.ru);

  await next.click();
  await expect(home).toHaveAttribute('data-requested-project', third.id);
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await page.evaluate(() => window.__hybridTargetReleases.splice(0).forEach((release) => release()));

  await expect(home).toHaveAttribute('data-active-project', third.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  await expect(page.locator('.chamber-home__title')).toHaveText(third.card.title.ru);
  await expect(page.locator('.chamber-home__view')).toHaveAttribute('href', `#${third.id}`);
  await expect(page.locator('.chamber-home__image--active')).toHaveAttribute('src', assetPathPattern(third.card.thumb));
  await expect(page.locator(`[data-design-project="${third.id}"]`)).toHaveAttribute('aria-current', 'true');
  const calls = await page.evaluate(() => window.__hybridDecodeCalls);
  expect(calls.some((source) => source.includes(assetPath(second.card.thumb)))).toBe(true);
  expect(calls.some((source) => source.includes(assetPath(third.card.thumb)))).toBe(true);

  await page.locator(`[data-design-project="${primary.id}"]`).dispatchEvent('mouseenter');
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await page.evaluate(() => {
    window.__hybridTargetReleases = [];
  });
  await next.click();
  await expect(home).toHaveAttribute('data-transition-state', 'decoding');
  await expect.poll(() => page.evaluate(() => window.__hybridTargetReleases.length)).toBeGreaterThanOrEqual(1);
  await page.locator('.chamber-home__pager-button').first().click();
  await expect(home).toHaveAttribute('data-requested-project', primary.id);
  await page.evaluate(() => window.__hybridTargetReleases.splice(0).forEach((release) => release()));
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  await page.evaluate(() => {
    window.__hybridDelayTarget = false;
  });
});

test('hybrid: crossfade reversal returns smoothly without committing the stale target', async ({ page }) => {
  const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
  const second = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for a crossfade reversal');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  await page.evaluate(() => {
    const home = document.querySelector('[data-design-home="hybrid"]');
    const controls = document.querySelectorAll('.chamber-home__pager-button');
    window.__hybridActiveHistory = [home.getAttribute('data-active-project')];
    window.__hybridActiveObserver = new MutationObserver(() => {
      window.__hybridActiveHistory.push(home.getAttribute('data-active-project'));
    });
    window.__hybridActiveObserver.observe(home, {
      attributes: true,
      attributeFilter: ['data-active-project']
    });
    new MutationObserver((records, observer) => {
      if (
        records.some((record) => record.attributeName === 'data-transition-state') &&
        home.getAttribute('data-transition-state') === 'crossfade'
      ) {
        observer.disconnect();
        controls[0].click();
      }
    }).observe(home, {
      attributes: true,
      attributeFilter: ['data-transition-state']
    });
    controls[1].click();
  });

  const home = page.locator('[data-design-home="hybrid"]');
  await expect(home).toHaveAttribute('data-requested-project', primary.id);
  await expect(home).toHaveAttribute('data-transition-state', 'reversing');
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).toHaveAttribute('data-active-project', primary.id);
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  await expect(page.locator('.chamber-home__image--active')).toHaveAttribute('src', assetPathPattern(primary.card.thumb));
  expect(
    await page.evaluate(() => {
      window.__hybridActiveObserver.disconnect();
      return window.__hybridActiveHistory;
    })
  ).not.toContain(second.id);
});

test('hybrid: same-frame crossfade reversal intent coalesces before motion ownership changes', async ({ page }) => {
  const second = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for a crossfade reversal');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);

  await page.evaluate(() => {
    const home = document.querySelector('[data-design-home="hybrid"]');
    const controls = document.querySelectorAll('.chamber-home__pager-button');
    window.__hybridTransitionHistory = [];
    window.__hybridTransitionObserver = new MutationObserver(() => {
      window.__hybridTransitionHistory.push(home.getAttribute('data-transition-state') || 'settled');
    });
    window.__hybridTransitionObserver.observe(home, {
      attributes: true,
      attributeFilter: ['data-transition-state']
    });
    new MutationObserver((records, observer) => {
      if (
        records.some((record) => record.attributeName === 'data-transition-state') &&
        home.getAttribute('data-transition-state') === 'crossfade'
      ) {
        observer.disconnect();
        controls[0].click();
        controls[1].click();
      }
    }).observe(home, {
      attributes: true,
      attributeFilter: ['data-transition-state']
    });
    controls[1].click();
  });

  const home = page.locator('[data-design-home="hybrid"]');
  await expect(home).toHaveAttribute('data-requested-project', second.id);
  await expect(home).toHaveAttribute('data-active-project', second.id);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  const states = await page.evaluate(() => {
    window.__hybridTransitionObserver.disconnect();
    return window.__hybridTransitionHistory;
  });
  expect(states).not.toContain('reversing');
  await expect(page.locator('.chamber-home__image--active')).toHaveAttribute('src', assetPathPattern(second.card.thumb));
});

test('hybrid: ten same-frame requests coalesce to the latest project', async ({ page }) => {
  requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for repeated transitions');
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);
  const inventory = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.work-card[data-id]:not(.tag-card)')).map((card) =>
      card.getAttribute('data-id')
    )
  );

  await page.evaluate(() => {
    const next = document.querySelectorAll('.chamber-home__pager-button')[1];
    for (let index = 0; index < 10; index += 1) next.click();
  });

  const target = inventory[10 % inventory.length];
  const home = page.locator('[data-design-home="hybrid"]');
  await expect(home).toHaveAttribute('data-requested-project', target);
  await expect(home).toHaveAttribute('data-active-project', target);
  await expect.poll(() => home.getAttribute('data-transition-state')).toBeNull();
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  await expect(page.locator('.chamber-home__view')).toHaveAttribute('href', `#${target}`);
  await expect(page.locator(`[data-design-project="${target}"]`)).toHaveAttribute('aria-current', 'true');
});

const hybridMotionTest = test.extend({
  // Trace capture perturbs requestAnimationFrame cadence on full-viewport SVG
  // crossfades. Retain DOM/source diagnostics without trace screencast frames;
  // Playwright still writes the separately configured failure screenshot.
  trace: {
    mode: 'retain-on-failure',
    screenshots: false,
    snapshots: true,
    sources: true
  }
});

hybridMotionTest('@motion-gate hybrid: ten project transitions keep fixed anchors and negligible layout shift', async ({ page }) => {
  requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for motion transitions');
  await page.addInitScript(() => {
    window.__hybridLayoutShiftScore = 0;
    window.__hybridLongTasks = [];
    if (typeof PerformanceObserver === 'function') {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) window.__hybridLayoutShiftScore += entry.value;
          });
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (_) {
        // LayoutShift is optional in older browser channels; geometry assertions remain authoritative.
      }
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            window.__hybridLongTasks.push({
              startTime: entry.startTime,
              duration: entry.duration
            });
          });
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch (_) {
        // Long Task API is optional; rAF pacing remains the browser-independent motion assertion.
      }
    }
  });
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);
  await page.evaluate(() => {
    window.__hybridLayoutShiftScore = 0;
    window.__hybridLongTasks = [];
    window.__hybridMotionStart = performance.now();
  });

  const inventory = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.work-card[data-id]:not(.tag-card)')).map((card) => ({
      id: card.getAttribute('data-id'),
      title: card.querySelector('.work-card__title').textContent.trim()
    }))
  );
  const readAnchors = () =>
    page.evaluate(() => {
      const media = document.querySelector('.chamber-home__media').getBoundingClientRect();
      const content = document.querySelector('.chamber-home__content').getBoundingClientRect();
      const pager = document.querySelector('.chamber-home__pager').getBoundingClientRect();
      return {
        contentLeft: content.left - media.left,
        contentBottom: media.bottom - content.bottom,
        pagerRight: media.right - pager.right,
        pagerBottom: media.bottom - pager.bottom
      };
    });
  const baseline = await readAnchors();
  const home = page.locator('[data-design-home="hybrid"]');
  const frameBlocks = [];

  for (let index = 1; index <= 10; index += 1) {
    const idleFrames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const frames = [];
          const deadline = performance.now() + 350;
          let previousFrame = null;
          const sampleIdleFrames = (timestamp) => {
            if (previousFrame !== null) frames.push(timestamp - previousFrame);
            previousFrame = timestamp;
            if (performance.now() < deadline) requestAnimationFrame(sampleIdleFrames);
            else resolve(frames);
          };
          requestAnimationFrame(sampleIdleFrames);
        })
    );
    const motionFrames = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const homeRoot = document.querySelector('[data-design-home="hybrid"]');
          const nextButton = document.querySelectorAll('.chamber-home__pager-button')[1];
          const frames = [];
          let previousFrame = null;
          let previousPhase = null;
          let stopped = false;
          const sampleMotionFrames = (timestamp) => {
            if (stopped) return;
            const phase = homeRoot.getAttribute('data-transition-state');
            const visibleMotion = phase === 'crossfade' || phase === 'reversing';
            if (visibleMotion && previousFrame !== null && previousPhase === phase) {
              frames.push(timestamp - previousFrame);
            }
            previousFrame = visibleMotion ? timestamp : null;
            previousPhase = visibleMotion ? phase : null;
            requestAnimationFrame(sampleMotionFrames);
          };
          const timeout = window.setTimeout(() => {
            stopped = true;
            observer.disconnect();
            reject(new Error('Hybrid transition did not settle within 3 seconds'));
          }, 3000);
          const settle = () => {
            if (homeRoot.hasAttribute('data-transition-state')) return;
            stopped = true;
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve(frames);
          };
          const observer = new MutationObserver(settle);
          observer.observe(homeRoot, { attributes: true, attributeFilter: ['data-transition-state'] });
          requestAnimationFrame(sampleMotionFrames);
          nextButton.click();
          requestAnimationFrame(settle);
        })
    );
    frameBlocks.push({ idleFrames, motionFrames });
    const expectedProject = inventory[index % inventory.length];
    await expect(home).toHaveAttribute('data-requested-project', expectedProject.id);
    await expect(home).toHaveAttribute('data-active-project', expectedProject.id);
    await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
    await expect(page.locator('.chamber-home__title')).toHaveText(expectedProject.title);
    await expect(page.locator(`[data-design-project="${expectedProject.id}"]`)).toHaveAttribute(
      'aria-current',
      'true'
    );
    const current = await readAnchors();
    for (const key of Object.keys(baseline)) expect(Math.abs(current[key] - baseline[key])).toBeLessThanOrEqual(1);
  }

  const summarize = (values, jankThreshold) => {
    const frames = values.slice().sort((left, right) => left - right);
    let slowStreak = 0;
    let maxSlowStreak = 0;
    values.forEach((delta) => {
      slowStreak = delta > jankThreshold ? slowStreak + 1 : 0;
      maxSlowStreak = Math.max(maxSlowStreak, slowStreak);
    });
    return {
      frameCount: frames.length,
      median: frames[Math.floor(frames.length / 2)] || 0,
      p90: frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.9))] || 0,
      p99: frames[Math.min(frames.length - 1, Math.floor(frames.length * 0.99))] || 0,
      max: frames[frames.length - 1] || 0,
      jankRatio: frames.filter((delta) => delta > jankThreshold).length / Math.max(1, frames.length),
      maxSlowStreak
    };
  };
  const blocks = frameBlocks.map(({ idleFrames, motionFrames }) => {
    const idleMedian = idleFrames.slice().sort((left, right) => left - right)[Math.floor(idleFrames.length / 2)] || 0;
    const jankThreshold = idleMedian * 1.5 + 1;
    const idle = summarize(idleFrames, jankThreshold);
    const motion = summarize(motionFrames, jankThreshold);
    return {
      idle,
      motion,
      excessJankRatio: Math.max(0, motion.jankRatio - idle.jankRatio)
    };
  });
  const pairedExcess = blocks.map((block) => block.excessJankRatio);
  const bootstrapMeans = [];
  let bootstrapSeed = 0xc0de0515;
  for (let sampleIndex = 0; sampleIndex < 5000; sampleIndex += 1) {
    let total = 0;
    for (let blockIndex = 0; blockIndex < pairedExcess.length; blockIndex += 1) {
      bootstrapSeed = (Math.imul(bootstrapSeed, 1664525) + 1013904223) >>> 0;
      total += pairedExcess[Math.floor((bootstrapSeed / 0x100000000) * pairedExcess.length)];
    }
    bootstrapMeans.push(total / pairedExcess.length);
  }
  bootstrapMeans.sort((left, right) => left - right);
  const pacing = {
    blocks,
    observedExcessMean: pairedExcess.reduce((total, value) => total + value, 0) / pairedExcess.length,
    excessLower95: bootstrapMeans[Math.floor(bootstrapMeans.length * 0.05)],
    longTasks: await page.evaluate(() =>
      window.__hybridLongTasks.filter((entry) => entry.startTime >= window.__hybridMotionStart)
    )
  };
  const pacingSummary = JSON.stringify(pacing);
  expect(await page.evaluate(() => window.__hybridLayoutShiftScore), pacingSummary).toBeLessThanOrEqual(0.01);
  for (const block of blocks) {
    expect(block.idle.frameCount, pacingSummary).toBeGreaterThan(12);
    expect(block.motion.frameCount, pacingSummary).toBeGreaterThan(20);
    // Pair each transition with a nearby idle control. A 60 Hz-capable host is
    // required, while isolated one-frame misses remain inside the p90/p99 caps.
    expect(block.idle.median, pacingSummary).toBeLessThanOrEqual(20.5);
    expect(block.motion.median, pacingSummary).toBeLessThanOrEqual(block.idle.median + 2);
    expect(block.motion.p90, pacingSummary).toBeLessThanOrEqual(
      Math.max(block.idle.p90 + 2, block.idle.median * 2 + 2)
    );
    expect(block.motion.p99, pacingSummary).toBeLessThanOrEqual(block.idle.median * 3 + 3);
  }
  // Detect regressions confidently above the 15% excess-jank budget with
  // transition-level resampling, plus a deterministic 20% gross ceiling.
  expect(pacing.observedExcessMean, pacingSummary).toBeLessThanOrEqual(0.2);
  expect(pacing.excessLower95, pacingSummary).toBeLessThanOrEqual(0.15);
  expect(pacing.longTasks, pacingSummary).toEqual([]);
});

test('hybrid: reduced motion Case and Free Assets surfaces have no axe violations', async ({ page }) => {
  const nextCase = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for reduced-motion navigation');
  const errors = collectConsoleErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${server.base}/index.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridHome(page);
  const home = page.locator('[data-design-home="hybrid"]');
  await expectReducedMotionStyles(page, '.chamber-home__image-layer');
  await page.locator('.chamber-home__pager-button').last().click();
  await expect(home).toHaveAttribute('data-requested-project', nextCase.id);
  await expect(home).toHaveAttribute('data-active-project', nextCase.id);
  await expect(home).not.toHaveAttribute('data-transition-state', /.+/);
  await expect(home).not.toHaveClass(/is-transitioning|is-content-changing/);
  const homeAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(homeAxe.violations, formatAxeViolations(homeAxe.violations)).toEqual([]);

  await page.locator('.chamber-home__view').click();
  await waitForHybridCase(page, nextCase.id);
  await expect(page.locator('.hybrid-case-dossier')).toBeVisible();
  await expect(page.locator('.hybrid-case-hero')).toBeVisible();
  await expectReducedMotionStyles(page, '#case-view');
  const caseAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(caseAxe.violations, formatAxeViolations(caseAxe.violations)).toEqual([]);

  await page.goto(`${server.base}/free-assets.html?design=hybrid&lang=en`, { waitUntil: 'networkidle' });
  await waitForHybridFreeAssets(page);
  await expect(page.locator('.fa-card__thumb-mv[data-codex-preview-enabled="true"]')).toHaveCount(0);
  await expect(page.locator('script[src*="model-viewer.min.js"]')).toHaveCount(0);
  await expectReducedMotionStyles(page, 'body');
  const assetsAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(assetsAxe.violations, formatAxeViolations(assetsAxe.violations)).toEqual([]);
  expect(internalConsoleErrors(errors)).toEqual([]);
});

test('chamber: language refresh preserves Case reading position', async ({ page }) => {
  const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
  await page.goto(`${server.base}/index.html?design=chamber&lang=en#${primary.id}`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'chamber', 'index');
  const caseScroll = page.locator('#case-scroll');
  await caseScroll.evaluate((node) => {
    node.scrollTop = 500;
  });
  const before = await caseScroll.evaluate((node) => node.scrollTop);
  expect(before).toBeGreaterThan(0);
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect.poll(() => caseScroll.evaluate((node) => node.scrollTop)).toBe(before);
});

test('specimen: Home keeps the hidden Case runtime idle', async ({ page }) => {
  await page.goto(`${server.base}/index.html?design=specimen&lang=en`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'specimen', 'index');
  const home = page.locator('[data-design-home="specimen"]');
  await expect(home).toBeVisible();
  await expect(page.locator('.case-motion[data-motion-playing="true"]')).toHaveCount(0);
  await expect(page.locator('.case-motion__vimeo iframe')).toHaveCount(0);
  await expect(page.locator('#case-3d model-viewer, #case-3d canvas')).toHaveCount(0);

  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect.poll(() => page.locator('.case-motion[data-motion-playing="true"]').count()).toBe(0);
  await expect(page.locator('.case-motion__vimeo iframe')).toHaveCount(0);
  await expect(page.locator('#case-3d model-viewer, #case-3d canvas')).toHaveCount(0);
});

test('specimen: leaving during delayed 3D load prevents a hidden mount', async ({ page }) => {
  const modelCase = requireFixture(THREE_D_CASE, 'skipped: no visible case has a 3D model');
  let loaderReleased = false;
  await page.route('**/js/vendor/codex-three-viewer.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
    loaderReleased = true;
  });
  await page.goto(`${server.base}/index.html?design=specimen&lang=en#${modelCase.id}`, {
    waitUntil: 'networkidle'
  });
  await waitForDesign(page, 'specimen', 'index');

  const loaderRequest = page.waitForRequest((request) => request.url().endsWith('/js/vendor/codex-three-viewer.js'));
  const loaderResponse = page.waitForResponse((response) =>
    response.url().endsWith('/js/vendor/codex-three-viewer.js')
  );
  await page.locator('#case-tab-3d').click();
  await loaderRequest;
  const backControls = page.locator('[data-design-back]:visible');
  expect(await backControls.count()).toBeGreaterThan(0);
  await backControls.first().click();
  await expect(page.locator('[data-design-home="specimen"]')).toBeVisible();
  const response = await loaderResponse;
  expect(await response.finished()).toBeNull();
  await expect.poll(() => loaderReleased).toBe(true);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#case-3d model-viewer, #case-3d canvas')).toHaveCount(0);
});

test('chamber: project arrows move selection and focus together', async ({ page }) => {
  const primary = requireFixture(PRIMARY_CASE, 'skipped: no visible case');
  const next = requireFixture(SECOND_CASE, 'skipped: fewer than 2 visible cases for arrow navigation');
  await page.goto(`${server.base}/index.html?design=chamber&lang=en`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'chamber', 'index');
  const first = page.locator(`.chamber-home__index-button[data-design-project="${primary.id}"]`);
  const second = page.locator(`.chamber-home__index-button[data-design-project="${next.id}"]`);
  await first.focus();
  await first.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(page.locator('.chamber-home__title')).toHaveText(next.card.title.en);
  await second.press('Enter');
  await expect.poll(() => new URL(page.url()).hash).toBe(`#${next.id}`);
  await expect(page.locator('#case-title')).toHaveText(next.card.title.en);
});

test('specimen: category filter constrains Case previous and next', async ({ page }) => {
  await page.goto(`${server.base}/index.html?design=specimen&lang=en`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'specimen', 'index');
  const category = await page.evaluate(() => {
    const counts = new Map();
    document.querySelectorAll('.work-card[data-id]:not(.tag-card)').forEach((card) => {
      const key = card.getAttribute('data-category');
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
  });
  expect(category).not.toBeNull();
  await page.locator(`.specimen-filter[data-filter="${category}"]`).click();
  const visibleIds = await page
    .locator('.specimen-project:not([hidden])')
    .evaluateAll((links) => links.map((link) => link.getAttribute('data-id')));
  expect(visibleIds.length).toBeGreaterThan(0);

  await page.locator(`.specimen-project[data-id="${visibleIds[0]}"]`).click();
  await expect.poll(() => new URL(page.url()).hash).toBe(`#${visibleIds[0]}`);
  const returnId = visibleIds.length > 1 ? visibleIds[1] : visibleIds[0];
  if (visibleIds.length > 1) {
    await page.locator('#case-next').click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${visibleIds[1]}`);
    await page.locator('#case-prev').click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${visibleIds[0]}`);
    await page.locator('#case-next').click();
    await expect.poll(() => new URL(page.url()).hash).toBe(`#${visibleIds[1]}`);
  } else {
    await expect(page.locator('#case-prev')).toBeDisabled();
    await expect(page.locator('#case-next')).toBeDisabled();
  }
  const backControls = page.locator('[data-design-back]:visible');
  expect(await backControls.count()).toBeGreaterThan(0);
  await backControls.first().click();
  const returnedLink = page.locator(`.specimen-project[data-id="${returnId}"]`);
  await expect(returnedLink).toBeVisible();
  await expect(returnedLink).toBeFocused();
  await expect(page.locator(`.specimen-filter[data-filter="${category}"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('specimen: RU mode translates Design Lab controls', async ({ page }) => {
  await page.goto(`${server.base}/index.html?design=specimen&lang=ru`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'specimen', 'index');

  await expect(page.locator('.specimen-index__head .specimen-kicker')).toHaveText('ИНДЕКС ПРОЕКТОВ');
  await expect(page.locator('.specimen-stage__top .specimen-kicker')).toHaveText('ЖИВОЙ ОБРАЗЕЦ');
  await expect(page.locator('.specimen-filter[data-filter="all"]')).toHaveText('ВСЕ');
  await expect(page.locator('.specimen-dossier__table dt').first()).toHaveText('ГОД');
});

/* ── FA-POSTER-01: растровые постеры Free Assets ──────────────────────────────
 *
 * The catalog poster slot now accepts a full './assets/…' path with its own
 * extension, so a real photo render can replace the SVG placeholder. Two
 * contracts are gated here:
 *   1. the runtime renders the path VERBATIM (no hardcoded ".svg" suffix) and
 *      marks the slot with data-poster-kind="raster";
 *   2. the branded veil (.fa-card__thumb::before) is WEAKENED for a raster —
 *      the diagonal hatching and the primary wash would read as a print defect
 *      over a photograph — while a vector poster keeps the historical look.
 * Chamber and Hybrid replace ::before wholesale at a higher specificity, so
 * their (already hatch-free) veil must stay exactly as it is; Specimen leaves
 * ::before to the base sheet and therefore inherits the weakening.
 * The generator side (fa-data, tag-card region, JSON-LD) is gated in
 * tests/quality/content-visibility.test.mjs scenario 23.
 */
/* Deterministic, content-INDEPENDENT fixtures. An earlier revision hunted for a
 * raster inside the owner's live assets/cards and skipped the whole gate when
 * there wasn't one — meaning this feature's entire runtime + CSS gate could
 * silently verify nothing. Both posters are now SERVED by the test: a 1x1 PNG
 * for the raster slot and a tiny SVG for the vector control, at fixed URLs that
 * page.route fulfils. The vector control is an INJECTED FA_DATA entry rather
 * than "some sibling card from content", because a single-item (or all-raster)
 * category would otherwise leave nothing to compare the raster against. */
const RASTER_FIXTURE = './assets/cards/zz-fa-poster-fixture.png';
const VECTOR_FIXTURE = './assets/cards/zz-fa-poster-fixture.svg';
const VECTOR_CONTROL_ID = 'zz-vector-control';
// 1x1 transparent PNG.
const RASTER_FIXTURE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const VECTOR_FIXTURE_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 6"><rect width="8" height="6" fill="#222"/></svg>',
  'utf8'
);
// The DEFAULT rendered category — the first visible tag card, so no tag click
// is needed in any design mode.
const RASTER_FA_CATEGORY = VISIBLE_FA_CATEGORIES[0] || null;

async function installRasterPosterFixture(page, category, options = {}) {
  const targetId = category.items[0].id;
  const dropModel = options.keepModel !== true;
  await page.route(`**${RASTER_FIXTURE.slice(1)}`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: RASTER_FIXTURE_BYTES })
  );
  await page.route(`**${VECTOR_FIXTURE.slice(1)}`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: VECTOR_FIXTURE_BYTES })
  );
  // fa-data.js is a classic script defining `var FA_DATA`; appending a patch
  // statement is the least invasive way to hand the runtime a raster item and
  // an independent vector control without touching content/.
  await page.route('**/js/fa-data.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        body +
        '\n;(function () {\n' +
        `  var list = FA_DATA[${JSON.stringify(category.key)}] || [];\n` +
        '  var target = null;\n' +
        '  for (var i = 0; i < list.length; i += 1) {\n' +
        `    if (list[i].id === ${JSON.stringify(targetId)}) { target = list[i]; }\n` +
        '  }\n' +
        '  if (!target) { return; }\n' +
        '  var control = JSON.parse(JSON.stringify(target));\n' +
        `  target.thumb = ${JSON.stringify(RASTER_FIXTURE)};\n` +
        (dropModel ? '  target.model = null;\n' : '') +
        `  control.id = ${JSON.stringify(VECTOR_CONTROL_ID)};\n` +
        `  control.thumb = ${JSON.stringify(VECTOR_FIXTURE)};\n` +
        '  control.model = null;\n' +
        '  list.splice(list.indexOf(target) + 1, 0, control);\n' +
        '})();\n'
    });
  });
  // Tag-card covers live in the generated region, so the raster variant is
  // installed on the SERVED html (the generator side is gated in
  // tests/quality/content-visibility.test.mjs scenario 23).
  await page.route('**/free-assets.html*', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const start = html.indexOf('<div class="tag-card__thumb');
    if (start < 0) {
      await route.fulfill({ response, body: html });
      return;
    }
    const end = html.indexOf('>', html.indexOf('<img ', start));
    const block = html
      .slice(start, end + 1)
      .replace('<div class="tag-card__thumb', '<div data-poster-kind="raster" class="tag-card__thumb')
      .replace(/src="[^"]*"/, `src="${RASTER_FIXTURE}"`);
    await route.fulfill({ response, body: html.slice(0, start) + block + html.slice(end + 1) });
  });
  return targetId;
}

// Computed ::before of a thumb — the veil contract is a computed-style
// contract, not a class-name one.
function readVeil(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const style = getComputedStyle(node, '::before');
    return {
      posterKind: node.getAttribute('data-poster-kind'),
      backgroundImage: style.backgroundImage,
      opacity: Number.parseFloat(style.opacity)
    };
  }, selector);
}

for (const mode of ['original', 'specimen', 'chamber', 'hybrid']) {
  test(`${mode}: a raster Free Assets poster renders verbatim and wears the right veil`, async ({ page }) => {
    const category = requireFixture(RASTER_FA_CATEGORY, 'skipped: no visible Free Assets category');
    const targetId = await installRasterPosterFixture(page, category);

    await page.setViewportSize({ width: 1440, height: 1024 });
    const design = mode === 'original' ? '' : `&design=${mode}`;
    await page.goto(`${server.base}/free-assets.html?lang=en${design}`, { waitUntil: 'networkidle' });
    if (mode === 'specimen' || mode === 'chamber') await waitForDesign(page, mode, 'free-assets');
    else if (mode === 'hybrid') await waitForHybridFreeAssets(page);
    await page.waitForFunction(
      (controlId) => Boolean(document.querySelector(`#fa-grid .fa-card[id="${controlId}"]`)),
      VECTOR_CONTROL_ID
    );

    // 1. the runtime resolver honours the extension instead of appending .svg.
    const rasterThumb = page.locator(`#fa-grid .fa-card[id="${targetId}"] .fa-card__thumb`);
    const vectorThumb = page.locator(`#fa-grid .fa-card[id="${VECTOR_CONTROL_ID}"] .fa-card__thumb`);
    await expect(rasterThumb).toHaveAttribute('data-poster-kind', 'raster');
    await expect(rasterThumb.locator('img')).toHaveAttribute('src', RASTER_FIXTURE);
    await expect(vectorThumb).not.toHaveAttribute('data-poster-kind', /.*/);
    await expect(vectorThumb.locator('img')).toHaveAttribute('src', VECTOR_FIXTURE);
    // The decorative contract verify-frozen pins (D2-axe budget 0) survives.
    for (const thumb of [rasterThumb, vectorThumb]) {
      await expect(thumb.locator('img')).toHaveAttribute('alt', '');
      await expect(thumb.locator('img')).toHaveAttribute('aria-hidden', 'true');
    }

    // 2. the veil: raster weakened in Original/Specimen, mode styling intact in
    //    Chamber/Hybrid (both already replace ::before without hatching).
    const raster = await readVeil(page, `#fa-grid .fa-card[id="${targetId}"] .fa-card__thumb`);
    const vector = await readVeil(page, `#fa-grid .fa-card[id="${VECTOR_CONTROL_ID}"] .fa-card__thumb`);
    expect(raster, 'the raster card must be rendered').toBeTruthy();
    expect(vector, 'the injected vector control must be rendered').toBeTruthy();

    if (mode === 'original' || mode === 'specimen') {
      expect(vector.backgroundImage).toContain('repeating-linear-gradient');
      expect(raster.backgroundImage).not.toContain('repeating-linear-gradient');
      expect(raster.opacity).toBeLessThan(vector.opacity);
    } else {
      expect(raster.backgroundImage).toBe(vector.backgroundImage);
      expect(raster.opacity).toBe(vector.opacity);
    }

    // 3. the category cover uses the same mechanism. Only Original renders the
    //    tag-card thumb — Specimen, Chamber and Hybrid all hide it.
    if (mode === 'original') {
      const rasterCover = await readVeil(page, '.tag-card__thumb[data-poster-kind="raster"]');
      expect(rasterCover, 'the raster category cover must be rendered').toBeTruthy();
      expect(rasterCover.backgroundImage).not.toContain('repeating-linear-gradient');
      const vectorCover = await readVeil(page, '.tag-card__thumb:not([data-poster-kind])');
      if (vectorCover) {
        expect(vectorCover.backgroundImage).toContain('repeating-linear-gradient');
        expect(rasterCover.opacity).toBeLessThan(vectorCover.opacity);
      }
    } else {
      await expect(page.locator('.tag-card__thumb').first()).toBeHidden();
    }
  });
}

test('original: a raster poster drops its weakened veil once the 3D model takes over', async ({ page }) => {
  const category = requireFixture(RASTER_FA_CATEGORY, 'skipped: no visible Free Assets category');
  const targetId = await installRasterPosterFixture(page, category, { keepModel: true });
  // Block the GLB so the real load event cannot race the assertions — the card
  // keeps its poster until this test fires the event itself.
  await page.route('**/assets/models/free/*.glb', (route) => route.abort());
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/free-assets.html?lang=en`, { waitUntil: 'networkidle' });
  const thumb = page.locator(`#fa-grid .fa-card[id="${targetId}"] .fa-card__thumb`);
  await expect(thumb).toHaveAttribute('data-poster-kind', 'raster');

  // Once the GLB is ready the poster is hidden (.is-model-ready img{opacity:0}),
  // so the slot must go back to the branded veil instead of keeping the
  // photo-friendly one over a 3D render. The real load event is what the
  // runtime listens for; the GLB itself never has to arrive.
  await page.evaluate((id) => {
    const viewer = document.querySelector(`#fa-grid .fa-card[id="${id}"] .fa-card__thumb-mv`);
    viewer.dispatchEvent(new Event('load'));
  }, targetId);

  await expect(thumb).toHaveClass(/is-model-ready/);
  await expect(thumb).not.toHaveAttribute('data-poster-kind', /.*/);
  const veil = await readVeil(page, `#fa-grid .fa-card[id="${targetId}"] .fa-card__thumb`);
  expect(veil.backgroundImage).toContain('repeating-linear-gradient');
});
