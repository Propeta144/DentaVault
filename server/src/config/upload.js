import multer from 'multer'
import path from 'node:path'
import AppError from '../utils/AppError.js'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'xrays')

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf', // minsan dumadating na printed/scanned PDFs yung panoramic scans
])
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15MB

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG, WebP, or PDF files are allowed', 415))
  }
  cb(null, true)
}

// Memory storage, hindi disk: kailangan lang mag-exist yung file bilang
// buffer, sapat lang na oras para maipasa ni xrayStorageService.
// storeXrayFile() papunta sa Cloudinary o isulat mismo sa disk — tignan
// yung file na 'yon kung alin sa dalawa ang talagang nangyayari.
export const uploadXray = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
})

export { UPLOAD_DIR }
