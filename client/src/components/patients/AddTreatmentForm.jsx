import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ClipboardPlus, Grid3x3, Save } from 'lucide-react'
import {
  PROCEDURES,
  ALL_TEETH,
  TOOTH_SELECT_GROUPS,
  SURFACES,
  PROCEDURE_CHART,
  isWholeMouthProcedure,
  conditionLabel,
} from '../../constants/dental'
import { useToast } from '../../context/ToastContext'
import DiscardChangesBar from '../common/DiscardChangesBar'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { todayISO } from '../../utils/formatDate'

// Nasa loob ng Modal (PatientProfilePage). Para sa chairside na paggamit:
// - Procedure = malalaking button (isang tap), hindi dropdown
// - Sariling validation (pulang text sa ilalim ng field), hindi browser
//   popup na "Please select an item in the list" (iba sa ibang form)
// - Default na petsa = NGAYON sa oras ng device (dati UTC: bago mag-8 AM
//   sa Pilipinas, kahapon ang lumalabas)
// - "Add another after saving": hindi na kailangang buksan ulit ang modal
//   kapag maraming procedure sa isang visit
// - Feature #30: naka-sync sa 2D/3D chart. Kapag may katapat na marka ang
//   procedure (Filling, Extraction, Root Canal, Crown...), lalabas din ito sa
//   chart; ang pang-surface (filling, sealant) ay may pagpipilian ng surface.
//   Ginagamit din ito sa EDIT ng treatment (prop na `treatment`).
//
// onSubmit(payload, { keepOpen }) — ang parent ang nagsasara kapag !keepOpen.
// guard: galing useDiscardGuard (babala bago mawala ang na-type).
// Maikling label (buo sa tooltip) para magkasya sa hanay ng Tooth at Date
const SHORT_SURFACE = { occlusal: 'Occlusal', facial: 'Facial', lingual: 'Lingual' }
const CHART_SURFACES = SURFACES.filter((s) => s.code !== 'whole').map((s) => ({
  ...s,
  short: SHORT_SURFACE[s.code] || s.label,
}))

const choiceClass = (checked, hasError = false) =>
  `min-h-11 rounded-md border px-3 py-2 text-left text-base leading-snug transition-colors ${
    checked
      ? 'border-sky-500 bg-sky-50 font-medium text-sky-900 ring-1 ring-sky-500'
      : `${hasError ? 'border-red-300' : 'border-slate-200'} text-slate-700 hover:border-slate-300 hover:bg-slate-50`
  }`

