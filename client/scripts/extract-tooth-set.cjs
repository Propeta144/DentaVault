// One-time asset-prep script (run manually with `node`, not part of the app
// build) that produces client/src/assets/models/teeth.glb — 8 distinct
// crown shapes (one per FDI tooth *position*, 1-8: central incisor,
// lateral incisor, canine, 1st premolar, 2nd premolar, 1st molar, 2nd
// molar, 3rd molar), replacing the single stamped-everywhere tooth.glb
// template extract-tooth-model.js originally produced.
//
// Source is the same "Teeth by Poly by Google" (CC-BY) asset — 30 tooth
// meshes bundled in one scene, two of which (mesh index 14, 28) carry a
// mismatched "_crayfishdiffuse" material and turned out on inspection to
// not even be tooth geometry (a stray curved/hook shape) — excluded, same
// as the original script did.
//
// Picking WHICH 8 of the other 28 map to which position: there's no
// metadata in the source (mesh names are just "Box001".."Box031", no
// anatomical labels) and no ground truth to classify against, so this
// uses each mesh's own PCA-aligned bounding-box proportions (computed the
// same way as extract-tooth-model.js — mesial-distal/crown-root/facial-
// lingual axes re-derived from the vertex cloud, not trusted from the
// source scene's arbitrary original orientation) as a proxy: real
// incisors are wide mesiodistally but thin faciolingually (a high
// width/depth ratio), canines are the tallest single-cusp crown, and
// molars trend toward a roughly square cross-section (ratio near 1) and
// are the widest overall. The 8 indices below were picked by sorting all
// 28 candidates by that width/depth ratio (3.60 down to 0.84) and taking
// a spread across it — a reasonable stand-in for true anatomical
// variety, not a claim of dental-anatomy accuracy (this project's scope
// is "surface-level documentation," not clinical precision — see
// CLAUDE.md's Limitations section).
const fs = require('fs')
const path = require('path')

const SRC = process.argv[2] || 'C:/Users/rhonb/Downloads/Teeth by Poly by Google - eNR_DPPP1Hp.glb'
const OUT = path.join(__dirname, '../src/assets/models/teeth.glb')

// index -> FDI position (1 = central incisor ... 8 = 3rd molar), sorted by
// descending mesial-distal/facial-lingual ratio (see rationale above).
const POSITION_TO_MESH_INDEX = {
  1: 6, // ratio 3.60 — widest/thinnest, most incisor-like
  2: 4, // ratio 3.20
  3: 1, // ratio 2.89, tallest crown (y=93946) — canine-like point
  4: 2, // ratio 2.46
  5: 8, // ratio 2.19
  6: 9, // ratio 1.89
  7: 18, // ratio 1.46
  8: 19, // ratio 0.96 — most square cross-section, widest+tallest — molar-like
}

const buf = fs.readFileSync(SRC)
let offset = 12
const jsonChunkLength = buf.readUInt32LE(offset)
offset += 8
const srcJson = JSON.parse(buf.toString('utf8', offset, offset + jsonChunkLength))
offset += jsonChunkLength
while (offset % 4 !== 0) offset++
const binChunkLength = buf.readUInt32LE(offset)
offset += 8
const srcBin = buf.subarray(offset, offset + binChunkLength)

function absoluteRange(accessorIdx, componentSize) {
  const acc = srcJson.accessors[accessorIdx]
  const bv = srcJson.bufferViews[acc.bufferView]
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0)
  return { start, length: acc.count * componentSize, count: acc.count }
}

function toFloat32(bytes) {
  const copy = Buffer.from(bytes)
  return new Float32Array(copy.buffer, copy.byteOffset, copy.length / 4)
}

function jacobiEigen(m) {
  let a = m.map((row) => row.slice())
  let v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2])
    if (off < 1e-9) break
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      if (Math.abs(a[p][q]) < 1e-12) continue
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
      const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)) || 1
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      const app = a[p][p],
        aqq = a[q][q],
        apq = a[p][q]
      a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq
      a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq
      a[p][q] = 0
      a[q][p] = 0
      for (let k = 0; k < 3; k++) {
        if (k !== p && k !== q) {
          const akp = a[k][p],
            akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[p][k] = a[k][p]
          a[k][q] = s * akp + c * akq
          a[q][k] = a[k][q]
        }
        const vkp = v[k][p],
          vkq = v[k][q]
        v[k][p] = c * vkp - s * vkq
        v[k][q] = s * vkp + c * vkq
      }
    }
  }
  const eigenvalues = [a[0][0], a[1][1], a[2][2]]
  const eigenvectors = [
    [v[0][0], v[1][0], v[2][0]],
    [v[0][1], v[1][1], v[2][1]],
    [v[0][2], v[1][2], v[2][2]],
  ]
  return { eigenvalues, eigenvectors }
}

