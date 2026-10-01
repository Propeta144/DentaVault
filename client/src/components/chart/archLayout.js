import * as THREE from 'three'
import { ODONTOGRAM_ROWS } from '../../constants/dental'
import { toothExtents } from './Tooth3D'

// Hugis at pwesto ng totoong dental arch para sa 3D chart (at sa gums).
//
// Dati: bilog na arko (75°), kaya halos 10 cm ang lapad sa likod at mababaw
// ang lalim — parang pamaypay, hindi bibig. Ngayon: OVOID arch batay sa
// karaniwang sukat ng adult (mm, kalahati ng arch, x = lapad mula midline,
// z = lalim mula sa harap ng incisors). Halos tuwid na ang molars sa likod,
// bilugan sa harap — gaya ng totoong panga at ng dental study model.
//
// 1 unit sa scene ≈ 10 mm (lapad ng upper central incisor sa model ≈ 0.81).
const MM = 0.1
const UPPER_ARCH_MM = [
  [0, 0], [4.2, 0.8], [11.5, 3.5], [17, 8], [20.5, 14], [22.5, 20.5],
  [24.5, 29], [26.5, 38.5], [28, 47], [29.5, 56], [30.5, 64],
]
// Mas makitid ang lower sa harap (intercanine ~26 mm vs ~34 mm sa upper)
const LOWER_ARCH_MM = [
  [0, 0], [2.7, 0.5], [8, 2.5], [13, 6], [17, 11.5], [19.5, 18],
  [22, 26.5], [24, 37], [25.5, 46.5], [26.5, 56], [27, 64],
]
// Overjet: nasa likod nang ~2.3 mm ang lower incisors, kaya ang upper ay
// nasa harap at labas ng lower (gaya ng normal na kagat)
const LOWER_Z_OFFSET = 0.23

// Pagitan ng magkatabing ngipin sa kahabaan ng arch
export const TOOTH_GAP = 0.015
// Kalahati ng bukas ng bibig: lahat ng dulo ng crown (incisal edge / cusp)
// ay nasa iisang occlusal plane (y = ±OCCLUSAL_GAP), gaya ng totoo. Bahagyang
// nakabuka para makita at madrawingan pa rin ang biting surfaces.
const OCCLUSAL_GAP = 0.22

// Labial na hilig ng crown (degrees) ayon sa posisyon ng ngipin (1 = central):
// ang incisors ay nakahilig pasulong, ang canine bahagya, ang likod ay tuwid.
const UPPER_TILT_DEG = [14, 11, 7, 2, 0, 0, 0, 0]
const LOWER_TILT_DEG = [9, 8, 5, 1, 0, 0, 0, 0]

// Taas ng papilla (gum sa pagitan ng ngipin), mas mataas sa harap
const PAPILLA = [0.42, 0.36, 0.3, 0.24, 0.22, 0.18, 0.16, 0.14]
// Ilang unit ng crown ang natatakpan ng gilid ng gums sa gitna ng ngipin
const MARGIN_OVERLAP = 0.05
// Haba ng gum lampas sa huling molar (retromolar area)
export const RETROMOLAR = 0.55

function buildCurve(pointsMm, zOffset) {
  const right = pointsMm.map(([x, z]) => new THREE.Vector3(x * MM, 0, -z * MM - zOffset))
  const left = right.slice(1).reverse().map((v) => new THREE.Vector3(-v.x, v.y, v.z))
  const curve = new THREE.CatmullRomCurve3([...left, ...right])
  curve.arcLengthDivisions = 4000
  return curve
}

// Distansya sa kahabaan ng arch (mula midline) ng gitna ng bawat ngipin,
// ayon sa totoong lapad ng bawat isa — negative = kaliwa ng screen.
function rowArcCenters(row) {
  const half = row.length / 2
  const widths = row.map((t) => 2 * toothExtents(t).x)
  const centers = new Array(row.length)
  let s = TOOTH_GAP / 2
  for (let i = half - 1; i >= 0; i--) {
    centers[i] = -(s + widths[i] / 2)
    s += widths[i] + TOOTH_GAP
  }
  s = TOOTH_GAP / 2
  for (let i = half; i < row.length; i++) {
    centers[i] = s + widths[i] / 2
    s += widths[i] + TOOTH_GAP
  }
  return centers
}

