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
 *                                and numberOfItems follow content/) plus the
 *                                fa-filters GEN region (the FA tags-dropdown
 *                                checkboxes with per-category item counts)
 *   sitemap.xml                — image:loc entries follow meta.json ogImages
 *
 * Visibility (iteration F): a case with enabled:false, and every case of a
 * filter with enabled:false in settings.json, is dropped from the grid,
 * cards-data and the locale dictionaries. A disabled filter also disappears
 * from the filters GEN region. The 'all' filter cannot be disabled and at
 * least one case must stay visible overall.
 *
 * FA visibility (iteration H): free-assets items and categories accept the
 * same optional enabled:false. Disabled items (and every item of a disabled
 * category) drop out of FA_DATA, FA_LOCALES, the FA JSON-LD ItemList and
 * numberOfItems, and the fa-filters checkbox row; a category left with zero
 * visible items is dropped entirely. At least one free asset must stay
 * visible overall (mirror of the case guard).
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
import { execSync } from 'node:child_process';
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
const FA_FILTERS_BEGIN = '<!-- CODEX:GEN fa-filters BEGIN -->';
const FA_FILTERS_END = '<!-- CODEX:GEN fa-filters END -->';
const FA_TAG_CARDS_BEGIN = '<!-- CODEX:GEN fa-tag-cards BEGIN -->';
const FA_TAG_CARDS_END = '<!-- CODEX:GEN fa-tag-cards END -->';
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

// FA visibility (iteration H): enabled categories with their enabled items;
// a category left with zero visible items is dropped entirely. Every FA
// consumer (FA_DATA, FA_LOCALES, fa-filters region, FA JSON-LD) reads this
// selection — js/free-assets.js then removes the tag cards of categories
// missing from FA_DATA at runtime.
function visibleFaCategories(content) {
  const categories =
    content.freeAssets && Array.isArray(content.freeAssets.categories) ? content.freeAssets.categories : [];
  return categories
    .filter((category) => category !== null && typeof category === 'object' && category.enabled !== false)
    .map((category) => ({
      key: category.key,
      tagCard: category.tagCard,
      items: (Array.isArray(category.items) ? category.items : []).filter(
        (item) => item !== null && typeof item === 'object' && item.enabled !== false
      )
    }))
    .filter((category) => category.items.length > 0);
}

// Effective thumb/model base name of an FA item (mirror of resolveAssetMedia
// in js/free-assets.js): absent key → the item id, null → disabled.
function faEffectiveBase(item, key) {
  return key in item ? item[key] : item.id;
}

/* ── content validation (runs before generation in --write AND --check) ──── */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasLocalePair(value) {
  return value !== null && typeof value === 'object' && isNonEmptyString(value.en) && isNonEmptyString(value.ru);
}

// Case text fields are rendered through innerHTML on the case view
// (js/main.js mediaItemHTML/textFullHTML/buildInfoHTML), so raw markup and
// control characters are rejected at the validation gate — the mirror of the
// existing Free-Assets "<>" guard below (prod-review F1, findings C-03/D-05/
// D-06; the runtime escaping fix itself is tracked as A1-01). U+2028/U+2029
// additionally break inline <script> JS contexts when unescaped.
// eslint-disable-next-line no-control-regex -- intentional: the guard exists to REJECT control characters in content
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/;
// eslint-disable-next-line no-control-regex -- intentional: the guard exists to REJECT control characters in content
const MARKUP_OR_CONTROL_RE = /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/;

function checkPlainText(violations, where, label, value) {
  if (typeof value === 'string' && MARKUP_OR_CONTROL_RE.test(value)) {
    violations.push(`${where}: ${label} must not contain "<", ">" or control characters`);
  }
}

