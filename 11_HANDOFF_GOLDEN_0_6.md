# 11 — HANDOFF · GOLDEN 0.6
## Codex Studio — Bugfix + Polish итерация

> Закрыто 6 задач (Z1, Z2, Z3, Z6, Z7) + найден и исправлен скрытый CSS-cascade
> баг (Z8) с mobile case-share кнопкой. Domain мигрирован на codex.promo.
>
> При проблемах с этой версией — откат к Golden 0.5 архиву.

---

## 📦 Версия и статус

- **Версия:** Golden 0.6
- **Дата:** 2 мая 2026
- **Архив:** `codex-studio-v0_6_0-GOLDEN.zip`
- **Базируется на:** Golden 0.5 (`codex-studio-v0_5_0-GOLDEN.zip`)
- **Точка отката:** Golden 0.5

### Финальные метрики (ожидаемые после прогона regression)

| Проверка | Результат |
|---|---|
| Playwright regression (`verify-frozen.js`) | **56/56 PASS, 0 FAIL** (после Z6 апдейта теста) |
| Lighthouse `index.html` | без изменений vs v0.5 (Perf 73, A11y 100, BP 95, SEO 100) |
| Lighthouse `free-assets.html` | без изменений vs v0.5 (Perf ~80, A11y 100, BP 95, SEO 100) |

### Что закрыто в 0.6

6 задач из ТЗ + 1 скрытый баг:
1. **Z1** — Dropdown-фильтр на FA не сортировал tag-cards (data-tag vs data-category)
2. **Z2** — Глобальная замена домена `codex.studio` → `codex.promo` (26 точек, 5 файлов)
3. **Z3** — case-item media `aspect-ratio` + `clamp` max-height (вместо жёсткого 1040/1100px)
4. ~~Z4~~ — page transition: пропущена (вариант A — оставить existing clip-path reveal)
5. ~~Z5~~ — hover desc reveal: пропущена (вариант A — UX side-effects)
6. **Z6** — theme-color архитектура: single tag везде (приведение FA к index)
7. **Z7** — scroll-hint chevron в case-view (real DOM-element, не `::after`)
8. **Z8** — *bonus*: CSS-cascade conflict mobile case-share (specificity fix)

---

## 📁 Файловая структура (отличия от 0.5)

```
codex-studio/
├── index.html                          ← обновлён: Z2
├── free-assets.html                    ← обновлён: Z1, Z2, Z6
├── README.md
├── CHANGELOG.md                        ← обновлён: добавлен v0.6 раздел
├── 08_ITERATION_HISTORY.md             ← без изменений (v0.5)
├── 09_HANDOFF_GOLDEN_0_4.md            ← историческая справка
├── 10_HANDOFF_GOLDEN_0_5.md            ← историческая справка
├── 11_HANDOFF_GOLDEN_0_6.md            ← ★ NEW — этот файл
├── verify-frozen.js                    ← обновлён: Z6 (META-theme-color-single)
├── robots.txt                          ← обновлён: Z2
├── sitemap.xml                         ← обновлён: Z2
├── llms.txt                            ← обновлён: Z2
├── css/
│   ├── tokens.css                      ← без изменений
│   ├── reset.css                       ← без изменений
│   ├── shared.css                      ← обновлён: Z8 (double-class case-share)
│   ├── portfolio.css                   ← обновлён: Z3, Z7
│   └── free-assets.css                 ← без изменений
├── js/
│   ├── main.js                         ← обновлён: Z7 (showScrollHint)
│   ├── animations.js                   ← без изменений
│   └── model-data.js                   ← без изменений
└── assets/                             ← без изменений
```

**Итого изменённых файлов: 9 (из ~25 в проекте).**

---

## 🚀 Что нужно знать перед следующей итерацией (0.7+)

### Domain мигрирован на codex.promo

- Все canonical, og:url, og:image, twitter:image, JSON-LD URLs, ItemList, sitemap, robots, llms.txt — указывают на `codex.promo`.
- Markdown-документация (CHANGELOG, HANDOFF, ITERATION_HISTORY) сохраняет упоминания `codex.studio` как историческую запись — это правильно, не править.
- Shareable URLs работают с новым доменом: `https://codex.promo/#orbital-mk-ii` и т.д.

