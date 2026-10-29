import { Router } from 'express'
import { body } from 'express-validator'
import * as xraysController from '../controllers/xrays.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { patientXrayUploadLimiter } from '../middleware/rateLimit.js'
import { uploadXray } from '../config/upload.js'
import { FIELD_LIMITS, notInFuture } from '../utils/validators.js'
import { isValidAnnotations } from '../utils/drawingData.js'

const router = Router()

router.use(authenticate)

// Patient-scoped 'to: listahan/pag-upload ng X-rays para sa isang partikular na patient.
router.get('/patients/:patientCode/xrays', xraysController.list)
// Dentist: kahit kaninong patient. Patient (#27): sariling record lang
// (tinitingnan sa controller gamit ang canAccessPatientRecord), may limit
// bawat araw na nauuna sa pagbasa ng file.
router.post(
  '/patients/:patientCode/xrays',
  requireRole('dentist', 'patient'),
  patientXrayUploadLimiter,
  uploadXray.single('file'),
  [
    body('takenDate')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Date taken must be a valid date')
      .bail()
      .custom(notInFuture)
      .withMessage('Date taken cannot be in the future'),
    body('notes')
      .optional({ values: 'falsy' })
      .isLength({ max: FIELD_LIMITS.notes })
      .withMessage(`Notes must be ${FIELD_LIMITS.notes} characters or fewer`),
  ],
  xraysController.upload,
)

// Dapat maregister bago yung '/xrays/:id/file' sa baba — kahit wala
// naman talagang collision dito (magkaiba yung segment counts), ganito na
// lang inilagay para tumugma sa convention ng codebase na 'to na ilista
// muna yung fixed paths bago yung :id routes.
router.get('/xrays/unreviewed-count', requireRole('dentist'), xraysController.unreviewedCount)
router.get('/xrays/inbox', requireRole('dentist'), xraysController.inbox)
router.put('/xrays/:id/reviewed', requireRole('dentist'), xraysController.markReviewed)

// X-ray-scoped 'to: gumagana sa isang image, base sa sarili niyang id.
router.get('/xrays/:id/file', xraysController.getFile)
router.put(
  '/xrays/:id/annotations',
  requireRole('dentist'),
  // Laman ng bawat guhit/text (#41): uri, coordinates, kulay, haba ng text, bilang
  [body('annotations').custom(isValidAnnotations)],
  xraysController.updateAnnotations,
)
// Patient: sariling upload lang na hindi pa nare-review (tignan controller)
router.delete('/xrays/:id', requireRole('dentist', 'patient'), xraysController.remove)

export default router