function checkPlainTextPair(violations, where, label, pair) {
  if (pair !== null && typeof pair === 'object') {
    checkPlainText(violations, where, `${label}.en`, pair.en);
    checkPlainText(violations, where, `${label}.ru`, pair.ru);
  }
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
    // F5: optional privacy hash for unlisted videos (vimeo.com/<id>/<hash>). Same
    // alphanumeric shape the runtime safeVimeoHash (/^[a-z0-9]+$/i) accepts.
    if ('vimeoHash' in block && (typeof block.vimeoHash !== 'string' || !/^[A-Za-z0-9]+$/.test(block.vimeoHash))) {
      violations.push(`${where}.vimeoHash: must be a string of alphanumeric characters ("${block.vimeoHash}")`);
    }
  } else {
    violations.push(`${where}.source: must be "local" or "vimeo" ("${block.source}")`);
  }
  // F5: layout/playback are now editable in admin → enforce the strict enums the
  // renderer consumes (layout drives wide/half rows, playback drives controls).
  if ('layout' in block && block.layout !== 'wide' && block.layout !== 'half') {
    violations.push(`${where}.layout: must be "wide" or "half" ("${block.layout}")`);
  }
  if ('playback' in block && block.playback !== 'ambient' && block.playback !== 'controlled') {
    violations.push(`${where}.playback: must be "ambient" or "controlled" ("${block.playback}")`);
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

  // "<>"/control guard over every HTML-emitted case text field (prod-review
  // F1, findings C-03/D-05/D-06 — the Free-Assets fields already had this).
  checkPlainTextPair(violations, where, 'card.title', card.title);
  checkPlainTextPair(violations, where, 'card.desc', card.desc);
  checkPlainTextPair(violations, where, 'card.alt', card.alt);
  checkPlainText(violations, where, 'card.thumbLabel', card.thumbLabel);
  checkPlainText(violations, where, 'year', c.year);
  checkPlainTextPair(violations, where, 'case.role', cs.role);
  if (Array.isArray(cs.tools)) {
    cs.tools.forEach((tool, i) => checkPlainText(violations, where, `case.tools[${i}]`, tool));
  }
  if (Array.isArray(cs.captions)) {
    cs.captions.forEach((caption, i) => {
      if (caption !== null && typeof caption === 'object') {
        checkPlainTextPair(violations, where, `case.captions[${i}].label`, caption.label);
        checkPlainTextPair(violations, where, `case.captions[${i}].desc`, caption.desc);
      }
    });
  }
  for (const block of ['text', 'inline']) {
    const value = cs[block];
    if (value !== null && typeof value === 'object') {
      checkPlainTextPair(violations, where, `case.${block}.title`, value.title);
      checkPlainTextPair(violations, where, `case.${block}.body`, value.body);
    }
  }
  if (Array.isArray(cs.motionBlocks)) {
    cs.motionBlocks.forEach((block, i) => {
      if (block !== null && typeof block === 'object') {
        checkPlainTextPair(violations, where, `case.motionBlocks[${i}].label`, block.label);
        checkPlainTextPair(violations, where, `case.motionBlocks[${i}].desc`, block.desc);
        // title feeds aria/data attributes of the motion shell (adversarial
        // F1 review).
        checkPlainText(violations, where, `case.motionBlocks[${i}].title`, block.title);
      }
    });
  }
  // palette values land in the style="background:…" attribute of the case
  // gallery (escaped at runtime since F2, guarded here as defense in depth —
  // prod-review F2, finding A2-11/A1-01).
  if (Array.isArray(cs.palette)) {
    cs.palette.forEach((color, i) => checkPlainText(violations, where, `case.palette[${i}]`, color));
  }
  // modelStats values render in the 3D info panel (buildInfoHTML → innerHTML,
  // escaped at runtime since F2) — adversarial F1 review found them outside
  // the guard.
  if (cs.modelStats !== null && typeof cs.modelStats === 'object' && !Array.isArray(cs.modelStats)) {
    for (const key of Object.keys(cs.modelStats)) {
      checkPlainText(violations, where, `case.modelStats.${key}`, cs.modelStats[key]);
    }
  }
  // i18nOverrides leaves end up in the same innerHTML render paths through
  // the locale dictionaries — walk every string leaf.
  (function walkOverrides(node, trail) {
    if (typeof node === 'string') {
      checkPlainText(violations, where, trail, node);
      return;
    }
    if (node !== null && typeof node === 'object') {
      for (const key of Object.keys(node)) walkOverrides(node[key], `${trail}.${key}`);
    }
  })(c.i18nOverrides, 'i18nOverrides');
}

