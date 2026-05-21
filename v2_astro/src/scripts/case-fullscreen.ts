/**
 * Case fullscreen image gallery — recovers the legacy main.js:3174-3450
 * `.media-fs` overlay (open, navigate, close) for the 2D case-scroll.
 *
 * Scope:
 *   • Singleton overlay built lazily on first image click and appended
 *     to <body>. Re-used across all case pages — survives View
 *     Transitions because it lives outside the swapped main-area.
 *   • Delegated click on .case-item__img picks up every gallery thumb
 *     under a [data-gallery] scope (set by CaseScroll on its track).
 *   • Open: fade overlay in, clone the image into the stage, focus the
 *     close button, lock document scroll.
 *   • Close: reverse fade, return focus to source thumb. ESC + backdrop
 *     click + close-btn all wire through closeFs().
 *   • Nav: cycle through siblings in the same data-gallery; prev/next
 *     buttons, ← / → keys, and the left/right halves of the backdrop
 *     (matches the legacy click-zone behaviour).
 *
 * Animation: pure CSS opacity transition. The legacy FLIP from thumb
 * rect into fullscreen needed GSAP and was the only reason main.js had
 * to ship eagerly. v2 leaves that to a future polish; today the
 * 200-ms fade matches the legacy reduced-motion fallback so the
 * functional parity arrives first.
 */

let overlay: HTMLElement | null = null;
let stageEl: HTMLElement | null = null;
let counterEl: HTMLElement | null = null;
let announcerEl: HTMLElement | null = null;
let prevBtn: HTMLButtonElement | null = null;
let nextBtn: HTMLButtonElement | null = null;
let closeBtn: HTMLButtonElement | null = null;

let listEls: HTMLImageElement[] = [];
let listIndex = 0;
let sourceThumb: HTMLImageElement | null = null;
let previousFocus: HTMLElement | null = null;
let isOpen = false;

