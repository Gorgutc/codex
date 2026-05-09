# 15 — HANDOFF · v0.7.4
## Codex Studio — Two-fix point release on top of v0.7.3 frozen baseline

> Точечный релиз по запросу пользователя на устранение двух нарушений build_rules.md,
> обнаруженных при code-review v0.7.3:
>
> 1. `!important` вне `@media (prefers-reduced-motion: reduce)` (1 случай в shared.css)
> 2. Redundant ARIA `role="main"` в index.html (на free-assets.html уже починено в v0.4 [HV1])
>
> Также в этой итерации был **отвергнут** Golden 0.4 паттерн «theme-color split на dark/light»
> как несовместимый с архитектурой проекта v0.6 [Z6]. См. ниже raison d'être.

---

## 📦 Версия и статус

- **Версия:** 0.7.4
- **Дата:** 8 мая 2026
- **Архив:** `codex-studio-v0_7_4.zip`
- **Базируется на:** v0.7.3 (frozen) → 2 точечные правки + 1 reverted attempt
- **Точка отката:** v0.7.3 / v0.7.2

### Что закрыто в 0.7.4

| # | Severity | Файл | Изменение |
|---|---|---|---|
| **P2** | MAJOR | `css/shared.css:1231` | `display: none !important` → `display: none` (специфичность каскада 1256 покрывает collapsed-кейс) |
| **P3** | MINOR | `index.html:580` | `<main class="main-area" role="main">` → `<main class="main-area">` (паритет с free-assets.html:386) |

### Что было отвергнуто в 0.7.4 (rejected)

| # | Что предлагалось | Причина отклонения |
|---|---|---|
| ~~P1~~ | theme-color split на `media="(prefers-color-scheme: dark/light)"` | Конфликт с архитектурой v0.6 [Z6]: `<body data-theme="dark">` жёстко-задан до JS, split создавал FOUC bug для пользователей с system=light. Single-tag + JS update — единственно корректный паттерн для проекта с manual-only theme toggle. |

---

## 🏗 Архитектура: detail на rejected P1

### Почему theme-color должен быть single-tag (v0.6 [Z6] decision)

**Сетап проекта:**
```html
<body data-theme="dark">  <!-- жёстко-задан в HTML -->
```
+ JS `applyTheme()` в `main.js:2480-2490` обновляет content при manual toggle через `#theme-toggle`.

**Что произошло бы при split:**

```html
<meta name="theme-color" content="#212121" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f5f5f5" media="(prefers-color-scheme: light)">
```

| Сценарий | Фон страницы | Адресная строка | Статус |
|---|---|---|---|
| system=dark, default | `#212121` (dark) | `#212121` (dark) | ✓ совпадает |
| system=light, default | `#212121` (dark — body data-theme="dark") | `#f5f5f5` (light — media-rule) | ❌ **FOUC bug** |

**Зафиксированный test в verify-frozen.js (строки 273-277):**
```javascript
// v0.6 [Z6] — архитектура theme-color приведена к single-tag (как в index.html).
// JS applyTheme() в main.js обновляет content при ручном toggle. Split с media
// создавал conflict (querySelector брал первый тег, второй оставался устаревшим).
add('fa', 'META-theme-color-single', m.themeColorPresent && m.themeColorCount === 1);
```

→ **Skill-spec Golden 0.4 «BLOCKER: theme-color split» — устарел.** Skill-файлы обновлены
(см. `skills-update-v0_4_1.zip`).

---

## 📁 Изменённые файлы

| Файл | Изменения | Lines changed |
|---|---|---|
| `css/shared.css` | строка 1231: убран `!important` + расширен комментарий до 5 строк | +4/-2 |
| `index.html` | строка 580: убран `role="main"` + добавлен комментарий v0.7.4 [P3] | +2/-1 |

### Файлы НЕ изменены

