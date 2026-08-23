/* Negative self-test for validateContent() in scripts/generate-content.mjs.
 *
 * Copies content/ to a temp directory, breaks it in several independent
 * ways, and runs the generator in --check mode with CONTENT_DIR pointing at
 * the broken copy. The validator must exit non-zero and report EVERY
 * violation (not just the first). A pristine-copy control run proves the
 * CONTENT_DIR override itself works. Plain node test — no Playwright.
 */
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatorPath = path.join(root, 'scripts', 'generate-content.mjs');
const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-content-validate-'));

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(tempDir, relPath), 'utf8'));
}

function writeJson(relPath, value) {
  writeFileSync(path.join(tempDir, relPath), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function runCheck() {
  const result = spawnSync(process.execPath, [generatorPath, '--check'], {
    cwd: root,
    env: { ...process.env, CONTENT_DIR: tempDir },
    encoding: 'utf8'
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

try {
  cpSync(path.join(root, 'content'), tempDir, { recursive: true });

  // Control: a pristine copy must validate cleanly through the override.
  const pristine = runCheck();
  if (pristine.status !== 0) {
    console.error(pristine.output);
    throw new Error('Expected --check to succeed on a pristine copy of content/.');
  }

  // Break the copy in several independent ways.
  const settings = readJson('settings.json');
  const authoredCaseIds = settings.cardOrder.slice();
  settings.cardOrder.push('ghost-case'); // orphan cardOrder entry
  delete settings.filters[1].label; // filter without a label
  writeJson('settings.json', settings);

  const lumen = readJson('cases/lumen-one.json');
  lumen.category = 'all'; // reserved filter key
  lumen.year = 2024; // must be a string
  lumen.card.title.ru = ''; // empty locale value
  lumen.card.imgLoading = 'soon'; // not "eager"/"lazy"
  lumen.card.imgFetchPriority = 'urgent'; // not a fetchpriority value
  lumen.case.media = 'five slots'; // case.media must be an array
  lumen.case.modelSrc = './assets/../outside/model.glb'; // traversal attempt
  writeJson('cases/lumen-one.json', lumen);

  // case.media negative scenarios (one shape per file so every violation is
  // attributable): empty array, over the block cap, broken enums, a video
  // block pointing at a still image, empty background, half-filled caption.
  const helix = readJson('cases/helix-reveal.json');
  helix.case.media = []; // empty media list
  writeJson('cases/helix-reveal.json', helix);

  const drift = readJson('cases/drift-koi.json');
  while (drift.case.media.length < 13) drift.case.media.push({ ...drift.case.media[0] }); // over the 12-block cap
  writeJson('cases/drift-koi.json', drift);

  const flux = readJson('cases/flux-capsule.json');
  flux.case.media[0].format = 'huge'; // not in {wide,tall}
  flux.case.media[1].type = 'audio'; // not in {image,video}
  writeJson('cases/flux-capsule.json', flux);

  const glint = readJson('cases/glint-owl.json');
  glint.case.media[2].type = 'video'; // video block still pointing at an .svg
  glint.case.media[3].bg = ''; // empty slot background
  // Captions are optional per pair, but never half-translated: an EN label
  // with an empty RU one would show English text to a Russian visitor.
  glint.case.media[4].caption.label.ru = '';
  writeJson('cases/glint-owl.json', glint);

  // case.cta negative scenarios (CASE-CTA-01): switched on without a link,
  // a foreign domain, and the REPLACE_WITH_REAL placeholder surviving on a
  // switched-off link (it is never a legitimate stored value).
  const mech = readJson('cases/mech-link.json');
  mech.case.cta = { enabled: true }; // enabled without a url
  writeJson('cases/mech-link.json', mech);

  const nyx = readJson('cases/nyx-panther.json');
  nyx.case.cta = { enabled: true, url: 'https://portfolio.example.com/nyx' }; // not artstation/behance
  writeJson('cases/nyx-panther.json', nyx);

  const recon = readJson('cases/recon-drone.json');
  recon.case.cta = { enabled: false, url: 'https://www.behance.net/REPLACE_WITH_REAL' };
  writeJson('cases/recon-drone.json', recon);

  const nightshard = readJson('cases/nightshard.json');
  nightshard.case.cta = { enabled: 'yes', url: 'https://www.artstation.com/artwork/x' }; // not a boolean
  writeJson('cases/nightshard.json', nightshard);

  // Public case routes are globally unique, including disabled cases. Pick
  // distinct authored fixtures rather than owner-specific ids so this remains
  // a controlled validator test when the portfolio changes.
  const slugFixtures = authoredCaseIds.slice(-6);
  if (slugFixtures.length !== 6) throw new Error('Slug validation fixture needs six authored cases.');
  const [invalidSlugId, invalidAliasesId, disabledCollisionId, stableIdCollisionId, canonicalAliasId, emptyAliasesId] = slugFixtures;
  const sharedToken = 'shared-route';

  const invalidSlug = readJson('cases/' + invalidSlugId + '.json');
  invalidSlug.slug = 'Bad Slug'; // public route grammar is strict lowercase kebab-case
  invalidSlug.legacySlugs = ['']; // aliases must be non-empty route tokens
  writeJson('cases/' + invalidSlugId + '.json', invalidSlug);

  const invalidAliases = readJson('cases/' + invalidAliasesId + '.json');
  invalidAliases.slug = sharedToken;
  invalidAliases.legacySlugs = 'old-route';
  writeJson('cases/' + invalidAliasesId + '.json', invalidAliases);

  const disabledCollision = readJson('cases/' + disabledCollisionId + '.json');
  disabledCollision.enabled = false; // coverage must not depend on owner visibility settings
  disabledCollision.slug = disabledCollision.id; // canonical must be omitted when it is the stable id
  disabledCollision.legacySlugs = [sharedToken, sharedToken];
  writeJson('cases/' + disabledCollisionId + '.json', disabledCollision);

  const stableIdCollision = readJson('cases/' + stableIdCollisionId + '.json');
  stableIdCollision.legacySlugs = [disabledCollision.id]; // collision with another stable id
  writeJson('cases/' + stableIdCollisionId + '.json', stableIdCollision);

  const canonicalAlias = readJson('cases/' + canonicalAliasId + '.json');
  const customCanonical = canonicalAlias.id + '-public';
  canonicalAlias.slug = customCanonical;
  canonicalAlias.legacySlugs = [customCanonical]; // alias cannot repeat canonical
  writeJson('cases/' + canonicalAliasId + '.json', canonicalAlias);

  const emptyAliases = readJson('cases/' + emptyAliasesId + '.json');
  emptyAliases.legacySlugs = []; // an empty alias list is not meaningful
  writeJson('cases/' + emptyAliasesId + '.json', emptyAliases);

  // Forms the URL parser forgives but the runtime refuses to render — every
  // one of them must fail HERE, or the button silently disappears from the
  // site (and the userinfo form additionally leaks credentials into the
  // public js/cards-data.js). One case per form so each is attributable.
  const cortenSeries = readJson('cases/corten-series.json');
  cortenSeries.case.cta = { enabled: true, url: 'https://user:token@dprofile.ru/works/1' };
  writeJson('cases/corten-series.json', cortenSeries);

  const cadStrut = readJson('cases/cad-strut.json');
  cadStrut.case.cta = { enabled: true, url: 'https://dprofile.ru:8443/works/1' };
  writeJson('cases/cad-strut.json', cadStrut);

  const ironclad = readJson('cases/ironclad-frame.json');
  ironclad.case.cta = { enabled: true, url: ' https://dprofile.ru/works/1' }; // padding whitespace
  writeJson('cases/ironclad-frame.json', ironclad);

  const lumenOne = readJson('cases/lumen-one.json');
  lumenOne.case.cta = { enabled: true, url: 'https:\\\\dprofile.ru/works/1' }; // backslashes
  writeJson('cases/lumen-one.json', lumenOne);

  // Suffix and prefix look-alikes of an allowlisted host (exact hostname match).
  const helixReveal = readJson('cases/helix-reveal.json');
  helixReveal.case.cta = { enabled: true, url: 'https://evil-dprofile.ru/works/1' };
  writeJson('cases/helix-reveal.json', helixReveal);

  const glintOwl2 = readJson('cases/glint-owl.json');
  glintOwl2.case.cta = { enabled: true, url: 'https://dprofile.ru.attacker.tld/works/1' };
  writeJson('cases/glint-owl.json', glintOwl2);

  // Chain integrity: a caption on a non-last strip splits the canvas, and a
  // mixed-format chain renders as a staircase.
  const corteRig = readJson('cases/core-rig.json');
  corteRig.case.media[1].seamless = true; // chain [0,1] on a manual-order case
  corteRig.case.media[2].seamless = true; // ...extended to [0,1,2]
  corteRig.case.media[2].format = corteRig.case.media[0].format === 'wide' ? 'tall' : 'wide';
  writeJson('cases/core-rig.json', corteRig);

  // case.media[i].seamless ("Behance trick"): the first block has nothing
  // above it, and the automatic layout reorders blocks, so gluing needs
  // layoutMode "manual".
  const coreRig = readJson('cases/core-rig.json');
  coreRig.layoutMode = 'manual';
  coreRig.case.media[0].seamless = true; // nothing above the first block
  writeJson('cases/core-rig.json', coreRig);

  const flexSpine = readJson('cases/flex-spine.json');
  delete flexSpine.layoutMode; // seeded — order is not authored
  flexSpine.case.media[1].seamless = true;
  writeJson('cases/flex-spine.json', flexSpine);

  // Slice B: background grammar and the optional stable block id.
  const vega = readJson('cases/vega-shell.json');
  // CSS escape: the tokenizer decodes "u\72l(" back into url() — the literal
  // "url(" ban alone does not catch it (adversarial review, P1).
  vega.case.media[0].bg = 'linear-gradient(red,blue),u\\72l(https://evil.example/pixel.png)';
  vega.case.media[1].bg = 'red; position:fixed; inset:0'; // declaration break-out
  // Second top-level background layer smuggled past the shape regex.
  vega.case.media[2].bg = 'linear-gradient(red,blue),url(https://evil.example/p.png)';
  vega.case.media[2].id = 'Slot One'; // not [a-z0-9-]
  vega.case.media[3].id = 'hero';
  vega.case.media[3].bg = 'linear-gradient(red,blue)/*x*/'; // CSS comment
  vega.case.media[4].id = 'hero'; // duplicate id inside the same case
  writeJson('cases/vega-shell.json', vega);

  // Slice B: poster is mandatory on a video block (it is the only frame shown
  // under reduced motion) and forbidden on an image block.
  const apex = readJson('cases/apex-frame.json');
  apex.case.media[0].type = 'video';
  apex.case.media[0].src = './assets/cases/orbital-mk-ii/orbital-shell-idle.webm';
  apex.case.media[0].poster = null; // video without a poster
  apex.case.media[1].poster = './assets/cases/apex-frame/01.svg'; // poster on an image block
  writeJson('cases/apex-frame.json', apex);

  const arc = readJson('cases/arc-motion.json');
  arc.case.captions = []; // mixed schema: legacy array alongside case.media
  writeJson('cases/arc-motion.json', arc);

  // case.blueprints[] (BP-DECISION-01/02): the owner authors and uploads the
  // sheet; the site only shows and serves it. The key is optional and its
  // ABSENCE is the default, so an EMPTY array must be rejected rather than
  // silently meaning "none" — one stored shape, one meaning.
  const cadStrutBp = readJson('cases/cad-strut.json');
  cadStrutBp.case.blueprints = []; // present but empty
  writeJson('cases/cad-strut.json', cadStrutBp);

  const mechLinkBp = readJson('cases/mech-link.json');
  // Over the sheet cap. A real .svg of this case keeps the failure attributable
  // to the count alone (a missing file would add its own violation).
  mechLinkBp.case.blueprints = Array.from({ length: 9 }, () => ({
    src: './assets/cases/mech-link/01.svg'
  }));
  writeJson('cases/mech-link.json', mechLinkBp);

  // src is confined to the case's OWN directory: borrowing another case's file
  // survives that case being deleted, and traversal/absolute URLs must die here.
  const apexBp = readJson('cases/apex-frame.json');
  apexBp.case.blueprints = [
    { src: './assets/cases/vega-shell/01.svg' }, // another case's directory
    { src: './assets/cases/apex-frame/01.png' }, // not an .svg
    { src: 'https://evil.example/sheet.svg' }, // absolute URL
    { src: './assets/cases/apex-frame/../vega-shell/01.svg' } // traversal
  ];
  writeJson('cases/apex-frame.json', apexBp);

  // Labels follow the SAME optional-pair rule as media captions: both locales
  // or neither. A half-filled label shows English to a Russian visitor.
  const nightshardBp = readJson('cases/nightshard.json');
  nightshardBp.case.blueprints = [
    { src: './assets/cases/nightshard/01.svg', label: { en: 'Section A-A', ru: '' } },
    { src: './assets/cases/nightshard/02.svg', id: 'Sheet One' }, // not [a-z0-9-]
    { src: './assets/cases/nightshard/03.svg', id: 'front' },
    { src: './assets/cases/nightshard/04.svg', id: 'front' } // duplicate in one case
  ];
  writeJson('cases/nightshard.json', nightshardBp);

  const orbital = readJson('cases/orbital-mk-ii.json');
  orbital.case.motionBlocks[0].src = './assets/cases/orbital-mk-ii/missing-loop.webm'; // not on disk
  orbital.case.motionBlocks[1].vimeoId = 'not-digits'; // invalid Vimeo id
  orbital.case.motionBlocks[1].vimeoHash = 'bad hash!'; // F5: invalid privacy hash (non-alphanumeric)
  orbital.case.motionBlocks[2].layout = 'tall'; // F5: layout not in {wide,half}
  orbital.case.motionBlocks[3].playback = 'loud'; // F5: playback not in {ambient,controlled}
  writeJson('cases/orbital-mk-ii.json', orbital);

  const ui = readJson('i18n-ui.json');
  delete ui.ru.skipToContent; // EN/RU parity break
  writeJson('i18n-ui.json', ui);

  const freeAssets = readJson('free-assets.json');
  freeAssets.categories[0].items.push({ ...freeAssets.categories[0].items[0] }); // duplicate id
  freeAssets.categories[0].items[1].size = ' '; // blank string field
  freeAssets.categories[0].items[1].contents = []; // empty contents list
  writeJson('free-assets.json', freeAssets);

  const meta = readJson('meta.json');
  meta.headerLogo = { src: './assets/img/header-logo.gif' }; // header logo: extension not allowed
  // Global identity is owner-editable, but never a credential-bearing or
  // malformed external endpoint. Exercise every independent guard here so a
  // permissive generator cannot publish unsafe structured data.
  meta.contactUrl = 'https://t.me/White\tCatWeb';
  meta.structuredData.organization = {
    name: '',
    alternateName: '',
    url: 'https://codex.promo/\n',
    description: { en: 'Valid English description', ru: 'Строка\u0001 с control character' },
    sameAs: ['https://t.me/WhiteCatWeb', 'https://t.me/WhiteCatWeb\r', 'https://t.me/WhiteCatWeb']
  };
  writeJson('meta.json', meta);

  // A copied case file whose name no longer matches its id.
  copyFileSync(path.join(tempDir, 'cases', 'apex-frame.json'), path.join(tempDir, 'cases', 'zz-mismatch.json'));

  const broken = runCheck();
  if (broken.status === 0) {
    console.error(broken.output);
    throw new Error('Expected --check to exit non-zero on the broken content copy.');
  }
  if (!broken.output.includes('CONTENT INVALID')) {
    console.error(broken.output);
    throw new Error('Expected the violation summary header in the output.');
  }

  const expectedViolations = [
    'cardOrder lists "ghost-case"',
    'filters[1] ("hard-surface") needs a non-empty string "label"',
    'category "all" must be a settings.json filter key other than "all"',
    '"year" must be a non-empty string',
    'card.title must have non-empty "en" and "ru"',
    'card.imgLoading must be exactly "eager" or "lazy" (got "soon")',
    'card.imgFetchPriority must be "high", "low", "auto", or null/absent (got "urgent")',
    '"size" must be a non-empty string',
    '"contents" must be a non-empty array of non-empty strings',
    'content/cases/lumen-one.json: case.media must be a non-empty array of media blocks',
    `content/cases/${invalidSlugId}.json: slug must be lowercase letters, digits and single dashes`,
    `content/cases/${invalidSlugId}.json: legacySlugs[0] must be lowercase letters, digits and single dashes`,
    `content/cases/${invalidAliasesId}.json: legacySlugs must be an array of non-empty route tokens`,
    `content/cases/${disabledCollisionId}.json: legacySlugs[1] duplicates "${sharedToken}"`,
    `content/cases/${disabledCollisionId}.json: slug must not repeat the stable id "${disabledCollisionId}"`,
    `case route token "${disabledCollisionId}" is used by both "${[disabledCollisionId, stableIdCollisionId].sort().join('" and "')}"`,
    `content/cases/${canonicalAliasId}.json: legacySlugs[0] must not repeat the canonical slug "${customCanonical}"`,
    `content/cases/${emptyAliasesId}.json: legacySlugs must be an array of non-empty route tokens`,
    `case route token "${sharedToken}" is used by both "${[disabledCollisionId, invalidAliasesId].sort().join('" and "')}"`,
    'content/cases/helix-reveal.json: case.media must be a non-empty array of media blocks',
    'case.media must have at most 12 blocks (got 13)',
    'case.media[0].format: must be "wide" or "tall" (got "huge")',
    'case.media[1].type: must be "image" or "video" (got "audio")',
    'case.media[2].src: a video block must point at a .webm file',
    'case.media[3].bg: must be a non-empty string',
    'case.media[4].caption.label: fill both "en" and "ru" or leave both empty',
    'content/cases/mech-link.json: case.cta.url must be a non-empty https:// link to the project',
    'content/cases/nyx-panther.json: case.cta.url must point at artstation.com, behance.net, dprofile.ru (got "portfolio.example.com")',
    'content/cases/recon-drone.json: case.cta.url still carries the REPLACE_WITH_REAL placeholder',
    'content/cases/nightshard.json: case.cta.enabled must be a boolean (got "yes")',
    'content/meta.json: contactUrl must be a credential-free HTTPS URL without control characters',
    'content/meta.json: structuredData.organization.name must be non-empty plain text',
    'content/meta.json: structuredData.organization.alternateName must be non-empty plain text',
    'content/meta.json: structuredData.organization.url must be a credential-free HTTPS URL without control characters',
    'content/meta.json: structuredData.organization.description.ru must be non-empty plain text without control characters',
    'content/meta.json: structuredData.organization.sameAs[1] must be a credential-free HTTPS URL without control characters',
    'content/meta.json: structuredData.organization.sameAs[2] duplicates "https://t.me/WhiteCatWeb"',
    'content/cases/core-rig.json: case.media[0].seamless: the first block has nothing above it to glue to',
    'content/cases/flex-spine.json: case.media[1].seamless: needs layoutMode "manual"',
    'content/cases/core-rig.json: case.media[0].caption: only the LAST block of a glued chain may carry a caption',
    'content/cases/core-rig.json: case.media[1].caption: only the LAST block of a glued chain may carry a caption',
    'content/cases/core-rig.json: case.media[2].format: every block of a glued chain must share one format',
    'content/cases/corten-series.json: case.cta.url must not carry a user name or password before the host',
    'content/cases/cad-strut.json: case.cta.url must not carry a port',
    'content/cases/ironclad-frame.json: case.cta.url must not start or end with spaces',
    'content/cases/lumen-one.json: case.cta.url must not contain backslashes',
    'content/cases/helix-reveal.json: case.cta.url must point at artstation.com, behance.net, dprofile.ru (got "evil-dprofile.ru")',
    'content/cases/glint-owl.json: case.cta.url must point at artstation.com, behance.net, dprofile.ru (got "dprofile.ru.attacker.tld")',
    'content/cases/vega-shell.json: case.media[0].bg: must be a single var(--token), #hex colour or linear/radial-gradient',
    'content/cases/vega-shell.json: case.media[1].bg: must be a single var(--token), #hex colour or linear/radial-gradient',
    'content/cases/vega-shell.json: case.media[2].bg: must be a single var(--token), #hex colour or linear/radial-gradient',
    'content/cases/vega-shell.json: case.media[3].bg: must be a single var(--token), #hex colour or linear/radial-gradient',
    'case.media[2].id: must be lowercase letters, digits and dashes (got "Slot One")',
    'case.media[4].id: duplicate block id "hero" in this case',
    'content/cases/apex-frame.json: case.media[0].poster: a video block needs a poster image',
    'content/cases/apex-frame.json: case.media[1].poster: only a video block may carry a poster',
    'content/cases/arc-motion.json: case.captions is obsolete — case.media[] is the only media schema',
    'content/cases/cad-strut.json: case.blueprints, when present, must be a non-empty array of sheets',
    'content/cases/mech-link.json: case.blueprints must have at most 8 sheets (got 9)',
    'content/cases/apex-frame.json: case.blueprints[0].src: must live under "./assets/cases/apex-frame/"',
    'content/cases/apex-frame.json: case.blueprints[1].src: "./assets/cases/apex-frame/01.png" must end with .svg',
    'content/cases/apex-frame.json: case.blueprints[2].src: "https://evil.example/sheet.svg" must start with "./assets/"',
    'content/cases/apex-frame.json: case.blueprints[3].src: "./assets/cases/apex-frame/../vega-shell/01.svg" must not contain ".." segments',
    'content/cases/nightshard.json: case.blueprints[0].label: fill both "en" and "ru" or leave both empty',
    'content/cases/nightshard.json: case.blueprints[1].id: must be lowercase letters, digits and dashes (got "Sheet One")',
    'content/cases/nightshard.json: case.blueprints[3].id: duplicate sheet id "front" in this case',
    'must not contain ".." segments',
    'missing-loop.webm',
    'must be a string of digits ("not-digits")',
    'must be a string of alphanumeric characters ("bad hash!")',
    'layout: must be "wide" or "half" ("tall")',
    'playback: must be "ambient" or "controlled" ("loud")',
    'key "skipToContent" exists in en but not in ru',
    'duplicate id',
    'file name does not match id "apex-frame"',
    'duplicate case id "apex-frame"',
    'headerLogo.src must be a .svg/.png/.webp image'
  ];
  const unreported = expectedViolations.filter((needle) => !broken.output.includes(needle));
  if (unreported.length > 0) {
    console.error(broken.output);
    throw new Error(`Expected violations not reported (validator must list ALL of them): ${unreported.join(' | ')}`);
  }

  console.log('content validator reports every injected violation and exits non-zero');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
