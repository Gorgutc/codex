/* migrate-case-media.mjs — one-shot content migration (case media blocks).
 *
 * Folds the three parallel per-case arrays
 *   case.srcs[5]     — explicit path or null (null → the positional default
 *                      ./assets/cases/<id>/0N.svg)
 *   case.captions[5] — { label: {en,ru}, desc: {en,ru} }
 *   case.palette[5]  — CSS gradient of the slot background
 * into ONE array of self-describing blocks
 *   case.media[] = {
 *     src, format, type, poster, bg,
 *     caption: { label: {en,ru}, desc: {en,ru} }
 *   }
 * and drops srcs/captions/palette.
 *
 * The slot format used to be implied by the POSITION in the layout
 * (MEDIA_FORMATS below, the former constant of scripts/generate-content.mjs);
 * it now lives on the block. `src` is materialized: a null override becomes
 * the explicit convention path, exactly what the generator emitted into
 * js/cards-data.js and what admin/js/ui.js moveMediaSlot used to write on the
 * first reorder. `type` is 'image' and `poster` is null for every migrated
 * block — the video slots arrive with the next slice.
 *
 * The migration is byte-neutral for every generated target: run
 * `npm run content:generate` afterwards and `git diff` must stay empty.
 *
 * Usage:
 *   node scripts/migrate-case-media.mjs           # rewrite content/cases/*.json
 *   node scripts/migrate-case-media.mjs --dry-run # report only
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CASES_DIR = path.join(ROOT, 'content', 'cases');
const DRY_RUN = process.argv.includes('--dry-run');

// The historical positional layout: slots 1 and 4 are wide, 2/3/5 are tall.
const MEDIA_FORMATS = ['wide', 'tall', 'tall', 'wide', 'tall'];

// Same `||` fallback the generator (buildCaseEntry) used, so an empty string
// override materializes into the convention path too.
function effectiveSrc(cs, id, i) {
  return (cs.srcs && cs.srcs[i]) || `./assets/cases/${id}/0${i + 1}.svg`;
}

function buildMedia(id, cs) {
  return MEDIA_FORMATS.map((format, i) => {
    const caption = cs.captions[i];
    return {
      src: effectiveSrc(cs, id, i),
      format,
      type: 'image',
      poster: null,
      bg: cs.palette[i],
      caption: {
        label: { en: caption.label.en, ru: caption.label.ru },
        desc: { en: caption.desc.en, ru: caption.desc.ru }
      }
    };
  });
}

// `media` takes the slot of the first replaced key (palette in every current
// file), so the diff stays local and the file reads in the same order.
function rewriteCase(cs, media) {
  const REPLACED = new Set(['palette', 'captions', 'srcs']);
  const out = {};
  let placed = false;
  for (const key of Object.keys(cs)) {
    if (REPLACED.has(key)) {
      if (!placed) {
        out.media = media;
        placed = true;
      }
      continue;
    }
    out[key] = cs[key];
  }
  if (!placed) out.media = media;
  return out;
}

// Fail-closed: classify EVERY file first; any mixed/malformed case aborts the
// run with exit 1 before a single byte is written. A half-done migration (or a
// re-run clobbering an edited case.media from stale legacy keys) must be
// impossible.
const pending = [];
const preflightErrors = [];

for (const file of fs.readdirSync(CASES_DIR).filter((name) => name.endsWith('.json')).sort()) {
  const filePath = path.join(CASES_DIR, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    preflightErrors.push(`${file}: broken JSON — ${err.message}`);
    continue;
  }
  const cs = data.case;
  if (!cs || typeof cs !== 'object' || Array.isArray(cs)) {
    preflightErrors.push(`${file}: no "case" object`);
    continue;
  }
  const hasLegacy = 'srcs' in cs || 'captions' in cs || 'palette' in cs;
  if (Array.isArray(cs.media)) {
    if (hasLegacy) {
      preflightErrors.push(`${file}: mixed schema (case.media alongside legacy srcs/captions/palette) — refusing to touch`);
    } else {
      pending.push({ file, state: 'migrated' });
    }
    continue;
  }
  if (
    !Array.isArray(cs.captions) || !Array.isArray(cs.palette) ||
    cs.captions.length !== 5 || cs.palette.length !== 5
  ) {
    preflightErrors.push(`${file}: legacy schema is malformed (expected captions[5] + palette[5])`);
    continue;
  }
  pending.push({ file, state: 'legacy', filePath, data });
}

if (preflightErrors.length > 0) {
  for (const line of preflightErrors) console.error(line);
  console.error('\npreflight failed — nothing was written');
  process.exit(1);
}

let migrated = 0;
for (const entry of pending) {
  if (entry.state === 'migrated') {
    console.log(`${entry.file}: already migrated`);
    continue;
  }
  entry.data.case = rewriteCase(entry.data.case, buildMedia(entry.data.id, entry.data.case));
  // Same serialization the admin panel publishes with (state.js serializeDraft):
  // 2-space indent, trailing newline, LF (Node writes '\n' verbatim).
  const text = JSON.stringify(entry.data, null, 2) + '\n';
  if (!DRY_RUN) fs.writeFileSync(entry.filePath, text, 'utf8');
  console.log(`${entry.file}: 5 slots → case.media[]${DRY_RUN ? ' (dry run)' : ''}`);
  migrated += 1;
}

console.log(`\nmigrated: ${migrated}, already migrated: ${pending.length - migrated}`);
