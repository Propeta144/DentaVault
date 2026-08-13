import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail } from '../models/userModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import AppError from '../utils/AppError.js'

const SALT_ROUNDS = 12

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function login({ email, password, ipAddress }) {
  const user = await findUserByEmail(email)

  // Same error para sa "no such user" at "wrong password" — huwag hayaang
  // magamit ng attacker yung login form para malaman kung aling emails ang
  // may accounts.
  const invalidCredentials = () => new AppError('Invalid email or password', 401)

  if (!user || !user.is_active) {
    throw invalidCredentials()
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    await recordAuditLog({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
    })
    throw invalidCredentials()
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role, patientId: user.patient_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  )

  await recordAuditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    ipAddress,
  })

  return {
    token,
    user: {
      id: user.id,
      role: user.role,
      patientId: user.patient_id,
      email: user.email,
      fullName: user.full_name,
    },
  }
}
