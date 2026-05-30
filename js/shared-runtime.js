/* Shared classic-script runtime helpers for Codex Studio pages. */
(function () {
  'use strict';

  var MODEL_VIEWER_SRC = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
  var modelViewerLoading = null;
  var modelViewerAttempts = 0;

  function loadModelViewerScript() {
    if (window.customElements && window.customElements.get('model-viewer')) {
      return Promise.resolve();
    }
    if (modelViewerLoading) return modelViewerLoading;

    modelViewerLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.type = 'module';
      modelViewerAttempts += 1;
      // Module scripts can memoize failed URLs, so retry with a fresh URL.
      s.src = MODEL_VIEWER_SRC + (modelViewerAttempts > 1 ? '?retry=' + modelViewerAttempts : '');
      s.onload = function () { resolve(); };
      s.onerror = function () {
        modelViewerLoading = null;
        reject(new Error('model-viewer load failed'));
      };
      document.head.appendChild(s);
    });

    return modelViewerLoading;
  }

  window.CodexShared = Object.assign({}, window.CodexShared, {
    loadModelViewerScript: loadModelViewerScript,
  });
})();
