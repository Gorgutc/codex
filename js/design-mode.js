/* Codex Design Lab: resolve the opt-in visual direction before CSS loads.
   Public pages are always Original unless ?design=specimen|chamber is set.
   Admin srcdoc previews may provide data-design-preview on <html>. */
(function () {
  'use strict';

  var root = document.documentElement;
  var valid = Object.create(null);
  valid.specimen = true;
  valid.chamber = true;
  var initialHash = window.location.hash;

  function normalize(value) {
    value = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(valid, value) ? value : 'original';
  }

  var requested;
  var previewMode = root.getAttribute('data-design-preview');
  if (previewMode !== null) {
    requested = previewMode;
  } else {
    try {
      requested = new URLSearchParams(window.location.search).get('design') || '';
    } catch (_error) {
      requested = '';
    }
  }

  var mode = normalize(requested);
  root.setAttribute('data-design', mode);

  if (mode !== 'original') {
    var robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute('content', 'noindex, nofollow');
  }

  function withMode(href) {
    if (typeof href !== 'string' || !href || href.charAt(0) === '#') return href;
    if (/^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return href;

    try {
      var base = new URL(document.baseURI);
      var url = new URL(href, base);
      if (!/^https?:$/.test(url.protocol) || url.origin !== base.origin) return href;

      if (mode === 'original') url.searchParams.delete('design');
      else url.searchParams.set('design', mode);

      var currentLang = new URLSearchParams(window.location.search).get('lang');
      if ((currentLang === 'en' || currentLang === 'ru') && !url.searchParams.has('lang')) {
        url.searchParams.set('lang', currentLang);
      }

      if (/^https?:\/\//i.test(href)) return url.toString();
      return url.pathname + url.search + url.hash;
    } catch (_error) {
      return href;
    }
  }

  window.CodexDesign = Object.freeze({
    mode: mode,
    initialHash: initialHash,
    withMode: withMode
  });
})();
