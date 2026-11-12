import { Router } from 'express'
import * as settingsController from '../controllers/settings.controller.js'
import { authenticate } from '../middleware/auth.js'
import * as photosController from '../controllers/photos.controller.js'
import { uploadPhoto } from '../config/photoUpload.js'
import { photoUploadLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.use(authenticate)

// Dentist at patient (kanya-kanyang account lang ang nakikita)
router.get('/', settingsController.get)
router.get('/photo', photosController.get)
router.put('/photo', photoUploadLimiter, uploadPhoto.single('file'), photosController.save)
router.delete('/photo', photosController.remove)

export default router