function svgIcon(path: string, viewBox = '0 0 18 18'): string {
  return (
    `<svg class="media-fs__nav-icon" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="${path}"></path>` +
    `</svg>`
  );
}

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'media-fs';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image gallery viewer');
  overlay.hidden = true;

  stageEl = document.createElement('div');
  stageEl.className = 'media-fs__stage';

  closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'media-fs__close';
  closeBtn.setAttribute('aria-label', 'Close fullscreen');
  closeBtn.setAttribute('title', 'Close fullscreen');
  closeBtn.setAttribute('data-cursor', 'link');
  closeBtn.innerHTML =
    '<svg class="media-fs__close-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">' +
    '<path d="M6 2v4H2M12 2v4h4M2 12h4v4M12 16v-4h4"></path>' +
    '</svg>';
  closeBtn.addEventListener('click', closeFs);

  prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'media-fs__prev';
  prevBtn.setAttribute('aria-label', 'Previous image');
  prevBtn.setAttribute('data-cursor', 'link');
  prevBtn.hidden = true;
  prevBtn.innerHTML = svgIcon('M11 4L5 9l6 5');
  prevBtn.addEventListener('click', () => navFs(-1));

  nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'media-fs__next';
  nextBtn.setAttribute('aria-label', 'Next image');
  nextBtn.setAttribute('data-cursor', 'link');
  nextBtn.hidden = true;
  nextBtn.innerHTML = svgIcon('M7 4l6 5-6 5');
  nextBtn.addEventListener('click', () => navFs(1));

  counterEl = document.createElement('div');
  counterEl.className = 'media-fs__counter';
  counterEl.hidden = true;

  announcerEl = document.createElement('div');
  announcerEl.className = 'media-fs__announcer';
  announcerEl.setAttribute('aria-live', 'polite');
  announcerEl.setAttribute('aria-atomic', 'true');

  overlay.append(closeBtn, prevBtn, nextBtn, counterEl, announcerEl, stageEl);

  // Backdrop click — in gallery mode the legacy behaviour navigates by
  // half-screen instead of closing, which feels much better with > 2
  // images. Click on a button (close/prev/next) bubbles but its target
  // is the button, not the overlay, so the navigate branch only triggers
  // on actual backdrop clicks.
  overlay.addEventListener('click', (e) => {
    if (e.target !== overlay && e.target !== stageEl) return;
    if (listEls.length > 1) {
      navFs(e.clientX < window.innerWidth / 2 ? -1 : 1);
    } else {
      closeFs();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

function setCounter() {
  if (!counterEl) return;
  counterEl.textContent = `${listIndex + 1} / ${listEls.length}`;
}

function announce() {
  if (!announcerEl) return;
  const cur = listEls[listIndex];
  announcerEl.textContent = `${cur?.alt ?? 'Image'} (${listIndex + 1} of ${listEls.length})`;
}

function buildClone(srcImg: HTMLImageElement): HTMLImageElement {
  const clone = srcImg.cloneNode(false) as HTMLImageElement;
  clone.removeAttribute('class');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-haspopup');
  clone.removeAttribute('aria-label');
  clone.removeAttribute('style');
  clone.removeAttribute('onerror');
  clone.loading = 'eager';
  return clone;
}

function showImage(srcImg: HTMLImageElement) {
  if (!stageEl) return;
  while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
  stageEl.appendChild(buildClone(srcImg));
  setCounter();
  announce();
}

function navFs(delta: -1 | 1) {
  if (listEls.length < 2) return;
  const total = listEls.length;
  listIndex = (listIndex + delta + total) % total;
  const next = listEls[listIndex];
  if (next) {
    sourceThumb = next;
    showImage(next);
  }
}

function onKey(e: KeyboardEvent) {
  if (!isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeFs();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navFs(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navFs(1);
  } else if (e.key === 'Tab') {
    // Lightweight focus trap: keep tabs cycling between close/prev/next.
    const focusables = [closeBtn, prevBtn, nextBtn].filter(
      (b): b is HTMLButtonElement => !!b && !b.hidden,
    );
    if (focusables.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = focusables.indexOf(active as HTMLButtonElement);
    if (e.shiftKey) {
      if (idx <= 0) {
        e.preventDefault();
        focusables[focusables.length - 1]?.focus();
      }
    } else {
      if (idx === focusables.length - 1) {
        e.preventDefault();
        focusables[0]?.focus();
      }
    }
  }
}

function openFsImageGallery(sourceImg: HTMLImageElement) {
  ensureOverlay();
  // Resolve gallery scope — any [data-gallery] ancestor; otherwise treat
  // the clicked image as a 1-of-1.
  const scope = sourceImg.closest<HTMLElement>('[data-gallery]');
  const imgs = scope
    ? Array.from(scope.querySelectorAll<HTMLImageElement>('img'))
    : [sourceImg];
  listEls = imgs.filter((i) => i.isConnected);
  if (listEls.length === 0) return;
  listIndex = Math.max(0, listEls.indexOf(sourceImg));
  sourceThumb = sourceImg;
  previousFocus = sourceImg;

  if (prevBtn) prevBtn.hidden = listEls.length < 2;
  if (nextBtn) nextBtn.hidden = listEls.length < 2;
  if (counterEl) counterEl.hidden = listEls.length < 2;

  showImage(sourceImg);

  if (!overlay) return;
  overlay.hidden = false;
  // force reflow so the is-open transition fires from the hidden state
  void overlay.offsetWidth;
  overlay.classList.add('is-open');
  document.documentElement.style.overflow = 'hidden';
  isOpen = true;
  document.addEventListener('keydown', onKey);

  // Defer focus until after the open transition so it doesn't fight the
  // user's source thumb still in view.
  window.setTimeout(() => {
    try {
      closeBtn?.focus({ preventScroll: true });
    } catch {
      /* noop */
    }
  }, 60);
}

function closeFs() {
  if (!overlay || !isOpen) return;
  overlay.classList.remove('is-open');
  isOpen = false;
  document.removeEventListener('keydown', onKey);
  document.documentElement.style.overflow = '';
  const focusTarget = previousFocus;
  window.setTimeout(() => {
    if (!overlay) return;
    if (overlay.classList.contains('is-open')) return;
    overlay.hidden = true;
    if (stageEl) while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
    if (focusTarget && focusTarget.isConnected) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* noop */
      }
    }
    listEls = [];
    sourceThumb = null;
  }, 260);
}

// ── Delegated click — bind once on document, survives View Transitions ───
let docClickBound = false;
function bindDocClick() {
  if (docClickBound) return;
  docClickBound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Only fire for images marked as gallery thumbs — case-item__img has
    // role=button and lives inside a [data-gallery] track.
    const img = target.closest<HTMLImageElement>('.case-item__img');
    if (!img) return;
    // Skip when keyboard activated via space/enter — those land via the
    // native button activation path; the role=button attribute already
    // makes them keyboard-clickable.
    e.preventDefault();
    openFsImageGallery(img);
  });
}

bindDocClick();
// Re-run on astro:page-load is a no-op but keeps init consistent with the
// rest of the v2 scripts.
document.addEventListener('astro:page-load', bindDocClick);

export { openFsImageGallery, closeFs };
