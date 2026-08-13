import * as patientModel from '../models/patientModel.js'
import * as xrayModel from '../models/xrayModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { verifyMailgunSignature, extractSenderEmail } from '../services/mailgunService.js'
import { storeXrayFile } from '../services/xrayStorageService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

// Public, unauthenticated endpoint 'to — wala namang paraan si Mailgun na
// magpadala ng Bearer token, kaya si verifyMailgunSignature() na mismo ang
// auth check dito. Laging 200 ang sasagutin basta tama yung signature,
// kahit "no match" pa yung case: nagre-retry kasi si Mailgun ng inbound
// delivery sa kahit ano maliban sa mabilis na 2xx, tapos yung email na
// wala talagang mata-match (walang ganitong patient), mag-re-retry pa nang
// walang katapusan kung hindi ganito.
export const mailgunInbound = asyncHandler(async (req, res) => {
  const { timestamp, token, signature, sender, from, subject } = req.body
  const messageId = req.body['Message-Id'] || req.body['message-id'] || null
  const files = req.files || []

  if (!verifyMailgunSignature({ timestamp, token, signature })) {
    throw new AppError('Invalid signature', 401)
  }

  const senderEmail = extractSenderEmail({ sender, from })
  const patient = senderEmail ? await patientModel.findPatientByEmail(senderEmail) : null

  if (!patient) {
    await recordAuditLog({
      userId: null,
      action: 'INBOUND_XRAY_EMAIL_UNMATCHED',
      entityType: 'xray_image',
      details: { senderEmail, subject, messageId },
      ipAddress: req.ip,
    })
    return res.status(200).json({ status: 'no matching patient' })
  }

  const attachments = files.filter((f) => f.fieldname.startsWith('attachment'))
  const created = []

  for (let i = 0; i < attachments.length; i++) {
    const file = attachments[i]

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) continue

    // UNIQUE per row yung mailgun_message_id, pero isang email lang,
    // pwede na siyang magdala ng ilang attachments — sufix na lang natin
    // yung position ng attachment para hindi mag-collide yung dalawang
    // images galing sa parehong email. Yung retried delivery (same
    // Message-Id, same attachment order), same suffixed id din ang
    // mareproduce niya, kaya ma-cacatch pa rin siya bilang duplicate sa
    // baba sa halip na ma-double-file.
    const dedupeId = messageId ? (attachments.length > 1 ? `${messageId}#${i}` : messageId) : null

    if (dedupeId) {
      const existing = await xrayModel.findXrayByMailgunMessageId(dedupeId)
      if (existing) continue
    }

    const fileUrl = await storeXrayFile(file.buffer, file.originalname)

    const xray = await xrayModel.createXray({
      patientId: patient.id,
      fileUrl,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      source: 'email_inbound',
      mailgunMessageId: dedupeId,
      uploadedBy: null,
    })
    created.push(xray)
  }

  await recordAuditLog({
    userId: null,
    action: 'INBOUND_XRAY_EMAIL',
    entityType: 'patient',
    entityId: patient.id,
    details: { senderEmail, subject, messageId, xrayCount: created.length },
    ipAddress: req.ip,
  })

  res.status(200).json({ status: 'ok', created: created.length })
})
