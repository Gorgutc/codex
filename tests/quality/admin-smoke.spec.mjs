/* admin-smoke.spec.mjs — смоук админ-панели (итерация D, npm run test:admin).
 *
 * Репозиторий раздаётся статикой (реальный content/ и admin/), а ВЕСЬ GitHub
 * API мокается через page.route: /user и проба репозитория для PAT-входа,
 * Contents API отдаёт реальные файлы с диска (base64), Git Data API
 * (blobs → tree → commit → update ref) и поллинг коммитов конвейера —
 * инлайн-фикстуры. Сценарии:
 *   1) экран входа рендерится;
 *   2) вход по PAT + список всех кейсов cardOrder из реального content/ + поиск;
 *   3) редактор: правка RU-заголовка → индикатор черновика → автосохранение
 *      переживает reload (sessionStorage) → пустое обязательное EN-поле
 *      блокирует публикацию русским сообщением у поля → успешная публикация
 *      с полностью замоканным Git Data API и success-тостом.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { allCaseIds } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CASE_PATH = 'content/cases/orbital-mk-ii.json';
const RU_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.ru"]`;
const EN_TITLE_FIELD = `[data-field="${CASE_PATH}::card.title.en"]`;
const SOURCE_SHA = 'a'.repeat(40);

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
  const calls = { commitMessage: '', tree: [], treePaths: [], refUpdated: false };
  const sourceFiles = new Map();
  let liveHead = 'b'.repeat(40);
  const blobs = new Map();
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
      const ref = url.searchParams.get('ref') || 'main';
      const abs = path.join(ROOT, filePath);
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return json(404, { message: 'Not Found' });
      const committed =
        ref === SOURCE_SHA || (ref === 'main' && liveHead === SOURCE_SHA) ? sourceFiles.get(filePath) : null;
      return json(200, {
        type: 'file',
        encoding: 'base64',
        sha: 'c'.repeat(40),
        content: (committed || fs.readFileSync(abs)).toString('base64')
      });
    }
    if (p === '/repos/Gorgutc/codex/git/ref/heads/main' && method === 'GET')
      return json(200, { object: { sha: liveHead } });
    if (/^\/repos\/Gorgutc\/codex\/git\/commits\/[0-9a-f]{40}$/.test(p))
      return json(200, { tree: { sha: 'treesha000' } });
    if (p === '/repos/Gorgutc/codex/git/blobs' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      const sha = 'blobsha-' + blobs.size;
      blobs.set(sha, Buffer.from(body.content || '', body.encoding === 'base64' ? 'base64' : 'utf8'));
      return json(201, { sha });
    }
    if (p === '/repos/Gorgutc/codex/git/trees' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      calls.tree = body.tree || [];
      calls.treePaths = calls.tree.map((item) => item.path);
      return json(201, { sha: 'newtree000' });
    }
    if (p === '/repos/Gorgutc/codex/git/commits' && method === 'POST') {
      calls.commitMessage = JSON.parse(request.postData() || '{}').message || '';
      calls.tree.forEach((item) => {
        if (item.path && blobs.has(item.sha)) sourceFiles.set(item.path, blobs.get(item.sha));
      });
      return json(201, { sha: SOURCE_SHA });
    }
    if (p === '/repos/Gorgutc/codex/git/refs/heads/main' && method === 'PATCH') {
      calls.refUpdated = true;
      liveHead = SOURCE_SHA;
      return json(200, { object: { sha: SOURCE_SHA } });
    }
    if (p === '/repos/Gorgutc/codex/commits') {
      // Поллинг вердикта конвейера: bot-коммит с маркером успеха.
      return json(200, [
        {
          sha: 'd'.repeat(40),
          html_url: 'https://github.com/Gorgutc/codex/commit/' + 'd'.repeat(40),
          author: { login: 'github-actions[bot]' },
          commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
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
  // Кнопка GitHub показывается только там, где живёт Netlify-функция OAuth
  // (слайс B: на статическом хостинге она 404-ит, и панель её прячет).
  // Здесь проверяется полный Netlify-контур, поэтому пробе отвечаем как
  // настоящая функция — редиректом на github.com.
  await page.route('**/.netlify/functions/cms-auth*', (route) =>
    route.fulfill({ status: 302, headers: { Location: 'https://github.com/login/oauth/authorize' }, body: '' })
  );
  await page.goto(`${base}/admin/`);
  await expect(page.locator('h1')).toHaveText('Вход в админ-панель');
  await expect(page.locator('#login-github')).toBeVisible();
  await expect(page.locator('#login-pat-toggle')).toBeVisible();
  await expect(page.locator('#topbar')).toBeHidden();
  // PAT-форма раскрывается и объясняет области доступа токена
  await page.click('#login-pat-toggle');
  await expect(page.locator('#pat-form .hint')).toContainText('Contents: Read and write');
});

