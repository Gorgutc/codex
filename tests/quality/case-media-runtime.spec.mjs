/* case-media-runtime.spec.mjs — рантайм-контракты сборки кейса: видео-слоты
 * case.media (слайс B), необязательные подписи блоков и внешний CTA кейса.
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
 *
 * Необязательные подписи (запрос владельца «серия иллюстраций без текста»):
 *   блок с пустыми label и desc не рендерит .case-item__caption вовсе;
 *   блок с одним label (без desc) рендерит только заголовок.
 *
 * Склейка «биханс-приёмом» (seamless): цепочка блоков собирается в ОДИН
 *   .case-row--seamless — вертикальный зазор и радиусы на стыке равны нулю,
 *   и это переживает мобильную раскладку, где все ряды становятся колонками
 *   с общим gap.
 *
 * Внешний CTA (CASE-CTA-01): кнопка живёт ТОЛЬКО там, где владелец включил
 *   её в content (case.cta.enabled + валидный url); плейсхолдер-адресов на
 *   сайте нет ни у одного видимого кейса.
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

/* ── необязательные подписи блоков ────────────────────────────────────── */

test('блок без подписи не рендерит .case-item__caption, label без desc — рендерит заголовок', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  // Синтетика: живой контент подписан целиком, а контракт нужен именно для
  // «серии иллюстраций без сопровождающего текста».
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  const patch =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.layoutMode='manual';` +
    `var base=e.items.media[0];` +
    `e.items.media=[` +
    `{type:'image',format:'wide',src:base.src,bg:base.bg,label:'',desc:'',enabled:true},` +
    `{type:'image',format:'wide',src:base.src,bg:base.bg,label:'Only a label',desc:'',enabled:true}` +
    `];e.items.inline=null;})();\n`;
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + patch })
  );
  await page.goto(`${base}/index.html?lang=en`);
  await page.waitForSelector(`.work-card[data-id="${CASE_ID}"]`);
  await page.click(`.work-card[data-id="${CASE_ID}"]`);
  await page.waitForSelector('#case-scroll-track .case-item--wide');

  const items = await page.evaluate(() =>
    [...document.querySelectorAll('#case-scroll-track .case-row--wide .case-item')].map((item) => {
      const caption = item.querySelector(':scope > .case-item__caption');
      return {
        hasCaption: !!caption,
        label: caption ? (caption.querySelector('.case-item__caption-label') || {}).textContent || null : null,
        desc: caption ? (caption.querySelector('.case-item__caption-desc') || {}).textContent || null : null
      };
    })
  );
  expect(items).toHaveLength(2);
  // Пустой блок: узла подписи нет вовсе — ни пустых <p>, ни лишнего отступа.
  expect(items[0].hasCaption).toBe(false);
  // Заголовок без описания: рендерится то, что есть.
  expect(items[1].hasCaption).toBe(true);
  expect(items[1].label).toBe('Only a label');
  expect(items[1].desc).toBeNull();
});

/* ── склейка блоков «биханс-приёмом» (seamless) ───────────────────────── */

// Две полосы, вторая приклеена к первой. Подписи пустые: подпись между
// полосами разрезала бы полотно (это же запрещает валидатор контента —
// синергия с необязательными подписями, рабочий сценарий владельца).
function seamlessPatch(caseId, format) {
  const strip = (extra) =>
    `{type:'image',format:${JSON.stringify(format)},src:base.src,bg:base.bg,label:'',desc:'',enabled:true${extra}}`;
  return `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(caseId)}];if(!e)return;` +
    `e.layoutMode='manual';var base=e.items.media[0];` +
    `e.items.media=[${strip('')},${strip(",seamless:true")}];e.items.inline=null;})();\n`;
}

/* Склейка обязана держаться во ВСЕХ контекстах, где переопределяется зазор
   рядов: базовая раскладка, планшет с открытым сайдбаром (там своё правило
   `body:not(.cards-collapsed) .case-row`) и мобильные Design Lab-режимы
   (hybrid/specimen переопределяют `.case-row` с высокой специфичностью). */
const SEAMLESS_CONTEXTS = [
  {
    name: 'desktop Original',
    viewport: { width: 1440, height: 900 },
    design: null,
    // Контекст обязан быть настоящим: иначе тест «проходит» на несуществующей
    // раскладке и молча перестаёт что-либо охранять.
    precondition: () => document.documentElement.getAttribute('data-design') === 'original'
  },
  {
    name: 'tablet 820px, сайдбар открыт',
    viewport: { width: 820, height: 1180 },
    design: null,
    sidebarOpen: true,
    precondition: () =>
      !document.body.classList.contains('cards-collapsed') &&
      window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches
  },
  {
    name: 'mobile 390px hybrid',
    viewport: { width: 390, height: 844 },
    design: 'hybrid',
    precondition: () =>
      document.documentElement.getAttribute('data-design') === 'hybrid' &&
      document.documentElement.getAttribute('data-design-surface') === 'case' &&
      document.body.classList.contains('chamber-page-portfolio') &&
      window.matchMedia('(max-width: 767px)').matches
  },
  {
    name: 'mobile 390px specimen',
    viewport: { width: 390, height: 844 },
    design: 'specimen',
    precondition: () =>
      document.documentElement.getAttribute('data-design') === 'specimen' &&
      document.body.classList.contains('specimen-index-page') &&
      window.matchMedia('(max-width: 767px)').matches
  }
];

async function openSeamlessCase(page, options) {
  const config = options || {};
  const format = config.format || 'wide';
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: original + (config.patch || seamlessPatch(CASE_ID, format))
    })
  );
  if (config.viewport) await page.setViewportSize(config.viewport);
  // Геометрия меряется под reduced motion — иначе GSAP-раскрытие (.case-item
  // въезжает снизу) держит ещё не показанную полосу со своим translateY, и
  // «зазор» оказывается кадром анимации, а не свойством вёрстки.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const query = config.design ? `?lang=en&design=${config.design}` : '?lang=en';
  // Кейс открывается хешем: у Design Lab-режимов своя домашняя поверхность,
  // и .work-card там не тот вход, что в базовом режиме.
  await page.goto(`${base}/index.html${query}#${CASE_ID}`);
  if (config.design) {
    await page.waitForFunction(
      (mode) => document.documentElement.getAttribute('data-design') === mode,
      config.design
    );
  }
  await page.waitForSelector('#case-scroll-track .case-row--seamless');
  if (config.sidebarOpen) {
    // Планшетное правило живёт под `body:not(.cards-collapsed)`; открытый
    // сайдбар — состояние владельца, до которого CSS обязан доехать.
    await page.evaluate(() => document.body.classList.remove('cards-collapsed'));
  }
}

