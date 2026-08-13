import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

// Opt-in lang si Cloudinary: hangga't hindi pa naka-set itong tatlong env
// vars, babalik lang si xrayStorage.js sa local disk, kagaya talaga ng
// dati niyang gawi — tignan yung .env.example. Walang code path na
// nangangailangan talaga ng Cloudinary account.
export const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
)

export default cloudinary
