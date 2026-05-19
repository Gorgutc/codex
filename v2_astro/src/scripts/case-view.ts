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
 */
import { navigate } from 'astro:transitions/client';

function init() {
  // Auto-collapse the sidebar on mobile whenever we're on /work/<slug>/ —
  // mirrors the legacy setCollapsed(true) call inside openCase() so the
  // case-view comes up over a tucked-away sidebar. Desktop is unaffected.
  applyMobileCollapse();

  const root = document.getElementById('case-view');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  bindTabs(root);
  bindCopyLink();
  bindProgress();
  bindNav();
  bindBack();
}

function applyMobileCollapse() {
  const onWork = /^\/work\/[^/]+\/?$/.test(location.pathname);
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  if (onWork && isMobile) {
    document.body.classList.add('cards-collapsed');
  }
}

// ── Tabs ────────────────────────────────────────────────────────────────────
function bindTabs(root: HTMLElement) {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.case-tab[data-viz]'));
  const panels = {
    '2d': document.getElementById('case-scroll'),
    '3d': document.getElementById('case-3d'),
    blueprints: document.getElementById('case-blueprints'),
  } as const;

  function activate(viz: '2d' | '3d' | 'blueprints') {
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
    // Stage 6 — signal the lazy-loader to register <model-viewer> the first
    // time the 3D tab is activated. case-3d.ts listens for this and runs
    // ensureModelViewer() exactly once per session.
    if (viz === '3d') {
      document.dispatchEvent(new CustomEvent('codex:3d-open'));
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => {
      const viz = t.dataset.viz as '2d' | '3d' | 'blueprints' | undefined;
      if (viz) activate(viz);
    });
  }
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
