/* Self-test for ASSET-BUDGET-01 — the shipped-asset byte budget.
 *
 * WHY THE GATE EXISTS: a 21.85 MB .glb was published from the admin panel and
 * reached production. Nothing stated a maximum size for a shipped asset, so the
 * only symptom was `npm run verify` timing out for 30 s while Playwright waited
 * on a 3D pane busy downloading it.
 *
 * DERIVATION DISCIPLINE (this repo's most-repeated failure — hardcoded fixture
 * ids, "exactly one X" assumptions and EN==RU comparisons broke it seven times
 * in a single day). Every assertion below is either
 *   (a) a pure unit assertion on scripts/asset-budget.mjs with an in-memory
 *       fixture — no repo content involved at all; or
 *   (b) derived from what is actually on disk at test time: the class list
 *       comes from ASSET_BUDGETS, the members of each class come from the
 *       resolver, and the case used for the end-to-end scenario is DISCOVERED
 *       by scanning the sandbox for a case that carries a model.
 * No case id, no case count, no asset count is written down anywhere here. A
 * precondition that cannot be met prints `SKIP <name>: <reason>` and passes —
 * the idiom already used in tests/quality/content-visibility.test.mjs.
 *
 * Scenarios:
 *   - budget table sanity          → every class warn < fail, hints complete;
 *   - classification               → extension decides the class, not the field;
 *   - grandfathering re-arms       → debt matches on EXACT bytes only;
 *   - live repo                    → zero un-grandfathered violations;
 *   - live repo                    → the js-scanned arm is alive (HDR visible);
 *   - admin mirror                 → MEDIA_RULES blockBytes == canonical fails;
 *   - admin mirror drift           → a mutated MEDIA_RULES copy IS reported;
 *   - throwaway root               → the audit reports an oversized model whose
 *                                    ONLY reference is one case's modelSrc;
 *   - generator end-to-end         → the same file makes `generate-content`
 *                                    exit 1 with a message naming the file, its
 *                                    size, its class and the budget.
 *
 * Plain node test — no Playwright. Wired into `npm run test:content-validate`.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ASSET_BUDGETS,
  ASSET_BUDGET_DEBT,
  ASSET_CLASS_EXTS,
  MB,
  assetBudgetViolation,
  assetClassOf,
  budgetProblem,
  budgetWarns,
  formatBytes,
  knownDebtFor
} from '../../scripts/asset-budget.mjs';
import { adminMirrorProblems, auditAssets, parseAdminMediaRules } from '../../scripts/asset-budget-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const generatorPath = path.join(root, 'scripts', 'generate-content.mjs');

function fail(message, output) {
  if (output) console.error(output);
  throw new Error(message);
}

function ok(name, detail) {
  console.log(`OK   ${name}${detail ? ' — ' + detail : ''}`);
}

function skip(name, reason) {
  console.log(`SKIP ${name}: ${reason}`);
}

/* ── 1. budget table sanity (pure, no repo content) ──────────────────────── */
{
  const expectedHardLimits = {
    model: 50 * MB,
    hdr: 4 * MB,
    video: 40 * MB,
    vector: 2 * MB,
    raster: 2 * MB,
    download: null
  };
  const classes = Object.keys(ASSET_BUDGETS);
  if (classes.length === 0) fail('ASSET_BUDGETS is empty — the gate would have nothing to enforce');
  if (ASSET_BUDGETS.model.warnBytes !== 25 * MB) {
    fail(`model warnBytes must be exactly 25 MiB, got ${ASSET_BUDGETS.model.warnBytes}`);
  }
  if (ASSET_BUDGETS.model.failBytes !== 50 * MB) {
    fail(`model failBytes must remain exactly 50 MiB, got ${ASSET_BUDGETS.model.failBytes}`);
  }
  if (JSON.stringify(Object.keys(ASSET_BUDGETS).sort()) !== JSON.stringify(Object.keys(expectedHardLimits).sort())) {
    fail('the asset-class set drifted — update the owner-approved complete hard-limit map intentionally');
  }
  for (const [assetClass, expectedFailBytes] of Object.entries(expectedHardLimits)) {
    if (ASSET_BUDGETS[assetClass].failBytes !== expectedFailBytes) {
      fail(
        `class "${assetClass}" failBytes must remain ${expectedFailBytes}, got ${ASSET_BUDGETS[assetClass].failBytes}`
      );
    }
  }
  for (const assetClass of classes) {
    const budget = ASSET_BUDGETS[assetClass];
    if (!Array.isArray(ASSET_CLASS_EXTS[assetClass]) || ASSET_CLASS_EXTS[assetClass].length === 0) {
      fail(`class "${assetClass}" has a budget but no extensions — nothing could ever be classified into it`);
    }
    if (typeof budget.warnBytes !== 'number' || budget.warnBytes <= 0) {
      fail(`class "${assetClass}" has no usable warnBytes`);
    }
    if (budget.failBytes !== null && budget.failBytes <= budget.warnBytes) {
      fail(
        `class "${assetClass}" fails at ${budget.failBytes} but warns at ${budget.warnBytes} — the warn is unreachable`
      );
    }
    if (typeof budget.label !== 'string' || budget.label === '') {
      fail(`class "${assetClass}" has no label — the violation message would not say what kind of asset it is`);
    }
  }
  // Extensions must be unique across classes, otherwise assetClassOf depends on
  // Object.keys order and the budget of a file becomes non-deterministic.
  const seen = new Map();
  for (const [assetClass, exts] of Object.entries(ASSET_CLASS_EXTS)) {
    for (const ext of exts) {
      if (seen.has(ext)) fail(`extension ${ext} is claimed by both "${seen.get(ext)}" and "${assetClass}"`);
      seen.set(ext, assetClass);
    }
  }
  ok('budget table', `${classes.length} classes, ${seen.size} extensions, warn < fail everywhere`);
}

