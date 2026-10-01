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

// Yung `search`, tumutugma sa kung sino ang gumawa (dentist name) at ano
// yung ginawa niya (action code, record type, o yung eksaktong record
// number kung numeric yung search term) — dalawang bagay na talagang
// hinahanap ng dentist kapag ire-reconstruct niya kung "sino gumawa ng
// ano". Yung `action` at date range naman, mas pinapaliit pa. Optional
// lahat ng apat, tapos AND ang pagsasama nila.
function buildAuditLogQuery({ search, action, dateFrom, dateTo }) {
  const conditions = []
  const params = {}

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    conditions.push(
      '(u.full_name LIKE :search OR al.action LIKE :search OR al.entity_type LIKE :search OR al.entity_id = :searchId)',
    )
    params.search = `%${trimmedSearch}%`
    params.searchId = Number(trimmedSearch) || 0 // 0, hindi 'to matutugma ng tunay na id — safe na "walang numeric term" sentinel
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
export async function listAuditLogs({ limit, offset, search, action, dateFrom, dateTo }) {
  const { where, params } = buildAuditLogQuery({ search, action, dateFrom, dateTo })

  const [rows] = await pool.execute(
    `SELECT al.id, al.user_id, u.full_name AS user_name, u.role AS user_role,
            al.action, al.entity_type, al.entity_id, al.details, al.ip_address, al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC, al.id DESC
     ${limitOffset(limit, offset)}`,
    params,
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${where}`,
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
