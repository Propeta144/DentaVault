import { Router } from 'express'
import { body } from 'express-validator'
import * as chartController from '../controllers/chart.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'

const router = Router()

router.use(authenticate)

const SURFACES = ['mesial', 'distal', 'occlusal', 'facial', 'lingual', 'whole']
const CONDITIONS = ['healthy', 'caries', 'filling', 'root_canal', 'crown', 'extracted']

router.get('/patients/:patientCode/chart', chartController.getCurrentChart)
router.get('/patients/:patientCode/chart/:toothNumber/history', chartController.getToothHistory)

router.post(
  '/patients/:patientCode/chart',
  requireRole('dentist'),
  [
    body('toothNumber').trim().notEmpty().withMessage('Tooth number is required'),
    body('surface').isIn(SURFACES).withMessage('Invalid surface'),
    body('conditionCode').isIn(CONDITIONS).withMessage('Invalid condition'),
    body('strokeData').optional({ nullable: true }).isArray().withMessage('strokeData must be an array'),
  ],
  chartController.createEntry,
)

export default router
