#!/usr/bin/env node
/*
 * Serializes a whole unresolved source batch into one settled main history.
 * This intentionally owns Git choreography rather than asking workflow YAML
 * to rebase generated output: if main moved, the attempt is discarded and a
 * fresh checkout regenerates from the new exact head.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';
const SUCCESS_PREFIX = 'chore(content): regenerate site from content/ [content-publish]';
const REVERT_PREFIX = 'revert(content): roll back content push after failed publish [content-publish-revert]';

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function gitOk(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch (_error) {
    return false;
  }
}

function metadata(cwd, sha) {
  const [authorName, authorEmail, subject] = git(cwd, ['show', '-s', '--format=%an%x00%ae%x00%s', sha]).split('\0');
  return { sha, authorName, authorEmail, subject };
}

function isTrustedBot(item) {
  return item.authorName === BOT_NAME && item.authorEmail === BOT_EMAIL;
}

function isTrustedTerminal(item) {
  return isTrustedBot(item) && strictTerminalSubject(item.subject);
}

function strictTerminalSubject(subject) {
  return [SUCCESS_PREFIX, REVERT_PREFIX].some(
    (prefix) =>
      subject === prefix || new RegExp('^' + escapeRegex(prefix) + ' \\[source:[0-9a-f]{40}\\]$').test(subject)
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function terminalSubject(status, sourceSha = null) {
  const prefix = status === 'reverted' ? REVERT_PREFIX : SUCCESS_PREFIX;
  if (sourceSha === null) return prefix;
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('Terminal marker requires a full lowercase source SHA.');
  return prefix + ' [source:' + sourceSha + ']';
}

function lastTrustedAnchor(cwd, base) {
  const commits = git(cwd, ['rev-list', '--first-parent', base]).split('\n').filter(Boolean);
  for (const sha of commits) {
    const item = metadata(cwd, sha);
    if (isTrustedTerminal(item)) return sha;
  }
  return null;
}

function touchesSource(cwd, sha) {
  const names = gitOk(cwd, ['rev-parse', '-q', '--verify', sha + '^1'])
    ? git(cwd, ['diff', '--name-only', sha + '^1', sha, '--', 'content/', 'assets/'])
        .split('\n')
        .filter(Boolean)
    : git(cwd, ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha, '--', 'content/', 'assets/'])
        .split('\n')
        .filter(Boolean);
  return names.some((name) => name.startsWith('content/') || name.startsWith('assets/'));
}

export function discoverUnresolvedSources({ cwd, base }) {
  const anchor = lastTrustedAnchor(cwd, base);
  const range = anchor ? anchor + '..' + base : base;
  const commits = git(cwd, ['rev-list', '--first-parent', '--reverse', range]).split('\n').filter(Boolean);
  return commits
    .map((sha) => metadata(cwd, sha))
    .filter((item) => !isTrustedTerminal(item) && touchesSource(cwd, item.sha));
}

function configureBot(cwd) {
  git(cwd, ['config', 'user.name', BOT_NAME]);
  git(cwd, ['config', 'user.email', BOT_EMAIL]);
}

function commit(cwd, subject, allowEmpty = false) {
  git(cwd, ['commit', ...(allowEmpty ? ['--allow-empty'] : []), '-m', subject]);
}

const GENERATED_ALLOWLIST = [
  'js/cards-data.js',
  'js/fa-data.js',
  'js/i18n-data.js',
  'index.html',
  'free-assets.html',
  'admin/index.html',
  'sitemap.xml',
  /^tests\/quality\/fixtures\//
];

function allowedGeneratedPath(rel, allowlist) {
  return allowlist.some((entry) =>
    typeof entry === 'string' ? entry === rel : typeof entry === 'function' ? entry(rel) : entry.test(rel)
  );
}

function generatedChanges(cwd, allowlist) {
  const tracked = git(cwd, ['diff', '--name-only']).split('\n').filter(Boolean);
  const cached = git(cwd, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const changed = Array.from(new Set(tracked.concat(cached, untracked))).sort();
  const unexpected = changed.filter((rel) => !allowedGeneratedPath(rel, allowlist));
  if (unexpected.length) {
    throw new Error('Generator changed a non-allowlisted path: ' + unexpected.join(', '));
  }
  return changed;
}

function freshOriginMain(cwd, base) {
  git(cwd, ['fetch', '--no-tags', 'origin', 'main']);
  return git(cwd, ['rev-parse', 'origin/main']) === base;
}

function isAncestor(cwd, ancestor, descendant) {
  try {
    git(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

function cleanAttempt(cwd, base) {
  git(cwd, ['reset', '--hard', base]);
  git(cwd, ['clean', '-fd']);
}

function pushWholeChain(cwd) {
  git(cwd, ['push', 'origin', 'HEAD:main']);
}

export function classifyRemoteHead(base, chainHead, remote) {
  if (remote === chainHead) return { status: 'confirmed' };
  if (remote !== base) return { retry: true, reason: 'main moved during batch push' };
  return { fatal: true, reason: 'push failed while origin/main still equals the checked base' };
}

export function classifyPushFailure(cwd, base, chainHead) {
  try {
    git(cwd, ['fetch', '--no-tags', 'origin', 'main']);
    const remote = git(cwd, ['rev-parse', 'origin/main']);
    if (isAncestor(cwd, chainHead, remote)) return { status: 'confirmed' };
    return classifyRemoteHead(base, chainHead, remote);
  } catch (error) {
    return { fatal: true, reason: 'could not verify the remote after push failure: ' + (error.message || error) };
  }
}

function revertSourceBatch(cwd, sources) {
  cleanAttempt(cwd, 'HEAD');
  for (const source of sources.slice().reverse()) {
    const merge = gitOk(cwd, ['rev-parse', '-q', '--verify', source.sha + '^2']);
    git(cwd, ['revert', '--no-commit', ...(merge ? ['-m', '1'] : []), source.sha]);
  }
  commit(cwd, terminalSubject('reverted'), true);
  sources.forEach((source) => commit(cwd, terminalSubject('reverted', source.sha), true));
}

async function oneAttempt(options) {
  const cwd = options.cwd || process.cwd();
  git(cwd, ['fetch', '--no-tags', 'origin', 'main']);
  const base = git(cwd, ['rev-parse', 'origin/main']);
  git(cwd, ['checkout', '--detach', base]);
  const sources = discoverUnresolvedSources({ cwd, base });
  if (sources.length === 0) return { status: 'nothing', sources: [] };
  configureBot(cwd);

  let failed = null;
  let generatedPaths = [];
  try {
    await options.generate({ cwd, base, sources, attempt: options.attempt });
    generatedPaths = generatedChanges(cwd, options.generatedAllowlist);
    if (generatedPaths.length) {
      await options.verify();
      await options.captureGolden();
      generatedPaths = generatedChanges(cwd, options.generatedAllowlist);
    }
  } catch (error) {
    failed = error;
  }

  // Rebuild instead of replaying output whenever main changed under checks.
  if (!freshOriginMain(cwd, base)) {
    cleanAttempt(cwd, base);
    return { retry: true, reason: 'main moved while the batch was being checked' };
  }

  try {
    if (failed) {
      cleanAttempt(cwd, base);
      revertSourceBatch(cwd, sources);
    } else {
      if (generatedPaths.length) {
        git(cwd, ['add', '--', ...generatedPaths]);
        commit(cwd, terminalSubject('published'));
      }
      sources.forEach((source) => commit(cwd, terminalSubject('published', source.sha), true));
    }
    // A second fetch closes the mutation-to-push window without any rebase.
    if (!freshOriginMain(cwd, base)) {
      cleanAttempt(cwd, base);
      return { retry: true, reason: 'main moved before batch push' };
    }
    const chainHead = git(cwd, ['rev-parse', 'HEAD']);
    try {
      pushWholeChain(cwd);
    } catch (_error) {
      const outcome = classifyPushFailure(cwd, base, chainHead);
      if (outcome.status !== 'confirmed') {
        cleanAttempt(cwd, base);
        if (outcome.retry) return outcome;
        throw new Error(outcome.reason, { cause: _error });
      }
    }
  } catch (error) {
    cleanAttempt(cwd, base);
    throw error;
  }
  return {
    status: failed ? 'reverted' : 'published',
    sources: sources.map((source) => source.sha),
    generated: generatedPaths.length > 0,
    error: failed || null
  };
}

export async function runFreshAttempts(maxAttempts, attempt) {
  let lastReason = '';
  for (let index = 1; index <= maxAttempts; index += 1) {
    const result = await attempt(index);
    if (!result.retry) return result;
    lastReason = result.reason || lastReason;
  }
  throw new Error(
    'main moved during every bounded content-publish rebuild attempt' + (lastReason ? ': ' + lastReason : '.')
  );
}

export async function runContentPublishBatch(options = {}) {
  const cwd = options.cwd || process.cwd();
  const generate = options.generate || (() => git(cwd, ['status']));
  const verify = options.verify || (() => git(cwd, ['status']));
  const captureGolden = options.captureGolden || (() => git(cwd, ['status']));
  const generatedAllowlist = options.generatedAllowlist || GENERATED_ALLOWLIST;
  return runFreshAttempts(options.maxAttempts || 3, (attempt) =>
    oneAttempt({ cwd, generate, verify, captureGolden, generatedAllowlist, attempt })
  );
}

async function cli() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('content-publish-batch CLI mutates main and is restricted to GitHub Actions.');
  }
  const cwd = process.cwd();
  const run = (command, args) => () => execFileSync(command, args, { cwd, stdio: 'inherit' });
  const result = await runContentPublishBatch({
    cwd,
    generate: run(process.execPath, ['scripts/generate-content.mjs', '--write']),
    verify: run('npm', ['run', 'verify']),
    captureGolden: run(process.execPath, ['scripts/capture-content-golden.mjs'])
  });
  console.log(JSON.stringify({ status: result.status, sources: result.sources || [] }));
  if (result.status === 'reverted') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}
