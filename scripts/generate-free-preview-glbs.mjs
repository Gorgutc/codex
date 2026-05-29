import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'models', 'free');

const MATERIALS = [
  material('dark gunmetal', [0.09, 0.1, 0.12, 1], 0.88, 0.36),
  material('brushed steel', [0.62, 0.66, 0.68, 1], 0.74, 0.28),
  material('warm brass', [0.95, 0.58, 0.22, 1], 0.55, 0.34),
  material('black polymer', [0.025, 0.028, 0.035, 1], 0.22, 0.55),
  material('cold blue accent', [0.08, 0.42, 0.95, 1], 0.05, 0.22),
  material('ember emissive', [1, 0.22, 0.08, 1], 0.05, 0.18, [1, 0.18, 0.04]),
  material('matte concrete', [0.34, 0.36, 0.34, 1], 0.05, 0.72),
  material('glass prism', [0.45, 0.82, 1, 0.55], 0, 0.08)
];

const MODEL_BUILDERS = {
  'bolt-cluster': buildBoltCluster,
  'terra-base': buildTerraBase,
  'shard-cannon': buildShardCannon(false),
  'wraith-blade': buildWraithBlade(false),
  'echo-shell': buildEchoShell,
  'prism-lab': buildPrismLab,
  'wraith-blade-g': buildWraithBlade(true),
  'shard-cannon-g': buildShardCannon(true)
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [id, build] of Object.entries(MODEL_BUILDERS)) {
  const parts = [];
  build(createKit(parts));
  const glb = writeGlb(parts, `${id} free asset preview`);
  const target = path.join(OUT_DIR, `${id}.glb`);
  fs.writeFileSync(target, glb);
  console.log(`${path.relative(ROOT, target)} ${glb.length} bytes`);
}

function material(name, baseColorFactor, metallicFactor, roughnessFactor, emissiveFactor) {
  const mat = {
    name,
    pbrMetallicRoughness: {
      baseColorFactor,
      metallicFactor,
      roughnessFactor
    }
  };
  if (baseColorFactor[3] < 1) {
    mat.alphaMode = 'BLEND';
    mat.doubleSided = true;
  }
  if (emissiveFactor) mat.emissiveFactor = emissiveFactor;
  return mat;
}

function createKit(parts) {
  return {
    box(center, size, materialIndex = 0, rotation = {}) {
      parts.push(createBox(center, size, materialIndex, rotation));
    },
    cylinder(center, radius, height, materialIndex = 0, options = {}) {
      parts.push(createCylinder(center, radius, radius, height, materialIndex, options));
    },
    cone(center, radius, height, materialIndex = 0, options = {}) {
      parts.push(createCylinder(center, radius, 0, height, materialIndex, options));
    }
  };
}

function buildBoltCluster(kit) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = (col - 1.5) * 0.42;
      const z = (row - 1) * 0.42;
      const lift = ((row + col) % 2) * 0.03;
      kit.cylinder([x, lift + 0.02, z], 0.135, 0.1, 1, { segments: 6 });
      kit.cylinder([x, lift - 0.08, z], 0.065, 0.18, 0, { segments: 16 });
      if ((row + col) % 3 === 0) {
        kit.cylinder([x, lift + 0.09, z], 0.052, 0.035, 2, { segments: 6 });
      }
    }
  }
  kit.box([0, -0.18, 0], [1.78, 0.05, 1.22], 3);
}

function buildTerraBase(kit) {
  for (let z = -1; z <= 1; z++) {
    for (let x = -1; x <= 1; x++) {
      const offset = (x + z) % 2 === 0 ? 0 : 0.04;
      kit.box([x * 0.48, -0.04 + offset, z * 0.48], [0.43, 0.08, 0.43], 6);
      kit.box([x * 0.48, 0.035 + offset, z * 0.48], [0.34, 0.035, 0.34], x === 0 && z === 0 ? 2 : 0);
    }
  }
  kit.cylinder([0, 0.18, 0], 0.16, 0.26, 1, { segments: 24 });
  kit.cylinder([-0.48, 0.12, 0.48], 0.08, 0.18, 1, { segments: 16 });
  kit.cylinder([0.48, 0.12, -0.48], 0.08, 0.18, 1, { segments: 16 });
}