// Classifies a PCA-aligned point into one of 5 regions — same logic as
// Tooth3D.jsx's classifySurface (y > 0.32 = occlusal, otherwise whichever of
// mesial-distal/facial-lingual the point sits proportionally further out
// on), duplicated here rather than imported because this is a plain Node
// script and that file is an ES module React component. Keep the two in
// sync if the thresholds ever change. Uses posX/negX instead of mesial/
// distal on purpose: this runs once per *geometry* (shared across all 4
// quadrants a tooth position appears in), and which physical side is
// mesial vs distal depends on which quadrant a given instance is placed
// in at runtime (see mesialOnPositiveX in Odontogram3D.jsx) — the geometry
// itself only knows "+X side" vs "-X side".
function regionForPoint(x, y, z, ext) {
  if (y > 0.32) return 'occlusal'
  const xFrac = Math.abs(x) / ext.x
  const zFrac = Math.abs(z) / ext.z
  if (xFrac > zFrac) return x > 0 ? 'posX' : 'negX'
  return z > 0 ? 'facial' : 'lingual'
}

// Non-overlapping UV atlas: 2 columns x 3 rows, one cell per region (6th
// cell unused). Replaces the source model's own UV unwrap entirely — that
// unwrap turned out to overlap facial and lingual onto the same texture
// region (mirrors, presumably to save texture space on a roughly
// symmetric shape), which meant a freehand mark drawn on one side of a
// tooth silently also appeared on the opposite side once painted. Baking
// fresh UVs here, keyed off the same 5-region classification already used
// for chart bookkeeping, guarantees each region is a distinct texture
// island.
const UV_PAD = 0.04
const UV_CELLS = {
  occlusal: [0, 2 / 3, 1, 1],
  facial: [0, 1 / 3, 0.5, 2 / 3],
  lingual: [0.5, 1 / 3, 1, 2 / 3],
  posX: [0, 0, 0.5, 1 / 3],
  negX: [0.5, 0, 1, 1 / 3],
}

function computeUV(x, y, z, ext) {
  const region = regionForPoint(x, y, z, ext)
  const [u0, v0, u1, v1] = UV_CELLS[region]
  const uw = u1 - u0
  const vh = v1 - v0
  // Which two axes get projected depends on which one is "dominant" (the
  // one regionForPoint used to pick this cell) — the other two vary within
  // the cell.
  let a, aMax, b, bMax
  if (region === 'occlusal') {
    a = x
    aMax = ext.x
    b = z
    bMax = ext.z
  } else if (region === 'facial' || region === 'lingual') {
    a = x
    aMax = ext.x
    b = y
    bMax = 0.5
  } else {
    a = z
    aMax = ext.z
    b = y
    bMax = 0.5
  }
  const au = Math.min(1, Math.max(0, 0.5 + 0.5 * (a / aMax)))
  const bv = Math.min(1, Math.max(0, 0.5 + 0.5 * (b / bMax)))
  const u = u0 + UV_PAD * uw + au * (uw - 2 * UV_PAD * uw)
  const v = v0 + UV_PAD * vh + bv * (vh - 2 * UV_PAD * vh)
  return [u, v]
}

