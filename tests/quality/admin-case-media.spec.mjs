/* admin-case-media.spec.mjs — структура иллюстраций кейса (слайс B,
 * входит в npm run test:admin).
 *
 * Репозиторий раздаётся статикой, ВЕСЬ GitHub API мокается (общий каркас
 * fixtures/admin-harness.mjs). Сценарии:
 *   1) layoutMode-гейт: в seeded «+ Фото» спрашивает подтверждение, отказ
 *      оставляет черновик нетронутым, согласие включает ручной порядок;
 *   2) «+ Видео»: у нового блока drop-зона .webm и отдельная мини-зона постера;
 *   3) удаление блока (confirm) и запрет удаления ПОСЛЕДНЕГО блока;
 *   4) переключатель формата пишет case.media.N.format;
 *   5) смена типа фото→видео чистит src и отменяет pending-байты;
 *   6) pending-медиа переживает добавление блока и переезжает при удалении
 *      соседа, а байты удалённого блока в коммит не уходят;
 *   7) конверт черновиков: V1 (без provenance), конверт будущей версии и
 *      битый JSON — fail-closed сброс с русским сообщением; V2, снятый с
 *      другой версии файла, тоже сбрасывается;
 *   8) TOCTOU: расхождение blob sha, занятый путь бинарника и неотличимая
 *      сетевая ошибка — три разных исхода, ни один не создаёт коммит;
 *   9) две публикации подряд в одной вкладке проходят (план пересобирается
 *      после precheck, а не берётся из кэша диалога);
 *  10) гонка in-flight загрузки: блок удалён, пока файл читался;
 *  11) 0N-нейминг на позициях 9/10/12 и граница предупреждения 8→9;
 *  12) зеркальный валидатор админки ловит грамматику фона, дубль id и
 *      беспостерное видео до публикации;
 *  13) probe OAuth-функции: 404 прячет кнопку «Войти через GitHub»;
 *  14) необязательные подписи: пустая пара публикуется, недоперевод (EN без
 *      RU) блокирует публикацию русским сообщением у ПУСТОГО поля;
 *  15) склейка seamless: чекбокс задизейблен на первом блоке и в
 *      автоматическом порядке, публикуется флагом блока, а блок, ставший
 *      первым, ловится валидацией, а не снимается молча;
 *  16) внешняя ссылка кейса (CASE-CTA-01): тогл + адрес публикуются,
 *      чужой домен и адрес-заглушка блокируются русским сообщением.
 *
 * Ожидания выводятся из content/ (владелец работает с частично скрытым
 * каталогом): фикстура кейса читается с диска, а не хардкодится.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, hash8, startStaticServer, mockGitHub } from './fixtures/admin-harness.mjs';

const CASE_ID = 'orbital-mk-ii';
const CASE_PATH = `content/cases/${CASE_ID}.json`;
const CASE_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, CASE_PATH), 'utf8'));
const MEDIA = CASE_JSON.case.media;

const PNG_BUFFER = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(4096)]);
const PNG2_BUFFER = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), crypto.randomBytes(2048)]);
const WEBM_BUFFER = Buffer.concat([Buffer.from('1a45dfa3', 'hex'), crypto.randomBytes(4096)]);

const ctx = startStaticServer();

const srcInput = (i) => `[data-media="${CASE_PATH}::case.media.${i}.src"]`;
const posterInput = (i) => `[data-media="${CASE_PATH}::case.media.${i}.poster"]`;
const typeField = (i) => `[data-field="${CASE_PATH}::case.media.${i}.type"]`;
const formatField = (i) => `[data-field="${CASE_PATH}::case.media.${i}.format"]`;
const slot = (page, i) => page.locator(`.media-slot[data-media-slot="${i}"]`);
// У видео-блока в слоте ДВЕ drop-зоны (файл + постер) — бейдж адресуем через
// поле-инпут конкретной зоны, иначе локатор неоднозначен.
const srcZone = (page, i) => page.locator('.drop-zone-field', { has: page.locator(srcInput(i)) });

// Черновики лежат в конверте { version, files, baseShas } (слайс B).
function readDrafts(page) {
  return page.evaluate(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    return raw && raw.files && typeof raw.files === 'object' ? raw.files : {};
  });
}

// Засев черновика кейса с корректным provenance: мок Contents API отдаёт
// канонический 40-hex blob SHA, и ensureFile принимает черновик только с ним.
async function seedCaseDraft(page, draft, options) {
  const sha = (options && options.baseSha) || 'c'.repeat(40);
  await page.addInitScript(
    (payload) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { 'content/cases/orbital-mk-ii.json': payload.draft },
          baseShas: { 'content/cases/orbital-mk-ii.json': payload.sha }
        })
      );
    },
    { draft, sha }
  );
}

// Кейс с ровно `count` блоками, ручной порядок (структурные операции открыты).
function caseWithBlocks(count) {
  const draft = JSON.parse(JSON.stringify(CASE_JSON));
  draft.layoutMode = 'manual';
  draft.case.media = [];
  for (let i = 0; i < count; i += 1) {
    draft.case.media.push(JSON.parse(JSON.stringify(MEDIA[i % MEDIA.length])));
  }
  return draft;
}

// confirm() в Playwright по умолчанию отклоняется — тесту нужен явный режим.
function handleDialogs(page, mode) {
  const state = { mode, seen: [] };
  page.on('dialog', (dialog) => {
    state.seen.push(dialog.message());
    if (state.mode === 'accept') dialog.accept();
    else dialog.dismiss();
  });
  return state;
}

async function openCaseEditor(page) {
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  await page.goto(`${ctx.base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click(`a[href="#/case/${CASE_ID}"]`);
  await expect(page.locator('#media-strip .media-slot').first()).toBeVisible();
}

async function enableManualLayout(page) {
  await page.click('#layout-manual-btn');
  await expect(page.locator('#media-strip .reorder-handle').first()).toBeVisible();
}

test('layoutMode-гейт: «+ Фото» в seeded требует подтверждения', async ({ page }) => {
  await mockGitHub(page);
  const dialogs = handleDialogs(page, 'dismiss');
  await openCaseEditor(page);

  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length);
  await expect(page.locator('#media-strip .reorder-handle')).toHaveCount(0);

  // Отказ: ни блока, ни черновика — режим остался автоматическим.
  await page.click('#media-add-photo');
  await expect(page.locator('.toast')).toContainText('Черновик не изменён');
  expect(dialogs.seen.join(' ')).toContain('ручном порядке');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length);
  await expect(page.locator('#draft-indicator')).toBeHidden();

  // Согласие: включается ручной порядок и появляется блок.
  dialogs.mode = 'accept';
  await page.click('#media-add-photo');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length + 1);
  await expect(page.locator('#draft-indicator')).toBeVisible();

  await page.waitForFunction((expected) => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.layoutMode === 'manual' && draft.case.media.length === expected;
  }, MEDIA.length + 1);
  const drafts = await readDrafts(page);
  const added = drafts[CASE_PATH].case.media[MEDIA.length];
  expect(added.type).toBe('image');
  expect(added.format).toBe('tall');
  expect(added.src).toBe('');
  expect(added.bg).toBe(MEDIA[MEDIA.length - 1].bg); // фон наследуется от последнего блока
  expect(added.id).toMatch(/^[a-z0-9-]+$/);
  expect(added.caption.label.ru).toBe('');
});

test('«+ Видео»: drop-зона .webm и отдельная зона постера', async ({ page }) => {
  await mockGitHub(page);
  handleDialogs(page, 'accept');
  await openCaseEditor(page);
  await enableManualLayout(page);

  await page.click('#media-add-video');
  const i = MEDIA.length;
  await expect(page.locator(typeField(i))).toHaveValue('video');
  await expect(page.locator(srcInput(i))).toHaveAttribute('accept', '.webm');
  // Постер обязателен: при отключённой анимации это единственный кадр слота.
  await expect(page.locator(posterInput(i))).toBeAttached();
  await expect(slot(page, i)).toContainText('постер (обязателен)');

  // Загруженный .webm получает cache-bust-имя от 0N-позиции (padStart: 06, не 010).
  await page.setInputFiles(srcInput(i), { name: 'loop.webm', mimeType: 'video/webm', buffer: WEBM_BUFFER });
  await expect(srcZone(page, i).locator('.drop-zone__badge')).toBeVisible();
  await page.waitForFunction((expected) => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case.media.length === expected;
  }, i + 1);
  await expect(slot(page, i).locator('.media-slot__technical-body .drop-zone-path code').first()).toHaveText(
    `./assets/cases/${CASE_ID}/0${i + 1}-${hash8(WEBM_BUFFER)}.webm`
  );
  const technical = slot(page, i).locator('.media-slot__technical-body');
  await expect(technical.locator(typeField(i))).toHaveCount(1);
  await expect(technical.locator(formatField(i))).toHaveCount(1);
  await expect(technical.locator(`[data-field="${CASE_PATH}::case.media.${i}.seamless"]`)).toHaveCount(1);
  await expect(technical.locator('.drop-zone-path')).toHaveCount(2);
  await expect(technical).toContainText('Путь постера');
  await expect(technical).toContainText('жёсткий предел 40 МБ');
});

test('удаление блока: confirm, сдвиг списка и запрет удаления последнего', async ({ page }) => {
  await mockGitHub(page);
  const dialogs = handleDialogs(page, 'dismiss');
  await openCaseEditor(page);
  await enableManualLayout(page);

  // Отказ в confirm — блок остаётся на месте.
  await page.click('[data-media-remove="0"]');
  await expect(page.locator('.toast').last()).toContainText('блок оставлен на месте');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length);

  dialogs.mode = 'accept';
  await page.click('[data-media-remove="0"]');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length - 1);
  await page.waitForFunction((expectedSrc) => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case.media[0].src === expectedSrc;
  }, MEDIA[1].src);
  const drafts = await readDrafts(page);
  expect(drafts[CASE_PATH].case.media).toHaveLength(MEDIA.length - 1);
  expect(drafts[CASE_PATH].case.media[0].caption.label.en).toBe(MEDIA[1].caption.label.en);
});

test('удаление последнего блока запрещено русским сообщением', async ({ page }) => {
  await mockGitHub(page);
  handleDialogs(page, 'accept');
  // Черновик с ОДНИМ блоком — иначе пришлось бы удалять по одному.
  await seedCaseDraft(page, caseWithBlocks(1));
  await openCaseEditor(page);

  await expect(page.locator('#media-strip .media-slot')).toHaveCount(1);
  await page.click('[data-media-remove="0"]');
  await expect(page.locator('.toast--error')).toContainText('Нельзя удалить последний блок');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(1);
});

test('предел 12 блоков: кнопки «добавить» скрыты, 0N-имена без «010»', async ({ page }) => {
  await mockGitHub(page);
  await seedCaseDraft(page, caseWithBlocks(12));
  await openCaseEditor(page);

  await expect(page.locator('#media-strip .media-slot')).toHaveCount(12);
  await expect(page.locator('#media-add-photo')).toHaveCount(0);
  await expect(page.locator('#media-add-video')).toHaveCount(0);
  await expect(page.locator('#media-cap-note')).toContainText('Достигнут предел: 12 блоков');
  await expect(page.locator('#media-count-warning')).toContainText('Длинный кейс: 12 блоков');

  // 0N-нейминг на ДВУЗНАЧНЫХ позициях: padStart, а не '0' + (i + 1),
  // иначе десятый слот назвал бы файл «010-<hash>.png».
  const cases = [
    { index: 8, expected: '09' },
    { index: 9, expected: '10' },
    { index: 11, expected: '12' }
  ];
  for (const item of cases) {
    const buffer = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from(`slot-${item.index}`)]);
    await page.setInputFiles(srcInput(item.index), {
      name: 'shot.png',
      mimeType: 'image/png',
      buffer
    });
    await expect(slot(page, item.index).locator('.media-slot__technical-body .drop-zone-path code').first()).toHaveText(
      `./assets/cases/${CASE_ID}/${item.expected}-${hash8(buffer)}.png`
    );
  }
});

test('порог предупреждения о длине кейса: 8 блоков молчат, 9 предупреждают', async ({ page }) => {
  await mockGitHub(page);
  await seedCaseDraft(page, caseWithBlocks(8));
  await openCaseEditor(page);
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(8);
  await expect(page.locator('#media-count-warning')).toHaveCount(0);
  // На пороге кнопки добавления ещё доступны — предупреждение не блокирует.
  await expect(page.locator('#media-add-photo')).toBeVisible();

  handleDialogs(page, 'accept');
  await page.click('#media-add-photo');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(9);
  await expect(page.locator('#media-count-warning')).toContainText('Длинный кейс: 9 блоков');
});

test('переключатель формата пишет case.media.N.format', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);

  const before = MEDIA[0].format;
  const next = before === 'wide' ? 'tall' : 'wide';
  await slot(page, 0).locator('details').first().locator('summary').click();
  await expect(page.locator(formatField(0))).toHaveValue(before);
  await page.selectOption(formatField(0), next);
  await page.waitForFunction((expected) => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case.media[0].format === expected;
  }, next);
  const drafts = await readDrafts(page);
  expect(drafts[CASE_PATH].case.media[0].format).toBe(next);
  // Формат меняется БЕЗ переключения в ручной режим (это не структурная правка).
  expect(drafts[CASE_PATH].layoutMode).toBeUndefined();
});

test('смена типа фото→видео чистит src и отменяет pending-байты', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);

  await page.setInputFiles(srcInput(0), { name: 'shot.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();
  await expect(page.locator('#media-warning')).toBeVisible();

  await slot(page, 0).locator('details').first().locator('summary').click();
  await page.selectOption(typeField(0), 'video');
  await expect(page.locator(srcInput(0))).toHaveAttribute('accept', '.webm');
  // Байты фото отменены: предупреждение о pending-медиа погасло.
  await expect(page.locator('#media-warning')).toBeHidden();
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeHidden();

  await page.waitForFunction(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case.media[0].type === 'video';
  });
  const drafts = await readDrafts(page);
  expect(drafts[CASE_PATH].case.media[0].type).toBe('video');
  expect(drafts[CASE_PATH].case.media[0].src).toBe('');
  // Подпись, фон и формат блока пережили смену типа.
  expect(drafts[CASE_PATH].case.media[0].bg).toBe(MEDIA[0].bg);
  expect(drafts[CASE_PATH].case.media[0].format).toBe(MEDIA[0].format);
  expect(drafts[CASE_PATH].case.media[0].caption.label.en).toBe(MEDIA[0].caption.label.en);

  // Пустой src блокирует публикацию русским сообщением (у drop-зоны нет
  // data-field-якоря, поэтому текст ошибки приходит тостом).
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('Публикация остановлена');
  await expect(page.locator('.toast--error')).toContainText('путь файла должен лежать внутри ./assets/');
});

test('pending-медиа переезжает при добавлении и удалении блоков', async ({ page }) => {
  const calls = await mockGitHub(page);
  handleDialogs(page, 'accept');
  await openCaseEditor(page);
  await enableManualLayout(page);

  // Слот 0 — байты уйдут вместе с ним в удаление; слот 1 — переедет на 0.
  await page.setInputFiles(srcInput(0), { name: 'doomed.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await page.setInputFiles(srcInput(1), { name: 'keeper.png', mimeType: 'image/png', buffer: PNG2_BUFFER });
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();
  await expect(srcZone(page, 1).locator('.drop-zone__badge')).toBeVisible();

  // Добавление блока в конец не сбивает адресацию существующих загрузок.
  await page.click('#media-add-photo');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length + 1);
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();
  await expect(srcZone(page, 1).locator('.drop-zone__badge')).toBeVisible();
  await expect(srcZone(page, MEDIA.length).locator('.drop-zone__badge')).toBeHidden();

  // Удаление слота 0: его байты отменяются, загрузка слота 1 уезжает на слот 0.
  await page.click('[data-media-remove="0"]');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length);
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();
  await expect(srcZone(page, 1).locator('.drop-zone__badge')).toBeHidden();

  // Новый блок держит публикацию (нет файла) — уберём его перед коммитом.
  await page.click(`[data-media-remove="${MEDIA.length - 1}"]`);
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length - 1);

  // Имя нового файла фиксируется в момент ЗАГРУЗКИ (по позиции слота тогда):
  // 02-… для пережившей загрузки, 01-… для отменённой.
  const keeperPath = `assets/cases/${CASE_ID}/02-${hash8(PNG2_BUFFER)}.png`;
  const doomedPath = `assets/cases/${CASE_ID}/01-${hash8(PNG_BUFFER)}.png`;
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const treePaths = calls.tree.map((entry) => entry.path);
  expect(treePaths).toContain(keeperPath);
  expect(treePaths).not.toContain(doomedPath);

  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  // Пережившая загрузка адресует ПЕРВЫЙ блок опубликованного кейса.
  expect(published.case.media[0].src).toBe(`./${keeperPath}`);
  expect(published.case.media).toHaveLength(MEDIA.length - 1);
});

/* Конверт черновиков (слайс B, ревью).
 * Восстановленный черновик кладётся поверх свежей базы ЦЕЛИКОМ, поэтому он
 * применим, только если снят с той же версии файла. Ни одна форма без
 * доказанного provenance не восстанавливается — четыре входа, один исход. */
