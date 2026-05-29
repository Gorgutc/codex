import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { DRACOLoader } from './three/DRACOLoader.js';
import { EXRLoader } from './three/EXRLoader.js';
import { HDRLoader } from './three/HDRLoader.js';
import { KTX2Loader } from './three/KTX2Loader.js';
import { OrbitControls } from './three/OrbitControls.js';
import { MeshoptDecoder } from './three/libs/meshopt_decoder.module.js';

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
    panelRim: 0xffffff,
    shadow: 0.26
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
    panelRim: 0xf3fbff,
    shadow: 0.2
  },
  citrus: {
    ambient: 1.0,
    hemi: 1.05,
    key: 2.35,
    fill: 0.82,
    rim: 0.7,
    color: 0xfffbf0,
    envIntensity: 1.04,
    room: 0x29343a,
    ground: 0x1d2522,
    panelKey: 0xfff5dc,
    panelFill: 0xcde7ff,
    panelRim: 0xffffff,
    shadow: 0.18,
    environmentUrl: './assets/hdr/experimental/citrus-orchard-puresky-4k.hdr',
    environmentFormat: 'hdr'
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
    panelRim: 0xffffff,
    shadow: 0.34
  }
};

const ENVIRONMENT_SIZE = 128;
const MATERIAL_MODES = ['pbr', 'clay', 'xray'];

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
  const initialMaterialMode = sanitizeMaterialMode(options.materialMode);

  let disposed = false;
  let ready = false;
  let model = null;
  let modelMaterialEntries = [];
  let materialMode = initialMaterialMode;
  let modeMaterials = null;
  let contactShadow = null;
  let contactShadowTexture = null;
  let activeEnvironment = initialEnvironment;
  let frameId = 0;
  let continuous = autoRotate;
  let interactionFrames = 0;
  let resizeObserver = null;
  let initialPosition = null;
  let initialTarget = null;
  let initialZoom = 1;
  let environmentTargets = {};
  let environmentPromises = {};
  let environmentRequest = 0;
  let dracoLoader = null;
  let ktx2Loader = null;

  const canvas = document.createElement('canvas');
  canvas.className = 'case-3d__three-canvas';
  canvas.dataset.quality = 'pmrem-contact-shadow-material-modes';
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

  function sanitizeMaterialMode(value) {
    return MATERIAL_MODES.indexOf(value) >= 0 ? value : 'pbr';
  }

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

  function createTextureEnvironmentTarget(name, preset) {
    const loader = preset.environmentFormat === 'exr' ? new EXRLoader() : new HDRLoader();
    if (typeof loader.setDataType === 'function') loader.setDataType(THREE.HalfFloatType);
    return loader.loadAsync(preset.environmentUrl).then((texture) => {
      if (disposed) {
        texture.dispose();
        return null;
      }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const target = pmrem.fromEquirectangular(texture);
      pmrem.dispose();
      texture.dispose();
      return target;
    });
  }

  function requestTextureEnvironmentTarget(name, preset) {
    if (!preset.environmentUrl) return null;
    if (!environmentPromises[name]) {
      environmentPromises[name] = createTextureEnvironmentTarget(name, preset)
        .then((target) => {
          if (!target) return null;
          const previousTarget = environmentTargets[name];
          environmentTargets[name] = target;
          if (previousTarget && previousTarget !== target) previousTarget.dispose();
          return target;
        })
        .catch((error) => {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[CodexThreeViewer] Environment map failed:', preset.environmentUrl, error);
          }
          return null;
        });
    }
    return environmentPromises[name];
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

  function createContactShadowTexture() {
    const size = 192;
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = size;
    shadowCanvas.height = size;
    const ctx = shadowCanvas.getContext('2d');
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.68)');
    gradient.addColorStop(0.48, 'rgba(0, 0, 0, 0.28)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(shadowCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function ensureContactShadow() {
    if (contactShadow) return contactShadow;
    contactShadowTexture = createContactShadowTexture();
    if (!contactShadowTexture) return null;
    const material = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      color: 0x000000,
      transparent: true,
      opacity: (PRESETS[activeEnvironment] || PRESETS.studio).shadow,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    contactShadow.name = 'Codex contact shadow';
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.renderOrder = -1;
    contactShadow.visible = false;
    scene.add(contactShadow);
    return contactShadow;
  }

  function updateContactShadow(size, maxDim) {
    const shadow = ensureContactShadow();
    if (!shadow) return;
    shadow.position.set(0, -size.y / 2 - Math.max(maxDim * 0.012, 0.006), 0);
    shadow.scale.set(
      Math.max(maxDim * 1.16, size.x * 1.45, 0.9),
      Math.max(maxDim * 0.72, size.z * 1.4, 0.55),
      1
    );
    shadow.visible = true;
  }

  function disposeContactShadow() {
    if (!contactShadow) return;
    scene.remove(contactShadow);
    if (contactShadow.geometry) contactShadow.geometry.dispose();
    if (contactShadow.material) contactShadow.material.dispose();
    if (contactShadowTexture) contactShadowTexture.dispose();
    contactShadow = null;
    contactShadowTexture = null;
  }

  function createModeMaterials() {
    return {
      clay: new THREE.MeshStandardMaterial({
        name: 'Codex clay inspection',
        color: 0xb8b2a7,
        roughness: 0.9,
        metalness: 0.02
      }),
      xray: new THREE.MeshPhysicalMaterial({
        name: 'Codex xray inspection',
        color: 0x8fd7ff,
        roughness: 0.18,
        metalness: 0,
        transmission: 0,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    };
  }

  function disposeModeMaterials() {
    if (!modeMaterials) return;
    Object.keys(modeMaterials).forEach((keyName) => {
      modeMaterials[keyName].dispose();
    });
    modeMaterials = null;
  }

  function registerOriginalMaterials() {
    modelMaterialEntries = [];
    if (!model) return;
    model.traverse((child) => {
      if (!child.isMesh) return;
      modelMaterialEntries.push({
        mesh: child,
        material: child.material
      });
    });
  }

  function restoreOriginalMaterials() {
    modelMaterialEntries.forEach((entry) => {
      entry.mesh.material = entry.material;
      entry.mesh.renderOrder = 0;
    });
  }

  function applyMaterialMode(value) {
    materialMode = sanitizeMaterialMode(value);
    if (!model || !modelMaterialEntries.length) return;
    if (materialMode === 'pbr') {
      restoreOriginalMaterials();
      tuneModelMaterials(PRESETS[activeEnvironment] || PRESETS.studio);
      return;
    }
    if (!modeMaterials) modeMaterials = createModeMaterials();
    const material = modeMaterials[materialMode] || modeMaterials.clay;
    modelMaterialEntries.forEach((entry) => {
      entry.mesh.material = material;
      entry.mesh.renderOrder = materialMode === 'xray' ? 2 : 0;
    });
    tuneMaterial(material, PRESETS[activeEnvironment] || PRESETS.studio);
  }

  function applyEnvironment(name) {
    const resolvedName = PRESETS[name] ? name : 'studio';
    const preset = PRESETS[resolvedName] || PRESETS.studio;
    activeEnvironment = resolvedName;
    ambient.intensity = preset.ambient;
    hemi.intensity = preset.hemi;
    key.intensity = preset.key;
    fill.intensity = preset.fill;
    rim.intensity = preset.rim;
    key.color.setHex(preset.color);
    scene.environment = getEnvironmentTarget(resolvedName).texture;
    scene.environmentIntensity = preset.envIntensity;
    tuneModelMaterials(preset);
    if (contactShadow && contactShadow.material) contactShadow.material.opacity = preset.shadow;
    const requestId = ++environmentRequest;
    const textureTarget = requestTextureEnvironmentTarget(resolvedName, preset);
    if (textureTarget) {
      textureTarget.then((target) => {
        if (!target || disposed || requestId !== environmentRequest || activeEnvironment !== resolvedName) return;
        scene.environment = target.texture;
        tuneModelMaterials(preset);
        requestRender(2);
      });
    }
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
    updateContactShadow(size, maxDim);

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
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(new URL('./three/libs/draco/gltf/', import.meta.url).href);
  loader.setDRACOLoader(dracoLoader);
  ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(new URL('./three/libs/basis/', import.meta.url).href);
  ktx2Loader.detectSupport(renderer);
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);
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
      registerOriginalMaterials();
      tuneModelMaterials(PRESETS[initialEnvironment] || PRESETS.studio);
      applyMaterialMode(materialMode);
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
    setMaterialMode(value) {
      applyMaterialMode(value);
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
        restoreOriginalMaterials();
        scene.remove(model);
        disposeObject(model);
        model = null;
        modelMaterialEntries = [];
      }
      disposeModeMaterials();
      disposeContactShadow();
      Object.keys(environmentTargets).forEach((name) => {
        environmentTargets[name].dispose();
      });
      environmentTargets = {};
      environmentPromises = {};
      if (dracoLoader) {
        dracoLoader.dispose();
        dracoLoader = null;
      }
      if (ktx2Loader) {
        ktx2Loader.dispose();
        ktx2Loader = null;
      }
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (_) {}
      canvas.remove();
    }
  };
}
