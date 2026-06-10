/* generate-content.mjs — deterministic content generator (Iteration B).
 *
 * Reads the editable content layer:
 *   content/settings.json      — filter list, card order
 *   content/cases/{id}.json    — one file per portfolio case (18)
 *   content/free-assets.json   — free-assets catalog (en+ru)
 *   content/i18n-ui.json       — UI_STRINGS (en+ru)
 *   content/meta.json          — META_STRINGS (en+ru)
 *
 * and regenerates the shipped files:
 *   js/cards-data.js           — window.CARDS_DATA in the final expanded form
 *                                (the former makeItems() from js/main.js is
 *                                ported here: media[5] = 2 wide + 3 tall,
 *                                enabled:true, text/inline/motionBlocks)
 *   js/fa-data.js              — var FA_DATA (EN catalog)
 *   js/i18n-data.js            — dictionaries injected into
 *                                scripts/templates/i18n-data.tpl.js
 *   index.html                 — the cards grid between
 *                                <!-- CODEX:GEN cards-grid BEGIN/END --> markers,
 *                                the filter checkboxes between
 *                                <!-- CODEX:GEN filters BEGIN/END --> markers,
 *                                the owner-editable head meta between
 *                                <!-- CODEX:GEN head-meta BEGIN/END --> markers
 *                                and the JSON-LD blocks between
 *                                <!-- CODEX:GEN jsonld BEGIN/END --> markers
 *                                (Organization logo + featured-works ItemList
 *                                from meta.json structuredData ∩ visible cases)
 *   free-assets.html           — the head-meta and jsonld GEN regions
 *                                (Organization/WebPage/catalog ItemList images
 *                                and numberOfItems follow content/)
 *   sitemap.xml                — image:loc entries follow meta.json ogImages
 *
 * Visibility (iteration F): a case with enabled:false, and every case of a
 * filter with enabled:false in settings.json, is dropped from the grid,
 * cards-data and the locale dictionaries. A disabled filter also disappears
 * from the filters GEN region. The 'all' filter cannot be disabled and at
 * least one case must stay visible overall.
 *
 * Both modes first run validateContent() over the content layer and exit 1
 * with the full violation list if anything is broken (unique ids, cardOrder
 * bijection, EN/RU parity, media files on disk, assets/ traversal guard).
 *
 * Usage:
 *   node scripts/generate-content.mjs --write   # write targets to disk
 *   node scripts/generate-content.mjs --check   # exit 1 if any target differs
 *
 * Env: CONTENT_DIR     — override the content directory (negative self-test);
 *      CONTENT_OUT_DIR — write targets into this directory instead of the
 *                        repo root (tests only; templates are still read
 *                        from the repo root).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// CONTENT_DIR may be overridden (tests/quality/content-validate.test.mjs points
// --check at a deliberately broken copy of the content layer).
const CONTENT_DIR = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(ROOT, 'content');
// CONTENT_OUT_DIR (tests only): redirect the generated targets to a temp
// directory so node tests can inspect the output of an alternate content
// layer without touching the working tree.
const OUT_DIR = process.env.CONTENT_OUT_DIR ? path.resolve(process.env.CONTENT_OUT_DIR) : ROOT;
const ASSETS_DIR = path.join(ROOT, 'assets');
const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'i18n-data.tpl.js');

const GRID_BEGIN = '<!-- CODEX:GEN cards-grid BEGIN -->';
const GRID_END = '<!-- CODEX:GEN cards-grid END -->';
const HEAD_BEGIN = '<!-- CODEX:GEN head-meta BEGIN -->';
const HEAD_END = '<!-- CODEX:GEN head-meta END -->';
const FILTERS_BEGIN = '<!-- CODEX:GEN filters BEGIN -->';
const FILTERS_END = '<!-- CODEX:GEN filters END -->';
const JSONLD_BEGIN = '<!-- CODEX:GEN jsonld BEGIN -->';
const JSONLD_END = '<!-- CODEX:GEN jsonld END -->';

/* ── content loading ─────────────────────────────────────────────────────── */

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, relPath), 'utf8'));
}

function loadContent() {
  const settings = readJson('settings.json');
  // Read every case file (not just cardOrder entries) so validateContent()
  // can detect orphans in both directions.
  const caseEntries = fs
    .readdirSync(path.join(CONTENT_DIR, 'cases'))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((file) => ({ file, data: readJson(path.join('cases', file)) }));
  const byId = new Map();
  for (const entry of caseEntries) {
    if (!byId.has(entry.data.id)) byId.set(entry.data.id, entry.data);
  }
  const cases = settings.cardOrder.map((id) => byId.get(id)).filter((data) => data !== undefined);
  const freeAssets = readJson('free-assets.json');
  const uiStrings = readJson('i18n-ui.json');
  const metaStrings = readJson('meta.json');
  return { settings, cases, caseEntries, freeAssets, uiStrings, metaStrings };
}

function enabledFilters(content) {
  const filters = Array.isArray(content.settings.filters) ? content.settings.filters : [];
  return filters.filter((f) => f && f.enabled !== false);
}

// Visible = the case itself is enabled AND its category filter is enabled
// (iteration F: disabling a whole category drops all its cases from the
// grid, cards-data and the locale dictionaries).
function visibleCases(content) {
  const enabledKeys = new Set(enabledFilters(content).map((f) => f.key));
  return content.cases.filter((c) => c.enabled !== false && enabledKeys.has(c.category));
}

/* ── content validation (runs before generation in --write AND --check) ──── */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasLocalePair(value) {
  return value !== null && typeof value === 'object' && isNonEmptyString(value.en) && isNonEmptyString(value.ru);
}

// Traversal guard: every media path the future admin panel may write must
// stay inside the repo's assets/ directory (no "..", no absolute paths).
function assetPathProblem(value) {
  if (!isNonEmptyString(value)) return 'must be a non-empty string';
  if (value.includes('\\')) return 'must use forward slashes';
  if (!value.startsWith('./assets/')) return 'must start with "./assets/"';
  if (value.split('/').includes('..')) return 'must not contain ".." segments';
  const resolved = path.resolve(ROOT, value);
  if (resolved !== ASSETS_DIR && !resolved.startsWith(ASSETS_DIR + path.sep)) return 'must resolve inside assets/';
  return null;
}

function checkAssetFile(violations, where, value, extension = null) {
  const problem = assetPathProblem(value);
  if (problem) {
    violations.push(`${where}: "${value}" ${problem}`);
    return;
  }
  if (extension && !value.endsWith(extension)) {
    violations.push(`${where}: "${value}" must end with ${extension}`);
    return;
  }
  if (!fs.existsSync(path.resolve(ROOT, value))) {
    violations.push(`${where}: file not found on disk ("${value}")`);
  }
}

