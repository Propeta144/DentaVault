import { importPatients, previewImport, IMPORT_TEMPLATE_HEADERS } from '../services/patientImportService.js'
import { EXTRA_PATIENT_FIELDS } from '../utils/patientFields.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'
import { csvField } from '../utils/csv.js'
import { buildXlsxTemplate } from '../utils/xlsx.js'

// Mapping galing sa Map Columns step: { first_name: "First Name", ... }
// (JSON string sa multipart form). Wala = auto-match sa server.
function parseMapping(raw) {
  if (!raw) return undefined
  try {
    const mapping = JSON.parse(raw)
    return mapping && typeof mapping === 'object' ? mapping : undefined
  } catch {
    throw new AppError('Column mapping is not valid', 422)
  }
}

// Migration wizard step 1 → 2: headers + unang 5 row + mungkahing mapping.
// Walang isinusulat, kaya walang audit entry.
export const previewFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('An Excel, CSV, or JSON file is required', 422)
  res.json(await previewImport(req.file.buffer, req.file.originalname))
})

// `?dryRun=1` = Validate / Preview step: parehong pagsusuri at resulta,
// pero walang isinusulat sa database (at walang audit entry).
export const importFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('An Excel, CSV, or JSON file is required', 422)
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true'
  const mapping = parseMapping(req.body.mapping)

  const result = await importPatients(req.file.buffer, req.file.originalname, req.user.userId, { mapping, dryRun })

  if (!dryRun) {
    await recordAuditLog({
      userId: req.user.userId,
      action: 'IMPORT_LEGACY_PATIENTS',
      entityType: 'patient',
      details: {
        filename: req.file.originalname,
        totalRows: result.totalRows,
        createdCount: result.createdCount,
        treatmentsAddedCount: result.treatmentsAddedCount,
        duplicateCount: result.duplicateCount,
        errorCount: result.errorCount,
      },
      ipAddress: req.ip,
    })
  }

  res.json(result)
})

// Mga header ng template: madaling basahin sa Excel, may * sa required at
// may halimbawang format sa loob ng ( ). Kusa pa rin silang nakikilala ng
// auto-match (normalizeHeader sa patientImportService ay hindi pinapansin
// ang * at ang nasa loob ng panaklong).
const TEMPLATE_COLUMN_TITLES = {
  first_name: 'First Name *',
  last_name: 'Last Name *',
  sex: 'Sex * (male/female)',
  date_of_birth: 'Date of Birth * (MM/DD/YYYY)',
  contact_number: 'Contact Number (09XXXXXXXXX)',
  email: 'Email',
  address: 'Address',
  medical_history: 'Medical History',
  allergies: 'Allergies (or None)',
  emergency_contact_name: 'Emergency Contact Name',
  emergency_contact_phone: 'Emergency Contact Phone',
  procedure_name: 'Procedure (past visit)',
  treatment_date: 'Treatment Date (MM/DD/YYYY)',
  tooth_number: 'Tooth Number (e.g. 26 or ALL)',
  treatment_notes: 'Treatment Notes',
  // Patient Information Record (papel na form ng clinic)
  ...Object.fromEntries(
    EXTRA_PATIENT_FIELDS.map((f) => [f.column, f.type === 'bool' ? `${f.label}? (Yes/No)` : f.label]),
  ),
}

// Excel template: Text format (para hindi mawala ang "0" ng 09...), date
// format, at dropdown. Text ang blood pressure (ginagawang petsa ng Excel
// ang "120/80") at ang last dental visit (malayang sagot, hal. "2019").
const TEXT_COLUMNS = new Set([
  'contact_number',
  'emergency_contact_phone',
  'tooth_number',
  'physician_office_number',
  'blood_pressure',
  'bleeding_time',
  'last_dental_visit',
])
const DATE_COLUMNS = new Set(['date_of_birth', 'treatment_date'])
const BOOL_COLUMNS = new Set(EXTRA_PATIENT_FIELDS.filter((f) => f.type === 'bool').map((f) => f.column))

// Blangkong template (header row lang). Dati may 2 halimbawang row
// ("Juan Dela Cruz"), kaya kailangan pang burahin bago mag-encode, at
// kapag nakalimutan, naiimport ang pekeng patient. Ang paliwanag kung paano
// punan ay nasa Upload step ng Migration page.
// Default = Excel (.xlsx); `?format=csv` = CSV (para sa ibang spreadsheet app).
export const downloadTemplate = asyncHandler(async (req, res) => {
  if (req.query.format === 'csv') {
    const csv = IMPORT_TEMPLATE_HEADERS.map((field) => csvField(TEMPLATE_COLUMN_TITLES[field])).join(',') + '\n'
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="dentavault-patient-import-template.csv"')
    return res.send(csv)
  }

  const columns = IMPORT_TEMPLATE_HEADERS.map((field) => ({
    field,
    title: TEMPLATE_COLUMN_TITLES[field],
    kind: TEXT_COLUMNS.has(field) ? 'text' : DATE_COLUMNS.has(field) ? 'date' : 'general',
    choices: field === 'sex' ? ['male', 'female'] : BOOL_COLUMNS.has(field) ? ['Yes', 'No'] : undefined,
  }))
  const file = await buildXlsxTemplate(columns)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="dentavault-patient-import-template.xlsx"')
  res.send(file)
})
