/* admin-preview.spec.mjs — смоук предпросмотра «как будет» (итерация G,
 * входит в npm run test:admin).
 *
 * Репозиторий раздаётся статикой, GitHub API мокается (page.route), внешний
 * geo-зонд i18n (cloudflare trace) блокируется для детерминизма. Сценарий:
 * черновик RU-заголовка кейса + pending-миниатюра + скрытый кейс →
 * «Предпросмотр» → настоящий index.html в same-origin iframe:
 *   1) скрытый кейс отсутствует в документе превью;
 *   2) pending-миниатюра видна как blob:-URL (файла на сервере ещё нет);
 *   3) переключатель RU показывает черновичный русский заголовок
 *      (inline-словарь I18N_DATA собран из черновика);
 *   4) карточки идут в порядке cardOrder без скрытого кейса;
 *   5) баннер напоминает, что это черновик, «Закрыть» возвращает админку.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { normalizeVisibility } from './fixtures/admin-harness.mjs';
import { visibleCaseIds, visibleFaCategories } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CASE_PATH = 'content/cases/orbital-mk-ii.json';
// Карточка, которая реально есть в СГЕНЕРИРОВАННОМ index.html: Design-Lab
// сценарий проверяет опубликованную страницу, а не черновик, поэтому id
// выводится из контента, а не зашит (prod-review F1, finding D-01).
const SHIPPED_CASE_ID = visibleCaseIds(ROOT)[0];
const RU_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.ru"]`;
const THUMB_INPUT = `[data-media="${CASE_PATH}::card.thumb"]`;
const HIDDEN_CASE = 'vega-shell';
const RU_DRAFT_TITLE = 'Орбитальная станция Мк.II';
// Опубликованный EN-заголовок кейса — из живого контента, не литералом:
// владелец правит тексты через админку, спек не должен от этого краснеть.
const CASE_TITLE_EN = JSON.parse(
  fs.readFileSync(path.join(ROOT, CASE_PATH), 'utf8')
).card.title.en;
const FEATURED_CASE_ID = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'meta.json'), 'utf8'))
  .structuredData.featuredWorks.find((entry) => visibleCaseIds(ROOT).includes(entry.id)).id;
const FEATURED_CASE_PATH = 'content/cases/' + FEATURED_CASE_ID + '.json';

const PNG_BUFFER = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'), // PNG-сигнатура
  Buffer.from('preview-thumb-fixture-bytes')
]);

let server;
let base;

test.beforeAll(async () => {
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webm': 'video/webm'
  };
  await new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (reqPath.endsWith('/')) reqPath += 'index.html';
      const filePath = path.join(ROOT, reqPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404).end();
          return;
        }
        res
          .writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' })
          .end(normalizeVisibility(reqPath, data));
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

// GitHub API: /user + repo для PAT-входа, Contents API с реальными файлами.
// Geo-зонд i18n блокируется: язык превью детерминированно стартует с EN.
async function mockNetwork(page) {
  await page.route('https://www.cloudflare.com/**', (route) => route.abort());
  await page.route('https://api.github.com/**', (route) => {
    const request = route.request();
    const p = new URL(request.url()).pathname;
    const json = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (p === '/user') return json(200, { login: 'owner-test', avatar_url: '' });
    if (p === '/repos/Gorgutc/codex') return json(200, { default_branch: 'main', permissions: { push: true } });
    if (p.startsWith('/repos/Gorgutc/codex/contents/')) {
      const filePath = decodeURIComponent(p.slice('/repos/Gorgutc/codex/contents/'.length));
      const abs = path.join(ROOT, filePath);
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return json(404, { message: 'Not Found' });
      return json(200, {
        type: 'file',
        encoding: 'base64',
        sha: 'sha-' + filePath,
        content: normalizeVisibility(filePath, fs.readFileSync(abs)).toString('base64')
      });
    }
    return json(404, { message: 'unmatched ' + request.method() + ' ' + p });
  });
}

test('Design Lab: public URL is opt-in, canonical stays Original, links retain mode', async ({ page }) => {
  const variantRequests = [];
  page.on('request', (request) => {
    if (/design-(?:specimen|chamber|hybrid)\.(?:css|js)(?:\?|$)/.test(request.url())) {
      variantRequests.push(request.url());
    }
  });

  await page.goto(`${base}/index.html`);
  await expect(page.locator('html')).toHaveAttribute('data-design', 'original');
  await expect(page.locator('[data-codex-design-asset]')).toHaveCount(0);
  expect(variantRequests).toHaveLength(0);

  await page.goto(`${base}/index.html?design=unknown`);
  await expect(page.locator('html')).toHaveAttribute('data-design', 'original');
  await expect(page.locator('[data-codex-design-asset]')).toHaveCount(0);
  expect(variantRequests).toHaveLength(0);

  await page.goto(`${base}/index.html?design=specimen`);
  await expect(page.locator('html')).toHaveAttribute('data-design', 'specimen');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://codex.promo/');
  await expect(page.locator('link[data-codex-design-asset="style"]')).toHaveAttribute('href', /design-specimen\.css$/);
  await expect(page.locator('script[data-codex-design-asset="runtime"]')).toHaveAttribute(
    'src',
    /design-specimen\.js$/
  );
  await expect(page.locator('a[href*="free-assets.html"]').first()).toHaveAttribute('href', /design=specimen/);
  await expect(page.locator(`a.work-card[data-id="${SHIPPED_CASE_ID}"]`)).toHaveAttribute(
    'href',
    `#${SHIPPED_CASE_ID}`
  );
  const designApi = await page.evaluate(() => ({
    mode: window.CodexDesign && window.CodexDesign.mode,
    initialHash: window.CodexDesign && window.CodexDesign.initialHash,
    link: window.CodexDesign && window.CodexDesign.withMode('./free-assets.html?lang=ru#game')
  }));
  expect(designApi).toEqual({
    mode: 'specimen',
    initialHash: '',
    link: '/free-assets.html?lang=ru&design=specimen#game'
  });

  await page.goto(`${base}/index.html?design=hybrid&lang=en`);
  await expect(page.locator('html')).toHaveAttribute('data-design', 'hybrid');
  await expect(page.locator('html')).toHaveAttribute('data-design-runtime-ready', 'hybrid');
  await expect(page.locator('html')).toHaveAttribute('data-design-surface', 'home');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://codex.promo/');
  const hybridAssets = await page.evaluate(() => ({
    css: Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]')).map(
      (asset) => new URL(asset.href).pathname
    ),
    js: Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]')).map(
      (asset) => new URL(asset.src).pathname
    )
  }));
  expect(hybridAssets).toEqual({
    css: ['/css/design-chamber.css', '/css/design-hybrid.css'],
    js: ['/js/design-chamber.js', '/js/design-hybrid.js']
  });
  await expect(page.locator('a[href*="free-assets.html"]').first()).toHaveAttribute('href', /design=hybrid/);

  await page.goto(`${base}/free-assets.html?design=chamber`);
  await expect(page.locator('html')).toHaveAttribute('data-design', 'chamber');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://codex.promo/free-assets.html');
  await expect(page.locator('link[data-codex-design-asset="style"]')).toHaveAttribute('href', /design-chamber\.css$/);
  await expect(page.locator('script[data-codex-design-asset="runtime"]')).toHaveAttribute('src', /design-chamber\.js$/);
  await expect(page.locator('a[href*="index.html"]').first()).toHaveAttribute('href', /design=chamber/);
});

test('превью: черновик в iframe — RU-заголовок, скрытый кейс, blob-миниатюра', async ({ page }) => {
  await mockNetwork(page);
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();

  // 1. Черновик: русский заголовок + pending-миниатюра у orbital-mk-ii
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.fill(RU_TITLE_FIELD, RU_DRAFT_TITLE);
  await page.setInputFiles(THUMB_INPUT, { name: 'new-thumb.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await expect(page.locator('#draft-indicator')).toBeVisible();

  // 2. Скрываем другой кейс выключателем в списке
  await page.click('a.back-link');
  await page.click(`[data-case-toggle="${HIDDEN_CASE}"]`);
  await expect(page.locator(`.case-row[data-case-id="${HIDDEN_CASE}"]`)).toHaveClass(/case-row--off/);

  // 3. Открываем предпросмотр: баннер + настоящий index.html в iframe
  await page.click('#preview-btn');
  await expect(page.locator('#preview-overlay')).toBeVisible();
  await expect(page.locator('#preview-banner')).toContainText('предпросмотр черновика');

  const frame = page.frameLocator('#preview-frame');
  await expect(frame.locator('a.work-card[data-id="orbital-mk-ii"]')).toBeAttached();
  await expect(frame.locator('script[src*="cards-data.js"], script[src*="i18n-data.js"]')).toHaveCount(0);
  await expect(frame.locator('script[src^="blob:"]')).toHaveCount(2);
  await expect
    .poll(() => frame.locator('html').evaluate(() => Boolean(window.CARDS_DATA && window.I18N_DATA)))
    .toBe(true);
  const designToggleOrder = await page
    .locator('.preview-overlay__group--design .preview-toggle')
    .evaluateAll((buttons) => buttons.map((button) => button.id));
  expect(designToggleOrder).toEqual([
    'preview-design-original',
    'preview-design-specimen',
    'preview-design-chamber',
    'preview-design-hybrid'
  ]);
  await expect(page.locator('#preview-design-original')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'original');
  await expect(frame.locator('html')).toHaveAttribute('data-design', 'original');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#preview-lang-en')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-lang-ru')).toHaveAttribute('aria-pressed', 'false');
  await expect(frame.locator('[data-codex-design-asset]')).toHaveCount(0);

  // Скрытый кейс выпал из документа превью
  await expect(frame.locator(`a.work-card[data-id="${HIDDEN_CASE}"]`)).toHaveCount(0);

  // Pending-миниатюра — blob:-URL (нового файла на сервере ещё нет)
  await expect(frame.locator('a.work-card[data-id="orbital-mk-ii"] img')).toHaveAttribute('src', /^blob:/);

  // Порядок карточек = cardOrder без скрытого кейса
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8'));
  const expectedOrder = settings.cardOrder.filter((id) => id !== HIDDEN_CASE);
  const renderedOrder = await frame
    .locator('a.work-card[data-id]')
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-id')));
  expect(renderedOrder).toEqual(expectedOrder);

  // 4. Переключение на RU: заголовок карточки берётся из черновичного словаря
  await page.click('#preview-lang-ru');
  await expect(page.locator('#preview-lang-ru')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(frame.locator('h2[data-i18n="card.orbital-mk-ii.title"]')).toHaveText(RU_DRAFT_TITLE);

  // Обратно EN — опубликованный заголовок (черновик менял только RU)
  await page.click('#preview-lang-en');
  await expect(page.locator('#preview-lang-en')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await expect(frame.locator('h2[data-i18n="card.orbital-mk-ii.title"]')).toHaveText(CASE_TITLE_EN);

  // 5. Design Lab полностью пересобирает iframe; быстрый последний выбор побеждает.
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    window.__previewCreatedUrls = [];
    window.__previewRevokedUrls = [];
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      window.__previewCreatedUrls.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      window.__previewRevokedUrls.push(url);
      revoke(url);
    };
  });
  let previewIndexRequests = 0;
  let releaseStaleRequest;
  const staleRequestGate = new Promise((resolve) => {
    releaseStaleRequest = resolve;
  });
  await page.route(`${base}/index.html`, async (route) => {
    previewIndexRequests += 1;
    if (previewIndexRequests === 1) await staleRequestGate;
    await route.continue();
  });
  await page.click('#preview-lang-ru');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'ru');
  await page.click('#preview-design-specimen');
  await expect.poll(() => previewIndexRequests).toBe(1);
  await page.click('#preview-design-chamber');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'chamber');
  await expect(frame.locator('html')).toHaveAttribute('data-design', 'chamber');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#preview-design-chamber')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-design-specimen')).toHaveAttribute('aria-pressed', 'false');
  await expect(frame.locator('link[data-codex-design-asset="style"]')).toHaveAttribute('href', /design-chamber\.css$/);
  await expect(frame.locator('script[data-codex-design-asset="runtime"]')).toHaveAttribute(
    'src',
    /design-chamber\.js$/
  );
  const previewGeneration = await page.locator('#preview-frame').getAttribute('data-preview-generation');
  await expect(frame.locator('html')).toHaveAttribute('data-preview-generation', previewGeneration);
  await expect.poll(() => previewIndexRequests).toBeGreaterThanOrEqual(2);
  const winnerUrlCount = await page.evaluate(() => window.__previewCreatedUrls.length);
  expect(winnerUrlCount).toBeGreaterThan(0);
  releaseStaleRequest();
  await expect.poll(() => page.evaluate(() => window.__previewCreatedUrls.length)).toBeGreaterThan(winnerUrlCount);
  await expect
    .poll(() =>
      page.evaluate((winnerCount) => {
        const revoked = new Set(window.__previewRevokedUrls);
        const stale = window.__previewCreatedUrls.slice(winnerCount);
        return stale.length > 0 && stale.every((url) => revoked.has(url));
      }, winnerUrlCount)
    )
    .toBe(true);
  const raceLifecycle = await page.evaluate(() => {
    const created = window.__previewCreatedUrls;
    return {
      created: created.length,
      uniqueCreated: new Set(created).size
    };
  });
  expect(raceLifecycle.uniqueCreated).toBe(raceLifecycle.created);

  await page.click('#preview-design-hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-runtime-state', 'ready');
  await expect(frame.locator('html')).toHaveAttribute('data-design-runtime-ready', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-surface', 'home');
  await expect(frame.locator('html')).toHaveClass(/design-chamber-home/);
  await expect(frame.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('#preview-design-hybrid')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-design-chamber')).toHaveAttribute('aria-pressed', 'false');
  const hybridPreviewAssets = await frame.locator('html').evaluate(() => ({
    css: Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]')).map(
      (asset) => new URL(asset.href).pathname
    ),
    js: Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]')).map(
      (asset) => new URL(asset.src).pathname
    )
  }));
  expect(hybridPreviewAssets).toEqual({
    css: ['/css/design-chamber.css', '/css/design-hybrid.css'],
    js: ['/js/design-chamber.js', '/js/design-hybrid.js']
  });
  const hybridPreviewOrder = await frame
    .locator('[data-design-home="hybrid"] [data-design-project]')
    .evaluateAll((controls) => controls.map((control) => control.getAttribute('data-design-project')));
  expect(hybridPreviewOrder).toEqual(expectedOrder);

  await frame.locator('html').evaluate(() => {
    // The preview document is a blob URL with a public <base>; update its own
    // fragment so the in-frame route stays on the draft document.
    window.location.hash = 'orbital-mk-ii';
  });
  await expect(frame.locator('html')).toHaveAttribute('data-design-surface', 'case');
  await expect(frame.locator('html')).not.toHaveClass(/design-chamber-home/);
  await expect(frame.locator('body')).toHaveClass(/chamber-page-portfolio/);
  await expect(frame.locator('#case-view')).toHaveAttribute('data-hybrid-case-ready', 'orbital-mk-ii');
  await expect(frame.locator('.hybrid-case-dossier')).toBeVisible();
  await expect(frame.locator('.hybrid-case-hero')).toBeVisible();
  await expect(frame.locator('.chamber-case-back, .chamber-case-poster, .specimen-case-hero')).toHaveCount(0);
  await frame.locator('.hybrid-case-dossier__back').click();
  await expect(frame.locator('html')).toHaveAttribute('data-design-surface', 'home');
  await expect(frame.locator('html')).toHaveClass(/design-chamber-home/);

  await page.click('#preview-lang-en');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await page.click('#preview-design-original');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'original');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await expect(frame.locator('[data-codex-design-asset]')).toHaveCount(0);

  // 6. Выбор живёт только в памяти вкладки: close/open сохраняет, reload сбрасывает.
  await page.click('#preview-design-hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'hybrid');
  await page.click('#preview-close');
  await expect(page.locator('#preview-overlay')).toBeHidden();
  await page.click('#preview-btn');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'hybrid');
  await expect(page.locator('#preview-design-hybrid')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#preview-close');
  const cleanupLifecycle = await page.evaluate(() => {
    const revoked = new Set(window.__previewRevokedUrls);
    return window.__previewCreatedUrls.every((url) => revoked.has(url));
  });
  expect(cleanupLifecycle).toBe(true);

  await page.reload();
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click('#preview-btn');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'original');
  await expect(page.locator('#preview-design-original')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#preview-close');
  await expect(page.locator('#draft-indicator')).toBeVisible();
});

test('preview rewrites runtime, grid and featured JSON-LD routes from the full draft', async ({ page }) => {
  await mockNetwork(page);
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.click(`a[href="#/case/${FEATURED_CASE_ID}"]`);

  const slug = 'preview-' + FEATURED_CASE_ID;
  const legacy = 'previous-' + FEATURED_CASE_ID;
  const canonical = page.locator('#case-public-slug');
  await canonical.fill(slug);
  await canonical.blur();
  await page.locator('#case-legacy-slugs').fill(legacy);
  await page.click('#preview-btn');
  const frame = page.frameLocator('#preview-frame');
  await expect(frame.locator(`a.work-card[data-id="${FEATURED_CASE_ID}"]`)).toHaveAttribute('href', '#' + slug);
  await expect.poll(() => frame.locator('html').evaluate(() => Boolean(window.CARDS_DATA && window.CodexCase))).toBe(true);

  const routeState = await frame.locator('html').evaluate((_element, route) => ({
    runtime: window.CARDS_DATA[route.id],
    runtimeKeys: Object.keys(window.CARDS_DATA),
    stable: window.CodexCase.resolveCaseToken(route.id),
    legacy: window.CodexCase.resolveCaseToken(route.legacyToken),
    featuredUrls: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((script) => {
      const value = JSON.parse(script.textContent);
      return value['@type'] === 'ItemList' ? value.itemListElement.map((entry) => entry.item.url) : [];
    })
  }), { id: FEATURED_CASE_ID, legacyToken: legacy });
  expect(routeState.runtime).toBeTruthy();
  expect(routeState.runtime.slug).toBe(slug);
  expect(routeState.runtime.legacySlugs).toEqual([legacy]);
  expect(routeState.stable).toBe(FEATURED_CASE_ID);
  expect(routeState.legacy).toBe(FEATURED_CASE_ID);
  expect(routeState.featuredUrls).toContain('https://codex.promo/#' + slug);
});

test('featured works keep paired id/about order, persist internal IDs, block duplicates, and preview canonical routes', async ({ page }) => {
  await mockNetwork(page);
  const metaPath = 'content/meta.json';
  const initial = JSON.parse(fs.readFileSync(path.join(ROOT, metaPath), 'utf8')).structuredData.featuredWorks;
  expect(initial.length).toBeGreaterThan(1);
  const catalogIds = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8')).cardOrder;
  const replacement = catalogIds.find((id) => !initial.some((feature) => feature.id === id));
  expect(replacement).toBeTruthy();

  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.click('a[href="#/meta"]');

  // Move the second row up, then the first back down: the whole object must
  // move, so its about stays paired with its internal case id in persisted draft.
  await page.click('#meta-featured-works [data-reorder="featured-1::up"]');
  const swapped = [initial[1], initial[0], ...initial.slice(2)];
  await page.waitForFunction((expected) => {
    const stored = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    return JSON.stringify(stored.files && stored.files['content/meta.json'] && stored.files['content/meta.json'].structuredData.featuredWorks) === JSON.stringify(expected);
  }, swapped);
  await page.click('#meta-featured-works [data-reorder="featured-0::down"]');
  await expect.poll(() => page.evaluate(() => window.AdminState.getValue('content/meta.json', 'structuredData.featuredWorks'))).toEqual(initial);

  // Change a select to an internal catalog ID, then reorder again for the
  // preview assertions. The editor never writes a public slug into metadata.
  const firstSelect = page.locator('[data-field="content/meta.json::structuredData.featuredWorks.0.id"]');
  await firstSelect.selectOption(replacement);
  const reordered = [{ ...initial[1] }, { ...initial[0], id: replacement }, ...initial.slice(2).map((feature) => ({ ...feature }))];
  await page.click('#meta-featured-works [data-reorder="featured-1::up"]');
  await page.waitForFunction((expected) => {
    const stored = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    return JSON.stringify(stored.files && stored.files['content/meta.json'] && stored.files['content/meta.json'].structuredData.featuredWorks) === JSON.stringify(expected);
  }, reordered);

  await page.click('#preview-btn');
  const frame = page.frameLocator('#preview-frame');
  await expect.poll(() => frame.locator('html').evaluate(() => Boolean(window.CARDS_DATA))).toBe(true);
  const expectedPreview = reordered.map((feature) => {
    const data = JSON.parse(normalizeVisibility('content/cases/' + feature.id + '.json', fs.readFileSync(path.join(ROOT, 'content', 'cases', feature.id + '.json'))).toString('utf8'));
    return { about: feature.about, url: 'https://codex.promo/#' + (data.slug || data.id) };
  });
  const featuredPreview = await frame.locator('html').evaluate(() => {
    const itemList = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => JSON.parse(script.textContent))
      .find((node) => node['@type'] === 'ItemList' && node.name === 'Codex Studio — Featured Works');
    return itemList.itemListElement.map((entry) => ({ position: entry.position, about: entry.item.about, url: entry.item.url }));
  });
  expect(featuredPreview).toEqual(expectedPreview.map((entry, index) => ({ position: index + 1, ...entry })));
  await page.click('#preview-close');

  // Duplicate IDs are rejected at publish time and the offending select is anchored.
  await page.locator('[data-field="content/meta.json::structuredData.featuredWorks.1.id"]').selectOption(reordered[0].id);
  await page.click('#publish-btn');
  await expect(page.locator('[data-field="content/meta.json::structuredData.featuredWorks.1.id"]')).toHaveClass(/field-invalid/);
  await expect(page.locator('.field-error-msg')).toContainText('встречается дважды');
});

test('превью Free Assets (F5): скрытая категория выпадает, грид рендерит черновик', async ({ page }) => {
  await mockNetwork(page);
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();

  // 1. Экран Free Assets + черновик: выключаем категорию «organic»
  await page.click('a[href="#/free-assets"]');
  await expect(page.locator('#fa-cat-list')).toBeVisible();
  const HIDDEN_CAT = 'organic';
  await page.uncheck(`[data-fa-category-toggle="${HIDDEN_CAT}"]`);
  await expect(page.locator(`.fa-cat[data-fa-category="${HIDDEN_CAT}"]`)).toHaveClass(/fa-cat--off/);
  await expect(page.locator('#draft-indicator')).toBeVisible();

  // 2. Предпросмотр: настоящий free-assets.html в same-origin iframe
  await page.click('#preview-btn');
  await expect(page.locator('#preview-overlay')).toBeVisible();
  await expect(page.locator('#preview-banner')).toContainText('Free Assets');

  const frame = page.frameLocator('#preview-frame');
  await expect(frame.locator('script[src*="fa-data.js"], script[src*="i18n-data.js"]')).toHaveCount(0);
  await expect(frame.locator('script[src^="blob:"]')).toHaveCount(2);
  await expect
    .poll(() => frame.locator('html').evaluate(() => Boolean(window.FA_DATA && window.I18N_DATA)))
    .toBe(true);
  // Обзор категорий: видимая категория есть, скрытая выпала
  await expect(frame.locator('a.tag-card[data-tag="hard-surface"]')).toBeAttached();
  await expect(frame.locator(`a.tag-card[data-tag="${HIDDEN_CAT}"]`)).toHaveCount(0);
  // Дропдаун фильтров пересобран без скрытой категории
  await expect(frame.locator(`#tags-dropdown-panel [data-filter="${HIDDEN_CAT}"]`)).toHaveCount(0);
  // Грид ассетов отрисован из черновичного FA_DATA (стартовая категория)
  await expect(frame.locator('#fa-grid .fa-card').first()).toBeAttached();

  // Design Lab доступен и для полного каталога Free Assets.
  await page.click('#preview-design-specimen');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'specimen');
  await expect(frame.locator('html')).toHaveAttribute('data-design', 'specimen');
  await expect(frame.locator('link[data-codex-design-asset="style"]')).toHaveAttribute('href', /design-specimen\.css$/);

  await page.click('#preview-design-hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-preview', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-runtime-ready', 'hybrid');
  await expect(frame.locator('html')).toHaveAttribute('data-design-surface', 'free-assets');
  await expect(frame.locator('html')).not.toHaveClass(/design-chamber-home/);
  await expect(frame.locator('body')).toHaveClass(/chamber-page-assets/);
  await expect(frame.locator('body')).not.toHaveClass(/specimen-fa-page/);
  await expect(page.locator('#preview-design-hybrid')).toHaveAttribute('aria-pressed', 'true');
  const hybridAssets = await frame.locator('html').evaluate(() => ({
    css: Array.from(document.querySelectorAll('link[data-codex-design-asset="style"]')).map(
      (asset) => new URL(asset.href).pathname
    ),
    js: Array.from(document.querySelectorAll('script[data-codex-design-asset="runtime"]')).map(
      (asset) => new URL(asset.src).pathname
    )
  }));
  expect(hybridAssets).toEqual({
    css: ['/css/design-chamber.css', '/css/design-hybrid.css'],
    js: ['/js/design-chamber.js', '/js/design-hybrid.js']
  });
  await expect(frame.locator('a.tag-card[data-tag="hard-surface"]')).toBeAttached();
  await expect(frame.locator(`a.tag-card[data-tag="${HIDDEN_CAT}"]`)).toHaveCount(0);
  await expect(frame.locator('#fa-grid .fa-card').first()).toHaveAttribute('data-chamber-index', '01');
  expect(
    await frame
      .locator('#fa-grid .fa-card')
      .evaluateAll((cards) =>
        cards.every((card, index) => card.dataset.chamberIndex === String(index + 1).padStart(2, '0'))
      )
  ).toBe(true);
  await expect(frame.locator('.fa-card__thumb-mv[data-codex-preview-enabled="true"]')).toHaveCount(0);
  await expect(frame.locator('script[src*="model-viewer.min.js"]')).toHaveCount(0);

  // 3. «Закрыть» возвращает админку, черновик каталога не потерян
  await page.click('#preview-close');
  await expect(page.locator('#preview-overlay')).toBeHidden();
  await expect(page.locator('#draft-indicator')).toBeVisible();
});

/* FA-POSTER-01: обложка категории в превью берётся из ЧЕРНОВИКА, в том числе у
 * уже отрисованной карточки. rebuildFaTagCards переиспользует разметку
 * опубликованной страницы ради i18n-fidelity — до этого фикса переиспользованная
 * карточка сохраняла ОПУБЛИКОВАННУЮ обложку, поэтому правка обложки (и тем более
 * переход на растр) не доезжала до превью вообще, а растровая ветка buildTagCard
 * срабатывала только для вновь включённой категории. */
