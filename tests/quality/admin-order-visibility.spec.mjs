/* admin-order-visibility.spec.mjs — смоук итерации F (порядок + видимость),
 * входит в npm run test:admin.
 *
 * Репозиторий раздаётся статикой, ВЕСЬ GitHub API мокается (page.route):
 * Contents API читает реальные файлы с диска, Git Data API пишет журнал
 * вызовов для ассертов. Сценарии:
 *   1) выключение кейса → строка мгновенно затемняется + бейдж «скрыто» +
 *      черновик enabled:false в sessionStorage;
 *   2) перестановка клавиатурными кнопками ↑/↓ меняет cardOrder черновика
 *      (тост «Порядок сохранён в черновик»), публикация несёт обновлённый
 *      content/settings.json в tree коммита;
 *   3) ручной layoutMode: переключатель показывает ручки/кнопки порядка у
 *      слотов и motion-блоков, перестановка слота двигает подпись и фон;
 *   4) русский guard при попытке скрыть последний видимый кейс;
 *   5) выключение категории → кейсы категории затемнены с бейджем
 *      «категория скрыта», фильтр «All» в списке категорий отсутствует.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SETTINGS_PATH = 'content/settings.json';
const CASE_PATH = 'content/cases/orbital-mk-ii.json';

const settingsJson = JSON.parse(fs.readFileSync(path.join(ROOT, SETTINGS_PATH), 'utf8'));
const CARD_ORDER = settingsJson.cardOrder;

let server;
let base;

test.beforeAll(async () => {
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
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

async function loginWithPat(page) {
  await page.goto(`${base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await expect(page.locator('.case-row').first()).toBeVisible();
}

// Автосейв черновиков в sessionStorage дебаунсится (~400 мс), поэтому
// сначала ждём появления нужного состояния, затем читаем снапшот.
async function waitDrafts(page, predicate) {
  await page.waitForFunction(predicate);
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}'));
}

test('выключение кейса: мгновенное затемнение, бейдж «скрыто», черновик', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);

  const row = page.locator('.case-row[data-case-id="vega-shell"]');
  await expect(row).not.toHaveClass(/case-row--off/);
  await row.locator('.switch input').click();

  await expect(row).toHaveClass(/case-row--off/);
  await expect(row.locator('.badge--off')).toHaveText('скрыто');
  await expect(row.locator('.switch input')).not.toBeChecked();
  await expect(page.locator('#draft-indicator')).toBeVisible();
  await page.waitForFunction(() => {
    const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = drafts['content/cases/vega-shell.json'];
    return !!draft && draft.enabled === false;
  });

  // включаем обратно — затемнение и бейдж исчезают, черновик чистый
  await row.locator('.switch input').click();
  await expect(row).not.toHaveClass(/case-row--off/);
  await expect(row.locator('.badge--off')).toHaveCount(0);
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('перестановка кнопками ↑/↓ меняет cardOrder; публикация несёт settings.json', async ({ page }) => {
  const calls = await mockGitHub(page);
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  await loginWithPat(page);

  const firstId = CARD_ORDER[0];
  const secondId = CARD_ORDER[1];
  await expect(page.locator('.case-row').first()).toHaveAttribute('data-case-id', firstId);

  // у первой строки «вверх» отключена, «вниз» активна (a11y-фоллбек)
  const firstRow = page.locator('.case-row').first();
  await expect(firstRow.locator(`[data-reorder="case::${firstId}::up"]`)).toBeDisabled();
  await firstRow.locator(`[data-reorder="case::${firstId}::down"]`).click();

  await expect(page.locator('.toast')).toContainText('Порядок сохранён в черновик');
  await expect(page.locator('.case-row').first()).toHaveAttribute('data-case-id', secondId);
  await expect(page.locator('.case-row').nth(1)).toHaveAttribute('data-case-id', firstId);
  const drafts = await waitDrafts(page, () => {
    const store = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    return !!store['content/settings.json'];
  });
  expect(drafts[SETTINGS_PATH].cardOrder[0]).toBe(secondId);
  expect(drafts[SETTINGS_PATH].cardOrder[1]).toBe(firstId);

  // публикация: диалог перечисляет settings.json, tree коммита несёт новый порядок
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await expect(page.locator('#publish-files')).toContainText(SETTINGS_PATH);
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
  expect(calls.refUpdated).toBe(true);

  const settingsEntry = calls.tree.find((entry) => entry.path === SETTINGS_PATH);
  expect(settingsEntry).toBeTruthy();
  const blob = calls.blobs.find((item) => item.sha === settingsEntry.sha);
  const published = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'));
  expect(published.cardOrder[0]).toBe(secondId);
  expect(published.cardOrder[1]).toBe(firstId);
  expect(published.cardOrder.length).toBe(CARD_ORDER.length);
});

test('ручной layoutMode: переключатель открывает перестановку слотов и блоков', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');

  // seeded по умолчанию: объяснение + ни одной ручки в редакторе
  const layoutSection = page.locator('#layout-section');
  await expect(layoutSection).toContainText('Порядок подбирается автоматически');
  await expect(layoutSection).toContainText('Включите ручной порядок');
  await expect(page.locator('#media-strip .reorder-handle')).toHaveCount(0);

  await page.click('#layout-manual-btn');
  await expect(page.locator('.toast')).toContainText('авторский порядок файлов');

  // manual: ручки и кнопки у 5 слотов и у каждого motion-блока
  await expect(page.locator('#media-strip .reorder-handle')).toHaveCount(5);
  await expect(page.locator('#motion-list .reorder-handle')).toHaveCount(4);
  await expect(page.locator('#layout-section')).toContainText('Ручной порядок включён');
  await page.waitForFunction(() => {
    const drafts = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = drafts['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.layoutMode === 'manual';
  });

  // слот 1 ↓: эффективный src материализуется и переезжает вместе с подписью
  await page.click('[data-reorder="slot::0::down"]');
  await expect(page.locator('.toast').last()).toContainText('Порядок сохранён в черновик');
  const drafts = await waitDrafts(page, () => {
    const store = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft = store['content/cases/orbital-mk-ii.json'];
    return !!draft && Array.isArray(draft.case.srcs) && draft.case.srcs[1] === './assets/cases/orbital-mk-ii/01.svg';
  });
  const draft = drafts[CASE_PATH];
  expect(draft.case.srcs[0]).toBe('./assets/cases/orbital-mk-ii/02.png');
  expect(draft.case.srcs[1]).toBe('./assets/cases/orbital-mk-ii/01.svg');
  expect(draft.case.captions[1].label.en).toBe('Hero render');
  expect(draft.case.captions[0].label.en).toBe('Material study');

  // motion-блок 1 ↓: массив motionBlocks переставлен
  await page.click('[data-reorder="motion::0::down"]');
  const drafts2 = await waitDrafts(page, () => {
    const store = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    const draft2 = store['content/cases/orbital-mk-ii.json'];
    return !!draft2 && draft2.case.motionBlocks[0].playback === 'controlled';
  });
  expect(drafts2[CASE_PATH].case.motionBlocks[0].playback).toBe('controlled');
  expect(drafts2[CASE_PATH].case.motionBlocks[1].playback).toBe('ambient');

  // возврат к seeded прячет ручки
  await page.click('#layout-seeded-btn');
  await expect(page.locator('#media-strip .reorder-handle')).toHaveCount(0);
});

test('guard: последний видимый кейс выключить нельзя (русское сообщение)', async ({ page }) => {
  await mockGitHub(page);
  // все кейсы, кроме orbital-mk-ii, выключены через черновики sessionStorage
  const seeded = {};
  for (const id of CARD_ORDER) {
    if (id === 'orbital-mk-ii') continue;
    const draft = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/cases/' + id + '.json'), 'utf8'));
    draft.enabled = false;
    seeded['content/cases/' + id + '.json'] = draft;
  }
  await page.addInitScript((store) => {
    sessionStorage.setItem('codexAdminDrafts', JSON.stringify(store));
  }, seeded);
  await loginWithPat(page);

  await expect(page.locator('.case-row--off')).toHaveCount(CARD_ORDER.length - 1);
  const lastVisible = page.locator('.case-row[data-case-id="orbital-mk-ii"]');
  await lastVisible.locator('.switch input').click();

  await expect(page.locator('.toast--error')).toContainText('Нельзя скрыть последний видимый кейс');
  await expect(lastVisible).not.toHaveClass(/case-row--off/);
  await expect(lastVisible.locator('.switch input')).toBeChecked();
});

test('категории: выключение скрывает кейсы с бейджем «категория скрыта»', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);

  await page.click('a[href="#/categories"]');
  // «All» не выключается и не показывается в списке
  await expect(page.locator('[data-category-row="all"]')).toHaveCount(0);
  const cadRow = page.locator('[data-category-row="cad"]');
  await expect(cadRow).toBeVisible();
  await cadRow.locator('.switch input').click();
  await expect(cadRow).toHaveClass(/category-row--off/);
  await expect(cadRow.locator('.badge--off')).toHaveText('скрыта');
  await expect(page.locator('#draft-indicator')).toBeVisible();

  // в списке кейсов cad-кейсы затемнены с бейджем «категория скрыта»
  await page.click('a[href="#/cases"]');
  const cadCase = page.locator('.case-row[data-case-id="cad-strut"]');
  await expect(cadCase).toHaveClass(/case-row--off/);
  await expect(cadCase.locator('.badge--off')).toHaveText('категория скрыта');
  // переключатель самого кейса остаётся включённым (enabled не трогали)
  await expect(cadCase.locator('.switch input')).toBeChecked();

  const drafts = await waitDrafts(page, () => {
    const store = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
    return !!store['content/settings.json'];
  });
  const cadFilter = drafts[SETTINGS_PATH].filters.find((f) => f.key === 'cad');
  expect(cadFilter.enabled).toBe(false);
});
