import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ScrollText, Search, X, Layers } from 'lucide-react'
import { listAuditLogs, listAuditLogActions } from '../services/auditLogs'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import { SkeletonRows } from '../components/common/Skeleton'
import {
  actionVariant,
  actionLabel,
  auditPatientName,
  formatAuditDetails,
  groupAuditLogs,
} from '../utils/auditAction'
import { formatDateTime } from '../utils/formatDate'

// 365 → "1 year", 1825 → "5 years", 90 → "90 days" — mas madaling basahin.
function formatDays(days) {
  if (days % 365 === 0) {
    const years = days / 365
    return `${years} year${years === 1 ? '' : 's'}`
  }
  return `${days} days`
}

// Readable na label sa badge; nasa tooltip pa rin ang eksaktong action
// code (hal. VIEW_XRAY) para sa nag-a-audit na kailangan ang eksaktong tala.
function ActionBadge({ group }) {
  return (
    <span title={group.count > 1 ? `${group.action} ×${group.count}` : group.action}>
      <StatusBadge variant={actionVariant(group.action)} icon={group.count > 1 ? Layers : undefined}>
        {actionLabel(group.action, group.count)}
      </StatusBadge>
    </span>
  )
}

// Pinagsamang grupo (hal. 6 na VIEW_XRAY): oras ng pinakauna hanggang huli
function GroupTime({ group }) {
  if (group.count === 1) return formatDateTime(group.created_at)
  const oldest = group.logs[group.logs.length - 1]
  return (
    <span title={`${formatDateTime(oldest.created_at)} – ${formatDateTime(group.created_at)}`}>
      {formatDateTime(group.created_at)}
    </span>
  )
}

function UserCell({ log }) {
  if (!log.user_name) {
    // hal. unmatched Mailgun inbound email, o ang retention job — walang logged-in user
    return <span className="italic text-slate-400">System</span>
  }
  // Role sa sariling linya: dati katabi ng pangalan, kaya nahahati ang
  // mahabang pangalan sa gitna sa table
  return (
    <>
      <span className="block text-slate-700">{log.user_name}</span>
      {log.user_role && <span className="block text-xs uppercase text-slate-400">{log.user_role}</span>}
    </>
  )
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

  // Display lang ang pagsasama (hal. 6 na VIEW_XRAY → isang row); buo pa
  // rin ang bawat entry sa database at sa bilang na "events total".
  const groups = useMemo(() => groupAuditLogs(data.logs), [data.logs])

  // Naka-sort ayon sa label (hindi sa code) para madaling hanapin sa dropdown
  const actionOptions = useMemo(
    () => [...availableActions].sort((a, b) => actionLabel(a).localeCompare(actionLabel(b))),
    [availableActions],
  )

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

  const inputClass =
    'min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100'

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ScrollText className="h-6 w-6 text-sky-600" />
          Audit Log
        </h1>
        <p className="text-base text-slate-500">
          Who did what, on which patient's record, and when, as required under the Data Privacy Act (RA 10173).
        </p>
        {data.retention?.enabled && (
          <p className="mt-1 text-sm text-slate-400">
            Views are kept here for {formatDays(data.retention.viewDays)}; changes, exports, and logins for{' '}
            {formatDays(data.retention.changeDays)}. Older entries are moved to a secure archive on the server, not
            lost.
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="relative sm:col-span-2 lg:min-w-[16rem] lg:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by user, patient, or action..."
            aria-label="Search audit log"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${inputClass} w-full pl-9`}
          />
        </div>

        <select
          value={action}
          aria-label="Filter by action"
          onChange={(e) => onActionChange(e.target.value)}
          className={`${inputClass} pr-8 sm:col-span-2 lg:w-56`}
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="w-10 text-sm text-slate-500 lg:w-auto" htmlFor="audit-date-from">
            From
          </label>
          <input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={`${inputClass} flex-1`}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-10 text-sm text-slate-500 lg:w-auto" htmlFor="audit-date-to">
            To
          </label>
          <input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={`${inputClass} flex-1`}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-base font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:col-span-2"
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
      )}
      {loading && <SkeletonRows rows={8} label="Loading audit log..." />}

      {!loading && !error && groups.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? 'No activity matches these filters' : 'No activity recorded yet'}
          description={hasFilters ? 'Try a wider date range or clear the filters.' : undefined}
        />
      )}

      {!loading && groups.length > 0 && (
        <>
          {/* Card list hanggang lg (phone, tablet, at laptop na may sidebar): siksik ang 6 na column kapag kulang sa ~1000px */}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
            {groups.map((g) => {
              const patientName = auditPatientName(g)
              const details = formatAuditDetails(g.details)
              return (
                <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  {/* flex-wrap: sa makitid na phone, bumababa ang oras sa
                      ilalim ng mahabang badge (hal. "Reset patient portal
                      password") imbes na tumulak palabas ng screen */}
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <ActionBadge group={g} />
                    <span className="shrink-0 text-right text-sm text-slate-400">
                      <GroupTime group={g} />
                    </span>
                  </div>
                  <p className="mt-2 text-base">
                    <UserCell log={g} />
                  </p>
                  <dl className="mt-2 space-y-1 text-sm text-slate-500">
                    {patientName && (
                      <div>
                        <dt className="inline">Patient: </dt>
                        <dd className="inline font-medium text-slate-700">{patientName}</dd>
                      </div>
                    )}
                    {details && (
                      <div>
                        <dt className="sr-only">Details</dt>
                        <dd className="text-slate-600">{details}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline">IP: </dt>
                      <dd className="inline text-slate-700">{g.ip_address || '—'}</dd>
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>

          {/* Table: lg pataas */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map((g) => {
                  const details = formatAuditDetails(g.details)
                  return (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <GroupTime group={g} />
                      </td>
                      <td className="px-4 py-3">
                        <UserCell log={g} />
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge group={g} />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{auditPatientName(g) || '—'}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500" title={details || undefined}>
                        {details || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{g.ip_address || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.total > 0 && !loading && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <p>
            {data.total} event{data.total === 1 ? '' : 's'} total — page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
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
