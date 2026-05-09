# Structure — Codex Studio
> Файловая структура проекта, порядок секций, сетка, навигация

---

## 📁 Файловая структура

```
codex-studio/
├── index.html              ← единственная HTML-страница
├── css/
│   ├── tokens.css          ← CSS-переменные из build_rules (цвета, шрифты, отступы)
│   ├── reset.css           ← Modern CSS Reset (Andy Bell)
│   └── main.css            ← основные стили (импортирует tokens.css и reset.css)
├── js/
│   ├── animations.js       ← все GSAP-анимации (ScrollTrigger, Hero, etc.)
│   └── main.js             ← навигация, theme toggle, мелкие взаимодействия
└── assets/
    ├── img/
    │   ├── hero/           ← hero-изображения или видео
    │   ├── work/           ← превью проектов (карточки портфолио)
    │   ├── about/          ← фото или изображения для About-секции
    │   └── og-image.jpg    ← OpenGraph изображение (1200×630px)
    └── favicon/
        ├── favicon.ico
        ├── favicon-32x32.png
        ├── favicon-16x16.png
        ├── apple-touch-icon.png
        └── site.webmanifest
```

**Правила:**
- Все пути относительные (`./css/main.css`, `./assets/img/...`)
- Никаких папок `dist/`, `build/`, `node_modules/` — статический сайт
- CSS подключается через `<link>` в `<head>`, JS через `<script>` (без defer) перед `</body>`

---

## 📐 Структура index.html

```html
<html lang="en">
  <head>
    <!-- мета-теги, title, SEO, OG из texts.md -->
    <!-- preconnect для Fontshare CDN -->
    <!-- link: tokens.css, reset.css, main.css -->
    <!-- link: favicon -->
  </head>
  <body data-theme="dark">

    <div class="preloader"><!-- логотип или индикатор --></div>

    <header>           <!-- фиксированная шапка, nav + theme toggle -->
    <main>
      <section id="hero">       <!-- 1. Hero -->
      <section id="about">      <!-- 2. About -->
      <section id="services">   <!-- 3. Services / What We Do -->
      <section id="work">       <!-- 4. Selected Work (портфолио) -->
      <section id="contact">    <!-- 5. Contact -->
    </main>
    <footer>           <!-- копирайт -->

    <!-- JS подключение: GSAP CDN (без defer) → затем наши скрипты (без defer) -->
    <!-- Важно: все скрипты перед </body>, порядок строго соблюдать -->
  </body>
</html>
```

---

## 🔗 CDN подключения — СТРОГИЙ ПОРЯДОК

```html
<!-- В <head> -->
<!-- 1. Preconnect -->
<link rel="preconnect" href="https://api.fontshare.com">

<!-- 2. Шрифты -->
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">

<!-- 3. Стили -->
<link rel="stylesheet" href="./css/tokens.css">
<link rel="stylesheet" href="./css/reset.css">
<link rel="stylesheet" href="./css/main.css">
```

```html
<!-- Перед </body> — ВСЕ скрипты БЕЗ defer, строго в этом порядке -->

<!-- 4. GSAP Core -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<!-- 5. ScrollTrigger -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<!-- 6. Наши скрипты — после GSAP, поэтому gsap гарантированно доступен -->
<script src="./js/main.js"></script>
<script src="./js/animations.js"></script>
```

> ⚠️ **Почему без `defer`:** скрипты расположены перед `</body>` — DOM уже построен.
> `defer` на CDN-скриптах и local-скриптах ломает порядок исполнения: `defer`-скрипты
> исполняются по порядку после DOMContentLoaded, но смешивание с обычными скриптами
> создаёт race condition. Решение: все JS-скрипты перед `</body>` — без `defer`.

---

## 🗺 Wireframe — порядок и высота секций

| Секция | ID | Высота | Описание |
|---|---|---|---|
| Header | — | 64px (фикс.) | Логотип/имя слева, nav справа, theme toggle |
| Hero | `#hero` | 100dvh | Крупный H1, subhead, 2 CTA, фоновый визуал |
| About | `#about` | auto | Текст + опционально фото/render |
| Services | `#services` | auto | 4 блока услуг, нестандартная раскладка |
| Work | `#work` | auto | Фильтры + карточки проектов |
| Contact | `#contact` | auto | Заголовок, CTA-кнопка, контакты |
| Footer | — | auto | Копирайт |

**Правило ритма:** секции намеренно разной высоты — нет монотонного ритма.

---

## 🧮 Сетка (Grid System)

```css
/* Контентная ширина */
--content-max:  1200px;   /* основной контент */
--content-wide: 1440px;   /* full-bleed секции (hero, work) */
--content-text:  720px;   /* текстовые блоки (about, contact) */

/* Основной контейнер */
.container {
  width: 100%;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: clamp(var(--space-4), 5vw, var(--space-16));
}

/* Wide-контейнер (для hero, portfolio) */
.container--wide {
  max-width: var(--content-wide);
}

/* Текстовый блок */
.container--text {
  max-width: var(--content-text);
}
```

---

## 🔲 Раскладки секций

### Header
```css
header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
  backdrop-filter: blur(12px);
}
```

### Services — нестандартный grid (не 3 одинаковые колонки!)
```css
/* Desktop: 2 услуги крупно сверху, 2 меньше снизу */
.services-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}
.service-item:first-child {
  grid-column: 1 / -1;  /* первая услуга — на всю ширину */
}
```

### Work — Portfolio Grid
```css
.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--space-6);
}
/* Первая карточка может быть large (col-span: 2) */
```

---

## 📱 Навигация — мобильная

- Hamburger-меню на `≤768px`
- Иконка: три линии → крестик (CSS transition)
- Меню открывается как overlay поверх контента
- touch target: минимум 44×44px

---

## 🌐 site.webmanifest

```json
{
  "name": "Codex Studio",
  "short_name": "Codex",
  "icons": [
    { "src": "./assets/favicon/favicon-32x32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "./assets/favicon/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ],
  "theme_color": "#212121",
  "background_color": "#212121",
  "display": "standalone"
}
```

---

*Версия: 1.1 | Апрель 2026 | Codex Studio*