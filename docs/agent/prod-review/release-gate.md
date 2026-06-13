# Релизный гейт F6 — go/no-go (2026-06-14)

Финальная итерация pre-production кампании. Ветка `codex/prod-f6-release-gate`
(draft PR, stacked на F5 #51). Цель — прогнать полный набор гейтов, поймать
релизные блокеры, дать вердикт go/no-go.

## Вердикт

**КОД — GO.** Все локальные инженерные гейты зелёные, frozen-контракт цел,
изменения F5/F6 отревьюены (3 агента-стража Opus 4.8 + workflow `/code-review`
7 углов + Codex adversarial). Релиз **остаётся gated только на действиях
владельца**, которые агент выполнить не может: ручной деплой репо→Beget, живая
проверка заголовков/CSP в бою и наполнение контента. См. «Шаги владельца».

Блокер, пойманный гейтом, **исправлен в F6** (см. F6-A11Y-01).

## Прогон гейтов (2026-06-14, на F6 с фиксом footer)

| Гейт | Результат |
| --- | --- |
| `verify` (verify-frozen) | **135/135 — 0 FAIL, 0 SKIPPED** |
| `codex:ship` | exit 0 (plugin 37/37, governance 0, parity, content:check байт-в-байт, golden 2/2, verify-fatal) |
| `check:js` / `check:css` / `check:html` | чисто |
| `check:markdown` / `check:spelling` | чисто |
| `check:deps` / `check:dead` (knip) / `check:duplicates` (jscpd) | чисто |
| `check:audit` (prod, high) | 0 уязвимостей |
| `test:content-validate` | пройден (вкл. orphan-самотест + vimeoHash/layout/playback) |
| `test:browser` (site-smoke) | 6/6 (вкл. preloader-смоук — без флака на этом прогоне) |
| `test:admin` | 21/21 (вкл. новый FA-превью тест) |
| `test:visual` (visual-regression) | 4/4 без диффов |
| `check:a11y` (pa11y WCAG2AA) | **index 0/0, free-assets 0/0** (после фикса F6-A11Y-01) |
| `check:lighthouse` | index perf=83 a11y=95 best=96 seo=100 (LCP 4.2s, CLS 0); free-assets perf=78 a11y=100 best=96 seo=100 (LCP 5.5s, CLS 0) — оба PASS бюджетов |

5-сек визуальный тест: F5 не менял shipped-страницы (только `admin/*`,
`scripts/*`, `tests/*`); F6 добавил лишь `role="group"` на footer (рендер не
меняется — `test:visual` 0 диффов). Первое впечатление сайта = последнему
зелёному прогону (итерация G).

## F6-A11Y-01 — пойманный и исправленный блокер

`check:a11y` (pa11y/axe 4.11) дал `aria-prohibited-attr` на
`free-assets.html`: `<footer class="site-footer" aria-label="Sidebar footer">`
внутри `<aside>`. После E-14 (итерация F4 сняла `role="contentinfo"` ради
валидной вложенности landmark'ов) footer стал безролевым, а `aria-label` на
безролевом элементе axe 4.11 запрещает (и он всё равно не озвучивается).
Не из F5 (F5 не трогала shipped-HTML) — pre-existing на main, всплыл на
релизном гейте. **Фикс:** `role="group"` обеим страницам (group — НЕ landmark,
разрешает `aria-label`, без проблемы вложенности E-14). После фикса
`check:a11y` 0/0 на обеих, `verify` 135/135, `test:visual` без диффов.

## Шаги владельца (release gated — агент выполнить не может)

1. **Деплой репо→Beget** (ручной: архив с GitHub → распаковка в файловое
   пространство с полной очисткой). Только после него `.htaccess` (F2:
   security-заголовки, строгий CSP, кэш, 404-блок не-сайтовых путей) станет
   живым.
2. **Живая проверка после деплоя** (нет прод-доступа у агента; локальная
   обкатка CSP в F2 была 0 нарушений):
   - заголовки и CSP на `/` и `/free-assets.html` (nosniff, XFO, HSTS,
     Referrer-Policy, Permissions-Policy, CSP без нарушений);
   - `/admin/` — `no-store` + `X-Robots-Tag: noindex`, srcdoc-превью админки
     под CSP end-to-end (blob-скрипты, остаточный риск из кросс-ревью F2);
   - кастомная `404.html` отдаётся на несуществующих путях;
   - info-disclosure: `/docs/`, `/content/`, `/scripts/`, `/AGENTS.md` и т.п.
     отдают 404 (F-06).
3. **Контент** (владелец заполняет сам):
   - русские тексты кейсов (сейчас RU = EN-плейсхолдеры) — через админку;
   - реальные ZIP-архивы Free Assets (сейчас placeholder-заглушки) и реальные
     OG-картинки/логотип — через админку (F5 дал upload-слоты);
   - по желанию — `node scripts/clean-orphan-assets.mjs --delete` (5 легаси-
     сирот, 85.7 КБ; dry-run в F5).
4. **OAuth App** — только при возврате на Netlify; на Beget вход админки по
   fine-grained PAT (`docs/admin-guide.md`).
5. **Мерж стопки draft PR**: F5 (#51) → F6, затем кампания закрыта.

## Известные не-блокеры (приняты, документированы)

- FA LCP 5.5s / index LCP 4.2s — в пределах PASS-бюджетов lighthouse; FA LCP —
  кандидат на будущую оптимизацию (E-23 lazy-стратегия), не блокер.
- index lighthouse a11y=95 (не 100) — lighthouse-эвристики; pa11y/axe WCAG2AA
  даёт 0 ошибок (строгий гейт чист).
- preloader-смоук исторически флачил по таймингу на этой машине (порог
  3900/4000мс, ADV1-4); на этом прогоне прошёл.
- Deferred (внешняя инфра/решение владельца): ZIP-аплоад через админку,
  Vimeo автозагрузка, откат через UI, GitHub App вместо OAuth scope.
