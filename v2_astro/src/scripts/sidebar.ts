/**
 * Sidebar runtime — tags-dropdown OR-filter, game-switch, cards-toggle
 * collapse state, and the public `codex:filter` event API.
 *
 * Ported from codex/js/main.js (v0.7.0 — tags-dropdown block at 765-1038,
 * setCollapsed at 2895-2918). Refactored as a single init() that re-runs
 * on every astro:page-load so View Transitions keep the bindings.
 *
 * Public events:
 *   • codex:filter — { category, filters[], gameOnly, visible }
 *   • codex:toggle — { collapsed }
 *
 * The frozen `:not(.tag-card)` selector requirement for v0.8 lives in the
 * Stage 8 animations module (gameAsset on Free Assets uses double-class
 * .work-card.tag-card). On the v2 portfolio page there are no .tag-card
 * elements, so the simple .work-card queries here are safe.
 */

type FilterKey = 'all' | 'hard-surface' | 'product' | 'organic' | 'prototyping' | 'animations' | 'cad';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  'hard-surface': 'Hard Surface',
  product: 'Product Viz',
  organic: 'Organic',
  prototyping: 'Mechanical',
  animations: 'Animation',
  cad: 'CAD',
};

interface SidebarState {
  selected: FilterKey[];
  gameOnly: boolean;
  collapsed: boolean;
}

/**
 * Highlight the work-card whose slug matches the current pathname
 * (/work/<slug>/). Re-runs after each View Transition swap because the
 * sidebar persists but the URL changes.
 */
