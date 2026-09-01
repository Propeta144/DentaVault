// One-time asset-prep script (run manually with `node`, not part of the app
// build) that produced client/src/assets/models/tooth.glb from a free
// "Teeth by Poly by Google" model (CC-BY — see the thesis paper's asset
// credits). The source file bundles 30 separate tooth meshes as one scene;
// this pulls out a single one (mesh index 0, the plain-white "02___Default"
// material — two of the 30 use a mismatched "_crayfishdiffuse" red
// material, likely a leftover from a remixed community asset, and were
// avoided) and re-derives its orientation from scratch, because the source
// bakes each tooth's original position/rotation directly into its vertex
// coordinates (no node transform) rather than storing them separately —
// meaning whichever tooth got picked still carries the tilt it had at its
// specific spot in the original artist's full dental-arch layout. Using it
// as-is (or naively recentering/rescaling) reproduces that tilt at every
// FDI position it gets stamped at in the app's own arch — the exact "bakit
// naka-tagilid" bug that prompted this rewrite.
//
// The fix is PCA: the tooth's vertex cloud has an obvious dominant axis
// (crown-to-root, the long way) and a clearly thinnest axis
// (facial-lingual, the short way) regardless of how the source scene had it
// rotated — so re-deriving X/Y/Z from the actual point cloud via
// eigendecomposition of the position covariance matrix, then rotating,
// re-centering (on the bounding box, not the vertex mean — an organic
// tooth silhouette is heavier on one end), and rescaling to a 1-unit crown
// height, produces a template that stands upright no matter which of the
// 30 source teeth was picked or how it was originally oriented.
//
// This does NOT need to be re-run for the app to work — tooth.glb is
// already committed. Only re-run it if re-deriving from the source .glb
// (e.g. picking a different mesh index), and update SRC to point at your
// own downloaded copy of "Teeth by Poly by Google" first.

const fs = require('fs')
const path = require('path')

const SRC = process.argv[2] || 'C:/Users/rhonb/Downloads/Teeth by Poly by Google - eNR_DPPP1Hp.glb'
const OUT = path.join(__dirname, '../src/assets/models/tooth.glb')
const MESH_INDEX = 0

const buf = fs.readFileSync(SRC)
let offset = 12
const jsonChunkLength = buf.readUInt32LE(offset)
offset += 8
const json = JSON.parse(buf.toString('utf8', offset, offset + jsonChunkLength))
offset += jsonChunkLength
while (offset % 4 !== 0) offset++
const binChunkLength = buf.readUInt32LE(offset)
offset += 8
const bin = buf.subarray(offset, offset + binChunkLength)

const mesh = json.meshes[MESH_INDEX]
const prim = mesh.primitives[0]

function absoluteRange(accessorIdx, componentSize) {
  const acc = json.accessors[accessorIdx]
  const bv = json.bufferViews[acc.bufferView]
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0)
  return { start, length: acc.count * componentSize, count: acc.count }
}

const posRange = absoluteRange(prim.attributes.POSITION, 12)
const normRange = absoluteRange(prim.attributes.NORMAL, 12)
const uvRange = absoluteRange(prim.attributes.TEXCOORD_0, 8)
const idxRange = absoluteRange(prim.indices, 2)

// Buffer.from() on a small subarray can return a pooled buffer whose
// .buffer is a larger shared ArrayBuffer — must pass byteOffset/length
// explicitly when reinterpreting as Float32Array, or you'll read garbage
// from wherever the pool placed it.
function toFloat32(bytes) {
  const copy = Buffer.from(bytes)
  return new Float32Array(copy.buffer, copy.byteOffset, copy.length / 4)
}

const positions = toFloat32(bin.subarray(posRange.start, posRange.start + posRange.length))
const normals = toFloat32(bin.subarray(normRange.start, normRange.start + normRange.length))
const uvBytes = Buffer.from(bin.subarray(uvRange.start, uvRange.start + uvRange.length))
const idxBytes = Buffer.from(bin.subarray(idxRange.start, idxRange.start + idxRange.length))

