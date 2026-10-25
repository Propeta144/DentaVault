import * as auditLogModel from '../models/auditLogModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getRetentionConfig } from '../services/auditRetentionService.js'
import { queryText, queryInt } from '../utils/query.js'

// Pang-araw-araw na ingay: pagbukas ng mga page at matagumpay na
// pag-sign in/out. Nakatago sa default view ng Audit Log (critique
// 2026-10-25: halos puro "Opened the dashboard" / "Signed in" ang laman), pero
// nandiyan pa rin sa database at lumalabas sa "Show sign-ins and page views"
// o kapag pinili mismo sa Action filter. Ang LOGIN_FAILED at pagpalit ng
// password ay hindi kasama rito (seguridad).
const ROUTINE_ACTIONS = ['VIEW_DASHBOARD', 'VIEW_AUDIT_LOG', 'VIEW_XRAY_INBOX', 'LOGIN_SUCCESS', 'LOGOUT']

export const list = asyncHandler(async (req, res) => {
  const page = queryInt(req.query.page, { min: 1, max: 100000, fallback: 1 })
  const limit = queryInt(req.query.limit, { min: 1, max: 100, fallback: 50 })
  const offset = (page - 1) * limit
  const action = queryText(req.query.action)
  const hideRoutine = queryText(req.query.routine) === 'hide' && !action

  const { rows, total } = await auditLogModel.listAuditLogs({
    limit,
    offset,
    search: queryText(req.query.search),
    action,
    dateFrom: queryText(req.query.dateFrom),
    dateTo: queryText(req.query.dateTo),
    excludeActions: hideRoutine ? ROUTINE_ACTIONS : [],
  })

  // Yung pag-view ng audit trail mismo, kabilang na rin sa klase ng
  // sensitive access na dapat i-track ng buong table na 'to — consistent
  // naman sa ibang sensitive reads sa app (VIEW_PATIENT, VIEW_XRAY, atbp).
  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_AUDIT_LOG',
    ipAddress: req.ip,
  })

  // Retention info para maipakita sa page kung gaano katagal nananatili ang
  // entries dito bago ilipat sa archive (araw lang — hindi kasama ang path).
  const { enabled, viewDays, changeDays } = getRetentionConfig()
  res.json({
    logs: rows,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    retention: { enabled, viewDays, changeDays },
  })
})

// Ito yung nasa likod ng "Action" filter dropdown. Hindi ito naka-log
// bilang sensitive access — nagre-reveal lang naman ito ng vocabulary ng
// action types, hindi kailanman ng aktwal na log entry — kaya hindi na
// idadagdag ang VIEW_AUDIT_LOG entry tuwing magloload yung page, on top pa
// ng isang naitatala na ng `list`.
export const listActions = asyncHandler(async (req, res) => {
  const actions = await auditLogModel.listDistinctActions()
  res.json({ actions })
})
