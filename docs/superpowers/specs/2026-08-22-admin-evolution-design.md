# Codex Studio Admin Evolution Design

**Date:** 2026-08-22

**Status:** approved by owner; implementation without Figma

**Baseline:** `main@11530c6da6d1bdbb5967d86e0db5a6bbe3751a73`

## Problem

The admin publish flow successfully committed and deployed the new Lumen One
cover plus six case-media files, but a returning browser showed the new cover
with the old case body. Production served the page shell with revalidation
while serving `js/cards-data.js` and `js/i18n-data.js` with a seven-day fresh
cache lifetime. A stable data-script URL therefore let a browser combine a new
HTML shell with an old content payload. A hard refresh made the new media
appear, which confirms cache incoherence rather than an upload, generator, or
deploy failure.

The case list also presents the internal case id, such as `corten-series`, as
the public hash URL. The id is coupled to source filenames, generated data,
translations, CSS selectors, admin routing, design modes, and some asset-path
validation. Renaming it to edit a public URL would break those contracts and
existing shared links.

The admin is structurally safe but increasingly difficult to operate. Six
media blocks already overflow the five-column editor, captions are separated
from their media, publish status is transient, and a reverted pipeline can
leave the owner without a retryable draft. Several user-visible global values
remain hardcoded or file-only even though the intended product boundary is
that site content, links, SEO, media, order, and visibility are owner-editable.

## Owner Decisions

1. Use the evolutionary approach; do not replace the admin with a generic CMS.
2. Do not create a Figma artifact. Preserve the current Codex Studio design
   language, tokens, density, typography, dark theme, vanilla stack, and
   interaction patterns.
3. Code implementation is delegated to Terra agents. The controller owns plan
   decisions, diff review, verification, and release acceptance.
4. Returning browsers must receive new generated content after a normal reload;
   `Ctrl+F5` must not be part of the publishing contract.
5. Keep case `id` stable. Add an independently editable public slug and legacy
   aliases instead of implementing id rename.
6. Preserve existing published hashes through client-side alias resolution.
7. “Editable site information” means content, links, SEO identity, media,
   ordering, visibility, and existing editorial settings. Runtime code,
   generator mechanics, security rules, design tokens, and cache policy remain
   code-controlled.
8. Deliver the evolution in independently releasable phases. The cache fix,
   slug contract, publish safety, media workflow, accessibility corrections,
   and critical global editability gaps form Release A. Structural catalog CRUD
   and binary-download transport follow as separate releases rather than being
   mixed into the cache repair.

## Goals

- Version generated data URLs deterministically so a changed payload always
  has a changed request URL on index, Free Assets, and admin preview surfaces.
- Preserve classic-script order and the no-build static hosting architecture.
- Add `slug` and `legacySlugs` without changing case ids or asset paths.
- Make canonical and legacy case hashes work in Original, Specimen, Chamber,
  Hybrid, admin preview, Copy Link, and JSON-LD.
- Keep a recoverable publish snapshot until the content-publish outcome settles
  and expose durable pipeline/release information in the admin.
- Rework the existing media editor using current components and tokens so each
  block owns its preview, format, type, seamless state, caption, validation,
  and reorder controls in one place.
- Correct the identified keyboard, labeling, navigation, live-region, and
  hidden-row contrast defects without introducing a new visual system.
- Move critical global identity/contact/structured-data values into validated
  content and expose them in the existing Meta area.
- Keep every generator and admin validation expectation derived from content,
  never pinned to the current case ids, visible counts, or number of blocks.

## Non-goals For Release A

- Renaming case ids, case JSON filenames, or asset directories.
- Server-side `/cases/<slug>` routes. Public case URLs remain hash routes.
- Replacing GitHub commits, content-publish, or Beget with a database CMS.
- WYSIWYG editing, a framework, a bundler, modules, or public-page storage.
- Redesigning public pages or the admin visual language.
- Deleting historical uploaded assets during replacement or rollback.
- Uploading large ZIP archives through GitHub. That needs a separately approved
  external-storage/transport design because of GitHub size and rollback limits.
- Combining `motionBlocks` and `media` in Release A; `ADM-MEDIA-03` remains an
  owner-gated structural migration.

## Release A Architecture

### 1. Deterministic generated-data revisions

