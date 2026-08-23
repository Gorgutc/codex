import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runBegetParityCli, verifyBegetParity } from '../../scripts/verify-beget-parity.mjs';

const PUBLIC_URL = 'https://codex.promo/';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEPLOY_WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'deploy-beget.yml');
const ADMIN_APP_ASSETS = [
  { file: 'admin/css/admin.css', base: './css/admin.css', tag: 'link', attr: 'href' },
  { file: 'admin/js/api.js', base: './js/api.js', tag: 'script', attr: 'src' },
  { file: 'admin/js/state.js', base: './js/state.js', tag: 'script', attr: 'src' },
  { file: 'admin/js/preview.js', base: './js/preview.js', tag: 'script', attr: 'src' },
  { file: 'admin/js/ui.js', base: './js/ui.js', tag: 'script', attr: 'src' }
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function lftpCommands(workflow) {
  const block = workflow.match(/^\s*lftp <<LFTP\s*\n([\s\S]*?)^\s*LFTP\s*$/m);
  assert.ok(block, 'deploy workflow must contain one executable LFTP block');
  const commands = [];
  let pending = '';
  for (const rawLine of block[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const continues = line.endsWith('\\');
    pending += `${pending ? ' ' : ''}${continues ? line.slice(0, -1).trim() : line}`;
    if (!continues) {
      commands.push(pending);
      pending = '';
    }
  }
  assert.equal(pending, '', 'LFTP command block must not end in a continuation');
  return commands;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-beget-parity-'));
  const payloads = {
    'js/cards-data.js': 'window.CARDS_DATA = [];\n',
    'js/fa-data.js': 'window.FA_DATA = [];\n',
    'js/i18n-data.js': 'window.I18N_DATA = {};\n'
  };
  const adminAssets = {
    'admin/css/admin.css': 'body { color: #fff; }\n',
    'admin/js/api.js': 'window.AdminAPI = {};\n',
    'admin/js/state.js': 'window.AdminState = {};\n',
    'admin/js/preview.js': 'window.AdminPreview = {};\n',
    'admin/js/ui.js': 'window.AdminUI = {};\n'
  };
  for (const [file, bytes] of Object.entries(payloads)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  for (const [file, bytes] of Object.entries(adminAssets)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const ref = (file) => `${file}?v=${sha256(payloads[file])}`;
  const adminRef = (asset) => `${asset.base}?v=${sha256(adminAssets[asset.file])}`;
  const shells = {
    'index.html': `<script src="${ref('js/cards-data.js')}"></script><script src="${ref('js/i18n-data.js')}"></script>\n`,
    'free-assets.html': `<script src="${ref('js/fa-data.js')}"></script><script src="${ref('js/i18n-data.js')}"></script>\n`,
    'admin/index.html': [
      `<link rel="stylesheet" href="${adminRef(ADMIN_APP_ASSETS[0])}">`,
      '<script src="./js/vendor/sortable.min.js"></script>',
      ...ADMIN_APP_ASSETS.slice(1).map((asset) => `<script src="${adminRef(asset)}"></script>`),
      ''
    ].join('\n')
  };
  for (const [file, bytes] of Object.entries(shells)) fs.writeFileSync(path.join(root, file), bytes);
  return { root, shells, payloads, adminAssets };
}

function fetchFor({ shells, payloads, adminAssets, staleShell, staleAdminShell, stalePayload, staleAdminAsset }) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/') return new Response(staleShell || shells['index.html']);
    if (parsed.pathname === '/free-assets.html') return new Response(shells['free-assets.html']);
    if (parsed.pathname === '/admin/index.html') return new Response(staleAdminShell || shells['admin/index.html']);
    const file = parsed.pathname.replace(/^\//, '');
    if (payloads[file] !== undefined) return new Response(file === stalePayload ? payloads[file] + '// stale\n' : payloads[file]);
    if (adminAssets[file] !== undefined) {
      return new Response(file === staleAdminAsset ? adminAssets[file] + '// stale\n' : adminAssets[file]);
    }
    return new Response('not found', { status: 404 });
  };
}

test('Beget parity accepts exact normal shells and all emitted immutable payloads', async () => {
  const data = fixture();
  const result = await verifyBegetParity({
    publicUrl: PUBLIC_URL,
    root: data.root,
    fetchImpl: fetchFor(data)
  });
  assert.deepEqual(result.payloads, ['js/cards-data.js', 'js/fa-data.js', 'js/i18n-data.js']);
  assert.deepEqual(result.adminAssets, ADMIN_APP_ASSETS.map((asset) => asset.file));
  assert.equal(
    await runBegetParityCli({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl: fetchFor(data), writeError: () => {} }),
    0
  );
});

test('Beget deploy uploads immutable bytes before exactly three manifest shells', () => {
  const commands = lftpCommands(fs.readFileSync(DEPLOY_WORKFLOW, 'utf8'));
  const mainMirror = commands.find((command) => command.startsWith('mirror --reverse --delete '));
  assert.ok(mainMirror, 'deploy must have a primary deleting reverse mirror');
  for (const manifest of ['index.html', 'free-assets.html', 'admin/index.html']) {
    assert.match(mainMirror, new RegExp(`--exclude-glob '${manifest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }

  const transfers = commands.filter(
    (command) => command.startsWith('mirror --reverse ') || command.startsWith('put ')
  );
  const manifestUploads = [
    'put index.html -o index.html',
    'put free-assets.html -o free-assets.html',
    'put admin/index.html -o admin/index.html'
  ];
  assert.deepEqual(transfers.slice(-manifestUploads.length), manifestUploads);
  assert.equal(transfers.filter((command) => command.startsWith('put ')).length, manifestUploads.length);
  assert.ok(
    transfers.findIndex((command) => command.startsWith('mirror --reverse --only-missing ')) < transfers.indexOf(manifestUploads[0]),
    'the manifest shells must follow every mirror transfer'
  );
});

test('Beget parity rejects a stale admin/index.html shell instead of the cookie-bootstrap directory URL', async () => {
  const data = fixture();
  await assert.rejects(
    verifyBegetParity({
      publicUrl: PUBLIC_URL,
      root: data.root,
      fetchImpl: fetchFor({ ...data, staleAdminShell: data.shells['admin/index.html'] + '<!-- stale -->\n' })
    }),
    /normal-shell parity mismatch for admin\/index\.html/
  );
});

test('Beget parity rejects arbitrary, missing and duplicate admin app references', async () => {
  const cases = [
    {
      name: 'arbitrary query',
      mutate: (shell) => shell.replace(/\.\/css\/admin\.css\?v=[0-9a-f]{64}/, `./css/admin.css?v=${'f'.repeat(64)}&cache=arbitrary`),
      error: /64 lowercase SHA-256 hex/
    },
    {
      name: 'missing revision',
      mutate: (shell) => shell.replace(/\.\/css\/admin\.css\?v=[0-9a-f]{64}/, './css/admin.css'),
      error: /64 lowercase SHA-256 hex/
    },
    {
      name: 'duplicate reference',
      mutate: (shell) => shell + shell.match(/<link[^>]+admin\.css[^>]*>/)[0] + '\n',
      error: /exactly one \.\/css\/admin\.css reference/
    }
  ];
  for (const scenario of cases) {
    const data = fixture();
    const shell = scenario.mutate(data.shells['admin/index.html']);
    fs.writeFileSync(path.join(data.root, 'admin/index.html'), shell);
    await assert.rejects(
      verifyBegetParity({
        publicUrl: PUBLIC_URL,
        root: data.root,
        fetchImpl: fetchFor({ ...data, shells: { ...data.shells, 'admin/index.html': shell } })
      }),
      scenario.error,
      scenario.name
    );
  }
});

test('Beget parity rejects a stale normal shell instead of accepting a cache-busted substitute', async () => {
  const data = fixture();
  await assert.rejects(
    verifyBegetParity({
      publicUrl: PUBLIC_URL,
      root: data.root,
      fetchImpl: fetchFor({ ...data, staleShell: data.shells['index.html'] + '<!-- stale -->\n' })
    }),
    /normal-shell parity mismatch/
  );
});

test('Beget parity rejects a stale emitted payload and returns a failing executable exit code', async () => {
  const data = fixture();
  const fetchImpl = fetchFor({ ...data, stalePayload: 'js/fa-data.js' });
  await assert.rejects(
    verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl }),
    /versioned payload mismatch/
  );
  assert.equal(
    await runBegetParityCli({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl, writeError: () => {} }),
    1
  );
});

test('Beget parity rejects stale versioned admin CSS and UI app bytes', async () => {
  for (const file of ['admin/css/admin.css', 'admin/js/ui.js']) {
    const data = fixture();
    await assert.rejects(
      verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl: fetchFor({ ...data, staleAdminAsset: file }) }),
      /versioned admin app asset mismatch/
    );
  }
});

test('Beget parity rejects local admin CSS and UI bytes that no longer match their shell revisions', async () => {
  for (const file of ['admin/css/admin.css', 'admin/js/ui.js']) {
    const data = fixture();
    fs.appendFileSync(path.join(data.root, file), '// stale local bytes\n');
    await assert.rejects(
      verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl: fetchFor(data) }),
      /does not match its emitted SHA-256 revision/
    );
  }
});

test('Beget parity rejects conflicting revisions for one payload emitted by different normal shells', async () => {
  const data = fixture();
  const conflicting = data.shells['free-assets.html'].replace(/i18n-data\.js\?v=[0-9a-f]{64}/, `i18n-data.js?v=${'f'.repeat(64)}`);
  fs.writeFileSync(path.join(data.root, 'free-assets.html'), conflicting);
  await assert.rejects(
    verifyBegetParity({
      publicUrl: PUBLIC_URL,
      root: data.root,
      fetchImpl: fetchFor({ ...data, shells: { ...data.shells, 'free-assets.html': conflicting } })
    }),
    /conflicting immutable revisions/
  );
});

test('Beget parity retries transient fetch failures with an abortable request', async () => {
  const data = fixture();
  const baseFetch = fetchFor(data);
  let indexAttempts = 0;
  const fetchImpl = async (url, options) => {
    assert.ok(options.signal, 'parity fetch must have a timeout signal');
    if (new URL(url).pathname === '/' && ++indexAttempts === 1) return new Response('temporary', { status: 503 });
    return baseFetch(url, options);
  };
  await verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl });
  assert.equal(indexAttempts, 2);
});

test('Beget parity rejects a redirect that leaves HTTPS', async () => {
  const data = fixture();
  const fetchImpl = async (url) => {
    if (new URL(url).pathname === '/') return new Response(null, { status: 302, headers: { location: 'http://stale.test/' } });
    return fetchFor(data)(url);
  };
  await assert.rejects(
    verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl }),
    /non-HTTPS redirect/
  );
});

test('Beget parity follows a successful HTTPS redirect before comparing normal shell bytes', async () => {
  const data = fixture();
  const baseFetch = fetchFor(data);
  let redirected = false;
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/') {
      return new Response(null, { status: 302, headers: { location: 'https://codex.promo/redirected-index.html' } });
    }
    if (parsed.pathname === '/redirected-index.html') {
      redirected = true;
      return new Response(data.shells['index.html']);
    }
    return baseFetch(url, options);
  };
  await verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl });
  assert.equal(redirected, true);
});

test('Beget parity retries when a successful header response fails while reading its body', async () => {
  const data = fixture();
  const baseFetch = fetchFor(data);
  let indexAttempts = 0;
  const fetchImpl = async (url, options) => {
    if (new URL(url).pathname === '/' && ++indexAttempts === 1) {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: async () => {
          assert.ok(options.signal, 'body read must remain inside the abortable timeout scope');
          throw new Error('body interrupted');
        }
      };
    }
    return baseFetch(url, options);
  };
  await verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl });
  assert.equal(indexAttempts, 2);
});

test('Beget parity aborts a stalled successful body three times and returns a failing CLI code', async () => {
  const data = fixture();
  const baseFetch = fetchFor(data);
  let indexAttempts = 0;
  const fetchImpl = async (url, options) => {
    if (new URL(url).pathname === '/') {
      indexAttempts += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: () =>
          new Promise((_, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('body aborted by timeout')), { once: true });
          })
      };
    }
    return baseFetch(url, options);
  };
  await assert.rejects(
    verifyBegetParity({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl, fetchTimeoutMs: 1 }),
    /body aborted by timeout/
  );
  assert.equal(indexAttempts, 3);
  assert.equal(
    await runBegetParityCli({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl, fetchTimeoutMs: 1, writeError: () => {} }),
    1
  );
});
