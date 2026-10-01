// One-time asset-prep script (manual na pinapatakbo gamit ang `node`, hindi
// kasama sa build) — gumagawa ng client/src/assets/models/teeth.glb at
// teethExtents.json mula sa 16 na GLB ng "DentaVault procedural tooth
// generator" (generate_teeth.py, tingnan ang teeth-source/README.md):
//   tooth1..8  = upper (maxillary):  central incisor → 3rd molar
//   tooth9..16 = lower (mandibular): central incisor → 3rd molar
// Pinalitan nito ang extract-tooth-set.cjs (8 crown mula sa "Teeth by Poly
// by Google", ~236 triangles bawat isa, iisang hugis sa itaas at ibaba).
//
// Iba sa lumang script: TAMA na ang orientation ng source (+Y = kagat,
// +Z = facial, +X = mesial), kaya WALANG PCA rotation (maiikot nang mali ang
// molars sa PCA, dahil hindi ang taas ang pinakamahabang axis nila).
//
// Ginagawa:
// 1. I-center ang bounding box ng bawat ngipin.
// 2. IISANG scale para sa lahat (taas ng upper central incisor = 1), para
//    manatili ang totoong proporsyon — ang molar ay mas maikli at mas malapad
//    kaysa incisor, gaya ng totoo. (Kapag pantay ang taas ng lahat, sobrang
//    lalaki ng molars at nagpapatong sa katabi.)
// 3. UV atlas na isang cell bawat surface (para sa freehand drawing at sa
//    kulay ng condition). Hinahati (unweld) ang vertex sa border ng dalawang
//    surface, para hindi mabanat ang drawing sa pagitan ng dalawang cell.
// 4. Compressed na format (KHR_mesh_quantization): normals = int8, UV =
//    uint16 — mula ~2.8 MB pababa. Walang vertex colors (hindi ginagamit).
// 5. Isinusulat ang sukat ng bawat ngipin sa teethExtents.json — binabasa ng
//    Tooth3D (surface classification) at Odontogram3D (pagitan sa arch).
//
// Usage: node scripts/prep-procedural-teeth.cjs <folder na may tooth1..16.glb>
const fs = require('fs')
const path = require('path')

const SRC_DIR = process.argv[2]
if (!SRC_DIR) {
  console.error('Usage: node scripts/prep-procedural-teeth.cjs <folder with tooth1..tooth16.glb>')
  process.exit(1)
}
const OUT_GLB = path.join(__dirname, '../src/assets/models/teeth.glb')
const OUT_EXTENTS = path.join(__dirname, '../src/assets/models/teethExtents.json')

// Taas ng upper central incisor sa source (1.05 cm). Lahat ng ngipin ay
// hinahati dito, kaya ang incisor = 1 unit ang taas (±0.5), gaya ng dati.
const COMMON_SCALE = 1 / 1.05

// Ang crown tip zone (occlusal/incisal) = itaas na 18% ng taas ng ngipin
// (y > 0.64 × half-height). KAPAREHO ng Tooth3D.classifySurface — dati
// absolute na `y > 0.32` (para sa ±0.5 na taas), ngayon relative dahil iba-
// iba na ang taas ng bawat ngipin.
const OCCLUSAL_FRACTION = 0.64

const COMPONENT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

function readGlb(file) {
  const buf = fs.readFileSync(file)
  const jsonLen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString())
  const bin = buf.slice(20 + jsonLen + 8)
  const read = (i) => {
    const a = json.accessors[i]
    const v = json.bufferViews[a.bufferView]
    const T = COMPONENT[a.componentType]
    const n = a.count * SIZE[a.type]
    const off = (v.byteOffset || 0) + (a.byteOffset || 0)
    const copy = Buffer.from(bin.slice(off, off + n * T.BYTES_PER_ELEMENT))
    return new T(copy.buffer, copy.byteOffset, n)
  }
  const prim = json.meshes[0].primitives[0]
  return {
    name: json.nodes?.[0]?.name,
    positions: read(prim.attributes.POSITION),
    normals: read(prim.attributes.NORMAL),
    indices: read(prim.indices),
  }
}

