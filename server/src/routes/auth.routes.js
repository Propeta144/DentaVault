import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
  ],
  authController.login,
)

router.get('/me', authenticate, authController.me)

// Sariling password (lahat ng role). Tignan ang authService.changePassword.
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isLength({ min: 1 }).withMessage('Enter your current password'),
    body('newPassword')
      .isLength({ min: 8, max: 72 }) // 72 = bcrypt limit; lampas doon, hindi na binabasa
      .withMessage('New password must be 8 to 72 characters'),
  ],
  authController.changePassword,
)

export default router
