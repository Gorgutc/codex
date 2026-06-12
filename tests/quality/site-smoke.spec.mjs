import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { visibleFaCategories } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// FA expectations derived from content/, NOT hardcoded (prod-review F1,
// finding D-01 class): hiding an asset or a category through the admin panel
// must not strand this suite on stale literal counts.
const FA_CATS = visibleFaCategories(ROOT);
const FA_DEFAULT_CAT = FA_CATS[0];
const FA_SWITCH_CAT = FA_CATS.find((cat) => cat.key !== FA_DEFAULT_CAT.key) || null;
// First default-category asset whose archive is missing from downloads/ —
// the target of the download-fallback assertion below. NOTE for iteration
// F4: once the Download button is hidden for missing archives (finding
// A2-01/E-02 decision), this block flips to asserting the button is absent.
const FA_MISSING_DOWNLOAD_INDEX = FA_DEFAULT_CAT.items.findIndex(
  (item) => !fs.existsSync(path.join(ROOT, 'downloads', String(item.file || '')))
);
const PAGES = [
  { path: '/index.html', title: /Codex/i, axeBudget: 0 },
  { path: '/free-assets.html', title: /Free 3D Assets/i, axeBudget: 0 }
];

const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.zip': 'application/zip'
};

let server;
let base;

test.beforeAll(async () => {
  await new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (requestPath === '/') requestPath = '/index.html';
      const filePath = path.join(ROOT, requestPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

for (const pageInfo of PAGES) {
  test(`${pageInfo.path} loads without internal console errors`, async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(`${base}${pageInfo.path}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(pageInfo.title);
    await expect(page.locator('main')).toBeVisible();

    const internalErrors = consoleErrors.filter(
      (error) =>
        !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|fontshare|og-image\.jpg)/i.test(error)
    );
    expect(internalErrors).toEqual([]);
  });

  test(`${pageInfo.path} stays inside the axe accessibility budget`, async ({ page }) => {
    await page.goto(`${base}${pageInfo.path}`, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations.length).toBeLessThanOrEqual(pageInfo.axeBudget);
  });
}

test('/free-assets.html releases preloader without waiting for lazy tag previews', async ({ page }) => {
  await page.addInitScript(() => {
    window.__codexPreloaderDoneEvents = [];
    document.addEventListener('codex:preloader-done', () => {
      window.__codexPreloaderDoneEvents.push(performance.now());
    });
  });

  await page.route(/\/assets\/cards\/(?:corten-series|nightshard|nyx-panther|helix-reveal|mech-link)\.svg$/i, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });

  const started = Date.now();
  await page.goto(`${base}/free-assets.html`, { waitUntil: 'domcontentloaded' });
  // The contract: the preloader releases WITHOUT waiting for the lazy tag
  // previews, which this test delays by 4000ms above. Any release strictly
  // below that artificial delay proves the contract; the previous 2200ms
  // bound additionally pinned machine speed and flaked on slower hosts
  // (pre-existing flake, iteration C / prod-review F1). 3500ms keeps a
  // 500ms safety margin below the 4000ms gate without weakening the claim.
  await page.waitForFunction(() => window.__codexPreloaderDoneEvents.length === 1, null, { timeout: 3500 });

  expect(Date.now() - started).toBeLessThan(3500);
  await expect(page.locator('html')).not.toHaveClass(/is-loading/);
  await expect(page.locator('#preloader')).toHaveCount(0);
});

test('/free-assets.html keeps trust, preview, tag, and download fallback contracts coherent', async ({ page }) => {
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(`${base}/free-assets.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((expectedCards) =>
    !document.documentElement.classList.contains('is-loading') &&
    document.querySelectorAll('#fa-grid .fa-card').length === expectedCards,
  FA_DEFAULT_CAT.items.length);

  await expect(page.locator('.fa-trust__item')).toHaveCount(3);
  await expect(page.locator('.fa-trust__item').first()).toContainText('CC0');
  // Mini-3D preview is present unless the item opts out with model:null
  // (mirrors FA_DEFAULT_PREVIEWS in verify-frozen.js).
  const expectedPreviews = FA_DEFAULT_CAT.items.filter(
    (item) => !('model' in item) || item.model !== null
  ).length;
  await expect(page.locator('.fa-card__thumb[data-preview-state="3d"] .fa-card__thumb-mv')).toHaveCount(expectedPreviews);
  expect(await page.locator('.fa-card__thumb-mv').evaluateAll((items) =>
    items.every((mv) => mv.getAttribute('loading') === 'lazy' && !mv.hasAttribute('camera-controls'))
  )).toBe(true);

  await page.click('#lang-toggle');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.fa-trust__item').first()).toContainText('CC0');
  await expect(page.locator('.fa-trust__item').nth(1)).toContainText('Без аккаунта');
  await expect(page.locator('.fa-trust')).toHaveAttribute('aria-label', 'Условия скачивания');

  await page.click('#lang-toggle');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  if (FA_SWITCH_CAT) {
    await page.click(`[data-tag="${FA_SWITCH_CAT.key}"]`);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(FA_SWITCH_CAT.items.length);

    await page.click(`[data-tag="${FA_DEFAULT_CAT.key}"]`);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(FA_DEFAULT_CAT.items.length);
  }
  if (FA_MISSING_DOWNLOAD_INDEX !== -1) {
    const missingDownload = page
      .locator('#fa-grid .fa-card')
      .nth(FA_MISSING_DOWNLOAD_INDEX)
      .locator('.fa-card__download');
    await missingDownload.click();
    await expect(missingDownload).toContainText(/File not found/i);
  }

  const internalErrors = consoleErrors.filter(
    (error) =>
      !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|fontshare|og-image\.jpg)/i.test(error)
  );
  expect(internalErrors).toEqual([]);
});