function buildShardCannon(gameVariant) {
  return function build(kit) {
    const accent = gameVariant ? 5 : 4;
    kit.cylinder([0.38, 0.05, 0], 0.11, 1.55, 1, { segments: 24, rotation: { z: Math.PI / 2 } });
    kit.cylinder([1.18, 0.05, 0], 0.17, 0.14, accent, { segments: 24, rotation: { z: Math.PI / 2 } });
    kit.box([-0.34, 0.03, 0], [0.72, 0.34, 0.34], 0);
    kit.box([-0.52, -0.18, 0], [0.3, 0.34, 0.18], 3, { z: -0.18 });
    kit.box([0.12, 0.26, 0], [0.64, 0.08, 0.22], accent);
    kit.box([0.18, -0.12, 0.27], [0.78, 0.08, 0.08], 1, { x: 0.12 });
    kit.box([0.18, -0.12, -0.27], [0.78, 0.08, 0.08], 1, { x: -0.12 });
    kit.cone([1.34, 0.05, 0], 0.16, 0.22, accent, { segments: 6, rotation: { z: -Math.PI / 2 } });
  };
}

function buildWraithBlade(gameVariant) {
  return function build(kit) {
    const accent = gameVariant ? 5 : 4;
    kit.box([0.18, 0.02, 0], [1.65, 0.08, 0.18], 1);
    kit.box([0.24, 0.055, 0], [1.45, 0.035, 0.06], accent);
    kit.cone([1.14, 0.02, 0], 0.16, 0.34, 1, { segments: 4, rotation: { z: -Math.PI / 2 } });
    kit.cylinder([-0.92, -0.02, 0], 0.075, 0.56, 3, { segments: 18, rotation: { z: Math.PI / 2 } });
    kit.box([-0.56, -0.01, 0], [0.08, 0.36, 0.46], 0);
    kit.box([-1.24, -0.02, 0], [0.16, 0.13, 0.13], accent);
  };
}

function buildEchoShell(kit) {
  kit.box([0, -0.18, 0], [0.74, 0.12, 0.34], 3);
  kit.cylinder([0, 0.08, 0], 0.34, 0.38, 0, { segments: 40 });
  kit.cylinder([0, 0.1, 0], 0.24, 0.42, 1, { segments: 40 });
  kit.cylinder([0, 0.12, 0], 0.13, 0.46, 3, { segments: 40 });
  kit.cylinder([-0.28, 0.34, 0], 0.045, 0.035, 4, { segments: 18 });
  kit.cylinder([0.28, 0.34, 0], 0.045, 0.035, 4, { segments: 18 });
}

function buildPrismLab(kit) {
  kit.box([0, -0.18, 0], [1.35, 0.12, 0.72], 6);
  kit.box([-0.42, -0.05, 0.2], [0.34, 0.18, 0.28], 0);
  kit.box([0.48, 0.02, -0.18], [0.38, 0.34, 0.22], 1);
  kit.cone([0, 0.32, 0], 0.42, 0.62, 7, { segments: 3 });
  kit.cylinder([0, -0.08, 0], 0.2, 0.08, 2, { segments: 3 });
}

function createBox(center, size, materialIndex, rotation = {}) {
  const [sx, sy, sz] = size.map((v) => v / 2);
  const faces = [
    {
      n: [1, 0, 0],
      c: [
        [sx, -sy, -sz],
        [sx, sy, -sz],
        [sx, sy, sz],
        [sx, -sy, sz]
      ]
    },
    {
      n: [-1, 0, 0],
      c: [
        [-sx, -sy, sz],
        [-sx, sy, sz],
        [-sx, sy, -sz],
        [-sx, -sy, -sz]
      ]
    },
    {
      n: [0, 1, 0],
      c: [
        [-sx, sy, -sz],
        [-sx, sy, sz],
        [sx, sy, sz],
        [sx, sy, -sz]
      ]
    },
    {
      n: [0, -1, 0],
      c: [
        [-sx, -sy, sz],
        [-sx, -sy, -sz],
        [sx, -sy, -sz],
        [sx, -sy, sz]
      ]
    },
    {
      n: [0, 0, 1],
      c: [
        [-sx, -sy, sz],
        [sx, -sy, sz],
        [sx, sy, sz],
        [-sx, sy, sz]
      ]
    },
    {
      n: [0, 0, -1],
      c: [
        [sx, -sy, -sz],
        [-sx, -sy, -sz],
        [-sx, sy, -sz],
        [sx, sy, -sz]
      ]
    }
  ];
  const positions = [];
  const normals = [];
  const indices = [];
  for (const face of faces) {
    const base = positions.length / 3;
    for (const corner of face.c) {
      positions.push(...transformPoint(corner, center, rotation));
      normals.push(...normalize(rotatePoint(face.n, rotation)));
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices, materialIndex };
}

function createCylinder(center, bottomRadius, topRadius, height, materialIndex, options = {}) {
  const segments = options.segments || 24;
  const rotation = options.rotation || {};
  const half = height / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const normal = normalize([ca, (bottomRadius - topRadius) / Math.max(height, 0.001), sa]);
    positions.push(...transformPoint([bottomRadius * ca, -half, bottomRadius * sa], center, rotation));
    positions.push(...transformPoint([topRadius * ca, half, topRadius * sa], center, rotation));
    normals.push(...normalize(rotatePoint(normal, rotation)));
    normals.push(...normalize(rotatePoint(normal, rotation)));
  }
  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
  }

  addCap(positions, normals, indices, center, rotation, segments, bottomRadius, -half, [0, -1, 0], true);
  if (topRadius > 0) {
    addCap(positions, normals, indices, center, rotation, segments, topRadius, half, [0, 1, 0], false);
  }

  return { positions, normals, indices, materialIndex };
}

