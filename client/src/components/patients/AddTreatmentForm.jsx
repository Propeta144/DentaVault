import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ClipboardPlus } from 'lucide-react'
import { PROCEDURES, FDI_TEETH, ALL_TEETH, isWholeMouthProcedure } from '../../constants/dental'
import { useToast } from '../../context/ToastContext'
import DiscardChangesBar from '../common/DiscardChangesBar'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { todayISO } from '../../utils/formatDate'

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

// Nasa loob ng Modal (PatientProfilePage). Para sa chairside na paggamit:
// - Procedure = malalaking button (isang tap), hindi dropdown
// - Sariling validation (pulang text sa ilalim ng field), hindi browser
//   popup na "Please select an item in the list" (iba sa ibang form)
// - Default na petsa = NGAYON sa oras ng device (dati UTC: bago mag-8 AM
//   sa Pilipinas, kahapon ang lumalabas)
// - "Add another after saving": hindi na kailangang buksan ulit ang modal
//   kapag maraming procedure sa isang visit
//
// onSubmit(payload, { keepOpen }) — ang parent ang nagsasara kapag !keepOpen.
// guard: galing useDiscardGuard (babala bago mawala ang na-type).
export default function AddTreatmentForm({ onSubmit, guard }) {
  const { showToast } = useToast()
  const ids = { procedure: useId(), tooth: useId(), date: useId(), notes: useId(), another: useId() }
  const [procedureName, setProcedureName] = useState('')
  const [toothNumber, setToothNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [treatmentDate, setTreatmentDate] = useState(todayISO)
  const [addAnother, setAddAnother] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const firstProcedureRef = useRef(null)
  const toothRef = useRef(null)
  const dateRef = useRef(null)

  const wholeMouth = isWholeMouthProcedure(procedureName)
  const dirty = Boolean(procedureName || toothNumber || notes || treatmentDate !== todayISO())
  const setDirty = guard?.setDirty
  // useLayoutEffect: naiuulat agad ang "may binago" (tignan PatientForm)
  useLayoutEffect(() => {
    setDirty?.(dirty)
  }, [dirty, setDirty])

  function handleProcedureChange(value) {
    setProcedureName(value)
    setErrors((prev) => ({ ...prev, procedureName: undefined, toothNumber: undefined }))
    // Yung whole-mouth procedures (cleaning, fluoride), sa buong bunganga
    // gumagana — ALL_TEETH na lang default tapos naka-lock na yung selector.
    if (isWholeMouthProcedure(value)) {
      setToothNumber(ALL_TEETH)
    } else if (toothNumber === ALL_TEETH) {
      setToothNumber('')
    }
  }

  function validate() {
    const next = {}
    if (!procedureName) next.procedureName = 'Choose a procedure'
    if (!toothNumber) next.toothNumber = 'Choose a tooth'
    if (!treatmentDate) next.treatmentDate = 'Enter the treatment date'
    else if (treatmentDate > todayISO()) next.treatmentDate = 'Treatment date cannot be in the future'
    return next
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const next = validate()
    setErrors(next)
    if (next.procedureName) return firstProcedureRef.current?.focus()
    if (next.toothNumber) return toothRef.current?.focus()
    if (next.treatmentDate) return dateRef.current?.focus()

    setSubmitting(true)
    try {
      await onSubmit({ procedureName, toothNumber, notes, treatmentDate }, { keepOpen: addAnother })
      showToast(addAnother ? 'Treatment saved. Add the next one.' : 'Treatment entry added.', { type: 'success' })
      setProcedureName('')
      setToothNumber('')
      setNotes('')
      setDirty?.(false)
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to add treatment')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-md border px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
      hasError ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <p id={ids.procedure} className="mb-2 block text-base font-medium text-slate-700">
          Procedure<span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
        </p>
        <div
          role="radiogroup"
          aria-labelledby={ids.procedure}
          aria-required="true"
          aria-invalid={errors.procedureName ? true : undefined}
          aria-describedby={errors.procedureName ? `${ids.procedure}-error` : undefined}
          className="grid grid-cols-2 gap-2" // 2 column kahit sa phone: mas maikli ang modal, kita ang Save
        >
          {PROCEDURES.map((p, i) => {
            const checked = procedureName === p.value
            return (
              <button
                key={p.value}
                ref={i === 0 ? firstProcedureRef : undefined}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => handleProcedureChange(p.value)}
                className={`min-h-11 rounded-md border px-3 py-2 text-left text-base transition-colors ${
                  checked
                    ? 'border-sky-500 bg-sky-50 font-medium text-sky-900 ring-1 ring-sky-500'
                    : `${errors.procedureName ? 'border-red-300' : 'border-slate-200'} text-slate-700 hover:border-slate-300 hover:bg-slate-50`
                }`}
              >
                {p.value}
              </button>
            )
          })}
        </div>
        {errors.procedureName && (
          <p id={`${ids.procedure}-error`} className="mt-1 text-sm text-red-600">
            {errors.procedureName}
          </p>
        )}
      </div>

      {/* Magkatabi kahit sa phone, para kita ang Save nang hindi nag-i-scroll */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor={ids.tooth} className="mb-1 block text-base font-medium text-slate-700">
            Tooth<span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
          </label>
          <select
            id={ids.tooth}
            ref={toothRef}
            disabled={wholeMouth}
            aria-invalid={errors.toothNumber ? true : undefined}
            aria-describedby={errors.toothNumber ? `${ids.tooth}-error` : undefined}
            className={inputClass(errors.toothNumber)}
            value={toothNumber}
            onChange={(e) => {
              setToothNumber(e.target.value)
              setErrors((prev) => ({ ...prev, toothNumber: undefined }))
            }}
          >
            <option value="" disabled>
              Select a tooth...
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
          {wholeMouth && <p className="mt-1 text-sm text-slate-500">Applies to the whole mouth</p>}
          {errors.toothNumber && (
            <p id={`${ids.tooth}-error`} className="mt-1 text-sm text-red-600">
              {errors.toothNumber}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={ids.date} className="mb-1 block text-base font-medium text-slate-700">
            Date<span className="ml-0.5 text-red-600" aria-hidden="true">*</span>
          </label>
          <input
            id={ids.date}
            ref={dateRef}
            type="date"
            max={todayISO()}
            aria-invalid={errors.treatmentDate ? true : undefined}
            aria-describedby={errors.treatmentDate ? `${ids.date}-error` : undefined}
            className={inputClass(errors.treatmentDate)}
            value={treatmentDate}
            onChange={(e) => {
              setTreatmentDate(e.target.value)
              setErrors((prev) => ({ ...prev, treatmentDate: undefined }))
            }}
          />
          {errors.treatmentDate && (
            <p id={`${ids.date}-error`} className="mt-1 text-sm text-red-600">
              {errors.treatmentDate}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={ids.notes} className="mb-1 block text-base font-medium text-slate-700">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id={ids.notes}
          rows={2}
          maxLength={FIELD_LIMITS.notes}
          className={inputClass(false)}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <label htmlFor={ids.another} className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-slate-700">
        <input
          id={ids.another}
          type="checkbox"
          checked={addAnother}
          onChange={(e) => setAddAnother(e.target.checked)}
          className="h-5 w-5 accent-sky-600"
        />
        Add another treatment after saving
      </label>

      {serverError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {serverError}
        </div>
      )}

      {guard?.confirming ? (
        <DiscardChangesBar guard={guard} />
      ) : (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={guard?.requestClose}
            className="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            <ClipboardPlus className="h-4 w-4" />
            {submitting ? 'Saving...' : 'Save Treatment'}
          </button>
        </div>
      )}
    </form>
  )
}