### data-category на FA tag-cards

- Все 6 tag-cards на free-assets.html теперь имеют **оба** атрибута: `data-tag` (legacy для inline FA script `selectTag()`) + `data-category` (для main.js `applyFilters()`).
- Если будут добавляться новые tag-cards на FA — **обязательно** добавлять оба атрибута.
- Значения должны совпадать с `data-filter` на чекбоксах в `.tags-dropdown__panel` FA (hard-surface, product, game, organic, animation, cad).

### case-item media: aspect-ratio + clamp

- На desktop+tablet работает `aspect-ratio: 16/9` (wide) и `4/5` (tall), max-height ограничен `clamp`.
- На mobile (≤768px) — отдельный override (без max-height, на 100% width). Не трогать.
- Если ассеты будут менять пропорции — пересмотреть aspect-ratio в `portfolio.css:415-432`.

### theme-color — single tag архитектура

- Обе страницы: `<meta name="theme-color" content="#212121">` без `media=""`.
- При ручном toggle JS `applyTheme()` в main.js обновляет content через `setAttribute`.
- При создании новой страницы — следовать этой архитектуре. **Не использовать media split.**
- Regression test `META-theme-color-single` проверяет ровно 1 тег.

### scroll-hint в case-view

- DOM-element `<div class="case-scroll-hint">` создаётся динамически в `showScrollHint()` из `main.js`.
- Стрелка появляется ТОЛЬКО на первом открытии кейса в сессии. После первого `scroll` действия на `.case-scroll` — навсегда скрывается через класс `.has-scrolled`.
- Animation 3 цикла мигания, opacity 0→0.85→0, translateY ±6px (вертикально, **до** rotate).
- При reduced-motion — `display: none`.
- `.case-view` получил `position: relative` для абсолютного позиционирования стрелки.

### CSS specificity для media-блока case-share

- Mobile case-share стили использyut **double-class selector** `.case-share.case-share--{mobile,desktop}` для победы над portfolio.css (вне @media).
- При добавлении новых `.case-share--*` modifier — следовать этой конвенции, иначе portfolio.css правила перебьют mobile.
- Аналогично для других элементов, где shared.css mobile @media конфликтует с portfolio.css вне media.

### Обновлён `verify-frozen.js`

- Тест `META-theme-color-light-dark` (split) → `META-theme-color-single` (single tag).
- Если в будущем вернётесь к media split — обязательно обновить этот тест обратно.

---

## 🐛 Известные нерешённые проблемы (для Golden 0.7+)

Перенесены без изменений из v0.5 + новые из v0.6:

### Performance LCP всё ещё выше 2.5s (с v0.5)

LCP 4.2s на index, 4.0s на FA. Дальнейшее улучшение требует:
- Critical CSS inline в `<head>` (выделить shared.css → critical (5 KB) + non-critical)
- Preload main.js + animations.js
- Async loading non-critical CSS

Это **architectural** решение, requires серьёзная перестройка.

### Unused CSS остаётся ~30-40 KiB (с v0.5)

В shared.css есть селекторы, которые используются только в части контекстов
(например, mobile-only или collapsed-only). Lighthouse `unused-css-rules` показывает
эти селекторы как unused per page-load.

### html-validate `prefer-native-element` (с v0.5)

24 errors на index, 8 на FA — это `<div role="listbox">` для tags-dropdown
(мульти-select с чекбоксами и chips) + `<div role="region">` для cards-scroll.
Намеренные паттерны, для которых нет нативных эквивалентов.

### `/downloads/` content (с v0.5)

В архиве 4 заглушки 412 bytes (apex-frame, corten-series, nightshard, orbital-mk-ii).
21 ZIP отсутствует — placeholder для FA download кнопок.

### JSON-LD `sameAs` placeholders (с v0.5)

```json
"sameAs": [
  "https://www.artstation.com/REPLACE_WITH_REAL",
  "https://www.behance.net/REPLACE_WITH_REAL",
  ...
]
```
Заменить на реальные URLs перед production deploy.

### Z8 был не в regression покрытии (новое в 0.6)

