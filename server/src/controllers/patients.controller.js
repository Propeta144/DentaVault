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

function assertValid(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(50, Number(req.query.limit) || 20)
  const offset = (page - 1) * limit

  const { rows, total } = await patientModel.listPatients({
    search: req.query.search?.trim(),
    sort: req.query.sort,
    limit,
    offset,
  })

  res.json({ patients: rows, page, limit, total, totalPages: Math.ceil(total / limit) })
})

export const exportCsv = asyncHandler(async (req, res) => {
  const patients = await patientModel.listPatientsForExport({ search: req.query.search?.trim() })

  const headers = [
    'Last Name', 'First Name', 'Sex', 'Date of Birth', 'Contact Number', 'Email',
    'Address', 'Medical History', 'Allergies', 'Emergency Contact Name',
    'Emergency Contact Phone', 'Legacy Record', 'Registered On',
  ]
  const rows = patients.map((p) => [
    p.last_name, p.first_name, p.sex, p.date_of_birth, p.contact_number, p.email,
    p.address, p.medical_history, p.allergies, p.emergency_contact_name,
    p.emergency_contact_phone, p.is_legacy_migrated ? 'Yes' : 'No',
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

  const patient = await patientModel.updatePatient(existing.id, req.body)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'UPDATE_PATIENT',
    entityType: 'patient',
    entityId: patient.id,
    ipAddress: req.ip,
  })

  res.json({ patient })
})

export const remove = asyncHandler(async (req, res) => {
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  await patientModel.softDeletePatient(patient.id)

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

export const addTreatment = asyncHandler(async (req, res) => {
  assertValid(req)
  const patient = await patientModel.findPatientByCode(req.params.code)
  if (!patient) throw new AppError('Patient not found', 404)

  const treatment = await treatmentModel.createTreatment({
    patientId: patient.id,
    procedureName: req.body.procedureName,
    toothNumber: req.body.toothNumber,
    notes: req.body.notes,
    treatmentDate: req.body.treatmentDate,
    createdBy: req.user.userId,
  })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'CREATE_TREATMENT',
    entityType: 'treatment',
    entityId: treatment.id,
    details: { patientId: patient.id },
    ipAddress: req.ip,
  })

  res.status(201).json({ treatment })
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
  await userModel.updatePasswordHash(account.id, passwordHash)

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
