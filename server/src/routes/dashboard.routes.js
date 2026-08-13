import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'

const router = Router()

router.use(authenticate)

// Nag-aaggregate ng counts sa buong patients/treatments/x-rays/chart
// entries — dentist-only, gaya ng ibang clinic-wide (hindi single-record)
// na view.
router.get('/dashboard', requireRole('dentist'), dashboardController.get)

export default router