// posX/negX dito (hindi mesial/distal): ang geometry ay +X = mesial, pero
// mina-mirror ito sa runtime sa kalahati ng bibig (tingnan ang Tooth3D).
//
// Occlusal = ang dulo ng crown (y > 64% ng half-height) O ang mga bahaging
// NAKAHARAP sa kagat (face normal pataas) sa itaas na 70% ng ngipin. Kapag
// taas lang ang batayan, ang central fossa ng molar (mas mababa sa mga
// cusp) ay napupunta sa gilid na surface, kaya matulis na tagpi lang sa
// dulo ng cusp ang occlusal kapag kinulayan. Ang runtime classification ng
// drawing ay batay sa UV cell (tingnan ang Tooth3D.surfaceForUV), kaya laging
// tugma ito rito.
function regionForTriangle(x, y, z, normalY, ext) {
  if (y > OCCLUSAL_FRACTION * ext.y) return 'occlusal'
  if (normalY > 0.55 && y > -0.4 * ext.y) return 'occlusal'
  const xFrac = Math.abs(x) / ext.x
  const zFrac = Math.abs(z) / ext.z
  if (xFrac > zFrac) return x > 0 ? 'posX' : 'negX'
  return z > 0 ? 'facial' : 'lingual'
}

// Parehong layout ng lumang atlas (2 columns × 3 rows), kaya ang mga lumang
// naka-save na drawing (stroke_data, UV coordinates) ay lumalabas pa rin sa
// tamang surface. KAPAREHO ng UV_CELLS sa Tooth3D.jsx.
const UV_PAD = 0.04
const UV_CELLS = {
  occlusal: [0, 2 / 3, 1, 1],
  facial: [0, 1 / 3, 0.5, 2 / 3],
  lingual: [0.5, 1 / 3, 1, 2 / 3],
  posX: [0, 0, 0.5, 1 / 3],
  negX: [0.5, 0, 1, 1 / 3],
}

function uvInRegion(region, x, y, z, ext) {
  const [u0, v0, u1, v1] = UV_CELLS[region]
  const uw = u1 - u0
  const vh = v1 - v0
  let a, aMax, b, bMax
  if (region === 'occlusal') [a, aMax, b, bMax] = [x, ext.x, z, ext.z]
  else if (region === 'facial' || region === 'lingual') [a, aMax, b, bMax] = [x, ext.x, y, ext.y]
  else [a, aMax, b, bMax] = [z, ext.z, y, ext.y]
  const au = Math.min(1, Math.max(0, 0.5 + 0.5 * (a / aMax)))
  const bv = Math.min(1, Math.max(0, 0.5 + 0.5 * (b / bMax)))
  return [u0 + UV_PAD * uw + au * (uw - 2 * UV_PAD * uw), v0 + UV_PAD * vh + bv * (vh - 2 * UV_PAD * vh)]
}

function prepare(src) {
  const n = src.positions.length / 3
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < n; i++)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], src.positions[i * 3 + a])
      max[a] = Math.max(max[a], src.positions[i * 3 + a])
    }
  const center = [0, 1, 2].map((a) => (min[a] + max[a]) / 2)
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] = (src.positions[i * 3 + a] - center[a]) * COMMON_SCALE
  const ext = {
    x: ((max[0] - min[0]) / 2) * COMMON_SCALE,
    y: ((max[1] - min[1]) / 2) * COMMON_SCALE,
    z: ((max[2] - min[2]) / 2) * COMMON_SCALE,
  }

  const out = { pos: [], norm: [], uv: [], idx: [] }
  const remap = new Map()
  for (let t = 0; t < src.indices.length; t += 3) {
    const tri = [src.indices[t], src.indices[t + 1], src.indices[t + 2]]
    const c = [0, 1, 2].map((a) => (pos[tri[0] * 3 + a] + pos[tri[1] * 3 + a] + pos[tri[2] * 3 + a]) / 3)
    // Face normal (cross product ng dalawang gilid ng triangle)
    const p = tri.map((v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]])
    const e1 = [0, 1, 2].map((a) => p[1][a] - p[0][a])
    const e2 = [0, 1, 2].map((a) => p[2][a] - p[0][a])
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const len = Math.hypot(...nrm) || 1
    const region = regionForTriangle(c[0], c[1], c[2], nrm[1] / len, ext)
    for (const v of tri) {
      const key = `${v}|${region}`
      if (!remap.has(key)) {
        remap.set(key, out.pos.length / 3)
        const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]
        out.pos.push(x, y, z)
        out.norm.push(src.normals[v * 3], src.normals[v * 3 + 1], src.normals[v * 3 + 2])
        out.uv.push(...uvInRegion(region, x, y, z, ext))
      }
      out.idx.push(remap.get(key))
    }
  }
  return { ...out, ext }
}

