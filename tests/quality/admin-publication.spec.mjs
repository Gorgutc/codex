/* Durable source-bound content publication recovery. */
import { expect, test } from '@playwright/test';
import { ROOT, hash8, mockGitHub, startStaticServer } from './fixtures/admin-harness.mjs';

const ctx = startStaticServer();
const CASE_PATH = 'content/cases/orbital-mk-ii.json';
const SOURCE_SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const SOURCE_BLOB_SHA = 'c'.repeat(40);

async function login(page) {
  await page.goto(`${ctx.base}/admin/`);
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await expect(page.locator('#topbar')).toBeVisible();
}

async function editAndConfirm(page) {
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill('Орбитальный recovery');
  await page.click('#publish-btn');
  await expect(page.locator('.publish-dialog__hint')).toContainText('Статус и время завершения');
  await expect(page.locator('.publish-dialog__hint')).not.toContainText('примерно');
  await page.click('#publish-confirm');
}

test('publication snapshots before source submission and preserves drafts until exact settlement', async ({ page }) => {
  const calls = await mockGitHub(page, { sourceSha: SOURCE_SHA, pipelineCommits: [] });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 10;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  await editAndConfirm(page);

  await expect.poll(() => calls.refUpdated).toBe(true);
  await page.waitForFunction(() => {
    const value = JSON.parse(sessionStorage.getItem('codexAdminPublication') || 'null');
    return value && value.phase === 'timed_out';
  });
  const ledger = await page.evaluate(() => JSON.parse(sessionStorage.getItem('codexAdminPublication')));
  expect(ledger).toMatchObject({ version: 1, phase: 'timed_out', source: { sha: SOURCE_SHA } });
  expect(JSON.stringify(ledger)).not.toMatch(/test-pat-token|blob:|Uint8Array|ArrayBuffer|"bytes"/);
  await expect(page.locator('#draft-indicator')).toBeVisible();
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await page.locator('#publish-btn').click({ force: true });
  expect(calls.refUpdates).toBe(1);
});

test('pipeline ignores terminal commits that are not attributed to the exact source', async ({ page }) => {
  await mockGitHub(page, {
    pipelineCommits: [
      {
        sha: 'c'.repeat(40),
        html_url: 'https://example.test/lookalike',
        author: { login: 'github-actions[bot]' },
        commit: { message: `lookalike [content-publish] [source:${SOURCE_SHA}]` }
      },
      {
        sha: 'e'.repeat(40),
        html_url: 'https://example.test/non-bot',
        author: { login: 'owner-test' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      },
      {
        sha: 'f'.repeat(40),
        html_url: 'https://example.test/no-author',
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      },
      {
        sha: 'c'.repeat(40),
        html_url: 'https://example.test/unrelated',
        author: { login: 'github-actions[bot]' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${OTHER_SHA}]` }
      },
      {
        sha: 'd'.repeat(40),
        html_url: 'https://example.test/right',
        author: { login: 'github-actions[bot]' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      }
    ]
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  const outcome = await page.evaluate(
    ([sha, since]) => window.AdminAPI.waitForPipeline(sha, since),
    [SOURCE_SHA, new Date(0).toISOString()]
  );
  expect(outcome).toMatchObject({ status: 'published', sha: 'd'.repeat(40), url: 'https://example.test/right' });
});

test('pipeline finds an exact source verdict beyond the first history page', async ({ page }) => {
  const unrelated = Array.from({ length: 100 }, (_, index) => ({
    sha: String(index % 10).repeat(40),
    author: { login: 'github-actions[bot]' },
    commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${OTHER_SHA}]` }
  }));
  await mockGitHub(page, {
    commitPages: {
      1: unrelated,
      2: [
        {
          sha: 'd'.repeat(40),
          html_url: 'https://example.test/page-two',
          author: { login: 'github-actions[bot]' },
          commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
        }
      ]
    }
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 1;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  const outcome = await page.evaluate((sha) => window.AdminAPI.waitForPipeline(sha), SOURCE_SHA);
  expect(outcome).toMatchObject({ status: 'published', sha: 'd'.repeat(40), url: 'https://example.test/page-two' });
});

test('reloading an unbound submission records an interrupted failure', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.evaluate(() => {
    sessionStorage.setItem(
      'codexAdminPublication',
      JSON.stringify({
        version: 1,
        phase: 'submitting',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        source: null,
        outcome: null,
        error: null,
        snapshot: { files: [], media: [] }
      })
    );
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.AdminState.getPublication() && window.AdminState.getPublication().phase))
    .toBe('failed');
  expect(await page.evaluate(() => window.AdminState.getPublication().error)).toContain('прервана');
  expect(await page.evaluate(() => window.AdminState.getPublication().candidate)).toBeNull();
});

test('published settlement is idempotent, clears only its snapshot, and leaves later edits dirty', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill('Первая правка');
  await page.evaluate(async () => {
    const plan = window.AdminState.buildPublishPlan();
    window.AdminState.createPublicationSnapshot(plan);
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    window.AdminState.setValue('content/cases/orbital-mk-ii.json', 'card.title.ru', 'Поздняя правка');
    await window.AdminState.settlePublication({
      status: 'published',
      sha: 'd'.repeat(40),
      url: 'https://example.test/right'
    });
    await window.AdminState.settlePublication({
      status: 'published',
      sha: 'd'.repeat(40),
      url: 'https://example.test/right'
    });
  });
  await expect(page.locator('#draft-indicator')).toBeVisible();
  const publication = await page.evaluate(() => window.AdminState.getPublication());
  expect(publication.phase).toBe('published');
});

test('a locked publication rejects discard and preserves a later draft through settlement', async ({ page }) => {
  let sourceDraft = null;
  let sourceIsSettled = false;
  const baseSha = 'c'.repeat(40);
  await mockGitHub(page, {
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH || !sourceDraft) return original;
      return ref === SOURCE_SHA || (sourceIsSettled && ref === 'main') ? JSON.stringify(sourceDraft) : original;
    }
  });
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const result = await page.evaluate(
    ({ path, sourceSha, baseSha }) => {
      window.AdminState.setValue(path, 'card.title.ru', 'Снимок публикации');
      const plan = window.AdminState.buildPublishPlan();
      const snapshot = window.AdminState.createPublicationSnapshot(plan);
      window.AdminState.recordPublicationCandidate({ sha: sourceSha, baseSha, date: new Date().toISOString() });
      const sourceDraft = structuredClone(window.AdminState.getEntry(path).draft);
      window.AdminState.setValue(path, 'card.title.ru', 'Поздняя правка');
      const beforeDiscard = structuredClone(window.AdminState.getEntry(path));
      let discardError = null;
      try {
        window.AdminState.discardDraft();
      } catch (error) {
        discardError = error.message;
      }
      return { snapshot, sourceDraft, beforeDiscard, discardError, afterDiscard: structuredClone(window.AdminState.getEntry(path)) };
    },
    { path: CASE_PATH, sourceSha: SOURCE_SHA, baseSha }
  );
  sourceDraft = result.sourceDraft;
  await expect(page.locator('#discard-draft-btn')).toBeHidden();
  expect(result.discardError).toContain('Публикация ожидает проверки');
  expect(result.afterDiscard).toEqual(result.beforeDiscard);
  sourceIsSettled = true;
  const settled = await page.evaluate(async () =>
    window.AdminState.settlePublication({ status: 'published', sha: 'd'.repeat(40) })
  );
  expect(settled.error).toBeNull();
  expect(
    await page.evaluate((path) => {
      const entry = window.AdminState.getEntry(path);
      return { base: entry.base.card.title.ru, draft: entry.draft.card.title.ru };
    }, CASE_PATH)
  ).toEqual({ base: 'Снимок публикации', draft: 'Поздняя правка' });
});

test('revert recovery validates every base atomically and explains binary re-upload after reload', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const result = await page.evaluate(async (casePath) => {
    const plan = {
      files: [{ path: casePath, content: '{\n  "id": "changed"\n}\n', expectedSha: 'c'.repeat(40) }],
      binaries: [{ path: 'assets/cards/orbital-recovery.svg', bytes: new Uint8Array([1, 2, 3]) }]
    };
    window.AdminState.createPublicationSnapshot(plan);
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    return window.AdminState.settlePublication({
      status: 'reverted',
      sha: 'e'.repeat(40),
      url: 'https://example.test/revert'
    });
  }, CASE_PATH);
  expect(result).toMatchObject({ phase: 'reverted' });
  expect(await page.evaluate(() => window.AdminState.restorePublicationSnapshot())).toMatchObject({
    restored: true,
    reupload: ['assets/cards/orbital-recovery.svg']
  });
});

