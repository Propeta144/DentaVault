import multer from 'multer'
import AppError from '../utils/AppError.js'

// Ang cropper ay nag-eexport ng JPEG; hindi tinatanggap ang SVG/animated files.
export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'image/jpeg') return callback(new AppError('Choose a JPEG, PNG, or WebP image and crop it before saving.', 415))
    callback(null, true)
  },
})
