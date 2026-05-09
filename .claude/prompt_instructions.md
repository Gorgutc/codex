# Prompt Instructions — Codex Studio
> Мета-файл: инструкция для AI о том, как читать и применять файлы этого Space

---

## 📋 Порядок чтения файлов (обязательно)

Перед генерацией любого кода читай файлы в этом порядке:

1. **`prompt_instructions.md`** (этот файл) — правила приоритетов
2. **`project_brief.md`** — цель, аудитория, позиционирование
3. **`build_rules.md`** — дизайн-система, токены, запреты
4. **`motion_brief.md`** — анимации и их правила
5. **`structure.md`** — файловая структура, wireframe, сетка, порядок скриптов
6. **`assets_brief.md`** — правила работы с изображениями и медиа
7. **`reference_brief.md`** — референсы и антипаттерны
8. **`texts.md`** — весь контент сайта
9. **`trusted_sources.md`** — источники для валидации кода
10. **`skills_brief.md`** — карта Skills, рабочий процесс, правила активации

---

## 🔁 Правила частичного обновления

При редактировании одного блока (не всего файла):
- Выводить ТОЛЬКО изменяемый блок с указанием файла и места вставки
- Не переопределять CSS-переменные из `tokens.css` внутри `main.css`
- Если неясно что уже написано — спросить, прежде чем генерировать

---

При противоречии между файлами:

```
project_brief.md  >  build_rules.md  >  motion_brief.md  >  structure.md
```

При противоречии между файлом и сообщением в чате:
```
сообщение в чате > любой файл
```

---

## 🎯 Главная цель

Портфолио-сайт 3D-дизайнера. Не шаблон. Не SaaS-лендинг.
Целевая аудитория — международные арт-директора, игровые студии, продуктовые компании.
Первое впечатление: «Это профессионал. Хочу посмотреть работы. Хочу написать.»

---

## 🔧 Технические константы (не менять)

```
Стек:          HTML + CSS + Vanilla JS (без фреймворков, без npm)
Анимации:      GSAP v3.13.0 + ScrollTrigger + SplitText — через CDN
Шрифты:        Clash Display + General Sans — через Fontshare CDN
Деплой:        GitHub Pages / Netlify (статика)
Структура:     строго по structure.md
```

**Порядок JS-скриптов** (строго перед `</body>`, все без `defer`):
1. `gsap@3.13.0/dist/gsap.min.js` (CDN)
2. `gsap@3.13.0/dist/ScrollTrigger.min.js` (CDN)
3. `gsap@3.13.0/dist/SplitText.min.js` (CDN)
4. `./js/main.js`
5. `./js/animations.js`

**Путь к og-image:** `./assets/img/og-image.jpg` (не `./assets/og-image.jpg`)

---

## 🚫 Никогда не делать без явного разрешения

- Менять технический стек (React, Vue, Tailwind, npm — запрещены)
- Добавлять AI-паттерны (см. `reference_brief.md` → секция ❌)
- Использовать цвета, шрифты или отступы, не описанные в `build_rules.md`
- Генерировать placeholder-контент — только из `texts.md`
- Оставлять TODO, заглушки или незавершённые блоки в коде
- Использовать `localStorage` / `sessionStorage` (блокируется в sandbox)
- Добавлять `defer` к скриптам (ломает порядок загрузки GSAP)
- Использовать хардкод цветов вне CSS-переменных

---

## ✅ Всегда делать

- Production-ready код с первой генерации
- Mobile-first (375px → 768px → 1280px)
- Dark mode по умолчанию (`data-theme="dark"` на `<body>`), light mode через `data-theme="light"`
- `prefers-reduced-motion` — обязательно в CSS и GSAP
- Семантический HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- Каждое изображение: `alt`, `width`, `height`, `loading="lazy"` (кроме hero)
- Hero-изображение: `loading="eager"` + `fetchpriority="high"`
- Файловая структура строго по `structure.md`
- `gsap.registerPlugin(ScrollTrigger)` — первая строка в `animations.js`

---

## 🛠 Skills — читай нужный файл перед задачей

| Задача | Файл |
|---|---|
| Генерация HTML/CSS/JS | `skill-code-generator.md` |
| Проверка кода | `skill-code-reviewer.md` |
| Анимации, GSAP, ScrollTrigger | `skill-motion-director.md` |
| Изображения, видео, SVG, favicon | `skill-asset-optimizer.md` |
| Accessibility, Lighthouse, Core Web Vitals | `skill-a11y-performance.md` |
| SEO, meta, JSON-LD, Open Graph | `skill-seo-structured-data.md` |
| Английские тексты, CTA, копирайт | `skill-copy-polisher.md` |
| Скриншоты, референсы | `skill-reference-analyzer.md` |
| Деплой, GitHub Pages, Netlify | `skill-deploy-auditor.md` |
| Анализ повторяющихся ошибок | `skill-dialog-memory-auditor.md` |

**Правило:** после генерации кода всегда запускать `skill-code-reviewer.md`.

**Публичный skill Anthropic:** перед генерацией любого HTML/CSS/JS также читать
`/mnt/skills/public/frontend-design/SKILL.md`

---

---

## 🆕 Updated for Golden 0.4 (May 2026)

- **GSAP:** `3.12.5` → `3.13.0`. Третий CDN-скрипт `SplitText.min.js` обязателен.
- **OG-image для FA:** отдельный `./assets/img/og-free-assets.jpg` (1200×630) — НЕ переиспользовать `og-image.jpg`.
- **`<link rel="manifest">`:** обязателен в `<head>` обеих страниц. Файл — `./assets/favicon/site.webmanifest`.
- **theme-color:** теперь два meta-тега с `media="(prefers-color-scheme: dark|light)"`.
- **`!important` запрет:** разрешён ТОЛЬКО внутри `@media (prefers-reduced-motion: reduce)`. Никаких других случаев.

---

*Версия: 1.3 | Май 2026 | Codex Studio Golden 0.4*