/* Public case-route canon. Case ids stay implementation keys; only these
 * validated values may enter the public hash namespace. */
export const CASE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function effectiveCaseSlug(caseData) {
  return caseData && typeof caseData.slug === 'string' && caseData.slug !== '' ? caseData.slug : caseData.id;
}

export function caseRouteTokens(caseData) {
  const tokens = [caseData && caseData.id, effectiveCaseSlug(caseData)];
  if (caseData && Array.isArray(caseData.legacySlugs)) tokens.push(...caseData.legacySlugs);
  return tokens.filter((token, index, all) => typeof token === 'string' && all.indexOf(token) === index);
}

export function caseSlugViolations(caseData, where) {
  const violations = [];
  if (!caseData || typeof caseData !== 'object') return violations;
  const id = caseData.id;
  if (Object.hasOwn(caseData, 'slug')) {
    if (typeof caseData.slug !== 'string' || !CASE_SLUG_RE.test(caseData.slug)) {
      violations.push(`${where}: slug must be lowercase letters, digits and single dashes`);
    } else if (caseData.slug === id) {
      violations.push(`${where}: slug must not repeat the stable id "${id}"`);
    }
  }
  if (!Object.hasOwn(caseData, 'legacySlugs')) return violations;
  if (!Array.isArray(caseData.legacySlugs) || caseData.legacySlugs.length === 0) {
    violations.push(`${where}: legacySlugs must be an array of non-empty route tokens`);
    return violations;
  }
  const canonical = effectiveCaseSlug(caseData);
  const seen = new Set();
  caseData.legacySlugs.forEach((token, index) => {
    const label = `${where}: legacySlugs[${index}]`;
    if (typeof token !== 'string' || !CASE_SLUG_RE.test(token)) {
      violations.push(`${label} must be lowercase letters, digits and single dashes`);
      return;
    }
    if (seen.has(token)) violations.push(`${label} duplicates "${token}"`);
    seen.add(token);
    if (token === id) violations.push(`${label} must not repeat the stable id "${id}"`);
    if (token === canonical) violations.push(`${label} must not repeat the canonical slug "${canonical}"`);
  });
  return violations;
}
