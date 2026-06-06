/* verify-frozen.js · Codex Studio GOLDEN regression
 * ─────────────────────────────────────────────────────────────────────────
 * Покрывает обе страницы:
 *   • index.html — основной портфолио
 *   • free-assets.html — каталог ассетов
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
 * Notes:
 *   - success is a clean exit with `0 FAIL`
 *   - do not treat any historical pass total as a contract
 *   - the embedded http server keeps the command self-contained
 * ───────────────────────────────────────────────────────────────────────── */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const ROOT = process.env.SITE_ROOT || __dirname;
const EXTERNAL_BASE = process.env.BASE; // если задан — не поднимаем свой сервер

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.json':'application/json', '.glb':'model/gltf-binary',
  '.jpg':'image/jpeg', '.png':'image/png', '.ico':'image/x-icon',
  '.mp4':'video/mp4', '.webm':'video/webm', '.webp':'image/webp', '.zip':'application/zip',
  '.txt':'text/plain', '.xml':'application/xml', '.md':'text/markdown',
  '.webmanifest':'application/manifest+json', '.wasm':'application/wasm',
  '.hdr':'image/vnd.radiance', '.exr':'image/x-exr', '.ktx2':'image/ktx2'
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

const results = [];
const add = (suite, name, pass, detail = '') => {
  results.push({ suite, name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

/* ═══════════════════════════════════════════════════════════════════════
   STATIC — file-level checks без браузера (Stage 1, A7+A8)
   ─────────────────────────────────────────────────────────────────────
   Грепаем shipped HTML + JS на запрещённые pattern'ы. Это runs ДО
   подъёма серверa: если static check FAIL — runtime тесты бессмысленны.
═══════════════════════════════════════════════════════════════════════ */
function runStaticChecks() {
  console.log('\n=== Static file-level checks ===');

  // A7 — Vendor paths only: GSAP / Lenis / ScrollTrigger / SplitText не
  // должны грузиться с jsdelivr / unpkg / cdnjs (v0.8.x cloud-env-fix).
  // Проверяем content обеих HTML на наличие запрещённых URLs.
  const blockedCDN = /(cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com)[^\s"]*\/(gsap|lenis|ScrollTrigger|SplitText)/i;
  const indexHTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const faHTML = fs.readFileSync(path.join(ROOT, 'free-assets.html'), 'utf8');
  const staticScriptTags = (indexHTML + '\n' + faHTML).match(/<script\b[^>]*>/gi) || [];
  add('static', 'A7-vendor-only-index', !blockedCDN.test(indexHTML), 'no jsdelivr/unpkg/cdnjs GSAP/Lenis URLs');
  add('static', 'A7-vendor-only-fa',    !blockedCDN.test(faHTML),    'no jsdelivr/unpkg/cdnjs GSAP/Lenis URLs');
  add('static', 'A7-no-static-model-viewer-fa', !/<script[^>]+model-viewer/i.test(faHTML),
      'free-assets loads mini 3D viewer lazily from JS');
  add('static', 'A7-no-static-three-scripts',
      !staticScriptTags.some(tag => /src=["'][^"']*(three|GLTFLoader|OrbitControls)[^"']*["']/i.test(tag)),
      'Three viewer artifacts must load through the adapter');
  add('static', 'A7-no-importmaps',
      !staticScriptTags.some(tag => /type=["']importmap["']/i.test(tag)),
      'no import-map architecture in shipped HTML');
  add('static', 'A7-no-first-party-module-scripts',
      !staticScriptTags.some(tag => /type=["']module["']/i.test(tag) && /src=["']\.?\/?js\//i.test(tag)),
      'first-party page scripts stay classic');
  // Sanity: vendor files actually present on disk.
  const vendorFiles = ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js', 'lenis.min.js'];
  const vendorOK = vendorFiles.every(f => fs.existsSync(path.join(ROOT, 'js', 'vendor', f)));
  add('static', 'A7-vendor-files-present', vendorOK, vendorFiles.join(', '));
  const threeVendorFiles = [
    'codex-three-viewer.js',
    path.join('three', 'three.module.js'),
    path.join('three', 'three.core.js'),
    path.join('three', 'GLTFLoader.js'),
    path.join('three', 'OrbitControls.js'),
    path.join('three', 'DRACOLoader.js'),
    path.join('three', 'KTX2Loader.js'),
    path.join('three', 'HDRLoader.js'),
    path.join('three', 'EXRLoader.js'),
    path.join('three', 'libs', 'draco', 'gltf', 'draco_decoder.wasm'),
    path.join('three', 'libs', 'basis', 'basis_transcoder.wasm'),
    path.join('three', 'libs', 'meshopt_decoder.module.js')
  ];
  const threeVendorOK = threeVendorFiles.every(f => fs.existsSync(path.join(ROOT, 'js', 'vendor', f)));
  add('static', 'A7-three-vendor-files-present', threeVendorOK, threeVendorFiles.join(', '));

  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const robotsPath = path.join(ROOT, 'robots.txt');
  const sitemap = fs.existsSync(sitemapPath) ? fs.readFileSync(sitemapPath, 'utf8') : '';
  const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : '';
  add('static', 'F1-sitemap-free-assets-image',
      /<loc>https:\/\/codex\.promo\/free-assets\.html<\/loc>[\s\S]*<image:loc>https:\/\/codex\.promo\/assets\/img\/og-free-assets\.jpg<\/image:loc>/i.test(sitemap),
      'free-assets sitemap entry includes OG image');
  add('static', 'F1-robots-sitemap-pointer',
      /Sitemap:\s*https:\/\/codex\.promo\/sitemap\.xml/i.test(robots),
      'robots.txt points to canonical sitemap');
  const faJsonLdStatic = [...faHTML.matchAll(/<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi)]
    .map(match => {
      try { return JSON.parse(match[1]); }
      catch (_) { return null; }
    })
    .filter(Boolean);
  const faJsonLdNodes = faJsonLdStatic.flatMap(item => Array.isArray(item['@graph']) ? item['@graph'] : [item]);
  const faContentUrls = faJsonLdNodes
    .flatMap(node => {
      const list = Array.isArray(node.itemListElement) ? node.itemListElement.map(entry => entry && entry.item) : [];
      return [node].concat(list);
    })
    .map(node => node && node.contentUrl)
    .filter(url => /https:\/\/codex\.promo\/downloads\/[^"']+\.zip$/i.test(String(url || '')));
  const missingFaDownloads = faContentUrls
    .map(url => String(url).replace(/^https:\/\/codex\.promo\/downloads\//i, ''))
    .filter(file => !fs.existsSync(path.join(ROOT, 'downloads', file)));
  add('static', 'F1-jsonld-contenturl-files',
      faContentUrls.length >= 2 && missingFaDownloads.length === 0,
      missingFaDownloads.length ? 'missing=' + missingFaDownloads.join(', ') : `linked=${faContentUrls.length}`);

  // A8 — localStorage / sessionStorage НЕ должны использоваться runtime в
  // shipped JS. Frozen rule top-10. Regex ловит method/property access
  // (foo.localStorage. / foo.sessionStorage[ ) — комментарии "no localStorage"
  // не попадают, т.к. там нет точки/bracket access после слова.
  const forbidden = /(localStorage|sessionStorage)\s*[.[]/;
  const jsFiles = [
    'main.js',
    'animations.js',
    'free-assets.js',
    'i18n.js',
    'i18n-data.js',
    'fa-data.js',
    'shared-runtime.js',
    'vendor/codex-three-viewer.js'
  ];
  const jsViolations = jsFiles.filter(f => {
    const full = path.join(ROOT, 'js', f);
    if (!fs.existsSync(full)) return false;
    return forbidden.test(fs.readFileSync(full, 'utf8'));
  });
  add('static', 'A8-no-localStorage-runtime', jsViolations.length === 0,
      jsViolations.length ? 'violations in: ' + jsViolations.join(', ') : 'all clean');

  const shippedCopyFiles = ['index.html', 'free-assets.html', 'main.js', 'i18n-data.js', 'fa-data.js', 'free-assets.js', 'shared-runtime.js'];
  const shippedCopyViolations = [];
  const shippedCopyRules = [
    {
      name: 'debug copy',
      pattern: /Testing hamster|Проверка загрузки иллюстрации/i,
    },
    {
      name: 'visible placeholder copy',
      pattern: /CAD placeholder|placeholder kit|technology placeholder|assembly placeholder|kinematic placeholder|work in progress|live render|live-рендер|Dev cycle|Dev-цикле|final GLB \+ renders in progress|final model (?:&|&amp;) textures pending/i,
    },
  ];
  shippedCopyFiles.forEach(file => {
    const full = file.endsWith('.js') ? path.join(ROOT, 'js', file) : path.join(ROOT, file);
    if (!fs.existsSync(full)) return;
    const rel = path.relative(ROOT, full);
    fs.readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, index) => {
      shippedCopyRules.forEach(rule => {
        if (rule.pattern.test(line)) {
          shippedCopyViolations.push(`${rel}:${index + 1} (${rule.name})`);
        }
      });
    });
  });
  add('static', 'A9-no-debug-or-visible-placeholder-copy', shippedCopyViolations.length === 0,
      shippedCopyViolations.length ? shippedCopyViolations.join(', ') : 'shipped copy is production-facing');

  // C1 — `font-size: Npx` budget per CSS file (Stage 3 whitelist mode).
  // Frozen rule говорит "px для font-size запрещено — rem / clamp() only",
  // но репо имеет pre-existing occurrences (главным образом в
  // portfolio-case.css на крупных сложных typografic-зонах case-view).
  // Чинить — отдельный CSS refactor. Тест в whitelist-mode: actual count
  // per file не должен превышать current budget. Новые добавления → FAIL.
  //
  // Snapshot 2026-05 (i18n PR head):
  //   shared.css         → 2 occurrences
  //   portfolio-case.css → 22 occurrences
  //   tokens / reset / portfolio-core / free-assets → 0
  //
  // При планомерной rem-conversion этот budget уменьшается; обновлять
  // прямо в PR который удаляет px-rules. Никогда не увеличивать.
  const PX_FONT_SIZE_BUDGET = {
    'shared.css': 2,
    'portfolio-case.css': 22,
    'tokens.css': 0,
    'reset.css': 0,
    'portfolio-core.css': 0,
    'free-assets.css': 0,
  };
  const pxFontSizeRe = /font-size:\s*\d+px/g;
  const pxViolations = [];
  let pxBudgetOK = true;
  Object.keys(PX_FONT_SIZE_BUDGET).forEach(file => {
    const full = path.join(ROOT, 'css', file);
    if (!fs.existsSync(full)) return;
    const matches = fs.readFileSync(full, 'utf8').match(pxFontSizeRe) || [];
    const budget = PX_FONT_SIZE_BUDGET[file];
    if (matches.length > budget) {
      pxBudgetOK = false;
      pxViolations.push(`${file}: ${matches.length} > budget ${budget}`);
    }
  });
  add('static', 'C1-no-new-px-font-size', pxBudgetOK,
      pxBudgetOK ? 'all CSS within current per-file budget' : pxViolations.join('; '));
}

/* ═══════════════════════════════════════════════════════════════════════
   INDEX.HTML — расширенный регрешен
═══════════════════════════════════════════════════════════════════════ */
async function testIndex(BASE) {
  console.log(`\n=== index.html · Desktop 1440×900 ===`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: false });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.addInitScript(() => {
    const lifecycle = {
      nextCanvasId: 1,
      getContext: [],
      loseContextCalls: [],
      lostEvents: [],
      restoredEvents: []
    };
    window.__codexWebglLifecycle = lifecycle;

    const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      const isWebgl = typeof type === 'string' && /webgl/i.test(type);
      if (isWebgl && !this.__codexWebglId) {
        this.__codexWebglId = lifecycle.nextCanvasId++;
        const canvas = this;
        canvas.addEventListener('webglcontextlost', event => {
          lifecycle.lostEvents.push({
            t: performance.now(),
            id: canvas.__codexWebglId,
            className: canvas.className || '',
            defaultPrevented: event.defaultPrevented
          });
        });
        canvas.addEventListener('webglcontextrestored', () => {
          lifecycle.restoredEvents.push({
            t: performance.now(),
            id: canvas.__codexWebglId,
            className: canvas.className || ''
          });
        });
      }

      const context = originalGetContext.apply(this, arguments);
      if (isWebgl) {
        lifecycle.getContext.push({
          t: performance.now(),
          id: this.__codexWebglId || null,
          type,
          ok: !!context,
          className: this.className || ''
        });
      }

      if (context && isWebgl && !context.__codexWrappedGetExtension) {
        const originalGetExtension = context.getExtension.bind(context);
        context.getExtension = function (name) {
          const extension = originalGetExtension(name);
          if (name === 'WEBGL_lose_context' && extension && !extension.__codexWrappedLoseContext) {
            const originalLoseContext = extension.loseContext.bind(extension);
            extension.loseContext = function () {
              lifecycle.loseContextCalls.push({
                t: performance.now(),
                id: context.canvas && context.canvas.__codexWebglId,
                className: (context.canvas && context.canvas.className) || ''
              });
              return originalLoseContext();
            };
            extension.__codexWrappedLoseContext = true;
          }
          return extension;
        };
        context.__codexWrappedGetExtension = true;
      }

      return context;
    };
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle', timeout: 30000 });

  // SCRIPTS
  const scripts = await page.$$eval('script[src]', els => els.map(e => ({ src: e.getAttribute('src'), defer: e.hasAttribute('defer'), async: e.hasAttribute('async') })));
  add('index', 'SCRIPTS-no-defer', !scripts.some(s => s.defer));
  const order = scripts.map(s => s.src);
  // A1 — Full chain: gsap → ScrollTrigger → SplitText → i18n-data → i18n → shared → main → animations.
  // Phase 1+ added i18n-data + i18n; they must sit ПОСЛЕ vendor GSAP-bundle и
  // ПЕРЕД main.js (main.js dereferences window.I18N at boot).
  const idx = (rx) => order.findIndex(s => rx.test(s));
  const iGsap = idx(/gsap\.min\.js/);
  const iST   = idx(/ScrollTrigger/);
  const iSpT  = idx(/SplitText/);
  const iI18nD = idx(/i18n-data\.js$/);
  const iI18n  = idx(/i18n\.js$/);
  const iShared = idx(/shared-runtime\.js$/);
  const iMain  = idx(/main\.js$/);
  const iAnim  = idx(/animations\.js$/);
  const orderOK =
    iGsap >= 0 && iST > iGsap && iSpT > iST &&
    iI18nD > iSpT && iI18n > iI18nD &&
    iShared > iI18n && iMain > iShared && iAnim > iMain;
  add('index', 'SCRIPTS-order', orderOK,
      `gsap=${iGsap} ST=${iST} SpT=${iSpT} i18n-data=${iI18nD} i18n=${iI18n} shared=${iShared} main=${iMain} anim=${iAnim}`);
  const sharedAPI = await page.evaluate(() => ({
    obj: typeof window.CodexShared === 'object',
    loadModelViewerScript: typeof (window.CodexShared && window.CodexShared.loadModelViewerScript) === 'function',
  }));
  add('index', 'SHARED-runtime-api', sharedAPI.obj && sharedAPI.loadModelViewerScript,
      JSON.stringify(sharedAPI));

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
  const sprintBCardAnatomy = await page.evaluate(() => {
    const workCards = [...document.querySelectorAll('.work-card[data-id]')];
    return {
      total: workCards.length,
      posters: workCards.filter(card => card.querySelector('.work-card__thumb img[width][height][decoding]')).length,
      hints: workCards.filter(card => card.querySelector('.work-card__hint[aria-hidden="true"]')).length,
      labels: workCards.filter(card => card.querySelector('.work-card__thumb[data-label]')).length,
    };
  });
  add('index', 'WORK-cards-sprint-b-anatomy',
      sprintBCardAnatomy.total === 18 &&
      sprintBCardAnatomy.posters === 18 &&
      sprintBCardAnatomy.hints === 18 &&
      sprintBCardAnatomy.labels === 18,
      `cards=${sprintBCardAnatomy.total}, posters=${sprintBCardAnatomy.posters}, hints=${sprintBCardAnatomy.hints}, labels=${sprintBCardAnatomy.labels}`);

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

  const motionContract = await page.evaluate(() => {
    const data = window.CARDS_DATA && window.CARDS_DATA['orbital-mk-ii'];
    const blocks = data && data.items && Array.isArray(data.items.motionBlocks)
      ? data.items.motionBlocks
      : [];
    const dom = [...document.querySelectorAll('.case-motion')].map(el => ({
      source: el.getAttribute('data-motion-source') || '',
      playback: el.getAttribute('data-motion-playback') || '',
      layout: el.getAttribute('data-motion-layout') || '',
      hasVideo: !!el.querySelector('video.case-motion__video'),
      hasVimeoShell: !!el.querySelector('.case-motion__vimeo'),
      hasIframe: !!el.querySelector('iframe[src*="player.vimeo.com"]'),
      vimeoRole: el.querySelector('.case-motion__vimeo')?.getAttribute('role') || '',
      hasControl: !!el.querySelector('.case-motion__control')
    }));
    return {
      dataCount: blocks.length,
      dataShape: blocks.map(b => ({
        source: b && b.source,
        playback: b && b.playback,
        layout: b && b.layout,
        src: b && b.src,
        label: b && b.label
      })),
      dom
    };
  });
  const expectedMotion = [
    { source: 'local', playback: 'ambient', layout: 'wide' },
    { source: 'vimeo', playback: 'controlled', layout: 'wide' },
    { source: 'local', playback: 'controlled', layout: 'half' },
    { source: 'vimeo', playback: 'ambient', layout: 'half' }
  ];
  const motionShapeOk =
    motionContract.dataCount === 4 &&
    motionContract.dom.length === 4 &&
    expectedMotion.every((expected, idx) => {
      const dataBlock = motionContract.dataShape[idx] || {};
      const domBlock = motionContract.dom[idx] || {};
      return dataBlock.source === expected.source &&
        dataBlock.playback === expected.playback &&
        dataBlock.layout === expected.layout &&
        domBlock.source === expected.source &&
        domBlock.playback === expected.playback &&
        domBlock.layout === expected.layout;
    });
  const localMotionAssets = motionContract.dataShape
    .filter(block => block.source === 'local')
    .map(block => block.src || '')
    .map(src => ({
      src,
      exists: src.startsWith('./assets/') &&
        fs.existsSync(path.join(ROOT, ...src.replace(/^\.\//, '').split('/')))
    }));
  const localMotionAssetsOk =
    localMotionAssets.length === 2 &&
    localMotionAssets.every(asset => asset.exists && /\.(mp4|webm)$/i.test(asset.src));
  add('index', 'CASE-motion-blocks-contract', motionShapeOk,
      JSON.stringify(motionContract));
  add('index', 'CASE-motion-local-assets-exist', localMotionAssetsOk,
      JSON.stringify(localMotionAssets));
  const motionPlaybackOk =
    motionContract.dom[0]?.hasVideo === true &&
    motionContract.dom[0]?.hasControl === false &&
    motionContract.dom[1]?.hasVimeoShell === true &&
    motionContract.dom[1]?.hasIframe === false &&
    motionContract.dom[1]?.hasControl === true &&
    motionContract.dom[2]?.hasVideo === true &&
    motionContract.dom[2]?.hasControl === true &&
    motionContract.dom[3]?.hasVimeoShell === true &&
    motionContract.dom[3]?.hasIframe === false &&
    motionContract.dom[1]?.vimeoRole === '' &&
    motionContract.dom[3]?.vimeoRole === '' &&
    motionContract.dom[3]?.hasControl === false;
  add('index', 'CASE-motion-playback-controls', motionPlaybackOk,
      JSON.stringify(motionContract.dom));

  // BLUEPRINT
  await page.click('.case-tab[data-viz="blueprints"]'); await page.waitForTimeout(400);
  const stoppedMotionLazy = await page.evaluate(() => ({
    localSrcs: [...document.querySelectorAll('.case-motion video')].map(video => video.getAttribute('src') || ''),
    iframeCount: document.querySelectorAll('.case-motion iframe[src*="player.vimeo.com"]').length
  }));
  add('index', 'CASE-motion-stop-keeps-lazy-media',
      stoppedMotionLazy.iframeCount === 0 && stoppedMotionLazy.localSrcs.every(src => src === ''),
      JSON.stringify(stoppedMotionLazy));
  add('index', 'CASE-blueprint-svg', !!await page.$('.case-blueprints svg'));
  await page.click('.case-tab[data-viz="2d"]'); await page.waitForTimeout(250);
  const motionSingleHandler = await page.evaluate(() => {
    const card = document.querySelector('.case-motion[data-motion-playback="controlled"]');
    const btn = card && card.querySelector('[data-motion-toggle]');
    if (!card || !btn) return { ok: false };
    const before = card.getAttribute('data-motion-playing');
    btn.click();
    return {
      ok: before === 'true' &&
        card.getAttribute('data-motion-playing') === 'false' &&
        btn.getAttribute('aria-pressed') === 'false',
      before,
      after: card.getAttribute('data-motion-playing'),
      pressed: btn.getAttribute('aria-pressed')
    };
  });
  add('index', 'CASE-motion-control-single-handler', motionSingleHandler.ok,
      JSON.stringify(motionSingleHandler));

  // 3D
  const before3DResources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(n => /codex-three-viewer|three\.module|three\.core|GLTFLoader|OrbitControls|DRACOLoader|KTX2Loader|HDRLoader|EXRLoader|model-data\.js|draco|basis_transcoder|meshopt_decoder|\.wasm|\.hdr|\.exr/i.test(n)));
  add('index', 'CASE-3d-lazy-before-click', before3DResources.length === 0, before3DResources.join(', ') || 'clean');
  await page.click('.case-tab[data-viz="3d"]'); await page.waitForTimeout(800);
  await page.waitForSelector('#case-3d-canvas canvas.case-3d__three-canvas', { timeout: 5000 }).catch(() => {});
  const c3d = await page.evaluate(() => ({
    canvas: !!document.getElementById('case-3d-canvas'),
    children: document.getElementById('case-3d-canvas')?.children.length > 0,
    threeCanvas: !!document.querySelector('#case-3d-canvas canvas.case-3d__three-canvas'),
    threeQuality: document.querySelector('#case-3d-canvas canvas.case-3d__three-canvas')?.dataset.quality || '',
    modelViewer: !!document.querySelector('#case-3d-canvas model-viewer'),
    materialModes: [...document.querySelectorAll('.case-3d__mat-group [data-material-mode]')].map(btn => btn.dataset.materialMode),
    activeMaterial: document.querySelector('.case-3d__mat-group [data-material-mode].is-on')?.dataset.materialMode || '',
    resources: performance.getEntriesByType('resource')
      .map(e => e.name)
      .filter(n => /codex-three-viewer|three\.module|three\.core|GLTFLoader|OrbitControls|DRACOLoader|KTX2Loader|HDRLoader|EXRLoader|model-data\.js|draco|basis_transcoder|meshopt_decoder|\.wasm|\.hdr|\.exr|\.glb/i.test(n))
  }));
  add('index', 'CASE-3d-canvas', c3d.canvas);
  add('index', 'CASE-3d-content', c3d.children);
  add('index', 'CASE-3d-three-island', c3d.threeCanvas && !c3d.modelViewer, c3d.resources.join(', '));
  add('index', 'CASE-3d-quality-controls',
      c3d.threeQuality === 'pmrem-contact-shadow-material-modes' &&
      c3d.materialModes.join(',') === 'pbr,clay,xray' &&
      c3d.activeMaterial === 'pbr',
      `quality=${c3d.threeQuality}, material=${c3d.materialModes.join(',')}, active=${c3d.activeMaterial}`);
  await page.click('.case-3d__mat-group [data-material-mode="clay"]'); await page.waitForTimeout(80);
  await page.click('.case-3d__mat-group [data-material-mode="xray"]'); await page.waitForTimeout(80);
  const materialSwitch = await page.evaluate(() => ({
    active: document.querySelector('.case-3d__mat-group [data-material-mode].is-on')?.dataset.materialMode || '',
    aria: document.querySelector('.case-3d__mat-group [data-material-mode="xray"]')?.getAttribute('aria-pressed') || ''
  }));
  add('index', 'CASE-3d-material-switch', materialSwitch.active === 'xray' && materialSwitch.aria === 'true',
      `active=${materialSwitch.active}, aria=${materialSwitch.aria}`);
  await page.click('.case-3d__mat-group [data-material-mode="pbr"]'); await page.waitForTimeout(80);
  add('index', 'CASE-3d-lazy-after-click',
      c3d.resources.some(n => /codex-three-viewer/i.test(n)) &&
      c3d.resources.some(n => /model-data\.js/i.test(n)),
      c3d.resources.join(', '));

  const studioDefaultEnvIds = ['orbital-mk-ii', 'vega-shell', 'ironclad-frame'];
  const studioDefaultEnvState = await page.evaluate(ids => {
    const active = document.querySelector('.case-3d__env-group [data-env].is-on');
    return {
      sources: ids.map(id => ({
        id,
        source: (window.CARDS_DATA && window.CARDS_DATA[id] && window.CARDS_DATA[id].modelEnvironment) || ''
      })),
      active: active ? active.dataset.env : '',
      aria: active ? active.getAttribute('aria-pressed') : ''
    };
  }, studioDefaultEnvIds);
  add('index', 'CASE-3d-studio-default-envs',
      studioDefaultEnvState.sources.every(item => item.source === 'studio') &&
      studioDefaultEnvState.active === 'studio' &&
      studioDefaultEnvState.aria === 'true',
      studioDefaultEnvState.sources.map(item => `${item.id}: source=${item.source}`).join('; ') +
      `; active=${studioDefaultEnvState.active}, aria=${studioDefaultEnvState.aria}`);

  await page.click('.work-card[data-id="ironclad-frame"]');
  await page.waitForFunction(() =>
    document.querySelector('#case-title')?.textContent?.includes('Ironclad Frame') &&
    document.querySelector('#case-3d-canvas.is-ready canvas.case-3d__three-canvas')
  );
  const pagination3DSwitchCount = 9;
  const pagination3D = await page.evaluate(async switchCount => {
    const host = document.getElementById('case-3d-canvas');
    const states = [];
    const baseline = {
      getContext: window.__codexWebglLifecycle?.getContext.length || 0,
      loseContextCalls: window.__codexWebglLifecycle?.loseContextCalls.length || 0,
      lostEvents: window.__codexWebglLifecycle?.lostEvents.length || 0,
      restoredEvents: window.__codexWebglLifecycle?.restoredEvents.length || 0
    };
    function readState(label) {
      const after = host ? window.getComputedStyle(host, '::after') : null;
      const state = {
        label,
        ready: !!host?.classList.contains('is-ready'),
        switching: !!host?.classList.contains('is-switching-3d'),
        coverPainted: !!after && after.content !== 'none' && after.display !== 'none' && after.opacity !== '0',
        children: host ? host.children.length : 0,
        canvases: document.querySelectorAll('#case-3d-canvas canvas.case-3d__three-canvas').length,
        fallback: !!document.querySelector('#case-3d-canvas .case-3d__fallback'),
        active3D: document.querySelector('.case-tab[data-viz="3d"]')?.classList.contains('case-tab--active') || false,
        title: document.querySelector('#case-title')?.textContent || '',
        counter: document.querySelector('#case-counter')?.textContent || ''
      };
      states.push(state);
      return state;
    }
    for (let step = 0; step < switchCount; step += 1) {
      readState(`step-${step}-before`);
      document.getElementById('case-next')?.click();
      readState(`step-${step}-sync`);
      await Promise.resolve();
      readState(`step-${step}-microtask`);
      let readyFrames = 0;
      for (let frame = 0; frame < 120; frame += 1) {
        await new Promise(resolve => window.requestAnimationFrame(resolve));
        const state = readState(`step-${step}-raf-${frame}`);
        if (state.ready) readyFrames += 1;
        if (readyFrames >= 2) break;
      }
      readState(`step-${step}-ready`);
    }
    await new Promise(resolve => window.setTimeout(resolve, 450));
    const afterLifecycle = {
      getContext: window.__codexWebglLifecycle?.getContext.length || 0,
      loseContextCalls: window.__codexWebglLifecycle?.loseContextCalls.length || 0,
      lostEvents: window.__codexWebglLifecycle?.lostEvents.length || 0,
      restoredEvents: window.__codexWebglLifecycle?.restoredEvents.length || 0,
      loseDetails: window.__codexWebglLifecycle?.loseContextCalls.slice(baseline.loseContextCalls) || [],
      lostDetails: window.__codexWebglLifecycle?.lostEvents.slice(baseline.lostEvents) || [],
      restoredDetails: window.__codexWebglLifecycle?.restoredEvents.slice(baseline.restoredEvents) || []
    };
    const finalCover = host ? window.getComputedStyle(host, '::after') : null;
    return {
      states,
      finalTitle: document.querySelector('#case-title')?.textContent || '',
      finalCounter: document.querySelector('#case-counter')?.textContent || '',
      finalReady: !!host?.classList.contains('is-ready'),
      finalSwitching: !!host?.classList.contains('is-switching-3d'),
      finalCoverPainted: !!finalCover && finalCover.content !== 'none' &&
        finalCover.display !== 'none' && finalCover.opacity !== '0',
      finalCanvases: document.querySelectorAll('#case-3d-canvas canvas.case-3d__three-canvas').length,
      finalActive3D: document.querySelector('.case-tab[data-viz="3d"]')?.classList.contains('case-tab--active') || false,
      lifecycle: {
        baseline,
        after: afterLifecycle,
        delta: {
          getContext: afterLifecycle.getContext - baseline.getContext,
          loseContextCalls: afterLifecycle.loseContextCalls - baseline.loseContextCalls,
          lostEvents: afterLifecycle.lostEvents - baseline.lostEvents,
          restoredEvents: afterLifecycle.restoredEvents - baseline.restoredEvents
        }
      }
    };
  }, pagination3DSwitchCount);
  const transitionFrames = pagination3D.states.filter(state => !state.label.endsWith('-before') && !state.ready);
  const transitionCovered = transitionFrames.length > 0 &&
    transitionFrames.every(state => state.switching && state.coverPainted && state.active3D && state.children > 0 && state.canvases <= 1);
  const postReadyChecks = Array.from({ length: pagination3DSwitchCount }, (_, step) => {
    const readyRafFrames = pagination3D.states
      .filter(state => state.label.startsWith(`step-${step}-raf-`) && state.ready)
      .slice(0, 2);
    return {
      step,
      frames: readyRafFrames.length,
      covered: readyRafFrames.filter(state => state.switching && state.coverPainted).length,
      pass: readyRafFrames.length === 2 &&
        readyRafFrames.every(state => state.switching && state.coverPainted)
    };
  });
  const postReadyCovered = postReadyChecks.every(item => item.pass);
  add('index', 'CASE-3d-pagination-transition-cover',
      pagination3D.finalTitle === 'Arc Motion' &&
      pagination3D.finalCounter === '12 / 18' &&
      pagination3D.finalReady &&
      !pagination3D.finalSwitching &&
      !pagination3D.finalCoverPainted &&
      pagination3D.finalCanvases === 1 &&
      pagination3D.finalActive3D &&
      transitionCovered &&
      postReadyCovered &&
      pagination3D.lifecycle.delta.getContext === pagination3DSwitchCount &&
      pagination3D.lifecycle.delta.loseContextCalls === 0 &&
      pagination3D.lifecycle.delta.lostEvents === 0 &&
      pagination3D.lifecycle.delta.restoredEvents === 0,
      `title=${pagination3D.finalTitle}, counter=${pagination3D.finalCounter}, ` +
      `finalSwitching=${pagination3D.finalSwitching}, finalCover=${pagination3D.finalCoverPainted}, ` +
      `transitionFrames=${transitionFrames.length}, postReady=${JSON.stringify(postReadyChecks)}, ` +
      `lifecycle=${JSON.stringify(pagination3D.lifecycle.delta)}, ` +
      `lose=${JSON.stringify(pagination3D.lifecycle.after.loseDetails)}, ` +
      `lost=${JSON.stringify(pagination3D.lifecycle.after.lostDetails)}, ` +
      `restored=${JSON.stringify(pagination3D.lifecycle.after.restoredDetails)}`);

  // SHARE BUTTONS
  add('index', 'CASE-share-desktop', !!await page.$('#case-share-desktop'));
  add('index', 'CASE-share-mobile', !!await page.$('#case-share-mobile'));

  // THEME TOGGLE
  await page.click('.case-tab[data-viz="2d"]'); await page.waitForTimeout(150);
  await page.click('#theme-toggle'); await page.waitForTimeout(300);
  const afterToggle = await page.getAttribute('body', 'data-theme');
  add('index', 'THEME-toggle', afterToggle === 'light');
  await page.click('#theme-toggle');

  /* ───── Stage 1 (A2-A6) ─ i18n runtime surfaces ───────────────────────── */

  // A2 — window.I18N API: object + required methods.
  const i18nAPI = await page.evaluate(() => ({
    obj:        typeof window.I18N === 'object',
    getLang:    typeof (window.I18N && window.I18N.getLang)   === 'function',
    t:          typeof (window.I18N && window.I18N.t)         === 'function',
    applyLang:  typeof (window.I18N && window.I18N.applyLang) === 'function',
    isValid:    typeof (window.I18N && window.I18N.isValidLang) === 'function',
    data:       typeof window.I18N_DATA === 'object',
  }));
  add('index', 'A2-I18N-api', i18nAPI.obj && i18nAPI.getLang && i18nAPI.t && i18nAPI.applyLang && i18nAPI.isValid && i18nAPI.data,
      `api=${JSON.stringify(i18nAPI)}`);

  // A3 — <html lang> set to a valid two-letter code after init.
  const htmlLang = await page.getAttribute('html', 'lang');
  add('index', 'A3-html-lang-valid', /^(en|ru)$/.test(htmlLang || ''), `lang="${htmlLang}"`);

  // A4 — #lang-toggle present в DOM (inside .header-top__controls).
  const langToggleInHeader = await page.evaluate(() => {
    const t = document.getElementById('lang-toggle');
    if (!t) return false;
    return !!t.closest('.header-top__controls');
  });
  add('index', 'A4-lang-toggle-present', langToggleInHeader);

  // A6 — og:locale meta exists and matches lang code shape.
  const ogLocale = await page.getAttribute('meta[property="og:locale"]', 'content');
  add('index', 'A6-og-locale', /^(en_US|ru_RU)$/.test(ogLocale || ''), `og:locale="${ogLocale}"`);

  // A5 — click #lang-toggle → URL ?lang flips. Round-trip обратно, чтобы
  // не оставлять страницу в RU-state для последующих тестов.
  const langBefore = await page.evaluate(() => window.I18N.getLang());
  await page.click('#lang-toggle'); await page.waitForTimeout(400);
  const urlAfter = await page.evaluate(() => location.search);
  const langAfter = await page.evaluate(() => window.I18N.getLang());
  await page.click('#lang-toggle'); await page.waitForTimeout(400); // restore
  add('index', 'A5-lang-toggle-flips-url',
      langAfter !== langBefore && /[?&]lang=(en|ru)\b/.test(urlAfter),
      `${langBefore}→${langAfter}, url="${urlAfter}"`);

  /* ───── Stage 2 (B1-B8, B10) ─ i18n dict shape + walker + a11y ────────── */

  // B1 — data-i18n attribute count floor. Index HTML carries ~121 total
  // occurrences (61 data-i18n + 51 data-i18n-attr + 9 data-i18n-meta);
  // unique elements (some carry two attrs simultaneously) are slightly less.
  // Floor at 100 catches regressions where >15% of attrs go missing while
  // staying above noise from minor refactors.
  const indexI18nAttrCount = await page.evaluate(() =>
    document.querySelectorAll('[data-i18n], [data-i18n-attr], [data-i18n-html], [data-i18n-meta]').length);
  add('index', 'B1-data-i18n-attr-floor', indexI18nAttrCount >= 100,
      `count=${indexI18nAttrCount} (floor 100)`);

  // B2 — UI_STRINGS shape: both langs exist, each has all critical namespaces.
  const uiShape = await page.evaluate(() => {
    const ui = window.I18N_DATA && window.I18N_DATA.UI_STRINGS;
    if (!ui || !ui.en || !ui.ru) return { ok: false, reason: 'no en/ru' };
    const required = ['aria', 'title', 'btn', 'pill', 'preloader', 'filter',
                      'tabs', 'footer', 'toggle', 'theme', 'copy', 'chip', 'fs',
                      'bp', 'viz'];
    const missingEn = required.filter(k => !ui.en[k]);
    const missingRu = required.filter(k => !ui.ru[k]);
    return { ok: missingEn.length === 0 && missingRu.length === 0, missingEn, missingRu };
  });
  add('index', 'B2-UI_STRINGS-namespaces', uiShape.ok,
      uiShape.ok ? 'all 15 namespaces × en+ru' : JSON.stringify(uiShape));

  // B3 — CARDS_LOCALES.ru has 18 keys matching EXPECTED_IDS.
  const cardsLocaleShape = await page.evaluate((expected) => {
    const cl = window.I18N_DATA && window.I18N_DATA.CARDS_LOCALES;
    if (!cl || !cl.en || !cl.ru) return { ok: false, reason: 'no en/ru' };
    const keys = Object.keys(cl.ru);
    const ok = keys.length === expected.length && expected.every(id => cl.ru[id] && cl.ru[id].title);
    return { ok, count: keys.length };
  }, EXPECTED_IDS);
  add('index', 'B3-CARDS_LOCALES-18-ru', cardsLocaleShape.ok,
      `ru.length=${cardsLocaleShape.count} (expected 18)`);

  // B4 — CASE_LOCALES.ru has 18 keys matching EXPECTED_IDS.
  const caseLocaleShape = await page.evaluate((expected) => {
    const cl = window.I18N_DATA && window.I18N_DATA.CASE_LOCALES;
    if (!cl || !cl.en || !cl.ru) return { ok: false, reason: 'no en/ru' };
    const keys = Object.keys(cl.ru);
    const orbitalMotion = cl.ru['orbital-mk-ii'] && cl.ru['orbital-mk-ii'].motionBlocks;
    const ok = keys.length === expected.length &&
               expected.every(id => cl.ru[id] && cl.ru[id].role && Array.isArray(cl.ru[id].captions)) &&
               Array.isArray(orbitalMotion) &&
               orbitalMotion.length === 4 &&
               orbitalMotion.every(block => block && block.label && block.desc);
    return { ok, count: keys.length, orbitalMotionCount: Array.isArray(orbitalMotion) ? orbitalMotion.length : 0 };
  }, EXPECTED_IDS);
  add('index', 'B4-CASE_LOCALES-18-ru', caseLocaleShape.ok,
      `ru.length=${caseLocaleShape.count} (expected 18, with role+captions), orbitalMotion=${caseLocaleShape.orbitalMotionCount}`);

  // B6 — Full EN ⇄ RU round-trip on lang-toggle. Verifies <html lang>,
  // currentLang AND that we restore EN cleanly (no stuck state).
  const roundTrip = await page.evaluate(async () => {
    const out = { steps: [] };
    const snap = () => ({
      htmlLang: document.documentElement.lang,
      apiLang: window.I18N.getLang(),
      togglerLabel: document.querySelector('#lang-toggle .lang-toggle__current')?.textContent.trim(),
    });
    out.steps.push({ at: 'initial', ...snap() });
    document.getElementById('lang-toggle').click();
    await new Promise(r => setTimeout(r, 350));
    out.steps.push({ at: 'after-1st-click', ...snap() });
    document.getElementById('lang-toggle').click();
    await new Promise(r => setTimeout(r, 350));
    out.steps.push({ at: 'after-2nd-click', ...snap() });
    return out;
  });
  const rtOK = roundTrip.steps[0].apiLang !== roundTrip.steps[1].apiLang &&
               roundTrip.steps[0].apiLang === roundTrip.steps[2].apiLang &&
               roundTrip.steps[1].apiLang !== roundTrip.steps[2].apiLang;
  add('index', 'B6-lang-toggle-round-trip', rtOK,
      roundTrip.steps.map(s => `${s.at}=${s.apiLang}`).join(' → '));

  // B7 — Walker mutated DOM: after switching to ru, the first work-card desc
  // contains Cyrillic. Switch back to en after.
  const cyrillicCheck = await page.evaluate(async () => {
    await window.I18N.applyLang('ru');
    await new Promise(r => setTimeout(r, 200));
    const ruText = document.querySelector('.work-card .work-card__desc')?.textContent || '';
    await window.I18N.applyLang('en');
    await new Promise(r => setTimeout(r, 200));
    const enText = document.querySelector('.work-card .work-card__desc')?.textContent || '';
    return { hasCyrillic: /[Ѐ-ӿ]/.test(ruText), ruSample: ruText.slice(0, 40), enSample: enText.slice(0, 40) };
  });
  add('index', 'B7-walker-mutates-cyrillic', cyrillicCheck.hasCyrillic,
      `ru="${cyrillicCheck.ruSample}…"`);

  // B8 — i18n:changed CustomEvent fires on language switch.
  const eventFires = await page.evaluate(async () => {
    let fired = null;
    const handler = e => { fired = e && e.detail && e.detail.lang; };
    window.addEventListener('i18n:changed', handler, { once: true });
    await window.I18N.applyLang(window.I18N.getLang() === 'ru' ? 'en' : 'ru');
    await new Promise(r => setTimeout(r, 200));
    await window.I18N.applyLang('en'); // restore
    await new Promise(r => setTimeout(r, 200));
    return fired;
  });
  add('index', 'B8-i18n-changed-event', typeof eventFires === 'string' && /^(en|ru)$/.test(eventFires),
      `detail.lang="${eventFires}"`);

  // B10 — skip-to-content link present (a11y, Phase 1 addition).
  const skipLink = await page.evaluate(() => {
    const a = document.querySelector('a.skip-to-content[href="#main"]');
    return !!a;
  });
  add('index', 'B10-skip-to-content', skipLink);

  /* ───── Stage 4 (D1, D3, D4) ─ a11y + asset hygiene ───────────────────── */

  // D1 — WCAG 2 A/AA via axe-core. Sprint E tightens the index budget to
  // zero after the baseline stayed clean.
  const axeIndex = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const axeIndexCount = axeIndex.violations.length;
  const AXE_INDEX_BUDGET = 0;
  add('index', 'D1-axe-wcag-aa', axeIndexCount <= AXE_INDEX_BUDGET,
      `violations=${axeIndexCount} budget=${AXE_INDEX_BUDGET}` +
      (axeIndexCount > 0 ? ' [' + axeIndex.violations.map(v => v.id).join(',') + ']' : ''));

  // D3 — every <img> has alt + width + height + loading + decoding.
  // Frozen rule from CLAUDE.md. Lazy SVG-data:image are exempted because
  // they're inline base64 with no <img> wrapper anyway.
  const imgIssues = await page.evaluate(() => {
    const required = ['alt', 'width', 'height', 'loading', 'decoding'];
    const fails = [];
    document.querySelectorAll('img').forEach(img => {
      const missing = required.filter(a => !img.hasAttribute(a));
      if (missing.length) {
        const src = img.getAttribute('src') || '(no src)';
        fails.push(`${src.slice(-40)} missing=[${missing.join(',')}]`);
      }
    });
    return fails;
  });
  add('index', 'D3-img-required-attrs', imgIssues.length === 0,
      imgIssues.length ? imgIssues.slice(0, 2).join(' | ') : 'all clean');

  // D4 — Fontshare CSS URL includes display=swap (prevents FOIT, frozen
  // perf rule). Проверяет только stylesheet/preload links — preconnect
  // указывает на хост без query params, у него display=swap по определению
  // быть не может.
  const fontDisplaySwap = await page.evaluate(() => {
    const links = [...document.querySelectorAll(
      'link[rel="stylesheet"][href*="fontshare"], link[rel="preload"][href*="fontshare"]'
    )];
    if (!links.length) return { ok: false, reason: 'no fontshare CSS link' };
    const bad = links.filter(l => !/display=swap/i.test(l.getAttribute('href') || ''));
    return { ok: bad.length === 0, total: links.length, bad: bad.length };
  });
  add('index', 'D4-font-display-swap', fontDisplaySwap.ok,
      `css-links=${fontDisplaySwap.total} bad=${fontDisplaySwap.bad || 0}`);

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
   FREE-ASSETS.HTML — регрешен
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

  // A1 — script order на FA (нет Lenis, есть animations.js и free-assets.js):
  // gsap → ScrollTrigger → SplitText → i18n-data → i18n → shared → main → animations → free-assets.
  const faOrder = scripts.map(s => s.src);
  const faIdx = (rx) => faOrder.findIndex(s => rx.test(s));
  const f = {
    gsap:    faIdx(/gsap\.min\.js/),
    st:      faIdx(/ScrollTrigger/),
    spt:     faIdx(/SplitText/),
    i18nD:   faIdx(/i18n-data\.js$/),
    i18n:    faIdx(/i18n\.js$/),
    shared:  faIdx(/shared-runtime\.js$/),
    main:    faIdx(/main\.js$/),
    anim:    faIdx(/animations\.js$/),
    faJs:    faIdx(/free-assets\.js$/),
  };
  const faOrderOK = f.gsap >= 0 && f.st > f.gsap && f.spt > f.st &&
                    f.i18nD > f.spt && f.i18n > f.i18nD &&
                    f.shared > f.i18n && f.main > f.shared &&
                    f.anim > f.main && f.faJs > f.anim;
  add('fa', 'SCRIPTS-order', faOrderOK, JSON.stringify(f));
  const faSharedAPI = await page.evaluate(() => ({
    obj: typeof window.CodexShared === 'object',
    loadModelViewerScript: typeof (window.CodexShared && window.CodexShared.loadModelViewerScript) === 'function',
  }));
  add('fa', 'SHARED-runtime-api', faSharedAPI.obj && faSharedAPI.loadModelViewerScript,
      JSON.stringify(faSharedAPI));

  // GSAP loaded
  const gsap = await page.evaluate(() => typeof window.gsap);
  add('fa', 'GSAP-loaded', gsap === 'object');

  /* ───── Stage 1 (A2-A6) ─ i18n runtime surfaces (мirror'им index) ─────── */
  const faI18nAPI = await page.evaluate(() => ({
    obj:        typeof window.I18N === 'object',
    getLang:    typeof (window.I18N && window.I18N.getLang)   === 'function',
    t:          typeof (window.I18N && window.I18N.t)         === 'function',
    applyLang:  typeof (window.I18N && window.I18N.applyLang) === 'function',
    data:       typeof window.I18N_DATA === 'object',
  }));
  add('fa', 'A2-I18N-api', faI18nAPI.obj && faI18nAPI.getLang && faI18nAPI.t && faI18nAPI.applyLang && faI18nAPI.data,
      JSON.stringify(faI18nAPI));

  const faHtmlLang = await page.getAttribute('html', 'lang');
  add('fa', 'A3-html-lang-valid', /^(en|ru)$/.test(faHtmlLang || ''), `lang="${faHtmlLang}"`);

  const faLangTogglePresent = await page.evaluate(() => {
    const t = document.getElementById('lang-toggle');
    return !!(t && t.closest('.header-top__controls'));
  });
  add('fa', 'A4-lang-toggle-present', faLangTogglePresent);

  const faOgLocale = await page.getAttribute('meta[property="og:locale"]', 'content');
  add('fa', 'A6-og-locale', /^(en_US|ru_RU)$/.test(faOgLocale || ''), `og:locale="${faOgLocale}"`);

  /* ───── Stage 2 (B1, B5, B10) ─ FA dict shape + a11y ─────────────────── */

  // B1-fa — data-i18n attribute count floor. FA HTML carries ~87 occurrences
  // (51 data-i18n + 27 data-i18n-attr + 9 data-i18n-meta). Floor at 70 with
  // same 15%-regression tolerance as index.
  const faI18nAttrCount = await page.evaluate(() =>
    document.querySelectorAll('[data-i18n], [data-i18n-attr], [data-i18n-html], [data-i18n-meta]').length);
  add('fa', 'B1-data-i18n-attr-floor', faI18nAttrCount >= 70,
      `count=${faI18nAttrCount} (floor 70)`);

  // B5 — FA_LOCALES.ru has 25 keys (8 hard-surface + 5 product + 4 game +
  // 3 organic + 2 animation + 3 cad = 25). Каждая запись хотя бы { desc }.
  const faLocaleShape = await page.evaluate(() => {
    const fa = window.I18N_DATA && window.I18N_DATA.FA_LOCALES;
    if (!fa || !fa.en || !fa.ru) return { ok: false, reason: 'no en/ru' };
    const keys = Object.keys(fa.ru);
    const allHaveDesc = keys.every(k => fa.ru[k] && typeof fa.ru[k].desc === 'string');
    return { ok: keys.length === 25 && allHaveDesc, count: keys.length };
  });
  add('fa', 'B5-FA_LOCALES-25-ru', faLocaleShape.ok,
      `ru.length=${faLocaleShape.count} (expected 25)`);

  // B10 — skip-to-content link present (a11y, Phase 1 addition).
  const faSkipLink = await page.evaluate(() =>
    !!document.querySelector('a.skip-to-content[href="#main"]'));
  add('fa', 'B10-skip-to-content', faSkipLink);

  /* ───── Stage 4 (D2, D3, D4) ─ a11y + asset hygiene ──────────────────── */

  // D2 — WCAG 2 A/AA via axe-core. Current FA = 0 violations (clean).
  // Budget = 0; ANY new violation → FAIL. Strict mode на FA потому что
  // FA layout проще и должен оставаться чистым.
  const axeFA = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const axeFACount = axeFA.violations.length;
  add('fa', 'D2-axe-wcag-aa', axeFACount === 0,
      `violations=${axeFACount}` +
      (axeFACount > 0 ? ' [' + axeFA.violations.map(v => v.id).join(',') + ']' : ' clean'));

  // D3 — img attributes (mirror index).
  const faImgIssues = await page.evaluate(() => {
    const required = ['alt', 'width', 'height', 'loading', 'decoding'];
    const fails = [];
    document.querySelectorAll('img').forEach(img => {
      const missing = required.filter(a => !img.hasAttribute(a));
      if (missing.length) {
        const src = img.getAttribute('src') || '(no src)';
        fails.push(`${src.slice(-40)} missing=[${missing.join(',')}]`);
      }
    });
    return fails;
  });
  add('fa', 'D3-img-required-attrs', faImgIssues.length === 0,
      faImgIssues.length ? faImgIssues.slice(0, 2).join(' | ') : 'all clean');

  // D4 — Fontshare display=swap on FA (mirror index).
  const faFontSwap = await page.evaluate(() => {
    const links = [...document.querySelectorAll(
      'link[rel="stylesheet"][href*="fontshare"], link[rel="preload"][href*="fontshare"]'
    )];
    if (!links.length) return { ok: false, reason: 'no fontshare CSS link' };
    const bad = links.filter(l => !/display=swap/i.test(l.getAttribute('href') || ''));
    return { ok: bad.length === 0, total: links.length, bad: bad.length };
  });
  add('fa', 'D4-font-display-swap', faFontSwap.ok,
      `css-links=${faFontSwap.total} bad=${faFontSwap.bad || 0}`);

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
  const faJsonLdDepth = await page.evaluate(() => {
    const parsed = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(node => {
        try { return JSON.parse(node.textContent || '{}'); }
        catch (_) { return null; }
      })
      .filter(Boolean);
    const nodes = parsed.flatMap(item => Array.isArray(item['@graph']) ? item['@graph'] : [item]);
    const itemList = nodes.find(item =>
      item &&
      item['@type'] === 'ItemList' &&
      /free 3d asset/i.test(String(item.name || ''))
    );
    const listItems = itemList && Array.isArray(itemList.itemListElement) ? itemList.itemListElement : [];
    const models = listItems
      .map(entry => entry && entry.item)
      .filter(item => item && item['@type'] === '3DModel');
    const fragments = listItems
      .map(entry => String(entry && entry.url || '').match(/#([^#]+)$/))
      .filter(Boolean)
      .map(match => decodeURIComponent(match[1]));
    return {
      itemList: !!itemList,
      numberOfItems: Number(itemList && itemList.numberOfItems) || 0,
      items: listItems.length,
      models: models.length,
      allFree: models.every(model => model.isAccessibleForFree === true),
      allLicensed: models.every(model => /creativecommons\.org\/publicdomain\/zero/i.test(String(model.license || ''))),
      hasFormats: models.every(model => Array.isArray(model.encodingFormat) && model.encodingFormat.length >= 2),
      fragments: fragments.length,
      allFragmentsResolve: fragments.length === listItems.length && fragments.every(id => !!document.getElementById(id)),
    };
  });
  add('fa', 'META-jsonLD-asset-depth',
      faJsonLdDepth.itemList &&
      faJsonLdDepth.numberOfItems === 25 &&
      faJsonLdDepth.items >= 8 &&
      faJsonLdDepth.models >= 8 &&
      faJsonLdDepth.allFree &&
      faJsonLdDepth.allLicensed &&
      faJsonLdDepth.hasFormats &&
      faJsonLdDepth.allFragmentsResolve,
      `items=${faJsonLdDepth.items}, models=${faJsonLdDepth.models}, total=${faJsonLdDepth.numberOfItems}, fragments=${faJsonLdDepth.fragments}`);
  add('fa', 'META-favicon-16', m.favicon16);
  add('fa', 'META-manifest', m.manifest);
  // v0.6 [Z6] — архитектура theme-color приведена к single-tag (как в index.html).
  // JS applyTheme() в main.js обновляет content при ручном toggle. Split с media
  // создавал conflict (querySelector брал первый тег, второй оставался устаревшим).
  // Тест: должен быть РОВНО ОДИН тег theme-color без media-attribute.
  add('fa', 'META-theme-color-single', m.themeColorPresent && m.themeColorCount === 1, `count=${m.themeColorCount}`);
  add('fa', 'META-og-image-absolute', /^https?:/.test(m.ogImage), `value=${m.ogImage.slice(-40)}`);
  add('fa', 'META-og-image-fa-specific', /og-free-assets\.jpg$/.test(m.ogImage));

  const faTrust = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.fa-trust__item')];
    return {
      items: items.length,
      keyed: items.filter(item => item.querySelector('[data-i18n^="faTrust."]')).length,
      terms: items.map(item => item.textContent.trim()).join(' | '),
    };
  });
  add('fa', 'FA-trust-signals',
      faTrust.items >= 3 && faTrust.keyed >= 3 && /CC0/i.test(faTrust.terms) && /No account/i.test(faTrust.terms),
      `items=${faTrust.items}, keyed=${faTrust.keyed}`);

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

  const mini3D = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.fa-card')];
    const previews = [...document.querySelectorAll('.fa-card__thumb-mv')];
    return {
      previews: previews.length,
      noPreview: cards.filter(card => !card.querySelector('.fa-card__thumb-mv')).length,
      autoRotate: previews.filter(mv => mv.hasAttribute('auto-rotate')).length,
      cameraControls: previews.filter(mv => mv.hasAttribute('camera-controls')).length,
      localSrcs: previews.every(mv => /^\.\/assets\/models\/free\/.+\.glb$/.test(mv.getAttribute('src') || mv.dataset.codexPreviewSrc || '')),
      deferredSources: previews.filter(mv => mv.dataset.codexPreviewSrc && !mv.getAttribute('src')).length,
      enabledSources: previews.filter(mv => mv.dataset.codexPreviewEnabled === 'true').length,
    };
  });
  add('fa', 'GRID-mini-3d-previews', mini3D.previews === 8 && mini3D.noPreview === 0,
      `previews=${mini3D.previews}, fallback-only=${mini3D.noPreview}`);
  add('fa', 'GRID-mini-3d-auto-rotate-only', mini3D.autoRotate === mini3D.previews && mini3D.cameraControls === 0,
      `auto=${mini3D.autoRotate}, camera-controls=${mini3D.cameraControls}`);
  add('fa', 'GRID-mini-3d-local-srcs', mini3D.localSrcs,
      `all preview GLBs load from ./assets/models/free/ (enabled=${mini3D.enabledSources}, deferred=${mini3D.deferredSources})`);
  const sprintBFAAnatomy = await page.evaluate(() => {
    const tagCards = [...document.querySelectorAll('.tag-card.work-card')];
    const assetCards = [...document.querySelectorAll('.fa-card')];
    return {
      tags: tagCards.length,
      tagHints: tagCards.filter(card => card.querySelector('.tag-card__hint[aria-hidden="true"]')).length,
      tagPosters: tagCards.filter(card => card.querySelector('.tag-card__thumb img[width][height][decoding]')).length,
      assets: assetCards.length,
      assetHints: assetCards.filter(card => card.querySelector('.fa-card__hint[aria-hidden="true"]')).length,
      assetPreviewStates: assetCards.filter(card => card.querySelector('.fa-card__thumb[data-preview-state="3d"]')).length,
      assetPreviewButtons: assetCards.filter(card => card.querySelector('.fa-card__preview-btn')).length,
    };
  });
  add('fa', 'FA-cards-sprint-b-anatomy',
      sprintBFAAnatomy.tags === 6 &&
      sprintBFAAnatomy.tagHints === 6 &&
      sprintBFAAnatomy.tagPosters === 6 &&
      sprintBFAAnatomy.assets === 8 &&
      sprintBFAAnatomy.assetHints === 8 &&
      sprintBFAAnatomy.assetPreviewStates === 8 &&
      sprintBFAAnatomy.assetPreviewButtons === 8,
      `tags=${sprintBFAAnatomy.tags}/${sprintBFAAnatomy.tagHints}/${sprintBFAAnatomy.tagPosters}, assets=${sprintBFAAnatomy.assets}/${sprintBFAAnatomy.assetHints}/${sprintBFAAnatomy.assetPreviewStates}/${sprintBFAAnatomy.assetPreviewButtons}`);

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
  await page.click('#tag-product'); await page.waitForTimeout(300);
  const gameAfterTagSwitch = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.fa-card')];
    const visible = cards.filter(card => !card.hidden && getComputedStyle(card).display !== 'none');
    return {
      total: cards.length,
      visible: visible.length,
      countText: document.getElementById('fa-view-count')?.textContent || ''
    };
  });
  add('fa', 'N4-game-persists-after-tag-switch',
      gameAfterTagSwitch.total === 5 && gameAfterTagSwitch.visible === 0 && /0 assets \(game-only\)/.test(gameAfterTagSwitch.countText),
      `product total=${gameAfterTagSwitch.total}, visible=${gameAfterTagSwitch.visible}, count="${gameAfterTagSwitch.countText}"`);
  await page.click('#lang-toggle'); await page.waitForTimeout(300);
  const gameAfterLangSwitch = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.fa-card')];
    const visible = cards.filter(card => !card.hidden && getComputedStyle(card).display !== 'none');
    return {
      total: cards.length,
      visible: visible.length,
      countText: document.getElementById('fa-view-count')?.textContent || ''
    };
  });
  add('fa', 'N4-game-persists-after-lang-switch',
      gameAfterLangSwitch.total === 5 && gameAfterLangSwitch.visible === 0 && /0 assets \(game-only\)/.test(gameAfterLangSwitch.countText),
      `product total=${gameAfterLangSwitch.total}, visible=${gameAfterLangSwitch.visible}, count="${gameAfterLangSwitch.countText}"`);
  await page.click('#lang-toggle'); await page.waitForTimeout(200);
  await page.click('.game-switch__track'); await page.waitForTimeout(200);

  // M3 — single fetch per click (downloadAsset)
  // Этот тест требует acceptDownloads; основной browser smoke покрывает coherent download fallback contract.

  // THEME TOGGLE
  await page.click('#theme-toggle'); await page.waitForTimeout(200);
  add('fa', 'THEME-toggle', await page.getAttribute('body', 'data-theme') === 'light');
  await page.click('#theme-toggle');

  // CONSOLE — без внутренних ошибок.
  // v0.8.x — filter расширен идентично index (fontshare, cloudflare, ERR_CERT_AUTHORITY_INVALID,
  // ERR_FAILED, jsdelivr) для устойчивости в cloud envs с corp TLS-перехватом.
  const internalErrors = consoleErrors.filter(e => !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|jsdelivr|fontshare|cloudflare|og-image\.jpg)/i.test(e));
  add('fa', 'CONSOLE-no-internal-errors', internalErrors.length === 0, internalErrors.slice(0,2).join(' | ') || 'clean');

  await browser.close();
}

/* ═══════════════════════════════════════════════════════════════════════
   MOBILE VIEWPORT — Stage 2 (B9). Проверка Phase 5 invariant: на ≤767px
   #lang-toggle visible (на месте contact icon), #contact-btn hidden,
   footer pill row остаётся 2 pills (не Phase-5-первая-версия с 3 pills).
═══════════════════════════════════════════════════════════════════════ */
async function testMobileViewport(BASE) {
  console.log(`\n=== Mobile 375×667 viewport invariants ===`);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  for (const url of ['/index.html', '/free-assets.html']) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => {
      const lt = document.getElementById('lang-toggle');
      const cb = document.getElementById('contact-btn');
      const lp = document.getElementById('lang-pill');
      const pills = document.querySelectorAll('.site-footer__row--pill .top-pill');
      return {
        langToggleVisible: lt ? window.getComputedStyle(lt).display !== 'none' : false,
        contactBtnHidden:  cb ? window.getComputedStyle(cb).display === 'none' : true,
        noLangPill:        !lp, // Phase 5 fix: removed the third footer pill.
        footerPillsCount:  pills.length,
      };
    });
    const scope = url.includes('free-assets') ? 'fa-mobile' : 'index-mobile';

    // B9 — Phase 5 invariant: lang-toggle stays in header on mobile, contact
    // icon hidden, no orphan #lang-pill in footer (would mean Phase 5 first
    // version slipped back in), footer pill row keeps exactly 2 pills.
    add(scope, 'B9-lang-toggle-visible', state.langToggleVisible,
        `display!=none: ${state.langToggleVisible}`);
    add(scope, 'B9-contact-btn-hidden', state.contactBtnHidden,
        `display=none: ${state.contactBtnHidden}`);
    add(scope, 'B9-no-lang-pill', state.noLangPill,
        'no #lang-pill in DOM');
    add(scope, 'B9-footer-pills-count', state.footerPillsCount === 2,
        `count=${state.footerPillsCount} (expected 2)`);

    await page.close();
  }
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
  console.log('  Codex Studio GOLDEN regression');
  console.log('══════════════════════════════════════════════════════════════════');

  let fatalError = null;

  try {
    runStaticChecks();
    await testIndex(BASE);
    await testFreeAssets(BASE);
    await testMobileViewport(BASE);
  } catch (e) {
    fatalError = e;
    console.error('\nTEST ERROR:', e.message);
    console.error(e.stack);
    add('runtime', 'fatal-test-error', false, e.message);
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
  if (fatalError) {
    console.log('Fatal test error: verification aborted before all checks completed.');
  }
  process.exit(fail > 0 ? 1 : 0);
})();
