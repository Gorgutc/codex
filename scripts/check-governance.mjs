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
      firstParty: !!srcValue && !/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(srcValue),
    };
  });
}

function indexOfScript(scripts, pattern) {
  return scripts.findIndex((script) => pattern.test(script.src));
}

function checkScriptOrder(page, expected) {
  const scripts = scriptSources(page);
  const positions = expected.map((pattern) => indexOfScript(scripts, pattern));
  const orderOk = positions.every((position) => position >= 0) &&
    positions.every((position, index) => index === 0 || position > positions[index - 1]);
  check(`${page}: protected script order`, orderOk, JSON.stringify(positions));
}

function checkNoFirstPartyModuleOrDefer(page) {
  const scripts = scriptSources(page);
  const firstPartyBad = scripts.filter((script) =>
    script.firstParty &&
    (/\bdefer\b/i.test(script.attrs) || /\basync\b/i.test(script.attrs) || script.type === 'module')
  );
  const importMaps = scripts.filter((script) => script.type === 'importmap');
  check(`${page}: no first-party defer/async/module scripts`, firstPartyBad.length === 0,
    firstPartyBad.map((script) => script.src).join(', '));
  check(`${page}: no import maps`, importMaps.length === 0,
    importMaps.map((script) => script.src || '(inline)').join(', '));
}

const packageJson = JSON.parse(read('package.json'));
check('package: check:governance script exists', packageJson.scripts['check:governance'] === 'node scripts/check-governance.mjs');
check('package: test:visual script exists', packageJson.scripts['test:visual'] === 'playwright test tests/quality/visual-regression.spec.mjs');
check('package: test:visual:update script exists', packageJson.scripts['test:visual:update'] === 'playwright test tests/quality/visual-regression.spec.mjs --update-snapshots');
check('package: quality:fast includes governance', /\bcheck:governance\b/.test(packageJson.scripts['quality:fast'] || ''));
check('package: quality:governance script exists', packageJson.scripts['quality:governance'] === 'npm run check:governance');
check('package: codex:ship includes governance', /\bcheck:governance\b/.test(packageJson.scripts['codex:ship'] || ''));
check('package: browser smoke stays explicit', packageJson.scripts['test:browser'] === 'playwright test tests/quality/site-smoke.spec.mjs');
check('package: visual snapshots stay out of fast hooks', !/\btest:visual\b/.test(packageJson.scripts['quality:fast'] || ''));
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
  'docs/superpowers/plans/2026-05-30-remaining-industrial-editorial-refresh.md',
].filter(exists);

const stalePassTotal = /\b(?:56|113|115)\/(?:56|113|115)\b|\b\d+\/\d+\s+PASS\b/i;
for (const rel of activeInstructionFiles) {
  check(`${rel}: no stale pass total`, !stalePassTotal.test(read(rel)));
}

check('AGENTS.md: documents shared-runtime order', read('AGENTS.md').includes('shared-runtime.js'));
check('architecture.md: documents shared runtime', /shared runtime/.test(read('docs/agent/architecture.md')));
check('technical-stack.md: documents Three-first runtime', /Three viewer first/.test(read('docs/agent/technical-stack.md')));
check('i18n.js header: documents shared-runtime order', firstBytes('js/i18n.js').includes('shared-runtime.js'));
check('verify-frozen.js header: no stale v0.4/count prose',
  !/v0\.4|37\s+тест|28\s+тест/i.test(firstBytes('verify-frozen.js', 2200)));
check('free-assets.html preloader comment: no stale zero-total claim',
  !/total\s*={2,3}\s*0|total\s+is\s+0/i.test(firstBytes('free-assets.html', 9000)));

checkScriptOrder('index.html', [
  /lenis\.min\.js$/,
  /gsap\.min\.js$/,
  /ScrollTrigger/,
  /SplitText/,
  /i18n-data\.js$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/,
]);
checkScriptOrder('free-assets.html', [
  /fa-data\.js$/,
  /gsap\.min\.js$/,
  /ScrollTrigger/,
  /SplitText/,
  /i18n-data\.js$/,
  /i18n\.js$/,
  /shared-runtime\.js$/,
  /main\.js$/,
  /animations\.js$/,
  /free-assets\.js$/,
]);

for (const page of ['index.html', 'free-assets.html']) {
  checkNoFirstPartyModuleOrDefer(page);
}

const freeAssetsHtml = read('free-assets.html');
check('free-assets.html: no static model-viewer script', !/model-viewer\.min\.js/i.test(freeAssetsHtml));
check('free-assets.html: no static Three script', !/three(?:\.module|\.core)?\.js/i.test(freeAssetsHtml));

const shippedRuntimeFiles = [
  'js/main.js',
  'js/animations.js',
  'js/free-assets.js',
  'js/i18n.js',
  'js/i18n-data.js',
  'js/fa-data.js',
  'js/shared-runtime.js',
  'js/vendor/codex-three-viewer.js',
];
const storageViolations = shippedRuntimeFiles.filter((rel) => /(localStorage|sessionStorage)\s*(?:\.|\[)/.test(read(rel)));
check('runtime: no browser storage access', storageViolations.length === 0, storageViolations.join(', '));

if (exists('.github/workflows/quality.yml')) {
  const workflow = read('.github/workflows/quality.yml');
  check('CI: runs governance gate', /quality:governance|check:governance/.test(workflow));
  check('CI: runs browser quality gate', /quality:deep|test:browser/.test(workflow));
} else {
  check('CI: workflow deferred explicitly', true, 'no .github/workflows/quality.yml');
}

if (failures > 0) {
  console.error(`SUMMARY: ${failures} governance failure(s)`);
  process.exit(1);
}

console.log('SUMMARY: 0 governance failures');
