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
  await page.waitForFunction(
    () => !document.documentElement.classList.contains('is-loading') && !document.querySelector('#preloader')
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
    `
  });
  await page.waitForTimeout(80);
}

async function waitForHybridHomeReady(page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    const home = document.querySelector('[data-design-home="hybrid"]');
    const activeImage = home?.querySelector('.chamber-home__image--active');
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element || element.hidden || element.getClientRects().length === 0) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    return (
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'home' &&
      root.classList.contains('design-chamber-home') &&
      home &&
      !home.hidden &&
      home.getAttribute('data-active-project') === 'orbital-mk-ii' &&
      !home.hasAttribute('data-transition-state') &&
      home.getAttribute('aria-busy') !== 'true' &&
      activeImage &&
      activeImage.complete &&
      activeImage.naturalWidth > 0 &&
      visible('.chamber-home__pager') &&
      visible('.chamber-home__foot') &&
      visible('.chamber-home__index-button.is-active') &&
      visible('.chamber-home__assets')
    );
  });

  await page.evaluate(async () => {
    const activeImage = document.querySelector('.chamber-home__image--active');
    if (activeImage && typeof activeImage.decode === 'function') {
      await activeImage.decode().catch(() => {});
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function settleSurfaceMedia(page, scrollSelector) {
  await page.evaluate(async (selector) => {
    window.scrollTo(0, 0);
    const scrollRoot = selector ? document.querySelector(selector) : null;
    if (scrollRoot) {
      scrollRoot.scrollTop = 0;
      scrollRoot.scrollLeft = 0;
    }

    document.querySelectorAll('video').forEach((video) => video.pause());
    const visibleImages = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
    await Promise.all(
      visibleImages.map((image) => {
        if (typeof image.decode === 'function') return image.decode();
        return Promise.resolve();
      })
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, scrollSelector);
}

async function waitForHybridCaseReady(page, caseId) {
  await page.waitForFunction((expectedId) => {
    const root = document.documentElement;
    const caseView = document.getElementById('case-view');
    const hero = document.querySelector('#case-scroll-track > .hybrid-case-hero');
    const heroImage = hero?.querySelector('img');
    return (
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'case' &&
      !root.classList.contains('design-chamber-home') &&
      caseView &&
      !caseView.hidden &&
      caseView.getAttribute('data-hybrid-case-ready') === expectedId &&
      document.body.classList.contains('chamber-page-portfolio') &&
      document.querySelectorAll('.hybrid-case-dossier').length === 1 &&
      document.querySelectorAll('#case-scroll-track > .hybrid-case-hero').length === 1 &&
      document.getElementById('case-tab-2d')?.getAttribute('aria-selected') === 'true' &&
      heroImage &&
      heroImage.complete &&
      heroImage.naturalWidth > 0
    );
  }, caseId);
  await settleSurfaceMedia(page, '#case-scroll');
}

async function waitForHybridFreeAssetsReady(page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    const cards = Array.from(document.querySelectorAll('#fa-grid .fa-card'));
    const visibleImages = cards
      .map((card) => card.querySelector('.fa-card__thumb img'))
      .filter((image) => {
        if (!image) return false;
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      });
    return (
      root.getAttribute('data-design-runtime-state') === 'ready' &&
      root.getAttribute('data-design-runtime-ready') === 'hybrid' &&
      root.getAttribute('data-design-surface') === 'free-assets' &&
      document.body.classList.contains('chamber-page-assets') &&
      cards.length === 8 &&
      cards.every((card) => Boolean(card.dataset.chamberIndex)) &&
      visibleImages.length > 0 &&
      visibleImages.every((image) => image.complete && image.naturalWidth > 0) &&
      getComputedStyle(document.querySelector('.layout')).visibility === 'visible'
    );
  });
  await settleSurfaceMedia(page, '.fa-scroll');
}

async function prepare(page, routePath, viewport, query = 'lang=en') {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // model-viewer is blocked so FA mini previews stay as static thumbs in the
  // baselines. Since prod-review F2 the bundle is self-hosted (C-05), so the
  // local vendor path is blocked too (the CDN pattern stays for older refs).
  await page.route('https://ajax.googleapis.com/ajax/libs/model-viewer/**', (route) => route.abort('blockedbyclient'));
  await page.route('**/js/vendor/model-viewer.min.js*', (route) => route.abort('blockedbyclient'));
  await page.goto(`${base}${routePath}?${query}`, { waitUntil: 'networkidle' });
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
      maxDiffPixelRatio: 0.015
    });
  });

  test('index mobile sidebar first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 375, height: 667 });
    await expect(page.locator('body')).not.toHaveClass(/cards-collapsed/);
    await expect(page.locator('.work-card[data-id]')).toHaveCount(18);
    await expect(page).toHaveScreenshot('index-mobile-sidebar.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('free assets desktop grid first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 1440, height: 900 });
    await expect(page.locator('#tag-hard-surface')).toHaveClass(/tag-card--active/);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(8);
    await expect(page).toHaveScreenshot('free-assets-desktop-grid.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('free assets mobile sidebar first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 375, height: 667 });
    await expect(page.locator('body')).not.toHaveClass(/cards-collapsed/);
    await expect(page.locator('.tag-card')).toHaveCount(6);
    await expect(page).toHaveScreenshot('free-assets-mobile-sidebar.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Home desktop first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 1440, height: 1024 }, 'design=hybrid&lang=en');
    await waitForHybridHomeReady(page);
    await expect(page.locator('[data-design-home="hybrid"]')).toBeVisible();
    await expect(page.locator('[data-design-home="hybrid"]')).toHaveAttribute('data-active-project', 'orbital-mk-ii');
    await expect(page.locator('.chamber-home__image--active')).toBeVisible();
    await expect(page.locator('.chamber-home__pager')).toBeVisible();
    await expect(page.locator('.chamber-home__foot')).toBeVisible();
    await expect(page).toHaveScreenshot('hybrid-home-desktop-1440x1024.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Home mobile first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 390, height: 844 }, 'design=hybrid&lang=en');
    await waitForHybridHomeReady(page);
    await expect(page.locator('[data-design-home="hybrid"]')).toBeVisible();
    await expect(page.locator('.chamber-home__image--active')).toBeVisible();
    await expect(page.locator('.chamber-home__pager-button')).toHaveCount(2);
    await expect(page.locator('.chamber-home__foot')).toBeVisible();
    await expect(page).toHaveScreenshot('hybrid-home-mobile-390x844.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Case desktop first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 1440, height: 1024 }, 'design=hybrid&lang=en#orbital-mk-ii');
    await waitForHybridCaseReady(page, 'orbital-mk-ii');
    await expect(page.locator('#case-view')).toBeVisible();
    await expect(page.locator('.hybrid-case-dossier')).toHaveCount(1);
    await expect(page.locator('#case-scroll-track > .hybrid-case-hero')).toHaveCount(1);
    await expect(page.locator('.chamber-case-poster')).toHaveCount(0);
    await expect(page).toHaveScreenshot('hybrid-case-desktop-1440x1024.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Case mobile first viewport', async ({ page }) => {
    await prepare(page, '/index.html', { width: 390, height: 844 }, 'design=hybrid&lang=en#orbital-mk-ii');
    await waitForHybridCaseReady(page, 'orbital-mk-ii');
    await expect(page.locator('#case-view')).toBeVisible();
    await expect(page.locator('.hybrid-case-dossier')).toHaveCount(1);
    await expect(page.locator('#case-scroll-track > .hybrid-case-hero')).toHaveCount(1);
    await expect(page.locator('.chamber-case-poster')).toHaveCount(0);
    await expect(page).toHaveScreenshot('hybrid-case-mobile-390x844.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Free Assets desktop first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 1440, height: 1024 }, 'design=hybrid&lang=en');
    await waitForHybridFreeAssetsReady(page);
    await expect(page.locator('body')).toHaveClass(/chamber-page-assets/);
    await expect(page.locator('#tag-hard-surface')).toHaveClass(/tag-card--active/);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(8);
    await expect(page).toHaveScreenshot('hybrid-free-assets-desktop-1440x1024.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });

  test('Hybrid R2 Free Assets mobile first viewport', async ({ page }) => {
    await prepare(page, '/free-assets.html', { width: 390, height: 844 }, 'design=hybrid&lang=en');
    await waitForHybridFreeAssetsReady(page);
    await expect(page.locator('body')).toHaveClass(/chamber-page-assets/);
    await expect(page.locator('#tag-hard-surface')).toHaveClass(/tag-card--active/);
    await expect(page.locator('#fa-grid .fa-card')).toHaveCount(8);
    await expect(page).toHaveScreenshot('hybrid-free-assets-mobile-390x844.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.015
    });
  });
});
