/* admin-free-assets.spec.mjs — смоук экрана «Free Assets» (итерация H),
 * входит в npm run test:admin.
 *
 * Репозиторий раздаётся статикой, ВЕСЬ GitHub API мокается (page.route):
 * Contents API читает реальные файлы с диска, Git Data API пишет журнал
 * вызовов для ассертов. Сценарии:
 *   1) правка RU-описания ассета → индикатор «несохранённые изменения» и
 *      черновик content/free-assets.json в sessionStorage;
 *   2) выключение ассета → строка мгновенно затемняется + бейдж «скрыто» +
 *      enabled:false в черновике; включение обратно очищает черновик;
 *   3) перестановка ассета кнопками ↑/↓ внутри категории меняет порядок
 *      items в черновике (тост «Порядок сохранён в черновик»);
 *   4) замена GLB-превью через setInputFiles → pending-бейдж, публикация
 *      несёт бинарный blob assets/models/free/{id}-{hash8}.glb и обновлённый
 *      free-assets.json, где model = БАЗОВОЕ имя (без папки и расширения);
 *   5) русский guard при попытке скрыть последний видимый ассет;
 *   6) выключение категории → её ассеты с бейджем «категория скрыта»;
 *   7) тогл постера вкл→выкл у ассета с thumb:null в base возвращает чистый
 *      черновик (deepEqual канонизирует порядок ключей), а отсутствующий
 *      файл по умолчанию даёт русскую ошибку, блокирующую публикацию.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FA_PATH = 'content/free-assets.json';
const FIRST_ITEM_BASE = 'categories.0.items.0';
const DESC_RU_FIELD = `[data-field="${FA_PATH}::${FIRST_ITEM_BASE}.desc.ru"]`;
const MODEL_INPUT = `[data-media="${FA_PATH}::${FIRST_ITEM_BASE}.model"]`;

const faJson = JSON.parse(fs.readFileSync(path.join(ROOT, FA_PATH), 'utf8'));
const FIRST_CATEGORY = faJson.categories[0];
const FIRST_ID = FIRST_CATEGORY.items[0].id;
const SECOND_ID = FIRST_CATEGORY.items[1].id;

const GLB_BUFFER = Buffer.concat([Buffer.from('676c5446', 'hex'), crypto.randomBytes(8192)]);

function hash8(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

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
    '.glb': 'model/gltf-binary'
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

// Полный мок GitHub REST API с журналом blob'ов и tree для ассертов.
async function mockGitHub(page) {
  const calls = { blobs: [], tree: [], commitMessage: '', refUpdated: false };
  await page.route('https://api.github.com/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const method = request.method();
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
    if (p === '/repos/Gorgutc/codex/git/ref/heads/main') return json(200, { object: { sha: 'headsha000' } });
    if (p === '/repos/Gorgutc/codex/git/commits/headsha000') return json(200, { tree: { sha: 'treesha000' } });
    if (p === '/repos/Gorgutc/codex/git/blobs' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      const sha = 'blobsha-' + calls.blobs.length;
      calls.blobs.push({ sha, content: body.content || '', encoding: body.encoding || '' });
      return json(201, { sha });
    }
    if (p === '/repos/Gorgutc/codex/git/trees' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      calls.tree = body.tree || [];
      return json(201, { sha: 'newtree000' });
    }
    if (p === '/repos/Gorgutc/codex/git/commits' && method === 'POST') {
      calls.commitMessage = JSON.parse(request.postData() || '{}').message || '';
      return json(201, { sha: 'newcommit0' });
    }
    if (p === '/repos/Gorgutc/codex/git/refs/heads/main' && method === 'PATCH') {
      calls.refUpdated = true;
      return json(200, { object: { sha: 'newcommit0' } });
    }
    if (p === '/repos/Gorgutc/codex/commits') {
      return json(200, [
        {
          sha: 'botsha0000',
          html_url: 'https://github.com/Gorgutc/codex/commit/botsha0000',
          commit: { message: 'chore(content): regenerate shipped files [content-publish]' }
        }
      ]);
    }
    return json(404, { message: 'unmatched ' + method + ' ' + p });
  });
  return calls;
}

async function openFreeAssets(page) {
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click('a[data-nav="free-assets"]');
  await expect(page.locator('.fa-cat').first()).toBeVisible();
}

test('правка RU-описания ассета: индикатор черновика и sessionStorage', async ({ page }) => {
  await mockGitHub(page);
  await openFreeAssets(page);

  // экран: группы категорий в порядке content, первая — с ассетами
  await expect(page.locator('.fa-cat')).toHaveCount(faJson.categories.length);
  await expect(page.locator('.fa-cat').first().locator('.fa-item-row')).toHaveCount(FIRST_CATEGORY.items.length);

  await page.click(`a[href="#/free-assets/${FIRST_ID}"]`);
  const descRu = page.locator(DESC_RU_FIELD);
  await expect(descRu).toBeAttached();
  await descRu.fill('Новое русское описание ассета.');

  await expect(page.locator('#draft-indicator')).toBeVisible();
  await page.waitForFunction(() => {
    const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = drafts['content/free-assets.json'];
    return !!draft && draft.categories[0].items[0].desc.ru === 'Новое русское описание ассета.';
  });
});

test('выключение ассета: затемнение, бейдж «скрыто», черновик enabled:false', async ({ page }) => {
  await mockGitHub(page);
  await openFreeAssets(page);

  const row = page.locator(`.fa-item-row[data-fa-item="${SECOND_ID}"]`);
  await expect(row).not.toHaveClass(/case-row--off/);
  await row.locator('.switch input').click();

  await expect(row).toHaveClass(/case-row--off/);
  await expect(row.locator('.badge--off')).toHaveText('скрыто');
  await expect(page.locator('#draft-indicator')).toBeVisible();
  await page.waitForFunction((id) => {
    const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = drafts['content/free-assets.json'];
    if (!draft) return false;
    const item = draft.categories[0].items.find((entry) => entry.id === id);
    return !!item && item.enabled === false;
  }, SECOND_ID);

  // включаем обратно — поле enabled удаляется, черновик снова чистый
  await row.locator('.switch input').click();
  await expect(row).not.toHaveClass(/case-row--off/);
  await expect(row.locator('.badge--off')).toHaveCount(0);
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('перестановка ассета кнопками ↑/↓ меняет порядок items в черновике', async ({ page }) => {
  await mockGitHub(page);
  await openFreeAssets(page);

  const firstCat = page.locator('.fa-cat').first();
  await expect(firstCat.locator('.fa-item-row').first()).toHaveAttribute('data-fa-item', FIRST_ID);
  await expect(firstCat.locator(`[data-reorder="fa-item::${FIRST_ID}::up"]`)).toBeDisabled();

  await firstCat.locator(`[data-reorder="fa-item::${FIRST_ID}::down"]`).click();
  await expect(page.locator('.toast')).toContainText('Порядок сохранён в черновик');
  await expect(firstCat.locator('.fa-item-row').first()).toHaveAttribute('data-fa-item', SECOND_ID);
  await expect(firstCat.locator('.fa-item-row').nth(1)).toHaveAttribute('data-fa-item', FIRST_ID);

  await page.waitForFunction(
    ([a, b]) => {
      const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
      const draft = drafts['content/free-assets.json'];
      return !!draft && draft.categories[0].items[0].id === b && draft.categories[0].items[1].id === a;
    },
    [FIRST_ID, SECOND_ID]
  );
});

test('замена GLB-превью: pending hash-путь, публикация несёт free-assets.json', async ({ page }) => {
  const calls = await mockGitHub(page);
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  await openFreeAssets(page);
  await page.click(`a[href="#/free-assets/${FIRST_ID}"]`);
  await expect(page.locator(MODEL_INPUT)).toBeAttached();

  await page.setInputFiles(MODEL_INPUT, {
    name: 'new-preview.glb',
    mimeType: 'model/gltf-binary',
    buffer: GLB_BUFFER
  });

  const glbHash = hash8(GLB_BUFFER);
  const newBase = `${FIRST_ID}-${glbHash}`;
  const newGlbPath = `assets/models/free/${newBase}.glb`;

  await expect(page.locator('.fa-media-slot').first().locator('.drop-zone__badge')).toBeVisible();
  await expect(page.locator('#media-warning')).toBeVisible();

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await expect(page.locator('#publish-files')).toContainText('Каталог Free Assets');
  await expect(page.locator('#publish-files')).toContainText(newGlbPath);
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
  expect(calls.refUpdated).toBe(true);

  // Tree: бинарный blob по hash-пути + обновлённый free-assets.json,
  // где model — БАЗОВОЕ имя (конвенция resolveAssetMedia), без удалений.
  const treePaths = calls.tree.map((entry) => entry.path);
  expect(treePaths).toContain(FA_PATH);
  expect(treePaths).toContain(newGlbPath);
  expect(calls.tree.every((entry) => entry.sha !== null)).toBe(true);

  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const glbEntry = calls.tree.find((entry) => entry.path === newGlbPath);
  expect(blobBySha.get(glbEntry.sha).content).toBe(GLB_BUFFER.toString('base64'));
  const faEntry = calls.tree.find((entry) => entry.path === FA_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(faEntry.sha).content, 'base64').toString('utf8'));
  expect(published.categories[0].items[0].model).toBe(newBase);

  await expect(page.locator('#media-warning')).toBeHidden();
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('тогл постера вкл→выкл: черновик снова чистый, missing-файл блокирует публикацию', async ({ page }) => {
  await mockGitHub(page);
  await openFreeAssets(page);

  // Ассет, у которого ключ thumb УЖЕ есть в base со значением null
  // (например bolt-cluster): включение удаляет ключ, выключение возвращает
  // null — но уже в КОНЕЦ объекта. До фикса deepEqual сравнивал
  // JSON.stringify в порядке ключей и считал такой черновик «грязным» вечно.
  const nullThumbItem = faJson.categories
    .flatMap((category) => category.items)
    .find((item) => 'thumb' in item && item.thumb === null);
  expect(nullThumbItem).toBeTruthy();
  await page.click(`a[href="#/free-assets/${nullThumbItem.id}"]`);

  const thumbToggle = page.locator('[data-fa-media-toggle="thumb"]');
  await expect(thumbToggle).not.toBeChecked();

  // Включаем постер: ключ thumb удаляется из черновика → «грязно», а файла
  // по умолчанию assets/cards/{id}.svg в репозитории нет → блокирующая
  // русская ошибка у слота и остановленная публикация.
  await thumbToggle.click();
  await expect(page.locator('#draft-indicator')).toBeVisible();
  const slotError = page.locator('.fa-media-slot.field-invalid + .field-error-msg');
  await expect(slotError).toContainText('ещё нет в репозитории');
  await page.click('#publish-btn');
  await expect(page.locator('.toast--error')).toContainText('Публикация остановлена');
  await expect(page.locator('#publish-dialog')).not.toBeVisible();

  // Выключаем обратно: thumb:null семантически равен base → индикатор
  // черновика гаснет, ошибка слота снимается.
  await page.locator('[data-fa-media-toggle="thumb"]').click();
  await expect(page.locator('[data-fa-media-toggle="thumb"]')).not.toBeChecked();
  await expect(page.locator('.field-error-msg')).toHaveCount(0);
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('guard: последний видимый ассет выключить нельзя (русское сообщение)', async ({ page }) => {
  await mockGitHub(page);
  // все ассеты, кроме первого, выключены через черновик sessionStorage
  const draft = JSON.parse(fs.readFileSync(path.join(ROOT, FA_PATH), 'utf8'));
  draft.categories.forEach((category, ci) => {
    category.items.forEach((item, ii) => {
      if (ci === 0 && ii === 0) return;
      item.enabled = false;
    });
  });
  await page.addInitScript(
    (store) => {
      sessionStorage.setItem('codexAdminDrafts', JSON.stringify(store));
    },
    { [FA_PATH]: draft }
  );
  await openFreeAssets(page);

  const lastVisible = page.locator(`.fa-item-row[data-fa-item="${FIRST_ID}"]`);
  await lastVisible.locator('.switch input').click();

  await expect(page.locator('.toast--error')).toContainText('Нельзя скрыть последний видимый ассет');
  await expect(lastVisible).not.toHaveClass(/case-row--off/);
  await expect(lastVisible.locator('.switch input')).toBeChecked();
});

test('выключение категории: ассеты с бейджем «категория скрыта»', async ({ page }) => {
  await mockGitHub(page);
  await openFreeAssets(page);

  const secondCat = page.locator('.fa-cat').nth(1);
  const secondKey = faJson.categories[1].key;
  await secondCat.locator(`[data-fa-category-toggle="${secondKey}"]`).click();

  await expect(page.locator(`.fa-cat[data-fa-category="${secondKey}"]`)).toHaveClass(/fa-cat--off/);
  const dimmedRows = page.locator(`.fa-cat[data-fa-category="${secondKey}"] .fa-item-row`);
  await expect(dimmedRows.first()).toHaveClass(/case-row--off/);
  await expect(dimmedRows.first().locator('.badge--off')).toHaveText('категория скрыта');
  // переключатель самого ассета остаётся включённым (enabled не трогали)
  await expect(dimmedRows.first().locator('.switch input')).toBeChecked();

  await page.waitForFunction((key) => {
    const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = drafts['content/free-assets.json'];
    if (!draft) return false;
    const category = draft.categories.find((entry) => entry.key === key);
    return !!category && category.enabled === false;
  }, secondKey);
});