function collectKeyPaths(value, prefix, out) {
  for (const key of Object.keys(value)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    const child = value[key];
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) collectKeyPaths(child, keyPath, out);
    else out.push(keyPath);
  }
  return out;
}

function checkLocaleParity(violations, fileLabel, dictionaries) {
  const en = new Set(collectKeyPaths((dictionaries && dictionaries.en) || {}, '', []));
  const ru = new Set(collectKeyPaths((dictionaries && dictionaries.ru) || {}, '', []));
  for (const keyPath of en) {
    if (!ru.has(keyPath)) violations.push(`${fileLabel}: key "${keyPath}" exists in en but not in ru`);
  }
  for (const keyPath of ru) {
    if (!en.has(keyPath)) violations.push(`${fileLabel}: key "${keyPath}" exists in ru but not in en`);
  }
}

function validateMotionBlock(violations, where, block) {
  if (block === null || typeof block !== 'object') {
    violations.push(`${where}: must be an object`);
    return;
  }
  if (block.source === 'local') {
    checkAssetFile(violations, `${where}.src`, block.src, '.webm');
  } else if (block.source === 'vimeo') {
    if (typeof block.vimeoId !== 'string' || !/^\d+$/.test(block.vimeoId)) {
      violations.push(`${where}.vimeoId: must be a string of digits ("${block.vimeoId}")`);
    }
  } else {
    violations.push(`${where}.source: must be "local" or "vimeo" ("${block.source}")`);
  }
  if ('poster' in block) checkAssetFile(violations, `${where}.poster`, block.poster);
  if (!hasLocalePair(block.label) || !hasLocalePair(block.desc)) {
    violations.push(`${where}: label and desc must have non-empty "en" and "ru"`);
  }
}

function validateCase(violations, entry, filterKeys) {
  const c = entry.data;
  const where = `content/cases/${entry.file}`;
  if (!isNonEmptyString(c.id)) {
    violations.push(`${where}: "id" must be a non-empty string`);
    return;
  }
  if (entry.file !== `${c.id}.json`) violations.push(`${where}: file name does not match id "${c.id}"`);
  if (!filterKeys.has(c.category) || c.category === 'all') {
    violations.push(`${where}: category "${c.category}" must be a settings.json filter key other than "all"`);
  }
  if (!isNonEmptyString(c.year)) violations.push(`${where}: "year" must be a non-empty string`);
  // enabled (iteration F): optional strict boolean — mirrors the filters
  // "enabled" rule; a truthy string would silently flip visibility logic.
  if ('enabled' in c && typeof c.enabled !== 'boolean') {
    violations.push(`${where}: "enabled" must be a boolean (got ${JSON.stringify(c.enabled)})`);
  }
  // layoutMode (iteration F): 'seeded' (default, deterministic shuffle in
  // js/main.js buildItems) or 'manual' (authored media order, flag travels
  // through js/cards-data.js).
  if ('layoutMode' in c && c.layoutMode !== 'seeded' && c.layoutMode !== 'manual') {
    violations.push(`${where}: layoutMode must be "seeded" or "manual" (got ${JSON.stringify(c.layoutMode)})`);
  }

  const card = c.card || {};
  for (const field of ['title', 'desc', 'alt']) {
    if (!hasLocalePair(card[field])) violations.push(`${where}: card.${field} must have non-empty "en" and "ru"`);
  }
  if (typeof card.htmlComment !== 'string' || card.htmlComment.includes('--')) {
    violations.push(`${where}: card.htmlComment must be a string without "--" (unsafe inside an HTML comment)`);
  }
  if (!isNonEmptyString(card.thumbLabel)) violations.push(`${where}: card.thumbLabel must be a non-empty string`);
  checkAssetFile(violations, `${where}: card.thumb`, card.thumb);
  // imgLoading is emitted verbatim into the loading="" attribute of the card
  // <img>; only the two valid HTML values are allowed.
  if (card.imgLoading !== 'eager' && card.imgLoading !== 'lazy') {
    violations.push(
      `${where}: card.imgLoading must be exactly "eager" or "lazy" (got ${JSON.stringify(card.imgLoading)})`
    );
  }
  // imgFetchPriority is emitted as fetchpriority="" only when truthy (see
  // buildCardHtml); real content uses null to mean "no attribute", so null
  // and absent are both accepted alongside the valid HTML enum.
  if (
    card.imgFetchPriority !== undefined &&
    card.imgFetchPriority !== null &&
    !['high', 'low', 'auto'].includes(card.imgFetchPriority)
  ) {
    violations.push(
      `${where}: card.imgFetchPriority must be "high", "low", "auto", or null/absent (got ${JSON.stringify(card.imgFetchPriority)})`
    );
  }

  const cs = c.case || {};
  if (!hasLocalePair(cs.role)) violations.push(`${where}: case.role must have non-empty "en" and "ru"`);
  if (!Array.isArray(cs.tools) || cs.tools.length === 0 || !cs.tools.every(isNonEmptyString)) {
    violations.push(`${where}: case.tools must be a non-empty array of strings`);
  }
  checkAssetFile(violations, `${where}: case.modelSrc`, cs.modelSrc, '.glb');
  if (cs.modelStats === null || typeof cs.modelStats !== 'object' || Array.isArray(cs.modelStats)) {
    violations.push(`${where}: case.modelStats must be an object`);
  }
  if (!Array.isArray(cs.palette) || cs.palette.length !== 5 || !cs.palette.every(isNonEmptyString)) {
    violations.push(`${where}: case.palette must be an array of 5 non-empty strings`);
  }
  if ('srcs' in cs && (!Array.isArray(cs.srcs) || cs.srcs.length !== 5)) {
    violations.push(`${where}: case.srcs, when present, must be an array of 5 entries (string path or null)`);
  }
  // Effective media sources: srcs[i] override or the default per-case SVG.
  for (let i = 0; i < 5; i += 1) {
    const override = Array.isArray(cs.srcs) ? cs.srcs[i] : null;
    if (override === null || override === undefined) {
      checkAssetFile(violations, `${where}: media slot ${i + 1} (default)`, `./assets/cases/${c.id}/0${i + 1}.svg`);
    } else {
      checkAssetFile(violations, `${where}: case.srcs[${i}]`, override);
    }
  }
  if (!Array.isArray(cs.captions) || cs.captions.length !== 5) {
    violations.push(`${where}: case.captions must be an array of 5 entries`);
  } else {
    cs.captions.forEach((caption, i) => {
      if (
        caption === null ||
        typeof caption !== 'object' ||
        !hasLocalePair(caption.label) ||
        !hasLocalePair(caption.desc)
      ) {
        violations.push(`${where}: case.captions[${i}] must have label and desc with non-empty "en" and "ru"`);
      }
    });
  }
  for (const block of ['text', 'inline']) {
    const value = cs[block];
    if (value === null || typeof value !== 'object' || !hasLocalePair(value.title) || !hasLocalePair(value.body)) {
      violations.push(`${where}: case.${block} must have title and body with non-empty "en" and "ru"`);
    }
  }
  if ('motionBlocks' in cs) {
    if (!Array.isArray(cs.motionBlocks) || cs.motionBlocks.length === 0) {
      violations.push(`${where}: case.motionBlocks, when present, must be a non-empty array`);
    } else {
      cs.motionBlocks.forEach((block, i) =>
        validateMotionBlock(violations, `${where}: case.motionBlocks[${i}]`, block)
      );
    }
  }
}

