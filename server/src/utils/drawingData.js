// Pagsusuri ng mga drawing bago i-save (security review, #41):
// - X-ray annotations (`xray_images.annotations`): mga guhit at text ng dentist sa X-ray.
// - 3D chart strokes (`chart_entries.stroke_data`): mga guhit ng 3D pen sa ngipin.
// Dati, "array ba?" lang ang tinitingnan, kaya kahit anong laman ay naise-save,
// at ang isang sirang entry (hal. hindi numero ang coordinate) ay puwedeng
// makasira sa pag-display ng buong X-ray o ngipin. Dentist lang ang
// nakakapag-save ng mga ito, pero mas ligtas pa ring tingnan ang laman.
//
// Coordinates ay fraction (0–1) ng lapad/taas ng larawan. May kaunting palugit
// sa X-ray (puwedeng lumampas nang bahagya ang pointer sa gilid habang gumuguhit).

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const ANNOTATION_TEXT_MAX = 200
const MAX_SHAPES = 200
const MAX_POINTS_PER_SHAPE = 5000
const MAX_TOTAL_POINTS = 20000
const MAX_STROKE_MARKS = 50

function isPoint(p, min, max) {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    p.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max)
  )
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// Ibinabalik ang unang problema (string), o null kapag maayos
function checkPoints(points, { min, max, label }) {
  if (!Array.isArray(points) || points.length === 0) return `${label} must have at least one point`
  if (points.length > MAX_POINTS_PER_SHAPE) return `${label} has too many points (max ${MAX_POINTS_PER_SHAPE})`
  if (!points.every((p) => isPoint(p, min, max))) return `${label} has an invalid point`
  return null
}

export function annotationsProblem(shapes) {
  if (!Array.isArray(shapes)) return 'Annotations must be a list'
  if (shapes.length > MAX_SHAPES) return `Too many annotations (max ${MAX_SHAPES})`
  let total = 0
  for (const [i, shape] of shapes.entries()) {
    const label = `Annotation ${i + 1}`
    if (!isPlainObject(shape)) return `${label} is invalid`
    if (typeof shape.color !== 'string' || !HEX_COLOR.test(shape.color)) return `${label} has an invalid color`
    if (shape.type === 'line') {
      const problem = checkPoints(shape.points, { min: -0.05, max: 1.05, label })
      if (problem) return problem
      total += shape.points.length
    } else if (shape.type === 'text') {
      if (!isPoint([shape.x, shape.y], -0.05, 1.05)) return `${label} has an invalid position`
      if (typeof shape.text !== 'string' || !shape.text.trim()) return `${label} has no text`
      if (shape.text.length > ANNOTATION_TEXT_MAX) return `${label} text must be ${ANNOTATION_TEXT_MAX} characters or fewer`
    } else {
      return `${label} has an unknown type`
    }
  }
  if (total > MAX_TOTAL_POINTS) return `Annotations have too many points (max ${MAX_TOTAL_POINTS})`
  return null
}

// 3D pen: laging nasa loob ng UV ng ngipin (clampedUV sa Tooth3D.jsx), kaya 0–1 talaga
export function strokeDataProblem(marks) {
  if (marks === null || marks === undefined) return null
  if (!Array.isArray(marks)) return 'strokeData must be an array'
  if (marks.length > MAX_STROKE_MARKS) return `Too many strokes (max ${MAX_STROKE_MARKS})`
  let total = 0
  for (const [i, mark] of marks.entries()) {
    const label = `Stroke ${i + 1}`
    if (!isPlainObject(mark) || mark.type !== 'freehand') return `${label} is invalid`
    if (typeof mark.color !== 'string' || !HEX_COLOR.test(mark.color)) return `${label} has an invalid color`
    const problem = checkPoints(mark.points, { min: 0, max: 1, label })
    if (problem) return problem
    total += mark.points.length
  }
  if (total > MAX_TOTAL_POINTS) return `Strokes have too many points (max ${MAX_TOTAL_POINTS})`
  return null
}

// Para sa express-validator `.custom()`: nag-e-error gamit ang mismong problema
function asValidator(check) {
  return (value) => {
    const problem = check(value)
    if (problem) throw new Error(problem)
    return true
  }
}

export const isValidAnnotations = asValidator(annotationsProblem)
export const isValidStrokeData = asValidator(strokeDataProblem)
