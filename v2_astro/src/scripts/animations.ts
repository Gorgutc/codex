/**
 * Animations runtime — work-card reveals, magnetic tilt, case-view
 * reveal + lift-on-scroll, Lenis smooth-scroll.
 *
 * Stage 8a — work-card cascade reveal, clip-path thumb reveal,
 *            codex:filter re-animate, codex:toggle reset.
 * Stage 8b — magnetic tilt (pointer:fine), case-view SplitText title,
 *            meta+scroll fade, lift-on-scroll case-items + clip-path
 *            media reveal, Lenis smooth-scroll bound to ScrollTrigger.
 *
 * Ported from codex/js/animations.js. Reduced-motion users return
 * early before any GSAP work runs.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'power2.out';
const LIFT_EASE = 'expo.out';

// ── Lenis smooth-scroll (module-scope, persists across View Transitions) ──
let lenis: Lenis | null = null;
function initLenis() {
  if (lenis) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time: number) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
function updateLenisState() {
  if (!lenis) return;
  const caseOpen = document.body.classList.contains('cards-collapsed');
  const fsOpen = document.body.classList.contains('has-blueprint-fs');
  if (caseOpen || fsOpen) lenis.stop();
  else lenis.start();
}

function init() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  initLenis();
  updateLenisState();

  initSidebarReveal();
  initMagneticTilt();
  initCaseReveal();
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Sidebar reveals (Stage 8a)                                            ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function initSidebarReveal() {
  const cardsScroll = document.getElementById('cards-scroll');
  if (!cardsScroll) return;
  cardsScroll.dataset.animBound = '1';

  const allCards = Array.from(
    document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)'),
  );
  const fresh = allCards.filter((c) => c.dataset.revealed !== 'true');

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

  requestAnimationFrame(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Magnetic tilt (Stage 8b) — pointer:fine + hover:hover only            ║
// ╚═══════════════════════════════════════════════════════════════════════╝
const MAX_TILT = 6;
const TILT_DURATION = 0.45;
const TILT_RESET_DURATION = 0.6;

function initMagneticTilt() {
  const fineHover =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fineHover) return;

  const cards = document.querySelectorAll<HTMLElement>(
    '.work-card:not(.tag-card)',
  );
  for (const card of cards) {
    if (card.dataset.tiltBound === '1') continue;
    card.dataset.tiltBound = '1';

    const qx = gsap.quickTo(card, 'rotationY', {
      duration: TILT_DURATION,
      ease: EASE,
    });
    const qy = gsap.quickTo(card, 'rotationX', {
      duration: TILT_DURATION,
      ease: EASE,
    });

    const onMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
      const ny = (e.clientY - rect.top) / rect.height * 2 - 1;
      qx(nx * MAX_TILT);
      qy(-ny * MAX_TILT);
    };
    const onLeave = () => {
      gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        duration: TILT_RESET_DURATION,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    // focusout bubbles, blur doesn't — survives focusable descendants.
    card.addEventListener('focusout', onLeave);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Case-view reveal + lift-on-scroll (Stage 8b)                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function initCaseReveal() {
  const caseView = document.getElementById('case-view');
  if (!caseView) return;

  const header = caseView.querySelector<HTMLElement>('.case-view__header');
  const progress = document.getElementById('case-progress');
  const scrollEl = document.getElementById('case-scroll');
  const trackEl = document.getElementById('case-scroll-track');
  const caseTitle = document.getElementById('case-title');
  if (!header || !scrollEl) return;

  // Reset progress bar to 0 — each new case starts fresh.
  const bar = document.getElementById('case-progress-bar');
  if (bar) bar.style.width = '0%';

  // Title — chars/words split + lift; fallback to plain fade if SplitText
  // throws (very unlikely on the npm bundle but defensive).
  revealCaseTitle(caseTitle);

  // Meta + scroll-track fade (parity with legacy MPA-ish "initial=false" path).
  const meta = header.querySelector('.case-view__meta');
  if (meta) {
    gsap.fromTo(
      meta,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      },
    );
  }
  if (progress) {
    gsap.fromTo(
      progress,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.out',
        clearProps: 'opacity',
      },
    );
  }
  if (trackEl) {
    gsap.fromTo(
      trackEl,
      { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
      {
        opacity: 1,
        clipPath: 'inset(0 0 0% 0)',
        duration: 0.55,
        ease: 'expo.out',
        clearProps: 'clipPath,opacity',
      },
    );
  }

  // Lift the case-items on scroll (per-item ScrollTrigger).
  requestAnimationFrame(() => setupLift(scrollEl));
}

function revealCaseTitle(caseTitle: HTMLElement | null) {
  if (!caseTitle) return;
  // Keep the original textContent reachable by screen readers — SplitText
  // wraps chars in spans, so we set aria-label to the plain text.
  caseTitle.setAttribute('aria-label', caseTitle.textContent?.trim() ?? '');
  try {
    const split = new SplitText(caseTitle, {
      type: 'chars,words',
      charsClass: 'case-title__char',
      wordsClass: 'case-title__word',
    });
    gsap.from(split.chars, {
      yPercent: 100,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: { amount: 0.35, from: 'start' },
      onComplete: () => {
        gsap.set(split.chars, { clearProps: 'transform,opacity' });
      },
    });
  } catch {
    gsap.fromTo(
      caseTitle,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
      },
    );
  }
}

function setupLift(scrollEl: HTMLElement) {
  const items = Array.from(
    scrollEl.querySelectorAll<HTMLElement>('.case-item'),
  );
  if (items.length === 0) return;

  killCaseItemTriggers();
  gsap.set(items, { opacity: 0, y: 44 });

  items.forEach((item, i) => {
    const initialDelay = i < 2 ? i * 0.09 : 0;
    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: LIFT_EASE,
      delay: initialDelay,
      clearProps: 'transform,opacity',
      scrollTrigger: {
        trigger: item,
        scroller: scrollEl,
        start: 'top 92%',
        toggleActions: 'play none none none',
        once: true,
      },
    });
  });

  // Clip-path reveal for case-item media — separate class so the
  // CSS rule doesn't collide with the sidebar thumb reveal.
  const media = Array.from(
    scrollEl.querySelectorAll<HTMLElement>('.case-item__media img, .case-item__media video'),
  );
  for (const el of media) {
    el.classList.add('is-clip-reveal-case');
    gsap.to(el, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.0,
      ease: 'power3.inOut',
      scrollTrigger: {
        trigger: el,
        scroller: scrollEl,
        start: 'top 90%',
        once: true,
      },
      onComplete: () => {
        gsap.set(el, { clearProps: 'clipPath' });
        el.classList.remove('is-clip-reveal-case');
      },
    });
  }

  ScrollTrigger.refresh();
}

function killCaseItemTriggers() {
  ScrollTrigger.getAll().forEach((st) => {
    const trig = st.vars?.trigger as HTMLElement | undefined;
    if (trig?.classList?.contains?.('case-item')) st.kill();
    // Also drop clip-path triggers scoped to #case-scroll (media reveal).
    const scroller = st.scroller as HTMLElement | Window | undefined;
    if (scroller instanceof HTMLElement && scroller.id === 'case-scroll') {
      st.kill();
    }
  });
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Global listeners (bound once, survive page-loads)                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝
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
  updateLenisState();
  if (ev.detail.collapsed) {
    const cards = document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)');
    gsap.set(cards, { clearProps: 'transform' });
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  }
}

if (!filterListenerBound) {
  document.addEventListener('codex:filter', onFilter);
  filterListenerBound = true;
}
if (!toggleListenerBound) {
  document.addEventListener('codex:toggle', onToggle);
  toggleListenerBound = true;
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Teardown / wiring                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function teardownScopedTriggers() {
  ScrollTrigger.getAll().forEach((t) => {
    const scroller = t.scroller as HTMLElement | Window | undefined;
    if (
      scroller instanceof HTMLElement &&
      (scroller.id === 'cards-scroll' || scroller.id === 'case-scroll')
    ) {
      t.kill();
    }
    // Also kill case-item triggers regardless of scroller (defensive).
    const trig = t.vars?.trigger as HTMLElement | undefined;
    if (trig?.classList?.contains?.('case-item')) t.kill();
  });
  const cardsScroll = document.getElementById('cards-scroll');
  if (cardsScroll) delete cardsScroll.dataset.animBound;
}

init();
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardownScopedTriggers);

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
