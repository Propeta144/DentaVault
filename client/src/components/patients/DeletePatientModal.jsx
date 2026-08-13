import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { deletePatient } from '../../services/patients'
import { useToast } from '../../context/ToastContext'

export default function DeletePatientModal({ patient, onClose, onDeleted }) {
  const { showToast } = useToast()
  const fullName = `${patient.first_name} ${patient.last_name}`
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText.trim().toLowerCase() === fullName.toLowerCase()

  async function handleDelete() {
    setError('')
    setSubmitting(true)
    try {
      await deletePatient(patient.id)
      showToast(`${fullName}'s record has been deleted.`, { type: 'success' })
      onDeleted(patient.id)
      onClose()
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete patient'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Delete Patient Record" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-base text-red-800">
            <p className="font-semibold">
              Are you sure you want to delete {fullName}&apos;s record?
            </p>
            <p className="mt-1">
              This removes them from the active patient list and prevents further edits. Their
              treatment history, X-rays, and dental chart are retained in the system for
              recordkeeping purposes but will no longer be accessible from the app.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-base font-medium text-slate-700">
            Type <span className="font-semibold">{fullName}</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            autoComplete="off"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {submitting ? 'Deleting...' : 'Delete Patient'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
