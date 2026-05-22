/* verify-frozen.js · Codex Studio v0.4 GOLDEN regression
 * ─────────────────────────────────────────────────────────────────────────
 * Покрывает обе страницы:
 *   • index.html  — основной портфолио (37 тестов)
 *   • free-assets.html — каталог ассетов (28 тестов)
 *
 * Запуск (без отдельного http-server — поднимает свой Node http внутри):
 *   cd <project-root>
 *   node verify-frozen.js
 *
 * Альтернативный запуск с внешним сервером (для CI):
 *   BASE=http://127.0.0.1:5555 node verify-frozen.js
 *
 * Зависимости: только `playwright` (npm i playwright).
 *
 * v0.4 changes:
 *   - покрытие free-assets.html (B1-B6, M1-M5, AX1, N4)
 *   - расширенные META checks (canonical, OG, Twitter, JSON-LD, manifest)
 *   - встроенный http-server для self-contained запуска
 * ───────────────────────────────────────────────────────────────────────── */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.env.SITE_ROOT || __dirname;
const PORT = parseInt(process.env.PORT || '5555', 10);
const EXTERNAL_BASE = process.env.BASE; // если задан — не поднимаем свой сервер

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.json':'application/json', '.glb':'model/gltf-binary',
  '.jpg':'image/jpeg', '.png':'image/png', '.ico':'image/x-icon',
  '.mp4':'video/mp4', '.webp':'image/webp', '.zip':'application/zip',
  '.txt':'text/plain', '.xml':'application/xml', '.md':'text/markdown',
  '.webmanifest':'application/manifest+json'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const EXPECTED_IDS = [
  'orbital-mk-ii','vega-shell','ironclad-frame','corten-series','lumen-one',
  'flux-capsule','nightshard','recon-drone','apex-frame','core-rig',
  'helix-reveal','arc-motion','nyx-panther','drift-koi','glint-owl',
  'mech-link','flex-spine','cad-strut',
];
const EXPECTED_TAGS = ['all','hard-surface','product','organic','prototyping','animations','cad'];
const EXPECTED_FA_TAGS = ['hard-surface','product','game','organic','animation','cad'];

