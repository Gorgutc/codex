# Asset Budget And CI Contract Repair Design

**Date:** 2026-08-08

**Status:** approved by owner; runtime addendum approved after measurement

**Baseline:** `main@122d4c4bfaf1970144a5a18b7746e60e6086d8e7`

## Problem

The current pull-request quality gate is deterministically red in
`tests/quality/admin-media.spec.mjs`. The test assumes that the SVG hard limit
must be lower than the raster hard limit, while the live contract intentionally
sets both limits to 2 MiB. The asset audit itself passes, so increasing a hard
limit would hide the stale test assumption rather than fix the failure.

The shipped Corten GLB is 22,908,588 bytes (about 21.85 MiB). It is below the
50 MiB model hard limit, but the current 15 MiB advisory threshold produces a
warning. The owner has explicitly changed that advisory policy: a model at or
below 25 MiB must be warning-free, while the 50 MiB hard limit remains intact.

Asset size is not a runtime-performance proof. The same Corten model has
reproduced a local 30-second browser timeout on this baseline even though it is
well below the hard limit. The latest remote content-publish verification
passed, so the outcome is timing/environment-sensitive rather than a
deterministic byte-limit failure. The design must therefore keep byte policy
and runtime verification as separate gates. The current verifier waits for a
canvas with a swallowed timeout and then clicks material controls before the
existing `is-ready` marker is required, so the local failure may also expose a
readiness race in the test harness.

## Owner Decisions

1. Model sizes use binary units: `1 MiB = 1024 * 1024` bytes.
2. A GLB of `<= 25 MiB` does not produce an asset-size warning.
3. A GLB of `> 25 MiB` and `<= 50 MiB` is publishable but produces an advisory
   warning.
4. A GLB of `> 50 MiB` is blocked.
5. Model, SVG, and raster hard limits are not expanded to make a test green.
6. SVG and raster hard limits remain 2 MiB each. Their existing advisory
   thresholds remain unchanged in this task.
7. A passing byte gate does not guarantee that a model loads or interacts
   correctly; the existing browser/runtime gate remains mandatory.
8. Every existing repository hard limit remains fixed: model 50 MiB, HDR
   4 MiB, video 40 MiB, vector 2 MiB, raster 2 MiB, and download archives
   remain warn-only with no repository hard limit.
9. After measuring the heaviest referenced model locally and on clean Linux
   SwiftShader CI, the owner-authorized runtime contract separates performance
   from operability: `120,000 ms` is the total-scenario target, load/readiness
   and every Clay/Xray/PBR transition have an absolute `180,000 ms` functional
   phase deadline, and one `600,000 ms` operational watchdog bounds the whole
   scenario. A slower successful total gets literal `PERF_WARN`; any
   phase/watchdog timeout fails without retry.

The comparisons are intentionally strict on the upper side. Exactly 25 MiB is
warning-free, exactly 50 MiB is allowed with a warning, and one byte above
50 MiB is rejected.

## Goals

- Make the current asset-policy tests express the real per-class boundaries
  instead of a cross-class ordering assumption.
- Change the canonical and owner-facing GLB warning threshold from 15 MiB to
  25 MiB without changing the 50 MiB hard limit.
- Prevent drift between the canonical model policy, the classic-script admin
  mirror, its UI copy, tests, and active instructions.
- Cover the blueprint upload slot in the admin-to-repository hard-limit mirror.
- Make the existing 3D browser gate deterministically wait for the heaviest
  visible referenced model to be ready before exercising material controls.
- Keep all asset path, extension, MIME, rendering, CSP, and publish/revert
  protections unchanged.
- Finish with a green full `npm run codex:ship` on the task branch and a green
  pull-request `quality` check.

## Non-goals

- Replacing, compressing, or editing the current GLB, SVG, raster, video, HDR,
  or download assets.
- Raising the 50 MiB GLB hard limit or either 2 MiB image hard limit.
- Changing the existing SVG, blueprint, raster, video, HDR, or download
  advisory thresholds.
- Introducing Git LFS, a bundler, a framework, new runtime storage, or a new
  upload service.
- Changing lazy-loading, Three viewer, `<model-viewer>` fallback, blueprint
  rendering, or deploy workflow behavior.
- Claiming that historical failed workflow runs can be made green retroactively.
- Repairing an unrelated historical Design Lab assertion unless it still
  reproduces on the updated branch and blocks the required full gate. Any such
  failure must be diagnosed independently before its scope is expanded.