`scripts/generate-content.mjs` remains the only writer of generated public
content. It calculates a short SHA-256 digest from the exact bytes it emits for
each generated data file and writes script references with that digest:

```text
./js/cards-data.js?v=<digest>
./js/i18n-data.js?v=<digest>
./js/fa-data.js?v=<digest>
```

The digest is a query string rather than a renamed file so rollback does not
need generated-file garbage collection and the no-build static host remains
unchanged. Only the corresponding payload changes its digest; generation is
deterministic. The HTML page still revalidates, then points the browser at the
new URL. Existing seven-day cached bytes under an older URL cannot satisfy the
new request.

The generator owns the versioned script references in both public pages and
the admin shell. Admin preview matches scripts by URL pathname rather than raw
`src` suffix so it can replace a versioned data script with draft data. Static
and browser verification require non-empty hexadecimal revisions and preserve
the existing classic-script order.

The deploy check must validate the normal public URL contract, not only an
origin request with a manual cache-busting query. Generated media already use
content-addressed filenames and keep their current behavior.

### 2. Stable ids and public slugs

Every case accepts:

```json
{
  "id": "corten-series",
  "slug": "happfe-dehydrator",
  "legacySlugs": ["corten-series"]
}
```

`slug` is optional in stored content and defaults to `id`. `legacySlugs` is
optional and defaults to an empty array. Every slug uses strict lowercase
kebab-case (`[a-z0-9]+(?:-[a-z0-9]+)*`) and must be unique across every case id,
canonical slug, and legacy alias. Empty aliases, duplicate aliases, aliases
equal to the canonical slug, and cross-case collisions fail closed in both the
generator and admin mirror validation.

Internal data keys, DOM `data-id`, source files, translations, media paths, 3D
state, and admin routes continue to use `id`. Generated card `href`, Copy Link,
and featured-work JSON-LD use the canonical slug. Generated case data exposes
the canonical slug and aliases so runtime routing can resolve a hash to an id.
Opening a legacy alias renders the same case and normalizes the hash with
`history.replaceState`; unknown-hash fallback behavior stays unchanged.

The case editor shows a read-only “Internal ID” and an editable “Case URL” with
the full `https://codex.promo/#<slug>` preview. When a previously published
canonical slug changes, the prior value is retained as a legacy alias. The
external project CTA remains a separate field with its existing allowlist.

### 3. Publish settlement and recovery

Submitting a publish creates a serializable publish snapshot containing the
draft content, pending-media metadata needed for recovery, source commit, and
timestamps. The admin does not irreversibly promote/clear the working draft
until the content-publish pipeline reports success.

The Publication surface uses the existing panel/card/button language and shows
the durable sequence:

```text
Draft -> source commit -> validation/generation -> deploy handoff -> production
```

It persists the last release state in the existing tab-scoped admin storage,
with source/generated commit links, timestamps, outcome, and failure reason.
On auto-revert or timeout, the owner can restore the snapshot and retry. On
success, the snapshot settles and the UI retains release evidence without
retaining the PAT outside the existing session contract. No public page gains
browser storage.

### 4. Media editor workflow

The editor keeps the existing `case.media[]` schema and manual order semantics.
At wide viewports it uses at most three summary cards per row; narrower screens
reduce columns using the existing responsive language. Each media card contains
its own caption fields and status. Technical file paths and long explanations
move behind a native details disclosure. One shared section-level explanation
replaces repeated seamless prose.

Reorder controls preserve drag-and-drop plus keyboard buttons, use comfortable
targets, restore focus, and keep the existing stable-id draft behavior. The
first card cannot become seamless, and all existing layout/seam validation
continues unchanged. This is a workflow re-layout, not a public-case redesign.

### 5. Accessibility and semantic hardening

- The preview becomes a true keyboard-contained modal, preferably native
  `<dialog>` when that can preserve existing styling and tests; otherwise the
  background is inert and Tab/Shift+Tab are trapped explicitly.
- Every input/select/textarea receives an associated label or an equivalent
  accessible name derived from the visible field label.
- Active admin navigation exposes `aria-current`.
- Disclosure controls expose `aria-controls` and stable controlled-region ids.
- The broad `aria-live` on the entire app is removed. Dedicated status and
  error live regions announce only meaningful changes.
- Hidden case rows remain visually subordinate without reducing functional
  text/control contrast below the project accessibility gate.
