# 09 — HANDOFF · GOLDEN 0.4
## Codex Studio — Точка отсчёта для всех будущих итераций

> Эта итерация фиксирует качество обеих страниц перед основной разработкой.
> Любая правка вне явного запроса запрещена. При проблемах — откат к этому архиву.

---

## 📦 Версия и статус

- **Версия:** Golden 0.4
- **Дата:** 2 мая 2026
- **Архив:** `codex-studio-v0_4_0-GOLDEN.rar`
- **Статус:** замороженная база. Откат — к этой версии.

### Прошедшие проверки

| Проверка | Результат |
|---|---|
| Playwright regression (verify-frozen.js v0.4) | **56/56 PASS, 0 FAIL** |
| Lighthouse `index.html` | Perf 54, A11y 96, BP 95, SEO 100 |
| Lighthouse `free-assets.html` | Perf 85, A11y **100**, BP 95, SEO 100 |
| Core Web Vitals — CLS | 0 на обеих страницах ✓ |
| Core Web Vitals — TBT | 170ms (index) / 60ms (FA) — оба ≤ 200ms ✓ |
| Core Web Vitals — LCP | 10.0s (index) / 4.0s (FA) — известное узкое место |
| html-validate (cosmetic errors) | 27 (index) / 8 (FA) — все намеренные |
| Manual code review | пройден |

### Что закрыто в 0.4

17 находок аудита: B1–B6 (BLOCKERs) + M1, M2, M3, M5 (MAJORs) + AX1 (A11y) +
N1, N4, HV1, HV2, HV3 (MINORs) + MX1 (missing asset). Полный список — в `CHANGELOG.md`.

---

## 📁 Файловая структура

```
codex-studio/
├── index.html                          ← основная portfolio-страница (заморожена)
├── free-assets.html                    ← каталог ассетов (заморожена)
├── README.md
├── CHANGELOG.md                        ← полный список изменений 0.4
├── 08_ITERATION_HISTORY.md             ← полная история v0.1 → v0.4
├── 09_HANDOFF_GOLDEN_0_4.md            ← этот файл
├── verify-frozen.js                    ← Playwright regression (56 тестов)
├── llms.txt
├── robots.txt
├── sitemap.xml
├── css/
│   ├── tokens.css                      ← дизайн-токены (заморожен)
│   ├── reset.css                       ← Andy Bell modern reset (заморожен)
│   ├── main.css                        ← основной CSS (заморожен после удаления .top-pills контейнера)
│   └── free-assets.css                 ← ★ NEW v0.4 — стили FA-страницы
├── js/
│   ├── main.js                         ← основная логика (заморожена)
│   ├── animations.js                   ← GSAP анимации (заморожены, с :not(.tag-card) v0.4)
│   └── model-data.js                   ← inline GLB ассеты (1.1 MB, заморожены)
├── assets/
│   ├── cards/                          ← SVG-превью карточек
│   ├── favicon/
│   │   ├── favicon.ico
│   │   ├── favicon-16.png
│   │   ├── favicon-32.png
│   │   ├── apple-touch-icon.png
│   │   └── site.webmanifest            ← ★ NEW v0.4 — PWA-манифест
│   ├── img/
│   │   ├── og-image.jpg                ← OG для index
│   │   └── og-free-assets.jpg          ← ★ NEW v0.4 — OG для FA (1200×630, 31 KB)
│   └── models/                         ← 18 GLB моделей для 3D-вида
└── downloads/                          ← ZIP-архивы для FA download
    ├── apex-frame.zip
    ├── corten-series.zip
    ├── nightshard.zip
    └── orbital-mk-ii.zip
```

**Удалены в 0.4:**
- `changelog.md` (231 KB), `changelog-v0.2.1.md`, `changelog-v0.2.2.md`, `changelog-v0.2.3.md`, `changelog-v0.3.md`
- `checklist.md` (32 KB)
- Все эти файлы заменены единым `CHANGELOG.md` + `08_ITERATION_HISTORY.md`.

---

## 🚀 Как развернуть и проверить

### Локально (для разработки)

```bash
# 1. Установить инструменты
npm i playwright
npx playwright install chromium

# 2. Запустить regression
node verify-frozen.js
# Должно: SUMMARY: 56/56 PASS, 0 FAIL

# 3. Превью в браузере (любой http-server, без CORS)
npx http-server -p 8080
# открыть http://127.0.0.1:8080/
```

### Деплой на GitHub Pages

```bash
# Из корня проекта
git init
git add .
git commit -m "Codex Studio v0.4.0 GOLDEN"
git remote add origin git@github.com:USERNAME/codex-studio.git
git push -u origin main

# Settings → Pages → Source: Deploy from branch main / root
# Через 2-3 минуты — https://USERNAME.github.io/codex-studio/
```