// thumb/model conventions (see js/free-assets.js resolveAssetMedia): key absent
// → defaults to the item id; null → preview explicitly disabled (null marker);
// string → base file name without extension.
function checkFreeAssetMedia(violations, itemWhere, key, item, baseDir, extension) {
  const base = key in item ? item[key] : item.id;
  if (base === null) return;
  if (!isNonEmptyString(base) || base.includes('/') || base.includes('\\') || base.includes('..')) {
    violations.push(`${itemWhere}: ${key} must be a plain base name without path separators ("${base}")`);
    return;
  }
  checkAssetFile(violations, `${itemWhere}: ${key}`, `${baseDir}${base}${extension}`);
}

function validateFreeAssets(violations, freeAssets) {
  const where = 'content/free-assets.json';
  if (freeAssets === null || typeof freeAssets !== 'object' || !Array.isArray(freeAssets.categories)) {
    violations.push(`${where}: "categories" must be an array`);
    return;
  }
  const seenIds = new Set();
  for (const category of freeAssets.categories) {
    if (!isNonEmptyString(category.key) || !Array.isArray(category.items)) {
      violations.push(`${where}: every category needs a string "key" and an "items" array`);
      continue;
    }
    for (const item of category.items) {
      if (item === null || typeof item !== 'object' || !isNonEmptyString(item.id)) {
        violations.push(`${where}: category "${category.key}" has an item without a string "id"`);
        continue;
      }
      const itemWhere = `${where}: ${category.key}/${item.id}`;
      if (seenIds.has(item.id)) violations.push(`${itemWhere}: duplicate id`);
      seenIds.add(item.id);
      if (!hasLocalePair(item.desc)) violations.push(`${itemWhere}: desc must have non-empty "en" and "ru"`);
      // These fields land verbatim in js/fa-data.js (see buildFaDataJs) and
      // render on the free-assets cards; an empty value breaks the card UI.
      for (const field of ['title', 'cat', 'badge', 'size', 'file', 'bg']) {
        if (!isNonEmptyString(item[field])) {
          violations.push(`${itemWhere}: "${field}" must be a non-empty string (got ${JSON.stringify(item[field])})`);
        }
      }
      if (!Array.isArray(item.contents) || item.contents.length === 0 || !item.contents.every(isNonEmptyString)) {
        violations.push(`${itemWhere}: "contents" must be a non-empty array of non-empty strings`);
      }
      checkFreeAssetMedia(violations, itemWhere, 'thumb', item, './assets/cards/', '.svg');
      checkFreeAssetMedia(violations, itemWhere, 'model', item, './assets/models/free/', '.glb');
    }
  }
}

// Head-meta fields emitted verbatim into the head GEN region of both pages
// (iteration E); an absent or empty value would render "undefined" into HTML.
const HEAD_META_FIELDS = [
  'title',
  'description',
  'ogSiteName',
  'ogTitle',
  'ogDescription',
  'ogImageAlt',
  'ogLocale',
  'twitterTitle',
  'twitterDescription'
];

function validateMetaImages(violations, metaStrings) {
  const where = 'content/meta.json';
  const images = metaStrings && metaStrings.ogImages;
  if (images === null || typeof images !== 'object' || Array.isArray(images)) {
    violations.push(`${where}: "ogImages" must be an object with "index" and "fa" asset paths`);
    return;
  }
  for (const page of ['index', 'fa']) {
    const value = images[page];
    checkAssetFile(violations, `${where}: ogImages.${page}`, value);
    if (isNonEmptyString(value) && !/\.(jpg|jpeg|png|webp)$/i.test(value)) {
      violations.push(`${where}: ogImages.${page} must be a .jpg/.jpeg/.png/.webp image ("${value}")`);
    }
  }
  for (const page of ['index', 'fa']) {
    const pageStrings = (metaStrings && metaStrings.en && metaStrings.en[page]) || {};
    for (const field of HEAD_META_FIELDS) {
      if (!isNonEmptyString(pageStrings[field])) {
        violations.push(`${where}: en.${page}.${field} must be a non-empty string (emitted into the head GEN region)`);
      }
    }
  }
}

// structuredData.featuredWorks (iteration G): the index.html JSON-LD ItemList
// is generated from this list intersected with the visible cases, so a hidden
// case stops being advertised to crawlers. Every id must be a real case.
function validateStructuredData(violations, metaStrings, caseIds) {
  const where = 'content/meta.json';
  const sd = metaStrings && metaStrings.structuredData;
  if (sd === null || typeof sd !== 'object' || Array.isArray(sd) || !Array.isArray(sd.featuredWorks)) {
    violations.push(`${where}: "structuredData.featuredWorks" must be an array of { id, about } objects`);
    return;
  }
  const seen = new Set();
  sd.featuredWorks.forEach((entry, i) => {
    const w = `${where}: structuredData.featuredWorks[${i}]`;
    if (entry === null || typeof entry !== 'object') {
      violations.push(`${w}: must be an object with "id" and "about"`);
      return;
    }
    if (!isNonEmptyString(entry.id) || !caseIds.has(entry.id)) {
      violations.push(`${w}: "id" must match an existing case (got ${JSON.stringify(entry.id)})`);
    }
    if (seen.has(entry.id)) violations.push(`${w}: duplicate id "${entry.id}"`);
    seen.add(entry.id);
    if (!isNonEmptyString(entry.about)) {
      violations.push(`${w}: "about" must be a non-empty string (emitted into the JSON-LD ItemList)`);
    }
  });
}