const REJECTED_ENVELOPES = [
  {
    name: 'V1 (плоская карта без версии и provenance)',
    build: () => {
      const legacy = JSON.parse(JSON.stringify(CASE_JSON));
      legacy.case.srcs = MEDIA.map((block) => block.src);
      legacy.case.captions = MEDIA.map((block) => block.caption);
      legacy.case.palette = MEDIA.map((block) => block.bg);
      legacy.case.text.title.ru = 'ЧЕРНОВИК V1';
      delete legacy.case.media;
      return { [CASE_PATH]: legacy };
    },
    marker: 'ЧЕРНОВИК V1'
  },
  {
    name: 'конверт версии из будущего',
    build: () => {
      const draft = JSON.parse(JSON.stringify(CASE_JSON));
      draft.case.text.title.ru = 'ЧЕРНОВИК V3';
      return {
        version: 3,
        files: { [CASE_PATH]: draft },
        baseShas: { [CASE_PATH]: `sha-${CASE_PATH}` }
      };
    },
    marker: 'ЧЕРНОВИК V3'
  },
  {
    name: 'повреждённый конверт V2 (files не объект)',
    build: () => ({ version: 2, files: 'сломано' }),
    marker: null
  },
  {
    name: 'V2 без provenance (baseShas потеряны)',
    build: () => {
      const draft = JSON.parse(JSON.stringify(CASE_JSON));
      draft.case.text.title.ru = 'ЧЕРНОВИК БЕЗ SHA';
      return { version: 2, files: { [CASE_PATH]: draft } };
    },
    marker: 'ЧЕРНОВИК БЕЗ SHA'
  }
];