// Extracts + PCA-aligns + recenters + rescales one source mesh, returning
// { positions, normals, uvs, indices } as typed arrays ready to embed.
function extractTooth(meshIndex) {
  const mesh = srcJson.meshes[meshIndex]
  const prim = mesh.primitives[0]

  const posRange = absoluteRange(prim.attributes.POSITION, 12)
  const normRange = absoluteRange(prim.attributes.NORMAL, 12)
  const idxRange = absoluteRange(prim.indices, 2)

  const positions = toFloat32(srcBin.subarray(posRange.start, posRange.start + posRange.length))
  const normals = toFloat32(srcBin.subarray(normRange.start, normRange.start + normRange.length))
  const idxBytes = Buffer.from(srcBin.subarray(idxRange.start, idxRange.start + idxRange.length))

  const n = posRange.count

  let cx = 0,
    cy = 0,
    cz = 0
  for (let i = 0; i < n; i++) {
    cx += positions[i * 3]
    cy += positions[i * 3 + 1]
    cz += positions[i * 3 + 2]
  }
  cx /= n
  cy /= n
  cz /= n

  let cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3] - cx
    const y = positions[i * 3 + 1] - cy
    const z = positions[i * 3 + 2] - cz
    cov[0][0] += x * x
    cov[1][1] += y * y
    cov[2][2] += z * z
    cov[0][1] += x * y
    cov[0][2] += x * z
    cov[1][2] += y * z
  }
  cov[1][0] = cov[0][1]
  cov[2][0] = cov[0][2]
  cov[2][1] = cov[1][2]
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a][b] /= n

  const { eigenvalues, eigenvectors } = jacobiEigen(cov)
  const order = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a])
  const axisY = eigenvectors[order[0]]
  const axisX = eigenvectors[order[1]]
  let axisZ = eigenvectors[order[2]]
  const cross = [
    axisX[1] * axisY[2] - axisX[2] * axisY[1],
    axisX[2] * axisY[0] - axisX[0] * axisY[2],
    axisX[0] * axisY[1] - axisX[1] * axisY[0],
  ]
  const dot = cross[0] * axisZ[0] + cross[1] * axisZ[1] + cross[2] * axisZ[2]
  if (dot < 0) axisZ = axisZ.map((v) => -v)

  const R = [axisX, axisY, axisZ]
  function applyR(vx, vy, vz) {
    return [
      R[0][0] * vx + R[0][1] * vy + R[0][2] * vz,
      R[1][0] * vx + R[1][1] * vy + R[1][2] * vz,
      R[2][0] * vx + R[2][1] * vy + R[2][2] * vz,
    ]
  }

  const alignedPos = new Float32Array(n * 3)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < n; i++) {
    const [x, y, z] = applyR(positions[i * 3] - cx, positions[i * 3 + 1] - cy, positions[i * 3 + 2] - cz)
    alignedPos[i * 3] = x
    alignedPos[i * 3 + 1] = y
    alignedPos[i * 3 + 2] = z
    if (x < min[0]) min[0] = x
    if (y < min[1]) min[1] = y
    if (z < min[2]) min[2] = z
    if (x > max[0]) max[0] = x
    if (y > max[1]) max[1] = y
    if (z > max[2]) max[2] = z
  }

  let topSpread = 0,
    topCount = 0,
    bottomSpread = 0,
    bottomCount = 0
  const midY = (min[1] + max[1]) / 2
  for (let i = 0; i < n; i++) {
    const x = alignedPos[i * 3],
      y = alignedPos[i * 3 + 1],
      z = alignedPos[i * 3 + 2]
    const r = x * x + z * z
    if (y > midY) {
      topSpread += r
      topCount++
    } else {
      bottomSpread += r
      bottomCount++
    }
  }
  const flipY = bottomSpread / bottomCount > topSpread / topCount

  const scale = 1 / (max[1] - min[1])
  const newMin = [Infinity, Infinity, Infinity]
  const newMax = [-Infinity, -Infinity, -Infinity]
  const finalPos = new Float32Array(n * 3)
  const finalNorm = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    let x = alignedPos[i * 3] * scale
    let y = alignedPos[i * 3 + 1] * scale
    let z = alignedPos[i * 3 + 2] * scale
    if (flipY) {
      y = -y
      x = -x
    }
    finalPos[i * 3] = x
    finalPos[i * 3 + 1] = y
    finalPos[i * 3 + 2] = z
    if (x < newMin[0]) newMin[0] = x
    if (y < newMin[1]) newMin[1] = y
    if (z < newMin[2]) newMin[2] = z
    if (x > newMax[0]) newMax[0] = x
    if (y > newMax[1]) newMax[1] = y
    if (z > newMax[2]) newMax[2] = z

    const [nx0, ny0, nz0] = applyR(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
    let nx = nx0,
      ny = ny0,
      nz = nz0
    if (flipY) {
      ny = -ny
      nx = -nx
    }
    finalNorm[i * 3] = nx
    finalNorm[i * 3 + 1] = ny
    finalNorm[i * 3 + 2] = nz
  }

  const bboxCenter = [0, 1, 2].map((a) => (newMin[a] + newMax[a]) / 2)
  for (let i = 0; i < n; i++) {
    finalPos[i * 3] -= bboxCenter[0]
    finalPos[i * 3 + 1] -= bboxCenter[1]
    finalPos[i * 3 + 2] -= bboxCenter[2]
  }
  for (let a = 0; a < 3; a++) {
    newMin[a] -= bboxCenter[a]
    newMax[a] -= bboxCenter[a]
  }

  const ext = {
    x: Math.max(Math.abs(newMin[0]), Math.abs(newMax[0])),
    z: Math.max(Math.abs(newMin[2]), Math.abs(newMax[2])),
  }
  const finalUV = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const [u, v] = computeUV(finalPos[i * 3], finalPos[i * 3 + 1], finalPos[i * 3 + 2], ext)
    finalUV[i * 2] = u
    finalUV[i * 2 + 1] = v
  }
  const uvBytes = Buffer.from(finalUV.buffer, finalUV.byteOffset, finalUV.byteLength)

  return {
    positions: finalPos,
    normals: finalNorm,
    uvBytes,
    idxBytes,
    uvCount: n,
    idxCount: idxRange.count,
    min: newMin,
    max: newMax,
    vertexCount: n,
  }
}

