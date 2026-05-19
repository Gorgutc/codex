/**
 * Case3D runtime — lazy-loads @google/model-viewer on first 3D-tab
 * activation, wires auto-rotate / env-switcher / info-panel controls.
 *
 * @google/model-viewer is bundled via Vite (not a CDN) because the
 * studio's network policy blocks jsdelivr / cdn.fontshare. The dynamic
 * import means the chunk is fetched only when a user opens the 3D tab,
 * preserving the 2D-default LCP budget.
 *
 * Cleanup: View Transitions destroy the case-view DOM between work
 * pages, so most state resets naturally. We only need to retire any
 * document-level listeners the module installs on init; everything
 * else is rebuilt per page-load.
 */

let mvPromise: Promise<unknown> | null = null;

/**
 * Idempotent loader for the model-viewer custom-element registration.
 * Returns the same promise across all callers within a session.
 */
export function ensureModelViewer(): Promise<unknown> {
  if (mvPromise) return mvPromise;
  // Vite emits a separate chunk; the custom element self-registers on
  // import. Safe to call before first paint of the 3D panel.
  mvPromise = import('@google/model-viewer').catch((err) => {
    console.warn('[case-3d] model-viewer load failed', err);
    mvPromise = null; // allow retry on next click
    throw err;
  });
  return mvPromise;
}

function init() {
  const root = document.getElementById('case-3d');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const mv = root.querySelector<HTMLElement>('#case-3d-mv');
  const canvas = root.querySelector<HTMLElement>('#case-3d-canvas');

  // ── Auto-rotate toggle ────────────────────────────────────────────────────
  const autoBtn = root.querySelector<HTMLButtonElement>(
    '[data-3d-ctrl="auto-rotate"]',
  );
  autoBtn?.addEventListener('click', () => {
    if (!mv) return;
    const next = !autoBtn.classList.contains('is-on');
    autoBtn.classList.toggle('is-on', next);
    autoBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
    if (next) mv.setAttribute('auto-rotate', '');
    else mv.removeAttribute('auto-rotate');
  });

  // ── Environment switcher (Studio / Outdoor / Dark) ────────────────────────
  const envBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-3d-env]'),
  );
  for (const btn of envBtns) {
    btn.addEventListener('click', () => {
      const env = btn.dataset['3dEnv']; // 'studio' | 'outdoor' | 'dark'
      if (!env || !mv) return;
      for (const b of envBtns) {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      mv.setAttribute('environment-image', `/hdr/${env}.hdr`);
    });
  }

  // ── Info-panel toggle ─────────────────────────────────────────────────────
  const infoBtn = root.querySelector<HTMLButtonElement>(
    '[data-3d-ctrl="info"]',
  );
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

  // ── Lazy-load trigger: a CustomEvent dispatched by case-view.ts when the
  //   3D tab is activated.  We could also poll via MutationObserver, but
  //   an explicit event keeps the load deterministic.
  document.addEventListener('codex:3d-open', onOpen);

  function onOpen() {
    if (!canvas) return;
    ensureModelViewer()
      .then(() => {
        canvas.classList.add('is-ready');
      })
      .catch(() => {
        /* surfaced by ensureModelViewer */
      });
  }

  // If the 3D tab is already open at first paint (deep link?), kick the load.
  if (!root.hidden) onOpen();
}

init();
document.addEventListener('astro:page-load', () => {
  init();
});
