import AppError from './AppError.js'
import { clinicToday } from './validators.js'

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function dashboardRange(query = {}, today = clinicToday()) {
  const { period, dateFrom, dateTo } = query
  if (period !== undefined && period !== 'all') throw new AppError('Choose a valid reporting period.')
  const emptyDates = (dateFrom === undefined || dateFrom === '') && (dateTo === undefined || dateTo === '')
  if (emptyDates) return { period: 'all' }
  if (period === 'all') throw new AppError('Choose all time or a date range.')
  if (!validDate(dateFrom) || !validDate(dateTo)) throw new AppError('Choose valid start and end dates.')
  if (dateFrom > dateTo) throw new AppError('Start date must be on or before end date.')
  if (dateTo > today) throw new AppError('End date cannot be in the future.')
  const [year, month] = dateFrom.split('-').map(Number)
  const [endYear, endMonth] = dateTo.split('-').map(Number)
  if ((endYear - year) * 12 + endMonth - month >= 24) throw new AppError('Choose a range of up to 24 calendar months.')
  return { dateFrom, dateTo }
}

export function monthKeys(dateFrom, dateTo) {
  const [year, month] = dateFrom.split('-').map(Number)
  const [endYear, endMonth] = dateTo.split('-').map(Number)
  const result = []
  for (let index = year * 12 + month - 1; index <= endYear * 12 + endMonth - 1; index++) {
    result.push(`${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`)
  }
  return result
}
