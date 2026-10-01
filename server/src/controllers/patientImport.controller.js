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

export const downloadTemplate = (req, res) => {
  // Isang patient, dalawang rows: ganito ipinapakita kung paano isasama
  // yung buong treatment history sa parehong file — ulitin lang yung
  // first_name/last_name/sex/date_of_birth (kailangan magkatugma, dahil
  // dito nakikilala kung parehong tao), tapos palitan na lang yung
  // procedure_name/treatment_date/tooth_number bawat past visit. Yung
  // demographic columns sa 2nd row, pwede nang iwan blangko maliban sa
  // required 4 — hindi na basahin kung meron nang existing patient match.
  const exampleRows = [
    [
      'Juan',
      'Dela Cruz',
      'male',
      '1985-03-14',
      '09171234567',
      'juan@example.com',
      'Bacoor City, Cavite',
      'None',
      'Penicillin',
      'Maria Dela Cruz',
      '09179876543',
      'Oral Prophylaxis / Cleaning',
      '2023-06-10',
      'ALL',
      'Routine cleaning, no issues noted',
    ],
    [
      'Juan',
      'Dela Cruz',
      'male',
      '1985-03-14',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Composite Restoration / Filling',
      '2024-01-22',
      '26',
      'Small cavity, resin filling',
    ],
  ]
  const csv = [
    IMPORT_TEMPLATE_HEADERS.map(csvField).join(','),
    ...exampleRows.map((row) => row.map(csvField).join(',')),
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="dentavault-patient-import-template.csv"')
  res.send(csv)
}
