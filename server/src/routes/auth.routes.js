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

export default router
