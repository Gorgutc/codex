#!/usr/bin/env node
/**
 * verify-v2.mjs — Stage 11a static DOM regression for the v2 build.
 *
 * Adapts the legacy verify-frozen.js (codex/verify-frozen.js, v0.4 GOLDEN)
 * to the Astro 5 + MPA layout.  Runs against the built dist/ HTML tree
 * via jsdom — no browser launch, no http server.  Behaviour-dependent
 * cases (filter click, kbd nav, copy-link toast) are out of scope here
 * and belong to a later Playwright pass.
 *
 * Run:
 *   npm run build && npm test
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');

const EXPECTED_IDS = [
  'orbital-mk-ii', 'vega-shell', 'ironclad-frame', 'corten-series', 'lumen-one',
  'flux-capsule', 'nightshard', 'recon-drone', 'apex-frame', 'core-rig',
  'helix-reveal', 'arc-motion', 'nyx-panther', 'drift-koi', 'glint-owl',
  'mech-link', 'flex-spine', 'cad-strut',
];
const EXPECTED_INDEX_TAGS = ['all', 'hard-surface', 'product', 'organic', 'prototyping', 'animations', 'cad'];
const EXPECTED_FA_TAGS = ['hard-surface', 'product', 'game', 'organic', 'animation', 'cad'];
const EXPECTED_VIZ = ['2d', '3d', 'blueprints'];

let pass = 0;
let fail = 0;
function check(suite, name, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL';
  const tag = `[${suite}] ${name}`;
  console.log(`  ${ok ? '\x1b[32m' : '\x1b[31m'}${status}\x1b[0m  ${tag}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

function load(path) {
  if (!existsSync(path)) {
    console.error(`Missing build output: ${path}. Run \`npm run build\` first.`);
    process.exit(2);
  }
  const html = readFileSync(path, 'utf8');
  return new JSDOM(html).window.document;
}

// ── 1. Work pages (any sample is representative; orbital-mk-ii carries the
//      richest schema set so the JSON-LD count + ItemList assertions check
//      against it specifically).
function testWorkPage(slug) {
  const path = join(DIST, 'work', slug, 'index.html');
  const doc = load(path);
  const suite = `work:${slug}`;

  // Theme-color invariant — single tag, no media attribute.
  const themeMetas = doc.querySelectorAll('meta[name="theme-color"]');
  check(suite, 'META-theme-color-single', themeMetas.length === 1, `count=${themeMetas.length}`);
  const themeMeta = themeMetas[0];
  check(suite, 'META-theme-color-no-media', themeMeta && !themeMeta.hasAttribute('media'));
  check(
    suite,
    'META-theme-color-content',
    themeMeta?.getAttribute('content') === '#212121',
    `value=${themeMeta?.getAttribute('content')}`,
  );

  // Body data-theme hardcode.
  const body = doc.body;
  check(suite, 'BODY-theme-dark-default', body.getAttribute('data-theme') === 'dark');

  // Meta basics.
  check(suite, 'META-canonical', !!doc.querySelector('link[rel="canonical"]'));
  check(suite, 'META-robots', !!doc.querySelector('meta[name="robots"]'));
  check(suite, 'META-manifest', !!doc.querySelector('link[rel="manifest"]'));
  check(
    suite,
    'META-favicon-16',
    !!doc.querySelector('link[rel="icon"][sizes="16x16"]'),
  );

  // Open Graph + Twitter.
  const og = ['og:url', 'og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height'];
  const missingOg = og.filter((k) => !doc.querySelector(`meta[property="${k}"]`));
  check(suite, 'META-og-complete', missingOg.length === 0, missingOg.join(','));
  const tw = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  const missingTw = tw.filter((k) => !doc.querySelector(`meta[name="${k}"]`));
  check(suite, 'META-twitter-complete', missingTw.length === 0, missingTw.join(','));
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';
  check(suite, 'META-og-image-absolute', /^https?:\/\//.test(ogImage), ogImage);

  // JSON-LD schema set.
  const lds = doc.querySelectorAll('script[type="application/ld+json"]');
  check(suite, 'META-jsonLD-present', lds.length >= 3, `count=${lds.length}`);
  const ldTypes = new Set();
  for (const el of lds) {
    try {
      const data = JSON.parse(el.textContent ?? '{}');
      if (data['@type']) ldTypes.add(data['@type']);
    } catch (e) {
      check(suite, 'META-jsonLD-parse', false, String(e));
    }
  }
  check(suite, 'META-jsonLD-organization', ldTypes.has('Organization'));
  check(suite, 'META-jsonLD-website', ldTypes.has('WebSite'));
  check(suite, 'META-jsonLD-creativework', ldTypes.has('CreativeWork'));

  // Work-cards.
  const cards = doc.querySelectorAll('.work-card[data-id]:not(.tag-card)');
  check(suite, 'WORK-cards-18', cards.length === 18, `count=${cards.length}`);
  const slugs = Array.from(cards).map((c) => c.getAttribute('data-id'));
  const missingIds = EXPECTED_IDS.filter((id) => !slugs.includes(id));
  check(suite, 'WORK-cards-ids', missingIds.length === 0, missingIds.join(','));
  const gameCards = doc.querySelectorAll('.work-card[data-game-asset="true"]');
  check(suite, 'WORK-cards-game-assets', gameCards.length >= 2, `count=${gameCards.length}`);

  // Tags-dropdown.
  const tagFilters = Array.from(doc.querySelectorAll('.tags-dropdown__checkbox')).map((el) => el.getAttribute('data-filter'));
  const missingTags = EXPECTED_INDEX_TAGS.filter((t) => !tagFilters.includes(t));
  check(suite, 'TAGS-buttons', missingTags.length === 0, missingTags.join(','));

  // Case-view tabs.
  const tabs = Array.from(doc.querySelectorAll('.case-tab[data-viz]')).map((el) => el.getAttribute('data-viz'));
  check(suite, 'CASE-tabs-3', tabs.length === 3, tabs.join(','));
  const missingViz = EXPECTED_VIZ.filter((v) => !tabs.includes(v));
  check(suite, 'CASE-tabs-viz', missingViz.length === 0, missingViz.join(','));

  // COPY LINK both variants.
  check(suite, 'CASE-share-desktop', !!doc.querySelector('.case-share--desktop'));
  check(suite, 'CASE-share-mobile', !!doc.querySelector('.case-share--mobile'));

  // Progress + scroll structure.
  check(suite, 'CASE-progress', !!doc.querySelector('#case-progress-bar'));
  check(suite, 'CASE-scroll-track', !!doc.querySelector('#case-scroll-track'));

  // 3D + Blueprints panels.
  const mv = doc.querySelector('#case-3d model-viewer');
  check(suite, 'CASE-3d-model-viewer', !!mv);
  check(suite, 'CASE-3d-src-local', /^\/models\//.test(mv?.getAttribute('src') ?? ''), mv?.getAttribute('src') ?? '');
  const bpSvg = doc.querySelector('.case-blueprints__page-canvas svg');
  check(suite, 'CASE-blueprints-svg', !!bpSvg);
  check(suite, 'CASE-blueprints-parts', !!doc.querySelector('.blueprint__parts'));

  // Mobile bar + back/share-mobile IDs.
  check(suite, 'CASE-mobile-bar', !!doc.querySelector('.case-mobile-bar'));
  check(suite, 'CASE-back-btn', !!doc.querySelector('#case-back'));

  // Logo invariants: portfolio uses #logo-home, NOT logo-back-portfolio.
  check(suite, 'LOGO-home-present', !!doc.querySelector('#logo-home'));
  check(suite, 'LOGO-no-back-portfolio', !doc.querySelector('#logo-back-portfolio'));

  // Cards-toggle uses chevron glyphs.
  const open = doc.querySelector('.cards-toggle__icon--open')?.textContent ?? '';
  const closed = doc.querySelector('.cards-toggle__icon--closed')?.textContent ?? '';
  check(suite, 'CARDS-toggle-chevrons', open.includes('‹') && closed.includes('›'), `open=${open} closed=${closed}`);
}

// ── 2. Free-assets page.
function testFreeAssets() {
  const path = join(DIST, 'free-assets', 'index.html');
  const doc = load(path);
  const suite = 'free-assets';

  // Single theme-color tag.
  const themeMetas = doc.querySelectorAll('meta[name="theme-color"]');
  check(suite, 'META-theme-color-single', themeMetas.length === 1);

  // OG image is the FA-specific file.
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '';
  check(suite, 'META-og-image-fa-specific', /og-free-assets\.jpg$/.test(ogImage), ogImage);

  // JSON-LD: Organization + WebSite + WebPage.
  const ldTypes = new Set();
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent ?? '{}');
      if (data['@type']) ldTypes.add(data['@type']);
    } catch {
      /* ignored */
    }
  }
  check(suite, 'META-jsonLD-organization', ldTypes.has('Organization'));
  check(suite, 'META-jsonLD-website', ldTypes.has('WebSite'));
  check(suite, 'META-jsonLD-webpage', ldTypes.has('WebPage'));

  // Tag-cards: 6 categories, all data-tag values present.
  const tagCards = doc.querySelectorAll('.tag-card[data-tag]');
  check(suite, 'FA-tag-cards-6', tagCards.length === 6, `count=${tagCards.length}`);
  const tagValues = Array.from(tagCards).map((c) => c.getAttribute('data-tag'));
  const missingTags = EXPECTED_FA_TAGS.filter((t) => !tagValues.includes(t));
  check(suite, 'FA-tag-cards-ids', missingTags.length === 0, missingTags.join(','));

  // Active tag-card on initial paint.
  const active = doc.querySelectorAll('.tag-card.tag-card--active[data-tag]');
  check(suite, 'FA-tag-card-active', active.length === 1, `count=${active.length}`);

  // FA grid: 25 cards total, 17 hidden + 8 visible at SSR for hard-surface.
  const allFa = doc.querySelectorAll('.fa-card');
  check(suite, 'FA-cards-total', allFa.length === 25, `count=${allFa.length}`);
  const hiddenFa = doc.querySelectorAll('.fa-card[hidden]');
  check(suite, 'FA-cards-hidden-initial', hiddenFa.length === 17, `count=${hiddenFa.length}`);
  const visibleFa = Array.from(allFa).filter((c) => !c.hasAttribute('hidden'));
  check(suite, 'FA-cards-visible-initial', visibleFa.length === 8, `count=${visibleFa.length}`);
  const visibleTags = new Set(visibleFa.map((c) => c.getAttribute('data-asset-tag')));
  check(suite, 'FA-visible-single-tag', visibleTags.size === 1 && visibleTags.has('hard-surface'), Array.from(visibleTags).join(','));

  // Logo invariants: FA uses logo-back-portfolio, NOT logo-home.
  check(suite, 'B1-logo-back-portfolio', !!doc.querySelector('#logo-back-portfolio'));
  check(suite, 'B1-no-logo-home', !doc.querySelector('#logo-home'));

  // Cards-toggle uses chevrons (same as portfolio).
  const open = doc.querySelector('.cards-toggle__icon--open')?.textContent ?? '';
  const closed = doc.querySelector('.cards-toggle__icon--closed')?.textContent ?? '';
  check(suite, 'B6-chevron-icons', open.includes('‹') && closed.includes('›'), `open=${open} closed=${closed}`);

  // Footer should NOT have a "Free Assets" pill on FA (it's the current page);
  // it has a "Portfolio" back-link pill instead.
  const portfolioPill = Array.from(doc.querySelectorAll('.top-pill__label'))
    .find((el) => el.textContent?.trim() === 'Portfolio');
  check(suite, 'FA-footer-portfolio-pill', !!portfolioPill);

  // Body data-theme hardcode.
  check(suite, 'BODY-theme-dark-default', doc.body.getAttribute('data-theme') === 'dark');
}