### Деплой на Netlify

1. Drag-drop корня проекта на https://app.netlify.com/drop
2. Готово через 30 секунд.

---

## 🔧 Технические константы (не менять без явного тикета)

| Параметр | Значение |
|---|---|
| Стек | HTML + CSS + Vanilla JS |
| GSAP | 3.13.0 (через `cdn.jsdelivr.net/npm/gsap@3.13.0`) |
| Шрифты | Clash Display + General Sans (Fontshare CDN) |
| Темы | dark (default) + light (через `data-theme`) |
| Скрипты | строго перед `</body>`, БЕЗ `defer` |
| Хранилище | НЕТ localStorage / sessionStorage (запрещены) |
| Модули | НЕТ (`type="module"` запрещён) |
| Сборщики | НЕТ (npm/webpack/vite запрещены) |

### Порядок скриптов (строгий, БЕЗ defer)

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
<script src="./js/main.js"></script>
<script src="./js/animations.js"></script>
<!-- На free-assets.html: <script>...</script> с FA-IIFE — после animations.js -->
```

---

## ⚠️ Замороженное — НЕ ТРОГАТЬ без явного тикета

Каждая правка ниже разрешена ТОЛЬКО при прямом текстовом запросе.

### HTML
- `index.html` — целиком (включая `<title>`, OG, JSON-LD)
- `free-assets.html` — целиком (включая FA-IIFE с `rebindGameSwitch`)

### CSS
- `css/tokens.css` — все токены (цвета, шрифты, отступы, радиусы)
- `css/reset.css` — Andy Bell reset
- `css/main.css` — все стили (включая удалённый `.top-pills` контейнер N1)
- `css/free-assets.css` — **новый**, заморожен

### JS
- `js/main.js` — все обработчики (sidebar, dropdown, theme, case-view, 3D, blueprints)
- `js/animations.js` — **с правками M1**: `:not(.tag-card)` в 3 селекторах
- `js/model-data.js` — inline GLB

### Ассеты
- Все файлы в `assets/cards/`, `assets/favicon/`, `assets/img/`, `assets/models/`
- `assets/favicon/site.webmanifest` — **новый**, заморожен
- `assets/img/og-free-assets.jpg` — **новый**, заморожен

### Скрипты регрессии
- `verify-frozen.js` — v0.4 (56 тестов на 2 страницы, self-contained http-server)

---

## 🐛 Известные проблемы (отложены на 0.5+)

### Performance index.html (Lighthouse 54)

**Корень:** `js/model-data.js` весит 1.1 MB (inline GLB ассеты для 3D-вида).

**Решение для 0.5:** lazy-load — открывать model-data.js только при первом клике на 3D-таб.

### Unused CSS ~80 KiB в main.css

**Корень:** main.css содержит селекторы для всех состояний и компонентов
обеих страниц. На каждой отдельно — много неиспользуемого.

**Решение для 0.5:** аудит unused CSS через PurgeCSS, создание per-page подмножеств,
либо переход к CSS-in-JS / Critical CSS.

### Lighthouse a11y warning: `label-content-name-mismatch`

**Корень:** `aria-label="Hard Surface — 8 assets"` начинается с visible-text `Hard Surface`,
но не идентичен полностью. WCAG 2.5.3 — проходит, но Lighthouse даёт это как warning.

**Решение для 0.5:** либо убрать `aria-label` (visible text сам себя описывает),
либо сделать `aria-label` идентичным visible-text.

### html-validate `prefer-native-element` errors

**Корень:** `<article role="button">` для tag-cards и work-cards — карточки имеют
сложную структуру (img + h2 + p + meta), которую `<button>` не разрешает.

**Решение для 0.5:** возможно переход к `<a>` с `role="button"` (если разрешает A11y),
либо сохранение текущего паттерна как намеренного.

---

## 🔍 Кратко: рабочий процесс на этом проекте

1. **Любая правка** = тикет с описанием проблемы и согласованием.
2. **После правки** = `node verify-frozen.js` должен дать `56/56 PASS`.
3. **Перед коммитом** = Lighthouse + ручная проверка обеих страниц в браузере.
4. **При сомнениях** = откат к Golden 0.4 архиву.

### Порядок Skills для типичных задач

| Задача | Skill |
|---|---|
| Новый блок / секция | code-generator → code-reviewer |
| Анимация | motion-director → code-reviewer |
| Изображения / видео | asset-optimizer |
| A11y / Performance | a11y-performance |
| SEO / structured data | seo-structured-data |
| Английская копия | copy-polisher |
| Перед деплоем | deploy-auditor |
| Регрессия после правок | verify-frozen.js (`node verify-frozen.js`) |

---

*Версия: 0.4.0 GOLDEN | 2 мая 2026 | Codex Studio*
