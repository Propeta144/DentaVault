import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Inbox, MailCheck, MailWarning, ScanLine, CheckCheck, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { getXrayInbox, markXrayReviewed } from '../services/xrays'
import { useToast } from '../context/ToastContext'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import { SkeletonRows } from '../components/common/Skeleton'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'
import { listName } from '../utils/patientName'
import { formatActivityTime, formatDate } from '../utils/formatDate'

// X-ray Inbox (dentist): lahat ng X-ray na ipinadala ng mga pasyente sa
// email ng clinic (Mailgun inbound), sa buong clinic. Ayon sa proposal,
// "notified" dapat ang dentist kapag may na-process na X-ray galing email —
// dati badge count lang sa menu, at kailangan pang hulaan kung kaninong
// patient iyon. Ngayon:
// - New: hindi pa nabubuksan; "Open" → diretso sa X-rays tab ng patient
//   (doon nagiging "reviewed" — parehong patakaran ng dati).
// - Mark reviewed: kapag alam na ng dentist, hindi na kailangang buksan.
// - Mga email na hindi na-match (hindi kilala ang sender): hindi sila
//   naiimbak, kaya dito lang makikita para maidagdag ang email sa patient.
const FILTERS = [
  { value: 'new', label: 'New' },
  { value: 'all', label: 'All from email' },
]

function StatusCell({ xray }) {
  if (!xray.reviewed_at) return <StatusBadge variant="amber">New</StatusBadge>
  return (
    <span className="whitespace-nowrap text-sm text-slate-500">Reviewed {formatDate(xray.reviewed_at)}</span>
  )
}

export default function XrayInboxPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [status, setStatus] = useState('new')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [marking, setMarking] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getXrayInbox({ status, page })
      .then((d) => {
        setData(d)
        setError('')
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load the X-ray inbox'))
      .finally(() => setLoading(false))
  }, [status, page])

  useEffect(() => {
    load()
  }, [load])

  function changeFilter(value) {
    setStatus(value)
    setPage(1)
  }

  function openXray(xray) {
    navigate(PROFILE_PATH, { state: profileState(xray.patient_code, { tab: 'xrays' }) })
  }

  async function handleMarkReviewed(xray) {
    setMarking(xray.id)
    try {
      await markXrayReviewed(xray.id)
      showToast(`Marked ${xray.original_filename} as reviewed.`, { type: 'success' })
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to mark as reviewed', { type: 'error' })
    } finally {
      setMarking(null)
    }
  }

  const xrays = data?.xrays || []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const unmatched = data?.unmatched || []

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Inbox className="h-6 w-6 text-sky-600" />
            X-ray Inbox
          </h1>
          <p className="text-base text-slate-500">X-rays patients sent by email. Open one to review it in their record.</p>
        </div>
      </div>

      {/* Filter: New / All (segmented, gaya ng 2D/3D toggle) */}
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={status === f.value}
            onClick={() => changeFilter(f.value)}
            className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-4 text-base font-medium transition-colors ${
              status === f.value ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {f.label}
            {f.value === 'new' && data?.unreviewedCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                {data.unreviewedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
      )}

      {loading && !data ? (
        <SkeletonRows rows={4} label="Loading X-ray inbox..." />
      ) : xrays.length === 0 ? (
        <div>
          {status === 'new' ? (
            <EmptyState
              icon={MailCheck}
              title="All caught up"
              description="No new X-rays from email. New ones show up here as soon as a patient sends them."
              action={
                <button
                  type="button"
                  onClick={() => changeFilter('all')}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Show all from email
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={ScanLine}
              title="No X-rays received by email yet"
              description="When a patient emails an X-ray from the address on their record, it is filed automatically and listed here."
            />
          )}
        </div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="space-y-3 md:hidden">
            {xrays.map((x) => (
              <li key={x.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{listName(x)}</p>
                    <p className="truncate text-sm text-slate-500">{x.original_filename}</p>
                  </div>
                  <StatusCell xray={x} />
                </div>
                <p className="mb-3 text-sm text-slate-500">Received {formatActivityTime(x.created_at)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openXray(x)}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {!x.reviewed_at && (
                    <button
                      type="button"
                      onClick={() => handleMarkReviewed(x)}
                      disabled={marking === x.id}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <CheckCheck className="h-4 w-4" />
                      {marking === x.id ? 'Saving...' : 'Mark reviewed'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* md pataas: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Patient</th>
                  {/* File: sariling column sa xl lang; sa mas makitid, nasa ilalim ng pangalan */}
                  <th className="hidden px-4 py-3 xl:table-cell">File</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {xrays.map((x) => (
                  <tr key={x.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatActivityTime(x.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        to={PROFILE_PATH}
                        state={profileState(x.patient_code, { tab: 'xrays' })}
                        className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                      >
                        {listName(x)}
                      </Link>
                      <span className="block max-w-56 truncate text-sm text-slate-500 xl:hidden" title={x.original_filename}>
                        {x.original_filename}
                      </span>
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-slate-600 xl:table-cell" title={x.original_filename}>
                      {x.original_filename}
                    </td>
                    <td className="px-4 py-3">
                      <StatusCell xray={x} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {!x.reviewed_at && (
                          <button
                            type="button"
                            onClick={() => handleMarkReviewed(x)}
                            disabled={marking === x.id}
                            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-700 disabled:opacity-50"
                          >
                            <CheckCheck className="h-4 w-4" />
                            {marking === x.id ? 'Saving...' : 'Mark reviewed'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openXray(x)}
                          className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                        >
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} · {data.total} X-ray{data.total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1 || loading}
                  className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages || loading}
                  className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {unmatched.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-amber-900">
            <MailWarning className="h-5 w-5" />
            Emails from unknown senders (last 90 days)
          </h2>
          <p className="mb-3 text-sm text-amber-800">
            These X-rays were not saved because the sender&apos;s email is not on any patient record. Add the email to
            the right patient (Edit patient), then ask them to send it again.
          </p>
          <ul className="divide-y divide-amber-200">
            {unmatched.map((u) => (
              <li key={u.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-amber-950">{u.senderEmail || 'Unknown sender'}</p>
                  {u.subject && <p className="truncate text-sm text-amber-800">&ldquo;{u.subject}&rdquo;</p>}
                </div>
                <p className="shrink-0 text-sm text-amber-800">{formatActivityTime(u.receivedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
