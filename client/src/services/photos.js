import api from './api'
import { createPhotoCache } from '../utils/photoCache'

export const photoCache = createPhotoCache({
  load: getPhotoBlob,
  getToken: () => localStorage.getItem('dentavault_token'),
})

export async function getPhotoBlob(endpoint, version, signal) {
  const response = await api.get(endpoint, { params: { v: version }, responseType: 'blob', signal })
  return response.data
}

export async function savePhoto(endpoint, blob, previousVersion) {
  const token = localStorage.getItem('dentavault_token')
  const form = new FormData()
  form.append('file', blob, 'profile.jpg')
  const { data } = await api.put(endpoint, form)
  photoCache.replace(token, previousVersion, data.photoVersion, blob)
  return data
}

export async function removePhoto(endpoint, previousVersion) {
  const token = localStorage.getItem('dentavault_token')
  const { data } = await api.delete(endpoint)
  photoCache.replace(token, previousVersion, null)
  return data
}
