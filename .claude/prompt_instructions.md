# Prompt Instructions — Codex Studio

> Мета-файл: правила приоритетов, порядка чтения и неизменяемых решений.

---

## 🥇 Source of truth

**`verify-frozen.js`** в корне проекта — авторитетный регрешен (56 тестов на 2 страницы).
Архитектурные решения зафиксированы в нём. Любая правка, конфликтующая с тестом — отвергается, пока пользователь явно не попросит изменить архитектуру.

**Текущий golden:** v0.8 (см. `16_HANDOFF_v0_8.md` в корне проекта — единый
handoff с историей всех итераций v0.4 → v0.8). Точка отката v0.8 описана
там же в секции «Точка отката».

Перед предложением правки на основании MAJOR/BLOCKER из skill-файла — проверить `verify-frozen.js`:

```bash
grep -n "<keyword>" verify-frozen.js
```

Если есть тест на обратное поведение — **skill-файл устарел**, не реальность.

---

## 📋 Порядок чтения файлов

Перед генерацией / ревью / правкой — читать в этом порядке:

1. **`prompt_instructions.md`** (этот файл)
2. **`project_brief.md`** — цель, аудитория, архитектура страниц
3. **`build_rules.md`** — токены, дизайн-система, запреты
4. **`structure.md`** — файловая структура, порядок CSS/JS, layout
5. **`motion_brief.md`** — анимации
6. **`assets_brief.md`** — изображения, видео, GLB, HDR, favicon
7. **`reference_brief.md`** — референсы и антипаттерны
8. **`texts.md`** — реальный контент сайта
9. **`trusted_sources.md`** — внешние документации
10. **`skills_brief.md`** — карта skills
11. Релевантный `skill-*.md` под задачу
12. **`verify-frozen.js`** — если правка касается архитектурных констант

---

## ⚖️ Приоритеты при противоречиях

```
verify-frozen.js  >  сообщение пользователя в чате  >
project_brief.md  >  build_rules.md  >  structure.md  >  motion_brief.md  >
texts.md  >  любой skill-*.md
```

Skill-файлы — методические, могут устаревать. Тест и явный запрос — авторитетны.

---

## 🔧 Технические константы (frozen)

```
Стек:        HTML + CSS + Vanilla JS (без фреймворков, без npm)
Анимации:    GSAP 3.13.0 + ScrollTrigger + SplitText (через CDN)
Шрифты:      Clash Display + General Sans (Fontshare CDN)
3D-вьювер:   <model-viewer> 4.0.0 (Google) — lazy-load по клику на 3D-tab
HDR:         Polyhaven CC0 (studio / outdoor / dark) в assets/hdr/
Деплой:      GitHub Pages / Netlify / любой статический хост
Домен:       codex.promo
```

### Порядок CSS-ссылок в `<head>` (строго)

```html
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=general-sans@400,500,600&display=swap">

<link rel="stylesheet" href="./css/tokens.css">
<link rel="stylesheet" href="./css/reset.css">
<link rel="stylesheet" href="./css/shared.css">
<!-- index.html: -->
<link rel="stylesheet" href="./css/portfolio.css">
<!-- free-assets.html: -->
<link rel="stylesheet" href="./css/free-assets.css">
```

### Порядок JS перед `</body>` (строго, БЕЗ `defer` / `type="module"`)

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
<script src="./js/main.js"></script>
<script src="./js/animations.js"></script>
```

`model-data.js` (1.1 MB inline GLBs) — **lazy-loaded** в `main.js` при первом клике на 3D-tab. НЕ грузить eagerly.

`<model-viewer>` тоже lazy-loaded (`https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/...`) — динамический `<script>` инжектится при первом 3D-открытии.

### Meta / OG / favicon (строго)

- Один `<meta name="theme-color" content="#212121">` БЕЗ `media=""` (тест `META-theme-color-single`)
- `<link rel="canonical">` обязателен на каждой странице
- `og:url`, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:image` (**абсолютный URL** `https://codex.promo/...`), `og:image:width=1200`, `og:image:height=630`, `og:image:alt`, `og:locale`
- Twitter card: `summary_large_image` + `twitter:title/description/image`
- Per-page OG-image: `og-image.jpg` для index, `og-free-assets.jpg` для FA — НЕ переиспользовать
- Favicon: `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` (180×180), `site.webmanifest` — все 5
- `<link rel="manifest">` на каждой странице
- JSON-LD: index → Organization + WebSite + ItemList; FA → Organization + WebPage

---

## 🚫 Никогда не делать без явного разрешения

- Менять стек (React/Vue/Tailwind/npm/build-tools — запрещены)
- Применять theme-color split с `media="(prefers-color-scheme: ...)"` — отвергнуто в v0.6 [Z6]
- Использовать цвета / шрифты / отступы вне токенов (исключение — `#fff` на `--color-primary`)
- Генерировать placeholder-контент для UI без явной маркировки `REPLACE_WITH_REAL`
- Использовать `localStorage` / `sessionStorage`
- Добавлять `defer` / `type="module"` к скриптам
- Убирать `:not(.tag-card)` из селекторов `.work-card` в `animations.js` (ломает FA)
- Удалять / переименовывать work-card `data-id` (`verify-frozen.js` проверяет `EXPECTED_IDS`)
- Менять количество work-cards (≠18 — тест FAIL)
- Менять список tag-фильтров (`EXPECTED_TAGS` / `EXPECTED_FA_TAGS` в `verify-frozen.js`)

---

## ✅ Всегда делать

- Production-ready код с первой генерации
- Mobile-first (375 → 768 → 1024 → 1280)
- Dark mode по умолчанию (`<body data-theme="dark">`), light — через `data-theme="light"` JS-toggle
- `prefers-reduced-motion` — early-return в `animations.js` + блок в CSS
- Семантический HTML
- Каждое `<img>`: `alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`
- Файловая структура — строго по `structure.md`
- `gsap.registerPlugin(ScrollTrigger)` — первая исполняемая строка `animations.js`
- `:not(.tag-card)` фильтр на любом селекторе `.work-card`, ставящем `opacity:0` / transform / hover
- Сверка с `verify-frozen.js` перед изменением `<head>`, DOM-структуры, ID-ов

---

## 🛠 Skills — карта задач

| Задача | Skill |
|---|---|
| Генерация HTML/CSS/JS | `skill-code-generator.md` |
| Ревью / аудит / pre-deploy | `skill-code-reviewer.md` |
| GSAP, ScrollTrigger, motion | `skill-motion-director.md` |
| Изображения, GLB, HDR, favicon | `skill-asset-optimizer.md` |
| A11y + Core Web Vitals | `skill-a11y-performance.md` |
| SEO, JSON-LD, OG | `skill-seo-structured-data.md` |
| English copy, CTA | `skill-copy-polisher.md` |
| Скриншоты, референсы | `skill-reference-analyzer.md` |
| Деплой, GitHub Pages, Netlify | `skill-deploy-auditor.md` |
| Анализ recurring issues | `skill-dialog-memory-auditor.md` |

**Правило:** после генерации кода всегда прогонять `skill-code-reviewer.md`.

**Публичный skill Anthropic** (если доступен): перед генерацией HTML/CSS/JS читать `/mnt/skills/public/frontend-design/SKILL.md`.

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.8 GOLDEN*
