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
    color: 0xffffff,
    envIntensity: 0.78,
    room: 0x1d2328,
    ground: 0x14171a,
    panelKey: 0xf6fbff,
    panelFill: 0x9cbfe4,
    panelRim: 0xffffff
  },
  outdoor: {
    ambient: 0.95,
    hemi: 1.0,
    key: 2.55,
    fill: 0.85,
    rim: 0.65,
    color: 0xf8fbff,
    envIntensity: 0.95,
    room: 0x26313a,
    ground: 0x1c2328,
    panelKey: 0xffffff,
    panelFill: 0xb9d6ff,
    panelRim: 0xf3fbff
  },
  dark: {
    ambient: 0.42,
    hemi: 0.45,
    key: 1.65,
    fill: 0.42,
    rim: 0.95,
    color: 0xe8efff,
    envIntensity: 0.58,
    room: 0x111419,
    ground: 0x0b0d10,
    panelKey: 0xbfd7ff,
    panelFill: 0x4d6a8d,
    panelRim: 0xffffff
  }
};

const ENVIRONMENT_SIZE = 128;

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
  let environmentTargets = {};

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
  scene.environmentIntensity = 0.78;
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

  function createBasicMaterial(color, side, strength) {
    const value = new THREE.Color(color);
    value.multiplyScalar(strength || 1);
    return new THREE.MeshBasicMaterial({
      color: value,
      side: side || THREE.FrontSide
    });
  }

  function createEnvironmentTarget(name) {
    const preset = PRESETS[name] || PRESETS.studio;
    const envScene = new THREE.Scene();
    const materials = [];
    const registerMaterial = (material) => {
      materials.push(material);
      return material;
    };

    const room = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      [
        registerMaterial(createBasicMaterial(preset.room, THREE.BackSide, 1.15)),
        registerMaterial(createBasicMaterial(preset.room, THREE.BackSide, 1.15)),
        registerMaterial(createBasicMaterial(preset.room, THREE.BackSide, 1.28)),
        registerMaterial(createBasicMaterial(preset.ground, THREE.BackSide, 1)),
        registerMaterial(createBasicMaterial(preset.room, THREE.BackSide, 1.1)),
        registerMaterial(createBasicMaterial(preset.room, THREE.BackSide, 1.05))
      ]
    );
    envScene.add(room);

    const panelGeometry = new THREE.PlaneGeometry(1, 1);
    function addPanel(color, strength, position, rotation, scale) {
      const material = registerMaterial(createBasicMaterial(color, THREE.DoubleSide, strength));
      const panel = new THREE.Mesh(panelGeometry, material);
      panel.position.set(position[0], position[1], position[2]);
      panel.rotation.set(rotation[0], rotation[1], rotation[2]);
      panel.scale.set(scale[0], scale[1], 1);
      envScene.add(panel);
    }

    addPanel(preset.panelKey, 1.7, [0, 6.8, -2.4], [-Math.PI / 2, 0, 0], [7.5, 3.1]);
    addPanel(preset.panelFill, 1.15, [-6.4, 1.8, 1.2], [0, Math.PI / 2, 0], [3.6, 4.8]);
    addPanel(preset.panelRim, name === 'dark' ? 1.85 : 1.25, [5.8, 2.6, -4.8], [0, -Math.PI / 3, 0], [3.2, 5.2]);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(envScene, 0.04, 0.1, 100, { size: ENVIRONMENT_SIZE });
    pmrem.dispose();
    panelGeometry.dispose();
    room.geometry.dispose();
    materials.forEach((material) => material.dispose());
    return target;
  }

  function getEnvironmentTarget(name) {
    if (!environmentTargets[name]) environmentTargets[name] = createEnvironmentTarget(name);
    return environmentTargets[name];
  }

  function tuneTexture(texture, maxAnisotropy) {
    if (!texture || !maxAnisotropy) return;
    texture.anisotropy = Math.max(texture.anisotropy || 1, maxAnisotropy);
    texture.needsUpdate = true;
  }

  function tuneMaterial(material, preset) {
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 1, 8);
    materials.forEach((item) => {
      if (!item) return;
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((keyName) => {
        tuneTexture(item[keyName], maxAnisotropy);
      });
      if (item.isMeshStandardMaterial || item.isMeshPhysicalMaterial) {
        item.envMapIntensity = preset.envIntensity;
        item.needsUpdate = true;
      }
    });
  }

  function tuneModelMaterials(preset) {
    if (!model) return;
    model.traverse((child) => {
      if (!child.isMesh) return;
      tuneMaterial(child.material, preset);
    });
  }

  function applyEnvironment(name) {
    const preset = PRESETS[name] || PRESETS.studio;
    ambient.intensity = preset.ambient;
    hemi.intensity = preset.hemi;
    key.intensity = preset.key;
    fill.intensity = preset.fill;
    rim.intensity = preset.rim;
    key.color.setHex(preset.color);
    scene.environment = getEnvironmentTarget(name).texture;
    scene.environmentIntensity = preset.envIntensity;
    tuneModelMaterials(preset);
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
      tuneModelMaterials(PRESETS[initialEnvironment] || PRESETS.studio);
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
      Object.keys(environmentTargets).forEach((name) => {
        environmentTargets[name].dispose();
      });
      environmentTargets = {};
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
    }
  };
}
