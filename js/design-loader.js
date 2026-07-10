/* Codex Design Lab: load exactly one opt-in direction and keep that mode on
   same-origin page links. Original mode requests no variant CSS or JS. */
(function () {
  'use strict';

  var Design = window.CodexDesign;
  var assets = {
    specimen: {
      css: './css/design-specimen.css',
      js: './js/design-specimen.js'
    },
    chamber: {
      css: './css/design-chamber.css',
      js: './js/design-chamber.js'
    }
  };
  var selected = Design && Object.prototype.hasOwnProperty.call(assets, Design.mode)
    ? assets[Design.mode]
    : null;
  if (!selected) return;

  var stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = selected.css;
  stylesheet.setAttribute('data-codex-design-asset', 'style');
  document.head.appendChild(stylesheet);

  function decorateAnchor(anchor) {
    if (!anchor || anchor.nodeType !== 1 || anchor.tagName !== 'A') return;
    var raw = anchor.getAttribute('href');
    var next = Design.withMode(raw);
    if (next && next !== raw) anchor.setAttribute('href', next);
  }

  function decorateLinks(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.tagName === 'A') decorateAnchor(root);
    var anchors = root.querySelectorAll ? root.querySelectorAll('a[href]') : [];
    for (var i = 0; i < anchors.length; i++) decorateAnchor(anchors[i]);
  }

  function boot() {
    decorateLinks(document);

    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var record = records[i];
          if (record.type === 'attributes') {
            decorateAnchor(record.target);
            continue;
          }
          for (var j = 0; j < record.addedNodes.length; j++) decorateLinks(record.addedNodes[j]);
        }
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['href']
      });
    }

    var runtime = document.createElement('script');
    runtime.src = selected.js;
    runtime.async = false;
    runtime.setAttribute('data-codex-design-asset', 'runtime');
    document.body.appendChild(runtime);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
