/* ─────────────────────────────────────────────────────────────────────────────
   clean-orphan-assets.mjs — manual maintenance audit (F5).

   The admin media flow uses cache-bust naming ({base}-{hash8}.{ext}) and never
   deletes the file it replaces (a deliberate decision so the live site never
   404s before the publish pipeline rebuilds — see admin/js/state.js). Replaced
   files therefore accumulate. This script reports — and, with --delete, removes —
   asset files that nothing references anymore.

   USAGE:
     node scripts/clean-orphan-assets.mjs            # dry-run (default): report only
     node scripts/clean-orphan-assets.mjs --delete   # remove orphans (guarded)

   CORRECTNESS: the #1 risk is a FALSE orphan (deleting a live file). The
   reference set is therefore built from FOUR sources and reconstructs every
   naming convention the generator/runtime apply: (1) content/*.json + convention
   defaults; (2) the shipped HTML; (3) the generated js/*-data.js + js/*.js;
   (4) css/** + the web manifest. README.md files and site.webmanifest are never
   reported. --delete additionally refuses to run on a dirty asset tree and caps
   how much of any one directory it will remove.
   ───────────────────────────────────────────────────────────────────────────── */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── helpers ─────────────────────────────────────────────────────────────── */

// Repo-relative POSIX path with a leading './' (the form content/*.json uses).
function rel(absPath) {
  return './' + path.relative(ROOT, absPath).split(path.sep).join('/');
}

function readJson(...segments) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ...segments), 'utf8'));
}

// Mirror of generate-content.mjs faEffectiveBase: an absent key defaults to the
// item id; an explicit null DISABLES the media (no file to reference).
function faEffectiveBase(item, key) {
  return key in item ? item[key] : item.id;
}

// Normalise any referenced path ('./assets/x', 'assets/x', 'downloads/x.zip') to
// the canonical './assets/...' / './downloads/...' form used for set membership.
function canonical(p) {
  let s = String(p).trim().replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  s = s.replace(/^\/+/, '');
  return './' + s;
}

function addRef(set, p) {
  if (!p || typeof p !== 'string') return;
  set.add(canonical(p));
}

/* ── (A1) references from content/*.json + convention defaults ───────────── */

