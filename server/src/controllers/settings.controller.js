import * as userModel from '../models/userModel.js'
import { getRetentionConfig } from '../services/auditRetentionService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

// Settings page (dentist at patient): account details + email ng clinic
// para sa pagpapadala ng X-ray. Read-only lahat dito; ang pagpalit ng
// password ay nasa /auth/change-password pa rin.
//
// CLINIC_XRAY_EMAIL: ang address na naka-set sa Mailgun route (Receiving →
// Routes). Wala sa code ang address mismo kasi nasa Mailgun account ito,
// kaya kailangang ilagay sa .env para maipakita sa mga pasyente.
export const get = asyncHandler(async (req, res) => {
  const user = await userModel.findUserById(req.user.userId)
  if (!user) throw new AppError('Account not found', 404)

  const isDentist = req.user.role === 'dentist'
  const retention = getRetentionConfig()

  res.json({
    account: { fullName: user.fullName, email: user.email, role: user.role },
    clinic: { name: 'Teodosio-Rufin Dental Clinic' },
    xraySubmissionEmail: process.env.CLINIC_XRAY_EMAIL || null,
    // Dentist lang: gaano katagal itinatago ang audit log (Feature #10)
    retention: isDentist
      ? { enabled: retention.enabled, viewDays: retention.viewDays, changeDays: retention.changeDays }
      : undefined,
  })
})
