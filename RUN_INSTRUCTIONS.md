# RUN_INSTRUCTIONS — как запустить Claude Code на этом репо

> Этот файл — единственное, что тебе нужно прочесть перед стартом новой сессии.
> Цель: чтобы Claude сам подтянул всю инфраструктуру (CLAUDE.md, агенты, хуки, slash-команды) и работал максимально автономно — ты только даёшь ТЗ.

---

## TL;DR — 3 шага

1. Открой свежую Claude Code сессию **в каталоге `codex/`** (важно — `.claude/` подхватывается только из CWD).
2. Прямо в первом prompt'е вставь блок **[A] Smoke-test** ниже — проверяешь что инфраструктура жива.
3. Если smoke-test PASS — вставь блок **[B] Pre-task header** и под ним своё ТЗ. Дальше можешь не вмешиваться.

---

## [A] Smoke-test (скопируй и вставь в самый первый prompt свежей сессии)

```
Перед тем как принять ТЗ, выполни проверку инфраструктуры:

1. Подтверди что видишь в системном контексте SessionStart-сводку про
   v0.8 GOLDEN, vanilla HTML+CSS+JS, 18 work-cards, hookSpecificOutput
   от хука .claude/hooks/session-start.sh. Если её нет — STOP, скажи
   мне «session-start hook не отстрелил» и не двигайся дальше.

2. Перечисли по именам все агенты, которые ты видишь в .claude/agents/.
   Должно быть ровно 4: codex-context-keeper, codex-spec-guardian,
   codex-quality-gate, codex-5sec-test.

3. Перечисли все slash-команды в .claude/commands/. Должно быть
   ровно 3: /ship, /run-5sec, /audit-skills.

4. Запусти codex-context-keeper с задачей «верни строки в js/main.js,
   которые реализуют theme toggle (поиск по 'data-theme' и 'toggleTheme').
   Только диапазон строк и FROZEN-флаг по verify-frozen.js. Ничего
   лишнего». Покажи мне его ответ дословно.

5. После п.4 не делай больше ничего. Жди мой следующий prompt.
```

**Если хоть один пункт упал** — не давай ТЗ, сначала разберитесь. Самые частые причины:
- Сессия запущена не из каталога `codex/` → `.claude/` не подхватился. Закрой, перейди `cd codex/`, открой заново.
- Хуки в `.claude/settings.json` есть, но shell-скрипты потеряли `+x` после клона на Windows/WSL → `chmod +x .claude/hooks/*.sh`.
- `npm install` не сделан → `npm install && npx playwright install chromium`.

**Если все 5 пунктов PASS** — можно давать ТЗ.

---

## [B] Pre-task header (вставь ПЕРЕД своим ТЗ)

```
Следуй workflow из CLAUDE.md и RUN_INSTRUCTIONS.md.

Жёсткие правила на эту сессию:

1. Перед ЛЮБОЙ записью или правкой index.html / free-assets.html /
   css/*.css / js/*.js / verify-frozen.js — спавни через Agent tool
   ПАРАЛЛЕЛЬНО в одном tool-turn:
     - codex-spec-guardian (frozen-архитектура)
     - codex-quality-gate (craftsmanship)
     - codex-context-keeper (текущее состояние затрагиваемых файлов)
   Дождись всех трёх. Только после VERDICT: PASS у guardian и
   QUALITY GATE: PASS у quality-gate — пиши файл.

2. PostToolUse hook сам прогонит verify-frozen.js после записи. Если
   он вернёт exit 2 с FAIL — откатывай правку и итерируй, не игнорируй.

3. Для doc-only правок (.claude/skill-*.md, README.md, CHANGELOG.md,
   HANDOFF*.md, *.txt в корне) — гейт не нужен, просто пиши.

4. Если в задаче есть слово «визуально» / «как выглядит» / «hero» /
   «sidebar look» — после записи кода запусти codex-5sec-test против
   скриншота (попроси меня запустить локальный сервер если ещё не).

5. SKILL_DRIFT_REPORT.md — справочный файл. Не редактируй
   .claude/skill-*.md без явной моей просьбы.

ТЗ:

[ТВОЁ ТЗ ЗДЕСЬ]
```

Можно сохранить этот блок отдельно (Notion / .txt) — он будет одинаковый для всех ТЗ.

---

## Что сработает АВТОМАТИЧЕСКИ (без твоего участия)

| # | Что | Когда | Кем |
|---|---|---|---|
| 1 | Инъекция `CLAUDE.md` в системный контекст Claude | session start | сам Claude Code |
| 2 | `SessionStart` hook → сводка v0.8 GOLDEN | session start | `.claude/settings.json` |
| 3 | `UserPromptSubmit` hook → детектит code-keywords (EN+RU), вставляет напоминание про `/ship` | каждый твой prompt | `.claude/settings.json` |
| 4 | `PostToolUse` hook → запуск `node verify-frozen.js` после Write/Edit/MultiEdit на shipped paths (кроме `model-data.js`); exit 2 + stderr при FAIL | после каждой записи | `.claude/settings.json` |
| 5 | Спавн 3 гейт-агентов перед записью кода | если ты вставил блок **[B]** в начале сессии | следует Claude |

