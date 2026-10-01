import { useState } from 'react'
import { ClipboardPlus } from 'lucide-react'
import { PROCEDURES, FDI_TEETH, ALL_TEETH, isWholeMouthProcedure } from '../../constants/dental'
import { useToast } from '../../context/ToastContext'

// Grouped by quadrant (tugma sa arch labels ng visual 2D chart —
// UPPER RIGHT/LEFT, LOWER RIGHT/LEFT) para may parehong anatomical anchor
// yung pagpili ng ngipin dito kagaya ng pag-click sa odontogram, sa halip
// na flat list lang ng two-digit FDI codes na walang reference point.
const TOOTH_GROUPS = [
  { label: 'Upper Right', teeth: FDI_TEETH.filter((t) => t[0] === '1') },
  { label: 'Upper Left', teeth: FDI_TEETH.filter((t) => t[0] === '2') },
  { label: 'Lower Left', teeth: FDI_TEETH.filter((t) => t[0] === '3') },
  { label: 'Lower Right', teeth: FDI_TEETH.filter((t) => t[0] === '4') },
]

// Nasa loob na ito ng Modal (AddTreatmentModal sa PatientProfilePage):
// dati nasa pinakailalim ito ng Treatment History, kaya kailangan pang
// mag-scroll lampas sa lahat ng lumang treatment bago makapag-record.
// `onCancel`: isinasara ang modal. Ang `onSubmit` ng parent ang nagsasara
// nito pagka-save.
export default function AddTreatmentForm({ onSubmit, onCancel }) {
  const { showToast } = useToast()
  const [procedureName, setProcedureName] = useState('')
  const [toothNumber, setToothNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [treatmentDate, setTreatmentDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const wholeMouth = isWholeMouthProcedure(procedureName)

  function handleProcedureChange(value) {
    setProcedureName(value)
    // Yung whole-mouth procedures (cleaning, fluoride), sa buong bunganga
    // gumagana — wala nang kwentang pagpipilian, kaya ALL_TEETH na lang
    // default tapos naka-lock na yung selector sa halip na pilitin pang
    // pumili ng isang ngipin.
    if (isWholeMouthProcedure(value)) {
      setToothNumber(ALL_TEETH)
    } else if (toothNumber === ALL_TEETH) {
      setToothNumber('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ procedureName, toothNumber, notes, treatmentDate })
      showToast('Treatment entry added.', { type: 'success' })
      setProcedureName('')
      setToothNumber('')
      setNotes('')
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to add treatment'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-base font-medium text-slate-700">Procedure</label>
          <select
            required
            className={inputClass}
            value={procedureName}
            onChange={(e) => handleProcedureChange(e.target.value)}
          >
            <option value="" disabled>
              Select a procedure...
            </option>
            {PROCEDURES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-base font-medium text-slate-700">Tooth</label>
          <select
            required
            disabled={wholeMouth}
            className={inputClass}
            value={toothNumber}
            onChange={(e) => setToothNumber(e.target.value)}
          >
            <option value="" disabled>
              Select...
            </option>
            <option value={ALL_TEETH}>All Teeth / Full Mouth</option>
            {TOOTH_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.teeth.map((t) => (
                  <option key={t} value={t}>
                    Tooth {t}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {wholeMouth && (
            <p className="mt-1 text-sm text-slate-400">Applies to the whole mouth</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-slate-700">Date</label>
        <input
          required
          type="date"
          className={inputClass}
          value={treatmentDate}
          onChange={(e) => setTreatmentDate(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-base font-medium text-slate-700">Notes</label>
        <textarea
          rows={2}
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          <ClipboardPlus className="h-4 w-4" />
          {submitting ? 'Saving...' : 'Save Treatment'}
        </button>
      </div>
    </form>
  )
}
