import { validationResult } from 'express-validator'
import * as chartModel from '../models/chartModel.js'
import * as patientModel from '../models/patientModel.js'
import * as treatmentModel from '../models/treatmentModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'
import { WHOLE_TOOTH_CONDITIONS, INTRAORAL_ITEMS, MOLAR_CLASSES } from '../utils/validators.js'
import { CONDITION_PROCEDURE } from '../utils/treatmentChart.js'

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
  // Pati ang mga kondisyon na para sa buong ngipin (WHOLE_TOOTH_CONDITIONS,
  // hal. Missing, Jacket Crown) kahit sa isang surface pinindot: walang
  // "medyo nawawala" sa mesial lang.
  const isWholeTooth = surface === 'whole' || WHOLE_TOOTH_CONDITIONS.includes(conditionCode)

  // Feature #30: "Also add to Treatment History" — para lang sa kondisyong
  // TREATMENT talaga (Filled, Root Canal, Crown, Extracted...). Ang findings
  // (Decayed, Impacted...) ay walang katapat na procedure.
  const procedureName = req.body.addTreatment === true ? CONDITION_PROCEDURE[conditionCode] : null
  if (req.body.addTreatment === true && !procedureName) {
    throw new AppError('This condition is a finding, not a treatment, so it cannot be added to Treatment History', 422)
  }

  let entry
  let treatmentId = null
  if (procedureName) {
    const created = await treatmentModel.createChartEntryWithTreatment({
      patientId: patient.id,
      procedureName,
      plan: { toothNumber, conditionCode, surfaces: [isWholeTooth ? 'whole' : surface] },
      notes,
      strokeData: isWholeTooth ? null : strokeData,
      recordedBy: req.user.userId,
    })
    treatmentId = created.treatmentId
    entry = await chartModel.findChartEntry(created.chartEntryId)
    await recordAuditLog({
      userId: req.user.userId,
      action: 'CREATE_TREATMENT',
      entityType: 'treatment',
      entityId: treatmentId,
      details: { patientId: patient.id, fromChart: true },
      ipAddress: req.ip,
    })
  } else {
    entry = isWholeTooth
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
  }

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
      ...(treatmentId ? { treatmentId } : {}),
    },
    ipAddress: req.ip,
  })

  res.status(201).json({ entry, treatmentId })
})

// Intraoral Examination (Periodontal, Occlusion, Appliances, TMD) — para sa
// buong bibig. Dentist: basahin at baguhin; patient: sariling record, basa lang.
export const getIntraoral = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)
  const exam = await chartModel.getIntraoralExam(patient.id)
  res.json({ exam })
})

export const saveIntraoral = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)
  const { items, molarClass, appliancesOther } = req.body || {}

  if (!Array.isArray(items) || items.some((i) => !INTRAORAL_ITEMS.includes(i))) {
    throw new AppError('Invalid examination findings', 422)
  }
  if (molarClass != null && molarClass !== '' && !MOLAR_CLASSES.includes(molarClass)) {
    throw new AppError('Molar class must be I, II, or III', 422)
  }
  const other = typeof appliancesOther === 'string' ? appliancesOther.trim() : ''
  if (other.length > 150) throw new AppError('Other appliance must be 150 characters or fewer', 422)

  const findings = {
    items: [...new Set(items)],
    molarClass: molarClass || null,
    appliancesOther: other || null,
  }
  const before = await chartModel.getIntraoralExam(patient.id)
  const exam = await chartModel.saveIntraoralExam(patient.id, findings, req.user.userId)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'UPDATE_INTRAORAL_EXAM',
    entityType: 'patient',
    entityId: patient.id,
    details: { patientId: patient.id, findingCount: findings.items.length, previous: before?.findings ?? null },
    ipAddress: req.ip,
  })

  res.json({ exam })
})
