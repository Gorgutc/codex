/**
 * Case3D runtime — lazy-loads @google/model-viewer on first 3D-tab
 * activation, wires the full control bar: auto-rotate · model-info ·
 * reset ↻ · fullscreen [ ] · env-switcher (desktop + light-dropdown
 * fallback for ≤1023px) · exposure slider (kept in sync between the
 * desktop range input and the light-dd mobile twin).
 *
 * @google/model-viewer is bundled via Vite (not a CDN) because the
 * studio's network policy blocks jsdelivr / cdn.fontshare. The dynamic
 * import means the chunk is fetched only when a user opens the 3D tab,
 * preserving the 2D-default LCP budget.
 *
 * Cleanup: View Transitions destroy the case-view DOM between work
 * pages, so most state resets naturally. Document-level listeners (the
 * light-dd outside-click / Escape closers) are tagged per-binding so
 * astro:before-swap can detach them before the next page-load init.
 */

let mvPromise: Promise<unknown> | null = null;

export function ensureModelViewer(): Promise<unknown> {
  if (mvPromise) return mvPromise;
  mvPromise = import('@google/model-viewer').catch((err) => {
    console.warn('[case-3d] model-viewer load failed', err);
    mvPromise = null;
    throw err;
  });
  return mvPromise;
}

type EnvKey = 'studio' | 'outdoor' | 'dark';
const ENV_PRESETS: Record<EnvKey, string> = {
  studio: '/hdr/studio.hdr',
  outdoor: '/hdr/outdoor.hdr',
  dark: '/hdr/dark.hdr',
};

// Per-page listeners we register on `document` for the light-dd closers.
// astro:before-swap removes them so we never leak handlers across cases.
let lightDdDocClick: ((e: MouseEvent) => void) | null = null;
let lightDdDocKey: ((e: KeyboardEvent) => void) | null = null;

interface ModelViewerEl extends HTMLElement {
  exposure?: number;
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: number | string;
  loaded?: boolean;
  modelIsVisible?: boolean;
  getCameraOrbit?: () => { toString: () => string };
  getCameraTarget?: () => { toString: () => string };
  getFieldOfView?: () => number;
  resetTurntableRotation?: () => void;
}

