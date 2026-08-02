/* fa-poster-path.mjs — the ONE canonical parser for a Free Assets poster slot
 * value (item `thumb`, category `tagCard.thumb`). FA-POSTER-01.
 *
 * A poster value is EITHER
 *   • a plain base name        → './assets/cards/<base>.svg' (the historical
 *                                 SVG default; an absent key means the item id
 *                                 and travels through here as a base name), OR
 *   • a full './assets/…' path → used verbatim, carrying its own extension,
 *                                 which is how a raster render reaches a card.
 *
 * WHY A SINGLE PARSER. Four consumers have to agree on the resolved path BYTE
 * FOR BYTE: the generator validates and emits it, js/free-assets.js requests
 * it, admin/js mirrors it, and scripts/clean-orphan-assets.mjs decides from it
 * whether a file on disk is still live. When they disagreed, a non-canonical
 * spelling such as './assets/cards//poster.png' passed validation (path.resolve
 * silently normalizes it), rendered nothing at runtime, and — worst — entered
 * the orphan reference set with the doubled slash, so it never matched the real
 * file and `clean-orphan-assets --delete` removed a LIVE poster. Non-canonical
 * spellings are therefore REJECTED here with a message, never normalized.
 *
 * SEGMENT RULES (the "segment parser"): the value must use forward slashes; a
 * path form must start with './assets/'; every segment must be non-empty, not
 * '.', not '..', and match [A-Za-z0-9._-]+; the extension must be allowlisted.
 * Restricting the character set is what removes URL-encoding from the picture
 * entirely: the generator emits the path raw into HTML and the runtime assigns
 * it to img.src, and because no segment can contain '?', '#', a space or any
 * non-ASCII byte, both sides produce an IDENTICAL URL with no encoding step.
 * That is strictly safer than the previous encodeURIComponent pass, which
 * mangled a hostile value into a different-but-live URL instead of refusing it.
 *
 * Browser mirrors cannot import this module (classic non-module scripts):
 * js/free-assets.js, admin/js/state.js and admin/js/preview.js re-implement the
 * same walk, and tests/quality/admin-free-assets.spec.mjs pins the admin mirror
 * against this module value-for-value.
 *
 * NOTE the banner inside the generated js/fa-data.js still describes only the
 * historical base-name form. It is left byte-identical on purpose so that
 * extending the schema does not rewrite a generated file on unchanged content;
 * this module is the live contract.
 */

export const FA_POSTER_EXTS = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
export const FA_POSTER_RASTER_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
export const FA_POSTER_DIR = './assets/cards/';
const ASSETS_PREFIX = './assets/';
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

function extensionOf(value) {
  const match = /\.[A-Za-z0-9]+$/.exec(value);
  return match ? match[0].toLowerCase() : '';
}

/* null when the value is a valid poster slot value, otherwise an English
 * problem clause. Callers compose it as `<where>: "<value>" <problem>` so the
 * message shape matches checkAssetFile in scripts/generate-content.mjs. */
export function faPosterProblem(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'must be a plain base name or a full "./assets/…" poster path';
  }
  if (value.includes('\\')) return 'must use forward slashes';
  if (!value.includes('/')) {
    if (value === '.' || value.includes('..')) {
      return 'must be a plain base name without path separators';
    }
    if (!SEGMENT_RE.test(value)) {
      return 'must be a plain base name of [A-Za-z0-9._-] characters only';
    }
    return null;
  }
  if (!value.startsWith(ASSETS_PREFIX)) {
    return 'must be a plain base name without path separators, or a full "./assets/…" poster path';
  }
  const segments = value.slice(2).split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') {
      return 'must be a canonical path — no empty, "." or ".." segments';
    }
    if (!SEGMENT_RE.test(segment)) {
      return 'must use path segments of [A-Za-z0-9._-] characters only';
    }
  }
  if (!FA_POSTER_EXTS.includes(extensionOf(value))) {
    return `must end with one of ${FA_POSTER_EXTS.join(', ')}`;
  }
  return null;
}

/* The canonical site path, or null when the value is not a valid poster value.
 * Every consumer resolves through this — never by string-concatenating a
 * directory and an extension of its own. */
export function faPosterPath(value) {
  if (faPosterProblem(value) !== null) return null;
  return value.includes('/') ? value : FA_POSTER_DIR + value + '.svg';
}

/* 'raster' | 'vector' | null, decided from the RESOLVED path — a base name that
 * merely ends in ".png" resolves to "<name>.png.svg" and is a vector. */
export function faPosterKind(value) {
  const resolved = faPosterPath(value);
  if (resolved === null) return null;
  return FA_POSTER_RASTER_EXTS.includes(extensionOf(resolved)) ? 'raster' : 'vector';
}

/* The ONE fallback for a category cover: an absent or null `tagCard.thumb`
 * means the category key (./assets/cards/<key>.svg). The generator, the orphan
 * audit, the admin preview and scripts/content-expectations.mjs all resolve a
 * cover through this so a missing key cannot mean three different files. */
export function faTagCoverValue(category) {
  const tagCard = category && typeof category === 'object' ? category.tagCard : null;
  const thumb = tagCard && typeof tagCard === 'object' ? tagCard.thumb : null;
  return thumb === null || thumb === undefined ? category && category.key : thumb;
}
