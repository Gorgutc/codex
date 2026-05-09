# Skills Brief — Codex Studio
> Карта всех Skills, правила активации и рабочий процесс
> Платформа: Claude.ai Projects | Версия: 2.1 | Апрель 2026

---

## 📋 Назначение

**Project Files = источник истины о проекте** (briefs, rules, texts, structure)
**Skills = метод работы** (как генерировать, проверять, ревьюить, деплоить)

В Claude.ai Skills — это `.md` файлы в Project Files.
Активируются явным упоминанием в запросе или автоматически через Project Instructions.

---

## 🗂 Список активных Skills (10 шт.)

| # | Skill файл | Триггеры | Приоритет |
|---|---|---|---|
| 1 | `skill-code-reviewer.md` | проверь, ревью, audit, debug, найди ошибки | ⭐⭐⭐ |
| 2 | `skill-code-generator.md` | создай, напиши код, верстай, секция, блок | ⭐⭐⭐ |
| 3 | `skill-motion-director.md` | анимация, GSAP, ScrollTrigger, reveal, preloader | ⭐⭐⭐ |
| 4 | `skill-deploy-auditor.md` | деплой, GitHub Pages, Netlify, go live | ⭐⭐⭐ |
| 5 | `skill-a11y-performance.md` | accessibility, a11y, Lighthouse, LCP, CLS, INP | ⭐⭐ |
| 6 | `skill-seo-structured-data.md` | SEO, meta, JSON-LD, schema, Open Graph | ⭐⭐ |
| 7 | `skill-asset-optimizer.md` | изображение, видео, WebP, SVG, favicon | ⭐⭐ |
| 8 | `skill-copy-polisher.md` | написать текст, copy, CTA, tone | ⭐⭐ |
| 9 | `skill-reference-analyzer.md` | скриншот, референс, visual inspiration | ⭐ |
| 10 | `skill-dialog-memory-auditor.md` | прошлые диалоги, повторяющиеся ошибки | ⭐ |

---

## 🔄 Стандартный рабочий процесс

### Для кода (новый блок/секция)
```
1. skill-code-generator    → генерация
2. skill-code-reviewer     → проверка (ОБЯЗАТЕЛЬНО)
3. skill-motion-director   → если есть анимации
4. skill-asset-optimizer   → если есть медиа
5. skill-a11y-performance  → a11y + Core Web Vitals
```

### Перед деплоем
```
6. skill-seo-structured-data → проверка SEO и JSON-LD
7. skill-deploy-auditor       → финальный гейт (must pass)
```

### Работа с референсами
```
skill-reference-analyzer → перед любым заимствованием из другого сайта
```

### Работа с текстом
```
skill-copy-polisher → перед добавлением английской копи в HTML
```

### Улучшение проекта (раз в 1–2 недели)
```
skill-dialog-memory-auditor → вставь историю диалогов, получи diff-обновления файлов
```

**Правило:** никогда не принимать сгенерированный код без `skill-code-reviewer`.

---

## 📍 Как активировать Skill в Claude.ai

### Автоматически (через Project Instructions)
Skills активируются автоматически если в Project Instructions прописан маппинг.
Файл с маппингом — `CLAUDE_PROJECT_INSTRUCTIONS.md` → скопировать в Project Settings → Instructions.

### Явный вызов в запросе
```
Используй skill-code-reviewer.
Проверь этот CSS блок. Выведи только BLOCKER ошибки.
```

### Примеры запросов с автоактивацией
- «Сверстай hero секцию» → `skill-code-generator` + `skill-code-reviewer`
- «Проверь этот код перед деплоем» → `skill-code-reviewer` + `skill-deploy-auditor`
- «Добавь GSAP анимацию появления карточек» → `skill-motion-director`
- «Проверь Lighthouse score» → `skill-a11y-performance`
- «Добавь structured data» → `skill-seo-structured-data`

---

## 📊 Покрытие задач Skills

| Зона проекта | Покрыто Skills |
|---|---|
| Генерация HTML/CSS/JS | ✅ skill-code-generator |
| Ревью и аудит кода | ✅ skill-code-reviewer |
| GSAP анимации | ✅ skill-motion-director |
| A11y + Core Web Vitals | ✅ skill-a11y-performance |
| SEO + JSON-LD | ✅ skill-seo-structured-data |
| Медиа (изображения, видео) | ✅ skill-asset-optimizer |
| Английская копия | ✅ skill-copy-polisher |
| Референсы и скриншоты | ✅ skill-reference-analyzer |
| Деплой на GitHub Pages/Netlify | ✅ skill-deploy-auditor |
| Улучшение проекта по итогам работы | ✅ skill-dialog-memory-auditor |

**Вердикт покрытия:** полный для портфолио-сайта. Дополнительные Skills не требуются.

---

---

## 🆕 Updated for Golden 0.4 (May 2026)

Все 10 Skills обновлены под Golden 0.4. Ключевые изменения:

- **GSAP:** все упоминания `3.12.5` → `3.13.0`. Третий CDN-скрипт `SplitText.min.js` теперь часть стека.
- **`code-reviewer`:** добавлены чеки на отсутствие `<link rel="manifest">`, на отсутствие META `theme-color` для light/dark prefers-color-scheme, на наличие `og:image:width/height/alt`, и на raw `&` без encode.
- **`code-generator`:** требование 3-х CDN-скриптов GSAP вместо 2-х.
- **`motion-director`:** официально подтверждено использование SplitText (бесплатен в 3.13.0+).
- **`deploy-auditor`:** обновлён pre-deploy чеклист — раздел Script Order теперь требует 3 CDN-ссылки.

---

*Версия: 2.2 | Май 2026 | Codex Studio Skills Pack (10 Skills) | Claude.ai Projects | Golden 0.4*