import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
};

let server;
let base;

function serve(req, res) {
  let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (requestPath === '/') requestPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, requestPath));
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
}

async function waitForPageReady(page) {
  await page.waitForFunction(() =>
    !document.documentElement.classList.contains('is-loading') &&
    !document.querySelector('#preloader')
  );
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
      .cursor { display: none !important; }
    `,
  });
  await page.waitForTimeout(80);
}

async function prepare(page, routePath, viewport) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://ajax.googleapis.com/ajax/libs/model-viewer/**', (route) => route.abort('blockedbyclient'));
  await page.goto(`${base}${routePath}?lang=en`, { waitUntil: 'networkidle' });
  await waitForPageReady(page);
}

test.beforeAll(async () => {
  await new Promise((resolve) => {
    server = http.createServer(serve);
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.describe('visual regression baselines', () => {
  test('index desktop first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 1440, height: 900 });
    await expect(page.locator('.work-card[data-id="orbital-mk-ii"].work-card--active')).toBeVisible();
    await expect(page.locator('#case-title')).toContainText('Orbital Mk.II');
    await expect(page).toHaveScreenshot('index-desktop-first-viewport.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015,
    });
  });

  test('index mobile sidebar first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 375, height: 667 });
    await expect(page.locator('body')).not.toHaveClass(/cards-collapsed/);
    await expect(page.locator('.work-card[data-id]')).toHaveCount(18);
    await expect(page).toHaveScreenshot('index-mobile-sidebar.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015,
    });
  });

  test('free assets desktop grid first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 1440, height: 900 });
    await expect(page.locator('#tag-hard-surface')).toHaveClass(/tag-card--active/);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(8);
    await expect(page).toHaveScreenshot('free-assets-desktop-grid.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015,
    });
  });

  test('free assets mobile sidebar first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 375, height: 667 });
    await expect(page.locator('body')).not.toHaveClass(/cards-collapsed/);
    await expect(page.locator('.tag-card')).toHaveCount(6);
    await expect(page).toHaveScreenshot('free-assets-mobile-sidebar.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015,
    });
  });
});