test('превью Free Assets: растровая обложка категории из черновика доезжает до tag-карточки', async ({ page }) => {
  await mockNetwork(page);
  const FA_PATH = 'content/free-assets.json';
  const RASTER_COVER = './assets/cards/zz-preview-cover-fixture.png';
  const draft = JSON.parse(normalizeVisibility(FA_PATH, fs.readFileSync(path.join(ROOT, FA_PATH))).toString('utf8'));
  // The target MUST be a category the published free-assets.html already
  // renders — that is the reuse path (rebuildFaTagCards keeps the shipped
  // markup for i18n fidelity), which is exactly where the draft cover used to
  // be dropped. A category the published page never rendered would take the
  // buildTagCard path instead and prove nothing about the regression.
  const shippedKey = visibleFaCategories(ROOT)[0] && visibleFaCategories(ROOT)[0].key;
  test.skip(!shippedKey, 'skipped: no visible Free Assets category in the shipped page');
  const target = draft.categories.find((category) => category.key === shippedKey);
  const targetKey = target.key;
  const vectorKey = (draft.categories.find((category) => category.key !== targetKey) || {}).key || null;
  target.tagCard = { ...(target.tagCard || {}), thumb: RASTER_COVER };
  await page.addInitScript(
    (store) => {
      const baseShas = {};
      for (const key of Object.keys(store)) baseShas[key] = 'sha-' + key;
      sessionStorage.setItem('codexAdminDrafts', JSON.stringify({ version: 2, files: store, baseShas }));
    },
    { [FA_PATH]: draft }
  );

  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click('a[href="#/free-assets"]');
  await expect(page.locator('#fa-cat-list')).toBeVisible();

  await page.click('#preview-btn');
  await expect(page.locator('#preview-overlay')).toBeVisible();
  const frame = page.frameLocator('#preview-frame');

  const cover = frame.locator(`a.tag-card[data-tag="${targetKey}"] .tag-card__thumb`);
  await expect(cover).toHaveAttribute('data-poster-kind', 'raster');
  await expect(cover.locator('img')).toHaveAttribute('src', RASTER_COVER);
  if (vectorKey) {
    // Контроль: нетронутая категория осталась вектором и без атрибута.
    const vectorCover = frame.locator(`a.tag-card[data-tag="${vectorKey}"] .tag-card__thumb`);
    await expect(vectorCover).not.toHaveAttribute('data-poster-kind', /.*/);
    await expect(vectorCover.locator('img')).toHaveAttribute('src', /\.svg$/);
  }

  await page.click('#preview-close');
  await expect(page.locator('#preview-overlay')).toBeHidden();
});