const n = posRange.count

// ---- PCA: find the tooth's natural principal axes -------------------------
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

// Classic cyclic Jacobi eigenvalue algorithm for a symmetric 3x3 matrix.
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

const { eigenvalues, eigenvectors } = jacobiEigen(cov)
const order = [0, 1, 2].sort((a, b) => eigenvalues[b] - eigenvalues[a])
// order[0] = largest variance (crown-root, our Y), order[1] = mid (mesial-
// distal width, our X), order[2] = smallest (facial-lingual depth, our Z)
const axisY = eigenvectors[order[0]]
const axisX = eigenvectors[order[1]]
let axisZ = eigenvectors[order[2]]
// Force a right-handed basis (Z = X cross Y) so we don't accidentally
// mirror the geometry — a left-handed rotation would invert every normal.
const cross = [
  axisX[1] * axisY[2] - axisX[2] * axisY[1],
  axisX[2] * axisY[0] - axisX[0] * axisY[2],
  axisX[0] * axisY[1] - axisX[1] * axisY[0],
]
const dot = cross[0] * axisZ[0] + cross[1] * axisZ[1] + cross[2] * axisZ[2]
if (dot < 0) axisZ = axisZ.map((v) => -v)

console.log(
  'eigenvalues (sorted desc):',
  order.map((i) => eigenvalues[i]),
)
console.log('axisX', axisX, 'axisY', axisY, 'axisZ', axisZ)

// Rotation matrix rows = new-basis vectors expressed in old coordinates —
// multiplying a point by this matrix expresses it in the new (aligned)
// basis, i.e. R * p_old = p_new.
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

// Sign convention: put the wider (occlusal/crown-tip) end at +Y. Approx by
// comparing the cross-sectional spread (x/z variance) in the top half vs
// bottom half of the aligned bounding box — crowns flare out, roots taper.
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
    x = -x // keep it a proper rotation (180 deg around Z), not a mirror
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

// Recenter on the bounding box (not the vertex mean) so the shape sits
// predictably within the [-0.5, 0.5]-ish slot the arch layout expects — an
// organic tooth silhouette is heavier on one end than the other, so mean-
// centering left it visibly offset within its own bbox.
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

const posBytes = Buffer.from(finalPos.buffer)
const normBytes = Buffer.from(finalNorm.buffer)
const newBuffers = [posBytes, normBytes, uvBytes, idxBytes]
let cursor = 0
const bufferViews = []
for (const b of newBuffers) {
  bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: b.length })
  cursor += b.length
  while (cursor % 4 !== 0) cursor++
}
const newBin = Buffer.alloc(cursor)
newBuffers.forEach((b, i) => b.copy(newBin, bufferViews[i].byteOffset))

const outJson = {
  asset: { version: '2.0', generator: 'dentavault-extract-single-tooth-v2-pca' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Tooth' }],
  meshes: [
    { name: 'Tooth', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] },
  ],
  materials: [
    {
      name: 'Tooth',
      pbrMetallicRoughness: { baseColorFactor: [0.973, 0.976, 0.98, 1], metallicFactor: 0, roughnessFactor: 0.85 },
    },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: n, type: 'VEC3', min: newMin, max: newMax },
    { bufferView: 1, componentType: 5126, count: n, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: uvRange.count, type: 'VEC2' },
    { bufferView: 3, componentType: 5123, count: idxRange.count, type: 'SCALAR', min: [0], max: [n - 1] },
  ],
  bufferViews: [
    { ...bufferViews[0], target: 34962 },
    { ...bufferViews[1], target: 34962 },
    { ...bufferViews[2], target: 34962 },
    { ...bufferViews[3], target: 34963 },
  ],
  buffers: [{ byteLength: cursor }],
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
console.log('final bbox min', newMin, 'max', newMax, 'flipY', flipY)
