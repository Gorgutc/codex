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

  // Wire 3D thumbnail previews on the fa-cards. Mirrors the legacy
  // v0.7.5 lazy-init: model-viewer module loads on the first card hitting
  // the viewport, then customElements.define() upgrades every <model-viewer>
  // in the grid; per-card loadfailure handlers flip --failed so the SVG
  // poster stays visible if the GLB is missing / blocked.
  setupFaModelViewers(grid);
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

  // Each MV reports its own loadfailure (404 / CORS / parse) — mark the
  // card so CSS hides the MV layer and the SVG poster shows through.
  for (const mv of mvs) {
    mv.addEventListener('error', (e) => {
      const evt = e as unknown as CustomEvent<{ type?: string }>;
      if (evt.detail?.type === 'loadfailure') {
        mv.classList.add('fa-card__thumb-mv--failed');
      }
    });
  }

  // Lazy-load the model-viewer module when the first card enters the
  // viewport — keeps the cold-load 2D-only and matches the legacy
  // js/free-assets.js:280 IntersectionObserver gate.
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
  // Skip if the user explicitly wants a new tab / back-and-forward
  // semantics — only intercept the plain click path.
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const tag = card.dataset.tag;
  if (!isTag(tag)) return;
  // ClientRouter / Lenis can swallow the native hash navigation in some
  // edge cases (we observed it on /work -> /free-assets transitions
  // during the May QA pass — clicking a tag-card no longer triggered
  // hashchange). Take ownership of the navigation explicitly: prevent
  // default, push the hash, and run activate() directly.
  e.preventDefault();
  if (location.hash !== `#${tag}`) {
    history.pushState(history.state, '', `#${tag}`);
  }
  activate(tag);
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
