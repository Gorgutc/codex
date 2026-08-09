/* asset-budget-audit.mjs — ASSET-BUDGET-01, the fs side of the budget.
 *
 * Resolves the set of assets the site actually SHIPS, stats each one, and
 * reports it against the canonical numbers in scripts/asset-budget.mjs.
 *
 * USAGE
 *   node scripts/asset-budget-audit.mjs          # full report, exit 1 on a violation
 *   npm run check:assets                         # same, wired into codex:ship
 *
 * REFERENCE-DERIVED, NOT A DIRECTORY WALK. A naive "any file under assets/ over
 * N bytes" gate would be useless here: the reference set has to be the thing
 * the site links to, so that unreferenced files cost nothing and a newly
 * referenced heavy file is caught the moment content points at it.
 *
 * IT REUSES buildReferenceSet() FROM scripts/clean-orphan-assets.mjs rather
 * than writing a second resolver. That function is already the repo's
 * battle-tested answer to "what is live", it is already unit-tested by
 * verify-frozen.js and tests/quality/content-visibility.test.mjs, and it
 * already covers BOTH arms this gate needs:
 *   (1) content/*.json plus every naming convention the generator applies
 *       (FA model/poster/download defaults resolved through the shared
 *       fa-poster-path.mjs), and
 *   (2) a literal scan of the shipped HTML, CSS, the web manifest and every
 *       file under js/ — which is the ONLY way the HDR maps become visible.
 *       No content/*.json holds an HDR path: case.modelEnvironment stores a key
 *       name ('studio') and the URL table is hardcoded in js/main.js
 *       (ENV_PRESETS) and js/vendor/codex-three-viewer.js. A content-only
 *       resolver would miss 22 MB of genuinely shipped bytes.
 * A second resolver would be the fifth consumer that has to agree byte for
 * byte, which is exactly the drift scripts/fa-poster-path.mjs was created to
 * end.
 *
 * VISIBILITY IS DELIBERATELY NOT A FILTER — see the ASSET_BUDGET_DEBT comment
 * in scripts/asset-budget.mjs for why a visible-only gate would auto-revert a
 * legitimate admin filter flip.
 *
 * The reference set legitimately contains entries that are not files: bare
 * directory prefixes ('./assets/cards/') that the runtime completes at request
 * time, and doc-string paths ('./assets/models/model.gltf'). Anything that is
 * not an existing file, or whose extension carries no budget, is skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReferenceSet } from './clean-orphan-assets.mjs';
import {
  ASSET_BUDGETS,
  ASSET_BUDGET_DEBT,
  KB,
  MB,
  assetClassOf,
  budgetProblem,
  budgetWarns,
  canonicalAssetPath,
  formatBytes,
  knownDebtFor
} from './asset-budget.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Every shipped, budgeted file: { path, abs, bytes, assetClass }.
 * `root` is a parameter so a self-test can audit a throwaway tree. */
export function collectBudgetedAssets(root = ROOT) {
  const entries = [];
  for (const ref of buildReferenceSet(root)) {
    const assetClass = assetClassOf(ref);
    if (assetClass === null) continue;
    const abs = path.resolve(root, ref);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch (_e) {
      continue; // referenced but absent — the generator reports that separately
    }
    if (!stat.isFile()) continue;
    entries.push({ path: canonicalAssetPath(ref), abs, bytes: stat.size, assetClass });
  }
  entries.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  return entries;
}

/* Full audit result.
 *   failures  — over the fail line and NOT grandfathered → the gate is red
 *   warnings  — over the advisory warn line, under the fail line
 *   debt      — grandfathered entries matched byte-for-byte (reported, never red)
 *   staleDebt — grandfather entries that no longer match anything on disk; the
 *               gate is already re-armed on that path, the entry is just cruft
 *   byClass   — every budgeted class → its entries (empty array when dormant) */
export function auditAssets(root = ROOT) {
  const entries = collectBudgetedAssets(root);
  const failures = [];
  const warnings = [];
  const debt = [];
  const byClass = {};
  for (const assetClass of Object.keys(ASSET_BUDGETS)) byClass[assetClass] = [];

  for (const entry of entries) {
    byClass[entry.assetClass].push(entry);
    const matched = knownDebtFor(entry.path, entry.bytes);
    if (matched !== null) {
      debt.push({ ...entry, reason: matched.reason });
      continue;
    }
    const problem = budgetProblem(entry.assetClass, entry.bytes);
    if (problem !== null) {
      failures.push({ ...entry, problem });
      continue;
    }
    if (budgetWarns(entry.assetClass, entry.bytes)) warnings.push(entry);
  }

  const matchedDebtPaths = new Set(debt.map((entry) => entry.path));
  const staleDebt = ASSET_BUDGET_DEBT.filter((entry) => !matchedDebtPaths.has(entry.path));

  return { entries, failures, warnings, debt, staleDebt, byClass };
}

