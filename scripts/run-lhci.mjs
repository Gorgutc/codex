import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function chromiumExecutablePath() {
  const full = chromium.executablePath();
  if (fs.existsSync(full)) return full;

  const browserDir = path.dirname(path.dirname(full));
  const cacheDir = path.dirname(browserDir);
  const revision = path.basename(browserDir).replace(/^chromium-/, '');
  const shell = path.join(
    cacheDir,
    `chromium_headless_shell-${revision}`,
    'chrome-headless-shell-win64',
    'chrome-headless-shell.exe'
  );
  return revision ? shell : full;
}

process.env.CHROME_PATH = process.env.CHROME_PATH || chromiumExecutablePath();

const lhciCli = path.join(ROOT, 'node_modules', '@lhci', 'cli', 'src', 'cli.js');
const child = spawn(process.execPath, [lhciCli, 'autorun'], {
  env: process.env,
  shell: false,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
