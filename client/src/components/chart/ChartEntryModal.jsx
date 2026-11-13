import { useId, useState } from 'react'
import { AlertTriangle, ClipboardList, Clock, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { PatientAlertStrip } from '../common/MedicalAlertBadge'
import {
  CONDITIONS,
  CONDITION_GROUPS,
  SURFACES,
  conditionColor,
  conditionLabel,
  conditionLetter,
  isWholeToothCondition,
  procedureForCondition,
  toothOrientation,
} from '../../constants/dental'
import ToothHistory from './ToothHistory'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/formatDate'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { TOOTH_BOX, toothShape } from './toothShape'
import { dentitionAgeCaution, dentitionLabel } from '../../utils/dentition'

// Parehong hugis-ngipin na iginuguhit ng Tooth.jsx (toothShape.js), para
// makita ng dentist kung anong parte ng ngipin ang napili. Orientation-aware
// (parehong mapping ng 2D chart). Sa 2D chart, napipindot din ito at may
// malalaking button sa tabi (SurfacePicker).
const ICON_SIZE = TOOTH_BOX
const PICKER_SIZE = 112

// Ayos ng mga button sa picker: whole muna, tapos ang 5 surface
const PICKER_SURFACES = ['whole', 'occlusal', 'mesial', 'distal', 'facial', 'lingual']

// BUG FIX: dati `position === surface` ang check — pero top/bottom/left/
// right/center ang mga position, at mesial/distal/facial/lingual/occlusal
// ang mga surface, kaya HINDI KAILANMAN nagha-highlight ang isang surface
// (whole tooth lang ang gumagana). Ngayon, parehong toothOrientation() ng
// 2D chart (Tooth.jsx) ang gamit, kaya tugma ang highlight sa pinindot.
function SurfaceIndicator({ surface, toothNumber, size = ICON_SIZE, onPick }) {
  const isWhole = surface === 'whole'
  const orientation = toothOrientation(toothNumber)
  const positionToSurface = {
    [orientation.facialSide]: 'facial',
    [orientation.lingualSide]: 'lingual',
    [orientation.mesialSide]: 'mesial',
    [orientation.distalSide]: 'distal',
    center: 'occlusal',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      className="shrink-0 rounded-md bg-slate-50"
      aria-hidden="true"
    >
      {Object.entries(toothShape(toothNumber).regions).map(([position, points]) => {
        const highlighted = isWhole || positionToSurface[position] === surface
        return (
          <polygon
            key={position}
            points={points}
            fill={highlighted ? '#6f2dbd' : '#ffffff'}
            fillOpacity={highlighted ? 0.9 : 1}
            stroke="#cbd5e1"
            strokeWidth={1}
            onClick={onPick ? () => onPick(positionToSurface[position]) : undefined}
            className={onPick ? 'cursor-pointer' : undefined}
          />
        )
      })}
    </svg>
  )
}

// Critique 2026-10-25: sa tablet, 7 hanggang 9px lang ang bawat surface sa
// 2D chart, kaya madalas katabing surface ang natatapik (lalo na naka-gloves).
// Kaya dito na pinipili/itinatama ang surface: malalaking button (44px), may
// kulay at letter code ng kasalukuyang marka ng bawat isa.
function SurfacePicker({ toothNumber, surface, toothState, onChange }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <SurfaceIndicator surface={surface} toothNumber={toothNumber} size={PICKER_SIZE} onPick={onChange} />
      <div role="radiogroup" aria-label="Surface" className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
        {PICKER_SURFACES.map((code) => {
          const entry = toothState?.[code]
          const selected = surface === code
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(code)}
              className={`flex min-h-11 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors ${
                selected
                  ? 'border-sky-500 bg-sky-50 font-semibold text-sky-900 ring-1 ring-sky-500'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1 leading-tight">{surfaceLabelFor(code)}</span>
              {entry && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: conditionColor(entry.condition_code) }}
                    aria-hidden="true"
                  />
                  {conditionLetter(entry.condition_code)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateString)
}

function surfaceLabelFor(code) {
  return SURFACES.find((s) => s.code === code)?.label || code
}

// toothState (2D o 3D surface selection): kasalukuyang marka ng ngipin, para
// mapalitan ang surface sa loob ng modal. Kapag wala (3D pen), nakapirmi ang
// surface (galing sa iginuhit) at currentEntry ang gamit.
// alerts: { allergies, medicalHistory } ng pasyente, laging kita sa itaas.
export default function ChartEntryModal({
  patientId,
  toothNumber,
  surface: initialSurface,
  currentEntry: fixedEntry,
  toothState,
  alerts,
  dateOfBirth,
  defaultConditionCode,
  strokes,
  onClose,
  onSubmit,
  onDelete,
}) {
  const { showToast } = useToast()
  const formId = useId()
  const surfaceSelectable = Boolean(toothState) && !strokes
  const [surface, setSurface] = useState(initialSurface)
  const currentEntry = toothState ? toothState[surface] : fixedEntry
  const isWholeTooth = surface === 'whole'
  // Whole-tooth entry point (pinindot ang numero): ang mga kondisyon lang na
  // para sa buong ngipin (scope 'whole' o 'any', hal. Missing, Jacket Crown,
  // Present). Ang mga pang-surface (Decayed, Filled...) ay hindi, para hindi
  // ma-overwrite ang 5 surface ng iisang "Decayed".
  //
  // Sa isang surface naman: LAHAT, pero ang pang-buong-ngipin (hal. Missing)
  // ay sine-save pa rin sa buong ngipin (tignan `applyToWholeTooth`): walang
  // "medyo nawawala sa mesial lang", kaya hindi na kailangang alamin ng
  // dentist na kailangan pang pindutin ang numero ng ngipin.
  const availableConditions = isWholeTooth ? CONDITIONS.filter((c) => c.scope !== 'surface') : CONDITIONS

  // Priority: ang pinili sa 3D pen, tapos ang kasalukuyang marka ng surface.
  // Kapag WALA (bagong surface): walang napili, at naka-disable ang Save
  // hangga't hindi pumipili ang dentist. Dati "Present / Healthy" agad, kaya
  // isang pindot lang sa Save ay may naitalang finding na hindi pinili
  // (critique 2026-10-25; skill: walang tahimik na default sa clinical field).
  const [conditionCode, setConditionCode] = useState(() => {
    if (availableConditions.some((c) => c.code === defaultConditionCode)) return defaultConditionCode
    if (availableConditions.some((c) => c.code === currentEntry?.condition_code)) return currentEntry.condition_code
    return null
  })
  const [notes, setNotes] = useState(currentEntry?.notes || '')
  // Feature #30: "Also add to Treatment History" para sa kondisyong
  // treatment (Filled, Root Canal, Crown, Extracted...). Naka-check bilang
  // default, MALIBAN kung ito na mismo ang kasalukuyang marka at galing na sa
  // isang treatment (hal. notes lang ang binabago), para walang doble.
  // null = hindi pa ginagalaw ng dentist (sumusunod sa default).
  const [addTreatmentChoice, setAddTreatmentChoice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmAge, setConfirmAge] = useState(false)
  const ageCaution = dentitionAgeCaution(dateOfBirth, toothNumber)

  const surfaceLabel = surfaceLabelFor(surface)
  const selectedLabel = conditionLabel(conditionCode)
  // Pang-buong-ngipin na kondisyon (hal. Missing, Jacket Crown), kahit saan
  // pa galing na entry point — tignan ang comment sa availableConditions.
  const applyToWholeTooth = isWholeTooth || isWholeToothCondition(conditionCode)
  const procedureName = procedureForCondition(conditionCode)
  const alreadyInHistory =
    Boolean(currentEntry?.treatment_id) && currentEntry.condition_code === conditionCode
  const addTreatment = Boolean(procedureName) && (addTreatmentChoice ?? !alreadyInHistory)

  // Pagpalit ng surface: parang direktang tinapik ang bagong surface, kaya
  // ang marka nito ang lumalabas (o walang napili kapag wala pa). Hindi
  // dinadala ang dating napili, para hindi mapagkamalang may marka na roon.
  function changeSurface(next) {
    if (next === surface) return
    const nextEntry = toothState?.[next]
    const allowed = next === 'whole' ? CONDITIONS.filter((c) => c.scope !== 'surface') : CONDITIONS
    setSurface(next)
    setNotes(nextEntry?.notes || '')
    setAddTreatmentChoice(null)
    setError('')
    setConditionCode(allowed.some((c) => c.code === nextEntry?.condition_code) ? nextEntry.condition_code : null)
  }

  async function handleSubmit(e, ageConfirmed = false) {
    e?.preventDefault()
    if (submitting) return
    if (!conditionCode) {
      setError('Choose a condition first.')
      return
    }
    setError('')
    if (ageCaution && !ageConfirmed) {
      setConfirmAge(true)
      return
    }
    setSubmitting(true)
    try {
      // Only a genuine single-surface 3D-pen save carries the actual drawn
      // strokes — whole-tooth saves apply to all 5 surfaces at once, and one
      // stroke drawn in one spot doesn't represent that; 2D-originated saves
      // never have strokes to begin with (no freehand drawing there).
      const strokeData =
        strokes && !applyToWholeTooth
          ? strokes.map((points) => ({ type: 'freehand', points, color: conditionColor(conditionCode) }))
          : null
      await onSubmit({
        toothNumber,
        surface: applyToWholeTooth ? 'whole' : surface,
        conditionCode,
        notes,
        strokeData,
        addTreatment,
      })
      showToast(
        applyToWholeTooth
          ? `Tooth ${toothNumber} marked ${selectedLabel.toLowerCase()}. All 5 surfaces updated.${addTreatment ? ' Added to Treatment History.' : ''}`
          : `Tooth ${toothNumber} (${surfaceLabel}) updated.${addTreatment ? ' Added to Treatment History.' : ''}`,
        { type: 'success' },
      )
      onClose()
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to update chart'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!currentEntry || !onDelete || submitting) return
    setError('')
    setSubmitting(true)
    try {
      await onDelete(currentEntry.id)
      showToast(`Condition removed from tooth ${toothNumber}.`, { type: 'success' })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete condition')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmAge && ageCaution) {
    const backToEntry = () => {
      if (submitting) return
      setConfirmAge(false)
      setError('')
    }
    return (
      <Modal key="confirm-tooth-age" title="Confirm Tooth Set" onClose={backToEntry}
        notice={alerts && <PatientAlertStrip allergies={alerts.allergies} medicalHistory={alerts.medicalHistory} />}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="text-base text-amber-900">
              <p className="font-semibold">Patient age: {ageCaution.age} {ageCaution.age === 1 ? 'year' : 'years'}</p>
              <p className="mt-1">You are recording <strong>{dentitionLabel(ageCaution.selectedDentition).toLowerCase()}</strong>.
                {' '}The age-based guide for this patient is {dentitionLabel(ageCaution.ageDefault).toLowerCase()}.</p>
              <p className="mt-1">Age is a guide only. Confirm this is the tooth you examined before saving.</p>
            </div>
          </div>
          <dl className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-base">
            <div><dt className="text-sm text-slate-500">Tooth</dt><dd className="font-medium text-slate-900">{toothNumber} · {dentitionLabel(ageCaution.selectedDentition)}</dd></div>
            <div><dt className="text-sm text-slate-500">Surface</dt><dd className="text-slate-800">{applyToWholeTooth ? 'Whole tooth (all 5 surfaces)' : surfaceLabel}</dd></div>
            <div><dt className="text-sm text-slate-500">Condition</dt><dd className="text-slate-800">{selectedLabel}</dd></div>
          </dl>
          {addTreatment && <p className="text-sm text-slate-600">Also adds {procedureName} to Treatment History.</p>}
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={backToEntry} disabled={submitting}
              className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Back to Entry</button>
            <button type="button" onClick={() => handleSubmit(null, true)} disabled={submitting}
              className="min-h-11 flex-1 rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? 'Saving...' : 'Confirm and Save'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  if (confirmDelete && currentEntry && onDelete) {
    const clearsWholeTooth = currentEntry.surface === 'whole' || isWholeToothCondition(currentEntry.condition_code)
    return (
      <Modal key="delete-condition" title="Delete Condition" onClose={() => !submitting && setConfirmDelete(false)}
        notice={alerts && <PatientAlertStrip allergies={alerts.allergies} medicalHistory={alerts.medicalHistory} />}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="text-base text-red-800">
              <p className="font-semibold">Delete {conditionLabel(currentEntry.condition_code)} from tooth {toothNumber}
                {clearsWholeTooth ? ' (whole tooth)' : ` (${surfaceLabel})`}?</p>
              <p className="mt-1">{clearsWholeTooth
                ? 'This clears the whole-tooth mark and all 5 surface marks on this tooth.'
                : 'This clears only the selected surface mark.'} The cleared area becomes unmarked. The removal stays in chart history and the audit log.</p>
              <p className="mt-1">Treatment History entries will remain. To delete an incorrect treatment, use Treatment History.</p>
            </div>
          </div>
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={submitting} onClick={() => { setConfirmDelete(false); setError('') }}
              className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={submitting} onClick={handleDelete}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" />{submitting ? 'Deleting...' : 'Delete Condition'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Tooth ${toothNumber} · ${surfaceLabel}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      notice={alerts && <PatientAlertStrip allergies={alerts.allergies} medicalHistory={alerts.medicalHistory} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {surfaceSelectable ? (
          <div>
            <p className="mb-2 text-base font-medium text-slate-700">Surface</p>
            <SurfacePicker
              toothNumber={toothNumber}
              surface={surface}
              toothState={toothState}
              onChange={changeSurface}
            />
            <p className="mt-2 text-sm text-slate-600">
              {isWholeTooth
                ? 'Whole-tooth conditions (such as missing, crown, or root canal) apply to all 5 surfaces at once.'
                : `Marking just the ${surfaceLabel} surface.`}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <SurfaceIndicator surface={surface} toothNumber={toothNumber} />
            <div className="text-base text-slate-600">
              {isWholeTooth ? (
                <p>Conditions for the whole tooth (such as missing, crown, or root canal). Applies to all 5 surfaces at once.</p>
              ) : (
                <p>
                  Marking just the <span className="font-medium text-slate-700">{surfaceLabel}</span>{' '}
                  surface.
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        {currentEntry && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p className="flex flex-wrap items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Currently <span className="font-medium text-slate-800">{conditionLabel(currentEntry.condition_code)}</span>
              <span aria-hidden="true">·</span>
              {timeAgo(currentEntry.recorded_at)}
            </p>
            {currentEntry.treatment_id && (
              <p className="mt-1 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Also in Treatment History (edit it there to change both)
              </p>
            )}
            {currentEntry.notes && (
              <p className="mt-1.5 border-t border-slate-200 pt-1.5 italic text-slate-600">
                "{currentEntry.notes}"
              </p>
            )}
          </div>
        )}

        <ToothHistory key={toothNumber} patientId={patientId} toothNumber={toothNumber} />

        <div>
          <p id={`${formId}-condition`} className="mb-2 block text-base font-medium text-slate-700">
            Condition
          </p>
          {/* radiogroup: para malaman ng screen reader kung alin ang napili.
              Naka-grupo (gaya ng legend ng papel na chart ng clinic), at may
              letter code bawat isa (ito ang nakasulat sa ngipin). */}
          <div role="radiogroup" aria-labelledby={`${formId}-condition`} className="space-y-3">
            {CONDITION_GROUPS.map((group) => {
              const items = availableConditions.filter((c) => c.group === group.code)
              if (items.length === 0) return null
              return (
                <div key={group.code}>
                  <p className="mb-1.5 text-sm font-semibold text-slate-600">{group.label}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {items.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        role="radio"
                        aria-checked={conditionCode === c.code}
                        onClick={() => setConditionCode(c.code)}
                        className={`flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2 text-left text-base transition-all duration-150 ${
                          conditionCode === c.code
                            ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-500'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="w-6 shrink-0 font-semibold">{c.letter}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {applyToWholeTooth && conditionCode && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Saving this sets all 5 surfaces of tooth {toothNumber} to "{selectedLabel}",
              overwriting whatever each surface currently shows.
            </span>
          </div>
        )}

        {strokes && currentEntry && conditionCode && !applyToWholeTooth && currentEntry.condition_code !== conditionCode && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Saving replaces the current condition and drawing on this surface. Other surfaces stay unchanged.
          </p>
        )}

        <div>
          <label htmlFor={`${formId}-notes`} className="mb-1 block text-base font-medium text-slate-700">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={`${formId}-notes`}
            rows={2}
            value={notes}
            maxLength={FIELD_LIMITS.notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>

          <label className={`flex min-h-11 items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-700 ${procedureName ? 'cursor-pointer' : ''}`}>
            <input
              type="checkbox"
              checked={addTreatment}
              disabled={!procedureName || submitting}
              onChange={(e) => setAddTreatmentChoice(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-sky-600"
            />
            <span>
              Also add to Treatment History
              <span className="block text-sm text-slate-500">
                {procedureName
                  ? `${procedureName}, tooth ${toothNumber}, today. ${alreadyInHistory ? 'This condition already has a linked treatment. Leave unchecked to avoid a duplicate.' : 'Uncheck if this was done before (e.g. at another clinic).'}`
                  : conditionCode
                    ? 'This condition is a finding, not a performed treatment. It is recorded in the dental chart and tooth history.'
                    : 'Choose a treatment condition, such as Filled, Root Canal Treated, Crown or Extracted, to enable this option.'}
              </span>
            </span>
          </label>

        {onDelete && currentEntry && (
          <button type="button" disabled={submitting} onClick={() => { setError(''); setConfirmDelete(true) }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2.5 text-base font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />Delete Current Condition
          </button>
        )}
        {!conditionCode && (
          <p id={`${formId}-save-hint`} className="text-sm text-slate-600">
            Choose a condition above to save.
          </p>
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
            type="submit"
            disabled={submitting || !conditionCode}
            aria-describedby={!conditionCode ? `${formId}-save-hint` : undefined}
            className="min-h-11 flex-1 rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
