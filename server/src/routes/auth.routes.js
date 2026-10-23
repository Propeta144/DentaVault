import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../utils/passwordPolicy.js'
import { loginLimiterByIp, loginLimiterByEmail, changePasswordLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post(
  '/login',
  loginLimiterByIp,
  loginLimiterByEmail,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
  ],
  authController.login,
)

router.get('/me', authenticate, authController.me)
router.post('/logout', authenticate, authController.logout)

// Sariling password (lahat ng role). Tignan ang authService.changePassword.
router.post(
  '/change-password',
  authenticate,
  changePasswordLimiter,
  [
    body('currentPassword').isLength({ min: 1 }).withMessage('Enter your current password'),
    // Haba lang dito; ang buong patakaran (capital, numero, special, hindi
    // pangalan/email) ay nasa authService.changePassword (kailangan ang account)
    body('newPassword')
      .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
      .withMessage(`New password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`),
  ],
  authController.changePassword,
)

export default router