Mobile case-share отображалась некорректно из-за CSS cascade conflict
(подробности в CHANGELOG v0.6 → Z8). Не покрыт regression-тестом — возможно,
стоит добавить тест `MOBILE-case-share-visible` который:
- Установить viewport 375×812
- Проверить что `.case-share--mobile` имеет computed `display: inline-flex`
- Проверить что `.case-share--desktop` имеет computed `display: none`

### Z7 scroll-hint не покрыт regression тестом (новое в 0.6)

Visual feature, сложно автоматически проверить. Можно добавить тест:
- Открыть кейс
- Подождать 1.3s (после animation-delay 1.2s)
- Проверить что `.case-scroll-hint` существует в DOM
- Проверить computed opacity > 0 (animation в активной фазе)

---

## 🔧 Технические константы (без изменений с 0.5)

| Параметр | Значение |
|---|---|
| Стек | HTML + CSS + Vanilla JS |
| GSAP | 3.13.0 (через `cdn.jsdelivr.net`) |
| Шрифты | Clash Display + General Sans (Fontshare CDN) |
| Темы | dark (default) + light (через `data-theme`) |
| Скрипты | строго перед `</body>`, БЕЗ `defer` |
| Хранилище | НЕТ localStorage / sessionStorage |
| Domain | **codex.promo** (миграция в v0.6) |

---

## ⚠️ Замороженное в 0.6 — НЕ ТРОГАТЬ без явного тикета

### HTML
- `index.html` — целиком (после Z2)
- `free-assets.html` — целиком (после Z1, Z2, Z6)

### CSS
- `css/tokens.css` — без изменений
- `css/reset.css` — без изменений
- `css/shared.css` — **обновлён в Z8**
- `css/portfolio.css` — **обновлён в Z3, Z7**
- `css/free-assets.css` — без изменений

### JS
- `js/main.js` — **обновлён в Z7**
- `js/animations.js` — без изменений
- `js/model-data.js` — без изменений

### SEO/Meta
- `robots.txt`, `sitemap.xml`, `llms.txt` — обновлены в Z2

### Регрессия
- `verify-frozen.js` — **обновлён в Z6** (META-theme-color-single)

---

## 🔍 Workflow для следующих итераций

1. **Любая правка** = тикет с описанием проблемы + согласование с owner.
2. **После правки** = `node verify-frozen.js` должен дать `56/56 PASS`.
3. **Перед коммитом** = Lighthouse + ручная проверка обеих страниц в браузере.
4. **При сомнениях** = откат: 0.6 → 0.5 → 0.4 → 0.3.5.

### Тестовые команды

```bash
# Установка зависимостей
npm i playwright
npx playwright install chromium

# Полная регрессия
node verify-frozen.js
# Ожидаемо: SUMMARY: 56/56 PASS, 0 FAIL

# Локальный preview
npx http-server -p 8080
# открыть http://127.0.0.1:8080/

# Lighthouse через Chrome DevTools
# DevTools → Lighthouse → Generate report → Desktop preset
```

### Manual checks специфичные для v0.6

После прогона regression — выполнить вручную:

1. **Z1**: открыть `free-assets.html` → клик на dropdown «Filter by category» → выбрать «Hard Surface» → должна остаться одна tag-card. Снять чекбокс → 6 вернулись. Multi-select работает.
2. **Z2**: view-source `index.html` → проверить что все ссылки на `codex.promo`. Аналогично для FA.
3. **Z3**: открыть кейс на 27" мониторе → caption под wide-иллюстрацией не уезжает за viewport. На 14" — иллюстрация компактнее.
4. **Z6**: на FA нажать `theme-toggle` (sun/moon) → хром-бар браузера меняет цвет (на Android Chrome заметнее).
5. **Z7**: открыть свежий кейс → через 1.2 сек снизу `.case-view` появляется тонкая стрелка вниз 18×18, мигает 3 раза вертикально (не по диагонали), затем исчезает. После первого скролла — больше не появляется ни на одном кейсе.
6. **Z8**: в DevTools mobile-emulator (375×812) → шапка `.case-mobile-bar` показывает `< Projects` + иконка-only share button (как на скриншоте ТЗ). Текст "COPY LINK" скрыт. Touch-target ≥44×44px.

---

*Версия: 0.6.0 GOLDEN | 2 мая 2026 | Codex Studio*