function seamlessGeometry(page) {
  return page.evaluate(() => {
    const row = document.querySelector('#case-scroll-track .case-row--seamless');
    const items = [...row.querySelectorAll(':scope > .case-item')];
    const media = items.map((item) => item.querySelector(':scope > .case-item__media'));
    const boxes = media.map((node) => node.getBoundingClientRect());
    const radii = media.map((node) => {
      const style = getComputedStyle(node);
      return {
        topLeft: style.borderTopLeftRadius,
        topRight: style.borderTopRightRadius,
        bottomLeft: style.borderBottomLeftRadius,
        bottomRight: style.borderBottomRightRadius
      };
    });
    return {
      rows: document.querySelectorAll('#case-scroll-track .case-row--seamless').length,
      items: items.length,
      gap: boxes[1].top - boxes[0].bottom,
      widthDelta: Math.abs(boxes[1].width - boxes[0].width),
      ratios: boxes.map((box) => box.width / box.height),
      formats: items.map((item) => (item.classList.contains('case-item--tall') ? 'tall' : 'wide')),
      radii
    };
  });
}

// Номинальные аспекты полос: полотно склеивается только если КАЖДАЯ полоса
// держит свой аспект. Кламп max-height срезал высоту, оставляя ширину, и
// object-fit:cover резал полосы независимо — регрессия молча вернула бы кроп.
const NOMINAL_RATIO = { wide: 16 / 9, tall: 4 / 5 };

function expectNominalRatios(geometry, label) {
  geometry.ratios.forEach((ratio, i) => {
    const nominal = NOMINAL_RATIO[geometry.formats[i]];
    expect(Math.abs(ratio - nominal), `${label}: полоса ${i + 1} (${geometry.formats[i]}) ratio=${ratio.toFixed(3)}`)
      .toBeLessThanOrEqual(0.01);
  });
}

