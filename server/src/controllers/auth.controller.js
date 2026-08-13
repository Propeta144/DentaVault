import { validationResult } from 'express-validator'
import * as authService from '../services/authService.js'
import { findUserById } from '../models/userModel.js'
import asyncHandler from '../utils/asyncHandler.js'
import AppError from '../utils/AppError.js'

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }

  const { email, password } = req.body
  const result = await authService.login({ email, password, ipAddress: req.ip })
  res.json(result)
})

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.userId)
  if (!user) throw new AppError('User not found', 404)
  res.json({ user })
})
