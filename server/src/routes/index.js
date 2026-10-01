import { Router } from 'express'
import authRoutes from './auth.routes.js'
import patientsRoutes from './patients.routes.js'
import xraysRoutes from './xrays.routes.js'
import chartRoutes from './chart.routes.js'
import webhooksRoutes from './webhooks.routes.js'
import auditLogRoutes from './auditLog.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import settingsRoutes from './settings.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

router.use('/auth', authRoutes)
router.use('/patients', patientsRoutes)
router.use('/settings', settingsRoutes)
// DAPAT mauna maregister ang webhooksRoutes bago yung xraysRoutes/
// chartRoutes: yung dalawang 'yon kasi, minomount nila si `authenticate`
// gamit ang router.use() sa sarili nilang root (walang path), kaya
// tatakbo 'to sa bawat request na nakakarating sa router na 'yon — kahit
// yung mga hindi tumutugma sa kahit anong route sa loob — bago pa man
// tignan ni Express yung path pattern. Hindi naman tumutugma yung webhook
// path ni Mailgun sa kahit ano sa xraysRoutes/chartRoutes, pero
// mare-reject pa rin ito sa authenticate gate nila habang dumadaan kung
// naregister 'to pagkatapos nila.
router.use(webhooksRoutes)
// Sarili nilang full paths ang dinedefine ng xraysRoutes at chartRoutes
// (hal. /patients/:patientCode/xrays) sa halip na sumali sa '/patients'
// prefix, dahil bawat isa, sumasaklaw sa parehong patient-scoped at
// sub-resource-scoped na route.
router.use(xraysRoutes)
router.use(chartRoutes)
router.use(auditLogRoutes)
router.use(dashboardRoutes)

export default router
