# Build Rules — Codex Studio

> Дизайн-система, токены, правила вёрстки, строгие запреты.
> Зеркалирует `css/tokens.css` v0.7.10. Всё, что в `tokens.css` — авторитетно.

---

## 🎨 Цветовая система

Базовый фон — `#212121`. Поверхности строятся ступенчатым осветлением. Контраст текста на всех уровнях проверен по WCAG AA (≥4.5:1).

### Dark (основной)

```css
:root, [data-theme="dark"] {
  /* Surface */
  --color-bg:               #212121;
  --color-surface:          #2a2a2a;
  --color-surface-2:        #313131;
  --color-surface-offset:   #3a3a3a;
  --color-divider:          #404040;
  --color-border:           #4a4a4a;

  /* Text — контрасты на --color-bg */
  --color-text:             #f0eeeb;  /* 14:1   AAA */
  --color-text-muted:       #a8a6a2;  /* 6.63:1 AA  */
  --color-text-faint:       #8a8884;  /* 3.4:1  FAIL — только декор */
  --color-text-inverse:     #212121;

  /* Primary (UI accent — кнопки, hover) */
  --color-primary:          #327AAE;
  --color-primary-hover:    #2a6695;
  --color-primary-active:   #225380;
  --color-primary-highlight: rgba(50, 122, 174, 0.12);

  /* Accent для текстовых акцентов на bg/surface (отдельно от UI primary) */
  --color-accent-text:      #4a94cf;

  /* Secondary (тил) */
  --color-secondary:        #2E8B8F;
  --color-secondary-hover:  #267679;

  /* Status */
  --color-error:            #e05a5a;
  --color-success:          #5a9e6e;

  /* Component tokens (alias на surface в dark, переопределяются в light) */
  --color-work-card-bg:         var(--color-surface);
  --color-work-card-bg-hover:   var(--color-surface-2);
  --color-work-card-border:     var(--color-divider);
  --color-work-card-border-hov: var(--color-border);
  --color-3d-canvas-bg:         var(--color-bg);
  --color-3d-canvas-glow:       rgba(50, 122, 174, 0.06);
  --color-case-bar-bg:          var(--color-bg);
  --color-ctrl-bg:              rgba(22, 22, 22, 0.82);

  /* Blueprint grid */
  --bp-grid-minor: rgba(50, 122, 174, 0.08);
  --bp-grid-major: rgba(50, 122, 174, 0.18);
}
```

### Light (manual toggle, не auto)

```css
[data-theme="light"] {
  --color-bg:              #f5f5f5;
  --color-surface:          #ffffff;
  --color-surface-2:        #ebebeb;
  --color-surface-offset:   #d4d4d4;
  --color-divider:          #7f7e7e;
  --color-border:           #7f7e7e;
  --color-text:             #1a1a1a;
  --color-text-muted:       #555555;
  --color-text-faint:       #626262;
  --color-text-inverse:     #ffffff;
  --color-accent-text:      #2a6695;

  --color-work-card-bg:         #ebebeb;
  --color-work-card-bg-hover:   #e0e0e0;
  --color-work-card-border:     #c8c8c8;
  --color-work-card-border-hov: #b0b0b0;
  --color-3d-canvas-bg:         #c9c9c9;
  --color-3d-canvas-glow:       rgba(50, 122, 174, 0.05);
  --color-case-bar-bg:          #dedede00;  /* alpha=0, прозрачный */
  --color-ctrl-bg:              rgba(255, 255, 255, 0.88);

  --bp-grid-minor: rgba(50, 122, 174, 0.18);
  --bp-grid-major: rgba(50, 122, 174, 0.36);
}
```

**Правила цвета:**
- Максимум 2 не-нейтральных цвета на экране одновременно
- `--color-primary` — UI-only (кнопки, hover, focus). Текст НА primary всегда `#fff` (только `#fff` проходит WCAG AA на `#327AAE` = 4.64:1)
- `--color-accent-text` — для текстовых акцентов на `--color-bg` / `--color-surface`
- `--color-text-faint` — **только декоративные элементы** (даты, метки), не для функционального текста (FAIL WCAG AA)
- `--color-secondary` — для специфических не-UI-primary контекстов
- Хардкод цветов вне токенов — запрещён, единственное исключение `#fff` на primary

---

## 📐 Типография

Оба шрифта бесплатны для коммерческого использования (ITF Free Font License), грузятся через Fontshare CDN.

```css
--font-display: 'Clash Display', 'Inter', sans-serif;
--font-body:    'General Sans', 'Inter', sans-serif;
```

```html
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600&display=swap">
```

```css
/* Fluid scale (clamp) — реальные значения tokens.css v0.7.10 */
--text-xs:   clamp(0.65rem,  0.6rem  + 0.2vw,  0.75rem);
--text-sm:   clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem);
--text-base: clamp(0.875rem, 0.82rem + 0.28vw, 1rem);
--text-lg:   clamp(1rem,     0.9rem  + 0.5vw,  1.25rem);
--text-xl:   clamp(1.125rem, 1rem    + 0.75vw, 1.5rem);
--text-2xl:  clamp(1.25rem,  1rem    + 1.5vw,  2rem);
--text-hero: clamp(3rem,     0.5rem  + 7vw,    8rem);
```

