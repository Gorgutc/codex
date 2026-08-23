/* case-blueprints-runtime.spec.mjs — рантайм-контракт вкладки «Чертежи».
 *
 * BP-DECISION-01: чертёж — это SVG, который владелец начертил и загрузил сам.
 * Сайт его только ПОКАЗЫВАЕТ и даёт СКАЧАТЬ; он ничего не чертит.
 * BP-DECISION-02: процедурная генерация удалена целиком, вкладка показывается
 * только там, где лист загружен (fail-closed).
 *
 * Безопасность: лист рендерится ТОЛЬКО как <img src>. Так SVG попадает в
 * secure-static mode — скрипты и обработчики внутри файла не исполняются.
 * Инлайн в DOM и <object> запрещены; прод дополнительно закрыт CSP
 * `object-src 'none'` (.htaccess).
 *
 * Ожидания выводятся из content/, а не из списка id: набор кейсов с листами
 * читается из content/cases/*.json. Сейчас листов нет ни у одного кейса,
 * поэтому «позитивные» проверки помечаются dormant-skip с явной причиной, а
 * fail-closed проверка остаётся живой и покрывает все видимые кейсы. Отдельно
 * контракт разметки листа проверяется на СИНТЕТИЧЕСКОМ кейсе — иначе он ждал бы
 * первой загрузки владельца.
 *
 * Регрессия, ради которой это написано: BLUEPRINT_META описывала corten-series
 * («Дегидратор Happfe») как СТУЛ — Seat / Back / Leg L / Leg R, 85×110 см — и
 * это уехало в прод. Хардкод-таблицы больше нет; вкладка обязана быть скрыта,
 * пока владелец не загрузит настоящий лист.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { visibleCaseIds } from '../../scripts/content-expectations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VISIBLE_IDS = visibleCaseIds(ROOT);

function caseJson(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cases', `${id}.json`), 'utf8'));
}

function sheetsOf(id) {
  const sheets = caseJson(id).case.blueprints;
  return Array.isArray(sheets) ? sheets : [];
}

// Набор кейсов с листами выводится из content/, а не перечисляется руками.
const IDS_WITH_SHEETS = VISIBLE_IDS.filter((id) => sheetsOf(id).length > 0);
const IDS_WITHOUT_SHEETS = VISIBLE_IDS.filter((id) => sheetsOf(id).length === 0);

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

async function openCase(page, id) {
  await page.goto(`${base}/index.html?lang=en`);
  await page.waitForSelector(`.work-card[data-id="${id}"]`);
  await page.click(`.work-card[data-id="${id}"]`);
  await page.waitForSelector(`.work-card[data-id="${id}"].work-card--active`);
}

/* ── fail-closed: вкладка ⇔ загруженные листы ─────────────────────────── */

test('вкладка Blueprints скрыта у каждого кейса БЕЗ загруженных листов', async ({ page }) => {
  test.skip(IDS_WITHOUT_SHEETS.length === 0, 'every visible case already has blueprint sheets');
  await page.goto(`${base}/index.html?lang=en`);
  for (const id of IDS_WITHOUT_SHEETS) {
    await page.click(`.work-card[data-id="${id}"]`);
    await page.waitForSelector(`.work-card[data-id="${id}"].work-card--active`);
    const state = await page.evaluate(() => {
      const tab = document.getElementById('case-tab-bp');
      return {
        hidden: tab ? tab.hidden : null,
        display: tab ? getComputedStyle(tab).display : null,
        pane: document.getElementById('case-blueprints')?.hidden ?? null,
        sheets: document.querySelectorAll('#case-blueprints-canvas .case-blueprints__sheet').length
      };
    });
    // Триггер остаётся в разметке (CASE-tabs-3 считает ровно 3 .case-tab),
    // но показан быть не имеет права.
    expect(state.hidden, `case ${id}: вкладка Blueprints обязана быть скрыта`).toBe(true);
    // Атрибута мало: author-origin `display` у .case-tab перебивает
    // `[hidden]` из UA-таблицы, и вкладка оставалась КЛИКАБЕЛЬНОЙ при
    // hidden=true. Проверяем именно вычисленный стиль.
    expect(state.display, `case ${id}: hidden-атрибут обязан реально скрывать вкладку`).toBe('none');
    expect(state.pane, `case ${id}: панель чертежей обязана быть скрыта`).toBe(true);
    expect(state.sheets, `case ${id}: листов быть не должно`).toBe(0);
  }
});

