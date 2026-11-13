import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import Modal from '../common/Modal'
import EmptyState from '../common/EmptyState'
import { SkeletonRows } from '../common/Skeleton'
import { listDashboardRecords } from '../../services/dashboard'
import { formatDate, formatDateTime } from '../../utils/formatDate'
import { listName } from '../../utils/patientName'
import { PROFILE_PATH, profileState } from '../../utils/selectedPatient'
import XrayReviewBadge from '../xray/XrayReviewBadge'

export default function DashboardRecordsModal({ selection, range, onClose }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const xray = selection.kind === 'xrays'
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    listDashboardRecords({ ...range, kind: selection.kind, procedure: selection.procedure, page })
      .then((result) => { if (active) setData(result) })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load records.') })
    return () => { active = false }
  }, [selection, range, page, attempt])
  return (
    <Modal title={selection.procedure || (xray ? 'X-ray uploads' : 'Treatments')} onClose={onClose} maxWidth="max-w-3xl">
      <p className="mb-4 text-sm text-slate-600">{range.period === 'all' ? 'All time.' : `${formatDate(range.dateFrom)} to ${formatDate(range.dateTo)} (inclusive).`} {xray ? 'By upload date.' : 'By treatment date.'}</p>
      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          <p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 min-h-11 rounded-md border border-red-300 px-3 font-medium">Retry</button>
        </div>
      ) : !data ? <SkeletonRows rows={4} label="Loading matching records" /> : data.rows.length === 0 ? (
        <EmptyState compact icon={ClipboardList} title="No matching records" description="Choose another reporting period to view records." />
      ) : (
        <>
          <p role="status" className="mb-2 text-sm text-slate-600">{data.total} matching {data.total === 1 ? 'record' : 'records'}</p>
          <ul className="divide-y divide-slate-100">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link to={PROFILE_PATH} state={profileState(row.patient_code, { tab: xray ? 'xrays' : 'history' })}
                  className="flex min-h-14 items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-base font-medium text-slate-900">{listName(row)}</p>
                    <p className="text-sm text-slate-600">Born {formatDate(row.date_of_birth)}</p>
                    <p className="mt-1 break-words text-sm text-slate-800">{xray ? row.original_filename : row.procedure_name}</p>
                    <p className="text-sm text-slate-600">{xray ? `Uploaded ${formatDateTime(row.record_date)}` : `${formatDate(row.record_date)} · ${row.tooth_number && row.tooth_number !== 'ALL' ? `Tooth ${row.tooth_number}` : 'Full mouth'}`}</p>
                    {xray && <div className="mt-1"><XrayReviewBadge xray={row} /></div>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {data && data.totalPages > 1 && (
        <nav aria-label="Matching records pages" className="mt-4 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-3 text-base disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Previous</button>
          <span className="text-sm text-slate-600">{page} / {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)} className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-3 text-base disabled:opacity-50">Next<ChevronRight className="h-4 w-4" /></button>
        </nav>
      )}
    </Modal>
  )
}
