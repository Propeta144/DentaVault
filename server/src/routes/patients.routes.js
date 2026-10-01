import { Router } from 'express'
import { body } from 'express-validator'
import * as patientsController from '../controllers/patients.controller.js'
import * as patientImportController from '../controllers/patientImport.controller.js'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { uploadImportFile } from '../config/importUpload.js'
import { FIELD_LIMITS, notInFuture, stripPhoneFormatting } from '../utils/validators.js'

const router = Router()

router.use(authenticate)

// PH mobile format lang: 09XXXXXXXXX (11 digits) o +639XXXXXXXXX. Kailangan
// ding i-enforce dito, hindi lang client-side, kasi madaling ma-bypass
// yung client check ng kahit sinong tumatawag diretso sa API.
const PH_MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/

// Haba ng bawat field: tignan ang FIELD_LIMITS sa utils/validators.js.
const maxLength = (field, label) =>
  body(field)
    .optional({ values: 'falsy' })
    .isLength({ max: FIELD_LIMITS[field] })
    .withMessage(`${label} must be ${FIELD_LIMITS[field]} characters or fewer`)

const patientValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  maxLength('firstName', 'First name'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  maxLength('lastName', 'Last name'),
  // Walang default sa form (dati "Male" na agad), kaya required dito
  body('sex').isIn(['male', 'female']).withMessage('Select the patient’s sex'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('A valid date of birth is required')
    .bail()
    .custom(notInFuture)
    .withMessage('Date of birth cannot be in the future'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Email must be valid'),
  maxLength('email', 'Email'),
  body('contactNumber')
    .customSanitizer(stripPhoneFormatting)
    .notEmpty()
    .withMessage('Contact number is required')
    .bail()
    .matches(PH_MOBILE_PATTERN)
    .withMessage('Contact number must be a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)'),
  maxLength('address', 'Address'),
  maxLength('emergencyContactName', 'Emergency contact name'),
  body('emergencyContactPhone')
    .customSanitizer(stripPhoneFormatting)
    .optional({ values: 'falsy' })
    .matches(PH_MOBILE_PATTERN)
    .withMessage('Emergency contact phone must be a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)'),
  maxLength('medicalHistory', 'Medical history'),
  // Kaligtasan ng pasyente: kapag blangko, hindi malaman kung "walang
  // allergy" o "hindi natanong" — kaya kailangang sagutin ("None" o listahan).
  body('allergies')
    .trim()
    .notEmpty()
    .withMessage('Allergies is required. Choose "None" if the patient has no known allergies.'),
  maxLength('allergies', 'Allergies'),
]

const treatmentValidation = [
  body('procedureName').trim().notEmpty().withMessage('Procedure name is required'),
  maxLength('procedureName', 'Procedure name'),
  body('treatmentDate')
    .isISO8601()
    .withMessage('A valid treatment date is required')
    .bail()
    .custom(notInFuture)
    .withMessage('Treatment date cannot be in the future'),
  maxLength('notes', 'Notes'),
]

// Dentist lang ang nagrerehistro/nag-eedit ng patients at nag-lo-log ng
// treatments — read-only ang Patient role, ini-enforce dito (list/create/
// update) at per-record din sa loob ng controller (getOne/listTreatments/
// summary).
router.get('/', requireRole('dentist'), patientsController.list)
router.post('/', requireRole('dentist'), patientValidation, patientsController.create)

// DAPAT maregister ang mga 'to bago yung '/:code' sa baba — kung hindi,
// ipapares ni Express yung "/import" o "/export" bilang :code =
// "import"/"export" tapos hindi na kailanman tatakbo itong mga route na
// 'to.
router.get('/import/template', requireRole('dentist'), patientImportController.downloadTemplate)
router.post(
  '/import/preview',
  requireRole('dentist'),
  uploadImportFile.single('file'),
  patientImportController.previewFile,
)
router.post(
  '/import',
  requireRole('dentist'),
  uploadImportFile.single('file'),
  patientImportController.importFile,
)
router.get('/export', requireRole('dentist'), patientsController.exportCsv)

router.get('/:code', patientsController.getOne)
router.put('/:code', requireRole('dentist'), patientValidation, patientsController.update)
router.delete('/:code', requireRole('dentist'), patientsController.remove)

router.get('/:code/treatments', patientsController.listTreatments)
router.post(
  '/:code/treatments',
  requireRole('dentist'),
  treatmentValidation,
  patientsController.addTreatment,
)

// Legacy Record Migration → Manual Entry (maraming lumang treatment nang sabay)
router.post('/:code/treatments/batch', requireRole('dentist'), patientsController.addTreatmentsBatch)

router.get('/:code/summary', patientsController.summary)

router.get('/:code/portal-account', requireRole('dentist'), patientsController.getPortalAccount)
router.post(
  '/:code/portal-account',
  requireRole('dentist'),
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  patientsController.createPortalAccount,
)
router.put(
  '/:code/portal-account/password',
  requireRole('dentist'),
  [body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  patientsController.resetPortalAccountPassword,
)

export default router