test('seamless: две полосы склеены в одно полотно (зазор 0, радиусы стыка 0)', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  await openSeamlessCase(page, { viewport: SEAMLESS_CONTEXTS[0].viewport });

  const geometry = await seamlessGeometry(page);
  // Одна цепочка = ОДИН ряд: зазор между полосами не зависит от gap трека,
  // который переопределяют режимы Design Lab.
  expect(geometry.rows).toBe(1);
  expect(geometry.items).toBe(2);
  expect(Math.abs(geometry.gap)).toBeLessThanOrEqual(0.5);
  expect(geometry.widthDelta).toBeLessThanOrEqual(0.5);
  // Радиусы на стыке погашены с обеих сторон, внешние углы полотна целы.
  expect(geometry.radii[0].bottomLeft).toBe('0px');
  expect(geometry.radii[0].bottomRight).toBe('0px');
  expect(geometry.radii[1].topLeft).toBe('0px');
  expect(geometry.radii[1].topRight).toBe('0px');
  expect(geometry.radii[0].topLeft).not.toBe('0px');
  expect(geometry.radii[1].bottomLeft).not.toBe('0px');
});

for (const context of SEAMLESS_CONTEXTS) {
  test(`seamless: зазор 0 в контексте «${context.name}»`, async ({ page }) => {
    test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
    await openSeamlessCase(page, context);

    expect(
      await page.evaluate(context.precondition),
      `${context.name}: контекст раскладки не воспроизвёлся — проверка была бы холостой`
    ).toBe(true);
    const geometry = await seamlessGeometry(page);
    expect(Math.abs(geometry.gap), `${context.name}: вертикальный зазор полотна`).toBeLessThanOrEqual(0.5);
    expect(geometry.radii[0].bottomLeft).toBe('0px');
    expect(geometry.radii[1].topLeft).toBe('0px');
  });
}

/* Аспект полос на широких экранах — там кламп max-height бил сильнее всего
   (замер до правки для wide: 1440×900 ratio 1.778, 1920×1080 — 2.661,
   2560×1440 — 3.846 при номинальных 1.778). */
const SEAMLESS_ASPECT_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 }
];

for (const format of ['wide', 'tall']) {
  for (const viewport of SEAMLESS_ASPECT_VIEWPORTS) {
    test(`seamless: полосы ${format} держат аспект на ${viewport.width}×${viewport.height}`, async ({ page }) => {
      test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
      // Кламп max-height существует ради одиночной иллюстрации с подписью;
      // внутри полотна он срезает высоту, оставляя ширину, и object-fit:cover
      // режет каждую полосу отдельно — полотно рвётся по кадру.
      await openSeamlessCase(page, { viewport, format });

      const geometry = await seamlessGeometry(page);
      expect(Math.abs(geometry.gap)).toBeLessThanOrEqual(0.5);
      expect(geometry.widthDelta).toBeLessThanOrEqual(0.5);
      expectNominalRatios(geometry, `${format} @ ${viewport.width}×${viewport.height}`);
    });
  }
}

test('seamless: полотно проявляется одним движением — разрыва в анимации нет', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  /* GSAP-lift ставит каждый .case-item в opacity:0/y:44 со СВОИМ ScrollTrigger.
     Полосы полотна — самостоятельные .case-item, поэтому нижняя висела на
     y=44, когда верхняя уже приземлилась: на стыке физически открывался
     разрыв в 44px. Единицей анимации стал ряд — проверяем это НЕ по коду, а
     замером зазора В ПРОЦЕССЕ раскрытия. */
  const strip = (extra) =>
    `{type:'image',format:'wide',src:base.src,bg:base.bg,label:'',desc:'',enabled:true${extra}}`;
  // Полотно уходит вниз ленты: до него надо доскроллить, значит раскрытие
  // гарантированно случится ПРИ НАС, а не до первого замера.
  const patch =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.layoutMode='manual';var base=e.items.media[0];` +
    `e.items.media=[${strip('')},${strip('')},${strip('')},${strip('')},${strip(',seamless:true')}];` +
    `e.items.inline=null;})();\n`;
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + patch })
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/index.html?lang=en#${CASE_ID}`);
  await page.waitForSelector('#case-scroll-track .case-row--seamless');

  const sample = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const row = document.querySelector('#case-scroll-track .case-row--seamless');
        const strips = [...row.querySelectorAll(':scope > .case-item')];
        const media = strips.map((item) => item.querySelector(':scope > .case-item__media'));
        const scroller = document.getElementById('case-scroll');
        let worstGap = 0;
        let sawReveal = false;
        let samples = 0;
        const started = performance.now();
        // Прокрутка ПОСТЕПЕННАЯ: мгновенный прыжок вниз вводит обе полосы в
        // кадр одним кадром, и даже поэлементная анимация выглядит синхронной.
        // Разрыв рождается именно тогда, когда верхняя полоса пересекает линию
        // триггера раньше нижней — это и воспроизводим.
        function tick() {
          scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + 36);
          const a = media[0].getBoundingClientRect();
          const b = media[1].getBoundingClientRect();
          worstGap = Math.max(worstGap, Math.abs(b.top - a.bottom));
          // Раскрытие ловим и на ряде, и на полосах: единица анимации — ряд,
          // но при регрессии (твин на каждый .case-item) прозрачность едет
          // именно у полос, и замер обязан остаться не холостым в обоих
          // случаях — иначе тест падал бы «не по той причине».
          const opacities = [row, ...strips].map((node) => Number.parseFloat(getComputedStyle(node).opacity));
          if (opacities.some((value) => value < 0.99)) sawReveal = true;
          samples += 1;
          if (performance.now() - started < 2600) requestAnimationFrame(tick);
          else resolve({ worstGap, sawReveal, samples });
        }
        requestAnimationFrame(tick);
      })
  );
  // Замер обязан застать раскрытие, иначе он холостой.
  expect(sample.samples).toBeGreaterThan(10);
  expect(sample.sawReveal, 'раскрытие полотна не попало в замер — проверка была бы холостой').toBe(true);
  expect(sample.worstGap, 'зазор между полосами В ПРОЦЕССЕ анимации').toBeLessThanOrEqual(0.5);
});