// ── 3. 404 page.
function test404() {
  const path = join(DIST, '404.html');
  const doc = load(path);
  const suite = '404';
  check(suite, '404-readout', !!doc.getElementById('nf-url'));
  check(suite, '404-status', !!doc.querySelector('.not-found__code'));
  const themeMetas = doc.querySelectorAll('meta[name="theme-color"]');
  check(suite, 'META-theme-color-single', themeMetas.length === 1);
  check(suite, 'BODY-theme-dark-default', doc.body.getAttribute('data-theme') === 'dark');
}

// ── 4. Sitemap.
function testSitemap() {
  const path = join(DIST, 'sitemap-0.xml');
  if (!existsSync(path)) {
    check('sitemap', 'sitemap-0-present', false);
    return;
  }
  const xml = readFileSync(path, 'utf8');
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // 18 work pages + 1 free-assets = 19 URLs; redirect / and /404 must be absent.
  check('sitemap', 'sitemap-loc-count', matches.length === 19, `count=${matches.length}`);
  check('sitemap', 'sitemap-no-redirect-root', !matches.some((u) => u === 'https://preview.codex.promo/'));
  check('sitemap', 'sitemap-no-404', !matches.some((u) => /\/404\b/.test(u)));
}

// ── 5. Redirect at / has canonical to first work.
function testRootRedirect() {
  const doc = load(join(DIST, 'index.html'));
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
  check('redirect', 'index-canonical-first-work', /\/work\/orbital-mk-ii\/?$/.test(canonical), canonical);
  const refresh = doc.querySelector('meta[http-equiv="refresh"]');
  check('redirect', 'index-meta-refresh', !!refresh);
}

// ── Run.
console.log('\nverify-v2.mjs — static frozen-invariant regression\n');

if (!existsSync(DIST)) {
  console.error(`dist/ not found at ${DIST}. Run \`npm run build\` first.`);
  process.exit(2);
}

const slugs = readdirSync(join(DIST, 'work')).filter((d) =>
  existsSync(join(DIST, 'work', d, 'index.html')),
);
console.log(`Found ${slugs.length} /work/ pages\n`);

// Run the full work-page suite against orbital-mk-ii (canonical/ItemList host)
// plus a few representative siblings for cross-validation.
const sampleSlugs = ['orbital-mk-ii', 'vega-shell', 'nightshard', 'cad-strut'];
for (const s of sampleSlugs) testWorkPage(s);

console.log('');
testFreeAssets();

console.log('');
test404();

console.log('');
testSitemap();

console.log('');
testRootRedirect();

console.log(`\nDone. \x1b[32mPASS=${pass}\x1b[0m \x1b[31mFAIL=${fail}\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
