/**
 * Animations runtime (Stage 8a) — work-card reveals + thumb clip-path
 * + filter re-animate + case-collapse reset.
 *
 * Magnetic tilt + Lenis smooth-scroll + case-view SplitText reveal +
 * lift-on-scroll for case-items land in Stage 8b.
 *
 * Ported from codex/js/animations.js lines 1-134 + 175-240. Reduced-
 * motion users return early before any GSAP setup.
 *
 * View-Transition contract: the sidebar persists across navigations,
 * so cards keep their `data-revealed="true"` flag between pages.
 * init() only batches the un-revealed remainder; ScrollTrigger
 * instances scoped to #cards-scroll are killed on before-swap so the
 * next page-load re-creates them against a clean state.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const EASE = 'power2.out';

function init() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const cardsScroll = document.getElementById('cards-scroll');
  if (!cardsScroll) return;

  // Idempotency — re-runs are cheap, but ScrollTrigger.batch installs new
  // observers each time; the data-attr guard keeps a single set live.
  if (cardsScroll.dataset.animBound === '1') {
    // Re-running because cards-scroll persisted across a View Transition
    // and we re-killed triggers on before-swap. Just rebuild against the
    // current card set, no need to wipe data-revealed (cards survive).
  }
  cardsScroll.dataset.animBound = '1';

  // Frozen selector — `:not(.tag-card)` keeps the FA dual-class cards
  // out of the reveal pass (mirrors legacy v0.4 [M1]).
  const allCards = Array.from(
    document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)'),
  );
  const fresh = allCards.filter((c) => c.dataset.revealed !== 'true');

  // ── 1. Cascade reveal of un-shown cards via ScrollTrigger.batch ─────────
  if (fresh.length > 0) {
    gsap.set(fresh, { opacity: 0, y: 16 });
    ScrollTrigger.batch(fresh, {
      scroller: cardsScroll,
      start: 'top 85%',
      once: true,
      onEnter: (batch) => {
        gsap.to(batch as HTMLElement[], {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: EASE,
          stagger: 0.08,
          clearProps: 'transform,opacity',
          onComplete: () => {
            for (const c of batch as HTMLElement[]) c.dataset.revealed = 'true';
          },
        });
      },
    });
  }

  // ── 1.5. Clip-path reveal for thumbnail <img>s ─────────────────────────
  // Closed state ships in CSS under @media (prefers-reduced-motion:
  // no-preference) so reduced users see the image instantly (the early
  // return above skips this block entirely for them).
  const thumbs = Array.from(
    cardsScroll.querySelectorAll<HTMLImageElement>(
      '.work-card__thumb:not(.tag-card__thumb) img:not([data-clip-played])',
    ),
  );
  for (const img of thumbs) {
    img.classList.add('is-clip-reveal');
    gsap.to(img, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.0,
      ease: 'power3.inOut',
      scrollTrigger: {
        trigger: img,
        scroller: cardsScroll,
        start: 'top 85%',
        once: true,
      },
      onComplete: () => {
        gsap.set(img, { clearProps: 'clipPath' });
        img.classList.remove('is-clip-reveal');
        img.dataset.clipPlayed = '1';
      },
    });
  }

  // Recompute ScrollTrigger positions once images decode + on window load.
  requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  // ── 2. Re-animate on codex:filter ───────────────────────────────────────
  if (!filterListenerBound) {
    document.addEventListener('codex:filter', onFilter);
    filterListenerBound = true;
  }

  // ── 3. Reset transforms when the case-view collapses back to sidebar ───
  if (!toggleListenerBound) {
    document.addEventListener('codex:toggle', onToggle);
    toggleListenerBound = true;
  }
}

// Module-scope guards so listeners survive page-load re-init without
// duplicating themselves. The Sidebar persists, so the bus is global.
let filterListenerBound = false;
let toggleListenerBound = false;

function onFilter() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const visible = document.querySelectorAll<HTMLElement>(
    '.work-card:not(.tag-card):not([hidden])',
  );
  if (visible.length === 0) return;
  gsap.fromTo(
    visible,
    { opacity: 0, y: 12 },
    {
      opacity: 1,
      y: 0,
      duration: 0.45,
      ease: EASE,
      stagger: 0.05,
      clearProps: 'transform',
    },
  );
}

function onToggle(e: Event) {
  const ev = e as CustomEvent<{ collapsed: boolean }>;
  if (!ev.detail) return;
  if (ev.detail.collapsed) {
    // Sidebar shrinking — drop any in-flight transform so the rail
    // doesn't carry tilt residue into the next paint.
    const cards = document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)');
    gsap.set(cards, { clearProps: 'transform' });
  } else {
    // Sidebar opening — defensive refresh after a layout flush so
    // ScrollTrigger picks up fresh positions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }
}

function teardownScopedTriggers() {
  // Kill only the ScrollTriggers scoped to #cards-scroll so persisted
  // cards don't accumulate stale observers across navigations. The
  // SplitText / case-view triggers from Stage 8b will live elsewhere.
  ScrollTrigger.getAll().forEach((t) => {
    const scroller = t.scroller as HTMLElement | Window | undefined;
    if (scroller instanceof HTMLElement && scroller.id === 'cards-scroll') {
      t.kill();
    }
  });
  const scroller = document.getElementById('cards-scroll');
  if (scroller) delete scroller.dataset.animBound;
}

init();
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardownScopedTriggers);

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