test('вкладка Blueprints показана у каждого кейса С загруженными листами', async ({ page }) => {
  test.skip(
    IDS_WITH_SHEETS.length === 0,
    'no case in content/ carries case.blueprints[] yet — owner has uploaded no sheets'
  );
  for (const id of IDS_WITH_SHEETS) {
    await openCase(page, id);
    await expect(page.locator('#case-tab-bp')).toBeVisible();
    await page.locator('#case-tab-bp').click();
    await expect(page.locator('#case-blueprints')).toBeVisible();

    const authored = sheetsOf(id);
    const rendered = await page.evaluate(() =>
      [...document.querySelectorAll('#case-blueprints-canvas .case-blueprints__sheet')].map((img) => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        loading: img.getAttribute('loading') || ''
      }))
    );
    // Порядок и адреса листов — ровно то, что владелец записал в content.
    expect(rendered.map((sheet) => sheet.src)).toEqual(authored.map((sheet) => sheet.src));
    for (const sheet of rendered) {
      expect(sheet.alt.length, `case ${id}: alt листа не может быть пустым`).toBeGreaterThan(0);
      expect(sheet.loading).toBe('lazy');
    }
  }
});

/* ── контракт разметки листа (синтетический кейс) ─────────────────────── */

const SYNTH_ID = VISIBLE_IDS[0] || '';
const SHEET_A = `./assets/cases/${SYNTH_ID}/01.svg`;
const SHEET_B = `./assets/cases/${SYNTH_ID}/02.svg`;

function blueprintPatch(sheets) {
  return (
    `\n;(function(){var e=window.CARDS_DATA&&window.CARDS_DATA[${JSON.stringify(SYNTH_ID)}];if(!e)return;` +
    `e.items.blueprints=${JSON.stringify(sheets)};})();\n`
  );
}

async function openSyntheticBlueprints(page, sheets) {
  const original = fs.readFileSync(path.join(ROOT, 'js', 'cards-data.js'), 'utf8');
  await page.route(/\/js\/cards-data\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: original + blueprintPatch(sheets) })
  );
  await openCase(page, SYNTH_ID);
  await page.locator('#case-tab-bp').click();
  await page.waitForSelector('#case-blueprints-canvas .case-blueprints__sheet');
}

test('лист рендерится как <img>: без инлайна SVG в DOM и без <object>', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticBlueprints(page, [{ src: SHEET_A }]);

  const pane = await page.evaluate(() => {
    const canvas = document.getElementById('case-blueprints-canvas');
    const img = canvas.querySelector('.case-blueprints__sheet');
    return {
      imgs: canvas.querySelectorAll('img.case-blueprints__sheet').length,
      // Инлайн-SVG листа = исполняемый скрипт в документе сайта. Иконки
      // тулбара/пейджера живут в своих контейнерах, поэтому смотрим именно
      // на область страницы чертежа.
      inlineSvgInPage: canvas.querySelectorAll('.case-blueprints__page-canvas svg').length,
      objects: canvas.querySelectorAll('object, embed, iframe').length,
      src: img.getAttribute('src'),
      objectFit: getComputedStyle(img).objectFit,
      pages: canvas.querySelectorAll('.case-blueprints__page').length,
      current: canvas.querySelectorAll('.case-blueprints__page.is-current').length,
      pageIndex: canvas.querySelector('.case-blueprints__page')?.getAttribute('data-bp-page'),
      hasPageCanvas: !!canvas.querySelector('.case-blueprints__page-canvas'),
      hasToolbar: !!canvas.querySelector('.case-blueprints__page-toolbar')
    };
  });

  expect(pane.imgs).toBe(1);
  expect(pane.inlineSvgInPage, 'лист не имеет права быть инлайн-SVG в DOM сайта').toBe(0);
  expect(pane.objects, '<object>/<embed>/<iframe> запрещены (CSP object-src none)').toBe(0);
  expect(pane.src).toBe(SHEET_A);
  // Чертёж должен быть виден ЦЕЛИКОМ: cover обрезал бы размеры и штамп.
  expect(pane.objectFit).toBe('contain');
  // DOM-контракт вкладки сохранён.
  expect(pane.pages).toBe(1);
  expect(pane.current).toBe(1);
  expect(pane.pageIndex).toBe('0');
  expect(pane.hasPageCanvas).toBe(true);
  expect(pane.hasToolbar).toBe(true);
});

