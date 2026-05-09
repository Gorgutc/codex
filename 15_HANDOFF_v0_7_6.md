# 15 — HANDOFF · v0.7.6
## Codex Studio — Tablet responsive fix on top of v0.7.5 frozen baseline

> Точечный релиз: исправление адаптации `.fa-grid` для планшетных размеров
> (iPad portrait 820px, iPad landscape 1180px, laptop 1280px). При открытом
> sidebar три колонки сжимались до 140-290px, что нарушало читаемость
> карточек ассетов и предпросмотра 3D-моделей.

---

## 📦 Версия и статус

- **Версия:** 0.7.6
- **Дата:** 8 мая 2026
- **Архив:** `codex-studio-v0_7_6.zip` (накатывается поверх v0.7.5 базы)
- **Базируется на:** v0.7.5 (frozen) → 1 файл, 2 точечные правки в CSS
- **Точка отката:** v0.7.5 (откат всего на v0.7.5 безопасен)

---

## 🎯 Что исправлено

`.fa-grid` теперь использует **container-aware auto-fit**:

- На любом viewport ≥768px количество колонок определяется доступной
  шириной `.main-area` (а не window.width). Это автоматически отвечает
  на toggle sidebar — никакого `body.cards-collapsed` watcher'а не нужно.
- Минимум 320px на карточку — порог читаемости (thumb 4:3 → 240px высоты,
  body с правильной типографической иерархией).
- На viewport ≥1440px — стабильные 3 колонки (cap для 2K/4K мониторов,
  где auto-fit дал бы 4+).

### Поведенческая матрица после фикса

| Viewport | Sidebar | main width | Колонок | Ширина карточки |
|---|---|---|---|---|
| ≤767 (mobile) | — | — | **1** | full width |
| 820 portrait | open | ~480 | **1** | 480px |
| 820 portrait | collapsed | ~820 | **2** | ~398 |
| 1024 (iPad Pro portrait) | open | ~684 | **2** | ~330 |
| 1024 | collapsed | ~1024 | **3** | ~325 |
| 1180 (iPad Pro landscape) | open | ~840 | **2** | ~408 |
| 1180 | collapsed | ~1180 | **3** | ~377 |
| 1280 (small laptop) | open | ~940 | **2** | ~458 |
| 1280 | collapsed | ~1280 | **3** | ~410 |
| 1440 (laptop) | open | ~1100 | **3** | ~366 |
| 1440 | collapsed | ~1440 | **3** | ~480 |
| ≥1920 (2K/4K) | any | capped 1440 | **3** | ~480 |

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `css/free-assets.css` | 2 правки: новый базовый rule + 2 новых media + удаление 1 дубля | +25/-2 |

### Файлы НЕ изменены

- `index.html`, `free-assets.html`, `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/shared.css`, `css/portfolio.css`
- `verify-frozen.js`, `README.md`, все ассеты, favicons, manifest, sitemap, robots, llms

---

## 🛠 Технические детали правок

### Правка 1 — базовое правило `.fa-grid` (строка 89)

```css
/* БЫЛО */
.fa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* ← жёстко 3 cols на любом размере */
  gap: 24px;
  padding: 24px 0 64px;
  list-style: none;
}

/* СТАЛО */
.fa-grid {
  display: grid;
  grid-template-columns: 1fr;  /* ← mobile-first 1 col, tablet/desktop в media */
  gap: 24px;
  padding: 24px 0 64px;
  list-style: none;
}
```

### Правка 2 — два новых media-блока (после базового правила)

```css
/* Tablet + intermediate desktop — auto-fit реагирует на main-area width */
@media (min-width: 768px) {
  .fa-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}

/* Wide screens — cap на 3 колонки, чтобы 4K не давал 4+ */
@media (min-width: 1440px) {
  .fa-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
```

### Правка 3 — удаление дублирующей строки (строка ~414, ныне ~437)

```css
/* БЫЛО */
@media (max-width: 1100px) and (min-width: 768px) {
  .fa-view { padding: var(--space-4) var(--space-8) 0; }
  .fa-grid { grid-template-columns: repeat(3, 1fr); }  /* ← перебивало auto-fit */
}

/* СТАЛО */
@media (max-width: 1100px) and (min-width: 768px) {
  .fa-view { padding: var(--space-4) var(--space-8) 0; }
  /* .fa-view padding оставлен — он намеренно меняется на planshet-range */
}
```

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] CSS braces balanced (78/78)
- [x] Никаких `!important` в новом коде (существующий в reduced-motion preserved)
- [x] Никакого хардкода цветов (новые правила не вводят цвета)
- [x] Никаких новых CSS custom properties (используем существующие токены)
- [x] Mobile-first cascade preserved (base → min:768 → min:1440)

### v0.7.6 specific

- [x] **Каскад `.fa-grid` правил в правильном порядке:**
  - Line 89 — base (1fr)
  - Line 105 — `min-width: 768px` (auto-fit minmax 320)
  - Line 114 — `min-width: 1440px` (3 cols cap)
  - Line 479 — `max-width: 767px` (gap override)
- [x] **DOM структура не тронута** — verify-frozen 56/56 should pass
- [x] **Selectors `.fa-grid` / `.fa-card` preserved** — все verify-frozen tests на DOM count работают
- [x] **`<link rel="manifest">` preserved** ✓
- [x] **theme-color single-tag preserved** ✓
- [x] **GSAP scripts order preserved** ✓ (free-assets.html не трогаем)
- [x] **`:not(.tag-card)` filter preserved** ✓ (animations.js не трогаем)
- [x] **model-viewer logic v0.7.5 preserved** ✓ (free-assets.html не трогаем)

