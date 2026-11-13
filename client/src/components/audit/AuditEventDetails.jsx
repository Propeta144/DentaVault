import { ChevronDown } from 'lucide-react'
import { formatAuditDetails, actionLabel } from '../../utils/auditAction'
import { auditSnapshotRows } from '../../utils/auditDetails'
import { formatDateTime } from '../../utils/formatDate'

function Snapshot({ title, snapshot }) {
  const rows = auditSnapshotRows(snapshot)
  if (!rows.length) return null
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
      <dl className="space-y-2">{rows.map((row) => <div key={row.label}><dt className="text-xs font-medium text-slate-600">{row.label}</dt><dd className="break-words text-sm text-slate-900">{row.value}</dd></div>)}</dl>
    </section>
  )
}

export function AuditDetailBody({ group }) {
  return (
    <ol className="space-y-3 pb-1">
      {group.logs.map((log) => {
        const details = log.details || {}
        const description = formatAuditDetails(details)
        const before = auditSnapshotRows(details.previous).length > 0
        const after = auditSnapshotRows(details.current).length > 0
        const deleted = auditSnapshotRows(details.deleted).length > 0
        return (
          <li key={log.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">{actionLabel(log.action)}</p>
            <p className="mt-1 text-xs text-slate-600">{formatDateTime(log.created_at)}</p>
            <p className="mt-1 break-words text-xs text-slate-600">By {log.user_name || (log.user_id ? 'Former account' : 'System / no account')} · IP {log.ip_address || 'not recorded'}</p>
            {description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{description}</p>}
            {(before || after) && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><Snapshot title={after ? 'Before' : 'Previously recorded'} snapshot={details.previous} /><Snapshot title="After" snapshot={details.current} /></div>}
            {before && !after && <p className="mt-2 text-xs text-slate-600">No after-values were recorded for this event.</p>}
            {deleted && <div className="mt-3"><Snapshot title="Deleted treatment" snapshot={details.deleted} /></div>}
            {!description && !before && !after && !deleted && <p className="mt-2 text-sm text-slate-600">No additional details were recorded for this event.</p>}
          </li>
        )
      })}
    </ol>
  )
}

export default function AuditEventDetails({ group }) {
  const summary = formatAuditDetails(group.details)
  return (
    <div className="min-w-0">
      {summary && <p className="line-clamp-2 break-words text-sm text-slate-600">{summary}</p>}
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm font-medium text-sky-700 hover:bg-sky-50 [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />View details{group.count > 1 ? ` (${group.count} events)` : ''}
        </summary>
        <AuditDetailBody group={group} />
      </details>
    </div>
  )
}