function validateContent(content) {
  const violations = [];
  const { settings, caseEntries, freeAssets, uiStrings, metaStrings } = content;

  const filters = Array.isArray(settings.filters) ? settings.filters : [];
  // Filter keys feed data-category matching, labels feed the visible filter
  // buttons and the card category line — both must be real strings.
  filters.forEach((filter, i) => {
    if (filter === null || typeof filter !== 'object') {
      violations.push(`content/settings.json: filters[${i}] must be an object with "key" and "label"`);
      return;
    }
    if (!isNonEmptyString(filter.key)) {
      violations.push(
        `content/settings.json: filters[${i}] needs a non-empty string "key" (got ${JSON.stringify(filter.key)})`
      );
    }
    if (!isNonEmptyString(filter.label)) {
      violations.push(
        `content/settings.json: filters[${i}] ("${filter.key}") needs a non-empty string "label" (got ${JSON.stringify(filter.label)})`
      );
    }
    // enabled (iteration F): optional boolean; the 'all' pseudo-filter is the
    // grid's reset state and can never be disabled.
    if ('enabled' in filter && typeof filter.enabled !== 'boolean') {
      violations.push(
        `content/settings.json: filters[${i}] ("${filter.key}") "enabled" must be a boolean (got ${JSON.stringify(filter.enabled)})`
      );
    }
    if (filter.key === 'all' && filter.enabled === false) {
      violations.push(`content/settings.json: the "all" filter cannot be disabled`);
    }
  });
  const filterKeys = new Set(filters.map((f) => f && f.key));

  // cardOrder ↔ case files must be a bijection: unique ids, no orphans.
  const order = Array.isArray(settings.cardOrder) ? settings.cardOrder : [];
  const orderSet = new Set();
  for (const id of order) {
    if (orderSet.has(id)) violations.push(`content/settings.json: cardOrder lists "${id}" more than once`);
    orderSet.add(id);
  }
  const fileIds = new Set();
  for (const entry of caseEntries) {
    const id = entry.data.id;
    if (typeof id !== 'string') continue; // reported per-case below
    if (fileIds.has(id)) violations.push(`content/cases/${entry.file}: duplicate case id "${id}"`);
    fileIds.add(id);
  }
  for (const id of orderSet) {
    if (!fileIds.has(id)) {
      violations.push(`content/settings.json: cardOrder lists "${id}" but content/cases/${id}.json does not exist`);
    }
  }
  for (const id of fileIds) {
    if (!orderSet.has(id)) violations.push(`content/cases/${id}.json: id is missing from settings.json cardOrder`);
  }

  for (const entry of caseEntries) validateCase(violations, entry, filterKeys);

  // Iteration F guard: an empty grid would break the shipped pages (and
  // verify-frozen) — at least one enabled case in an enabled category.
  if (visibleCases(content).length === 0) {
    violations.push(
      'content: at least one case must stay visible (an enabled case in an enabled category) — the grid cannot be empty'
    );
  }

  checkLocaleParity(violations, 'content/i18n-ui.json', uiStrings);
  checkLocaleParity(violations, 'content/meta.json', metaStrings);
  validateMetaImages(violations, metaStrings);
  validateStructuredData(violations, metaStrings, fileIds);
  validateFreeAssets(violations, freeAssets);

  return violations;
}

/* ── JS literal serializer (stable key order, single quotes, 2-space indent) ─ */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function jsString(value) {
  return (
    "'" +
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029') +
    "'"
  );
}

function serializeJs(value, indent) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number' || type === 'boolean') return String(value);
  if (type === 'string') return jsString(value);
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '[\n' + value.map((item) => inner + serializeJs(item, inner)).join(',\n') + '\n' + indent + ']';
  }
  if (type === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const body = keys
      .map((key) => inner + (IDENT_RE.test(key) ? key : jsString(key)) + ': ' + serializeJs(value[key], inner))
      .join(',\n');
    return '{\n' + body + '\n' + indent + '}';
  }
  throw new Error(`cannot serialize value of type ${type}`);
}

/* ── sparse i18n overrides (see content/cases/*.json → i18nOverrides) ────── */

function applySparse(target, diff) {
  if (diff === undefined) return target;
  if (diff !== null && typeof diff === 'object' && '__replace' in diff) return diff.__replace;
  if (diff === null || typeof diff !== 'object') return diff;
  const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
  for (const key of Object.keys(diff)) out[key] = applySparse(out[key], diff[key]);
  return out;
}

/* ── js/cards-data.js ────────────────────────────────────────────────────── */

const MEDIA_FORMATS = ['wide', 'tall', 'tall', 'wide', 'tall'];
const MOTION_KEYS = ['source', 'layout', 'playback', 'src', 'vimeoId', 'poster', 'title'];

function buildCaseEntry(c) {
  const cs = c.case;
  const media = MEDIA_FORMATS.map((format, i) => ({
    type: 'image',
    format,
    src: (cs.srcs && cs.srcs[i]) || `./assets/cases/${c.id}/0${i + 1}.svg`,
    bg: cs.palette[i],
    label: cs.captions[i].label.en,
    desc: cs.captions[i].desc.en,
    enabled: true
  }));

  let motionBlocks = null;
  if (Array.isArray(cs.motionBlocks)) {
    motionBlocks = cs.motionBlocks.map((block) => {
      const out = {};
      for (const key of MOTION_KEYS) {
        if (key in block) out[key] = block[key];
      }
      out.label = block.label.en;
      out.desc = block.desc.en;
      return out;
    });
  }

  const entry = {
    role: cs.role.en,
    tools: cs.tools,
    modelSrc: cs.modelSrc
  };
  // layoutMode travels into the runtime payload only when 'manual':
  // js/main.js buildItems() treats an absent flag as 'seeded', so the
  // generated file stays byte-identical while every case is seeded.
  if (c.layoutMode === 'manual') entry.layoutMode = 'manual';
  if ('modelEnvironment' in cs) entry.modelEnvironment = cs.modelEnvironment;
  if ('modelExposure' in cs) entry.modelExposure = cs.modelExposure;
  entry.modelStats = cs.modelStats;
  entry.items = {
    media,
    text: cs.text ? { title: cs.text.title.en, body: cs.text.body.en } : null,
    inline: cs.inline ? { title: cs.inline.title.en, body: cs.inline.body.en } : null,
    motionBlocks
  };
  return entry;
}

function buildCardsDataJs(content) {
  const data = {};
  for (const c of visibleCases(content)) data[c.id] = buildCaseEntry(c);
  return (
    `/* ═══════════════════════════════════════════════════════════════════════
   cards-data.js — AUTO-GENERATED by scripts/generate-content.mjs. Do not
   edit by hand: run \`npm run content:generate\` after editing the content
   sources in content/cases/*.json (order: content/settings.json cardOrder).

   window.CARDS_DATA — финальная развёрнутая структура кейсов (бывший
   makeItems() из js/main.js портирован в генератор):
     items.media[5] — 2 wide + 3 tall, src по умолчанию
       ./assets/cases/<id>/01..05.svg (переопределяется case.srcs[i]);
     items.text / items.inline — текстовые блоки (или null);
     items.motionBlocks — fixed motion-секции (или null).
   Подключается ПЕРЕД js/main.js (classic script, без defer/async).
═══════════════════════════════════════════════════════════════════════ */
window.CARDS_DATA = ` +
    serializeJs(data, '') +
    ';\n'
  );
}

