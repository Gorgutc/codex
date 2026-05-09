# Build Rules — Codex Studio
> Дизайн-система, токены, правила верстки и строгие запреты

---

## 🎨 Цветовая система

Базовый фон: `#212121` — тёмно-серый нейтральный.
Все поверхности строятся от него со ступенчатым осветлением для чёткой глубины.
Контраст текста на всех уровнях проверен по WCAG AA (4.5:1+).

```css
/* DARK MODE — основной */
:root, [data-theme="dark"] {
  --color-bg:              #212121;  /* Базовый фон */
  --color-surface:         #2a2a2a;  /* Карточки, панели (+9) */
  --color-surface-2:       #313131;  /* Вложенные элементы (+10) */
  --color-surface-offset:  #3a3a3a;  /* Hover-поверхности, выделение (+9) */
  --color-divider:         #404040;  /* Разделители */
  --color-border:          #4a4a4a;  /* Бордеры элементов */

  /* Текст — высокий контраст на #212121 */
  --color-text:            #f0eeeb;  /* Основной — контраст ~14:1 ✅ WCAG AAA */
  --color-text-muted:      #a8a6a2;  /* Вторичный — контраст ~5.2:1 ✅ WCAG AA */
  --color-text-faint:      #6a6866;  /* ⚠️ ТОЛЬКО декоративный — контраст ~3.1:1, не для функционального текста */
  --color-text-inverse:    #212121;

  /* Акцент — основной: стальной синий */
  --color-primary:         #327AAE;
  --color-primary-hover:   #2a6695;
  --color-primary-active:  #225380;
  --color-primary-highlight: rgba(50, 122, 174, 0.15);

  /* Акцент — альтернатива: холодный тил */
  /* --color-primary:      #2E8B8F; */
  /* --color-primary-hover: #267679; */

  --color-error:           #e05a5a;
  --color-success:         #5a9e6e;
}

/* LIGHT MODE — опциональный */
[data-theme="light"] {
  --color-bg:              #f5f5f5;
  --color-surface:         #ffffff;
  --color-surface-2:       #f0f0f0;
  --color-surface-offset:  #e8e8e8;
  --color-divider:         #d8d8d8;
  --color-border:          #cccccc;
  --color-text:            #1a1a1a;
  --color-text-muted:      #555555;
  --color-text-faint:      #999999;
  --color-text-inverse:    #ffffff;
  --color-primary:         #327AAE;
  --color-primary-hover:   #2a6695;
}
```

**Правило:** максимум 2 не-нейтральных цвета на экране.
Акцент `#327AAE` — только на CTA-кнопках и hover-состояниях. Не для декорации.
Альтернатива `#2E8B8F` (тил) — раскомментировать если нужен более холодный/технический вид.
⚠️ `--color-text-faint` — только для декоративных меток, дат, вспомогательных подписей. Никогда для body-текста или UI-элементов.

---

## 📐 Типографическая система

Оба шрифта **бесплатны для коммерческого использования** (ITF Free Font License), доступны через Fontshare CDN.

```css
--font-display: 'Clash Display', 'Inter', sans-serif;
--font-body:    'General Sans', 'Inter', sans-serif;
```

```html
<!-- Подключение через Fontshare CDN -->
<link rel="preconnect" href="https://api.fontshare.com">
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
```

```css
/* Размеры (fluid scale — clamp) */
--text-xs:   clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem); /* 12-14px */
--text-sm:   clamp(0.875rem, 0.8rem  + 0.35vw, 1rem);     /* 14-16px */
--text-base: clamp(1rem,     0.95rem + 0.25vw, 1.125rem); /* 16-18px */
--text-lg:   clamp(1.125rem, 1rem    + 0.75vw, 1.5rem);   /* 18-24px */
--text-xl:   clamp(1.5rem,   1.2rem  + 1.25vw, 2.25rem);  /* 24-36px */
--text-2xl:  clamp(2rem,     1.2rem  + 2.5vw,  3.5rem);   /* 32-56px */
--text-hero: clamp(3rem,     0.5rem  + 7vw,    8rem);     /* 48-128px */
```

