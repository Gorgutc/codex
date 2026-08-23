import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runBegetParityCli, verifyBegetParity } from '../../scripts/verify-beget-parity.mjs';

const PUBLIC_URL = 'https://codex.promo/';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-beget-parity-'));
  const payloads = {
    'js/cards-data.js': 'window.CARDS_DATA = [];\n',
    'js/fa-data.js': 'window.FA_DATA = [];\n',
    'js/i18n-data.js': 'window.I18N_DATA = {};\n'
  };
  for (const [file, bytes] of Object.entries(payloads)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const ref = (file) => `${file}?v=${sha256(payloads[file])}`;
  const shells = {
    'index.html': `<script src="${ref('js/cards-data.js')}"></script><script src="${ref('js/i18n-data.js')}"></script>\n`,
    'free-assets.html': `<script src="${ref('js/fa-data.js')}"></script><script src="${ref('js/i18n-data.js')}"></script>\n`
  };
  for (const [file, bytes] of Object.entries(shells)) fs.writeFileSync(path.join(root, file), bytes);
  return { root, shells, payloads };
}

function fetchFor({ shells, payloads, staleShell, stalePayload }) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/') return new Response(staleShell || shells['index.html']);
    if (parsed.pathname === '/free-assets.html') return new Response(shells['free-assets.html']);
    const file = parsed.pathname.replace(/^\//, '');
    if (payloads[file] !== undefined) return new Response(file === stalePayload ? payloads[file] + '// stale\n' : payloads[file]);
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
  assert.equal(
    await runBegetParityCli({ publicUrl: PUBLIC_URL, root: data.root, fetchImpl: fetchFor(data), writeError: () => {} }),
    0
  );
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
