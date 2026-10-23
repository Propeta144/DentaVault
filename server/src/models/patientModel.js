import pool from '../config/db.js'
import { EXTRA_PATIENT_FIELDS, toDbValue } from '../utils/patientFields.js'
import { limitOffset } from '../utils/sqlLimit.js'
import { generatePatientCode, normalizePatientCode } from '../utils/patientCode.js'

// Whitelisted 'to, hindi galing sa user input — sarili nating sinulat na
// ORDER BY clause lang naman palagi yung `sort`, kaya walang injection
// surface kahit direktang na-iinterpolate 'to sa query string sa baba.
// Yung "(x IS NULL) ASC" trick, tinutulak nito sa ilalim yung mga patient
// na wala pang treatment kahit anong direction, dahil wala namang NULLS
// LAST keyword si MySQL.
const PATIENT_SORTS = {
  name: 'p.last_name ASC, p.first_name ASC',
  name_desc: 'p.last_name DESC, p.first_name DESC',
  date_added: 'p.created_at DESC',
  date_added_asc: 'p.created_at ASC',
  last_visit: '(lt.last_treatment_date IS NULL) ASC, lt.last_treatment_date DESC',
}

function buildPatientListQuery({ search }) {
  const searchTerm = search ? `%${search}%` : null
  const where = searchTerm
    ? // Single quotes sa ' ', hindi " ": naka-ANSI_QUOTES ang Aiven, kaya
      // column name ang tingin nito sa "..." (hindi text).
      `WHERE p.deleted_at IS NULL AND (CONCAT(p.first_name, ' ', p.last_name) LIKE :search)`
    : 'WHERE p.deleted_at IS NULL'
  return {
    where,
    params: { search: searchTerm },
  }
}

