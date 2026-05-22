/* ═════════════════════════════════════════════════════════════════════════════
   i18n-data.js — Phase 0 skeleton (v0.8.x)
   Словари для переключателя RU/EN. На старте все объекты пустые — реальные
   строки добавятся в Phase 1 (UI), Phase 2 (CARDS), Phase 3 (FA).

   Принцип "никогда не переводить" зафиксирован в архитектуре: технические
   термины (Hard Surface, Product, CAD, Blender, ZBrush, Tris, LOD0, 4K, PBR)
   остаются англицизмами в обеих локалях. CARDS_DATA / FA_DATA хранят такие
   поля сами; CARDS_LOCALES / FA_LOCALES их не перекрывают (нет ключа → нет
   замены при merge).

   Persistence: URL ?lang=ru|en. NO localStorage / sessionStorage / cookies.
   ═════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CIS_COUNTRIES = ['RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'AM', 'AZ', 'MD'];

  const UI_STRINGS = { en: {}, ru: {} };
  const META_STRINGS = { en: { index: {}, fa: {} }, ru: { index: {}, fa: {} } };
  const CARDS_LOCALES = { en: {}, ru: {} };
  const FA_LOCALES = { en: {}, ru: {} };

  window.I18N_DATA = {
    CIS_COUNTRIES: CIS_COUNTRIES.slice(),
    UI_STRINGS: UI_STRINGS,
    META_STRINGS: META_STRINGS,
    CARDS_LOCALES: CARDS_LOCALES,
    FA_LOCALES: FA_LOCALES,
  };
})();
