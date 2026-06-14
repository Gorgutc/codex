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
  settings.cardOrder.push('ghost-case'); // orphan cardOrder entry
  delete settings.filters[1].label; // filter without a label
  writeJson('settings.json', settings);

  const lumen = readJson('cases/lumen-one.json');
  lumen.category = 'all'; // reserved filter key
  lumen.year = 2024; // must be a string
  lumen.card.title.ru = ''; // empty locale value
  lumen.card.imgLoading = 'soon'; // not "eager"/"lazy"
  lumen.card.imgFetchPriority = 'urgent'; // not a fetchpriority value
  lumen.case.palette = lumen.case.palette.slice(0, 4); // wrong length
  lumen.case.modelSrc = './assets/../outside/model.glb'; // traversal attempt
  writeJson('cases/lumen-one.json', lumen);

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
    'case.palette must be an array of 5 non-empty strings',
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