function init() {
  const root = document.getElementById('case-3d');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const mv = root.querySelector<ModelViewerEl>('#case-3d-mv');
  const canvas = root.querySelector<HTMLElement>('#case-3d-canvas');

  // Capture the initial camera pose on first load so RESET has a target
  // to interpolate back to. model-viewer fires `load` once the GLB has
  // been parsed and the camera is framed; before that the getters return
  // pre-framing defaults that look wrong post-reset.
  let initialOrbit: string | null = null;
  let initialTarget: string | null = null;
  let initialFov: string | null = null;
  mv?.addEventListener('load', () => {
    if (initialOrbit != null) return;
    try {
      initialOrbit = mv.getCameraOrbit?.().toString() ?? null;
      initialTarget = mv.getCameraTarget?.().toString() ?? null;
      const fov = mv.getFieldOfView?.();
      initialFov = typeof fov === 'number' ? `${fov}deg` : null;
    } catch {
      /* getters not yet available — RESET will fall back to attr removal */
    }
  });

  // ── Auto-rotate toggle ─────────────────────────────────────────────────
  const autoBtn = root.querySelector<HTMLButtonElement>('[data-3d-ctrl="auto-rotate"]');
  autoBtn?.addEventListener('click', () => {
    if (!mv) return;
    const next = !autoBtn.classList.contains('is-on');
    autoBtn.classList.toggle('is-on', next);
    autoBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    if (next) mv.setAttribute('auto-rotate', '');
    else mv.removeAttribute('auto-rotate');
  });

  // ── Environment switcher — sync both UI sets (desktop env-group + light-dd)
  let currentEnv: EnvKey = 'studio';
  const envBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-3d-env]'),
  );
  function syncEnvUI(key: EnvKey) {
    for (const b of envBtns) {
      const on = b.dataset['3dEnv'] === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  for (const btn of envBtns) {
    btn.addEventListener('click', () => {
      const key = btn.dataset['3dEnv'] as EnvKey | undefined;
      if (!key || !mv || key === currentEnv) return;
      currentEnv = key;
      mv.setAttribute('environment-image', ENV_PRESETS[key]);
      syncEnvUI(key);
    });
  }

  // ── Info-panel toggle ─────────────────────────────────────────────────
  const infoBtn = root.querySelector<HTMLButtonElement>('[data-3d-ctrl="info"]');
  const infoPanel = root.querySelector<HTMLElement>('#case-3d-info');
  infoBtn?.addEventListener('click', () => {
    if (!infoPanel) return;
    const next = !infoBtn.classList.contains('is-on');
    infoBtn.classList.toggle('is-on', next);
    infoBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    infoBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
    infoPanel.classList.toggle('is-visible', next);
    infoPanel.setAttribute('aria-hidden', next ? 'false' : 'true');
  });

  // ── RESET — smooth return to initial orbit/target/FOV ─────────────────
  // Ports legacy main.js:2638-2657 (v0.14.0 [3]) — instead of
  // jumpCameraToGoal (instant snap, the cause of the abrupt reset the
  // user flagged), we clear the camera attributes and re-assign the
  // captured initial values as PROPERTIES. model-viewer reads those as
  // a new target pose and interpolates from the current camera state;
  // interpolation-decay="200" on the element (Case3D.astro) tunes the
  // ease-out so the trip lands in ~600-900ms, matching the legacy feel.
  const resetBtn = root.querySelector<HTMLButtonElement>('[data-3d-ctrl="reset"]');
  resetBtn?.addEventListener('click', () => {
    if (!mv) return;
    try {
      mv.removeAttribute('camera-orbit');
      mv.removeAttribute('camera-target');
      mv.removeAttribute('field-of-view');
      if (initialOrbit) mv.cameraOrbit = initialOrbit;
      if (initialTarget) mv.cameraTarget = initialTarget;
      if (initialFov) mv.fieldOfView = initialFov;
      mv.resetTurntableRotation?.();
    } catch {
      /* swallow — getters may not be ready on the very first frame */
    }
    resetBtn.classList.add('is-pulse');
    window.setTimeout(() => resetBtn.classList.remove('is-pulse'), 520);
  });

  // ── FULLSCREEN — open the canvas in native fullscreen ─────────────────
  const fsBtn = root.querySelector<HTMLButtonElement>('[data-3d-ctrl="fullscreen"]');
  fsBtn?.addEventListener('click', () => {
    if (!canvas) return;
    type FsCapable = HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const c = canvas as FsCapable;
    const inFs = document.fullscreenElement === canvas;
    if (inFs) {
      document.exitFullscreen?.();
    } else if (canvas.requestFullscreen) {
      canvas.requestFullscreen().catch(() => {});
    } else {
      c.webkitRequestFullscreen?.();
    }
  });

  // ── EXPOSURE — desktop range + mobile light-dd twin stay in sync ───────
  const expoDesktop = root.querySelector<HTMLInputElement>('[data-3d-ctrl="exposure"]');
  const expoMobile = root.querySelector<HTMLInputElement>('[data-3d-ctrl="exposure-mobile"]');
  function applyExposure(value: string, sourceIsDesktop: boolean) {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || !mv) return;
    mv.exposure = n;
    mv.setAttribute('exposure', String(n));
    if (sourceIsDesktop && expoMobile && expoMobile.value !== value) {
      expoMobile.value = value;
    } else if (!sourceIsDesktop && expoDesktop && expoDesktop.value !== value) {
      expoDesktop.value = value;
    }
  }
  expoDesktop?.addEventListener('input', () => applyExposure(expoDesktop.value, true));
  expoMobile?.addEventListener('input', () => applyExposure(expoMobile.value, false));

  // ── LIGHT-DROPDOWN — toggles env+exposure mobile panel ────────────────
  const lightDd = root.querySelector<HTMLElement>('.case-3d__light-dd');
  const lightTrigger = root.querySelector<HTMLButtonElement>(
    '.case-3d__light-dd__trigger',
  );
  const lightPanel = root.querySelector<HTMLElement>('.case-3d__light-dd__panel');

  function closeLightDd() {
    if (!lightDd || lightDd.dataset.open !== 'true') return;
    lightDd.dataset.open = 'false';
    lightTrigger?.setAttribute('aria-expanded', 'false');
    if (lightPanel) lightPanel.hidden = true;
  }
  function openLightDd() {
    if (!lightDd) return;
    lightDd.dataset.open = 'true';
    lightTrigger?.setAttribute('aria-expanded', 'true');
    if (lightPanel) lightPanel.hidden = false;
  }
  lightTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!lightDd) return;
    if (lightDd.dataset.open === 'true') closeLightDd();
    else openLightDd();
  });

  // Document-level closers — outside click + Escape. Stored so before-swap
  // can detach (otherwise stale references to removed lightDd accumulate).
  if (lightDdDocClick) document.removeEventListener('click', lightDdDocClick);
  if (lightDdDocKey) document.removeEventListener('keydown', lightDdDocKey);
  lightDdDocClick = (e) => {
    if (!lightDd || lightDd.dataset.open !== 'true') return;
    if (lightDd.contains(e.target as Node)) return;
    closeLightDd();
  };
  lightDdDocKey = (e) => {
    if (e.key === 'Escape' && lightDd?.dataset.open === 'true') {
      closeLightDd();
      lightTrigger?.focus();
    }
  };
  document.addEventListener('click', lightDdDocClick);
  document.addEventListener('keydown', lightDdDocKey);

  // ── Lazy-load trigger ─────────────────────────────────────────────────
  document.addEventListener('codex:3d-open', onOpen);
  function onOpen() {
    if (!canvas) return;
    ensureModelViewer()
      .then(() => {
        if (!canvas) return;
        canvas.classList.add('is-ready');
        // When the <model-viewer> element was parsed before
        // customElements.define() landed (our case — Astro renders the
        // tag statically, ensureModelViewer() runs only after the user
        // opens the 3D tab), the custom-element upgrade fires but some
        // versions of model-viewer don't kick off the renderer until an
        // attribute change. Nudge it by toggling src on the next frame
        // so the GLB load actually starts.
        if (!mv) return;
        // Skip the nudge once the GLB has actually downloaded — toggling
        // src on a loaded model would force an unnecessary reload.
        if (mv.loaded) return;
        const src = mv.getAttribute('src');
        if (!src) return;
        requestAnimationFrame(() => {
          if (mv.loaded) return;
          mv.removeAttribute('src');
          requestAnimationFrame(() => mv.setAttribute('src', src));
        });
      })
      .catch((err) => {
        console.warn('[case-3d] model-viewer init failed', err);
      });
  }

  if (!root.hidden) onOpen();
}

init();
document.addEventListener('astro:page-load', () => {
  init();
});
document.addEventListener('astro:before-swap', () => {
  if (lightDdDocClick) document.removeEventListener('click', lightDdDocClick);
  if (lightDdDocKey) document.removeEventListener('keydown', lightDdDocKey);
  lightDdDocClick = null;
  lightDdDocKey = null;
});
