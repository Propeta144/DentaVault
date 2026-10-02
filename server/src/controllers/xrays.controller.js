import { validationResult } from 'express-validator'
import * as xrayModel from '../models/xrayModel.js'
import * as patientModel from '../models/patientModel.js'
import * as xrayHoldModel from '../models/xrayHoldModel.js'
import { recordAuditLog, listUnmatchedInboundEmails } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import { storeXrayFile, resolveXrayFile, deleteXrayFile } from '../services/xrayStorageService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

function assertValid(req) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }
}

async function assertPatientAccess(req, patientCode) {
  const patient = await patientModel.findPatientByCode(patientCode)
  if (!patient) throw new AppError('Patient not found', 404)
  if (!canAccessPatientRecord(req.user, patient.id)) {
    throw new AppError('You do not have permission to access this record', 403)
  }
  return patient
}

export const list = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)
  const xrays = await xrayModel.listXraysForPatient(patient.id)
  res.json({ xrays })
})

// Sidebar badge count 'to — dentist-only (tignan route), kaya hindi na
// kailangan ng patient-record access check dito: global count naman 'to,
// hindi scoped sa isang chart lang.
// Kasama ang mga email na naghihintay ng desisyon (holds), dahil pareho
// silang "may kailangang tingnan sa X-ray Inbox".
export const unreviewedCount = asyncHandler(async (req, res) => {
  const [unreviewed, held] = await Promise.all([
    xrayModel.countUnreviewedEmailXrays(),
    xrayHoldModel.countPendingHolds(),
  ])
  res.json({ count: unreviewed + held })
})

// X-ray inbox (dentist-only, tignan route): lahat ng X-ray na natanggap sa
// email sa buong clinic + mga email na hindi na-match sa patient. Ito ang
// "notification" na nasa proposal (dentist is notified when an emailed X-ray
// is processed) — dati badge count lang, walang listahan.
export const inbox = asyncHandler(async (req, res) => {
  const status = req.query.status === 'all' ? 'all' : 'new'
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = 20
  const [{ rows, total }, unreviewed, unmatched, held] = await Promise.all([
    xrayModel.listInboxXrays({ status, limit, offset: (page - 1) * limit }),
    xrayModel.countUnreviewedEmailXrays(),
    listUnmatchedInboundEmails(),
    xrayHoldModel.listPendingHolds(),
  ])

  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_XRAY_INBOX',
    entityType: 'xray_image',
    details: { status, page },
    ipAddress: req.ip,
  })

  res.json({ xrays: rows, total, page, limit, status, unreviewedCount: unreviewed, unmatched, held })
})

// "Mark as reviewed" mula sa inbox, nang hindi binubuksan ang X-ray (hal.
// alam na ng dentist kung ano 'yon). Idempotent.
export const markReviewed = asyncHandler(async (req, res) => {
  const xray = await xrayModel.findXrayById(req.params.id)
  if (!xray) throw new AppError('X-ray not found', 404)
  await xrayModel.markXrayReviewed(xray.id)
  await recordAuditLog({
    userId: req.user.userId,
    action: 'MARK_XRAY_REVIEWED',
    entityType: 'xray_image',
    entityId: xray.id,
    details: { patientId: xray.patient_id },
    ipAddress: req.ip,
  })
  res.status(204).send()
})

// --- X-ray emails na hinawakan muna (shared email / hindi pumasa sa SPF) ---
// Dentist-only lahat (tignan route). Tignan webhooks.controller.js kung
// kailan nangyayari ang hold.

// Thumbnail/preview para makapagpasya ang dentist kung kanino ito.
export const getHeldFile = asyncHandler(async (req, res) => {
  const file = await xrayHoldModel.findHoldFile(req.params.holdId, req.params.fileId)
  if (!file || file.status !== 'pending') throw new AppError('File not found', 404)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'VIEW_HELD_XRAY',
    entityType: 'inbound_xray_hold',
    entityId: file.hold_id,
    ipAddress: req.ip,
  })

  const { redirectUrl, localPath } = resolveXrayFile(file.file_url)
  if (redirectUrl) return res.redirect(redirectUrl)
  res.setHeader('Content-Type', file.mime_type)
  res.sendFile(localPath)
})

// I-file sa napiling patient. Kahit sinong patient (hindi lang ang may
// tugmang email): kung minsan ang tamang pasyente ay ang anak na walang
// sariling email sa record.
export const assignHeld = asyncHandler(async (req, res) => {
  assertValid(req)
  const patient = await patientModel.findPatientByCode(req.body.patientCode)
  if (!patient) throw new AppError('Patient not found', 404)

  const count = await xrayHoldModel.assignHold(req.params.holdId, { patientId: patient.id, userId: req.user.userId })
  if (count === null) throw new AppError('This email was already handled', 409)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'ASSIGN_HELD_XRAY',
    entityType: 'patient',
    entityId: patient.id,
    details: { holdId: Number(req.params.holdId), xrayCount: count },
    ipAddress: req.ip,
  })

  res.json({ xrayCount: count })
})

// Hindi ifa-file (hal. spam o hindi kilala). Binubura ang mga file.
export const dismissHeld = asyncHandler(async (req, res) => {
  const fileUrls = await xrayHoldModel.dismissHold(req.params.holdId, { userId: req.user.userId })
  if (fileUrls === null) throw new AppError('This email was already handled', 409)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'DISMISS_HELD_XRAY',
    entityType: 'inbound_xray_hold',
    entityId: Number(req.params.holdId),
    details: { fileCount: fileUrls.length },
    ipAddress: req.ip,
  })

  // Pagkatapos ng commit: kapag pumalya ang pagbura ng isang file, naka-
  // dismiss pa rin (hindi na lalabas kahit saan); ila-log lang.
  for (const url of fileUrls) {
    await deleteXrayFile(url).catch((err) => console.error('Failed to delete held X-ray file:', err.message))
  }

  res.status(204).send()
})

export const upload = asyncHandler(async (req, res) => {
  const patient = await assertPatientAccess(req, req.params.patientCode)

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

// Dentist-only (tignan route) — soft delete, gaya ng ginagawa sa patients:
// hindi tinatanggal yung row o yung file mismo, minamarkahan lang na
// deleted_at para itago sa app, pero manatiling buo sa DB para sa
// retention/audit purposes.
export const remove = asyncHandler(async (req, res) => {
  const xray = await xrayModel.findXrayById(req.params.id)
  if (!xray) throw new AppError('X-ray not found', 404)

  await xrayModel.softDeleteXray(xray.id)

  await recordAuditLog({
    userId: req.user.userId,
    action: 'DELETE_XRAY',
    entityType: 'xray_image',
    entityId: xray.id,
    details: { patientId: xray.patient_id, filename: xray.original_filename },
    ipAddress: req.ip,
  })

  res.status(204).send()
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