/* ── admin/js/state.js MEDIA_RULES mirror ────────────────────────────────────
 *
 * The admin panel cannot import scripts/asset-budget.mjs: admin/index.html
 * loads every admin script with a plain `src` (no type="module") and state.js
 * is an IIFE — the same constraint scripts/fa-poster-path.mjs documents for its
 * own browser mirrors. So the numbers are hand-mirrored into MEDIA_RULES and
 * this parser pins them.
 *
 * Block parity is mandatory for every mapped slot: if the admin block were
 * looser than the repo fail line, the panel would accept an upload that CI then
 * rejects after the commit is already on main. Advisory values stay
 * slot-specific (for example, the admin warns images at 200 KiB while the repo
 * warns raster files at 256 KiB). Model warnBytes is the focused exception:
 * owner-facing 25 MiB guidance must match the repository canon exactly.
 *
 * The parse is deliberately strict: a MEDIA_RULES literal this cannot read is
 * reported as a problem rather than silently skipped, because "cannot check"
 * and "checked and fine" must never look the same.
 */

// Which MEDIA_RULES slot maps to which budget class. Slots sharing a class must
// agree with each other as well as with the canon.
const ADMIN_SLOT_CLASS = {
  image: 'raster',
  blueprint: 'vector',
  ogImage: 'raster',
  orgLogo: 'raster',
  headerLogo: 'raster',
  faThumb: 'raster',
  video: 'video',
  model: 'model'
};

// Slots whose extension list includes 'svg' additionally carry a per-extension
// block for the vector class. Vector and raster currently share the 2 MiB hard
// limit, but the extension check keeps their independent contracts explicit.
const ADMIN_EXT_CLASS = { svg: 'vector' };

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function sliceBalanced(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return null;
}