for (const envelope of REJECTED_ENVELOPES) {
  test(`черновик отклоняется fail-closed: ${envelope.name}`, async ({ page }) => {
    await mockGitHub(page);
    await page.addInitScript((payload) => {
      sessionStorage.setItem('codexAdminDrafts', JSON.stringify(payload));
    }, envelope.build());
    await openCaseEditor(page);

    // Сообщение приходит либо при загрузке (нечитаемый конверт), либо в
    // ensureFile (конверт читаемый, но provenance не подтверждается) — к
    // моменту открытия кейса оно на экране в обоих случаях.
    await expect(page.locator('.toast--warn')).toContainText('сброшен');
    // Открылась база с GitHub: число блоков из content/, маркер черновика не виден.
    await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length);
    if (envelope.marker) {
      await expect(page.locator(`[data-field="${CASE_PATH}::case.text.title.ru"]`)).not.toHaveValue(envelope.marker);
    }
    await expect(page.locator('#draft-indicator')).toBeHidden();
  });
}

test('черновик V2 со ЧУЖИМ baseSha сбрасывается при открытии файла', async ({ page }) => {
  await mockGitHub(page);
  const draft = JSON.parse(JSON.stringify(CASE_JSON));
  draft.case.text.title.ru = 'СНЯТ С ДРУГОЙ ВЕРСИИ';
  // Конверт корректный, но снят с версии файла, которой на сервере уже нет.
  await seedCaseDraft(page, draft, { baseSha: 'd'.repeat(40) });
  await openCaseEditor(page);

  await expect(page.locator('.toast--warn')).toContainText('снят с другой версии файла');
  await expect(page.locator(`[data-field="${CASE_PATH}::case.text.title.ru"]`)).not.toHaveValue('СНЯТ С ДРУГОЙ ВЕРСИИ');
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('черновик V2 со СВОИМ baseSha восстанавливается', async ({ page }) => {
  await mockGitHub(page);
  const draft = JSON.parse(JSON.stringify(CASE_JSON));
  draft.case.text.title.ru = 'ЖИВОЙ ЧЕРНОВИК';
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await expect(page.locator(`[data-field="${CASE_PATH}::case.text.title.ru"]`)).toHaveValue('ЖИВОЙ ЧЕРНОВИК');
  await expect(page.locator('#draft-indicator')).toBeVisible();
});

test('TOCTOU: расхождение blob sha на head отменяет публикацию без коммита', async ({ page }) => {
  const calls = await mockGitHub(page, {
    shaForPath: (path, ref) => (path === CASE_PATH && ref === 'b'.repeat(40) ? 'd'.repeat(40) : 'c'.repeat(40))
  });
  // Файл увели из-под нас между publishPrecheck и деревом: на head у него
  // другой blob sha. Shared mock различает исходную загрузку и head ref.
  await openCaseEditor(page);

  await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill('Правка перед гонкой');
  await expect(page.locator('#draft-indicator')).toBeVisible();

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');

  await expect(page.locator('.toast--error')).toContainText('изменился на GitHub');
  // Ни одного блоба, ни дерева, ни обновления ref — коммита не было.
  expect(calls.blobs).toHaveLength(0);
  expect(calls.tree).toHaveLength(0);
  expect(calls.refUpdated).toBe(false);
  // Черновик цел — правки не потеряны.
  await expect(page.locator('#draft-indicator')).toBeVisible();
});

test('TOCTOU: занятый путь бинарника отменяет публикацию без коммита', async ({ page }) => {
  const calls = await mockGitHub(page);
  const takenPath = `assets/cases/${CASE_ID}/01-${hash8(PNG_BUFFER)}.png`;
  // Имя нового файла несёт hash8 содержимого, поэтому на head его быть не
  // должно. Кто-то занял путь — публикуем не то, что показали владельцу.
  await page.route(`**/repos/Gorgutc/codex/contents/${takenPath}**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ type: 'file', encoding: 'base64', sha: 'sha-занято', content: '' })
    })
  );
  await openCaseEditor(page);

  await page.setInputFiles(srcInput(0), { name: 'shot.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await expect(srcZone(page, 0).locator('.drop-zone__badge')).toBeVisible();

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');

  await expect(page.locator('.toast--error')).toContainText('уже существует на сервере');
  expect(calls.blobs).toHaveLength(0);
  expect(calls.tree).toHaveLength(0);
  expect(calls.refUpdated).toBe(false);
});

test('TOCTOU: сетевая ошибка проверки НЕ выдаётся за гонку', async ({ page }) => {
  const calls = await mockGitHub(page);
  // Проверка свежести идёт на запиненном head; обрываем именно её. Раньше
  // любая ошибка приравнивалась к «файл изменился» — владелец шёл чинить
  // несуществующую гонку вместо того, чтобы повторить попытку.
  let exactHeadReads = 0;
  await page.route(`**/repos/Gorgutc/codex/contents/content/cases/orbital-mk-ii.json?ref=${'b'.repeat(40)}`, (route) => {
    exactHeadReads += 1;
    // validateAll reads the full authoritative catalog once before opening the
    // dialog and again at confirmation; fail the subsequent per-file precheck.
    if (exactHeadReads >= 3) return route.abort('failed');
    return route.fallback();
  });
  await openCaseEditor(page);

  await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill('Правка при обрыве сети');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');

  const toast = page.locator('.toast--error');
  await expect(toast).toContainText('Не удалось проверить состояние');
  await expect(toast).toContainText('повторите попытку');
  await expect(toast).not.toContainText('изменился на сервере');
  expect(calls.tree).toHaveLength(0);
  expect(calls.refUpdated).toBe(false);
});

test('две публикации подряд в одной вкладке проходят', async ({ page }) => {
  const calls = await mockGitHub(page, {
    sourceShaForCommit: (count) => (count === 1 ? 'a'.repeat(40) : 'd'.repeat(40))
  });
  /* Регрессия: план собирался в диалоге ДО publishPrecheck и нёс sha базы,
     который первый же коммит делал устаревшим — вторая публикация в той же
     вкладке падала «файл изменился» на пустом месте.
     Базовый мок Contents API всегда отдаёт файл С ДИСКА и один и тот же sha,
     поэтому гонку он не воспроизводит вовсе. Здесь Contents API отражает
     коммиты: после каждой публикации подменяем и содержимое, и sha — ровно
     то, что делает git (sha блоба выводится из содержимого). */
  await openCaseEditor(page);

  for (const value of ['Первая правка', 'Вторая правка']) {
    await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill(value);
    await expect(page.locator('#draft-indicator')).toBeVisible();
    await page.click('#publish-btn');
    await expect(page.locator('#publish-dialog')).toBeVisible();
    await page.click('#publish-confirm');
    await expect(page.locator('.toast--success').last()).toContainText('Опубликовано');
    await expect(page.locator('#publish-btn')).toHaveText('Опубликовать');
    expect(await page.evaluate(() => window.AdminState.changedPaths())).toEqual([]);
    await expect(page.locator('#draft-indicator')).toBeHidden();
  }

  expect(calls.refUpdated).toBe(true);
  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const treeEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  expect(JSON.parse(Buffer.from(blobBySha.get(treeEntry.sha).content, 'base64').toString('utf8')).card.title.ru).toBe(
    'Вторая правка'
  );
});

test('гонка: блок удалён, пока файл читался — байты не уезжают в чужой слот', async ({ page }) => {
  const calls = await mockGitHub(page);
  handleDialogs(page, 'accept');
  await openCaseEditor(page);
  await enableManualLayout(page);

  // Тормозим чтение файла ровно в том окне, где раньше терялась идентичность
  // блока: запись создавалась ПОСЛЕ await по исходному dot-пути.
  await page.evaluate(() => {
    const original = Blob.prototype.arrayBuffer;
    window.__releaseRead = null;
    Blob.prototype.arrayBuffer = function () {
      return new Promise((resolve) => {
        window.__releaseRead = () => resolve(original.call(this));
      });
    };
  });

  await page.setInputFiles(srcInput(0), { name: 'in-flight.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await page.waitForFunction(() => typeof window.__releaseRead === 'function');

  // Пока байты «читаются», удаляем блок 0 — цель загрузки исчезает.
  await page.click('[data-media-remove="0"]');
  await expect(page.locator('#media-strip .media-slot')).toHaveCount(MEDIA.length - 1);

  await page.evaluate(() => window.__releaseRead());
  await expect(page.locator('.toast--warn')).toContainText('Загрузка отменена');

  // Ни одна drop-зона не получила pending-бейдж, предупреждение о несохранённых
  // медиа не зажглось: байты выброшены, а не перевешены на соседний блок.
  await expect(page.locator('#media-strip .drop-zone__badge:visible')).toHaveCount(0);
  await expect(page.locator('#media-warning')).toBeHidden();

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  // В коммите только JSON — ни одного бинарника.
  const treePaths = calls.tree.map((entry) => entry.path);
  expect(treePaths).toEqual([CASE_PATH]);
  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  expect(published.case.media).toHaveLength(MEDIA.length - 1);
  expect(published.case.media.every((block) => !/-[0-9a-f]{8}\.png$/.test(block.src))).toBe(true);
});

test('зеркало валидатора: CSS-эскейп в фоне и дубль id блокируют публикацию', async ({ page }) => {
  await mockGitHub(page);
  const draft = caseWithBlocks(3);
  // CSS-эскейп: токенизатор развернёт "u\72l(" обратно в url(), поэтому
  // запрета одного лишь литерала "url(" недостаточно.
  draft.case.media[0].bg = 'linear-gradient(red,blue),u\\72l(https://evil.example/p.png)';
  draft.case.media[1].id = 'hero';
  draft.case.media[2].id = 'hero'; // дубль служебного id
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  // Некорректный/дублирующий id остаётся задачей валидатора, но не может
  // создавать дубли id в DOM и связывать disclosure/focus с чужим слотом.
  const disclosureIds = await page.locator('#media-strip [id^="media-"]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(disclosureIds).size).toBe(disclosureIds.length);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  const toast = page.locator('.toast--error');
  await expect(toast).toContainText('Публикация остановлена');
  await expect(toast).toContainText('фон должен быть ОДНИМ слоем');
  await expect(toast).toContainText('повторяется');
});

test('зеркало валидатора: видео-блок без постера не публикуется', async ({ page }) => {
  await mockGitHub(page);
  const draft = caseWithBlocks(2);
  draft.case.media[0].type = 'video';
  draft.case.media[0].src = './assets/cases/orbital-mk-ii/orbital-shell-idle.webm';
  draft.case.media[0].poster = null;
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await expect(page.locator('#media-strip .media-slot')).toHaveCount(2);
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('видео-блоку нужен постер');
});

/* ── необязательные подписи блоков ────────────────────────────────────── */

test('пустые подписи публикуются: блок без текста — валидный кейс', async ({ page }) => {
  const calls = await mockGitHub(page);
  const draft = caseWithBlocks(2);
  // Владелец хочет серию иллюстраций без сопровождающего текста.
  draft.case.media[0].caption = { label: { en: '', ru: '' }, desc: { en: '', ru: '' } };
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  const labelEn = page.locator(`[data-field="${CASE_PATH}::case.media.0.caption.label.en"]`);
  await expect(labelEn).toHaveValue('');
  await expect(page.locator('#caption-optional-hint')).toContainText('Подписи необязательны');

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  expect(published.case.media[0].caption.label.en).toBe('');
  expect(published.case.media[0].caption.desc.ru).toBe('');
});

test('подпись на одном языке блокирует публикацию русским сообщением у поля', async ({ page }) => {
  const calls = await mockGitHub(page);
  await openCaseEditor(page);

  // Стираем RU-заголовок первого слота: EN остаётся — это недоперевод.
  await page.locator(`[data-field="${CASE_PATH}::case.media.0.caption.label.ru"]`).fill('');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('заполните обе локали или оставьте обе пустыми');
  // Ошибка встаёт у ПУСТОГО поля — именно его надо решить.
  const ruField = page.locator(`[data-field="${CASE_PATH}::case.media.0.caption.label.ru"]`);
  await expect(ruField).toHaveClass(/field-invalid/);
  await expect(ruField.locator('xpath=ancestor::details[contains(@class, "media-slot__caption")]')).toHaveAttribute('open', '');
  await expect(ruField.locator('xpath=following-sibling::p[1]')).toContainText('Слот 1 — заголовок');
  expect(calls.tree).toHaveLength(0);

  // Пустой EN рядом с пустым RU — уже валидно, публикация проходит.
  await page.locator(`[data-field="${CASE_PATH}::case.media.0.caption.label.en"]`).fill('');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
});

/* ── склейка блоков «биханс-приёмом» (seamless) ───────────────────────── */

const seamlessField = (i) => `[data-field="${CASE_PATH}::case.media.${i}.seamless"]`;

test('seamless: чекбокс задизейблен на первом блоке и в автоматическом порядке', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);

  // seeded: склейка недоступна нигде — порядок блоков подбирает раскладка.
  await expect(page.locator(seamlessField(1))).toBeDisabled();
  await expect(slot(page, 1)).toContainText('Доступно при ручном порядке блоков');

  await enableManualLayout(page);
  // Первому блоку клеиться не к чему даже при ручном порядке.
  await expect(page.locator(seamlessField(0))).toBeDisabled();
  await expect(slot(page, 0)).toContainText('Первый блок склеивать не с чем');
  await expect(page.locator(seamlessField(1))).toBeEnabled();
});

test('seamless: чекбокс публикуется флагом блока', async ({ page }) => {
  const calls = await mockGitHub(page);
  // Полотно по правилам цепочки: одинаковый формат и подпись только у
  // последней полосы (у первой её чистим — иначе текст встал бы между полос).
  const draft = JSON.parse(JSON.stringify(CASE_JSON));
  draft.layoutMode = 'manual';
  draft.case.media[1].format = draft.case.media[0].format;
  draft.case.media[0].caption = { label: { en: '', ru: '' }, desc: { en: '', ru: '' } };
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await slot(page, 1).locator('details').first().locator('summary').click();
  await page.check(seamlessField(1));
  await page.waitForFunction(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case.media[1].seamless === true;
  });

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  expect(published.case.media[1].seamless).toBe(true);
  expect(published.layoutMode).toBe('manual');
  // Снятый флаг убирает ключ целиком — в JSON не остаётся seamless:false.
  expect('seamless' in published.case.media[0]).toBe(false);
});

test('seamless: подпись на не-последней полосе блокирует публикацию', async ({ page }) => {
  const calls = await mockGitHub(page);
  const draft = caseWithBlocks(3);
  draft.case.media[1].seamless = true; // цепочка [0,1]
  draft.case.media[1].format = draft.case.media[0].format;
  // Подпись у ПЕРВОЙ полосы: она рисуется между двумя медиа и разрезает
  // полотно — ровно то, ради чего склейку и включали.
  draft.case.media[0].caption = { label: { en: 'Split', ru: 'Разрыв' }, desc: { en: '', ru: '' } };
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('подпись возможна только у ПОСЛЕДНЕГО блока');
  expect(calls.tree).toHaveLength(0);
});

test('seamless: смешанные форматы в цепочке блокируют публикацию', async ({ page }) => {
  const calls = await mockGitHub(page);
  const draft = caseWithBlocks(3);
  draft.case.media[0].format = 'wide';
  draft.case.media[1].format = 'tall';
  draft.case.media[1].seamless = true;
  for (const block of draft.case.media) {
    block.caption = { label: { en: '', ru: '' }, desc: { en: '', ru: '' } };
  }
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('формат должен совпадать');
  expect(calls.tree).toHaveLength(0);
});

test('зеркало подписей: битая форма пары ловится в админке, а не в CI', async ({ page }) => {
  const calls = await mockGitHub(page);
  // Формы, которые генератор отвергает: пара-массив и числа вместо строк.
  // Без зеркала публикация уходила бы в коммит и возвращалась авто-revert'ом.
  const draft = caseWithBlocks(2);
  draft.case.media[0].caption.label = ['Slot', 'Слот'];
  draft.case.media[1].caption.desc = { en: 5, ru: 5 };
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  const toast = page.locator('.toast--error');
  await expect(toast).toContainText('Публикация остановлена');
  await expect(toast).toContainText('поле повреждено');
  await expect(toast).toContainText('значение должно быть текстом');
  expect(calls.tree).toHaveLength(0);
});

test('seamless: блок, ставший первым, не публикуется молча', async ({ page }) => {
  const calls = await mockGitHub(page);
  // Черновик, снятый ДО перестановки: склейка стоит на блоке, который теперь
  // первый. Молча снимать флаг нельзя — это тихая правка вёрстки кейса.
  const draft = caseWithBlocks(3);
  draft.case.media[0].seamless = true;
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('склейка возможна начиная со второго блока');
  expect(calls.tree).toHaveLength(0);
});

/* ── внешняя ссылка кейса (CASE-CTA-01) ───────────────────────────────── */

test('CTA: тогл + адрес публикуются в case.cta', async ({ page }) => {
  const calls = await mockGitHub(page);
  await openCaseEditor(page);

  // У кейса ссылки нет — поля адреса тоже нет.
  await expect(page.locator('#case-cta-section')).toBeVisible();
  await expect(page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`)).toHaveCount(0);
  await expect(page.locator('#case-cta-hint')).toContainText('Кнопки в шапке кейса нет');

  await page.click('#case-cta-toggle');
  const urlField = page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`);
  await expect(urlField).toBeVisible();
  await expect(page.locator('#case-cta-hint')).toContainText('artstation.com');

  const CTA_URL = 'https://www.behance.net/gallery/12345/orbital';
  await urlField.fill(CTA_URL);
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');

  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const published = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  expect(published.case.cta).toEqual({ enabled: true, url: CTA_URL });
});

test('CTA: выключение сохраняет ПОСЛЕДНИЙ введённый адрес, а не адрес момента рендера', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);
  await page.click('#case-cta-toggle');

  const urlField = () => page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`);
  await expect(page.locator('#case-cta-toggle')).toBeChecked();
  await urlField().fill('https://www.behance.net/gallery/1/first');
  // Второй адрес вводится ПОСЛЕ включения тогла: обработчик обязан читать
  // черновик, а не значение, замкнутое на момент отрисовки секции.
  await urlField().fill('https://dprofile.ru/works/second');
  await page.click('#case-cta-toggle'); // выключили
  // Тогл перерисовывает секцию: ждём НОВЫЙ снятый чекбокс, иначе следующий
  // клик уйдёт в узел, который вот-вот заменят. Запись черновика отложенная —
  // ждём и её (sessionStorage), а не только перерисовку.
  await expect(page.locator('#case-cta-toggle')).not.toBeChecked();
  await page.waitForFunction(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case && draft.case.cta && draft.case.cta.enabled === false;
  });
  const off = await readDrafts(page);
  expect(off[CASE_PATH].case.cta).toEqual({ enabled: false, url: 'https://dprofile.ru/works/second' });

  // Включили обратно — адрес тот же, без «воскрешения» первого.
  await page.click('#case-cta-toggle');
  await expect(page.locator('#case-cta-toggle')).toBeChecked();
  await expect(urlField()).toHaveValue('https://dprofile.ru/works/second');
  await page.waitForFunction(() => {
    const raw = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || 'null');
    const draft = raw && raw.files && raw.files['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.case && draft.case.cta && draft.case.cta.enabled === true;
  });
  const on = await readDrafts(page);
  expect(on[CASE_PATH].case.cta).toEqual({ enabled: true, url: 'https://dprofile.ru/works/second' });
});

