import { parse as parseCsv } from 'csv-parse/sync'
import * as patientModel from '../models/patientModel.js'
import * as treatmentModel from '../models/treatmentModel.js'
import AppError from '../utils/AppError.js'
import { FIELD_LIMITS, stripPhoneFormatting, isValidToothNumber, clinicToday } from '../utils/validators.js'
import { EXTRA_PATIENT_FIELDS, parseYesNo } from '../utils/patientFields.js'
import { readXlsx, isXlsxBuffer, isLegacyXlsBuffer } from '../utils/xlsx.js'

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

// Patient Information Record (migration 015): optional din. Ang column name
// sa file = DB column (hal. "middle_name"), o ang label (hal. "Middle name").
const INFO_FIELDS_BY_COLUMN = Object.fromEntries(EXTRA_PATIENT_FIELDS.map((f) => [f.column, f]))
export const INFO_COLUMNS = EXTRA_PATIENT_FIELDS.map((f) => f.column)

// Mirrors client/src/constants/dental.js's PROCEDURES — kept as a separate
// copy here (server and client are separate npm packages, no shared
// package between them) rather than free text, so imported treatments
// group correctly with normal dentist-entered ones on the dashboard's
// "Most Common Procedures" breakdown and pick up the same whole-mouth
// tooth-selector behavior AddTreatmentForm.jsx applies on the client.
// Keep the two lists in sync if procedures are ever added/renamed.
//
// `aliases`: karaniwang tawag na isinusulat ng nag-e-encode mula sa papel
// (hal. "Cleaning", "Pasta", "Bunot"). Pinapalitan ito ng tamang `value`
// bago i-save, kaya pareho pa rin ang grupo sa dashboard.
const STANDARD_PROCEDURES = [
  { value: 'Consultation', wholeMouth: true, aliases: ['check-up', 'checkup', 'konsulta'] },
  { value: 'Oral Prophylaxis / Cleaning', wholeMouth: true, aliases: ['cleaning', 'oral prophylaxis', 'prophylaxis', 'linis'] },
  { value: 'Deep Scaling', wholeMouth: false, aliases: ['scaling', 'scaling and root planing'] },
  { value: 'Fluoride Treatment', wholeMouth: true, aliases: ['fluoride'] },
  { value: 'Pit & Fissure Sealant', wholeMouth: false, aliases: ['sealant', 'sealants', 'pit and fissure sealant'] },
  {
    value: 'Composite Restoration / Filling',
    wholeMouth: false,
    aliases: ['filling', 'composite', 'composite filling', 'composite restoration', 'pasta'],
  },
  { value: 'Amalgam Filling', wholeMouth: false, aliases: ['amalgam'] },
  { value: 'Inlay / Onlay', wholeMouth: false, aliases: ['inlay', 'onlay'] },
  { value: 'Tooth Extraction', wholeMouth: false, aliases: ['extraction', 'bunot'] },
  { value: 'Root Canal Treatment', wholeMouth: false, aliases: ['root canal', 'rct'] },
  { value: 'Braces Installation', wholeMouth: true, aliases: ['braces', 'braces installation'] },
  { value: 'Orthodontic Adjustment', wholeMouth: false, aliases: ['adjustment', 'braces adjustment'] },
  { value: 'Crown', wholeMouth: false, aliases: ['jacket crown', 'jacket'] },
  { value: 'Bridge', wholeMouth: false, aliases: ['fixed bridge'] },
  { value: 'Denture', wholeMouth: false, aliases: ['dentures', 'removable denture', 'pustiso'] },
  { value: 'Veneers', wholeMouth: false, aliases: ['veneer'] },
  { value: 'Teeth Whitening', wholeMouth: true, aliases: ['whitening', 'bleaching'] },
]

function matchStandardProcedure(value) {
  const v = String(value || '').trim().toLowerCase()
  return (
    STANDARD_PROCEDURES.find((p) => p.value.toLowerCase() === v) ||
    STANDARD_PROCEDURES.find((p) => p.aliases.includes(v)) ||
    null
  )
}

