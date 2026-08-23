/* Self-test for iteration F/G/H generator semantics (visibility, layoutMode,
 * JSON-LD and sitemap derivation, free-assets catalog).
 *
 * For every scenario a fresh copy of content/ goes to a temp CONTENT_DIR and
 * the generator runs against it:
 *   - disable one case            → grid html, cards-data and locales drop it;
 *   - disable a whole category    → its filter checkbox AND its cases are gone;
 *   - layoutMode invalid value    → validation error (exit 1);
 *   - layoutMode 'manual'         → flag emitted into cards-data entry;
 *   - all cases disabled          → "at least one case visible" guard fires;
 *   - 'all' filter disabled       → validation error;
 *   - disable a featured case     → its JSON-LD ListItem is gone, positions
 *                                   renumbered (no SEO ghosts, iteration G);
 *   - cache-busted ogImages       → Organization logo, FA thumbnails and
 *                                   sitemap image:loc follow content;
 *   - cross-page ogImages swap    → validation error (the per-page basename
 *                                   convention pinned by verify-frozen.js,
 *                                   prod-review F1, finding D-03);
 *   - featuredWorks unknown id    → validation error;
 *   - disable one FA item         → fa-data, FA_LOCALES, JSON-LD ItemList and
 *                                   the fa-filters counts drop it (iteration H);
 *   - disable an FA category      → its checkbox, fa-data key and locales gone;
 *   - bad FA "enabled" type       → validation error (item AND category);
 *   - thumb null / custom base    → fa-data emits the convention verbatim,
 *                                   JSON-LD thumbnail falls back to the FA OG;
 *   - raster poster path          → fa-data, tag card and JSON-LD follow the
 *                                   full './assets/…' path and the tag-card
 *                                   thumb gains data-poster-kind="raster",
 *                                   while a vector catalog stays attribute-free
 *                                   (FA-POSTER-01);
 *   - bad poster path             → foreign extension, "..", missing file and
 *                                   non-"./assets/" values are all rejected;
 *   - all FA items disabled       → "at least one free asset" guard fires;
 *   - disable an FA category      → its tag-card leaves the fa-tag-cards
 *                                   overview region (XSS/visibility batch);
 *   - disable one FA item         → the category count badge (static text AND
 *                                   the faTag.*.count i18n value) drops by one;
 *   - title with <script>         → validateFreeAssets rejects "<"/">" (XSS).
 *
 * --write output goes to a temp CONTENT_OUT_DIR (the working tree is never
 * touched). Plain node test — no Playwright. Wired into test:content-validate.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildReferenceSet, findOrphans, findPosterProblems } from '../../scripts/clean-orphan-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatorPath = path.join(root, 'scripts', 'generate-content.mjs');

function fail(message, output) {
  if (output) console.error(output);
  throw new Error(message);
}

// Every scenario asserts GENERATOR SEMANTICS (what disabling X does), so each
// sandbox copy starts from a fully visible baseline and then hides exactly the
// one thing under test. Without this the owner's live visibility choices decide
// whether the self-test can run at all: with 5 of 7 filters and 5 of 6 FA
// categories currently disabled in content/, "disable one case and count the
// rest" asserted 17 cards against a 3-card grid.
function showEverything(contentDir) {
  const readJson = (rel) => JSON.parse(readFileSync(path.join(contentDir, rel), 'utf8'));
  const writeJson = (rel, value) =>
    writeFileSync(path.join(contentDir, rel), JSON.stringify(value, null, 2) + '\n', 'utf8');

  const settings = readJson('settings.json');
  for (const filter of settings.filters || []) delete filter.enabled;
  writeJson('settings.json', settings);
  for (const id of settings.cardOrder || []) {
    const rel = path.join('cases', `${id}.json`);
    const data = readJson(rel);
    if (data.enabled === false) {
      data.enabled = true;
      writeJson(rel, data);
    }
  }
  const fa = readJson('free-assets.json');
  for (const category of fa.categories || []) {
    delete category.enabled;
    for (const item of category.items || []) delete item.enabled;
  }
  writeJson('free-assets.json', fa);
}

// Fresh sandbox per scenario: contentDir = copy of content/, outDir = empty.
function makeSandbox(name) {
  const contentDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-content-`));
  const outDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-out-`));
  cpSync(path.join(root, 'content'), contentDir, { recursive: true });
  showEverything(contentDir);
  return {
    contentDir,
    outDir,
    readJson(rel) {
      return JSON.parse(readFileSync(path.join(contentDir, rel), 'utf8'));
    },
    writeJson(rel, value) {
      writeFileSync(path.join(contentDir, rel), JSON.stringify(value, null, 2) + '\n', 'utf8');
    },
    readOut(rel) {
      return readFileSync(path.join(outDir, rel), 'utf8');
    },
    run(mode) {
      const result = spawnSync(process.execPath, [generatorPath, mode], {
        cwd: root,
        env: { ...process.env, CONTENT_DIR: contentDir, CONTENT_OUT_DIR: outDir },
        encoding: 'utf8'
      });
      return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
    },
    cleanup() {
      rmSync(contentDir, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  };
}

function caseIdsOfCategory(sandbox, key) {
  const settings = sandbox.readJson('settings.json');
  return settings.cardOrder.filter((id) => sandbox.readJson(path.join('cases', `${id}.json`)).category === key);
}

// CARDS_LOCALES + CASE_LOCALES slice of js/i18n-data.js. FA_LOCALES stays out:
// free-assets items legitimately share ids with cases (vega-shell etc.) and
// must NOT react to case visibility.
function caseLocalesSection(i18n) {
  const start = i18n.indexOf('const CARDS_LOCALES');
  const end = i18n.indexOf('const FA_LOCALES');
  if (start < 0 || end <= start) fail('i18n-data.js: locale sections not found');
  return i18n.slice(start, end);
}

function dataScriptRevision(html, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<script\\s+src=["'](?:\\.\\.?/)?js/${escaped}\\?v=([0-9a-f]{64})["']><\\/script>`, 'i').exec(html);
  if (!match) fail(`missing exact versioned ${fileName} data-script reference`, html);
  return match[1];
}

function dataScriptRevisions(sandbox) {
  const index = sandbox.readOut('index.html');
  const freeAssets = sandbox.readOut('free-assets.html');
  const admin = sandbox.readOut('admin/index.html');
  const digest = (rel) => createHash('sha256').update(sandbox.readOut(rel), 'utf8').digest('hex');
  const revisions = {
    cards: digest('js/cards-data.js'),
    fa: digest('js/fa-data.js'),
    i18n: digest('js/i18n-data.js')
  };
  const references = {
    index: {
      cards: dataScriptRevision(index, 'cards-data.js'),
      i18n: dataScriptRevision(index, 'i18n-data.js')
    },
    freeAssets: {
      fa: dataScriptRevision(freeAssets, 'fa-data.js'),
      i18n: dataScriptRevision(freeAssets, 'i18n-data.js')
    },
    admin: {
      cards: dataScriptRevision(admin, 'cards-data.js'),
      fa: dataScriptRevision(admin, 'fa-data.js'),
      i18n: dataScriptRevision(admin, 'i18n-data.js')
    }
  };
  for (const [shell, payloads] of Object.entries(references)) {
    for (const [payload, revision] of Object.entries(payloads)) {
      if (revision !== revisions[payload]) {
        fail(`${shell} ${payload}-data.js revision must equal the SHA-256 of its exact emitted JS bytes`);
      }
    }
  }
  if (references.index.i18n !== references.freeAssets.i18n || references.index.i18n !== references.admin.i18n) {
    fail('index, Free Assets and admin must use the same i18n-data revision');
  }
  return revisions;
}

/* 1 — disabling one case drops it from grid html, cards-data and locales */
{
  const sandbox = makeSandbox('case-off');
  try {
    const vega = sandbox.readJson('cases/vega-shell.json');
    vega.enabled = false;
    sandbox.writeJson('cases/vega-shell.json', vega);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with one case disabled', result.output);

    const grid = sandbox.readOut('index.html');
    if (grid.includes('data-id="vega-shell"')) fail('grid html must not contain the disabled case card');
    const expectedCards = sandbox.readJson('settings.json').cardOrder.length - 1;
    const actualCards = (grid.match(/class="work-card"/g) || []).length;
    if (actualCards !== expectedCards) {
      fail(`grid must keep the other ${expectedCards} cards (got ${actualCards})`);
    }

    const cardsData = sandbox.readOut('js/cards-data.js');
    if (cardsData.includes("'vega-shell'")) fail('cards-data must not contain the disabled case entry');

    const locales = caseLocalesSection(sandbox.readOut('js/i18n-data.js'));
    if (locales.includes("'vega-shell'")) fail('case locales must not contain the disabled case');
    // count drop: the disabled case is gone from all four dictionaries
    // (CARDS en/ru + CASE en/ru) while enabled cases keep all four entries.
    const enabledEntries = (locales.match(/'orbital-mk-ii'/g) || []).length;
    if (enabledEntries !== 4) fail(`enabled cases must keep 4 locale entries (got ${enabledEntries})`);
    console.log('case disable: card, cards-data entry and locales dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 2 — disabling a category removes its filter checkbox and all its cases */
{
  const sandbox = makeSandbox('category-off');
  try {
    const cadIds = caseIdsOfCategory(sandbox, 'cad');
    if (cadIds.length === 0) fail('sanity: the cad category must have cases');
    const settings = sandbox.readJson('settings.json');
    settings.filters.find((f) => f.key === 'cad').enabled = false;
    sandbox.writeJson('settings.json', settings);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with a category disabled', result.output);

    const grid = sandbox.readOut('index.html');
    if (grid.includes('data-filter="cad"')) fail('filters region must not contain the disabled category checkbox');
    if (!grid.includes('data-filter="organic"')) fail('enabled filter checkboxes must stay');
    for (const id of cadIds) {
      if (grid.includes(`data-id="${id}"`)) fail(`grid must not contain ${id} (its category is disabled)`);
    }

    const cardsData = sandbox.readOut('js/cards-data.js');
    const locales = caseLocalesSection(sandbox.readOut('js/i18n-data.js'));
    for (const id of cadIds) {
      if (cardsData.includes(`'${id}'`)) fail(`cards-data must not contain ${id}`);
      if (locales.includes(`'${id}'`)) fail(`case locales must not contain ${id}`);
    }
    console.log('category disable: checkbox and all category cases dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 3 — invalid layoutMode value is a validation error */
{
  const sandbox = makeSandbox('layout-invalid');
  try {
    const lumen = sandbox.readJson('cases/lumen-one.json');
    lumen.layoutMode = 'random';
    sandbox.writeJson('cases/lumen-one.json', lumen);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on an invalid layoutMode', result.output);
    if (!result.output.includes('layoutMode must be "seeded" or "manual"')) {
      fail('expected the layoutMode enum violation in the output', result.output);
    }
    console.log('layoutMode enum: invalid value rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 4 — layoutMode 'manual' travels into the cards-data entry */
{
  const sandbox = makeSandbox('layout-manual');
  try {
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.layoutMode = 'manual';
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with layoutMode manual', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    const orbitalEntry = cardsData.slice(cardsData.indexOf("'orbital-mk-ii'"), cardsData.indexOf("'vega-shell'"));
    if (!orbitalEntry.includes("layoutMode: 'manual'")) {
      fail('the manual case entry must carry layoutMode in cards-data');
    }
    // Сколько manual-кейсов ждать — считаем из содержимого песочницы, а не из
    // допущения «manual только тот, что выставил тест»: владелец переводит кейсы
    // в ручной порядок штатно (это условие структурных операций со слотами).
    const expectedManual = readdirSync(path.join(sandbox.contentDir, 'cases'))
      .filter((name) => name.endsWith('.json'))
      .filter(
        (name) =>
          JSON.parse(readFileSync(path.join(sandbox.contentDir, 'cases', name), 'utf8')).layoutMode === 'manual'
      ).length;
    if ((cardsData.match(/layoutMode/g) || []).length !== expectedManual) {
      fail(`seeded cases must not carry the layoutMode flag (expected ${expectedManual} manual case(s))`);
    }
    console.log('layoutMode manual: flag emitted into cards-data');
  } finally {
    sandbox.cleanup();
  }
}

/* 5 — disabling every case trips the "at least one visible" guard */
{
  const sandbox = makeSandbox('all-off');
  try {
    for (const id of sandbox.readJson('settings.json').cardOrder) {
      const data = sandbox.readJson(path.join('cases', `${id}.json`));
      data.enabled = false;
      sandbox.writeJson(path.join('cases', `${id}.json`), data);
    }
    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail when every case is hidden', result.output);
    if (!result.output.includes('at least one case must stay visible')) {
      fail('expected the empty-grid guard violation in the output', result.output);
    }
    console.log('empty-grid guard: zero visible cases rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 6 — the 'all' filter cannot be disabled */
{
  const sandbox = makeSandbox('all-filter');
  try {
    const settings = sandbox.readJson('settings.json');
    settings.filters.find((f) => f.key === 'all').enabled = false;
    sandbox.writeJson('settings.json', settings);

    const result = sandbox.run('--check');
    if (result.status === 0) fail("--check must fail when the 'all' filter is disabled", result.output);
    if (!result.output.includes('"all" filter cannot be disabled')) {
      fail("expected the 'all' filter violation in the output", result.output);
    }
    console.log("'all' filter guard: disable attempt rejected");
  } finally {
    sandbox.cleanup();
  }
}

/* 7 — disabling a featured case drops its JSON-LD ListItem (iteration G) */
{
  const sandbox = makeSandbox('jsonld-featured-off');
  try {
    const featured = sandbox.readJson('meta.json').structuredData.featuredWorks;
    if (featured.length < 2) fail('sanity: at least two featured works expected');
    const hiddenId = featured[featured.length - 1].id; // nightshard today
    const data = sandbox.readJson(path.join('cases', `${hiddenId}.json`));
    data.enabled = false;
    sandbox.writeJson(path.join('cases', `${hiddenId}.json`), data);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with a featured case disabled', result.output);

    const html = sandbox.readOut('index.html');
    if (html.includes(`https://codex.promo/#${hiddenId}`)) {
      fail('the JSON-LD ItemList must not advertise the hidden case');
    }
    const positions = (html.match(/"position": \d+/g) || []).map((m) => Number(m.slice(12)));
    const expected = Array.from({ length: featured.length - 1 }, (_v, i) => i + 1);
    if (positions.join(',') !== expected.join(',')) {
      fail(`ListItem positions must be renumbered 1..${expected.length} (got ${positions.join(',')})`);
    }
    console.log('jsonld: hidden featured case dropped, positions renumbered');
  } finally {
    sandbox.cleanup();
  }
}

/* 8 — Organization logo, FA thumbnails and sitemap images follow ogImages.
 *     Uses cache-busted variants of each page's OWN basename family — the
 *     old cross-page swap is a convention violation since prod-review F1
 *     (finding D-03), asserted separately in scenario 8b below. */
{
  const sandbox = makeSandbox('jsonld-og-cachebust');
  const bustedIndex = path.join(root, 'assets', 'img', 'og-image-aaaaaaaa.jpg');
  const bustedFa = path.join(root, 'assets', 'img', 'og-free-assets-aaaaaaaa.jpg');
  try {
    // The validator checks files on disk: simulate the admin cache-bust
    // upload by copying the real images next to themselves.
    cpSync(path.join(root, 'assets', 'img', 'og-image.jpg'), bustedIndex);
    cpSync(path.join(root, 'assets', 'img', 'og-free-assets.jpg'), bustedFa);
    const meta = sandbox.readJson('meta.json');
    meta.ogImages = {
      index: './assets/img/og-image-aaaaaaaa.jpg',
      fa: './assets/img/og-free-assets-aaaaaaaa.jpg',
      orgLogo: './assets/favicon/apple-touch-icon.png'
    };
    sandbox.writeJson('meta.json', meta);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed after a cache-busted ogImages update', result.output);

    const html = sandbox.readOut('index.html');
    // E-06: Organization.logo follows ogImages.orgLogo (a dedicated square brand
    // asset), NOT the cache-busted index OG image.
    if (!html.includes('"logo": "https://codex.promo/assets/favicon/apple-touch-icon.png"')) {
      fail('the Organization logo must follow ogImages.orgLogo');
    }
    const fa = sandbox.readOut('free-assets.html');
    if (!fa.includes('"primaryImageOfPage": "https://codex.promo/assets/img/og-free-assets-aaaaaaaa.jpg"')) {
      fail('the FA WebPage primary image must follow ogImages.fa');
    }
    // E-05: a thumb-less curated entry no longer borrows the page OG image as a
    // dishonest thumbnail, so the cache-busted FA OG must NOT appear as any
    // thumbnailUrl (it stays the WebPage primaryImageOfPage, asserted above).
    if (fa.includes('"thumbnailUrl": "https://codex.promo/assets/img/og-free-assets-aaaaaaaa.jpg"')) {
      fail('a thumb-less FA ItemList entry must NOT fall back to the OG image as its thumbnailUrl');
    }
    const sitemap = sandbox.readOut('sitemap.xml');
    if (!sitemap.includes('<image:loc>https://codex.promo/assets/img/og-image-aaaaaaaa.jpg</image:loc>')) {
      fail('the sitemap index image must follow ogImages.index');
    }
    if (!sitemap.includes('<image:loc>https://codex.promo/assets/img/og-free-assets-aaaaaaaa.jpg</image:loc>')) {
      fail('the sitemap FA image must follow ogImages.fa');
    }
    console.log('jsonld/sitemap: image fields follow meta.json ogImages (cache-busted)');
  } finally {
    rmSync(bustedIndex, { force: true });
    rmSync(bustedFa, { force: true });
    sandbox.cleanup();
  }
}

/* 8b — a cross-page ogImages swap violates the per-page basename convention
 *      pinned by verify-frozen.js (META-og-image-*-specific): caught as a
 *      validation error at publish time instead of a verify FAIL with
 *      auto-revert (prod-review F1, finding D-03). */
{
  const sandbox = makeSandbox('jsonld-og-swap-rejected');
  try {
    const meta = sandbox.readJson('meta.json');
    meta.ogImages = { index: './assets/img/og-free-assets.jpg', fa: './assets/img/og-image.jpg' };
    sandbox.writeJson('meta.json', meta);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on a cross-page ogImages swap', result.output);
    if (!result.output.includes('naming convention pinned by verify-frozen.js')) {
      fail('expected the og basename convention violation in the output', result.output);
    }
    console.log('og basename guard: cross-page swap rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 9 — featuredWorks pointing at a nonexistent case is a validation error */
{
  const sandbox = makeSandbox('jsonld-bad-featured');
  try {
    const meta = sandbox.readJson('meta.json');
    meta.structuredData.featuredWorks.push({ id: 'no-such-case', about: 'Ghost entry' });
    sandbox.writeJson('meta.json', meta);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on a featuredWorks id without a case', result.output);
    if (!result.output.includes('"id" must match an existing case')) {
      fail('expected the featuredWorks id violation in the output', result.output);
    }
    console.log('featuredWorks guard: unknown case id rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* ── iteration H: free-assets visibility and media conventions ──────────── */

// FA_LOCALES slice of js/i18n-data.js (free-assets items share ids with
// cases, so FA assertions must not look at the case dictionaries).
function faLocalesSection(i18n) {
  const start = i18n.indexOf('const FA_LOCALES');
  if (start < 0) fail('i18n-data.js: FA_LOCALES section not found');
  return i18n.slice(start);
}

// The fa-filters GEN region slice of free-assets.html.
function faFiltersSection(html) {
  const start = html.indexOf('<!-- CODEX:GEN fa-filters BEGIN -->');
  const end = html.indexOf('<!-- CODEX:GEN fa-filters END -->');
  if (start < 0 || end <= start) fail('free-assets.html: fa-filters GEN region not found');
  return html.slice(start, end);
}

// The fa-tag-cards GEN region slice of free-assets.html (overview tag cards).
function faTagCardsSection(html) {
  const start = html.indexOf('<!-- CODEX:GEN fa-tag-cards BEGIN -->');
  const end = html.indexOf('<!-- CODEX:GEN fa-tag-cards END -->');
  if (start < 0 || end <= start) fail('free-assets.html: fa-tag-cards GEN region not found');
  return html.slice(start, end);
}

/* 10 — disabling one FA item drops it from fa-data, locales, JSON-LD, counts */
{
  const sandbox = makeSandbox('fa-item-off');
  try {
    const fa = sandbox.readJson('free-assets.json');
    const hardSurface = fa.categories.find((c) => c.key === 'hard-surface');
    const before = hardSurface.items.length;
    const total = fa.categories.reduce((sum, c) => sum + c.items.length, 0);
    // bolt-cluster is FA-only (no case shares the id) — locale check is exact.
    hardSurface.items.find((item) => item.id === 'bolt-cluster').enabled = false;
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with one FA item disabled', result.output);

    const faData = sandbox.readOut('js/fa-data.js');
    if (faData.includes("'bolt-cluster'")) fail('fa-data must not contain the disabled item');
    const locales = faLocalesSection(sandbox.readOut('js/i18n-data.js'));
    if (locales.includes("'bolt-cluster'")) fail('FA locales must not contain the disabled item');

    const html = sandbox.readOut('free-assets.html');
    if (html.includes('#bolt-cluster')) fail('the FA JSON-LD must not advertise the hidden item');
    if (!html.includes(`"numberOfItems": ${total - 1},`)) {
      fail(`numberOfItems must drop to ${total - 1} (visible items only)`);
    }
    const positions = (html.match(/"position": \d+/g) || []).map((m) => Number(m.slice(12)));
    const expected = Array.from({ length: positions.length }, (_v, i) => i + 1);
    if (positions.length === 0 || positions.join(',') !== expected.join(',')) {
      fail(`FA ListItem positions must be renumbered 1..${positions.length} (got ${positions.join(',')})`);
    }
    const filters = faFiltersSection(html);
    if (!filters.includes(`id="opt-count-hard-surface">${before - 1}<`)) {
      fail(`the hard-surface checkbox count must drop to ${before - 1}`);
    }
    console.log('FA item disable: fa-data, locales, JSON-LD and counts dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 11 — disabling an FA category removes its checkbox, fa-data key, locales */
{
  const sandbox = makeSandbox('fa-category-off');
  try {
    const fa = sandbox.readJson('free-assets.json');
    const animation = fa.categories.find((c) => c.key === 'animation');
    const animationIds = animation.items.map((item) => item.id);
    const total = fa.categories.reduce((sum, c) => sum + c.items.length, 0);
    animation.enabled = false;
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with an FA category disabled', result.output);

    const html = sandbox.readOut('free-assets.html');
    const filters = faFiltersSection(html);
    if (filters.includes('data-filter="animation"')) {
      fail('the fa-filters region must not contain the disabled category checkbox');
    }
    if (!filters.includes('data-filter="organic"')) fail('enabled FA category checkboxes must stay');
    if (!filters.includes(`id="opt-count-all">${fa.categories.length - 1}<`)) {
      fail('the "all" option must count only visible categories');
    }
    if (!html.includes(`"numberOfItems": ${total - animationIds.length},`)) {
      fail('numberOfItems must exclude the disabled category items');
    }

    const faData = sandbox.readOut('js/fa-data.js');
    if (faData.includes('animation:')) fail('fa-data must not contain the disabled category key');
    const locales = faLocalesSection(sandbox.readOut('js/i18n-data.js'));
    for (const id of animationIds) {
      if (locales.includes(`'${id}'`)) fail(`FA locales must not contain ${id} (its category is disabled)`);
    }
    console.log('FA category disable: checkbox, fa-data key and locales dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 12 — a non-boolean FA "enabled" (item or category) is a validation error */
{
  const sandbox = makeSandbox('fa-enabled-type');
  try {
    const fa = sandbox.readJson('free-assets.json');
    fa.categories[0].enabled = 'yes';
    fa.categories[0].items[0].enabled = 'no';
    fa.categories[1].items[0].thumb = 'foo/bar';
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on non-boolean FA enabled', result.output);
    if (!result.output.includes('category "hard-surface" "enabled" must be a boolean')) {
      fail('expected the category enabled violation in the output', result.output);
    }
    if (!result.output.includes('orbital-mk-ii: "enabled" must be a boolean')) {
      fail('expected the item enabled violation in the output', result.output);
    }
    if (!result.output.includes('must be a plain base name')) {
      fail('expected the thumb base-name violation in the output', result.output);
    }
    console.log('FA enabled guard: non-boolean values and bad base names rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 13 — thumb null / custom base names emit verbatim; JSON-LD thumb falls back */
{
  const sandbox = makeSandbox('fa-media-conventions');
  try {
    const fa = sandbox.readJson('free-assets.json');
    const hardSurface = fa.categories.find((c) => c.key === 'hard-surface');
    // orbital-mk-ii: disable the poster (null convention).
    hardSurface.items.find((item) => item.id === 'orbital-mk-ii').thumb = null;
    // bolt-cluster: custom model base (points at an existing on-disk GLB).
    hardSurface.items.find((item) => item.id === 'bolt-cluster').model = 'orbital-mk-ii';
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with thumb:null and a custom model base', result.output);

    const faData = sandbox.readOut('js/fa-data.js');
    const orbitalEntry = faData.slice(faData.indexOf("'orbital-mk-ii'"), faData.indexOf("'vega-shell'"));
    if (!orbitalEntry.includes('thumb: null')) fail('fa-data must emit thumb: null verbatim');
    const boltEntry = faData.slice(faData.indexOf("'bolt-cluster'"), faData.indexOf("'terra-base'"));
    if (!boltEntry.includes("model: 'orbital-mk-ii'")) fail('fa-data must emit the custom model base verbatim');

    // E-05: JSON-LD honesty — a thumb:null item carries NO thumbnailUrl at all
    // (no dishonest fallback to the page OG image).
    const html = sandbox.readOut('free-assets.html');
    const jsonLdOrbital = html.slice(html.indexOf('#orbital-mk-ii'), html.indexOf('#vega-shell'));
    if (jsonLdOrbital.includes('"thumbnailUrl"')) {
      fail('the JSON-LD entry of a thumb:null item must omit thumbnailUrl entirely');
    }
    console.log('FA media conventions: null and custom base names emitted correctly');
  } finally {
    sandbox.cleanup();
  }
}

/* 14 — disabling every FA item trips the "at least one free asset" guard */
{
  const sandbox = makeSandbox('fa-all-off');
  try {
    const fa = sandbox.readJson('free-assets.json');
    for (const category of fa.categories) {
      for (const item of category.items) item.enabled = false;
    }
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail when every FA item is hidden', result.output);
    if (!result.output.includes('at least one free asset must stay visible')) {
      fail('expected the empty-catalog guard violation in the output', result.output);
    }
    console.log('empty-catalog guard: zero visible free assets rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 15 — disabling a category drops its tag-card from the fa-tag-cards region */
{
  const sandbox = makeSandbox('fa-tag-card-off');
  try {
    const fa = sandbox.readJson('free-assets.json');
    const animation = fa.categories.find((c) => c.key === 'animation');
    if (!animation) fail('sanity: the animation FA category must exist');
    animation.enabled = false;
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with an FA category disabled', result.output);

    const tagCards = faTagCardsSection(sandbox.readOut('free-assets.html'));
    if (tagCards.includes('id="tag-animation"') || tagCards.includes('data-tag="animation"')) {
      fail('the fa-tag-cards region must not contain the disabled category tag card');
    }
    if (!tagCards.includes('data-tag="organic"')) {
      fail('enabled category tag cards must stay in the fa-tag-cards region');
    }
    // The new first visible category keeps the tag-card--active class (and only
    // one card is active) so firstAvailableTag still lands on a real category.
    const activeCount = (tagCards.match(/tag-card--active/g) || []).length;
    if (activeCount !== 1) fail(`exactly one tag card must stay active (got ${activeCount})`);
    console.log('FA tag-card disable: category card dropped from the overview region');
  } finally {
    sandbox.cleanup();
  }
}

/* 16 — the count badge reflects the visible item count after hiding one item */
{
  const sandbox = makeSandbox('fa-tag-card-count');
  try {
    const fa = sandbox.readJson('free-assets.json');
    const hardSurface = fa.categories.find((c) => c.key === 'hard-surface');
    const before = hardSurface.items.length;
    hardSurface.items.find((item) => item.id === 'bolt-cluster').enabled = false;
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with one FA item disabled', result.output);

    const tagCards = faTagCardsSection(sandbox.readOut('free-assets.html'));
    // The static text node of the count badge must follow the visible count.
    if (!tagCards.includes(`data-i18n="faTag.hardSurface.count">${before - 1} assets<`)) {
      fail(`the hard-surface count badge text must drop to "${before - 1} assets"`);
    }
    // And the i18n dictionary value must agree (both locales) so the runtime
    // re-render does not revert the badge to a stale hand-maintained string.
    const i18n = sandbox.readOut('js/i18n-data.js');
    const matches = (i18n.match(new RegExp(`count: '${before - 1} assets'`, 'g')) || []).length;
    if (matches < 2) {
      fail(`the faTag.hardSurface.count dictionary value must be "${before - 1} assets" in EN and RU (got ${matches})`);
    }
    console.log('FA tag-card count: badge text and i18n dictionary follow the visible count');
  } finally {
    sandbox.cleanup();
  }
}

/* 17 — validateFreeAssets rejects a title containing markup (stored-XSS guard) */
{
  const sandbox = makeSandbox('fa-title-xss');
  try {
    const fa = sandbox.readJson('free-assets.json');
    fa.categories[0].items[0].title = 'Pwned <script>alert(1)</script>';
    sandbox.writeJson('free-assets.json', fa);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on a title containing "<"/">"', result.output);
    if (!result.output.includes('"title" must not contain "<" or ">"')) {
      fail('expected the title angle-bracket violation in the output', result.output);
    }
    console.log('FA XSS guard: title with <script> rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* (header logo) — admin-editable site header logo: a set src emits an
 *      <img class="logo__img"> (all five D3 attrs) on both pages and both case-bars;
 *      a null src keeps the byte-identical "CODEX" text wordmark in all four spots. */
{
  const sandbox = makeSandbox('header-logo');
  try {
    const meta = sandbox.readJson('meta.json');

    // src set → 2 logo <img> per page (sidebar + mobile case-bar), no text wordmark.
    meta.headerLogo = { src: './assets/favicon/apple-touch-icon.png' };
    sandbox.writeJson('meta.json', meta);
    const set = sandbox.run('--write');
    if (set.status !== 0) fail('header logo: generator must accept a valid headerLogo.src', set.output);
    const imgRe = /<img class="logo__img" src="[^"]+" alt="CODEX" width="120" height="24" loading="eager" decoding="async">/g;
    for (const page of ['index.html', 'free-assets.html']) {
      const html = sandbox.readOut(page);
      const imgs = html.match(imgRe) || [];
      if (imgs.length !== 2) fail(`header logo: ${page} must emit 2 logo <img> (sidebar + mobile), got ${imgs.length}`, html);
      if (/<span class="logo__text">CODEX<\/span>/.test(html)) fail(`header logo: ${page} kept the text wordmark while a logo image is set`, html);
    }

    // src null → byte-identical "CODEX" wordmark in all four spots, no logo <img>.
    meta.headerLogo = { src: null };
    sandbox.writeJson('meta.json', meta);
    const unset = sandbox.run('--write');
    if (unset.status !== 0) fail('header logo: generator must accept null headerLogo.src', unset.output);
    for (const page of ['index.html', 'free-assets.html']) {
      const html = sandbox.readOut(page);
      const spans = html.match(/<span class="logo__text">CODEX<\/span>/g) || [];
      if (spans.length !== 2) fail(`header logo: ${page} must restore 2 "CODEX" wordmarks when src is null, got ${spans.length}`, html);
      if (/<img class="logo__img" src=/.test(html)) fail(`header logo: ${page} emitted a logo <img> when src is null`, html);
    }
    console.log('header logo: set src emits <img class="logo__img"> on both pages; null restores the CODEX wordmark');
  } finally {
    sandbox.cleanup();
  }
}

/* 18 (F5) — orphan-asset audit: the reference set must cover every live naming
 *      convention so that live files are NEVER reported as orphans. */
{
  const referenceSet = buildReferenceSet();
  const liveFiles = [
    './assets/models/experimental/dino.glb',   // case modelSrc (experimental dir)
    './assets/models/free/orbital-mk-ii.glb',  // FA mini-3d model (faEffectiveBase)
    './assets/cards/orbital-mk-ii.svg',        // card / FA thumb
    './assets/cases/orbital-mk-ii/01.svg',     // case slide (explicit or default)
    './assets/cases/orbital-mk-ii/02.png',     // explicit case slide src
    './assets/img/og-image.jpg',               // meta ogImages.index
    './assets/favicon/apple-touch-icon.png'    // meta ogImages.orgLogo
  ];
  const missing = liveFiles.filter((p) => !referenceSet.has(p));
  if (missing.length) fail('orphan audit: live files missing from the reference set (would be FALSE orphans): ' + missing.join(', '));

  // FA-POSTER-01: the reference the audit stores must be the path the file
  // actually has. Against the live repo an FA poster is ALSO referenced by a
  // portfolio card or by the scanned HTML, so a broken poster resolver would
  // still look green here — hence a throwaway root whose ONLY reference to the
  // PNG is the FA poster value.
  {
    const posterRoot = mkdtempSync(path.join(tmpdir(), 'codex-orphan-poster-'));
    try {
      const write = (relPath, body) => {
        mkdirSync(path.join(posterRoot, path.dirname(relPath)), { recursive: true });
        writeFileSync(path.join(posterRoot, relPath), body);
      };
      write('content/settings.json', JSON.stringify({ filters: [], cardOrder: [] }));
      write('content/meta.json', JSON.stringify({ ogImages: {} }));
      write('assets/cards/fa-only-poster.png', 'png');
      write('assets/cards/solo-cover.svg', 'svg');
      write('assets/cards/nothing-points-here.png', 'png');
      const faOf = (thumb) =>
        JSON.stringify({
          categories: [
            { key: 'solo', tagCard: { thumb: 'solo-cover' }, items: [{ id: 'only', thumb, model: null }] }
          ]
        });

      write('content/free-assets.json', faOf('./assets/cards/fa-only-poster.png'));
      const posterOrphans = findOrphans(buildReferenceSet(posterRoot), posterRoot).map((o) => o.path);
      if (posterOrphans.includes('./assets/cards/fa-only-poster.png')) {
        fail('orphan audit: a poster referenced ONLY by an FA item was reported as an orphan — --delete would eat it');
      }
      if (posterOrphans.includes('./assets/cards/solo-cover.svg')) {
        fail('orphan audit: a category cover was reported as an orphan');
      }
      // Positive control: the audit still finds a genuinely unreferenced file.
      if (!posterOrphans.includes('./assets/cards/nothing-points-here.png')) {
        fail('orphan audit: the throwaway root must still report its genuinely unreferenced file', posterOrphans.join(', '));
      }
      if (findPosterProblems(posterRoot).length !== 0) {
        fail('orphan audit: a canonical poster value must not be reported as a problem');
      }

      // A non-canonical value cannot be resolved, so the reference set is
      // INCOMPLETE — the audit has to say so, because `--delete` would
      // otherwise remove the live file the value meant to point at.
      write('content/free-assets.json', faOf('./assets/cards//fa-only-poster.png'));
      const problems = findPosterProblems(posterRoot);
      if (problems.length === 0) {
        fail('orphan audit: a non-canonical poster value must be reported so --delete refuses to run');
      }
      if (!problems.join(' ').includes('fa-only-poster')) {
        fail('orphan audit: the reported problem must name the offending value', problems.join(' | '));
      }
    } finally {
      rmSync(posterRoot, { recursive: true, force: true });
    }
  }

  const orphans = findOrphans(referenceSet);
  const orphanPaths = new Set(orphans.map((o) => o.path));
  const falseOrphans = liveFiles.filter((p) => orphanPaths.has(p));
  if (falseOrphans.length) fail('orphan audit: live files reported as orphans: ' + falseOrphans.join(', '));
  const protectedFlagged = orphans.filter((o) => /\.md$/i.test(o.path) || /site\.webmanifest$/i.test(o.path));
  if (protectedFlagged.length) fail('orphan audit: protected files reported as orphans: ' + protectedFlagged.map((o) => o.path).join(', '));
  console.log('orphan audit: reference set complete (no false orphans for live content)');
}

/* 19 — optional media captions: a block with BOTH pairs empty is valid content
 *      and travels into cards-data / CASE_LOCALES as empty strings, keeping the
 *      positional captions array intact (contract B4). */
{
  const sandbox = makeSandbox('caption-optional');
  try {
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    const secondLabel = orbital.case.media[1].caption.label.en;
    orbital.case.media[0].caption = { label: { en: '', ru: '' }, desc: { en: '', ru: '' } };
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must accept a media block with no caption at all', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    const entry = cardsData.slice(cardsData.indexOf("'orbital-mk-ii'"), cardsData.indexOf("'vega-shell'"));
    if (!/label: '',\n\s+desc: '',/.test(entry)) {
      fail('an uncaptioned block must emit empty label/desc into cards-data', entry);
    }
    // The other blocks keep their captions — emptying one is not contagious.
    if (!entry.includes(`label: '${secondLabel}'`)) fail('captioned blocks must keep their text', entry);

    // CASE_LOCALES stays positional: the empty block is entry [0], not a hole.
    const locales = caseLocalesSection(sandbox.readOut('js/i18n-data.js'));
    const caseEn = locales.slice(locales.indexOf('const CASE_LOCALES'));
    if (!/captions: \[\s*\{\s*label: '',\s*desc: ''\s*\}/.test(caseEn)) {
      fail('CASE_LOCALES must keep an empty positional captions entry for the uncaptioned block', caseEn.slice(0, 1200));
    }
    console.log('optional captions: empty pair accepted, emitted as empty strings, captions array stays positional');
  } finally {
    sandbox.cleanup();
  }
}

/* 20 — half-filled caption pair is still a validation error (bilingual honesty:
 *      a filled EN with an empty RU would show English to a Russian visitor). */
{
  const sandbox = makeSandbox('caption-half');
  try {
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.case.media[0].caption.desc = { en: 'Only English', ru: '' };
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on a half-filled caption pair', result.output);
    if (!result.output.includes('case.media[0].caption.desc: fill both "en" and "ru" or leave both empty')) {
      fail('expected the caption parity violation in the output', result.output);
    }
    console.log('optional captions: half-filled pair rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 21 (CASE-CTA-01) — case.cta reaches the runtime ONLY when switched on with a
 *      valid link; a switched-off link is kept in content but emits nothing. */
{
  const sandbox = makeSandbox('case-cta');
  try {
    const CTA_URL = 'https://www.behance.net/gallery/12345/orbital';
    // Сколько кнопок ждать — считаем из песочницы: владелец включает CTA на
    // своих кейсах штатно (ради этого фича и делалась), поэтому «ровно одна»
    // было бы утверждением о его контенте, а не о семантике генератора.
    const enabledElsewhere = readdirSync(path.join(sandbox.contentDir, 'cases'))
      .filter((name) => name.endsWith('.json') && name !== 'orbital-mk-ii.json' && name !== 'vega-shell.json')
      .filter((name) => {
        const cta = JSON.parse(readFileSync(path.join(sandbox.contentDir, 'cases', name), 'utf8')).case?.cta;
        return Boolean(cta && cta.enabled);
      }).length;
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.case.cta = { enabled: true, url: CTA_URL };
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);
    // A second case keeps the link switched off — the address survives in
    // content, the button does not reach cards-data.
    const vega = sandbox.readJson('cases/vega-shell.json');
    vega.case.cta = { enabled: false, url: 'https://www.artstation.com/artwork/vega' };
    sandbox.writeJson('cases/vega-shell.json', vega);

    const on = sandbox.run('--write');
    if (on.status !== 0) fail('--write must accept an enabled case.cta with a valid url', on.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    if (!cardsData.includes(`cta: {\n        url: '${CTA_URL}'`)) {
      fail('an enabled cta must travel into items.cta of cards-data', cardsData.slice(0, 400));
    }
    if ((cardsData.match(/cta: \{/g) || []).length !== enabledElsewhere + 1) {
      fail(`only enabled cases may carry a cta key in cards-data (expected ${enabledElsewhere + 1})`);
    }
    if (cardsData.includes('artstation.com/artwork/vega')) fail('a disabled cta must not reach the runtime payload');

    // Switching the same link off removes the key again (no ghost buttons):
    // остаются ровно те кнопки, что владелец включил на своих кейсах.
    orbital.case.cta.enabled = false;
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);
    const off = sandbox.run('--write');
    if (off.status !== 0) fail('--write must accept a disabled case.cta', off.output);
    const afterOff = (sandbox.readOut('js/cards-data.js').match(/cta: \{/g) || []).length;
    if (afterOff !== enabledElsewhere) {
      fail(`switching a link off must drop its cta key (expected ${enabledElsewhere}, got ${afterOff})`);
    }
    console.log('case.cta: enabled+valid emits items.cta, disabled emits nothing');
  } finally {
    sandbox.cleanup();
  }
}

/* 21b (CASE-CTA-01) — every allowlisted platform reaches the runtime, and the
 *      emitted address is the NORMALIZED one (parsed.href): js/main.js parses
 *      exactly the string the validator approved. */
{
  const sandbox = makeSandbox('case-cta-platforms');
  try {
    const platforms = [
      { id: 'orbital-mk-ii', url: 'https://www.artstation.com/artwork/codex' },
      { id: 'vega-shell', url: 'https://www.behance.net/gallery/12345/codex' },
      // No path: URL() normalizes it to a trailing slash — the runtime must be
      // handed that exact form, not the raw input.
      { id: 'nightshard', url: 'https://dprofile.ru' }
    ];
    const touched = new Set(platforms.map((platform) => `${platform.id}.json`));
    // Кнопки, включённые владельцем на прочих кейсах, — легитимная часть
    // ожидаемого количества (см. сценарий 21).
    const enabledElsewhere = readdirSync(path.join(sandbox.contentDir, 'cases'))
      .filter((name) => name.endsWith('.json') && !touched.has(name))
      .filter((name) => {
        const cta = JSON.parse(readFileSync(path.join(sandbox.contentDir, 'cases', name), 'utf8')).case?.cta;
        return Boolean(cta && cta.enabled);
      }).length;
    for (const platform of platforms) {
      const data = sandbox.readJson(`cases/${platform.id}.json`);
      data.case.cta = { enabled: true, url: platform.url };
      sandbox.writeJson(`cases/${platform.id}.json`, data);
    }

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must accept every allowlisted CTA platform', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    const expectedCtas = platforms.length + enabledElsewhere;
    if ((cardsData.match(/cta: \{/g) || []).length !== expectedCtas) {
      fail(`every enabled cta must reach cards-data (expected ${expectedCtas})`);
    }
    for (const platform of platforms) {
      const expected = new URL(platform.url).href;
      if (!cardsData.includes(`url: '${expected}'`)) {
        fail(`cards-data must carry the normalized address ${expected}`, cardsData.slice(0, 400));
      }
    }
    console.log('case.cta: artstation/behance/dprofile emitted, addresses normalized');
  } finally {
    sandbox.cleanup();
  }
}

/* 22 — seamless ("Behance trick"): the flag reaches the runtime only when set,
 *      and only a manual-order case may carry it. */
{
  const sandbox = makeSandbox('case-seamless');
  try {
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.layoutMode = 'manual';
    orbital.case.media[1].seamless = true;
    // A real chain: the strips share one format and only the LAST one keeps a
    // caption (a caption on the first strip would be drawn between the two
    // media boxes and split the canvas — the validator rejects it).
    orbital.case.media[1].format = orbital.case.media[0].format;
    orbital.case.media[0].caption = { label: { en: '', ru: '' }, desc: { en: '', ru: '' } };
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must accept seamless on a manual-order case', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    if ((cardsData.match(/seamless: true/g) || []).length !== 1) {
      fail('exactly the flagged block must carry seamless in cards-data');
    }
    // Byte safety: the flag is emitted ONLY when true — no `seamless: false`
    // key appears on the untouched blocks.
    if (cardsData.includes('seamless: false')) fail('an unset seamless flag must not be emitted at all');
    console.log('seamless: flag emitted only when switched on');
  } finally {
    sandbox.cleanup();
  }
}

/* 23 (FA-POSTER-01) — a RASTER poster (full './assets/…' path with its own
 *      extension) reaches fa-data verbatim, the overview tag card and the
 *      JSON-LD thumbnail, and marks the slot with data-poster-kind="raster";
 *      an all-vector catalog emits NO such attribute (byte identity). */
{
  // Any committed raster under assets/ works as the fixture — the validator
  // only requires a './assets/…' path with a poster extension. Prefer a real
  // card poster, fall back to any raster so the scenario is not hostage to the
  // owner's current uploads.
  const rasterPoster = (() => {
    const isRaster = (name) => /\.(?:png|jpe?g|webp)$/i.test(name);
    const cardsDir = path.join(root, 'assets', 'cards');
    const card = readdirSync(cardsDir).find(isRaster);
    if (card) return `./assets/cards/${card}`;
    const walkAssets = (dir) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, name.name);
        if (name.isDirectory()) {
          const nested = walkAssets(abs);
          if (nested) return nested;
        } else if (isRaster(name.name)) {
          return './' + path.relative(root, abs).split(path.sep).join('/');
        }
      }
      return null;
    };
    return walkAssets(path.join(root, 'assets'));
  })();
  // Deterministic VECTOR control (a base name, i.e. the historical convention),
  // authored into the sandbox rather than assumed of the owner's content.
  const vectorPoster = (() => {
    const svg = readdirSync(path.join(root, 'assets', 'cards')).find((name) => name.endsWith('.svg'));
    return svg ? svg.replace(/\.svg$/, '') : null;
  })();

  if (!rasterPoster || !vectorPoster) {
    console.log('SKIP raster poster: assets/cards needs both a raster and an SVG file to build the fixture pair');
  } else {
    const sandbox = makeSandbox('fa-raster-poster');
    try {
      // A baseline run tells us which ids the curated JSON-LD ItemList actually
      // carries — derived from content, never hardcoded.
      const baseline = sandbox.run('--write');
      if (baseline.status !== 0) fail('baseline --write must succeed', baseline.output);
      const baselineHtml = sandbox.readOut('free-assets.html');
      const curatedIds = [...baselineHtml.matchAll(/free-assets\.html#([A-Za-z0-9-]+)/g)].map((m) => m[1]);

      const fa = sandbox.readJson('free-assets.json');
      const pairs = fa.categories.flatMap((category) => category.items.map((item) => ({ category, item })));
      const target = pairs.find(({ item }) => curatedIds.includes(item.id)) || pairs[0];
      if (!target) fail('raster poster: the catalog has no items to test with');
      target.item.thumb = rasterPoster;
      target.category.tagCard = { ...(target.category.tagCard || {}), thumb: rasterPoster };
      // EXPLICIT vector control. Asserting "no data-poster-kind anywhere" would
      // have been a claim about the OWNER'S content: the first legitimate raster
      // cover published through the admin panel would then fail this mandatory
      // gate (test:content-validate runs inside codex:ship) before the raster
      // assertions below ever ran. The control is authored here instead.
      const otherCategory = fa.categories.find((c) => c.key !== target.category.key) || null;
      if (otherCategory) otherCategory.tagCard = { ...(otherCategory.tagCard || {}), thumb: vectorPoster };
      sandbox.writeJson('free-assets.json', fa);

      const result = sandbox.run('--write');
      if (result.status !== 0) fail('--write must accept a raster poster path', result.output);

      // 1. fa-data carries the path VERBATIM — the runtime resolver, not the
      //    generator, owns the extension.
      const faData = sandbox.readOut('js/fa-data.js');
      const emitted = (faData.match(new RegExp(`thumb: '${rasterPoster.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []);
      if (emitted.length !== 1) fail('fa-data must emit the raster poster path verbatim exactly once', faData.slice(0, 1200));

      // 2. the overview tag card requests the raster and marks the slot.
      const html = sandbox.readOut('free-assets.html');
      const tagBlock = (key) => {
        const start = html.indexOf(`id="tag-${key}"`);
        if (start < 0) return '';
        return html.slice(start, html.indexOf('</a>', start));
      };
      const targetTag = tagBlock(target.category.key);
      if (!targetTag) fail(`raster poster: no tag card emitted for category "${target.category.key}"`);
      if (!targetTag.includes(`src="${rasterPoster}"`)) {
        fail('the tag card must request the raster cover verbatim', targetTag);
      }
      if (!targetTag.includes('data-poster-kind="raster"')) {
        fail('a raster cover must mark the tag-card thumb with data-poster-kind="raster"', targetTag);
      }
      // The <img> contract verify-frozen pins (D3-img-required-attrs /
      // FA-cards-sprint-b-anatomy) survives the new attribute.
      for (const attr of ['alt=', 'width="800"', 'height="600"', 'decoding="async"', 'loading=']) {
        if (!targetTag.includes(attr)) fail(`the raster tag-card <img> lost ${attr}`, targetTag);
      }
      if (otherCategory) {
        const otherTag = tagBlock(otherCategory.key);
        if (otherTag && otherTag.includes('data-poster-kind')) {
          fail('a vector cover must stay attribute-free (its bytes must not move)', otherTag);
        }
      }

      // 3. JSON-LD advertises the raster thumbnail when the item is curated.
      if (curatedIds.includes(target.item.id)) {
        const entry = html.slice(html.indexOf(`#${target.item.id}`));
        const expected = `"thumbnailUrl": "https://codex.promo/${rasterPoster.replace(/^\.\//, '')}"`;
        if (!entry.slice(0, 1500).includes(expected)) {
          fail('the JSON-LD thumbnail must follow the raster poster path', entry.slice(0, 1500));
        }
      }
      console.log('FA raster poster: path emitted verbatim, tag card marked raster, vector covers untouched');
    } finally {
      sandbox.cleanup();
    }
  }
}

/* 24 (FA-POSTER-01) — poster paths are fenced AND canonical. The non-canonical
 *      spellings matter as much as the traversal ones: './assets/cards//x.png'
 *      used to pass validation (path.resolve normalizes it), render nothing at
 *      runtime, and enter the orphan reference set with the doubled slash — so
 *      `clean-orphan-assets --delete` would have removed a LIVE poster. */
{
  const sandbox = makeSandbox('fa-poster-guards');
  try {
    const cases = [
      { value: './assets/cards/nope.gif', expected: 'must end with one of' },
      { value: './assets/cards/../secrets.png', expected: 'no empty, "." or ".." segments' },
      { value: './assets/cards//poster.png', expected: 'no empty, "." or ".." segments' },
      { value: './assets/cards/./poster.png', expected: 'no empty, "." or ".." segments' },
      { value: './assets/cards/', expected: 'no empty, "." or ".." segments' },
      { value: '.\\assets\\cards\\poster.png', expected: 'must use forward slashes' },
      { value: './assets/cards/product render.png', expected: '[A-Za-z0-9._-] characters only' },
      { value: './assets/cards/definitely-missing-poster.png', expected: 'file not found on disk' },
      { value: 'covers/hero.png', expected: 'must be a plain base name' },
      { value: 'https://evil.example/hero.png', expected: 'must be a plain base name' }
    ];
    for (const { value, expected } of cases) {
      const fa = sandbox.readJson('free-assets.json');
      fa.categories[0].items[0].thumb = value;
      sandbox.writeJson('free-assets.json', fa);
      const result = sandbox.run('--check');
      if (result.status === 0) fail(`--check must reject the poster value ${JSON.stringify(value)}`, result.output);
      if (!result.output.includes(expected)) {
        fail(`expected "${expected}" for the poster value ${JSON.stringify(value)}`, result.output);
      }
    }
    // The same fence protects the category cover.
    const fa = sandbox.readJson('free-assets.json');
    delete fa.categories[0].items[0].thumb;
    fa.categories[0].tagCard = { ...(fa.categories[0].tagCard || {}), thumb: './assets/cards/nope.gif' };
    sandbox.writeJson('free-assets.json', fa);
    const coverResult = sandbox.run('--check');
    if (coverResult.status === 0) fail('--check must reject a category cover with a foreign extension', coverResult.output);
    if (!coverResult.output.includes('tagCard.thumb')) {
      fail('the category cover violation must name tagCard.thumb', coverResult.output);
    }
    console.log('FA poster guards: extension, traversal, non-canonical spellings and non-assets paths rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* case.blueprints[] (BP-DECISION-01/02) — the owner uploads the sheet, the
 * generator only forwards it. Byte safety: a case without the key emits nothing,
 * which is what keeps js/cards-data.js unchanged on day zero. */
{
  const sandbox = makeSandbox('case-blueprints');
  try {
    // Generator semantics must not depend on today's authored catalog. Build
    // an explicit no-blueprints baseline, then add one carrier below.
    const settings = sandbox.readJson('settings.json');
    for (const id of settings.cardOrder) {
      const projectPath = `cases/${id}.json`;
      const project = sandbox.readJson(projectPath);
      if (project.case && Object.hasOwn(project.case, 'blueprints')) {
        delete project.case.blueprints;
        sandbox.writeJson(projectPath, project);
      }
    }
    const clean = sandbox.run('--write');
    if (clean.status !== 0) fail('--write must succeed on pristine content', clean.output);
    if (sandbox.readOut('js/cards-data.js').includes('blueprints')) {
      fail('the explicit no-blueprints fixture must not emit the key in cards-data.js');
    }

    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.case.blueprints = [
      { id: 'section-aa', src: './assets/cases/orbital-mk-ii/01.svg', label: { en: 'Section A-A', ru: 'Разрез А-А' } },
      { src: './assets/cases/orbital-mk-ii/02.svg' }, // unlabelled — label is optional
      // The shape the ADMIN PANEL actually writes for an unlabelled sheet: the
      // pair exists with both locales empty. State.setValue cannot create
      // missing containers, so the form materialises `label` up front (exactly
      // as it does for a new media block's caption). That shape must be as
      // valid as an absent key, and must emit no label either.
      { src: './assets/cases/orbital-mk-ii/03.svg', label: { en: '', ru: '' } }
    ];
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must accept an authored blueprint sheet', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    // Assertions are scoped to the blueprints array: `label: ''` is a legitimate
    // emission for an uncaptioned MEDIA block, so a file-wide substring check
    // would pass (or fail) for the wrong reason.
    const blueprintBlock = /\n(\s*)blueprints: \[\n([\s\S]*?)\n\1\]/.exec(cardsData);
    if (!blueprintBlock) fail('the authored sheets must reach the runtime payload as items.blueprints');
    const sheets = blueprintBlock[2];
    if (!sheets.includes("src: './assets/cases/orbital-mk-ii/01.svg'")) {
      fail('the authored sheet path must reach the runtime payload');
    }
    if (!sheets.includes("src: './assets/cases/orbital-mk-ii/02.svg'")) {
      fail('the second authored sheet must travel too');
    }
    if (!sheets.includes("src: './assets/cases/orbital-mk-ii/03.svg'")) {
      fail('the admin-shaped sheet (empty label pair) must travel too');
    }
    if (!sheets.includes("id: 'section-aa'")) fail('an authored sheet id must travel');
    if (!sheets.includes("label: 'Section A-A'")) fail('the EN label must travel into cards-data');
    // An absent label emits NO key at all — same truthy-only rule as poster.
    // An empty PAIR (what the admin panel writes) must behave identically:
    // three sheets, one label key.
    if ((sheets.match(/label:/g) || []).length !== 1) {
      fail('an absent label — and an empty label pair — must emit no key at all');
    }
    // The RU label rides the locale overlay, not cards-data.
    if (cardsData.includes('Разрез')) fail('the RU label must not land in cards-data.js');
    const i18nData = sandbox.readOut('js/i18n-data.js');
    if (!i18nData.includes('Разрез А-А')) fail('the RU label must reach CASE_LOCALES in i18n-data.js');

    // Only THIS case gained the key; the others stay untouched.
    const carriers = (cardsData.match(/\bblueprints: \[/g) || []).length;
    if (carriers !== 1) fail(`exactly one case must carry blueprints (got ${carriers})`);
    console.log('case.blueprints: sheet path/id/EN label emitted, RU label in locales, absent key stays absent');
  } finally {
    sandbox.cleanup();
  }
}

/* Generated payloads are revisioned from their final JS bytes. A case title
 * affects cards + i18n but not Free Assets; a Free Assets description affects
 * FA + i18n but not cards. Every shell must reference those literal digests. */
{
  const sandbox = makeSandbox('payload-revisions');
  try {
    let result = sandbox.run('--write');
    if (result.status !== 0) fail('baseline --write must succeed for payload revisions', result.output);
    const baseline = dataScriptRevisions(sandbox);

    const caseData = sandbox.readJson('cases/orbital-mk-ii.json');
    caseData.case.text.title.en += ' revision probe';
    sandbox.writeJson('cases/orbital-mk-ii.json', caseData);
    result = sandbox.run('--write');
    if (result.status !== 0) fail('case-title --write must succeed for payload revisions', result.output);
    const afterCaseTitle = dataScriptRevisions(sandbox);
    if (afterCaseTitle.cards === baseline.cards || afterCaseTitle.i18n === baseline.i18n) {
      fail('a case title mutation must revise cards-data and i18n-data');
    }
    if (afterCaseTitle.fa !== baseline.fa) fail('a case title mutation must not revise fa-data');

    const fa = sandbox.readJson('free-assets.json');
    fa.categories[0].items[0].desc.en += ' revision probe';
    sandbox.writeJson('free-assets.json', fa);
    result = sandbox.run('--write');
    if (result.status !== 0) fail('Free Assets description --write must succeed for payload revisions', result.output);
    const afterFaDescription = dataScriptRevisions(sandbox);
    if (afterFaDescription.fa === afterCaseTitle.fa || afterFaDescription.i18n === afterCaseTitle.i18n) {
      fail('a Free Assets description mutation must revise fa-data and i18n-data');
    }
    if (afterFaDescription.cards !== afterCaseTitle.cards) {
      fail('a Free Assets description mutation must not revise cards-data');
    }
    console.log('payload revisions: exact JS SHA-256 references, per-payload invalidation and shared i18n revision verified');
  } finally {
    sandbox.cleanup();
  }
}

/* Custom public slugs change only public route surfaces: the stable filename,
 * cardOrder key and DOM data-id remain internal ids, while grid/JSON-LD/data
 * expose the canonical route and a legacy alias. */
{
  const sandbox = makeSandbox('case-slugs');
  try {
    const settings = sandbox.readJson('settings.json');
    const id = settings.cardOrder[0];
    const project = sandbox.readJson(`cases/${id}.json`);
    project.slug = 'public-' + id;
    project.legacySlugs = ['previous-' + id];
    sandbox.writeJson(`cases/${id}.json`, project);

    const meta = sandbox.readJson('meta.json');
    meta.structuredData.featuredWorks = [{ id, about: 'Slug contract fixture' }];
    sandbox.writeJson('meta.json', meta);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('custom canonical slug must validate and generate', result.output);
    const grid = sandbox.readOut('index.html');
    const cards = sandbox.readOut('js/cards-data.js');
    if (!grid.includes(`data-id="${id}"`) || !grid.includes(`href="#public-${id}"`)) {
      fail('grid must preserve data-id while using the canonical public slug', grid);
    }
    if (!cards.includes(`'${id}': {`) || !cards.includes(`slug: 'public-${id}'`) || !cards.includes(`legacySlugs: [`)) {
      fail('runtime data must retain the internal key and expose route metadata', cards);
    }
    if (!grid.includes(`https://codex.promo/#public-${id}`)) {
      fail('featured-work JSON-LD must use the canonical public slug', grid);
    }
    console.log('case slugs: internal ids stay stable while public routes use canonical metadata');
  } finally {
    sandbox.cleanup();
  }
}

/* Global identity and Free Assets structured data must follow editable content,
 * rather than fixed editorial mirrors. The synthetic visible item deliberately
 * reuses only validated local file facts and has no hard-coded id in runtime
 * code; a hidden peer proves visibility still controls crawler output. */
{
  const sandbox = makeSandbox('global-identity');
  try {
    const settings = sandbox.readJson('settings.json');
    const featuredId = settings.cardOrder[0];
    const meta = sandbox.readJson('meta.json');
    meta.contactUrl = 'https://example.test/contact';
    meta.structuredData.organization = {
      name: 'Fixture Studio',
      alternateName: 'Fixture',
      url: 'https://example.test/',
      description: { en: 'Fixture English description', ru: 'Описание фикстуры' },
      sameAs: ['https://example.test/community', 'https://example.test/profile']
    };
    meta.structuredData.featuredWorks = [{ id: featuredId, about: 'Fixture featured about' }];
    sandbox.writeJson('meta.json', meta);

    const freeAssets = sandbox.readJson('free-assets.json');
    const category = freeAssets.categories.find((candidate) =>
      candidate && candidate.enabled !== false && Array.isArray(candidate.items) &&
      candidate.items.some((item) => item && item.enabled !== false)
    );
    const source = category && category.items.find((item) => item && item.enabled !== false);
    if (!category || !source) fail('fixture requires a visible Free Assets category and item from content');
    const visibleProbe = {
      ...source,
      id: 'metadata-probe',
      thumb: null,
      model: null,
      title: 'Fixture visible asset',
      cat: 'Fixture category',
      desc: { en: 'Fixture visible description', ru: 'Видимое описание фикстуры' }
    };
    const hiddenProbe = {
      ...visibleProbe,
      id: 'hidden-metadata-probe',
      title: 'Hidden fixture asset',
      enabled: false
    };
    category.items.push(visibleProbe, hiddenProbe);
    sandbox.writeJson('free-assets.json', freeAssets);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed for a valid global-identity fixture', result.output);

    const readJsonLd = (html) => Array.from(html.matchAll(/<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi))
      .map((match) => JSON.parse(match[1]));
    const index = sandbox.readOut('index.html');
    const freeAssetsHtml = sandbox.readOut('free-assets.html');
    for (const html of [index, freeAssetsHtml]) {
      if (!html.includes('id="contact-btn"') || !html.includes('id="contact-pill"') ||
          (html.match(/href="https:\/\/example\.test\/contact"/g) || []).length !== 2) {
        fail('both generated contact anchors must follow content.meta.contactUrl', html);
      }
      const contactAnchors = Array.from(html.matchAll(/<a\b[^>]*id="contact-(?:btn|pill)"[^>]*>/g)).map((match) => match[0]);
      if (contactAnchors.length !== 2 || contactAnchors.some((anchor) => /telegram|contactTelegram/i.test(anchor))) {
        fail('non-Telegram contact fixtures must emit provider-neutral anchor copy and i18n keys', contactAnchors.join('\n'));
      }
      const organization = readJsonLd(html).find((node) => node['@type'] === 'Organization');
      if (!organization || organization.name !== 'Fixture Studio' || organization.alternateName !== 'Fixture' ||
          organization.url !== 'https://example.test/' || organization.description !== 'Fixture English description' ||
          organization.sameAs.join('|') !== 'https://example.test/community|https://example.test/profile') {
        fail('Organization JSON-LD must follow the editable content fixture', JSON.stringify(organization));
      }
    }
    const featuredList = readJsonLd(index).find((node) => node['@type'] === 'ItemList');
    if (!featuredList || featuredList.name !== 'Fixture Studio — Featured Works' || featuredList.itemListElement.length !== 1 ||
        featuredList.itemListElement[0].item.about !== 'Fixture featured about') {
      fail('featured works order and about must follow content.meta.structuredData');
    }
    const expectedFreeAssetIds = freeAssets.categories
      .filter((candidate) => candidate && candidate.enabled !== false)
      .flatMap((candidate) => Array.isArray(candidate.items) ? candidate.items : [])
      .filter((item) => item && item.enabled !== false)
      .map((item) => item.id);
    const assetList = readJsonLd(freeAssetsHtml).find((node) => node['@type'] === 'ItemList');
    const freeAssetsPage = readJsonLd(freeAssetsHtml).find((node) => node['@type'] === 'WebPage');
    const visible = assetList && assetList.itemListElement.find((entry) => entry.url.endsWith('#metadata-probe'));
    const hidden = assetList && assetList.itemListElement.find((entry) => entry.url.endsWith('#hidden-metadata-probe'));
    const actualFreeAssetIds = assetList && assetList.itemListElement.map((entry) => entry.url.split('#')[1]);
    const actualPositions = assetList && assetList.itemListElement.map((entry) => entry.position);
    if (!freeAssetsPage || freeAssetsPage.name !== 'Free 3D Assets — Fixture Studio' ||
        !assetList || assetList.name !== 'Fixture Studio — Free 3D asset catalog' || assetList.numberOfItems !== expectedFreeAssetIds.length ||
        JSON.stringify(actualFreeAssetIds) !== JSON.stringify(expectedFreeAssetIds) ||
        JSON.stringify(actualPositions) !== JSON.stringify(expectedFreeAssetIds.map((_id, index) => index + 1)) ||
        !visible || visible.item.name !== 'Fixture visible asset' || visible.item.description !== 'Fixture visible description' || hidden) {
      fail('Free Assets ItemList must include every visible authored item and omit hidden items');
    }
    console.log('global identity: contact, Organization, featured work and content-derived Free Assets JSON-LD verified');
  } finally {
    sandbox.cleanup();
  }
}

console.log('iteration F/G/H visibility/layoutMode/jsonld/free-assets generator semantics verified');