test('CTA: включённый тогл без адреса подсвечивает поле, а не только тост', async ({ page }) => {
  const calls = await mockGitHub(page);
  await openCaseEditor(page);
  await page.click('#case-cta-toggle');

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText('вставьте адрес проекта');
  // Якорь у поля: applyPendingErrors ищет [data-field], и без него ошибка
  // осталась бы безликим тостом (у секции и тогла свои якоря).
  const urlField = page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`);
  await expect(urlField).toHaveClass(/field-invalid/);
  await expect(urlField.locator('xpath=following-sibling::p[1]')).toContainText('Внешняя ссылка');
  expect(calls.tree).toHaveLength(0);
});

test('CTA: чужой домен и заглушка блокируют публикацию русским сообщением', async ({ page }) => {
  const calls = await mockGitHub(page);
  await openCaseEditor(page);
  await page.click('#case-cta-toggle');
  const urlField = page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`);

  await urlField.fill('https://portfolio.example.com/orbital');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error')).toContainText(
    'разрешены только artstation.com, behance.net, dprofile.ru'
  );

  // Суффиксный двойник разрешённого домена — сравнение точное, не «по концу».
  await urlField.fill('https://evil-dprofile.ru/works/1');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error').last()).toContainText('evil-dprofile.ru');

  // Логин/пароль в адресе утащили бы креды в публичный js/cards-data.js.
  await urlField.fill('https://user:token@dprofile.ru/works/1');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error').last()).toContainText('логина и пароля');

  await urlField.fill('https://dprofile.ru:8443/works/1');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error').last()).toContainText('порта');
  await expect(urlField).toHaveClass(/field-invalid/);
  await expect(urlField.locator('xpath=following-sibling::p[1]')).toContainText('Внешняя ссылка');

  // Адрес-заглушка — отдельное сообщение (это самый вероятный copy-paste).
  await urlField.fill('https://www.behance.net/REPLACE_WITH_REAL');
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.toast--error').last()).toContainText('адрес-заглушка REPLACE_WITH_REAL');

  // Выключенный тогл с пустым адресом убирает ключ целиком — кейс возвращается
  // к состоянию «ссылки нет».
  await urlField.fill('');
  await page.click('#case-cta-toggle');
  await expect(page.locator(`[data-field="${CASE_PATH}::case.cta.url"]`)).toHaveCount(0);
  expect(calls.tree).toHaveLength(0);
});

