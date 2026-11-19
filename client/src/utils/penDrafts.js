import { surfaceForUV } from './toothUV.js'
import { conditionColor, procedureForCondition } from '../constants/dental.js'

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

// Save in last-drawn order so the last chosen condition stays current when
// several conditions were drawn on the same surface. All entries keep history.
export async function savePenDrafts({ drafts, entries, addTreatments, saveEntry, onSaved }) {
  const positions = new Map(drafts.map((draft, index) => [draft.id, index]))
  const groups = groupPenDrafts(drafts).sort((a, b) =>
    positions.get(a.drafts.at(-1).id) - positions.get(b.drafts.at(-1).id))
  const current = new Map(entries.map((entry) => [`${entry.tooth_number}:${entry.surface}`, entry]))
  for (const group of groups) {
    const key = `${group.toothNumber}:${group.surface}`
    const existing = current.get(key)
    const sameCondition = existing?.condition_code === group.conditionCode
    const strokes = group.drafts.map((draft) => ({ type: 'freehand', points: draft.uv, color: conditionColor(group.conditionCode) }))
    const entry = await saveEntry({ toothNumber: group.toothNumber, surface: group.surface,
      conditionCode: group.conditionCode, notes: sameCondition ? existing.notes || '' : '',
      strokeData: [...(sameCondition && Array.isArray(existing.stroke_data) ? existing.stroke_data : []), ...strokes],
      addTreatment: Boolean(addTreatments && procedureForCondition(group.conditionCode) && !(sameCondition && existing.treatment_id)),
    })
    current.set(key, entry)
    onSaved(group, entry)
  }
}
