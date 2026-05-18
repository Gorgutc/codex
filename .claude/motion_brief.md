# Motion Brief — Codex Studio

> Правила анимаций — что, когда, как и чего никогда.
> Реальные паттерны проекта зафиксированы в `js/animations.js` и в Section "Реальные паттерны".

---

## 🎯 Принцип

Анимация направляет внимание, не развлекает. Каждая отвечает на вопрос: **«Что это говорит пользователю?»** Если ответа нет — анимации нет.

**Правило одного сюрприза:** на странице 1–2 «вау»-момента, остальное — тихая точность.

---

## ⚙️ Технологии

- **GSAP 3.13.0** — все сложные анимации, таймлайны, scroll-driven
- **GSAP ScrollTrigger** — scroll-анимации, batch reveal
- **GSAP SplitText** — анимация заголовков (бесплатен с 3.13.0); подключается с fallback
- **CSS transitions/animations** — простые hover, fade, micro-interactions
- Никаких jQuery animate(), никаких CSS-анимаций там, где нужен GSAP-таймлайн

---

## 📐 Стандартные параметры

```javascript
gsap.registerPlugin(ScrollTrigger);          // ВСЕГДА первая исполняемая строка animations.js
if (typeof SplitText !== 'undefined') {      // SplitText опционально с fallback
  gsap.registerPlugin(SplitText);
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) return;                          // early-return — никаких GSAP-инициализаций

const EASE      = 'power2.out';
const LIFT_EASE = 'expo.out';
const DEFAULT_DURATION = 0.55;
const DEFAULT_STAGGER  = 0.08;
```

CSS-токены easing (см. `tokens.css`):
```css
--ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:    cubic-bezier(0.7, 0, 0.84, 0);
--ease-inout: cubic-bezier(0.87, 0, 0.13, 1);
```

---

## 🎬 Реальные паттерны проекта (v0.7.10)

### 1. ScrollTrigger.batch для work-cards с custom scroller

Карточки (`.work-card`) лежат внутри `#cards-scroll` (собственный `overflow-y:auto`). Без `scroller: '#cards-scroll'` ScrollTrigger считал бы позиции относительно `window` и нижние карточки никогда не триггерились.

```javascript
gsap.set(cards, { opacity: 0, y: 16 });

const cardsScroll = document.getElementById('cards-scroll');
ScrollTrigger.batch(cards, {
  scroller: cardsScroll || window,
  start: 'top 85%',
  once: true,
  onEnter: batch => {
    gsap.to(batch, {
      opacity: 1, y: 0,
      duration: 0.55, ease: 'power2.out',
      stagger: 0.08,
      clearProps: 'transform,opacity'
    });
  }
});

requestAnimationFrame(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
```

**ОБЯЗАТЕЛЬНО:** селектор `.work-card:not(.tag-card)` — иначе на FA `tag-card` (двойной класс) получает `opacity:0` поверх собственных стилей.

### 2. Clip-path reveal для thumbnails

```javascript
const thumbs = document.querySelectorAll('.work-card__thumb:not(.tag-card__thumb) img');
thumbs.forEach(img => img.classList.add('is-clip-reveal'));

thumbs.forEach(img => {
  gsap.to(img, {
    clipPath: 'inset(0 0% 0 0)',
    duration: 1.0,
    ease: 'power3.inOut',
    scrollTrigger: { trigger: img, scroller: cardsScroll || window, start: 'top 85%', once: true },
    onComplete: () => {
      gsap.set(img, { clearProps: 'clipPath' });
      img.classList.remove('is-clip-reveal');
    }
  });
});
```

Закрытое начальное состояние — в CSS под `@media (prefers-reduced-motion: no-preference)`. Reduced-пользователи видят картинку сразу (early-return выше до этого блока не доходит).

### 3. Re-animate при смене фильтра