function syncActiveCard() {
  const match = location.pathname.match(/^\/work\/([^/]+)\/?$/);
  const slug = match ? match[1] : null;
  const cards = document.querySelectorAll<HTMLElement>('.work-card[data-id]');
  for (const c of cards) {
    if (slug && c.dataset.id === slug) c.classList.add('work-card--active');
    else c.classList.remove('work-card--active');
  }
  // Scroll the active card into view inside the persistent cards-scroll —
  // helpful when a deep link or kbd nav moves to an off-screen item.
  if (!slug) return;
  const active = document.querySelector<HTMLElement>(`.work-card[data-id="${slug}"]`);
  const scroller = document.getElementById('cards-scroll');
  if (active && scroller) {
    const r = active.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    if (r.top < s.top || r.bottom > s.bottom) {
      active.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }
}

function init() {
  const dropdown = document.getElementById('tags-dropdown');
  const trigger = document.getElementById('tags-dropdown-trigger');
  const panel = document.getElementById('tags-dropdown-panel');
  const chipsHost = document.getElementById('tags-dropdown-chips');
  const placeholder = document.getElementById('tags-dropdown-placeholder');
  const overlay = document.getElementById('tags-dropdown-overlay');
  const countEl = document.getElementById('cards-count');
  const gameSwitch = document.getElementById('game-switch') as HTMLInputElement | null;
  const toggleBtn = document.getElementById('cards-toggle');
  const scrollEl = document.getElementById('cards-scroll');

  if (!dropdown || !trigger || !panel) return; // no sidebar on this page

  // Idempotency — bail when the swap re-runs init() against a node tree we
  // already wired up. Cleared by clearing data-sidebar-bound on swap-out.
  if (dropdown.dataset.sidebarBound === '1') return;
  dropdown.dataset.sidebarBound = '1';

  const checkboxes = Array.from(
    panel.querySelectorAll<HTMLInputElement>('.tags-dropdown__checkbox[data-filter]'),
  );
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('.work-card[data-category]:not(.tag-card)'),
  );

  const state: SidebarState = { selected: [], gameOnly: false, collapsed: false };

  // ── Filter application ────────────────────────────────────────────────────
  const isAllActive = () => state.selected.length === 0 || state.selected.includes('all');

  function updateCount(n: number) {
    if (!countEl) return;
    countEl.textContent = `${n} ${n === 1 ? 'project' : 'projects'}`;
  }

  function applyFilters() {
    const allActive = isAllActive();
    let visible = 0;
    for (const card of cards) {
      const cat = card.dataset.category ?? '';
      const catMatch = allActive || state.selected.includes(cat as FilterKey);
      const gameMatch = !state.gameOnly || card.dataset.gameAsset === 'true';
      const show = catMatch && gameMatch;
      card.hidden = !show;
      if (show) visible++;
    }
    document.body.classList.toggle('filter-game', state.gameOnly);
    updateCount(visible);

    document.dispatchEvent(
      new CustomEvent('codex:filter', {
        detail: {
          category: allActive ? 'all' : state.selected[0],
          filters: allActive ? ['all'] : state.selected.slice(),
          gameOnly: state.gameOnly,
          visible,
        },
      }),
    );
  }

  // ── Dropdown open/close ───────────────────────────────────────────────────
  function setOpen(open: boolean) {
    dropdown!.setAttribute('data-open', open ? 'true' : 'false');
    trigger!.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel!.hidden = !open;
  }

  // ── Chip rendering ────────────────────────────────────────────────────────
  function renderChips() {
    if (!chipsHost) return;
    chipsHost.innerHTML = '';
    const hasChips = state.selected.length > 0;
    dropdown!.setAttribute('data-has-chips', hasChips ? 'true' : 'false');
    if (placeholder) placeholder.style.display = hasChips ? 'none' : '';

    for (const key of state.selected) {
      const chip = document.createElement('span');
      chip.className = 'tags-dropdown__chip';
      chip.dataset.chipFilter = key;

      const label = document.createElement('span');
      label.className = 'tags-dropdown__chip-label';
      label.textContent = FILTER_LABELS[key] ?? key;
      chip.appendChild(label);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tags-dropdown__chip-remove';
      remove.setAttribute('aria-label', `Remove ${FILTER_LABELS[key] ?? key}`);
      remove.dataset.removeFilter = key;
      remove.textContent = '×';
      chip.appendChild(remove);

      chipsHost.appendChild(chip);
    }
  }

  function syncCheckboxes() {
    for (const cb of checkboxes) {
      cb.checked = state.selected.includes(cb.dataset.filter as FilterKey);
    }
  }

  function refresh() {
    syncCheckboxes();
    renderChips();
    applyFilters();
  }

  // ── Filter state mutators ─────────────────────────────────────────────────
  function selectFilter(key: FilterKey) {
    if (key === 'all') {
      state.selected = ['all'];
    } else {
      state.selected = state.selected.filter((f) => f !== 'all');
      if (!state.selected.includes(key)) state.selected.push(key);
    }
  }

  function deselectFilter(key: FilterKey) {
    state.selected = state.selected.filter((f) => f !== key);
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  trigger.addEventListener('click', (e) => {
    if ((e.target as Element).closest('.tags-dropdown__chip-remove')) return;
    setOpen(dropdown.getAttribute('data-open') !== 'true');
  });

  if (overlay) {
    const close = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    overlay.addEventListener('click', close);
    overlay.addEventListener('touchstart', close, { passive: false });
    overlay.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    overlay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  }

  if (chipsHost) {
    chipsHost.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLButtonElement>('.tags-dropdown__chip-remove');
      if (!btn) return;
      e.stopPropagation();
      const key = btn.dataset.removeFilter as FilterKey | undefined;
      if (!key) return;
      deselectFilter(key);
      refresh();
    });
  }

  for (const cb of checkboxes) {
    cb.addEventListener('change', () => {
      const key = cb.dataset.filter as FilterKey | undefined;
      if (!key) return;
      if (cb.checked) selectFilter(key);
      else deselectFilter(key);
      refresh();
    });
  }

  // Document-level: close on outside-click, Escape.
  const onDocClick = (e: MouseEvent) => {
    if (dropdown.getAttribute('data-open') !== 'true') return;
    if (dropdown.contains(e.target as Node)) return;
    setOpen(false);
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && dropdown.getAttribute('data-open') === 'true') {
      setOpen(false);
      trigger.focus();
    }
  };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);

  // ── Game-switch ───────────────────────────────────────────────────────────
  if (gameSwitch) {
    gameSwitch.addEventListener('change', () => {
      state.gameOnly = gameSwitch.checked;
      gameSwitch.setAttribute('aria-checked', state.gameOnly ? 'true' : 'false');
      applyFilters();
    });
  }

  // ── Cards-toggle (sidebar collapse) ───────────────────────────────────────
  function setCollapsed(collapsed: boolean) {
    if (!toggleBtn) return;
    state.collapsed = collapsed;
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleBtn.setAttribute(
      'aria-label',
      collapsed ? 'Show projects panel' : 'Hide projects panel',
    );
    const label = toggleBtn.querySelector<HTMLElement>('.cards-toggle__label');
    if (label) label.textContent = collapsed ? 'Show projects' : 'Hide projects';

    document.body.classList.toggle('cards-collapsed', collapsed);

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) {
      document.documentElement.style.setProperty('--sidebar-w', collapsed ? '56px' : '340px');
      if (scrollEl) (scrollEl as HTMLElement).hidden = collapsed;
    } else {
      if (scrollEl) (scrollEl as HTMLElement).hidden = false;
      document.documentElement.style.removeProperty('--sidebar-w');
    }

    document.dispatchEvent(new CustomEvent('codex:toggle', { detail: { collapsed } }));
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = toggleBtn.getAttribute('aria-expanded') === 'false';
      setCollapsed(!isCollapsed);
    });
  }

  // Initial paint — selectedFilters=[] → All works visible.
  refresh();

  // Tear down doc-level listeners + binding flag when the page swaps out so
  // the next page-load init can re-run cleanly.
  const onBeforeSwap = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onDocKey);
    delete dropdown.dataset.sidebarBound;
    document.removeEventListener('astro:before-swap', onBeforeSwap);
  };
  document.addEventListener('astro:before-swap', onBeforeSwap);
}

init();
syncActiveCard();
document.addEventListener('astro:page-load', () => {
  init();
  syncActiveCard();
});

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
