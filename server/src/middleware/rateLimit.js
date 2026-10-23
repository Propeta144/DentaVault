import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { recordAuditLog } from '../models/auditLogModel.js'

// Proteksyon laban sa brute force (paulit-ulit na paghula ng password).
// MALING subok lang ang binibilang (`skipSuccessfulRequests`), kaya hindi
// naaapektuhan ang normal na pag-login. Pagkalampas sa limit, 429 hanggang
// matapos ang window.
//
// Dalawang susi para sa login:
//  - bawat IP: humaharang sa isang makina na sumusubok ng maraming account.
//  - bawat email: humaharang sa paghula ng password ng IISANG account, kahit
//    magpalit-palit ng IP (napepeke ang IP sa likod ng Vercel; tingnan ang
//    TRUST_PROXY sa app.js). Kapalit: puwedeng ma-lock nang pansamantala ang
//    account ng may-ari kapag may ibang nanghuhula; awtomatikong nawawala
//    pagkatapos ng window.
//
// Nasa memory ng server ang bilang (isang instance lang sa Render), kaya
// nare-reset kapag nag-restart ang server.

const WINDOW_MINUTES = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES) || 15
const MAX_FAILED = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10

function blockedHandler({ name, message, auditAction }) {
  return async (req, res, next, options) => {
    // Isang audit entry lang bawat lock (yung unang naharang na request),
    // para hindi mapuno ang audit log kapag tuloy-tuloy ang pag-atake.
    if (req.rateLimit.used === req.rateLimit.limit + 1) {
      try {
        await recordAuditLog({
          userId: req.user?.userId ?? null,
          action: auditAction,
          entityType: 'user',
          details: { limitedBy: name, windowMinutes: WINDOW_MINUTES },
          ipAddress: req.ip,
        })
      } catch (err) {
        console.error('Failed to record rate-limit audit log', err)
      }
    }
    const minutes = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000))
    res.status(options.statusCode).json({
      error: `${message} Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      retryAfterMinutes: minutes,
    })
  }
}

function failedAttemptLimiter({ name, keyGenerator, message, auditAction }) {
  return rateLimit({
    windowMs: WINDOW_MINUTES * 60 * 1000,
    limit: MAX_FAILED,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    handler: blockedHandler({ name, message, auditAction }),
  })
}

const LOGIN_MESSAGE = 'Too many failed sign-in attempts.'

export const loginLimiterByIp = failedAttemptLimiter({
  name: 'ip',
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  message: LOGIN_MESSAGE,
  auditAction: 'LOGIN_RATE_LIMITED',
})

export const loginLimiterByEmail = failedAttemptLimiter({
  name: 'email',
  keyGenerator: (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase()}`,
  message: LOGIN_MESSAGE,
  auditAction: 'LOGIN_RATE_LIMITED',
})

// Change password: kailangan ang kasalukuyang password, kaya puwede rin itong
// gamitin sa paghula kapag may nakakuha ng naka-login na session.
export const changePasswordLimiter = failedAttemptLimiter({
  name: 'user',
  keyGenerator: (req) => `user:${req.user.userId}`,
  message: 'Too many incorrect password attempts.',
  auditAction: 'CHANGE_PASSWORD_RATE_LIMITED',
})

// --- X-ray upload ng patient (#27) ---
// Hanggang 10 upload bawat 24 oras bawat patient account, para hindi
// mapuno ang storage (Cloudinary) kahit may bug o pang-aabuso. Patient lang:
// walang limit sa dentist. Nauuna ito sa pagbasa ng file (multer).
export const patientXrayUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.PATIENT_XRAY_UPLOADS_PER_DAY) || 10,
  skipFailedRequests: true, // matagumpay na upload lang ang binibilang
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.user?.role !== 'patient',
  keyGenerator: (req) => `patient-upload:${req.user.userId}`,
  handler: (req, res, next, options) =>
    res.status(options.statusCode).json({
      error: 'You have reached today’s upload limit. Please try again tomorrow, or bring the X-ray to the clinic.',
    }),
})
