/* capture-content-golden.mjs — one-off golden fixture capture (Iteration B).
 *
 * Boots the same kind of internal static server as verify-frozen.js, opens
 * index.html and free-assets.html in headless Chromium and snapshots the
 * runtime content state into committed JSON fixtures:
 *
 *   tests/quality/fixtures/cards-data.json      — window.CARDS_DATA (post-makeItems form)
 *   tests/quality/fixtures/cards-grid.json      — #cards-list innerHTML (CODEX:GEN markers stripped)
 *   tests/quality/fixtures/i18n-data-index.json — window.I18N_DATA on index.html
 *   tests/quality/fixtures/fa-data.json         — window.FA_DATA on free-assets.html
 *   tests/quality/fixtures/i18n-data-fa.json    — window.I18N_DATA on free-assets.html
 *
 * Determinism: pages are loaded with ?lang=en (skips async geo detection),
 * reduced motion (skips GSAP card reveal mutations) and with all external
 * requests aborted. No timestamps are written.
 *
 * Usage: node scripts/capture-content-golden.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { visibleCaseIds } from './content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'quality', 'fixtures');
// Derived from content/, NOT hardcoded (prod-review F1, finding D-01): a
// hidden case used to time this wait out INSIDE the content-publish pipeline
// after verify had already passed, leaving main without regeneration and
// without the auto-revert.
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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
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
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export function stripGenMarkers(html) {
  return html.replace(/[ \t]*<!-- CODEX:GEN cards-grid (?:BEGIN|END) -->\r?\n/g, '');
}

function writeFixture(name, value) {
  const target = path.join(FIXTURES_DIR, name);
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  console.log(`written ${path.relative(ROOT, target)}`);
}

async function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());

  try {
    const page = await context.newPage();

    await page.goto(`${base}/index.html?lang=en`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (expectedCards) =>
        !document.documentElement.classList.contains('is-loading') &&
        document.querySelectorAll('#cards-list .work-card').length === expectedCards &&
        !!document.querySelector('.work-card--active') &&
        document.querySelectorAll('#case-scroll-track .case-item').length > 0,
      VISIBLE_CARD_COUNT
    );
    const indexState = await page.evaluate(() => ({
      cardsData: JSON.parse(JSON.stringify(window.CARDS_DATA)),
      i18nData: JSON.parse(JSON.stringify(window.I18N_DATA)),
      gridHTML: document.getElementById('cards-list').innerHTML
    }));

    await page.goto(`${base}/free-assets.html?lang=en`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        !document.documentElement.classList.contains('is-loading') &&
        document.querySelectorAll('#fa-grid .fa-card').length > 0
    );
    const faState = await page.evaluate(() => ({
      faData: JSON.parse(JSON.stringify(window.FA_DATA)),
      i18nData: JSON.parse(JSON.stringify(window.I18N_DATA))
    }));

    writeFixture('cards-data.json', indexState.cardsData);
    writeFixture('cards-grid.json', { innerHTML: stripGenMarkers(indexState.gridHTML) });
    writeFixture('i18n-data-index.json', indexState.i18nData);
    writeFixture('fa-data.json', faState.faData);
    writeFixture('i18n-data-fa.json', faState.i18nData);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