/* { slotName: rawRuleBody } or null when the literal cannot be located. */
export function parseAdminMediaRules(source) {
  const anchor = source.indexOf('const MEDIA_RULES = {');
  if (anchor === -1) return null;
  const body = sliceBalanced(source, source.indexOf('{', anchor));
  if (body === null) return null;
  const clean = stripComments(body);
  const rules = {};
  let i = 0;
  while (i < clean.length) {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*\{/.exec(clean.slice(i));
    if (match) {
      const openIndex = i + match[0].length - 1;
      const ruleBody = sliceBalanced(clean, openIndex);
      if (ruleBody === null) return null;
      rules[match[1]] = ruleBody;
      i = openIndex + ruleBody.length + 2;
      continue;
    }
    i += 1;
  }
  return rules;
}

// '2 * MB' | '256 * KB' | '1048576' → bytes, or null when unparseable.
function evalBytes(expression) {
  const text = String(expression).trim().replace(/,$/, '');
  const scaled = /^(\d+)\s*\*\s*(KB|MB)$/.exec(text);
  if (scaled) return Number(scaled[1]) * (scaled[2] === 'MB' ? MB : KB);
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

function fieldOf(ruleBody, field) {
  const match = new RegExp(`\\b${field}\\s*:\\s*([^,\\n}]+)`).exec(ruleBody);
  return match ? match[1] : null;
}

function listOf(ruleBody, field) {
  const match = new RegExp(`\\b${field}\\s*:\\s*\\[([^\\]]*)\\]`).exec(ruleBody);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part !== '');
}

/* English problem clauses; an empty array means the mirror is in sync.
 * `root` is a parameter so a self-test can point at a mutated copy. */
export function adminMirrorProblems(root = ROOT) {
  const where = 'admin/js/state.js MEDIA_RULES';
  const statePath = path.join(root, 'admin', 'js', 'state.js');
  let source;
  try {
    source = fs.readFileSync(statePath, 'utf8');
  } catch (_e) {
    return [`${where}: admin/js/state.js not found — the budget mirror cannot be verified`];
  }
  const rules = parseAdminMediaRules(source);
  if (rules === null) {
    return [
      `${where}: could not locate the "const MEDIA_RULES = {…}" literal — the mirror is unverifiable, which must never look like "in sync"`
    ];
  }
  const problems = [];
  for (const [slot, assetClass] of Object.entries(ADMIN_SLOT_CLASS)) {
    const ruleBody = rules[slot];
    if (ruleBody === undefined) {
      problems.push(`${where}: slot "${slot}" is missing — every budgeted upload slot must mirror a class`);
      continue;
    }
    const expected = ASSET_BUDGETS[assetClass].failBytes;
    const actual = evalBytes(fieldOf(ruleBody, 'blockBytes'));
    if (actual === null) {
      problems.push(
        `${where}: slot "${slot}" has no readable blockBytes (expected ${expected} for class ${assetClass})`
      );
    } else if (actual !== expected) {
      problems.push(
        `${where}: slot "${slot}" blockBytes is ${formatBytes(actual)} (${actual}) but the ${assetClass} budget fails at ` +
          `${formatBytes(expected)} (${expected}) — the panel would accept an upload the repo rejects. ` +
          `Change both files together (scripts/asset-budget.mjs is the canon).`
      );
    }
    if (slot === 'model') {
      const expectedWarn = ASSET_BUDGETS.model.warnBytes;
      const actualWarn = evalBytes(fieldOf(ruleBody, 'warnBytes'));
      if (actualWarn === null) {
        problems.push(
          `${where}: slot "model" has no readable warnBytes (expected ${expectedWarn} for the focused model advisory)`
        );
      } else if (actualWarn !== expectedWarn) {
        problems.push(
          `${where}: slot "model" warnBytes is ${formatBytes(actualWarn)} (${actualWarn}) but the canonical model ` +
            `warning starts above ${formatBytes(expectedWarn)} (${expectedWarn}). Change both files together ` +
            `(scripts/asset-budget.mjs is the canon).`
        );
      }
    }
    // A slot that accepts an extension whose class has its OWN budget must end
    // up enforcing that budget. It can do so two ways, and both are correct:
    // an explicit per-extension override, or a general blockBytes that already
    // equals it. Only a genuine disagreement is a problem.
    //
    // Demanding the explicit override unconditionally would be false precision:
    // it reported three "mirror problems" for slots whose plain blockBytes was
    // already exactly the vector budget, i.e. where the panel and the repo
    // agree byte for byte. A parity check that fires when nothing disagrees
    // trains people to ignore it, which is worse than not having it.
    const exts = listOf(ruleBody, 'exts') || [];
    for (const [ext, extClass] of Object.entries(ADMIN_EXT_CLASS)) {
      if (!exts.includes(ext)) continue;
      const expectedExt = ASSET_BUDGETS[extClass].failBytes;
      const byExtBody = /blockBytesByExt\s*:\s*\{([^}]*)\}/.exec(ruleBody);
      const actualExt = byExtBody === null ? null : evalBytes(fieldOf(byExtBody[1], ext));
      const effective = actualExt === null ? actual : actualExt;
      if (effective !== expectedExt) {
        problems.push(
          `${where}: slot "${slot}" accepts .${ext} and would block it at ` +
            `${effective === null ? 'an unreadable limit' : formatBytes(effective)}, but the ${extClass} budget fails at ` +
            `${formatBytes(expectedExt)} (${expectedExt}). Set blockBytesByExt.${ext}, or align blockBytes. ` +
            `Change both files together (scripts/asset-budget.mjs is the canon).`
        );
      }
    }
  }
  return problems;
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

function report(root = ROOT) {
  const { entries, failures, warnings, debt, staleDebt, byClass } = auditAssets(root);
  console.log(
    `Asset weight budget — ${entries.length} shipped file(s) resolved from content/ + shipped HTML/CSS/JS.\n`
  );

  for (const [assetClass, budget] of Object.entries(ASSET_BUDGETS)) {
    const classEntries = byClass[assetClass];
    if (classEntries.length === 0) {
      // Dormant classes are explicit, never silent: "no video is shipped today"
      // and "the video check is broken" must not look the same.
      console.log(`  ${assetClass.padEnd(9)} SKIP  no shipped asset of this class in the reference set`);
      continue;
    }
    const largest = classEntries[0];
    const failLabel = budget.failBytes === null ? 'warn-only' : `fail ${formatBytes(budget.failBytes)}`;
    console.log(
      `  ${assetClass.padEnd(9)} ${String(classEntries.length).padStart(3)} file(s), largest ${formatBytes(largest.bytes)} ` +
        `${largest.path}  [warn ${formatBytes(budget.warnBytes)}, ${failLabel}]`
    );
  }

  if (debt.length) {
    console.log('\nKnown debt (grandfathered by path AND exact byte size — re-arms automatically on re-upload):');
    for (const entry of debt) console.log(`  ${entry.path}  ${formatBytes(entry.bytes)}\n    ${entry.reason}`);
  }
  if (staleDebt.length) {
    console.log('\nStale grandfather entries (nothing on disk matches path+size — the gate is already armed there):');
    for (const entry of staleDebt) {
      console.log(`  ${entry.path} @ ${entry.bytes} B — safe to delete from ASSET_BUDGET_DEBT`);
    }
  }
  if (warnings.length) {
    console.log('\nOver the advisory warn line (not blocking):');
    for (const entry of warnings) console.log(`  ${entry.path}  ${formatBytes(entry.bytes)}  (${entry.assetClass})`);
  }

  const mirrorProblems = adminMirrorProblems(root);
  if (mirrorProblems.length) {
    console.error('\nAdmin mirror out of sync:');
    for (const problem of mirrorProblems) console.error(`  ${problem}`);
  } else {
    console.log(
      '\nAdmin mirror: admin/js/state.js MEDIA_RULES hard limits and focused model warning match the canon.'
    );
  }

  if (failures.length) {
    console.error('\nASSET BUDGET VIOLATIONS:');
    for (const entry of failures) console.error(`  ${entry.path} ${entry.problem}`);
  }

  const bad = failures.length + mirrorProblems.length;
  if (bad > 0) {
    console.error(
      `\nSUMMARY: ${failures.length} oversized shipped asset(s), ${mirrorProblems.length} mirror problem(s).`
    );
    return 1;
  }
  console.log(
    `\nSUMMARY: 0 violations (${warnings.length} warning(s), ${debt.length} grandfathered file(s)). ` +
      'downloads/**: repo copies are placeholders excluded from the Beget mirror — their real size is not observable here.'
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(report());
}