test('вход по PAT: список всех кейсов из реального content/ и поиск', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);

  await expect(page.locator('.topbar__login')).toHaveText('owner-test');
  // Список админки показывает ВСЕ кейсы cardOrder (включая скрытые) —
  // число из content/, не литерал (prod-review F1, класс находки D-01).
  await expect(page.locator('.case-row')).toHaveCount(allCaseIds(ROOT).length);
  // итерация F: ручка перестановки и активный выключатель в каждой строке
  await expect(page.locator('.case-row .reorder-handle').first()).toBeVisible();
  await expect(page.locator('.case-row .switch input').first()).toBeEnabled();
  await expect(page.locator('.case-row .switch input').first()).toBeChecked();

  await page.fill('#case-search', 'orbital');
  await expect(page.locator('.case-row')).toHaveCount(1);
  await expect(page.locator('.case-row__title')).toHaveText('Orbital Mk.II');
});

test('Meta: global identity and featured works are editable from the full catalog', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/meta"]');

  await expect(page.locator('#meta-contact-url')).toBeVisible();
  await expect(page.locator('#meta-organization-name')).toBeVisible();
  await expect(page.locator('#meta-organization-alternate-name')).toBeVisible();
  await expect(page.locator('#meta-organization-url')).toBeVisible();
  await expect(page.locator('#meta-organization-same-as')).toBeVisible();
  await expect(page.locator('#meta-featured-works')).toBeVisible();

  const catalogIds = allCaseIds(ROOT);
  const featuredSelects = page.locator('#meta-featured-works select[data-field]');
  await expect(featuredSelects.first()).toBeVisible();
  const optionValues = await featuredSelects
    .first()
    .locator('option')
    .evaluateAll((options) => options.map((option) => option.value));
  expect(optionValues).toEqual(catalogIds);

  await page.fill('#meta-contact-url', 'https://example.test/contact');
  await page.fill('#meta-organization-same-as', 'https://example.test/community\nhttps://example.test/profile');
  await expect(page.locator('#draft-indicator')).toBeVisible();

  const before = await featuredSelects.count();
  await page.click('#meta-featured-add');
  await expect(featuredSelects).toHaveCount(before + 1);
  await expect(page.locator('#meta-featured-works [data-reorder$="::up"]')).toHaveCount(before + 1);
});

test('Meta: every C0 URL separator blocks publishing and anchors the contact field', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/meta"]');

  const contact = page.locator('#meta-contact-url');
  await expect(contact).toHaveValue(/^https:\/\//);
  // Text inputs normalize LF/CR before dispatching `input`, so set the draft
  // directly just as an imported draft would. Each must be rejected before
  // URL() gets a chance to normalize it, then point back to this UI field.
  for (const [name, character] of [
    ['tab', '\t'],
    ['LF', '\n'],
    ['CR', '\r']
  ]) {
    await page.evaluate((value) => {
      window.AdminState.setValue('content/meta.json', 'contactUrl', value);
      const button = document.getElementById('publish-btn');
      button.disabled = false;
      button.click();
    }, 'https://example.test/contact' + character);
    await expect(contact, name + ' must anchor its validation error').toHaveClass(/field-invalid/);
    await expect(contact.locator('xpath=following-sibling::*[contains(@class, "field-error-msg")]')).toContainText(
      'HTTPS-адрес'
    );
  }
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

// Этот спек раздаёт СЫРОЙ content/ (без normalizeVisibility из admin-harness),
// поэтому именно здесь проверяется рендер админки поверх реальных
// enabled:false владельца — остальные admin-спеки видят нормализованную базу.
test('owner-скрытая база: кейс выключенной категории затемнён с бейджем', async ({ page }) => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/settings.json'), 'utf8'));
  const hiddenFilter = (settings.filters || []).find((f) => f.enabled === false && f.key !== 'all');
  test.skip(!hiddenFilter, 'в content/ нет выключенных категорий — нечего проверять');
  // Первый кейс скрытой категории, не выключенный сам по себе, — из контента.
  const hiddenCaseId =
    hiddenFilter &&
    (settings.cardOrder || []).find((id) => {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, `content/cases/${id}.json`), 'utf8'));
      return data.category === hiddenFilter.key && data.enabled !== false;
    });
  test.skip(!hiddenCaseId, 'у выключенной категории нет включённых кейсов в cardOrder');

  await mockGitHub(page);
  await loginWithPat(page);

  const row = page.locator(`.case-row[data-case-id="${hiddenCaseId}"]`);
  await expect(row).toHaveClass(/case-row--off/);
  await expect(row.locator('.badge--off')).toHaveText('категория скрыта');
  // собственный выключатель кейса не тронут: скрыта категория, а не кейс
  await expect(row.locator('.switch input')).toBeChecked();
});

