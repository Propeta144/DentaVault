import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { deleteXray } from '../../services/xrays'
import { useToast } from '../../context/ToastContext'

// byPatient (#27): ang patient na nagbubura ng sariling upload na hindi pa
// nare-review (hal. maling file); ibang paliwanag.
export default function DeleteXrayModal({ xray, onClose, onDeleted, byPatient = false }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    setSubmitting(true)
    try {
      await deleteXray(xray.id)
      showToast(byPatient ? 'X-ray removed.' : 'X-ray deleted.', { type: 'success' })
      onDeleted()
      onClose()
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to delete X-ray'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={byPatient ? 'Remove X-ray' : 'Delete X-ray'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-base text-red-800">
            <p className="font-semibold">
              {byPatient ? 'Remove' : 'Delete'} "{xray.original_filename}"?
            </p>
            {byPatient ? (
              <p className="mt-1">
                The clinic will no longer see this X-ray. You can upload the correct file afterwards.
              </p>
            ) : (
              <p className="mt-1">
                This removes it from the patient's X-ray gallery. The file and its annotation
                history are retained in the system for recordkeeping purposes but will no longer
                be accessible from the app.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

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
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {submitting ? (byPatient ? 'Removing...' : 'Deleting...') : byPatient ? 'Remove X-ray' : 'Delete X-ray'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