// Pagkakasunod sa template: middle name katabi ng pangalan, tapos ang iba
// pang field ng Patient Information Record bago ang treatment columns
export const IMPORT_TEMPLATE_HEADERS = [
  'first_name',
  'middle_name',
  ...REQUIRED_COLUMNS.filter((c) => c !== 'first_name'),
  ...OPTIONAL_COLUMNS,
  ...INFO_COLUMNS.filter((c) => c !== 'middle_name'),
  ...TREATMENT_COLUMNS,
]

// [CSV column, FIELD_LIMITS key]
const IMPORT_LENGTH_CHECKS = [
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['contact_number', 'contactNumber'],
  ['email', 'email'],
  ['address', 'address'],
  ['medical_history', 'medicalHistory'],
  ['allergies', 'allergies'],
  ['emergency_contact_name', 'emergencyContactName'],
  ['emergency_contact_phone', 'emergencyContactPhone'],
  ['treatment_notes', 'notes'],
]

// Binabasa ang file nang hindi pa binabago ang mga header (para maipakita
// sa Map Columns step kung ano mismo ang nakasulat sa file ng clinic).
// Excel (.xlsx) = kinikilala sa laman ng file (ZIP), hindi lang sa pangalan.
async function parseFile(buffer, originalname) {
  if (isXlsxBuffer(buffer)) return readXlsx(buffer)
  if (isLegacyXlsBuffer(buffer) || /\.xls$/i.test(originalname)) {
    throw new AppError('Old Excel files (.xls) are not supported. In Excel, use File → Save As → Excel Workbook (.xlsx).', 422)
  }
  if (/\.xlsx$/i.test(originalname)) {
    throw new AppError('That Excel file could not be read. Open it in Excel and save it again as .xlsx.', 422)
  }

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
    const headers = [...new Set(parsed.flatMap((row) => Object.keys(row || {})))]
    return { headers, rows: parsed }
  }

  try {
    const text = buffer.toString('utf8')
    // bom: tinatanggal ang invisible na marka sa simula ng CSV na galing Excel
    const rows = parseCsv(text, { columns: true, trim: true, skip_empty_lines: true, bom: true })
    const firstLine = parseCsv(text, { to_line: 1, trim: true, bom: true })[0] || []
    return { headers: firstLine.filter((h) => String(h).trim() !== ''), rows }
  } catch (err) {
    throw new AppError(`Could not parse CSV: ${err.message}`, 422)
  }
}

// --- Column mapping (Map Columns step) ---
// Hindi na kailangang eksaktong "first_name" ang header ng file ng clinic:
// ina-auto-match ang karaniwang pangalan ("First Name", "Birthdate",
// "Gender", "Contact"...), at puwedeng baguhin ng dentist bago mag-import.
// Hindi pinapansin ang nasa loob ng ( ) at ang *, para tugma pa rin ang
// header ng template gaya ng "Sex * (male/female)" → "sex".
const normalizeHeader = (h) =>
  String(h || '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const HEADER_ALIASES = {
  first_name: ['firstname', 'fname', 'givenname', 'first', 'pangalan'],
  last_name: ['lastname', 'lname', 'surname', 'familyname', 'last', 'apelyido'],
  sex: ['sex', 'gender', 'kasarian'],
  date_of_birth: ['dateofbirth', 'birthdate', 'dob', 'birthday', 'bday', 'kaarawan'],
  contact_number: ['contactnumber', 'contact', 'contactno', 'phone', 'phonenumber', 'mobile', 'mobilenumber', 'cellphone', 'cpnumber'],
  email: ['email', 'emailaddress'],
  address: ['address', 'homeaddress', 'tirahan'],
  medical_history: ['medicalhistory', 'medical', 'medicalconditions'],
  allergies: ['allergies', 'allergy'],
  emergency_contact_name: ['emergencycontactname', 'emergencycontact', 'contactperson'],
  emergency_contact_phone: ['emergencycontactphone', 'emergencyphone', 'emergencynumber', 'emergencycontactnumber'],
  procedure_name: ['procedurename', 'procedure', 'treatment'],
  treatment_date: ['treatmentdate', 'visitdate', 'dateoftreatment', 'dateofvisit'],
  tooth_number: ['toothnumber', 'tooth', 'toothno'],
  treatment_notes: ['treatmentnotes', 'notes', 'remarks'],
  // Patient Information Record: dagdag sa column name at label (awtomatiko)
  middle_name: ['middlename', 'mname', 'middle', 'middleinitial', 'mi', 'gitnangpangalan'],
  occupation: ['occupation', 'trabaho', 'work', 'job'],
  nationality: ['nationality', 'citizenship'],
  religion: ['religion', 'relihiyon'],
  guardian_name: ['guardian', 'parentguardian', 'parentguardiansname', 'parentsname', 'parent', 'magulang'],
  previous_dentist: ['previousdentist', 'formerdentist'],
  last_dental_visit: ['lastdentalvisit', 'lastvisit'],
  physician_name: ['physician', 'nameofphysician', 'doctor'],
  physician_specialty: ['specialty'],
  physician_office_address: ['officeaddress'],
  physician_office_number: ['officenumber', 'officeno'],
  in_good_health: ['goodhealth', 'areyouingoodhealth'],
  is_pregnant: ['pregnant', 'buntis'],
  is_nursing: ['nursing', 'breastfeeding'],
  taking_birth_control: ['birthcontrol', 'birthcontrolpills'],
  blood_type: ['bloodtype', 'bloodgroup'],
  blood_pressure: ['bloodpressure', 'bp'],
}
for (const f of EXTRA_PATIENT_FIELDS) {
  HEADER_ALIASES[f.column] = [...new Set([normalizeHeader(f.label), ...(HEADER_ALIASES[f.column] || [])])]
}