/* ── 2. classification + message shape (pure, in-memory fixtures) ─────────── */
{
  if (assetClassOf('./assets/cases/x/clip.webm') !== 'video') fail('a .webm must classify as video');
  if (assetClassOf('./assets/cases/x/slide.SVG') !== 'vector') fail('classification must be case-insensitive');
  if (assetClassOf('./assets/models/x.glb') !== 'model') fail('a .glb must classify as model');
  if (assetClassOf('./assets/hdr/x.hdr') !== 'hdr') fail('a .hdr must classify as hdr');
  // Class comes from the extension, NOT from the content field: case.media[].src
  // carries an image or a video depending on the block type.
  if (assetClassOf('./assets/cases/x/01.jpg') !== 'raster') fail('a .jpg media src must classify as raster');
  // Unbudgeted extensions are silent, not violations.
  if (assetClassOf('./js/vendor/draco.wasm') !== null) fail('an unbudgeted extension must classify as null');
  if (assetBudgetViolation('./js/vendor/draco.wasm', 99 * 1024 * 1024) !== null) {
    fail('an unbudgeted extension must never produce a violation');
  }

  const modelWarn = 25 * MB;
  const modelFail = 50 * MB;
  if (budgetWarns('model', modelWarn) !== false) fail('exactly 25 MiB must not warn');
  if (budgetWarns('model', modelWarn + 1) !== true) fail('one byte above 25 MiB must warn');
  if (budgetProblem('model', modelFail) !== null) fail('exactly 50 MiB must pass (<=, not <)');
  const over = budgetProblem('model', modelFail + 1);
  if (over === null) fail('one byte over the fail line must be a violation');
  // The message has to be actionable: file size, exact bytes, budget and class.
  for (const needle of [String(modelFail + 1), formatBytes(modelFail), ASSET_BUDGETS.model.label]) {
    if (!over.includes(needle)) fail(`the violation message must mention ${JSON.stringify(needle)} — got: ${over}`);
  }
  if (budgetWarns('model', modelFail) !== true) fail('exactly 50 MiB must remain in the advisory band');
  if (budgetWarns('model', modelFail + 1) !== false) fail('a blocked model must not also be reported as a warning');
  // download is warn-only: the repo copies are placeholders excluded from the
  // Beget mirror, so the gate cannot see the artifact a visitor downloads.
  if (ASSET_BUDGETS.download.failBytes !== null) fail('the download class must stay warn-only');
  if (budgetProblem('download', 10 * 1024 * 1024 * 1024) !== null) fail('a warn-only class must never fail');
  ok('classification + message shape', 'extension decides the class; message names size, bytes, budget and class');
}