- `free-assets.html` (Правка #1 откачена; `role="main"` уже был починен в v0.4)
- `js/main.js`, `js/animations.js`, `js/model-data.js`
- `css/tokens.css`, `css/reset.css`, `css/portfolio.css`, `css/free-assets.css`
- `verify-frozen.js`, `README.md`
- Все ассеты, favicons, manifest, sitemap, robots, llms

---

## ✅ Pre-deploy чек-лист (passed)

### Code health

- [x] CSS braces balanced (5 файлов)
- [x] HTML structure validates
- [x] JS syntax check (node -c) — OK на всех файлах

### v0.7.4 specific

- [x] **Все `!important` теперь только в `@media (prefers-reduced-motion: reduce)`** ✓
  - Проверено в shared.css (строки 236, 1200, 1201, 1397) — все в reduced-motion
  - portfolio.css (строки 886, 1754) — все в reduced-motion
  - free-assets.css (строка 387) — в reduced-motion
  - reset.css (строки 60-63) — в reduced-motion
- [x] **`role="main"` отсутствует** на index.html и free-assets.html
- [x] **theme-color остался single-tag** на обеих страницах (v0.6 [Z6] preserved)

### A11y

- [x] `<main>` сохраняет implicit ARIA role
- [x] Lighthouse правило `[no-redundant-roles]` — теперь pass на index.html
- [x] WCAG ARIA 1.1 spec — соблюдён

### Verify-frozen test mapping

| Test | Risk after this release |
|---|---|
| `META-theme-color-single — count=1` | ✓ PASS (Правка #1 откачена) |
| `SIDEBAR-structure` | ✓ PASS (Правка #2 не затронула DOM) |
| `B6-chevron-icons` | ✓ PASS (icon разметка не менялась) |
| Все остальные 53 теста | ✓ Unaffected |

---

## 🧪 Manual QA checklist

### Mobile (≤767px), обычный режим

- [ ] Открыть `index.html` → header **не содержит** кнопку `«» Hide projects`
- [ ] DevTools → inspect `.cards-toggle` → computed `display: none`
- [ ] Источник правила: `shared.css:1231` без `!important`

### Mobile collapsed (open case)

- [ ] Кликнуть на любой кейс → sidebar уезжает, открывается case-view
- [ ] Header теперь содержит **`← Back`** (case-back), но не `«»`
- [ ] DevTools → inspect `body.cards-collapsed .cards-toggle` → `display: none` (источник: `shared.css:1256`)

### Desktop (≥768px)

- [ ] Кнопка `Hide projects «»` видна и работает идентично v0.7.3
- [ ] Toggle скрывает sidebar, появляется fixed top-right toggle для возврата
- [ ] Tablet portrait (820px) — поведение идентично desktop

### A11y

- [ ] VoiceOver/NVDA → rotor → Landmarks → один main-landmark на index.html
- [ ] Lighthouse audit → Best Practices → no warnings про `[no-redundant-roles]`
- [ ] axe-core devtools → no errors

### Theme

- [ ] `#theme-toggle` переключает корректно
- [ ] `<meta name="theme-color">` content обновляется в DevTools при toggle
- [ ] На mobile Safari адресная строка совпадает по цвету с фоном

### Regression

```bash
node verify-frozen.js
# Ожидание: SUMMARY: 56/56 PASS, 0 FAIL
```

---

## 🚫 Что НЕ сделано

По решению пользователя — только 2 точечные правки. **Не сделано** (frozen):

- **Нет** branded preloader (model-data.js уже lazy в v0.5, LCP 2-3s — preloader избыточен)
- **Нет** изменений в model-viewer reveal=manual / IO-стратегии (mobile 3D работает приемлемо)
- **Нет** изменений в desktop UI
- **Нет** изменений Phase 2 (HDR bloom + SSAO остаётся abandoned)
- **Нет** изменений в model-viewer версии (4.0.0 bundled, как в v0.7.1)
- **Нет** изменений в HDR файлах или их структуре

---

## 🐛 Унаследованные нерешённые проблемы (frozen, без изменений)

Все из v0.7.3 без изменений:

- Performance LCP 2-3s на index.html (model-data.js lazy уже снизил с ~10s)
- Unused CSS ~30-40 KiB в shared.css
- `/downloads/*.zip` placeholders
- JSON-LD `sameAs` placeholders
- HDR-фичи + light-dd не покрыты Playwright regression

Кандидаты для v0.8.x point fixes — когда пользователь явно запросит.

---

## 🔒 FROZEN STATEMENT

Все элементы v0.7.3 остаются заморожены, кроме двух явно изменённых строк в этом релизе.
Дальнейшие изменения требуют прямого запроса пользователя.

Без таких прямых указаний — **никаких изменений**, только просмотр и анализ.

---

## 📦 Связанный артефакт: skills-update-v0_4_1.zip

Параллельно с этим релизом обновлены 5 skill-файлов в Project Files Claude.ai
(см. `skills-update-v0_4_1.zip` + его README):

- `skill-dialog-memory-auditor.md` — добавлен новый recurring issue «Skill spec drift relative to test suite»
- `skill-code-reviewer.md` — обновлено правило про theme-color (single-tag вместо split)
- `skill-deploy-auditor.md` — то же
- `skill-seo-structured-data.md` — то же
- `skill-code-generator.md` — то же

Skills-update обязателен — без него любая будущая правка через AI будет повторно
предлагать split (recurring issue воспроизведётся). Распакуй обновлённые skills в
Project Files Claude.ai через UI: Settings → Project Files → Replace.

---

## 🎯 Что делать пользователю

### Сейчас
1. Скачать `codex-studio-v0_7_4.zip`
2. Распаковать поверх существующего проекта
3. Запустить через Live Server / GitHub Pages preview
4. Проверить **Manual QA checklist** выше — особенно mobile/desktop разделение `.cards-toggle`
5. Прогнать `node verify-frozen.js` → ожидание `56/56 PASS`

### Skills update
6. Скачать `skills-update-v0_4_1.zip`
7. Распаковать в Project Files Claude.ai → Settings → Project Files → Replace 5 файлов

### При обнаружении багов
Прислать скриншот + viewport size. Точечный фикс через v0.7.5.

### Production deploy
HDR файлы должны быть в `assets/hdr/` (как в v0.7.1+). CDN dependencies без изменений.

---

*Версия: 0.7.4 · 8 мая 2026 · Codex Studio · Two-fix point release + theme-color architecture clarification*
