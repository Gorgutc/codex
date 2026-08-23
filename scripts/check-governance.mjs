import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
let failures = 0;

function relPath(...segments) {
  return path.join(ROOT, ...segments);
}

function read(rel) {
  return fs.readFileSync(relPath(rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(relPath(rel));
}

function check(name, ok, detail = '') {
  const suffix = detail ? ` - ${detail}` : '';
  if (ok) {
    console.log(`[PASS] ${name}${suffix}`);
    return;
  }
  failures += 1;
  console.error(`[FAIL] ${name}${suffix}`);
}

function firstBytes(rel, length = 1600) {
  return read(rel).slice(0, length);
}

function scriptSources(htmlRel) {
  const html = read(htmlRel);
  return Array.from(html.matchAll(/<script\b([^>]*)>/gi)).map((match) => {
    const attrs = match[1];
    const src = attrs.match(/\bsrc=["']([^"']+)["']/i);
    const type = attrs.match(/\btype=["']([^"']+)["']/i);
    const srcValue = src ? src[1].trim() : '';
    const typeValue = type ? type[1].trim().toLowerCase() : '';
    return {
      attrs,
      src: srcValue,
      type: typeValue,
      firstParty: !!srcValue && !/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(srcValue)
    };
  });
}

function indexOfScript(scripts, pattern) {
  return scripts.findIndex((script) => pattern.test(script.src));
}

function checkScriptOrder(page, expected) {
  const scripts = scriptSources(page);
  const positions = expected.map((pattern) => indexOfScript(scripts, pattern));
  const orderOk =
    positions.every((position) => position >= 0) &&
    positions.every((position, index) => index === 0 || position > positions[index - 1]);
  check(`${page}: protected script order`, orderOk, JSON.stringify(positions));
}

function checkNoFirstPartyModuleOrDefer(page) {
  const scripts = scriptSources(page);
  const firstPartyBad = scripts.filter(
    (script) =>
      script.firstParty &&
      (/\bdefer\b/i.test(script.attrs) || /\basync\b/i.test(script.attrs) || script.type === 'module')
  );
  const importMaps = scripts.filter((script) => script.type === 'importmap');
  check(
    `${page}: no first-party defer/async/module scripts`,
    firstPartyBad.length === 0,
    firstPartyBad.map((script) => script.src).join(', ')
  );
  check(
    `${page}: no import maps`,
    importMaps.length === 0,
    importMaps.map((script) => script.src || '(inline)').join(', ')
  );
}

function checkGeneratedDataScriptRevisions(page, expectedFiles) {
  const scripts = scriptSources(page).filter((script) => script.firstParty);
  const expectedSources = new Map(
    expectedFiles.map((fileName) => [
      `./js/${fileName}`,
      `./js/${fileName}?v=${createHash('sha256')
        .update(read(`js/${fileName}`), 'utf8')
        .digest('hex')}`
    ])
  );
  const queryScripts = scripts.filter((script) => script.src.includes('?'));
  const unexpectedQueries = queryScripts.filter((script) => ![...expectedSources.values()].includes(script.src));
  const missingOrDuplicated = [...expectedSources.entries()].filter(
    ([, expectedSrc]) => scripts.filter((script) => script.src === expectedSrc).length !== 1
  );
  check(
    `${page}: generated data scripts use exact SHA-256 revisions`,
    unexpectedQueries.length === 0 && missingOrDuplicated.length === 0,
    [...unexpectedQueries.map((script) => script.src), ...missingOrDuplicated.map(([file]) => file)].join(', ')
  );
}

const packageJson = JSON.parse(read('package.json'));
check(
  'package: check:governance script exists',
  packageJson.scripts['check:governance'] === 'node scripts/check-governance.mjs'
);
check(
  'package: test:visual script exists',
  packageJson.scripts['test:visual'] === 'playwright test tests/quality/visual-regression.spec.mjs'
);
check(
  'package: test:visual:update script exists',
  packageJson.scripts['test:visual:update'] ===
    'playwright test tests/quality/visual-regression.spec.mjs --update-snapshots'
);
check(
  'package: quality:fast includes governance',
  /\bcheck:governance\b/.test(packageJson.scripts['quality:fast'] || '')
);
check(
  'package: quality:governance script exists',
  packageJson.scripts['quality:governance'] === 'npm run check:governance'
);
check('package: codex:ship includes governance', /\bcheck:governance\b/.test(packageJson.scripts['codex:ship'] || ''));
check(
  'package: motion gate is isolated on one worker',
  packageJson.scripts['test:motion'] ===
    'playwright test tests/quality/design-modes.spec.mjs --grep @motion-gate --workers=1'
);
check(
  'package: browser smoke includes Design Lab explicitly',
  packageJson.scripts['test:browser'] ===
    'playwright test tests/quality/site-smoke.spec.mjs tests/quality/design-modes.spec.mjs --grep-invert @motion-gate && npm run test:motion'
);
check(
  'package: Design Lab gate is explicit',
  packageJson.scripts['test:design-lab'] ===
    'playwright test tests/quality/design-modes.spec.mjs tests/quality/admin-preview.spec.mjs --grep-invert @motion-gate && npm run test:motion'
);
check(
  'package: codex:ship includes Design Lab gate',
  /\btest:design-lab\b/.test(packageJson.scripts['codex:ship'] || '')
);
/* Slice B: the admin panel is the only way the owner writes content, and its
 * publish path now carries the TOCTOU guard, the draft-envelope migration and
 * the case-media structure editor. Those suites used to live only in
 * `test:admin`, which CI never ran (the workflow runs `codex:ship` alone), so a
 * regression there reached main green. Both the admin suite and the case-media
 * runtime gate are part of the ship gate now, and the roster is pinned here so
 * a new spec cannot be added to `test:admin` and silently skipped by CI. */
check(
  'package: codex:ship includes the admin panel gate',
  /\btest:admin\b/.test(packageJson.scripts['codex:ship'] || '')
);
check(
  'package: admin gate lists the case-media editor spec',
  /tests\/quality\/admin-case-media\.spec\.mjs/.test(packageJson.scripts['test:admin'] || '')
);
check(
  'package: admin gate lists the publication recovery spec',
  /tests\/quality\/admin-publication\.spec\.mjs/.test(packageJson.scripts['test:admin'] || '')
);
{
  const contentPublish = read('.github/workflows/content-publish.yml');
  const batchRunner = read('scripts/content-publish-batch.mjs');
  const deployBeget = read('.github/workflows/deploy-beget.yml');
  const begetParity = read('scripts/verify-beget-parity.mjs');
  check(
    'content publish: workflow delegates complete source batches to the tested runner',
    /fetch-depth: 0/.test(contentPublish) &&
      /paths: \['content\/\*\*', 'assets\/\*\*'\]/.test(contentPublish) &&
      /node scripts\/content-publish-batch\.mjs/.test(contentPublish) &&
      /github-actions\[bot\]/.test(contentPublish) &&
      /subject="\$\(git log -1 --pretty=%s\)"/.test(contentPublish) &&
      /regen_subject_regex/.test(contentPublish) &&
      /revert_subject_regex/.test(contentPublish) &&
      !/git pull --rebase|git rebase/.test(contentPublish)
  );
  check(
    'content publish: runner discovers strict trusted anchors and emits one marker per source',
    /lastTrustedAnchor/.test(batchRunner) &&
      /discoverUnresolvedSources/.test(batchRunner) &&
      /--first-parent/.test(batchRunner) &&
      /sha \+ '\^1'/.test(batchRunner) &&
      /isTrustedTerminal\(item\)/.test(batchRunner) &&
      /terminalSubject\('published', source\.sha\)/.test(batchRunner) &&
      /terminalSubject\('reverted', source\.sha\)/.test(batchRunner)
  );
  check(
    'content publish: runner rebuilds instead of rebasing and pushes the chain once',
    /maxAttempts \|\| 3/.test(batchRunner) &&
      /checkout', '--detach', base/.test(batchRunner) &&
      /freshOriginMain/.test(batchRunner) &&
      /push', 'origin', 'HEAD:main'/.test(batchRunner) &&
      /GENERATED_ALLOWLIST/.test(batchRunner) &&
      /'diff', '--cached', '--name-only'/.test(batchRunner) &&
      !/\['add', '-A'\]/.test(batchRunner) &&
      /GITHUB_ACTIONS/.test(batchRunner) &&
      !/pull --rebase|\bgit rebase\b/.test(batchRunner)
  );
  check(
    'deploy: both head and history settlement checks accept only old or full-source subjects',
    (deployBeget.match(/regen_subject_regex/g) || []).length >= 2 &&
      (deployBeget.match(/revert_subject_regex/g) || []).length >= 2 &&
      deployBeget.includes('source:[0-9a-f]{40}') &&
      deployBeget.includes('trusted_terminal') &&
      deployBeget.includes('41898282+github-actions[bot]@users.noreply.github.com') &&
      deployBeget.includes('! git diff --quiet "$sha^1" "$sha" -- content/ assets/') &&
      deployBeget.includes('! git diff-tree --root --quiet --no-commit-id -r "$sha" -- content/ assets/')
  );
  check(
    'deploy: Beget parity delegates normal-shell and immutable-payload verification to its executable fixture',
    !deployBeget.includes('cache_bust=') &&
      !deployBeget.includes('Cache-Control: no-cache') &&
      deployBeget.includes('node scripts/verify-beget-parity.mjs --public-url "$PUBLIC_URL"') &&
      deployBeget.includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020') &&
      deployBeget.includes('node-version: 22') &&
      begetParity.includes("redirect: 'manual'") &&
      begetParity.includes('FETCH_ATTEMPTS = 3') &&
      begetParity.includes('FETCH_TIMEOUT_MS = 60_000') &&
      begetParity.includes('return Buffer.from(await response.arrayBuffer())') &&
      begetParity.includes('conflicting immutable revisions') &&
      begetParity.includes('process.exitCode = await runBegetParityCli({ publicUrl });') &&
      /node --test tests\/quality\/beget-parity\.test\.mjs/.test(packageJson.scripts['test:beget-parity'] || '') &&
      /\btest:beget-parity\b/.test(packageJson.scripts['codex:ship'] || '')
  );
}
check(
  'package: codex:ship includes the content-publish batch fixture gate',
  /\btest:content-publish-batch\b/.test(packageJson.scripts['codex:ship'] || '') &&
    /node --test tests\/quality\/content-publish-batch\.test\.mjs/.test(
      packageJson.scripts['test:content-publish-batch'] || ''
    )
);
check(
  'package: codex:ship includes the case-media runtime gate',
  /\btest:case-media\b/.test(packageJson.scripts['codex:ship'] || '')
);
check(
  'package: case-media runtime gate is explicit',
  packageJson.scripts['test:case-media'] === 'playwright test tests/quality/case-media-runtime.spec.mjs'
);
// BP-UPLOAD-01: чертежи получили СВОЙ гейт, а не приписку к case-media. Правило
// выше пришпиливает test:case-media к ровно одному спеку, и дописывание туда
// второго его ломает — что и произошло при первой попытке. Отдельный скрипт
// сохраняет оба инварианта явными и позволяет гонять гейты по отдельности.
check(
  'package: case-blueprints runtime gate is explicit',
  packageJson.scripts['test:case-blueprints'] === 'playwright test tests/quality/case-blueprints-runtime.spec.mjs'
);
check(
  'package: codex:ship includes the case-blueprints runtime gate',
  /\btest:case-blueprints\b/.test(packageJson.scripts['codex:ship'] || '')
);
check(
  'package: admin gate lists the case-blueprints editor spec',
  /tests\/quality\/admin-case-blueprints\.spec\.mjs/.test(packageJson.scripts['test:admin'] || '')
);
check(
  'package: visual snapshots stay out of fast hooks',
  !/\btest:visual\b/.test(packageJson.scripts['quality:fast'] || '')
);
check('package: quality:all includes visual gate', /\btest:visual\b/.test(packageJson.scripts['quality:all'] || ''));

const activeInstructionFiles = [
  'AGENTS.md',
  'README.md',
  'RUN_INSTRUCTIONS.md',
  'docs/agent/architecture.md',
  'docs/agent/technical-stack.md',
  'docs/agent/verification.md',
  'docs/agent/quality-tooling.md',
  'docs/agent/instruction-audit.md',
  'docs/agent/skill-map.md',
  'docs/agent/preview-contract.md',
  'docs/superpowers/plans/2026-05-30-remaining-industrial-editorial-refresh.md'
].filter(exists);

const stalePassTotal = /\b(?:56|113|115)\/(?:56|113|115)\b|\b\d+\/\d+\s+PASS\b/i;
for (const rel of activeInstructionFiles) {
  check(`${rel}: no stale pass total`, !stalePassTotal.test(read(rel)));
}

check('AGENTS.md: documents shared-runtime order', read('AGENTS.md').includes('shared-runtime.js'));
check('architecture.md: documents shared runtime', /shared runtime/.test(read('docs/agent/architecture.md')));
check(
  'technical-stack.md: documents Three-first runtime',
  /Three viewer first/.test(read('docs/agent/technical-stack.md'))
);
check('i18n.js header: documents shared-runtime order', firstBytes('js/i18n.js').includes('shared-runtime.js'));
check(
  'verify-frozen.js header: no stale v0.4/count prose',
  !/v0\.4|37\s+тест|28\s+тест/i.test(firstBytes('verify-frozen.js', 2200))
);
check(
  'free-assets.html preloader comment: no stale zero-total claim',
  !/total\s*={2,3}\s*0|total\s+is\s+0/i.test(firstBytes('free-assets.html', 9000))
);

checkScriptOrder('index.html', [
  /design-mode\.js$/,
  /design-loader\.js$/,
  /lenis\.min\.js$/,
  /gsap\.min\.js$/,
  /ScrollTrigger/,
  /SplitText/,
  /i18n-data\.js\?v=[0-9a-f]{64}$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/
]);
checkScriptOrder('free-assets.html', [
  /design-mode\.js$/,
  /design-loader\.js$/,
  /fa-data\.js\?v=[0-9a-f]{64}$/,
  /gsap\.min\.js$/,
  /ScrollTrigger/,
  /SplitText/,
  /i18n-data\.js\?v=[0-9a-f]{64}$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/,
  /free-assets\.js$/
]);

for (const page of ['index.html', 'free-assets.html']) {
  checkNoFirstPartyModuleOrDefer(page);
  checkGeneratedDataScriptRevisions(
    page,
    page === 'index.html' ? ['i18n-data.js', 'cards-data.js'] : ['fa-data.js', 'i18n-data.js']
  );
  const html = read(page);
  check(
    `${page}: Design Lab bootstrap is singular`,
    (html.match(/\.\/js\/design-mode\.js/g) || []).length === 1 &&
      (html.match(/\.\/js\/design-loader\.js/g) || []).length === 1
  );
  check(`${page}: variant assets stay runtime-opt-in`, !/design-(?:specimen|chamber|hybrid)\.(?:css|js)/.test(html));
  check(
    `${page}: canonical excludes design query`,
    !/<link\s+rel=["']canonical["'][^>]+href=["'][^"']*[?&]design=/i.test(html)
  );
}

const designLabAssets = [
  'js/design-mode.js',
  'js/design-loader.js',
  'js/design-specimen.js',
  'js/design-chamber.js',
  'js/design-hybrid.js',
  'css/design-specimen.css',
  'css/design-chamber.css',
  'css/design-hybrid.css'
];
check(
  'Design Lab: every routed runtime asset exists',
  designLabAssets.every(exists),
  designLabAssets.filter((file) => !exists(file)).join(', ')
);
check(
  'Design Lab: exact variant asset map',
  /design-specimen\.css/.test(read('js/design-loader.js')) &&
    /design-specimen\.js/.test(read('js/design-loader.js')) &&
    /design-chamber\.css/.test(read('js/design-loader.js')) &&
    /design-chamber\.js/.test(read('js/design-loader.js')) &&
    /design-hybrid\.css/.test(read('js/design-loader.js')) &&
    /design-hybrid\.js/.test(read('js/design-loader.js'))
);
check(
  'Design Lab: Hybrid foundation assets stay ordered',
  /hybrid:\s*{\s*css:\s*\['\.\/css\/design-chamber\.css',\s*'\.\/css\/design-hybrid\.css'\],\s*js:\s*\['\.\/js\/design-chamber\.js',\s*'\.\/js\/design-hybrid\.js'\]/s.test(
    read('js/design-loader.js')
  )
);
check('Design Lab: Hybrid mode is explicitly allowlisted', /valid\.hybrid\s*=\s*true/.test(read('js/design-mode.js')));
check(
  'Design Lab: Hybrid readiness is style-gated with bounded Original fallback',
  /data-design-runtime-state', 'pending'/.test(read('js/design-loader.js')) &&
    /hybridPendingStyles/.test(read('js/design-loader.js')) &&
    /setTimeout\(failOpenHybrid, 4000\)/.test(read('js/design-loader.js')) &&
    /data-design-runtime-state', 'fallback'/.test(read('js/design-loader.js')) &&
    /data-design-runtime-state', 'ready'/.test(read('js/design-loader.js'))
);

const freeAssetsHtml = read('free-assets.html');
check('free-assets.html: no static model-viewer script', !/model-viewer\.min\.js/i.test(freeAssetsHtml));
check('free-assets.html: no static Three script', !/three(?:\.module|\.core)?\.js/i.test(freeAssetsHtml));

const shippedRuntimeFiles = [
  'js/design-mode.js',
  'js/design-loader.js',
  'js/design-specimen.js',
  'js/design-chamber.js',
  'js/design-hybrid.js',
  'js/main.js',
  'js/animations.js',
  'js/free-assets.js',
  'js/i18n.js',
  'js/i18n-data.js',
  'js/fa-data.js',
  'js/shared-runtime.js',
  'js/vendor/codex-three-viewer.js'
];
const storageViolations = shippedRuntimeFiles.filter((rel) =>
  /(localStorage|sessionStorage)\s*(?:\.|\[)/.test(read(rel))
);
check('public runtime: no browser storage access', storageViolations.length === 0, storageViolations.join(', '));

if (exists('.github/workflows/quality.yml')) {
  const workflow = read('.github/workflows/quality.yml');
  const runsShip = /npm\s+run\s+codex:ship/.test(workflow);
  check('CI: runs governance gate', runsShip || /quality:governance|check:governance/.test(workflow));
  check('CI: runs browser quality gate', runsShip || /quality:deep|test:browser|test:design-lab/.test(workflow));
} else {
  check('CI: workflow deferred explicitly', true, 'no .github/workflows/quality.yml');
}

// ── prod-review F2: strict-CSP integrity on the Beget prod host ──────────
// The .htaccess CSP pins sha256 hashes of (a) the inline bootstrap script
// and (b) the link onload swap handler. Nothing else recomputed them: an
// innocent edit of the inline bootstrap passed every local gate (no CSP in
// dev/preview servers) and broke ONLY in production. These checks recompute
// the hashes from the shipped HTML and assert both CSP headers carry them.
if (exists('.htaccess') && exists('admin/.htaccess')) {
  const { createHash } = await import('node:crypto');
  const cspTexts = {
    '.htaccess': read('.htaccess'),
    'admin/.htaccess': read('admin/.htaccess')
  };
  const requiredHashes = new Map(); // hash → описание источника
  for (const page of ['index.html', 'free-assets.html']) {
    const html = read(page);
    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/ld\+json/i.test(match[1])) continue; // не исполняется, вне script-src
      const hash = createHash('sha256').update(match[2], 'utf8').digest('base64');
      requiredHashes.set(hash, `${page} inline script`);
    }
    for (const match of html.matchAll(/\bonload="([^"]+)"/gi)) {
      const hash = createHash('sha256').update(match[1], 'utf8').digest('base64');
      requiredHashes.set(hash, `${page} onload handler`);
    }
  }
  check(
    'CSP: shipped pages have hashable inline code',
    requiredHashes.size > 0,
    `${requiredHashes.size} unique hash(es)`
  );
  for (const [file, text] of Object.entries(cspTexts)) {
    const csp = text.match(/Content-Security-Policy "([^"]+)"/);
    check(`${file}: CSP header present`, !!csp);
    if (!csp) continue;
    for (const [hash, source] of requiredHashes) {
      check(`${file}: CSP pins ${source}`, csp[1].includes(`'sha256-${hash}'`), `sha256-${hash.slice(0, 12)}…`);
    }
  }
}

// Self-hosted model-viewer (F2, C-05): console-error gates cannot catch a
// missing vendor file (404s are filtered as noise), so its presence is a
// static invariant.
check('vendor: model-viewer.min.js self-hosted', exists('js/vendor/model-viewer.min.js'));
check(
  'runtime: shared-runtime loads model-viewer from vendor',
  /js\/vendor\/model-viewer\.min\.js/.test(read('js/shared-runtime.js'))
);

if (failures > 0) {
  console.error(`SUMMARY: ${failures} governance failure(s)`);
  process.exit(1);
}

console.log('SUMMARY: 0 governance failures');
