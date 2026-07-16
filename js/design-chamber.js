/*
 * CODEX BLACK CHAMBER
 * Reusable Black Chamber presentation layer. Chamber starts every surface;
 * the Hybrid adapter starts only the approved Home capability. Cases, 3D,
 * blueprints, filters, previews, downloads, i18n and sharing stay delegated to
 * their existing runtime owners.
 */
(function () {
  'use strict';

  var design = window.CodexDesign;
  if (!design || (design.mode !== 'chamber' && design.mode !== 'hybrid')) return;

  var initialHash = decodeHash(design.initialHash || window.location.hash);
  var isFreeAssets = !!document.getElementById('fa-grid');
  var runtime = null;
  var started = false;

  function decodeHash(hash) {
    var value = String(hash || '').replace(/^#/, '');
    if (!value) return '';
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function translated(key, fallback) {
    var i18n = window.I18N;
    if (!i18n || typeof i18n.t !== 'function') return fallback;
    var value = i18n.t(key);
    return value && value !== key ? value : fallback;
  }

  function isRussian() {
    return String(document.documentElement.lang || '').toLowerCase().indexOf('ru') === 0;
  }

  function localCopy(en, ru) {
    return isRussian() ? ru : en;
  }

  function withMode(url) {
    if (design && typeof design.withMode === 'function') {
      try { return design.withMode(url); } catch (_) { /* safe relative fallback */ }
    }
    return url;
  }

  function isModifiedActivation(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (typeof event.button === 'number' && event.button !== 0);
  }

  function preserveModeLinks() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || href.charAt(0) === '/' ||
          /^(?:https?:|mailto:|tel:)/i.test(href)) return;
      link.setAttribute('href', withMode(href));
    });
  }

  function dispatchRender(view, id) {
    if (runtime && runtime.mode === 'hybrid') {
      document.documentElement.setAttribute('data-design-runtime-ready', runtime.mode);
      document.dispatchEvent(new CustomEvent('codex:design-runtime-ready', {
        detail: { mode: runtime.mode, view: view, id: id || null }
      }));
    }
    document.dispatchEvent(new CustomEvent('codex:design-render', {
      detail: { mode: runtime ? runtime.mode : design.mode, view: view, id: id || null }
    }));
  }

  function setDesignSurface(surface) {
    if (!runtime || runtime.mode !== 'hybrid') return;
    var root = document.documentElement;
    root.setAttribute('data-design-surface', surface);
    root.classList.toggle('design-chamber-home', surface === 'home');
  }

  function projectCards() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.work-card[data-id]:not(.tag-card)')
    );
  }

  function projectFromCard(card, index) {
    var title = card.querySelector('.work-card__title');
    var description = card.querySelector('.work-card__desc');
    var category = card.querySelector('.work-card__cat');
    var year = card.querySelector('.work-card__year');
    var image = card.querySelector('.work-card__thumb img');
    return {
      id: card.dataset.id,
      index: index,
      title: title ? title.textContent.trim() : card.dataset.id,
      description: description ? description.textContent.trim() : '',
      category: category ? category.textContent.trim() : '',
      year: year ? year.textContent.trim() : '',
      imageSrc: image ? (image.getAttribute('src') || '') : '',
      imageAlt: image ? (image.getAttribute('alt') || '') : '',
      imageWidth: image ? (image.getAttribute('width') || '800') : '800',
      imageHeight: image ? (image.getAttribute('height') || '600') : '600'
    };
  }

  function initPortfolio() {
    var main = document.getElementById('main');
    var caseView = document.getElementById('case-view');
    var caseScroll = document.getElementById('case-scroll');
    var cards = projectCards();
    if (!main || !caseView || !cards.length) return;

    document.body.classList.add('chamber-page-portfolio');
    preserveModeLinks();

    var projects = cards.map(projectFromCard);
    var ids = projects.map(function (project) { return project.id; });
    var activeIndex = Math.max(0, ids.indexOf('orbital-mk-ii'));
    var homeIntent = ids.indexOf(initialHash) === -1;
    var routeFocus = false;
    var lastShownCaseId = '';
    var home = buildHome(projects);
    setDesignSurface(homeIntent ? 'home' : 'case');
    main.insertBefore(home.root, caseView);

    var back = document.getElementById('case-back');
    if (runtime.casePresentation) {
      back = make('button', 'chamber-case-back');
      back.type = 'button';
      back.textContent = localCopy('Back to projects', 'Назад к проектам');
      back.setAttribute('aria-label', translated('aria.backToProjects', back.textContent));
      caseView.insertBefore(back, caseView.firstChild);
    }
    if (back) back.dataset.designBack = '';

    document.querySelectorAll('.chamber-page-portfolio .logo').forEach(function (logo) {
      logo.dataset.designBack = '';
    });

    function refreshProjects() {
      projects = projectCards().map(projectFromCard);
      ids = projects.map(function (project) { return project.id; });
      if (activeIndex >= projects.length) activeIndex = 0;
      activeIndex = home.refresh(projects, activeIndex);
    }

    function validProject(id) {
      return !!id && ids.indexOf(id) !== -1;
    }

    function baseUrl() {
      return window.location.pathname + window.location.search;
    }

    function ensureCaseHash(id) {
      if (!id || decodeHash(window.location.hash) === id) return;
      try { history.replaceState(null, '', baseUrl() + '#' + encodeURIComponent(id)); }
      catch (_) { /* file and strict preview sandboxes may reject history writes */ }
    }

    function stopOptInMedia() {
      if (window.CodexCase && typeof window.CodexCase.leaveCase === 'function') {
        window.CodexCase.leaveCase();
        return;
      }
      var tab2d = document.getElementById('case-tab-2d');
      if (tab2d && tab2d.getAttribute('aria-selected') !== 'true') tab2d.click();
      document.querySelectorAll('.case-motion__video').forEach(function (video) {
        if (typeof video.pause === 'function') video.pause();
      });
    }

    function setHybridMobileSidebar(collapsed) {
      if (runtime.mode !== 'hybrid' || !window.matchMedia('(max-width: 767px)').matches) return;
      if (window.CodexCase && typeof window.CodexCase.setSidebarCollapsed === 'function') {
        window.CodexCase.setSidebarCollapsed(collapsed);
      }
    }

    function showHome(options) {
      options = options || {};
      homeIntent = true;
      setHybridMobileSidebar(false);
      setDesignSurface('home');
      home.root.hidden = false;
      caseView.hidden = true;
      caseView.setAttribute('aria-hidden', 'true');
      document.body.classList.add('chamber-route-home');
      document.body.classList.remove('chamber-route-case', 'chamber-case-scrolled');
      stopOptInMedia();
      if (!options.keepHomeRender) home.render(activeIndex, false);
      if (options.focus) home.focusHeading();
      dispatchRender('home');
    }

    function decorateCase(id) {
      var track = document.getElementById('case-scroll-track');
      if (!track) return;
      var previousPoster = track.querySelector('.chamber-case-poster');
      var project = projects[ids.indexOf(id)];
      var posterMatches = previousPoster && previousPoster.getAttribute('data-chamber-case-id') === id &&
        previousPoster.querySelector('.chamber-case-poster__image') &&
        previousPoster.querySelector('.chamber-case-poster__image').getAttribute('src') === project.imageSrc;
      if (previousPoster && !posterMatches) previousPoster.remove();
      if (project && project.imageSrc && !posterMatches) {
        var posterRow = make('div', 'case-row chamber-case-hero chamber-case-poster');
        posterRow.setAttribute('data-chamber-case-id', id);
        var posterItem = make('article', 'case-item chamber-case-poster__item');
        var posterMedia = make('div', 'case-item__media chamber-case-poster__media');
        var posterImage = make('img', 'case-item__img chamber-case-poster__image');
        posterImage.src = project.imageSrc;
        posterImage.alt = project.imageAlt || project.title;
        posterImage.width = Number(project.imageWidth) || 800;
        posterImage.height = Number(project.imageHeight) || 600;
        posterImage.loading = 'eager';
        posterImage.decoding = 'async';
        append(posterMedia, posterImage);
        append(posterItem, posterMedia);
        append(posterRow, posterItem);
        track.insertBefore(posterRow, track.firstChild);
      }
      var rows = Array.prototype.slice.call(track.querySelectorAll(':scope > .case-row:not(.chamber-case-poster)'));
      rows.forEach(function (row, index) {
        row.dataset.chamberChapter = String(index + 1).padStart(2, '0');
      });
    }

    function showCase(id, options) {
      options = options || {};
      if (!validProject(id)) {
        showHome(options);
        return;
      }
      var enteringFromHome = !home.root.hidden;
      var shouldResetCasePosition = enteringFromHome || lastShownCaseId !== id;
      homeIntent = false;
      activeIndex = ids.indexOf(id);
      home.cancel();
      setHybridMobileSidebar(true);
      setDesignSurface('case');
      home.root.hidden = true;
      caseView.hidden = false;
      caseView.removeAttribute('aria-hidden');
      document.body.classList.add('chamber-route-case');
      document.body.classList.remove('chamber-route-home', 'chamber-case-scrolled');
      if (runtime.casePresentation) decorateCase(id);
      if (shouldResetCasePosition) {
        if (caseScroll) caseScroll.scrollTop = 0;
        window.scrollTo(0, 0);
        requestAnimationFrame(function () {
          if (caseScroll) caseScroll.scrollTop = 0;
          window.scrollTo(0, 0);
        });
      }
      lastShownCaseId = id;
      if (shouldResetCasePosition) {
        requestAnimationFrame(function () {
          document.dispatchEvent(new CustomEvent('codex:viz-change', {
            detail: { mode: '2d', caseId: id }
          }));
        });
      }
      if (options.focus) {
        var caseTitle = document.getElementById('case-title');
        if (caseTitle) {
          caseTitle.setAttribute('tabindex', '-1');
          caseTitle.focus({ preventScroll: true });
        }
      }
      dispatchRender('case', id);
      if (enteringFromHome && window.CodexCase && typeof window.CodexCase.resumeCase === 'function') {
        requestAnimationFrame(function () { window.CodexCase.resumeCase(); });
      }
    }

    function goHome(pushHistory) {
      if (!home.root.hidden && !validProject(decodeHash(window.location.hash))) {
        showHome({ focus: true });
        return;
      }
      homeIntent = true;
      if (pushHistory !== false) {
        try { history.pushState(null, '', baseUrl()); }
        catch (_) { window.location.hash = ''; }
      } else {
        try { history.replaceState(null, '', baseUrl()); }
        catch (_) { window.location.hash = ''; }
      }
      showHome({ focus: true });
    }

    function syncRoute(options) {
      options = options || {};
      var id = decodeHash(window.location.hash);
      if (validProject(id)) {
        homeIntent = false;
        showCase(id, options);
      } else {
        if (id) {
          try { history.replaceState(null, '', baseUrl()); } catch (_) { /* no-op */ }
        }
        showHome(options);
      }
    }

    home.onSelect(function (index) {
      if (index === activeIndex) return;
      activeIndex = index;
      home.render(activeIndex, true);
    });
    home.onOpen(function (event) {
      if (isModifiedActivation(event)) return;
      homeIntent = false;
      routeFocus = true;
    });

    document.addEventListener('click', function (event) {
      var control = event.target.closest && event.target.closest('[data-design-back]');
      if (!control || !document.body.classList.contains('chamber-page-portfolio')) return;
      if (control.tagName === 'A' && isModifiedActivation(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      goHome(true);
    }, true);

    document.addEventListener('keydown', function (event) {
      if (home.root.hidden || event.ctrlKey || event.metaKey || event.altKey) return;
      var target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' || target.isContentEditable)) return;
      var nextIndex = activeIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex++;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex--;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = projects.length - 1;
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activeIndex = (nextIndex + projects.length) % projects.length;
      home.render(activeIndex, true);
      home.focusActiveProject();
    }, true);

    if (caseScroll) {
      caseScroll.addEventListener('scroll', function () {
        document.body.classList.toggle('chamber-case-scrolled', caseScroll.scrollTop > 64);
      }, { passive: true });
    }

    document.addEventListener('codex:case-open', function (event) {
      var id = event.detail && event.detail.id;
      if (!validProject(id) || homeIntent) return;
      ensureCaseHash(id);
      requestAnimationFrame(function () {
        showCase(id, { focus: routeFocus });
        routeFocus = false;
      });
    });

    window.addEventListener('hashchange', function () {
      syncRoute({ focus: routeFocus });
      routeFocus = false;
    });

    window.addEventListener('popstate', function () {
      homeIntent = !validProject(decodeHash(window.location.hash));
      syncRoute({ focus: true });
    });

    window.addEventListener('i18n:changed', function () {
      if (runtime.casePresentation && back) {
        back.textContent = localCopy('Back to projects', 'Назад к проектам');
        back.setAttribute('aria-label', translated('aria.backToProjects', back.textContent));
      }
      refreshProjects();
      if (homeIntent) showHome({ keepHomeRender: true });
    });

    /* main.js opens the first case on a zero-delay timer. Run after that timer so
       root remains Home, while a direct #orbital-mk-ii deep link stays a Case. */
    window.setTimeout(function () {
      if (initialHash && validProject(initialHash)) {
        homeIntent = false;
        if (window.CodexCase && typeof window.CodexCase.openCase === 'function') {
          window.CodexCase.openCase(initialHash, { initial: true, skipHashSync: true });
        }
        ensureCaseHash(initialHash);
        showCase(initialHash);
      } else {
        showHome();
      }
    }, 0);
  }

  function buildHome(projects) {
    var root = make('section', 'chamber-home');
    root.dataset.designHome = runtime.mode;
    root.setAttribute('aria-labelledby', 'chamber-home-title');

    var media = make('div', 'chamber-home__media');
    var image = make('img', 'chamber-home__image');
    image.loading = 'eager';
    image.decoding = 'async';
    var incomingImage = null;
    if (runtime.stableMotion) {
      image.classList.add('chamber-home__image--active');
      incomingImage = make('img', 'chamber-home__image');
      incomingImage.loading = 'eager';
      incomingImage.decoding = 'async';
      incomingImage.hidden = true;
      incomingImage.setAttribute('aria-hidden', 'true');
    }
    var shade = make('div', 'chamber-home__shade');
    shade.setAttribute('aria-hidden', 'true');
    append(media, image, incomingImage, shade);

    var rail = make('nav', 'chamber-home__rail');
    rail.setAttribute('aria-label', localCopy('Project index', 'Индекс проектов'));
    var railLabel = make('p', 'chamber-home__rail-label');
    var list = make('ol', 'chamber-home__index');
    append(rail, railLabel, list);

    var content = make('div', 'chamber-home__content');
    var meta = make('p', 'chamber-home__meta');
    var title = make('h1', 'chamber-home__title');
    title.id = 'chamber-home-title';
    title.setAttribute('tabindex', '-1');
    var description = make('p', 'chamber-home__description');
    var actions = make('div', 'chamber-home__actions');
    var view = make('a', 'chamber-home__view');
    view.dataset.designOpenProject = '';
    var counter = make('span', 'chamber-home__counter');
    counter.setAttribute('aria-live', 'polite');
    append(actions, view, counter);
    append(content, meta, title, description, actions);

    var pager = make('div', 'chamber-home__pager');
    var previous = make('button', 'chamber-home__pager-button', '←');
    previous.type = 'button';
    var next = make('button', 'chamber-home__pager-button', '→');
    next.type = 'button';
    append(pager, previous, next);

    var foot = make('div', 'chamber-home__foot');
    var studio = make('span', 'chamber-home__studio', 'CODEX / 3D DESIGN STUDIO');
    var assets = make('a', 'chamber-home__assets');
    assets.href = withMode('./free-assets.html');
    assets.textContent = translated('pill.freeAssets', 'Free Assets');
    append(foot, studio, assets);

    append(root, media, rail, content, pager, foot);

    var selectHandler = function () {};
    var openHandler = function () {};
    var activeIndex = 0;
    var projectList = projects;
    var requestedIndex = 0;
    var committedIndex = -1;
    var transitionGeneration = 0;
    var transitionRunning = false;
    var transitionSourceIndex = -1;
    var reversalFrame = 0;
    var activeImage = image;
    var standbyImage = incomingImage;
    var motionWaiters = [];

    function rebuildIndex() {
      list.replaceChildren();
      projectList.forEach(function (project, index) {
        var item = make('li', 'chamber-home__index-item');
        var button = make('a', 'chamber-home__index-button');
        button.href = '#' + encodeURIComponent(project.id);
        button.dataset.designProject = project.id;
        button.setAttribute('aria-label', String(index + 1).padStart(2, '0') + ' — ' + project.title);
        var number = make('span', 'chamber-home__index-number', String(index + 1).padStart(2, '0'));
        var label = make('span', 'chamber-home__index-title', project.title);
        append(button, number, label);
        button.addEventListener('mouseenter', function () { selectHandler(index); });
        button.addEventListener('focus', function () { selectHandler(index); });
        button.addEventListener('click', function (event) { openHandler(event); });
        append(item, button);
        list.appendChild(item);
      });
    }

    function updateLabels() {
      rail.setAttribute('aria-label', localCopy('Project index', 'Индекс проектов'));
      railLabel.textContent = localCopy('Projects', 'Проекты') + ' / ' + projectList.length;
      view.textContent = localCopy('View case', 'Смотреть кейс') + ' ↗';
      previous.setAttribute('aria-label', translated('aria.prevProject', 'Previous project'));
      next.setAttribute('aria-label', translated('aria.nextProject', 'Next project'));
      assets.textContent = translated('pill.freeAssets', 'Free Assets');
    }

    function normalizeIndex(index) {
      return (index + projectList.length) % projectList.length;
    }

    function updateSelection(index, shouldScroll) {
      list.querySelectorAll('.chamber-home__index-button').forEach(function (button, buttonIndex) {
        var selected = buttonIndex === index;
        button.classList.toggle('is-active', selected);
        if (selected) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      if (shouldScroll) {
        var activeButton = list.querySelector('.chamber-home__index-button.is-active');
        if (activeButton) activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }

    function setImageSource(layer, project) {
      if (!layer) return;
      if (project.imageSrc) {
        layer.hidden = false;
        if (layer.getAttribute('src') !== project.imageSrc) layer.src = project.imageSrc;
        layer.alt = project.imageAlt || project.title;
        layer.width = Number(project.imageWidth) || 800;
        layer.height = Number(project.imageHeight) || 600;
      } else {
        layer.hidden = true;
        layer.removeAttribute('src');
        layer.alt = '';
      }
    }

    function commitCopy(index) {
      var project = projectList[index];
      root.dataset.activeProject = project.id;
      title.textContent = project.title;
      description.textContent = project.description;
      meta.textContent = [project.category, project.year].filter(Boolean).join(' · ');
      updateRouteControls(runtime.stableMotion ? requestedIndex : index);
      media.dataset.label = project.title;
    }

    function updateRouteControls(index) {
      var project = projectList[index];
      counter.textContent = String(index + 1).padStart(2, '0') + ' / ' +
        String(projectList.length).padStart(2, '0');
      view.href = '#' + encodeURIComponent(project.id);
      view.dataset.designOpenProject = project.id;
    }

    function renderLegacy(index, animate) {
      activeIndex = normalizeIndex(index);
      var project = projectList[activeIndex];
      root.dataset.requestedProject = project.id;
      root.classList.toggle('is-changing', !!animate &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      commitCopy(activeIndex);
      setImageSource(image, project);
      updateSelection(activeIndex, animate);
      if (animate) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { root.classList.remove('is-changing'); });
        });
      }
    }

    function nextFrame() {
      return new Promise(function (resolve) { requestAnimationFrame(resolve); });
    }

    function delay(milliseconds) {
      return new Promise(function (resolve) {
        var waiter = { id: 0, resolve: resolve };
        waiter.id = window.setTimeout(function () {
          motionWaiters = motionWaiters.filter(function (entry) { return entry !== waiter; });
          resolve();
        }, milliseconds);
        motionWaiters.push(waiter);
      });
    }

    function cancelMotionWaiters() {
      motionWaiters.splice(0).forEach(function (waiter) {
        window.clearTimeout(waiter.id);
        waiter.resolve();
      });
    }

    function cancelScheduledReversal() {
      if (!reversalFrame) return;
      window.cancelAnimationFrame(reversalFrame);
      reversalFrame = 0;
    }

    function prepareImage(layer, project) {
      setImageSource(layer, project);
      if (!project.imageSrc || typeof layer.decode !== 'function') return Promise.resolve();
      return layer.decode().catch(function () {
        if (layer.complete) return undefined;
        return new Promise(function (resolve) {
          layer.addEventListener('load', resolve, { once: true });
          layer.addEventListener('error', resolve, { once: true });
        });
      });
    }

    function clearStableMotion() {
      transitionGeneration += 1;
      transitionRunning = false;
      transitionSourceIndex = -1;
      cancelScheduledReversal();
      cancelMotionWaiters();
      root.classList.remove('is-transitioning', 'is-content-changing');
      root.removeAttribute('data-transition-state');
      root.removeAttribute('aria-busy');
      if (standbyImage) {
        standbyImage.classList.remove('chamber-home__image--active');
        standbyImage.hidden = true;
        standbyImage.setAttribute('aria-hidden', 'true');
      }
      if (activeImage) {
        activeImage.hidden = false;
        activeImage.classList.add('chamber-home__image--active');
        activeImage.removeAttribute('aria-hidden');
      }
    }

    function commitDirect(index) {
      clearStableMotion();
      requestedIndex = normalizeIndex(index);
      activeIndex = requestedIndex;
      committedIndex = requestedIndex;
      setImageSource(activeImage, projectList[committedIndex]);
      commitCopy(committedIndex);
      updateSelection(committedIndex, false);
    }

    async function reverseStableMotion(sourceIndex) {
      reversalFrame = 0;
      transitionGeneration += 1;
      var generation = transitionGeneration;
      cancelMotionWaiters();
      transitionRunning = true;
      root.classList.add('is-transitioning', 'is-content-changing');
      root.setAttribute('data-transition-state', 'reversing');
      root.setAttribute('aria-busy', 'true');
      activeImage.hidden = false;
      activeImage.removeAttribute('aria-hidden');
      standbyImage.setAttribute('aria-hidden', 'true');
      activeImage.classList.add('chamber-home__image--active');
      standbyImage.classList.remove('chamber-home__image--active');

      await delay(180);
      if (generation !== transitionGeneration) return;
      commitCopy(sourceIndex);
      root.classList.remove('is-content-changing');

      /* The image scale is the longest Hybrid transition (720ms). Keep the
         motion owner active for its full duration so a following request can
         never reverse an in-flight transform after will-change is removed. */
      await delay(540);
      if (generation !== transitionGeneration) return;
      standbyImage.hidden = true;
      committedIndex = sourceIndex;
      transitionSourceIndex = -1;
      root.classList.remove('is-transitioning', 'is-content-changing');
      root.removeAttribute('data-transition-state');
      root.removeAttribute('aria-busy');
      transitionRunning = false;

      if (requestedIndex !== committedIndex) {
        root.setAttribute('aria-busy', 'true');
        transitionGeneration += 1;
        runStableMotion(transitionGeneration);
      }
    }

    function scheduleStableReversal(sourceIndex) {
      if (reversalFrame) return;
      var generation = transitionGeneration;
      reversalFrame = window.requestAnimationFrame(function () {
        reversalFrame = 0;
        if (generation !== transitionGeneration || !transitionRunning ||
            requestedIndex !== sourceIndex ||
            root.getAttribute('data-transition-state') !== 'crossfade') return;
        reverseStableMotion(sourceIndex);
      });
    }

    async function runStableMotion(generation) {
      transitionRunning = true;
      while (generation === transitionGeneration && requestedIndex !== committedIndex) {
        var targetIndex = requestedIndex;
        var targetProject = projectList[targetIndex];
        transitionSourceIndex = committedIndex;
        root.setAttribute('data-transition-state', 'decoding');
        standbyImage.classList.remove('chamber-home__image--active');
        standbyImage.hidden = false;
        await prepareImage(standbyImage, targetProject);
        if (generation !== transitionGeneration) break;
        if (targetIndex !== requestedIndex) {
          standbyImage.hidden = true;
          continue;
        }

        root.classList.add('is-transitioning', 'is-content-changing');
        root.setAttribute('data-transition-state', 'crossfade');
        await nextFrame();
        if (generation !== transitionGeneration) break;
        standbyImage.removeAttribute('aria-hidden');
        activeImage.setAttribute('aria-hidden', 'true');
        standbyImage.classList.add('chamber-home__image--active');
        activeImage.classList.remove('chamber-home__image--active');

        await delay(180);
        if (generation !== transitionGeneration) break;
        commitCopy(targetIndex);
        root.classList.remove('is-content-changing');

        /* 180ms content phase + 540ms settle phase matches the CSS transform's
           full 720ms. data-transition-state remains authoritative until then. */
        await delay(540);
        if (generation !== transitionGeneration) break;
        activeImage.hidden = true;
        var previousImage = activeImage;
        activeImage = standbyImage;
        standbyImage = previousImage;
        committedIndex = targetIndex;
        transitionSourceIndex = -1;
        root.classList.remove('is-transitioning');
        root.removeAttribute('data-transition-state');
      }
      if (generation === transitionGeneration) {
        transitionRunning = false;
        if (requestedIndex === committedIndex) {
          root.classList.remove('is-transitioning', 'is-content-changing');
          root.removeAttribute('data-transition-state');
          root.removeAttribute('aria-busy');
          standbyImage.classList.remove('chamber-home__image--active');
          standbyImage.hidden = true;
          standbyImage.setAttribute('aria-hidden', 'true');
        }
      }
    }

    function renderStable(index, animate) {
      requestedIndex = normalizeIndex(index);
      activeIndex = requestedIndex;
      root.dataset.requestedProject = projectList[requestedIndex].id;
      updateSelection(requestedIndex, animate);
      updateRouteControls(requestedIndex);
      if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || committedIndex < 0) {
        commitDirect(requestedIndex);
        return;
      }
      if (transitionRunning) {
        if (requestedIndex === transitionSourceIndex &&
            root.getAttribute('data-transition-state') === 'crossfade') {
          scheduleStableReversal(transitionSourceIndex);
        } else {
          cancelScheduledReversal();
        }
        return;
      }
      if (requestedIndex === committedIndex) return;
      root.setAttribute('aria-busy', 'true');
      transitionGeneration += 1;
      runStableMotion(transitionGeneration);
    }

    function render(index, animate) {
      if (!projectList.length) return;
      if (runtime.stableMotion) renderStable(index, animate);
      else renderLegacy(index, animate);
    }

    previous.addEventListener('click', function () {
      selectHandler((activeIndex - 1 + projectList.length) % projectList.length);
    });
    next.addEventListener('click', function () {
      selectHandler((activeIndex + 1) % projectList.length);
    });
    view.addEventListener('click', function (event) { openHandler(event); });

    rebuildIndex();
    updateLabels();
    render(0, false);

    return {
      root: root,
      render: render,
      refresh: function (nextProjects, fallbackIndex) {
        var nextIndex = normalizeIndex(fallbackIndex);
        var previousCommittedId = committedIndex >= 0 && projectList[committedIndex]
          ? projectList[committedIndex].id
          : '';
        var hadPendingSelection = runtime.stableMotion && requestedIndex !== committedIndex;
        if (runtime.stableMotion) clearStableMotion();
        projectList = nextProjects;
        if (nextIndex >= projectList.length) nextIndex = 0;
        activeIndex = nextIndex;
        requestedIndex = nextIndex;
        rebuildIndex();
        updateLabels();

        if (runtime.stableMotion && hadPendingSelection && previousCommittedId) {
          committedIndex = projectList.findIndex(function (project) {
            return project.id === previousCommittedId;
          });
          if (committedIndex < 0) committedIndex = 0;
          setImageSource(activeImage, projectList[committedIndex]);
          commitCopy(committedIndex);
          renderStable(nextIndex, true);
        } else {
          commitDirect(nextIndex);
        }
        return nextIndex;
      },
      cancel: function () {
        if (runtime.stableMotion) clearStableMotion();
        else root.classList.remove('is-changing');
      },
      onSelect: function (handler) { selectHandler = handler; },
      onOpen: function (handler) { openHandler = handler; },
      focusHeading: function () { title.focus({ preventScroll: true }); },
      focusActiveProject: function () {
        var activeButton = list.querySelector('.chamber-home__index-button.is-active');
        if (activeButton) activeButton.focus({ preventScroll: true });
      }
    };
  }

  function initFreeAssets() {
    document.body.classList.add('chamber-page-assets');
    preserveModeLinks();

    var grid = document.getElementById('fa-grid');
    var assetsScroll = document.querySelector('.fa-scroll');
    if (assetsScroll) assetsScroll.scrollTop = 0;
    window.scrollTo(0, 0);
    requestAnimationFrame(function () {
      if (assetsScroll) assetsScroll.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    var categories = document.querySelectorAll('.tag-card[data-tag]');
    categories.forEach(function (card, index) {
      card.dataset.chamberIndex = String(index + 1).padStart(2, '0');
    });

    function decorateGrid() {
      if (!grid) return;
      grid.querySelectorAll('.fa-card').forEach(function (card, index) {
        card.dataset.chamberIndex = String(index + 1).padStart(2, '0');
      });
      dispatchRender('free-assets');
    }

    if (grid && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function () { decorateGrid(); }).observe(grid, { childList: true });
    }

    window.addEventListener('i18n:changed', function () {
      preserveModeLinks();
      decorateGrid();
    });

    requestAnimationFrame(decorateGrid);
  }

  function start(options) {
    options = options || {};
    var mode = String(options.mode || design.mode);
    var root = document.documentElement;
    if (started || mode !== design.mode || root.getAttribute('data-design') !== mode ||
        (mode === 'hybrid' && root.getAttribute('data-design-runtime-state') === 'fallback')) return false;

    runtime = {
      mode: mode,
      home: options.home !== false,
      casePresentation: options.casePresentation !== false,
      freeAssetsPresentation: options.freeAssetsPresentation !== false,
      stableMotion: options.stableMotion === true
    };
    started = true;

    onReady(function () {
      if (isFreeAssets) {
        preserveModeLinks();
        if (runtime.freeAssetsPresentation) initFreeAssets();
        else dispatchRender('free-assets-fallback');
      } else if (runtime.home) {
        initPortfolio();
      }
    });
    return true;
  }

  window.CodexChamber = Object.freeze({ start: start });

  if (design.mode === 'chamber') {
    start({
      mode: 'chamber',
      home: true,
      casePresentation: true,
      freeAssetsPresentation: true,
      stableMotion: false
    });
  }
})();
