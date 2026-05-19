/**
 * CaseBlueprints runtime (Stages 7b + 7c) — pager state for multi-page
 * technical drawings + per-page Export-SVG + Fullscreen overlay.
 *
 * All pages are pre-rendered server-side; this script flips `.is-current`
 * between siblings, keeps the counter / aria-hidden in sync, and wires
 * the top-toolbar Export + Fullscreen buttons against the currently
 * visible page.
 *
 * Export builds a fresh forExport SVG (with embedded grid + title
 * block) via buildBlueprintSVG, runs it through decorateExportSvg to
 * inline the dark-theme blueprint CSS + background rect, then triggers
 * a Blob download.
 */
import { buildBlueprintSVG, getBlueprintPages } from '~/lib/blueprint';
import {
  bpFileSuffix,
  decorateExportSvg,
  downloadSvg,
} from '~/lib/blueprint-export';

function init() {
  const canvas = document.getElementById('case-blueprints-canvas');
  if (!canvas || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';

  const total = Number(canvas.dataset.bpTotal ?? '0');
  if (total === 0) return; // no blueprint data — bail entirely

  const pages = Array.from(
    canvas.querySelectorAll<HTMLElement>('.case-blueprints__page'),
  );
  if (pages.length === 0) return;

  let idx = 0;

  // ── Pager (Stage 7b) ────────────────────────────────────────────────────
  const prevBtn = document.getElementById('case-blueprints-pager-prev');
  const nextBtn = document.getElementById('case-blueprints-pager-next');
  const counter = document.getElementById('case-blueprints-pager-counter');

  function setPage(next: number) {
    if (total <= 1) return;
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

  prevBtn?.addEventListener('click', () => setPage(idx - 1));
  nextBtn?.addEventListener('click', () => setPage(idx + 1));

  // ── Slug (Stage 7c) ─────────────────────────────────────────────────────
  // Top-toolbar handlers need the current work's slug to regenerate the
  // forExport SVG. Pulled from the URL pathname so we don't have to
  // thread props through the markup.
  function currentSlug(): string | null {
    const match = location.pathname.match(/^\/work\/([^/]+)\/?$/);
    return match ? (match[1] ?? null) : null;
  }
  function currentTitle(): string {
    return document.getElementById('case-title')?.textContent?.trim() || '';
  }
  function currentYearText(): string {
    return document.getElementById('case-year')?.textContent?.trim() || '';
  }

  // ── Export-SVG (Stage 7c) ──────────────────────────────────────────────
  const exportBtn = document.getElementById('case-blueprints-export');
  exportBtn?.addEventListener('click', () => {
    const slug = currentSlug();
    if (!slug) return;
    const title = currentTitle();
    const year = currentYearText() || undefined;
    const svgString = buildBlueprintSVG(slug, idx, {
      title,
      year,
      forExport: true,
    });
    if (!svgString) return;
    const decorated = decorateExportSvg(svgString);
    const totalPages = getBlueprintPages(slug).length;
    downloadSvg(decorated, bpFileSuffix(slug, idx, totalPages));
  });

  // ── Fullscreen (Stage 7c) ──────────────────────────────────────────────
  const fsBtn = document.getElementById('case-blueprints-fs');
  const overlay = document.getElementById('case-blueprints-fs-overlay');
  const fsCanvas = document.getElementById('case-blueprints-fs-canvas');
  let scrollLocked = false;

  function openFs() {
    if (!overlay || !fsCanvas) return;
    const slug = currentSlug();
    if (!slug) return;
    const svgString = buildBlueprintSVG(slug, idx, {
      title: currentTitle(),
      year: currentYearText() || undefined,
      forExport: true,
    });
    if (!svgString) return;
    fsCanvas.innerHTML = decorateExportSvg(svgString);
    overlay.hidden = false;
    document.body.classList.add('has-blueprint-fs');
    scrollLocked = true;
    document.addEventListener('keydown', onFsKey);
    // Move focus to the close button so screen-reader users land in the
    // dialog and Esc/Tab navigation behaves predictably.
    const closeBtn = document.getElementById('case-blueprints-fs-close');
    closeBtn?.focus();
  }

  function closeFs() {
    if (!overlay) return;
    overlay.hidden = true;
    if (fsCanvas) fsCanvas.innerHTML = '';
    document.body.classList.remove('has-blueprint-fs');
    scrollLocked = false;
    document.removeEventListener('keydown', onFsKey);
    fsBtn?.focus();
  }

  function onFsKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFs();
    }
  }

  fsBtn?.addEventListener('click', openFs);
  overlay?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.bpFsClose !== undefined) closeFs();
  });

  // Clean up before View Transitions swap.
  const onBeforeSwap = () => {
    if (scrollLocked) closeFs();
    document.removeEventListener('astro:before-swap', onBeforeSwap);
  };
  document.addEventListener('astro:before-swap', onBeforeSwap);
}

init();
document.addEventListener('astro:page-load', () => {
  init();
});

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
