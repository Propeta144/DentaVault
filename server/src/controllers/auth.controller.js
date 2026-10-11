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

export const changePassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422)
  }
  const result = await authService.changePassword({
    userId: req.user.userId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    ipAddress: req.ip,
  })
  res.json(result)
})

// Sign out: pinapawalang-bisa sa server ang token (tignan authService.logout).
export const logout = asyncHandler(async (req, res) => {
  await authService.logout({ userId: req.user.userId, ipAddress: req.ip })
  res.status(204).send()
})

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.userId)
  if (!user) throw new AppError('User not found', 404)
  res.json({ user })
})
