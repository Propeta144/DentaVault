import { validationResult } from 'express-validator'
import * as xrayModel from '../models/xrayModel.js'
import * as patientModel from '../models/patientModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import { storeXrayFile, resolveXrayFile } from '../services/xrayStorageService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

function assertValid(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }
}

async function assertPatientAccess(req, patientId) {
  const patient = await patientModel.findPatientById(patientId)
  if (!patient) throw new AppError('Patient not found', 404)
  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to access this record', 403)
  }
  return patient
}

export const list = asyncHandler(async (req, res) => {
  await assertPatientAccess(req, req.params.patientId)
  const xrays = await xrayModel.listXraysForPatient(req.params.patientId)
  res.json({ xrays })
})

// Sidebar badge count 'to — dentist-only (tignan route), kaya hindi na
// kailangan ng patient-record access check dito: global count naman 'to,
// hindi scoped sa isang chart lang.
export const unreviewedCount = asyncHandler(async (req, res) => {
  const count = await xrayModel.countUnreviewedEmailXrays()
  res.json({ count })
})

export const upload = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientId)

  if (!req.file) {
    throw new AppError('An X-ray file is required', 422)
  }
  assertValid(req)

  const fileUrl = await storeXrayFile(req.file.buffer, req.file.originalname)

  const xray = await xrayModel.createXray({
    patientId: patient.id,
    fileUrl,
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSizeBytes: req.file.size,
    source: 'manual_upload',
    takenDate: req.body.takenDate || null,
    notes: req.body.notes,
    uploadedBy: req.user.userId,
  })

  await recordAuditLog({
    userId: req.user.userId,
    action: 'UPLOAD_XRAY',
    entityType: 'xray_image',
    entityId: xray.id,
    details: { patientId: patient.id },
    ipAddress: req.ip,
  })

  res.status(201).json({ xray })
})

export const getFile = asyncHandler(async (req, res) => {
  const xray = await xrayModel.findXrayById(req.params.id)
  if (!xray) throw new AppError('X-ray not found', 404)

  if (!canAccessPatientRecord(req.user, xray.patient_id)) {
    throw new AppError('You do not have permission to view this file', 403)
  }

  // Kinukuha ng gallery lahat ng thumbnail pag-load, at 'yon din mismo
  // yung sandaling "nakita" na ng dentist yung bagong email-submitted
  // X-ray — 'yon ang nagliclear sa sidebar badge. Walang mangyayari sa
  // manual uploads at yung mga already-reviewed rows (tignan
  // markXrayReviewed).
  if (req.user.role === 'dentist' && xray.source === 'email_inbound' && !xray.reviewed_at) {
    await xrayModel.markXrayReviewed(xray.id)
  }

  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_XRAY',
    entityType: 'xray_image',
    entityId: xray.id,
    ipAddress: req.ip,
  })

  // Dalawang posibleng backend base sa xrayStorageService.js: yung
  // Cloudinary asset, may makukuhang short-lived signed URL (dire-diretso
  // ire-redirect yung client papuntang Cloudinary — na-gate na naman ng
  // sarili nating auth check sa taas bago pa makarating dito); yung
  // local-disk asset naman, direktang sine-serve, kagaya nung wala pang
  // Cloudinary. Yung file_url, laging alinman sa pangalan na sarili nating
  // ginawa o Cloudinary public_id na nakuha natin mismo galing sa sarili
  // nating upload — hindi kailanman galing sa user input — kaya wala dito
  // na makakatakas sa UPLOAD_DIR.
  const { redirectUrl, localPath } = resolveXrayFile(xray.file_url)
  if (redirectUrl) {
    return res.redirect(redirectUrl)
  }
  res.setHeader('Content-Type', xray.mime_type)
  res.sendFile(localPath)
})

export const updateAnnotations = asyncHandler(async (req, res) => {
  const xray = await xrayModel.findXrayById(req.params.id)
  if (!xray) throw new AppError('X-ray not found', 404)

  // Dentist lang ang nag-a-annotate (clinical review), hindi yung patient.
  const updated = await xrayModel.updateAnnotations(xray.id, req.body.annotations || [])

  await recordAuditLog({
    userId: req.user.userId,
    action: 'ANNOTATE_XRAY',
    entityType: 'xray_image',
    entityId: xray.id,
    ipAddress: req.ip,
  })

  res.json({ xray: updated })
})
