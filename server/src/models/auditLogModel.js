import pool from '../config/db.js'
import { limitOffset } from '../utils/sqlLimit.js'

// Dapat tawagin 'to sa bawat write action, at bawat pag-view ng sensitive
// data (patient records, x-rays). Tignan yung RA 10173 requirement sa
// proposal.
export async function recordAuditLog({ userId, action, entityType, entityId, details, ipAddress }) {
  await pool.execute(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
     VALUES (:userId, :action, :entityType, :entityId, :details, :ipAddress)`,
    {
      userId: userId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
      ipAddress: ipAddress ?? null,
    },
  )
}

// Ibinabalik ni mysql2 yung JSON columns bilang raw text, hindi parsed
// value — same gotcha gaya ng xray_images.annotations (tignan xrayModel.js).
// Kailangan i-parse pabalik dito sa bawat read path, kung hindi, makukuha
// ng caller string kung saan object naman yung inaasahan ng UI.
function parseDetails(row) {
  if (row.details && typeof row.details === 'string') {
    row.details = JSON.parse(row.details)
  }
  return row
}

// Kung KANINONG patient ang isang log entry. Dati "patient #1" /
// "xray_image #4" lang ang naipapakita sa Audit Log page (numeric internal
// ID — salungat sa Feature #7 na walang patient ID sa screen). Ngayon,
// hinahanap ang patient mula sa entity mismo:
//   patient                              → entity_id na mismo ang patient
//   treatment / xray_image / chart_entry → patient_id ng row na iyon
//   user                                 → patient_id ng portal account (null kung dentist)
//   kahit ano                            → details.patientId, kung meron
// Kasama ang soft-deleted na patients (walang deleted_at filter), para may
// pangalan pa rin ang mga lumang log ng nabura nang patient.
// Single quotes lang sa SQL (naka-ANSI_QUOTES ang Aiven).
const AUDIT_FROM = `
  FROM audit_logs al
  LEFT JOIN users u ON u.id = al.user_id
  LEFT JOIN treatments rt ON al.entity_type = 'treatment' AND rt.id = al.entity_id
  LEFT JOIN xray_images rx ON al.entity_type = 'xray_image' AND rx.id = al.entity_id
  LEFT JOIN chart_entries rc ON al.entity_type = 'chart_entry' AND rc.id = al.entity_id
  LEFT JOIN users ru ON al.entity_type = 'user' AND ru.id = al.entity_id
  LEFT JOIN patients rp ON rp.id = COALESCE(
    CASE WHEN al.entity_type = 'patient' THEN al.entity_id END,
    rt.patient_id, rx.patient_id, rc.patient_id, ru.patient_id,
    CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.patientId')) AS UNSIGNED)
  )`

// Yung `search`, tumutugma sa kung sino ang gumawa (dentist name), kaninong
// patient (pangalan), at ano yung ginawa niya (action code o record type).
// Yung `action` at date range naman, mas pinapaliit pa. Optional lahat,
// tapos AND ang pagsasama nila. `excludeActions`: galing lang sa sariling
// code (hal. Dashboard), hindi sa user input, at placeholders pa rin ang
// gamit.
function buildAuditLogQuery({ search, action, dateFrom, dateTo, excludeActions = [] }) {
  const conditions = []
  const params = {}

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    conditions.push(
      `(u.full_name LIKE :search OR CONCAT(rp.first_name, ' ', rp.last_name) LIKE :search
        OR al.action LIKE :search OR al.entity_type LIKE :search)`,
    )
    params.search = `%${trimmedSearch}%`
  }
  if (excludeActions.length) {
    const placeholders = excludeActions.map((actionCode, i) => {
      params[`exclude${i}`] = actionCode
      return `:exclude${i}`
    })
    conditions.push(`al.action NOT IN (${placeholders.join(', ')})`)
  }
  if (action) {
    conditions.push('al.action = :action')
    params.action = action
  }
  if (dateFrom) {
    conditions.push('al.created_at >= :dateFrom')
    params.dateFrom = `${dateFrom} 00:00:00`
  }
  if (dateTo) {
    conditions.push('al.created_at <= :dateTo')
    params.dateTo = `${dateTo} 23:59:59`
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { where, params }
}

// 'To yung nagpapagana sa audit log viewer page (dentist-only). Newest
// first, kasi halos palagi naman, recent activity ang pinapansin ng
// dentist kapag chinicheck niya kung "sino gumawa ng ano".
export async function listAuditLogs({ limit, offset, search, action, dateFrom, dateTo, excludeActions }) {
  const { where, params } = buildAuditLogQuery({ search, action, dateFrom, dateTo, excludeActions })

  const [rows] = await pool.execute(
    `SELECT al.id, al.user_id, u.full_name AS user_name, u.role AS user_role,
            al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at,
            CONCAT(rp.first_name, ' ', rp.last_name) AS patient_name
     ${AUDIT_FROM}
     ${where}
     ORDER BY al.created_at DESC, al.id DESC
     ${limitOffset(limit, offset)}`,
    params,
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total ${AUDIT_FROM} ${where}`,
    params,
  )
  return { rows: rows.map(parseDetails), total }
}

// Yung distinct action codes na talagang nasa table, para sa filter
// dropdown — unconditional yung pag-query (hindi scoped sa current
// filter), para hindi kailanman lumiit yung option list ng dropdown base
// sa kung ano na yung na-filter mo na.
export async function listDistinctActions() {
  const [rows] = await pool.execute('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC')
  return rows.map((r) => r.action)
}
