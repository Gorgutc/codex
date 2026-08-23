import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { allCaseIds } from '../../scripts/content-expectations.mjs';
import { mockGitHub, startStaticServer } from './fixtures/admin-harness.mjs';

const server = startStaticServer();
const CASE_ID = allCaseIds(process.cwd())[0];
const CASE_PATH = 'content/cases/' + CASE_ID + '.json';
const SETTINGS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'settings.json'), 'utf8'));
const DISABLED_CASE_ID = allCaseIds(process.cwd()).find((id) => {
  const project = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'cases', id + '.json'), 'utf8'));
  const filter = SETTINGS.filters.find((entry) => entry.key === project.category);
  return id !== CASE_ID && (project.enabled === false || filter?.enabled === false);
});

async function login(page) {
  await mockGitHub(page);
  await page.goto(server.base + '/admin/');
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.locator('.case-row[data-case-id="' + CASE_ID + '"]').click();
}

test('case URL editor commits canonical route changes without input-prefix aliases', async ({ page }) => {
  await login(page);
  const id = page.locator('#case-public-url-section input[readonly]');
  const canonical = page.locator('#case-public-slug');
  const aliases = page.locator('#case-legacy-slugs');
  await expect(id).toHaveValue(CASE_ID);
  await expect(page.locator('#case-public-url')).toContainText('https://codex.promo/#' + CASE_ID);

  const first = 'public-' + CASE_ID;
  await canonical.pressSequentially(first);
  await expect(page.locator('#case-public-url')).toContainText('https://codex.promo/#' + first);
  await expect(aliases).toHaveValue('');
  await canonical.blur();
  await expect(aliases).toHaveValue('');

  await canonical.fill('');
  await canonical.blur();
  await expect(aliases).toHaveValue(first);
});

test('case URL editor retains one prior custom canonical slug when renamed', async ({ page }) => {
  await login(page);
  const canonical = page.locator('#case-public-slug');
  const aliases = page.locator('#case-legacy-slugs');
  const first = 'public-' + CASE_ID;
  const second = 'renamed-' + CASE_ID;
  await canonical.fill(first);
  await canonical.blur();
  await canonical.click();
  await canonical.press('ControlOrMeta+A');
  await canonical.pressSequentially(second);
  await canonical.blur();
  await expect(aliases).toHaveValue(first);
});

test('case URL editor anchors a cross-case alias collision on the edited route field', async ({ page }) => {
  await login(page);
  test.skip(!DISABLED_CASE_ID, 'requires a hidden or disabled case in the authored catalog');
  await page.locator('#case-legacy-slugs').fill(DISABLED_CASE_ID);
  await page.click('#publish-btn');
  await expect(page.locator('#case-public-url-section')).toContainText(/уже используется кейсом/);
  await expect(page.locator('#case-legacy-slugs')).toHaveClass(/field-invalid/);
});

test('slug editing is separate from CTA data and publishes only the case JSON', async ({ page }) => {
  await login(page);
  const before = await page.evaluate((casePath) => window.AdminState.getValue(casePath, 'case.cta'), CASE_PATH);
  await page.locator('#case-public-slug').fill('publish-' + CASE_ID);
  await page.locator('#case-public-slug').blur();
  const state = await page.evaluate((casePath) => ({
    cta: window.AdminState.getValue(casePath, 'case.cta'),
    plan: window.AdminState.buildPublishPlan()
  }), CASE_PATH);
  expect(state.cta).toEqual(before);
  expect(state.plan.binaries).toEqual([]);
  expect(state.plan.files.map((file) => file.path)).toEqual([CASE_PATH]);
  expect(JSON.parse(state.plan.files[0].content).slug).toBe('publish-' + CASE_ID);
});

test('invalid public route grammar blocks publish with an anchored Russian error', async ({ page }) => {
  await login(page);
  await page.locator('#case-public-slug').fill('Bad Slug');
  await page.locator('#case-public-slug').blur();
  await page.click('#publish-btn');
  await expect(page.locator('#case-public-url-section')).toContainText(/строчные латинские буквы/);
});

test('authoritative main catalog rejects an untouched remotely conflicting case before any Git write', async ({ page }) => {
  const remoteId = allCaseIds(process.cwd()).find((id) => id !== CASE_ID);
  test.skip(!remoteId, 'requires a second case');
  const remotePath = 'content/cases/' + remoteId + '.json';
  const remoteSlug = 'remote-only-conflict';
  const calls = await mockGitHub(page, {
    contentForPath(path, original, ref) {
      if (path !== remotePath || ref === 'main') return null;
      const remote = JSON.parse(original.toString('utf8'));
      remote.slug = remoteSlug;
      return JSON.stringify(remote, null, 2) + '\n';
    }
  });
  await page.goto(server.base + '/admin/');
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.locator('.case-row[data-case-id="' + CASE_ID + '"]').click();
  await page.locator('#case-public-slug').fill(remoteSlug);
  await page.locator('#case-public-slug').blur();
  await page.click('#publish-btn');
  await expect(page.locator('#case-public-url-section')).toContainText(/уже используется кейсом/);
  expect(calls.blobs).toHaveLength(0);
  expect(calls.tree).toHaveLength(0);
});

test('a moved main head after authoritative validation is rejected before blob writes', async ({ page }) => {
  const expectedHead = 'b'.repeat(40);
  const movedHead = 'f'.repeat(40);
  const calls = await mockGitHub(page, { headSequence: [expectedHead, expectedHead, movedHead] });
  await page.goto(server.base + '/admin/');
  await page.click('#login-pat-toggle');
  await page.fill('#pat-input', 'test-pat-token');
  await page.click('#pat-submit');
  await page.locator('.case-row[data-case-id="' + CASE_ID + '"]').click();
  await page.locator('#case-public-slug').fill('bound-head-' + CASE_ID);
  await page.locator('#case-public-slug').blur();
  await page.click('#publish-btn');
  await expect(page.locator('#publish-dialog')).toBeVisible();
  await page.click('#publish-confirm');
  await expect(page.locator('#toast-errors')).toContainText(/main изменился/);
  expect(calls.blobs).toHaveLength(0);
  expect(calls.tree).toHaveLength(0);
});
