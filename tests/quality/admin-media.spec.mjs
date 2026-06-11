/* admin-media.spec.mjs — смоук медиа-управления админки (итерация E,
 * входит в npm run test:admin).
 *
 * Репозиторий раздаётся статикой, ВЕСЬ GitHub API мокается (page.route):
 * Contents API читает реальные файлы с диска, Git Data API записывает
 * blob'ы/tree в журнал вызовов для ассертов. Сценарии:
 *   1) замена миниатюры (PNG) и GLB-модели: pending-бейдж, превью через
 *      object-URL, предупреждение о перезагрузке, публикация — JSON
 *      ссылается на новые cache-bust-пути {base}-{hash8}.{ext}, бинарные
 *      blob'ы в tree, и НИЧЕГО не удаляется (ни одной tree-entry с
 *      sha: null): удаление в admin-коммите открыло бы окно 404 на проде,
 *      пока bot-коммит конвейера не пересоберёт страницы;
 *   2) Vimeo: URL парсится в цифровой ID с подтверждением, мусорный ввод
 *      блокирует публикацию русским сообщением у поля;
 *   3) изображение тяжелее жёсткого лимита блокируется русским тостом и
 *      не попадает в черновик.
 */
import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { hash8, startStaticServer, mockGitHub } from './fixtures/admin-harness.mjs';

const CASE_PATH = 'content/cases/orbital-mk-ii.json';
const THUMB_INPUT = `[data-media="${CASE_PATH}::card.thumb"]`;
const MODEL_INPUT = `[data-media="${CASE_PATH}::case.modelSrc"]`;
const VIMEO_FIELD = `[data-field="${CASE_PATH}::case.motionBlocks.1.vimeoId"]`;

const PNG_BUFFER = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'), // PNG-сигнатура
  crypto.randomBytes(4096)
]);
const GLB_BUFFER = Buffer.concat([Buffer.from('676c5446', 'hex'), crypto.randomBytes(8192)]);

const ctx = startStaticServer();

async function openCaseEditor(page) {
  await page.goto(`${ctx.base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(THUMB_INPUT)).toBeAttached();
}

test('замена миниатюры и GLB: hash-пути, бинарные blob’ы, без удалений', async ({ page }) => {
  const calls = await mockGitHub(page);
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 25;
    window.ADMIN_POLL_TIMEOUT_MS = 3000;
  });
  await openCaseEditor(page);

  const cardSection = page.locator('.editor-section', { hasText: 'Карточка в списке работ' });
  await expect(cardSection.locator('.drop-zone__badge')).toBeHidden();

  // Загрузка новой миниатюры → pending-бейдж, blob-превью, предупреждение
  await page.setInputFiles(THUMB_INPUT, { name: 'new-thumb.png', mimeType: 'image/png', buffer: PNG_BUFFER });
  await expect(cardSection.locator('.drop-zone__badge')).toBeVisible();
  await expect(cardSection.locator('.drop-zone__preview')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#media-warning')).toBeVisible();
  await expect(page.locator('#media-warning')).toContainText('не переживут перезагрузку');
  await expect(page.locator('#draft-indicator')).toBeVisible();

  // Замена 3D-модели: старый dino.glb остаётся в репозитории (no-delete)
  await page.setInputFiles(MODEL_INPUT, { name: 'dino-new.glb', mimeType: 'model/gltf-binary', buffer: GLB_BUFFER });

  const thumbHash = hash8(PNG_BUFFER);
  const glbHash = hash8(GLB_BUFFER);
  const newThumbPath = `assets/cards/orbital-mk-ii-${thumbHash}.png`;
  const newGlbPath = `assets/models/experimental/dino-${glbHash}.glb`;

  // Диалог публикации перечисляет новые файлы и НЕ обещает удалений
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await expect(page.locator('#publish-files')).toContainText(newThumbPath);
  await expect(page.locator('#publish-files')).toContainText(newGlbPath);
  await expect(page.locator('#publish-files')).not.toContainText('удал');
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--success')).toContainText('Опубликовано');
  expect(calls.refUpdated).toBe(true);

  // Tree: JSON + два бинарных blob'а, БЕЗ единой tree-entry с sha: null —
  // заменённые файлы не удаляются (иначе прод 404-ил бы до bot-коммита)
  const treePaths = calls.tree.map((entry) => entry.path);
  expect(treePaths).toContain(CASE_PATH);
  expect(treePaths).toContain(newThumbPath);
  expect(treePaths).toContain(newGlbPath);
  expect(calls.tree.every((entry) => entry.sha !== null)).toBe(true);
  expect(treePaths).not.toContain('assets/models/experimental/dino.glb');
  expect(treePaths).not.toContain('assets/cards/orbital-mk-ii.svg');

  // Бинарные blob'ы — base64 загруженных байтов
  const blobBySha = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
  const thumbEntry = calls.tree.find((entry) => entry.path === newThumbPath);
  expect(blobBySha.get(thumbEntry.sha).content).toBe(PNG_BUFFER.toString('base64'));
  const glbEntry = calls.tree.find((entry) => entry.path === newGlbPath);
  expect(blobBySha.get(glbEntry.sha).content).toBe(GLB_BUFFER.toString('base64'));

  // JSON-черновик ссылается на новые cache-bust-пути
  const caseEntry = calls.tree.find((entry) => entry.path === CASE_PATH);
  const caseJson = JSON.parse(Buffer.from(blobBySha.get(caseEntry.sha).content, 'base64').toString('utf8'));
  expect(caseJson.card.thumb).toBe(`./${newThumbPath}`);
  expect(caseJson.case.modelSrc).toBe(`./${newGlbPath}`);

  // После публикации pending-медиа очищены
  await expect(page.locator('#media-warning')).toBeHidden();
  await expect(page.locator('#draft-indicator')).toBeHidden();
});

test('vimeo: URL парсится в ID, мусорный ввод блокирует публикацию', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);

  const vimeoInput = page.locator(VIMEO_FIELD);
  await expect(vimeoInput).toHaveValue('76979871');

  await vimeoInput.fill('https://vimeo.com/123456789?h=abcdef');
  const motionBlock = page.locator('.motion-block', { has: page.locator(VIMEO_FIELD) });
  await expect(motionBlock.locator('.vimeo-confirm')).toHaveText('Распознан ID: 123456789');

  await vimeoInput.fill('не-ссылка-и-не-id');
  await expect(motionBlock.locator('.vimeo-confirm')).toContainText('Не похоже на Vimeo ID');

  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeHidden();
  await expect(page.locator('.field-error-msg').first()).toContainText('Vimeo ID должен состоять только из цифр');
});

test('изображение тяжелее жёсткого лимита блокируется русским сообщением', async ({ page }) => {
  await mockGitHub(page);
  await openCaseEditor(page);

  const oversize = Buffer.alloc(2 * 1024 * 1024 + 1024, 7);
  await page.setInputFiles(THUMB_INPUT, { name: 'huge.png', mimeType: 'image/png', buffer: oversize });

  await expect(page.locator('.toast--error')).toContainText('Файл слишком большой');
  await expect(page.locator('.toast--error')).toContainText('тяжелее 2 МБ не публикуем');
  const cardSection = page.locator('.editor-section', { hasText: 'Карточка в списке работ' });
  await expect(cardSection.locator('.drop-zone__badge')).toBeHidden();
  await expect(page.locator('#media-warning')).toBeHidden();
  await expect(page.locator('#draft-indicator')).toBeHidden();
});