**Правила типографики:**
- `Clash Display` — только от `--text-xl` (24px) и выше
- `General Sans` — всё ниже 24px: body, кнопки, лейблы, nav
- Максимум 4–5 уникальных комбинаций шрифт/размер/вес на странице
- Body text всегда `--text-base` (16px), никогда не мельче

---

## 📏 Система отступов (4px grid)

```css
--space-1:  0.25rem;  /*  4px */
--space-2:  0.5rem;   /*  8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */
--space-32: 8rem;     /* 128px */
```

Секции: `padding-block: clamp(var(--space-8), 6vw, var(--space-24))`

---

## 🔲 Скругления и тени

```css
--radius-sm:   0.375rem;  /*  6px */
--radius-md:   0.5rem;    /*  8px */
--radius-lg:   0.75rem;   /* 12px */
--radius-xl:   1rem;      /* 16px */
--radius-full: 9999px;

/* Тени — тёмные, глубокие (под тёмный фон) */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.4);
--shadow-md: 0 4px 12px oklch(0 0 0 / 0.5);
--shadow-lg: 0 12px 32px oklch(0 0 0 / 0.65);
```

**Правило nested radius:** внутренний радиус = внешний − отступ
```css
.card       { border-radius: var(--radius-xl); padding: var(--space-3); }
.card-inner { border-radius: calc(var(--radius-xl) - var(--space-3)); }
```

---

## 📐 Сетка и контейнеры

```css
/* Контентная ширина — использовать везде */
--content-max:  1200px;   /* основной контент */
--content-wide: 1440px;   /* full-bleed (hero, portfolio) */
--content-text:  720px;   /* текстовые блоки */

.container {
  width: 100%;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: clamp(var(--space-4), 5vw, var(--space-16));
}
```

---

## 📱 Адаптивность

- Mobile-first. Проверка при 375px, 390px, 768px, 1280px
- Touch targets: минимум 44×44px
- Нет hover-only элементов без touch-альтернативы
- Навигация на мобайле — hamburger-меню (overlay)

---

## ✅ Обязательные базовые правила

```css
/* CSS Reset — базовый (использовать Andy Bell reset из trusted_sources.md) */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
body { min-height: 100dvh; line-height: 1.6; }
img  { display: block; max-width: 100%; height: auto; }
```

- Каждая картинка: `alt`, `width`, `height`, `loading="lazy"` (кроме hero — там `loading="eager"`)
- Каждая кнопка-иконка: `aria-label`
- Один `<h1>` на страницу, иерархия заголовков не прерывается (h1 → h2 → h3)
- Семантические теги везде: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- `focus-visible` для всех интерактивных элементов (доступность с клавиатуры)

---

## 🚫 Строгие запреты

| Запрет | Почему |
|---|---|
| `!important` | Ломает специфичность, признак хака. **Исключение:** разрешён только внутри `@media (prefers-reduced-motion: reduce)` |
| `px` для шрифтов | Использовать только `rem` и `clamp()` |
| Inline-стили через `style=""` | Только CSS-переменные и классы |
| `<div>` вместо семантических тегов | Ломает accessibility и SEO |
| Gradient на кнопках | Дешёвый вид, использовать solid color |
| Цветные border-left на карточках | AI-паттерн, запрещён |
| `position: absolute` без явной необходимости | Создаёт layout-проблемы |
| Больше 3 шрифтовых семей | Хаотичная типографика |
| Одинаковый padding у всех секций | Монотонный ритм |
| localStorage / sessionStorage | Блокируется в sandbox-среде |
| `--color-text-faint` для функционального текста | Не проходит WCAG AA |
| Хардкод цветов вне CSS-переменных | Нарушает дизайн-систему |

---

*Версия: 1.2 | Апрель 2026 | Codex Studio*