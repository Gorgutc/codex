#!/usr/bin/env node
/* Verify the deployed normal shells, generated payloads and admin app assets. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHELLS = [
  { local: 'index.html', remote: '' },
  { local: 'free-assets.html', remote: 'free-assets.html' },
  // Beget serves a cookie-bootstrap challenge at /admin/, so the static shell
  // contract must use the literal document URL rather than the directory URL.
  { local: 'admin/index.html', remote: 'admin/index.html' }
];
const PAYLOADS = ['js/cards-data.js', 'js/fa-data.js', 'js/i18n-data.js'];
const PAYLOAD_REF_RE = /src="(?:\.\/)?(js\/(?:cards-data|fa-data|i18n-data)\.js)\?v=([0-9a-f]{64})"/g;
const ADMIN_APP_ASSETS = [
  { file: 'admin/css/admin.css', tag: 'link', attr: 'href', base: './css/admin.css' },
  { file: 'admin/js/api.js', tag: 'script', attr: 'src', base: './js/api.js' },
  { file: 'admin/js/state.js', tag: 'script', attr: 'src', base: './js/state.js' },
  { file: 'admin/js/preview.js', tag: 'script', attr: 'src', base: './js/preview.js' },
  { file: 'admin/js/ui.js', tag: 'script', attr: 'src', base: './js/ui.js' }
];
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 5;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function normalizedPublicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('PUBLIC_URL must use HTTPS.');
  return url.href.endsWith('/') ? url.href : url.href + '/';
}

async function fetchBytes(fetchImpl, url, { attempts = FETCH_ATTEMPTS, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  let target = new URL(url);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (target.protocol !== 'https:') throw new Error(`Public parity rejected non-HTTPS redirect to ${target.href}.`);
    let lastError;
    let redirectLocation = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(target.href, {
          headers: { 'Accept-Encoding': 'identity' },
          redirect: 'manual',
          signal: controller.signal
        });
        if (response.status >= 300 && response.status < 400) {
          redirectLocation = response.headers.get('location');
          if (!redirectLocation) throw new Error(`Public parity redirect without Location from ${target.href}.`);
          break;
        }
        if (!response.ok) throw new Error(`Public parity fetch failed for ${target.href} (${response.status}).`);
        // Keep the abort timer alive through the complete body read: curl's
        // former --max-time protected payload transfer, not merely headers.
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (redirectLocation) {
      target = new URL(redirectLocation, target);
      if (target.protocol !== 'https:') throw new Error(`Public parity rejected non-HTTPS redirect to ${target.href}.`);
      continue;
    }
    throw lastError || new Error(`Public parity fetch failed for ${target.href}.`);
  }
  throw new Error(`Public parity exceeded ${MAX_REDIRECTS} redirects for ${url}.`);
}

function refsFromShell(shell) {
  const refs = [];
  for (const match of shell.toString('utf8').matchAll(PAYLOAD_REF_RE)) refs.push({ file: match[1], revision: match[2] });
  return refs;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function adminAppRefsFromShell(shell) {
  const html = shell.toString('utf8');
  const refs = new Map();
  for (const asset of ADMIN_APP_ASSETS) {
    const tag = escapeRegex(asset.tag);
    const attr = escapeRegex(asset.attr);
    const base = escapeRegex(asset.base);
    const matches = Array.from(
      html.matchAll(new RegExp(`<${tag}\\b[^>]*\\s${attr}\\s*=\\s*["'](${base}(?:\\?[^"']*)?)["']`, 'gi'))
    );
    if (matches.length !== 1) {
      throw new Error(`Admin normal shell must emit exactly one ${asset.base} reference (found ${matches.length}).`);
    }
    const href = matches[0][1];
    const revision = new RegExp(`^${base}\\?v=([0-9a-f]{64})$`).exec(href);
    if (!revision) {
      throw new Error(`Admin normal shell must emit ${asset.base}?v=<64 lowercase SHA-256 hex>.`);
    }
    refs.set(asset.file, { href, revision: revision[1] });
  }
  const sortable = Array.from(
    html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']*sortable\.min\.js[^"']*)["']/gi)
  );
  if (sortable.length !== 1 || sortable[0][1] !== './js/vendor/sortable.min.js') {
    throw new Error('Admin normal shell must keep exactly one pinned, unversioned SortableJS vendor reference.');
  }
  return refs;
}

export async function verifyBegetParity({
  publicUrl,
  root = process.cwd(),
  fetchImpl = fetch,
  // Fixtures may shorten this; the production CLI intentionally exposes no
  // timeout flag and therefore always uses FETCH_TIMEOUT_MS.
  fetchTimeoutMs = FETCH_TIMEOUT_MS
}) {
  const baseUrl = normalizedPublicUrl(publicUrl);
  const publicShells = [];
  for (const shell of SHELLS) {
    const remoteUrl = new URL(shell.remote, baseUrl).href;
    const [local, remote] = await Promise.all([
      fs.readFile(path.join(root, shell.local)),
      fetchBytes(fetchImpl, remoteUrl, { timeoutMs: fetchTimeoutMs })
    ]);
    if (!local.equals(remote)) {
      throw new Error(`Public normal-shell parity mismatch for ${shell.local} (local ${sha256(local)}, public ${sha256(remote)}).`);
    }
    publicShells.push({ ...shell, remote, remoteUrl });
  }
  const refs = new Map();
  for (const ref of publicShells.filter((shell) => shell.local !== 'admin/index.html').flatMap((shell) => refsFromShell(shell.remote))) {
    const existing = refs.get(ref.file);
    if (existing && existing !== ref.revision) {
      throw new Error(`Normal public shells emit conflicting immutable revisions for ${ref.file}.`);
    }
    refs.set(ref.file, ref.revision);
  }
  if (refs.size !== PAYLOADS.length || PAYLOADS.some((file) => !refs.has(file))) {
    throw new Error('Normal public shells must emit exactly cards-data, fa-data, and i18n-data versioned payload references.');
  }
  for (const file of PAYLOADS) {
    const local = await fs.readFile(path.join(root, file));
    const revision = refs.get(file);
    const localHash = sha256(local);
    if (localHash !== revision) {
      throw new Error(`Local ${file}?v=${revision} does not match its emitted SHA-256 revision ${revision}.`);
    }
    const publicPayload = await fetchBytes(fetchImpl, new URL(`${file}?v=${revision}`, baseUrl).href, {
      timeoutMs: fetchTimeoutMs
    });
    if (!local.equals(publicPayload)) {
      throw new Error(`Public versioned payload mismatch for ${file}?v=${revision} (local ${localHash}, public ${sha256(publicPayload)}).`);
    }
  }
  const adminShell = publicShells.find((shell) => shell.local === 'admin/index.html');
  const adminRefs = adminAppRefsFromShell(adminShell.remote);
  for (const asset of ADMIN_APP_ASSETS) {
    const ref = adminRefs.get(asset.file);
    const local = await fs.readFile(path.join(root, asset.file));
    const localHash = sha256(local);
    if (localHash !== ref.revision) {
      throw new Error(`Local ${asset.file}?v=${ref.revision} does not match its emitted SHA-256 revision ${ref.revision}.`);
    }
    const publicAsset = await fetchBytes(fetchImpl, new URL(ref.href, adminShell.remoteUrl).href, {
      timeoutMs: fetchTimeoutMs
    });
    if (!local.equals(publicAsset)) {
      throw new Error(
        `Public versioned admin app asset mismatch for ${asset.file}?v=${ref.revision} (local ${localHash}, public ${sha256(publicAsset)}).`
      );
    }
  }
  return { payloads: PAYLOADS.slice(), adminAssets: ADMIN_APP_ASSETS.map((asset) => asset.file) };
}

export async function runBegetParityCli({
  publicUrl,
  root = process.cwd(),
  fetchImpl = fetch,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
  writeError = console.error
} = {}) {
  try {
    await verifyBegetParity({ publicUrl, root, fetchImpl, fetchTimeoutMs });
    return 0;
  } catch (error) {
    writeError(`::error::${error && error.message ? error.message : error}`);
    return 1;
  }
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publicUrl = argumentValue(process.argv.slice(2), '--public-url');
  if (!publicUrl) {
    console.error('Usage: verify-beget-parity.mjs --public-url https://codex.promo/');
    process.exitCode = 1;
  } else {
    process.exitCode = await runBegetParityCli({ publicUrl });
  }
}