## Что нужно сделать ТЕБЕ вручную

| # | Что | Когда |
|---|---|---|
| 6 | Вставить блок **[A]** в первый prompt | один раз в начале новой сессии |
| 7 | Вставить блок **[B]** + ТЗ | каждый раз, когда даёшь новую боевую задачу |
| 8 | Напечатать `/ship "..."`, `/run-5sec ...`, `/audit-skills` | только если хочешь руками вызвать конкретный slash. В обычном flow не нужно — Claude следует тому же runbook'у через **[B]**. |
| 9 | Поднять локальный сервер для visual-проверок | `python3 -m http.server 5555` перед `/run-5sec` |

Slash-команды (`/ship`, `/run-5sec`, `/audit-skills`) **может вызвать только пользователь — Claude напечатать `/` не умеет**. Это by design Claude Code. Поэтому workflow в `CLAUDE.md` сформулирован так, чтобы Claude мог достичь того же эффекта через прямой спавн агентов.

---

## Одноразовая подготовка перед первой сессией

1. Смерджить PR с инфраструктурой (если ещё не).
2. `cd ~/codex/`
3. `npm install` — поставит playwright локально (если ещё не делал).
4. `npx playwright install chromium` — поставит браузер для verify-frozen.js.
5. **На macOS/Linux**: убедись что shell-скрипты исполняемы — `ls -la .claude/hooks/*.sh` должно показывать `-rwxr-xr-x`. Если нет — `chmod +x .claude/hooks/*.sh`.
6. **На Windows/WSL**: убедись что у скриптов LF line endings (не CRLF) — `file .claude/hooks/*.sh`. Если CRLF — `dos2unix .claude/hooks/*.sh`.

Проверка: `node verify-frozen.js` должна выдать `SUMMARY: 56/56 PASS, 0 FAIL`. В sandboxed cloud-окружениях с закрытым CDN allowlist baseline может быть `48/56` — это OK, см. PR #17.

---

## Что НЕ нужно делать

- ❌ Запускать Claude Code из любой папки выше или ниже `codex/`. `.claude/` не подхватится.
- ❌ Редактировать `.claude/settings.json` или скрипты в `.claude/hooks/` во время живой сессии — hook config не реагирует на изменения на лету. Нужен рестарт сессии.
- ❌ Просить Claude «вызови `/ship`» в тексте ТЗ. Claude напишет тебе «извини, не могу вызвать slash» и сделает workaround. Лучше используй блок **[B]** — он эквивалентен.
- ❌ Давать ТЗ на правку `js/model-data.js` без явной необходимости. Этот файл (1.1 MB inline GLB base64) специально исключён из PostToolUse-гейта; правка его не пройдёт верификацию автоматически.
- ❌ Запускать `/audit-skills` чаще раза в неделю. Skill-drift редко меняется, а отчёт перезаписывает `SKILL_DRIFT_REPORT.md`.

---

## Что делать когда что-то пошло не так

| Симптом | Причина | Фикс |
|---|---|---|
| После Edit на CSS Claude молчит и не двигается | PostToolUse hook вернул exit 2 (FAIL в verify-frozen.js). Stderr должен быть в видимом контексте Claude. | Прочти stderr-блок про `[FAIL]` тесты, реши: реальная регрессия (откатывай) или env-baseline (см. PR #17). |
| Claude не спавнит агентов перед записью кода | Ты не вставил блок **[B]** в первый prompt. | Откати, перезапусти сессию, вставь **[B]**. |
| `codex-spec-guardian` всегда возвращает FAIL | Ты на ветке где `verify-frozen.js` сломан или CDN недоступен. | Проверь `node verify-frozen.js` локально. Если 56/56 — проблема не в guardian'е. Если 48/56 в cloud-env — это известный env-baseline. |
| Hook-скрипты говорят `command not found` | Скрипты не исполняемы, или у тебя сильно урезанный shell. | `chmod +x .claude/hooks/*.sh`, проверь что `/usr/bin/env bash` доступен. |
| `/audit-skills` создаёт пустой отчёт | Что-то в скрипте сломалось. | Покажи мне (Claude) вывод — разберёмся. |

---

## Ссылки

- Основной runbook для Claude: `CLAUDE.md` (короткий, сесcион-bootstrap)
- Frozen-правила и приоритеты: `.claude/prompt_instructions.md`
- Файловая структура: `.claude/structure.md`
- Дизайн-токены и запреты: `.claude/build_rules.md`
- Анимации: `.claude/motion_brief.md`
- Skill drift на момент установки инфраструктуры: `SKILL_DRIFT_REPORT.md`
- PR с инфраструктурой: https://github.com/Gorgutc/codex/pull/17
