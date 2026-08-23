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

/* Живой content/ приходит с ВЫКЛЮЧЕННОЙ частью категорий и кейсов — владелец
 * прячет их через админку. Эти смоуки проверяют ПОВЕДЕНИЕ админки («выключи
 * кейс — строка затемнилась»), поэтому им нужен полностью видимый базовый
 * слепок: иначе строка под тестом уже затемнена и спек падает на реальном
 * контенте, а не на регрессии. Оба читателя контента (статический сервер для
 * loadCatalog и мок Contents API для ensureFile) отдают ОДНИ И ТЕ ЖЕ
 * нормализованные байты, поэтому черновики, publishPrecheck и план коммита
 * остаются согласованными. */
export function normalizeVisibility(relPath, buffer) {
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const isCase = /^content\/cases\/[^/]+\.json$/.test(rel);
  if (!isCase && rel !== 'content/settings.json' && rel !== 'content/free-assets.json') return buffer;
  let data;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch (_error) {
    return buffer;
  }
  if (rel === 'content/settings.json') {
    for (const filter of data.filters || []) delete filter.enabled;
  } else if (rel === 'content/free-assets.json') {
    for (const category of data.categories || []) {
      delete category.enabled;
      for (const item of category.items || []) delete item.enabled;
    }
  } else if (data.enabled === false) {
    data.enabled = true;
  }
  return Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8');
}

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
          res
            .writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
            .end(normalizeVisibility(reqPath, data));
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
export async function mockGitHub(page, options = {}) {
  let sourceSha = options.sourceSha || 'a'.repeat(40);
  let sourceCommitCount = 0;
  let liveHead = options.initialHead || 'b'.repeat(40);
  const headSequence = Array.isArray(options.headSequence) ? options.headSequence.slice() : null;
  const refContents = new Map();
  const calls = {
    blobs: [],
    tree: [],
    commitMessage: '',
    refUpdated: false,
    refUpdates: 0,
    refReads: 0,
    sourceSha,
    commitPolls: 0
  };
  await page.route('https://api.github.com/**', async (route) => {
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
      const ref = url.searchParams.get('ref') || 'main';
      const abs = path.join(ROOT, filePath);
      if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return json(404, { message: 'Not Found' });
      const original = normalizeVisibility(filePath, fs.readFileSync(abs));
      const overridden =
        typeof options.contentForPath === 'function' ? options.contentForPath(filePath, original, ref, liveHead) : null;
      const committed = refContents.get(ref);
      const content =
        overridden === null || overridden === undefined
          ? (committed && committed.get(filePath)) || original
          : Buffer.from(overridden);
      return json(200, {
        type: 'file',
        encoding: 'base64',
        sha: typeof options.shaForPath === 'function' ? options.shaForPath(filePath, ref) : 'c'.repeat(40),
        content: content.toString('base64')
      });
    }
    if (p === '/repos/Gorgutc/codex/git/ref/heads/main' && method === 'GET') {
      calls.refReads += 1;
      if (options.refDelayMs) await new Promise((resolve) => setTimeout(resolve, options.refDelayMs));
      if (headSequence && headSequence.length) {
        liveHead = headSequence[Math.min(calls.refReads - 1, headSequence.length - 1)];
      }
      return json(200, { object: { sha: liveHead } });
    }
    if (/^\/repos\/Gorgutc\/codex\/git\/commits\/[0-9a-f]{40}$/.test(p))
      return json(200, { tree: { sha: 'treesha000' } });
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
      sourceCommitCount += 1;
      if (typeof options.sourceShaForCommit === 'function') {
        sourceSha = options.sourceShaForCommit(sourceCommitCount);
        calls.sourceSha = sourceSha;
      }
      const blobs = new Map(calls.blobs.map((blob) => [blob.sha, blob]));
      const committed = new Map();
      calls.tree.forEach((item) => {
        const blob = blobs.get(item.sha);
        if (item.path && blob && blob.encoding === 'base64')
          committed.set(item.path, Buffer.from(blob.content, 'base64'));
      });
      refContents.set(sourceSha, committed);
      return json(201, { sha: sourceSha });
    }
    if (p === '/repos/Gorgutc/codex/git/refs/heads/main' && method === 'PATCH') {
      calls.refUpdated = true;
      calls.refUpdates += 1;
      if (options.patchStatus) {
        if (options.patchCommitsSource) {
          liveHead = sourceSha;
          refContents.set('main', refContents.get(sourceSha));
        }
        if (options.patchMovesHead) liveHead = options.patchMovesHead;
        return json(options.patchStatus, { message: 'PATCH simulated failure' });
      }
      liveHead = sourceSha;
      refContents.set('main', refContents.get(sourceSha));
      return json(200, { object: { sha: sourceSha } });
    }
    if (p === '/repos/Gorgutc/codex/commits') {
      calls.commitPolls += 1;
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const paged = options.commitPages && options.commitPages[pageNumber];
      const pipeline =
        paged ||
        (typeof options.pipelineCommits === 'function'
          ? options.pipelineCommits(calls.commitPolls)
          : options.pipelineCommits);
      return json(
        200,
        pipeline || [
          {
            sha: 'd'.repeat(40),
            html_url: 'https://github.com/Gorgutc/codex/commit/' + 'd'.repeat(40),
            author: { login: 'github-actions[bot]' },
            commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${sourceSha}]` }
          }
        ]
      );
    }
    return json(404, { message: 'unmatched ' + method + ' ' + p });
  });
  return calls;
}
