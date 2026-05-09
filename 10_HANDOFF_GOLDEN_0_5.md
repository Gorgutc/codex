# 10 — HANDOFF · GOLDEN 0.5
## Codex Studio — Performance + Accessibility итерация

> Закрыты все 5 нерешённых проблем из Golden 0.4. **Lighthouse Accessibility =
> 100/100 на обеих страницах.** LCP index упал с 9.9s до 4.2s.
>
> При проблемах с этой версией — откат к Golden 0.4 архиву.

---

## 📦 Версия и статус

- **Версия:** Golden 0.5
- **Дата:** 2 мая 2026
- **Архив:** `codex-studio-v0_5_0-GOLDEN.zip`
- **Базируется на:** Golden 0.4 (`codex-studio-v0_4_0-GOLDEN.zip`)
- **Точка отката:** Golden 0.4

### Финальные метрики

| Проверка | Результат |
|---|---|
| Playwright regression (verify-frozen.js) | **56/56 PASS, 0 FAIL** |
| Lighthouse `index.html` | Perf **73**, A11y **100**, BP 95, SEO 100 |
| Lighthouse `free-assets.html` | Perf ~80, A11y **100**, BP 95, SEO 100 |
| LCP `index.html` | 4.2s (-57% vs 0.4) |
| LCP `free-assets.html` | 4.0s |
| CLS обе страницы | 0 ✓ |
| TBT `index.html` | 320ms |
| html-validate `index.html` | 24 errors (-21 vs 0.4) |
| html-validate `free-assets.html` | 8 errors (-6 vs 0.4) |

### Что закрыто в 0.5

5 проблем из «known issues» Golden 0.4:
1. **#1** Performance index 52→73 (lazy-load model-data.js)
2. **#2** aria-label-misuse — удалены 3 неиспользуемых aria-label
3. **#3** Unused CSS — main.css разделён на shared + portfolio
4. **#4** label-content-name-mismatch — закрыто через #5
5. **#5** `<article role="button">` → `<a href>` (валидно по HTML spec, бонус: shareable URLs)

---

## 📁 Файловая структура (отличия от 0.4)

```
codex-studio/
├── index.html                          ← обновлён: #1, #2, #4, #5
├── free-assets.html                    ← обновлён: #4, #5
├── README.md
├── CHANGELOG.md                        ← обновлён: добавлен v0.5 раздел
├── 08_ITERATION_HISTORY.md             ← обновлён: добавлена Phase 9
├── 09_HANDOFF_GOLDEN_0_4.md            ← остаётся как историческая справка
├── 10_HANDOFF_GOLDEN_0_5.md            ← ★ NEW — этот файл
├── verify-frozen.js                    ← без изменений (v0.4, 56 тестов)
├── css/
│   ├── tokens.css                      ← без изменений
│   ├── reset.css                       ← без изменений
│   ├── shared.css                      ← ★ NEW v0.5 (выделено из main.css)
│   ├── portfolio.css                   ← ★ NEW v0.5 (выделено из main.css)
│   └── free-assets.css                 ← без изменений
├── js/
│   ├── main.js                         ← обновлён: loadModelData, click handlers
│   ├── animations.js                   ← без изменений
│   └── model-data.js                   ← без изменений (теперь lazy-loaded)
└── assets/                             ← без изменений
```

**Удалено в 0.5:**
- `css/main.css` (96.6 KB) — заменён на shared.css + portfolio.css.

---

## 🚀 Что нужно знать перед следующей итерацией (0.6+)

### Shareable URLs работают из коробки

Любая ссылка вида `https://codex.studio/#card-id` теперь открывает кейс напрямую:
- `#orbital-mk-ii` → Orbital Mk.II
- `#vega-shell` → Vega Shell
- ... etc.

В FA: `#hard-surface`, `#product`, `#game`, `#prototyping`, `#animations`, `#cad`.

### model-data.js lazy-loading

`window.CODEX_LOCAL_GLB` будет `undefined` до первого 3D-клика. Если пишешь
новую логику, требующую этих данных при load — вызвать `loadModelData()`
вручную (объявлена как `var` в IIFE main.js — не глобальна).

