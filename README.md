# Codex Studio — site

Портфолио-сайт 3D-дизайн-студии. Production-ready static site.

## Стек

- HTML + CSS + Vanilla JS (без фреймворков и npm)
- GSAP 3.12.5 + ScrollTrigger (CDN)
- Clash Display + General Sans (Fontshare CDN)

## Запуск локально

Любой статический сервер, например:

```bash
# Python
python3 -m http.server 5555

# Node
npx serve .
```

Открыть http://localhost:5555/

## Структура

```
codex-studio/
├── index.html
├── css/
│   ├── tokens.css    ← design tokens (единственное место для цветов/типографики)
│   ├── reset.css
│   └── main.css
├── js/
│   ├── main.js       ← фильтр тэгов, keyboard, toggle Hide/Show
│   └── animations.js ← GSAP stagger reveal + magnetic tilt hover
├── assets/
│   ├── img/
│   │   ├── og-image.jpg          ← OpenGraph (1200×630)
│   │   └── work/                 ← ПРЕВЬЮ КАРТОЧЕК СЮДА
│   │       ├── README.md         (таблица имён файлов)
│   │       ├── orbital-mk-ii.jpg
│   │       ├── vega-shell.jpg
│   │       └── … (12 файлов)
│   └── favicon/
├── checklist.md      ← pre-launch чеклист
└── changelog.md      ← лог решений
```

## Где редактировать что

- Цвета, шрифты, отступы → `css/tokens.css`
- Текст, карточки, SEO-меta → `index.html`
- Логика фильтров, счётчик → `js/main.js`
- Анимации → `js/animations.js`

## Замена текстового логотипа на SVG

1. В `index.html` внутри `<a class="logo">` удалить `<span class="logo__text">CODEX</span>`
2. Вставить `<svg class="logo__svg" viewBox="0 0 120 24" aria-hidden="true">…</svg>`
3. Размеры управляются `.logo__svg` в `css/main.css` (высота 22px)

## Замена плейсхолдеров у карточек

Положи JPG/WEBP в `./assets/img/work/` с именами из таблицы в [assets/img/work/README.md](./assets/img/work/README.md).
Рекомендуемо: 800×600 px, ≤ 200 KB, sRGB. Если файл не существует — остаётся градиент-плейсхолдер (fallback на `onerror`).
