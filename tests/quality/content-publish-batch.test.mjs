import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyPushFailure,
  classifyRemoteHead,
  discoverUnresolvedSources,
  runContentPublishBatch,
  runFreshAttempts
} from '../../scripts/content-publish-batch.mjs';

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', ...options }).trim();
}

function write(cwd, rel, value) {
  const target = path.join(cwd, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function commit(cwd, message, files, author = 'Owner <owner@example.test>') {
  Object.entries(files).forEach(([rel, value]) => write(cwd, rel, value));
  git(cwd, ['add', ...Object.keys(files)]);
  git(cwd, [
    '-c',
    `user.name=${author.slice(0, author.indexOf(' <'))}`,
    '-c',
    `user.email=${author.match(/<(.+)>/)[1]}`,
    'commit',
    '-m',
    message
  ]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-content-publish-'));
  const origin = path.join(root, 'origin.git');
  const repo = path.join(root, 'repo');
  git(root, ['init', '--bare', origin]);
  git(root, ['clone', origin, repo]);
  git(repo, ['checkout', '-b', 'main']);
  commit(repo, 'initial', { 'content/value.json': '{"value":"base"}\n', 'docs/note.md': 'base\n' });
  git(repo, ['push', '-u', 'origin', 'main']);
  git(repo, [
    '-c',
    'user.name=github-actions[bot]',
    '-c',
    'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit',
    '--allow-empty',
    '-m',
    'chore(content): regenerate site from content/ [content-publish] [source:' + 'a'.repeat(40) + ']'
  ]);
  git(repo, ['push']);
  const first = commit(repo, 'content: first [admin]', { 'content/value.json': '{"value":"one"}\n' });
  commit(repo, 'docs: interleaved', { 'docs/note.md': 'keep me\n' });
  const second = commit(repo, 'assets: middle [admin]', { 'assets/cards/middle.svg': '<svg/>\n' });
  git(repo, ['checkout', '-b', 'merge-source']);
  commit(repo, 'content: merge source [admin]', { 'content/other.json': '{"value":"three"}\n' });
  git(repo, ['checkout', 'main']);
  commit(repo, 'docs: second interleaving', { 'docs/second.md': 'still keep me\n' });
  git(repo, ['merge', '--no-ff', 'merge-source', '-m', 'merge content source [admin]']);
  const third = git(repo, ['rev-parse', 'HEAD']);
  git(repo, [
    '-c',
    'user.name=Owner',
    '-c',
    'user.email=owner@example.test',
    'commit',
    '--allow-empty',
    '-m',
    'chore(content): regenerate site from content/ [content-publish] [source:' + 'b'.repeat(40) + ']'
  ]);
  git(repo, ['push']);
  return { root, origin, repo, sources: [first, second, third] };
}

const generatedAllowlist = [(rel) => rel === 'generated/site.txt'];

function subjects(cwd) {
  return git(cwd, ['log', '--first-parent', '--format=%s', '-n', '8']).split('\n');
}

test('discovers strict trusted anchor and every unresolved content/assets source oldest-first', () => {
  const { repo, sources } = fixture();
  const found = discoverUnresolvedSources({ cwd: repo, base: 'HEAD' });
  assert.deepEqual(
    found.map((item) => item.sha),
    sources
  );
});

test('unknown bot source is unresolved while only a trusted strict terminal commit is skipped', () => {
  const { repo, sources } = fixture();
  const unknown = commit(
    repo,
    'bot: hand-written assets change',
    { 'assets/cards/unknown.svg': '<svg/>\n' },
    'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>'
  );
  const found = discoverUnresolvedSources({ cwd: repo, base: 'HEAD' });
  assert.deepEqual(
    found.map((item) => item.sha),
    sources.concat(unknown)
  );
});

test('success emits one generated commit and ordered source markers while preserving interleaved docs', async () => {
  const { repo, sources } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => write(repo, 'generated/site.txt', 'generated\n'),
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'published', String(result.error));
  const log = subjects(repo);
  assert.equal(log[0], `chore(content): regenerate site from content/ [content-publish] [source:${sources[2]}]`);
  assert.equal(log[1], `chore(content): regenerate site from content/ [content-publish] [source:${sources[1]}]`);
  assert.equal(log[2], `chore(content): regenerate site from content/ [content-publish] [source:${sources[0]}]`);
  assert.equal(log[3], 'chore(content): regenerate site from content/ [content-publish]');
  assert.equal(fs.readFileSync(path.join(repo, 'docs/note.md'), 'utf8'), 'keep me\n');
});

test('golden capture changes are included in the final generated commit and push', async () => {
  const { repo } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => write(repo, 'generated/site.txt', 'generated\n'),
    verify: () => {},
    captureGolden: () => write(repo, 'tests/quality/fixtures/captured.txt', 'golden\n'),
    generatedAllowlist: [(rel) => rel === 'generated/site.txt' || rel.startsWith('tests/quality/fixtures/')]
  });
  assert.equal(result.status, 'published', String(result.error));
  assert.equal(git(repo, ['show', 'origin/main:tests/quality/fixtures/captured.txt']), 'golden');
  assert.equal(git(repo, ['status', '--porcelain']), '');
});