- Draft copy distinguishes locally saved text from memory-only uploads and
  offers Review changes and Discard draft actions.

### 6. Critical global editability

`content/meta.json` becomes the validated source for:

- public contact URL;
- Organization name, canonical URL, description, logo, and `sameAs` links;
- owner-curated featured works and their `about` copy.

The Meta admin screen edits those values. Generated visible contact anchors and
Organization/ItemList JSON-LD consume them; no hardcoded Telegram identity
remains in generated regions. Fixed technical SEO fields such as robots,
hreflang structure, OG type, Twitter card type, favicon wiring, and image
dimensions remain code-controlled.

Free Assets JSON-LD stops using a hardcoded per-id copy map. It derives name,
description, category, media, and download information from the already
editable visible item/category content, with validation that fails closed when
required structured-data values are absent. This removes an owner-content
mirror from both generator and verifier.

## Follow-up Releases

### Release B — structure and remaining editorial controls

- Safe create/archive/delete flows for cases, portfolio filters, Free Assets
  categories, and Free Assets items, with dependency previews and recoverable
  deletion plans.
- Existing-case controls for category, year, game-asset state, badges,
  tag-card cover/game state, model environment/exposure, and add/remove of
  text, inline, and motion sections.
- A coverage view that distinguishes editable, derived, and code-controlled
  fields so new content fields cannot silently bypass the admin.

### Release C — downloads and external binary transport

- A separately approved storage/upload path for ZIP archives larger than the
  GitHub workflow should carry.
- Production availability, real size, checksum, and rollback state reflected
  in admin preview and Publication status.

## Test Design

Implementation follows strict red-green-refactor cycles.

### Cache coherence

- A generator sandbox mutates one payload and proves only its deterministic
  revision changes.
- Public HTML and admin shell contain non-empty revisions while classic-script
  order remains unchanged.
- Admin preview replaces versioned data scripts by pathname.
- A persistent browser-context regression first caches an old payload, then
  loads regenerated HTML normally and must observe the new case data without
  clearing cache or adding a test-only query.

### Slugs

- Default `slug=id` leaves existing content valid.
- Valid canonical slug changes generated href and JSON-LD while internal data
  keys and `data-id` remain the original id.
- Unsafe or colliding canonical/legacy values fail generator and admin mirror
  validation.
- New slug, old alias, Copy Link, pagination, and every enabled design mode
  resolve/canonicalize correctly.
- Admin preview shows the new URL while CTA editing stays independent.

### Publish and media UX

- Success settles the snapshot only after pipeline success.
- Revert and timeout keep a restorable draft and durable release evidence.
- Modal keyboard traversal cannot escape and focus returns to the opener.
- Every rendered form control has an accessible name.
- Media reordering preserves media/caption/seamless identity and focus.
- Desktop and narrow admin screenshots show no five-column control squeeze or
  orphaned single card caused by the previous grid rule.

### Metadata

- Contact and Organization output derive from a sandboxed content fixture.
- Featured-work editor data remain content-derived and hidden cases stay out of
  JSON-LD.
- Free Assets JSON-LD follows editable item/category text without any fixed-id
  allowlist.

Every test derives cases, counts, categories, and block availability from its
fixture or current content. No test may assume that Corten, Lumen, a motion
owner, or a specific number of visible cards exists unless the test itself
constructs that fixture.

## Verification And Acceptance

Release A is accepted only after:

1. focused red-green evidence for every task;
2. `npm run content:check`;
3. `npm run test:content-validate`;
4. focused public/admin Playwright suites;
5. `npm run test:admin`;
6. `npm run verify` with `0 FAIL`;
7. `npm run codex:ship`;
8. task-level and whole-branch reviews with no open Critical/Important issue;
9. a draft PR on a `codex/*` branch;
10. Second-brain session/status update after repository release evidence exists.

The production acceptance scenario is a normal returning-browser reload after
new content is published. A forced reload is not accepted as proof.

## Rollback

Every Release A change is source-only. Reverting the branch restores stable
script URLs and the previous admin UI. Existing ids and asset paths never move.
Previously emitted legacy aliases remain harmless data. Publish snapshots are
tab-scoped and schema-versioned; incompatible snapshots are ignored with an
owner-visible recovery message rather than applied silently.
