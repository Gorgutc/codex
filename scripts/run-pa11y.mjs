import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pa11y from 'pa11y';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  { path: '/index.html', budget: 0 },
  { path: '/free-assets.html', budget: 0 }
];
const IGNORE_CODES = [
  // Pa11y+Puppeteer reports false color-contrast positives on the animated,
  // transparent card/case surfaces. Playwright axe remains the contrast gate.
  'color-contrast'
];

const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.zip': 'application/zip'
};

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

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (requestPath === '/') requestPath = '/index.html';
      const filePath = path.join(ROOT, requestPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

const { server, base } = await startServer();
let failures = 0;

try {
  for (const page of PAGES) {
    const result = await pa11y(`${base}${page.path}`, {
      standard: 'WCAG2AA',
      timeout: 45_000,
      wait: 2_000,
      viewport: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        isMobile: false
      },
      runners: ['axe'],
      ignore: IGNORE_CODES,
      chromeLaunchConfig: {
        executablePath: chromiumExecutablePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    const errors = result.issues.filter((issue) => issue.type === 'error');
    const ok = errors.length <= page.budget;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] pa11y ${page.path}: errors=${errors.length}, budget=${page.budget}`);
    errors.slice(0, 5).forEach((issue) => {
      console.log(`  - ${issue.code}: ${issue.message}`);
    });
    if (!ok) failures += 1;
  }
} finally {
  server.close();
}

process.exit(failures ? 1 : 0);