test('admin chrome: current section is singular and draft actions are truthful', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.fill(RU_TITLE_FIELD, 'Черновик для проверки');
  await expect(page.locator('#app[aria-live]')).toHaveCount(0);
  await expect(page.locator('[data-nav][aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('#draft-indicator')).toContainText('JSON-правки сохранены в этой вкладке');
  await expect(page.locator('#draft-indicator')).toContainText(/\d{2}:\d{2}:\d{2}/);
  const savedAt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('codexAdminDrafts')).savedAt);
  const savedTime = new Date(savedAt).toLocaleTimeString('ru-RU');
  await expect(page.locator('#draft-indicator')).toContainText(savedTime);
  await page.reload();
  await expect(page.locator('#draft-indicator')).toContainText(savedTime);
  await expect(page.locator('#review-draft-btn')).toBeVisible();
  await expect(page.locator('#discard-draft-btn')).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/not-a-real-admin-section';
  });
  await expect(page.locator('.case-row').first()).toBeVisible();
  await expect(page.locator('[data-nav][aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('[data-nav="cases"]')).toHaveAttribute('aria-current', 'page');
});

test('draft indicator never calls an unsaved draft persisted when session storage rejects it', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'codexAdminDrafts') throw new DOMException('quota', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
  });
  await page.fill(RU_TITLE_FIELD, 'Только в памяти');
  await expect(page.locator('#draft-indicator')).toContainText('пока только в памяти этой вкладки');
  await expect(page.locator('#draft-indicator')).not.toContainText('JSON-правки сохранены');
});

test('a legacy V2 draft without savedAt is truthfully persisted until the next edit timestamps it', async ({ page }) => {
  const baseDraft = JSON.parse(fs.readFileSync(path.join(ROOT, CASE_PATH), 'utf8'));
  const legacyDraft = structuredClone(baseDraft);
  legacyDraft.card.title.ru = 'Сохранено до времени';
  await page.addInitScript(
    ({ casePath, base, draft }) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [casePath]: draft },
          baseShas: { [casePath]: 'c'.repeat(40) },
          baseSnapshots: { [casePath]: base }
        })
      );
    },
    { casePath: CASE_PATH, base: baseDraft, draft: legacyDraft }
  );
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(RU_TITLE_FIELD)).toHaveValue('Сохранено до времени');
  await expect(page.locator('#draft-indicator')).toContainText('сохранены ранее');
  await expect(page.locator('#draft-indicator')).toContainText('время неизвестно');
  await expect(page.locator('#draft-indicator')).not.toContainText('сохраняются');
  await page.fill(RU_TITLE_FIELD, 'Сохранено с новым временем');
  await expect(page.locator('#draft-indicator')).toContainText('сохраняются');
  await page.waitForFunction(() => {
    const draft = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    return draft && typeof draft.savedAt === 'string';
  });
  const savedAt = await page.evaluate(() => JSON.parse(sessionStorage.getItem('codexAdminDrafts')).savedAt);
  await expect(page.locator('#draft-indicator')).toContainText(new Date(savedAt).toLocaleTimeString('ru-RU'));
});

async function expectVisibleControlLabels(page, selectors) {
  for (const selector of selectors) {
    const controls = page.locator(selector);
    expect(await controls.count(), selector + ' is rendered').toBeGreaterThan(0);
    const withoutVisibleAssociation = await controls.evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const labels = Array.from(node.labels || []).filter((label) => label.textContent.trim());
          const ids = String(node.getAttribute('aria-labelledby') || '')
            .split(/\s+/)
            .filter(Boolean);
          const labelledBy = ids.length > 0 && ids.every((id) => {
            const label = document.getElementById(id);
            return label && label.textContent.trim();
          });
          return labels.length === 0 && !labelledBy;
        })
        .map((node) => ({ field: node.getAttribute('data-field'), id: node.id, type: node.type }))
    );
    expect(withoutVisibleAssociation, selector + ' has a visible associated label').toEqual([]);
  }
}

