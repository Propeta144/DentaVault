// Ginagamit parehong AuditLogPage (full table) at DashboardPage (recent
// activity feed) — cosmetic grouping lang naman 'to, para scannable pa rin
// yung mahabang listahan ng action codes (CREATE_PATIENT, LOGIN_FAILED,
// DELETE_PATIENT, ...).
export function actionVariant(action) {
  if (action.includes('DELETE') || action.includes('FAILED') || action.includes('UNMATCHED')) return 'red'
  if (action.includes('CREATE') || action.includes('SUCCESS') || action.includes('IMPORT')) return 'emerald'
  if (action.includes('UPDATE') || action.includes('RESET') || action.includes('ANNOTATE') || action.includes('INBOUND')) return 'sky'
  if (action.includes('EXPORT')) return 'amber'
  return 'slate' // VIEW_*, GENERATE_*, at kahit ano pang hindi na-mention sa taas
}

// "CREATE_CHART_ENTRY" -> "Create Chart Entry" — fallback lang ito para sa
// action code na wala pa sa ACTION_LABELS sa baba (hal. bagong action na
// idinagdag sa server pero hindi pa dito).
export function humanizeAction(action) {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

// Mga salitang maiintindihan ng dentist (at ng panel), kapalit ng raw code.
// `plural`: kapag pinagsama ang magkakasunod na parehong action (tignan ang
// groupAuditLogs), hal. 6 na VIEW_XRAY → "Viewed 6 X-rays".
// Kapag may bagong action code sa server, idagdag din dito.
const ACTION_LABELS = {
  LOGIN_SUCCESS: { label: 'Signed in' },
  LOGIN_FAILED: { label: 'Failed sign-in attempt', plural: (n) => `${n} failed sign-in attempts` },
  VIEW_DASHBOARD: { label: 'Opened the dashboard' },
  VIEW_AUDIT_LOG: { label: 'Opened the audit log' },
  VIEW_PATIENT: { label: 'Viewed patient record' },
  VIEW_XRAY: { label: 'Viewed an X-ray', plural: (n) => `Viewed ${n} X-rays` },
  CREATE_PATIENT: { label: 'Registered a patient' },
  UPDATE_PATIENT: { label: 'Updated patient details' },
  DELETE_PATIENT: { label: 'Deleted a patient' },
  CREATE_TREATMENT: { label: 'Added a treatment' },
  CREATE_CHART_ENTRY: { label: 'Updated the dental chart', plural: (n) => `Updated the dental chart (${n} entries)` },
  UPLOAD_XRAY: { label: 'Uploaded an X-ray' },
  ANNOTATE_XRAY: { label: 'Annotated an X-ray', plural: (n) => `Annotated X-rays (${n} saves)` },
  DELETE_XRAY: { label: 'Deleted an X-ray' },
  GENERATE_TREATMENT_SUMMARY: { label: 'Printed treatment summary' },
  EXPORT_PATIENTS_CSV: { label: 'Exported the patient list' },
  IMPORT_LEGACY_PATIENTS: { label: 'Imported patient records' },
  INBOUND_XRAY_EMAIL: { label: 'Received an X-ray by email' },
  INBOUND_XRAY_EMAIL_UNMATCHED: { label: 'X-ray email from unknown sender' },
  CREATE_PATIENT_PORTAL_ACCOUNT: { label: 'Created patient portal account' },
  RESET_PATIENT_PORTAL_PASSWORD: { label: 'Reset patient portal password' },
  PRUNE_AUDIT_LOGS: { label: 'Archived old audit entries' },
}

export function actionLabel(action, count = 1) {
  const entry = ACTION_LABELS[action]
  if (!entry) return humanizeAction(action)
  if (count > 1 && entry.plural) return entry.plural(count)
  return entry.label
}

// Mga detalye na maiintindihan ng tao. Sadyang HINDI ipinapakita ang
// patientId (numeric na internal ID — Feature #7: walang patient ID sa
// screen; nasa "Patient" column na ang pangalan) at messageId (mahabang
// email header, walang silbi sa dentist).
const HIDDEN_DETAIL_KEYS = new Set(['patientId', 'messageId', 'propagatedToAllSurfaces'])

const DETAIL_FORMATTERS = {
  name: (v) => `Patient: ${v}`,
  count: (v) => `${v} patient${Number(v) === 1 ? '' : 's'}`,
  toothNumber: (v) => (v === 'ALL' ? 'All teeth' : `Tooth ${v}`),
  surface: (v) => `Surface: ${v}`,
  conditionCode: (v) => `Condition: ${String(v).replace(/_/g, ' ')}`,
  filename: (v) => `File: ${v}`,
  senderEmail: (v) => `From: ${v}`,
  subject: (v) => `Subject: "${v}"`,
  xrayCount: (v) => `${v} X-ray${Number(v) === 1 ? '' : 's'}`,
  totalRows: (v) => `${v} rows`,
  createdCount: (v) => `${v} created`,
  treatmentsAddedCount: (v) => `${v} treatments added`,
  duplicateCount: (v) => `${v} duplicates`,
  errorCount: (v) => `${v} errors`,
}

export function formatAuditDetails(details) {
  if (!details || typeof details !== 'object') return ''
  return Object.entries(details)
    .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && value !== null && value !== '' && value !== undefined)
    .map(([key, value]) => (DETAIL_FORMATTERS[key] ? DETAIL_FORMATTERS[key](value) : `${key}: ${value}`))
    .join(' · ')
}

// Ang "Patient" ng isang log entry: galing sa server (patient_name, hinanap
// mula sa entity — tignan ang auditLogModel.listAuditLogs). Fallback ang
// details.name para sa DELETE_PATIENT ng mga lumang entry.
export function auditPatientName(log) {
  return log.patient_name || log.details?.name || null
}

// Mga action na kadalasang sabay-sabay nangyayari at walang dagdag na
// impormasyon kapag isa-isang ipinakita. Hal. pagbukas ng X-ray tab = isang
// VIEW_XRAY bawat thumbnail (6 na X-ray → 6 na row). Pinagsasama sila sa
// isang row kapag magkakasunod, parehong user, parehong patient, at nasa
// loob ng 2 minuto mula sa una.
const GROUPABLE = new Set(['VIEW_XRAY', 'CREATE_CHART_ENTRY', 'ANNOTATE_XRAY', 'LOGIN_FAILED'])
const GROUP_WINDOW_MS = 2 * 60 * 1000

// Bawat group: { ...unang log (pinakabago), count, logs: [lahat] }.
// Display lang ito; buo pa rin ang bawat entry sa database.
export function groupAuditLogs(logs) {
  const groups = []
  for (const log of logs) {
    const last = groups[groups.length - 1]
    const canMerge =
      last &&
      GROUPABLE.has(log.action) &&
      last.action === log.action &&
      last.user_id === log.user_id &&
      auditPatientName(last) === auditPatientName(log) &&
      Math.abs(new Date(last.created_at) - new Date(log.created_at)) <= GROUP_WINDOW_MS
    if (canMerge) {
      last.count += 1
      last.logs.push(log)
    } else {
      groups.push({ ...log, count: 1, logs: [log] })
    }
  }
  return groups
}
