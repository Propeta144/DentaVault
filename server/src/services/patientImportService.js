import { parse as parseCsv } from 'csv-parse/sync'
import * as patientModel from '../models/patientModel.js'
import * as treatmentModel from '../models/treatmentModel.js'
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

// Optional per-row treatment columns. The sheet is "long format" — a
// patient can appear on more than one row (same first_name+last_name+
// date_of_birth), one row per past visit, so a full treatment history can
// come in through the same single file instead of needing a second import
// or manual re-entry per patient afterward. A row with no procedure_name
// is treated as patient-info-only.
const TREATMENT_COLUMNS = ['procedure_name', 'treatment_date', 'tooth_number', 'treatment_notes']

// Mirrors client/src/constants/dental.js's PROCEDURES — kept as a separate
// copy here (server and client are separate npm packages, no shared
// package between them) rather than free text, so imported treatments
// group correctly with normal dentist-entered ones on the dashboard's
// "Most Common Procedures" breakdown and pick up the same whole-mouth
// tooth-selector behavior AddTreatmentForm.jsx applies on the client.
// Keep the two lists in sync if procedures are ever added/renamed.
const STANDARD_PROCEDURES = [
  { value: 'Oral Prophylaxis / Cleaning', wholeMouth: true },
  { value: 'Composite Restoration / Filling', wholeMouth: false },
  { value: 'Tooth Extraction', wholeMouth: false },
  { value: 'Root Canal Treatment', wholeMouth: false },
  { value: 'Crown / Bridge', wholeMouth: false },
  { value: 'Orthodontic Adjustment', wholeMouth: false },
  { value: 'Fluoride Treatment', wholeMouth: true },
]

function matchStandardProcedure(value) {
  const v = String(value || '').trim().toLowerCase()
  return STANDARD_PROCEDURES.find((p) => p.value.toLowerCase() === v) || null
}

export const IMPORT_TEMPLATE_HEADERS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS, ...TREATMENT_COLUMNS]

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

// A row with a blank procedure_name is patient-info-only (or a plain
// duplicate row) — hasTreatment stays false and the row is never rejected
// for missing treatment_date/tooth_number, since those only matter once
// there's actually a procedure to attach.
function validateAndNormalizeTreatmentRow(raw) {
  const rawProcedureName = raw.procedure_name ? String(raw.procedure_name).trim() : ''
  if (!rawProcedureName) return { hasTreatment: false }

  const errors = []

  const procedure = matchStandardProcedure(rawProcedureName)
  if (!procedure) {
    const valid = STANDARD_PROCEDURES.map((p) => p.value).join(', ')
    errors.push(`procedure_name "${rawProcedureName}" doesn't match a standard procedure. Valid values: ${valid}`)
  }

  const treatmentDate = normalizeDate(raw.treatment_date)
  if (!treatmentDate) {
    errors.push(`treatment_date is invalid or missing (got "${raw.treatment_date ?? ''}") — required when procedure_name is set`)
  }

  // Whole-mouth procedures (cleaning, fluoride) always apply to the whole
  // dentition, same as AddTreatmentForm.jsx locking the tooth selector to
  // ALL_TEETH client-side — whatever's in tooth_number for those rows is
  // moot, so it's not even validated.
  let toothNumber = null
  if (procedure?.wholeMouth) {
    toothNumber = 'ALL'
  } else {
    const rawTooth = raw.tooth_number ? String(raw.tooth_number).trim() : ''
    if (rawTooth) {
      if (rawTooth.toUpperCase() === 'ALL') {
        toothNumber = 'ALL'
      } else if (/^[1-4][1-8]$/.test(rawTooth)) {
        toothNumber = rawTooth
      } else {
        errors.push(`tooth_number must be a valid FDI tooth number (11-48) or "ALL" (got "${raw.tooth_number}")`)
      }
    }
  }

  if (errors.length > 0) return { hasTreatment: true, errors }

  return {
    hasTreatment: true,
    data: {
      procedureName: procedure.value,
      treatmentDate,
      toothNumber,
      notes: raw.treatment_notes ? String(raw.treatment_notes).trim() : null,
    },
  }
}

// Pinoproseso bawat row nang independente — hindi dapat maharang yung
// ibang 199 sa pag-import dahil lang sa isang malformed row sa 200-row
// sheet. Nagbabalik ng per-row report para makita mismo ng dentist/staff
// kung ano talaga ang kailangang ayusin.
//
// Long-format sheet: isang patient, pwedeng umulit sa maraming rows (isang
// row bawat past visit). Unang beses lumitaw yung name+DOB niya, doon
// gagawin yung patient record; bawat susunod na row na tumugma, doon na
// lang ikakabit yung treatment (kung may procedure_name). Sequential yung
// loop na 'to (hindi parallel), kaya yung findPatientByNameAndDob ng isang
// row, makikita na niya yung patient na ginawa ng mas naunang row sa parehong
// import — walang hiwalay pang in-memory tracking na kailangan.
export async function importPatients(buffer, originalname, importedByUserId) {
  const rawRows = parseFile(buffer, originalname)
  if (rawRows.length === 0) {
    throw new AppError('The file has no rows to import', 422)
  }

  const created = []
  const treatmentsAdded = []
  const duplicates = []
  const rowErrors = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2 // +1 para sa 0-index, +1 para sa header row
    const raw = rawRows[i]
    const { data: patientData, errors: patientErrors } = validateAndNormalizeRow(raw)
    const treatmentResult = validateAndNormalizeTreatmentRow(raw)

    const errors = [...(patientErrors || []), ...(treatmentResult.errors || [])]
    if (errors.length > 0) {
      rowErrors.push({ row: rowNumber, errors })
      continue
    }

    let patient = await patientModel.findPatientByNameAndDob(
      patientData.firstName,
      patientData.lastName,
      patientData.dateOfBirth,
    )
    const isNewPatient = !patient
    if (isNewPatient) {
      patient = await patientModel.createPatient(patientData)
    }

    const name = `${patientData.firstName} ${patientData.lastName}`
    let treatment = null
    if (treatmentResult.hasTreatment) {
      treatment = await treatmentModel.createTreatment({
        patientId: patient.id,
        procedureName: treatmentResult.data.procedureName,
        toothNumber: treatmentResult.data.toothNumber,
        notes: treatmentResult.data.notes,
        treatmentDate: treatmentResult.data.treatmentDate,
        createdBy: importedByUserId,
      })
    }

    if (isNewPatient) {
      created.push({ row: rowNumber, name, treatmentAdded: Boolean(treatment) })
    } else if (treatment) {
      treatmentsAdded.push({
        row: rowNumber,
        name,
        procedureName: treatment.procedure_name,
      })
    } else {
      duplicates.push({ row: rowNumber, name })
    }
  }

  return {
    totalRows: rawRows.length,
    createdCount: created.length,
    treatmentsAddedCount: treatmentsAdded.length,
    duplicateCount: duplicates.length,
    errorCount: rowErrors.length,
    created,
    treatmentsAdded,
    duplicates,
    errors: rowErrors,
    importedByUserId,
  }
}
