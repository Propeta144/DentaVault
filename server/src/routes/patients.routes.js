import { Router } from 'express'
import { body } from 'express-validator'
import * as patientsController from '../controllers/patients.controller.js'
import * as patientImportController from '../controllers/patientImport.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { uploadImportFile } from '../config/importUpload.js'

const router = Router()

router.use(authenticate)

// PH mobile format lang: 09XXXXXXXXX (11 digits) o +639XXXXXXXXX. Kailangan
// ding i-enforce dito, hindi lang client-side, kasi madaling ma-bypass
// yung client check ng kahit sinong tumatawag diretso sa API.
const PH_MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/

const patientValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('sex').isIn(['male', 'female']).withMessage('Sex must be male or female'),
  body('dateOfBirth').isISO8601().withMessage('A valid date of birth is required'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be valid'),
  body('contactNumber')
    .trim()
    .notEmpty()
    .withMessage('Contact number is required')
    .bail()
    .matches(PH_MOBILE_PATTERN)
    .withMessage('Contact number must be a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)'),
  body('emergencyContactPhone')
    .optional({ values: 'falsy' })
    .matches(PH_MOBILE_PATTERN)
    .withMessage('Emergency contact phone must be a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)'),
]

const treatmentValidation = [
  body('procedureName').trim().notEmpty().withMessage('Procedure name is required'),
  body('treatmentDate').isISO8601().withMessage('A valid treatment date is required'),
]

// Dentist lang ang nagrerehistro/nag-eedit ng patients at nag-lo-log ng
// treatments — read-only ang Patient role, ini-enforce dito (list/create/
// update) at per-record din sa loob ng controller (getOne/listTreatments/
// summary).
router.get('/', requireRole('dentist'), patientsController.list)
router.post('/', requireRole('dentist'), patientValidation, patientsController.create)

// DAPAT maregister ang mga 'to bago yung '/:id' sa baba — kung hindi,
// ipapares ni Express yung "/import" o "/export" bilang :id =
// "import"/"export" tapos hindi na kailanman tatakbo itong mga route na
// 'to.
router.get('/import/template', requireRole('dentist'), patientImportController.downloadTemplate)
router.post(
  '/import',
  requireRole('dentist'),
  uploadImportFile.single('file'),
  patientImportController.importFile,
)
router.get('/export', requireRole('dentist'), patientsController.exportCsv)

router.get('/:id', patientsController.getOne)
router.put('/:id', requireRole('dentist'), patientValidation, patientsController.update)
router.delete('/:id', requireRole('dentist'), patientsController.remove)

router.get('/:id/treatments', patientsController.listTreatments)
router.post(
  '/:id/treatments',
  requireRole('dentist'),
  treatmentValidation,
  patientsController.addTreatment,
)

router.get('/:id/summary', patientsController.summary)

router.get('/:id/portal-account', requireRole('dentist'), patientsController.getPortalAccount)
router.post(
  '/:id/portal-account',
  requireRole('dentist'),
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  patientsController.createPortalAccount,
)
router.put(
  '/:id/portal-account/password',
  requireRole('dentist'),
  [body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  patientsController.resetPortalAccountPassword,
)

export default router
