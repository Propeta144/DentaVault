// Ginagamit ni XrayViewer (live editing) at XrayPrintPage (static output),
// kaya same lang ang itsura ng na-save na annotation kung ina-edit man o
// pina-print.

export const ANNOTATION_TEXT_MAX = 200
const DEFAULT_COLOR = '#ef4444'

const isNum = (n) => typeof n === 'number' && Number.isFinite(n)
const isPoint = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1])

// Mga maayos na shape lang ang itinatabi (#41): ang sirang entry (hindi numero
// ang coordinate, lumang format, hindi object) ay nilalaktawan, para hindi
// masira ang buong X-ray at hindi na rin maipadala ulit sa server pag-save.
// Kapareho ng patakaran ng server (server/src/utils/drawingData.js).
export function cleanShapes(shapes) {
  if (!Array.isArray(shapes)) return []
  const out = []
  for (const shape of shapes) {
    if (!shape || typeof shape !== 'object') continue
    const color = /^#[0-9a-f]{6}$/i.test(shape.color) ? shape.color : DEFAULT_COLOR
    const inRange = (n) => n >= -0.05 && n <= 1.05
    if (shape.type === 'line' && Array.isArray(shape.points)) {
      const points = shape.points.filter((p) => isPoint(p) && inRange(p[0]) && inRange(p[1]))
      if (points.length) out.push({ type: 'line', points, color })
    } else if (shape.type === 'text' && isNum(shape.x) && isNum(shape.y) && inRange(shape.x) && inRange(shape.y)) {
      const text = String(shape.text ?? '').trim().slice(0, ANNOTATION_TEXT_MAX)
      if (text) out.push({ type: 'text', x: shape.x, y: shape.y, text, color })
    }
  }
  return out
}

export function drawShapes(ctx, shapes, width, height) {
  const lineWidth = Math.max(2, width * 0.003)

  for (const shape of cleanShapes(shapes)) {
    if (shape.type === 'line') {
      ctx.strokeStyle = shape.color
      ctx.lineWidth = lineWidth
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      shape.points.forEach(([xFrac, yFrac], i) => {
        const x = xFrac * width
        const y = yFrac * height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else if (shape.type === 'text') {
      ctx.fillStyle = shape.color
      ctx.font = `bold ${Math.max(14, width * 0.02)}px sans-serif`
      ctx.fillText(shape.text, shape.x * width, shape.y * height)
    }
  }
}
