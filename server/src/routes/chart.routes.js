import { Router } from 'express'
import { body } from 'express-validator'
import * as chartController from '../controllers/chart.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { FIELD_LIMITS, CHART_CONDITIONS, isValidToothNumber } from '../utils/validators.js'
import { isValidStrokeData } from '../utils/drawingData.js'

const router = Router()

router.use(authenticate)

const SURFACES = ['mesial', 'distal', 'occlusal', 'facial', 'lingual', 'whole']

router.get('/patients/:patientCode/chart', chartController.getCurrentChart)
router.get('/patients/:patientCode/chart/:toothNumber/history', chartController.getToothHistory)
// Intraoral Examination (Periodontal, Occlusion, Appliances, TMD): para sa
// buong bibig, hindi bawat ngipin
router.get('/patients/:patientCode/intraoral', chartController.getIntraoral)
router.put('/patients/:patientCode/intraoral', requireRole('dentist'), chartController.saveIntraoral)

router.post(
  '/patients/:patientCode/chart',
  requireRole('dentist'),
  [
    body('toothNumber')
      .trim()
      .custom(isValidToothNumber)
      .withMessage('Tooth number must be an FDI number (11–48, or 51–85 for baby teeth)'),
    body('surface').isIn(SURFACES).withMessage('Invalid surface'),
    body('conditionCode').isIn(CHART_CONDITIONS).withMessage('Invalid condition'),
    // Laman din ng bawat guhit, hindi lang kung array (#41)
    body('strokeData').optional({ nullable: true }).custom(isValidStrokeData),
    body('addTreatment').optional().isBoolean({ strict: true }).withMessage('addTreatment must be true or false'),
    body('notes')
      .optional({ values: 'falsy' })
      .isLength({ max: FIELD_LIMITS.notes })
      .withMessage(`Notes must be ${FIELD_LIMITS.notes} characters or fewer`),
  ],
  chartController.createEntry,
)

export default router
