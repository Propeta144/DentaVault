import { Router } from 'express'
import * as auditLogController from '../controllers/auditLog.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'

const router = Router()

router.use(authenticate)

// Sensitive din naman yung audit trail mismo (sino ang nag-access ng
// aling patient, kailan, saan galing) — dentist-only, gaya ng ibang
// oversight endpoint.
router.get('/audit-logs', requireRole('dentist'), auditLogController.list)
router.get('/audit-logs/actions', requireRole('dentist'), auditLogController.listActions)

export default router