### Verify-frozen test mapping

| Test | Risk after this release |
|---|---|
| `GRID-rendered` (.fa-card count > 0) | ✓ PASS — DOM не меняем |
| `TAG-product-switch` (5 карточек после product) | ✓ PASS — `FA_DATA` не меняем |
| `N4-game-keeps-tag-cards` | ✓ PASS — tag-card логику не трогаем |
| `META-theme-color-single` | ✓ PASS — head не трогаем |
| `META-manifest` | ✓ PASS |
| `SCRIPTS-no-defer` | ✓ PASS — html не трогаем |
| Все остальные 50 тестов | ✓ Unaffected |

После применения: ожидание `node verify-frozen.js` → `SUMMARY: 56/56 PASS, 0 FAIL`.

---

## 🧪 Manual QA checklist

### iPad portrait (820 viewport, sidebar OPEN)

- [ ] Открыть free-assets.html → Hard Surface
- [ ] Видна **1 карточка в ряд** (была 3 сжатых)
- [ ] Карточка занимает ~480px ширины — model-viewer thumb видно нормально
- [ ] Кнопка "DOWNLOAD — XX MB" в одну строку
- [ ] Тэги в одну-две строки (не оборачиваются хаотично)

### iPad portrait (820 viewport, sidebar COLLAPSED)

- [ ] Тапнуть на «« Hide projects → sidebar уезжает
- [ ] Видны **2 карточки в ряд** (были 3 сжатых)
- [ ] Карточки ~398px каждая — комфортно

### iPad landscape (1180 viewport, sidebar OPEN)

- [ ] Повернуть планшет в landscape
- [ ] **2 карточки в ряд**, ~408px каждая ✓
- [ ] (было 3 сжатых ~256px)

### iPad landscape (1180 viewport, sidebar COLLAPSED)

- [ ] **3 карточки в ряд**, ~377px каждая ✓
- [ ] (было 3, ширина та же)

### Laptop 1280px (sidebar OPEN)

- [ ] **2 карточки в ряд**, ~458px каждая
- [ ] Это улучшение vs предыдущее 3 cols ~290px

### Laptop 1440px (screenshot-2 сценарий)

- [ ] **3 карточки в ряд**, ~366px каждая ✓ (как было — поведение не изменилось)

### 2K/4K monitor

- [ ] **3 карточки в ряд** ✓ (как было)
- [ ] Не превращается в 4+ cols на широких экранах

### Mobile ≤767 (regression — должно остаться как было)

- [ ] **1 карточка в ряд** ✓
- [ ] Никаких визуальных регрессий

### Reduced-motion (regression)

- [ ] DevTools → Rendering → Emulate prefers-reduced-motion: reduce
- [ ] Hover scale на карточках отключён ✓

### Regression полная

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано (frozen / out of scope)

По решению пользователя — только адаптация planshet-range. **Не сделано:**

- **Нет** изменений в `.fa-card` внутренней разметке (структура карточки)
- **Нет** изменений в `.fa-card__thumb` aspect-ratio (4:3 preserved)
- **Нет** изменений в model-viewer параметрах (auto-rotate / reveal / lazy preserved)
- **Нет** изменений в sidebar tag-cards (отдельная компонента)
- **Нет** изменений в case-view на index.html (frozen v0.7.5)
- **Нет** изменений в JS-коде (вся логика v0.7.5 preserved)

### Альтернативы рассмотрены и отклонены

| Подход | Почему отклонён |
|---|---|
| Container queries `@container` | Требует новый CSS layer (`container-type: inline-size` на main-area). Auto-fit достаточно для нашего случая. |
| JS-listener на cards-collapsed | Усложняет архитектуру (race conditions, jank). Auto-fit делает то же чисто-CSS. |
| Жёсткие breakpoints (768/1024/1280/1440) | Не учитывает sidebar state. Toggle sidebar не пересчитывает grid. |
| 280px минимум | Слишком тесно для preview 3D. Не проходит читабельность title/desc. |
| 360px минимум | На iPad landscape collapsed (1180) даёт 3 cols (1180/360=3.27 → 3 cols), но гранично. 320 надёжнее. |

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.5 без изменений:

- Performance LCP 2-3s на index.html
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders

Кандидаты для v0.8.x — когда пользователь явно запросит.

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.5 остаются заморожены, кроме одного явно изменённого
файла в этом релизе (`css/free-assets.css`). Дальнейшие изменения требуют
прямого запроса пользователя.

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 🎯 Что делать пользователю

### Сейчас

1. Подменить `css/free-assets.css` в проекте на новую версию (один файл)
2. Открыть free-assets.html в DevTools → Toggle device toolbar
3. Проверить три ключевых сценария:
   - iPad Air (820 portrait), sidebar open → 1 col
   - iPad Air (820 portrait), sidebar collapsed → 2 col
   - iPad Pro (1180 landscape), sidebar open → 2 col
4. Прогнать `node verify-frozen.js` → ожидание `56/56 PASS`

### При обнаружении багов

Прислать скриншот с указанным viewport (DevTools → device toolbar shows ширину).
Точечный фикс через v0.7.6.x.

### Production deploy

Никаких новых dependencies. CSS-only fix. GitHub Pages / Netlify deploy
идентичен v0.7.5.

---

*Версия: 0.7.6 · 8 мая 2026 · Codex Studio · Tablet responsive grid fix*