/* ── js/fa-data.js ───────────────────────────────────────────────────────── */

function buildFaDataJs(content) {
  const data = {};
  for (const category of content.freeAssets.categories) {
    data[category.key] = category.items.map((item) => {
      const out = { id: item.id };
      if ('thumb' in item) out.thumb = item.thumb;
      if ('model' in item) out.model = item.model;
      out.cat = item.cat;
      out.title = item.title;
      out.desc = item.desc.en;
      out.badge = item.badge;
      out.contents = item.contents;
      out.size = item.size;
      out.file = item.file;
      out.bg = item.bg;
      return out;
    });
  }
  return (
    `/* ═══════════════════════════════════════════════════════════════════════
   fa-data.js — AUTO-GENERATED by scripts/generate-content.mjs. Do not edit
   by hand: run \`npm run content:generate\` after editing
   content/free-assets.json.

   FA_DATA — каталог free-assets для js/free-assets.js.
   Конвенции (см. js/free-assets.js):
     thumbnail-path = './assets/cards/' + id + '.svg' по умолчанию;
     model-path     = './assets/models/free/' + id + '.glb' по умолчанию;
     thumb/model строкой — базовое имя файла без расширения;
     thumb/model: null — соответствующий preview отключён.
═══════════════════════════════════════════════════════════════════════ */
var FA_DATA = ` +
    serializeJs(data, '') +
    ';\n'
  );
}

/* ── js/i18n-data.js ─────────────────────────────────────────────────────── */

function buildCardsLocales(content) {
  const en = {};
  const ru = {};
  for (const c of visibleCases(content)) {
    const enCandidate = { title: c.card.title.en, desc: c.card.desc.en, alt: c.card.alt.en };
    const overrides = c.i18nOverrides && c.i18nOverrides.cardsEn;
    en[c.id] = applySparse(enCandidate, overrides);
    ru[c.id] = { title: c.card.title.ru, desc: c.card.desc.ru, alt: c.card.alt.ru };
  }
  return { en, ru };
}

function buildCaseLocales(content) {
  const en = {};
  const ru = {};
  for (const c of visibleCases(content)) {
    const cs = c.case;
    const enCandidate = {
      role: cs.role.en,
      captions: cs.captions.map((cap) => ({ label: cap.label.en, desc: cap.desc.en })),
      text: { title: cs.text.title.en, body: cs.text.body.en },
      inline: { title: cs.inline.title.en, body: cs.inline.body.en }
    };
    const ruEntry = {
      role: cs.role.ru,
      captions: cs.captions.map((cap) => ({ label: cap.label.ru, desc: cap.desc.ru })),
      text: { title: cs.text.title.ru, body: cs.text.body.ru },
      inline: { title: cs.inline.title.ru, body: cs.inline.body.ru }
    };
    if (Array.isArray(cs.motionBlocks)) {
      enCandidate.motionBlocks = cs.motionBlocks.map((b) => ({ label: b.label.en, desc: b.desc.en }));
      ruEntry.motionBlocks = cs.motionBlocks.map((b) => ({ label: b.label.ru, desc: b.desc.ru }));
    }
    const overrides = c.i18nOverrides && c.i18nOverrides.caseEn;
    en[c.id] = applySparse(enCandidate, overrides);
    ru[c.id] = ruEntry;
  }
  return { en, ru };
}

function buildFaLocales(content) {
  const en = {};
  const ru = {};
  for (const category of content.freeAssets.categories) {
    for (const item of category.items) {
      en[item.id] = { desc: item.desc.en };
      ru[item.id] = { desc: item.desc.ru };
    }
  }
  return { en, ru };
}

function buildI18nDataJs(content) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8').replace(/\r\n/g, '\n');
  const replacements = {
    __UI_STRINGS__: content.uiStrings,
    // Only the locale dictionaries: the sibling ogImages key (iteration E)
    // feeds the head GEN region, not the runtime i18n payload.
    __META_STRINGS__: { en: content.metaStrings.en, ru: content.metaStrings.ru },
    __CARDS_LOCALES__: buildCardsLocales(content),
    __CASE_LOCALES__: buildCaseLocales(content),
    __FA_LOCALES__: buildFaLocales(content)
  };
  let out = template;
  for (const [token, value] of Object.entries(replacements)) {
    if (!out.includes(token)) throw new Error(`template is missing ${token}`);
    const serialized = serializeJs(value, '  ');
    // Replacer function: data may contain `$&`/`$'`-style patterns that
    // String.prototype.replace would otherwise expand.
    out = out.replace(token, () => serialized);
  }
  return out;
}

/* ── index.html cards grid (byte-identical templating) ──────────────────── */

function escapeHtmlText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(value) {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

function buildCardHtml(c, catLabel) {
  if (String(c.card.htmlComment).includes('--')) {
    throw new Error(`${c.id}: card.htmlComment must not contain "--" (unsafe inside an HTML comment)`);
  }
  const id = escapeHtmlAttr(c.id);
  const lines = [];
  lines.push(`        <!-- ${c.card.htmlComment} -->`);
  let anchor = `        <a class="work-card" data-id="${id}" data-category="${escapeHtmlAttr(c.category)}"`;
  if (c.gameAsset) anchor += ' data-game-asset="true"';
  if (c.cadPlaceholder) anchor += ' data-cad-placeholder="true"';
  anchor += ` href="#${id}">`;
  lines.push(anchor);
  lines.push(`          <div class="work-card__thumb" data-label="${escapeHtmlAttr(c.card.thumbLabel)}">`);
  let img = `            <img src="${escapeHtmlAttr(c.card.thumb)}" data-i18n-attr="alt:card.${id}.alt"`;
  img += ` alt="${escapeHtmlAttr(c.card.alt.en)}"`;
  img += ` loading="${escapeHtmlAttr(c.card.imgLoading)}"`;
  if (c.card.imgFetchPriority) img += ` fetchpriority="${escapeHtmlAttr(c.card.imgFetchPriority)}"`;
  img += ' decoding="async" width="800" height="600">';
  lines.push(img);
  if (c.card.badge) lines.push(`            <span class="work-card__badge">${escapeHtmlText(c.card.badge)}</span>`);
  lines.push('          </div>');
  lines.push('          <div class="work-card__info">');
  lines.push(
    `            <div class="work-card__meta"><span class="work-card__cat">${escapeHtmlText(catLabel)}</span>` +
      `<span class="work-card__meta-tail"><span class="work-card__year">${escapeHtmlText(c.year)}</span>` +
      '<span class="work-card__hint" aria-hidden="true">↗</span></span></div>'
  );
  lines.push(
    `            <h2 class="work-card__title" data-i18n="card.${id}.title">${escapeHtmlText(c.card.title.en)}</h2>`
  );
  lines.push(
    `            <p class="work-card__desc" data-i18n="card.${id}.desc">${escapeHtmlText(c.card.desc.en)}</p>`
  );
  lines.push('          </div>');
  lines.push('        </a>');
  return lines.join('\n');
}

function buildGridRegion(content) {
  const labels = Object.fromEntries(content.settings.filters.map((f) => [f.key, f.label]));
  return visibleCases(content)
    .map((c) => buildCardHtml(c, labels[c.category]))
    .join('\n\n');
}

/* ── filters GEN region (iteration F, byte-identical templating) ──────────── */

// data-i18n key of a filter: 'hard-surface' → 'filter.hardSurface' (matches
// the historical hand-written keys in content/i18n-ui.json).
function filterI18nKey(key) {
  return 'filter.' + String(key).replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase());
}

