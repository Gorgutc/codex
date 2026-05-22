# Structure — Codex Studio

> Файловая структура, порядок CSS/JS, layout страниц.
> Авторитетный источник архитектуры — `verify-frozen.js`.

---

## 📁 Файловая структура (v0.8 GOLDEN)

```
codex/
├── index.html                  ← основное портфолио (sidebar + case-view)
├── free-assets.html            ← каталог CC0/CC-BY 3D-ассетов
├── _beget-placeholder.php      ← дефолт хостинга Beget, к проекту не относится
├── verify-frozen.js            ← Playwright-регрешен (56 тестов, source of truth)
├── README.md
├── CHANGELOG.md
├── 08_ITERATION_HISTORY.md     ← историческая хроника фаз
├── 16_HANDOFF_v0_8.md          ← актуальный handoff (заменил 09–15_HANDOFF_v0_7_*)
├── llms.txt
├── robots.txt
├── sitemap.xml
│
├── css/
│   ├── tokens.css              ← дизайн-токены (цвета/шрифты/отступы) — единственное место
│   ├── reset.css               ← Andy-Bell-style modern reset
│   ├── shared.css              ← общие стили (sidebar, header, footer, theme, work-card база, cursor, grain)
│   ├── portfolio-core.css      ← только index, initial paint: work-card thumb backgrounds (~1.5 KB, 18 правил)
│   ├── portfolio-case.css      ← только index, lazy/preload: case-view, case-3d, fullscreen, work-card--active (~16 KB, 269 правил)
│   └── free-assets.css         ← только FA: fa-grid, fa-card, tag-cards грид
│
├── js/
│   ├── main.js                 ← CARDS_DATA + sidebar UI + case-view + 3D-вьювер + theme + filters (eager)
│   ├── animations.js           ← все GSAP-анимации (eager, после main.js)
│   ├── free-assets.js          ← логика страницы free-assets.html (только на FA)
│   ├── fa-data.js              ← каталог FA (вынесен из inline в free-assets.html)
│   └── model-data.js           ← inline GLB data 1.1 MB — LAZY-LOADED по первому клику на 3D-tab
│
├── assets/
│   ├── cards/                  ← 18 SVG-thumbnail (превью карточек, 800×600 viewBox)
│   ├── cases/<id>/01..05.svg   ← 18 кейсов × 5 SVG-слайдов (галерея в case-view 2D)
│   ├── models/                 ← 18 GLB (3D-модели для случев)
│   ├── models/free/            ← 18 GLB для FA
│   ├── hdr/                    ← studio.hdr / outdoor.hdr / dark.hdr (Polyhaven CC0, IBL для 3D)
│   ├── img/
│   │   ├── og-image.jpg        ← OG для index (1200×630)
│   │   └── og-free-assets.jpg  ← OG для FA (1200×630)
│   └── favicon/
│       ├── favicon.ico
│       ├── favicon-16.png
│       ├── favicon-32.png
│       ├── apple-touch-icon.png   (180×180)
│       └── site.webmanifest
│
└── downloads/                  ← *.zip плейсхолдеры (placeholder 412 B каждый)
```

**Правила:**
- Все пути относительные (`./css/...`, `./assets/...`)
- В OG/canonical/sitemap/JSON-LD — абсолютные URL `https://codex.promo/...`
- Никаких `dist/`, `build/`, `node_modules/` — статика
- Серверного кода нет (Beget-placeholder отдельный артефакт)

---

## 📐 Структура `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- meta charset/viewport, title, description, canonical -->
  <!-- og:* (absolute URLs) + twitter:* -->
  <!-- robots, theme-color (single tag, no media) -->
  <!-- favicon-комплект + manifest -->
  <!-- JSON-LD: Organization + WebSite + ItemList -->
  <!-- preconnect (api.fontshare.com, cdn.jsdelivr.net) + Fontshare CSS -->
  <!-- CSS: tokens → reset → shared → portfolio-core (+ preload portfolio-case) -->
