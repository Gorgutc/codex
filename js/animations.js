/* ═══════════════════════════════════════════════════════════════════════
   ANIMATIONS — Codex Studio (v0.6.0)
   ─────────────────────────────────────────────────────────────────────
   - Первичный reveal карточек (stagger)
   - Re-animate при фильтре
   - Magnetic tilt hover (pointer: fine)
   - Case-view reveal при открытии кейса
   - LIFT-ON-SCROLL для case-items через ScrollTrigger в вертикальном скролле.
     Lift: items поднимаются снизу с expo.out-easing — лёгкий «sticky» эффект.
═══════════════════════════════════════════════════════════════════════ */
gsap.registerPlugin(ScrollTrigger);

/* v0.13.6 — SplitText для H1 кейса.
   Плагин стал бесплатным с мая 2025 (GSAP 3.13+).
   Регистрация безопасна — если CDN не загрузился (CSP, оффлайн), код внизу
   проверяет typeof SplitText и fallback на fade. */
if (typeof SplitText !== 'undefined') {
  gsap.registerPlugin(SplitText);
}

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  var EASE  = 'power2.out';
  var LIFT_EASE = 'expo.out';  /* «залипающий» деселерейшн */
  /* v0.4 [M1]: :not(.tag-card) — на free-assets.html tag-cards имеют двойной класс `.tag-card.work-card`,
     и попадают сюда без фильтра. Это даёт им opacity:0 / y:16 / magnetic-tilt поверх собственных стилей,
     ломая визуал и pointer-events. Селектор исключает их явно. */
  var cards = document.querySelectorAll('.work-card:not(.tag-card)');

  /* ══════════════════════════════════
     1) Каскадный reveal карточек при входе в viewport (v0.13.5)
     ─────────────────────────────────────────────────────────
     Было: gsap.from(cards, …) — single-shot при загрузке, бьёт по
     всем 15 карточкам одновременно, а нижние (вне viewport) вообще
     проигрывают анимацию «в пустоту» — когда пользователь доскроллит,
     они уже давно opacity:1.
     Стало: ScrollTrigger.batch — собирает карточки, попавшие в viewport
     за короткое окно, и запускает onEnter(batch) со стаггером. Получаем
     каскад по мере скролла, при первой загрузке — только видимые.
  ══════════════════════════════════ */
  gsap.from('.cards-count', { opacity: 0, duration: 0.4, ease: 'power1.out' });
  // Начальное состояние — ставим сразу, чтобы верхние карточки не «мигнули»
  // до инициализации ScrollTrigger (batch поставит их в onEnter через такт).
  gsap.set(cards, { opacity: 0, y: 16 });
  // ВАЖНО: карточки лежат внутри .cards-scroll (собственный overflow-y:auto),
  // а не скроллятся месте с window. Без scroller: '#cards-scroll' ScrollTrigger
  // считает позиции относительно viewport и нижние карточки не триггерятся.
  var cardsScroll = document.getElementById('cards-scroll');
  ScrollTrigger.batch(cards, {
    scroller: cardsScroll || window,
    start: 'top 85%',
    once: true,
    onEnter: function (batch) {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        ease: EASE,
        stagger: 0.08,
        clearProps: 'transform,opacity',
        /* v0.18.0 — mark revealed cards so ResizeObserver / future filter
           passes can skip re-animating already-shown items.
           onComplete fires once per stagger group — все карточки batch'а
           помечаются единовременно после завершения tween-сетки. */
        onComplete: function () {
          batch.forEach(function (c) { c.setAttribute('data-revealed', 'true'); });
        }
      });
    }
  });
  // Изображения карточек догружаются после init — лайоут смещается,
  // старт-позиции устаревают. Рефрешим на load и через такт после DOMContentLoaded.
  requestAnimationFrame(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* ══════════════════════════════════
     1.5) CLIP-PATH REVEAL — миниатюры карточек (v0.13.4)
     ─────────────────────────────────────────────────────────────────
     • Класс .is-clip-reveal вешаем кодом (не в HTML 15× вручную).
     • Закрытое состояние — в CSS под @media no-preference:
       reduced пользователи видят картинку сразу (IIFE до них не дойдёт —
       выше early-return на reduced).
     • Без will-change — GSAP выставит его сам на время tween (Safari-safe, v0.12.4).
     • clearProps + снятие класса после tween — картинка чистая,
       hover scale(1.04) работает без конфликта.
     • При смене фильтра (codex:filter) класс уже снят → clip не возвращается.
     • scrollTrigger once: true — не висит после срабатывания.
  ══════════════════════════════════ */
  /* v0.4 [M1]: :not(.tag-card__thumb) — на FA у tag-card вложенный div имеет двойной класс,
     внутри нет реального <img>, но фильтр для гигиены — чтобы будущие img не попали. */
  var thumbs = document.querySelectorAll('.work-card__thumb:not(.tag-card__thumb) img');
  thumbs.forEach(function (img) { img.classList.add('is-clip-reveal'); });

  thumbs.forEach(function (img) {
    gsap.to(img, {
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.0,
      ease: 'power3.inOut',
      scrollTrigger: {
        trigger: img,
        scroller: cardsScroll || window,  /* v0.13.5 — тот же скроллер, что у batch */
        start: 'top 85%',
        once: true
      },
      onComplete: function () {
        gsap.set(img, { clearProps: 'clipPath' });
        img.classList.remove('is-clip-reveal');
      }
    });
  });

  /* ══════════════════════════════════
     2) Re-animate при смене фильтра
  ══════════════════════════════════ */
  document.addEventListener('codex:filter', function () {
    /* v0.4 [M1]: :not(.tag-card) — codex:filter эмитится фильтрами портфолио (index.html),
       на FA tag-cards не должны re-animate. */
    var visible = document.querySelectorAll('.work-card:not(.tag-card):not([hidden])');
    gsap.fromTo(visible,
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: EASE,
        stagger: 0.05,
        clearProps: 'transform'
      }
    );
  });

  /* ══════════════════════════════════
     3) Magnetic tilt hover
  ══════════════════════════════════ */
  var fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (fineHover) {
    var MAX_TILT       = 6;
    var DURATION       = 0.45;
    var RESET_DURATION = 0.6;

    // v0.8.1 [H2] — tilt отвечает только за rotationX/Y. translate (x/y)
    // принадлежит magnetic-cursor в main.js (MAGNETIC_SELECTOR/PULL_SOFT).
    // Раньше оба блока писали x/y через gsap.to(... overwrite:'auto'):
    // последний tween перетирал предыдущий → визуально один из эффектов
    // частично гасил другой. Теперь чистое разделение ответственностей.
    cards.forEach(function (card) {
      var qx = gsap.quickTo(card, 'rotationY', { duration: DURATION, ease: EASE });
      var qy = gsap.quickTo(card, 'rotationX', { duration: DURATION, ease: EASE });

      function onMove(e) {
        var rect = card.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width  * 2 - 1;
        var ny = (e.clientY - rect.top)  / rect.height * 2 - 1;
        qx( nx * MAX_TILT);
        qy(-ny * MAX_TILT);
      }
      function onLeave() {
        gsap.to(card, {
          rotationX: 0, rotationY: 0,
          duration: RESET_DURATION, ease: 'power3.out', overwrite: 'auto'
        });
      }

      card.addEventListener('pointermove',  onMove);
      card.addEventListener('pointerleave', onLeave);
      // focusout (бабблит) вместо blur — устойчиво к появлению фокусируемых детей в .work-card
      card.addEventListener('focusout',     onLeave);
    });
  }

  /* ══════════════════════════════════
     4) При сворачивании панели — снимаем tilt
  ══════════════════════════════════ */
  document.addEventListener('codex:toggle', function (e) {
    if (e.detail && e.detail.collapsed) {
      gsap.set(cards, { clearProps: 'transform' });
    }
  });

  /* ══════════════════════════════════
     4.1) v0.2.1 [П2] + v0.2.2 [П2] — MOBILE FIX для карточек после case-view.
     ----------------------------------------------------------------
     v0.2.1 репро: open-case → scroll → next → scroll → case-back.
       Проблема A — часть карточек оставалась с inline opacity:0,
       поставленным в секции 1 (`gsap.set(cards, { opacity:0, y:16 })`),
       т.к. ScrollTrigger.batch сработал только для карточек в viewport при
       первом рендере. На 375×800 cards-scroll height=438 и карточка №2
       (y=600) на ~6px не попадает в 'top 85%' threshold (594px).

     v0.2.2 репро: open-case → case-nav ×4 → case-back.
       Проблема B — карточки съезжают влево (rect.left ≈ –190px).
       ROOT CAUSE: в openCase() вызывался scrollIntoView({block:'center'})
       на активной карточке в момент, когда #cards-scroll имел
       display:none (0×0). Браузер вычислял scrollLeft = offsetLeft +
       width/2 ≈ 187px и присваивал этот offset #cards-scroll.scrollLeft
       несмотря на overflow-x:hidden (блокирует только жест, не программное
       присвоение). v0.2.2 [П1] в main.js блокирует тот вызов на
       mobile+collapsed. Здесь — defensive reset и доброскролл к активной.

     Фикс (mobile only, desktop не затронут):
     1. cardsScroll.scrollLeft = 0 — defensive сброс горизонтального
        scroll offset (на случай если какая-либо другая ветка оставит
        ненулевое значение).
     2. killTweensOf(cards) + clearProps по всем GSAP-трансформам —
        убирает остатки x/y/rotation* (напр. от прерванного reset
        магнитного эффекта) до анимации.
     3. ScrollTrigger.refresh() — пересчёт позиций после возврата лайаута.
     4. invisible cards (проблема A из v0.2.1) — fromTo анимация с явным
        clearProps, включая individual CSS transforms (translate/rotate/scale
        — GSAP 3.13+ их не падпадает под 'transform' shorthand).
     5. scrollIntoView({block:'nearest'}) активной карточки — замена
        пропущенного в v0.2.2 [П1] scrollIntoView из case-nav. Безопасно:
        контейнер уже видим (collapsed=false). 'nearest' вместо 'center' —
        не скроллит если карточка в видимости, меньше дергает.
  ══════════════════════════════════ */
  /* ══════════════════════════════════
     4.2) v0.7.12 [bug] — DESKTOP-аналог 4.1 (same ROOT CAUSE).
       setCollapsed(true) → scrollEl.hidden=true → display:none.
       openCase()→scrollIntoView в скрытом контейнере пишет неконсистентный
       scrollTop, который персистит после re-expand → нижние карточки
       визуально пропадают до resize.
       Desktop: достаточно [3] ScrollTrigger.refresh + [5] доскролл.
       Mobile: дополнительно [1] scrollLeft reset, [2] killTweens,
       [4] reveal invisible cards.
       Гард на сторону openCase: см. main.js isCollapsed.
  ══════════════════════════════════ */
  // v0.8.6 [M5] — раньше было два разных listener'а на один codex:toggle
  // (mobile в 4.1, desktop в 4.2), 80% общего тела. Объединены в один
  // с if(isMobile)-веткой; общие шаги [3] и [5] вынесены за условие.
  document.addEventListener('codex:toggle', function (e) {
    if (!e.detail || e.detail.collapsed) return;
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    // Два rAF: первый дождётся пока sidebar снова visible, второй — layout flush.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (isMobile) {
          // [1] Defensive reset горизонтального scroll offset.
          if (cardsScroll) {
            cardsScroll.scrollLeft = 0;
          }

          // [2] Останавливаем все tween'ы на карточках и чистим накопленные
          // GSAP-трансформы (кроме opacity — он чистится в [4] по инвизибл).
          gsap.killTweensOf(cards);
          gsap.set(cards, {
            clearProps: 'x,y,xPercent,yPercent,rotation,rotationX,rotationY,scale'
          });
        }

        // [3] Пересчёт позиций ScrollTrigger после возврата лайаута. Общий.
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();

        if (isMobile) {
          // [4] Ищем карточки с остатками opacity (проблема A из v0.2.1).
          // getComputedStyle надёжнее gsap.getProperty после killTweensOf.
          var invisible = [];
          cards.forEach(function (card) {
            var op = parseFloat(getComputedStyle(card).opacity);
            if (isNaN(op) || op < 0.99) invisible.push(card);
          });
          if (invisible.length) {
            gsap.fromTo(invisible,
              { opacity: 0, y: 8 },
              {
                opacity: 1,
                y: 0,
                duration: 0.4,
                ease: EASE,
                stagger: 0.04,
                clearProps: 'transform,opacity,translate,rotate,scale'
              }
            );
          }
        }

        // [5] Доброскролл к активной карточке. 'nearest' — корректный block,
        // не скроллит если карточка уже видима. Общий.
        var activeCard = document.querySelector('.work-card--active');
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  });

  /* ══════════════════════════════════
     5) CASE-OPEN — плавный reveal + setup lift-on-scroll
  ══════════════════════════════════ */
  function killItemScrollTriggers() {
    ScrollTrigger.getAll().forEach(function (st) {
      var trig = st.vars && st.vars.trigger;
      if (trig && trig.classList && trig.classList.contains('case-item')) {
        st.kill();
      }
    });
  }

  function setupLift(caseScroll) {
    var items = caseScroll.querySelectorAll('.case-item');
    if (!items.length) return;

    // Сбрасываем старые ScrollTriggers и кладём items в исходное положение
    killItemScrollTriggers();
    gsap.set(items, { opacity: 0, y: 44 });

    items.forEach(function (item, i) {
      // Для первых 2-х видимых — небольшой stagger, дальше без задержки
      var initialDelay = i < 2 ? i * 0.09 : 0;

      gsap.to(item, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: LIFT_EASE,
        delay: initialDelay,
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: item,
          scroller: caseScroll,
          start: 'top 92%',
          toggleActions: 'play none none none',
          once: true
        }
      });
    });

    /* v0.13.5 — CLIP-PATH reveal для медиа внутри case-item.
       media генерится динамически в js/main.js (img/video), поэтому
       триггерим на scroller: caseScroll. Класс .is-clip-reveal-case
       отдельный от v0.13.4 (.is-clip-reveal), чтобы CSS-правила не пересекались.
       onComplete — clearProps + снятие класса, картинка чистая, hover на
       case-item не ломается (у case-item__img нет hover-scale, но
       защита на будущее). */
    var media = caseScroll.querySelectorAll('.case-item__media img, .case-item__media video, .case-motion__poster');
    media.forEach(function (el) { el.classList.add('is-clip-reveal-case'); });
    media.forEach(function (el) {
      gsap.to(el, {
        clipPath: 'inset(0 0% 0 0)',
        duration: 1.0,
        ease: 'power3.inOut',
        scrollTrigger: {
          trigger: el,
          scroller: caseScroll,
          start: 'top 90%',
          once: true
        },
        onComplete: function () {
          gsap.set(el, { clearProps: 'clipPath' });
          el.classList.remove('is-clip-reveal-case');
        }
      });
    });

    // Форсируем пересчёт ScrollTrigger после сборки DOM
    ScrollTrigger.refresh();
  }

  document.addEventListener('codex:case-open', function (e) {
    var initial   = e.detail && e.detail.initial;
    var caseView  = document.getElementById('case-view');
    if (!caseView) return;

    var header   = caseView.querySelector('.case-view__header');
    var progress = document.getElementById('case-progress');
    var scrollEl = document.getElementById('case-scroll');
    var trackEl  = document.getElementById('case-scroll-track');

    // v0.8.4 [M2] — header может отсутствовать если case-view частично
    // собран (race на rebuild). header.querySelector(...) на null крашился.
    if (!header) return;

    // Сбрасываем прогресс
    var bar = document.getElementById('case-progress-bar');
    if (bar) bar.style.width = '0%';

    /* v0.13.6 — SplitText reveal для H1 кейса (с fallback на fade).
       Заменяет fade .case-view__left — буквы выезжают снизу стаггером.
       Только для .case-view__title (единственный H1 в проекте) —
       правило «одного сюрприза» из motion_brief.md. */
    var caseTitle = document.getElementById('case-title');
    var splitSupported = (typeof SplitText !== 'undefined');

    function revealCaseTitle() {
      if (!caseTitle) return;
      if (!splitSupported) {
        // Fallback: простой fade для H1 (CDN SplitText недоступен)
        gsap.fromTo(caseTitle,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', clearProps: 'transform,opacity' }
        );
        return;
      }
      // Сохраняем оригинал для скринридера — SplitText оборачивает буквы в <span>.
      // Обновляем каждый раз, т.к. при next/prev-кейсе main.js меняет textContent.
      caseTitle.setAttribute('aria-label', caseTitle.textContent.trim());
      // ВАЖНО: НЕ вызываем __split.revert() — main.js уже заменил textContent,
      // старые чар-спаны удалены. revert() вернул бы старый текст и перезаписал
      // только что поставленный. Новый SplitText сплитит текущий текст с нуля.
      var split = new SplitText(caseTitle, {
        type: 'chars,words',
        charsClass: 'case-title__char',
        wordsClass: 'case-title__word'
      });
      caseTitle.__split = split;
      gsap.from(split.chars, {
        yPercent: 100,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: { amount: 0.35, from: 'start' },
        onComplete: function () {
          // Очищаем inline-стили, но split оставляем — revert при следующем открытии
          gsap.set(split.chars, { clearProps: 'transform,opacity' });
        }
      });
    }

    // Reveal блоков
    if (initial) {
      // Null-guard: если case-view ещё не собран, пропускаем reveal, чтобы GSAP не падал на null
      var initialTargets = [progress, scrollEl].filter(Boolean);
      if (initialTargets.length) {
        gsap.from(initialTargets, {
          opacity: 0,
          y: 12,
          duration: 0.6,
          ease: 'power2.out',
          stagger: 0.08,
          clearProps: 'transform,opacity'
        });
      }
      // header показываем сразу, H1 — через SplitText
      revealCaseTitle();
    } else {
      // v0.9 — clip-path expand + fade для трека при выборе карточки
      // v0.13.6 — мета (cat/year) fade, H1 — SplitText
      gsap.fromTo(
        header.querySelector('.case-view__meta'),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
      revealCaseTitle();
      if (trackEl) {
        gsap.fromTo(
          trackEl,
          { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
          {
            opacity: 1,
            clipPath: 'inset(0 0 0% 0)',
            duration: 0.55,
            ease: 'expo.out',
            clearProps: 'clipPath,opacity'
          }
        );
      }
    }

    // Setup lift — делаем в следующем тике, когда DOM items уже прогрелись
    requestAnimationFrame(function () {
      if (scrollEl) setupLift(scrollEl);
    });
  });

  /* ══════════════════════════════════
     v0.10.1 — переключение 2D↔Blueprints
     ──────────────────────────────────
     Баг: когда пользователь открывает новый кейс, находясь во вкладке Blueprints,
     case-scroll скрыт (display:none), а setupLift() уже поставил items в opacity:0/y:44
     и создал ScrollTriggers — но они не сработают в скрытом контейнере.
     Фикс: при возврате на 2D — перезапускаем setupLift.
  ══════════════════════════════════ */
  document.addEventListener('codex:viz-change', function (e) {
    if (!e.detail || e.detail.mode !== '2d') return;
    var scrollEl = document.getElementById('case-scroll');
    if (!scrollEl) return;
    requestAnimationFrame(function () {
      // Сносим старые ScrollTrigger'ы для case-item
      killItemScrollTriggers();
      var items = scrollEl.querySelectorAll('.case-item');
      if (!items.length) return;
      // Напрямую показываем контент через fromTo — без ScrollTrigger,
      // т.к. при скрытом-затем-показанном scroller они не срабатывают корректно.
      gsap.fromTo(items,
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0,
          duration: 0.55,
          ease: LIFT_EASE,
          stagger: 0.05,
          clearProps: 'transform,opacity'
        }
      );
      ScrollTrigger.refresh();
    });
  });

  /* ══════════════════════════════════════════════════════════════════
     6) TYPEWRITER (v0.18.0) — type-on effect for [data-typewriter]
     ─────────────────────────────────────────────────────────────────
     Opt-in only. Element's textContent сохраняется, очищается,
     перепечатывается по символам при попадании в viewport. Текст остаётся
     нативным textContent без aria-label на roleless-элементе. once:true — без reverse.
     Reduced-motion: эта IIFE уже early-return'нула на line 25, поэтому
     для reduced пользователей текст остаётся как в HTML (без анимации).

     v0.21.5 — Fix race на cold start: раньше использовался
     ScrollTrigger.create({ start: 'top 90%' }), который зависел от
     window scroll event'ов для пересчёта. Но window на этой странице
     НЕ скроллится (sidebar/case-view имеют свой overflow:auto, плюс
     помечены data-lenis-prevent). Single ScrollTrigger.refresh() из
     codex:preloader-done handler срабатывал в гонке с layout reflow —
     иногда ловил footer в позиции, иногда нет → текст оставался
     навсегда пустым. IntersectionObserver корректно отрабатывает
     initial intersection state синхронно при observe() и не зависит
     от scroll-событий window.
  ══════════════════════════════════════════════════════════════════ */
  function setupTypewriters() {
    var typewriterEls = document.querySelectorAll('[data-typewriter]');
    if (!typewriterEls.length) return;
    var CHAR_DELAY = 30;
    typewriterEls.forEach(function (el) {
      var original = el.textContent;
      if (!original) return;
      el.textContent = '';
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          var i = 0;
          (function step() {
            el.textContent = original.slice(0, i);
            if (i++ < original.length) setTimeout(step, CHAR_DELAY);
          })();
        });
      }, { threshold: 0.1 });
      io.observe(el);
    });
  }
  // Запускаем после preloader-done чтобы layout settled. Если preloader
  // нет (is-loading не установлен в инлайн-script) — сразу.
  if (document.documentElement.classList.contains('is-loading')) {
    document.addEventListener('codex:preloader-done', setupTypewriters, { once: true });
  } else {
    setupTypewriters();
  }

  /* ══════════════════════════════════════════════════════════════════
     7) PRELOADER GATE — refresh ScrollTrigger after preloader removes
     itself (v0.17.0). Layouts that were behind .is-loading visibility:
     hidden may have measured differently before the overlay was
     unmounted; one extra refresh aligns trigger positions.
  ══════════════════════════════════════════════════════════════════ */
  document.addEventListener('codex:preloader-done', function () {
    requestAnimationFrame(function () { ScrollTrigger.refresh(); });
  }, { once: true });
})();
