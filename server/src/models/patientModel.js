import pool from '../config/db.js'
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
  const orderBy = PATIENT_SORTS[sort] || PATIENT_SORTS.name

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

// Ginagamit 'to ng Mailgun inbound webhook para itugma yung emailed X-ray
// sa patient, base sa address ng sender. LAHAT ng tugma ang ibinabalik
// (hindi LIMIT 1): puwedeng iisa ang email ng ilang patient (hal. magulang
// para sa mga anak), at kapag 2+ ang tugma, hindi na dapat hulaan kung
// kanino — ang dentist ang pipili (tignan webhooks.controller.js). Hindi
// tutugma yung email ng deleted patient. `exceptId`: para sa Edit (hindi
// kasama ang sarili). Max 10 — sapat para malaman kung "shared" na.
export async function findPatientsByEmail(email, { exceptId = null } = {}) {
  const [rows] = await pool.execute(
    `SELECT id, patient_code, first_name, last_name FROM patients
     WHERE LOWER(email) = LOWER(:email) AND deleted_at IS NULL
       AND (:exceptId IS NULL OR id <> :exceptId)
     ORDER BY last_name, first_name
     LIMIT 10`,
    { email, exceptId },
  )
  return rows
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

async function insertPatient(data, patientCode) {
  const [result] = await pool.execute(
    `INSERT INTO patients
      (patient_code, first_name, last_name, sex, date_of_birth, contact_number, email, address, medical_history, allergies, emergency_contact_name, emergency_contact_phone, is_legacy_migrated)
     VALUES
      (:patientCode, :firstName, :lastName, :sex, :dateOfBirth, :contactNumber, :email, :address, :medicalHistory, :allergies, :emergencyContactName, :emergencyContactPhone, :isLegacyMigrated)`,
    {
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