test('вход: 404 на Netlify-функции прячет кнопку GitHub и объясняет вход по токену', async ({ page }) => {
  await mockGitHub(page);
  // Статический хостинг (Beget): функций нет, popup вёл бы в 404.
  await page.route('**/.netlify/functions/cms-auth*', (route) => route.fulfill({ status: 404, body: 'not found' }));
  await page.goto(`${ctx.base}/admin/`);

  await expect(page.locator('#login-oauth-note')).toBeVisible();
  await expect(page.locator('#login-oauth-note')).toContainText('вход выполняется по токену');
  await expect(page.locator('#login-github')).toBeHidden();
  // Остался единственный путь входа — он рабочий.
  await page.click('#login-pat-toggle');
  await expect(page.locator('#pat-input')).toBeVisible();
});

test('вход: доступная Netlify-функция оставляет кнопку GitHub', async ({ page }) => {
  await mockGitHub(page);
  // Реальная функция отвечает 302 на github.com; с redirect:"manual" fetch
  // отдаёт opaqueredirect и никуда не идёт. Любой ответ, кроме 404, = контур есть.
  await page.route('**/.netlify/functions/cms-auth*', (route) =>
    route.fulfill({ status: 302, headers: { Location: 'https://github.com/login/oauth/authorize' }, body: '' })
  );
  await page.goto(`${ctx.base}/admin/`);

  await expect(page.locator('#login-github')).toBeVisible();
  await expect(page.locator('#login-oauth-note')).toBeHidden();
});

