import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ScrollText, Search, X } from 'lucide-react'
import { listAuditLogs, listAuditLogActions } from '../services/auditLogs'
import StatusBadge from '../components/common/StatusBadge'
import { actionVariant, humanizeAction } from '../utils/auditAction'

function formatDetails(details) {
  if (!details || typeof details !== 'object') return '—'
  const parts = Object.entries(details).map(([key, value]) => `${key}: ${value}`)
  return parts.length ? parts.join(', ') : '—'
}

export default function AuditLogPage() {
  const [data, setData] = useState({ logs: [], page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [availableActions, setAvailableActions] = useState([])
  const hasFilters = Boolean(search || action || dateFrom || dateTo)

  useEffect(() => {
    listAuditLogActions()
      .then(setAvailableActions)
      .catch(() => {}) // non-critical lang naman 'to: babalik lang na walang laman yung dropdown
  }, [])

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    listAuditLogs({ page, search, action, dateFrom, dateTo })
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load audit log'))
      .finally(() => setLoading(false))
  }, [page, search, action, dateFrom, dateTo])

  useEffect(() => {
    const timeout = setTimeout(reload, 300) // debounce, para hindi mag-fire ng request sa bawat letrang type sa Search
    return () => clearTimeout(timeout)
  }, [reload])

  // Dapat bumalik sa page 1 tuwing may magbabagong filter — kasi kung
  // naiwan sa page 4 ng unfiltered list habang isang page lang naman yung
  // filtered result set, "no results" ang ipapakita kahit may match naman
  // talaga.
  function updateFilter(setter) {
    return (value) => {
      setter(value)
      setPage(1)
    }
  }
  const onSearchChange = updateFilter(setSearch)
  const onActionChange = updateFilter(setAction)
  const onDateFromChange = updateFilter(setDateFrom)
  const onDateToChange = updateFilter(setDateTo)

  function clearFilters() {
    setSearch('')
    setAction('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ScrollText className="h-6 w-6 text-sky-600" />
          Audit Log
        </h1>
        <p className="text-base text-slate-500">
          Every sensitive read/write in DentaVault, as required under the Data Privacy Act
          (RA 10173) — who did what, on which record, and when.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[16rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by dentist name or record..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <select
          value={action}
          onChange={(e) => onActionChange(e.target.value)}
          className="min-h-11 rounded-md border border-slate-300 py-2.5 pl-3 pr-8 text-base text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          <option value="">All actions</option>
          {availableActions.map((a) => (
            <option key={a} value={a}>
              {humanizeAction(a)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500" htmlFor="audit-date-from">
            From
          </label>
          <input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500" htmlFor="audit-date-to">
            To
          </label>
          <input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="min-h-11 rounded-md border border-slate-300 px-3 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-base font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="px-1 py-6 text-center text-sm text-slate-400">Loading...</p>}

      {!loading && data.logs.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">
          {hasFilters
            ? 'No activity matches these filters.'
            : 'No activity recorded yet.'}
        </p>
      )}

      {!loading && data.logs.length > 0 && (
        <>
          {/* Card list: small screens lang — kopya 'to ng pattern ng
              PatientsListPage, para hindi na masiksik yung dense
              multi-column table sa phone. */}
          <div className="space-y-3 md:hidden">
            {data.logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <StatusBadge variant={actionVariant(log.action)}>{log.action}</StatusBadge>
                  <span className="shrink-0 text-sm text-slate-400">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-base text-slate-700">
                  {log.user_name || <span className="italic text-slate-400">system</span>}
                  {log.user_role && (
                    <span className="ml-1 text-sm uppercase text-slate-400">({log.user_role})</span>
                  )}
                </p>
                <dl className="mt-2 space-y-1 text-sm text-slate-500">
                  <div>
                    <dt className="inline">Record: </dt>
                    <dd className="inline text-slate-700">
                      {log.entity_type
                        ? log.entity_id != null
                          ? `${log.entity_type} #${log.entity_id}`
                          : log.entity_type
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Details: </dt>
                    <dd className="inline text-slate-700">{formatDetails(log.details)}</dd>
                  </div>
                  <div>
                    <dt className="inline">IP: </dt>
                    <dd className="inline text-slate-700">{log.ip_address || '—'}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Table: md pataas */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date/Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {log.user_name || (
                        <span className="italic text-slate-400">
                          system {/* hal. unmatched Mailgun inbound email — walang logged-in user */}
                        </span>
                      )}
                      {log.user_role && (
                        <span className="ml-1 text-xs uppercase text-slate-400">({log.user_role})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={actionVariant(log.action)}>{log.action}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.entity_type
                        ? log.entity_id != null
                          ? `${log.entity_type} #${log.entity_id}`
                          : log.entity_type // hal. EXPORT_PATIENTS_CSV, sumasaklaw sa maraming patients, hindi isang record lang
                        : '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={formatDetails(log.details)}>
                      {formatDetails(log.details)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.total > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <p>
            {data.total} event{data.total === 1 ? '' : 's'} total — page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
