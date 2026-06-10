/* admin-smoke.spec.mjs — смоук админ-панели (итерация D, npm run test:admin).
 *
 * Репозиторий раздаётся статикой (реальный content/ и admin/), а ВЕСЬ GitHub
 * API мокается через page.route: /user и проба репозитория для PAT-входа,
 * Contents API отдаёт реальные файлы с диска (base64), Git Data API
 * (blobs → tree → commit → update ref) и поллинг коммитов конвейера —
 * инлайн-фикстуры. Сценарии:
 *   1) экран входа рендерится;
 *   2) вход по PAT + список из 18 кейсов из реального content/ + поиск;
 *   3) редактор: правка RU-заголовка → индикатор черновика → автосохранение
 *      переживает reload (sessionStorage) → пустое обязательное EN-поле
 *      блокирует публикацию русским сообщением у поля → успешная публикация
 *      с полностью замоканным Git Data API и success-тостом.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CASE_PATH = 'content/cases/orbital-mk-ii.json';
const RU_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.ru"]`;
const EN_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.en"]`;

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

// Полный мок GitHub REST API. Возвращает «журнал» вызовов для ассертов.
async function mockGitHub(page) {
  const calls = { commitMessage: '', treePaths: [], refUpdated: false };
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
    if (p === '/repos/Gorgutc/codex/git/blobs' && method === 'POST') return json(201, { sha: 'blobsha000' });
    if (p === '/repos/Gorgutc/codex/git/trees' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      calls.treePaths = (body.tree || []).map((item) => item.path);
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
      // Поллинг вердикта конвейера: bot-коммит с маркером успеха.
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
}

test('экран входа: русский заголовок и оба способа авторизации', async ({ page }) => {
  await page.goto(`${base}/admin/`);
  await expect(page.locator('h1')).toHaveText('Вход в админ-панель');
  await expect(page.locator('#login-github')).toBeVisible();
  await expect(page.locator('#login-pat-toggle')).toBeVisible();
  await expect(page.locator('#topbar')).toBeHidden();
  // PAT-форма раскрывается и объясняет области доступа токена
  await page.click('#login-pat-toggle');
  await expect(page.locator('#pat-form .hint')).toContainText('Contents: Read and write');
});

test('вход по PAT: список из 18 кейсов из реального content/ и поиск', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);

  await expect(page.locator('.topbar__login')).toHaveText('owner-test');
  await expect(page.locator('.case-row')).toHaveCount(18);
  // итерация F: ручка перестановки и активный выключатель в каждой строке
  await expect(page.locator('.case-row .reorder-handle').first()).toBeVisible();
  await expect(page.locator('.case-row .switch input').first()).toBeEnabled();
  await expect(page.locator('.case-row .switch input').first()).toBeChecked();

  await page.fill('#case-search', 'orbital');
  await expect(page.locator('.case-row')).toHaveCount(1);
  await expect(page.locator('.case-row__title')).toHaveText('Orbital Mk.II');
});

test('редактор: автосохранение черновика, валидация и публикация', async ({ page }) => {
  const calls = await mockGitHub(page);
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  page.on('dialog', (dialog) => dialog.accept()); // beforeunload при reload с черновиком
  await loginWithPat(page);

  await page.click('a[href="#/case/orbital-mk-ii"]');
  const ruTitle = page.locator(RU_TITLE_FIELD);
  await expect(ruTitle).toHaveValue('Orbital Mk.II');
  await expect(page.locator('#draft-indicator')).toBeHidden();

  // правка RU-заголовка → индикатор черновика + debounce-автосейв в sessionStorage
  await ruTitle.fill('Орбитальный Мк.II');
  await expect(page.locator('#draft-indicator')).toBeVisible();
  await page.waitForFunction(() => (sessionStorage.getItem('codexAdminDrafts') || '').includes('Орбитальный'));

  // перезагрузка: токен и черновик живут в sessionStorage вкладки
  await page.reload();
  await expect(page.locator(RU_TITLE_FIELD)).toHaveValue('Орбитальный Мк.II');
  await expect(page.locator('#draft-indicator')).toBeVisible();

  // пустое обязательное EN-поле блокирует публикацию русским сообщением у поля
  await page.fill(EN_TITLE_FIELD, '');
  await page.click('#publish-btn');
  await expect(page.locator('.field-error-msg').first()).toContainText('EN-текст не может быть пустым');
  await expect(page.locator('#publish-dialog')).toBeHidden();

  // исправляем и публикуем: подтверждение перечисляет изменённые файлы
  await page.fill(EN_TITLE_FIELD, 'Orbital Mk.II');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await expect(page.locator('#publish-files li')).toHaveCount(1);
  await expect(page.locator('#publish-files')).toContainText(CASE_PATH);
  await page.click('#publish-confirm');

  // полный мок Git Data API → success-тост после маркера [content-publish]
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
  await expect(page.locator('#draft-indicator')).toBeHidden();
  expect(calls.refUpdated).toBe(true);
  expect(calls.treePaths).toEqual([CASE_PATH]);
  expect(calls.commitMessage).toMatch(/^content: .+ \[admin\]$/);
});
