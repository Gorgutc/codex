/* Shared classic-script runtime helpers for Codex Studio pages. */
(function () {
  'use strict';

  // prod-review F2 (C-05): model-viewer 4.0.0 is self-hosted in js/vendor/
  // (the last external first-party script; ADR 0007 precedent). The bundle is
  // self-contained for our plain GLBs; the decoder locations below are a
  // defensive pin to the already self-hosted three decoders in case a future
  // free asset ships Draco/KTX2-compressed (default would be gstatic.com).
  var MODEL_VIEWER_SRC = './js/vendor/model-viewer.min.js';
  var modelViewerLoading = null;
  var modelViewerAttempts = 0;

  function configureModelViewerDecoders() {
    var MV = window.customElements && window.customElements.get('model-viewer');
    if (!MV) return;
    try {
      MV.dracoDecoderLocation = './js/vendor/three/libs/draco/gltf/';
      MV.ktx2TranscoderLocation = './js/vendor/three/libs/basis/';
    } catch (_e) { /* older bundle without static config — defaults stay */ }
  }

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
      s.onload = function () {
        configureModelViewerDecoders();
        resolve();
      };
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