// The checkbox row of the tags dropdown: only enabled filters are emitted.
// Line layout reproduces the pre-iteration-F bytes exactly, so the first
// generation is a no-op; values come from content/settings.json.
function buildFiltersRegion(content) {
  return enabledFilters(content)
    .map((filter) => {
      const key = escapeHtmlAttr(filter.key);
      const i18n = escapeHtmlAttr(filterI18nKey(filter.key));
      const label = filter.label;
      return [
        '          <label class="tags-dropdown__option" role="option">',
        `            <input type="checkbox" class="tags-dropdown__checkbox" data-filter="${key}" data-i18n-attr="aria-label:${i18n}" aria-label="${escapeHtmlAttr(label)}">`,
        `            <span class="tags-dropdown__label" data-i18n="${i18n}">${escapeHtmlText(label)}</span>`,
        '          </label>'
      ].join('\n');
    })
    .join('\n');
}

function replaceRegion(html, filePath, begin, end, region) {
  const lines = html.split('\n');
  const beginIdx = lines.findIndex((line) => line.trim() === begin);
  const endIdx = lines.findIndex((line) => line.trim() === end);
  if (beginIdx < 0 || endIdx < 0 || endIdx <= beginIdx) {
    throw new Error(`${filePath}: ${begin} / ${end} markers not found or malformed`);
  }
  return lines
    .slice(0, beginIdx + 1)
    .concat(region, lines.slice(endIdx))
    .join('\n');
}

/* ── head-meta GEN region (iteration E, byte-identical templating) ────────── */

