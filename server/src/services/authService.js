import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail, findUserById, updatePasswordHash, bumpTokenVersion } from '../models/userModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import AppError from '../utils/AppError.js'

const SALT_ROUNDS = 12

// Para sa login na hindi kilala ang email: kinukumpara pa rin sa isang pekeng
// hash para pareho ang tagal ng sagot (~bcrypt) kahit may account o wala.
// Dati, 1–5 ms lang kapag walang account vs ~400 ms kapag meron, kaya
// nalalaman kung aling email ang naka-register (security review, #26).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), SALT_ROUNDS)

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

// Kasama sa token ang `mustChangePassword`: binabasa ito ng authenticate
// middleware para harangin ang lahat ng ibang API (maliban sa /auth/me at
// /auth/change-password) hangga't hindi pa napapalitan ang temporary
// password — server-side, hindi lang redirect sa client.
// `tv` = users.token_version noong nag-login; kapag tumaas na ito sa database
// (password reset, sign out, na-delete ang patient), hindi na tatanggapin
// ang token (tignan middleware/auth.js).
function signToken({ id, role, patientId, mustChangePassword, tokenVersion }) {
  return jwt.sign(
    { userId: id, role, patientId, tv: Number(tokenVersion), ...(mustChangePassword ? { mustChangePassword: true } : {}) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  )
}

export async function login({ email, password, ipAddress }) {
  const user = await findUserByEmail(email)

  // Same error para sa "no such user" at "wrong password" — huwag hayaang
  // magamit ng attacker yung login form para malaman kung aling emails ang
  // may accounts.
  const invalidCredentials = () => new AppError('Invalid email or password', 401)

  if (!user || !user.is_active) {
    await bcrypt.compare(password, DUMMY_HASH)
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

  const mustChangePassword = Boolean(user.must_change_password)
  const token = signToken({
    id: user.id,
    role: user.role,
    patientId: user.patient_id,
    mustChangePassword,
    tokenVersion: user.token_version,
  })

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
      patientCode: user.patient_code,
      email: user.email,
      fullName: user.full_name,
      mustChangePassword,
    },
  }
}

// Pagpalit ng sariling password (hal. temporary password mula sa dentist).
// Kailangan ang kasalukuyang password, kahit naka-login na — para hindi
// mapalitan ng ibang taong nakagamit ng naiwang nakabukas na device.
// Bagong token ang ibinabalik (wala nang mustChangePassword).
export async function changePassword({ userId, currentPassword, newPassword, ipAddress }) {
  const account = await findUserById(userId)
  if (!account) throw new AppError('User not found', 404)
  const { password_hash: currentHash } = await findUserByEmail(account.email)

  const matches = await bcrypt.compare(currentPassword, currentHash)
  if (!matches) throw new AppError('Current password is incorrect', 422)
  if (await bcrypt.compare(newPassword, currentHash)) {
    throw new AppError('Choose a new password that is different from the current one', 422)
  }

  await updatePasswordHash(userId, await hashPassword(newPassword), { mustChangePassword: false })
  await recordAuditLog({
    userId,
    action: 'CHANGE_OWN_PASSWORD',
    entityType: 'user',
    entityId: userId,
    ipAddress,
  })

  const user = await findUserById(userId)
  return { token: signToken(user), user }
}

// Sign out: hindi na gagana ang lahat ng token ng user na 'to (lahat ng
// device), hindi lang binubura sa browser.
export async function logout({ userId, ipAddress }) {
  await bumpTokenVersion(userId)
  await recordAuditLog({
    userId,
    action: 'LOGOUT',
    entityType: 'user',
    entityId: userId,
    ipAddress,
  })
}
