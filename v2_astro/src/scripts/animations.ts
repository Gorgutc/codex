/**
 * Animations runtime — work-card reveals, magnetic tilt, case-view
 * reveal + lift-on-scroll, Lenis smooth-scroll.
 *
 * Stage 11c: GSAP / ScrollTrigger / SplitText / Lenis are dynamic
 * imports so they ship as a separate chunk and stay out of the
 * initial /work/<slug>/ payload.  The CSS gate `html.anim-pending`
 * (set by BaseLayout's inline script) pre-hides un-revealed work-
 * cards while the libs stream in, so the lazy load is flash-free.
 *
 * Reduced-motion users skip the lazy load entirely and immediately
 * clear the anim-pending class so cards become visible without
 * animation.
 */

type GsapModule = typeof import('gsap');
type ScrollTriggerModule = typeof import('gsap/ScrollTrigger');
type SplitTextModule = typeof import('gsap/SplitText');
type LenisModule = typeof import('lenis');

interface Libs {
  gsap: GsapModule['gsap'];
  ScrollTrigger: ScrollTriggerModule['ScrollTrigger'];
  SplitText: SplitTextModule['SplitText'];
  Lenis: LenisModule['default'];
}

let libs: Libs | null = null;
let libsPromise: Promise<Libs> | null = null;
let lenis: InstanceType<LenisModule['default']> | null = null;

const EASE = 'power2.out';
const LIFT_EASE = 'expo.out';

/**
 * Lazy-load GSAP + ScrollTrigger + SplitText + Lenis. Cached after the
 * first call so navigating between case pages re-uses the same chunk.
 */
function ensureLibs(): Promise<Libs> {
  if (libs) return Promise.resolve(libs);
  if (libsPromise) return libsPromise;
  libsPromise = (async () => {
    const [g, st, sp, l] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/SplitText'),
      import('lenis'),
    ]);
    g.gsap.registerPlugin(st.ScrollTrigger, sp.SplitText);
    const resolved: Libs = {
      gsap: g.gsap,
      ScrollTrigger: st.ScrollTrigger,
      SplitText: sp.SplitText,
      Lenis: l.default,
    };
    libs = resolved;
    return resolved;
  })();
  return libsPromise;
}

function clearAnimPending() {
  document.documentElement.classList.remove('anim-pending');
}

// ── Lenis smooth-scroll ────────────────────────────────────────────────────
function initLenis(L: Libs) {
  if (lenis) return;
  lenis = new L.Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  const handleScroll = () => L.ScrollTrigger.update();
  lenis.on('scroll', handleScroll);
  L.gsap.ticker.add((time: number) => lenis?.raf(time * 1000));
  L.gsap.ticker.lagSmoothing(0);
}
function updateLenisState() {
  if (!lenis) return;
  const caseOpen = document.body.classList.contains('cards-collapsed');
  const fsOpen = document.body.classList.contains('has-blueprint-fs');
  if (caseOpen || fsOpen) lenis.stop();
  else lenis.start();
}