test('media workflow: шесть слотов — карточки с собственными disclosures и сеткой редактора', async ({ page }, testInfo) => {
  await mockGitHub(page);
  const draft = caseWithBlocks(6);
  draft.case.media.forEach((block, index) => {
    block.caption = { label: { en: 'Label ' + index, ru: 'Подпись ' + index }, desc: { en: '', ru: '' } };
  });
  await seedCaseDraft(page, draft);
  await openCaseEditor(page);
  const grid = page.locator('#media-strip.case-media-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.media-slot')).toHaveCount(6);
  await expect(grid.locator('.media-slot__caption details, details.media-slot__caption')).toHaveCount(6);
  await expect(grid.locator('summary[aria-controls]')).toHaveCount(12);
  await expect(page.locator('#caption-optional-hint')).toHaveCount(1);
  await expect(page.locator('#seamless-rules-hint')).toHaveCount(1);
  for (const [width, expectedRows] of [
    [1440, [3, 3]],
    [800, [2, 2, 2]],
    [500, [1, 1, 1, 1, 1, 1]]
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    const rows = await grid.locator('.media-slot').evaluateAll((slots) => {
      const groups = [];
      slots.forEach((slot) => {
        const top = Math.round(slot.getBoundingClientRect().top);
        const row = groups.find((item) => Math.abs(item.top - top) < 2);
        if (row) row.count += 1;
        else groups.push({ top, count: 1 });
      });
      return groups.sort((a, b) => a.top - b.top).map((row) => row.count);
    });
    expect(rows).toEqual(expectedRows);
  }
  for (let index = 0; index < 6; index += 1) {
    const card = grid.locator('.media-slot').nth(index);
    await expect(card.locator(`[data-field="${CASE_PATH}::case.media.${index}.caption.label.en"]`)).toHaveCount(1);
    await expect(card.locator(`[data-field="${CASE_PATH}::case.media.${index}.caption.desc.ru"]`)).toHaveCount(1);
    await expect(card.locator('.media-slot__technical-body .drop-zone-path')).toHaveCount(1);
    await expect(card.locator(`[data-field="${CASE_PATH}::case.media.${index}.type"]`)).toHaveCount(1);
    await expect(card.locator(`[data-field="${CASE_PATH}::case.media.${index}.format"]`)).toHaveCount(1);
    await expect(card.locator(`[data-field="${CASE_PATH}::case.media.${index}.seamless"]`)).toHaveCount(1);
    await expect(card.locator('.media-slot__technical-body')).toContainText('SVG, PNG, JPG или WebP');
  }
  await expect(grid.locator('details.media-slot__caption').first()).toHaveAttribute('open', '');
  const disclosureRelationships = await grid.locator('summary[aria-controls]').evaluateAll((nodes) => {
    const ids = nodes.map((node) => node.getAttribute('aria-controls'));
    return {
      unique: new Set(ids).size === ids.length,
      targetsExist: nodes.every((node) => document.getElementById(node.getAttribute('aria-controls'))),
      ownedByCard: nodes.every((node) => {
        const card = node.closest('.media-slot');
        const target = document.getElementById(node.getAttribute('aria-controls'));
        return card && target && card.contains(target);
      })
    };
  });
  expect(disclosureRelationships).toEqual({ unique: true, targetsExist: true, ownedByCard: true });
  await expect(page.locator('#seamless-rules-hint')).toHaveText(
    'Правила склейки полотна: одинаковый формат у полос и подпись только у последней, чтобы текст не разрезал иллюстрацию.'
  );
  await expect(page.getByText('Правила склейки полотна:', { exact: false })).toHaveCount(1);
  const visualDir = process.env.CODEX_TASK5_VISUAL_DIR;
  if (visualDir) fs.mkdirSync(visualDir, { recursive: true });
  const capturePath = (name) => (visualDir ? path.join(visualDir, name) : testInfo.outputPath(name));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: capturePath('case-media-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 500, height: 1000 });
  await page.screenshot({ path: capturePath('case-media-narrow.png'), fullPage: true });
});