function buildArch(rowIndex) {
  const upper = rowIndex === 0
  const curve = buildCurve(upper ? UPPER_ARCH_MM : LOWER_ARCH_MM, upper ? 0 : LOWER_Z_OFFSET)
  const length = curve.getLength()
  const row = ODONTOGRAM_ROWS[rowIndex]
  const centers = rowArcCenters(row)
  const teeth = row.map((toothNumber, i) => {
    const ext = toothExtents(toothNumber)
    const position = Number(toothNumber[1]) - 1
    // "apical" coordinate: layo mula sa occlusal plane papunta sa ugat
    const aCervical = OCCLUSAL_GAP + 2 * ext.y
    return {
      toothNumber,
      s: centers[i],
      halfWidth: ext.x,
      tz: ext.z,
      aCervical,
      zenith: aCervical - MARGIN_OVERLAP,
      papilla: PAPILLA[position],
      tiltDeg: (upper ? UPPER_TILT_DEG : LOWER_TILT_DEG)[position],
    }
  })
  const half = row.length / 2
  // Bawat side, nakaayos mula midline palabas
  const right = teeth.slice(half)
  const left = teeth.slice(0, half).reverse()
  const lastEdge = Math.max(...teeth.map((t) => Math.abs(t.s) + t.halfWidth)) + TOOTH_GAP / 2
  const topA = Math.max(...teeth.map((t) => t.aCervical)) + 0.75
  return { upper, curve, length, teeth, right, left, lastEdge, topA, sign: upper ? 1 : -1 }
}

export const ARCHES = [buildArch(0), buildArch(1)]

// Punto sa arch (arc length s mula midline) at ang palabas (facial) na direksyon
export function archFrame(arch, s) {
  const u = THREE.MathUtils.clamp(0.5 + s / arch.length, 0, 1)
  const point = arch.curve.getPointAt(u)
  const tangent = arch.curve.getTangentAt(u)
  const outward = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
  return { point, outward }
}

export function toothPlacement(rowIndex, indexInRow) {
  const arch = ARCHES[rowIndex]
  const tooth = arch.teeth[indexInRow]
  const { point, outward } = archFrame(arch, tooth.s)
  // Pivot = gitna ng cervical line (kung saan lumalabas ang ngipin sa gums);
  // dito umiikot ang labial tilt, kaya nananatiling nakabaon ang leeg.
  const position = [point.x, arch.sign * tooth.aCervical, point.z]
  const rotationY = Math.atan2(outward.x, outward.z)
  const tilt = THREE.MathUtils.degToRad(tooth.tiltDeg)
  // The tooth model is authored crown-up — correct for a lower tooth, since
  // lower crowns point up toward the bite line. Upper teeth are flipped (see
  // Tooth3D), which swaps which physical side ends up mesial vs distal —
  // `mesialOnPositiveX` reports that (ginagamit ng Tooth3D para i-mirror).
  const s = tooth.s
  return {
    position,
    rotationY,
    flipUpper: arch.upper,
    mesialOnPositiveX: arch.upper ? s > 0 : s < 0,
    // Upper: ang crown ay pababa, kaya negative na rotation ang nagtutulak
    // sa dulo nito pasulong (facial); lower: positive
    tiltX: arch.upper ? -tilt : tilt,
    // Label nasa gums, ~3 mm lampas sa cervical line
    labelY: arch.sign * 0.33,
  }
}

// Halaga sa loob ng ngipin na humahalo papunta sa kapitbahay sa contact
// point: center sa gitna ng ngipin, `contact(own, neighbor)` sa gilid.
function blendAlongTooth(arch, s, centerOf, contactOf, beyond) {
  const side = s < 0 ? arch.left : arch.right
  const other = s < 0 ? arch.right : arch.left
  const d = Math.abs(s)
  if (d > arch.lastEdge) return beyond(side[side.length - 1], (d - arch.lastEdge) / RETROMOLAR)
  let i = side.findIndex((t) => d <= Math.abs(t.s) + t.halfWidth + TOOTH_GAP / 2)
  if (i < 0) i = side.length - 1
  const tooth = side[i]
  const u = THREE.MathUtils.clamp((d - Math.abs(tooth.s)) / (tooth.halfWidth + TOOTH_GAP / 2), -1, 1)
  const neighbor = u < 0 ? (i === 0 ? other[0] : side[i - 1]) : side[i + 1]
  const contact = contactOf(tooth, neighbor)
  return THREE.MathUtils.lerp(centerOf(tooth), contact, u * u)
}

// Gilid ng gums (apical coordinate): pinakamataas sa gitna ng ngipin
// (gingival zenith), at tulis pababa sa pagitan (papilla) — scalloped.
export function marginAt(arch, s) {
  return blendAlongTooth(
    arch,
    s,
    (t) => t.zenith,
    (t, n) => (n ? (t.zenith + n.zenith) / 2 - (t.papilla + n.papilla) / 2 : t.zenith - t.papilla * 0.4),
    (last) => last.zenith - last.papilla * 0.4,
  )
}

// Kalahating kapal (facial-lingual) ng ngipin sa puntong ito ng arch
export function thicknessAt(arch, s) {
  return blendAlongTooth(
    arch,
    s,
    (t) => t.tz,
    (t, n) => (n ? 0.85 * ((t.tz + n.tz) / 2) : 0.85 * t.tz),
    (last) => 0.85 * last.tz,
  )
}
