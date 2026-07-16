import fs from 'node:fs';
import path from 'node:path';

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
  'package: browser smoke includes Design Lab explicitly',
  packageJson.scripts['test:browser'] ===
    'playwright test tests/quality/site-smoke.spec.mjs tests/quality/design-modes.spec.mjs'
);
check(
  'package: Design Lab gate is explicit',
  packageJson.scripts['test:design-lab'] ===
    'playwright test tests/quality/design-modes.spec.mjs tests/quality/admin-preview.spec.mjs'
);
check(
  'package: codex:ship includes Design Lab gate',
  /\btest:design-lab\b/.test(packageJson.scripts['codex:ship'] || '')
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
  /i18n-data\.js$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/
]);
checkScriptOrder('free-assets.html', [
  /design-mode\.js$/,
  /design-loader\.js$/,
  /fa-data\.js$/,
  /gsap\.min\.js$/,
  /ScrollTrigger/,
  /SplitText/,
  /i18n-data\.js$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/,
  /free-assets\.js$/
]);

for (const page of ['index.html', 'free-assets.html']) {
  checkNoFirstPartyModuleOrDefer(page);
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
check(
  'Design Lab: Hybrid mode is explicitly allowlisted',
  /valid\.hybrid\s*=\s*true/.test(read('js/design-mode.js'))
);
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
