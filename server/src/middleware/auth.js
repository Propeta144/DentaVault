import jwt from 'jsonwebtoken'
import AppError from '../utils/AppError.js'

// Chinicheck yung JWT tapos ini-attach yung { userId, role, patientId } sa
// req.user. Kahit anong route na nasa likod ng middleware na 'to, pwede
// nang basta magtiwala sa req.user nang hindi na chinicheck ulit yung
// database — yung signature ng token na mismo ang patunay ng identity.
export function authenticate(req, res, next) {
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

  // Temporary password (mula sa dentist) na hindi pa napapalitan: bawal ang
  // lahat ng API maliban sa pagbasa ng sariling account at pagpalit ng
  // password. Server-side ito, kaya hindi malalampasan kahit tawagin nang
  // diretso ang API gamit ang temporary password.
  if (req.user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(req.originalUrl.split('?')[0])) {
    return next(new AppError('Please change your temporary password first', 403))
  }
  next()
}

const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/change-password'])
