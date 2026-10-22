import { validationResult } from 'express-validator'
import * as patientModel from '../models/patientModel.js'
import * as treatmentModel from '../models/treatmentModel.js'
import * as userModel from '../models/userModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import { hashPassword } from '../services/authService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'
import { csvField } from '../utils/csv.js'
import { FIELD_LIMITS, clinicToday, isValidToothNumber } from '../utils/validators.js'
import { EXTRA_PATIENT_FIELDS } from '../utils/patientFields.js'
import { queryText, queryInt } from '../utils/query.js'

function assertValid(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }
}

export const list = asyncHandler(async (req, res) => {
  const page = queryInt(req.query.page, { min: 1, max: 100000, fallback: 1 })
  const limit = queryInt(req.query.limit, { min: 1, max: 50, fallback: 20 })
  const offset = (page - 1) * limit

  const { rows, total } = await patientModel.listPatients({
    search: queryText(req.query.search),
    sort: queryText(req.query.sort),
    limit,
    offset,
  })

  res.json({ patients: rows, page, limit, total, totalPages: Math.ceil(total / limit) })
})

export const exportCsv = asyncHandler(async (req, res) => {
  const patients = await patientModel.listPatientsForExport({ search: queryText(req.query.search) })

  // Kasama ang buong Patient Information Record (migration 015). Yes/No na
  // sagot: "Yes" / "No" / blangko (hindi natanong).
  const extras = EXTRA_PATIENT_FIELDS.filter((f) => f.key !== 'middleName')
  const extraCell = (f, p) => {
    const v = p[f.column]
    if (f.type === 'bool') return v === null || v === undefined ? '' : v ? 'Yes' : 'No'
    return v
  }
  const headers = [
    'Last Name', 'First Name', 'Middle Name', 'Sex', 'Date of Birth', 'Contact Number', 'Email',
    'Address', 'Medical History', 'Allergies', 'Emergency Contact Name',
    'Emergency Contact Phone', ...extras.map((f) => f.label), 'Legacy Record', 'Registered On',
  ]
  const rows = patients.map((p) => [
    p.last_name, p.first_name, p.middle_name, p.sex, p.date_of_birth, p.contact_number, p.email,
    p.address, p.medical_history, p.allergies, p.emergency_contact_name,
    p.emergency_contact_phone, ...extras.map((f) => extraCell(f, p)), p.is_legacy_migrated ? 'Yes' : 'No',
    // Bumabalik yung created_at bilang JS Date (DATE columns lang ang
    // pinapanatiling strings — tignan db.js) — verbose yung default
    // String() form nito, "Wed Jul 22 2026 12:18:24 GMT+0800 (...)",
    // hindi spreadsheet-friendly.
    p.created_at.toISOString().slice(0, 10),
  ])

  const csv = [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\n')

  await recordAuditLog({
    userId: req.user.userId,
    action: 'EXPORT_PATIENTS_CSV',
    entityType: 'patient',
    details: { count: patients.length },
    ipAddress: req.ip,
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="dentavault-patients-${new Date().toISOString().slice(0, 10)}.csv"`,
  )
  res.send(csv)
})

export const create = asyncHandler(async (req, res) => {
  assertValid(req)

  // Duplicate warning: parehong pangalan + birthday ng isang aktibong
  // patient (parehong panuntunan ng Import). Hindi ito tuluyang bawal —
  // puwedeng magkapareho talaga ang dalawang tao — kaya kapag sinadya ng
  // dentist ("Register anyway"), ipinapadala ng client ang allowDuplicate.
  if (req.body.allowDuplicate !== true) {
    const existing = await patientModel.findPatientByNameAndDob(
      req.body.firstName.trim(),
      req.body.lastName.trim(),
      req.body.dateOfBirth,
    )
    if (existing) {
      throw new AppError('A patient with the same name and date of birth already exists', 409, {
        duplicate: { patientCode: existing.patient_code },
      })
    }
  }

  const patient = await patientModel.createPatient(req.body)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'CREATE_PATIENT',
    entityType: 'patient',
    entityId: patient.id,
    ipAddress: req.ip,
  })

  res.status(201).json({ patient })
})

// Babala sa Register/Edit form: may ibang patient na bang gumagamit ng
// email na 'to? Hindi bawal (normal sa pamilya na iisa ang email), pero
// kailangang malaman ng dentist na ang X-ray na ipapadala mula rito ay
// hindi na awtomatikong mafa-file — siya ang pipili sa X-ray Inbox.
// `exceptCode`: ang patient na ine-edit (hindi kasama ang sarili).
export const emailUsage = asyncHandler(async (req, res) => {
  const email = queryText(req.query.email) || ''
  if (!email) return res.json({ patients: [] })
  const exceptCode = queryText(req.query.exceptCode)
  const except = exceptCode ? await patientModel.findPatientByCode(exceptCode) : null
  const rows = await patientModel.findPatientsByEmail(email, { exceptId: except?.id ?? null })
  res.json({ patients: rows.map((p) => ({ first_name: p.first_name, last_name: p.last_name })) })
})

export const getOne = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to view this record', 403)
  }

  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_PATIENT',
    entityType: 'patient',
    entityId: patient.id,
    ipAddress: req.ip,
  })

  res.json({ patient })
})

export const update = asyncHandler(async (req, res) => {
  assertValid(req)
  const existing = await patientModel.findPatientByCode(req.params.code)
  if (!existing) throw new AppError('Patient not found', 404)

  // Portal account: ang email ng patient = sign-in email niya (Feature #30).
  // Sinusuri MUNA bago may isulat, para walang kalahating update.
  const account = await userModel.findUserByPatientId(existing.id)
  const newEmail = (req.body.email || '').trim()
  let emailChanged = false
  if (account) {
    if (!newEmail) {
      throw new AppError(
        'This patient signs in to the patient portal with their email. Enter the new email instead of leaving it blank.',
        422,
      )
    }
    emailChanged = newEmail.toLowerCase() !== String(account.email).toLowerCase()
    if (emailChanged) {
      const other = await userModel.findUserByEmail(newEmail)
      if (other && other.id !== account.id) {
        throw new AppError('Another portal account already signs in with that email. Use a different email.', 409)
      }
    }
  }

  const patient = await patientModel.updatePatient(existing.id, req.body)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'UPDATE_PATIENT',
    entityType: 'patient',
    entityId: patient.id,
    ipAddress: req.ip,
  })

  let portalAccount = null
  if (account) {
    await userModel.updatePortalIdentity(account.id, {
      email: emailChanged ? newEmail : account.email,
      fullName: `${patient.first_name} ${patient.last_name}`,
    })
    portalAccount = { id: account.id, email: emailChanged ? newEmail : account.email, isActive: account.isActive }
    if (emailChanged) {
      await recordAuditLog({
        userId: req.user.userId,
        action: 'UPDATE_PORTAL_ACCOUNT_EMAIL',
        entityType: 'user',
        entityId: account.id,
        details: { patientId: patient.id },
        ipAddress: req.ip,
      })
    }
  }

  res.json({ patient, portalAccount })
})

export const remove = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  await patientModel.softDeletePatient(patient.id)
  // Portal account: hindi na makakapag-login, at hinto agad ang bukas na session
  await userModel.deactivateUserForPatient(patient.id)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'DELETE_PATIENT',
    entityType: 'patient',
    entityId: patient.id,
    details: { name: `${patient.first_name} ${patient.last_name}` },
    ipAddress: req.ip,
  })

  res.status(204).send()
})

export const listTreatments = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to view these records', 403)
  }

  const treatments = await treatmentModel.listTreatmentsForPatient(patient.id)
  res.json({ treatments })
})

const treatmentInput = (body) => ({
  procedureName: body.procedureName,
  toothNumber: body.toothNumber || null,
  surfaces: body.surfaces ?? null,
  chartCondition: body.chartCondition || null,
  notes: body.notes || null,
  treatmentDate: body.treatmentDate,
})

export const addTreatment = asyncHandler(async (req, res) => {
  assertValid(req)
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  // Kasama na ang marka sa 2D/3D chart kapag may katapat (Feature #30)
  const treatment = await treatmentModel.createTreatment({
    ...treatmentInput(req.body),
    patientId: patient.id,
    createdBy: req.user.userId,
  })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'CREATE_TREATMENT',
    entityType: 'treatment',
    entityId: treatment.id,
    details: { patientId: patient.id, chartEntries: treatment.chart_entry_count },
    ipAddress: req.ip,
  })

  res.status(201).json({ treatment })
})

async function findPatientTreatment(req) {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)
  const treatmentId = Number(req.params.treatmentId)
  const treatment = Number.isInteger(treatmentId)
    ? await treatmentModel.findTreatmentForPatient(treatmentId, patient.id)
    : null
  if (!treatment) throw new AppError('Treatment not found', 404)
  return { patient, treatment }
}

const treatmentSnapshot = (t) => ({
  procedureName: t.procedure_name,
  toothNumber: t.tooth_number,
  surfaces: t.surfaces,
  treatmentDate: t.treatment_date,
  notes: t.notes,
})

// Edit (Feature #30): naka-log ang dating laman. Sumusunod ang chart.
export const updateTreatment = asyncHandler(async (req, res) => {
  assertValid(req)
  const { patient, treatment: before } = await findPatientTreatment(req)

  const { treatment, chartChange } = await treatmentModel.updateTreatment(before.id, {
    ...treatmentInput(req.body),
    patientId: patient.id,
    updatedBy: req.user.userId,
  })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'UPDATE_TREATMENT',
    entityType: 'treatment',
    entityId: treatment.id,
    details: { patientId: patient.id, previous: treatmentSnapshot(before), chartChange },
    ipAddress: req.ip,
  })

  res.json({ treatment, chartChange })
})

// Delete (maling entry): kasama ang marka nito sa chart
export const deleteTreatment = asyncHandler(async (req, res) => {
  const { patient, treatment } = await findPatientTreatment(req)
  const chartEntriesRemoved = await treatmentModel.deleteTreatment(treatment.id)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'DELETE_TREATMENT',
    entityType: 'treatment',
    entityId: treatment.id,
    details: { patientId: patient.id, deleted: treatmentSnapshot(treatment), chartEntriesRemoved },
    ipAddress: req.ip,
  })

  res.status(204).send()
})

// Legacy Record Migration → Manual Entry: sabay-sabay na pag-encode ng mga
// lumang treatment galing sa papel (hal. 8 visit mula 2019). Sinusuri muna
// LAHAT bago may isulat — kapag may mali kahit isa, walang mase-save, at
// sinasabi kung aling row ang aayusin (para hindi kalahati lang ang pumasok).
const MAX_BATCH_TREATMENTS = 50

function validateTreatmentEntry(entry, index) {
  const row = `Row ${index + 1}`
  const procedureName = String(entry?.procedureName || '').trim()
  const treatmentDate = String(entry?.treatmentDate || '').trim()
  const toothNumber = String(entry?.toothNumber || '').trim().toUpperCase()
  const notes = entry?.notes ? String(entry.notes).trim() : ''

  if (!procedureName) throw new AppError(`${row}: procedure is required`, 422)
  if (procedureName.length > FIELD_LIMITS.procedureName) {
    throw new AppError(`${row}: procedure must be ${FIELD_LIMITS.procedureName} characters or fewer`, 422)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(treatmentDate) || Number.isNaN(new Date(treatmentDate).getTime())) {
    throw new AppError(`${row}: a valid treatment date is required`, 422)
  }
  if (treatmentDate > clinicToday()) throw new AppError(`${row}: treatment date cannot be in the future`, 422)
  if (toothNumber && toothNumber !== 'ALL' && !isValidToothNumber(toothNumber)) {
    throw new AppError(`${row}: tooth must be an FDI number (11-48, or 51-85 for baby teeth) or ALL`, 422)
  }
  if (notes.length > FIELD_LIMITS.notes) {
    throw new AppError(`${row}: notes must be ${FIELD_LIMITS.notes} characters or fewer`, 422)
  }
  return { procedureName, treatmentDate, toothNumber: toothNumber || null, notes: notes || null }
}

export const addTreatmentsBatch = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  const entries = req.body?.treatments
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError('Add at least one treatment', 422)
  }
  if (entries.length > MAX_BATCH_TREATMENTS) {
    throw new AppError(`Save at most ${MAX_BATCH_TREATMENTS} treatments at a time`, 422)
  }
  const valid = entries.map(validateTreatmentEntry)

  // Iisang transaction na (dati isa-isa): all-or-nothing pati sa chart
  const treatments = await treatmentModel.createTreatments(
    valid.map((entry) => ({ ...entry, patientId: patient.id, createdBy: req.user.userId })),
  )

  await recordAuditLog({
    userId: req.user.userId,
    action: 'MIGRATE_TREATMENT_HISTORY',
    entityType: 'patient',
    entityId: patient.id,
    details: { patientId: patient.id, count: treatments.length },
    ipAddress: req.ip,
  })

  res.status(201).json({ treatments })
})

export const getPortalAccount = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  const account = await userModel.findUserByPatientId(patient.id)
  res.json({ account: account ? { id: account.id, email: account.email, isActive: account.isActive } : null })
})

export const createPortalAccount = asyncHandler(async (req, res) => {
  assertValid(req)
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  const existingAccount = await userModel.findUserByPatientId(patient.id)
  if (existingAccount) throw new AppError('This patient already has a portal account', 409)

  const existingEmail = await userModel.findUserByEmail(req.body.email)
  if (existingEmail) throw new AppError('That email is already in use', 409)

  const passwordHash = await hashPassword(req.body.password)
  const account = await userModel.createUser({
    patientId: patient.id,
    role: 'patient',
    email: req.body.email,
    passwordHash,
    fullName: `${patient.first_name} ${patient.last_name}`,
    mustChangePassword: true, // alam ng dentist ang temporary password, kaya papalitan sa unang login
  })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'CREATE_PATIENT_PORTAL_ACCOUNT',
    entityType: 'user',
    entityId: account.id,
    details: { patientId: patient.id },
    ipAddress: req.ip,
  })

  res.status(201).json({ account: { id: account.id, email: account.email, isActive: account.isActive } })
})

export const resetPortalAccountPassword = asyncHandler(async (req, res) => {
  assertValid(req)
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  const account = await userModel.findUserByPatientId(patient.id)
  if (!account) throw new AppError('This patient does not have a portal account yet', 404)

  const passwordHash = await hashPassword(req.body.password)
  await userModel.updatePasswordHash(account.id, passwordHash, { mustChangePassword: true })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'RESET_PATIENT_PORTAL_PASSWORD',
    entityType: 'user',
    entityId: account.id,
    details: { patientId: patient.id },
    ipAddress: req.ip,
  })

  res.json({ account: { id: account.id, email: account.email, isActive: account.isActive } })
})

export const summary = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to view this record', 403)
  }

  const treatments = await treatmentModel.listTreatmentsForPatient(patient.id)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'GENERATE_TREATMENT_SUMMARY',
    entityType: 'patient',
    entityId: patient.id,
    ipAddress: req.ip,
  })

  res.json({ patient, treatments })
})
