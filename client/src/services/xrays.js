import api from './api'

export function listXrays(patientId) {
  return api.get(`/patients/${patientId}/xrays`).then((r) => r.data.xrays)
}

export function uploadXray(patientId, { file, notes, takenDate }) {
  const formData = new FormData()
  formData.append('file', file)
  if (notes) formData.append('notes', notes)
  if (takenDate) formData.append('takenDate', takenDate)
  return api
    .post(`/patients/${patientId}/xrays`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data.xray)
}

// Kinukuha yung image bilang blob tapos ginagawang object URL, dahil
// kailangan ng file endpoint ng Bearer token na hindi naman kayang
// ipadala ng <img src="">  — mag-401 lang yung plain URL. Tignan yung
// XrayViewer kung paano na-revoke ulit yung URL.
export async function fetchXrayObjectUrl(xrayId) {
  const response = await api.get(`/xrays/${xrayId}/file`, { responseType: 'blob' })
  return URL.createObjectURL(response.data)
}

export function saveAnnotations(xrayId, annotations) {
  return api.put(`/xrays/${xrayId}/annotations`, { annotations }).then((r) => r.data.xray)
}

// 'To yung nagpapagana sa sidebar "new X-ray from email" badge (dentist-only endpoint).
export function getUnreviewedXrayCount() {
  return api.get('/xrays/unreviewed-count').then((r) => r.data.count)
}
