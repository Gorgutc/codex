/**
 * CaseBlueprints runtime (Stage 7b) — pager state for multi-page
 * technical drawings.  All pages are pre-rendered server-side; this
 * script just flips `.is-current` between siblings and keeps the
 * counter + aria-hidden in sync.
 *
 * Cycling wrap mirrors the legacy main.js:2061 (modulo prev/next so
 * the arrows never disable; same UX as the media-fs gallery).
 *
 * No keyboard shortcut is wired in 7b — case-view's ←/→ already paginate
 * between works, and the legacy never bound a separate blueprint
 * shortcut.  Stage 7c may add `Shift + ←/→` if it's needed.
 */

function init() {
  const canvas = document.getElementById('case-blueprints-canvas');
  if (!canvas || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';

  const total = Number(canvas.dataset.bpTotal ?? '0');
  if (total <= 1) return; // single-page work — pager is hidden, nothing to bind

  const prev = document.getElementById('case-blueprints-pager-prev');
  const next = document.getElementById('case-blueprints-pager-next');
  const counter = document.getElementById('case-blueprints-pager-counter');
  const pages = Array.from(
    canvas.querySelectorAll<HTMLElement>('.case-blueprints__page'),
  );
  if (pages.length === 0) return;

  let idx = 0;

  function setPage(next: number) {
    const target = ((next % total) + total) % total;
    if (target === idx) return;
    const prevEl = pages[idx];
    const nextEl = pages[target];
    if (!nextEl) return;
    prevEl?.classList.remove('is-current');
    prevEl?.setAttribute('aria-hidden', 'true');
    nextEl.classList.add('is-current');
    nextEl.setAttribute('aria-hidden', 'false');
    idx = target;
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
  }

  prev?.addEventListener('click', () => setPage(idx - 1));
  next?.addEventListener('click', () => setPage(idx + 1));
}

init();
document.addEventListener('astro:page-load', () => {
  init();
});

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