test('case editor: representative controls have visible labels and hidden rows keep axe contrast', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');

  // Enabling the optional CTA proves that labels survive a rerender as well.
  await page.click('#case-cta-toggle');
  await expect(page.locator('#case-cta-section [data-field$="case.cta.url"]')).toBeVisible();

  await expectVisibleControlLabels(page, [
    RU_TITLE_FIELD,
    `[data-field="${CASE_PATH}::case.tools"]`,
    '#case-public-slug',
    '#case-legacy-slugs',
    '#case-cta-toggle',
    `[data-field="${CASE_PATH}::case.cta.url"]`,
    `[data-field="${CASE_PATH}::case.media.0.type"]`,
    `[data-field="${CASE_PATH}::case.media.0.format"]`,
    `[data-media="${CASE_PATH}::case.media.0.src"]`,
    `[data-media="${CASE_PATH}::case.modelSrc"]`,
    `[data-field="${CASE_PATH}::case.modelStats.triangles"]`,
    `[data-field="${CASE_PATH}::case.motionBlocks.0.layout"]`,
    `[data-field="${CASE_PATH}::case.motionBlocks.1.source"]`,
    `[data-field="${CASE_PATH}::case.motionBlocks.1.vimeoId"]`
  ]);

  // The off-row treatment must dim decoration, not make its functional text
  // fail WCAG contrast. Run axe against the actual deterministic off state.
  await page.click('a[href="#/cases"]');
  await page.click('[data-case-toggle="orbital-mk-ii"]');
  const offRow = page.locator('.case-row--off[data-case-id="orbital-mk-ii"]');
  await expect(offRow).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('.case-row--off[data-case-id="orbital-mk-ii"]').analyze();
  expect(axe.violations.filter((violation) => violation.id === 'color-contrast')).toEqual([]);

  await page.click('a[href="#/categories"]');
  await page.locator('[data-category-row] .switch input:checked').first().click();
  const offCategory = page.locator('.category-row--off').first();
  await expect(offCategory).toBeVisible();
  const offCategorySelector = await offCategory.evaluate((node) => '[data-category-row="' + node.dataset.categoryRow + '"]');
  const categoryAxe = await new AxeBuilder({ page }).include(offCategorySelector).analyze();
  expect(categoryAxe.violations.filter((violation) => violation.id === 'color-contrast')).toEqual([]);

  await page.click('a[href="#/free-assets"]');
  const firstAssetLink = page.locator('a[href^="#/free-assets/"]').first();
  await firstAssetLink.click();
  await expect(page.locator('[data-field^="content/free-assets.json::"]').first()).toBeVisible();
  await expectVisibleControlLabels(page, [
    '[data-field^="content/free-assets.json::"][data-field$=".title"]',
    '[data-field^="content/free-assets.json::"][data-field$=".bg"]'
  ]);
});

test('draft actions: Review is non-publishing and Discard clears tab draft/media but preserves publication recovery', async ({ page }) => {
  const calls = await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.fill(RU_TITLE_FIELD, 'Изменение для review');
  await page.waitForFunction(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    return raw && raw.savedAt;
  });
  await page.click('#review-draft-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  expect(calls.tree).toHaveLength(0);
  await page.click('#publish-cancel');

  await page.setInputFiles(`[data-media="${CASE_PATH}::card.thumb"]`, {
    name: 'memory-only.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a-memory-only')
  });
  await expect(page.locator('#draft-indicator')).toContainText('файлов в памяти: 1');
  await page.evaluate(() => sessionStorage.setItem('codexAdminPublication', '{"keep":"recovery"}'));
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#discard-draft-btn');
  await expect(page.locator('#draft-indicator')).toBeHidden();
  await expect(page.locator('#media-warning')).toBeHidden();
  await expect.poll(() => page.evaluate(() => ({
    drafts: sessionStorage.getItem('codexAdminDrafts'),
    publication: sessionStorage.getItem('codexAdminPublication'),
    pending: window.AdminState.mediaPendingCount()
  }))).toEqual({ drafts: null, publication: '{"keep":"recovery"}', pending: 0 });
});
