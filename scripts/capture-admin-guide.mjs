/* capture-admin-guide.mjs — скриншоты админки для docs/admin-guide.md (итерация G).
 *
 * Поднимает статический сервер по корню репозитория (как verify-frozen.js),
 * мокает GitHub API на уровне Playwright-роутов (Contents API отдаёт реальные
 * файлы content/ с диска) и сеет сессию в sessionStorage — скриншоты
 * показывают НАСТОЯЩУЮ админку с настоящим контентом, без сети и токенов.
 *
 * Снимки кладутся в docs/img/admin-guide/*.png (viewport 1280x800).
 * Запуск (однократный, при обновлении гайда): node scripts/capture-admin-guide.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'img', 'admin-guide');

const MIME = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xml': 'application/xml'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (requestPath.endsWith('/')) requestPath += 'index.html';
      const filePath = path.join(ROOT, requestPath);
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
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Мок GitHub REST API: вход и чтение файлов работают как настоящие,
// публикация в скриншотах не выполняется.
async function mockGitHub(page) {
  await page.route('https://www.cloudflare.com/**', (route) => route.abort());
  await page.route('https://api.github.com/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (status, body) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === '/user') return json(200, { login: 'Gorgutc', avatar_url: '' });
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
    return json(404, { message: 'unmatched ' + p });
  });
}

async function shoot(page, name) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`[SHOT] ${name} (${kb} KB)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // ── 01: экран входа (без сессии) ─────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await mockGitHub(page);
    await page.goto(`${base}/admin/`);
    await page.click('#login-pat-toggle'); // показать и PAT-форму
    await page.waitForSelector('#pat-form:not([hidden])');
    await shoot(page, '01-login.png');
    await page.close();
  }

  // ── Остальные экраны: залогиненная сессия ────────────────────────────
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await mockGitHub(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem('codexAdminToken', 'guide-session-token');
    window.sessionStorage.setItem('codexAdminUser', JSON.stringify({ login: 'Gorgutc', avatarUrl: '' }));
  });
  page.on('dialog', (dialog) => dialog.accept());

  // 02: список кейсов
  await page.goto(`${base}/admin/#/cases`);
  await page.waitForSelector('.case-row');
  await shoot(page, '02-cases-list.png');

  // 03: редактор кейса — тексты RU/EN
  await page.goto(`${base}/admin/#/case/orbital-mk-ii`);
  await page.waitForSelector('[data-field="content/cases/orbital-mk-ii.json::card.title.ru"]');
  await shoot(page, '03-case-editor-text.png');

  // 04: иллюстрации кейса (drop-зоны слотов)
  await page.locator('h2', { hasText: 'Иллюстрации кейса' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '04-case-editor-media.png');

  // 05: motion-блоки (видео и Vimeo)
  await page.locator('h2', { hasText: 'Motion-блоки' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '05-case-editor-motion.png');

  // 06: ручной порядок блоков (стрелки и ручки перестановки)
  await page.locator('#layout-manual-btn').scrollIntoViewIfNeeded();
  await page.click('#layout-manual-btn');
  await page.waitForSelector('#layout-seeded-btn');
  await page.locator('#layout-section').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shoot(page, '06-layout-manual.png');
  await page.click('#layout-seeded-btn'); // вернуть, чтобы не «протёк» в другие кадры
  await page.waitForSelector('#layout-manual-btn');

  // 07: выключенный кейс в списке (бейдж «скрыто»)
  await page.goto(`${base}/admin/#/cases`);
  await page.waitForSelector('.case-row');
  await page.click('[data-case-toggle="vega-shell"]');
  await page.waitForSelector('.case-row--off');
  await shoot(page, '07-case-hidden.png');

  // 08: экран категорий
  await page.goto(`${base}/admin/#/categories`);
  await page.waitForSelector('.category-row');
  await shoot(page, '08-categories.png');

  // 09: мета-теги с OG-изображением
  await page.goto(`${base}/admin/#/meta`);
  await page.waitForSelector('.drop-zone');
  await shoot(page, '09-meta-og.png');

  // 10: предпросмотр черновика (настоящий сайт в iframe; в черновике
  // сейчас скрытый vega-shell — его карточки нет в гриде)
  await page.click('#preview-btn');
  await page.waitForSelector('#preview-overlay:not([hidden])');
  const frame = page.frameLocator('#preview-frame');
  await frame.locator('.work-card').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500); // дать прелоадеру сайта уйти
  await shoot(page, '10-preview.png');
  await page.click('#preview-close');

  // 11: диалог публикации (черновик: скрытый кейс)
  await page.click('#publish-btn');
  await page.waitForSelector('#publish-dialog[open]');
  await shoot(page, '11-publish-dialog.png');

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log(`Done: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
