import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { deleteTreatment } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import { ALL_TEETH } from '../../constants/dental'
import { formatDate } from '../../utils/formatDate'

// Pagbura ng maling treatment entry (Feature #30). Hindi kailangang i-type
// ang pangalan (gaya ng Delete Patient): isang entry lang ito, at naka-log
// sa Audit Log ang buong laman. Kasama ang marka nito sa 2D/3D chart, kaya
// sinasabi iyon dito bago burahin.
export default function DeleteTreatmentModal({ patientCode, treatment, onClose, onDeleted }) {
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const onChart = Number(treatment.chart_entry_count) > 0
  const tooth =
    treatment.tooth_number && (treatment.tooth_number === ALL_TEETH ? 'full mouth' : `tooth ${treatment.tooth_number}`)

  async function handleDelete() {
    setError('')
    setSubmitting(true)
    try {
      await deleteTreatment(patientCode, treatment.id)
      showToast('Treatment deleted.', { type: 'success' })
      onDeleted()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete treatment')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Delete Treatment" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-base text-red-800">
            <p className="font-semibold">
              Delete {treatment.procedure_name}
              {tooth ? ` (${tooth})` : ''} from {formatDate(treatment.treatment_date)}?
            </p>
            <p className="mt-1">
              Use this only for an entry recorded by mistake.
              {onChart && ' Its mark on the 2D and 3D dental chart is removed too, so the tooth shows what was recorded before it.'}
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {submitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
