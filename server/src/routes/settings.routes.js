import { Router } from 'express'
import * as settingsController from '../controllers/settings.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Dentist at patient (kanya-kanyang account lang ang nakikita)
router.get('/', settingsController.get)

export default router
