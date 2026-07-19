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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CASE_PATH = 'content/cases/orbital-mk-ii.json';
const RU_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.ru"]`;
const THUMB_INPUT = `[data-media="${CASE_PATH}::card.thumb"]`;
const HIDDEN_CASE = 'vega-shell';
const RU_DRAFT_TITLE = 'Орбитальная станция Мк.II';

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
        res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' }).end(data);
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
        content: fs.readFileSync(abs).toString('base64')
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
  await expect(page.locator('a.work-card[data-id="orbital-mk-ii"]')).toHaveAttribute('href', '#orbital-mk-ii');
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
  await expect(frame.locator('h2[data-i18n="card.orbital-mk-ii.title"]')).toHaveText('Orbital Mk.II');

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