</head>
<body data-theme="dark">

  <div class="layout">
    <aside class="sidebar" aria-label="Projects navigator">
      <header class="site-header" role="banner">
        <div class="header-top">
          <a class="logo" id="logo-home" ...>CODEX</a>
          <div class="header-top__controls">
            <a class="contact-btn" ...>Contact</a>          <!-- Telegram -->
            <button class="theme-toggle" id="theme-toggle">…</button>
            <button class="cards-toggle" id="cards-toggle">‹‹ ›› Hide projects</button>
          </div>
        </div>
        <div class="tags-dropdown" id="tags-dropdown" data-open="false">…</div>
        <div class="tags-divider"></div>
        <div class="sidebar__row">
          <label class="game-switch">…</label>
          <div class="cards-count">18 projects</div>
        </div>
      </header>

      <div class="cards-scroll" id="cards-scroll">
        <div class="cards-list" id="cards-list">
          <!-- 18 .work-card с data-id, data-category, опционально data-game-asset -->
        </div>
      </div>

      <footer class="site-footer">
        <div class="site-footer__row site-footer__row--actions">
          <p class="site-footer__stats">DELETED 422 CUBES • CREATED 120 WORKS</p>
        </div>
        <div class="site-footer__divider"></div>
        <div class="site-footer__row site-footer__row--pill">
          <a class="top-pill top-pill--contact">Contact</a>
          <a class="top-pill top-pill--free" href="./free-assets.html">Free Assets</a>
        </div>
      </footer>
    </aside>

    <main class="main-area">
      <section class="case-view" id="case-view">
        <div class="case-mobile-bar"><!-- mobile only: mini-logo + Back + COPY LINK --></div>

        <div class="case-view__header">
          <div class="case-view__left">
            <div class="case-view__meta">…cat · year</div>
            <h1 class="case-view__title" id="case-title">Orbital Mk.II</h1>
          </div>
          <div class="case-view__actions">
            <div class="case-view__tabs" role="tablist">
              <button class="case-tab case-tab--active" data-viz="2d">2D</button>
              <button class="case-tab"                  data-viz="3d">3D</button>
              <button class="case-tab"                  data-viz="blueprints">Blueprints</button>
              <div class="case-nav">
                <button id="case-prev">‹</button>
                <span class="case-nav__counter">1 / 15</span>
                <button id="case-next">›</button>
              </div>
              <button class="case-share case-share--desktop">COPY LINK</button>
            </div>
          </div>
        </div>

        <div class="case-progress"><div class="case-progress__bar"></div></div>

        <div class="case-scroll" id="case-scroll" role="region" tabindex="0">
          <div class="case-scroll__track" id="case-scroll-track"><!-- buildItems() --></div>
        </div>
        <div class="case-blueprints" id="case-blueprints" hidden><!-- buildBlueprint() --></div>
        <div class="case-3d"         id="case-3d"         hidden><!-- build3D() лениво --></div>
      </section>
    </main>
  </div>

  <div class="cursor" aria-hidden="true"><div class="cursor-dot"></div></div>

  <!-- JS перед </body>: gsap → ScrollTrigger → SplitText → main.js → animations.js -->
