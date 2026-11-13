export function dashboardToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

export function dashboardPreset(preset = 'all', today = dashboardToday()) {
  if (!preset || preset === 'all') return { period: 'all' }
  const [year, month] = today.split('-').map(Number)
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (preset === 'lastMonth') return { dateFrom: dateKey(new Date(year, month - 2, 1)), dateTo: dateKey(new Date(year, month - 1, 0)) }
  const months = preset === 'sixMonths' ? 6 : preset === 'year' ? 12 : 1
  return { dateFrom: dateKey(new Date(year, month - months, 1)), dateTo: today }
}

export function dashboardRangeKey(range) {
  return range?.period === 'all' ? 'all' : `${range?.dateFrom}/${range?.dateTo}`
}

export function dashboardRangeError({ period, dateFrom, dateTo }, today = dashboardToday()) {
  if (period === 'all') return ''
  const valid = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(dateFrom) || !valid(dateTo)) return 'Choose valid start and end dates.'
  if (dateFrom > dateTo) return 'Start date must be on or before end date.'
  if (dateTo > today) return 'End date cannot be in the future.'
  const [year, month] = dateFrom.split('-').map(Number)
  const [endYear, endMonth] = dateTo.split('-').map(Number)
  return (endYear - year) * 12 + endMonth - month >= 24 ? 'Choose a range of up to 24 calendar months.' : ''
}