export async function listPatients({ search, sort, limit, offset }) {
  const { where, params } = buildPatientListQuery({ search })
  // Object.hasOwn: para hindi tumama ang "__proto__"/"constructor" (500 dati)
  const orderBy = Object.hasOwn(PATIENT_SORTS, sort ?? '') ? PATIENT_SORTS[sort] : PATIENT_SORTS.name

  const [rows] = await pool.execute(
    `SELECT p.id, p.patient_code, p.first_name, p.last_name, p.sex, p.date_of_birth, p.contact_number, p.email,
            p.is_legacy_migrated, p.created_at, lt.last_treatment_date
     FROM patients p
     LEFT JOIN (
       SELECT patient_id, MAX(treatment_date) AS last_treatment_date
       FROM treatments
       GROUP BY patient_id
     ) lt ON lt.patient_id = p.id
     ${where}
     ORDER BY ${orderBy}
     ${limitOffset(limit, offset)}`,
    params,
  )

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM patients p ${where}`,
    params,
  )

  return { rows, total }
}

// Full, unpaginated column set 'to para sa CSV export — dentist-only
// (tignan route). Ginagamit ulit yung parehong search filter ng list
// view, kaya kapag "Export CSV" pagkatapos mag-search, filtered results
// lang ang lalabas, hindi lahat ng patient.
export async function listPatientsForExport({ search }) {
  const { where, params } = buildPatientListQuery({ search })
  const [rows] = await pool.execute(
    `SELECT p.* FROM patients p ${where} ORDER BY p.last_name, p.first_name`,
    params,
  )
  return rows
}

// Sa point of view ng app, yung mga soft-deleted patients, parang wala
// nang existing (404, kagaya ng invalid id) — kept pa rin naman yung row
// mismo para sa compliance/retention, pero wala nang lalabas dito sa API.
export async function findPatientById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM patients WHERE id = :id AND deleted_at IS NULL',
    { id },
  )
  return rows[0] || null
}

// Ito yung ginagamit ng lahat ng route na may patient sa URL
// (/patients/:code/...) — Patient Code na ang laman ng URL, hindi na yung
// numeric id. Kapag mali ang format, diretsong null (404) na.
export async function findPatientByCode(value) {
  const code = normalizePatientCode(value)
  if (!code) return null
  const [rows] = await pool.execute(
    'SELECT * FROM patients WHERE patient_code = :code AND deleted_at IS NULL',
    { code },
  )
  return rows[0] || null
}

// Ginagamit 'to ng legacy import para ma-detect yung duplicate profiles.
// Name + DOB, same de-dup key din naman na gagamitin ng front-desk clerk
// kung titignan lang niya mismo sa paper folder. Hindi binibilang na
// duplicate yung mga deleted patients — kapag ni-reimport ulit yung
// parehong tao pagkatapos ma-delete ang record niya, dapat gumawa 'to ng
// bago.
export async function findPatientByNameAndDob(firstName, lastName, dateOfBirth) {
  const [rows] = await pool.execute(
    `SELECT id, patient_code FROM patients
     WHERE LOWER(first_name) = LOWER(:firstName)
       AND LOWER(last_name) = LOWER(:lastName)
       AND date_of_birth = :dateOfBirth
       AND deleted_at IS NULL
     LIMIT 1`,
    { firstName, lastName, dateOfBirth },
  )
  return rows[0] || null
}

// Hanggang 5 subok kapag nagkataong may kaparehong code na (UNIQUE index
// ang magrereject) — halos imposible sa 1 trilyong kombinasyon, pero mas
// mabuti nang may sagot kaysa mag-crash yung pag-register.
export async function createPatient(data) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insertPatient(data, generatePatientCode())
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY' || !err.message.includes('patient_code') || attempt >= 5) throw err
    }
  }
}

// Mga field ng Patient Information Record (migration 015) bilang
// { key: value } na handa nang isulat: NULL ang blangko, 1/0 ang Yes/No, at
// NULL ang pang-babae lang kapag male (tignan EXTRA_PATIENT_FIELDS).
function extraFieldValues(data, sex) {
  const values = {}
  for (const field of EXTRA_PATIENT_FIELDS) {
    if (data[field.key] === undefined) continue
    values[field.key] = field.womenOnly && sex === 'male' ? null : toDbValue(field, data[field.key])
  }
  return values
}

async function insertPatient(data, patientCode) {
  const extras = extraFieldValues(data, data.sex)
  const extraColumns = EXTRA_PATIENT_FIELDS.filter((f) => f.key in extras)
  const [result] = await pool.execute(
    `INSERT INTO patients
      (patient_code, first_name, last_name, sex, date_of_birth, contact_number, email, address, medical_history, allergies, emergency_contact_name, emergency_contact_phone, is_legacy_migrated${extraColumns.map((f) => `, ${f.column}`).join('')})
     VALUES
      (:patientCode, :firstName, :lastName, :sex, :dateOfBirth, :contactNumber, :email, :address, :medicalHistory, :allergies, :emergencyContactName, :emergencyContactPhone, :isLegacyMigrated${extraColumns.map((f) => `, :${f.key}`).join('')})`,
    {
      ...extras,
      patientCode,
      firstName: data.firstName,
      lastName: data.lastName,
      sex: data.sex,
      dateOfBirth: data.dateOfBirth,
      contactNumber: data.contactNumber ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      medicalHistory: data.medicalHistory ?? null,
      allergies: data.allergies ?? null,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      isLegacyMigrated: data.isLegacyMigrated ? 1 : 0,
    },
  )
  return findPatientById(result.insertId)
}

export async function updatePatient(id, data) {
  const fieldMap = {
    firstName: 'first_name',
    lastName: 'last_name',
    sex: 'sex',
    dateOfBirth: 'date_of_birth',
    contactNumber: 'contact_number',
    email: 'email',
    address: 'address',
    medicalHistory: 'medical_history',
    allergies: 'allergies',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
  }

  const setClauses = []
  const params = { id }

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      setClauses.push(`${column} = :${key}`)
      params[key] = data[key]
    }
  }

  // Patient Information Record fields (whitelist din: galing sa
  // EXTRA_PATIENT_FIELDS ang column name, hindi sa request)
  let sex = data.sex
  if (sex === undefined) sex = (await findPatientById(id))?.sex
  const extras = extraFieldValues(data, sex)
  for (const field of EXTRA_PATIENT_FIELDS) {
    if (field.key in extras) {
      setClauses.push(`${field.column} = :${field.key}`)
      params[field.key] = extras[field.key]
    }
  }
  // Kapag ginawang male, burahin ang pang-babae lang kahit hindi ipinadala
  if (sex === 'male') {
    for (const field of EXTRA_PATIENT_FIELDS.filter((f) => f.womenOnly && !(f.key in extras))) {
      setClauses.push(`${field.column} = NULL`)
    }
  }

  if (setClauses.length === 0) return findPatientById(id)

  await pool.execute(
    `UPDATE patients SET ${setClauses.join(', ')} WHERE id = :id`,
    params,
  )
  return findPatientById(id)
}

export async function softDeletePatient(id) {
  await pool.execute('UPDATE patients SET deleted_at = NOW() WHERE id = :id', { id })
}