export const IMPORT_FIELDS = IMPORT_TEMPLATE_HEADERS

export function suggestMapping(headers) {
  const mapping = {}
  const used = new Set()
  for (const field of IMPORT_FIELDS) {
    const candidates = [normalizeHeader(field), ...HEADER_ALIASES[field]]
    const match = headers.find((h) => !used.has(h) && candidates.includes(normalizeHeader(h)))
    if (match) {
      mapping[field] = match
      used.add(match)
    }
  }
  return mapping
}

// Sinusuri ang mapping galing sa client: header na totoong nasa file lang,
// at kumpleto ang 4 na required na field.
function resolveMapping(headers, mapping) {
  const resolved = {}
  for (const field of IMPORT_FIELDS) {
    const header = mapping?.[field]
    if (!header) continue
    if (!headers.includes(header)) {
      throw new AppError(`Column "${header}" is not in the file`, 422)
    }
    resolved[field] = header
  }
  const missing = REQUIRED_COLUMNS.filter((f) => !resolved[f])
  if (missing.length > 0) {
    throw new AppError(`Choose which column holds: ${missing.join(', ')}`, 422)
  }
  return resolved
}

function applyMapping(rawRows, mapping) {
  return rawRows.map((raw) => {
    const row = {}
    for (const [field, header] of Object.entries(mapping)) row[field] = raw[header]
    return row
  })
}