```javascript
document.addEventListener('codex:filter', () => {
  const visible = document.querySelectorAll('.work-card:not(.tag-card):not([hidden])');
  gsap.fromTo(visible, { opacity: 0, y: 12 }, {
    opacity: 1, y: 0,
    duration: 0.4, ease: 'power2.out', stagger: 0.04
  });
});
```

### 4. Magnetic tilt hover (только pointer:fine)

CSS-переменные `--tx`, `--ty` обновляются JS при `mousemove` на `.work-card`. На touch — отключено через `@media (hover: hover) and (pointer: fine)`.

### 5. Case-view reveal при открытии кейса

Заголовок кейса опционально через SplitText (chars/words), с fallback на простой fade при отсутствии плагина. Items в `case-scroll__track` появляются через ScrollTrigger с `LIFT_EASE = 'expo.out'` (тот же «sticky» feel, что у нижних карточек sidebar).

### 6. Custom cursor

```javascript
// Включается только при pointer:fine (НЕ touch)
if (window.matchMedia('(pointer: fine)').matches && !reduced) {
  document.documentElement.classList.add('cursor-fine');
  // GSAP quickTo для x/y следования за курсором
}
```

CSS: `body { cursor: none; } .cursor { ... }` — но только когда есть класс `cursor-fine`.

### 7. Theme toggle — обновление meta theme-color

```javascript
// в applyTheme() в main.js
const isLight = document.body.dataset.theme === 'light';
themeMetaColor.setAttribute('content', isLight ? '#f5f5f5' : '#212121');
```

**Не split с media** — один тег обновляется JS. Иначе FOUC: `<body data-theme="dark">` хардкод + media-rule браузера = рассинхрон фон/адресной строки.

### 8. Light-dropdown для 3D-controls (≤1023px)

Ленивая инициализация global handlers (close-on-outside-click + Escape). Module-level vars `currentLightDdDocClick` / `currentLightDdDocKey` снимаются `removeEventListener` в `destroy3D()` при смене кейса — иначе утечки + race conditions.

---

## 🚦 Скорости

| Элемент | Duration | Ease |
|---|---|---|
| Hover кнопок | 180ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Tooltip / dropdown | 0.2s | `power2.out` |
| Scroll reveal cards | 0.55s | `power2.out` |
| Clip-path reveal | 1.0s | `power3.inOut` |
| Filter re-animate | 0.4s | `power2.out` |
| Case-view reveal | 0.6–0.8s | `power2.out` |
| Lift-on-scroll case-items | 0.7–1.0s | `expo.out` |
| Theme toggle | мгновенно (CSS) | — |

**Никогда:** duration > 2s для UI-элементов.

---

## ♿ Reduced-motion (обязательно оба слоя)

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
if (reduced) return;  // early-return перед любым registerPlugin / scrollTrigger
```

`!important` в CSS — единственный разрешённый случай в проекте.

---

## 🚫 Запрещённые анимации

| Запрет | Почему |
|---|---|
| Бесконечно вращающиеся UI-элементы | Отвлекают |
| Bounce / elastic ease для UI | Мультяшно |
| Анимация `height: auto` / `width` / `margin` / `padding` | Layout shift |
| Параллакс на mobile | Укачивание (отключать через `matchMedia('(max-width: 768px)')`) |
| `animation-iteration-count: infinite` для UI | Раздражает при чтении |
| `scale > 1.03` на hover | Мультяшно |
| Сложный preloader | На сайте preloader-а нет — не добавлять без явного запроса |
| Markers в production | `markers: false` обязательно (true только при отладке) |

---

## 🎭 Pin-секции

Использовать ТОЛЬКО для нарративно-оправданных scroll-storytelling сцен. На текущем сайте pin не используется.

---

## 🔧 Отладка

```javascript
ScrollTrigger.create({ markers: false });  // markers ТОЛЬКО локально, не в коммитах
ScrollTrigger.refresh();                    // после dynamic content / resize
```

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.7.10 → v0.8 (in progress)*