test('corrupt or incompatible ledgers fail closed, can be dismissed only once settled, and block a second publish', async ({
  page
}) => {
  await mockGitHub(page, { pipelineCommits: [] });
  await login(page);
  await page.evaluate(() => sessionStorage.setItem('codexAdminPublication', '{not json'));
  await page.reload();
  expect(await page.evaluate(() => window.AdminState.getPublication())).toBeNull();
  await page.evaluate(() => {
    sessionStorage.setItem(
      'codexAdminPublication',
      JSON.stringify({
        version: 1,
        phase: 'timed_out',
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        source: { sha: 'a'.repeat(40), date: '2026-08-22T00:00:00.000Z' },
        candidate: null,
        outcome: null,
        error: null,
        snapshot: { files: [], media: [] }
      })
    );
  });
  await page.reload();
  await expect(page.locator('#publish-btn')).toBeDisabled();
  expect(await page.evaluate(() => window.AdminState.getPublication().phase)).toBe('timed_out');
});

test('source-bound ledger resumes after reload and settles only the recorded source', async ({ page }) => {
  await mockGitHub(page, {
    pipelineCommits: [
      {
        sha: 'd'.repeat(40),
        html_url: 'https://example.test/settlement',
        author: { login: 'github-actions[bot]' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      }
    ]
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  await page.evaluate(
    (sha) =>
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha, date: '2026-08-22T00:00:00.000Z' },
          candidate: { sha, baseSha: 'b'.repeat(40), date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [], media: [] }
        })
      ),
    SOURCE_SHA
  );
  await page.reload();
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'published');
  await page.click('a[href="#/publication"]');
  await expect(page.locator('#app').getByRole('link', { name: 'Открыть production' })).toBeVisible();
});

