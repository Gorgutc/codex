/**
 * Free-assets runtime — tag selection, hash sync, grid filter, plus the
 * legacy tags-dropdown + game-switch combo from codex/free-assets.js.
 *
 * Server-side renders all 25 asset cards and pre-activates the first
 * tag-card.  On mount we read location.hash, switch to the matching
 * category if any, then wire:
 *   - Tag-card clicks (sidebar category navigation)
 *   - hashchange (back/forward + deep-link)
 *   - tags-dropdown checkboxes (filters which tag-cards stay visible in
 *     the sidebar list; "All" or empty selection = show all)
 *   - game-switch (FA semantics — filters fa-cards in the ACTIVE category
 *     by `data-game-asset`, not the categories themselves; v0.8.9 [L5])
 *   - 3D thumbnail lazy-load (model-viewer module gates on first
 *     fa-card hitting the viewport, matches legacy v0.7.5)
 *
 * Filtering is `[hidden]`-based on the pre-rendered cards so we don't
 * need to re-execute templates on every category switch.
 */

const TAGS = [
  'hard-surface',
  'product',
  'game',
  'organic',
  'animation',
  'cad',
] as const;
type Tag = (typeof TAGS)[number];

function isTag(s: string | null | undefined): s is Tag {
  return !!s && (TAGS as readonly string[]).includes(s);
}

interface FaState {
  activeTag: Tag;
  gameOnly: boolean;
}
const state: FaState = { activeTag: 'hard-surface', gameOnly: false };

function init() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
  const grid = document.getElementById('fa-grid');
  if (!sidebar || !grid) return;

  if (grid.dataset.bound !== '1') {
    grid.dataset.bound = '1';
    setupFaModelViewers(grid);
  }

  // Bind tag-card clicks (sidebar can persist, bind once).
  if (!sidebar.dataset.faBound) {
    sidebar.dataset.faBound = '1';
    sidebar.addEventListener('click', onSidebarClick);
  }

  // Pick up the live game-switch state — sidebar persists across
  // navigations, so the DOM checkbox can be `checked` from a previous
  // visit while module-scoped `state.gameOnly` is fresh false.
  const gameSwitch = document.getElementById('game-switch') as HTMLInputElement | null;
  if (gameSwitch) state.gameOnly = gameSwitch.checked;

  // sidebar.ts owns the dropdown trigger + game-switch listeners; it
  // dispatches `codex:filter` with the full {filters, gameOnly} state
  // on every change. We listen once, document-scope, and tear down on
  // `astro:before-swap` so navigations don't stack handlers.
  if (!document.documentElement.dataset.faGlobalsBound) {
    document.documentElement.dataset.faGlobalsBound = '1';
    document.addEventListener('codex:filter', onCodexFilter);
    window.addEventListener('hashchange', refreshFromHash);
    document.addEventListener('astro:before-swap', teardownFaGlobals);
  }

  refreshFromHash();
}

function teardownFaGlobals() {
  document.removeEventListener('codex:filter', onCodexFilter);
  window.removeEventListener('hashchange', refreshFromHash);
  document.removeEventListener('astro:before-swap', teardownFaGlobals);
  delete document.documentElement.dataset.faGlobalsBound;
}

let mvLoadingPromise: Promise<unknown> | null = null;
function ensureModelViewer(): Promise<unknown> {
  if (mvLoadingPromise) return mvLoadingPromise;
  if (typeof customElements !== 'undefined' && customElements.get('model-viewer')) {
    mvLoadingPromise = Promise.resolve();
    return mvLoadingPromise;
  }
  mvLoadingPromise = import('@google/model-viewer').catch((err) => {
    console.warn('[free-assets] model-viewer load failed', err);
    mvLoadingPromise = null;
    throw err;
  });
  return mvLoadingPromise;
}

function setupFaModelViewers(grid: HTMLElement) {
  const mvs = Array.from(grid.querySelectorAll<HTMLElement>('.fa-card__thumb-mv'));
  if (mvs.length === 0) return;

  for (const mv of mvs) {
    mv.addEventListener('error', (e) => {
      const evt = e as unknown as CustomEvent<{ type?: string }>;
      if (evt.detail?.type === 'loadfailure') {
        mv.classList.add('fa-card__thumb-mv--failed');
      }
    });
  }

  if (!('IntersectionObserver' in window)) {
    ensureModelViewer();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    ensureModelViewer();
  }, { rootMargin: '200px' });
  for (const mv of mvs.slice(0, 4)) observer.observe(mv);
}

function onSidebarClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  const card = target?.closest<HTMLAnchorElement>('a.tag-card[data-tag]');
  if (!card) return;
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const tag = card.dataset.tag;
  if (!isTag(tag)) return;
  // ClientRouter / Lenis can swallow native hash navigation in some
  // edge cases (observed on /work -> /free-assets transitions). Take
  // ownership: prevent default, push hash, run activate().
  e.preventDefault();
  if (location.hash !== `#${tag}`) {
    history.pushState(history.state, '', `#${tag}`);
  }
  activate(tag, { fromUser: true });
}

function refreshFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const tag: Tag = isTag(raw) ? raw : 'hard-surface';
  activate(tag, { fromUser: !!raw });
}

function activate(tag: Tag, opts: { fromUser?: boolean } = {}) {
  state.activeTag = tag;

  // 1. Sidebar tag-card active state — flip class + aria-current.
  const tagCards = document.querySelectorAll<HTMLElement>('.tag-card[data-tag]');
  for (const c of tagCards) {
    const isActive = c.dataset.tag === tag;
    c.classList.toggle('tag-card--active', isActive);
    if (isActive) c.setAttribute('aria-current', 'page');
    else c.removeAttribute('aria-current');
  }

  // 2. Show only the asset cards belonging to this category, then layer
  //    the game-switch filter on top if it's currently on.
  applyAssetFilter();

  // 3. Header chrome — category label + title (count handled in applyAssetFilter).
  const catEl = document.getElementById('fa-view-cat');
  const titEl = document.getElementById('fa-view-title');
  const label = displayLabel(tag);
  if (catEl) catEl.textContent = label;
  if (titEl) titEl.textContent = label;

  // 4. Mobile: collapse the sidebar so the user lands on the grid —
  //    parity with the legacy noCollapse=false. Only auto-collapse on
  //    user-driven activations (tag-card click / hashchange) so the
  //    initial SSR render doesn't surprise direct-link visitors.
  if (opts.fromUser) {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) document.body.classList.add('cards-collapsed');
  }
}

/**
 * Apply the combined category + game-switch filter to the asset grid
 * and update both the view-count ("8 assets") and sidebar cards-count
 * ("8 assets" / "8 assets (game-only)") readouts.
 */
function applyAssetFilter() {
  const cards = document.querySelectorAll<HTMLElement>('.fa-card[data-asset-tag]');
  let visible = 0;
  for (const c of cards) {
    const inCategory = c.dataset.assetTag === state.activeTag;
    const isGame = c.dataset.gameAsset === 'true';
    const show = inCategory && (!state.gameOnly || isGame);
    c.hidden = !show;
    if (show) visible++;
  }
  const cntEl = document.getElementById('fa-view-count');
  if (cntEl) {
    cntEl.textContent = `${visible} asset${visible === 1 ? '' : 's'}${state.gameOnly ? ' (game-only)' : ''}`;
  }
  // Sidebar cards-count mirrors the header count once a category is open.
  const sideCnt = document.getElementById('cards-count');
  if (sideCnt) {
    sideCnt.textContent = `${visible} asset${visible === 1 ? '' : 's'}${state.gameOnly ? ' (game-only)' : ''}`;
  }
}

/**
 * Dropdown filter listener — picks up sidebar.ts' codex:filter events
 * and hides tag-cards whose tag isn't in the selected set. "All" or
 * empty selection = show every tag-card.
 */
/**
 * Single sidebar.ts -> free-assets.ts handshake. sidebar.ts dispatches
 * `codex:filter` whenever any of its tracked inputs change (dropdown
 * checkboxes or the game-switch). We mirror its truth into state and
 * re-paint both the tag-card visibility and the asset grid in one go.
 *
 * Reading `gameOnly` from the event detail (instead of binding a second
 * `change` listener on #game-switch) avoids the stale-state race where
 * sidebar.ts fires its own applyFilters → codex:filter BEFORE our local
 * listener flipped state.gameOnly.
 */
function onCodexFilter(e: Event) {
  const ev = e as CustomEvent<{ filters?: string[]; gameOnly?: boolean }>;
  const filters = ev.detail?.filters ?? [];
  if (typeof ev.detail?.gameOnly === 'boolean') {
    state.gameOnly = ev.detail.gameOnly;
  }
  const isAll = filters.length === 0 || filters.includes('all');
  const tagCards = document.querySelectorAll<HTMLElement>('.tag-card[data-tag]');
  for (const c of tagCards) {
    const tag = c.dataset.tag;
    c.hidden = !isAll && !!tag && !filters.includes(tag);
  }
  // sidebar.ts' applyFilters writes "0 projects" to #cards-count when
  // the work-card array is empty (always on FA). Re-stamp with the
  // accurate "N assets" string.
  applyAssetFilter();
}

function displayLabel(tag: Tag): string {
  switch (tag) {
    case 'hard-surface':
      return 'Hard Surface';
    case 'product':
      return 'Product Viz';
    case 'game':
      return 'Game Assets';
    case 'organic':
      return 'Organic';
    case 'animation':
      return 'Animation';
    case 'cad':
      return 'CAD';
  }
}

init();
document.addEventListener('astro:page-load', init);

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