test('seamless: цепочка В СЕРЕДИНЕ массива не ломает авторский порядок', async ({ page }) => {
  test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
  /* Авторский порядок [A wide, B tall, C склеен с B, D wide] обязан дать ряды
     A → полотно(B+C) → D. Раньше ряды собирались по группам (сначала все
     tall, потом все wide), цепочка уезжала в конец своей группы, и лента
     начиналась с чужого блока — в hybrid/specimen hero доставался не тот.
     Один проход по массиву схлопывает цепочку НА МЕСТЕ головы. */
  const block = (index, format, extra) =>
    `{type:'image',format:${JSON.stringify(format)},src:m[${index}].src,bg:m[${index}].bg,` +
    `label:'',desc:'',enabled:true${extra}}`;
  const patch =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.layoutMode='manual';var m=e.items.media;` +
    `e.items.media=[${block(0, 'wide', '')},${block(1, 'tall', '')},` +
    `${block(2, 'tall', ',seamless:true')},${block(3 % 5, 'wide', '')}];e.items.inline=null;})();\n`;
  await openSeamlessCase(page, { patch, viewport: { width: 1440, height: 900 } });

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('#case-scroll-track > .case-row')].map((row) => ({
      seamless: row.classList.contains('case-row--seamless'),
      srcs: [...row.querySelectorAll('img.case-item__img')].map((img) => img.getAttribute('src'))
    }))
  );
  const mediaRows = rows.filter((row) => row.srcs.length > 0);
  expect(mediaRows).toHaveLength(3);
  // A — до полотна, D — после: авторская последовательность рядов сохранена.
  expect(mediaRows[0].seamless).toBe(false);
  expect(mediaRows[0].srcs).toHaveLength(1);
  expect(mediaRows[1].seamless).toBe(true);
  expect(mediaRows[1].srcs).toHaveLength(2); // полотно B+C на авторском месте
  expect(mediaRows[2].seamless).toBe(false);
  expect(mediaRows[2].srcs).toHaveLength(1);
});

/* ── внешний CTA кейса (CASE-CTA-01) ──────────────────────────────────── */

function ctaState(page) {
  return page.evaluate(() => {
    const node = document.querySelector('#case-scroll-track .case-text__external-btn');
    if (!node) return null;
    return {
      href: node.getAttribute('href') || '',
      external: node.getAttribute('data-external') || '',
      aria: node.getAttribute('aria-label') || '',
      target: node.getAttribute('target') || '',
      rel: node.getAttribute('rel') || '',
      label: (node.querySelector('.case-text__external-btn-label') || {}).textContent || ''
    };
  });
}

test('CTA кейса: ни одного плейсхолдера, кнопка ⇔ cta.enabled в content', async ({ page }) => {
  test.skip(VISIBLE_IDS.length === 0, 'no visible cases in content/ — nothing to open');
  await page.goto(`${base}/index.html?lang=en`);
  for (const id of VISIBLE_IDS) {
    await page.click(`.work-card[data-id="${id}"]`);
    await page.waitForSelector(`.work-card[data-id="${id}"].work-card--active`);
    await page.waitForSelector('#case-scroll-track .case-row');
    const cta = await ctaState(page);

    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cases', `${id}.json`), 'utf8'));
    const authored = json.case.cta;
    const expected = !!(
      authored &&
      authored.enabled === true &&
      typeof authored.url === 'string' &&
      /^https:\/\//.test(authored.url)
    );

    // Плейсхолдер-адрес не имеет права доехать до посетителя ни при каких
    // настройках кейса.
    expect(cta ? cta.href : '', `case ${id}: CTA href`).not.toContain('REPLACE_WITH_REAL');
    expect(Boolean(cta), `case ${id}: CTA рендерится ⇔ case.cta.enabled в content`).toBe(expected);
    if (expected) expect(cta.href).toBe(authored.url);
  }
});

/* Таблица платформ дублируется в трёх зеркалах (канон-генератор, зеркало
   админки, рантайм). Ожидания теста выводятся из НЕЁ, а не из трёх литералов:
   четвёртая платформа добавляется одной записью и здесь. */
const CTA_PLATFORM_CASES = [
  { network: 'artstation', url: 'https://www.artstation.com/artwork/codex-demo', label: 'View on ArtStation' },
  { network: 'behance', url: 'https://www.behance.net/gallery/12345/codex-demo', label: 'View on Behance' },
  { network: 'dprofile', url: 'https://dprofile.ru/works/12345', label: 'View on DPROFILE' }
];

async function openCaseWithCta(page, url) {
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  const patch =
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(CASE_ID)}];if(!e)return;` +
    `e.items.cta={url:${JSON.stringify(url)}};})();\n`;
  await page.route('**/js/cards-data.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + patch })
  );
  await page.goto(`${base}/index.html?lang=en`);
  await page.click(`.work-card[data-id="${CASE_ID}"]`);
  await page.waitForSelector(`.work-card[data-id="${CASE_ID}"].work-card--active`);
}

