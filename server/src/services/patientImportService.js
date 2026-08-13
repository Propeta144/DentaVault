import { parse as parseCsv } from 'csv-parse/sync'
import * as patientModel from '../models/patientModel.js'
import AppError from '../utils/AppError.js'

const REQUIRED_COLUMNS = ['first_name', 'last_name', 'sex', 'date_of_birth']
const OPTIONAL_COLUMNS = [
  'contact_number',
  'email',
  'address',
  'medical_history',
  'allergies',
  'emergency_contact_name',
  'emergency_contact_phone',
]

export const IMPORT_TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]

function parseFile(buffer, originalname) {
  const isJson = /\.json$/i.test(originalname)
  if (isJson) {
    let parsed
    try {
      parsed = JSON.parse(buffer.toString('utf8'))
    } catch {
      throw new AppError('That JSON file is not valid JSON', 422)
    }
    if (!Array.isArray(parsed)) {
      throw new AppError('JSON import must be an array of patient objects', 422)
    }
    return parsed
  }

  try {
    return parseCsv(buffer.toString('utf8'), {
      columns: (header) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')),
      trim: true,
      skip_empty_lines: true,
    })
  } catch (err) {
    throw new AppError(`Could not parse CSV: ${err.message}`, 422)
  }
}

// Tinatanggap yung common real-world variants na baka gamitin ng existing
// paper/Excel records ng clinic ("M", "Male", "female") tapos ino-normalize
// papunta sa DB enum.
function normalizeSex(value) {
  const v = String(value || '').trim().toLowerCase()
  if (['m', 'male'].includes(v)) return 'male'
  if (['f', 'female'].includes(v)) return 'female'
  return null
}

// Tinatanggap ang YYYY-MM-DD o MM/DD/YYYY; tinatanggihan yung iba pa sa
// halip na manghula, kasi mas malala pa yung tahimik na na-misparse na
// birth date kaysa sa isang rejected row.
function normalizeDate(value) {
  const v = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return isValidCalendarDate(v) ? v : null
  }
  const usMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (usMatch) {
    const [, month, day, year] = usMatch
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    return isValidCalendarDate(iso) ? iso : null
  }
  return null
}

function isValidCalendarDate(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return false
  if (date > new Date()) return false
  return true
}

function validateAndNormalizeRow(raw) {
  const errors = []
  const firstName = String(raw.first_name || '').trim()
  const lastName = String(raw.last_name || '').trim()
  const sex = normalizeSex(raw.sex)
  const dateOfBirth = normalizeDate(raw.date_of_birth)

  if (!firstName) errors.push('first_name is required')
  if (!lastName) errors.push('last_name is required')
  if (!sex) errors.push(`sex must be male/female (got "${raw.sex ?? ''}")`)
  if (!dateOfBirth) errors.push(`date_of_birth is invalid or missing (got "${raw.date_of_birth ?? ''}")`)

  if (errors.length > 0) return { errors }

  return {
    data: {
      firstName,
      lastName,
      sex,
      dateOfBirth,
      contactNumber: raw.contact_number ? String(raw.contact_number).trim() : null,
      email: raw.email ? String(raw.email).trim() : null,
      address: raw.address ? String(raw.address).trim() : null,
      medicalHistory: raw.medical_history ? String(raw.medical_history).trim() : null,
      allergies: raw.allergies ? String(raw.allergies).trim() : null,
      emergencyContactName: raw.emergency_contact_name ? String(raw.emergency_contact_name).trim() : null,
      emergencyContactPhone: raw.emergency_contact_phone ? String(raw.emergency_contact_phone).trim() : null,
      isLegacyMigrated: true,
    },
  }
}

// Pinoproseso bawat row nang independente — hindi dapat maharang yung
// ibang 199 sa pag-import dahil lang sa isang malformed row sa 200-row
// sheet. Nagbabalik ng per-row report para makita mismo ng dentist/staff
// kung ano talaga ang kailangang ayusin.
export async function importPatients(buffer, originalname, importedByUserId) {
  const rawRows = parseFile(buffer, originalname)
  if (rawRows.length === 0) {
    throw new AppError('The file has no rows to import', 422)
  }

  const created = []
  const duplicates = []
  const rowErrors = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2 // +1 para sa 0-index, +1 para sa header row
    const { data, errors } = validateAndNormalizeRow(rawRows[i])

    if (errors) {
      rowErrors.push({ row: rowNumber, errors })
      continue
    }

    const existing = await patientModel.findPatientByNameAndDob(
      data.firstName,
      data.lastName,
      data.dateOfBirth,
    )
    if (existing) {
      duplicates.push({ row: rowNumber, name: `${data.firstName} ${data.lastName}`, existingPatientId: existing.id })
      continue
    }

    const patient = await patientModel.createPatient(data)
    created.push({ row: rowNumber, id: patient.id, name: `${patient.first_name} ${patient.last_name}` })
  }

  return {
    totalRows: rawRows.length,
    createdCount: created.length,
    duplicateCount: duplicates.length,
    errorCount: rowErrors.length,
    created,
    duplicates,
    errors: rowErrors,
    importedByUserId,
  }
}
