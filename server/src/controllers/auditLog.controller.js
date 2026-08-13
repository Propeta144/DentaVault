import * as auditLogModel from '../models/auditLogModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Number(req.query.limit) || 50)
  const offset = (page - 1) * limit

  const { rows, total } = await auditLogModel.listAuditLogs({
    limit,
    offset,
    search: req.query.search?.trim(),
    action: req.query.action?.trim(),
    dateFrom: req.query.dateFrom?.trim(),
    dateTo: req.query.dateTo?.trim(),
  })

  // Yung pag-view ng audit trail mismo, kabilang na rin sa klase ng
  // sensitive access na dapat i-track ng buong table na 'to — consistent
  // naman sa ibang sensitive reads sa app (VIEW_PATIENT, VIEW_XRAY, atbp).
  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_AUDIT_LOG',
    ipAddress: req.ip,
  })

  res.json({ logs: rows, page, limit, total, totalPages: Math.ceil(total / limit) })
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
