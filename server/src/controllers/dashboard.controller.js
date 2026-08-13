import * as dashboardModel from '../models/dashboardModel.js'
import * as auditLogModel from '../models/auditLogModel.js'
import { countUnreviewedEmailXrays } from '../models/xrayModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'

// Isang aggregated response lang, same reasoning sa `summary` ng
// patients.controller.js — isang screen lang naman ang dashboard na may
// isang loading state, kaya hindi na kailangan ng limang hiwalay na round
// trips para lang maging "RESTful".
export const get = asyncHandler(async (req, res) => {
  const [
    activePatients,
    treatmentsThisMonth,
    xraysThisMonth,
    unreviewedXrays,
    procedureBreakdown,
    conditionBreakdown,
    monthlyTrend,
    recentActivity,
  ] = await Promise.all([
    dashboardModel.getActivePatientCount(),
    dashboardModel.getTreatmentsThisMonthCount(),
    dashboardModel.getXraysThisMonthCount(),
    countUnreviewedEmailXrays(),
    dashboardModel.getProcedureBreakdown(),
    dashboardModel.getConditionBreakdown(),
    dashboardModel.getMonthlyTrend(),
    auditLogModel.listAuditLogs({ limit: 8, offset: 0 }),
  ])

  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_DASHBOARD',
    ipAddress: req.ip,
  })

  res.json({
    stats: { activePatients, treatmentsThisMonth, xraysThisMonth, unreviewedXrays },
    procedureBreakdown,
    conditionBreakdown,
    monthlyTrend,
    recentActivity: recentActivity.rows,
  })
})
