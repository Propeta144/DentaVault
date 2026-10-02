import * as patientModel from '../models/patientModel.js'
import * as xrayModel from '../models/xrayModel.js'
import * as xrayHoldModel from '../models/xrayHoldModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { verifyMailgunSignature, extractSenderEmail, senderAuthentication } from '../services/mailgunService.js'
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
  const matches = senderEmail ? await patientModel.findPatientsByEmail(senderEmail) : []
  const auth = senderAuthentication(req.body)

  if (matches.length === 0) {
    await recordAuditLog({
      userId: null,
      action: 'INBOUND_XRAY_EMAIL_UNMATCHED',
      entityType: 'xray_image',
      details: { senderEmail, subject, messageId, spf: auth.spf },
      ipAddress: req.ip,
    })
    return res.status(200).json({ status: 'no matching patient' })
  }

  const attachments = files.filter((f) => f.fieldname.startsWith('attachment'))
  const allowed = attachments.filter((f) => ALLOWED_MIME_TYPES.has(f.mimetype))

  // Hindi awtomatikong ifa-file kapag:
  // - 2+ patient ang may ganitong email (hal. iisang email ng magulang para
  //   sa mga anak) — dati, LIMIT 1 lang, kaya puwedeng mapunta ang X-ray sa
  //   maling anak nang walang babala;
  // - hindi pumasa sa SPF (puwedeng peke ang sender — tignan mailgunService).
  // Iniimbak muna ang mga file (para hindi na kailangang ipadala ulit ng
  // pasyente), pero hindi makikita sa kahit anong patient record hangga't
  // hindi pinipili ng dentist sa X-ray Inbox.
  const holdReason = matches.length > 1 ? 'shared_email' : !auth.verified ? 'unverified_sender' : null
  if (holdReason) {
    if (messageId && (await xrayHoldModel.findHoldByMessageId(messageId))) {
      return res.status(200).json({ status: 'duplicate' }) // retry ni Mailgun
    }
    if (allowed.length === 0) {
      await recordAuditLog({
        userId: null,
        action: 'INBOUND_XRAY_EMAIL_HELD',
        entityType: 'inbound_xray_hold',
        details: { senderEmail, subject, messageId, reason: holdReason, matchCount: matches.length, spf: auth.spf, dkim: auth.dkim, fileCount: 0 },
        ipAddress: req.ip,
      })
      return res.status(200).json({ status: 'held', files: 0 })
    }

    const stored = []
    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i]
      stored.push({
        fileUrl: await storeXrayFile(file.buffer, file.originalname),
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        // parehong patakaran ng dedupeId sa baba
        dedupeId: messageId ? (allowed.length > 1 ? `${messageId}#${i}` : messageId) : null,
      })
    }
    const holdId = await xrayHoldModel.createHold({
      reason: holdReason,
      senderEmail,
      subject,
      messageId,
      spf: auth.spf,
      dkim: auth.dkim,
      files: stored,
    })
    await recordAuditLog({
      userId: null,
      action: 'INBOUND_XRAY_EMAIL_HELD',
      entityType: 'inbound_xray_hold',
      entityId: holdId,
      details: { senderEmail, subject, messageId, reason: holdReason, matchCount: matches.length, spf: auth.spf, dkim: auth.dkim, fileCount: stored.length },
      ipAddress: req.ip,
    })
    return res.status(200).json({ status: 'held', files: stored.length })
  }

  const patient = matches[0]
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
    details: { senderEmail, subject, messageId, xrayCount: created.length, spf: auth.spf },
    ipAddress: req.ip,
  })

  res.status(200).json({ status: 'ok', created: created.length })
})
