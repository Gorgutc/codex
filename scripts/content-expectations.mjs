/* content-expectations.mjs — shared content-derived expectations for the
 * golden capture script and the Playwright suites (prod-review F1, finding
 * D-01).
 *
 * These consumers used to hardcode the visible card/asset counts (=== 18,
 * === 8): hiding a case or an asset through the admin panel kept verify
 * green but timed out the golden-recapture step of the content-publish
 * pipeline AFTER the verify gate — main was left without regeneration and
 * without the auto-revert. Deriving the same selection from content/ (the
 * exact mirror of EXPECTED_IDS in verify-frozen.js and visibleCases()/
 * visibleFaCategories() in scripts/generate-content.mjs) keeps every
 * consumer in lockstep with legitimate admin publications.
 */
import fs from 'node:fs';
import path from 'node:path';

function readJson(root, ...segments) {
  return JSON.parse(fs.readFileSync(path.join(root, 'content', ...segments), 'utf8'));
}

// Visible cases = enabled cases of enabled categories, in cardOrder.
export function visibleCaseIds(root) {
  const settings = readJson(root, 'settings.json');
  const enabledFilterKeys = new Set(
    settings.filters.filter((f) => f && f.enabled !== false).map((f) => f.key)
  );
  return settings.cardOrder.filter((id) => {
    const data = readJson(root, 'cases', id + '.json');
    return data.enabled !== false && enabledFilterKeys.has(data.category);
  });
}

// Every authored case id (visible or hidden), in cardOrder — what the admin
// case list renders.
export function allCaseIds(root) {
  return readJson(root, 'settings.json').cardOrder.slice();
}

// Visible FA categories with their visible items, in authored order.
export function visibleFaCategories(root) {
  const fa = readJson(root, 'free-assets.json');
  return (fa.categories || [])
    .filter((cat) => cat && cat.enabled !== false)
    .map((cat) => ({
      key: cat.key,
      gameAsset: !!(cat.tagCard && cat.tagCard.gameAsset === true),
      items: (Array.isArray(cat.items) ? cat.items : []).filter(
        (item) => item && item.enabled !== false
      )
    }))
    .filter((cat) => cat.items.length > 0);
}
