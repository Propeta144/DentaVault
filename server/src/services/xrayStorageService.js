import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js'
import { UPLOAD_DIR } from '../config/upload.js'

// Isa sa dalawang shapes ang hawak ng xray_images.file_url, nakikilala
// gamit ang prefix:
//   "cloudinary:<public_id>"   -> naka-store sa Cloudinary, access-controlled
//   "<bare-filename>"          -> naka-store sa local disk sa ilalim ng UPLOAD_DIR
// Ibig sabihin nito, gagana pa rin nang walang binago yung mga lumang row
// na nasulat bago pa na-configure si Cloudinary (walang migration na
// kailangan) — bagong uploads lang na ginawa *pagkatapos* ma-set yung
// env vars ang magsisimulang mapunta sa Cloudinary. Ang backend na
// tatanggap ng isang partikular na file, isang beses lang napagdedesisyunan,
// sa oras ng upload, base sa isCloudinaryConfigured.
const CLOUDINARY_PREFIX = 'cloudinary:'

// Medical images ang mga X-ray, kaya hindi kailanman ito sine-serve galing
// sa public at unexpiring na path (tignan yung auth check sa
// xrays.controller.js) — pinapanatili din 'to ng 'authenticated' delivery
// kahit sa Cloudinary: mag-401 yung raw asset URL kung walang signature,
// kaya yung caller ng storeXrayFile() na nakapasa na sa sarili nating
// auth/RBAC check, siya pa rin talaga ang gumagate ng access, hindi yung
// "nahanap mo ba yung URL".
async function uploadToCloudinary(buffer, originalname) {
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        type: 'authenticated',
        folder: 'dentavault/xrays',
        filename_override: originalname,
      },
      (err, res) => (err ? reject(err) : resolve(res)),
    )
    stream.end(buffer)
  })
  return `${CLOUDINARY_PREFIX}${result.public_id}`
}

async function writeToLocalDisk(buffer, originalname) {
  const ext = path.extname(originalname).toLowerCase()
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
  await fs.writeFile(path.join(UPLOAD_DIR, uniqueName), buffer)
  return uniqueName
}

// Sine-save yung bytes ng isang uploaded file (galing sa memoryStorage ni
// multer — tignan config/upload.js at config/mailgunUpload.js) tapos
// ibinabalik yung string na ise-save bilang xray_images.file_url.
export async function storeXrayFile(buffer, originalname) {
  return isCloudinaryConfigured
    ? uploadToCloudinary(buffer, originalname)
    : writeToLocalDisk(buffer, originalname)
}

// Base sa naka-store na file_url, ibinabalik ito bilang { redirectUrl }
// (Cloudinary — short-lived signed URL na diretso kukunin ng client) o
// { localPath } (yung caller ang gagawa ng res.sendFile() dito, gaya ng
// dati).
export function resolveXrayFile(fileUrl) {
  if (fileUrl.startsWith(CLOUDINARY_PREFIX)) {
    const publicId = fileUrl.slice(CLOUDINARY_PREFIX.length)
    const redirectUrl = cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minuto
    })
    return { redirectUrl }
  }
  return { localPath: path.join(UPLOAD_DIR, fileUrl) }
}

// Binubura ang file (local o Cloudinary). Ginagamit lang sa "Dismiss" ng
// X-ray email na hinawakan muna (inbound_xray_holds) — hindi kailanman
// na-file sa patient, at puwedeng galing sa nagpapanggap, kaya walang
// dahilan para itago. (Ang mga X-ray na naka-file na sa patient ay soft
// delete lang, tignan xrays.controller.js remove.) Hindi nagt-throw kapag
// wala na ang file.
export async function deleteXrayFile(fileUrl) {
  if (fileUrl.startsWith(CLOUDINARY_PREFIX)) {
    const publicId = fileUrl.slice(CLOUDINARY_PREFIX.length)
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated' })
    return
  }
  await fs.unlink(path.join(UPLOAD_DIR, fileUrl)).catch((err) => {
    if (err.code !== 'ENOENT') throw err
  })
}
