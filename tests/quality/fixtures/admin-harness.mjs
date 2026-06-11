/* admin-harness.mjs — общий каркас Playwright-смоуков админки.
 *
 * Несколько admin-*.spec.mjs делили дословно одинаковые куски: статический
 * сервер репозитория (beforeAll/afterAll), полный мок GitHub REST API с
 * журналом blob'ов/tree и хелпер hash8. Здесь они извлечены в один модуль.
 *
 * Contents API читает реальные файлы с диска; Git Data API пишет журнал
 * вызовов (calls) для ассертов. Сервер раздаёт весь репозиторий статикой.
 *
 * Использование в спеке:
 *   import { ROOT, hash8, startStaticServer, mockGitHub } from './fixtures/admin-harness.mjs';
 *   const ctx = startStaticServer();   // регистрирует beforeAll/afterAll
 *   // в тесте: const calls = await mockGitHub(page); ... ctx.base
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

// fixtures/ лежит на один уровень глубже, чем сами спеки.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function hash8(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

// MIME покрывает все типы, которые раздают admin-смоуки (надмножество прежних
// локальных карт каждого спека).
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary'
};

// Поднимает статический сервер репозитория в beforeAll, гасит в afterAll.
// Возвращает объект с живым полем base (URL сервера) — читать ВНУТРИ теста,
// когда сервер уже поднят.
export function startStaticServer() {
  const ctx = { base: '', server: null };

  test.beforeAll(async () => {
    await new Promise((resolve) => {
      ctx.server = http.createServer((req, res) => {
        let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (reqPath.endsWith('/')) reqPath += 'index.html';
        const filePath = path.join(ROOT, reqPath);
        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403).end();
          return;
        }
        fs.readFile(filePath, (error, data) => {
          if (error) {
            res.writeHead(404).end();
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' }).end(data);
        });
      });
      ctx.server.listen(0, '127.0.0.1', () => {
        ctx.base = `http://127.0.0.1:${ctx.server.address().port}`;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    await new Promise((resolve) => ctx.server.close(resolve));
  });

  return ctx;
}

// Полный мок GitHub REST API с журналом blob'ов и tree для ассертов.
// calls = { blobs, tree, commitMessage, refUpdated }.
export async function mockGitHub(page) {
  const calls = { blobs: [], tree: [], commitMessage: '', refUpdated: false };
  await page.route('https://api.github.com/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const method = request.method();
    const json = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (p === '/user') return json(200, { login: 'owner-test', avatar_url: '' });
    if (p === '/repos/Gorgutc/codex') return json(200, { default_branch: 'main', permissions: { push: true } });
    if (p.startsWith('/repos/Gorgutc/codex/contents/')) {
      const filePath = decodeURIComponent(p.slice('/repos/Gorgutc/codex/contents/'.length));
      const abs = path.join(ROOT, filePath);
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return json(404, { message: 'Not Found' });
      return json(200, {
        type: 'file',
        encoding: 'base64',
        sha: 'sha-' + filePath,
        content: fs.readFileSync(abs).toString('base64')
      });
    }
    if (p === '/repos/Gorgutc/codex/git/ref/heads/main') return json(200, { object: { sha: 'headsha000' } });
    if (p === '/repos/Gorgutc/codex/git/commits/headsha000') return json(200, { tree: { sha: 'treesha000' } });
    if (p === '/repos/Gorgutc/codex/git/blobs' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      const sha = 'blobsha-' + calls.blobs.length;
      calls.blobs.push({ sha, content: body.content || '', encoding: body.encoding || '' });
      return json(201, { sha });
    }
    if (p === '/repos/Gorgutc/codex/git/trees' && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      calls.tree = body.tree || [];
      return json(201, { sha: 'newtree000' });
    }
    if (p === '/repos/Gorgutc/codex/git/commits' && method === 'POST') {
      calls.commitMessage = JSON.parse(request.postData() || '{}').message || '';
      return json(201, { sha: 'newcommit0' });
    }
    if (p === '/repos/Gorgutc/codex/git/refs/heads/main' && method === 'PATCH') {
      calls.refUpdated = true;
      return json(200, { object: { sha: 'newcommit0' } });
    }
    if (p === '/repos/Gorgutc/codex/commits') {
      return json(200, [
        {
          sha: 'botsha0000',
          html_url: 'https://github.com/Gorgutc/codex/commit/botsha0000',
          commit: { message: 'chore(content): regenerate shipped files [content-publish]' }
        }
      ]);
    }
    return json(404, { message: 'unmatched ' + method + ' ' + p });
  });
  return calls;
}
