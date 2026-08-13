import api from './api'

export function getCurrentChart(patientId) {
  return api.get(`/patients/${patientId}/chart`).then((r) => r.data.entries)
}

export function getToothHistory(patientId, toothNumber) {
  return api.get(`/patients/${patientId}/chart/${toothNumber}/history`).then((r) => r.data.history)
}

export function createChartEntry(patientId, payload) {
  return api.post(`/patients/${patientId}/chart`, payload).then((r) => r.data.entry)
}
