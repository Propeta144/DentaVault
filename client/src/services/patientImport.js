import api from './api'

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

// Migration wizard, step 1 → 2: headers, unang 5 row, at mungkahing mapping
export function previewImportFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/patients/import/preview', formData, multipart).then((r) => r.data)
}

// mapping: { first_name: "First Name", ... } (galing Map Columns step)
// dryRun: true = Validate/Preview lang, walang isinusulat sa database
export function importPatientsFile(file, { mapping, dryRun = false } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (mapping) formData.append('mapping', JSON.stringify(mapping))
  return api
    .post('/patients/import', formData, { ...multipart, params: dryRun ? { dryRun: 1 } : undefined })
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
