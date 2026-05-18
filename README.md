# Codex Studio — site

Портфолио-сайт 3D-дизайн-студии. Production-ready static site.

## Стек

- HTML + CSS + Vanilla JS (без фреймворков, без npm, без билд-тулов)
- GSAP 3.13.0 + ScrollTrigger + SplitText (CDN)
- Lenis smooth scroll (CDN)
- `<model-viewer>` 4.0.0 — lazy-loaded на первом клике 3D-таба
- Clash Display + General Sans (Fontshare CDN)

## Запуск локально

Любой статический сервер. Например:

```bash
# Python
python3 -m http.server 5555

# Node
npx serve .
```

Открыть http://localhost:5555/

## Регрешен

`verify-frozen.js` — Playwright-регрешен (56 тестов на index + free-assets). Это **source of truth** для архитектуры; любая правка должна оставлять `56/56 PASS`.

```bash
npm install playwright
npx playwright install chromium
node verify-frozen.js
```

## Структура

```
codex/
├── index.html               ← основное портфолио
├── free-assets.html         ← каталог CC0/CC-BY 3D-ассетов
├── verify-frozen.js         ← Playwright-регрешен (source of truth)
├── llms.txt, robots.txt, sitemap.xml, netlify.toml
├── README.md, CHANGELOG.md
├── 08_ITERATION_HISTORY.md  ← хроника фаз
├── 16_HANDOFF_v0_8.md       ← актуальный handoff (последняя итерация)
│
├── css/
│   ├── tokens.css           ← дизайн-токены (цвета/шрифты/отступы) — единственное место для значений
│   ├── reset.css            ← Andy-Bell-style modern reset
│   ├── shared.css           ← общие компоненты обеих страниц (sidebar, cursor, theme, work-card база)
│   ├── portfolio.css        ← только index.html (case-view, case-3d, gallery, blueprints)
│   └── free-assets.css      ← только free-assets.html (fa-grid, fa-card, tag-cards)
│
├── js/
│   ├── main.js              ← CARDS_DATA + sidebar UI + case-view + 3D + theme + filters
│   ├── animations.js        ← все GSAP-анимации
│   ├── free-assets.js       ← логика страницы free-assets.html
│   ├── fa-data.js           ← каталог FA (вынесен из inline)
│   └── model-data.js        ← inline GLB base64 (1.1 MB) — LAZY-LOADED по первому клику 3D-таба
│
├── assets/
│   ├── cards/               ← 18 SVG-thumbnail (превью карточек index)
│   ├── cases/<id>/01..05.svg← 18 кейсов × 5 SVG-слайдов (gallery в case-view 2D)
│   ├── models/              ← 18 GLB (3D-модели кейсов)
│   ├── models/free/         ← GLB для FA
│   ├── hdr/                 ← studio/outdoor/dark.hdr (Polyhaven CC0, IBL для 3D)
│   ├── img/                 ← og-image.jpg, og-free-assets.jpg
│   └── favicon/             ← favicon.ico + 16/32 + apple-touch + site.webmanifest
│
└── downloads/               ← *.zip плейсхолдеры (412 B)
```

## Где редактировать что

- **Цвета, шрифты, отступы** → `css/tokens.css` (единственное место для значений)
- **Текст, карточки, SEO-meta** → `index.html` / `free-assets.html`
- **Логика sidebar / filters / case-view / 3D / theme** → `js/main.js`
- **GSAP-анимации** → `js/animations.js`
- **Каталог FA** → `js/fa-data.js`

## Деплой

Static site. Любой хост (GitHub Pages / Netlify / Vercel / Beget). Domain: `codex.promo`. См. `netlify.toml`.

## Документация

`.claude/` содержит подробные инструкции:
- `prompt_instructions.md` — приоритеты, frozen-константы, запреты
- `structure.md` — файловая структура и layout страниц
- `build_rules.md` — токены, дизайн-система
- `motion_brief.md` — GSAP анимации
- `skill-*.md` — методические гайды (code-review, motion, SEO, a11y, deploy и т.д.)

## Замена плейсхолдеров

- **OG-images** — `assets/img/og-image.jpg` + `og-free-assets.jpg` (1200×630)
- **JSON-LD `sameAs`** — массив `REPLACE_WITH_REAL` в обоих HTML
- **ArtStation/Behance ссылки** — `REPLACE_WITH_REAL` href в `js/main.js`
- **`downloads/*.zip`** — пустые 412 B плейсхолдеры, заменить на реальные архивы