test('preview applies draft contact, Organization and featured-work identity', async ({ page }) => {
  await mockNetwork(page);
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.click('a[href="#/meta"]');

  const contact = 'https://example.test/contact';
  await page.fill('#meta-contact-url', contact);
  await page.fill('#meta-organization-name', 'Preview Studio');
  await page.fill('#meta-organization-alternate-name', 'Preview');
  await page.fill('#meta-organization-url', 'https://example.test/');
  await page.fill('#meta-organization-same-as', 'https://example.test/community');
  await page.fill('[data-field="content/meta.json::structuredData.organization.description.en"]', 'Preview English description');
  await page.fill('[data-field="content/meta.json::structuredData.organization.description.ru"]', 'Описание предпросмотра');
  await page.locator('[data-field^="content/meta.json::structuredData.featuredWorks."][data-field$=".about"]').first().fill('Preview featured about');

  await page.click('#preview-btn');
  const frame = page.frameLocator('#preview-frame');
  await expect(frame.locator('#contact-btn')).toHaveAttribute('href', contact);
  await expect(frame.locator('#contact-pill')).toHaveAttribute('href', contact);
  const identity = await frame.locator('html').evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script) => JSON.parse(script.textContent));
    const organization = nodes.find((node) => node['@type'] === 'Organization');
    const website = nodes.find((node) => node['@type'] === 'WebSite');
    const featured = nodes.find((node) => node['@type'] === 'ItemList' && node.name === 'Codex Studio — Featured Works');
    return { organization, publisher: website && website.publisher, featuredAbout: featured && featured.itemListElement[0].item.about };
  });
  expect(identity.organization).toMatchObject({
    name: 'Preview Studio',
    alternateName: 'Preview',
    url: 'https://example.test/',
    description: 'Preview English description',
    sameAs: ['https://example.test/community']
  });
  expect(identity.publisher).toEqual({ '@type': 'Organization', name: 'Preview Studio', url: 'https://example.test/' });
  expect(identity.featuredAbout).toBe('Preview featured about');
});