test('failure reverts every unresolved source, preserves interleaved docs, and emits ordered revert markers', async () => {
  const { repo, sources } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => {
      throw new Error('generator failed');
    },
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'reverted');
  const log = subjects(repo);
  assert.equal(
    log[0],
    `revert(content): roll back content push after failed publish [content-publish-revert] [source:${sources[2]}]`
  );
  assert.equal(
    log[1],
    `revert(content): roll back content push after failed publish [content-publish-revert] [source:${sources[1]}]`
  );
  assert.equal(
    log[2],
    `revert(content): roll back content push after failed publish [content-publish-revert] [source:${sources[0]}]`
  );
  assert.equal(log[3], 'revert(content): roll back content push after failed publish [content-publish-revert]');
  assert.equal(fs.readFileSync(path.join(repo, 'content/value.json'), 'utf8'), '{"value":"base"}\n');
  assert.equal(fs.existsSync(path.join(repo, 'content/other.json')), false);
  assert.equal(fs.existsSync(path.join(repo, 'assets/cards/middle.svg')), false);
  assert.equal(fs.readFileSync(path.join(repo, 'docs/note.md'), 'utf8'), 'keep me\n');
  assert.equal(fs.readFileSync(path.join(repo, 'docs/second.md'), 'utf8'), 'still keep me\n');
});

test('verification failure reverts the entire unresolved batch and leaves no generated output', async () => {
  const { repo } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => write(repo, 'generated/site.txt', 'generated before verify failure\n'),
    verify: () => {
      throw new Error('verification failed');
    },
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'reverted');
  assert.equal(fs.existsSync(path.join(repo, 'generated/site.txt')), false);
  assert.equal(
    subjects(repo)[3],
    'revert(content): roll back content push after failed publish [content-publish-revert]'
  );
});

test('unexpected generator output is rejected before it can be committed', async () => {
  const { repo } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => write(repo, 'playwright-report/leak.txt', 'must not commit\n'),
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'reverted');
  assert.equal(fs.existsSync(path.join(repo, 'playwright-report/leak.txt')), false);
  assert.equal(
    subjects(repo)[3],
    'revert(content): roll back content push after failed publish [content-publish-revert]'
  );
});

test('a staged unexpected generator output is rejected before a marker can commit it', async () => {
  const { repo } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => {
      write(repo, 'playwright-report/staged-leak.txt', 'must not commit\n');
      git(repo, ['add', 'playwright-report/staged-leak.txt']);
    },
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'reverted');
  assert.equal(fs.existsSync(path.join(repo, 'playwright-report/staged-leak.txt')), false);
  assert.equal(
    git(repo, ['ls-tree', '-r', '--name-only', 'origin/main']).includes('playwright-report/staged-leak.txt'),
    false
  );
});

