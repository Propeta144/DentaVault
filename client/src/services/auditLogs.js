import api from './api'

// showRoutine: false = nakatago ang pagbukas ng page at matagumpay na sign-in/out
export function listAuditLogs({ page = 1, limit = 50, search, action, dateFrom, dateTo, userId, patientCode, showRoutine = true } = {}) {
  return api
    .get('/audit-logs', {
      params: { page, limit, search, action, dateFrom, dateTo, userId, patientCode, routine: showRoutine ? undefined : 'hide' },
    })
    .then((r) => r.data)
}

// Yung mga distinct action codes na talagang na-log na, para sa filter
// dropdown — hindi naka-tali sa current filter, kaya kumpleto pa rin
// yung option list kahit ano pa yung napili ngayon.
export function listAuditLogActions() {
  return api.get('/audit-logs/actions').then((r) => r.data.actions)
}

export function listAuditFilterOptions(params) {
  return api.get('/audit-logs/filter-options', { params }).then((response) => response.data)
}