// Step 1 → 2: basahin ang file, ibalik ang headers, unang 5 row, at mungkahing mapping
export async function previewImport(buffer, originalname) {
  const { headers, rows } = await parseFile(buffer, originalname)
  if (rows.length === 0) throw new AppError('The file has no rows to import', 422)
  return {
    headers,
    totalRows: rows.length,
    sampleRows: rows.slice(0, 5),
    suggestedMapping: suggestMapping(headers),
    fields: IMPORT_FIELDS,
    requiredFields: REQUIRED_COLUMNS,
    // Para sa Map Columns step: hiwalay na grupo at label ng mga bagong field
    infoFields: INFO_COLUMNS,
    fieldLabels: Object.fromEntries(EXTRA_PATIENT_FIELDS.map((f) => [f.column, f.label])),
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

// Petsa galing sa papel/Excel (Feature #30). Dati YYYY-MM-DD at MM/DD/YYYY
// lang ang tinatanggap, pero binabago ng Excel ang petsa ayon sa Windows
// setting kapag nag-Save As CSV (hal. "1985-03-14" → "14/03/1985", o
// "3/14/85", o "14-Mar-85"), kaya halos lahat ng row ay "invalid". Ngayon:
// - YYYY-MM-DD / YYYY/MM/DD (pati may oras sa dulo, "1985-03-14 00:00")
// - MM/DD/YYYY, M-D-YY, M.D.YYYY (/, -, o .); 2-digit na taon = 19xx o 20xx
//   (hindi puwedeng sa hinaharap)
// - DD/MM/YYYY kapag malinaw (hal. 14/03/1985: walang ika-14 na buwan), at
//   kapag may ganoong row sa parehong column, DD/MM ang buong column (tingnan
//   detectDayFirst) para hindi magkahalo
// - May pangalan ng buwan: "Mar 14, 1985", "14 March 1985", "14-Mar-85"
// - Excel serial number (hal. 31120), kapag naka-Number ang column
// Tinatanggihan pa rin ang hindi totoong petsa (Feb 30) at petsa sa hinaharap.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function monthFromName(name) {
  const i = MONTHS.indexOf(String(name).slice(0, 3).toLowerCase())
  return i < 0 ? null : i + 1
}

function fullYear(y) {
  if (y.length !== 2) return Number(y)
  const n = Number(y)
  const currentYY = Number(clinicToday().slice(2, 4))
  return n > currentYY ? 1900 + n : 2000 + n
}

function toIso(year, month, day) {
  if (!year || !month || !day) return null
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isValidCalendarDate(iso) ? iso : null
}

// Para sa buong column: may value bang malinaw na DD/MM (unang numero > 12)?
export function detectDayFirst(values) {
  return values.some((value) => {
    const m = String(value ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/)
    return m && Number(m[1]) > 12 && Number(m[2]) <= 12
  })
}

export function normalizeDate(value, { dayFirst = false } = {}) {
  let v = String(value ?? '').trim()
  if (!v) return null

  // Excel serial (araw mula 1899-12-30). 20000–60000 = 1954–2064.
  if (/^\d{5}(\.0+)?$/.test(v)) {
    const n = Number(v)
    if (n >= 20000 && n <= 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000)
      return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
    return null
  }

  // Oras sa dulo ("1985-03-14 00:00:00", "3/14/1985 0:00")
  v = v.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm)?z?$/i, '').trim()

  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]))

  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const year = fullYear(m[3])
    // Malinaw kapag isa lang ang puwedeng buwan; kung pareho (≤ 12), MM/DD
    // gaya ng template, maliban kung DD/MM ang column
    const dayFirstHere = a > 12 || (dayFirst && b <= 12)
    return dayFirstHere ? toIso(year, b, a) : toIso(year, a, b)
  }

  // "Mar 14, 1985" / "March 14 1985" / "Mar-14-1985"
  m = v.match(/^([a-z]{3,9})\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s-]+(\d{2}|\d{4})$/i)
  if (m) return toIso(fullYear(m[3]), monthFromName(m[1]), Number(m[2]))

  // "14 Mar 1985" / "14-Mar-85" / "14 March, 1985"
  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?,?[\s-]+(\d{2}|\d{4})$/i)
  if (m) return toIso(fullYear(m[3]), monthFromName(m[2]), Number(m[1]))

  return null
}

// Totoong petsa sa kalendaryo (hindi Feb 30), at hindi sa hinaharap (oras sa
// Pilipinas). Dati `new Date()`, na tinatanggap ang 1985-02-31 (Mar 3).
function isValidCalendarDate(isoString) {
  const [y, mo, d] = isoString.split('-').map(Number)
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false
  return isoString <= clinicToday()
}

const DATE_HELP = 'Use MM/DD/YYYY, e.g. 03/14/1985'

// Excel: kapag tinype ang 09171234567, nagiging numero (9171234567) at
// nawawala ang 0; ang +639... ay nagiging 639.... Ibinabalik dito ang
// tamang PH mobile format. Ang ibang format (hal. landline) ay iniiwan lang.
function normalizeImportPhone(value) {
  if (value == null || String(value).trim() === '') return null
  const original = String(value).trim()
  const v = stripPhoneFormatting(original)
  if (/^0?9\d{9}$/.test(v)) return v.startsWith('0') ? v : `0${v}`
  if (/^\+?639\d{9}$/.test(v)) return v.startsWith('+') ? v : `+${v}`
  return original
}

