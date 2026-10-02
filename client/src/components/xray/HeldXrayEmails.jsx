import { useEffect, useState } from 'react'
import { AlertTriangle, FileText, ShieldAlert, Trash2, Users } from 'lucide-react'
import Modal from '../common/Modal'
import StatusBadge from '../common/StatusBadge'
import { useToast } from '../../context/ToastContext'
import { assignHeldXray, dismissHeldXray, fetchHeldXrayObjectUrl } from '../../services/xrays'
import { listName } from '../../utils/patientName'
import { formatActivityTime } from '../../utils/formatDate'

// X-ray emails na HINDI awtomatikong na-file (tignan server
// webhooks.controller.js):
// - shared_email: 2+ patient ang may ganitong email (hal. magulang at mga
//   anak), kaya hindi alam kung kanino — dati, sa una lang napupunta.
// - unverified_sender: hindi pumasa sa SPF, kaya puwedeng peke ang sender.
// Ang dentist ang pipili: i-file sa patient, o i-dismiss (buburahin ang file).

const REASONS = {
  shared_email: {
    badge: 'Shared email',
    icon: Users,
    text: (n) =>
      `This email is on ${n} patient records, so the X-ray was not filed automatically. Choose whose X-ray it is.`,
  },
  unverified_sender: {
    badge: 'Sender not verified',
    icon: ShieldAlert,
    text: () =>
      'The sender’s email could not be verified, so this may not really be from the patient. Check the file before adding it to their record.',
  },
}

function HeldThumbnail({ holdId, file, onOpen }) {
  const [url, setUrl] = useState(null)
  const isPdf = file.mime_type === 'application/pdf'

  useEffect(() => {
    if (isPdf) return undefined
    let objectUrl
    let cancelled = false
    fetchHeldXrayObjectUrl(holdId, file.id)
      .then((u) => {
        if (cancelled) return URL.revokeObjectURL(u)
        objectUrl = u
        setUrl(u)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [holdId, file.id, isPdf])

  return (
    <button
      type="button"
      onClick={() => url && onOpen({ url, name: file.original_filename })}
      disabled={isPdf}
      title={file.original_filename}
      aria-label={isPdf ? `${file.original_filename} (PDF)` : `View ${file.original_filename}`}
      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-500"
    >
      {isPdf ? (
        <span className="flex flex-col items-center gap-1">
          <FileText className="h-5 w-5" />
          PDF
        </span>
      ) : url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        '...'
      )}
    </button>
  )
}

export default function HeldXrayEmails({ holds, onChanged }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(null) // hold id
  const [preview, setPreview] = useState(null) // { url, name }
  const [confirmDismiss, setConfirmDismiss] = useState(null) // hold

  async function handleAssign(hold, patient) {
    setBusy(hold.id)
    try {
      const { xrayCount } = await assignHeldXray(hold.id, patient.patient_code)
      showToast(
        `Filed ${xrayCount} X-ray${xrayCount === 1 ? '' : 's'} to ${listName(patient)}. ${
          xrayCount === 1 ? 'It is' : 'They are'
        } now under New.`,
        { type: 'success' },
      )
      onChanged()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to file the X-ray', { type: 'error' })
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  async function handleDismiss() {
    const hold = confirmDismiss
    setBusy(hold.id)
    try {
      await dismissHeldXray(hold.id)
      showToast('Email dismissed. Its files were deleted.', { type: 'success' })
      setConfirmDismiss(null)
      onChanged()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to dismiss the email', { type: 'error' })
      setConfirmDismiss(null)
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-6" aria-labelledby="held-xrays-title">
      <h2 id="held-xrays-title" className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        Needs your decision
        <StatusBadge variant="amber">{holds.length}</StatusBadge>
      </h2>
      <p className="mb-3 text-base text-slate-500">
        These emailed X-rays were kept aside instead of being filed automatically.
      </p>

      <ul className="space-y-3">
        {holds.map((hold) => {
          const reason = REASONS[hold.reason] || REASONS.unverified_sender
          const ReasonIcon = reason.icon
          const isBusy = busy === hold.id
          return (
            <li key={hold.id} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{hold.sender_email}</p>
                  {hold.subject && <p className="truncate text-sm text-slate-500">&ldquo;{hold.subject}&rdquo;</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge variant="amber" icon={ReasonIcon}>
                    {reason.badge}
                  </StatusBadge>
                  <span className="whitespace-nowrap text-sm text-slate-500">{formatActivityTime(hold.created_at)}</span>
                </div>
              </div>

              <p className="mb-3 text-sm text-slate-600">
                {hold.candidates.length === 0
                  ? 'No patient record has this email anymore. Choose “Dismiss”, or add the email to the right patient first.'
                  : reason.text(hold.candidates.length)}
              </p>

              {hold.files.length > 0 ? (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1" data-scroll-ok>
                  {hold.files.map((f) => (
                    <HeldThumbnail key={f.id} holdId={hold.id} file={f} onOpen={setPreview} />
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-sm text-slate-500">This email had no image or PDF attachments.</p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {hold.files.length > 0 &&
                  hold.candidates.map((p) => (
                    <button
                      key={p.patient_code}
                      type="button"
                      onClick={() => handleAssign(hold, p)}
                      disabled={isBusy}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 text-base font-medium text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-50"
                    >
                      File to {listName(p)}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setConfirmDismiss(hold)}
                  disabled={isBusy}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-base font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 sm:ml-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  Dismiss
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)} maxWidth="max-w-3xl">
          <img src={preview.url} alt={preview.name} className="mx-auto max-h-[70vh] w-auto rounded-lg" />
        </Modal>
      )}

      {confirmDismiss && (
        <Modal title="Dismiss this email?" onClose={() => setConfirmDismiss(null)}>
          <div className="mb-4 flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-base text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              {confirmDismiss.files.length > 0
                ? `The ${confirmDismiss.files.length} attached file${
                    confirmDismiss.files.length === 1 ? '' : 's'
                  } will be deleted and not added to any patient. This can’t be undone.`
                : 'It will be removed from this list.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDismiss(null)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy === confirmDismiss.id}
              className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === confirmDismiss.id ? 'Dismissing...' : 'Dismiss'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
