import jwt from 'jsonwebtoken'
import AppError from '../utils/AppError.js'
import { findUserAuthState } from '../models/userModel.js'

// Chinicheck yung JWT tapos ini-attach yung { userId, role, patientId } sa
// req.user. Pinapatunayan ng signature kung SINO ang may token; sa database
// naman tinitingnan kung BUHAY pa ang token (security review, #26): dati,
// gumagana pa ang token nang hanggang 8 oras kahit na-reset ang password,
// nag-sign out, o na-delete ang patient.
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Authentication required', 401))
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return next(new AppError('Invalid or expired token', 401))
  }

  // `tv` (token_version) — tinataasan sa password reset/change, sign out, at
  // pag-delete ng patient (tignan userModel.js). Ang token na walang `tv`
  // (galing bago ang update na 'to) ay hindi na rin tinatanggap.
  let state
  try {
    state = await findUserAuthState(req.user.userId)
  } catch (err) {
    return next(err)
  }
  if (!state || !state.isActive || state.patientDeleted) {
    return next(new AppError('Your session has ended. Please sign in again.', 401))
  }
  // `reason`: para masabi ng client kung bakit (hal. nag-login sa ibang
  // device, #39). Dahilan lang, walang detalye ng ibang device.
  if (req.user.tv !== state.tokenVersion) {
    return next(
      new AppError('Your session has ended. Please sign in again.', 401, {
        reason: state.sessionEndReason || 'ended',
      }),
    )
  }

  // Temporary password (mula sa dentist) na hindi pa napapalitan: bawal ang
  // lahat ng API maliban sa pagbasa ng sariling account, pagpalit ng
  // password, at pag-sign out. Server-side ito, kaya hindi malalampasan kahit
  // tawagin nang diretso ang API gamit ang temporary password.
  if (req.user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(req.originalUrl.split('?')[0])) {
    return next(new AppError('Please change your temporary password first', 403))
  }
  next()
}

const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'])
