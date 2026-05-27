import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { OrbitControls } from './three/OrbitControls.js';

const PRESETS = {
  studio: {
    ambient: 0.75,
    hemi: 0.72,
    key: 2.25,
    fill: 0.7,
    rim: 0.55,
    color: 0xffffff
  },
  outdoor: {
    ambient: 0.95,
    hemi: 1.0,
    key: 2.55,
    fill: 0.85,
    rim: 0.65,
    color: 0xf8fbff
  },
  dark: {
    ambient: 0.42,
    hemi: 0.45,
    key: 1.65,
    fill: 0.42,
    rim: 0.95,
    color: 0xe8efff
  }
};

export function canUseCodexThreeViewer() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true
  });

  if (!gl) return false;
  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) loseContext.loseContext();
  return true;
}

export function createCodexThreeViewer(options) {
  const host = options.host;
  const src = options.src;
  const alt = options.alt || '3D model';
  const autoRotate = options.autoRotate !== false;
  const initialExposure = Number.isFinite(options.exposure) ? options.exposure : 1;
  const initialEnvironment = options.environment || 'studio';

  let disposed = false;
  let ready = false;
  let model = null;
  let frameId = 0;
  let continuous = autoRotate;
  let interactionFrames = 0;
  let resizeObserver = null;
  let initialPosition = null;
  let initialTarget = null;
  let initialZoom = 1;

  const canvas = document.createElement('canvas');
  canvas.className = 'case-3d__three-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', alt);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = initialExposure;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 1.2;
  controls.minDistance = 0.1;
  controls.maxDistance = 100;

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x22242a, 0.72);
  const key = new THREE.DirectionalLight(0xffffff, 2.25);
  const fill = new THREE.DirectionalLight(0xdbe7ff, 0.7);
  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(4, 5, 6);
  fill.position.set(-5, 3, 3);
  rim.position.set(-3, 4, -5);
  scene.add(ambient, hemi, key, fill, rim);

  host.appendChild(canvas);

  function applyEnvironment(name) {
    const preset = PRESETS[name] || PRESETS.studio;
    ambient.intensity = preset.ambient;
    hemi.intensity = preset.hemi;
    key.intensity = preset.key;
    fill.intensity = preset.fill;
    rim.intensity = preset.rim;
    key.color.setHex(preset.color);
  }

  function resize() {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || host.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || host.clientHeight || 1));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender(continuous ? 0 : 1);
  }

  function requestRender(extraFrames) {
    if (disposed) return;
    if (Number.isFinite(extraFrames)) interactionFrames = Math.max(interactionFrames, extraFrames);
    if (!frameId) frameId = window.requestAnimationFrame(frame);
  }

  function renderOnce() {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
  }

  function frame() {
    if (disposed) return;
    frameId = 0;
    renderOnce();
    if (continuous || interactionFrames > 0) {
      if (interactionFrames > 0) interactionFrames -= 1;
      requestRender();
    }
  }

  function fitModel(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 1);
    object.position.sub(center);

    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = Math.max(2.2, (maxDim / (2 * Math.tan(fov / 2))) * 1.35);

    camera.near = Math.max(0.01, distance / 120);
    camera.far = Math.max(100, distance * 120);
    camera.position.set(distance * 0.78, distance * 0.42, distance * 1.02);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(0.05, maxDim * 0.25);
    controls.maxDistance = Math.max(maxDim * 8, distance * 5);
    controls.saveState();

    initialPosition = camera.position.clone();
    initialTarget = controls.target.clone();
    initialZoom = camera.zoom;
  }

  function disposeMaterial(material) {
    Object.keys(material).forEach((keyName) => {
      const value = material[keyName];
      if (value && value.isTexture && typeof value.dispose === 'function') value.dispose();
    });
    material.dispose();
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
        else disposeMaterial(child.material);
      }
    });
  }

  applyEnvironment(initialEnvironment);
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  controls.addEventListener('start', () => requestRender(90));
  controls.addEventListener('change', () => {
    if (!continuous) requestRender(8);
  });
  controls.addEventListener('end', () => {
    if (!continuous) requestRender(24);
  });

  const loader = new GLTFLoader();
  loader.load(
    src,
    (gltf) => {
      if (disposed) return;
      model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!model) {
        if (options.onError) options.onError(new Error('GLB scene is empty'));
        return;
      }

      scene.add(model);
      fitModel(model);
      ready = true;
      if (options.onReady) options.onReady();
      requestRender(continuous ? 0 : 1);
    },
    undefined,
    (error) => {
      if (disposed) return;
      if (options.onError) options.onError(error);
    }
  );

  return {
    canvas,
    isReady() {
      return ready;
    },
    setAutoRotate(value) {
      continuous = !!value;
      controls.autoRotate = continuous;
      if (continuous) {
        requestRender();
      } else {
        interactionFrames = 0;
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }
        renderOnce();
      }
    },
    setExposure(value) {
      const next = Number.parseFloat(value);
      renderer.toneMappingExposure = Number.isFinite(next) ? next : 1;
      requestRender(1);
    },
    setEnvironment(name) {
      applyEnvironment(name);
      requestRender(1);
    },
    resetCamera() {
      if (!initialPosition || !initialTarget) return;
      camera.position.copy(initialPosition);
      camera.zoom = initialZoom;
      camera.updateProjectionMatrix();
      controls.target.copy(initialTarget);
      controls.update();
      requestRender(1);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      controls.dispose();
      if (model) {
        scene.remove(model);
        disposeObject(model);
        model = null;
      }
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
    }
  };
}