- Skipping the Corten case, using forced/DOM clicks, weakening viewer state
  assertions, or treating the 600-second CI watchdog as a user-experience SLA.
- Changing shipped viewer behavior or the Corten model in this repair. The
  measured performance risk remains visible and can be remediated separately.

## Considered Approaches

### A. Keep hard limits and repair the contract tests — chosen

Keep model/SVG/raster hard limits at 50/2/2 MiB, move only the model advisory
line to 25 MiB, and test each class at its own exact boundary. This matches the
owner decision, preserves protection, and fixes the known red CI at its source.

### B. Split SVG and raster hard limits — rejected

Making raster larger than SVG would satisfy the stale comparison, but there is
no demonstrated product need for larger rasters. It would weaken the gate and
would require a separate owner decision about compensating pixel-dimension or
aggregate-case guards.

### C. Raise or remove the model hard limit — rejected

The known model already fits below 50 MiB. Raising the hard limit cannot repair
the failing admin test and would increase transfer/runtime risk.

### D. Treat `<= 25 MiB` as runtime-safe — rejected

Byte size is only a useful advisory signal. Mesh complexity, materials,
textures, decoding, GPU/CPU capability, and browser timing still affect viewer
readiness. Runtime verification remains authoritative for runtime behavior.

## Contract And Data Flow

### Canonical repository policy

`scripts/asset-budget.mjs` remains the source of truth for repository asset
classes and byte limits. Its model budget becomes:

```text
warnBytes = 25 * MiB
failBytes = 50 * MiB
```

`budgetWarns()` and `budgetProblem()` retain their current `>` semantics. No
classification, debt, hint, or reference-set behavior changes.

### Admin mirror

The admin panel cannot import the Node module because shipped admin scripts are
classic non-module scripts. `admin/js/state.js` therefore keeps the hand mirror:

```text
model.warnBytes  = 25 * MiB
model.blockBytes = 50 * MiB
```

The Russian warning must say 25 MiB. Both the case-editor and Free Assets
3D-model drop-zone hints derive their 25/50 MiB values from
`State.getMediaRule('model')` instead of keeping additional hard-coded numeric
mirrors. Upload extension/MIME checks and the `>` hard-stop comparison remain
untouched.

`scripts/asset-budget-audit.mjs` continues to prove that every mapped admin
hard limit equals the canonical hard limit. The `blueprint` slot is added to
that mapping as class `vector`. Because SVG/raster admin advisory thresholds
intentionally differ from repository warnings, general advisory parity is not
introduced. Instead, the owner-selected model warning receives a focused
mirror assertion so 25 MiB cannot silently drift between repository and admin.

### Owner-facing guidance and active instructions

The owner guide and active asset skill state the two model thresholds together:

- recommended without size warning: `<= 25 MiB`;
- publish block: `> 50 MiB`;
- models in any allowed byte band must still pass runtime verification.

The same guidance lists the current SVG/blueprint/raster advisory and hard
limits without silently normalizing their intentionally different admin and
repository warning values:

| Surface and class | Advisory band | Block when |
| --- | ---: | ---: |
| Repository model and admin model | `(25 MiB, 50 MiB]` | `> 50 MiB` |
| Repository vector or raster | `(256 KiB, 2 MiB]` | `> 2 MiB` |
| Admin image, OG, logo, or FA thumbnail | `(200 KiB, 2 MiB]` | `> 2 MiB` |
| Admin blueprint | `(500 KiB, 2 MiB]` | `> 2 MiB` |

Exactly 2 MiB remains allowed for SVG and raster uploads. General advisory
parity is forbidden because the surfaces intentionally differ; the model is a
focused parity exception. Stale comments that describe obsolete 1 MiB raster,
256 KiB vector hard stops, 10 MiB video limits, or a four-times-smaller vector
hard limit are rewritten to match executable code.

Active plugin skills must route current asset work to the live code, active
asset skill, and current verification commands. `references/claude-original/`
remains an archive and is not edited as policy. Generated `.claude/skills/**`
and `.claude/agents/**` files are updated only through `npm run sync:harness`.
The root agent rules receive only a pointer to the canonical budget and gate;
they do not duplicate numeric thresholds. The active admin specification and
verification guide record the superseding owner decision, while historical
handoff text remains historical and receives a new superseding entry instead
of being silently rewritten.

## Test Design

