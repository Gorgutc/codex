/* case-media-runtime.spec.mjs — рантайм видео-слота case.media (слайс B).
 *
 * Живой content/ пока не содержит ни одного блока type:'video' (владелец их
 * ещё не завёл), поэтому кейс собирается СИНТЕТИЧЕСКИ: ответ js/cards-data.js
 * отдаётся как есть плюс патч-скрипт, который подменяет items.media одного
 * видимого кейса на «картинка + видео». Так тест не зависит ни от чужого
 * контента, ни от текущего режима видимости каталога: id кейса выводится из
 * content/ (visibleCaseIds), а отсутствие видимых кейсов = test.skip.
 *
 * Проверяется контракт слайса B:
 *   preload="none" и НИ ОДНОГО байта до появления слота в кадре;
 *   src подставляется из data-case-media-src по видимости (IntersectionObserver);
 *   уход с вкладки 2D ставит ролик на паузу (teardown);
 *   постер — нативный атрибут <video>, а не <img>, поэтому он не становится
 *     слайдом лайтбокс-галереи [data-gallery];
 *   prefers-reduced-motion: автозапуска нет, байты не грузятся;
 *   кейс из одних широких блоков не теряет items.inline (ряд .case-row--text).
 *     Ветка одна на обычный и hybrid-режим: rowInlineTextFull режим не читает.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { visibleCaseIds } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VISIBLE_IDS = visibleCaseIds(ROOT);
const CASE_ID = VISIBLE_IDS[0] || '';
// Реальный self-hosted ролик репозитория (motion-блоки кейса orbital-mk-ii) —
// синтетический слот ссылается на существующий файл, чтобы ленивая загрузка
// проверялась на настоящем ответе сервера.
const VIDEO_SRC = './assets/cases/orbital-mk-ii/orbital-shell-idle.webm';
const POSTER_SRC = './assets/cases/orbital-mk-ii/02.png';

const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xml': 'application/xml'
};

let server;
let base;

test.beforeAll(async () => {
  await new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (requestPath === '/') requestPath = '/index.html';
      const filePath = path.join(ROOT, requestPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' }).end(data);
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

// Патч поверх настоящего cards-data.js: первый блок остаётся картинкой (в
// галерее должен остаться ровно один слайд), второй становится видео.
function patchScript(caseId) {
  return `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(caseId)}];if(!e)return;` +
    `var first=e.items.media[0];first.format='wide';` +
    `e.items.media=[first,{type:'video',format:'tall',src:${JSON.stringify(VIDEO_SRC)},` +
    `poster:${JSON.stringify(POSTER_SRC)},bg:'var(--color-surface)',` +
    `label:'Synthetic video slot',desc:'runtime spec',enabled:true}];})();\n`;
}

async function routeSyntheticCase(page, caseId) {
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + patchScript(caseId) })
  );
}

async function openSyntheticCase(page) {
  await routeSyntheticCase(page, CASE_ID);
  await page.goto(`${base}/index.html?lang=en`);
  await page.waitForSelector(`.work-card[data-id="${CASE_ID}"]`);
  await page.click(`.work-card[data-id="${CASE_ID}"]`);
  await page.waitForSelector('#case-scroll-track video.case-item__video');
}

function videoState(page) {
  return page.evaluate(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    if (!video) return null;
    const media = video.closest('.case-item__media');
    return {
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      preload: video.getAttribute('preload') || '',
      src: video.getAttribute('src') || '',
      lazySrc: video.getAttribute('data-case-media-src') || '',
      poster: video.getAttribute('poster') || '',
      hasAutoplayAttr: video.hasAttribute('autoplay'),
      width: video.getAttribute('width') || '',
      height: video.getAttribute('height') || '',
      isMotionBlock: !!video.closest('.case-motion'),
      imgsInMedia: media ? media.querySelectorAll('img').length : -1,
      galleryImgs: document.querySelectorAll('[data-gallery] img').length,
      paused: video.paused
    };
  });
}

test('видео-слот: preload=none, ленивый src по видимости, пауза при уходе с 2D', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticCase(page);

  const initial = await videoState(page);
  expect(initial).not.toBeNull();
  expect(initial.preload).toBe('none');
  expect(initial.src).toBe(''); // байты не грузятся до появления в кадре
  expect(initial.lazySrc).toBe(VIDEO_SRC);
  expect(initial.hasAutoplayAttr).toBe(false);
  // CLS: те же условные размеры, что и у <img>-ветки (tall 600×800).
  expect(initial.width).toBe('600');
  expect(initial.height).toBe('800');
  // Класс .case-motion НЕ используется: его анатомию пинит verify-frozen.
  expect(initial.isMotionBlock).toBe(false);
  // Постер — атрибут <video>, а не <img>: в галерее лайтбокса он не слайд.
  expect(initial.poster).toBe(POSTER_SRC);
  expect(initial.imgsInMedia).toBe(0);
  expect(initial.galleryImgs).toBe(1); // только настоящая иллюстрация кейса

  await page.evaluate(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    if (video) video.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    return !!video && !!video.getAttribute('src');
  });
  const loaded = await videoState(page);
  expect(loaded.src).toBe(VIDEO_SRC);

  // Уход на Blueprints = teardown 2D-медиа.
  await page.click('.case-tab[data-viz="blueprints"]');
  await page.waitForFunction(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    return !video || video.paused === true;
  });
  const stopped = await videoState(page);
  if (stopped) expect(stopped.paused).toBe(true);
});

test('кейс без высоких блоков: инлайн-текст идёт отдельным полноширинным рядом', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  const caseJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cases', `${CASE_ID}.json`), 'utf8'));
  test.skip(!caseJson.case.inline, `case ${CASE_ID} has no inline text block`);
  const inlineTitle = caseJson.case.inline.title.en;

  // Все блоки широкие → носителя для инлайн-текста нет. До слайса B
  // buildItems() молча терял items.inline в этой раскладке.
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  const allWide =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.items.media.forEach(function(m){m.format='wide';});})();\n`;
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + allWide })
  );
  await page.goto(`${base}/index.html?lang=en`);
  await page.waitForSelector(`.work-card[data-id="${CASE_ID}"]`);
  await page.click(`.work-card[data-id="${CASE_ID}"]`);
  await page.waitForSelector('#case-scroll-track .case-row');

  const layout = await page.evaluate(() => ({
    tallRows: document.querySelectorAll('#case-scroll-track .case-row--tall-1, #case-scroll-track .case-row--tall-2, #case-scroll-track .case-row--tall-text').length,
    inlineTitles: [...document.querySelectorAll('#case-scroll-track .case-row--text .case-text--inline .case-text__title')].map(
      (node) => node.textContent
    )
  }));
  expect(layout.tallRows).toBe(0);
  expect(layout.inlineTitles).toContain(inlineTitle);
});

test('LCP: eager получает первая РЕАЛЬНАЯ картинка, а не первый ряд', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  // Слайс B легализовал видео и полноширинный текст в первом ряду. Метка
  // eager/fetchpriority считалась по idx===0 и уходила в ряд без <img>,
  // оставляя настоящий LCP-кандидат на loading="lazy".
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  const videoFirst =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.layoutMode='manual';` + // авторский порядок: видео гарантированно первое
    `var img=e.items.media[0];img.format='wide';` +
    `e.items.media=[{type:'video',format:'wide',src:${JSON.stringify(VIDEO_SRC)},` +
    `poster:${JSON.stringify(POSTER_SRC)},bg:'var(--color-surface)',label:'v',desc:'d',enabled:true},img];})();\n`;
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + videoFirst })
  );
  await page.goto(`${base}/index.html?lang=en`);
  await page.waitForSelector(`.work-card[data-id="${CASE_ID}"]`);
  await page.click(`.work-card[data-id="${CASE_ID}"]`);
  await page.waitForSelector('#case-scroll-track img.case-item__img');

  const images = await page.evaluate(() =>
    [...document.querySelectorAll('#case-scroll-track img.case-item__img')].map((node) => ({
      loading: node.getAttribute('loading') || '',
      priority: node.getAttribute('fetchpriority') || ''
    }))
  );
  expect(images.length).toBeGreaterThan(0);
  expect(images[0].loading).toBe('eager');
  expect(images[0].priority).toBe('high');
  // Ровно одна картинка помечена eager — приоритет не размазан.
  expect(images.filter((img) => img.loading === 'eager')).toHaveLength(1);
});

test('пересборка кейса: играющий слот гасится ДО подмены разметки', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticCase(page);

  await page.evaluate(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    if (video) video.scrollIntoView({ block: 'center' });
  });
  await page.waitForFunction(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    return !!video && !!video.getAttribute('src');
  });

  // Смена языка пересобирает трек через innerHTML. Старый <video> отцепляется:
  // если его не остановить ДО подмены, он продолжает играть в отсоединённом
  // поддереве, где его уже никакой querySelector не найдёт.
  const detached = await page.evaluate(async () => {
    const before = document.querySelector('#case-scroll-track video.case-item__video');
    const toggle = document.getElementById('lang-toggle') || document.querySelector('[data-lang-toggle]');
    if (toggle) toggle.click();
    else if (window.I18N && typeof window.I18N.setLang === 'function') window.I18N.setLang('ru');
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { rebuilt: !document.contains(before), pausedOldNode: before ? before.paused : null };
  });
  // Либо трек не пересобирался (тогда проверять нечего), либо отцепленный
  // узел остановлен.
  if (detached.rebuilt) expect(detached.pausedOldNode).toBe(true);
});

test('prefers-reduced-motion: видео-слот не запускается и не грузит байты', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  // emulateMedia, а не test.use: опция контекста применяется к фикстуре page
  // раньше, чем этот файл её переопределит, и эмуляция молча не включалась.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const videoRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('orbital-shell-idle.webm')) videoRequests.push(request.url());
  });
  await openSyntheticCase(page);

  await page.evaluate(() => {
    const video = document.querySelector('#case-scroll-track video.case-item__video');
    if (video) video.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(600);

  const state = await videoState(page);
  expect(state.reduced).toBe(true); // эмуляция действительно включена
  expect(state.src).toBe(''); // src так и не подставлен
  expect(state.paused).toBe(true);
  expect(videoRequests).toHaveLength(0);
});