// og:image / twitter:image require absolute URLs (crawlers do not resolve
// relative paths); content stores the repo-relative "./assets/..." form.
function absoluteAssetUrl(assetPath) {
  return 'https://codex.promo/' + String(assetPath).replace(/^\.\//, '');
}

// The owner-editable head block of each page. Line layout (including the
// historical attribute padding) reproduces the pre-iteration-E bytes exactly,
// so the first generation is a no-op; only the values come from content/.
function buildHeadMetaRegion(content, page) {
  const m = content.metaStrings.en[page];
  const og = escapeHtmlAttr(absoluteAssetUrl(content.metaStrings.ogImages[page]));
  const a = escapeHtmlAttr;
  if (page === 'index') {
    return [
      `  <title data-i18n-meta="index.title">${escapeHtmlText(m.title)}</title>`,
      '',
      `  <meta name="description" data-i18n-meta="index.description" content="${a(m.description)}">`,
      '  <link rel="canonical" href="https://codex.promo/">',
      '',
      '  <!-- OpenGraph (absolute URLs required by crawlers) -->',
      '  <meta property="og:url"             content="https://codex.promo/">',
      '  <meta property="og:type"            content="website">',
      `  <meta property="og:site_name"       data-i18n-meta="index.ogSiteName" content="${a(m.ogSiteName)}">`,
      `  <meta property="og:title"           data-i18n-meta="index.ogTitle"   content="${a(m.ogTitle)}">`,
      `  <meta property="og:description"     data-i18n-meta="index.ogDescription" content="${a(m.ogDescription)}">`,
      `  <meta property="og:image"           content="${og}">`,
      '  <meta property="og:image:width"     content="1200">',
      '  <meta property="og:image:height"    content="630">',
      `  <meta property="og:image:alt"       data-i18n-meta="index.ogImageAlt" content="${a(m.ogImageAlt)}">`,
      `  <meta property="og:locale"          data-i18n-meta="index.ogLocale" content="${a(m.ogLocale)}">`,
      '',
      '  <!-- Twitter Card -->',
      '  <meta name="twitter:card"           content="summary_large_image">',
      `  <meta name="twitter:title"          data-i18n-meta="index.twitterTitle" content="${a(m.twitterTitle)}">`,
      `  <meta name="twitter:description"    data-i18n-meta="index.twitterDescription" content="${a(m.twitterDescription)}">`,
      `  <meta name="twitter:image"          content="${og}">`
    ].join('\n');
  }
  return [
    `  <title data-i18n-meta="fa.title">${escapeHtmlText(m.title)}</title>`,
    '',
    `  <meta name="description" data-i18n-meta="fa.description" content="${a(m.description)}">`,
    '  <link rel="canonical" href="https://codex.promo/free-assets.html">',
    '',
    '  <!-- v0.4 [B5]: OpenGraph (absolute URLs required by crawlers) -->',
    '  <meta property="og:url"             content="https://codex.promo/free-assets.html">',
    '  <meta property="og:type"            content="website">',
    `  <meta property="og:site_name"       data-i18n-meta="fa.ogSiteName" content="${a(m.ogSiteName)}">`,
    `  <meta property="og:title"           data-i18n-meta="fa.ogTitle"    content="${a(m.ogTitle)}">`,
    `  <meta property="og:description"    data-i18n-meta="fa.ogDescription" content="${a(m.ogDescription)}">`,
    `  <meta property="og:image"           content="${og}">`,
    '  <meta property="og:image:width"     content="1200">',
    '  <meta property="og:image:height"    content="630">',
    `  <meta property="og:image:alt"       data-i18n-meta="fa.ogImageAlt" content="${a(m.ogImageAlt)}">`,
    `  <meta property="og:locale"          data-i18n-meta="fa.ogLocale" content="${a(m.ogLocale)}">`,
    '',
    '  <!-- v0.4 [B5]: Twitter Card -->',
    '  <meta name="twitter:card"           content="summary_large_image">',
    `  <meta name="twitter:title"          data-i18n-meta="fa.twitterTitle" content="${a(m.twitterTitle)}">`,
    `  <meta name="twitter:description"    data-i18n-meta="fa.twitterDescription" content="${a(m.twitterDescription)}">`,
    `  <meta name="twitter:image"          content="${og}">`
  ].join('\n');
}

/* ── jsonld GEN region (iteration G, byte-identical templating) ──────────── */

// JSON string literal for the hand-formatted JSON-LD blocks (the blocks keep
// the historical 2-space indentation, so values are interpolated one by one).
function j(value) {
  return JSON.stringify(value);
}

// Shared Organization block (both pages): the logo follows the index OG image
// owners replace through the admin panel (cache-bust name included).
function organizationJsonLd(content) {
  return [
    '  <script type="application/ld+json">',
    '  {',
    '    "@context": "https://schema.org",',
    '    "@type": "Organization",',
    '    "name": "Codex Studio",',
    '    "alternateName": "Codex",',
    '    "url": "https://codex.promo/",',
    `    "logo": ${j(absoluteAssetUrl(content.metaStrings.ogImages.index))},`,
    '    "description": "Remote 3D design studio specializing in hard surface modeling, product visualization, and game-ready assets. Built in Blender.",',
    '    "sameAs": [',
    '      "https://t.me/WhiteCatWeb"',
    '    ]',
    '  }',
    '  </script>'
  ];
}

// index.html ItemList: featuredWorks from content/meta.json intersected with
// the visible cases (a hidden case or category leaves no SEO ghost), positions
// renumbered, names follow the live card titles. List order stays the
// owner-curated featuredWorks order (historically not equal to cardOrder).
function buildIndexJsonLdRegion(content) {
  const visible = new Map(visibleCases(content).map((c) => [c.id, c]));
  const featured = content.metaStrings.structuredData.featuredWorks.filter((f) => visible.has(f.id));
  const items = featured.map((f, i) => {
    const c = visible.get(f.id);
    return [
      '      {',
      '        "@type": "ListItem",',
      `        "position": ${i + 1},`,
      '        "item": {',
      '          "@type": "CreativeWork",',
      `          "name": ${j(c.card.title.en)},`,
      '          "creator": { "@type": "Organization", "name": "Codex Studio" },',
      `          "about": ${j(f.about)},`,
      `          "url": ${j(`https://codex.promo/#${f.id}`)}`,
      '        }',
      '      }'
    ].join('\n');
  });
  return organizationJsonLd(content)
    .concat([
      '  <script type="application/ld+json">',
      '  {',
      '    "@context": "https://schema.org",',
      '    "@type": "WebSite",',
      '    "name": "Codex Studio",',
      '    "url": "https://codex.promo/",',
      '    "inLanguage": "en",',
      '    "publisher": { "@type": "Organization", "name": "Codex Studio" }',
      '  }',
      '  </script>',
      '  <script type="application/ld+json">',
      '  {',
      '    "@context": "https://schema.org",',
      '    "@type": "ItemList",',
      '    "name": "Codex Studio — Featured Works",',
      '    "itemListOrder": "https://schema.org/ItemListOrderAscending",',
      '    "itemListElement": [',
      items.join(',\n'),
      '    ]',
      '  }',
      '  </script>'
    ])
    .join('\n');
}

// free-assets.html catalog ItemList: the entries are SEO-specific copy that
// never came from content/free-assets.json (names/descriptions are crafted
// for crawlers), so they stay literal HERE; what follows content/ is
// numberOfItems (catalog size) and every og-image-dependent field
// (thumbnailUrl fallback = the FA OG image owners replace via the admin).
const FA_JSONLD_ITEMS = [
  {
    fragment: 'orbital-mk-ii',
    name: 'Orbital Mk.II free hard-surface 3D asset',
    description: 'Sci-fi prop with clean topology, full PBR texture set, and Blender, FBX, OBJ delivery.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/obj', 'model/gltf-binary'],
    contentSize: '48 MB',
    thumb: 'https://codex.promo/assets/cards/orbital-mk-ii.svg',
    contentUrl: 'https://codex.promo/downloads/orbital-mk-ii.zip'
  },
  {
    fragment: 'vega-shell',
    name: 'Vega Shell free modular armor asset',
    description: 'Modular exo-armor system with 47 snap-together parts, clean UVs, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary'],
    contentSize: '93 MB',
    thumb: 'https://codex.promo/assets/cards/vega-shell.svg'
  },
  {
    fragment: 'ironclad-frame',
    name: 'Ironclad Frame free industrial chassis asset',
    description: 'Industrial chassis breakdown with modeled bolts, PBR textures, wire renders, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary'],
    contentSize: '55 MB',
    thumb: 'https://codex.promo/assets/cards/ironclad-frame.svg'
  },
  {
    fragment: 'bolt-cluster',
    name: 'Bolt Cluster free industrial fastener kit',
    description: 'Industrial fastener kit with 12 variants, GeoNodes scatter setup, Blender file and 2K textures.',
    encodingFormat: ['application/x-blender', 'model/gltf-binary', 'image/png'],
    contentSize: '31 MB',
    thumb: null
  },
  {
    fragment: 'terra-base',
    name: 'Terra Base free modular environment kit',
    description: 'Modular environment kit with 24 tileable pieces, GeoNodes scatter system, and 4K textures.',
    encodingFormat: ['application/x-blender', 'model/gltf-binary', 'image/png'],
    contentSize: '182 MB',
    thumb: null
  },
  {
    fragment: 'shard-cannon',
    name: 'Shard Cannon free sci-fi weapon asset',
    description: 'Sci-fi heavy weapon with three skin variations, UE5-compatible export, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary', 'image/png'],
    contentSize: '103 MB',
    thumb: null
  },
  {
    fragment: 'wraith-blade',
    name: 'Wraith Blade free melee weapon asset',
    description: 'Thin melee weapon with emissive edge variant, PBR textures, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary', 'image/png'],
    contentSize: '76 MB',
    thumb: null
  },
  {
    fragment: 'apex-frame',
    name: 'Apex Frame free mechanical component asset',
    description: 'Mechanical component breakdown with STEP file, exploded rig, textures, README and Blender source.',
    encodingFormat: ['application/x-blender', 'model/step', 'model/gltf-binary', 'text/plain'],
    contentSize: '67 MB',
    thumb: 'https://codex.promo/assets/cards/apex-frame.svg',
    contentUrl: 'https://codex.promo/downloads/apex-frame.zip'
  }
];