for (const platform of CTA_PLATFORM_CASES) {
  test(`включённый CTA (${platform.network}): href, data-external и двуязычные лейблы`, async ({ page }) => {
    test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
    await openCaseWithCta(page, platform.url);
    await page.waitForSelector('#case-scroll-track .case-text__external-btn');

    const en = await ctaState(page);
    expect(en.href).toBe(platform.url);
    expect(en.external).toBe(platform.network);
    expect(en.target).toBe('_blank');
    expect(en.rel).toBe('noopener noreferrer');
    expect(en.label).toBe(platform.label);
    expect(en.aria).not.toMatch(/[А-Яа-я]/); // EN-режим — латиница

    await page.click('#lang-toggle');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await page.waitForSelector('#case-scroll-track .case-text__external-btn');
    const ru = await ctaState(page);
    expect(ru.href).toBe(platform.url);
    expect(ru.aria).toMatch(/[А-Яа-я]/); // RU-режим — кириллица в aria
  });
}

/* Рантайм — последний рубеж: адреса, которые валидатор не пропускает, всё
   равно не должны рисоваться кнопкой (ручная правка cards-data.js, старый
   опубликованный контент). Семантика парсера здесь та же, что в валидаторе:
   https, без userinfo, без порта, точное совпадение hostname. */
const CTA_RUNTIME_REJECTED = [
  { name: 'суффиксный домен', url: 'https://evil-dprofile.ru/works/1' },
  { name: 'домен-приставка', url: 'https://dprofile.ru.attacker.tld/works/1' },
  { name: 'userinfo перед доменом', url: 'https://user:token@dprofile.ru/works/1' },
  { name: 'нестандартный порт', url: 'https://dprofile.ru:8443/works/1' },
  { name: 'http вместо https', url: 'http://dprofile.ru/works/1' }
];

for (const rejected of CTA_RUNTIME_REJECTED) {
  test(`CTA не рендерится: ${rejected.name}`, async ({ page }) => {
    test.skip(!CASE_ID, 'no visible cases in content/ — nothing to open');
    await openCaseWithCta(page, rejected.url);
    await page.waitForSelector('#case-scroll-track .case-row');
    expect(await ctaState(page), `${rejected.name}: кнопка не имеет права появиться`).toBeNull();
  });
}

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
