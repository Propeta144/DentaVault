import * as userModel from '../models/userModel.js'
import { getRetentionConfig } from '../services/auditRetentionService.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

// Settings page (dentist at patient): account details. Read-only lahat
// dito; ang pagpalit ng password ay nasa /auth/change-password pa rin.
export const get = asyncHandler(async (req, res) => {
  const user = await userModel.findUserById(req.user.userId)
  if (!user) throw new AppError('Account not found', 404)

  const isDentist = req.user.role === 'dentist'
  const retention = getRetentionConfig()

  res.json({
    account: { fullName: user.fullName, email: user.email, role: user.role },
    clinic: { name: 'Teodosio-Rufin Dental Clinic' },
    // Dentist lang: gaano katagal itinatago ang audit log (Feature #10)
    retention: isDentist
      ? { enabled: retention.enabled, viewDays: retention.viewDays, changeDays: retention.changeDays }
      : undefined,
  })
})