// thumb/model conventions (see js/free-assets.js resolveAssetMedia): key absent
// → defaults to the item id; null → preview explicitly disabled (null marker);
// string → base file name without extension.
function checkFreeAssetMedia(violations, itemWhere, key, item, baseDir, extension) {
  const base = faEffectiveBase(item, key);
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
    // enabled (iteration H): optional strict boolean on categories AND items —
    // mirrors the case/filter rule; a truthy string would flip visibility.
    if ('enabled' in category && typeof category.enabled !== 'boolean') {
      violations.push(
        `${where}: category "${category.key}" "enabled" must be a boolean (got ${JSON.stringify(category.enabled)})`
      );
    }
    // tagCard (XSS/visibility batch): drives the generated overview tag card.
    // thumb is the cover SVG base name (./assets/cards/<thumb>.svg); gameAsset
    // is the optional boolean that emits the "Game" overlay badge.
    const tagCard = category.tagCard;
    if (tagCard === null || typeof tagCard !== 'object' || Array.isArray(tagCard)) {
      violations.push(
        `${where}: category "${category.key}" needs a "tagCard" object (cover thumb for the overview grid)`
      );
    } else {
      const tagBase = tagCard.thumb;
      if (!isNonEmptyString(tagBase) || tagBase.includes('/') || tagBase.includes('\\') || tagBase.includes('..')) {
        violations.push(
          `${where}: category "${category.key}" tagCard.thumb must be a plain base name without path separators (got ${JSON.stringify(tagBase)})`
        );
      } else {
        checkAssetFile(
          violations,
          `${where}: category "${category.key}" tagCard.thumb`,
          `./assets/cards/${tagBase}.svg`
        );
      }
      if ('gameAsset' in tagCard && typeof tagCard.gameAsset !== 'boolean') {
        violations.push(
          `${where}: category "${category.key}" tagCard.gameAsset must be a boolean (got ${JSON.stringify(tagCard.gameAsset)})`
        );
      }
    }
    for (const item of category.items) {
      if (item === null || typeof item !== 'object' || !isNonEmptyString(item.id)) {
        violations.push(`${where}: category "${category.key}" has an item without a string "id"`);
        continue;
      }
      const itemWhere = `${where}: ${category.key}/${item.id}`;
      if (seenIds.has(item.id)) violations.push(`${itemWhere}: duplicate id`);
      seenIds.add(item.id);
      if ('enabled' in item && typeof item.enabled !== 'boolean') {
        violations.push(`${itemWhere}: "enabled" must be a boolean (got ${JSON.stringify(item.enabled)})`);
      }
      if (!hasLocalePair(item.desc)) violations.push(`${itemWhere}: desc must have non-empty "en" and "ru"`);
      // These fields land verbatim in js/fa-data.js (see buildFaDataJs) and
      // render on the free-assets cards; an empty value breaks the card UI.
      // Defense in depth against stored XSS (the runtime appends title/size as
      // textContent, see js/free-assets.js): reject "<" and ">" so the values
      // can never carry HTML tags even if a future renderer regresses to
      // innerHTML. "file" is regex-guarded separately below; "&" stays allowed
      // (gradients/copy use it). Current content has none of these chars.
      for (const field of ['title', 'cat', 'badge', 'size', 'file', 'bg']) {
        if (!isNonEmptyString(item[field])) {
          violations.push(`${itemWhere}: "${field}" must be a non-empty string (got ${JSON.stringify(item[field])})`);
        } else if (field !== 'file' && /[<>]/.test(item[field])) {
          violations.push(`${itemWhere}: "${field}" must not contain "<" or ">" (got ${JSON.stringify(item[field])})`);
        }
      }
      // file lands in './downloads/' + file at runtime and (when the archive
      // exists in downloads/) in the JSON-LD contentUrl — plain name only.
      if (isNonEmptyString(item.file) && !/^[A-Za-z0-9._-]+\.zip$/i.test(item.file)) {
        violations.push(
          `${itemWhere}: "file" must be a plain ZIP file name like "${item.id}.zip" (got ${JSON.stringify(item.file)})`
        );
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

// og:image naming convention pinned by verify-frozen.js
// (META-og-image-index-specific / META-og-image-fa-specific): the
// page-specific basename plus an optional -<hash8> cache-bust suffix.
// Enforcing the same convention here turns a mismatch into a validation
// error at publish time instead of a verify FAIL with auto-revert of a
// legitimate publication (prod-review F1, finding D-03). Built from RegExp
// strings to avoid escape soup; "[.]" and "[/]" are literal characters.
const OG_BASENAME = {
  index: new RegExp('^[.][/]assets[/]img[/]og-image(-[0-9a-f]{8})?[.](jpg|jpeg|png|webp)$'),
  fa: new RegExp('^[.][/]assets[/]img[/]og-free-assets(-[0-9a-f]{8})?[.](jpg|jpeg|png|webp)$')
};

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
    if (isNonEmptyString(value) && !OG_BASENAME[page].test(value)) {
      violations.push(
        `${where}: ogImages.${page} must follow the "./assets/img/` +
          `${page === 'fa' ? 'og-free-assets' : 'og-image'}(-<hash8>).<ext>" naming convention ` +
          `pinned by verify-frozen.js ("${value}")`
      );
    }
  }
  // E-06: Organization.logo — square brand asset (>=112x112), validated like the
  // og images (present on disk + image extension) but with no basename convention.
  const orgLogo = images.orgLogo;
  checkAssetFile(violations, `${where}: ogImages.orgLogo`, orgLogo);
  if (isNonEmptyString(orgLogo) && !/\.(jpg|jpeg|png|webp)$/i.test(orgLogo)) {
    violations.push(`${where}: ogImages.orgLogo must be a .jpg/.jpeg/.png/.webp image ("${orgLogo}")`);
  }
  // og:locale is emitted verbatim and pinned by verify-frozen.js A6-og-locale
  // (en_US|ru_RU): a free-form locale passes the generic non-empty check and
  // only fails at verify time with auto-revert (prod-review F1, finding D-04).
  for (const lang of ['en', 'ru']) {
    for (const page of ['index', 'fa']) {
      const block = metaStrings && metaStrings[lang] && metaStrings[lang][page];
      const value = block && block.ogLocale;
      if (value !== undefined && !/^(en_US|ru_RU)$/.test(String(value))) {
        violations.push(`${where}: ${lang}.${page}.ogLocale must be "en_US" or "ru_RU" (got ${JSON.stringify(value)})`);
      }
    }
  }
  for (const page of ['index', 'fa']) {
    const pageStrings = (metaStrings && metaStrings.en && metaStrings.en[page]) || {};
    for (const field of HEAD_META_FIELDS) {
      if (!isNonEmptyString(pageStrings[field])) {
        violations.push(`${where}: en.${page}.${field} must be a non-empty string (emitted into the head GEN region)`);
      } else if (CONTROL_CHARS_RE.test(pageStrings[field])) {
        // Control characters and U+2028/U+2029 break the emitted HTML head
        // and script-embedded JSON (prod-review F1, finding D-06).
        violations.push(`${where}: en.${page}.${field} must not contain control characters`);
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

  // Iteration H guards (only when the categories array itself is sane):
  if (freeAssets !== null && typeof freeAssets === 'object' && Array.isArray(freeAssets.categories)) {
    const visibleFa = visibleFaCategories(content);
    // an empty FA catalog would break free-assets.html (and verify-frozen) —
    // at least one enabled item in an enabled category (mirror of the case
    // guard).
    if (visibleFa.length === 0) {
      violations.push(
        'content/free-assets.json: at least one free asset must stay visible (an enabled item in an enabled category) — the catalog cannot be empty'
      );
    }
    // the fa-filters GEN region takes the visible EN label of every visible
    // category from i18n-ui.json (filter.<key>); a missing label would emit
    // "undefined" into free-assets.html.
    for (const category of visibleFa) {
      const suffix = faFilterI18nKey(category.key).slice('filter.'.length);
      const label = uiStrings && uiStrings.en && uiStrings.en.filter && uiStrings.en.filter[suffix];
      if (!isNonEmptyString(label)) {
        violations.push(
          `content/i18n-ui.json: en.filter.${suffix} must be a non-empty string (label of the visible free-assets category "${category.key}")`
        );
      }
    }
    // buildFaFiltersRegion also renders labels.all (the "all" option of the
    // FA dropdown) — same guard as for the per-category labels above.
    for (const lang of ['en', 'ru']) {
      const allLabel = uiStrings && uiStrings[lang] && uiStrings[lang].filter && uiStrings[lang].filter.all;
      if (!isNonEmptyString(allLabel)) {
        violations.push(
          `content/i18n-ui.json: ${lang}.filter.all must be a non-empty string (label of the free-assets "all" filter option)`
        );
      }
    }
  }

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
const MOTION_KEYS = ['source', 'layout', 'playback', 'src', 'vimeoId', 'vimeoHash', 'poster', 'title'];

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

// A2-01/E-02/F-03: human-readable archive size from the real byte count (honest
// contentSize / Download label). Deterministic, no locale formatting.
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + ' MB';
  const gb = mb / 1024;
  return (gb < 10 ? gb.toFixed(1) : String(Math.round(gb))) + ' GB';
}

function buildFaDataJs(content) {
  const data = {};
  for (const category of visibleFaCategories(content)) {
    data[category.key] = category.items.map((item) => {
      const out = { id: item.id };
      if ('thumb' in item) out.thumb = item.thumb;
      if ('model' in item) out.model = item.model;
      out.cat = item.cat;
      out.title = item.title;
      out.desc = item.desc.en;
      out.badge = item.badge;
      out.contents = item.contents;
      out.file = item.file;
      // A2-01/E-02/F-03: archive presence (computed from downloads/ at generate
      // time) drives the runtime Download-button visibility; size from the REAL
      // file when present (stub → "412 B"), else the content size as fallback.
      const faArchivePath = path.join(ROOT, 'downloads', String(item.file || ''));
      out.hasFile = fs.existsSync(faArchivePath);
      out.size = out.hasFile ? formatBytes(fs.statSync(faArchivePath).size) : item.size;
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
  for (const category of visibleFaCategories(content)) {
    for (const item of category.items) {
      en[item.id] = { desc: item.desc.en };
      ru[item.id] = { desc: item.desc.ru };
    }
  }
  return { en, ru };
}

// faTag.<key>.count badges always reflect the visible item count of the
// category (XSS/visibility batch #11): instead of trusting the hand-maintained
// i18n string, override count for every visible category in BOTH locales. The
// current RU strings already mirror EN ("N assets"), so the computed value is
// byte-identical to the existing dictionaries. A clone keeps content.uiStrings
// (and thus the on-disk content) untouched.
function uiStringsWithCounts(content) {
  const clone = JSON.parse(JSON.stringify(content.uiStrings));
  const visible = visibleFaCategories(content);
  for (const lang of ['en', 'ru']) {
    const faTag = clone[lang] && clone[lang].faTag;
    if (!faTag || typeof faTag !== 'object') continue;
    for (const category of visible) {
      const camel = faTagKey(category.key).slice('faTag.'.length);
      if (faTag[camel] && typeof faTag[camel] === 'object') {
        faTag[camel].count = category.items.length + ' assets';
      }
    }
  }
  return clone;
}

function buildI18nDataJs(content) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8').replace(/\r\n/g, '\n');
  const replacements = {
    __UI_STRINGS__: uiStringsWithCounts(content),
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

// One <label> option of a tags dropdown — shared by the index (filters) and FA
// (fa-filters) regions. When `count` is omitted the count span is dropped, so
// both regions stay byte-identical to their historical hand-written markup.
function filterOptionLine(key, i18nKey, label, count) {
  const k = escapeHtmlAttr(key);
  const i18n = escapeHtmlAttr(i18nKey);
  // E-15: the dropdown is a group of native checkboxes, not an ARIA listbox — a
  // role="option" must not wrap an interactive control. The panel carries
  // role="group" + aria-label; each row is a plain <label> around its checkbox.
  const lines = [
    '          <label class="tags-dropdown__option">',
    `            <input type="checkbox" class="tags-dropdown__checkbox" data-filter="${k}" data-i18n-attr="aria-label:${i18n}" aria-label="${escapeHtmlAttr(label)}">`,
    `            <span class="tags-dropdown__label" data-i18n="${i18n}">${escapeHtmlText(label)}</span>`
  ];
  if (count !== undefined) {
    lines.push(`            <span class="tags-dropdown__option-count" id="opt-count-${k}">${count}</span>`);
  }
  lines.push('          </label>');
  return lines.join('\n');
}

// The checkbox row of the tags dropdown: only enabled filters are emitted.
// Line layout reproduces the pre-iteration-F bytes exactly, so the first
// generation is a no-op; values come from content/settings.json.
function buildFiltersRegion(content) {
  return enabledFilters(content)
    .map((filter) => filterOptionLine(filter.key, filterI18nKey(filter.key), filter.label))
    .join('\n');
}

/* ── fa-filters GEN region (iteration H, byte-identical templating) ───────── */

// data-i18n key of an FA category checkbox. The FA dropdown historically
// reuses the shared filter.* dictionary but with FA-specific wording for two
// keys ('product' → 'Product Viz', 'game' → 'Game Assets'); the rest follow
// the same camelCase convention as the index filters.
const FA_FILTER_I18N_SUFFIX = { product: 'productViz', game: 'gameAssets' };

function faFilterI18nKey(key) {
  // FA-specific wording for two keys; everything else follows the shared
  // kebab→camel convention (delegate to filterI18nKey, no duplicated regex).
  if (FA_FILTER_I18N_SUFFIX[key]) return 'filter.' + FA_FILTER_I18N_SUFFIX[key];
  return filterI18nKey(key);
}

// The checkbox row of the FA tags dropdown: 'all' plus one option per visible
// category, each with its visible item count ('all' counts the categories).
// Line layout reproduces the pre-iteration-H bytes exactly, so the first
// generation is a no-op; labels come from content/i18n-ui.json (EN locale).
function buildFaFiltersRegion(content) {
  const visible = visibleFaCategories(content);
  const labels = (content.uiStrings && content.uiStrings.en && content.uiStrings.en.filter) || {};
  const rows = [filterOptionLine('all', 'filter.all', labels.all, visible.length)];
  for (const category of visible) {
    const i18nKey = faFilterI18nKey(category.key);
    rows.push(filterOptionLine(category.key, i18nKey, labels[i18nKey.slice('filter.'.length)], category.items.length));
  }
  return rows.join('\n');
}

/* ── fa-tag-cards GEN region (XSS/visibility batch, byte-identical templating) ─
 *
 * The tag-card overview grid in free-assets.html used to be hand-written static
 * markup outside any GEN region. That meant an admin category reorder/disable
 * never reached the page and the runtime had to prune hidden cards after the
 * fact. It is now generated from visibleFaCategories(content) in content order,
 * only visible categories, so:
 *   #2  category order/visibility reaches the overview grid;
 *   #6  main.js captures the NodeList of the already-correct cards at parse
 *       time, so #cards-count is right on its own (pruneHiddenTagCards is gone);
 *   #10 firstAvailableTag is deterministic (first emitted .tag-card[data-tag]);
 *   #11 the per-category count badge is the live visible item count.
 *
 * Editorial fields that cannot be derived from the catalog live in
 * content/free-assets.json category.tagCard:
 *   thumb     — the cover SVG base name (./assets/cards/<thumb>.svg);
 *   gameAsset — true only for the game category (emits the "Game" overlay badge
 *               and data-game-asset="true").
 * Everything else (comment label, alt, cat, title, desc, format, count text)
 * comes from the faTag.<key> i18n strings / item counts, so the first
 * generation reproduces the historical bytes exactly.
 */

// data-i18n key prefix of an FA tag card: 'hard-surface' → 'faTag.hardSurface'.
// Plain kebab→camel (no FA filter special-casing — these keys predate it).
function faTagKey(key) {
  return 'faTag.' + String(key).replace(/-([a-z])/g, (_m, ch) => ch.toUpperCase());
}

function buildFaTagCardsRegion(content) {
  const visible = visibleFaCategories(content);
  const en = (content.uiStrings && content.uiStrings.en) || {};
  const filterLabels = (en.filter && typeof en.filter === 'object' && en.filter) || {};
  const faTag = (en.faTag && typeof en.faTag === 'object' && en.faTag) || {};

  const cards = visible.map((category, index) => {
    const key = category.key;
    const tag = category.tagCard || {};
    const camel = faTagKey(key).slice('faTag.'.length);
    const t = faTag[camel] || {};
    // The card comment / data-label reuse the FA filter label of the category
    // ("Hard Surface", "Product Viz", "Game Assets", …) — matches the bytes.
    const label = filterLabels[faFilterI18nKey(key).slice('filter.'.length)] || '';
    const isFirst = index === 0;
    const gameAsset = tag.gameAsset === true;
    const count = category.items.length + ' assets';

    const cls = isFirst ? 'tag-card tag-card--active work-card' : 'tag-card work-card';
    const imgLine2 = isFirst
      ? '                 loading="eager" fetchpriority="high" decoding="async" width="800" height="600">'
      : '                 loading="lazy" decoding="async" width="800" height="600">';

    const lines = [
      `        <!-- TAG CARD: ${escapeHtmlText(label)} -->`,
      `        <a class="${cls}" id="tag-${escapeHtmlAttr(key)}" href="#${escapeHtmlAttr(key)}"`,
      `                 data-tag="${escapeHtmlAttr(key)}" data-category="${escapeHtmlAttr(key)}" data-game-asset="${gameAsset ? 'true' : 'false'}">`,
      `          <div class="tag-card__thumb work-card__thumb" data-label="${escapeHtmlAttr(label)}">`,
      `            <img src="./assets/cards/${escapeHtmlAttr(tag.thumb)}.svg" data-i18n-attr="alt:faTag.${camel}.alt" alt="${escapeHtmlAttr(t.alt)}"`,
      imgLine2
    ];
    if (gameAsset) {
      lines.push(
        '            <!-- v0.4 [HV3]: убран aria-label на <span> — у span нет implicit role,',
        '                 aria-label игнорируется. Текст "Game" уже семантически достаточен. -->',
        `            <span class="work-card__badge" data-i18n="faTag.${camel}.badge">${escapeHtmlText(t.badge)}</span>`,
        '            <!-- v0.4 [M2]: убран лишний inline style — CSS уже задаёт top/right по умолчанию -->'
      );
    }
    lines.push(
      `            <span class="tag-card__count-badge" data-i18n="faTag.${camel}.count">${escapeHtmlText(count)}</span>`,
      '          </div>',
      '          <div class="tag-card__info work-card__info">',
      '            <div class="tag-card__meta work-card__meta">',
      `              <span class="tag-card__cat work-card__cat" data-i18n="faTag.${camel}.cat">${escapeHtmlText(t.cat)}</span>`,
      `              <span class="tag-card__meta-tail work-card__meta-tail"><span class="tag-card__format work-card__year" data-i18n="faTag.${camel}.format">${escapeHtmlText(t.format)}</span><span class="tag-card__hint work-card__hint" aria-hidden="true">↗</span></span>`,
      '            </div>',
      `            <h2 class="tag-card__title work-card__title" data-i18n="faTag.${camel}.title">${escapeHtmlText(t.title)}</h2>`,
      `            <p class="tag-card__desc work-card__desc" data-i18n="faTag.${camel}.desc">${escapeHtmlText(t.desc)}</p>`,
      '          </div>',
      '        </a>'
    );
    return lines.join('\n');
  });

  // Leading/trailing blank line reproduce the historical layout (blank after the
  // cards-list div, blank before its closing tag).
  return '\n' + cards.join('\n\n') + '\n';
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
      '  <link rel="alternate" hreflang="x-default" href="https://codex.promo/">',
      '  <link rel="alternate" hreflang="en"        href="https://codex.promo/">',
      '  <link rel="alternate" hreflang="ru"        href="https://codex.promo/?lang=ru">',
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
      `  <meta name="twitter:image"          content="${og}">`,
      `  <meta name="twitter:image:alt"      data-i18n-meta="index.ogImageAlt" content="${a(m.ogImageAlt)}">`
    ].join('\n');
  }
  return [
    `  <title data-i18n-meta="fa.title">${escapeHtmlText(m.title)}</title>`,
    '',
    `  <meta name="description" data-i18n-meta="fa.description" content="${a(m.description)}">`,
    '  <link rel="canonical" href="https://codex.promo/free-assets.html">',
    '  <link rel="alternate" hreflang="x-default" href="https://codex.promo/free-assets.html">',
    '  <link rel="alternate" hreflang="en"        href="https://codex.promo/free-assets.html">',
    '  <link rel="alternate" hreflang="ru"        href="https://codex.promo/free-assets.html?lang=ru">',
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
    `  <meta name="twitter:image"          content="${og}">`,
    `  <meta name="twitter:image:alt"      data-i18n-meta="fa.ogImageAlt" content="${a(m.ogImageAlt)}">`
  ].join('\n');
}

/* ── jsonld GEN region (iteration G, byte-identical templating) ──────────── */

// JSON string literal for the hand-formatted JSON-LD blocks (the blocks keep
// the historical 2-space indentation, so values are interpolated one by one).
function j(value) {
  // "<" goes out as its JSON unicode escape u003c (same parsed value): a raw
  // "</script>" inside a value would otherwise close the surrounding
  // <script type="application/ld+json"> block early and inject markup into
  // <head> (prod-review F1, finding C-02/D-05). U+2028/U+2029 get the same
  // treatment as defense in depth for script-embedded JSON.
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
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
    `    "logo": ${j(absoluteAssetUrl(content.metaStrings.ogImages.orgLogo))},`,
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

// free-assets.html catalog ItemList: name/description/encodingFormat are
// SEO-specific copy that never came from content/free-assets.json (crafted
// for crawlers), so they stay literal HERE, keyed by item id. Everything
// else is derived from content (iteration H): the list = visible items of
// the curated category in their content order (a hidden item leaves no SEO
// ghost, positions renumber), contentSize = item.size, thumbnailUrl = the
// item's effective thumb (null → the FA OG image owners replace via the
// admin), contentUrl = emitted only when downloads/<file> exists in the repo.
const FA_JSONLD_CATEGORY = 'hard-surface';
const FA_JSONLD_COPY = {
  'orbital-mk-ii': {
    name: 'Orbital Mk.II free hard-surface 3D asset',
    description: 'Sci-fi prop with clean topology, full PBR texture set, and Blender, FBX, OBJ delivery.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/obj', 'model/gltf-binary']
  },
  'vega-shell': {
    name: 'Vega Shell free modular armor asset',
    description: 'Modular exo-armor system with 47 snap-together parts, clean UVs, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary']
  },
  'ironclad-frame': {
    name: 'Ironclad Frame free industrial chassis asset',
    description: 'Industrial chassis breakdown with modeled bolts, PBR textures, wire renders, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary']
  },
  'bolt-cluster': {
    name: 'Bolt Cluster free industrial fastener kit',
    description: 'Industrial fastener kit with 12 variants, GeoNodes scatter setup, Blender file and 2K textures.',
    encodingFormat: ['application/x-blender', 'model/gltf-binary', 'image/png']
  },
  'terra-base': {
    name: 'Terra Base free modular environment kit',
    description: 'Modular environment kit with 24 tileable pieces, GeoNodes scatter system, and 4K textures.',
    encodingFormat: ['application/x-blender', 'model/gltf-binary', 'image/png']
  },
  'shard-cannon': {
    name: 'Shard Cannon free sci-fi weapon asset',
    description: 'Sci-fi heavy weapon with three skin variations, UE5-compatible export, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary', 'image/png']
  },
  'wraith-blade': {
    name: 'Wraith Blade free melee weapon asset',
    description: 'Thin melee weapon with emissive edge variant, PBR textures, Blender and FBX files.',
    encodingFormat: ['application/x-blender', 'model/vnd.fbx', 'model/gltf-binary', 'image/png']
  },
  'apex-frame': {
    name: 'Apex Frame free mechanical component asset',
    description: 'Mechanical component breakdown with STEP file, exploded rig, textures, README and Blender source.',
    encodingFormat: ['application/x-blender', 'model/step', 'model/gltf-binary', 'text/plain']
  }
};

function buildFaJsonLdRegion(content) {
  const faOg = absoluteAssetUrl(content.metaStrings.ogImages.fa);
  const visibleCategories = visibleFaCategories(content);
  const itemCount = visibleCategories.reduce((sum, category) => sum + category.items.length, 0);
  const curatedCategory = visibleCategories.find((category) => category.key === FA_JSONLD_CATEGORY);
  const curated = (curatedCategory ? curatedCategory.items : []).filter((item) => FA_JSONLD_COPY[item.id]);
  const items = curated.map((item, i) => {
    const copy = FA_JSONLD_COPY[item.id];
    const thumbBase = faEffectiveBase(item, 'thumb');
    const hasDownload = fs.existsSync(path.join(ROOT, 'downloads', item.file));
    // Build the "item" object's properties as a list joined with commas, so the
    // optional members (thumbnailUrl, contentSize, contentUrl) compose without
    // trailing-comma juggling.
    const itemProps = [
      '          "@type": "3DModel"',
      `          "name": ${j(copy.name)}`,
      `          "description": ${j(copy.description)}`,
      `          "encodingFormat": [${copy.encodingFormat.map(j).join(', ')}]`,
      '          "license": "https://creativecommons.org/publicdomain/zero/1.0/"',
      '          "isAccessibleForFree": true'
    ];
    // E-05: advertise a thumbnailUrl only when the asset has a real cover SVG. An
    // asset with thumb:null no longer borrows the page OG image as a dishonest
    // thumbnail — it simply carries no thumbnailUrl.
    if (thumbBase) {
      itemProps.push(`          "thumbnailUrl": ${j(absoluteAssetUrl(`./assets/cards/${thumbBase}.svg`))}`);
    }
    // A2-01/E-02/F-03: contentSize + contentUrl only when the archive really
    // exists in downloads/ — honest structured data (no fabricated "48 MB" for a
    // missing/stub file). contentSize derived from the real byte count.
    if (hasDownload) {
      const faArchiveBytes = fs.statSync(path.join(ROOT, 'downloads', item.file)).size;
      itemProps.push(`          "contentSize": ${j(formatBytes(faArchiveBytes))}`);
      itemProps.push(`          "contentUrl": ${j(`https://codex.promo/downloads/${item.file}`)}`);
    }
    const lines = [
      '      {',
      '        "@type": "ListItem",',
      `        "position": ${i + 1},`,
      `        "url": ${j(`https://codex.promo/free-assets.html#${item.id}`)},`,
      '        "item": {',
      itemProps.join(',\n'),
      '        }',
      '      }'
    ];
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

// lastmod follows the last commit that touched content/ — admin publications
// ARE content milestones, and the previous hand-written literal would have
// stayed frozen for every future publish (prod-review F1, finding E-03).
// NOTE (adversarial F1 review): the date is NOT stable across commits — any
// new commit touching content/ moves it while the committed sitemap still
// carries the previous date. --check therefore compares sitemap.xml MODULO
// the lastmod value (see main()); only --write refreshes the real date.
// Falls back to the last hand-written literal in a git-less environment.
const SITEMAP_LASTMOD_FALLBACK = '2026-05-30';
let cachedContentLastmod = null;
function contentLastmod() {
  if (cachedContentLastmod !== null) return cachedContentLastmod;
  let value = SITEMAP_LASTMOD_FALLBACK;
  try {
    const out = execSync('git log -1 --format=%cs -- content/', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(out)) value = out;
  } catch {
    // keep the fallback
  }
  cachedContentLastmod = value;
  return value;
}

// The whole file is regenerated; no generated-file banner on purpose — the
// first generation must be byte-identical to the hand-written sitemap.
function buildSitemapXml(content) {
  const images = content.metaStrings.ogImages;
  // E-01: each logical page gets an EN/x-default <url> AND a ?lang=ru <url>, both
  // carrying reciprocal xhtml:link alternates so the RU variant is crawl-
  // discoverable (owner decision: index RU). The EN block stays FIRST with its
  // image:image so the F1-sitemap-* regex (loc + image:loc in the same <url>,
  // negative-lookahead on </url>) keeps matching the EN image.
  const pages = [
    { base: 'https://codex.promo/', img: absoluteAssetUrl(images.index), title: 'Codex Studio — 3D design portfolio', changefreq: 'weekly', priority: '1.0' },
    { base: 'https://codex.promo/free-assets.html', img: absoluteAssetUrl(images.fa), title: 'Codex Studio — Free 3D assets catalog', changefreq: 'monthly', priority: '0.7' }
  ];
  const ruHref = (base) => base + (base.includes('?') ? '&' : '?') + 'lang=ru';
  const altLinks = (base) => [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${base}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${base}"/>`,
    `    <xhtml:link rel="alternate" hreflang="ru" href="${ruHref(base)}"/>`
  ];
  const urlBlock = (loc, page) => [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${contentLastmod()}</lastmod>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    ...altLinks(page.base),
    '    <image:image>',
    `      <image:loc>${page.img}</image:loc>`,
    `      <image:title>${page.title}</image:title>`,
    '    </image:image>',
    '  </url>'
  ];
  const urls = [];
  for (const page of pages) {
    urls.push(...urlBlock(page.base, page));          // EN/x-default first
    urls.push(...urlBlock(ruHref(page.base), page));  // ?lang=ru variant
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
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
  faNext = replaceRegion(faNext, 'free-assets.html', FA_FILTERS_BEGIN, FA_FILTERS_END, buildFaFiltersRegion(content));
  faNext = replaceRegion(
    faNext,
    'free-assets.html',
    FA_TAG_CARDS_BEGIN,
    FA_TAG_CARDS_END,
    buildFaTagCardsRegion(content)
  );

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
    let same = onDisk === target.next.replace(/\r\n/g, '\n');
    // sitemap lastmod is compared MODULO the date in --check (prod-review F2,
    // adversarial finding on F1/E-03): the date follows the last commit that
    // touched content/, so the moment such a commit lands (a publication, an
    // auto-revert, a local content edit committed together with its
    // regeneration) the committed sitemap is one date behind and a strict
    // byte comparison would turn content:check red repo-wide. --write still
    // refreshes the real date; --check only proves the structure matches.
    if (!same && mode === '--check' && target.rel === 'sitemap.xml' && onDisk !== null) {
      const stripLastmod = (text) => text.replace(/^\s*<lastmod>[0-9-]*<\/lastmod>$/gm, '<lastmod/>');
      same = stripLastmod(onDisk) === stripLastmod(target.next.replace(/\r\n/g, '\n'));
    }
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
