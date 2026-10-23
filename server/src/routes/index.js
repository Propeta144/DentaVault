import { Router } from 'express'
import authRoutes from './auth.routes.js'
import patientsRoutes from './patients.routes.js'
import xraysRoutes from './xrays.routes.js'
import chartRoutes from './chart.routes.js'
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
// Sarili nilang full paths ang dinedefine ng xraysRoutes at chartRoutes
// (hal. /patients/:patientCode/xrays) sa halip na sumali sa '/patients'
// prefix, dahil bawat isa, sumasaklaw sa parehong patient-scoped at
// sub-resource-scoped na route.
router.use(xraysRoutes)
router.use(chartRoutes)
router.use(auditLogRoutes)
router.use(dashboardRoutes)

export default router
