/**
 * CaseView runtime — tab switching, COPY LINK, progress bar, keyboard
 * arrow navigation. The /work/<slug>/ route handles per-case routing
 * via the Astro ClientRouter (View Transitions), so prev/next arrows
 * and the ← → keys simply call navigate().
 *
 * Re-runs on every `astro:page-load` so each new case page gets fresh
 * bindings against the swapped main-area DOM.  The sidebar persists,
 * so its work-card list is the source of truth for prev/next order
 * (it already honours the active filters via sidebar.ts).
 *
 * Active tab persists across case switches via `?tab=` URL param —
 * propagated to /work/* navigations via astro:before-preparation so
 * clicking a sidebar card preserves whatever viz the user was viewing.
 */
import { navigate } from 'astro:transitions/client';

type Viz = '2d' | '3d' | 'blueprints';
const VALID_TABS: readonly Viz[] = ['2d', '3d', 'blueprints'] as const;

function isViz(s: string | null | undefined): s is Viz {
  return !!s && (VALID_TABS as readonly string[]).includes(s);
}

function readTabFromUrl(): Viz {
  const t = new URL(location.href).searchParams.get('tab');
  return isViz(t) ? t : '2d';
}

function writeTabToUrl(viz: Viz) {
  const url = new URL(location.href);
  if (viz === '2d') url.searchParams.delete('tab');
  else url.searchParams.set('tab', viz);
  const next = url.pathname + (url.search || '') + url.hash;
  history.replaceState(history.state, '', next);
}

function init() {
  applyMobileCollapse();

  const root = document.getElementById('case-view');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const activate = bindTabs(root);
  bindCopyLink();
  bindProgress();
  bindNav();
  bindBack();

  // Restore the tab the user was on before navigating here. The page is
  // statically rendered with 2D active, so this may flash 2D → 3D on a
  // very slow first paint — masked by html.is-loading until preloader
  // finishes (BaseLayout) and tucked behind a rAF below.
  const desired = readTabFromUrl();
  if (desired !== '2d') {
    requestAnimationFrame(() => activate(desired));
  }
}

function applyMobileCollapse() {
  const onWork = /^\/work\/[^/]+\/?$/.test(location.pathname);
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  if (onWork && isMobile) {
    document.body.classList.add('cards-collapsed');
  }
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function bindTabs(root: HTMLElement): (viz: Viz) => void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.case-tab[data-viz]'));
  const panels = {
    '2d': document.getElementById('case-scroll'),
    '3d': document.getElementById('case-3d'),
    blueprints: document.getElementById('case-blueprints'),
  } as const;

  function activate(viz: Viz) {
    for (const t of tabs) {
      const isActive = t.dataset.viz === viz;
      t.classList.toggle('case-tab--active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const [key, el] of Object.entries(panels)) {
      if (!el) continue;
      const isActive = key === viz;
      el.hidden = !isActive;
      el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    }
    writeTabToUrl(viz);
    if (viz === '3d') {
      document.dispatchEvent(new CustomEvent('codex:3d-open'));
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => {
      const viz = t.dataset.viz as Viz | undefined;
      if (viz) activate(viz);
    });
  }

  return activate;
}

// ── COPY LINK (desktop + mobile share buttons) ──────────────────────────────
function bindCopyLink() {
  // Wire both share buttons through the same handler. Mobile uses an
  // icon-only layout where the COPY LINK label is visually-hidden until
  // .case-share--copied flips it to "COPIED ✓" — handled via CSS.
  for (const id of ['case-share-desktop', 'case-share-mobile']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const label = btn.querySelector<HTMLElement>('.case-share__label');
    const originalLabel = label?.textContent ?? 'COPY LINK';

    btn.addEventListener('click', async () => {
      const url = window.location.href;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          // Fallback for non-https / older browsers.
          const tmp = document.createElement('input');
          tmp.value = url;
          tmp.setAttribute('readonly', '');
          tmp.style.position = 'fixed';
          tmp.style.opacity = '0';
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
        }
        btn.classList.add('case-share--copied');
        if (label) label.textContent = 'COPIED ✓';
        window.setTimeout(() => {
          btn.classList.remove('case-share--copied');
          if (label) label.textContent = originalLabel;
        }, 1500);
      } catch (err) {
        // Quiet failure — typically clipboard permission denied.
        console.warn('[case-view] copy failed', err);
      }
    });
  }
}

// ── Mobile "Back to projects" — drop cards-collapsed so the sidebar slides in
function bindBack() {
  const btn = document.getElementById('case-back');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.body.classList.remove('cards-collapsed');
  });
}

// ── Scroll progress ─────────────────────────────────────────────────────────
function bindProgress() {
  const scroll = document.getElementById('case-scroll');
  const bar = document.getElementById('case-progress-bar');
  if (!scroll || !bar) return;

  let queued = false;
  function update() {
    if (!scroll || !bar) return;
    const max = scroll.scrollHeight - scroll.clientHeight;
    const pct = max > 0 ? (scroll.scrollTop / max) * 100 : 0;
    bar.style.width = pct.toFixed(2) + '%';
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }
  scroll.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

// ── Prev/Next + keyboard navigation ─────────────────────────────────────────
function bindNav() {
  const prev = document.getElementById('case-prev');
  const next = document.getElementById('case-next');

  prev?.addEventListener('click', () => navigateSibling(-1));
  next?.addEventListener('click', () => navigateSibling(+1));

  // Document-level kbd — listener is per-page-load init, so no duplicates.
  document.addEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent) {
  // Skip when typing in a field or modifier keys are held.
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement | null;
  if (target?.matches?.('input, textarea, [contenteditable="true"]')) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateSibling(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateSibling(+1);
  }
}

function navigateSibling(delta: -1 | 1) {
  const match = location.pathname.match(/^\/work\/([^/]+)\/?$/);
  if (!match) return;
  const currentSlug = match[1];

  // Use the sidebar list as the canonical order (already filtered by
  // any active disciplines / game-switch — those cards have hidden=true).
  const cards = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('.work-card[data-id]:not([hidden])'),
  );
  if (cards.length === 0) return;
  const idx = cards.findIndex((c) => c.dataset.id === currentSlug);
  if (idx === -1) return;
  // Wrap-around — feels natural with a finite list.
  const next = (idx + delta + cards.length) % cards.length;
  const target = cards[next];
  if (!target) return;
  navigate(target.getAttribute('href') ?? '/');
}

init();
document.addEventListener('astro:page-load', () => {
  init();
});
// Remove the document-level keyboard listener before swap so the next
// page-load init can attach a fresh one against the new case context.
document.addEventListener('astro:before-swap', () => {
  document.removeEventListener('keydown', onKey);
});

// ── Propagate ?tab= across case-to-case navigations ────────────────────────
// Sidebar work-card anchors render as plain /work/<slug>/ at build time.
// When the user is on /work/A/?tab=3d and clicks /work/B/, the ClientRouter
// would otherwise drop the query string. Intercept the navigation URL and
// carry the current tab forward so the next page restores the same viz.
document.addEventListener('astro:before-preparation', (e: Event) => {
  const ev = e as Event & { to?: URL; from?: URL };
  if (!ev.to) return;
  if (!/^\/work\/[^/]+\/?$/.test(ev.to.pathname)) return;
  if (ev.to.searchParams.has('tab')) return;
  const currentTab = new URL(location.href).searchParams.get('tab');
  if (currentTab && (VALID_TABS as readonly string[]).includes(currentTab) && currentTab !== '2d') {
    ev.to.searchParams.set('tab', currentTab);
  }
});
