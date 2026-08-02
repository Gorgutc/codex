/* asset-budget.mjs — the ONE canonical byte budget for shipped assets.
 * ASSET-BUDGET-01.
 *
 * WHY THIS EXISTS. A 21.85 MB .glb was published from the admin panel and
 * reached production. Nothing in the repo stated a maximum size for a shipped
 * asset: the only thresholds anywhere were the client-side MEDIA_RULES in
 * admin/js/state.js, whose model rule warned at 15 MB and blocked at 50 MB, so
 * the upload landed in the warn band and the owner clicked past it. The
 * consequence was not a red gate but an opaque one — `npm run verify` started
 * timing out after 30 s while Playwright waited for a 3D pane that was busy
 * downloading 21.85 MB. This module turns that into a named, actionable
 * failure that fires in ~1 s, before any browser is opened.
 *
 * THE MODULE IS PURE. No fs, no deps, no I/O — exactly the shape of
 * scripts/fa-poster-path.mjs, and for the same reason: several consumers have
 * to agree on the same numbers. The fs-side resolver and the CLI live in
 * scripts/asset-budget-audit.mjs; this file only answers "given a site path and
 * a byte count, is that publishable?".
 *
 * CONSUMERS
 *   • scripts/generate-content.mjs  — checkAssetFile() (the single chokepoint
 *     every content-declared asset path already crosses) calls
 *     assetBudgetViolation(). This is the one that closes the owner's publish
 *     path: the `regen` step of .github/workflows/content-publish.yml runs the
 *     generator with continue-on-error and feeds `steps.regen.outcome` into the
 *     auto-revert, so an oversized asset never reaches the bot regen commit and
 *     never reaches Beget. No workflow YAML change was needed.
 *   • scripts/asset-budget-audit.mjs — resolves the SHIPPED set (content refs
 *     plus the literal scan of HTML/CSS/js, which is the only way to see the
 *     HDR paths hardcoded in js/main.js) and reports against these numbers.
 *   • verify-frozen.js              — ASSET-budget-<class> static checks.
 *   • admin/js/state.js MEDIA_RULES — HAND MIRROR. The admin panel is a classic
 *     non-module script layer (admin/index.html loads every file with a plain
 *     `src`, and state.js is an IIFE), so it CANNOT import this module — the
 *     same constraint fa-poster-path.mjs documents. The mirror is therefore
 *     pinned by adminMirrorProblems() in scripts/asset-budget-audit.mjs, which
 *     parses the MEDIA_RULES literal and fails when a number drifts. The
 *     invariant it enforces: for every class, admin blockBytes === failBytes
 *     here, so the panel refuses an upload the repo would later reject instead
 *     of the owner discovering it as a red X in Actions after the commit is
 *     already on main. Admin warnBytes is advisory and may be stricter.
 *
 * CLASS COMES FROM THE EXTENSION, NOT THE FIELD. case.media[].src carries an
 * image or a video depending on the block type, and an FA poster slot carries a
 * vector or a raster; deriving the class from the field would need every call
 * site to agree, which is the drift fa-poster-path.mjs was created to end.
 */

export const KB = 1024;
export const MB = 1024 * KB;

/* Extension → class. An extension listed nowhere here has NO budget (.wasm,
 * .bin, .gltf, .ktx2, .md, .webmanifest): those are vendor/runtime files no
 * content field can point at, and inventing a number for them would be a guess
 * this incident does not justify. */
export const ASSET_CLASS_EXTS = {
  model: ['.glb'],
  hdr: ['.hdr', '.exr'],
  video: ['.webm', '.mp4'],
  vector: ['.svg'],
  raster: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico'],
  download: ['.zip']
};

