import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourcePath = path.join(root, 'verify-frozen.js');
const tempDir = mkdtempSync(path.join(tmpdir(), 'codex-verify-fatal-'));
const tempPath = path.join(tempDir, 'verify-frozen-fatal-copy.js');

try {
  const source = readFileSync(sourcePath, 'utf8');
  const browserPhase =
    /    await testIndex\(BASE\);\r?\n    await testFreeAssets\(BASE\);\r?\n    await testMobileViewport\(BASE\);/;

  if (!browserPhase.test(source)) {
    throw new Error('verify-frozen.js browser phase shape changed; update this regression test.');
  }

  const testSource = source.replace(browserPhase, "    throw new Error('forced fatal verification error');");
  writeFileSync(tempPath, testSource, 'utf8');

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
