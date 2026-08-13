import api from './api'

export function listPatients({ search = '', sort = 'name', page = 1, limit = 20 } = {}) {
  return api.get('/patients', { params: { search, sort, page, limit } }).then((r) => r.data)
}

// Parehong auth-required-blob pattern gaya ng downloadImportTemplate sa
// patientImport.js — hindi kasi makakapagpadala ng Bearer token yung plain
// <a href>.
export async function exportPatientsCsv({ search = '' } = {}) {
  const response = await api.get('/patients/export', { params: { search }, responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `dentavault-patients-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function getPatient(id) {
  return api.get(`/patients/${id}`).then((r) => r.data.patient)
}

export function createPatient(payload) {
  return api.post('/patients', payload).then((r) => r.data.patient)
}

export function updatePatient(id, payload) {
  return api.put(`/patients/${id}`, payload).then((r) => r.data.patient)
}

export function deletePatient(id) {
  return api.delete(`/patients/${id}`)
}

export function listTreatments(patientId) {
  return api.get(`/patients/${patientId}/treatments`).then((r) => r.data.treatments)
}

export function addTreatment(patientId, payload) {
  return api.post(`/patients/${patientId}/treatments`, payload).then((r) => r.data.treatment)
}

export function getSummary(patientId) {
  return api.get(`/patients/${patientId}/summary`).then((r) => r.data)
}

export function getPortalAccount(patientId) {
  return api.get(`/patients/${patientId}/portal-account`).then((r) => r.data.account)
}

export function createPortalAccount(patientId, payload) {
  return api.post(`/patients/${patientId}/portal-account`, payload).then((r) => r.data.account)
}

export function resetPortalAccountPassword(patientId, payload) {
  return api
    .put(`/patients/${patientId}/portal-account/password`, payload)
    .then((r) => r.data.account)
}
