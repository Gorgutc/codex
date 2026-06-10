/* Self-test for iteration F generator semantics (visibility + layoutMode).
 *
 * For every scenario a fresh copy of content/ goes to a temp CONTENT_DIR and
 * the generator runs against it:
 *   - disable one case            → grid html, cards-data and locales drop it;
 *   - disable a whole category    → its filter checkbox AND its cases are gone;
 *   - layoutMode invalid value    → validation error (exit 1);
 *   - layoutMode 'manual'         → flag emitted into cards-data entry;
 *   - all cases disabled          → "at least one case visible" guard fires;
 *   - 'all' filter disabled       → validation error.
 *
 * --write output goes to a temp CONTENT_OUT_DIR (the working tree is never
 * touched). Plain node test — no Playwright. Wired into test:content-validate.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatorPath = path.join(root, 'scripts', 'generate-content.mjs');

function fail(message, output) {
  if (output) console.error(output);
  throw new Error(message);
}

// Fresh sandbox per scenario: contentDir = copy of content/, outDir = empty.
function makeSandbox(name) {
  const contentDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-content-`));
  const outDir = mkdtempSync(path.join(tmpdir(), `codex-visibility-${name}-out-`));
  cpSync(path.join(root, 'content'), contentDir, { recursive: true });
  return {
    contentDir,
    outDir,
    readJson(rel) {
      return JSON.parse(readFileSync(path.join(contentDir, rel), 'utf8'));
    },
    writeJson(rel, value) {
      writeFileSync(path.join(contentDir, rel), JSON.stringify(value, null, 2) + '\n', 'utf8');
    },
    readOut(rel) {
      return readFileSync(path.join(outDir, rel), 'utf8');
    },
    run(mode) {
      const result = spawnSync(process.execPath, [generatorPath, mode], {
        cwd: root,
        env: { ...process.env, CONTENT_DIR: contentDir, CONTENT_OUT_DIR: outDir },
        encoding: 'utf8'
      });
      return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
    },
    cleanup() {
      rmSync(contentDir, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  };
}

function caseIdsOfCategory(sandbox, key) {
  const settings = sandbox.readJson('settings.json');
  return settings.cardOrder.filter((id) => sandbox.readJson(path.join('cases', `${id}.json`)).category === key);
}

// CARDS_LOCALES + CASE_LOCALES slice of js/i18n-data.js. FA_LOCALES stays out:
// free-assets items legitimately share ids with cases (vega-shell etc.) and
// must NOT react to case visibility.
function caseLocalesSection(i18n) {
  const start = i18n.indexOf('const CARDS_LOCALES');
  const end = i18n.indexOf('const FA_LOCALES');
  if (start < 0 || end <= start) fail('i18n-data.js: locale sections not found');
  return i18n.slice(start, end);
}

/* 1 — disabling one case drops it from grid html, cards-data and locales */
{
  const sandbox = makeSandbox('case-off');
  try {
    const vega = sandbox.readJson('cases/vega-shell.json');
    vega.enabled = false;
    sandbox.writeJson('cases/vega-shell.json', vega);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with one case disabled', result.output);

    const grid = sandbox.readOut('index.html');
    if (grid.includes('data-id="vega-shell"')) fail('grid html must not contain the disabled case card');
    const expectedCards = sandbox.readJson('settings.json').cardOrder.length - 1;
    const actualCards = (grid.match(/class="work-card"/g) || []).length;
    if (actualCards !== expectedCards) {
      fail(`grid must keep the other ${expectedCards} cards (got ${actualCards})`);
    }

    const cardsData = sandbox.readOut('js/cards-data.js');
    if (cardsData.includes("'vega-shell'")) fail('cards-data must not contain the disabled case entry');

    const locales = caseLocalesSection(sandbox.readOut('js/i18n-data.js'));
    if (locales.includes("'vega-shell'")) fail('case locales must not contain the disabled case');
    // count drop: the disabled case is gone from all four dictionaries
    // (CARDS en/ru + CASE en/ru) while enabled cases keep all four entries.
    const enabledEntries = (locales.match(/'orbital-mk-ii'/g) || []).length;
    if (enabledEntries !== 4) fail(`enabled cases must keep 4 locale entries (got ${enabledEntries})`);
    console.log('case disable: card, cards-data entry and locales dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 2 — disabling a category removes its filter checkbox and all its cases */
{
  const sandbox = makeSandbox('category-off');
  try {
    const cadIds = caseIdsOfCategory(sandbox, 'cad');
    if (cadIds.length === 0) fail('sanity: the cad category must have cases');
    const settings = sandbox.readJson('settings.json');
    settings.filters.find((f) => f.key === 'cad').enabled = false;
    sandbox.writeJson('settings.json', settings);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with a category disabled', result.output);

    const grid = sandbox.readOut('index.html');
    if (grid.includes('data-filter="cad"')) fail('filters region must not contain the disabled category checkbox');
    if (!grid.includes('data-filter="organic"')) fail('enabled filter checkboxes must stay');
    for (const id of cadIds) {
      if (grid.includes(`data-id="${id}"`)) fail(`grid must not contain ${id} (its category is disabled)`);
    }

    const cardsData = sandbox.readOut('js/cards-data.js');
    const locales = caseLocalesSection(sandbox.readOut('js/i18n-data.js'));
    for (const id of cadIds) {
      if (cardsData.includes(`'${id}'`)) fail(`cards-data must not contain ${id}`);
      if (locales.includes(`'${id}'`)) fail(`case locales must not contain ${id}`);
    }
    console.log('category disable: checkbox and all category cases dropped');
  } finally {
    sandbox.cleanup();
  }
}

/* 3 — invalid layoutMode value is a validation error */
{
  const sandbox = makeSandbox('layout-invalid');
  try {
    const lumen = sandbox.readJson('cases/lumen-one.json');
    lumen.layoutMode = 'random';
    sandbox.writeJson('cases/lumen-one.json', lumen);

    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail on an invalid layoutMode', result.output);
    if (!result.output.includes('layoutMode must be "seeded" or "manual"')) {
      fail('expected the layoutMode enum violation in the output', result.output);
    }
    console.log('layoutMode enum: invalid value rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 4 — layoutMode 'manual' travels into the cards-data entry */
{
  const sandbox = makeSandbox('layout-manual');
  try {
    const orbital = sandbox.readJson('cases/orbital-mk-ii.json');
    orbital.layoutMode = 'manual';
    sandbox.writeJson('cases/orbital-mk-ii.json', orbital);

    const result = sandbox.run('--write');
    if (result.status !== 0) fail('--write must succeed with layoutMode manual', result.output);

    const cardsData = sandbox.readOut('js/cards-data.js');
    const orbitalEntry = cardsData.slice(cardsData.indexOf("'orbital-mk-ii'"), cardsData.indexOf("'vega-shell'"));
    if (!orbitalEntry.includes("layoutMode: 'manual'")) {
      fail('the manual case entry must carry layoutMode in cards-data');
    }
    if ((cardsData.match(/layoutMode/g) || []).length !== 1) {
      fail('seeded cases must not carry the layoutMode flag');
    }
    console.log('layoutMode manual: flag emitted into cards-data');
  } finally {
    sandbox.cleanup();
  }
}

/* 5 — disabling every case trips the "at least one visible" guard */
{
  const sandbox = makeSandbox('all-off');
  try {
    for (const id of sandbox.readJson('settings.json').cardOrder) {
      const data = sandbox.readJson(path.join('cases', `${id}.json`));
      data.enabled = false;
      sandbox.writeJson(path.join('cases', `${id}.json`), data);
    }
    const result = sandbox.run('--check');
    if (result.status === 0) fail('--check must fail when every case is hidden', result.output);
    if (!result.output.includes('at least one case must stay visible')) {
      fail('expected the empty-grid guard violation in the output', result.output);
    }
    console.log('empty-grid guard: zero visible cases rejected');
  } finally {
    sandbox.cleanup();
  }
}

/* 6 — the 'all' filter cannot be disabled */
{
  const sandbox = makeSandbox('all-filter');
  try {
    const settings = sandbox.readJson('settings.json');
    settings.filters.find((f) => f.key === 'all').enabled = false;
    sandbox.writeJson('settings.json', settings);

    const result = sandbox.run('--check');
    if (result.status === 0) fail("--check must fail when the 'all' filter is disabled", result.output);
    if (!result.output.includes('"all" filter cannot be disabled')) {
      fail("expected the 'all' filter violation in the output", result.output);
    }
    console.log("'all' filter guard: disable attempt rejected");
  } finally {
    sandbox.cleanup();
  }
}

console.log('iteration F visibility/layoutMode generator semantics verified');
