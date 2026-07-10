import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { startStaticServer } from './fixtures/admin-harness.mjs';

const server = startStaticServer();
const MODES = ['specimen', 'chamber'];
const PROTOTYPE_KEYS = ['constructor', 'toString', '__proto__'];

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

test('Original stays the default and unknown design values fail closed', async ({ page }) => {
  const variantRequests = [];
  page.on('request', (request) => {
    if (/design-(?:specimen|chamber)\.(?:css|js)(?:\?|$)/.test(request.url())) variantRequests.push(request.url());
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
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto(`${server.base}/free-assets.html?lang=en`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('#fa-grid .fa-card').length > 0);

  const nonGameTag = await page.evaluate(() => {
    const card = document.querySelector('.tag-card[data-game-asset="false"][data-tag]');
    const tag = card?.getAttribute('data-tag') || '';
    return tag && window.FA_DATA?.[tag]?.length ? tag : null;
  });
  expect(nonGameTag).not.toBeNull();

  await page.locator(`.tag-card[data-tag="${nonGameTag}"]`).click();
  await page.locator('#game-switch-label').click();
  await expect(page.locator('#game-switch')).toBeChecked();
  await expect(page.locator('#fa-grid .fa-card:visible')).toHaveCount(0);
  await expect(page.locator('#fa-grid .fa-grid__empty')).toBeVisible();
});

for (const mode of MODES) {
  test(`${mode}: direct case deep links survive bootstrap`, async ({ page }) => {
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#orbital-mk-ii`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    expect(new URL(page.url()).hash).toBe('#orbital-mk-ii');
    await expect(page.locator(`[data-design-home="${mode}"]`)).toBeHidden();
    await expect(page.locator('#case-view')).toBeVisible();
    await expect(page.locator('#case-title')).toContainText('Orbital Mk.II');
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
    await expect.poll(() => new URL(page.url()).hash).toBe('#vega-shell');
    expect(new URL(page.url()).searchParams.get('design')).toBe(mode);
    await expect(page.locator('#case-title')).toContainText('Vega Shell');

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#vega-shell`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');

    expect(new URL(page.url()).hash).toBe('#vega-shell');
    await expect(page.locator(`[data-design-home="${mode}"]`)).toBeHidden();
    await expect(page.locator('#case-title')).toContainText('Vega Shell');
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
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#orbital-mk-ii`, { waitUntil: 'networkidle' });
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

    await home.locator('[data-design-project="orbital-mk-ii"]').click();
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
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    const home = page.locator(`[data-design-home="${mode}"]`);
    await home.locator('[data-design-project="orbital-mk-ii"]').first().click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#orbital-mk-ii');
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
    expect(faTargetSizes.filter((size) => size.width < 44 || size.height < 44)).toEqual([]);
    const faAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(faAxe.violations, formatAxeViolations(faAxe.violations)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(internalConsoleErrors(errors)).toEqual([]);
  });

  test(`${mode}: mobile Home and Case keep controls inside the viewport`, async ({ page }) => {
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
    expect(homeTargetSizes.filter((size) => size.width < 44 || size.height < 44)).toEqual([]);
    const homeAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(homeAxe.violations, formatAxeViolations(homeAxe.violations)).toEqual([]);

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#orbital-mk-ii`, { waitUntil: 'networkidle' });
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
    expect(caseTargetSizes.filter((size) => size.width < 44 || size.height < 44)).toEqual([]);

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
    if (mode === 'chamber') expect(caseLayout.posterSrc).toMatch(/assets\/cards\/orbital-mk-ii\.svg$/);
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
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#orbital-mk-ii`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    await expect(page.locator('#case-view')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, formatAxeViolations(result.violations)).toEqual([]);
  });

  test(`${mode}: reduced motion covers Home, Case and Free Assets`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${server.base}/index.html?design=${mode}&lang=en`, { waitUntil: 'networkidle' });
    await waitForDesign(page, mode, 'index');
    await expectReducedMotionStyles(page, 'body');

    if (mode === 'chamber') {
      const home = page.locator('[data-design-home="chamber"]');
      await page.locator('.chamber-home__index-button[data-design-project="vega-shell"]').click();
      await expect(home).not.toHaveClass(/is-changing/);
    }

    await page.goto(`${server.base}/index.html?design=${mode}&lang=en#orbital-mk-ii`, {
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

test('chamber: language refresh preserves Case reading position', async ({ page }) => {
  await page.goto(`${server.base}/index.html?design=chamber&lang=en#orbital-mk-ii`, { waitUntil: 'networkidle' });
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
  let loaderReleased = false;
  await page.route('**/js/vendor/codex-three-viewer.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
    loaderReleased = true;
  });
  await page.goto(`${server.base}/index.html?design=specimen&lang=en#orbital-mk-ii`, {
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
  await page.goto(`${server.base}/index.html?design=chamber&lang=en`, { waitUntil: 'networkidle' });
  await waitForDesign(page, 'chamber', 'index');
  const first = page.locator('.chamber-home__index-button[data-design-project="orbital-mk-ii"]');
  const second = page.locator('.chamber-home__index-button[data-design-project="vega-shell"]');
  await first.focus();
  await first.press('ArrowRight');
  await expect(second).toBeFocused();
  await expect(page.locator('.chamber-home__title')).toHaveText('Vega Shell');
  await second.press('Enter');
  await expect.poll(() => new URL(page.url()).hash).toBe('#vega-shell');
  await expect(page.locator('#case-title')).toHaveText('Vega Shell');
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
