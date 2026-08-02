/* admin-case-blueprints.spec.mjs — раздел «Чертежи» редактора кейса
 * (BP-DECISION-01/02, входит в npm run test:admin).
 *
 * Задача, ради которой всё это: у владельца НЕ БЫЛО способа загрузить свой
 * SVG-чертёж. Сайт рисовал схему сам по хардкод-таблице и приписывал кейсам
 * чужую геометрию. Слайс 1 убрал генератор и завёл схему case.blueprints[];
 * здесь проверяется то, что владелец реально делает руками: добавил лист →
 * загрузил SVG → опубликовал → лист уехал в content-JSON вместе с файлом.
 *
 * Репозиторий раздаётся статикой, ВЕСЬ GitHub API мокается (общий каркас
 * fixtures/admin-harness.mjs). Сценарии:
 *   1) листы, уже заведённые в content/, показываются в форме (dormant-skip,
 *      пока ни у одного кейса их нет);
 *   2) пустое состояние: раздел есть, листов нет, вкладка на сайте скрыта;
 *   3) добавить → загрузить .svg → опубликовать: путь, id, подпись и байты;
 *   4) растр отвергается НА ЗАГРУЗКЕ, а не на публикации;
 *   5) предел 8 листов прячет кнопку «добавить» и объясняет почему;
 *   6) удаление последнего листа уносит ключ case.blueprints целиком
 *      (пустой массив — не синоним «чертежей нет»), удаление одного из двух
 *      публикуется;
 *   7) недопереведённая подпись (EN без RU) блокирует публикацию русским
 *      сообщением у ПУСТОГО поля;
 *   8) зеркальный валидатор ловит чужую папку и пустой массив до публикации;
 *   9) перестановка листов везёт с собой ещё не опубликованную загрузку.
 *
 * Ожидания выводятся из content/: фикстура кейса читается с диска, набор
 * кейсов с листами — тоже. Хардкода «сейчас листов ноль» здесь нет; когда
 * владелец заведёт чертежи, спек продолжит проверять то же самое.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, hash8, startStaticServer, mockGitHub } from './fixtures/admin-harness.mjs';

const CASE_ID = 'orbital-mk-ii';
const CASE_PATH = `content/cases/${CASE_ID}.json`;
const CASES_DIR = path.join(ROOT, 'content', 'cases');

function caseJsonOf(id) {
  return JSON.parse(fs.readFileSync(path.join(CASES_DIR, `${id}.json`), 'utf8'));
}

function sheetsOf(id) {
  const sheets = caseJsonOf(id).case.blueprints;
  return Array.isArray(sheets) ? sheets : [];
}

const CASE_JSON = caseJsonOf(CASE_ID);
// Сколько листов у подопытного кейса СЕЙЧАС — из файла, а не из ожиданий.
const SEEDED_SHEETS = sheetsOf(CASE_ID);
// Кейсы с листами — из content/, списка id здесь нет.
const IDS_WITH_SHEETS = fs
  .readdirSync(CASES_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -5))
  .filter((id) => sheetsOf(id).length > 0);

// Настоящий (пусть и минимальный) чертёж: путь + рамка. Два разных файла
// нужны, чтобы hash8 у них отличался и было видно, чьи байты куда уехали.
const SVG_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<path d="M10 10h80v80H10z" fill="none" stroke="#000"/></svg>',
  'utf8'
);
const SVG2_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
    '<path d="M0 50h200" fill="none" stroke="#000"/></svg>',
  'utf8'
);
const PNG_BUFFER = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(2048)]);

const ctx = startStaticServer();

const srcInput = (i) => `[data-media="${CASE_PATH}::case.blueprints.${i}.src"]`;
const labelField = (i, lang) => `[data-field="${CASE_PATH}::case.blueprints.${i}.label.${lang}"]`;
const slot = (page, i) => page.locator(`.blueprint-slot[data-blueprint-slot="${i}"]`);
const srcZone = (page, i) => page.locator('.drop-zone-field', { has: page.locator(srcInput(i)) });
const sheetPathLine = (page, i) => srcZone(page, i).locator('.drop-zone-path code').first();

function readDrafts(page) {
  return page.evaluate(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    return raw && raw.files && typeof raw.files === 'object' ? raw.files : {};
  });
}

// Засев черновика с корректным provenance: мок Contents API отдаёт sha вида
// `sha-<path>`, и ensureFile принимает черновик только с ним.
async function seedCaseDraft(page, draft) {
  await page.addInitScript(
    (payload) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [payload.path]: payload.draft },
          baseShas: { [payload.path]: payload.sha }
        })
      );
    },
    { draft, path: CASE_PATH, sha: `sha-${CASE_PATH}` }
  );
}

// Кейс БЕЗ чертежей: гарантирует старт «раздел пуст» независимо от того,
// завёл ли владелец листы этому кейсу в content/.
function caseWithoutSheets() {
  const draft = JSON.parse(JSON.stringify(CASE_JSON));
  delete draft.case.blueprints;
  return draft;
}

// Кейс с ровно `count` листами. Пути строятся по той же конвенции, что даёт
// форма: ./assets/cases/<id>/blueprints/NN-<hash>.svg.
function caseWithSheets(count) {
  const draft = caseWithoutSheets();
  draft.case.blueprints = [];
  for (let i = 0; i < count; i += 1) {
    const nn = String(i + 1).padStart(2, '0');
    draft.case.blueprints.push({
      id: `bp-seed-${i + 1}`,
      src: `./assets/cases/${CASE_ID}/blueprints/${nn}-0000000${i + 1}.svg`
    });
  }
  return draft;
}

function handleDialogs(page, mode) {
  const state = { mode, seen: [] };
  page.on('dialog', (dialog) => {
    state.seen.push(dialog.message());
    if (state.mode === 'accept') dialog.accept();
    else dialog.dismiss();
  });
  return state;
}

async function openCaseEditor(page, id) {
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  await page.goto(`${ctx.base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click(`a[href="#/case/${id || CASE_ID}"]`);
  await expect(page.locator('#blueprint-section')).toBeVisible();
}

async function publishedCase(calls) {
  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const entry = calls.tree.find((item) => item.path === CASE_PATH);
  return JSON.parse(Buffer.from(blobBySha.get(entry.sha).content, 'base64').toString('utf8'));
}

test('листы из content/ показываются в форме', async ({ page }) => {
  test.skip(
    IDS_WITH_SHEETS.length === 0,
    'ни один кейс в content/ пока не несёт case.blueprints — показывать нечего ' +
      '(раздел наполняется владельцем через эту же форму, см. остальные сценарии)'
  );
  await mockGitHub(page);
  const id = IDS_WITH_SHEETS[0];
  await openCaseEditor(page, id);

  const sheets = sheetsOf(id);
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(sheets.length);
  for (let i = 0; i < sheets.length; i += 1) {
    await expect(
      page.locator('.drop-zone-field', {
        has: page.locator(`[data-media="content/cases/${id}.json::case.blueprints.${i}.src"]`)
      })
        .locator('.drop-zone-path code')
        .first()
    ).toHaveText(sheets[i].src);
  }
});

test('пустой раздел объясняет, что вкладка «Чертежи» скрыта', async ({ page }) => {
  test.skip(
    SEEDED_SHEETS.length > 0,
    `у кейса ${CASE_ID} уже есть листы в content/ — пустое состояние на нём не проверить`
  );
  await mockGitHub(page);
  await openCaseEditor(page);

  await expect(page.locator('#blueprint-section h2')).toHaveText('Чертежи');
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(0);
  await expect(page.locator('#blueprint-hint')).toContainText('вкладка «Чертежи» на странице кейса скрыта');
  await expect(page.locator('#blueprint-add')).toBeVisible();
  await expect(page.locator('#blueprint-cap-note')).toHaveCount(0);
});

test('добавить лист → загрузить SVG → опубликовать', async ({ page }) => {
  const calls = await mockGitHub(page);
  // dismiss: если бы раздел спрашивал про ручной порядок (как иллюстрации),
  // отказ оставил бы черновик пустым и тест упал бы — порядок листов от
  // layoutMode не зависит, диалога здесь быть не должно.
  const dialogs = handleDialogs(page, 'dismiss');
  await seedCaseDraft(page, caseWithoutSheets());
  await openCaseEditor(page);

  await page.click('#blueprint-add');
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(1);
  expect(dialogs.seen).toEqual([]);
  await expect(page.locator('.toast')).toContainText('Загрузите SVG');
  // Слот принимает ТОЛЬКО вектор: схема кейса других форматов не знает.
  await expect(page.locator(srcInput(0))).toHaveAttribute('accept', '.svg');
  await expect(sheetPathLine(page, 0)).toHaveText('—');

  await page.setInputFiles(srcInput(0), {
    name: 'section-aa.svg',
    mimeType: 'image/svg+xml',
    buffer: SVG_BUFFER
  });
  const expectedSrc = `./assets/cases/${CASE_ID}/blueprints/01-${hash8(SVG_BUFFER)}.svg`;
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();
  await expect(sheetPathLine(page, 0)).toHaveText(expectedSrc);

  await page.fill(labelField(0, 'en'), 'Section A-A');
  await page.fill(labelField(0, 'ru'), 'Разрез А-А');

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const published = await publishedCase(calls);
  expect(published.case.blueprints).toHaveLength(1);
  expect(published.case.blueprints[0].src).toBe(expectedSrc);
  expect(published.case.blueprints[0].label).toEqual({ en: 'Section A-A', ru: 'Разрез А-А' });
  expect(published.case.blueprints[0].id).toMatch(/^[a-z0-9-]+$/);
  // Сами байты чертежа тоже уехали в коммит — иначе кейс сослался бы на 404.
  const binary = calls.tree.find((item) => item.path === expectedSrc.replace(/^\.\//, ''));
  expect(binary).toBeTruthy();
});

test('растровый файл отвергается на загрузке, а не на публикации', async ({ page }) => {
  await mockGitHub(page);
  await seedCaseDraft(page, caseWithoutSheets());
  await openCaseEditor(page);

  await page.click('#blueprint-add');
  await page.setInputFiles(srcInput(0), { name: 'sheet.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await expect(page.locator('.toast--error')).toContainText('нужен формат SVG');
  // Байты не приняты: ни бейджа «новый файл», ни пути в слоте.
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeHidden();
  await expect(sheetPathLine(page, 0)).toHaveText('—');

  // Тот же слот принимает вектор — отказ не «сломал» зону.
  await page.setInputFiles(srcInput(0), { name: 'sheet.svg', mimeType: 'image/svg+xml', buffer: SVG_BUFFER });
  await expect(sheetPathLine(page, 0)).toHaveText(
    `./assets/cases/${CASE_ID}/blueprints/01-${hash8(SVG_BUFFER)}.svg`
  );
});

test('предел листов: кнопка «добавить» уступает место объяснению', async ({ page }) => {
  await mockGitHub(page);
  await seedCaseDraft(page, caseWithSheets(8));
  await openCaseEditor(page);

  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(8);
  await expect(page.locator('#blueprint-add')).toHaveCount(0);
  await expect(page.locator('#blueprint-cap-note')).toContainText('Достигнут предел: 8 листов');
  // Восьмой лист остаётся «08», а не «008»: имя файла берёт padStart.
  await page.setInputFiles(srcInput(7), { name: 'last.svg', mimeType: 'image/svg+xml', buffer: SVG_BUFFER });
  await expect(sheetPathLine(page, 7)).toHaveText(
    `./assets/cases/${CASE_ID}/blueprints/08-${hash8(SVG_BUFFER)}.svg`
  );
});

test('удаление последнего листа уносит ключ case.blueprints целиком', async ({ page }) => {
  await mockGitHub(page);
  const dialogs = handleDialogs(page, 'dismiss');
  await seedCaseDraft(page, caseWithSheets(1));
  await openCaseEditor(page);

  // Отказ в confirm — лист на месте.
  await page.click('[data-blueprint-remove="0"]');
  await expect(page.locator('.toast').last()).toContainText('лист оставлен на месте');
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(1);

  dialogs.mode = 'accept';
  await page.click('[data-blueprint-remove="0"]');
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(0);
  expect(dialogs.seen.join(' ')).toContain('вкладка «Чертежи» пропадёт');
  await expect(page.locator('.toast').last()).toContainText('вкладка «Чертежи» на сайте скрыта');

  // Пустого массива в кейсе не бывает: «чертежей нет» — это ОТСУТСТВИЕ ключа
  // (оба валидатора отвергают []). Черновик обязан вернуться к этой форме.
  await page.waitForFunction((filePath) => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files[filePath];
    return !draft || !('blueprints' in draft.case);
  }, CASE_PATH);
});

test('удаление одного листа из двух публикуется', async ({ page }) => {
  const calls = await mockGitHub(page);
  handleDialogs(page, 'accept');
  const seeded = caseWithSheets(2);
  await seedCaseDraft(page, seeded);
  await openCaseEditor(page);

  await page.click('[data-blueprint-remove="0"]');
  await expect(page.locator('#blueprint-strip .blueprint-slot')).toHaveCount(1);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const published = await publishedCase(calls);
  expect(published.case.blueprints).toHaveLength(1);
  // Остался ВТОРОЙ лист целиком — со своим id и файлом, а не сдвинутая копия.
  expect(published.case.blueprints[0]).toEqual(seeded.case.blueprints[1]);
});

test('подпись на одном языке блокирует публикацию русским сообщением у поля', async ({ page }) => {
  const calls = await mockGitHub(page);
  const draft = caseWithSheets(1);
  draft.case.blueprints[0].label = { en: 'Section A-A', ru: '' };
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('заполните обе локали или оставьте обе пустыми');
  // Ошибка встаёт у ПУСТОГО поля — именно его надо решить.
  const ruField = page.locator(labelField(0, 'ru'));
  await expect(ruField).toHaveClass(/field-invalid/);
  await expect(ruField.locator('xpath=following-sibling::p[1]')).toContainText('Лист 1 — подпись');
  expect(calls.tree).toHaveLength(0);

  // Обе пустые — валидный лист без подписи, публикация проходит.
  await page.fill(labelField(0, 'en'), '');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
});

test('зеркало генератора: чужая папка и пустой список ловятся до публикации', async ({ page }) => {
  const calls = await mockGitHub(page);
  // Файл соседнего кейса переживёт удаление ТОГО кейса и осиротеет здесь.
  const foreign = caseWithSheets(1);
  foreign.case.blueprints[0].src = './assets/cases/vega-shell/01.svg';
  await seedCaseDraft(page, foreign);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('должен лежать в папке этого кейса');
  // Ошибка привязана к КОНКРЕТНОМУ листу: у drop-зоны свой якорь (data-media),
  // который applyPendingErrors не видит, поэтому якорь .src висит на слоте.
  await expect(slot(page, 0)).toHaveClass(/field-invalid/);
  await expect(slot(page, 0).locator('xpath=following-sibling::p[1]')).toContainText('Лист 1');
  expect(calls.tree).toHaveLength(0);
});

test('зеркало генератора: пустой массив листов — ошибка, а не «чертежей нет»', async ({ page }) => {
  const calls = await mockGitHub(page);
  const empty = caseWithoutSheets();
  empty.case.blueprints = []; // форма так не пишет; это черновик из прошлой схемы
  await seedCaseDraft(page, empty);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('Чертежи: список пуст');
  expect(calls.tree).toHaveLength(0);
});

test('перестановка листов везёт с собой незалитую загрузку', async ({ page }) => {
  await mockGitHub(page);
  const seeded = caseWithSheets(2);
  await seedCaseDraft(page, seeded);
  await openCaseEditor(page);

  // Файл уехал во ВТОРОЙ лист: имя берётся от позиции слота (02-…).
  await page.setInputFiles(srcInput(1), { name: 'top.svg', mimeType: 'image/svg+xml', buffer: SVG2_BUFFER });
  const pendingSrc = `./assets/cases/${CASE_ID}/blueprints/02-${hash8(SVG2_BUFFER)}.svg`;
  await expect(sheetPathLine(page, 1)).toHaveText(pendingSrc);

  await page.click('[data-reorder="sheet::1::up"]');
  await expect(page.locator('.toast').last()).toContainText('Порядок листов сохранён');

  // Лист переехал на первую позицию ВМЕСТЕ со своими ещё не залитыми байтами:
  // иначе загруженный файл достался бы чужому листу.
  await expect(sheetPathLine(page, 0)).toHaveText(pendingSrc);
  await page.waitForFunction(
    (payload) => {
      const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
      const draft = raw && raw.files && raw.files[payload.path];
      return !!draft && draft.case.blueprints[0].id === payload.id;
    },
    { path: CASE_PATH, id: seeded.case.blueprints[1].id }
  );
  const drafts = await readDrafts(page);
  expect(drafts[CASE_PATH].case.blueprints.map((sheet) => sheet.id)).toEqual([
    seeded.case.blueprints[1].id,
    seeded.case.blueprints[0].id
  ]);
});