function buildFaJsonLdRegion(content) {
  const faOg = absoluteAssetUrl(content.metaStrings.ogImages.fa);
  const itemCount = content.freeAssets.categories.reduce((sum, category) => sum + category.items.length, 0);
  const items = FA_JSONLD_ITEMS.map((item, i) => {
    const lines = [
      '      {',
      '        "@type": "ListItem",',
      `        "position": ${i + 1},`,
      `        "url": ${j(`https://codex.promo/free-assets.html#${item.fragment}`)},`,
      '        "item": {',
      '          "@type": "3DModel",',
      `          "name": ${j(item.name)},`,
      `          "description": ${j(item.description)},`,
      `          "encodingFormat": [${item.encodingFormat.map(j).join(', ')}],`,
      `          "contentSize": ${j(item.contentSize)},`,
      '          "license": "https://creativecommons.org/publicdomain/zero/1.0/",',
      '          "isAccessibleForFree": true,',
      `          "thumbnailUrl": ${j(item.thumb || faOg)}${item.contentUrl ? ',' : ''}`
    ];
    if (item.contentUrl) lines.push(`          "contentUrl": ${j(item.contentUrl)}`);
    lines.push('        }', '      }');
    return lines.join('\n');
  });
  return organizationJsonLd(content)
    .concat([
      '  <script type="application/ld+json">',
      '  {',
      '    "@context": "https://schema.org",',
      '    "@type": "WebPage",',
      '    "name": "Free 3D Assets — Codex Studio",',
      '    "url": "https://codex.promo/free-assets.html",',
      '    "inLanguage": "en",',
      '    "description": "Free 3D assets by Codex Studio. Hard surface models, game-ready props, and product renders.",',
      '    "isPartOf": { "@type": "WebSite", "name": "Codex Studio", "url": "https://codex.promo/" },',
      '    "publisher": { "@type": "Organization", "name": "Codex Studio" },',
      `    "primaryImageOfPage": ${j(faOg)}`,
      '  }',
      '  </script>',
      '  <script type="application/ld+json">',
      '  {',
      '    "@context": "https://schema.org",',
      '    "@type": "ItemList",',
      '    "name": "Free 3D asset catalog — Codex Studio",',
      '    "url": "https://codex.promo/free-assets.html",',
      `    "numberOfItems": ${itemCount},`,
      '    "itemListOrder": "https://schema.org/ItemListOrderAscending",',
      '    "itemListElement": [',
      items.join(',\n'),
      '    ]',
      '  }',
      '  </script>'
    ])
    .join('\n');
}

/* ── sitemap.xml (iteration G: image:loc follows meta.json ogImages) ──────── */

// The whole file is regenerated; no generated-file banner on purpose — the
// first generation must be byte-identical to the hand-written sitemap.
// lastmod stays a literal: it tracks page content milestones, not OG swaps.
function buildSitemapXml(content) {
  const images = content.metaStrings.ogImages;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    '  <url>',
    '    <loc>https://codex.promo/</loc>',
    '    <lastmod>2026-05-30</lastmod>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '    <image:image>',
    `      <image:loc>${absoluteAssetUrl(images.index)}</image:loc>`,
    '      <image:title>Codex Studio — 3D design portfolio</image:title>',
    '    </image:image>',
    '  </url>',
    '  <url>',
    '    <loc>https://codex.promo/free-assets.html</loc>',
    '    <lastmod>2026-05-30</lastmod>',
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.7</priority>',
    '    <image:image>',
    `      <image:loc>${absoluteAssetUrl(images.fa)}</image:loc>`,
    '      <image:title>Codex Studio — Free 3D assets catalog</image:title>',
    '    </image:image>',
    '  </url>',
    '</urlset>',
    ''
  ].join('\n');
}

/* ── targets, --write / --check ──────────────────────────────────────────── */

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function buildTargets(content) {
  const indexRaw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const indexEol = detectEol(indexRaw);
  let indexNext = indexRaw.replace(/\r\n/g, '\n');
  indexNext = replaceRegion(indexNext, 'index.html', HEAD_BEGIN, HEAD_END, buildHeadMetaRegion(content, 'index'));
  indexNext = replaceRegion(indexNext, 'index.html', JSONLD_BEGIN, JSONLD_END, buildIndexJsonLdRegion(content));
  indexNext = replaceRegion(indexNext, 'index.html', FILTERS_BEGIN, FILTERS_END, buildFiltersRegion(content));
  indexNext = replaceRegion(indexNext, 'index.html', GRID_BEGIN, GRID_END, buildGridRegion(content));

  const faRaw = fs.readFileSync(path.join(ROOT, 'free-assets.html'), 'utf8');
  const faEol = detectEol(faRaw);
  let faNext = faRaw.replace(/\r\n/g, '\n');
  faNext = replaceRegion(faNext, 'free-assets.html', HEAD_BEGIN, HEAD_END, buildHeadMetaRegion(content, 'fa'));
  faNext = replaceRegion(faNext, 'free-assets.html', JSONLD_BEGIN, JSONLD_END, buildFaJsonLdRegion(content));

  const sitemapPath = path.join(ROOT, 'sitemap.xml');
  const sitemapEol = fs.existsSync(sitemapPath) ? detectEol(fs.readFileSync(sitemapPath, 'utf8')) : '\n';

  return [
    { rel: 'js/cards-data.js', next: buildCardsDataJs(content), eol: '\n' },
    { rel: 'js/fa-data.js', next: buildFaDataJs(content), eol: '\n' },
    { rel: 'js/i18n-data.js', next: buildI18nDataJs(content), eol: '\n' },
    { rel: 'index.html', next: indexNext, eol: indexEol },
    { rel: 'free-assets.html', next: faNext, eol: faEol },
    { rel: 'sitemap.xml', next: buildSitemapXml(content), eol: sitemapEol }
  ];
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('Usage: node scripts/generate-content.mjs --write | --check');
    process.exit(2);
  }

  const content = loadContent();
  const violations = validateContent(content);
  if (violations.length > 0) {
    console.error(`CONTENT INVALID: ${violations.length} violation(s)`);
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }

  const targets = buildTargets(content);
  let diffs = 0;

  for (const target of targets) {
    const fullPath = path.join(OUT_DIR, target.rel);
    // EOL robustness: with git core.autocrlf=true a fresh checkout puts CRLF
    // in the working tree while the generator emits LF. Normalize BOTH sides
    // before comparing so --check passes and --write does not churn.
    const onDisk = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n') : null;
    const same = onDisk === target.next.replace(/\r\n/g, '\n');
    if (mode === '--check') {
      if (same) {
        console.log(`[OK]   ${target.rel}`);
      } else {
        diffs += 1;
        console.error(`[DIFF] ${target.rel}${onDisk === null ? ' (missing on disk)' : ''}`);
      }
    } else if (same) {
      console.log(`[SKIP] ${target.rel} (already up to date)`);
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, target.eol === '\n' ? target.next : target.next.replace(/\n/g, target.eol), 'utf8');
      console.log(`[GEN]  ${target.rel}`);
    }
  }

  if (mode === '--check') {
    if (diffs > 0) {
      console.error(`SUMMARY: ${diffs} generated target(s) out of date — run \`npm run content:generate\``);
      process.exit(1);
    }
    console.log('SUMMARY: generated targets match content/');
  }
}

main();
