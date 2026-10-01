import { validationResult } from 'express-validator'
import * as chartModel from '../models/chartModel.js'
import * as patientModel from '../models/patientModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

async function assertPatientAccess(req, patientCode) {
  const patient = await patientModel.findPatientByCode(patientCode)
  if (!patient) throw new AppError('Patient not found', 404)
  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to access this record', 403)
  }
  return patient
}

export const getCurrentChart = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)
  const entries = await chartModel.getCurrentChart(patient.id)
  res.json({ entries })
})

export const getToothHistory = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)
  const history = await chartModel.getToothHistory(patient.id, req.params.toothNumber)
  res.json({ history })
})

export const createEntry = asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }

  const patient = await assertPatientAccess(req, req.params.patientCode)
  const { toothNumber, surface, conditionCode, notes, strokeData } = req.body

  // Yung "whole tooth" entry (extraction, restoration, o full-coverage fact
  // gaya ng crown), sabay na nag-a-apply sa lahat ng 5 surfaces — tignan
  // yung comment ng createWholeToothEntry kung bakit. Kaya rin hindi natin
  // isinasama ang strokeData dito — isang lugar lang ginuhit yun, hindi
  // naman kumakatawan sa lahat ng 5 surfaces kung i-replicate.
  const isWholeTooth = surface === 'whole'
  const entry = isWholeTooth
    ? await chartModel.createWholeToothEntry({
        patientId: patient.id,
        toothNumber,
        conditionCode,
        notes,
        recordedBy: req.user.userId,
      })
    : await chartModel.createChartEntry({
        patientId: patient.id,
        toothNumber,
        surface,
        conditionCode,
        notes,
        strokeData,
        recordedBy: req.user.userId,
      })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'CREATE_CHART_ENTRY',
    entityType: 'chart_entry',
    entityId: entry.id,
    details: {
      patientId: patient.id,
      toothNumber: entry.tooth_number,
      surface: entry.surface,
      conditionCode: entry.condition_code,
      propagatedToAllSurfaces: isWholeTooth,
    },
    ipAddress: req.ip,
  })

  res.status(201).json({ entry })
})
