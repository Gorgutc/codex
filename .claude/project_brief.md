# Project Brief — Codex Studio

> Главный документ проекта — цель, аудитория, позиционирование, стиль.
> Версия сайта: **v0.7.10 GOLDEN FROZEN** (9 мая 2026).
> Источник истины архитектуры — `verify-frozen.js` (56/56 PASS).

---

## 🎯 Цель проекта

Портфолио-сайт 3D-дизайн-студии (Hard Surface, Product Viz, Game Assets) уровня Senior.
Production-ready static-site без фреймворков. Разворачивается через GitHub Pages / Netlify / любой статический хостинг.

**Главная задача:** показать уровень и стиль автора зарубежным клиентам и работодателям.
**Критерий успеха:** посетитель за 5 секунд понимает — это серьёзный профессионал, не шаблон.

**Домен:** `codex.promo` (canonical, OG, JSON-LD, sitemap, llms.txt).

---

## 👤 Аудитория

**Первичная:**
- Арт-директора и креативные директора в студиях и агентствах (международный рынок)
- Продуктовые компании и стартапы — 3D-визуализация для прототипирования и маркетинга
- Игровые студии и продакшн-компании, нанимающие 3D-художников

**Вторичная:**
- Коллеги-дизайнеры (профессиональное сообщество)
- Партнёры по фрилансу

**Что должен почувствовать посетитель:** «Это профессионал. Хочу посмотреть работы. Хочу написать.»

---

## 🧭 Позиционирование

| Параметр | Значение |
|---|---|
| Специализация | Hard Surface 3D + Product Viz + Game Assets |
| Уровень | Senior |
| Подход | Качество, излишняя детализированность, инженерная точность |
| Локация | Remote, global |
| Ключевое слово | Precision |
| Язык контента | English только |

**Голос бренда:** уверенный, немногословный, профессиональный. Никаких клише.

---

## 🏗 Архитектура сайта (v0.7.10)

**Две страницы:**

1. **`index.html`** — основное портфолио. Layout `aside.sidebar` (340px) + `main.case-view`.
   - Sidebar: logo / Contact (Telegram) / theme-toggle / cards-toggle (chevrons ‹‹/››) / tags-dropdown (OR-фильтр дисциплин) / game-switch / scrollable список **18 work-cards** / site-footer
   - Case-view: header (title+meta) → tabs **2D / 3D / Blueprints** + case-nav (prev/next + counter `n / N`) + COPY LINK → progress bar → switching view (case-scroll / case-3d через `<model-viewer>` / case-blueprints SVG)
   - Дополнительно: custom cursor, film-grain (`body::before`), vignette (`body::after`)

2. **`free-assets.html`** — каталог CC0/CC-BY 3D-ассетов (та же sidebar-структура, `tag-cards` + `fa-card`-grid, своя категоризация)

**Не страница, но артефакт:** `_beget-placeholder.php` — дефолтный заглушка-файл хостинга Beget, к проекту не относится, переименован в `_*` чтобы не мешать.

---

## 🎨 Визуальный стиль

**Общее ощущение:** тёмный, дорогой, точный. Уровень atlab.io / lusion.co.

**Палитра:** холодная нейтральная база (`#212121`) + один точечный акцент — стальной синий `#327AAE` (с `#fff` для текста на нём = WCAG AA 4.64:1). `--color-secondary: #2E8B8F` (тил) — для специфических контекстов.

**Типографика:** контраст между display-шрифтом (Clash Display от 24px и выше) и sans-serif (General Sans для всего остального).

**Плотность:** sidebar-плотный (карточки списком), case-view — визуальный (галерея кейса в вертикальном скролле).

**Режим:** dark по умолчанию (`<body data-theme="dark">` хардкод), light — через manual toggle (НЕ через `prefers-color-scheme`).

**Атмосфера:** film-grain + vignette overlays поверх `<body>` для лёгкого «плёночного» ощущения. В light — ослаблены.

---

## 🔧 Технический стек

```
HTML + CSS + Vanilla JS          ← без фреймворков, без npm
GSAP 3.13.0 + ScrollTrigger      ← через CDN
+ SplitText (free since 3.13.0)
Clash Display + General Sans     ← Fontshare CDN
<model-viewer> (Google)          ← lazy-loaded для 3D-вкладки
HDR (Polyhaven CC0)              ← IBL освещение в 3D-вьювере
```

**Деплой:** GitHub Pages / Netlify / любой статический хост. Серверный код отсутствует.

---

## 🔒 Неизменяемые решения (frozen, не менять без явного запроса)

- Технический стек — vanilla HTML/CSS/JS
- Архитектура страниц — sidebar + case-view (на index), tag-cards + fa-grid (на FA)
- Двойной хардкод темы: `<body data-theme="dark">` + JS `applyTheme()` обновляет `<meta name="theme-color">` content
- **Один тег `<meta name="theme-color">` без `media=""`** — проверяется тестом `META-theme-color-single` в `verify-frozen.js`
- 18 work-cards с фиксированными `data-id` (см. `EXPECTED_IDS` в `verify-frozen.js`)
- Tag-категории index: `all / hard-surface / product / organic / prototyping / animations / cad`
- Tag-категории FA: `hard-surface / product / game / organic / animation / cad`
- Файловая структура и порядок CSS/JS — строго по `structure.md`
- Все скрипты перед `</body>`, без `defer`, без `type="module"`
- Язык контента — English (никакой кириллицы в UI)
- Цвета — только из `tokens.css` через CSS-переменные

**Source of truth для архитектурных решений:** `verify-frozen.js`. Skill-доки могут устаревать, тесты — нет.

---

*Версия: 2.0 · Май 2026 · Codex Studio v0.7.10 GOLDEN FROZEN*
