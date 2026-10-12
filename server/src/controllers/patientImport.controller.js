import { importPatients, previewImport, IMPORT_TEMPLATE_HEADERS } from '../services/patientImportService.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'
import { csvField } from '../utils/csv.js'

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
  if (!req.file) throw new AppError('A CSV or JSON file is required', 422)
  res.json(previewImport(req.file.buffer, req.file.originalname))
})

// `?dryRun=1` = Validate / Preview step: parehong pagsusuri at resulta,
// pero walang isinusulat sa database (at walang audit entry).
export const importFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('A CSV or JSON file is required', 422)
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
}

// Blangkong template (header row lang). Dati may 2 halimbawang row
// ("Juan Dela Cruz"), kaya kailangan pang burahin bago mag-encode, at
// kapag nakalimutan, naiimport ang pekeng patient. Ang paliwanag kung paano
// punan ay nasa Upload step ng Migration page.
export const downloadTemplate = (req, res) => {
  const csv = IMPORT_TEMPLATE_HEADERS.map((field) => csvField(TEMPLATE_COLUMN_TITLES[field])).join(',') + '\n'

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="dentavault-patient-import-template.csv"')
  res.send(csv)
}
