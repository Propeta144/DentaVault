import { surfaceLetters, conditionLabel } from '../constants/dental.js'
import { formatDate } from './formatDate.js'

export function auditSnapshotRows(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const fields = [
    ['procedureName', 'Procedure', (value) => String(value)],
    ['toothNumber', 'Tooth', (value) => value === 'ALL' ? 'Full mouth' : String(value)],
    ['surfaces', 'Surfaces', surfaceLetters],
    ['treatmentDate', 'Treatment date', formatDate],
    ['conditionCode', 'Condition', conditionLabel],
  ]
  return fields.filter(([key]) => Object.hasOwn(snapshot, key)).map(([key, label, format]) => ({
    label, value: snapshot[key] == null || snapshot[key] === '' ? 'Not recorded' : format(snapshot[key]) || 'Not recorded',
  }))
}
