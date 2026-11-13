import AppError from './AppError.js'
import { normalizePatientCode } from './patientCode.js'

export function auditFilters(query = {}) {
  const filters = {}
  if (query.userId !== undefined && query.userId !== '') {
    if (typeof query.userId !== 'string' || (query.userId !== 'system' && !/^[1-9]\d*$/.test(query.userId)) || (query.userId !== 'system' && !Number.isSafeInteger(Number(query.userId)))) throw new AppError('Choose a valid user filter.')
    filters.userId = query.userId === 'system' ? 'system' : Number(query.userId)
  }
  if (query.patientCode !== undefined && query.patientCode !== '') {
    if (typeof query.patientCode !== 'string' || !normalizePatientCode(query.patientCode)) throw new AppError('Choose a valid patient filter.')
    filters.patientCode = normalizePatientCode(query.patientCode)
  }
  for (const field of ['dateFrom', 'dateTo']) {
    const value = query[field]
    if (value === undefined || value === '') continue
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError('Choose valid audit dates.')
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError('Choose valid audit dates.')
    filters[field] = value
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) throw new AppError('Start date must be on or before end date.')
  return filters
}
