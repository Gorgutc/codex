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
  await expect(frame.locator('h2[data-i18n="card.orbital-mk-ii.title"]')).toHaveText(RU_DRAFT_TITLE);

  // Обратно EN — опубликованный заголовок (черновик менял только RU)
  await page.click('#preview-lang-en');
  await expect(frame.locator('h2[data-i18n="card.orbital-mk-ii.title"]')).toHaveText('Orbital Mk.II');

  // 5. «Закрыть» возвращает админку, черновик не потерян
  await page.click('#preview-close');
  await expect(page.locator('#preview-overlay')).toBeHidden();
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

  // 3. «Закрыть» возвращает админку, черновик каталога не потерян
  await page.click('#preview-close');
  await expect(page.locator('#preview-overlay')).toBeHidden();
  await expect(page.locator('#draft-indicator')).toBeVisible();
});