Implementation follows test-first development for each behavioral change. The
existing cross-class assertion is first captured as the known RED diagnosis;
its independent-boundary replacement is expected to pass against unchanged
production hard limits and does not justify a production limit change.

### Canonical model boundary

The asset-budget self-test first pins the owner-selected numbers, not merely a
self-referential value read from the object:

- `model.warnBytes === 25 * MiB`;
- `model.failBytes === 50 * MiB`;
- 25 MiB: no warning;
- 25 MiB + 1 byte: warning;
- 50 MiB: no violation;
- 50 MiB + 1 byte: violation.

The threshold assertion must fail before the production constant changes and
pass after it changes.

The same pure test pins the complete repository hard-limit map from Owner
Decision 8, including the warn-only download class, so unrelated limits cannot
be loosened as collateral change.

### Admin upload boundaries

The impossible premise `vector.failBytes < raster.failBytes` is removed. The
test exercises the actual independent contracts:

- an SVG at exactly 2 MiB is accepted;
- an SVG at 2 MiB + 1 byte is rejected;
- a raster at exactly 2 MiB is accepted;
- a raster at 2 MiB + 1 byte is rejected;
- the model mirror exposes 25 MiB advisory and 50 MiB hard values;
- `model.warnText` names `25 МБ` and `model.blockText` names `50 МБ`;
- both case-editor and Free Assets model upload screens show the derived 25/50
  MiB guidance.

Where a browser cannot practically allocate a boundary fixture without noise,
the pure contract test owns the byte arithmetic and the browser test proves
the user-visible outcome with the smallest deterministic fixture.

### Blueprint coverage

Mirror coverage maps `blueprint` to the vector hard limit. A focused admin
blueprint scenario uploads an SVG above 2 MiB and proves that it is rejected
before a pending media record or publish tree entry is created. The existing
SVG-only, case-directory, `<img>`, and CSP assertions remain unchanged.

### Runtime proof

`verify-frozen.js` already launches Playwright inside `npm run verify`, and the
content-publish workflow runs that command before accepting generated content.
Its 3D path is strengthened without changing shipped runtime code:

1. Preserve proof that Three, model data, and GLB resources are not requested
   before the 3D tab is opened.
2. Derive the largest visible referenced `modelSrc` from current content and
   file sizes instead of relying on the motion-case or card-order fallback.
3. After opening 3D, require a successful response for that exact GLB and wait
   for `#case-3d-canvas.is-ready canvas.case-3d__three-canvas`. The readiness
   wait must not swallow its timeout.
4. Exercise Clay, Xray, and the return to PBR with normal Playwright clicks,
   then verify `.is-on` and `aria-pressed` state. Do not use `force: true` or a
   DOM-level `.click()` to bypass actionability.
5. On failure, report the case id, asset path, byte size, response status, and
   readiness timing under a named 3D result.

The initial deterministic 30,000 ms readiness ceiling reproduced the failure
twice. A cold diagnostic then measured the exact GLB response at 394 ms,
`is-ready` at 39,055 ms, Clay/Xray/PBR interactions at 48,057/9,558/39,921 ms,
and the complete scenario at 140,965 ms. Chromium also reported GPU
`ReadPixels` and render-pass stalls. With reduced motion, the same diagnostic
measured 399 ms response, 37,657 ms readiness, 19,400/2,115/4,450 ms material
interactions, and 64,481 ms total. The bottleneck is therefore decode/render
and browser/GPU operability, not network transfer or the byte gate.

Subsequent local verification measured complete totals of 122,537, 154,249,
158,362, 173,265, and 180,008 ms. The last run completed readiness plus all
Clay/Xray/PBR states but crossed the original 180,000 ms ceiling on the final
mandatory lifecycle snapshot. That evidence produced an intermediate
210,000 ms whole-scenario ceiling. It remains historical evidence but was
superseded after a clean Linux SwiftShader run proved that one total ceiling
still conflated performance with functional operability.

The active measured contract is:

- `MODEL_RUNTIME_TARGET_MS = 120,000`: a successful total at or below the
  target is `within-target`; a slower successful total is `PERF_WARN`;
- `MODEL_RUNTIME_PHASE_TIMEOUT_MS = 180,000`: load/readiness and each
  Clay/Xray/PBR transition get one absolute phase budget shared by their click,
  state wait, and snapshot;
- `MODEL_RUNTIME_WATCHDOG_MS = 600,000`: one absolute operational watchdog
  covers the dedicated scenario through the final lifecycle snapshot;
