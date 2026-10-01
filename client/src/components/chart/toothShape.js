// Hugis ng ngipin sa 2D chart (at sa maliit na diagram ng ChartEntryModal).
//
// Dati: parisukat na "envelope" (gitnang square + 4 na trapezoid) para sa
// LAHAT ng ngipin — tama ang 5 surface, pero hindi mukhang ngipin. Ngayon:
// occlusal view (tingin mula sa itaas ng kagat) ayon sa uri ng ngipin:
// - Incisor (1-2): malapad at manipis (incisal edge)
// - Canine (3): bilugang diamond
// - Premolar (4-5): oval, may 2 cusp (facial at lingual)
// - Molar (6-8): malapad na bilugang parisukat, may 4 cusp
//
// PAREHO pa rin ang 5 napipindot na bahagi at ang pwesto nila (top / bottom
// / left / right / center → facial, lingual, mesial, distal, occlusal ayon
// sa toothOrientation()), kaya walang nagbago sa functionality.
//
// Paano ginagawa: ang gilid ng ngipin ay "superellipse" (bilog ↔ parisukat,
// depende sa `n`) na may maliliit na umbok para sa cusps. Ang gitna
// (occlusal) ay parehong hugis pero pinaliit. Ang 4 na gilid na bahagi ay
// hinati ng mga linyang papunta sa "kanto" ng hugis.

export const TOOTH_BOX = 56
const C = TOOTH_BOX / 2
const STEPS_PER_REGION = 16

// a/b = kalahating lapad/taas, n = gaano ka-parisukat (2 = ellipse),
// inner = laki ng occlusal (x, y), lobes = umbok ng cusps
const TYPES = {
  incisor: { a: 25, b: 16, n: 2.4, inner: [0.64, 0.34], lobes: { m: 2, amp: 0.04, phase: 0 } },
  canine: { a: 21, b: 23, n: 1.7, inner: [0.44, 0.44], lobes: null },
  premolar: { a: 21, b: 25, n: 2.2, inner: [0.5, 0.46], lobes: { m: 2, amp: 0.08, phase: Math.PI / 2 } },
  molar: { a: 26, b: 25, n: 2.6, inner: [0.5, 0.48], lobes: { m: 4, amp: 0.075, phase: Math.PI / 4 } },
}

export function toothType(toothNumber) {
  const position = Number(String(toothNumber)[1])
  if (position <= 2) return 'incisor'
  if (position === 3) return 'canine'
  if (position <= 5) return 'premolar'
  return 'molar'
}

// Punto sa gilid sa anggulong `theta` (math: 0 = kanan, pataas = positive);
// ibinabalik sa screen coordinates (pababa ang y)
function edgePoint(type, theta, sx = 1, sy = 1, withLobes = true) {
  const { a, b, n, lobes } = TYPES[type]
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  const e = 2 / n
  let x = a * Math.sign(c) * Math.abs(c) ** e
  let y = b * Math.sign(s) * Math.abs(s) ** e
  if (lobes && withLobes) {
    const k = 1 + lobes.amp * Math.cos(lobes.m * (theta - lobes.phase))
    x *= k
    y *= k
  }
  return [C + x * sx, C - y * sy]
}

const fmt = (points) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

function arc(type, from, to, sx, sy, withLobes) {
  const pts = []
  for (let i = 0; i <= STEPS_PER_REGION; i++) {
    pts.push(edgePoint(type, from + ((to - from) * i) / STEPS_PER_REGION, sx, sy, withLobes))
  }
  return pts
}

function buildShape(type) {
  const { a, b, inner } = TYPES[type]
  const [ix, iy] = inner
  // Hangganan ng mga bahagi: papunta sa "kanto" ng hugis (hindi laging 45°,
  // kasi malapad ang incisor at mataas ang premolar)
  const phi = Math.atan2(b, a)
  const ranges = {
    right: [-phi, phi],
    top: [phi, Math.PI - phi],
    left: [Math.PI - phi, Math.PI + phi],
    bottom: [Math.PI + phi, 2 * Math.PI - phi],
  }
  const regions = {}
  for (const [position, [from, to]] of Object.entries(ranges)) {
    const outer = arc(type, from, to, 1, 1, true)
    const innerArc = arc(type, from, to, ix, iy, false).reverse()
    regions[position] = fmt([...outer, ...innerArc])
  }
  regions.center = fmt(arc(type, 0, 2 * Math.PI, ix, iy, false).slice(0, -1))
  const outline = fmt(arc(type, 0, 2 * Math.PI, 1, 1, true).slice(0, -1))

  // Palamuti lang (hindi napipindot): fissure/groove sa biting surface
  const ga = a * ix * 0.7
  const gb = b * iy * 0.7
  let grooves = ''
  if (type === 'molar') {
    grooves = `M ${C - ga} ${C} L ${C + ga} ${C} M ${C} ${C - gb} L ${C} ${C + gb}`
  } else if (type === 'premolar') {
    grooves = `M ${C - ga} ${C} L ${C + ga} ${C}`
  }
  return { regions, outline, grooves }
}

const CACHE = Object.fromEntries(Object.keys(TYPES).map((t) => [t, buildShape(t)]))

// { regions: { top, bottom, left, right, center }, outline, grooves }
// (polygon points / SVG path, sa loob ng TOOTH_BOX × TOOTH_BOX)
export function toothShape(toothNumber) {
  return CACHE[toothType(toothNumber)]
}
