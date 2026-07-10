import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, '.lighthouseci');
const CONFIG = require('../lighthouserc.cjs');

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

const CATEGORY_KEYS = {
  'categories:accessibility': 'accessibility',
  'categories:best-practices': 'best-practices',
  'categories:performance': 'performance',
  'categories:seo': 'seo'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (requestPath === '/') requestPath = '/index.html';
      const filePath = path.normalize(path.join(ROOT, requestPath));
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

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function pagePath(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.pathname || '/index.html'}${parsed.search}${parsed.hash}`;
  } catch (_) {
    return rawUrl.replace(/^https?:\/\/localhost/i, '') || '/index.html';
  }
}

function slugFor(page) {
  return (
    page
      .replace(/^\//, '')
      .replace(/\.html$/, '')
      .replace(/[^a-z0-9-]+/gi, '-') || 'index'
  );
}

function score(category) {
  return Math.round((category && typeof category.score === 'number' ? category.score : 0) * 100);
}

function assertionsFor(lhr) {
  const assertions = CONFIG.ci?.assert?.assertions || {};
  return Object.entries(assertions).map(([key, rule]) => {
    const category = CATEGORY_KEYS[key];
    const level = Array.isArray(rule) ? rule[0] : 'warn';
    const options = Array.isArray(rule) ? rule[1] || {} : {};
    const minScore = typeof options.minScore === 'number' ? options.minScore : 0;
    const actual = category ? (lhr.categories[category]?.score ?? 0) : 0;
    return {
      key,
      category,
      level,
      minScore,
      actual,
      ok: actual >= minScore
    };
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const { server, base } = await startServer();
const chromePort = await freePort();
const browser = await chromium.launch({
  headless: true,
  args: [`--remote-debugging-port=${chromePort}`, '--no-sandbox', '--disable-dev-shm-usage']
});

let failures = 0;
const summary = [];

try {
  const urls = CONFIG.ci?.collect?.url || ['http://localhost/index.html', 'http://localhost/free-assets.html'];
  for (const rawUrl of urls) {
    const currentPath = pagePath(rawUrl);
    const target = `${base}${currentPath}`;
    console.log(`Running Lighthouse on ${target}`);

    const result = await lighthouse(target, {
      port: chromePort,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      throttlingMethod: 'simulate',
      emulatedFormFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        disabled: false
      }
    });

    const lhr = result.lhr;
    const checks = assertionsFor(lhr);
    const blockingFailures = checks.filter((check) => !check.ok && check.level === 'error');
    failures += blockingFailures.length;

    const row = {
      page: currentPath,
      performance: score(lhr.categories.performance),
      accessibility: score(lhr.categories.accessibility),
      bestPractices: score(lhr.categories['best-practices']),
      seo: score(lhr.categories.seo),
      fcp: lhr.audits['first-contentful-paint']?.displayValue || '',
      lcp: lhr.audits['largest-contentful-paint']?.displayValue || '',
      tbt: lhr.audits['total-blocking-time']?.displayValue || '',
      cls: lhr.audits['cumulative-layout-shift']?.displayValue || '',
      assertions: checks
    };
    summary.push(row);

    const outFile = path.join(OUT_DIR, `${slugFor(currentPath)}.report.json`);
    fs.writeFileSync(outFile, JSON.stringify(lhr, null, 2));

    console.log(
      `[PASS] ${currentPath} ` +
        `perf=${row.performance} a11y=${row.accessibility} best=${row.bestPractices} seo=${row.seo} ` +
        `FCP=${row.fcp} LCP=${row.lcp} TBT=${row.tbt} CLS=${row.cls}`
    );
    checks
      .filter((check) => !check.ok)
      .forEach((check) => {
        const label = check.level === 'error' ? 'FAIL' : 'WARN';
        console.log(`  [${label}] ${check.key}: score=${check.actual.toFixed(2)} min=${check.minScore.toFixed(2)}`);
      });
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`Lighthouse summary written to ${path.join(OUT_DIR, 'summary.json')}`);

process.exit(failures ? 1 : 0);