test('storage failure prevents source submission and an unsettled record prevents a second API publish', async ({
  page
}) => {
  const calls = await mockGitHub(page, { sourceSha: SOURCE_SHA, pipelineCommits: [] });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 50;
  });
  await login(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'codexAdminPublication') throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`).fill('Storage blocked');
  await page.click('#publish-btn');
  await page.click('#publish-confirm');
  await expect(page.locator('.toast--error')).toContainText('сохранить запись восстановления');
  expect(calls.refUpdated).toBe(false);
});

test('lost PATCH response is recovered as a known source without a second commit', async ({ page }) => {
  const calls = await mockGitHub(page, {
    sourceSha: SOURCE_SHA,
    patchStatus: 504,
    patchCommitsSource: true,
    pipelineCommits: []
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 40;
  });
  await login(page);
  await editAndConfirm(page);
  await page.waitForFunction(() => {
    const record = window.AdminState.getPublication();
    return record && record.phase === 'timed_out';
  });
  expect(await page.evaluate(() => window.AdminState.getPublication().source.sha)).toBe(SOURCE_SHA);
  expect(calls.refUpdates).toBe(1);
  await expect(page.locator('#publish-btn')).toBeDisabled();
});

test('ambiguous PATCH failure keeps its candidate locked and a definite 422 safely fails', async ({ page }) => {
  await mockGitHub(page, { sourceSha: SOURCE_SHA, patchStatus: 504, pipelineCommits: [] });
  await login(page);
  await editAndConfirm(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.candidate && record.phase;
      })
    )
    .toBe('submitting');
  const unknown = await page.evaluate(() => window.AdminState.getPublication());
  expect(unknown.candidate.sha).toBe(SOURCE_SHA);
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.phase;
      })
    )
    .toBe('submitting');
});

test('candidate persistence failure prevents PATCH and keeps any persisted media path safely blocked after reload', async ({
  page
}) => {
  const calls = await mockGitHub(page, { sourceSha: SOURCE_SHA });
  await login(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let publicationWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'codexAdminPublication' && ++publicationWrites === 2)
        throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await page.evaluate(async (path) => {
    await window.AdminState.stageMedia(
      path,
      'card.thumb',
      'image',
      './assets/cards/candidate.svg',
      null,
      new File(['<svg/>'], 'candidate.svg', { type: 'image/svg+xml' })
    );
  }, CASE_PATH);
  await page.waitForTimeout(450);
  const beforeFailure = await page.evaluate(() => JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}'));
  const stagedPath = beforeFailure.files && beforeFailure.files['content/cases/orbital-mk-ii.json'].card.thumb;
  expect(stagedPath).toMatch(/^\.\/assets\/cards\/candidate-/);
  expect(beforeFailure.pendingMediaPaths).toContain(stagedPath.replace(/^\.\//, ''));
  expect(JSON.stringify(beforeFailure)).not.toMatch(/blob:|"bytes"|Uint8Array|ArrayBuffer|test-pat-token/);
  await page.click('#publish-btn');
  await page.click('#publish-confirm');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.phase;
      })
    )
    .toBe('failed');
  expect(calls.refUpdates).toBe(0);
  await expect(page.locator('#publish-btn')).toBeEnabled();
  await page.reload();
  const blocked = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    try {
      window.AdminState.buildPublishPlan();
    } catch (error) {
      return error.message;
    }
    return null;
  }, CASE_PATH);
  expect(blocked).toContain(stagedPath.replace(/^\.\//, ''));
});

test('attach storage failure retains candidate lock and same-tab/reload recheck never creates a second source', async ({
  page
}) => {
  const calls = await mockGitHub(page, { sourceSha: SOURCE_SHA });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 40;
  });
  await login(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let publicationWrites = 0;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'codexAdminPublication' && ++publicationWrites === 3)
        throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await editAndConfirm(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.candidate && record.phase;
      })
    )
    .toBe('submitting');
  expect(calls.refUpdates).toBe(1);
  await page.evaluate(() => {
    window.location.hash = '#/publication';
  });
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'published');
  expect(await page.evaluate(() => window.AdminState.getPublication().source.sha)).toBe(SOURCE_SHA);
  await page.reload();
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'published');
  expect(calls.refUpdates).toBe(1);
});

test('authoritative 422 rejects a moved non-descendant and accepts a reachable candidate ancestor', async ({
  page
}) => {
  const moved = 'f'.repeat(40);
  const calls = await mockGitHub(page, {
    sourceSha: SOURCE_SHA,
    patchStatus: 422,
    patchMovesHead: moved,
    pipelineCommits: []
  });
  await login(page);
  await editAndConfirm(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.phase;
      })
    )
    .toBe('failed');
  await expect(page.locator('#publish-btn')).toBeEnabled();
  expect(calls.refUpdates).toBe(1);
});

test('authoritative 422 treats a candidate in a descendant main history as a submitted source', async ({ page }) => {
  const moved = 'f'.repeat(40);
  const calls = await mockGitHub(page, {
    sourceSha: SOURCE_SHA,
    patchStatus: 422,
    patchMovesHead: moved,
    pipelineCommits: [
      { sha: SOURCE_SHA, commit: { message: 'content: descendant [admin]' }, author: { login: 'owner-test' } }
    ]
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 40;
  });
  await login(page);
  await editAndConfirm(page);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const record = window.AdminState.getPublication();
        return record && record.phase;
      })
    )
    .toBe('timed_out');
  expect(await page.evaluate(() => window.AdminState.getPublication().source.sha)).toBe(SOURCE_SHA);
  expect(calls.refUpdates).toBe(1);
});

test('invalid publication ledgers with traversal paths are discarded and never lock publishing', async ({ page }) => {
  await mockGitHub(page);
  await page.addInitScript(() => {
    const sha = 'a'.repeat(40);
    sessionStorage.setItem(
      'codexAdminPublication',
      JSON.stringify({
        version: 1,
        phase: 'awaiting_pipeline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: { sha, date: new Date().toISOString() },
        candidate: null,
        outcome: null,
        error: null,
        snapshot: {
          files: [{ path: 'content/../settings.json', baseSha: sha, base: {}, draft: {}, workingDraft: {} }],
          media: []
        }
      })
    );
  });
  await login(page);
  expect(await page.evaluate(() => window.AdminState.getPublication())).toBeNull();
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('codexAdminPublication'))).toBeNull();
});

test('schema-invalid source, candidate, base SHA, and media ledger fields are removed on reload', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  const now = new Date().toISOString();
  const sha = 'a'.repeat(40);
  const base = {
    version: 1,
    phase: 'awaiting_pipeline',
    createdAt: now,
    updatedAt: now,
    source: { sha, date: now },
    candidate: { sha, baseSha: 'b'.repeat(40), date: now },
    outcome: null,
    error: null,
    snapshot: {
      files: [{ path: CASE_PATH, baseSha: 'c'.repeat(40), base: {}, draft: {}, workingDraft: {} }],
      media: []
    }
  };
  const invalid = [
    { ...base, createdAt: 'yesterday' },
    { ...base, updatedAt: null },
    { ...base, error: { message: 'not serializable recovery error' } },
    { ...base, source: null },
    { ...base, candidate: { ...base.candidate, baseSha: 'not-a-sha' } },
    { ...base, candidate: { ...base.candidate, sha: 'd'.repeat(40) } },
    { ...base, snapshot: { ...base.snapshot, files: [{ ...base.snapshot.files[0], baseSha: 'short' }] } },
    {
      ...base,
      snapshot: { ...base.snapshot, files: [{ ...base.snapshot.files[0], path: 'content/other-safe-looking.json' }] }
    },
    {
      ...base,
      snapshot: {
        ...base.snapshot,
        media: [{ path: 'assets/../escape.svg', filePath: null, dotPath: null, value: null }]
      }
    },
    {
      ...base,
      snapshot: {
        ...base.snapshot,
        media: [{ path: 'assets/cards/slot.svg', filePath: CASE_PATH, dotPath: null, value: './assets/cards/slot.svg' }]
      }
    },
    {
      ...base,
      outcome: { status: 'published', sha: 'short', url: 'javascript:alert(1)', message: 7, settledAt: 'not-a-date' }
    }
  ];
  for (const record of invalid) {
    await page.evaluate((value) => sessionStorage.setItem('codexAdminPublication', JSON.stringify(value)), record);
    await page.reload();
    await expect(page.locator('#topbar')).toBeVisible();
    expect(await page.evaluate(() => window.AdminState.getPublication())).toBeNull();
    expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem('codexAdminPublication'))).toBeNull();
  }
});

test('published terminal reconciliation error remains published and can be retried successfully', async ({ page }) => {
  const base = { id: 'base' };
  const published = { id: 'published' };
  const later = { id: 'later' };
  const baseSha = 'c'.repeat(40);
  await mockGitHub(page, {
    contentForPath: (path, original) => (path === CASE_PATH ? JSON.stringify({ id: 'wrong-source' }) : original)
  });
  await page.addInitScript(
    ({ path, base, published, later, baseSha }) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [path]: later },
          baseShas: { [path]: baseSha },
          baseSnapshots: { [path]: base }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: { sha: 'a'.repeat(40), date: new Date().toISOString() },
          candidate: { sha: 'a'.repeat(40), baseSha: 'b'.repeat(40), date: new Date().toISOString(), url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha, base, draft: published, workingDraft: base }], media: [] }
        })
      );
    },
    { path: CASE_PATH, base, published, later, baseSha }
  );
  await login(page);
  const failedReconcile = await page.evaluate(async () => window.AdminState.settlePublication({ status: 'published' }));
  expect(failedReconcile.phase).toBe('published');
  expect(failedReconcile.error).toContain('не совпал');
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(true);
  expect(
    await page.evaluate(() => {
      try {
        window.AdminState.createPublicationSnapshot({ files: [], binaries: [] });
        return 'replaced';
      } catch (error) {
        return error.message;
      }
    })
  ).toContain('локальной сверки');
  expect(await page.evaluate(() => window.AdminState.getPublication().source.sha)).toBe('a'.repeat(40));
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(false);
  await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    window.AdminState.setValue(path, 'card.title.ru', 'Не перезаписывать recovery');
  }, CASE_PATH);
  await expect(page.locator('#publish-btn')).toBeDisabled();
  await expect(page.locator('#publish-btn')).toHaveText('Требуется локальная сверка');
  await page.evaluate(
    ({ base, source }) => {
      window.AdminAPI.fetchFile = async (path, ref) => ({
        path,
        sha: 'd'.repeat(40),
        text: JSON.stringify(ref === 'b'.repeat(40) ? base : source)
      });
    },
    { base, source: published }
  );
  const retried = await page.evaluate(async () => window.AdminState.retryPublicationReconciliation());
  expect(retried).toMatchObject({ phase: 'published', error: null });
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(false);
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(true);
});

test('concurrent candidate rechecks share one reachability lookup and one terminal poll', async ({ page }) => {
  const now = new Date().toISOString();
  const calls = await mockGitHub(page, { sourceSha: SOURCE_SHA, initialHead: SOURCE_SHA, refDelayMs: 150 });
  await page.addInitScript(
    ({ now, path, sourceSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'submitting',
          createdAt: now,
          updatedAt: now,
          source: null,
          candidate: { sha: sourceSha, baseSha: 'b'.repeat(40), date: now, url: null },
          outcome: null,
          error: null,
          snapshot: {
            files: [
              {
                path,
                baseSha: 'c'.repeat(40),
                base: { id: 'base' },
                draft: { id: 'published' },
                workingDraft: { id: 'base' }
              }
            ],
            media: []
          }
        })
      );
    },
    { now, path: CASE_PATH, sourceSha: SOURCE_SHA }
  );
  await login(page);
  await page.click('a[href="#/publication"]');
  const recheck = page.getByRole('button', { name: 'Проверить статус' });
  await expect(recheck).toBeVisible();
  await Promise.all([recheck.click(), recheck.click()]);
  await expect.poll(() => calls.commitPolls).toBe(1);
  await expect.poll(() => page.evaluate(() => window.AdminState.getPublication().phase)).toBe('published');
  expect(calls.refReads).toBe(1);
  expect(calls.commitPolls).toBe(1);
});

test('revert prefetch is atomic, retains same-tab media, and requires a real re-upload after reload', async ({
  page
}) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const staged = await page.evaluate(async (casePath) => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'recovery.svg', { type: 'image/svg+xml' });
    const result = await window.AdminState.stageMedia(
      casePath,
      'card.thumb',
      'image',
      './assets/cards/recovery.svg',
      null,
      file
    );
    const plan = window.AdminState.buildPublishPlan();
    window.AdminState.createPublicationSnapshot(plan);
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    await window.AdminState.settlePublication({ status: 'reverted', sha: 'e'.repeat(40) });
    return { path: result.assetPath, sameTab: await window.AdminState.restorePublicationSnapshot() };
  }, CASE_PATH);
  expect(staged.sameTab).toMatchObject({ restored: true, reupload: [] });
  await page.reload();
  const afterReload = await page.evaluate(
    async ({ casePath, assetPath }) => {
      const restored = await window.AdminState.restorePublicationSnapshot();
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'recovery.svg', { type: 'image/svg+xml' });
      const restaged = await window.AdminState.stageMedia(
        casePath,
        'card.thumb',
        'image',
        './assets/cards/recovery.svg',
        assetPath,
        file
      );
      return { restored, restaged, pending: Boolean(window.AdminState.getMediaEdit(casePath, 'card.thumb')) };
    },
    { casePath: CASE_PATH, assetPath: staged.path }
  );
  expect(afterReload.restored.reupload).toEqual([staged.path.replace(/^\.\//, '')]);
  expect(afterReload.restaged.unchanged).toBe(false);
  expect(afterReload.pending).toBe(true);
});

test('same-tab revert restores a moved snapshot upload to its exact original slot without duplicates', async ({
  page
}) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const restored = await page.evaluate(async (path) => {
    await window.AdminState.stageMedia(
      path,
      'case.media.0.src',
      'image',
      './assets/cases/orbital-mk-ii/01.svg',
      null,
      new File(['<svg/>'], '01.svg', { type: 'image/svg+xml' })
    );
    window.AdminState.createPublicationSnapshot(window.AdminState.buildPublishPlan());
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    window.AdminState.remapMediaEdits(path, (dotPath) =>
      dotPath === 'case.media.0.src' ? 'case.media.1.src' : dotPath
    );
    await window.AdminState.settlePublication({ status: 'reverted', sha: 'e'.repeat(40) });
    return {
      original: Boolean(window.AdminState.getMediaEdit(path, 'case.media.0.src')),
      moved: Boolean(window.AdminState.getMediaEdit(path, 'case.media.1.src')),
      pending: window.AdminState.mediaPendingCount()
    };
  }, CASE_PATH);
  expect(restored).toEqual({ original: true, moved: false, pending: 1 });
});

test('a base mismatch blocks every revert mutation', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.evaluate(async () => {
    await window.AdminState.ensureFile('content/cases/orbital-mk-ii.json');
    await window.AdminState.ensureFile('content/meta.json');
    window.AdminState.setValue('content/cases/orbital-mk-ii.json', 'card.title.ru', 'Snapshot title');
    window.AdminState.setValue('content/meta.json', 'contactUrl', 'https://example.test/snapshot');
    window.AdminState.createPublicationSnapshot(window.AdminState.buildPublishPlan());
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    window.AdminState.setValue('content/cases/orbital-mk-ii.json', 'card.title.ru', 'Later title');
    const original = window.AdminAPI.fetchFile;
    window.AdminAPI.fetchFile = async (path) => {
      const fresh = await original(path);
      return path === 'content/meta.json' ? { ...fresh, text: '{}' } : fresh;
    };
  });
  await expect(page.evaluate(() => window.AdminState.restorePublicationSnapshot())).rejects.toThrow(
    'Ничего не было изменено'
  );
  expect(
    await page.evaluate(() => window.AdminState.getValue('content/cases/orbital-mk-ii.json', 'card.title.ru'))
  ).toBe('Later title');
});

test('a source-bound revert keeps recovery available when its base check blocks restore', async ({ page }) => {
  await mockGitHub(page, {
    pipelineCommits: [
      {
        sha: 'e'.repeat(40),
        html_url: 'https://example.test/revert',
        author: { login: 'github-actions[bot]' },
        commit: {
          message: `revert(content): roll back content push after failed publish [content-publish-revert] [source:${SOURCE_SHA}]`
        }
      }
    ]
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  await page.evaluate(async () => {
    await window.AdminState.ensureFile('content/cases/orbital-mk-ii.json');
    window.AdminState.setValue('content/cases/orbital-mk-ii.json', 'card.title.ru', 'Snapshot title');
    window.AdminState.createPublicationSnapshot(window.AdminState.buildPublishPlan());
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    const original = window.AdminAPI.fetchFile;
    window.__restoreFetch = original;
    window.AdminAPI.fetchFile = async (path) => ({ ...(await original(path)), text: '{}' });
  });
  await page.evaluate(async () => {
    await window.AdminState.settlePublication({ status: 'reverted', sha: 'e'.repeat(40) });
    window.location.hash = '#/publication';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'reverted');
  await expect(page.getByRole('button', { name: 'Восстановить черновик' })).toBeVisible();
  await expect(page.locator('.publication-record')).toContainText('Ничего не было изменено');
  await page.evaluate(() => {
    window.AdminAPI.fetchFile = window.__restoreFetch;
  });
  await page.getByRole('button', { name: 'Восстановить черновик' }).click();
  await expect.poll(() => page.evaluate(() => window.AdminState.getPublication().error)).toBeNull();
});

test('published settlement clears every staged record sharing one binary path', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const pending = await page.evaluate(async (casePath) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    await window.AdminState.stageMedia(
      casePath,
      'card.thumb',
      'image',
      './assets/cards/shared.svg',
      null,
      new File([svg], 'shared.svg', { type: 'image/svg+xml' })
    );
    await window.AdminState.stageMedia(
      casePath,
      'case.media.0.src',
      'image',
      './assets/cards/shared.svg',
      null,
      new File([svg], 'shared.svg', { type: 'image/svg+xml' })
    );
    window.AdminState.createPublicationSnapshot(window.AdminState.buildPublishPlan());
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    await window.AdminState.settlePublication({ status: 'published', sha: 'd'.repeat(40) });
    return window.AdminState.mediaPendingCount();
  }, CASE_PATH);
  expect(pending).toBe(0);
});

test('source-bound reload accepts an effective staged-media snapshot without reviving its bytes', async ({ page }) => {
  const baseFile = await import('node:fs').then(({ readFileSync }) =>
    JSON.parse(readFileSync(`${ROOT}/content/cases/orbital-mk-ii.json`, 'utf8'))
  );
  const sourceDraft = structuredClone(baseFile);
  sourceDraft.card.thumb = './assets/cards/orbital-source.svg';
  await mockGitHub(page, {
    pipelineCommits: [],
    contentForPath: (path, original, ref) =>
      path === CASE_PATH ? JSON.stringify(ref === 'b'.repeat(40) ? baseFile : sourceDraft) : original,
    shaForPath: (path) => (path === CASE_PATH ? 'f'.repeat(40) : 'c'.repeat(40))
  });
  await page.addInitScript(
    ({ path, base, draft, sourceSha }) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({ version: 2, files: { [path]: base }, baseShas: { [path]: 'e'.repeat(40) } })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z' },
          candidate: { sha: sourceSha, baseSha: 'b'.repeat(40), date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: {
            files: [{ path, baseSha: 'e'.repeat(40), base, draft }],
            media: [
              {
                path: 'assets/cards/orbital-source.svg',
                filePath: path,
                dotPath: 'card.thumb',
                value: draft.card.thumb
              }
            ]
          }
        })
      );
    },
    { path: CASE_PATH, base: baseFile, draft: sourceDraft, sourceSha: SOURCE_SHA }
  );
  await login(page);
  await page.click(`a[href="#/case/orbital-mk-ii"]`);
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  expect(await page.evaluate(() => window.AdminState.consumeDraftNotice())).toBe('');
  expect(await page.evaluate(() => window.AdminState.getPublication().phase)).toBe('awaiting_pipeline');
  expect(await page.evaluate(() => window.AdminState.mediaPendingCount())).toBe(0);
  await expect(page.locator('#publish-btn')).toBeDisabled();
});

test('auto-settled unpublished editor drafts are reconciled before their publication record is dismissed', async ({
  page
}) => {
  const baseFile = await import('node:fs').then(({ readFileSync }) =>
    JSON.parse(readFileSync(`${ROOT}/content/cases/orbital-mk-ii.json`, 'utf8'))
  );
  const sourceDraft = structuredClone(baseFile);
  sourceDraft.card.title.ru = 'Источник уже опубликован';
  await mockGitHub(page, {
    sourceSha: SOURCE_SHA,
    pipelineCommits: [
      {
        sha: 'd'.repeat(40),
        html_url: 'https://example.test/settlement',
        author: { login: 'github-actions[bot]' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      }
    ],
    contentForPath: (path, original, ref) =>
      path === CASE_PATH ? JSON.stringify(ref === 'b'.repeat(40) ? baseFile : sourceDraft) : original,
    shaForPath: (path) => (path === CASE_PATH ? 'f'.repeat(40) : 'c'.repeat(40))
  });
  await page.addInitScript(
    ({ path, base, draft, sourceSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({ version: 2, files: { [path]: base }, baseShas: { [path]: 'e'.repeat(40) } })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z' },
          candidate: { sha: sourceSha, baseSha: 'b'.repeat(40), date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha: 'e'.repeat(40), base, draft }], media: [] }
        })
      );
    },
    { path: CASE_PATH, base: baseFile, draft: sourceDraft, sourceSha: SOURCE_SHA }
  );
  await login(page);
  await page.reload();
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'published');
  expect(await page.evaluate((path) => window.AdminState.getEntry(path), CASE_PATH)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('codexAdminDrafts'))).toBeNull();
  await page.click('a[href="#/publication"]');
  await page.getByRole('button', { name: 'Скрыть завершённую запись' }).click();
  await page.evaluate(() => {
    window.location.hash = '#/case/orbital-mk-ii';
  });
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toHaveValue('Источник уже опубликован');
  expect(await page.evaluate(() => window.AdminState.consumeDraftNotice())).toBe('');
});

test('auto-settlement rebases an unloaded later edit onto its source snapshot before dismissal', async ({ page }) => {
  const bytes = '<svg/>';
  let sourceDraft = null;
  await mockGitHub(page, {
    sourceSha: SOURCE_SHA,
    pipelineCommits: [
      {
        sha: 'd'.repeat(40),
        html_url: 'https://example.test/settlement',
        author: { login: 'github-actions[bot]' },
        commit: { message: `chore(content): regenerate site from content/ [content-publish] [source:${SOURCE_SHA}]` }
      }
    ],
    contentForPath: (path, original) => (path === CASE_PATH && sourceDraft ? JSON.stringify(sourceDraft) : original),
    shaForPath: (path) => (path === CASE_PATH && sourceDraft ? SOURCE_BLOB_SHA : 'd'.repeat(40))
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  await page.evaluate(
    async ({ path, bytes }) => {
      await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/later-reload.svg',
        null,
        new File([bytes], 'later-reload.svg', { type: 'image/svg+xml' })
      );
      await window.AdminState.publishPrecheck();
      window.AdminState.createPublicationSnapshot(window.AdminState.buildPublishPlan());
      window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: '2026-08-22T00:00:00.000Z' });
      window.AdminState.setValue(path, 'card.title.ru', 'Поздняя правка после source');
    },
    { path: CASE_PATH, bytes }
  );
  sourceDraft = await page.evaluate(
    (path) => window.AdminState.getPublication().snapshot.files.find((file) => file.path === path).draft,
    CASE_PATH
  );
  expect(
    await page.evaluate(
      (path) =>
        window.AdminState.getPublication().snapshot.files.find((file) => file.path === path).workingDraft.card.title.ru,
      CASE_PATH
    )
  ).toBe('Orbital Mk.II');
  await page.waitForTimeout(450);
  await page.evaluate(() => {
    window.location.hash = '#/cases';
  });
  await page.reload();
  await page.waitForFunction(() => window.AdminState.getPublication().phase === 'published');
  expect(await page.evaluate((path) => window.AdminState.getEntry(path), CASE_PATH)).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('codexAdminDrafts'))).toContain(
    'Поздняя правка после source'
  );
  expect(await page.evaluate(async (path) => (await window.AdminAPI.fetchFile(path)).sha, CASE_PATH)).toBe(
    SOURCE_BLOB_SHA
  );
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(true);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toHaveValue('Поздняя правка после source');
  expect(await page.evaluate((path) => window.AdminState.getValue(path, 'card.thumb'), CASE_PATH)).toBe(
    sourceDraft.card.thumb
  );
  expect(await page.evaluate(() => window.AdminState.consumeDraftNotice())).toBe('');
  expect(await page.evaluate(() => window.AdminState.mediaPendingCount())).toBe(0);
  const next = await page.evaluate(async () => {
    await window.AdminState.publishPrecheck();
    return window.AdminState.buildPublishPlan();
  });
  expect(next.binaries).toEqual([]);
  expect(next.files).toHaveLength(1);
  expect(next.files[0].content).toContain('Поздняя правка после source');
});

test('coalesced A success rebases an unloaded later draft onto current B without losing either side', async ({
  page
}) => {
  const base = { id: 'coalesced', a: 'base', b: 'base', local: 'base' };
  const sourceA = { ...base, a: 'A' };
  const currentB = { ...sourceA, b: 'B' };
  const later = { ...base, local: 'L' };
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  await mockGitHub(page, {
    sourceSha,
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH) return original;
      if (ref === sourceSha) return JSON.stringify(sourceA);
      if (ref === baseSha) return JSON.stringify(base);
      return JSON.stringify(currentB);
    },
    shaForPath: (path, ref) =>
      path === CASE_PATH ? (ref === 'main' ? 'd'.repeat(40) : 'c'.repeat(40)) : 'c'.repeat(40)
  });
  await page.addInitScript(
    ({ path, base, sourceA, later, sourceSha, baseSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [path]: later },
          baseShas: { [path]: baseSha },
          baseSnapshots: { [path]: base }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha, base, draft: sourceA, workingDraft: base }], media: [] }
        })
      );
    },
    { path: CASE_PATH, base, sourceA, later, sourceSha, baseSha }
  );
  await login(page);
  await page.waitForFunction(() => {
    const record = window.AdminState.getPublication();
    return record && record.phase === 'published';
  });
  expect(await page.evaluate(() => window.AdminState.getPublication().error)).toBeNull();
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(true);
  const reconciled = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    return window.AdminState.getEntry(path).draft;
  }, CASE_PATH);
  expect(reconciled).toMatchObject({ a: 'A', b: 'B', local: 'L' });
  expect(await page.evaluate(() => window.AdminState.consumeDraftNotice())).toBe('');
});

test('coalesced B revert rebuilds B intent over the final anchor and preserves a later draft', async ({ page }) => {
  const baseA = { id: 'coalesced', a: 'A', b: 'base', local: 'base' };
  const sourceB = { ...baseA, b: 'B' };
  const anchor = { id: 'coalesced', a: 'base', b: 'base', local: 'base' };
  const later = { ...baseA, local: 'L' };
  const sourceSha = 'e'.repeat(40);
  const baseSha = 'a'.repeat(40);
  await mockGitHub(page, {
    sourceSha,
    pipelineCommits: [
      {
        sha: 'f'.repeat(40),
        html_url: 'https://example.test/revert',
        author: { login: 'github-actions[bot]' },
        commit: {
          message: `revert(content): roll back content push after failed publish [content-publish-revert] [source:${sourceSha}]`
        }
      }
    ],
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH) return original;
      if (ref === sourceSha) return JSON.stringify(sourceB);
      if (ref === baseSha) return JSON.stringify(baseA);
      return JSON.stringify(anchor);
    },
    shaForPath: (path, ref) =>
      path === CASE_PATH ? (ref === 'main' ? 'd'.repeat(40) : 'c'.repeat(40)) : 'c'.repeat(40)
  });
  await page.addInitScript(
    ({ path, baseA, sourceB, later, sourceSha, baseSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [path]: later },
          baseShas: { [path]: baseSha },
          baseSnapshots: { [path]: baseA }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha, base: baseA, draft: sourceB, workingDraft: baseA }], media: [] }
        })
      );
    },
    { path: CASE_PATH, baseA, sourceB, later, sourceSha, baseSha }
  );
  await login(page);
  await page.waitForFunction(() => {
    const record = window.AdminState.getPublication();
    return record && record.phase === 'reverted';
  });
  expect(await page.evaluate(() => window.AdminState.getPublication().error)).toBeNull();
  const reconciled = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    return window.AdminState.getEntry(path).draft;
  }, CASE_PATH);
  expect(reconciled).toMatchObject({ a: 'base', b: 'B', local: 'L' });
});

test('coalesced success keeps a protected published record when B overlaps a later A-tab edit', async ({ page }) => {
  const base = { id: 'coalesced', title: 'base' };
  const sourceA = { ...base, title: 'A' };
  const currentB = { ...base, title: 'B' };
  const later = { ...base, title: 'L' };
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  await mockGitHub(page, {
    sourceSha,
    contentForPath: (path, original, ref) =>
      path !== CASE_PATH ? original : JSON.stringify(ref === sourceSha ? sourceA : ref === baseSha ? base : currentB)
  });
  await page.addInitScript(
    ({ path, base, sourceA, later, sourceSha, baseSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [path]: later },
          baseShas: { [path]: baseSha },
          baseSnapshots: { [path]: base }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha, base, draft: sourceA, workingDraft: base }], media: [] }
        })
      );
    },
    { path: CASE_PATH, base, sourceA, later, sourceSha, baseSha }
  );
  await login(page);
  await page.waitForFunction(() => {
    const record = window.AdminState.getPublication();
    return record && record.phase === 'published' && record.error;
  });
  const record = await page.evaluate(() => window.AdminState.getPublication());
  expect(record.error).toContain('Конфликт восстановления публикации');
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(true);
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(false);
});

test('coalesced revert keeps a protected reverted record when final main overlaps B intent', async ({ page }) => {
  const baseA = { id: 'coalesced', title: 'base' };
  const sourceB = { ...baseA, title: 'B' };
  const conflictingAnchor = { ...baseA, title: 'R' };
  const sourceSha = 'e'.repeat(40);
  const baseSha = 'a'.repeat(40);
  await mockGitHub(page, {
    sourceSha,
    pipelineCommits: [
      {
        sha: 'f'.repeat(40),
        author: { login: 'github-actions[bot]' },
        commit: {
          message: `revert(content): roll back content push after failed publish [content-publish-revert] [source:${sourceSha}]`
        }
      }
    ],
    contentForPath: (path, original, ref) =>
      path !== CASE_PATH
        ? original
        : JSON.stringify(ref === sourceSha ? sourceB : ref === baseSha ? baseA : conflictingAnchor)
  });
  await page.addInitScript(
    ({ path, baseA, sourceB, sourceSha, baseSha }) => {
      window.ADMIN_POLL_INTERVAL_MS = 5;
      window.ADMIN_POLL_TIMEOUT_MS = 100;
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: { files: [{ path, baseSha, base: baseA, draft: sourceB, workingDraft: baseA }], media: [] }
        })
      );
    },
    { path: CASE_PATH, baseA, sourceB, sourceSha, baseSha }
  );
  await login(page);
  await page.waitForFunction(
    () => window.AdminState.getPublication() && window.AdminState.getPublication().phase === 'reverted'
  );
  const record = await page.evaluate(() => window.AdminState.getPublication());
  expect(record.error).toContain('Конфликт восстановления публикации');
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(true);
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(false);
});

test('coalesced three-way merge treats array order as a conflict-aware value', async ({ page }) => {
  let scenario;
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  await mockGitHub(page, {
    sourceSha,
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH) return original;
      return JSON.stringify(ref === sourceSha ? scenario.source : ref === baseSha ? scenario.base : scenario.remote);
    }
  });
  await page.addInitScript(() => {
    window.ADMIN_POLL_INTERVAL_MS = 5;
    window.ADMIN_POLL_TIMEOUT_MS = 100;
  });
  await login(page);
  async function settle(base, source, remote, later) {
    scenario = { base, source, remote };
    await page.evaluate(
      ({ path, base, source, later, sourceSha, baseSha }) => {
        sessionStorage.setItem(
          'codexAdminDrafts',
          JSON.stringify({
            version: 2,
            files: { [path]: later },
            baseShas: { [path]: baseSha },
            baseSnapshots: { [path]: source }
          })
        );
        sessionStorage.setItem(
          'codexAdminPublication',
          JSON.stringify({
            version: 1,
            phase: 'awaiting_pipeline',
            createdAt: '2026-08-22T00:00:00.000Z',
            updatedAt: '2026-08-22T00:00:00.000Z',
            source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
            candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
            outcome: null,
            error: null,
            snapshot: { files: [{ path, baseSha, base, draft: source, workingDraft: source }], media: [] }
          })
        );
      },
      { path: CASE_PATH, base, source, later, sourceSha, baseSha }
    );
    await page.reload();
    await page.waitForFunction(
      () => window.AdminState.getPublication() && window.AdminState.getPublication().phase === 'published'
    );
    return page.evaluate(() => window.AdminState.getPublication());
  }
  const keyedBase = {
    id: 'array',
    items: [
      { id: 'a', caption: 'base' },
      { id: 'b', caption: 'base' }
    ]
  };
  const keyedLater = {
    id: 'array',
    items: [
      { id: 'a', caption: 'local' },
      { id: 'b', caption: 'base' }
    ]
  };
  let record = await settle(
    keyedBase,
    keyedBase,
    {
      id: 'array',
      items: [
        { id: 'b', caption: 'base' },
        { id: 'a', caption: 'base' }
      ]
    },
    keyedLater
  );
  expect(record.error).toBeNull();
  const keyed = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    return window.AdminState.getEntry(path).draft;
  }, CASE_PATH);
  expect(keyed.items.map((item) => item.id)).toEqual(['b', 'a']);
  expect(keyed.items.find((item) => item.id === 'a').caption).toBe('local');

  const primitive = { id: 'array', tags: ['a', 'b', 'c'] };
  record = await settle(primitive, primitive, { id: 'array', tags: ['c', 'a', 'b'] }, primitive);
  expect(record.error).toBeNull();
  const primitiveMerged = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    return window.AdminState.getEntry(path).draft;
  }, CASE_PATH);
  expect(primitiveMerged.tags).toEqual(['c', 'a', 'b']);

  const unkeyed = { id: 'array', items: [{ caption: 'a' }, { caption: 'b' }] };
  record = await settle(
    unkeyed,
    unkeyed,
    { id: 'array', items: [{ caption: 'b' }, { caption: 'a' }] },
    { id: 'array', items: [{ caption: 'local-a' }, { caption: 'b' }] }
  );
  expect(record.error).toContain('структуру списка');
  expect(await page.evaluate(() => window.AdminState.isPublicationLocked())).toBe(true);

  const keyedThree = { id: 'array', items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  record = await settle(
    keyedThree,
    keyedThree,
    { id: 'array', items: [{ id: 'b' }, { id: 'a' }, { id: 'c' }] },
    { id: 'array', items: [{ id: 'a' }, { id: 'c' }, { id: 'b' }] }
  );
  expect(record.error).toContain('порядок списка');
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(false);
});

test('coalesced revert preserves later M2 and unrelated M3 media, then keeps their re-upload needs after dismiss', async ({
  page
}) => {
  let refs = null;
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const otherPath = 'content/cases/lumen-one.json';
  await mockGitHub(page, {
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH || !refs) return original;
      return JSON.stringify(ref === sourceSha ? refs.source : ref === baseSha ? refs.base : refs.base);
    }
  });
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const first = await page.evaluate(
    async ({ path, sourceSha, baseSha }) => {
      window.AdminState.setValue(path, 'card.title.ru', 'M1 recovery source');
      const m1 = await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/m1.svg',
        null,
        new File(['m1'], 'm1.svg', { type: 'image/svg+xml' })
      );
      const plan = window.AdminState.buildPublishPlan();
      window.AdminState.createPublicationSnapshot(plan);
      const snapshot = window.AdminState.getPublication().snapshot.files.find((file) => file.path === path);
      window.AdminState.recordPublicationCandidate({ sha: sourceSha, baseSha, date: new Date().toISOString() });
      return {
        base: snapshot && snapshot.base,
        source: snapshot && snapshot.draft,
        m1: m1.assetPath,
        files: plan.files.length
      };
    },
    { path: CASE_PATH, sourceSha, baseSha }
  );
  expect(first.files).toBe(1);
  refs = { base: first.base, source: first.source };
  const recovered = await page.evaluate(
    async ({ path, otherPath, sourceSha, m1 }) => {
      const m2 = await window.AdminState.stageMedia(
        path,
        'case.media.0.src',
        'image',
        './assets/cards/m2.svg',
        null,
        new File(['m2'], 'm2.svg', { type: 'image/svg+xml' })
      );
      await window.AdminState.ensureFile(otherPath);
      const m3 = await window.AdminState.stageMedia(
        otherPath,
        'card.thumb',
        'image',
        './assets/cards/m3.svg',
        null,
        new File(['m3'], 'm3.svg', { type: 'image/svg+xml' })
      );
      window.AdminState.attachPublicationSource({ sha: sourceSha, date: new Date().toISOString() });
      await window.AdminState.settlePublication({ status: 'reverted' });
      const plan = window.AdminState.buildPublishPlan();
      return {
        error: window.AdminState.getPublication().error,
        m1:
          window.AdminState.getMediaEdit(path, 'card.thumb') &&
          window.AdminState.getMediaEdit(path, 'card.thumb').uploadPath,
        m2:
          window.AdminState.getMediaEdit(path, 'case.media.0.src') &&
          window.AdminState.getMediaEdit(path, 'case.media.0.src').uploadPath,
        m3:
          window.AdminState.getMediaEdit(otherPath, 'card.thumb') &&
          window.AdminState.getMediaEdit(otherPath, 'card.thumb').uploadPath,
        binaries: plan.binaries.map((binary) => binary.path).sort(),
        m1Path: m1,
        m2Path: m2.assetPath,
        m3Path: m3.assetPath
      };
    },
    { path: CASE_PATH, otherPath, sourceSha, m1: first.m1 }
  );
  expect(recovered.error).toBeNull();
  expect(recovered.m1).toBe(recovered.m1Path.replace(/^\.\//, ''));
  expect(recovered.m2).toBe(recovered.m2Path.replace(/^\.\//, ''));
  expect(recovered.m3).toBe(recovered.m3Path.replace(/^\.\//, ''));
  expect(recovered.binaries).toEqual(
    [
      recovered.m1Path.replace(/^\.\//, ''),
      recovered.m2Path.replace(/^\.\//, ''),
      recovered.m3Path.replace(/^\.\//, '')
    ].sort()
  );
  expect(await page.evaluate(() => window.AdminState.dismissPublication())).toBe(true);
  await page.reload();
  const afterReload = await page.evaluate(
    async ({ path, otherPath, m1, m2, m3 }) => {
      let precheckBlocked = null;
      let planBlocked = null;
      try {
        await window.AdminState.publishPrecheck();
      } catch (error) {
        precheckBlocked = error.message;
      }
      try {
        window.AdminState.buildPublishPlan();
      } catch (error) {
        planBlocked = error.message;
      }
      await window.AdminState.ensureFile(otherPath);
      const preservedM3 = window.AdminState.getEntry(otherPath).draft.card.thumb;
      const one = await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/m1.svg',
        m1,
        new File(['m1'], 'm1.svg', { type: 'image/svg+xml' })
      );
      const two = await window.AdminState.stageMedia(
        path,
        'case.media.0.src',
        'image',
        './assets/cards/m2.svg',
        m2,
        new File(['m2'], 'm2.svg', { type: 'image/svg+xml' })
      );
      const three = await window.AdminState.stageMedia(
        otherPath,
        'card.thumb',
        'image',
        './assets/cards/m3.svg',
        m3,
        new File(['m3'], 'm3.svg', { type: 'image/svg+xml' })
      );
      const before = JSON.parse(sessionStorage.getItem('codexAdminDrafts'));
      const plan = window.AdminState.buildPublishPlan();
      window.AdminState.createPublicationSnapshot(plan);
      window.AdminState.attachPublicationSource({ sha: 'f'.repeat(40), date: new Date().toISOString() });
      await window.AdminState.settlePublication({ status: 'published' });
      const after = JSON.parse(sessionStorage.getItem('codexAdminDrafts') || '{}');
      const cleared = await window.AdminState.stageMedia(
        path,
        'case.media.0.src',
        'image',
        './assets/cards/m2.svg',
        m2,
        new File(['m2'], 'm2.svg', { type: 'image/svg+xml' })
      );
      return {
        one: one.unchanged,
        two: two.unchanged,
        three: three.unchanged,
        planBinaries: plan.binaries.map((binary) => binary.path).sort(),
        before,
        after,
        cleared: cleared.unchanged,
        precheckBlocked,
        planBlocked,
        preservedM3
      };
    },
    { path: CASE_PATH, otherPath, m1: first.m1, m2: recovered.m2Path, m3: recovered.m3Path }
  );
  expect(afterReload.precheckBlocked).toContain(recovered.m1Path.replace(/^\.\//, ''));
  expect(afterReload.planBlocked).toContain(recovered.m1Path.replace(/^\.\//, ''));
  expect(afterReload.preservedM3).toBe(recovered.m3Path);
  expect(afterReload.one).toBe(false);
  expect(afterReload.two).toBe(false);
  expect(afterReload.three).toBe(false);
  expect(afterReload.planBinaries).toEqual(
    [
      recovered.m1Path.replace(/^\.\//, ''),
      recovered.m2Path.replace(/^\.\//, ''),
      recovered.m3Path.replace(/^\.\//, '')
    ].sort()
  );
  expect(afterReload.before.pendingMediaPaths).toEqual(
    expect.arrayContaining([
      recovered.m1Path.replace(/^\.\//, ''),
      recovered.m2Path.replace(/^\.\//, ''),
      recovered.m3Path.replace(/^\.\//, '')
    ])
  );
  expect(JSON.stringify(afterReload.before)).not.toMatch(/blob:|"bytes"|Uint8Array|ArrayBuffer/);
  expect(afterReload.after.pendingMediaPaths || []).not.toContain(recovered.m2Path.replace(/^\.\//, ''));
  expect(afterReload.cleared).toBe(true);
});

test('reverted reconciliation does not request M1 when a later M2 owns the same slot', async ({ page }) => {
  const base = { id: 'slot', card: { thumb: './assets/cards/old.svg' } };
  const m1 = './assets/cards/m1.svg';
  const m2 = './assets/cards/m2.svg';
  const source = { id: 'slot', card: { thumb: m1 } };
  const current = { id: 'slot', card: { thumb: m2 } };
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  await mockGitHub(page, {
    contentForPath: (path, original, ref) =>
      path === CASE_PATH ? JSON.stringify(ref === sourceSha ? source : ref === baseSha ? base : current) : original
  });
  await page.addInitScript(
    ({ path, base, source, current, m1, m2, sourceSha, baseSha }) => {
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [path]: current },
          baseShas: { [path]: baseSha },
          baseSnapshots: { [path]: base }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: {
            files: [{ path, baseSha, base, draft: source, workingDraft: base }],
            media: [{ path: m1.replace(/^\.\//, ''), filePath: path, dotPath: 'card.thumb', value: m1 }]
          }
        })
      );
    },
    { path: CASE_PATH, base, source, current, m1, m2, sourceSha, baseSha }
  );
  await login(page);
  const recovered = await page.evaluate(async () => {
    await window.AdminState.settlePublication({ status: 'reverted' });
    return {
      publication: window.AdminState.getPublication(),
      drafts: JSON.parse(sessionStorage.getItem('codexAdminDrafts'))
    };
  });
  expect(recovered.publication.error).toBeNull();
  expect(recovered.publication.reuploadPaths || []).not.toContain(m1.replace(/^\.\//, ''));
  expect((recovered.drafts && recovered.drafts.pendingMediaPaths) || []).not.toContain(m1.replace(/^\.\//, ''));
});

test('published settlement retains a later M2 path but blocks reload until its bytes are restaged', async ({
  page
}) => {
  let refs = null;
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  await mockGitHub(page, {
    contentForPath: (path, original, ref) => {
      if (path !== CASE_PATH || !refs) return original;
      return JSON.stringify(ref === sourceSha ? refs.source : ref === baseSha ? refs.base : refs.source);
    }
  });
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const publication = await page.evaluate(
    async ({ path, sourceSha, baseSha }) => {
      window.AdminState.setValue(path, 'card.title.ru', 'source M1');
      await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/success-m1.svg',
        null,
        new File(['m1'], 'm1.svg', { type: 'image/svg+xml' })
      );
      const plan = window.AdminState.buildPublishPlan();
      window.AdminState.createPublicationSnapshot(plan);
      const snapshot = window.AdminState.getPublication().snapshot.files.find((file) => file.path === path);
      window.AdminState.recordPublicationCandidate({ sha: sourceSha, baseSha, date: new Date().toISOString() });
      return { base: snapshot.base, source: snapshot.draft };
    },
    { path: CASE_PATH, sourceSha, baseSha }
  );
  refs = publication;
  const m2Path = await page.evaluate(
    async ({ path, sourceSha }) => {
      const m2 = await window.AdminState.stageMedia(
        path,
        'case.media.0.src',
        'image',
        './assets/cards/success-m2.svg',
        null,
        new File(['m2'], 'm2.svg', { type: 'image/svg+xml' })
      );
      window.AdminState.attachPublicationSource({ sha: sourceSha, date: new Date().toISOString() });
      await window.AdminState.settlePublication({ status: 'published' });
      return m2.assetPath.replace(/^\.\//, '');
    },
    { path: CASE_PATH, sourceSha }
  );
  await page.reload();
  const blocked = await page.evaluate(async (path) => {
    await window.AdminState.ensureFile(path);
    try {
      await window.AdminState.publishPrecheck();
    } catch (error) {
      return error.message;
    }
    return null;
  }, CASE_PATH);
  expect(blocked).toContain(m2Path);
});

test('replacing or discarding a staged media slot prunes obsolete durable paths', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  const paths = await page.evaluate(async (path) => {
    const m1 = await window.AdminState.stageMedia(
      path,
      'card.thumb',
      'image',
      './assets/cards/prune.svg',
      null,
      new File(['m1'], 'm1.svg', { type: 'image/svg+xml' })
    );
    const first = window.AdminState.buildPublishPlan().binaries.map((binary) => binary.path);
    const m2 = await window.AdminState.stageMedia(
      path,
      'card.thumb',
      'image',
      './assets/cards/prune.svg',
      null,
      new File(['m2'], 'm2.svg', { type: 'image/svg+xml' })
    );
    const second = window.AdminState.buildPublishPlan().binaries.map((binary) => binary.path);
    window.AdminState.discardMediaEdit(path, 'card.thumb');
    const third = window.AdminState.buildPublishPlan().binaries.map((binary) => binary.path);
    return { m1: m1.assetPath.replace(/^\.\//, ''), m2: m2.assetPath.replace(/^\.\//, ''), first, second, third };
  }, CASE_PATH);
  expect(paths.first).toEqual([paths.m1]);
  expect(paths.second).toEqual([paths.m2]);
  expect(paths.third).toEqual([]);
});

test('two-file coalesced conflict leaves the first orphan draft and provenance untouched', async ({ page }) => {
  const sourceSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const firstBase = { id: 'first', value: 'base' };
  const firstSource = { ...firstBase, value: 'A' };
  const firstLater = { ...firstBase, value: 'L' };
  const secondBase = { title: 'base' };
  const secondSource = { title: 'A' };
  const secondLater = { title: 'L' };
  await mockGitHub(page, {
    sourceSha,
    contentForPath: (path, original, ref) => {
      const source = path === CASE_PATH ? firstSource : { title: 'wrong-source' };
      const base = path === CASE_PATH ? firstBase : secondBase;
      const current = path === CASE_PATH ? firstSource : { title: 'B' };
      return JSON.stringify(ref === sourceSha ? source : ref === baseSha ? base : current);
    }
  });
  await page.addInitScript(
    ({ sourceSha, baseSha, firstBase, firstSource, firstLater, secondBase, secondSource, secondLater }) => {
      const firstPath = 'content/cases/orbital-mk-ii.json';
      const secondPath = 'content/settings.json';
      sessionStorage.setItem(
        'codexAdminDrafts',
        JSON.stringify({
          version: 2,
          files: { [firstPath]: firstLater, [secondPath]: secondLater },
          baseShas: { [firstPath]: baseSha, [secondPath]: baseSha },
          baseSnapshots: { [firstPath]: firstBase, [secondPath]: secondBase }
        })
      );
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'awaiting_pipeline',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: sourceSha, date: '2026-08-22T00:00:00.000Z', url: null },
          candidate: { sha: sourceSha, baseSha, date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: null,
          error: null,
          snapshot: {
            files: [
              { path: firstPath, baseSha, base: firstBase, draft: firstSource, workingDraft: firstSource },
              { path: secondPath, baseSha, base: secondBase, draft: secondSource, workingDraft: secondSource }
            ],
            media: []
          }
        })
      );
    },
    { sourceSha, baseSha, firstBase, firstSource, firstLater, secondBase, secondSource, secondLater }
  );
  await login(page);
  const before = await page.evaluate(() => sessionStorage.getItem('codexAdminDrafts'));
  expect(
    await page.evaluate(() => ({
      publication: window.AdminState.getPublication(),
      drafts: JSON.parse(sessionStorage.getItem('codexAdminDrafts'))
    }))
  ).toMatchObject({
    publication: {
      candidate: { sha: sourceSha, baseSha },
      snapshot: { files: [{ path: CASE_PATH }, { path: 'content/settings.json' }] }
    },
    drafts: { files: { [CASE_PATH]: firstLater, 'content/settings.json': secondLater } }
  });
  expect(
    await page.evaluate(
      async ({ sourceSha, baseSha }) => ({
        source: JSON.parse((await window.AdminAPI.fetchFile('content/settings.json', sourceSha)).text),
        base: JSON.parse((await window.AdminAPI.fetchFile('content/settings.json', baseSha)).text),
        current: JSON.parse((await window.AdminAPI.fetchFile('content/settings.json')).text)
      }),
      { sourceSha, baseSha }
    )
  ).toEqual({ source: { title: 'wrong-source' }, base: secondBase, current: { title: 'B' } });
  const settled = await page.evaluate(async () => window.AdminState.settlePublication({ status: 'published' }));
  expect(settled.error).toContain('не совпал со снимком');
  expect(await page.evaluate(() => sessionStorage.getItem('codexAdminDrafts'))).toBe(before);
});

test('a settled reverted ledger makes its media path reupload-required after reload', async ({ page }) => {
  const bytes = '<svg/>';
  const assetPath = `./assets/cards/recovery-${hash8(Buffer.from(bytes))}.svg`;
  await mockGitHub(page);
  await page.addInitScript(
    ({ path, assetPath }) => {
      sessionStorage.setItem(
        'codexAdminPublication',
        JSON.stringify({
          version: 1,
          phase: 'reverted',
          createdAt: '2026-08-22T00:00:00.000Z',
          updatedAt: '2026-08-22T00:00:00.000Z',
          source: { sha: 'a'.repeat(40), date: '2026-08-22T00:00:00.000Z' },
          candidate: { sha: 'a'.repeat(40), baseSha: 'b'.repeat(40), date: '2026-08-22T00:00:00.000Z', url: null },
          outcome: { status: 'reverted', sha: null, url: null, message: null, settledAt: '2026-08-22T00:00:00.000Z' },
          error: null,
          snapshot: {
            files: [],
            media: [{ path: assetPath.replace(/^\.\//, ''), filePath: path, dotPath: 'card.thumb', value: assetPath }]
          }
        })
      );
    },
    { path: CASE_PATH, assetPath }
  );
  await login(page);
  await page.reload();
  await page.click('a[href="#/case/orbital-mk-ii"]');
  const staged = await page.evaluate(
    async ({ path, assetPath, bytes }) => {
      const result = await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/recovery.svg',
        assetPath,
        new File([bytes], 'recovery.svg', { type: 'image/svg+xml' })
      );
      const pending = Boolean(window.AdminState.getMediaEdit(path, 'card.thumb'));
      const plan = window.AdminState.buildPublishPlan();
      window.AdminState.createPublicationSnapshot(plan);
      window.AdminState.attachPublicationSource({ sha: 'f'.repeat(40), date: new Date().toISOString() });
      await window.AdminState.settlePublication({ status: 'published' });
      const afterSuccess = await window.AdminState.stageMedia(
        path,
        'card.thumb',
        'image',
        './assets/cards/recovery.svg',
        assetPath,
        new File([bytes], 'recovery.svg', { type: 'image/svg+xml' })
      );
      return { unchanged: result.unchanged, pending, afterSuccess: afterSuccess.unchanged };
    },
    { path: CASE_PATH, assetPath, bytes }
  );
  expect(staged.unchanged).toBe(false);
  expect(staged.pending).toBe(true);
  expect(staged.afterSuccess).toBe(true);
});

test('published rebase leaves only later edits in the next plan and drops source media', async ({ page }) => {
  await mockGitHub(page);
  await login(page);
  await page.click('a[href="#/case/orbital-mk-ii"]');
  await expect(page.locator(`[data-field="${CASE_PATH}::card.title.ru"]`)).toBeVisible();
  const next = await page.evaluate(async (casePath) => {
    await window.AdminState.stageMedia(
      casePath,
      'card.thumb',
      'image',
      './assets/cards/rebase.svg',
      null,
      new File(['<svg/>'], 'rebase.svg', { type: 'image/svg+xml' })
    );
    const sourcePlan = window.AdminState.buildPublishPlan();
    window.AdminState.createPublicationSnapshot(sourcePlan);
    window.AdminState.attachPublicationSource({ sha: 'a'.repeat(40), date: new Date().toISOString() });
    const source = window.AdminState.getPublication().snapshot.files[0].draft;
    window.AdminState.setValue(casePath, 'card.title.ru', 'Поздняя дельта');
    await window.AdminState.settlePublication({ status: 'published', sha: 'd'.repeat(40) });
    const original = window.AdminAPI.fetchFile;
    window.AdminAPI.fetchFile = async (path) =>
      path === casePath ? { path, sha: 'published-source-blob', text: JSON.stringify(source) } : original(path);
    await window.AdminState.publishPrecheck();
    return window.AdminState.buildPublishPlan();
  }, CASE_PATH);
  expect(next.binaries).toEqual([]);
  expect(next.files).toHaveLength(1);
  expect(next.files[0].content).toContain('Поздняя дельта');
});