- each phase deadline is clipped by the operational watchdog. Any phase or
  watchdog timeout fails without retry, regardless of the performance label.

The independent generic viewer opens first on the primary page with the
smallest visible referenced model. Nine real pagination remounts then alternate
through a content-derived adjacent non-heaviest pair; every step must preserve
the transition cover, reach its expected case, and settle. With two or more
visible cases, inability to form that pair fails closed. The primary page is
closed before the heaviest-model acceptance starts last on a dedicated
normal-motion page, which is closed only after the complete material scenario.
This isolation does not skip or weaken Corten: it prevents generic pagination
from decoding it repeatedly and prevents its continuous render loop from
consuming the dedicated acceptance budget. The generic readiness helper
accepts the existing inline `model-data.js` resolution used by small models;
the exact HTTP response requirement remains on the external heaviest GLB.

The first PR #73 quality run exposed the missing isolation: nine unconditional
next-clicks mounted Corten three times before its dedicated smoke, and the
primary page remained open. The run reached the 210,000 ms watchdog before PBR
and therefore was not a clean basis for expanding the ceiling. After isolating
pagination and closing the primary page, two fresh local complete scenarios
passed in 171,512 and 158,145 ms under the then-current intermediate 120/210 contract.

The next exact-head PR run `31274544296` supplied the first clean cross-platform
measurement. Lightweight pagination passed all nine transitions. The external
GLB response/body completed in 3,168/3,259 ms, Linux SwiftShader reached ready
at 74,475 ms, and Clay/Xray completed in 81,919/33,010 ms with zero unexpected
context loss. The intermediate 210,000 ms total expired during the normal PBR
click, leaving only about 20.6 seconds for that phase. Every completed phase
was below 120 seconds, while their legitimate sum exceeded 210 seconds. Under
the owner's explicit authorization to revisit the boundary after measurement,
this evidence superseded the intermediate whole-scenario ceiling with an
intermediate 120-second phase / 360-second operational split.

Exact-head PR run `31277048918` then measured the split itself. Attempt 1
completed the external model in 323,940 ms: ready 87,456 ms, Clay 76,878 ms,
Xray 26,006 ms, PBR 99,387 ms, and zero unexpected context loss. That left only
36,060 ms of whole-watchdog headroom. Attempt 2 reached ready in 70,891 ms,
logged the exact GLB HTTP 200 and `contextLosses=0`, then crossed the 120,000 ms
Clay phase deadline at total 208,086 ms. Because that first terminal timeout
ended the run, the log does not separately establish the absence of page or
console errors. The failed phase is a
right-censored measurement (`>120,000 ms`), so a 150-second replacement would
not provide defensible tail margin. Under the same prior owner authorization,
these two attempts supersede the intermediate split with the active
120-second target / 180-second phase / 600-second watchdog contract above.
The 180-second phase adds 50% beyond the demonstrated lower bound; the
600-second watchdog remains bounded well inside the existing 30-minute job.
Any timeout at the active limits stops this task for runtime profiling rather
than causing another automatic increase.

The verifier records HTTP status, response time, readiness time, every material
interaction time, total time, and WebGL context-loss state. Non-2xx response,
missing readiness, wrong material state, page error, or unexpected viewer
context loss fails regardless of elapsed time. The intentional short-lived
capability-probe release through `WEBGL_lose_context` is recorded separately
and is not a viewer failure. The 600-second watchdog is CI anti-hang headroom,
not proof of acceptable end-user performance. A warning-free 21.85 MiB model
is runtime-accepted only after two fresh local passes and the pull-request CI
pass; the measured slowness remains an explicit performance risk.

## Error Handling And Safety Invariants

- Files above a hard limit continue to be rejected before bytes are staged for
  publication.
- Exact-limit files remain accepted because all hard checks use `>`.
- Content paths remain constrained to `assets/` and case-specific blueprint
  directories.
- Existing extension validation remains fail-closed; when the browser supplies
  a non-empty MIME type, it must remain allowlisted.
- SVG blueprints continue to render through `<img>`, not inline SVG or
  `<object>`; CSP `object-src 'none'` remains protected.
- The generator and content-publish auto-revert path continue to reject an
  oversized referenced asset before deployment.
- No workflow or branch-protection setting is changed by this task.

## Expected Implementation Surface

