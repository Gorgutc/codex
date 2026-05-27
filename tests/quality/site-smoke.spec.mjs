import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = [
  { path: '/index.html', title: /Codex/i, axeBudget: 1 },
  { path: '/free-assets.html', title: /Free 3D Assets/i, axeBudget: 0 }
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
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.zip': 'application/zip'
};

let server;
let base;

test.beforeAll(async () => {
  await new Promise((resolve) => {
    server = http.createServer((req, res) => {
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
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

for (const pageInfo of PAGES) {
  test(`${pageInfo.path} loads without internal console errors`, async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(`${base}${pageInfo.path}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(pageInfo.title);
    await expect(page.locator('main')).toBeVisible();

    const internalErrors = consoleErrors.filter(
      (error) =>
        !/(403|404|ERR_FAILED|ERR_CERT_AUTHORITY_INVALID|model-viewer|googleapis|fontshare|og-image\.jpg)/i.test(error)
    );
    expect(internalErrors).toEqual([]);
  });

  test(`${pageInfo.path} stays inside the axe accessibility budget`, async ({ page }) => {
    await page.goto(`${base}${pageInfo.path}`, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations.length).toBeLessThanOrEqual(pageInfo.axeBudget);
  });
}