test('push recovery only trusts an exact chain head and retries only after a moved base', () => {
  const base = 'a'.repeat(40);
  const chainHead = 'b'.repeat(40);
  assert.deepEqual(classifyRemoteHead(base, chainHead, chainHead), { status: 'confirmed' });
  assert.deepEqual(classifyRemoteHead(base, chainHead, 'c'.repeat(40)), {
    retry: true,
    reason: 'main moved during batch push'
  });
  assert.deepEqual(classifyRemoteHead(base, chainHead, base), {
    fatal: true,
    reason: 'push failed while origin/main still equals the checked base'
  });
});

test('push recovery confirms a remote descendant of the local chain after a lost response', () => {
  const { root, origin, repo } = fixture();
  const chainHead = git(repo, ['rev-parse', 'origin/main']);
  const other = path.join(root, 'push-race');
  git(root, ['clone', '-b', 'main', origin, other]);
  commit(other, 'docs: pushed after lost response', { 'docs/after-push.md': 'advanced\n' });
  git(other, ['push']);
  assert.deepEqual(classifyPushFailure(repo, chainHead, chainHead), { status: 'confirmed' });
});

test('net-zero failed sources still receive an allow-empty generic revert anchor and every marker', async () => {
  const { repo } = fixture();
  await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => {},
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  const first = commit(repo, 'content: net one [admin]', { 'content/value.json': '{"value":"temporary"}\n' });
  const second = commit(repo, 'content: net zero [admin]', { 'content/value.json': '{"value":"one"}\n' });
  git(repo, ['push', 'origin', 'HEAD:main']);
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => {
      throw new Error('verify failed');
    },
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'reverted');
  const log = subjects(repo);
  assert.equal(
    log[0],
    `revert(content): roll back content push after failed publish [content-publish-revert] [source:${second}]`
  );
  assert.equal(
    log[1],
    `revert(content): roll back content push after failed publish [content-publish-revert] [source:${first}]`
  );
  assert.equal(log[2], 'revert(content): roll back content push after failed publish [content-publish-revert]');
  assert.equal(fs.readFileSync(path.join(repo, 'content/value.json'), 'utf8'), '{"value":"one"}\n');
});

test('fresh-head retry helper discards a moved-head attempt and retries from a new base', async () => {
  let attempts = 0;
  const result = await runFreshAttempts(3, async () => {
    attempts += 1;
    return attempts === 1 ? { retry: true } : { status: 'published' };
  });
  assert.equal(attempts, 2);
  assert.deepEqual(result, { status: 'published' });
});

test('a real moved origin discards first generated output and rebuilds a widened source batch', async () => {
  const { root, origin, repo, sources } = fixture();
  const other = path.join(root, 'other');
  let generateRuns = 0;
  let widened = [];
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 3,
    generate: ({ attempt, sources: currentSources }) => {
      generateRuns += 1;
      write(repo, 'generated/site.txt', 'attempt-' + attempt + '\n');
      if (attempt === 1) {
        git(root, ['clone', '-b', 'main', origin, other]);
        const added = commit(other, 'content: raced [admin]', { 'content/raced.json': '{"race":true}\n' });
        git(other, ['push']);
        return added;
      }
      widened = currentSources.map((source) => source.sha);
      return null;
    },
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'published');
  assert.equal(generateRuns, 2);
  assert.equal(widened.length, 4);
  assert.deepEqual(widened.slice(0, 3), sources);
  assert.equal(fs.readFileSync(path.join(repo, 'generated/site.txt'), 'utf8'), 'attempt-2\n');
});

test('asset-only no-diff batch emits exact markers without a generic generated commit', async () => {
  const { repo, sources } = fixture();
  const result = await runContentPublishBatch({
    cwd: repo,
    maxAttempts: 1,
    generate: () => {},
    verify: () => {},
    captureGolden: () => {},
    generatedAllowlist
  });
  assert.equal(result.status, 'published');
  const log = subjects(repo);
  assert.equal(log[0], `chore(content): regenerate site from content/ [content-publish] [source:${sources[2]}]`);
  assert.equal(log.includes('chore(content): regenerate site from content/ [content-publish]'), false);
});
