import { Router } from 'express'
import pool from '../config/db.js'
import authRoutes from './auth.routes.js'
import patientsRoutes from './patients.routes.js'
import xraysRoutes from './xrays.routes.js'
import chartRoutes from './chart.routes.js'
import auditLogRoutes from './auditLog.routes.js'
import dashboardRoutes from './dashboard.routes.js'
import settingsRoutes from './settings.routes.js'

const router = Router()

// Binibisita ng uptime monitor (UptimeRobot) bawat 5 minuto (#34): gising ang
// server at ang database, at may email alert kapag may problema sa alinman.
// Walang detalye ng error sa sagot (public ang endpoint), status lang.
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'ok' })
  } catch (err) {
    console.error('Health check: database unreachable:', err.message)
    res.status(503).json({ status: 'error', database: 'unreachable' })
  }
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
