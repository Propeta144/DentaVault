import { useMemo } from 'react'
import * as THREE from 'three'
import { RETROMOLAR, archFrame, marginAt, thicknessAt } from './archLayout'

// Gums (gingiva) na sumusunod sa mismong arch at sa bawat ngipin — pinalitan
// ang dating simpleng tubo (TubeGeometry) na nakalutang sa itaas/ibaba ng
// ngipin. Parang dental study model (typodont):
// - Scalloped na gilid: kumukurba sa leeg ng bawat ngipin at tumutulis
//   pataas sa pagitan nila (interdental papilla).
// - Facial at lingual na pader na may kaunting umbok (alveolar bone sa
//   ilalim), mas maputla malapit sa ngipin at mas mapula papunta sa itaas.
// - Upper: may palate (ngalangala) para hindi butas ang loob ng arch.
// Ginagawa nang isang beses lang (useMemo) — static ang hugis.

const STEP = 0.015
const MARGIN_COLOR = new THREE.Color('#f2b3b0')
const BASE_COLOR = new THREE.Color('#d47a80')
const PALATE_COLOR = new THREE.Color('#dc9096')

// Cross-section ng gums sa isang punto ng arch, sa (n, a): n = layo palabas
// (facial +, lingual −) mula sa gitna ng arch, a = layo mula sa occlusal
// plane papunta sa ugat. Saradong loop: ang huling punto ay dudugtong sa una
// (ang "sahig" sa pagitan ng facial at lingual na gilid, nakikita lang sa
// puwang sa pagitan ng mga ngipin).
function profile(tz, m, top, closeFactor) {
  const neck = 0.7 * tz * closeFactor
  return [
    [neck, m],
    [tz + 0.07, m + 0.12],
    [tz + 0.15, m + 0.45],
    [tz + 0.17, top - 0.35],
    [tz + 0.12, top],
    [0, top + 0.04],
    [-tz - 0.1, top],
    [-tz - 0.14, top - 0.4],
    [-tz - 0.12, m + 0.4],
    [-tz - 0.06, m + 0.1],
    [-neck, m],
    [0, m + 0.02],
  ]
}

function buildGum(arch) {
  const end = arch.lastEdge + RETROMOLAR
  const count = Math.ceil((2 * end) / STEP) + 1
  const positions = []
  const colors = []
  const indices = []
  let ringSize = 0
  const color = new THREE.Color()

  for (let j = 0; j < count; j++) {
    const s = -end + (2 * end * j) / (count - 1)
    const { point, outward } = archFrame(arch, s)
    const tz = thicknessAt(arch, s)
    const m = marginAt(arch, s)
    // Lampas sa huling molar: nagsasara ang gilid (wala nang ngipin), tapos
    // bilugang dulo (lumiliit ang buong cross-section)
    const t = Math.max(0, (Math.abs(s) - arch.lastEdge) / RETROMOLAR)
    const closeFactor = Math.max(0, 1 - t / 0.35)
    const shrink = t < 0.4 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.6) ** 2))
    const midA = (m + arch.topA) / 2
    const ring = profile(tz, m, arch.topA, closeFactor)
    ringSize = ring.length
    for (const [n0, a0] of ring) {
      const n = n0 * shrink
      const a = midA + (a0 - midA) * shrink
      positions.push(point.x + outward.x * n, arch.sign * a, point.z + outward.z * n)
      const k = THREE.MathUtils.clamp((a - m) / (arch.topA - m), 0, 1)
      color.copy(MARGIN_COLOR).lerp(BASE_COLOR, Math.pow(k, 0.7))
      colors.push(color.r, color.g, color.b)
    }
  }

  for (let j = 0; j < count - 1; j++) {
    for (let k = 0; k < ringSize; k++) {
      const a = j * ringSize + k
      const b = j * ringSize + ((k + 1) % ringSize)
      const c = a + ringSize
      const d = b + ringSize
      if (arch.upper) indices.push(a, c, b, b, c, d)
      else indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Ngalangala: dome mula sa lingual na pader ng kaliwa papuntang kanan,
// mababaw sa harap (rugae area) at mas malalim sa likod
function buildPalate(arch) {
  const across = 16
  const count = Math.ceil(arch.lastEdge / STEP) + 1
  const positions = []
  const colors = []
  const indices = []
  for (let j = 0; j < count; j++) {
    const s = (arch.lastEdge * j) / (count - 1)
    const left = archFrame(arch, -s)
    const right = archFrame(arch, s)
    const nl = -thicknessAt(arch, -s) - 0.14
    const nr = -thicknessAt(arch, s) - 0.14
    const a = arch.topA - 0.4
    const pl = left.point.clone().addScaledVector(left.outward, nl)
    const pr = right.point.clone().addScaledVector(right.outward, nr)
    // Hindi lalampas sa itaas ng gums (para malinis ang front view)
    const depth = 0.36 * THREE.MathUtils.smoothstep(s, 0, 2.2)
    for (let i = 0; i <= across; i++) {
      const t = i / across
      const p = pl.clone().lerp(pr, t)
      const y = arch.sign * (a + depth * Math.pow(Math.sin(Math.PI * t), 0.7))
      positions.push(p.x, y, p.z)
      colors.push(PALATE_COLOR.r, PALATE_COLOR.g, PALATE_COLOR.b)
    }
  }
  const row = across + 1
  for (let j = 0; j < count - 1; j++) {
    for (let i = 0; i < across; i++) {
      const a = j * row + i
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default function Gingiva({ arch }) {
  const gum = useMemo(() => buildGum(arch), [arch])
  const palate = useMemo(() => (arch.upper ? buildPalate(arch) : null), [arch])

  return (
    <group>
      <mesh geometry={gum} receiveShadow>
        {/* Basa at bahagyang makinang, gaya ng totoong gums */}
        <meshPhysicalMaterial vertexColors roughness={0.45} clearcoat={0.3} clearcoatRoughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {palate && (
        <mesh geometry={palate} receiveShadow>
          <meshPhysicalMaterial vertexColors roughness={0.5} clearcoat={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
