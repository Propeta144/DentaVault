import { surfaceForUV } from './toothUV.js'

// Isang pointer stroke puwedeng tumawid sa UV seam o surface. Hiwalay ang
// segments para tama ang 2D condition at walang linya sa pagitan ng seams.
export function splitPenStroke(toothNumber, stroke, strokeId) {
  const segments = []
  for (const point of stroke.uv) {
    const surface = surfaceForUV(point)
    const previous = segments.at(-1)
    const lastPoint = previous?.uv.at(-1)
    if (previous?.surface === surface && Math.hypot(point[0] - lastPoint[0], point[1] - lastPoint[1]) <= 0.2) {
      previous.uv.push(point)
    } else {
      segments.push({ id: `${strokeId}:${segments.length}`, strokeId, toothNumber,
        conditionCode: stroke.conditionCode, surface, uv: [point] })
    }
  }
  return segments
}

export function groupPenDrafts(drafts) {
  const groups = new Map()
  for (const draft of drafts) {
    const key = `${draft.toothNumber}:${draft.surface}:${draft.conditionCode}`
    if (!groups.has(key)) groups.set(key, { key, toothNumber: draft.toothNumber,
      surface: draft.surface, conditionCode: draft.conditionCode, drafts: [] })
    groups.get(key).drafts.push(draft)
  }
  return [...groups.values()]
}