/* ── 3. grandfathering re-arms on ANY size change ─────────────────────────── */
{
  if (ASSET_BUDGET_DEBT.length === 0) {
    skip('grandfather re-arm', 'ASSET_BUDGET_DEBT is empty — nothing is grandfathered, so nothing can go stale');
  } else {
    for (const entry of ASSET_BUDGET_DEBT) {
      if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
        fail(`grandfather entry ${entry.path} carries no reason — undocumented debt is indistinguishable from a bug`);
      }
      if (knownDebtFor(entry.path, entry.bytes) === null) fail(`grandfather entry ${entry.path} does not match itself`);
      // THE POINT of keying on bytes: a re-upload changes the size, the entry
      // stops matching, and the gate re-arms with no human step.
      if (knownDebtFor(entry.path, entry.bytes + 1) !== null) {
        fail(`grandfather entry ${entry.path} still matches at a different size — the gate would never re-arm`);
      }
      if (knownDebtFor(entry.path.replace('/assets/', '/assets/other/'), entry.bytes) !== null) {
        fail(`grandfather entry ${entry.path} matches a different path — the waiver is too broad`);
      }
      // A grandfather entry must be necessary: waiving something already under
      // budget is dead weight that hides a real regression later.
      const assetClass = assetClassOf(entry.path);
      if (assetClass === null || budgetProblem(assetClass, entry.bytes) === null) {
        fail(`grandfather entry ${entry.path} is under budget already — delete it instead of waiving it`);
      }
    }
    ok('grandfather re-arm', `${ASSET_BUDGET_DEBT.length} entr(ies), each keyed by path AND exact byte size`);
  }
}

/* ── 4. the LIVE repo passes the gate (derived, nothing hardcoded) ────────── */
{
  const audit = auditAssets(root);
  if (audit.entries.length === 0) {
    fail('the resolver returned zero shipped assets — a silently empty reference set would make every check pass');
  }
  if (audit.failures.length) {
    fail(
      'the live repo violates the asset budget:\n' + audit.failures.map((e) => `  ${e.path} ${e.problem}`).join('\n')
    );
  }
  // Per-class report is DERIVED: classes with no member are dormant, not failed.
  const dormant = [];
  for (const assetClass of Object.keys(ASSET_BUDGETS)) {
    const members = audit.byClass[assetClass];
    if (members.length === 0) {
      dormant.push(assetClass);
      continue;
    }
    const largest = members[0];
    const budget = ASSET_BUDGETS[assetClass];
    if (
      budget.failBytes !== null &&
      largest.bytes > budget.failBytes &&
      knownDebtFor(largest.path, largest.bytes) === null
    ) {
      fail(
        `class ${assetClass}: ${largest.path} is ${formatBytes(largest.bytes)} — over ${formatBytes(budget.failBytes)}`
      );
    }
  }
  for (const assetClass of dormant) {
    skip(`live budget: ${assetClass}`, `no shipped asset of this class in content/ or the shipped HTML/CSS/JS`);
  }
  if (audit.staleDebt.length) {
    // Not a failure: a stale entry means the gate is already armed on that path
    // (e.g. the owner re-uploaded the model). It is cruft, and saying so is the
    // whole value of reporting it.
    console.log(
      `NOTE stale grandfather entr(ies) — nothing on disk matches path+size, safe to delete from ASSET_BUDGET_DEBT: ` +
        audit.staleDebt.map((e) => `${e.path}@${e.bytes}`).join(', ')
    );
  }
  ok(
    'live repo budget',
    `${audit.entries.length} shipped file(s), 0 violations, ${audit.warnings.length} warning(s), ${audit.debt.length} grandfathered`
  );
}

