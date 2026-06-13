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
2. **A1-01 / C-01 (high → F2, fixed)** — stored XSS на публичном
   сайте: `mediaItemHTML` / `textFullHTML` / `rowTallText` /
   `buildInfoHTML` вставляли admin-редактируемые поля кейса в
   `innerHTML` без `escapeHTML`. Исправлено в F2 по паттерну
   `motionItemHTML`; inline-`onerror` заменены делегированным
   error-листенером на caseTrack (заодно убран CSP-блокер).
3. **C-02 / D-05 (high → F1, fixed)** — breakout из
   `<script type="application/ld+json">`: `j()` в генераторе был
   голым `JSON.stringify` без экранирования `<`; `card.title.en` с
   `</script>…` валидатор пропускал (нет `<>`-гарда на кейс-полях, в
   отличие от FA-полей). Исправлено в F1: `<`-эскейп в `j()` +
   `<>`/control-гард на все HTML-эмитируемые кейс-поля и
   i18nOverrides-листья.
4. **D-01 (high → F1, fixed)** — capture-скрипт и golden-тест ждали
   ровно 18 карточек: легитимное скрытие кейса валило recapture-шаг
   `content-publish.yml` ПОСЛЕ verify без авто-revert. Исправлено в
   F1: ожидания из content (`scripts/content-expectations.mjs`) +
   recapture включён в revert-условия workflow.
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
8. **C-04 / E-22 (high → F2, fixed)** — security-заголовков не было
   вообще. Закрыто в F2 через `.htaccess` (Beget — прод-носитель):
   полный набор + строгий CSP, no-store для `/admin/`, кэш-политика
   (F-02). Локальная CSP-обкатка — 0 нарушений; проверка в бою —
   после следующего деплоя (F6).

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
- **C-02** (high → F1, fixed): dup D-05, см. «Критические» п. 3.
- **C-03** (medium → F1+F2, частично fixed): server-гард `<>` на
  кейс-полях добавлен в F1; зеркало в admin/js/state.js — F2.
- **C-04** (high → F2, fixed): закрыто в `.htaccess` (корень +
  `/admin/`-оверрайд): nosniff, Referrer-Policy, XFO, HSTS,
  Permissions-Policy, СТРОГИЙ CSP (один inline-хэш + 'unsafe-hashes'
  для onload-свопа preload-линков + wasm-unsafe-eval; без CDN после
  C-05), no-store + X-Robots-Tag для админки. Локальная обкатка
  Playwright (index с 3D/wasm/motion, FA с mini-3D, админка):
  0 нарушений CSP — попутно пойман реальный блокер connect-src
  blob: (GLTFLoader-текстуры). Проверка в бою — после следующего
  деплоя владельца (F6). Исходный CSP-инвентарь
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
- **C-05** (medium → F2, fixed): model-viewer 4.0.0 self-hosted в
  js/vendor/ (955КБ, лицензия в шапке), декодеры Draco/KTX2
  защитно запинены на уже self-hosted пути js/vendor/three/libs/
  (все 26 FA-моделей сейчас без сжатия — проверено);
  visual-regression блокирует и локальный путь, чтобы baselines не
  поплыли.
- **C-06** (medium → F2, частично fixed): admin-guide переписан —
  на Beget вход по PAT объявлен ОСНОВНЫМ (OAuth требует Netlify),
  отмечено преимущество fine-grained-токена. Миграция на GitHub App
  — deferred (решение владельца).
- **C-07** (low → F1, fixed): guard «Skip own bot commits» якорится
  только на автора github-actions[bot]; подстрочный матч по subject
  убран (тихая непубликация при `[content-publish` в описании).
- **C-08** (low → F2, fixed): `buildPublishPlan` ассертит префиксы
  путей коммита (content/ для JSON, assets/ для бинарных медиа).
- **C-09** (low, accepted): нет rate-limit на OAuth-функции — abuse
  ограничен механикой state; опционально после F-01.
