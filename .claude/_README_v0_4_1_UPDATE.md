# Skills Update Pack — Codex Studio v0.4.1
## Theme-color architecture fix + new recurring issue

Обновлено 5 файлов skill-системы Codex Studio. Замени их в Project Files Claude.ai.

---

## Что изменилось

### Корневая причина обновления

Skill-spec Golden 0.4 (April 2026) содержал BLOCKER-чек:
> «theme-color должен быть split на `media="(prefers-color-scheme: dark/light)"`»

Это правило **некорректно** для архитектуры Codex Studio v0.6 [Z6]+, где:

1. `<body data-theme="dark">` жёстко-задан в HTML (НЕ зависит от system preference)
2. Manual toggle через `#theme-toggle` управляет темой через JS `applyTheme()`
3. JS обновляет `<meta name="theme-color">` content при каждом toggle

При split с `media=""` пользователь с системной светлой темой получал FOUC bug:
тёмный фон страницы (data-theme="dark") + светлая адресная строка (media-rule).

В v0.6 [Z6] split был **сознательно отвергнут**, и `verify-frozen.js` тест
`META-theme-color-single` явно требует ровно один тег. Skill-файлы продолжали
советовать split — это и есть Skill spec drift.

---

## Изменённые файлы (5 шт.)

| Файл | Что изменилось |
|---|---|
| **skill-dialog-memory-auditor.md** | + новый раздел «Skill spec drift relative to test suite» с разбором кейса; - убрана строка про theme-color split из списка recurring issues |
| **skill-code-reviewer.md** | BLOCKER-чек переписан: «единый тег без media + JS update» вместо split |
| **skill-deploy-auditor.md** | Pre-deploy чек переписан аналогично; добавлена ссылка на verify-frozen.js test |
| **skill-seo-structured-data.md** | Раздел «theme-color split» переписан: правильный single-tag паттерн + объяснение, когда split реально применим |
| **skill-code-generator.md** | Правило генерации переписано: ОДИН тег без media |

---

## Как применить

1. Скопируй все 5 файлов в Project Files Claude.ai через UI:
   ```
   Settings → Project Files → Replace
   ```
2. Дополнительно скопируй этот README, если хочешь сохранить контекст для будущих коллег

После обновления — все Skills будут работать в контексте Codex Studio v0.7.4 baseline,
никакой будущий AI-prompt больше не предложит split с media= для theme-color.

---

## Проверка

После замены файлов в новом чате задай вопрос:
> «Какой паттерн для `<meta name="theme-color">` использовать в Codex Studio?»

**Правильный ответ:**
> Один тег `<meta name="theme-color" content="#212121">` без `media=""`. JS `applyTheme()`
> в `main.js` обновляет content при manual toggle. Split с media был отвергнут в v0.6 [Z6]
> из-за FOUC с жёстко-заданным `<body data-theme="dark">`.

**Неправильный ответ (значит, обновление не применилось):**
> Использовать два meta-тега с `media="(prefers-color-scheme: dark)"` и `light`.

---

## Связанный артефакт: codex-studio-v0_7_4.zip

Этот skills-update сопровождает релиз кода v0.7.4. См. `15_HANDOFF_v0_7_4.md` для
подробностей по двум код-правкам и подробному обоснованию rejected P1 (theme-color split).

---

*Версия: 0.4.1 · 8 мая 2026 · Codex Studio Skills Update · theme-color architecture clarification*