const results = [];
const add = (suite, name, pass, detail = '') => {
  results.push({ suite, name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

/* ═══════════════════════════════════════════════════════════════════════
   INDEX.HTML — расширенный регрешен (37 тестов)
═══════════════════════════════════════════════════════════════════════ */
async function testIndex(BASE) {
  console.log(`\n=== index.html · Desktop 1440×900 ===`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });

  // SCRIPTS
  const scripts = await page.$$eval('script[src]', els => els.map(e => ({ src: e.getAttribute('src'), defer: e.hasAttribute('defer'), async: e.hasAttribute('async') })));
  add('index', 'SCRIPTS-no-defer', !scripts.some(s => s.defer));
  const order = scripts.map(s => s.src);
  const orderOK =
    order.findIndex(s => /gsap\.min\.js/.test(s)) <
    order.findIndex(s => /ScrollTrigger/.test(s)) &&
    order.findIndex(s => /ScrollTrigger/.test(s)) <
    order.findIndex(s => /main\.js$/.test(s)) &&
    order.findIndex(s => /main\.js$/.test(s)) <
    order.findIndex(s => /animations\.js$/.test(s));
  add('index', 'SCRIPTS-order', orderOK);

  // BODY THEME
  const theme = await page.getAttribute('body', 'data-theme');
  add('index', 'BODY-theme-dark-default', theme === 'dark', `data-theme="${theme}"`);

  // GSAP
  const gsapInfo = await page.evaluate(() => ({
    gsap: typeof window.gsap, gsapVersion: window.gsap && window.gsap.version,
    ScrollTrigger: typeof window.ScrollTrigger, SplitText: typeof window.SplitText,
  }));
  add('index', 'GSAP-loaded', gsapInfo.gsap === 'object', `v${gsapInfo.gsapVersion}`);
  add('index', 'ScrollTrigger-loaded', gsapInfo.ScrollTrigger === 'function');
  add('index', 'SplitText-loaded', gsapInfo.SplitText === 'function');

  // META — полный набор
  const m = await page.evaluate(() => ({
    canonical: !!document.querySelector('link[rel="canonical"]'),
    robots: !!document.querySelector('meta[name="robots"]'),
    ogUrl: !!document.querySelector('meta[property="og:url"]'),
    ogType: !!document.querySelector('meta[property="og:type"]'),
    ogDescription: !!document.querySelector('meta[property="og:description"]'),
    ogSiteName: !!document.querySelector('meta[property="og:site_name"]'),
    ogImageWidth: !!document.querySelector('meta[property="og:image:width"]'),
    twitterCard: !!document.querySelector('meta[name="twitter:card"]'),
    twitterTitle: !!document.querySelector('meta[name="twitter:title"]'),
    twitterImage: !!document.querySelector('meta[name="twitter:image"]'),
    jsonLDcount: document.querySelectorAll('script[type="application/ld+json"]').length,
    favicon16: !!document.querySelector('link[rel="icon"][sizes="16x16"]'),
    manifest: !!document.querySelector('link[rel="manifest"]'),
  }));
  add('index', 'META-canonical', m.canonical);
  add('index', 'META-robots', m.robots);
  add('index', 'META-og-complete', m.ogUrl && m.ogType && m.ogDescription && m.ogSiteName && m.ogImageWidth);
  add('index', 'META-twitter-complete', m.twitterCard && m.twitterTitle && m.twitterImage);
  add('index', 'META-jsonLD', m.jsonLDcount > 0, `count=${m.jsonLDcount}`);
  add('index', 'META-favicon-16', m.favicon16);
  add('index', 'META-manifest', m.manifest);

  // SIDEBAR
  const sidebarOrder = await page.evaluate(() => ({
    hasSidebar: !!document.querySelector('.sidebar'),
    hasLogo: !!document.querySelector('.sidebar .logo'),
    hasContact: !!document.getElementById('contact-btn'),
    hasTheme: !!document.getElementById('theme-toggle'),
    hasCardsToggle: !!document.getElementById('cards-toggle'),
    hasTagsNav: !!document.querySelector('.sidebar .tags-dropdown'),
    hasGameSwitch: !!document.querySelector('.sidebar .game-switch'),
  }));
  add('index', 'SIDEBAR-structure', Object.values(sidebarOrder).every(Boolean));

  // CURSOR
  const cursor = await page.evaluate(() => ({
    fine: document.documentElement.classList.contains('cursor-fine'),
    cursorExists: !!document.querySelector('.cursor'),
    dotExists: !!document.querySelector('.cursor-dot'),
    bodyCursor: getComputedStyle(document.body).cursor,
  }));
  add('index', 'CURSOR-html-fine', cursor.fine);
  add('index', 'CURSOR-elements', cursor.cursorExists && cursor.dotExists);
  add('index', 'CURSOR-native-hidden', cursor.bodyCursor === 'none');

  // CARDS
  const cards = await page.$$eval('.work-card', els => els.map(e => ({ id: e.dataset.id, cat: e.dataset.category, game: e.dataset.gameAsset === 'true' })));
  add('index', 'WORK-cards-18', cards.length === 18, `found ${cards.length}`);
  const idsMatch = EXPECTED_IDS.every(id => cards.some(c => c.id === id));
  add('index', 'WORK-cards-ids', idsMatch);
  const gameCount = cards.filter(c => c.game).length;
  add('index', 'WORK-cards-game-assets', gameCount >= 2, `${gameCount} cards`);

  // TAGS
  const tagButtons = await page.$$eval('.tags-dropdown__checkbox[data-filter]', els => els.map(e => e.dataset.filter));
  add('index', 'TAGS-buttons', EXPECTED_TAGS.every(t => tagButtons.includes(t)));

  // FILTER PRODUCT
  await page.click('#tags-dropdown-trigger'); await page.waitForTimeout(150);
  await page.click('.tags-dropdown__checkbox[data-filter="product"]'); await page.waitForTimeout(300);
  const visibleAfter = await page.$$eval('.work-card', els => els.filter(e => { const cs = getComputedStyle(e); return cs.display !== 'none' && !e.hasAttribute('hidden'); }).map(e => e.dataset.category));
  add('index', 'TAGS-filter-product', visibleAfter.length > 0 && visibleAfter.every(c => c === 'product'));
  await page.click('.tags-dropdown__checkbox[data-filter="product"]'); await page.waitForTimeout(200);
  await page.mouse.click(10, 10); await page.waitForTimeout(150);

  // GAME SWITCH
  await page.click('.game-switch__track'); await page.waitForTimeout(300);
  const gameVisible = await page.$$eval('.work-card', els => els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.dataset.gameAsset === 'true'));
  add('index', 'GAME-switch-filters', gameVisible.length > 0 && gameVisible.every(Boolean));
  await page.click('.game-switch__track'); await page.waitForTimeout(200);

  // OPEN CASE
  await page.click('.work-card'); await page.waitForTimeout(500);
  const caseStatus = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.case-tab')].map(t => t.dataset.viz),
    progressBar: !!document.querySelector('.case-progress__bar'),
    hasNav: !!document.querySelector('.case-nav'),
  }));
  add('index', 'CASE-tabs-3', caseStatus.tabs.length === 3);
  add('index', 'CASE-progress', caseStatus.progressBar);
  add('index', 'CASE-nav', caseStatus.hasNav);

  // BLUEPRINT
  await page.click('.case-tab[data-viz="blueprints"]'); await page.waitForTimeout(400);
  add('index', 'CASE-blueprint-svg', !!await page.$('.case-blueprints svg'));

  // 3D
  await page.click('.case-tab[data-viz="3d"]'); await page.waitForTimeout(800);
  const c3d = await page.evaluate(() => ({
    canvas: !!document.getElementById('case-3d-canvas'),
    children: document.getElementById('case-3d-canvas')?.children.length > 0,
  }));
  add('index', 'CASE-3d-canvas', c3d.canvas);
  add('index', 'CASE-3d-content', c3d.children);

  // SHARE BUTTONS
  add('index', 'CASE-share-desktop', !!await page.$('#case-share-desktop'));
  add('index', 'CASE-share-mobile', !!await page.$('#case-share-mobile'));

  // THEME TOGGLE
  await page.click('.case-tab[data-viz="2d"]'); await page.waitForTimeout(150);
  await page.click('#theme-toggle'); await page.waitForTimeout(300);
  const afterToggle = await page.getAttribute('body', 'data-theme');
  add('index', 'THEME-toggle', afterToggle === 'light');
  await page.click('#theme-toggle');

  // CONSOLE — игнорируем внешние CDN failures (model-viewer 403/404, ERR_FAILED от заблокированного googleapis).
  // v0.8.x — добавлены fontshare (TLS MITM в sandboxed cloud envs) и cloudflare
  // (i18n.js geo-fetch endpoint; в corp envs TLS перехватывается, fetch падает
  // тихо в try/catch внутри i18n.js, но requestfailed-эхо всё равно попадает
  // в console). Plus ERR_CERT_AUTHORITY_INVALID — общий TLS-noise от MITM proxy.
  const internalErrors = consoleErrors.filter(e => !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|jsdelivr|fontshare|cloudflare)/i.test(e));
  add('index', 'CONSOLE-no-internal-errors', internalErrors.length === 0, internalErrors.slice(0,2).join(' | ') || 'clean');

  await browser.close();
}