test('скачивание отдаёт ОРИГИНАЛЬНЫЙ файл владельца, а не снимок DOM', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticBlueprints(page, [{ src: SHEET_A }]);

  const control = await page.evaluate(() => {
    const node = document.querySelector('#case-blueprints-canvas .case-blueprints__page-export');
    if (!node) return null;
    return {
      tag: node.tagName,
      href: node.getAttribute('href'),
      download: node.getAttribute('download'),
      aria: node.getAttribute('aria-label') || '',
      // Классы — часть контракта вёрстки и i18n-обвязки.
      hasBtnClass: node.classList.contains('bp-export-btn'),
      i18nLabel: !!node.querySelector('[data-i18n="btn.exportSvg"]')
    };
  });

  expect(control).not.toBeNull();
  expect(control.tag).toBe('A'); // ссылка на файл, а не кнопка-сериализатор
  expect(control.href).toBe(SHEET_A);
  expect(control.download).toMatch(/\.svg$/);
  expect(control.hasBtnClass).toBe(true);
  expect(control.i18nLabel).toBe(true);
  expect(control.aria.length).toBeGreaterThan(0);
});

test('подпись листа даёт alt; без подписи alt берётся из i18n и переводится', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticBlueprints(page, [{ src: SHEET_A, label: 'Section A-A' }, { src: SHEET_B }]);

  const alts = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#case-blueprints-canvas .case-blueprints__sheet')].map(
        (img) => img.getAttribute('alt') || ''
      )
    );

  const en = await alts();
  expect(en).toHaveLength(2);
  expect(en[0]).toBe('Section A-A'); // подпись владельца выигрывает
  expect(en[1].length).toBeGreaterThan(0); // без подписи — не пусто
  expect(en[1]).not.toBe(en[0]); // листы различимы для скринридера

  // Fallback идёт через i18n, значит в RU-режиме он обязан стать кириллицей.
  // Подпись владельца при этом не переводится сайтом.
  await page.click('#lang-toggle');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.waitForSelector('#case-blueprints-canvas .case-blueprints__sheet');
  const ru = await alts();
  expect(ru[1]).toMatch(/[А-Яа-я]/);
});

test('несколько листов: пейджер листает, активной остаётся одна страница', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticBlueprints(page, [{ src: SHEET_A }, { src: SHEET_B }]);

  const state = () =>
    page.evaluate(() => {
      const canvas = document.getElementById('case-blueprints-canvas');
      const current = canvas.querySelector('.case-blueprints__page.is-current');
      return {
        pages: canvas.querySelectorAll('.case-blueprints__page').length,
        currentCount: canvas.querySelectorAll('.case-blueprints__page.is-current').length,
        currentIndex: current ? current.getAttribute('data-bp-page') : null,
        counter: (canvas.querySelector('.case-blueprints__pager-counter') || {}).textContent || '',
        pagerHidden: canvas.querySelector('.case-blueprints__pager')?.hidden ?? null
      };
    });

  const initial = await state();
  expect(initial.pages).toBe(2);
  expect(initial.currentCount).toBe(1);
  expect(initial.currentIndex).toBe('0');
  expect(initial.counter).toBe('1 / 2');
  expect(initial.pagerHidden).toBe(false);

  await page.locator('.case-blueprints__pager-btn--next').click();
  const next = await state();
  expect(next.currentIndex).toBe('1');
  expect(next.currentCount).toBe(1);
  expect(next.counter).toBe('2 / 2');
});

test('одиночный лист: пейджер скрыт', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await openSyntheticBlueprints(page, [{ src: SHEET_A }]);
  expect(
    await page.evaluate(() => document.querySelector('.case-blueprints__pager')?.hidden ?? null)
  ).toBe(true);
});

test('reduced-motion: лист виден сразу, раскрытие не оставляет его прозрачным', async ({ page }) => {
  test.skip(!SYNTH_ID, 'no visible cases in content/ — nothing to open');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSyntheticBlueprints(page, [{ src: SHEET_A }]);

  const state = await page.evaluate(() => {
    const img = document.querySelector('#case-blueprints-canvas .case-blueprints__sheet');
    return {
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      opacity: Number.parseFloat(getComputedStyle(img).opacity)
    };
  });
  expect(state.reduced).toBe(true); // эмуляция действительно включена
  expect(state.opacity).toBeGreaterThan(0.99);
});