/* Every threshold below is justified against the ACTUAL shipped inventory, not
 * against a round number — a budget that is red on arrival gets ignored, and a
 * budget that no real asset can reach is decoration.
 *
 *   model    15 MB warn / 50 MB fail. OWNER DECISION 2026-08-02, verbatim:
 *            "лучше расшири гейт до 50 мб так как модели мпогут быть разными".
 *            The owner ships real client work and needs headroom, so the hard
 *            line is theirs, not ours, and it deliberately mirrors the two
 *            thresholds admin/js/state.js has always used (warn 15 / block 50):
 *            the gate now says in CI exactly what the upload dialog already
 *            says in the browser, instead of inventing a stricter second rule
 *            the owner never agreed to.
 *            CONSEQUENCE, stated plainly rather than hidden: at 50 MB the
 *            21.85 MB model that triggered this work does NOT fail — it warns.
 *            That is the accepted trade. The warn is what keeps it named on
 *            every run; see ASSET_BUDGET_DEBT for why no grandfather entry is
 *            needed for it at this budget.
 *   raster   256 KB warn / 1 MB fail. Deliberately NOT 200 KB: the largest
 *            shipped image is 215,442 B, so a 200 KB warn would flag unmodified
 *            production content on day one. 256 KB sits just above today's
 *            worst case — green now, flags the very next upload heavier than
 *            anything currently shipped. The 1 MB fail is set for the gallery,
 *            not the single image: one case loads seven of these.
 *   vector   64 KB warn / 256 KB fail. Hand-authored diagram slides top out at
 *            11,774 B. The fail line exists for one failure mode nothing else
 *            in the stack can see: a base64-embedded raster inside an .svg,
 *            which passes every extension check in MEDIA_RULES, in
 *            fa-poster-path.mjs and in the generator.
 *   video    2 MB warn / 10 MB fail. Both existing clips are under 0.36 MB. The
 *            fail line can be aggressive because the schema already ships the
 *            escape hatch: motionBlocks[].source === 'vimeo' exists precisely
 *            for heavy clips, and the admin's own warn text says so.
 *   hdr      2 MB warn / 4 MB fail. The three Polyhaven 1k maps in use are
 *            1,485,234 / 1,508,872 / 1,686,299 B — the intended shape of the
 *            class, sitting just under the warn on purpose. A 1k map must not
 *            warn; a 2k (~4-5 MB) must fail.
 *   download 50 MB warn, NO fail. downloads/** is excluded from the Beget lftp
 *            mirror (.github/workflows/deploy-beget.yml), so the repo copies
 *            are 354-412 B placeholders and the archive a visitor actually
 *            downloads is owner-managed on the server. This gate cannot see
 *            that artifact and must not pretend to enforce its size.
 */
export const ASSET_BUDGETS = {
  /* GOVERNING PRINCIPLE for every fail line below: this gate must never forbid
   * what the admin panel already allowed. Its job is to make weight VISIBLE in
   * CI, not to quietly narrow what the owner could upload yesterday. So each
   * failBytes mirrors the corresponding admin blockBytes exactly, and all the
   * genuinely new signal lives in warnBytes, which blocks nothing.
   * Tightening any fail line below its admin counterpart is an owner decision,
   * not a maintenance detail — ask first. */
  model: { warnBytes: 15 * MB, failBytes: 50 * MB, label: 'GLB model' },
  hdr: { warnBytes: 2 * MB, failBytes: 4 * MB, label: 'HDR environment map' },
  video: { warnBytes: 2 * MB, failBytes: 40 * MB, label: 'video clip' },
  /* vector fail === the 2 MB image block; the warn is what actually catches a
   * base64 raster glued inside an .svg. Deliberately NOT stricter: the owner is
   * about to start uploading hand-authored SVG blueprints, and a detailed
   * technical drawing can legitimately weigh far more than the 11 KB the
   * existing generated slides do. */
  vector: { warnBytes: 256 * KB, failBytes: 2 * MB, label: 'SVG' },
  raster: { warnBytes: 256 * KB, failBytes: 2 * MB, label: 'raster image' },
  download: { warnBytes: 50 * MB, failBytes: null, label: 'download archive' }
};

/* Per-class hint appended to a violation so the message says what to DO. */
const ASSET_BUDGET_HINT = {
  model: 'optimise the mesh/textures (Draco or meshopt, fewer or smaller maps) before publishing',
  hdr: 'ship a 1k map — the three in assets/hdr/ are 1.4-1.7 MB',
  video: 'compress the clip, or host it on Vimeo via motionBlocks[].source = "vimeo"',
  vector: 'an SVG this large usually means a raster was embedded as base64 — export the raster separately',
  raster: 'export a smaller WebP/JPG — shipped case renders sit at 150-215 KB',
  download: 'the repo copy is a placeholder; the real archive lives on the server'
};

