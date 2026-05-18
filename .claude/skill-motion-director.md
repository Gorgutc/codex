---
name: codex-motion-director
description: "Use when the user asks for animation, GSAP, ScrollTrigger, SplitText, scroll reveal, hover states, pinned sections, parallax, page transitions, custom cursor, magnetic tilt, clip-path reveal, lift-on-scroll, theme-color animation, model-viewer animations, motion review, or motion audit for Codex Studio. Trigger on: animate, GSAP, ScrollTrigger, scroll animation, reveal, hover effect, cursor, motion, animation bug, batch, scroller."
---

# Codex Studio — Motion Director

Senior Motion Designer + GSAP Specialist. Animation guides attention, never decorates.
Rule of one surprise: 1–2 "wow" moments per page. Everything else: quiet precision.

## Stack (immutable)

- GSAP **3.13.0** + ScrollTrigger + SplitText (free since 3.13.0) via CDN
- CSS transitions/animations ONLY for hover, focus, button feedback
- NO jQuery animate(), NO Web Animations API for scroll
- NO CSS @keyframes where GSAP timeline/scrub/pin needed

## MANDATORY: first executable line in animations.js

```javascript
gsap.registerPlugin(ScrollTrigger);

if (typeof SplitText !== 'undefined') {
  gsap.registerPlugin(SplitText);
}
```

SplitText guarded — CDN may fail (CSP, offline).

## Reduced motion — early-return + CSS

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```javascript
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) return;  // entire IIFE bails
```

`!important` in CSS reduced-motion is the ONLY allowed `!important` in the project.

## Default GSAP parameters

```javascript
const EASE      = 'power2.out';
const LIFT_EASE = 'expo.out';
const DEFAULT_DURATION = 0.55;
const DEFAULT_STAGGER  = 0.08;
```

CSS easing tokens: `--ease-out` / `--ease-in` / `--ease-inout` (see tokens.css).

## CRITICAL — actual project patterns (v0.7.10)

### 1. ScrollTrigger.batch with custom scroller

`.work-card` lives inside `#cards-scroll` (its own `overflow-y:auto`). Without `scroller: '#cards-scroll'`, lower cards never trigger.

```javascript
gsap.set(cards, { opacity: 0, y: 16 });
const cardsScroll = document.getElementById('cards-scroll');

ScrollTrigger.batch(cards, {
  scroller: cardsScroll || window,
  start: 'top 85%',
  once: true,
  onEnter: batch => gsap.to(batch, {
    opacity: 1, y: 0,
    duration: 0.55, ease: EASE,
    stagger: 0.08,
    clearProps: 'transform,opacity'
  })
});

requestAnimationFrame(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
```

### 2. `:not(.tag-card)` filter — MANDATORY

`.tag-card` on free-assets.html has the double class `tag-card work-card`. Any `.work-card` selector animating opacity/transform must filter:

```javascript
const cards  = document.querySelectorAll('.work-card:not(.tag-card)');
const thumbs = document.querySelectorAll('.work-card__thumb:not(.tag-card__thumb) img');
const visible = document.querySelectorAll('.work-card:not(.tag-card):not([hidden])');
```

Forgetting this breaks the FA page.

### 3. Clip-path reveal for thumbnails

```javascript
thumbs.forEach(img => img.classList.add('is-clip-reveal'));
thumbs.forEach(img => {
  gsap.to(img, {
    clipPath: 'inset(0 0% 0 0)',
    duration: 1.0, ease: 'power3.inOut',
    scrollTrigger: { trigger: img, scroller: cardsScroll || window, start: 'top 85%', once: true },
    onComplete: () => {
      gsap.set(img, { clearProps: 'clipPath' });
      img.classList.remove('is-clip-reveal');
    }
  });
});
```

Closed initial state in CSS under `@media (prefers-reduced-motion: no-preference)` — reduced users see image immediately.

### 4. Filter re-animate

```javascript
document.addEventListener('codex:filter', () => {
  const visible = document.querySelectorAll('.work-card:not(.tag-card):not([hidden])');
  gsap.fromTo(visible,
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, duration: 0.4, ease: EASE, stagger: 0.04 }
  );
});
```