**Правила:**
- `Clash Display` — только от `--text-xl` (24px) и выше
- `General Sans` — всё ниже 24px (body, nav, кнопки, лейблы)
- Body — `--text-base`
- Максимум 4–5 уникальных комбинаций шрифт/размер/вес на странице
- `font-display: swap` (уже встроено в Fontshare URL)

---

## 📏 Отступы (4px grid)

```css
--space-1:  0.25rem;   --space-2:  0.5rem;   --space-3:  0.75rem;
--space-4:  1rem;      --space-6:  1.5rem;   --space-8:  2rem;
--space-12: 3rem;      --space-16: 4rem;     --space-24: 6rem;
--space-32: 8rem;
```

Секции и блоки используют только эти токены.

---

## 🔲 Скругления и тени

```css
--radius-sm:   0.375rem;
--radius-md:   0.5rem;
--radius-lg:   0.75rem;
--radius-xl:   1rem;
--radius-full: 9999px;

/* Узкоспециализированные */
--radius-tag:  0.125rem;  /* tag chips */
--radius-card: 0.375rem;  /* work-card */

/* Тени — глубокие, под тёмный фон */
--shadow-sm: 0 1px 2px  oklch(0 0 0 / 0.4);
--shadow-md: 0 4px 12px oklch(0 0 0 / 0.5);
--shadow-lg: 0 12px 32px oklch(0 0 0 / 0.65);
```

**Nested radius:** внутренний радиус = внешний − padding. Пример: `.card { border-radius: 1rem; padding: 0.75rem; } .card-inner { border-radius: 0.25rem; }`.

---

## 📐 Layout-токены

```css
--content-max:   1200px;
--content-wide:  1440px;
--content-text:  720px;
--sidebar-w:     340px;   /* переопределяется JS на узких экранах */
```

`.container` использует `--content-max` + `padding-inline: clamp(var(--space-4), 5vw, var(--space-16))`.
Sidebar ширина переопределяется JS-инлайном через `document.documentElement.style.setProperty('--sidebar-w', ...)`.

---

## 🎬 Motion-токены

```css
--ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:    cubic-bezier(0.7, 0, 0.84, 0);
--ease-inout: cubic-bezier(0.87, 0, 0.13, 1);
```

Подробности — см. `motion_brief.md`.

---

## 📱 Адаптивность

- Mobile-first. Контрольные точки: 375px (base), 768px, 1024px, 1280px
- Touch targets ≥ 44×44px
- На `≤1023px` (tablet portrait + mobile) — 3D-controls сворачиваются в light-dropdown
- На `≤767px` — sidebar становится bottom-overlay; case-mobile-bar содержит mini-logo + Back + COPY LINK
- Hover-only взаимодействия запрещены без touch-альтернативы

---

## ✅ Базовые правила

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
body { min-height: 100dvh; line-height: 1.6; }
img  { display: block; max-width: 100%; height: auto; }
```

- Каждый `<img>`: `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`
- Каждая иконочная кнопка: `aria-label`
- Один `<h1>` на страницу (на index — `.case-view__title`)
- Семантика: `<aside>`, `<header>`, `<main>`, `<section>`, `<footer>`, `<nav>`
- `:focus-visible` для всех интерактивных элементов

---

## 🚫 Строгие запреты

| Запрет | Почему |
|---|---|
| `!important` | Ломает специфичность. **Исключение:** только внутри `@media (prefers-reduced-motion: reduce)` |
| `px` для шрифтов | Только `rem` + `clamp()` |
| Inline `style=""` (кроме инлайн-градиентов плейсхолдеров на work-card) | Все стили — в CSS |
| `<div>` вместо семантических тегов | Ломает a11y и SEO |
| Gradient на кнопках | Дешёвый AI-вид |
| Цветные `border-left` на карточках | AI-паттерн |
| Иконки в цветных кружках | AI-паттерн |
| Emoji в UI | Снижает воспринимаемый уровень |
| Centered-everything layout | AI-паттерн |
| Одинаковая высота всех секций | Монотонный ритм |
| `localStorage` / `sessionStorage` | Часто блокируется в sandbox-средах |
| `defer` / `type="module"` на скриптах | Ломает порядок GSAP |
| `--color-text-faint` для функционального текста | FAIL WCAG AA |
| Хардкод цветов вне токенов (кроме `#fff` на primary) | Нарушает дизайн-систему |
| Кириллица в UI | Сайт полностью на English |
| `role="main"` / `role="list"` / `role="navigation"` | Redundant ARIA на нативных тегах |
| `aria-label` на bare `<span>` / `<p>` | Игнорируется screen reader |
| `aria-label`, дублирующий visible-text | Lighthouse `label-content-name-mismatch` |
| Анимация `height` / `width` / `margin` / `padding` | Layout shift; только `opacity` + `transform` |
| `scale > 1.03` на hover | Мультяшно |
| Bounce / elastic easing для UI | Несерьёзно |
| Aurora / mesh / animated gradient backgrounds | AI-эстетика |
| Wavy SVG dividers | AI-эстетика |
| Stock-фото людей | Только свои рендеры |
| GIF | Использовать MP4/WebM |
| Theme-color split с `media="(prefers-color-scheme: ...)"` | Конфликтует с хардкодным `<body data-theme="dark">` (FOUC bug). Test `META-theme-color-single` требует count=1 |

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.7.10*
