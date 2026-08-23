/* content-golden.spec.mjs — golden equivalence gate for the content data layer (Iteration B).
 *
 * Deep-compares the runtime content state of both pages against the committed
 * fixtures in tests/quality/fixtures/ (captured by scripts/capture-content-golden.mjs):
 *   - window.CARDS_DATA (post-makeItems expanded form) on index.html
 *   - #cards-list innerHTML on index.html (CODEX:GEN markers stripped)
 *   - window.I18N_DATA dictionaries on both pages
 *   - window.FA_DATA on free-assets.html
 *
 * Pages are loaded with ?lang=en, reduced motion and aborted external requests —
 * the exact conditions the fixtures were captured under.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { visibleCaseIds } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'quality', 'fixtures');
// Derived from content/, NOT hardcoded (prod-review F1, finding D-01) — the
// same selection the capture script, verify-frozen.js and the generator use.
const VISIBLE_CARD_COUNT = visibleCaseIds(ROOT).length;

const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xml': 'application/xml'
};

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

function stripGenMarkers(html) {
  return html.replace(/[ \t]*<!-- CODEX:GEN cards-grid (?:BEGIN|END) -->\r?\n/g, '');
}

function dataScriptUrl(html, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<script\\s+src=["']([^"']*${escaped}(?:\\?[^"']*)?)["']`, 'i').exec(html);
  if (!match) throw new Error(`missing ${fileName} data script`);
  return match[1];
}

let server;
let base;

test.use({ viewport: { width: 1440, height: 900 } });

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

test.beforeEach(async ({ context, page }) => {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  // Same conditions as scripts/capture-content-golden.mjs: reduced motion keeps
  // the GSAP reveal pass (animations.js) from mutating the captured grid markup.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('index.html runtime CARDS_DATA, grid markup and i18n dictionaries match the golden fixtures', async ({ page }) => {
  await page.goto(`${base}/index.html?lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    (expectedCards) =>
      !document.documentElement.classList.contains('is-loading') &&
      document.querySelectorAll('#cards-list .work-card').length === expectedCards &&
      !!document.querySelector('.work-card--active') &&
      document.querySelectorAll('#case-scroll-track .case-item').length > 0,
    VISIBLE_CARD_COUNT
  );

  const state = await page.evaluate(() => ({
    cardsData: JSON.parse(JSON.stringify(window.CARDS_DATA)),
    i18nData: JSON.parse(JSON.stringify(window.I18N_DATA)),
    gridHTML: document.getElementById('cards-list').innerHTML
  }));

  expect(state.cardsData).toEqual(readFixture('cards-data.json'));
  expect(stripGenMarkers(state.gridHTML)).toBe(readFixture('cards-grid.json').innerHTML);
  expect(state.i18nData).toEqual(readFixture('i18n-data-index.json'));
});

test('free-assets.html runtime FA_DATA and i18n dictionaries match the golden fixtures', async ({ page }) => {
  await page.goto(`${base}/free-assets.html?lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () =>
      !document.documentElement.classList.contains('is-loading') &&
      document.querySelectorAll('#fa-grid .fa-card').length > 0
  );

  const state = await page.evaluate(() => ({
    faData: JSON.parse(JSON.stringify(window.FA_DATA)),
    i18nData: JSON.parse(JSON.stringify(window.I18N_DATA))
  }));

  expect(state.faData).toEqual(readFixture('fa-data.json'));
  expect(state.i18nData).toEqual(readFixture('i18n-data-fa.json'));
});

test('a regenerated index reloads versioned data payloads instead of immutable legacy cache entries', async ({ browser }) => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const legacyHtml = indexHtml
    .replace(/(\.\/js\/cards-data\.js)(?:\?[^"']*)?/g, '$1')
    .replace(/(\.\/js\/i18n-data\.js)(?:\?[^"']*)?/g, '$1');
  const currentCardsUrl = dataScriptUrl(indexHtml, 'cards-data.js');
  const currentI18nUrl = dataScriptUrl(indexHtml, 'i18n-data.js');
  const payloads = {
    cards: fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8'),
    i18n: fs.readFileSync(path.join(ROOT, 'js', 'i18n-data.js'), 'utf8')
  };
  let generation = 'legacy';
  const requests = [];
  const coherenceServer = await new Promise((resolve) => {
    const instance = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const isLegacyBarePayload = generation === 'legacy' && /^\/js\/(?:cards|i18n)-data\.js$/.test(url.pathname) && !url.search;
      if (/^\/js\/(?:cards|i18n)-data\.js$/.test(url.pathname)) requests.push(url.pathname + url.search);
      if (url.pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        res.end(generation === 'legacy' ? legacyHtml : indexHtml);
        return;
      }
      if (url.pathname === '/js/cards-data.js' || url.pathname === '/js/i18n-data.js') {
        const key = url.pathname.includes('cards') ? 'cards' : 'i18n';
        res.writeHead(200, {
          'Content-Type': 'text/javascript',
          'Cache-Control': isLegacyBarePayload ? 'public, max-age=31536000, immutable' : 'no-store'
        });
        res.end(`${payloads[key]}\nwindow.__cacheRevisionSentinel = ${JSON.stringify(generation)};`);
        return;
      }
      const filePath = path.join(ROOT, url.pathname);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) return res.writeHead(404).end('not found');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const coherenceBase = `http://127.0.0.1:${coherenceServer.address().port}`;
  // Do not add Playwright routing to this context: enabling routes disables
  // the HTTP cache, which would make the returning-browser scenario vacuous.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${coherenceBase}/index.html?lang=en`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => window.__cacheRevisionSentinel)).toBe('legacy');

    generation = 'current';
    await page.goto(`${coherenceBase}/index.html?lang=en`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => window.__cacheRevisionSentinel)).toBe('current');
    expect(requests).toContain(new URL(currentCardsUrl, coherenceBase).pathname + new URL(currentCardsUrl, coherenceBase).search);
    expect(requests).toContain(new URL(currentI18nUrl, coherenceBase).pathname + new URL(currentI18nUrl, coherenceBase).search);
    expect(currentCardsUrl).toMatch(/\?v=[0-9a-f]{64}$/);
    expect(currentI18nUrl).toMatch(/\?v=[0-9a-f]{64}$/);
  } finally {
    await page.close();
    await context.close();
    await new Promise((resolve) => coherenceServer.close(resolve));
  }
});