test('preview keeps hostile draft JSON-LD data inert and parseable inside srcdoc', async ({ page }) => {
  await mockNetwork(page);
  const metaPath = 'content/meta.json';
  const draft = JSON.parse(normalizeVisibility(metaPath, fs.readFileSync(path.join(ROOT, metaPath))).toString('utf8'));
  const hostile = '</script><script id="preview-xss-script">window.__previewXssScript=1</script><img id="preview-xss-probe" src=x onerror="window.__previewXss=1">\u2028\u2029';
  draft.structuredData.organization.name = hostile;
  draft.structuredData.organization.alternateName = hostile;
  draft.structuredData.organization.description.en = hostile;
  draft.structuredData.featuredWorks[0].about = hostile;
  await page.addInitScript(
    ({ path, value }) => sessionStorage.setItem('codexAdminDrafts', JSON.stringify({
      version: 2,
      files: { [path]: value },
      baseShas: { [path]: 'sha-' + path }
    })),
    { path: metaPath, value: draft }
  );

  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.click('a[href="#/meta"]');
  await page.click('#preview-btn');

  const frame = page.frameLocator('#preview-frame');
  await expect(frame.locator('#preview-xss-probe')).toHaveCount(0);
  await expect(frame.locator('#preview-xss-script')).toHaveCount(0);
  const safety = await frame.locator('html').evaluate((expected) => {
    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((script) => JSON.parse(script.textContent));
    const organization = jsonLd.find((node) => node['@type'] === 'Organization');
    const website = jsonLd.find((node) => node['@type'] === 'WebSite');
    const featured = jsonLd.find((node) => node['@type'] === 'ItemList' && node.name === 'Codex Studio — Featured Works');
    return {
      xssGlobal: window.__previewXss,
      xssScriptGlobal: window.__previewXssScript,
      appAlive: Boolean(window.CARDS_DATA && document.getElementById('cards-list')),
      organization: organization && [organization.name, organization.alternateName, organization.description],
      website: website && [website.name, website.publisher && website.publisher.name],
      featured: featured && featured.itemListElement[0].item.about,
      expected
    };
  }, hostile);
  expect(safety.xssGlobal).toBeUndefined();
  expect(safety.xssScriptGlobal).toBeUndefined();
  expect(safety.appAlive).toBe(true);
  expect(safety.organization).toEqual([hostile, hostile, hostile]);
  expect(safety.website).toEqual([hostile, hostile]);
  expect(safety.featured).toBe(hostile);

  // Free Assets carries the WebPage node, so verify the same serialized draft
  // survives that rewrite too rather than only testing the home-page schema.
  await page.click('#preview-close');
  await page.click('a[href="#/free-assets"]');
  await page.click('#preview-btn');
  const freeFrame = page.frameLocator('#preview-frame');
  await expect.poll(() => freeFrame.locator('html').evaluate(() => Boolean(window.FA_DATA))).toBe(true);
  const pageIdentity = await freeFrame.locator('html').evaluate(() => {
    const node = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => JSON.parse(script.textContent))
      .find((item) => item['@type'] === 'WebPage');
    return [node.publisher && node.publisher.name, node.isPartOf && node.isPartOf.name];
  });
  expect(pageIdentity).toEqual([hostile, hostile]);
});
