# Motion Brief — Codex Studio
> Правила анимаций — что, когда, как и чего никогда

---

## 🎯 Принцип

Анимация существует чтобы направлять внимание, а не развлекать.
Каждая анимация должна отвечать на вопрос: **«Что это говорит пользователю?»**
Если ответа нет — анимации нет.

**Правило одного сюрприза:** на странице 1–2 «вау»-момента. Остальное — тихая точность.

---

## ⚙️ Технологии

- **GSAP v3** — все сложные анимации, таймлайны, scroll-driven
- **GSAP ScrollTrigger** — анимации при скролле, pin-секции
- **CSS transitions/animations** — простые hover-состояния, fade-эффекты
- Никаких jQuery animate(), никаких CSS-анимаций там, где нужен GSAP

---

## 📐 Параметры по умолчанию

```javascript
// Регистрация плагина — всегда первой строкой в animations.js
gsap.registerPlugin(ScrollTrigger);

// Стандартные значения
const defaults = {
  duration: 0.6,
  ease: "power2.out",
  stagger: 0.08,
}

// Scroll Reveal — стандартный паттерн
gsap.from(".reveal", {
  scrollTrigger: {
    trigger: ".reveal",
    start: "top 85%",
    toggleActions: "play none none none"
  },
  opacity: 0,
  y: 24,
  duration: 0.6,
  ease: "power2.out",
  stagger: 0.08
})
```

---

## 🎬 Типы анимаций и правила

### Preloader (загрузка страницы)

Простой preloader обязателен — сайт содержит тяжёлые 3D-рендеры.

```javascript
// Минимальный preloader с принудительным скрытием через 2 секунды
const preloader = document.querySelector('.preloader')

function hidePreloader() {
  gsap.to(preloader, {
    opacity: 0,
    duration: 0.5,
    ease: "power2.out",
    onComplete: () => preloader.style.display = 'none'
  })
  initHeroAnimation()
}

// Принудительное скрытие — на случай если load не сработает
const forceHide = setTimeout(() => hidePreloader(), 2000)

window.addEventListener('load', () => {
  clearTimeout(forceHide)
  hidePreloader()
})
```

```css
.preloader {
  position: fixed;
  inset: 0;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
/* Индикатор: простая линия-прогресс или просто логотип */
```

**Правила preloader:**
- Максимум 2 секунды ожидания — потом принудительно скрываем
- Минималистичный дизайн — логотип или точки, не сложная анимация
- Плавное исчезновение через opacity, не резкое удаление

### Hero-анимация (после preloader)

- Максимум 1.2 секунды до появления главного контента
- Заголовок: fade + небольшой slide вверх (y: -16px → 0)
- Подзаголовок: задержка 0.15s после заголовка
- CTA-кнопка: задержка 0.3s

### Scroll Reveal (появление при скролле)

- Свойства: только `opacity` и `transform` (y/x/scale)
- Сдвиг: максимум 24–32px (не 100px — это слишком театрально)
- Никогда не анимировать `height`, `width`, `margin`, `padding` — вызывают layout shift
- `start: "top 85%"` — стандартный триггер

### Hover-состояния

```css
transition: color 180ms cubic-bezier(0.16, 1, 0.3, 1),
            background 180ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
```
- Scale на hover: максимум `scale(1.03)` — не больше
- Никаких `scale(1.1)` и выше — выглядит мультяшно

### Переходы между секциями

- Page scroll: `scroll-behavior: smooth`
- Якорные ссылки: `scroll-padding-top` равен высоте header (64px)

### Pin-секции (GSAP ScrollTrigger pin)

```javascript
// Только там, где нарративно оправдано
ScrollTrigger.create({
  trigger: ".pin-section",
  pin: true,
  start: "top top",
  end: "+=600",
  scrub: 1
})
```

---

## 🚦 Скорости (duration)

| Элемент | Duration | Ease |
|---|---|---|
| Hover кнопок | 180ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Tooltip/dropdown | 0.2s | power2.out |
| Scroll reveal | 0.5–0.7s | power2.out |
| Hero-анимация | 0.8–1.0s | power3.out |
| Preloader fade-out | 0.5s | power2.out |
| Сложные таймлайны | 1.0–1.5s | custom |

**Никогда:** duration > 2s для UI-элементов (только для кинематографических сцен)

---

## ♿ Доступность (обязательно)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```javascript
// Проверка перед инициализацией GSAP
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!prefersReducedMotion) {
  // инициализировать все GSAP анимации
}
```

---

## 🚫 Запрещённые анимации

| Запрет | Почему |
|---|---|
| Бесконечно вращающиеся элементы | Отвлекают, раздражают |
| Bounce easing для UI | Мультяшно, несерьёзно |
| Анимация `height: auto` | Ломает layout — использовать `clip-path` или `scaleY` |
| Параллакс на мобайле | Вызывает укачивание — отключать через media query |
| Анимации на каждом элементе | «Танцующее кладбище», нет фокуса |
| `animation-iteration-count: infinite` для UI | Раздражает при чтении |
| Сложный preloader (>2s) | Пользователь уйдёт до загрузки |

---

## 🔧 Отладка анимаций

```javascript
// markers только в dev
ScrollTrigger.create({
  trigger: ".section",
  markers: false, // включать вручную при отладке
  start: "top 80%",
})

// Refresh при resize
ScrollTrigger.refresh()
```

---

*Версия: 1.1 | Апрель 2026 | Codex Studio*