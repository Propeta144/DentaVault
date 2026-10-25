import * as dashboardModel from '../models/dashboardModel.js'
import * as auditLogModel from '../models/auditLogModel.js'
import { listPatients } from '../models/patientModel.js'
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
    recentPatients,
    allergiesNotRecorded,
  ] = await Promise.all([
    dashboardModel.getActivePatientCount(),
    dashboardModel.getTreatmentsThisMonthCount(),
    dashboardModel.getXraysThisMonthCount(),
    countUnreviewedEmailXrays(),
    dashboardModel.getProcedureBreakdown(),
    dashboardModel.getConditionBreakdown(),
    dashboardModel.getMonthlyTrend(),
    // "Recent Activity" sa Dashboard: mga ginawa sa records lang. Hindi
    // kasama ang pagbukas ng Dashboard/Audit Log mismo at ang matagumpay na
    // login, kung hindi puro "Opened the dashboard" / "Signed in" ang laman.
    // Nasa buong Audit Log page pa rin silang lahat. (Kasama pa rin ang
    // LOGIN_FAILED: may kinalaman sa seguridad.) 20 ang kinukuha:
    // pinagsasama pa sa client ang magkakasunod na VIEW_XRAY
    // (groupAuditLogs), tapos 8 grupo lang ang ipinapakita.
    auditLogModel.listAuditLogs({
      limit: 20,
      offset: 0,
      excludeActions: [
        'VIEW_DASHBOARD', 'VIEW_AUDIT_LOG', 'LOGIN_SUCCESS', 'LOGOUT',
        // Account events, hindi records (dati puro "Changed own password")
        'CHANGE_OWN_PASSWORD', 'PASSWORD_UPGRADE_REQUIRED',
      ],
    }),
    // Patient-first na simula (critique 2026-10-25): "sino ang susunod sa
    // upuan" ang unang tanong ng dentist, hindi "kumusta ang clinic". Parehong
    // "Recently seen" ng Ctrl+K (pinakabagong treatment muna).
    listPatients({ sort: 'last_visit', limit: 6, offset: 0 }),
    dashboardModel.getAllergiesNotRecorded({ limit: 5 }),
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
    // Walang numeric id sa response (Feature #7): patient_code lang
    recentPatients: recentPatients.rows.map(({ id, ...rest }) => rest),
    allergiesNotRecorded,
  })
})