- **C-MIRROR** (medium → F2, fixed): зеркало валидации admin ↔
  server дозаполнено в admin/js/state.js: `<>`/control-гард всех
  текстовых кейс- и FA-полей + i18nOverrides (#31), уникальность
  cardOrder (#22), конвенция имени og-картинки + ogLocale enum
  (#26/D-04), структура featuredWorks (#27), tagCard (#39),
  глобальный дубль FA id (#40), key категории (#38), year/imgLoading/
  imgFetchPriority/palette/captions-длина (#4/#5/#11/#13/#21).
  Не зеркалится осознанно: category∈filters (админка не редактирует
  категорию кейса), существование og-файла на диске (ловится
  publish-precheck'ом медиа), parity локалей (ловит CI).
- **D-09** (medium → F2, fixed): перестановка слотов/motion-блоков
  блокируется с объясняющим тостом, если у кейса есть i18nOverrides
  с числовыми индексами (admin/js/ui.js, reorderBlockedByOverrides).
  Миграция overrides по стабильному id — пост-прод улучшение.

Проверено и чисто: токен только в sessionStorage; postMessage с
pinned origin + source; state-cookie HttpOnly/Secure/SameSite +
одноразовость; reflected XSS в cms-auth закрыт; preview srcdoc без
инъекций; workflow на push-триггере без fork-инъекций; SortableJS
self-hosted 1.15.7.

## Поток D — контракт (генератор ↔ verify-frozen ↔ content)

- **D-01** (high → F1, fixed): см. «Критические» п. 4. Исправлено в
  F1: число карточек выводится из content через новый
  `scripts/content-expectations.mjs` (capture-скрипт, golden-тест,
  site-smoke, admin-smoke); плюс defense-in-depth — recapture-шаг
  workflow получил `continue-on-error` и включён в revert-условия.
- **D-02** (medium → F1, fixed): `B1-data-i18n-attr-floor` теперь
  формула из content: 32 base + 3×карточки + 2×фильтры (на полном
  каталоге = прежние 100, строгость сохранена).
- **D-03** (medium → F1, fixed): конвенция basename og-картинок
  (`og-image(-hash8)` / `og-free-assets(-hash8)`) перенесена в
  `validateMetaImages` — рассинхрон ловится валидатором, а не
  verify-FAIL→revert. Тест-сценарий №8 переделан: cache-bust в
  пределах конвенции (позитив) + кросс-своп отклоняется (8b).
- **D-04** (low → F1, fixed): ogLocale enum-валидируется
  (`en_US|ru_RU`) в обеих локалях.
- **D-05** (medium → F1, fixed): `j()` экранирует `<` как `<`
  (+U+2028/2029); вывод на текущем контенте байт-идентичен.
- **D-06** (low → F1, fixed): control-символы и U+2028/2029
  отклоняются валидатором: кейс-поля (включая i18nOverrides-листья)
  и head-meta-поля.
- **D-08** (low, accepted): FA_JSONLD_COPY_IDS — ручная копия в
  verify, дрейф ловится static-чеком F1-jsonld-copy-mirror; долг
  «вынести в общий JSON» — пост-прод.
- **D-09** (medium → F2, fixed): i18nOverrides привязаны к
  структурным индексам и не переезжали при reorder
  (`admin/js/ui.js` moveMediaSlot/moveMotionBlock). Закрыто в F2
  блокировкой перестановки при индексных overrides (см. C-MIRROR
  блок); миграция по стабильному id — пост-прод.
- **D-10** (low, accepted): мёртвые faTag-ключи скрытых категорий
  остаются в словаре (generate-content.mjs uiStringsWithCounts) —
  невидимы на сайте, чистка добавила бы churn генерации; решение:
  принять.
- **D-14** (low → F1, fixed): добавлен `.gitattributes`
  (`* text=auto eol=lf` + binary-маски); индекс уже был 100% LF,
  ренормализации не было.
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
- **E-03** (medium → F1, fixed): lastmod sitemap выводится из даты
  последнего коммита, тронувшего content/ (`git log -1 --format=%cs
  -- content/`), с фолбэком на старый литерал в git-less среде;
  детерминизм `--check` сохранён, sitemap регенерирован
  (lastmod = 2026-06-11).
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
- **E-20** (medium → F2, fixed): мёртвое правило `for = "/*.html"`
  заменено явными `/index.html` + `/free-assets.html` (netlify.toml
  теперь preview-контур, прод-носитель — `.htaccess`).
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

- **F-01** (critical → решено: Beget): см. «Критические» п. 1.
  Механизм деплоя уточнён у владельца (2026-06-12): ручной — архив
  репозитория с GitHub распаковывается в файловое пространство Beget
  с предварительной полной очисткой. Значит `.htaccess` доезжает
  автоматически с каждым деплоем.
- **F-02** (medium → F2, fixed): Cache-Control задан в `.htaccess`
  (html must-revalidate; css/js 1d+SWR; ассеты 7d). Финальная
  подстройка — F4.
- **F-06** (medium-high → F2, fixed, НОВАЯ): из-за деплоя «весь
  репозиторий как есть» на проде публично раздавались docs/
  (включая внутренний handoff), content/*.json, scripts/, tests/,
  .github/, AGENTS.md, package.json, verify-frozen.js и т.д.
  (проверено: HTTP 200). Секретов нет, но это information
  disclosure. Закрыто в `.htaccess`: RedirectMatch 404 на все
  не-сайтовые пути (+ Options -Indexes); публичными остаются только
  index/free-assets, css/js/assets/downloads, admin, robots/
  sitemap/llms и фавиконы.
- **F-03** (high, dup A2-01/E-02): 404 на 21/25 архивов подтверждён
  на проде.
- **F-04** (положительное): index.html, free-assets.html,
  robots.txt, sitemap.xml на проде байт-в-байт совпадают с main —
  инвариант «репо = прод» выполняется, деплой-синк работает.
- **F-05** (dup E-19): кастомной 404-страницы на проде нет.

## Adversarial-ревью F1 (после мержа PR #46)

Независимый агент-ревьюер атаковал диф F1; контрактные ужесточения
выдержали (B1-формула, og-конвенция, plain-text-диапазоны, j(),
workflow-матрица, .gitattributes, эквивалентность
content-expectations). Находки:

- **ADV1-1** (high → F2, fixed): `contentLastmod()` ломал
  байт-идентичность `--check` после ЛЮБОГО нового коммита,
  тронувшего content/ (auto-revert, локальный коммит
  content+generated, shallow clone) — эмпирически подтверждено.
  Фикс: `--check` сравнивает sitemap.xml ПО МОДУЛЮ lastmod-даты;
  реальную дату обновляет только `--write`. Протестировано подменой
  даты на диске.
- **ADV1-2** (medium → F2, fixed): `modelStats` (и
  `motionBlocks[].title`) были вне plain-text-гарда — добавлены в
  валидатор; рантайм-экранирование buildInfoHTML сделано в A1-01.
- **ADV1-3** (medium-low, accepted): транзиентный сбой recapture
  теперь откатывает легитимную публикацию (до F1 он молча оставлял
  main без регенерации — хуже). Осознанный trade-off: revert честный
  и громкий, владелец публикует повторно.
- **ADV1-4** (low → F2, fixed): порог preloader-гейта поднят
  3500→3900мс (реальный прогон 3.4s оставлял ~100мс запаса);
  инвариант «строго < 4000мс задержки» сохранён.
- **ADV1-5** (info, accepted, pre-existing): сбой на шаге
  commit/push конвейера (конфликт rebase) роняет job без revert —
  сообщение честно требует перезапуска; F1 не ухудшил.

## Кросс-ревью F2 (security-review + code-review до коммита)

`/security-review` (агент + false-positive-фильтр): 0 уязвимостей
HIGH/MEDIUM в диффе F2; остаточные замечания ниже порога (CSS-контекст
palette — нейтрализован CSP; `/admin/.htaccess` закрыт стандартным
Apache-deny; префикс-ассерты без нормализации — пути недостижимы).

`/code-review` (high, 4 finder-угла + сверки): найдено и исправлено
ДО коммита:

- **CR-1 (critical, fixed)**: блокировка `/content/` в `.htaccess`
  убивала загрузку каталога админки на Beget (`loadCatalog` фетчит
  `../content/*.json` same-origin). `/content/` исключён из
  блок-листа — это собственные тексты сайта, не секрет.
- **CR-2 (critical, fixed)**: строгий admin-CSP блокировал
  inline-скрипты ДАННЫХ черновика в srcdoc-превью (их хэш
  непредсказуем). `preview.js` переведён на Blob-URL-скрипты +
  `script-src blob:` в admin-CSP.
- **CR-3 (high, fixed)**: `no-store` админки перекрывался
  родительскими `<FilesMatch>` (Apache мержит FilesMatch ПОСЛЕ
  directory-уровня) — переопределён на том же FilesMatch-уровне в
  admin/.htaccess.
- **CR-4 (medium, fixed)**: делегированный error-листенер
  овер-матчил motion-видео (классы пересекаются) — у них никогда не
  было самоудаления; исключены через `.closest('.case-motion')`.
- **CR-5 (medium, fixed)**: fullscreen-клоны потеряли самоудаление
  битых медиа (клоны живут вне caseTrack, классы сняты) — зеркальный
  листенер на fsStage.
- **CR-6 (medium, fixed)**: `Options -Indexes` мог дать 500 на весь
  сайт при AllowOverride без Options — убран (листинг закрыт
  блок-листом путей).
- **CR-7 (low, fixed)**: тест прелоадера — expect декаплен от
  waitForFunction (3900/4000), гонка с самим собой устранена.
- **CR-8 (low, fixed)**: фильтры консольных ошибок verify/смоуков
  больше не глотают `model-viewer|googleapis` (бандл первопартийный);
  добавлен governance-гард: наличие vendor-файла и пересчёт
  CSP-хэшей inline-кода на каждом codex:ship (дрейф ловится
  локально, а не на проде).
- **CR-9 (medium, fixed)**: ошибки валидации без полей-якорей (year,
  palette, cardOrder, structuredData, i18nOverrides) были невидимы —
  первые сообщения теперь показываются в тосте публикации.
- Cleanup: `pushPairTextErrors` (обязательность+разметка одним
  вызовом; найден и закрыт пропуск зеркала у motion-блоков),
  FORBIDDEN_TEXT_RE — литерал байт-в-байт с каноном, слиты два
  motionBlocks-цикла генератора, хойст числового регэкспа.
- Принято без изменений: netlify-контур получил зеркало
  admin-заголовков; 4-я копия og-регэкспа — санкционированный
  mirror-паттерн; сужение D-09-блокировки до поддерева — пост-прод.

Остаточный риск для F6: blob-скрипты в srcdoc-превью под CSP
проверены по спецификации и обкаткой админ-страницы, но не
end-to-end с логином — проверить превью вживую после деплоя.

## Итерация F3 — рантайм сайта (2026-06-13)

Ветка `codex/prod-f3-site-runtime` (stacked на main @ `a42d4fe`).
Фиксы строго по реестру, через оркестрацию на Opus 4.8 (агент-карта
frozen-инвариантов + 4 кластерных аналитика → apply-ready патч-спеки;
правки применялись батчами по непересекающимся файлам, verify-frozen
прогонялся post-edit хуком после каждой правки).

**Закрыто (fixed F3):**

- `js/main.js` (кластеры A+B): **A1-02** (стоп rAF/autoRotate Three-вьюера
  при уходе с 3D-вкладки + возобновление по `currentThreeSource.autoRotate`),
  **A1-03** (kill in-flight tween close→reopen FLIP), **A1-04** (pending-state
  theme-toggle), **A1-05** (клик по фону закрывает single-item оверлей),
  **A1-06** (`findCardById` — нет SyntaxError на битом hash), **A1-07**
  (эмит `codex:filter` на early-return скрытого кейса), **A1-08** (chip-remove
  `<span>` вместо `<button>` — закрывает aria-hidden-focus/nested-interactive),
  **A1-09** (скрытие вкладки Blueprints при нуле страниц), **A1-10**
  (preloader SKIP виден на 1500мс), **A1-11** (предикат битых картинок),
  **A1-14** (hashchange восстанавливает канонический hash), **A1-15** (сброс
  кэша rejected-промиса fullscreen-3D import), **A1-16** (модификаторные/
  middle клики отдаём браузеру), **A1-18** (лого открывает первую
  не-скрытую-фильтром карту), **A1-19** (таймер сброса COPY LINK на кнопке),
  **A1-20** (JS-хук `body.filter-empty`; видимый empty-state — F4), **A2-08**
  (лейбл chip из текста чекбокса), **E-17** (width/height у галерейного
  video — CLS), **E-23** (первый media-item кейса — eager+fetchpriority).
- `js/free-assets.js` + `js/animations.js` (кластер C): **A2-03** (game-фильтр
  по штампованному `data-game-asset` категории + `setGridEmptyState`),
  **A2-04** (deep-link hash → категория + scroll), **A2-07** (in-place desc
  на смене языка, без пересборки grid), **A2-09** (`catLabelForTag` — нет
  сырого slug в пустом H1), **A2-10** (`faData()`-гард от отсутствия
  FA_DATA), **A2-11** (`setSafeBackground` + `encodeURIComponent`), **A2-12**
  (typewriter `data-i18n-pause`), **A2-13** (kill предыдущего SplitText-твина),
  **A2-14** (мобильный collapse через клик `#cards-toggle`).
- `css/*` + HTML (кластер D): **B-01** (`--space-6` вместо несуществующего
  `--space-5`), **B-02** (мёртвая `:root[data-theme=light]`-ветка), **B-03**
  (мёртвый визуальный блок `.contact-btn`), **B-05/B-06** (мёртвые
  `[disabled]`-правила), **B-07/B-14** (`.media-fs__announcer` sr-only в
  FA-сабсете), **B-08** (768→767px: preloader + bp-export-btn), **B-09**
  (перекрытый transition), **B-15** (дубль `.main-area{display:none}`),
  **B-16** (`.case-text__eyebrow` → `--color-accent-text`, AA-контраст),
  **B-18** (`focus-within` на `.fa-card__hint`), **E-24** (`color-scheme` в
  tokens.css + meta в обеих HTML).

**Перенесено в F4 (i18n-территория):**

- **A1-17** (lang-switch сбрасывает scroll/remount'ит 3D) — нет хирургического
  фикса, нужен scoped `lang-refresh`-режим `openCase` (сохранить scrollTop +
  пропустить build3D при совпадении id/viz). cannot-confirm в анализе.
- **A2-05** (provisional-lang: `?lang=en` пишется до geo-детекта) — плотно
  переплетён с frozen i18n-URL-чеками и работой F4 по hreflang/`?lang=ru`;
  менять i18n URL-логику один раз там.
- **A1-20 видимый empty-state** (элемент + i18n-копи + CSS) и **FA empty-state
  i18n** (`setGridEmptyState` сейчас English-only, не рефрешится на смене
  языка — Codex MEDIUM): F4 добавит ключи `content/i18n-ui.json` + RU +
  refresh в `i18n:changed`. До F4 английский месседж — улучшение против
  прежнего «пустой грид без сообщения», не регрессия.
- **chip.remove** — осиротевший i18n-ключ после A1-08 (нет консумера): F4
  удалит из `content/i18n-ui.json` + `content:generate` + golden-recapture.

**Accepted / rejected:**

- **B-04** (мёртвые мобильные `.cards-toggle`-правила, перекрытые поздними
  `display:none` на 1320/1345) — accepted: удаление требует точной сверки
  каскада по нескольким `@media`, выгода низкая; post-prod cleanup.
- **B-19** (комментарии о брейкпоинтах light-dd) — **rejected/false-positive**:
  анализ заявил реальный брейкпоинт 1199px, но в `portfolio-case.css` нет
  `1199/1200` — реальные медиа-запросы на 1023/1024 (строки 113, 1799),
  т.е. комментарии «≤1023/≥1024» КОРРЕКТНЫ.

**Ревью F3 (4 внутренних агента Opus 4.8 + Codex adversarial):**

- spec-guardian — clean (нет рисков для frozen-контракта). Исправлено по
  ревью ДО коммита: **A1-19** (таймер на кнопке вместо общей переменной —
  без конфликта desktop/mobile share при ресайзе через 768px); **A2-12**
  (pause/clear/capture перенесены ВНУТРЬ IntersectionObserver — off-screen
  footer остаётся переводимым, печатается актуальный язык без вспышки).
- Codex (`codex:rescue`, сессия `019ec1ea-…`): 1 HIGH — **A1-02 async-гонка**:
  пауза в `setViz` гасила лишь уже существующий вьюер, а при уходе с вкладки
  во время загрузки модели async-`createCodexThreeViewer` стартовал с
  `autoRotate:true`. Исправлено: `autoRotate: (currentViz === '3d') &&
  autoRotateOn` на создании (предпочтение хранит `currentThreeSource`).
  MEDIUM (empty-state i18n) и LOW (color-scheme `:root` vs тема на body —
  гипотеза, browser-verify) — в F4/F6 (см. выше). A1-08 keyboard — accepted
  (chips `aria-hidden`, удаление через чекбоксы). A2-03 категориальный штамп —
  INFO forward-only (идентичен для текущего каталога, N4 проходят).

**Гейты F3:** `npm run codex:ship` exit 0 — verify-plugin 37/37,
check:governance 0, check:parity 19/19, content:check OK, test:golden 2/2,
test:verify-fatal OK, verify-frozen **134/134, 0 FAIL**. (Env: worktree без
своего `node_modules` — `test:verify-fatal` падал на резолве `playwright` из
temp-копии; починено junction'ом `node_modules` → основной репо, к репо
отношения не имеет, как ENV-01.)

Следующий шаг: draft PR F3, затем итерация F4 (`codex/prod-f4-seo-i18n`):
hreflang + `?lang=ru` + RU-sitemap, экстернализация строк, ЧЕРНОВОЙ перевод
всего RU (meta + UI-ключи + тексты кейсов) на утверждение владельца, скрытие
Download у ассетов без файла, llms.txt, JSON-LD numberOfItems, Organization.logo,
twitter:image:alt, manifest-иконки, кастомный 404, a11y (E-14/E-15), + перенесённые
A1-12/A1-13/A1-17/A2-05/A2-02/A2-06/A2-15, empty-state i18n, chip.remove cleanup.

## Итерация F4-tail — остаток F4 (2026-06-13)

Ветка `codex/prod-f4-seo-i18n-tail` (PR #49/F4 влит в main на 6/9 chunk'ов;
хвост закрыт здесь). Детали — `docs/agent/admin-panel/handoff.md`, «Сессия 5».
Оркестрация: 3 фоновых стража Opus 4.8, workflow `f4-tail-code-review` (7 углов)
и Codex adversarial.

**Закрыто (fixed F4-tail):**

- **E-12 / A1-12 / A2-02** (+ часть **A2-06 / E-11**): счётчики через i18n —
  namespace `count.*` (плюрал `Intl.PluralRules`), `tCount`/`faCountText`,
  FA-ветка «categories», пересчёт на смене языка. EN байт-в-байт.
- **A1-20 / A2-03**: видимый empty-state (index `.cards-empty` + FA
  `setGridEmptyState`) через namespace `empty.*`. Озвучивание — `#cards-count`
  aria-live (без `role=status` на статичном тексте — анти-паттерн).
- **A1-13**: i18n + refresh aria/title fullscreen-кнопок (`refreshFsLabels`,
  ключи `fs.zoom*`).
- **A2-05**: провизорный рендер не штампует `?lang` до settle; `userSettled`-гард.
- **A1-17**: смена языка при открытом кейсе сохраняет 2D-scroll (`langRefresh`);
  3D/blueprint пересобирается для перевода aria-лейблов.
- **E-05**: FA JSON-LD `thumbnailUrl` опускается у ассетов без обложки (нет
  OG-фолбэка); тесты content-visibility 8/13.
- **E-15**: дропдаун `role="listbox"`→`role="group"`, сняты `aria-multiselectable`
  и `role="option"` (нативные чекбоксы).
- **chip.remove**: мёртвый ключ удалён, `chip` убран из B2-namespaces.

**Принято / не чинится:** **A2-15** (`numberOfItems`=25 — SEO-призрак, дизайн);
blueprint title-block переводится через rebuild; ремаунт 3D при смене языка
на 3D-вкладке сохранён (лейблы `viz.*` через `I18N.t`, декаплинг отложен).

**Ревью-фиксы (workflow + Codex):** лишний `i18n:changed` на EN→EN geo-settle
(редизайн `applyLang`); empty-state `role=status` снят; `langRefresh` scroll
только на 2D; **Codex P2** — `langRefresh` замораживал JS-лейблы 3D/blueprint →
rebuild возвращён (A1-17 сужен до сохранения scroll).

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
| Счётчики «N assets» вручную | уже автоматизировано генератором (см. D-10); текст в handoff обновлён в F1 |
| Manual-порядок стартует с авторского | F5 — делаем (старт с seeded-раскладки) |
| Чередование рядов в manual | F5 — оценить; если рискованно для вёрстки — accepted |
| i18nOverrides при reorder | F2 — admin-батч (точная локация в D-09) |
| Golden-фикстуры / CI recapture | сделано в F1 (D-01) |
| .gitattributes eol=lf | сделано в F1 |
| Флак preloader-смоука | сделано в F1: порог 2200→3500мс при гейте «строго < 4000мс задержки» — контракт сохранён (на прогоне F1 тест занял 3.4s, старый порог флакнул бы) |
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