async function init() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    clearAnimPending();
    return;
  }

  const L = await ensureLibs();

  initLenis(L);
  updateLenisState();

  initSidebarReveal(L);
  initMagneticTilt(L);
  initCaseReveal(L);

  // Animations are wired — release the CSS pre-hide so any future
  // .work-card insertions (e.g. via View Transitions) render normally.
  clearAnimPending();
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Sidebar reveals                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function initSidebarReveal(L: Libs) {
  const cardsScroll = document.getElementById('cards-scroll');
  if (!cardsScroll) return;
  cardsScroll.dataset.animBound = '1';

  const allCards = Array.from(
    document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)'),
  );
  const fresh = allCards.filter((c) => c.dataset.revealed !== 'true');

  if (fresh.length > 0) {
    L.gsap.set(fresh, { opacity: 0, y: 16 });
    L.ScrollTrigger.batch(fresh, {
      scroller: cardsScroll,
      start: 'top 85%',
      once: true,
      onEnter: (batch) => {
        L.gsap.to(batch as HTMLElement[], {
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
    L.gsap.to(img, {
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
        L.gsap.set(img, { clearProps: 'clipPath' });
        img.classList.remove('is-clip-reveal');
        img.dataset.clipPlayed = '1';
      },
    });
  }

  requestAnimationFrame(() => L.ScrollTrigger.refresh());
  window.addEventListener('load', () => L.ScrollTrigger.refresh(), { once: true });
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Magnetic tilt                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝
const MAX_TILT = 6;
const TILT_DURATION = 0.45;
const TILT_RESET_DURATION = 0.6;

function initMagneticTilt(L: Libs) {
  const fineHover =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fineHover) return;

  const cards = document.querySelectorAll<HTMLElement>(
    '.work-card:not(.tag-card)',
  );
  for (const card of cards) {
    if (card.dataset.tiltBound === '1') continue;
    card.dataset.tiltBound = '1';

    const qx = L.gsap.quickTo(card, 'rotationY', {
      duration: TILT_DURATION,
      ease: EASE,
    });
    const qy = L.gsap.quickTo(card, 'rotationX', {
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
      L.gsap.to(card, {
        rotationX: 0,
        rotationY: 0,
        duration: TILT_RESET_DURATION,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    card.addEventListener('focusout', onLeave);
  }
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ Case-view reveal + lift-on-scroll                                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function initCaseReveal(L: Libs) {
  const caseView = document.getElementById('case-view');
  if (!caseView) return;

  const header = caseView.querySelector<HTMLElement>('.case-view__header');
  const progress = document.getElementById('case-progress');
  const scrollEl = document.getElementById('case-scroll');
  const trackEl = document.getElementById('case-scroll-track');
  const caseTitle = document.getElementById('case-title');
  if (!header || !scrollEl) return;

  const bar = document.getElementById('case-progress-bar');
  if (bar) bar.style.width = '0%';

  revealCaseTitle(L, caseTitle);

  const meta = header.querySelector('.case-view__meta');
  if (meta) {
    L.gsap.fromTo(
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
    L.gsap.fromTo(
      progress,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'opacity' },
    );
  }
  if (trackEl) {
    L.gsap.fromTo(
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

  requestAnimationFrame(() => setupLift(L, scrollEl));
}

function revealCaseTitle(L: Libs, caseTitle: HTMLElement | null) {
  if (!caseTitle) return;
  caseTitle.setAttribute('aria-label', caseTitle.textContent?.trim() ?? '');
  try {
    const split = new L.SplitText(caseTitle, {
      type: 'chars,words',
      charsClass: 'case-title__char',
      wordsClass: 'case-title__word',
    });
    L.gsap.from(split.chars, {
      yPercent: 100,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: { amount: 0.35, from: 'start' },
      onComplete: () => {
        L.gsap.set(split.chars, { clearProps: 'transform,opacity' });
      },
    });
  } catch {
    L.gsap.fromTo(
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

function setupLift(L: Libs, scrollEl: HTMLElement) {
  const items = Array.from(
    scrollEl.querySelectorAll<HTMLElement>('.case-item'),
  );
  if (items.length === 0) return;

  killCaseItemTriggers(L);
  L.gsap.set(items, { opacity: 0, y: 44 });

  items.forEach((item, i) => {
    const initialDelay = i < 2 ? i * 0.09 : 0;
    L.gsap.to(item, {
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

  const media = Array.from(
    scrollEl.querySelectorAll<HTMLElement>('.case-item__media img, .case-item__media video'),
  );
  for (const el of media) {
    el.classList.add('is-clip-reveal-case');
    L.gsap.to(el, {
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
        L.gsap.set(el, { clearProps: 'clipPath' });
        el.classList.remove('is-clip-reveal-case');
      },
    });
  }

  L.ScrollTrigger.refresh();
}

function killCaseItemTriggers(L: Libs) {
  L.ScrollTrigger.getAll().forEach((st) => {
    const trig = st.vars?.trigger as HTMLElement | undefined;
    if (trig?.classList?.contains?.('case-item')) st.kill();
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
  if (!libs) return; // animations not loaded yet; sidebar.ts already toggled [hidden]
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const visible = document.querySelectorAll<HTMLElement>(
    '.work-card:not(.tag-card):not([hidden])',
  );
  if (visible.length === 0) return;
  libs.gsap.fromTo(
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
  if (!libs) return;
  if (ev.detail.collapsed) {
    const cards = document.querySelectorAll<HTMLElement>('.work-card:not(.tag-card)');
    libs.gsap.set(cards, { clearProps: 'transform' });
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => libs?.ScrollTrigger.refresh());
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
  if (!libs) return;
  libs.ScrollTrigger.getAll().forEach((t) => {
    const scroller = t.scroller as HTMLElement | Window | undefined;
    if (
      scroller instanceof HTMLElement &&
      (scroller.id === 'cards-scroll' || scroller.id === 'case-scroll')
    ) {
      t.kill();
    }
    const trig = t.vars?.trigger as HTMLElement | undefined;
    if (trig?.classList?.contains?.('case-item')) t.kill();
  });
  const cardsScroll = document.getElementById('cards-scroll');
  if (cardsScroll) delete cardsScroll.dataset.animBound;
}

// Fire-and-forget initial init.  Errors are surfaced quietly — the CSS
// gate cleanup at the end of init() guarantees cards become visible
// either way.
init().catch((err) => {
  console.warn('[animations] init failed', err);
  clearAnimPending();
});
document.addEventListener('astro:page-load', () => {
  init().catch((err) => {
    console.warn('[animations] init failed', err);
    clearAnimPending();
  });
});
document.addEventListener('astro:before-swap', teardownScopedTriggers);

// Force ES-module semantics so top-level declarations stay file-scoped.
export {};
