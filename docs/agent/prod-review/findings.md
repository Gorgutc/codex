# Реестр находок: pre-production кампания (R0)

Дата ревью: 2026-06-12. Ветка: `codex/prod-r0-review-register`.
База: main @ `8bff9ec` (все итерации админки 0–H влиты).

Кампания и итерации описаны в плане сессии и в `handoff.md`
(журнал «Сессия 3»). Правило: фиксы делаются только по находкам из
этого реестра. Статусы: `open` / `fixed (PR #N)` / `accepted` /
`deferred` / `owner` (нужно решение владельца).

Baseline на чистом дереве: `npm run verify` — 0 FAIL;
`npm run quality:fast` — зелёный после `npm install` в worktree
(см. ENV-01).

## Сводка

| Поток | Зона | Находок | high/critical |
| --- | --- | --- | --- |
| A1 | js/main.js + index.html | 21 | 1 |
| A2 | free-assets/animations/i18n JS | 15 | 1 |
| B | css/* | 19 | 0 |
| C | админка, auth, CI, заголовки | 9 | 3 |
| D | генератор ↔ verify-frozen ↔ content | 10 значимых | 1 |
| E | SEO / i18n / a11y / deploy | 24 | 3 |
| F | живой сайт codex.promo | 5 | 1 critical |

## Критические и high (приоритет кампании)

1. **F-01 (critical → решено: Beget, см. «Решения владельца»)** —
   прод-хостинг codex.promo — это **Beget (nginx/Apache), а не
   Netlify**: DNS → 45.130.41.162, `/.netlify/functions/cms-auth`
   на проде отдаёт 404, `/admin/` перекрыт beget-заглушкой. Значит:
   OAuth-вход админки на проде не работает (только PAT),
   `netlify.toml` (кэш и security-заголовки) на проде инертен. При
   этом сами файлы сайта синхронизированы с репо байт-в-байт
   (см. F-04). Решение владельца: остаёмся на Beget — заголовки и
   кэш через `.htaccess` (F2), вход по PAT (документируем), механизм
   деплоя репо→Beget уточняется у владельца.
2. **A1-01 / C-01 (high → F2)** — stored XSS на публичном сайте:
   `mediaItemHTML` / `textFullHTML` / `rowTallText` / `buildInfoHTML`
   вставляют admin-редактируемые поля кейса (label/desc/title/body/
   role/tools/bg) в `innerHTML` без `escapeHTML`
   (js/main.js:608-643, 838-886, 898-910, 1945-1965; sink: 1012,
   2467, 2887). Паттерн экранирования уже есть в `motionItemHTML`.
3. **C-02 / D-05 (high → F1)** — breakout из
   `<script type="application/ld+json">`: `j()` в генераторе — голый
   `JSON.stringify` без экранирования `<`
   (scripts/generate-content.mjs:1173, 1213, 1216); `card.title.en`
   с `</script>…` валидатор пропускает (нет `<>`-гарда на кейс-полях,
   в отличие от FA-полей, строка 421). Фикс: `<`-эскейп в `j()`
   плюс `<>`-гард на кейс-поля (C-03).
4. **D-01 (high → F1)** — `scripts/capture-content-golden.mjs:96` и
   `tests/quality/content-golden.spec.mjs:97` ждут ровно 18 карточек.
   Легитимное скрытие/добавление кейса через админку валит шаг
   recapture в `content-publish.yml` ПОСЛЕ verify, авто-revert не
   срабатывает → main остаётся в рассинхроне. Вывести число из
   content, как EXPECTED_IDS в verify-frozen.
5. **A2-01 / E-02 / F-03 (high → F4 + owner)** — каталог Free Assets
   обещает 25 архивов, в `downloads/` лежат 4, на проде 404
   (проверено: `vega-shell.zip` → 404). Существующие 4 zip — стабы по
   412 байт (README.txt внутри), а JSON-LD заявляет contentSize
   «48 MB»/«93 MB» — misleading structured data. Решение владельца:
   выложить реальные архивы или скрывать кнопку Download и
   contentUrl/contentSize у ассетов без файла.
6. **E-01 (high → F4 + owner)** — RU-версия невидима для поисковиков:
   один URL, клиентский `?lang=`, ни одного hreflang, RU-метаданных
   нет в sitemap; соцскрейперы видят только EN. Либо осознанно
   принять EN-only индексацию, либо вводить индексируемые
   `?lang=ru`-URL + hreflang + RU-sitemap.
7. **E-10 (high → F4)** — RU-блок `content/meta.json` — плейсхолдер:
   16 из 18 строк идентичны EN (title/description/og/twitter).
   Механизм data-i18n-meta готов, нужен перевод.
8. **C-04 / E-22 (high → F2)** — security-заголовков нет вообще
   (ни CSP, ни X-Frame-Options/X-Content-Type-Options/
   Referrer-Policy/HSTS, ни no-cache для `/admin/*`). На проде
   (Beget) сейчас нет и Cache-Control (F-02). Решение владельца уже
   есть: полный набор + строгий CSP; целевой носитель зависит от
   F-01. CSP-инвентарь собран (см. C-05 и раздел CSP в журнале
   ревью потока C).

## Поток A1 — js/main.js + index.html

- **A1-01** (high → F2, open): см. «Критические» п. 2.
- **A1-02** (medium → F3, open): скрытый Three.js-вьюер продолжает
  rAF-рендер после ухода из 3D-вкладки (`setViz('2d')` прячет
  контейнер, не останавливая цикл) — js/main.js:3010-3039 +
  vendor/codex-three-viewer.js:116,493-501. Фикс: стоп
  рендера/autoRotate при уходе с вкладки.
- **A1-03** (medium → F3, open): гонка close→reopen fullscreen-
  галереи: onComplete reverse-FLIP без guard убивает свежеоткрытый
  оверлей (js/main.js:3969-3984 vs 3888-3930). Фикс:
  `gsap.killTweensOf` + проверка `is-open` в onComplete.
- **A1-04** (medium → F3, open): двойной быстрый клик по
  theme-toggle «съедает» переключение — атрибут темы меняется в
  onComplete через ~140мс (js/main.js:3313-3328). Фикс: pending-state
  в переменной.
- **A1-05** (medium → F3, open): клик по фону fullscreen не
  закрывает оверлей при единственном элементе (blueprint у 15/18
  кейсов): backdrop уходит в nav, а nav при total<2 — ранний return
  (js/main.js:3662-3675, 4043, 3994). Фикс: при total<2 звать
  `closeFs()`.
- **A1-06** (medium → F3, open): невалидный hash (`#abc\`) роняет
  querySelector → init-обработчик умирает, case-view пустой
  (js/main.js:3393-3399, 3434). Фикс: CSS.escape/whitelist + try.
- **A1-07** (medium → F3, open): событие `codex:filter` не
  диспатчится, когда фильтр скрыл текущий кейс (ранний return;
  комментарий врёт, что openCase диспатчит) — js/main.js:369-379.
  Подписчик в animations.js:119 пропускает reveal.
- **A1-08** (medium → F3, open): button-в-button + фокусируемые
  кнопки внутри `aria-hidden="true"` в tags-dropdown
  (index.html:303-317 + js/main.js:414-437). Фикс: вынести chips из
  trigger или tabindex=-1 и делегирование.
- **A1-09** (medium → F3, open): `BLUEPRINT_META` — хардкод 18 id;
  новый кейс из админки получает пустую вкладку Blueprints с no-op
  кнопками (js/main.js:1286-1313, 1788-1795, 3128-3131, 4005-4008).
  Фикс в зоне: прятать вкладку при `getBpPages(id).length === 0`.
- **A1-10** (low → F3, open): кнопка SKIP прелоадера недостижима —
  softTimer(2500) всегда раньше skipTimer(4000)
  (js/main.js:193-205, index.html:202).
- **A1-11** (low → F3, open): фильтр битых картинок
  `naturalWidth >= 0` — всегда true (js/main.js:3855). Корректно:
  `!i.complete || i.naturalWidth > 0`.
- **A1-12** (low → F4, open): счётчик «N projects» не в i18n
  (js/main.js:342-345, index.html:366). Вместе с A2-02.
- **A1-13** (low → F4, open): aria-лейблы fullscreen-оверлея
  замораживаются на языке первого открытия; zoom-кнопки без i18n
  (js/main.js:3594-3650, 4182).
- **A1-14** (low → F3, open): hashchange на скрытый/несуществующий
  кейс молча игнорируется — URL врёт (js/main.js:3434-3437).
- **A1-15** (low → F3, open): rejected `threeViewerLoading` не
  сбрасывается в `openFsThree` → fullscreen-3D навсегда offline
  после одного сбоя (js/main.js:3802-3808 vs 2958-2961).
- **A1-16** (low → F3, open): безусловный preventDefault на клике
  карточки глотает Ctrl/Cmd/middle-click (js/main.js:3196-3204).
- **A1-17** (low → F3, open): смена языка при открытом кейсе
  сбрасывает scroll и remount'ит 3D (js/main.js:3445-3448, 1157).
- **A1-18** (low → F3, needs-runtime-proof): клик по логотипу при
  свёрнутом сайдбаре может открыть скрытый фильтром кейс
  (js/main.js:3171-3186).
- **A1-19** (low → F3, open): таймер COPY LINK не очищается между
  кликами (js/main.js:3478-3496).
- **A1-20** (low → F3, open): комбинация фильтров с нулём совпадений
  оставляет противоречивое состояние «0 / 0» (js/main.js:369-379,
  1238-1247). Нужен empty-state.
- **A1-21** (low → F3, needs-runtime-proof): flipOpen при нулевом
  rect пропускает activateFsImageZoom (js/main.js:3911-3914).

## Поток A2 — free-assets.js / animations.js / i18n.js / shared-runtime.js

- **A2-01** (high → F4 + owner, open): см. «Критические» п. 5.
- **A2-02** (medium → F4, open): на FA-странице счётчик показывает
  «6 projects» вместо «6 categories» — `updateCount()` без FA-ветки
  (js/main.js:344 ← js/free-assets.js:497-499); GEN-текст
  перетирается при загрузке, aria-live озвучивает неверное слово.
- **A2-03** (medium → F3+F1, open): фильтр «Game assets only»
  детектит game-ассеты регэкспом по тексту бейджа — переименование
  бейджа в админке ломает фильтр; в 5/6 категорий свитч опустошает
  грид без empty-state (js/free-assets.js:394-399). Фикс: явный
  boolean в FA_DATA (генератор, F1) + data-атрибут + empty-state
  (F3).
- **A2-04** (medium → F3, open): hash deep-links FA не работают —
  init всегда `selectTag(firstAvailableTag())`, JSON-LD при этом
  раздаёт `#vega-shell`-якоря (js/free-assets.js:500-503).
- **A2-05** (medium → F3, open): `?lang=en` навязывается до
  завершения geo-детекта и размножается по ссылкам — RU-пользователь
  может «залипнуть» в EN (js/i18n.js:368, 424-437).
- **A2-06** (medium → F4, open): RU-словарь FA наполовину EN:
  faTag.*, filter.*, btn.gameAssetsOnly и др.
  (js/i18n-data.js:239-453). Вместе с E-11.
- **A2-07** (low → F3, open): смена языка пересоздаёт весь FA-грид:
  сброс скролла, пересоздание GLB-превью (js/free-assets.js:510-512).
- **A2-08** (low → F3, open): chips дропдауна на FA показывают сырые
  слаги («game») — FILTER_LABELS не знает FA-ключей
  (js/main.js:329-337). Фикс: брать label из текста чекбокса.
- **A2-09** (low → F3, open): пустая категория рендерит слаг в H1 и
  пустой грид без сообщения (js/free-assets.js:57-66).
- **A2-10** (low → F3, open): нет guard на отсутствие FA_DATA —
  ReferenceError каскадно убивает init (js/free-assets.js:27, 221).
- **A2-11** (low → F3+F1, open): admin-поля конкатенируются в
  URL/стили без encodeURIComponent; `asset.bg` — поверхность
  CSS-injection (js/free-assets.js:113-130, 325). Валидаторная часть
  — F1.
- **A2-12** (low → F3, open): латентная гонка typewriter ×
  i18n-walker — затирание текста при реальном переводе
  (js/animations.js:522-543). Фикс: data-i18n-pause.
- **A2-13** (low → F3, open): SplitText-твины предыдущего открытия
  не убиваются при быстрой навигации (js/animations.js:404-420).
- **A2-14** (low → F3, open): мобильный collapse FA идёт мимо
  setCollapsed — label кнопки не обновляется
  (js/free-assets.js:50-54).
- **A2-15** (low → F4, open): JSON-LD ItemList numberOfItems=25 при
  8 itemListElement (free-assets.html:90-92). Вместе с E-05.

## Поток B — CSS

- **B-01** (medium → F3, open): `var(--space-5)` не существует —
  padding плашки «модель недоступна» схлопывается в 0
  (css/portfolio-case.css:1277). Заменить на существующий токен.
- **B-02** (low → F3, open): мёртвая ветка
  `:root[data-theme="light"]` — тема ставится только на body
  (css/shared.css:1311).
- **B-03** (medium → F3, open): визуальный блок `.contact-btn`
  (css/shared.css:314-350) стилизует элемент, скрытый на всех
  вьюпортах. ВНИМАНИЕ: `#contact-btn` заморожен тестами
  (verify-frozen.js:600, 1773) — HTML и скрывающие правила не
  трогать, чистить только мёртвые визуальные стили.
- **B-04** (low → F3, open): мёртвые мобильные правила
  `.cards-toggle` перекрыты поздними `display:none`
  (css/shared.css:1198-1220 vs 1320, 1345).
- **B-05** (low → F3, open): `.top-pill--free[disabled]` — disabled
  никогда не ставится (css/shared.css:415-423).
- **B-06** (low → F3, open): `.bp-export-btn[disabled]` — то же
  (css/portfolio-case.css:901-904).
- **B-07** (medium → F3, open): в FA-сабсете `.media-fs` нет
  sr-only правила для `.media-fs__announcer`, который main.js
  создаёт безусловно (css/free-assets.css:281-362,
  js/main.js:3627-3631). Закрывается переводом announcer на
  `.sr-only`.
- **B-08** (low → F3, open): смешение границ 767/768px — на ровно
  768px применяются и мобильные, и desktop-правила
  (css/shared.css:1942-1945, css/portfolio-case.css:912-914).
- **B-09** (low → F3, open): transition `.cursor-dot` перекрыт
  повтором ниже (css/shared.css:1531 vs 1625-1627).
- **B-10** (low, accepted): 13 неиспользуемых дизайн-токенов
  (css/tokens.css) — резерв дизайн-системы, пометить комментарием.
- **B-11** (low, accepted): правила для text-input «про запас»
  (css/shared.css:1687-1700).
- **B-12** (medium, accepted): дубликат `.media-fs`-сабсета между
  free-assets.css и portfolio-case.css — рефакторинг трогает
  замороженный CSS-порядок; перед продом не трогаем, расхождение
  закрывает B-07. Кандидат на пост-прод maintenance.
- **B-13** (low, accepted): тройной thumb-паттерн (work-card /
  fa-card / tag-card) — зона load-bearing селектора, не трогаем.
- **B-14** (low → F3, open): `.media-fs__announcer` перевести на
  готовый `.sr-only` (часть B-07); остальные sr-only дубли —
  accepted.
- **B-15** (low → F3, open): дубль `.main-area{display:none}` в
  free-assets.css:709.
- **B-16** (medium → F3, open): контраст `.case-text__eyebrow`
  ниже AA (3.1:1 dark / 4.07:1 light) — мигрировать на
  `--color-accent-text`, как уже сделано для `.work-card__cat`
  (css/portfolio-case.css:713-721). Axe это не ловит: D1 сканирует
  до открытия кейса.
- **B-17** (low, owner): лейблы курсора 'VIEW →'/'PREV'/'NEXT' в CSS
  content — в RU остаются EN (css/shared.css:1653, 1684-1685).
  Возможно осознанный стиль.
- **B-18** (low → F3, open): `.fa-card__hint` hover-only без
  focus-within (css/free-assets.css:445-449).
- **B-19** (low → F3, open): устаревшие комментарии о брейкпоинтах
  (css/portfolio-case.css:1524-1529, 2025).

## Поток C — безопасность (админка, auth, CI, заголовки)

- **C-01** (high → F2, open): dup A1-01, см. «Критические» п. 2.
- **C-02** (high → F1, open): dup D-05, см. «Критические» п. 3.
- **C-03** (medium → F1+F2, open): `<>`-гард есть только у FA-полей
  (generate-content.mjs:421), кейс-поля и админ-зеркало без него.
  Server-гард — F1, зеркало в admin/js/state.js — F2.
- **C-04** (high → F2, open): см. «Критические» п. 8. CSP-инвентарь
  по директивам собран в ревью потока C (script-src 'self' +
  ajax.googleapis.com + wasm-unsafe-eval + хэш inline-прелоадера;
  style-src 'self' + api.fontshare.com + 'unsafe-inline'; font-src
  cdn.fontshare.com; img-src 'self' data: blob: (+ avatars для
  admin); connect-src 'self' (+ api.github.com для admin); frame-src
  'self' + player.vimeo.com; worker-src 'self' blob:; admin-CSP —
  надмножество публичного из-за srcdoc-превью).
  CSP-блокеры: inline-прелоадер (хэшировать), inline
  `onerror="this.remove()"` (вынести в делегированный обработчик),
  inline style="background:…" ('unsafe-inline' или рефактор),
  CDN model-viewer (C-05).
- **C-05** (medium → F2, open): model-viewer 4.0.0 грузится с
  ajax.googleapis.com без SRI — единственный внешний скрипт,
  противоречит self-hosted политике (js/shared-runtime.js:5).
  Self-host в js/vendor/.
- **C-06** (medium → F2/owner, open): OAuth App с классическим scope
  `repo` = доступ ко ВСЕМ репо владельца. Компенсации: admin-CSP +
  no-store (F2); рекомендация PAT fine-grained в доке; миграция на
  GitHub App — deferred (решение владельца).
- **C-07** (low → F1, open): guard «Skip own bot commits» в
  content-publish.yml:44-53 матчит подстроку `[content-publish` в
  любом коммите → «тихая непубликация». Якорить на автора bot.
- **C-08** (low → F2, open): пути git-tree в publish не проверяются
  на префикс content/ | assets/ (admin/js/state.js:993-1004,
  api.js:206-223). Добавить assert.
- **C-09** (low, accepted): нет rate-limit на OAuth-функции — abuse
  ограничен механикой state; опционально после F-01.
- **C-MIRROR** (medium → F2, open): зеркало валидации admin ↔ server
  неполно (~20 правил). Приоритет: `<>`-гард FA/кейс-полей (#31),
  cardOrder bijection (#22), существование og-файла (#26),
  featuredWorks (#27), tagCard (#39), глобальный дубль FA id (#40).
  Полная таблица — в отчёте потока D (журнал сессии).

Проверено и чисто: токен только в sessionStorage; postMessage с
pinned origin + source; state-cookie HttpOnly/Secure/SameSite +
одноразовость; reflected XSS в cms-auth закрыт; preview srcdoc без
инъекций; workflow на push-триггере без fork-инъекций; SortableJS
self-hosted 1.15.7.

## Поток D — контракт (генератор ↔ verify-frozen ↔ content)

- **D-01** (high → F1, open): см. «Критические» п. 4.
- **D-02** (medium → F1, open): `B1-data-i18n-attr-floor` — хардкод
  100 (verify-frozen.js:1093); скрытие ≥8 кейсов даёт ложный FAIL и
  авто-revert легитимной публикации. Вывести формулой из content,
  как FA-floor (1361-1366).
- **D-03** (medium → F1, open): verify пинит basename og-картинок
  регэкспом, валидатор принимает любой файл (verify-frozen.js:588,
  1525 vs generate-content.mjs:455-467) — валидная публикация может
  отреверчиваться. Согласовать: либо конвенцию в валидатор, либо
  точный URL из content в verify.
- **D-04** (low → F1, open): ogLocale не enum-валидируется,
  verify требует `en_US|ru_RU` (verify-frozen.js:1071, 1325).
- **D-05** (medium → F1, open): dup C-02 + защита `<>` кейс-полей.
- **D-06** (low → F1, open): control-символы и U+2028/2029 проходят
  в title → HTML/JSON-LD (generate-content.mjs:1119, 1144). Добавить
  charset-гард.
- **D-08** (low, accepted): FA_JSONLD_COPY_IDS — ручная копия в
  verify, дрейф ловится static-чеком F1-jsonld-copy-mirror; долг
  «вынести в общий JSON» — пост-прод.
- **D-09** (medium → F1, open): i18nOverrides привязаны к
  структурным индексам и не переезжают при reorder
  (generate-content.mjs:660-667, 789, 817). Сегодня безопасно
  (только не-индексные overrides). Фикс: запрет reorder при
  индексных overrides либо миграция по стабильному id.
- **D-10** (low → F1, open): мёртвые faTag-ключи скрытых категорий
  остаются в словаре (generate-content.mjs:842-856). Косметика.
- **D-14** (low → F1, open): Windows CRLF-churn косметический;
  закрывается `.gitattributes eol=lf` (deferred-пункт).
- **D-SKIP** (accepted, задокументировать): SKIP-ветки verify-frozen
  в целом безопасны; два осознанных компромисса: motion-контракт
  целиком отключается, если скрыть все motion-кейсы; клик-тест
  фильтра не выполняется при единственной видимой категории.
- Чисто: детерминизм (нет Date.now/random/localeCompare),
  traversal-гард, narrowing видимости (кейсы/категории/FA/JSON-LD/
  sitemap) согласованы, негативные тесты валидатора есть.

## Поток E — SEO / i18n / a11y / deploy / perf

- **E-01** (high → F4 + owner, open): см. «Критические» п. 6.
- **E-02** (high → F4 + owner, open): dup A2-01/F-03.
- **E-03** (medium → F1, open): lastmod sitemap захардкожен
  «2026-05-30» в генераторе (generate-content.mjs:1374-1386) —
  каждая публикация пишет замороженную дату. NB: брать дату так,
  чтобы не сломать детерминизм `--check` (например, дата последнего
  коммита content/).
- **E-04** (medium → F4, open): llms.txt устарел: «1 known axe
  issue» (бюджет уже 0), нет Free Assets, плейсхолдер
  ArtStation/Behance, дата 2026-04-19.
- **E-05** (medium → F4, open): dup A2-15 + у позиций 4-7 JSON-LD
  generic-превью og-free-assets.jpg вместо своих карточек.
- **E-06** (low → F4, open): Organization.logo — баннер 1200×630,
  нужен квадрат ≥112×112.
- **E-07** (low → F4, open): нет twitter:image:alt (генератор
  head-meta).
- **E-08** (low → F4, open): manifest без 192/512/maskable иконок
  при display:standalone (assets/favicon/site.webmanifest).
- **E-10** (high → F4, open): см. «Критические» п. 7.
- **E-11** (medium → F4, open): 119/165 UI-ключей RU=EN; критичная
  часть: все 36 aria.*, 11 title.*, faTag.*.desc, filter.*,
  skipToContent. Англицизмы-термины (2D/3D/Blueprints/CAD/форматы)
  — осознанно оставить.
- **E-12** (medium → F4, open): строки мимо словаря: «N projects»,
  «N assets», «(game-only)», «Download — 48 MB», «File not found…»,
  aria lang-toggle (js/main.js:344, js/free-assets.js:64-404,
  js/i18n.js:203-205).
- **E-13** (low → F4/owner, open): 59/332 en/ru-пар в кейсах
  идентичны; переводимые: caption-лейблы «Lighting setup» и т.п.
  Большинство — имена собственные (ок).
- **E-14** (low → F4, open): role="banner"/"contentinfo" внутри
  aside (index.html:209,627; free-assets.html:278,544).
- **E-15** (low → F4, open): listbox/option + вложенные нативные
  checkbox — смешанный паттерн для AT (index.html:321-351).
- **E-16** (low, accepted): первый заголовок в DOM — h2 сайдбара.
- **E-17** (low → F3, open): video в галерее без width/height
  (js/main.js:615-617) — CLS-риск.
- **E-18** (medium → F4 + F-01, open): /assets/* immutable на год
  при нехэшированных именах админ-медиа. На Beget сейчас инертно,
  но политика должна быть согласована при любом исходе F-01.
- **E-19** (medium → F4, open): нет кастомного 404 (на проде
  дефолтная страница хостинга; redirect `/netlify/*` ведёт на
  несуществующий /404).
- **E-20** (medium → F2, open): правило `for = "/*.html"` в
  netlify.toml почти наверняка мёртвое (сплат не в конце пути).
- **E-21** (low, accepted): css/js max-age 86400 + SWR — окно
  стейла после публикации, осознанный trade-off (пересмотреть при
  F-01).
- **E-23** (medium → F3, open): все изображения кейс-галереи
  loading="lazy", включая LCP-кандидата — первый media-item
  открытого кейса (js/main.js:627-628). Первому — eager +
  fetchpriority=high.
- **E-24** (low → F3, open): нет color-scheme при наличии тем
  (css/tokens.css, index.html).
- Чисто: canonical/OG согласованы, robots.txt корректен, alt на
  всех img, skip-link валиден, reduced-motion покрыт, preload-
  цепочка шрифтов корректна, mixed content отсутствует.

## Поток F — живой сайт codex.promo

- **F-01** (critical, owner): см. «Критические» п. 1.
- **F-02** (medium → F2 + F-01, open): на проде нет вообще никаких
  Cache-Control (nginx отдаёт только ETag/Last-Modified) — браузеры
  кэшируют эвристически; стратегия кэширования должна быть задана
  на целевом хостинге.
- **F-03** (high, dup A2-01/E-02): 404 на 21/25 архивов подтверждён
  на проде.
- **F-04** (положительное): index.html, free-assets.html,
  robots.txt, sitemap.xml на проде байт-в-байт совпадают с main —
  инвариант «репо = прод» выполняется, деплой-синк работает.
- **F-05** (dup E-19): кастомной 404-страницы на проде нет.

## Окружение

- **ENV-01** (fixed): в worktree не был выполнен `npm install` —
  отсутствовал `@cspell/dict-ru_ru`, `quality:fast` падал на
  check:spelling. Исправлено локально (`npm install`), к репо
  отношения не имеет.

## Триаж deferred-листа handoff (решение владельца: «включить всё возможное»)

| Пункт | Вердикт |
| --- | --- |
| Vimeo privacy-hash | F5 — делаем (админка + схема + embed) |
| og:image размеры не проверяются | F4 — делаем (чтение размеров при загрузке) |
| FA не входит в превью админки | F5 — делаем (расширить preview.js) |
| ZIP-аплоад через админку | deferred — нужна внешняя инфраструктура (S3/R2), отдельное решение |
| Счётчики «N assets» вручную | уже автоматизировано генератором (см. D-10); обновить текст в handoff — F1 |
| Manual-порядок стартует с авторского | F5 — делаем (старт с seeded-раскладки) |
| Чередование рядов в manual | F5 — оценить; если рискованно для вёрстки — accepted |
| i18nOverrides при reorder | F1 — делаем (D-09) |
| Golden-фикстуры / CI recapture | F1 — делаем (D-01 закрывает главный разрыв) |
| .gitattributes eol=lf | F1 — делаем |
| Флак preloader-смоука | F1 — стабилизируем тест, не ослабляя гейт |
| JSON-LD narrowing | уже согласован (поток D); остаток numberOfItems — F4 (E-05) |
| Чистка осиротевших ассетов | F5 — делаем (maintenance-скрипт, ручной запуск) |
| Vimeo автозагрузка | deferred — нужен Vimeo API/аккаунт |
| layout/playback motion-блоков в админке | F5 — делаем (строгие enum) |
| Откат через UI админки | deferred — большая фича, отдельное решение владельца |
| GitHub App вместо OAuth scope repo | deferred — решение владельца (C-06) |

## Решения владельца по вопросам R0 (2026-06-12)

1. **F-01 — остаёмся на Beget.** Следствия: security-заголовки,
   CSP и кэш-политика доставляются через `.htaccess` (Apache за
   nginx); вход в админку на проде — только fine-grained PAT
   (OAuth-функция требует серверной среды; задокументировать в
   admin-guide); `netlify.toml` сохраняем консистентным для
   возможных Netlify-превью, но прод-носитель — `.htaccess`.
   Открытый под-вопрос владельцу: как именно устроен деплой
   репо→Beget (git-pull в панели / FTP / вручную) — нужно для F2
   (доставка .htaccess) и F6 (проверка в бою).
2. **A2-01/E-02 — скрываем Download у ассетов без файла.**
   Генератор и рантайм прячут кнопку и contentUrl/contentSize при
   отсутствии архива в `downloads/`; для существующих файлов
   contentSize выводится из реального размера (честный JSON-LD).
   Когда владелец зальёт реальные архивы — включится само. → F4.
3. **E-01 — индексируем RU**: hreflang-пары, `?lang=ru` в sitemap,
   RU-метаданные (черновик переводов готовит агент, утверждает
   владелец). → F4 вместе с E-10/E-11.

## Прогоны гейтов (R0)

- `npm run verify` — PASS, 0 FAIL (baseline).
- `npm run quality:fast` — PASS после ENV-01.
- `npm run check:a11y` — PASS: index 0 ошибок, free-assets 0 ошибок
  (budget 0).
- `npm run check:lighthouse` — PASS: index perf=95 a11y=100 seo=100
  (LCP 2.6s, CLS 0); free-assets perf=78 a11y=100 seo=100
  (LCP 5.5s — связано с E-23/lazy-стратегией, цель улучшения в F4).