### CSS подключения

| Страница | Порядок CSS |
|---|---|
| index.html | tokens.css → reset.css → **shared.css → portfolio.css** |
| free-assets.html | tokens.css → reset.css → **shared.css → free-assets.css** |

При создании новой страницы — обязательно `shared.css` первым после reset.

### Active state для work-card / tag-card

Старое: `aria-pressed="true"` (на `<article role="button">`)
Новое: `aria-current="page"` (на `<a>`)

При программном переключении активной карточки — использовать `setAttribute('aria-current', 'page')` / `removeAttribute('aria-current')`.

---

## 🐛 Известные нерешённые проблемы (для Golden 0.6+)

### Performance LCP всё ещё выше 2.5s

LCP 4.2s на index, 4.0s на FA. Дальнейшее улучшение требует:
- Critical CSS inline в `<head>` (выделить shared.css → critical (5 KB) + non-critical)
- Preload main.js + animations.js
- Async loading non-critical CSS

Это **architectural** решение, requires серьёзная перестройка. Откладывать на 0.6+
если приоритет.

### Unused CSS остаётся ~30-40 KiB

В shared.css есть селекторы, которые используются только в части контекстов
(например, mobile-only или collapsed-only). Lighthouse "unused-css-rules" показывает
эти селекторы как unused per page-load, хотя они активируются при определённых
состояниях.

Дальнейшая оптимизация требует **критический путь** — выделить только то, что
точно нужно для first paint, остальное вынести в отдельные `media-query` файлы.

### html-validate `prefer-native-element` (24 + 8 errors)

Все оставшиеся — это `<div role="listbox">` для tags-dropdown (мульти-select с
чекбоксами и chips) + `<div role="region">` для cards-scroll. Это **намеренные
паттерны**, для которых нет нативных эквивалентов. Если переход на нативные
элементы — потеря функциональности UI.

### `/downloads/` content

В архиве 4 заглушки 412 bytes (apex-frame, corten-series, nightshard, orbital-mk-ii).
21 ZIP отсутствует — placeholder для FA download кнопок (выдают 404 при попытке
скачать).

Если FA нужно полностью функциональным — наполнить /downloads/ реальными ZIP.

---

## 🔧 Технические константы (без изменений с 0.4)

| Параметр | Значение |
|---|---|
| Стек | HTML + CSS + Vanilla JS |
| GSAP | 3.13.0 (через `cdn.jsdelivr.net`) |
| Шрифты | Clash Display + General Sans (Fontshare CDN) |
| Темы | dark (default) + light (через `data-theme`) |
| Скрипты | строго перед `</body>`, БЕЗ `defer` |
| Хранилище | НЕТ localStorage / sessionStorage |

---

## ⚠️ Замороженное в 0.5 — НЕ ТРОГАТЬ без явного тикета

### HTML
- `index.html` — целиком (вкл. lazy-load model-data, `<a>` work-cards)
- `free-assets.html` — целиком (вкл. `<a>` tag-cards)

### CSS
- `css/tokens.css`
- `css/reset.css`
- `css/shared.css` — **новый**, заморожен
- `css/portfolio.css` — **новый**, заморожен
- `css/free-assets.css`

### JS
- `js/main.js` (с loadModelData + новыми click handlers)
- `js/animations.js`
- `js/model-data.js` (теперь lazy-loaded, контент не менялся)

### Регрессия
- `verify-frozen.js` — v0.4, 56 тестов

---

## 🔍 Workflow для следующих итераций

1. **Любая правка** = тикет с описанием проблемы + согласование с owner.
2. **После правки** = `node verify-frozen.js` должен дать `56/56 PASS`.
3. **Перед коммитом** = Lighthouse + ручная проверка обеих страниц в браузере.
4. **При сомнениях** = откат: 0.5 → 0.4 → 0.3.5.

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

---

*Версия: 0.5.0 GOLDEN | 2 мая 2026 | Codex Studio*