export default function AddTreatmentForm({ onSubmit, guard, treatment }) {
  const { showToast } = useToast()
  const isEdit = Boolean(treatment)
  const ids = {
    procedure: useId(),
    tooth: useId(),
    date: useId(),
    notes: useId(),
    another: useId(),
    surfaces: useId(),
    reason: useId(),
  }
  // Edit: laman ng treatment; Add: blangko (petsa = ngayon)
  const [initial] = useState(() => ({
    procedureName: treatment?.procedure_name || '',
    toothNumber: treatment?.tooth_number || '',
    notes: treatment?.notes || '',
    treatmentDate: treatment?.treatment_date || todayISO(),
    surfaces: treatment?.surfaces ? treatment.surfaces.split(',') : [],
    chartCondition: treatment?.chart_condition || '',
  }))
  const [procedureName, setProcedureName] = useState(initial.procedureName)
  const [toothNumber, setToothNumber] = useState(initial.toothNumber)
  const [notes, setNotes] = useState(initial.notes)
  const [treatmentDate, setTreatmentDate] = useState(initial.treatmentDate)
  const [surfaces, setSurfaces] = useState(initial.surfaces)
  const [chartCondition, setChartCondition] = useState(initial.chartCondition)
  const [addAnother, setAddAnother] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const firstProcedureRef = useRef(null)
  const toothRef = useRef(null)
  const dateRef = useRef(null)

  const wholeMouth = isWholeMouthProcedure(procedureName)
  // Marka sa chart (Feature #30). Kapareho ng chartPlanFor sa server.
  const chartMap = PROCEDURE_CHART[procedureName]
  const chartTooth = Boolean(chartMap && toothNumber && toothNumber !== ALL_TEETH)
  const needsSurfaces = chartTooth && chartMap.scope === 'surface'
  const hasReasonChoice = chartTooth && chartMap.scope === 'whole' && chartMap.conditions.length > 1
  const willShowOnChart = chartTooth && (!needsSurfaces || surfaces.length > 0)

  const dirty =
    procedureName !== initial.procedureName ||
    toothNumber !== initial.toothNumber ||
    notes !== initial.notes ||
    treatmentDate !== initial.treatmentDate ||
    surfaces.join() !== initial.surfaces.join() ||
    chartCondition !== initial.chartCondition
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
    // Ibang procedure = ibang marka sa chart. Ang surfaces ay para lang sa
    // pang-surface (filling, sealant...)
    if (PROCEDURE_CHART[value]?.scope !== 'surface') setSurfaces([])
    if (!PROCEDURE_CHART[value]?.conditions.includes(chartCondition)) setChartCondition('')
  }

  // Laging parehong pagkakasunod (M, D, O, F, L), kahit ano ang unang pinindot
  function toggleSurface(code) {
    setSurfaces((prev) => {
      const next = prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
      return CHART_SURFACES.map((s) => s.code).filter((c) => next.includes(c))
    })
  }

  function validate() {
    const next = {}
    if (!procedureName) next.procedureName = 'Choose a procedure'
    // Edit ng lumang import na walang ngipin: puwedeng manatiling blangko
    if (!toothNumber && !(isEdit && !initial.toothNumber)) next.toothNumber = 'Choose a tooth'
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
      await onSubmit(
        {
          procedureName,
          toothNumber,
          notes,
          treatmentDate,
          surfaces: needsSurfaces ? surfaces : null,
          chartCondition: hasReasonChoice ? chartCondition || chartMap.conditions[0] : null,
        },
        { keepOpen: addAnother },
      )
      const chartNote = willShowOnChart ? ' Also shown on the dental chart.' : ''
      showToast(
        isEdit
          ? `Treatment updated.${chartNote}`
          : addAnother
            ? `Treatment saved.${chartNote} Add the next one.`
            : `Treatment entry added.${chartNote}`,
        { type: 'success' },
      )
      if (!isEdit) {
        setProcedureName('')
        setToothNumber('')
        setNotes('')
        setSurfaces([])
        setChartCondition('')
      }
      setDirty?.(false)
    } catch (err) {
      setServerError(err.response?.data?.error || (isEdit ? 'Failed to update treatment' : 'Failed to add treatment'))
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
          // 17 na ang procedures (client visit): maikling pangalan (`short`,
          // buo sa tooltip) at 2–5 column, para kita pa rin ang Save nang
          // hindi nag-i-scroll sa laptop (1366×768). Nakaayos ayon sa grupo
          // (Diagnostic → Cosmetic), tignan PROCEDURES sa dental.js.
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {PROCEDURES.map((p, i) => (
            <button
              key={p.value}
              ref={i === 0 ? firstProcedureRef : undefined}
              type="button"
              role="radio"
              aria-checked={procedureName === p.value}
              title={p.short ? p.value : undefined}
              onClick={() => handleProcedureChange(p.value)}
              className={choiceClass(procedureName === p.value, errors.procedureName)}
            >
              {p.short || p.value}
            </button>
          ))}
        </div>
        {/* Lumang procedure na wala na sa listahan (hal. "Crown / Bridge" o
            galing import): ipinapakita pa rin kapag ine-edit */}
        {isEdit && procedureName && !PROCEDURES.some((p) => p.value === procedureName) && (
          <p className="mt-2 text-sm text-slate-500">
            Current: <span className="font-medium text-slate-700">{procedureName}</span>. Choose one above to change it.
          </p>
        )}
        {errors.procedureName && (
          <p id={`${ids.procedure}-error`} className="mt-1 text-sm text-red-600">
            {errors.procedureName}
          </p>
        )}
      </div>

      {/* Magkatabi kahit sa phone, para kita ang Save nang hindi nag-i-scroll.
          Laptop: kasama sa iisang hanay ang Surfaces / Reason (Feature #30),
          para kita pa rin ang Save sa 1366×768 */}
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${
          needsSurfaces || hasReasonChoice ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : ''
        }`}
      >
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
            {TOOTH_SELECT_GROUPS.map((group) => (
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

        {/* Feature #30: marka sa 2D/3D chart */}
        {needsSurfaces && (
          <div className="col-span-2 lg:col-span-1">
            <p id={ids.surfaces} className="mb-2 block text-base font-medium text-slate-700">
              Surfaces <span className="font-normal text-slate-400">(for the chart)</span>
            </p>
            <div role="group" aria-labelledby={ids.surfaces} className="flex flex-wrap gap-2">
              {CHART_SURFACES.map((sf) => (
                <button
                  key={sf.code}
                  type="button"
                  aria-pressed={surfaces.includes(sf.code)}
                  onClick={() => toggleSurface(sf.code)}
                  title={sf.label}
                  className={`whitespace-nowrap ${choiceClass(surfaces.includes(sf.code))}`}
                >
                  {sf.short}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasReasonChoice && (
          <div className="col-span-2 lg:col-span-1">
            <p id={ids.reason} className="mb-2 block text-base font-medium text-slate-700">
              Reason <span className="font-normal text-slate-400">(for the chart)</span>
            </p>
            <div role="radiogroup" aria-labelledby={ids.reason} className="flex flex-wrap gap-2">
              {chartMap.conditions.map((code) => {
                const checked = (chartCondition || chartMap.conditions[0]) === code
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setChartCondition(code)}
                    title={conditionLabel(code)}
                    className={`whitespace-nowrap ${choiceClass(checked)}`}
                  >
                    {code === 'extracted' ? 'Caries' : 'Other causes'}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {procedureName && toothNumber && (
        <p className="-mt-2 flex items-start gap-2 text-sm text-slate-500">
          <Grid3x3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {willShowOnChart
            ? `Also shown on the 2D and 3D chart (tooth ${toothNumber}).`
            : needsSurfaces
              ? 'Choose the surfaces to also show it on the dental chart.'
              : 'Treatment History only. This procedure has no mark on the dental chart.'}
        </p>
      )}

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

      {!isEdit && (
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
      )}

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
            disabled={submitting || (isEdit && !dirty)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {isEdit ? <Save className="h-4 w-4" /> : <ClipboardPlus className="h-4 w-4" />}
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Treatment'}
          </button>
        </div>
      )}
    </form>
  )
}
