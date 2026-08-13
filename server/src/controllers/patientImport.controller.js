import { importPatients, IMPORT_TEMPLATE_HEADERS } from '../services/patientImportService.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'
import { csvField } from '../utils/csv.js'

export const importFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('A CSV or JSON file is required', 422)
  }

  const result = await importPatients(req.file.buffer, req.file.originalname, req.user.userId)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'IMPORT_LEGACY_PATIENTS',
    entityType: 'patient',
    details: {
      filename: req.file.originalname,
      totalRows: result.totalRows,
      createdCount: result.createdCount,
      duplicateCount: result.duplicateCount,
      errorCount: result.errorCount,
    },
    ipAddress: req.ip,
  })

  res.json(result)
})

export const downloadTemplate = (req, res) => {
  const exampleRow = [
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
  ]
  const csv = [
    IMPORT_TEMPLATE_HEADERS.map(csvField).join(','),
    exampleRow.map(csvField).join(','),
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="dentavault-patient-import-template.csv"')
  res.send(csv)
}