function validateAndNormalizeRow(raw, { dayFirst } = {}) {
  const errors = []
  const firstName = String(raw.first_name || '').trim()
  const lastName = String(raw.last_name || '').trim()
  const sex = normalizeSex(raw.sex)
  const dateOfBirth = normalizeDate(raw.date_of_birth, { dayFirst: dayFirst?.date_of_birth })

  if (!firstName) errors.push('first_name is required')
  if (!lastName) errors.push('last_name is required')
  if (!sex) errors.push(`sex must be male/female (got "${raw.sex ?? ''}")`)
  if (!dateOfBirth) {
    errors.push(
      String(raw.date_of_birth ?? '').trim()
        ? `date_of_birth "${raw.date_of_birth}" is not a date we can read, or is in the future. ${DATE_HELP}`
        : 'date_of_birth is required',
    )
  }

  // Haba ng bawat field (FIELD_LIMITS = laki ng column sa DB). Dati walang
  // check: sa Aiven (strict mode) error sa database ang sobrang habang
  // field, kaya generic na 500 sa gitna ng import imbes na malinaw na row error.
  for (const [column, key] of IMPORT_LENGTH_CHECKS) {
    const value = raw[column] == null ? '' : String(raw[column]).trim()
    if (value.length > FIELD_LIMITS[key]) {
      errors.push(`${column} must be ${FIELD_LIMITS[key]} characters or fewer (got ${value.length})`)
    }
  }

  // Patient Information Record: haba ng text, at Yes/No na sagot
  const info = {}
  for (const column of INFO_COLUMNS) {
    const field = INFO_FIELDS_BY_COLUMN[column]
    const rawValue = raw[column]
    if (field.type === 'bool') {
      const parsed = parseYesNo(rawValue)
      if (parsed.error) errors.push(`${column} must be Yes or No (got "${rawValue}")`)
      else if (parsed.value !== null) info[field.key] = parsed.value === 1
    } else {
      const value = rawValue == null ? '' : String(rawValue).trim()
      if (value.length > field.max) errors.push(`${column} must be ${field.max} characters or fewer (got ${value.length})`)
      else if (value) info[field.key] = value
    }
  }

  if (errors.length > 0) return { errors }

  return {
    data: {
      ...info,
      firstName,
      lastName,
      sex,
      dateOfBirth,
      contactNumber: normalizeImportPhone(raw.contact_number),
      email: raw.email ? String(raw.email).trim() : null,
      address: raw.address ? String(raw.address).trim() : null,
      medicalHistory: raw.medical_history ? String(raw.medical_history).trim() : null,
      allergies: raw.allergies ? String(raw.allergies).trim() : null,
      emergencyContactName: raw.emergency_contact_name ? String(raw.emergency_contact_name).trim() : null,
      emergencyContactPhone: normalizeImportPhone(raw.emergency_contact_phone),
      isLegacyMigrated: true,
    },
  }
}

