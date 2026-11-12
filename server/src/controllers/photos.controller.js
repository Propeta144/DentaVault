import crypto from 'node:crypto'
import * as photoModel from '../models/photoModel.js'
import * as storage from '../services/photoStorageService.js'
import { findUserById } from '../models/userModel.js'
import { findPatientByCode } from '../models/patientModel.js'
import { recordAuditLog } from '../models/auditLogModel.js'
import { canAccessPatientRecord } from '../middleware/rbac.js'
import { validatePhoto } from '../utils/profilePhoto.js'
import AppError from '../utils/AppError.js'
import asyncHandler from '../utils/asyncHandler.js'

export function createPhotoHandlers(deps = {}) {
  const model = deps.model || photoModel, files = deps.storage || storage
  const userById = deps.userById || findUserById, patientByCode = deps.patientByCode || findPatientByCode
  const audit = deps.audit || recordAuditLog
  async function ownerFor(req) {
    if (req.params.code) {
      const patient = await patientByCode(req.params.code)
      if (!patient) throw new AppError('Patient not found', 404)
      if (!canAccessPatientRecord(req.user, patient.id)) throw new AppError('Access denied', 403)
      return { type: 'patient', id: patient.id }
    }
    const user = await userById(req.user.userId)
    if (!user) throw new AppError('Account not found', 404)
    return user.role === 'patient' ? { type: 'patient', id: user.patientId } : { type: 'user', id: user.id }
  }
  async function cleanup(file) {
    if (!file) return
    try { await files.removePhoto(file) } catch { console.error('Could not remove a replaced profile photo') }
  }
  return {
    get: asyncHandler(async (req, res) => {
      const owner = await ownerFor(req)
      const photo = await model.findPhoto(owner)
      if (!photo?.photo_file) throw new AppError('No profile photo', 404)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      const { redirectUrl, localPath } = files.resolvePhoto(photo.photo_file)
      if (redirectUrl) {
        // Server proxy: walang signed storage URL sa browser at walang
        // cross-origin requirement para sa private Cloudinary download.
        const response = await fetch(redirectUrl, { signal: AbortSignal.timeout(10000) })
        if (!response.ok) throw new AppError('Could not load the profile photo', 502)
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > 2 * 1024 * 1024) throw new AppError('Could not load the profile photo', 502)
        return res.type('jpeg').send(buffer)
      }
      res.type('jpeg').sendFile(localPath)
    }),
    save: asyncHandler(async (req, res) => {
      const owner = await ownerFor(req)
      if (req.params.code && req.user.role !== 'dentist') throw new AppError('Access denied', 403)
      if (!req.file) throw new AppError('Choose a photo first', 422)
      validatePhoto(req.file.buffer)
      const version = crypto.randomUUID(), file = await files.storePhoto(req.file.buffer)
      let previous
      try { previous = await model.replacePhoto(owner, file, version) }
      catch (error) { await cleanup(file); throw error }
      await cleanup(previous)
      await audit({ userId: req.user.userId, action: 'UPDATE_PROFILE_PHOTO', entityType: owner.type, entityId: owner.id, ipAddress: req.ip })
      res.json({ photoVersion: version })
    }),
    remove: asyncHandler(async (req, res) => {
      const owner = await ownerFor(req)
      if (req.params.code && req.user.role !== 'dentist') throw new AppError('Access denied', 403)
      const previous = await model.replacePhoto(owner, null, null)
      await cleanup(previous)
      await audit({ userId: req.user.userId, action: 'DELETE_PROFILE_PHOTO', entityType: owner.type, entityId: owner.id, ipAddress: req.ip })
      res.json({ photoVersion: null })
    }),
  }
}

export const { get, save, remove } = createPhotoHandlers()