The implementation plan will verify exact line-level ownership, but the
expected hand-edited surface is limited to:

- `scripts/asset-budget.mjs`
- `scripts/asset-budget-audit.mjs`
- `scripts/model-runtime-contract.cjs`
- `verify-frozen.js`
- `package.json`
- `eslint.config.mjs`
- `admin/js/state.js`
- `admin/js/ui.js`
- `tests/quality/asset-budget.test.mjs`
- `tests/quality/admin-media.spec.mjs`
- `tests/quality/admin-case-blueprints.spec.mjs`
- `tests/quality/admin-free-assets.spec.mjs`
- `tests/quality/verify-frozen-fatal-exit.test.mjs`
- `tests/quality/model-runtime-contract.test.mjs`
- `tests/quality/design-modes.spec.mjs` (adjacent stale Hybrid assertion required
  for a green current-main ship gate; inline copy may use an overlay or the
  existing full-width fallback)
- `tests/quality/content-visibility.test.mjs` (adjacent stale zero-blueprint
  fixture required for a green current-main content gate; generator semantics
  use an explicit empty fixture instead of assuming the live catalog is empty)
- `README.md` (current Beget production publish route)
- `.github/workflows/content-publish.yml` (current deploy bridge comment)
- `AGENTS.md` (canonical pointer only, without copied numbers)
- `docs/admin-guide.md`
- `docs/agent/admin-panel/research.md` (dated current-carrier supersession)
- `docs/agent/verification.md`
- `docs/agent/admin-panel/tz.md`
- `docs/agent/admin-panel/handoff.md` (new superseding entry; no historical
  rewrite)
- `.agents/skills/codex-studio-assets/SKILL.md`
- `plugins/codex-studio-codex/skills/codex-studio-admin-rules/SKILL.md`
- `plugins/codex-studio-codex/skills/codex-studio-rules/SKILL.md`
- `plugins/codex-studio-codex/skills/codex-studio-frontend-rules/SKILL.md`

Generated harness mirrors may change only as output of `npm run sync:harness`.
No content JSON, generated content data, asset binary, deployment behavior, or
`js/model-data.js` change is expected. The `content-publish` workflow edit is a
comment-only correction of the already-live Beget delivery route.

## Verification And Acceptance

Verification proceeds from narrow to broad and records fresh command output:

1. Capture the existing RED fingerprint from the stale SVG/raster cross-class
   assertion as diagnosis, then replace it with independent boundary coverage
   that passes against the unchanged 2 MiB production limits.
2. Intentional RED for the explicit 25 MiB owner-contract assertion before the
   production and admin warning values change.
3. `node tests/quality/asset-budget.test.mjs`
4. Focused Playwright run for `admin-media.spec.mjs`
5. Focused Playwright run for `admin-case-blueprints.spec.mjs`
6. Focused Playwright run for `admin-free-assets.spec.mjs`
7. `npm run check:assets`
8. `npm run test:content-validate`
9. `npm run sync:harness`
10. `npm run check:parity`
11. `npm run codex:verify-plugin`
12. `npm run test:design-lab` to expose any independent current-main blocker
13. `npm run codex:ship`
14. Independent `/review` of the final diff and verification evidence
15. Push the `codex/*` branch, open a draft PR, and confirm its `quality` check
    is green

Success requires all of the following:

- no warning at exactly 25 MiB and a warning at 25 MiB + 1 byte;
- no hard failure at exactly 50 MiB and a hard failure at 50 MiB + 1 byte;
- repository hard limits still equal model 50 MiB, HDR 4 MiB, video 40 MiB,
  vector 2 MiB, and raster 2 MiB, while downloads remain warn-only;
- blueprint hard-limit parity is checked;
- current referenced assets produce zero hard-limit violations;
- the current 21.85 MiB model is no longer reported as a size warning;
- two fresh local browser/runtime runs and the PR run report `0 FAIL`, preserve
  normal clicks and all viewer assertions, and apply the 120-second target,
  180-second functional phase, and 600-second operational-watchdog contract;
- full `codex:ship` and the draft PR `quality` job pass;
- unrelated historical failed runs are reported accurately rather than
  presented as retroactively repaired.

## Rollback

The change is source-only and reversible. If the 25 MiB advisory policy must be
reconsidered, revert the canonical threshold, admin mirror/copy, focused tests,
and documentation together. Hard limits and runtime behavior remain unchanged,
so rollback does not require asset migration or production data repair.
