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
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReferenceSet, findOrphans } from '../../scripts/clean-orphan-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatorPath = path.join(root, 'scripts', 'generate-content.mjs');

function fail(message, output) {
  if (output) console.error(output);
  throw new Error(message);
}

// Fresh sandbox per scenario: contentDir = copy of content/, outDir = empty.
function makeSandbox(name) {
  const contentDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-content-`));
  const outDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-out-`));
  cpSync(path.join(root, 'content'), contentDir, { recursive: true });
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
    if ((cardsData.match(/layoutMode/g) || []).length !== 1) {
      fail('seeded cases must not carry the layoutMode flag');
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

  const orphans = findOrphans(referenceSet);
  const orphanPaths = new Set(orphans.map((o) => o.path));
  const falseOrphans = liveFiles.filter((p) => orphanPaths.has(p));
  if (falseOrphans.length) fail('orphan audit: live files reported as orphans: ' + falseOrphans.join(', '));
  const protectedFlagged = orphans.filter((o) => /\.md$/i.test(o.path) || /site\.webmanifest$/i.test(o.path));
  if (protectedFlagged.length) fail('orphan audit: protected files reported as orphans: ' + protectedFlagged.map((o) => o.path).join(', '));
  console.log('orphan audit: reference set complete (no false orphans for live content)');
}

console.log('iteration F/G/H visibility/layoutMode/jsonld/free-assets generator semantics verified');