function addContentRefs(set) {
  const settings = readJson('content', 'settings.json');
  for (const id of settings.cardOrder) {
    let c;
    try {
      c = readJson('content', 'cases', id + '.json');
    } catch (_e) {
      continue;
    }
    if (c.card && c.card.thumb) addRef(set, c.card.thumb);
    const cs = c.case || {};
    if (cs.modelSrc) addRef(set, cs.modelSrc);
    // 5 illustration slots: explicit src, or the per-case convention default.
    for (let i = 0; i < 5; i++) {
      const explicit = cs.srcs && cs.srcs[i];
      addRef(set, explicit || `./assets/cases/${id}/0${i + 1}.svg`);
    }
    if (Array.isArray(cs.motionBlocks)) {
      for (const block of cs.motionBlocks) {
        if (block && block.src) addRef(set, block.src);
        if (block && block.poster) addRef(set, block.poster);
      }
    }
  }

  const fa = readJson('content', 'free-assets.json');
  for (const category of fa.categories || []) {
    if (category.tagCard && category.tagCard.thumb) {
      addRef(set, `./assets/cards/${category.tagCard.thumb}.svg`);
    }
    for (const item of category.items || []) {
      const thumbBase = faEffectiveBase(item, 'thumb');
      if (thumbBase) addRef(set, `./assets/cards/${thumbBase}.svg`);
      const modelBase = faEffectiveBase(item, 'model');
      if (modelBase) addRef(set, `./assets/models/free/${modelBase}.glb`);
      if (item.file) addRef(set, `./downloads/${item.file}`);
    }
  }

  const meta = readJson('content', 'meta.json');
  const og = meta.ogImages || {};
  addRef(set, og.index);
  addRef(set, og.fa);
  addRef(set, og.orgLogo);

  // site.webmanifest icons use manifest-relative paths (e.g. "./favicon-32.png")
  // that the assets/downloads regex cannot see — resolve them against the
  // manifest's own dir so a manifest-only icon is never a false orphan.
  try {
    const manifest = readJson('assets', 'favicon', 'site.webmanifest');
    for (const icon of manifest.icons || []) {
      if (icon && typeof icon.src === 'string') {
        addRef(set, './assets/favicon/' + icon.src.replace(/^\.?\//, ''));
      }
    }
  } catch (_e) {
    /* no manifest — nothing to add */
  }
}

/* ── (A2) references scanned literally from shipped + generated sources ───── */

// HTML / sitemap / manifest scanned literally. Every JS file under js/ (incl.
// vendor and the lazy 3D viewer, which hardcodes an HDR path) is added by walking
// js/ in addScannedRefs — a hardcoded list could omit a file that references an
// asset and turn that asset into a FALSE orphan.
const SCAN_FILES = [
  'index.html',
  'free-assets.html',
  '404.html',
  'sitemap.xml',
  'assets/favicon/site.webmanifest'
];

const ASSET_REF_RE = /(?:\.\/)?(?:assets|downloads)\/[A-Za-z0-9._/-]+/g;

function addScannedRefs(set) {
  const absFiles = SCAN_FILES.map((relPath) => path.join(ROOT, relPath));
  // every CSS file
  const cssDir = path.join(ROOT, 'css');
  if (fs.existsSync(cssDir)) {
    for (const f of fs.readdirSync(cssDir)) {
      if (f.endsWith('.css')) absFiles.push(path.join(cssDir, f));
    }
  }
  // every JS file under js/ (incl. vendor + the lazy 3D viewer's hardcoded HDR):
  // walking the tree avoids a hardcoded list omitting an asset reference.
  const jsFiles = [];
  walk(path.join(ROOT, 'js'), jsFiles);
  for (const abs of jsFiles) {
    if (abs.endsWith('.js')) absFiles.push(abs);
  }
  for (const abs of absFiles) {
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const matches = text.match(ASSET_REF_RE) || [];
    for (const m of matches) addRef(set, m);
  }
}

export function buildReferenceSet() {
  const set = new Set();
  addContentRefs(set);
  addScannedRefs(set);
  return set;
}

/* ── walk assets/ + downloads/ and diff ──────────────────────────────────── */

function walk(dirAbs, out) {
  if (!fs.existsSync(dirAbs)) return;
  for (const name of fs.readdirSync(dirAbs)) {
    const abs = path.join(dirAbs, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
}

// Files that ship in every asset dir and must never be flagged.
function isProtected(relPath) {
  const lower = relPath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('/site.webmanifest') || lower.endsWith('.gitkeep');
}

export function findOrphans(referenceSet) {
  const files = [];
  walk(path.join(ROOT, 'assets'), files);
  walk(path.join(ROOT, 'downloads'), files);
  const orphans = [];
  for (const abs of files) {
    const relPath = rel(abs);
    if (isProtected(relPath)) continue;
    if (!referenceSet.has(relPath)) orphans.push({ path: relPath, abs, size: fs.statSync(abs).size });
  }
  return orphans;
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function dirOf(relPath) {
  return relPath.slice(0, relPath.lastIndexOf('/'));
}

function main() {
  const del = process.argv.includes('--delete');
  const referenceSet = buildReferenceSet();
  const orphans = findOrphans(referenceSet);

  if (orphans.length === 0) {
    console.log('No orphan assets — every file under assets/ and downloads/ is referenced.');
    return;
  }

  const totalBytes = orphans.reduce((sum, o) => sum + o.size, 0);
  console.log(`Found ${orphans.length} orphan file(s), ${fmtBytes(totalBytes)} reclaimable:`);
  for (const o of orphans) console.log(`  ${o.path}  (${fmtBytes(o.size)})`);

  if (!del) {
    console.log('\nDry-run (default). Re-run with --delete to remove them.');
    return;
  }

  // --delete guards.
  let dirty;
  try {
    dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (_e) {
    console.error('Aborting --delete: could not run `git status`.');
    process.exitCode = 1;
    return;
  }
  if (dirty) {
    console.error('\nAborting --delete: the working tree has uncommitted changes — commit/stash first so the reference set reflects committed sources (content/HTML/JS/CSS) and deletions stay reviewable.');
    process.exitCode = 1;
    return;
  }
  // Per-directory sanity cap: refuse if a broken reference set would wipe >50% of any dir.
  const perDir = new Map();
  const totalPerDir = new Map();
  walkCount(path.join(ROOT, 'assets'), totalPerDir);
  walkCount(path.join(ROOT, 'downloads'), totalPerDir);
  for (const o of orphans) {
    const d = dirOf(o.path);
    perDir.set(d, (perDir.get(d) || 0) + 1);
  }
  for (const [d, count] of perDir) {
    const total = totalPerDir.get(d) || count;
    if (count > total * 0.5) {
      console.error(`\nAborting --delete: would remove ${count}/${total} files in ${d} (>50%). The reference set looks broken — refusing.`);
      process.exitCode = 1;
      return;
    }
  }
  for (const o of orphans) {
    const abs = path.resolve(o.abs);
    if (!abs.startsWith(path.join(ROOT, 'assets') + path.sep) && !abs.startsWith(path.join(ROOT, 'downloads') + path.sep)) {
      console.error(`Refusing to delete outside assets/ or downloads/: ${o.path}`);
      continue;
    }
    fs.rmSync(abs);
    console.log(`deleted ${o.path}`);
  }
  console.log(`\nDeleted ${orphans.length} orphan file(s). Review with \`git status\` and commit.`);
}

function walkCount(dirAbs, perDir) {
  if (!fs.existsSync(dirAbs)) return;
  for (const name of fs.readdirSync(dirAbs)) {
    const abs = path.join(dirAbs, name);
    if (fs.statSync(abs).isDirectory()) walkCount(abs, perDir);
    else {
      const d = dirOf(rel(abs));
      perDir.set(d, (perDir.get(d) || 0) + 1);
    }
  }
}

// Run main() only when invoked directly (not when imported by the unit test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
