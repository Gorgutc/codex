#!/usr/bin/env node
/**
 * Migrate legacy CARDS_DATA + index.html work-cards → Astro Content Collection.
 *
 * Source of truth:
 *   • codex/js/main.js       — CARDS_DATA (role, tools, modelSrc, modelStats, items)
 *   • codex/index.html       — title/description/year/category/data-game-asset flags
 *   • codex/assets/cards/<id>.svg       — thumbnail (copied 1:1)
 *   • codex/assets/cases/<id>/01..05.svg — gallery slides (copied 1:1)
 *
 * Destination:
 *   • v2_astro/src/content/works/<slug>.md
 *   • v2_astro/public/works/<slug>/thumb.svg
 *   • v2_astro/public/works/<slug>/01..05.svg
 *
 * Run from the v2_astro/ directory:  node scripts/migrate-cards-data.mjs
 * Idempotent — overwrites .md files and SVGs on every run.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2_ROOT = resolve(__dirname, '..');
const LEGACY_ROOT = resolve(V2_ROOT, '..');
const LEGACY_MAIN_JS = join(LEGACY_ROOT, 'js', 'main.js');
const LEGACY_INDEX_HTML = join(LEGACY_ROOT, 'index.html');
const LEGACY_CARDS_DIR = join(LEGACY_ROOT, 'assets', 'cards');
const LEGACY_CASES_DIR = join(LEGACY_ROOT, 'assets', 'cases');
const CONTENT_DIR = join(V2_ROOT, 'src', 'content', 'works');
const PUBLIC_WORKS_DIR = join(V2_ROOT, 'public', 'works');

// ── Category mapping ────────────────────────────────────────────────────────
// Legacy kebab → canonical Title Case (Stage 3 decision). 'prototyping' folds
// into 'Mechanical'; game-asset is a separate boolean flag that ALSO adds
// the 'Game Asset' category so the filter works without a second pass.
const CATEGORY_MAP = {
  'hard-surface': ['Hard Surface'],
  product: ['Product Viz'],
  organic: ['Organic'],
  prototyping: ['Mechanical'],
  animations: ['Animation'],
  cad: ['CAD'],
};

// Featured works for the homepage ItemList (project_brief.md v0.8).
const FEATURED_SLUGS = new Set(['orbital-mk-ii', 'corten-series', 'apex-frame', 'nightshard']);

// External modelSrc URLs are legacy stubs (modelviewer.dev / Khronos sample
// helmet) — they must NOT survive the migration as canonical model paths.
// We blank these out so Stage 6 explicitly drops them in or wires the real GLBs.
function sanitizeModelSrc(src) {
  if (!src) return undefined;
  if (/^https?:\/\//.test(src)) return undefined;
  // Rewrite ./assets/models/foo.glb → /models/foo.glb (served from public/).
  return src.replace(/^\.\/assets\/models\//, '/models/');
}

// ── 1. Extract CARDS_DATA via sandboxed vm ──────────────────────────────────
function loadCardsData() {
  const mainJs = readFileSync(LEGACY_MAIN_JS, 'utf8');

  // Locate the object literal: `var CARDS_DATA = { … };`.
  // The body spans from the opening `{` to the matching `};` at file scope.
  const startMarker = 'var CARDS_DATA = {';
  const startIdx = mainJs.indexOf(startMarker);
  if (startIdx === -1) throw new Error('CARDS_DATA marker not found in main.js');

  // Walk forward, tracking nesting, until we hit the matching `}` followed by `;`.
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx + startMarker.length - 1; i < mainJs.length; i++) {
    const ch = mainJs[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error('CARDS_DATA closing brace not found');

  const objectLiteral = mainJs.slice(startIdx + 'var CARDS_DATA = '.length, endIdx);

  // makeItems stub: mirrors the legacy implementation from main.js so the
  // returned shape matches `{ media: [5], text, inline }` exactly. Keeping
  // the same code path avoids divergence if the legacy layout (1 wide,
  // 2 tall, 1 wide, 1 tall) is referenced elsewhere downstream.
  const sandbox = {
    makeItems(cfg) {
      const media = [
        { type: 'image', format: 'wide', src: `./assets/cases/${cfg.id}/01.svg` },
        { type: 'image', format: 'tall', src: `./assets/cases/${cfg.id}/02.svg` },
        { type: 'image', format: 'tall', src: `./assets/cases/${cfg.id}/03.svg` },
        { type: 'image', format: 'wide', src: `./assets/cases/${cfg.id}/04.svg` },
        { type: 'image', format: 'tall', src: `./assets/cases/${cfg.id}/05.svg` },
      ];
      for (let i = 0; i < 5; i++) {
        if (cfg.srcs && cfg.srcs[i]) media[i].src = cfg.srcs[i];
        media[i].bg = cfg.palette[i];
        media[i].label = cfg.captions[i].label;
        media[i].desc = cfg.captions[i].desc;
        media[i].enabled = true;
      }
      return { media, text: cfg.text || null, inline: cfg.inline || null };
    },
  };
  const result = vm.runInNewContext(`(${objectLiteral})`, sandbox, { timeout: 5_000 });
  return result;
}

// ── 2. Parse work-card metadata from index.html ─────────────────────────────
function parseWorkCards() {
  const html = readFileSync(LEGACY_INDEX_HTML, 'utf8');
  const cards = {};

  // Greedy block per card: <a class="work-card" data-id="…" …> … </a>
  const cardRe =
    /<a\s+class="work-card"[^>]*data-id="([^"]+)"[^>]*data-category="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const [, slug, categoryKebab, extraAttrs, body] = m;
    const titleM = body.match(/work-card__title[^>]*>([^<]+)</);
    const descM = body.match(/work-card__desc[^>]*>([^<]+)</);
    const catLabelM = body.match(/work-card__cat[^>]*>([^<]+)</);
    const yearM = body.match(/work-card__year[^>]*>([^<]+)</);
    cards[slug] = {
      slug,
      categoryKebab,
      title: titleM ? decodeHtml(titleM[1].trim()) : slug,
      description: descM ? decodeHtml(descM[1].trim()) : '',
      categoryLabel: catLabelM ? catLabelM[1].trim() : '',
      year: yearM ? parseInt(yearM[1].trim(), 10) : new Date().getFullYear(),
      gameAsset: /data-game-asset="true"/.test(extraAttrs),
      cadPlaceholder: /data-cad-placeholder="true"/.test(extraAttrs),
    };
  }
  return cards;
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── 3. Build the canonical category array per work ──────────────────────────
function resolveCategories(card) {
  const mapped = CATEGORY_MAP[card.categoryKebab];
  if (!mapped) throw new Error(`Unknown legacy category: ${card.categoryKebab} (slug=${card.slug})`);
  const cats = [...mapped];
  if (card.gameAsset && !cats.includes('Game Asset')) cats.unshift('Game Asset');
  return cats;
}

// ── 4. Emit .md file with frontmatter + body ────────────────────────────────
function makeMarkdown(card, cd, order) {
  const items = cd.items;
  const media = items?.media ?? [];
  // Filter out media slides explicitly disabled in the legacy data.
  const gallery = media
    .filter((m) => m.enabled !== false)
    .map((m, idx) => {
      // Preserve the original filename + extension so PNG overrides (e.g.
      // orbital-mk-ii/02.png) don't get silently rewritten to .svg.
      let src;
      if (m.src && /^https?:\/\//.test(m.src)) {
        src = m.src;
      } else if (m.src) {
        src = `/works/${card.slug}/${m.src.split('/').pop()}`;
      } else {
        src = `/works/${card.slug}/${String(idx + 1).padStart(2, '0')}.svg`;
      }
      return {
        src,
        alt: `${card.title} — ${m.label ?? 'render'}`,
        type: 'image',
        format: m.format ?? 'wide',
        label: m.label,
        description: m.desc,
        bg: m.bg,
      };
    });

  const categories = resolveCategories(card);

  const specs = {
    tools: cd.tools,
    software: cd.modelStats?.software ? [cd.modelStats.software] : undefined,
    polycount: cd.modelStats?.triangles,
    vertices: cd.modelStats?.vertices,
    materials: cd.modelStats?.materials,
    textures: cd.modelStats?.textures,
  };
  // Strip empty values from specs.
  for (const k of Object.keys(specs)) if (specs[k] === undefined) delete specs[k];

  const frontmatter = {
    title: card.title,
    slug: card.slug,
    year: card.year,
    category: categories,
    role: cd.role,
    description: card.description,
    thumb: {
      src: `/works/${card.slug}/thumb.svg`,
      alt: `${card.title} thumbnail`,
    },
    gallery,
    intro: items?.text ?? undefined,
    inline: items?.inline ?? undefined,
    specs: Object.keys(specs).length ? specs : undefined,
    modelSrc: sanitizeModelSrc(cd.modelSrc),
    cadPlaceholder: card.cadPlaceholder || undefined,
    gameAsset: card.gameAsset || undefined,
    featured: FEATURED_SLUGS.has(card.slug) || undefined,
    order,
  };

  // Strip undefined keys so the YAML stays clean.
  for (const k of Object.keys(frontmatter)) {
    if (frontmatter[k] === undefined) delete frontmatter[k];
  }

  const yaml = toYaml(frontmatter);
  const intro = items?.text?.body
    ? `\n\n${items.text.body}\n`
    : `\n\n${card.description}\n`;

  return `---\n${yaml}---${intro}`;
}

// Minimal YAML emitter — handles the shapes we generate (strings, numbers,
// booleans, arrays of primitives or single-level objects). Quotes any string
// containing YAML-significant characters or leading whitespace.
function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
        continue;
      }
      lines.push(`${pad}${key}:`);
      for (const v of value) {
        if (v && typeof v === 'object') {
          // Array of objects — '-' on first key, rest indented one extra.
          const entries = Object.entries(v).filter(([, vv]) => vv !== undefined && vv !== null);
          if (entries.length === 0) continue;
          const [firstKey, firstVal] = entries[0];
          lines.push(`${pad}  - ${firstKey}: ${formatScalar(firstVal)}`);
          for (let i = 1; i < entries.length; i++) {
            const [k, vv] = entries[i];
            lines.push(`${pad}    ${k}: ${formatScalar(vv)}`);
          }
        } else {
          lines.push(`${pad}  - ${formatScalar(v)}`);
        }
      }
    } else if (value && typeof value === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value, indent + 1));
    } else {
      lines.push(`${pad}${key}: ${formatScalar(value)}`);
    }
  }
  return lines.join('\n') + (indent === 0 ? '\n' : '');
}

function formatScalar(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  // Quote if contains YAML-significant chars, leading/trailing whitespace,
  // looks like a number/bool, or starts with reserved chars.
  if (
    /[:#&*!|>'"%@`{}\[\],?\\]/.test(s) ||
    /^\s|\s$/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s) ||
    /^-?\d/.test(s) ||
    s === ''
  ) {
    return `'${s.replace(/'/g, "''")}'`;
  }
  return s;
}

// ── 5. Copy thumbnail + gallery SVGs ────────────────────────────────────────
function copyAssets(slug) {
  const slugDir = join(PUBLIC_WORKS_DIR, slug);
  mkdirSync(slugDir, { recursive: true });

  // Thumbnail.
  const thumbSrc = join(LEGACY_CARDS_DIR, `${slug}.svg`);
  if (existsSync(thumbSrc)) {
    copyFileSync(thumbSrc, join(slugDir, 'thumb.svg'));
  } else {
    console.warn(`  ! missing thumb: ${thumbSrc}`);
  }

  // Gallery SVGs (01.svg … 05.svg) + any extras the case directory ships.
  const caseDir = join(LEGACY_CASES_DIR, slug);
  if (existsSync(caseDir)) {
    for (const file of readdirSync(caseDir)) {
      if (file.endsWith('.svg') || file.endsWith('.png') || file.endsWith('.webp')) {
        copyFileSync(join(caseDir, file), join(slugDir, file));
      }
    }
  } else {
    console.warn(`  ! missing case dir: ${caseDir}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  console.log('▶ Loading CARDS_DATA…');
  const cardsData = loadCardsData();
  console.log(`  parsed ${Object.keys(cardsData).length} entries`);

  console.log('▶ Parsing index.html work-cards…');
  const htmlCards = parseWorkCards();
  console.log(`  parsed ${Object.keys(htmlCards).length} cards`);

  mkdirSync(CONTENT_DIR, { recursive: true });
  mkdirSync(PUBLIC_WORKS_DIR, { recursive: true });

  // Iterate in HTML order so `order` matches the legacy sidebar layout.
  const order = Object.keys(htmlCards);
  for (let i = 0; i < order.length; i++) {
    const slug = order[i];
    const card = htmlCards[slug];
    const cd = cardsData[slug];
    if (!cd) {
      console.warn(`  ! CARDS_DATA missing for ${slug}, skipping`);
      continue;
    }
    const md = makeMarkdown(card, cd, i + 1);
    writeFileSync(join(CONTENT_DIR, `${slug}.md`), md);
    copyAssets(slug);
    console.log(`  ✓ ${String(i + 1).padStart(2, '0')}  ${slug}`);
  }

  console.log('Done.');
}

main();
