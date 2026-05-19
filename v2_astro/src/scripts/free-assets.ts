/**
 * Free-assets runtime (Stage 9b) — tag selection, hash sync, grid filter.
 *
 * Server-side renders all 25 asset cards and pre-activates the first
 * tag-card.  On mount we read location.hash, switch to the matching
 * category if any, then wire tag-card click handlers + popstate/
 * hashchange listeners.
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

function init() {
  const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
  const grid = document.getElementById('fa-grid');
  if (!sidebar || !grid || grid.dataset.bound === '1') {
    // Re-init via astro:page-load is fine; bail if the wiring already
    // happened (Sidebar persists across navigations).
    if (grid?.dataset.bound === '1') refreshFromHash();
    return;
  }
  grid.dataset.bound = '1';

  // Bind tag-card clicks (sidebar can persist, bind once).
  if (!sidebar.dataset.faBound) {
    sidebar.dataset.faBound = '1';
    sidebar.addEventListener('click', onSidebarClick);
  }

  // Hash routing — initial + on change.
  window.addEventListener('hashchange', refreshFromHash);
  refreshFromHash();
}

function onSidebarClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  const card = target?.closest<HTMLElement>('.tag-card[data-tag]');
  if (!card) return;
  const tag = card.dataset.tag;
  if (!isTag(tag)) return;
  // Let the anchor's default `#tag` behaviour update location.hash;
  // hashchange will fire, refreshFromHash will activate. No
  // preventDefault — keeps back/forward and middle-click intact.
}

function refreshFromHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const tag: Tag = isTag(raw) ? raw : 'hard-surface';
  activate(tag);
}

function activate(tag: Tag) {
  // 1. Sidebar tag-card active state — flip class + aria-current.
  const tagCards = document.querySelectorAll<HTMLElement>('.tag-card[data-tag]');
  for (const c of tagCards) {
    const isActive = c.dataset.tag === tag;
    c.classList.toggle('tag-card--active', isActive);
    if (isActive) c.setAttribute('aria-current', 'page');
    else c.removeAttribute('aria-current');
  }

  // 2. Hide / show asset cards by data-asset-tag — pre-rendered server-
  //    side; we just flip the [hidden] attribute.
  let visible = 0;
  const cards = document.querySelectorAll<HTMLElement>('.fa-card[data-asset-tag]');
  for (const c of cards) {
    const show = c.dataset.assetTag === tag;
    c.hidden = !show;
    if (show) visible++;
  }

  // 3. Header chrome — category label, count, title.
  const catEl = document.getElementById('fa-view-cat');
  const cntEl = document.getElementById('fa-view-count');
  const titEl = document.getElementById('fa-view-title');
  const label = displayLabel(tag);
  if (catEl) catEl.textContent = label;
  if (cntEl) cntEl.textContent = `${visible} asset${visible === 1 ? '' : 's'}`;
  if (titEl) titEl.textContent = label;

  // 4. On mobile, collapse the sidebar so the user lands on the grid —
  //    parity with the legacy noCollapse=false behaviour. Initial-load
  //    refresh skips this to avoid surprising the user.
  if (initialLoadHandled) {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) document.body.classList.add('cards-collapsed');
  } else {
    initialLoadHandled = true;
  }
}

let initialLoadHandled = false;

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
