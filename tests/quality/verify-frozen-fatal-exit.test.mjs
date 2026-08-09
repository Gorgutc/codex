import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourcePath = path.join(root, 'verify-frozen.js');
const contractPath = path.join(root, 'scripts', 'model-runtime-contract.cjs');
const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-verify-fatal-'));
const tempPath = path.join(tempDir, 'verify-frozen-fatal-copy.js');
const tempContractPath = path.join(tempDir, 'scripts', 'model-runtime-contract.cjs');

try {
  const source = readFileSync(sourcePath, 'utf8');
  const contractSource = readFileSync(contractPath, 'utf8');
  const verifierRuntimeContract = [
    [/require\('\.\/scripts\/model-runtime-contract\.cjs'\)/, 'shared model runtime contract import'],
    [/const beforeWatchdog = \(operation, label\) => withAbsoluteDeadline\(\s*operation,\s*watchdogDeadlineAt/, 'lazy absolute model runtime watchdog call'],
    [/async function runDedicatedHeaviestModelSmoke/, 'dedicated heaviest-model error boundary'],
    [/const startedAt = Date\.now\(\);\s*const watchdogDeadlineAt = startedAt \+ MODEL_RUNTIME_WATCHDOG_MS;[\s\S]*?withAbsoluteDeadline\(\s*\(\) => page\.goto/, 'whole-scenario watchdog starts before dedicated navigation'],
    [/runHeaviestModelSmoke\(page, observedErrors, startedAt, watchdogDeadlineAt\)/, 'whole-scenario watchdog is shared with the runtime phases'],
    [/firstPartyHttpFailure\(response\.url\(\), response\.status\(\), baseUrl\)/, 'first-party HTTP failure classifier call'],
    [/page\.on\('response', onResponse\)/, 'first-party response listener wiring'],
    [/classifyModelRuntime\(totalMs\)\.label/, 'runtime performance classification call'],
    [/await page\.close\(\);\s*const heavyPage = await ctx\.newPage\(\)/, 'primary-page isolation before the heaviest model'],
    [/lightweightPaginationPlan\([\s\S]*?GENERAL_MODEL_CASE\.caseId,[\s\S]*?HEAVIEST_MODEL_CASE\.caseId/, 'lightweight pagination plan call'],
    [/loadPhase\.run\(\s*Promise\.all\(\[responsePromise, readyPromise, clickPromise\]\)/, 'already-observed heaviest readiness aggregate'],
    [/const expectedModelUrl = new URL\(target\.publicPath, page\.url\(\)\)\.href/, 'absolute expected heaviest-model URL'],
    [/exactResourceResponseMatches\(response\.url\(\), expectedModelUrl\)/, 'origin-aware exact-GLB response matcher call'],
    [/modelRuntimePhasePlan\(Date\.now\(\), watchdogDeadlineAt\)/, 'shared dedicated phase deadline planning'],
    [/load-ready/, 'named load/readiness phase'],
    [/material-\$\{mode\}/, 'named material phases'],
    [/withAbsoluteDeadline\(\s*\(\) => page\.evaluate\([\s\S]*?'pagination transition cover',[\s\S]*?GENERAL_MODEL_TIMEOUT_MS\s*\)/, 'absolute pagination wall-clock watchdog'],
    [/expectedSteps: paginationExpectedSteps/, 'per-step lightweight pagination targets'],
    [/finally \{\s*await browser\.close\(\)\.catch\(\(\) => \{\}\);\s*\}/, 'index browser cleanup on every exit'],
    [/modelRuntime = await runDedicatedHeaviestModelSmoke\(heavyPage, BASE\)/, 'dedicated heaviest-model call site'],
    [/CASE-3d-heaviest-model-runtime/, 'named heaviest-model runtime result'],
    [/const status = response\.status\(\);\s*if \(status < 200 \|\| status > 299\)/, 'immediate exact-GLB non-2xx rejection']
  ];
  for (const [pattern, description] of verifierRuntimeContract) {
    if (!pattern.test(source)) {
      throw new Error(`verify-frozen.js is missing the ${description}.`);
    }
  }

  const sharedRuntimeContract = [
    [/MODEL_RUNTIME_TARGET_MS = 120_000/, '120-second runtime target'],
    [/MODEL_RUNTIME_PHASE_TIMEOUT_MS = 180_000/, '180-second functional phase timeout'],
    [/MODEL_RUNTIME_WATCHDOG_MS = 600_000/, '600-second operational watchdog'],
    [/label: 'PERF_WARN'/, 'explicit model runtime performance warning'],
    [/typeof operation === 'function' \? operation\(\) : operation/, 'lazy deadline operation factory'],
    [/function modelRuntimePhasePlan/, 'shared runtime phase planner'],
    [/function exactResourceResponseMatches/, 'origin-aware exact resource matcher'],
    [/function lightweightPaginationPlan/, 'lightweight pagination planner']
  ];
  for (const [pattern, description] of sharedRuntimeContract) {
    if (!pattern.test(contractSource)) {
      throw new Error(`model-runtime-contract.cjs is missing the ${description}.`);
    }
  }

  const heaviestSmoke = source.match(
    /async function runHeaviestModelSmoke\(page, observedErrors, startedAt, watchdogDeadlineAt\) \{[\s\S]*?\n\}/
  )?.[0] || '';
  if (!heaviestSmoke) {
    throw new Error('Heaviest-model runtime smoke extraction failed closed.');
  }
  const forbiddenSyntheticClick = /force\s*:\s*true|dispatchEvent\s*\(\s*new MouseEvent/;
  if (forbiddenSyntheticClick.test(heaviestSmoke)) {
    throw new Error('Heaviest-model runtime smoke must use normal Playwright clicks.');
  }
  const forcedClickMutation = heaviestSmoke.replace(
    'const target = HEAVIEST_MODEL_CASE;',
    'const target = HEAVIEST_MODEL_CASE;\n  const forbiddenMutation = { force: true };'
  );
  if (forcedClickMutation === heaviestSmoke || !forbiddenSyntheticClick.test(forcedClickMutation)) {
    throw new Error('Heaviest-model synthetic-click regression guard is not mutation-sensitive.');
  }

  const browserPhase =
    /    await testIndex\(BASE\);\r?\n    await testFreeAssets\(BASE\);\r?\n    await testMobileViewport\(BASE\);/;

  if (!browserPhase.test(source)) {
    throw new Error('verify-frozen.js browser phase shape changed; update this regression test.');
  }

  const testSource = source.replace(browserPhase, "    throw new Error('forced fatal verification error');");
  mkdirSync(path.dirname(tempContractPath), { recursive: true });
  writeFileSync(tempPath, testSource, 'utf8');
  writeFileSync(tempContractPath, contractSource, 'utf8');

  const result = spawnSync(process.execPath, [tempPath], {
    cwd: root,
    env: {
      ...process.env,
      NODE_PATH: path.join(root, 'node_modules'),
      SITE_ROOT: root
    },
    encoding: 'utf8'
  });

  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes('TEST ERROR: forced fatal verification error')) {
    console.error(output);
    throw new Error('Expected verify-frozen.js to report the forced fatal error.');
  }

  if (!output.includes('[FAIL] fatal-test-error')) {
    console.error(output);
    throw new Error('Expected verify-frozen.js to count fatal test errors as failures.');
  }

  if (result.status === 0) {
    console.error(output);
    throw new Error('Expected verify-frozen.js to exit non-zero after a fatal test error.');
  }

  console.log('verify-frozen fatal error path exits non-zero');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
