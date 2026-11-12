export function photoCropRect(width, height, zoom = 1, horizontal = 0, vertical = 0) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Invalid image size')
  const safeZoom = Math.min(3, Math.max(1, Number(zoom) || 1))
  const size = Math.min(width, height) / safeZoom
  const position = value => (Math.min(100, Math.max(-100, Number(value) || 0)) + 100) / 200
  return { x: (width - size) * position(horizontal), y: (height - size) * position(vertical), size }
}
