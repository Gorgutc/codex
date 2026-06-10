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
 *                                <!-- CODEX:GEN cards-grid BEGIN/END --> markers
 *
 * Usage:
 *   node scripts/generate-content.mjs --write   # write targets to disk
 *   node scripts/generate-content.mjs --check   # exit 1 if any target differs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'i18n-data.tpl.js');

const GRID_BEGIN = '<!-- CODEX:GEN cards-grid BEGIN -->';
const GRID_END = '<!-- CODEX:GEN cards-grid END -->';

/* ── content loading ─────────────────────────────────────────────────────── */

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, relPath), 'utf8'));
}

function loadContent() {
  const settings = readJson('settings.json');
  const cases = settings.cardOrder.map((id) => {
    const data = readJson(path.join('cases', `${id}.json`));
    if (data.id !== id) throw new Error(`content/cases/${id}.json: id mismatch ("${data.id}")`);
    return data;
  });
  const freeAssets = readJson('free-assets.json');
  const uiStrings = readJson('i18n-ui.json');
  const metaStrings = readJson('meta.json');

  const filterKeys = new Set(settings.filters.map((f) => f.key));
  for (const c of cases) {
    if (!filterKeys.has(c.category)) throw new Error(`${c.id}: unknown category "${c.category}"`);
  }
  return { settings, cases, freeAssets, uiStrings, metaStrings };
}

function enabledCases(content) {
  return content.cases.filter((c) => c.enabled !== false);
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
  for (const c of enabledCases(content)) data[c.id] = buildCaseEntry(c);
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
  for (const c of enabledCases(content)) {
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
  for (const c of enabledCases(content)) {
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
    __META_STRINGS__: content.metaStrings,
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
  return enabledCases(content)
    .map((c) => buildCardHtml(c, labels[c.category]))
    .join('\n\n');
}

function splitByMarkers(html, filePath) {
  const lines = html.split('\n');
  const beginIdx = lines.findIndex((line) => line.trim() === GRID_BEGIN);
  const endIdx = lines.findIndex((line) => line.trim() === GRID_END);
  if (beginIdx < 0 || endIdx < 0 || endIdx <= beginIdx) {
    throw new Error(`${filePath}: CODEX:GEN cards-grid markers not found or malformed`);
  }
  return {
    head: lines.slice(0, beginIdx + 1).join('\n'),
    region: lines.slice(beginIdx + 1, endIdx).join('\n'),
    tail: lines.slice(endIdx).join('\n')
  };
}

/* ── targets, --write / --check ──────────────────────────────────────────── */

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function buildTargets(content) {
  const indexPath = path.join(ROOT, 'index.html');
  const indexRaw = fs.readFileSync(indexPath, 'utf8');
  const eol = detectEol(indexRaw);
  const parts = splitByMarkers(indexRaw.replace(/\r\n/g, '\n'), 'index.html');
  const indexNext = [parts.head, buildGridRegion(content), parts.tail].join('\n');

  return [
    { rel: 'js/cards-data.js', next: buildCardsDataJs(content), eol: '\n' },
    { rel: 'js/fa-data.js', next: buildFaDataJs(content), eol: '\n' },
    { rel: 'js/i18n-data.js', next: buildI18nDataJs(content), eol: '\n' },
    { rel: 'index.html', next: indexNext, eol }
  ];
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('Usage: node scripts/generate-content.mjs --write | --check');
    process.exit(2);
  }

  const content = loadContent();
  const targets = buildTargets(content);
  let diffs = 0;

  for (const target of targets) {
    const fullPath = path.join(ROOT, target.rel);
    const onDisk = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n') : null;
    const same = onDisk === target.next;
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