// ---- Assemble one glTF with 8 named nodes/meshes sharing one buffer -------
const buffers = []
const bufferViews = []
const accessors = []
const meshes = []
const nodes = []
let cursor = 0

function pushBuffer(bytes) {
  const start = cursor
  buffers.push(bytes)
  cursor += bytes.length
  while (cursor % 4 !== 0) cursor++
  return start
}

for (let position = 1; position <= 8; position++) {
  const meshIndex = POSITION_TO_MESH_INDEX[position]
  const t = extractTooth(meshIndex)
  console.log(
    `position ${position} <- source mesh ${meshIndex}: bbox min=${t.min.map((v) => v.toFixed(3))} max=${t.max.map((v) => v.toFixed(3))} verts=${t.vertexCount}`,
  )

  const posBytes = Buffer.from(t.positions.buffer, t.positions.byteOffset, t.positions.byteLength)
  const normBytes = Buffer.from(t.normals.buffer, t.normals.byteOffset, t.normals.byteLength)

  const posStart = pushBuffer(posBytes)
  const posViewIdx = bufferViews.length
  bufferViews.push({ buffer: 0, byteOffset: posStart, byteLength: posBytes.length, target: 34962 })

  const normStart = pushBuffer(normBytes)
  const normViewIdx = bufferViews.length
  bufferViews.push({ buffer: 0, byteOffset: normStart, byteLength: normBytes.length, target: 34962 })

  const uvStart = pushBuffer(t.uvBytes)
  const uvViewIdx = bufferViews.length
  bufferViews.push({ buffer: 0, byteOffset: uvStart, byteLength: t.uvBytes.length, target: 34962 })

  const idxStart = pushBuffer(t.idxBytes)
  const idxViewIdx = bufferViews.length
  bufferViews.push({ buffer: 0, byteOffset: idxStart, byteLength: t.idxBytes.length, target: 34963 })

  const posAccIdx = accessors.length
  accessors.push({
    bufferView: posViewIdx,
    componentType: 5126,
    count: t.vertexCount,
    type: 'VEC3',
    min: t.min,
    max: t.max,
  })
  const normAccIdx = accessors.length
  accessors.push({ bufferView: normViewIdx, componentType: 5126, count: t.vertexCount, type: 'VEC3' })
  const uvAccIdx = accessors.length
  accessors.push({ bufferView: uvViewIdx, componentType: 5126, count: t.uvCount, type: 'VEC2' })
  const idxAccIdx = accessors.length
  accessors.push({
    bufferView: idxViewIdx,
    componentType: 5123,
    count: t.idxCount,
    type: 'SCALAR',
    min: [0],
    max: [t.vertexCount - 1],
  })

  const meshIdx = meshes.length
  meshes.push({
    name: `Tooth${position}`,
    primitives: [
      { attributes: { POSITION: posAccIdx, NORMAL: normAccIdx, TEXCOORD_0: uvAccIdx }, indices: idxAccIdx, material: 0 },
    ],
  })
  nodes.push({ mesh: meshIdx, name: `Tooth${position}` })
}

const outJson = {
  asset: { version: '2.0', generator: 'dentavault-extract-tooth-set-v1' },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials: [
    {
      name: 'Tooth',
      pbrMetallicRoughness: { baseColorFactor: [0.973, 0.976, 0.98, 1], metallicFactor: 0, roughnessFactor: 0.85 },
    },
  ],
  accessors,
  bufferViews,
  buffers: [{ byteLength: cursor }],
}

const newBin = Buffer.alloc(cursor)
let writeOffset = 0
for (const b of buffers) {
  b.copy(newBin, writeOffset)
  writeOffset += b.length
  while (writeOffset % 4 !== 0) writeOffset++
}

let outJsonStr = JSON.stringify(outJson)
while (outJsonStr.length % 4 !== 0) outJsonStr += ' '
const outJsonBuf = Buffer.from(outJsonStr, 'utf8')

const header = Buffer.alloc(12)
header.write('glTF', 0, 'ascii')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + outJsonBuf.length + 8 + newBin.length, 8)

const jsonChunkHeader = Buffer.alloc(8)
jsonChunkHeader.writeUInt32LE(outJsonBuf.length, 0)
jsonChunkHeader.write('JSON', 4, 'ascii')

const binChunkHeader = Buffer.alloc(8)
binChunkHeader.writeUInt32LE(newBin.length, 0)
binChunkHeader.write('BIN\0', 4, 'ascii')

fs.writeFileSync(OUT, Buffer.concat([header, jsonChunkHeader, outJsonBuf, binChunkHeader, newBin]))
console.log('wrote', OUT)
