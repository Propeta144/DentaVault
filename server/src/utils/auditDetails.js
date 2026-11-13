import { EXTRA_PATIENT_FIELDS } from './patientFields.js'

const SCALARS = new Set([
  'name', 'count', 'toothNumber', 'surface', 'conditionCode', 'filename', 'xrayCount', 'totalRows',
  'createdCount', 'treatmentsAddedCount', 'duplicateCount', 'errorCount', 'reason', 'matchCount',
  'fileCount', 'limitedBy', 'windowMinutes', 'byPatient', 'findingCount', 'chartEntries',
  'chartChange', 'chartEntriesRemoved', 'fromChart', 'procedureName', 'treatmentDate',
  'dateFrom', 'dateTo', 'period', 'kind', 'procedure', 'page', 'viewDays', 'changeDays',
])
const SNAPSHOT_FIELDS = ['procedureName', 'toothNumber', 'surfaces', 'treatmentDate', 'conditionCode']

// Audit UI gets a deliberately small view, never raw account secrets,
// request payloads, clinical notes or archive paths. Stored logs stay intact.
export function publicAuditDetails(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return null }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (SCALARS.has(key) && (item === null || ['string', 'number', 'boolean'].includes(typeof item))) result[key] = item
    if (['previous', 'current', 'deleted'].includes(key) && item && typeof item === 'object' && !Array.isArray(item)) {
      const snapshot = {}
      for (const field of SNAPSHOT_FIELDS) {
        const content = item[field]
        if (content === undefined) continue
        if (content === null || ['string', 'number', 'boolean'].includes(typeof content)) snapshot[field] = content
        else if (field === 'surfaces' && Array.isArray(content)) snapshot[field] = content.filter((entry) => typeof entry === 'string').slice(0, 5)
      }
      if (Object.keys(snapshot).length) result[key] = snapshot
    }
    if (key === 'changedFields' && Array.isArray(item)) result[key] = item.filter((field) => typeof field === 'string').slice(0, 80).map((field) => field.slice(0, 150))
  }
  return Object.keys(result).length ? result : null
}

const PATIENT_FIELDS = [
  ['first_name', 'First name'], ['last_name', 'Last name'], ['sex', 'Sex'], ['date_of_birth', 'Date of birth'],
  ['contact_number', 'Contact number'], ['email', 'Email'], ['address', 'Address'],
  ['medical_history', 'Medical history'], ['allergies', 'Allergies'],
  ['emergency_contact_name', 'Emergency contact name'], ['emergency_contact_phone', 'Emergency contact number'],
  ...EXTRA_PATIENT_FIELDS.map((field) => [field.column, field.label]),
]

export function changedPatientFields(before, after) {
  const normalize = (value) => value == null || value === '' ? '' : String(value)
  return PATIENT_FIELDS.filter(([column]) => normalize(before[column]) !== normalize(after[column])).map(([, label]) => label)
}
