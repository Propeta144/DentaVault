import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js'

const directory = path.resolve('uploads', 'avatars')
const cloudPrefix = 'cloudinary:'

export async function storePhoto(buffer) {
  if (isCloudinaryConfigured) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        resource_type: 'image', type: 'authenticated', folder: 'dentavault/avatars', format: 'jpg',
      }, (error, uploaded) => error ? reject(error) : resolve(uploaded))
      stream.end(buffer)
    })
    return cloudPrefix + result.public_id
  }
  await fs.mkdir(directory, { recursive: true })
  const filename = `${crypto.randomUUID()}.jpg`
  await fs.writeFile(path.join(directory, filename), buffer, { flag: 'wx' })
  return filename
}

export function resolvePhoto(file) {
  if (file.startsWith(cloudPrefix)) {
    // Private download URL na may expiration; hindi public image URL.
    return { redirectUrl: cloudinary.utils.private_download_url(file.slice(cloudPrefix.length), 'jpg', {
      resource_type: 'image', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
    }) }
  }
  if (!/^[a-f0-9-]{36}\.jpg$/.test(file)) throw new Error('Invalid stored photo filename')
  return { localPath: path.join(directory, file) }
}

export async function removePhoto(file) {
  if (!file) return
  if (file.startsWith(cloudPrefix)) {
    await cloudinary.uploader.destroy(file.slice(cloudPrefix.length), { resource_type: 'image', type: 'authenticated', invalidate: true })
  } else {
    const { localPath } = resolvePhoto(file)
    await fs.rm(localPath, { force: true })
  }
}
