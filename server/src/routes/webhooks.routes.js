import { Router } from 'express'
import { mailgunInbound } from '../controllers/webhooks.controller.js'
import { uploadMailgunAttachments } from '../config/mailgunUpload.js'
import { webhookLimiterByIp, webhookLimiterGlobal, rejectLargeWebhookBody } from '../middleware/rateLimit.js'

const router = Router()

// Sinadya na WALANG `authenticate` middleware 'to — si Mailgun kasi ang
// tumatawag dito, hindi isang logged-in user. Sa halip, chinicheck ni
// mailgunInbound() yung sariling request signature ni Mailgun; tignan yung
// services/mailgunService.js.
// Rate limit at laki: tinitingnan BAGO basahin ang body (tignan rateLimit.js).
router.post(
  '/webhooks/mailgun/inbound',
  webhookLimiterByIp,
  webhookLimiterGlobal,
  rejectLargeWebhookBody,
  uploadMailgunAttachments,
  mailgunInbound,
)

export default router