function addCap(positions, normals, indices, center, rotation, segments, radius, y, normal, reverse) {
  const base = positions.length / 3;
  positions.push(...transformPoint([0, y, 0], center, rotation));
  normals.push(...normalize(rotatePoint(normal, rotation)));
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(...transformPoint([radius * Math.cos(angle), y, radius * Math.sin(angle)], center, rotation));
    normals.push(...normalize(rotatePoint(normal, rotation)));
  }
  for (let i = 1; i <= segments; i++) {
    if (reverse) indices.push(base, base + i + 1, base + i);
    else indices.push(base, base + i, base + i + 1);
  }
}

function transformPoint(point, center, rotation) {
  const rotated = rotatePoint(point, rotation);
  return [rotated[0] + center[0], rotated[1] + center[1], rotated[2] + center[2]];
}

function rotatePoint(point, rotation = {}) {
  let [x, y, z] = point;
  if (rotation.x) {
    const c = Math.cos(rotation.x);
    const s = Math.sin(rotation.x);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (rotation.y) {
    const c = Math.cos(rotation.y);
    const s = Math.sin(rotation.y);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (rotation.z) {
    const c = Math.cos(rotation.z);
    const s = Math.sin(rotation.z);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function writeGlb(parts, name) {
  const json = {
    asset: { version: '2.0', generator: 'Codex Studio procedural free preview generator' },
    scene: 0,
    scenes: [{ nodes: parts.map((_, index) => index) }],
    nodes: parts.map((_, index) => ({ mesh: index })),
    meshes: [],
    materials: MATERIALS,
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: []
  };
  const chunks = [];

  parts.forEach((part, index) => {
    const positionAccessor = addTypedView(
      json,
      chunks,
      new Float32Array(part.positions),
      5126,
      'VEC3',
      bounds(part.positions)
    );
    const normalAccessor = addTypedView(json, chunks, new Float32Array(part.normals), 5126, 'VEC3');
    const indexAccessor = addTypedView(json, chunks, new Uint16Array(part.indices), 5123, 'SCALAR');
    json.meshes.push({
      name: `${name} part ${index + 1}`,
      primitives: [
        {
          attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
          indices: indexAccessor,
          material: part.materialIndex
        }
      ]
    });
  });

  const binary = Buffer.concat(chunks);
  json.buffers[0].byteLength = binary.length;
  const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuffer = padBuffer(binary, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + binBuffer.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
}

function addTypedView(json, chunks, typedArray, componentType, type, minMax) {
  const byteLength = typedArray.byteLength;
  const data = padBuffer(Buffer.from(typedArray.buffer), 0);
  const byteOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const bufferView = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset, byteLength });
  chunks.push(data);
  const accessor = {
    bufferView,
    componentType,
    count: type === 'VEC3' ? typedArray.length / 3 : typedArray.length,
    type
  };
  if (minMax) {
    accessor.min = minMax.min;
    accessor.max = minMax.max;
  }
  json.accessors.push(accessor);
  return json.accessors.length - 1;
}

function bounds(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }
  return { min, max };
}

function padBuffer(buffer, padValue) {
  const pad = (4 - (buffer.length % 4)) % 4;
  if (!pad) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(pad, padValue)]);
}