// ---- GLB writer ----
const chunks = []
const bufferViews = []
const accessors = []
let cursor = 0
function addView(bytes, target, byteStride) {
  const start = cursor
  chunks.push(bytes)
  cursor += bytes.length
  const pad = (4 - (cursor % 4)) % 4
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    cursor += pad
  }
  bufferViews.push({ buffer: 0, byteOffset: start, byteLength: bytes.length, target, ...(byteStride ? { byteStride } : {}) })
  return bufferViews.length - 1
}
function addAccessor(view, componentType, count, type, extra = {}) {
  accessors.push({ bufferView: view, componentType, count, type, ...extra })
  return accessors.length - 1
}

const meshes = []
const nodes = []
const extents = {}
const report = []
for (let file = 1; file <= 16; file++) {
  const src = readGlb(path.join(SRC_DIR, `tooth${file}.glb`))
  const t = prepare(src)
  const upper = file <= 8
  const position = upper ? file : file - 8
  const nodeName = upper ? `Tooth${position}` : `LowerTooth${position}`
  const count = t.pos.length / 3

  // POSITION: float32 (kailangan ng min/max)
  const posArr = new Float32Array(t.pos)
  const pmin = [Infinity, Infinity, Infinity]
  const pmax = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < count; i++)
    for (let a = 0; a < 3; a++) {
      pmin[a] = Math.min(pmin[a], posArr[i * 3 + a])
      pmax[a] = Math.max(pmax[a], posArr[i * 3 + a])
    }
  const POSITION = addAccessor(addView(Buffer.from(posArr.buffer), 34962), 5126, count, 'VEC3', { min: pmin, max: pmax })

  // NORMAL: int8 normalized, stride 4 (KHR_mesh_quantization)
  const normBytes = Buffer.alloc(count * 4)
  for (let i = 0; i < count; i++)
    for (let a = 0; a < 3; a++) normBytes.writeInt8(Math.round(Math.max(-1, Math.min(1, t.norm[i * 3 + a])) * 127), i * 4 + a)
  const NORMAL = addAccessor(addView(normBytes, 34962, 4), 5120, count, 'VEC3', { normalized: true })

  // TEXCOORD_0: uint16 normalized (core glTF)
  const uvArr = new Uint16Array(count * 2)
  for (let i = 0; i < count * 2; i++) uvArr[i] = Math.round(Math.max(0, Math.min(1, t.uv[i])) * 65535)
  const TEXCOORD_0 = addAccessor(addView(Buffer.from(uvArr.buffer), 34962), 5123, count, 'VEC2', { normalized: true })

  const IndexArray = count > 65535 ? Uint32Array : Uint16Array
  const idxArr = new IndexArray(t.idx)
  const indices = addAccessor(addView(Buffer.from(idxArr.buffer), 34963), IndexArray === Uint32Array ? 5125 : 5123, idxArr.length, 'SCALAR')

  meshes.push({ name: nodeName, primitives: [{ attributes: { POSITION, NORMAL, TEXCOORD_0 }, indices, material: 0 }] })
  nodes.push({ name: nodeName, mesh: meshes.length - 1 })
  extents[nodeName] = { x: +t.ext.x.toFixed(4), y: +t.ext.y.toFixed(4), z: +t.ext.z.toFixed(4) }
  report.push({ node: nodeName, source: src.name, ...extents[nodeName], verts: count, tris: idxArr.length / 3 })
}

const json = {
  asset: { version: '2.0', generator: 'DentaVault prep-procedural-teeth.cjs' },
  extensionsUsed: ['KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials: [{ name: 'enamel', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.35 } }],
  accessors,
  bufferViews,
  buffers: [{ byteLength: cursor }],
}
let jsonBuf = Buffer.from(JSON.stringify(json))
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)])
const binBuf = Buffer.concat(chunks)
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8)
const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonBuf.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4)
const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binBuf.length, 0)
binHeader.writeUInt32LE(0x004e4942, 4)
fs.writeFileSync(OUT_GLB, Buffer.concat([header, jsonHeader, jsonBuf, binHeader, binBuf]))
fs.writeFileSync(
  OUT_EXTENTS,
  JSON.stringify({ _note: 'Generated by scripts/prep-procedural-teeth.cjs — do not edit by hand.', ...extents }, null, 2) + '\n',
)
console.table(report)
console.log(`wrote ${OUT_GLB} (${Math.round(fs.statSync(OUT_GLB).size / 1024)} KB) and ${path.basename(OUT_EXTENTS)}`)
