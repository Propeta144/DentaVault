import multer from 'multer'
import AppError from '../utils/AppError.js'

const ALLOWED_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', 'application/json', 'text/plain'])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB — maliit lang naman ang text data ng legacy patient lists

function fileFilter(req, file, cb) {
  const isCsvOrJsonExt = /\.(csv|json)$/i.test(file.originalname)
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) && !isCsvOrJsonExt) {
    return cb(new AppError('Only CSV or JSON files are allowed', 415))
  }
  cb(null, true)
}

// Memory storage: isang beses lang pinapa-parse itong mga files na 'to
// tapos itatapon na, hindi kagaya ng X-ray images na naka-keep sa disk —
// walang na-iiwan para pang i-serve pa ulit mamaya.
export const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
})