// A row with a blank procedure_name is patient-info-only (or a plain
// duplicate row) — hasTreatment stays false and the row is never rejected
// for missing treatment_date/tooth_number, since those only matter once
// there's actually a procedure to attach.
function validateAndNormalizeTreatmentRow(raw, { dayFirst } = {}) {
  const rawProcedureName = raw.procedure_name ? String(raw.procedure_name).trim() : ''
  if (!rawProcedureName) return { hasTreatment: false }

  const errors = []

  const procedure = matchStandardProcedure(rawProcedureName)
  if (!procedure && rawProcedureName.toLowerCase() === 'crown / bridge') {
    // Dating iisang procedure; hiwalay na ngayon (hiling ng clinic)
    errors.push('procedure_name "Crown / Bridge" is now two procedures. Write Crown or Bridge')
  } else if (!procedure) {
    const valid = STANDARD_PROCEDURES.map((p) => p.value).join(', ')
    errors.push(`procedure_name "${rawProcedureName}" doesn't match a standard procedure. Valid values: ${valid}`)
  }

  const treatmentDate = normalizeDate(raw.treatment_date, { dayFirst: dayFirst?.treatment_date })
  if (!treatmentDate) {
    errors.push(
      String(raw.treatment_date ?? '').trim()
        ? `treatment_date "${raw.treatment_date}" is not a date we can read, or is in the future. ${DATE_HELP}`
        : 'treatment_date is required when procedure_name is set',
    )
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
      } else if (isValidToothNumber(rawTooth)) {
        toothNumber = rawTooth
      } else {
        errors.push(`tooth_number must be a valid FDI tooth number (11-48, or 51-85 for baby teeth) or "ALL" (got "${raw.tooth_number}")`)
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
export async function importPatients(buffer, originalname, importedByUserId, { mapping, dryRun = false } = {}) {
  const { headers, rows: fileRows } = await parseFile(buffer, originalname)
  if (fileRows.length === 0) {
    throw new AppError('The file has no rows to import', 422)
  }
  // Walang mapping (lumang client / direktang API call) = auto-match
  const rawRows = applyMapping(fileRows, resolveMapping(headers, mapping || suggestMapping(headers)))

  const created = []
  const treatmentsAdded = []
  const duplicates = []
  const rowErrors = []
  // Dry run (Validate / Preview step): walang isinusulat sa database. Para
  // makilala pa rin ang paulit-ulit na patient sa parehong file (long
  // format), tinatandaan dito ang mga "magiging bago" na patient.
  const plannedNew = new Set()
  // DD/MM ba ang buong column? (tingnan detectDayFirst)
  const dayFirst = {
    date_of_birth: detectDayFirst(rawRows.map((r) => r.date_of_birth)),
    treatment_date: detectDayFirst(rawRows.map((r) => r.treatment_date)),
  }

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2 // +1 para sa 0-index, +1 para sa header row
    const raw = rawRows[i]
    const { data: patientData, errors: patientErrors } = validateAndNormalizeRow(raw, { dayFirst })
    const treatmentResult = validateAndNormalizeTreatmentRow(raw, { dayFirst })

    const errors = [...(patientErrors || []), ...(treatmentResult.errors || [])]
    if (errors.length > 0) {
      rowErrors.push({ row: rowNumber, errors })
      continue
    }

    const key = `${patientData.firstName}|${patientData.lastName}|${patientData.dateOfBirth}`.toLowerCase()
    let patient = await patientModel.findPatientByNameAndDob(
      patientData.firstName,
      patientData.lastName,
      patientData.dateOfBirth,
    )
    const isNewPatient = !patient && !plannedNew.has(key)
    if (isNewPatient) {
      if (dryRun) plannedNew.add(key)
      else patient = await patientModel.createPatient(patientData)
    }

    const name = `${patientData.firstName} ${patientData.lastName}`
    let treatmentProcedure = null
    if (treatmentResult.hasTreatment) {
      treatmentProcedure = treatmentResult.data.procedureName
      if (!dryRun) {
        await treatmentModel.createTreatment({
          patientId: patient.id,
          procedureName: treatmentResult.data.procedureName,
          toothNumber: treatmentResult.data.toothNumber,
          notes: treatmentResult.data.notes,
          treatmentDate: treatmentResult.data.treatmentDate,
          createdBy: importedByUserId,
        })
      }
    }

    if (isNewPatient) {
      created.push({ row: rowNumber, name, treatmentAdded: Boolean(treatmentProcedure) })
    } else if (treatmentProcedure) {
      treatmentsAdded.push({ row: rowNumber, name, procedureName: treatmentProcedure })
    } else {
      duplicates.push({ row: rowNumber, name })
    }
  }

  return {
    dryRun,
    totalRows: rawRows.length,
    createdCount: created.length,
    // Lahat ng treatment na naidagdag (pati sa mga bagong patient)
    treatmentsAddedCount: treatmentsAdded.length + created.filter((c) => c.treatmentAdded).length,
    duplicateCount: duplicates.length,
    errorCount: rowErrors.length,
    created,
    treatmentsAdded,
    duplicates,
    errors: rowErrors,
  }
}
