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
 *      слотов и motion-блоков, перестановка слота двигает блок case.media
 *      целиком (src, подпись, фон, формат);
 *   4) русский guard при попытке скрыть последний видимый кейс;
 *   5) выключение категории → кейсы категории затемнены с бейджем
 *      «категория скрыта», фильтр «All» в списке категорий отсутствует.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, startStaticServer, mockGitHub } from './fixtures/admin-harness.mjs';

const SETTINGS_PATH = 'content/settings.json';
const CASE_PATH = 'content/cases/orbital-mk-ii.json';

const settingsJson = JSON.parse(fs.readFileSync(path.join(ROOT, SETTINGS_PATH), 'utf8'));
const CARD_ORDER = settingsJson.cardOrder;
// Публикуемая схема слотов: один самодостаточный блок case.media[] на слот.
// Ожидания выводятся из живого контента (не хардкодятся): владелец правит
// подписи/число блоков через админку, и спек не должен от этого краснеть.
const caseJson = JSON.parse(fs.readFileSync(path.join(ROOT, CASE_PATH), 'utf8'));
const mediaJson = caseJson.case.media;
const motionJson = caseJson.case.motionBlocks;

const ctx = startStaticServer();

async function loginWithPat(page) {
  await page.goto(`${ctx.base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await expect(page.locator('.case-row').first()).toBeVisible();
}

// Автосейв черновиков в sessionStorage дебаунсится (~400 мс), поэтому
// сначала ждём появления нужного состояния, затем читаем снапшот.
async function waitDrafts(page, predicate, arg) {
  await page.waitForFunction(predicate, arg);
  return page.evaluate(() => (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {}));
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
    const drafts = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
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
    const store = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
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

  // manual: ручка у каждого слота и у каждого motion-блока (числа — из контента)
  expect(mediaJson.length).toBeGreaterThanOrEqual(2);
  expect(motionJson.length).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#media-strip .reorder-handle')).toHaveCount(mediaJson.length);
  await expect(page.locator('#motion-list .reorder-handle')).toHaveCount(motionJson.length);
  await expect(page.locator('#layout-section')).toContainText('Ручной порядок включён');
  await page.waitForFunction(() => {
    const drafts = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
    const draft = drafts['content/cases/orbital-mk-ii.json'];
    return !!draft && draft.layoutMode === 'manual';
  });

  // слот 1 ↓: блок case.media переезжает целиком — src (уже явный путь),
  // подпись и формат едут вместе с изображением.
  const firstFormat = mediaJson[0].format;
  const secondFormat = mediaJson[1].format;
  // sanity-guard фикстуры: ассерт «формат едет с блоком» не должен молча
  // превратиться в тавтологию, если владелец уравняет форматы слотов 1 и 2
  expect(firstFormat).not.toBe(secondFormat);
  await page.setInputFiles(`[data-media="${CASE_PATH}::case.media.0.src"]`, {
    name: 'reorder-pending.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a-reorder-pending', 'hex')
  });
  await page.waitForFunction(() => {
    const edit = window.AdminState.getMediaEdit('content/cases/orbital-mk-ii.json', 'case.media.0.src');
    return edit && edit.value;
  });
  const pendingPath = await page.evaluate(
    () => window.AdminState.getMediaEdit('content/cases/orbital-mk-ii.json', 'case.media.0.src').value
  );
  await page.click('[data-reorder="slot::0::down"]');
  await expect(page.locator('.toast').last()).toContainText('Порядок сохранён в черновик');
  const drafts = await waitDrafts(
    page,
    (expectedSrc) => {
      const store = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
      const draft = store['content/cases/orbital-mk-ii.json'];
      return !!draft && Array.isArray(draft.case.media) && draft.case.media[1].src === expectedSrc;
    },
    pendingPath
  );
  const draft = drafts[CASE_PATH];
  expect(draft.case.media).toHaveLength(mediaJson.length);
  expect(draft.case.media[0].src).toBe(mediaJson[1].src);
  expect(draft.case.media[1].src).toBe(pendingPath);
  expect(draft.case.media[1].caption.label.en).toBe(mediaJson[0].caption.label.en);
  expect(draft.case.media[0].caption.label.en).toBe(mediaJson[1].caption.label.en);
  expect(draft.case.media[0].format).toBe(secondFormat);
  expect(draft.case.media[1].format).toBe(firstFormat);
  const firstMoved = {
    caption: mediaJson[0].caption,
    format: mediaJson[0].format,
    type: mediaJson[0].type,
    bg: mediaJson[0].bg
  };
  if ('seamless' in mediaJson[0]) firstMoved.seamless = mediaJson[0].seamless;
  expect(draft.case.media[1]).toMatchObject(firstMoved);
  const secondMoved = {
    src: mediaJson[1].src,
    caption: mediaJson[1].caption,
    format: mediaJson[1].format,
    type: mediaJson[1].type,
    bg: mediaJson[1].bg
  };
  if ('seamless' in mediaJson[1]) secondMoved.seamless = mediaJson[1].seamless;
  expect(draft.case.media[0]).toMatchObject(secondMoved);
  await expect.poll(() => page.evaluate(() => {
    const moved = window.AdminState.getMediaEdit('content/cases/orbital-mk-ii.json', 'case.media.1.src');
    const old = window.AdminState.getMediaEdit('content/cases/orbital-mk-ii.json', 'case.media.0.src');
    return { moved: moved && moved.value, old: Boolean(old) };
  })).toEqual({ moved: pendingPath, old: false });

  // motion-блок 1 ↓: массив motionBlocks переставлен (ожидания — из контента)
  expect(motionJson[0].playback).not.toBe(motionJson[1].playback);
  await page.click('[data-reorder="motion::0::down"]');
  const drafts2 = await waitDrafts(
    page,
    (expectedPlayback) => {
      const store = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
      const draft2 = store['content/cases/orbital-mk-ii.json'];
      return !!draft2 && draft2.case.motionBlocks[0].playback === expectedPlayback;
    },
    motionJson[1].playback
  );
  expect(drafts2[CASE_PATH].case.motionBlocks[0].playback).toBe(motionJson[1].playback);
  expect(drafts2[CASE_PATH].case.motionBlocks[1].playback).toBe(motionJson[0].playback);

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
    // baseShas: провенанс черновика. ensureFile принимает восстановленный
    // черновик, только если он снят с ТОЙ ЖЕ версии файла; мок Contents
    // API отдаёт sha вида `sha-<path>`.
    const baseShas = {};
    for (const key of Object.keys(store)) baseShas[key] = 'sha-' + key;
    sessionStorage.setItem('codexAdminDrafts', JSON.stringify({ version: 2, files: store, baseShas }));
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
    const store = (JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {});
    return !!store['content/settings.json'];
  });
  const cadFilter = drafts[SETTINGS_PATH].filters.find((f) => f.key === 'cad');
  expect(cadFilter.enabled).toBe(false);
});

test('media reorder: фокус следует за перенесённым блоком, а не индексом', async ({ page }) => {
  await mockGitHub(page);
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.click('#layout-manual-btn');
  const firstKey = await page.locator('.media-slot').first().getAttribute('data-media-key');
  await page.click('[data-reorder="slot::0::down"]');
  await expect(page.locator('.media-slot').nth(1)).toHaveAttribute('data-media-key', firstKey);
  await expect(page.locator('.media-slot').nth(1).locator(':focus')).toHaveCount(1);
});

test('media reorder: legacy slots без id сохраняют ключ и фокус на границе', async ({ page }) => {
  await mockGitHub(page);
  const legacy = JSON.parse(JSON.stringify(caseJson));
  legacy.layoutMode = 'manual';
  legacy.case.media = legacy.case.media.slice(0, 2);
  legacy.case.media.forEach((block) => delete block.id);
  await page.addInitScript(({ path, draft }) => {
    sessionStorage.setItem('codexAdminDrafts', JSON.stringify({
      version: 2,
      files: { [path]: draft },
      baseShas: { [path]: 'c'.repeat(40) }
    }));
  }, { path: CASE_PATH, draft: legacy });
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  const first = page.locator('.media-slot').first();
  const stableKey = await first.getAttribute('data-media-key');
  expect(stableKey).toMatch(/^legacy-/);
  await first.locator('[data-reorder$="::down"]').click();
  const moved = page.locator('.media-slot').nth(1);
  await expect(moved).toHaveAttribute('data-media-key', stableKey);
  await expect(moved.locator('[data-reorder$="::up"]')).toBeFocused();
});

test('media reorder: duplicate id keeps the legacy key and video/seamless fields move as one block', async ({ page }) => {
  await mockGitHub(page);
  const draft = JSON.parse(JSON.stringify(caseJson));
  draft.layoutMode = 'manual';
  draft.case.media = draft.case.media.slice(0, 2);
  draft.case.media[0].id = 'hero';
  Object.assign(draft.case.media[1], {
    id: 'hero',
    type: 'video',
    src: './assets/cases/orbital-mk-ii/reorder-proof.webm',
    poster: './assets/cases/orbital-mk-ii/reorder-proof.png',
    seamless: true,
    bg: 'linear-gradient(135deg,#101820 0%,#203040 100%)',
    caption: { label: { en: 'Video travels', ru: 'Видео переезжает' }, desc: { en: 'Proof', ru: 'Проверка' } }
  });
  await page.addInitScript(({ path, value }) => {
    sessionStorage.setItem('codexAdminDrafts', JSON.stringify({
      version: 2,
      files: { [path]: value },
      baseShas: { [path]: 'c'.repeat(40) }
    }));
  }, { path: CASE_PATH, value: draft });
  await loginWithPat(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  const duplicate = page.locator('.media-slot').nth(1);
  const legacyKey = await duplicate.getAttribute('data-media-key');
  expect(legacyKey).toMatch(/^legacy-/);
  await duplicate.locator('[data-reorder$="::up"]').click();
  const moved = page.locator('.media-slot').first();
  await expect(moved).toHaveAttribute('data-media-key', legacyKey);
  await expect(moved.locator('[data-reorder$="::down"]')).toBeFocused();
  const reordered = await waitDrafts(page, () => {
    const files = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{"files":{}}').files || {};
    return files['content/cases/orbital-mk-ii.json'] && files['content/cases/orbital-mk-ii.json'].case.media[0].type === 'video';
  });
  expect(reordered[CASE_PATH].case.media[0]).toMatchObject({
    id: 'hero',
    type: 'video',
    src: './assets/cases/orbital-mk-ii/reorder-proof.webm',
    poster: './assets/cases/orbital-mk-ii/reorder-proof.png',
    seamless: true,
    bg: 'linear-gradient(135deg,#101820 0%,#203040 100%)',
    caption: { label: { en: 'Video travels', ru: 'Видео переезжает' }, desc: { en: 'Proof', ru: 'Проверка' } }
  });
});