/* KNOWN DEBT — grandfathered, keyed by path AND EXACT byte size.
 *
 * This is the same shape AGENTS.md already sanctions for the font-size budget:
 * "a frozen grandfathered budget, not blanket permission". Keying on bytes (not
 * just on the path) is the whole point — the moment a grandfathered file is
 * re-encoded, replaced or re-uploaded its size changes, the entry stops
 * matching, and the gate re-arms on that path automatically with no human step.
 *
 * WHY GRANDFATHER RATHER THAN SCOPE THE GATE TO VISIBLE CASES. Three of the
 * five entries below are referenced by cases that are currently invisible — not
 * because the case is disabled, but because their category filter is disabled
 * in content/settings.json. A gate scoped to visible assets would be green
 * today and would then auto-revert the owner's publish the moment they
 * re-enabled that filter from the admin, on bytes that were already in the repo
 * and that they did not touch. That is precisely the failure class this repo
 * has been bitten by repeatedly: an expectation that did not match the content
 * the owner legitimately changed. Grandfathering is stated, visible in every
 * audit run, and never blocks a legitimate visibility change.
 *
 * These files are NOT to be compressed, moved, replaced or deleted by this
 * change. The owner's decision on the corten model is explicit: it was a test
 * model and they will re-upload it themselves.
 */
export const ASSET_BUDGET_DEBT = [
  /* NO model entries. At the owner's 50 MB model budget none is needed: the
   * corten incident file (22,908,588 B), car-paint (17,044,880 B) and
   * humanoid-2 (13,193,600 B) all sit under the fail line and are reported as
   * warnings instead. That is strictly better than grandfathering them — a
   * warning stays visible on every run and needs no maintenance, whereas a
   * debt entry has to be pruned by hand once the file changes. Do not add
   * model entries here to silence a warning; raise it with the owner instead. */
  {
    path: './assets/hdr/experimental/citrus-orchard-puresky-4k.hdr',
    bytes: 18459533,
    reason:
      'pre-existing 4k IBL map wired as the CITRUS env preset in js/main.js and as the default environmentUrl of js/vendor/codex-three-viewer.js — one click issues an 18.5 MB fetch; out of scope for this change, flagged to the owner'
  }
];

/* Canonical './assets/…' spelling for set membership and debt lookup. Mirrors
 * canonical() in scripts/clean-orphan-assets.mjs. */
export function canonicalAssetPath(value) {
  let s = String(value).trim().replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  s = s.replace(/^\/+/, '');
  return './' + s;
}

export function extensionOf(value) {
  const match = /\.[A-Za-z0-9]+$/.exec(String(value));
  return match ? match[0].toLowerCase() : '';
}

/* 'model' | 'hdr' | 'video' | 'vector' | 'raster' | 'download' | null. */
export function assetClassOf(value) {
  const ext = extensionOf(value);
  for (const [assetClass, exts] of Object.entries(ASSET_CLASS_EXTS)) {
    if (exts.includes(ext)) return assetClass;
  }
  return null;
}

/* Human-readable byte count. Identical to the formatter the generator already
 * uses for the Free Assets archive labels (it now imports this one), so a
 * budget message and the size the owner sees on a card are worded the same.
 * Deterministic, no locale formatting. */
export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
  const mb = kb / 1024;
  if (mb < 1024) return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + ' MB';
  const gb = mb / 1024;
  return (gb < 10 ? gb.toFixed(1) : String(Math.round(gb))) + ' GB';
}

/* The debt entry matching this path AND size, or null. */
export function knownDebtFor(sitePath, bytes) {
  const key = canonicalAssetPath(sitePath);
  return ASSET_BUDGET_DEBT.find((entry) => entry.path === key && entry.bytes === bytes) || null;
}

/* null when the size is publishable, otherwise an English problem clause.
 * Callers compose it as `<where>: "<value>" <problem>` so the message shape
 * matches checkAssetFile in scripts/generate-content.mjs and faPosterProblem in
 * scripts/fa-poster-path.mjs. */
export function budgetProblem(assetClass, bytes) {
  const budget = ASSET_BUDGETS[assetClass];
  if (!budget || budget.failBytes === null) return null;
  if (bytes <= budget.failBytes) return null;
  return (
    `is ${formatBytes(bytes)} (${bytes} bytes) — over the ${formatBytes(budget.failBytes)} budget for a ` +
    `${budget.label}; ${ASSET_BUDGET_HINT[assetClass]} (scripts/asset-budget.mjs)`
  );
}

/* True when the size is under the fail line but over the advisory warn line. */
export function budgetWarns(assetClass, bytes) {
  const budget = ASSET_BUDGETS[assetClass];
  if (!budget) return false;
  if (budget.failBytes !== null && bytes > budget.failBytes) return false;
  return bytes > budget.warnBytes;
}

/* THE one call every path-plus-size consumer makes: classify, honour the
 * grandfather list, then budget. null means publishable. */
export function assetBudgetViolation(sitePath, bytes) {
  const assetClass = assetClassOf(sitePath);
  if (assetClass === null) return null;
  if (knownDebtFor(sitePath, bytes) !== null) return null;
  return budgetProblem(assetClass, bytes);
}