/* ── 5. the js-scanned arm is alive ───────────────────────────────────────── */
{
  // No content/*.json holds an HDR path — case.modelEnvironment stores a key
  // name and the URL table is hardcoded in js/main.js. If the literal scan of
  // js/ ever stops working, a content-only resolver would still look green
  // while missing ~22 MB of shipped bytes, so this asserts the arm is wired.
  const audit = auditAssets(root);
  const contentDeclared = /"\.\/assets\/[^"]+\.(hdr|exr)"/i;
  const anyContentHdr = ['settings.json', 'free-assets.json', 'meta.json'].some((file) => {
    const abs = path.join(root, 'content', file);
    return existsSync(abs) && contentDeclared.test(readFileSync(abs, 'utf8'));
  });
  if (audit.byClass.hdr.length > 0) {
    if (anyContentHdr) {
      skip('js-scanned arm', 'an HDR path now exists in content/ too — the scan is no longer the only source');
    } else {
      ok('js-scanned arm', `${audit.byClass.hdr.length} HDR file(s) resolved from shipped JS literals alone`);
    }
  } else {
    skip('js-scanned arm', 'no HDR/EXR is referenced anywhere — nothing only the literal scan could see');
  }
}

/* ── 6. admin/js/state.js MEDIA_RULES mirror ──────────────────────────────── */
{
  const problems = adminMirrorProblems(root);
  if (problems.length) fail('the admin budget mirror has drifted:\n' + problems.map((p) => `  ${p}`).join('\n'));
  ok('admin mirror', 'MEDIA_RULES hard limits and focused model warning match the canon');
}