### 5. Magnetic tilt hover (pointer:fine only)

CSS variables `--tx` / `--ty` updated by JS on `mousemove`. CSS `@media (hover: hover) and (pointer: fine)` gates the effect for non-touch.

### 6. Custom cursor

Active only when:

```javascript
if (window.matchMedia('(pointer: fine)').matches && !reduced) {
  document.documentElement.classList.add('cursor-fine');
  // gsap.quickTo for x/y on `.cursor`
}
```

CSS: `body { cursor: none; } .cursor { ... }` — gated by `.cursor-fine`.

### 7. Case-view reveal + lift-on-scroll

When opening a case (clicking `.work-card`):
- Title via SplitText (chars/words) with fade fallback if SplitText absent
- Items in `case-scroll__track` use `expo.out` (`LIFT_EASE`) — slight sticky deceleration

### 8. Theme-color JS sync

```javascript
// in applyTheme() in main.js
const isLight = document.body.dataset.theme === 'light';
themeMetaColor.setAttribute('content', isLight ? '#f5f5f5' : '#212121');
```

NOT split with `media` — single tag, JS-controlled. Test `META-theme-color-single` enforces this.

### 9. 3D-controls light-dropdown listener cleanup

Module-level vars for global handlers:

```javascript
let currentLightDdDocClick = null;
let currentLightDdDocKey   = null;

function destroy3D() {
  if (currentLightDdDocClick) {
    document.removeEventListener('click', currentLightDdDocClick);
    currentLightDdDocClick = null;
  }
  if (currentLightDdDocKey) {
    document.removeEventListener('keydown', currentLightDdDocKey);
    currentLightDdDocKey = null;
  }
}
```

Without cleanup → leaks + race conditions on case-switch.

## Speed table

| Element | Duration | Ease |
|---|---|---|
| Hover (CSS transition) | 180ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Tooltip / dropdown | 0.2s | `power2.out` |
| Cards scroll reveal (batch) | 0.55s | `power2.out` |
| Clip-path reveal | 1.0s | `power3.inOut` |
| Filter re-animate | 0.4s | `power2.out` |
| Case-view reveal | 0.6–0.8s | `power2.out` |
| Lift-on-scroll case-items | 0.7–1.0s | `expo.out` |
| Complex timeline | 1.0–1.5s | custom |

NEVER duration > 2s for UI.

## Hover (CSS only)

```css
.btn, .card, a {
  transition: color 180ms var(--ease-out),
              background-color 180ms var(--ease-out),
              transform 180ms var(--ease-out),
              opacity 180ms var(--ease-out);
}
```

Scale on hover ≤ 1.03. NEVER 1.1+.

## Parallax — mobile rule

```javascript
const isMobile = window.matchMedia('(max-width: 768px)').matches;
if (!isMobile && !reduced) { /* parallax here */ }
```

Currently no parallax in project.

## Pin sections

Currently NOT used. Add only with explicit narrative justification.

## Preloader

Currently NOT used on the site. Do NOT add a preloader without explicit user request — the page renders fast enough without one.

## Debugging

```javascript
ScrollTrigger.create({ markers: false });  // production: ALWAYS false
ScrollTrigger.refresh();                    // after dynamic content / resize
```

## Prohibited

- Infinitely rotating UI elements
- Bounce / elastic easing for UI
- Animating `height: auto` / `width` / `margin` / `padding` (use `clip-path` or `scaleY` instead)
- Parallax on mobile
- Animation on every element ("dancing graveyard")
- `animation-iteration-count: infinite` for UI
- Background gradient animations (Aurora, Mesh)

## Output format

1. Motion intent in ONE sentence: "This animation [X] to [Y]"
2. CSS code (hover/micro) — `FILE: css/shared.css` or `css/portfolio.css`
3. JS code (GSAP) — `FILE: js/animations.js` or `js/main.js`
4. Explicit: trigger, duration, easing, reduced-motion fallback
5. Anti-overanimation check: "Does this add meaning or fill space?"
6. If touches `.work-card` selectors — confirm `:not(.tag-card)` filter present

---

*Version: 2.0 · May 2026 · Codex Studio v0.7.10 → v0.8 (in progress)*
