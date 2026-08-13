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
    next()
  } catch {
    next(new AppError('Invalid or expired token', 401))
  }
}