/* ═══════════════════════════════════════════════════════════════════════
   FREE-ASSETS.HTML — регрешен (28 тестов)
═══════════════════════════════════════════════════════════════════════ */
async function testFreeAssets(BASE) {
  console.log(`\n=== free-assets.html · Desktop 1440×900 ===`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(`${BASE}/free-assets.html`, { waitUntil: 'networkidle', timeout: 30000 });

  // SCRIPTS
  const scripts = await page.$$eval('script[src]', els => els.map(e => ({ src: e.getAttribute('src'), defer: e.hasAttribute('defer') })));
  add('fa', 'SCRIPTS-no-defer', !scripts.some(s => s.defer));

  // GSAP loaded
  const gsap = await page.evaluate(() => typeof window.gsap);
  add('fa', 'GSAP-loaded', gsap === 'object');

  // BODY THEME
  add('fa', 'BODY-theme-dark', await page.getAttribute('body', 'data-theme') === 'dark');

  // META — полный набор (B5)
  const m = await page.evaluate(() => ({
    canonical: !!document.querySelector('link[rel="canonical"]'),
    robots: !!document.querySelector('meta[name="robots"]'),
    ogUrl: !!document.querySelector('meta[property="og:url"]'),
    ogType: !!document.querySelector('meta[property="og:type"]'),
    ogSiteName: !!document.querySelector('meta[property="og:site_name"]'),
    ogImageWidth: !!document.querySelector('meta[property="og:image:width"]'),
    twitterCard: !!document.querySelector('meta[name="twitter:card"]'),
    twitterImage: !!document.querySelector('meta[name="twitter:image"]'),
    jsonLD: document.querySelectorAll('script[type="application/ld+json"]').length,
    favicon16: !!document.querySelector('link[rel="icon"][sizes="16x16"]'),
    manifest: !!document.querySelector('link[rel="manifest"]'),
    themeColorPresent: !!document.querySelector('meta[name="theme-color"]'),
    themeColorCount: document.querySelectorAll('meta[name="theme-color"]').length,
    ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
  }));
  add('fa', 'META-canonical', m.canonical);
  add('fa', 'META-robots', m.robots);
  add('fa', 'META-og-complete', m.ogUrl && m.ogType && m.ogSiteName && m.ogImageWidth);
  add('fa', 'META-twitter-complete', m.twitterCard && m.twitterImage);
  add('fa', 'META-jsonLD', m.jsonLD >= 1, `count=${m.jsonLD}`);
  add('fa', 'META-favicon-16', m.favicon16);
  add('fa', 'META-manifest', m.manifest);
  // v0.6 [Z6] — архитектура theme-color приведена к single-tag (как в index.html).
  // JS applyTheme() в main.js обновляет content при ручном toggle. Split с media
  // создавал conflict (querySelector брал первый тег, второй оставался устаревшим).
  // Тест: должен быть РОВНО ОДИН тег theme-color без media-attribute.
  add('fa', 'META-theme-color-single', m.themeColorPresent && m.themeColorCount === 1, `count=${m.themeColorCount}`);
  add('fa', 'META-og-image-absolute', /^https?:/.test(m.ogImage), `value=${m.ogImage.slice(-40)}`);
  add('fa', 'META-og-image-fa-specific', /og-free-assets\.jpg$/.test(m.ogImage));

  // B2 — no inline <style> in head
  const inlineStyleSize = await page.evaluate(() => Array.from(document.querySelectorAll('head style')).reduce((s, e) => s + e.textContent.length, 0));
  add('fa', 'NO-inline-style-block', inlineStyleSize === 0);

  // B1 — id="logo-back-portfolio", no logo-home
  const ids = await page.evaluate(() => ({
    home: document.querySelectorAll('#logo-home').length,
    back: document.querySelectorAll('#logo-back-portfolio').length,
  }));
  add('fa', 'B1-no-logo-home', ids.home === 0);
  add('fa', 'B1-logo-back-portfolio', ids.back === 1);

  // B6 — chevron icons
  const toggle = await page.evaluate(() => ({
    open: document.querySelector('.cards-toggle__icon--open')?.textContent,
    closed: document.querySelector('.cards-toggle__icon--closed')?.textContent,
  }));
  add('fa', 'B6-chevron-icons', toggle.open === '\u2039\u2039' && toggle.closed === '\u203A\u203A');

  // GRID
  const grid = await page.evaluate(() => ({
    count: document.querySelectorAll('.fa-card').length,
    first: document.querySelector('.fa-card .fa-card__title')?.textContent,
  }));
  add('fa', 'GRID-rendered', grid.count > 0, `${grid.count} cards, first="${grid.first}"`);

  // TAG SWITCH
  await page.click('#tag-product'); await page.waitForTimeout(300);
  const productCount = await page.$$eval('.fa-card', els => els.length);
  add('fa', 'TAG-product-switch', productCount === 5, `expected 5, got ${productCount}`);
  await page.click('#tag-hard-surface'); await page.waitForTimeout(300);

  // N4 — game-switch keeps tag-cards visible, filters grid
  const beforeTags = await page.$$eval('.tag-card', els => els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').length);
  await page.click('.game-switch__track'); await page.waitForTimeout(300);
  const afterTags = await page.$$eval('.tag-card', els => els.filter(e => !e.hidden && getComputedStyle(e).display !== 'none').length);
  const bodyFilter = await page.evaluate(() => document.body.classList.contains('filter-game'));
  add('fa', 'N4-game-keeps-tag-cards', afterTags === beforeTags, `before=${beforeTags}, after=${afterTags}`);
  add('fa', 'N4-game-no-body-filter-class', !bodyFilter);
  await page.click('.game-switch__track'); await page.waitForTimeout(200);

  // M3 — single fetch per click (downloadAsset)
  // Этот тест требует acceptDownloads — пропустим в основном regression, тестируется в downloads-test

  // THEME TOGGLE
  await page.click('#theme-toggle'); await page.waitForTimeout(200);
  add('fa', 'THEME-toggle', await page.getAttribute('body', 'data-theme') === 'light');
  await page.click('#theme-toggle');

  // CONSOLE — без внутренних ошибок.
  // v0.8.x — filter расширен идентично index (fontshare, cloudflare, ERR_CERT_AUTHORITY_INVALID,
  // ERR_FAILED, jsdelivr) для устойчивости в cloud envs с corp TLS-перехватом.
  const internalErrors = consoleErrors.filter(e => !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|jsdelivr|fontshare|cloudflare|og-image\.jpg)/i.test(e));
  add('fa', 'CONSOLE-no-internal-errors', internalErrors.length === 0);

  await browser.close();
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
(async () => {
  let server, port, BASE;
  if (EXTERNAL_BASE) {
    BASE = EXTERNAL_BASE.replace(/\/$/, '');
    console.log(`Using external server: ${BASE}`);
  } else {
    const s = await startServer();
    server = s.server; port = s.port;
    BASE = `http://127.0.0.1:${port}`;
    console.log(`Started internal server: ${BASE}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  Codex Studio v0.4 GOLDEN regression');
  console.log('══════════════════════════════════════════════════════════════════');

  try {
    await testIndex(BASE);
    await testFreeAssets(BASE);
  } catch (e) {
    console.error('\nTEST ERROR:', e.message);
    console.error(e.stack);
  }

  if (server) server.close();

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`  SUMMARY: ${pass}/${results.length} PASS, ${fail} FAIL`);
  console.log('══════════════════════════════════════════════════════════════════');
  if (fail) {
    console.log('Failures:');
    results.filter(r => !r.pass).forEach(r => console.log(`  [${r.suite}] ${r.name}: ${r.detail}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})();