/* ── 7. NEGATIVE: a drifted admin mirror IS reported ──────────────────────── */
{
  // Without this, a mirror check that silently stopped parsing MEDIA_RULES
  // would look identical to a mirror that is in sync.
  const sandbox = mkdtempSync(path.join(tmpdir(), 'codex-budget-mirror-'));
  try {
    const source = readFileSync(path.join(root, 'admin', 'js', 'state.js'), 'utf8');
    const rules = parseAdminMediaRules(source);
    if (rules === null) fail('parseAdminMediaRules could not read the live MEDIA_RULES literal');
    // Pick the slot to break by SCANNING the parsed rules, not by naming one.
    const slot = Object.keys(rules).find((key) => /blockBytes\s*:/.test(rules[key]));
    if (slot === undefined) {
      skip('admin mirror drift', 'no MEDIA_RULES slot declares blockBytes — nothing to mutate');
    } else {
      const original = /blockBytes\s*:\s*([^,\n}]+)/.exec(rules[slot])[0];
      const mutated = source.replace(rules[slot], rules[slot].replace(original, 'blockBytes: 999 * MB'));
      if (mutated === source) fail('the mirror mutation did not change the file — the negative test proves nothing');
      mkdirSync(path.join(sandbox, 'admin', 'js'), { recursive: true });
      writeFileSync(path.join(sandbox, 'admin', 'js', 'state.js'), mutated, 'utf8');
      const problems = adminMirrorProblems(sandbox);
      if (!problems.some((p) => p.includes(`"${slot}"`))) {
        fail(`a 999 MB blockBytes on slot "${slot}" was not reported:\n${problems.join('\n')}`);
      }
      ok('admin mirror drift', `a mutated blockBytes on slot "${slot}" is reported`);
    }
    // The model advisory is the one intentional warning-parity exception.
    const modelWarn = /warnBytes\s*:\s*([^,\n}]+)/.exec(rules.model || '');
    if (modelWarn === null) fail('the model MEDIA_RULES slot has no readable warnBytes to mutate');
    const modelMutated = source.replace(
      rules.model,
      rules.model.replace(modelWarn[0], 'warnBytes: 999 * MB')
    );
    writeFileSync(path.join(sandbox, 'admin', 'js', 'state.js'), modelMutated, 'utf8');
    const modelProblems = adminMirrorProblems(sandbox);
    if (!modelProblems.some((p) => p.includes('"model"') && p.includes('warnBytes'))) {
      fail(`a 999 MB model warnBytes was not reported:\n${modelProblems.join('\n')}`);
    }
    ok('admin model warning drift', 'a mutated model warnBytes is reported');

    // Blueprints are vector uploads and need the same hard-limit mirror proof.
    const blueprintBlock = /blockBytes\s*:\s*([^,\n}]+)/.exec(rules.blueprint || '');
    if (blueprintBlock === null) fail('the blueprint MEDIA_RULES slot has no readable blockBytes to mutate');
    const blueprintMutated = source.replace(
      rules.blueprint,
      rules.blueprint.replace(blueprintBlock[0], 'blockBytes: 999 * MB')
    );
    writeFileSync(path.join(sandbox, 'admin', 'js', 'state.js'), blueprintMutated, 'utf8');
    const blueprintProblems = adminMirrorProblems(sandbox);
    if (
      !blueprintProblems.some(
        (p) => p.includes('slot "blueprint" blockBytes') && p.includes('the vector budget')
      )
    ) {
      fail(`a 999 MB blueprint blockBytes was not reported:\n${blueprintProblems.join('\n')}`);
    }
    ok('admin blueprint drift', 'a mutated blueprint blockBytes is reported');
    // A missing/unreadable file must be a problem, never silent success.
    if (adminMirrorProblems(path.join(sandbox, 'nowhere')).length === 0) {
      fail('a missing admin/js/state.js reported no problem — "cannot check" must not look like "in sync"');
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

/* ── 8. NEGATIVE: the audit catches an oversized model in a throwaway root ── */
{
  /* A throwaway root whose ONLY reference to the oversized file is ONE case's
   * case.modelSrc. Against the live repo most assets are referenced from more
   * than one place, so a resolver that silently dropped the modelSrc slot would
   * still look green — the same reasoning that made buildReferenceSet take a
   * `root` parameter in scripts/clean-orphan-assets.mjs. */
  const sandbox = mkdtempSync(path.join(tmpdir(), 'codex-budget-root-'));
  try {
    cpSync(path.join(root, 'content'), path.join(sandbox, 'content'), { recursive: true });
    const settings = JSON.parse(readFileSync(path.join(sandbox, 'content', 'settings.json'), 'utf8'));
    // DISCOVER the target case; never name one.
    const targetId = (settings.cardOrder || []).find((id) => {
      const abs = path.join(sandbox, 'content', 'cases', `${id}.json`);
      if (!existsSync(abs)) return false;
      const data = JSON.parse(readFileSync(abs, 'utf8'));
      return data.case !== undefined && data.case !== null && typeof data.case.modelSrc === 'string';
    });
    if (targetId === undefined) {
      skip('throwaway root', 'no case in content/ carries a case.modelSrc — the fixture cannot be built');
    } else {
      const relPath = './assets/models/asset-budget-selftest.glb';
      const oversize = ASSET_BUDGETS.model.failBytes + 1;
      const casePath = path.join(sandbox, 'content', 'cases', `${targetId}.json`);
      const data = JSON.parse(readFileSync(casePath, 'utf8'));
      data.case.modelSrc = relPath;
      writeFileSync(casePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      mkdirSync(path.join(sandbox, 'assets', 'models'), { recursive: true });
      writeFileSync(path.join(sandbox, 'assets', 'models', 'asset-budget-selftest.glb'), Buffer.alloc(oversize));

      const audit = auditAssets(sandbox);
      const reported = audit.failures.find((entry) => entry.path === relPath);
      if (reported === undefined) {
        fail(
          `the audit did not report ${relPath} at ${oversize} B. Failures: ` +
            (audit.failures.map((e) => e.path).join(', ') || '(none)')
        );
      }
      if (reported.assetClass !== 'model') fail(`the oversized file was classified as ${reported.assetClass}`);
      ok('throwaway root', `an oversized model reachable only through case "${targetId}" modelSrc is reported`);
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

/* ── 9. NEGATIVE: the generator (the publish-path host) exits 1 ───────────── */
{
  /* checkAssetFile resolves asset paths against the REPO root, not against
   * CONTENT_DIR, so the oversized fixture has to be written into the repo's own
   * assets/ tree and removed in `finally` — the same pattern
   * tests/quality/content-visibility.test.mjs uses for its cache-busted OG
   * images. This is the scenario that matters most: it is the gate that runs in
   * the `regen` step of .github/workflows/content-publish.yml. */
  const fixtureRel = './assets/models/asset-budget-selftest.glb';
  const fixtureAbs = path.join(root, 'assets', 'models', 'asset-budget-selftest.glb');
  const contentDir = mkdtempSync(path.join(tmpdir(), 'codex-budget-gen-content-'));
  const outDir = mkdtempSync(path.join(tmpdir(), 'codex-budget-gen-out-'));
  const run = () =>
    spawnSync(process.execPath, [generatorPath, '--write'], {
      cwd: root,
      env: { ...process.env, CONTENT_DIR: contentDir, CONTENT_OUT_DIR: outDir },
      encoding: 'utf8'
    });
  try {
    if (existsSync(fixtureAbs)) fail(`${fixtureRel} already exists — refusing to overwrite a real asset`);
    cpSync(path.join(root, 'content'), contentDir, { recursive: true });

    // Control run on the untouched copy: if THIS is red, the scenario below
    // would prove nothing.
    const control = run();
    if (control.status !== 0)
      fail('control run on a pristine content copy failed', `${control.stdout}\n${control.stderr}`);

    const settings = JSON.parse(readFileSync(path.join(contentDir, 'settings.json'), 'utf8'));
    const targetId = (settings.cardOrder || []).find((id) => {
      const abs = path.join(contentDir, 'cases', `${id}.json`);
      if (!existsSync(abs)) return false;
      const data = JSON.parse(readFileSync(abs, 'utf8'));
      return data.case !== undefined && data.case !== null && typeof data.case.modelSrc === 'string';
    });
    if (targetId === undefined) {
      skip('generator gate', 'no case in content/ carries a case.modelSrc — the fixture cannot be built');
    } else {
      const oversize = ASSET_BUDGETS.model.failBytes + 1;
      writeFileSync(fixtureAbs, Buffer.alloc(oversize));
      const casePath = path.join(contentDir, 'cases', `${targetId}.json`);
      const data = JSON.parse(readFileSync(casePath, 'utf8'));
      data.case.modelSrc = fixtureRel;
      writeFileSync(casePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

      const broken = run();
      const output = `${broken.stdout}\n${broken.stderr}`;
      if (broken.status === 0) fail('the generator accepted an oversized model', output);
      if (!output.includes('CONTENT INVALID')) fail('the generator did not report a content violation', output);
      // The message must be actionable on its own: where, which file, how big,
      // which budget, which class.
      for (const needle of [
        `content/cases/${targetId}.json`,
        fixtureRel,
        String(oversize),
        formatBytes(ASSET_BUDGETS.model.failBytes),
        ASSET_BUDGETS.model.label
      ]) {
        if (!output.includes(needle)) fail(`the generator message is missing ${JSON.stringify(needle)}`, output);
      }
      ok('generator gate', `an oversized model on case "${targetId}" exits 1 with an actionable message`);
    }
  } finally {
    rmSync(fixtureAbs, { force: true });
    rmSync(contentDir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

console.log('\nasset-budget self-test: all scenarios passed.');
