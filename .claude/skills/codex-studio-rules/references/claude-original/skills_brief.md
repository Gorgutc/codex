# Skills Brief — Codex Studio

> Карта Skills, правила активации, рабочий процесс.
> Платформа: Claude.ai Projects / Claude Code / Anthropic SDK.

---

## 📋 Назначение

**Project Files = источник истины** (briefs, rules, texts, structure, **`verify-frozen.js`**)
**Skills = метод работы** (как генерировать, проверять, ревьюить, деплоить)

Skill-файлы могут устаревать. **`verify-frozen.js` — авторитетнее.** При конфликте: побеждает тест.

---

## 🗂 Активные Skills (10)

| # | Skill файл | Триггеры | Приоритет |
|---|---|---|---|
| 1 | `skill-code-reviewer.md` | проверь, ревью, audit, debug, найди ошибки, pre-deploy | ⭐⭐⭐ |
| 2 | `skill-code-generator.md` | создай, напиши код, верстай, секция, блок | ⭐⭐⭐ |
| 3 | `skill-motion-director.md` | анимация, GSAP, ScrollTrigger, reveal, hover, cursor | ⭐⭐⭐ |
| 4 | `skill-deploy-auditor.md` | деплой, GitHub Pages, Netlify, go live | ⭐⭐⭐ |
| 5 | `skill-a11y-performance.md` | accessibility, a11y, Lighthouse, LCP, CLS, INP | ⭐⭐ |
| 6 | `skill-seo-structured-data.md` | SEO, meta, JSON-LD, schema, Open Graph | ⭐⭐ |
| 7 | `skill-asset-optimizer.md` | изображение, SVG, GLB, HDR, favicon, OG-image | ⭐⭐ |
| 8 | `skill-copy-polisher.md` | написать текст, copy, CTA, tone | ⭐⭐ |
| 9 | `skill-reference-analyzer.md` | скриншот, референс, visual inspiration | ⭐ |
| 10 | `skill-dialog-memory-auditor.md` | прошлые диалоги, повторяющиеся ошибки, обновить инструкции | ⭐ |

---

## 🔄 Стандартный рабочий процесс

### Для нового кода (блок / секция)

```
1. skill-code-generator     → генерация
2. skill-code-reviewer      → проверка (ОБЯЗАТЕЛЬНО)
3. skill-motion-director    → если есть анимации
4. skill-asset-optimizer    → если есть медиа
5. skill-a11y-performance   → a11y + Core Web Vitals
```

### Перед деплоем

```
6. skill-seo-structured-data → проверка SEO и JSON-LD
7. skill-deploy-auditor       → финальный гейт
+ node verify-frozen.js       → 56/56 PASS обязательно
```

### Работа с референсами

```
skill-reference-analyzer → перед заимствованием паттернов
```

### Работа с текстом

```
skill-copy-polisher → перед добавлением английской копии
```

### Анализ recurring issues

```
skill-dialog-memory-auditor → вставь историю диалогов / список ошибок,
                              получи diff-обновления skill-файлов
```

---

## 🥇 Главное правило

**Никогда не принимать сгенерированный код без `skill-code-reviewer`.**
**Никогда не деплоить без `node verify-frozen.js` → 56/56 PASS.**

---

## 📍 Активация Skill

### В Claude Code (агент)
Skill автоматически подхватывается из `.claude/` папки если совпадают триггеры из YAML frontmatter в файле skill-`*`.md.

### Явный вызов
```
Используй skill-code-reviewer.
Проверь этот CSS блок. Выведи только BLOCKER ошибки.
```

### Примеры запросов с автоактивацией
- «Сверстай блок» → `skill-code-generator` + `skill-code-reviewer`
- «Проверь этот код перед деплоем» → `skill-code-reviewer` + `skill-deploy-auditor`
- «Добавь GSAP анимацию появления карточек» → `skill-motion-director`
- «Lighthouse score?» → `skill-a11y-performance`
- «Добавь structured data» → `skill-seo-structured-data`

---

## 📊 Покрытие задач

| Зона проекта | Покрыто Skills |
|---|---|
| Генерация HTML/CSS/JS | ✅ skill-code-generator |
| Ревью и аудит | ✅ skill-code-reviewer |
| GSAP анимации | ✅ skill-motion-director |
| A11y + Core Web Vitals | ✅ skill-a11y-performance |
| SEO + JSON-LD | ✅ skill-seo-structured-data |
| Медиа (изображения, GLB, HDR) | ✅ skill-asset-optimizer |
| English copy | ✅ skill-copy-polisher |
| Референсы | ✅ skill-reference-analyzer |
| Деплой | ✅ skill-deploy-auditor |
| Улучшение skill-системы | ✅ skill-dialog-memory-auditor |

Дополнительные skills для портфолио-сайта не требуются.

---

## ⚠️ Skill spec drift — известный сценарий

Skill может содержать правило, которое проект **сознательно отверг** в более поздней
итерации. Перед применением правки на основании MAJOR/BLOCKER чека:

1. `grep -n "<keyword>" verify-frozen.js`
2. Если есть тест на обратное поведение — skill устарел, правку НЕ применять
3. Сообщить пользователю о конфликте; предложить либо откат правки, либо явный refactor с обновлением теста

**Канонический пример:** theme-color split с `media="(prefers-color-scheme: ...)"` был BLOCKER в Golden 0.4 spec, но в v0.6 [Z6] отвергнут (FOUC bug с хардкодным `<body data-theme="dark">`). `verify-frozen.js` тест `META-theme-color-single` требует ровно 1 тег. Skills уже обновлены.

---

*Версия: 2.3 · Май 2026 · Codex Studio v0.8 GOLDEN · 10 Skills · verify-frozen.js as source of truth*