</body>
</html>
```

---

## 📐 Структура `free-assets.html`

Идентичная sidebar-структура. Отличия:

- `<a class="logo" id="logo-back-portfolio" href="./index.html">` (НЕ `id="logo-home"`)
- `cards-toggle` подписан "Hide categories" (вместо "Hide projects")
- `tags-dropdown` использует `EXPECTED_FA_TAGS` (`hard-surface / product / game / organic / animation / cad`) с `tags-dropdown__option-count` рядом с каждым лейблом
- В sidebar — `tag-cards` (специальные карточки-категории), фильтрующие FA-grid в `<main>`
- `<main>` содержит `fa-grid` с `fa-card` (real download cards)
- Подключается `./css/free-assets.css` вместо `./css/portfolio-core.css` + `./css/portfolio-case.css` (FA не использует portfolio-сплит)

`tag-card` имеет ОБА класса `tag-card work-card` (двойной класс — поэтому в `animations.js` обязателен фильтр `:not(.tag-card)` на всех селекторах `.work-card`).

---

## 🔗 CDN — строгий порядок (см. `prompt_instructions.md`)

В `<head>` — preconnect → Fontshare → tokens → reset → shared → (portfolio-core + preload portfolio-case на index | free-assets на FA).

Перед `</body>` — gsap → ScrollTrigger → SplitText → main.js → animations.js. Все БЕЗ `defer` и `type="module"`.

---

## 📐 Layout

```
┌─────────────────────────────────────────────────────┐
│ <body data-theme="dark"> (film grain ::before, vignette ::after) │
│ ┌───────────┬─────────────────────────────────────┐ │
│ │ aside.    │ main.main-area                      │ │
│ │ sidebar   │   section.case-view                 │ │
│ │ width     │     header (title + tabs + nav)     │ │
│ │ = 340px   │     case-progress                   │ │
│ │ (var      │     case-scroll (vert. gallery)     │ │
│ │ --sidebar-w│     case-blueprints (hidden)       │ │
│ │ )         │     case-3d (hidden, model-viewer)  │ │
│ │           │                                     │ │
│ │ header    │                                     │ │
│ │ scroll    │                                     │ │
│ │ footer    │                                     │ │
│ └───────────┴─────────────────────────────────────┘ │
│ div.cursor (custom cursor, pointer:fine only)       │
└─────────────────────────────────────────────────────┘
```

**Состояние `body.cards-collapsed`:** sidebar схлопывается, `main-area` занимает всю ширину, controls (theme/cards/contact) перемещаются в fixed top-right.

**Mobile (≤767px):**
- Sidebar становится bottom-overlay (или full-screen)
- `case-mobile-bar` показывается с mini-logo, "Projects" back, COPY LINK
- 3D-controls (env presets + exposure) сворачиваются в `light-dropdown` (≤1023px)

---

## 🌐 site.webmanifest

```json
{
  "name": "Codex Studio",
  "short_name": "Codex",
  "icons": [
    { "src": "./assets/favicon/favicon-32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "./assets/favicon/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ],
  "theme_color": "#212121",
  "background_color": "#212121",
  "display": "standalone"
}
```

---

## 🔒 Frozen-инварианты (проверяет `verify-frozen.js`)

- `BODY-theme-dark-default` — `<body data-theme="dark">`
- `META-theme-color-single` — ровно один тег `<meta name="theme-color">`, без `media=""`
- `META-favicon-16` — favicon-16 присутствует
- `META-manifest` — `<link rel="manifest">` присутствует
- `META-og-image-absolute` — og:image начинается с `https?://`
- `META-og-image-fa-specific` (FA) — og:image оканчивается на `og-free-assets.jpg`
- `SCRIPTS-no-defer` — ни один `<script>` не имеет `defer`
- `SCRIPTS-order` — gsap < ScrollTrigger < main.js < animations.js
- `WORK-cards-18` — на index ровно 18 `.work-card`
- `WORK-cards-ids` — все `EXPECTED_IDS` присутствуют
- `WORK-cards-game-assets` — ≥2 карточек с `data-game-asset="true"`
- `TAGS-buttons` — все `EXPECTED_TAGS` есть в dropdown
- `CASE-tabs-3` — ровно 3 `.case-tab` (2D/3D/Blueprints)
- `CASE-share-desktop` / `CASE-share-mobile` — обе кнопки COPY LINK присутствуют
- `B1-no-logo-home` (FA) — на FA нет id `logo-home`
- `B1-logo-back-portfolio` (FA) — есть `id="logo-back-portfolio"`
- `B6-chevron-icons` (FA) — `cards-toggle` использует ‹‹ / ›› (НЕ SVG-глаза)
- `NO-inline-style-block` (FA) — нет `<style>` в `<head>`
- `N4-game-keeps-tag-cards` (FA) — game-switch не скрывает tag-cards
- `CONSOLE-no-internal-errors` — без внутренних ошибок (внешние CDN-403/404 игнорируются)

Любая правка, ломающая эти тесты — отвергается.

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.8 GOLDEN*
