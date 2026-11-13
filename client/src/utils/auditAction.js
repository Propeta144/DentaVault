import { conditionLabel } from '../constants/dental.js'
import { formatDate } from './formatDate.js'

// Ginagamit parehong AuditLogPage (full table) at DashboardPage (recent
// activity feed) — cosmetic grouping lang naman 'to, para scannable pa rin
// yung mahabang listahan ng action codes (CREATE_PATIENT, LOGIN_FAILED,
// DELETE_PATIENT, ...).
export function actionVariant(action) {
  if (action.includes('DELETE') || action.includes('FAILED') || action.includes('UNMATCHED') || action.includes('RATE_LIMITED')) return 'red'
  if (action === 'INBOUND_XRAY_EMAIL_HELD') return 'amber' // naghihintay ng desisyon ng dentist
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
  VIEW_CHART_COMPARISON: { label: 'Compared dental charts' },
  RESTORE_CHART_ENTRY: { label: 'Restored chart markings (Undo/Redo)' },
  UPDATE_PROFILE_PHOTO: { label: 'Updated a profile photo' },
  DELETE_PROFILE_PHOTO: { label: 'Removed a profile photo' },
  LOGIN_SUCCESS: { label: 'Signed in' },
  LOGOUT: { label: 'Signed out' },
  LOGIN_FAILED: { label: 'Failed sign-in attempt', plural: (n) => `${n} failed sign-in attempts` },
  LOGIN_RATE_LIMITED: { label: 'Sign-in blocked (too many failed attempts)' },
  CHANGE_PASSWORD_RATE_LIMITED: { label: 'Password change blocked (too many wrong passwords)' },
  VIEW_DASHBOARD: { label: 'Opened the dashboard' },
  VIEW_AUDIT_LOG: { label: 'Opened the audit log' },
  VIEW_PATIENT: { label: 'Viewed patient record' },
  VIEW_XRAY: { label: 'Viewed an X-ray', plural: (n) => `Viewed ${n} X-rays` },
  CREATE_PATIENT: { label: 'Registered a patient' },
  UPDATE_PATIENT: { label: 'Updated patient details' },
  DELETE_PATIENT: { label: 'Deleted a patient' },
  CREATE_TREATMENT: { label: 'Added a treatment' },
  UPDATE_TREATMENT: { label: 'Edited a treatment' },
  DELETE_TREATMENT: { label: 'Deleted a treatment' },
  UPDATE_INTRAORAL_EXAM: { label: 'Updated the intraoral examination' },
  CREATE_CHART_ENTRY: { label: 'Updated the dental chart', plural: (n) => `Updated the dental chart (${n} entries)` },
  DELETE_CHART_ENTRY: { label: 'Removed a dental chart condition' },
  UPLOAD_XRAY: { label: 'Uploaded an X-ray' },
  PATIENT_UPLOAD_XRAY: { label: 'Patient uploaded an X-ray (patient portal)' },
  ANNOTATE_XRAY: { label: 'Annotated an X-ray', plural: (n) => `Annotated X-rays (${n} saves)` },
  DELETE_XRAY: { label: 'Deleted an X-ray' },
  GENERATE_TREATMENT_SUMMARY: { label: 'Printed treatment summary' },
  EXPORT_PATIENTS_CSV: { label: 'Exported the patient list' },
  IMPORT_LEGACY_PATIENTS: { label: 'Imported patient records' },
  INBOUND_XRAY_EMAIL: { label: 'Received an X-ray by email' },
  INBOUND_XRAY_EMAIL_UNMATCHED: { label: 'X-ray email from unknown sender' },
  INBOUND_XRAY_EMAIL_HELD: { label: 'X-ray email held for review' },
  VIEW_HELD_XRAY: { label: 'Viewed a held X-ray email', plural: (n) => `Viewed held X-ray files (${n})` },
  ASSIGN_HELD_XRAY: { label: 'Filed a held X-ray email to a patient' },
  DISMISS_HELD_XRAY: { label: 'Dismissed a held X-ray email' },
  VIEW_XRAY_INBOX: { label: 'Opened the X-ray inbox' },
  MARK_XRAY_REVIEWED: { label: 'Marked an X-ray as reviewed', plural: (n) => `Marked ${n} X-rays as reviewed` },
  MIGRATE_TREATMENT_HISTORY: { label: 'Encoded past treatments (migration)' },
  CREATE_PATIENT_PORTAL_ACCOUNT: { label: 'Created patient portal account' },
  RESET_PATIENT_PORTAL_PASSWORD: { label: 'Reset patient portal password' },
  UPDATE_PORTAL_ACCOUNT_EMAIL: { label: 'Changed patient portal sign-in email' },
  CHANGE_OWN_PASSWORD: { label: 'Changed own password' },
  PASSWORD_UPGRADE_REQUIRED: { label: 'Asked to choose a stronger password' },
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
const HIDDEN_DETAIL_KEYS = new Set(['patientId', 'messageId', 'propagatedToAllSurfaces', 'holdId', 'dkim', 'previous', 'treatmentId'])

// Treatment History ↔ chart (Feature #30)
const CHART_CHANGE_LABELS = {
  none: 'Treatment History only',
  updated: 'Chart mark updated',
  replaced: 'Chart mark replaced',
  removed: 'Chart mark removed',
  added: 'Added to the chart',
}

const DETAIL_FORMATTERS = {
  name: (v) => `Patient: ${v}`,
  count: (v) => `${v} patient${Number(v) === 1 ? '' : 's'}`,
  toothNumber: (v) => (v === 'ALL' ? 'All teeth' : `Tooth ${v}`),
  surface: (v) => `Surface: ${v}`,
  conditionCode: (v) => `Condition: ${conditionLabel(v)}`,
  filename: (v) => `File: ${v}`,
  senderEmail: (v) => `From: ${v}`,
  subject: (v) => `Subject: "${v}"`,
  xrayCount: (v) => `${v} X-ray${Number(v) === 1 ? '' : 's'}`,
  totalRows: (v) => `${v} rows`,
  createdCount: (v) => `${v} created`,
  treatmentsAddedCount: (v) => `${v} treatments added`,
  duplicateCount: (v) => `${v} duplicates`,
  errorCount: (v) => `${v} errors`,
  reason: (v) => (v === 'shared_email' ? 'Email shared by several patients' : v === 'unverified_sender' ? 'Sender not verified' : v),
  matchCount: (v) => `${v} matching patient${Number(v) === 1 ? '' : 's'}`,
  fileCount: (v) => `${v} file${Number(v) === 1 ? '' : 's'}`,
  spf: (v) => `Sender check (SPF): ${v}`,
  limitedBy: (v) => `Limit: ${{ ip: 'per IP address', email: 'per account email', user: 'per account' }[v] ?? v}`,
  windowMinutes: (v) => `Wait: ${v} min`,
  byPatient: () => 'Removed by the patient (before review)',
  findingCount: (v) => `${v} finding${Number(v) === 1 ? '' : 's'} checked`,
  chartEntries: (v) => (Number(v) > 0 ? 'Also on the dental chart' : 'Treatment History only'),
  chartChange: (v) => CHART_CHANGE_LABELS[v] ?? v,
  chartEntriesRemoved: (v) => (Number(v) > 0 ? 'Removed from the dental chart too' : 'Was not on the chart'),
  fromChart: () => 'Added from the dental chart',
  changedFields: (v) => Array.isArray(v) ? `Changed fields: ${v.join(', ')}` : '',
  procedureName: (v) => `Procedure: ${v}`,
  treatmentDate: (v) => `Treatment date: ${formatDate(v)}`,
  dateFrom: (v) => `From: ${formatDate(v)}`,
  dateTo: (v) => `To: ${formatDate(v)}`,
  period: (v) => v === 'all' ? 'All time' : '',
  kind: (v) => `Records: ${v === 'xrays' ? 'X-rays' : v === 'treatments' ? 'Treatments' : v}`,
  procedure: (v) => `Procedure: ${v}`,
  page: (v) => `Page ${v}`,
  viewDays: (v) => `View events: ${v} days`,
  changeDays: (v) => `Change events: ${v} days`,
  deleted: (v) =>
    [v?.procedureName, v?.toothNumber && (v.toothNumber === 'ALL' ? 'all teeth' : `tooth ${v.toothNumber}`), v?.treatmentDate]
      .filter(Boolean)
      .join(', '),
}

export function formatAuditDetails(details) {
  if (!details || typeof details !== 'object') return ''
  return Object.entries(details)
    .filter(([key, value]) => !HIDDEN_DETAIL_KEYS.has(key) && Object.hasOwn(DETAIL_FORMATTERS, key) && value !== null && value !== '' && value !== undefined)
    .map(([key, value]) => DETAIL_FORMATTERS[key](value))
    .filter(Boolean)
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
const GROUPABLE = new Set(['VIEW_XRAY', 'VIEW_HELD_XRAY', 'CREATE_CHART_ENTRY', 'ANNOTATE_XRAY', 'LOGIN_FAILED'])
const GROUP_WINDOW_MS = 2 * 60 * 1000

function recordIdentity(log) {
  if (log.patient_code) return `patient:${log.patient_code}`
  if (log.entity_type && log.entity_id != null) return `${log.entity_type}:${log.entity_id}`
  return log.action === 'LOGIN_FAILED' ? 'no-patient' : `unresolved:${log.id}`
}

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
      last.ip_address === log.ip_address &&
      recordIdentity(last) === recordIdentity(log) &&
      new Date(last.created_at).toDateString() === new Date(log.created_at).toDateString() &&
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
