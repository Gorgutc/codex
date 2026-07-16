/* Codex Design Lab: approved R2 Hybrid adapter.
   VIS-05.3 enables the shared Black Chamber Home only. Case and Free Assets
   deliberately keep their Original presentation until VIS-05.4 / VIS-05.5. */
(function () {
  'use strict';

  var design = window.CodexDesign;
  var chamber = window.CodexChamber;
  if (!design || design.mode !== 'hybrid' || !chamber || typeof chamber.start !== 'function') return;

  chamber.start({
    mode: 'hybrid',
    home: true,
    casePresentation: false,
    freeAssetsPresentation: false,
    stableMotion: true
  });
})();
