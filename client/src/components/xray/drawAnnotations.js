// Ginagamit ni XrayViewer (live editing) at XrayPrintPage (static output),
// kaya same lang ang itsura ng na-save na annotation kung ina-edit man o
// pina-print.
export function drawShapes(ctx, shapes, width, height) {
  const lineWidth = Math.max(2, width * 0.003)

  for (const shape of shapes) {
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
