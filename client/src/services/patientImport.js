import api from './api'

export function importPatientsFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return api
    .post('/patients/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data)
}

// Kailangan din ng template endpoint yung parehong Bearer token gaya ng
// iba, kaya hindi pwedeng gumamit ng plain <a href> — kunin na lang siya
// bilang blob tapos i-trigger yung download nang manual.
export async function downloadImportTemplate() {
  const response = await api.get('/patients/import/template', { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = 'dentavault-patient-import-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
