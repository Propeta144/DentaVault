import { useId, useState } from 'react'
import { AlertTriangle, Clock, History, Loader2 } from 'lucide-react'
import Modal from '../common/Modal'
import { CONDITIONS, SURFACES, conditionColor, toothOrientation } from '../../constants/dental'
import { getToothHistory } from '../../services/chart'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/formatDate'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { TOOTH_BOX, toothShape } from './toothShape'

// "root_canal" → "Root Canal" (dati raw code ang lumalabas sa "Currently ..."
// at sa history)
function conditionLabel(code) {
  return CONDITIONS.find((c) => c.code === code)?.label || code
}

// Maliit na version ng parehong hugis-ngipin na iginuguhit ng Tooth.jsx
// (toothShape.js), para paalalahanan ang dentist kung anong parte ng ngipin
// ang pinindot. Orientation-aware (parehong mapping ng 2D chart).
const ICON_SIZE = TOOTH_BOX

// BUG FIX: dati `position === surface` ang check — pero top/bottom/left/
// right/center ang mga position, at mesial/distal/facial/lingual/occlusal
// ang mga surface, kaya HINDI KAILANMAN nagha-highlight ang isang surface
// (whole tooth lang ang gumagana). Ngayon, parehong toothOrientation() ng
// 2D chart (Tooth.jsx) ang gamit, kaya tugma ang highlight sa pinindot.
function SurfaceIndicator({ surface, toothNumber }) {
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
    <svg width={ICON_SIZE} height={ICON_SIZE} className="shrink-0 rounded-md bg-slate-50" aria-hidden="true">
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
          />
        )
      })}
    </svg>
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

export default function ChartEntryModal({
  patientId,
  toothNumber,
  surface,
  currentEntry,
  defaultConditionCode,
  strokes,
  onClose,
  onSubmit,
}) {
  const { showToast } = useToast()
  const formId = useId()
  const isWholeTooth = surface === 'whole'
  // Yung whole-tooth entry point, dalawang whole-tooth-level facts lang
  // ang ino-offer niya (present vs. missing) — hindi yung mga surface-specific
  // conditions gaya ng "Crown" o "Caries", kasi baka ma-overwrite lang
  // nang tuluyan yung individual settings ng bawat isa sa 5 surfaces.
  //
  // Laging andiyan yung "Extracted / Missing" option, kahit sa single-surface
  // click galing — dahil either missing yung ngipin o hindi, wala namang
  // "medyo missing lang" sa mesial surface — kaya kapag pinili 'to, kahit
  // saan galing, mag-a-apply pa rin sa lahat ng 5 surfaces pag nag-submit
  // (tignan yung `applyToWholeTooth` sa handleSubmit) — para hindi na
  // kailangan malaman ng dentist na kailangan pa niya i-click yung
  // tooth-number label para lang makarating sa whole-tooth view.
  const availableConditions = isWholeTooth
    ? CONDITIONS.filter((c) => c.code === 'healthy' || c.code === 'extracted')
    : CONDITIONS

  // Priority: what the dentist just painted with (3D pen), then the
  // surface's existing condition (2D click-to-edit), then healthy.
  const [conditionCode, setConditionCode] = useState(() => {
    if (availableConditions.some((c) => c.code === defaultConditionCode)) return defaultConditionCode
    if (availableConditions.some((c) => c.code === currentEntry?.condition_code)) return currentEntry.condition_code
    return 'healthy'
  })
  const [notes, setNotes] = useState(currentEntry?.notes || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const surfaceLabel = surfaceLabelFor(surface)
  const selectedLabel = CONDITIONS.find((c) => c.code === conditionCode)?.label
  // Whole-tooth fact talaga yung "Extracted", kahit saan pa galing na entry
  // point papunta dito — tignan yung comment sa availableConditions sa taas.
  const applyToWholeTooth = isWholeTooth || conditionCode === 'extracted'

  function toggleHistory() {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    setShowHistory(true)
    if (history === null) {
      setLoadingHistory(true)
      getToothHistory(patientId, toothNumber)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setLoadingHistory(false))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
      })
      showToast(
        applyToWholeTooth
          ? `Tooth ${toothNumber} marked ${selectedLabel.toLowerCase()} — all 5 surfaces updated.`
          : `Tooth ${toothNumber} (${surfaceLabel}) updated.`,
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

  return (
    <Modal title={`Tooth ${toothNumber} — ${surfaceLabel}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <SurfaceIndicator surface={surface} toothNumber={toothNumber} />
          <div className="text-base text-slate-500">
            {isWholeTooth ? (
              <p>Whether the tooth is present or extracted — applies to all 5 surfaces at once.</p>
            ) : (
              <p>
                Marking just the <span className="font-medium text-slate-700">{surfaceLabel}</span>{' '}
                surface.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        {currentEntry && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <p className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Currently <span className="font-medium text-slate-700">{conditionLabel(currentEntry.condition_code)}</span>
              {' — '}
              {timeAgo(currentEntry.recorded_at)} by {currentEntry.dentist_name}
            </p>
            {currentEntry.notes && (
              <p className="mt-1.5 border-t border-slate-200 pt-1.5 italic text-slate-600">
                "{currentEntry.notes}"
              </p>
            )}
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={toggleHistory}
            className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            <History className="h-4 w-4" />
            {showHistory ? 'Hide' : 'View'} full history for tooth {toothNumber}
          </button>

          {showHistory && (
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2.5">
              {loadingHistory && (
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </p>
              )}
              {!loadingHistory && history?.length === 0 && (
                <p className="text-xs text-slate-400">No history recorded yet.</p>
              )}
              {!loadingHistory &&
                history?.map((h) => (
                  <div key={h.id} className="border-b border-slate-100 pb-2 text-xs last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">
                        {surfaceLabelFor(h.surface)} — {conditionLabel(h.condition_code)}
                      </span>
                      <span className="shrink-0 text-slate-400">{timeAgo(h.recorded_at)}</span>
                    </div>
                    <p className="text-slate-400">by {h.dentist_name}</p>
                    {h.notes && <p className="mt-0.5 italic text-slate-500">"{h.notes}"</p>}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div>
          <p id={`${formId}-condition`} className="mb-2 block text-base font-medium text-slate-700">
            Condition
          </p>
          {/* radiogroup: para malaman ng screen reader kung alin ang napili */}
          <div role="radiogroup" aria-labelledby={`${formId}-condition`} className="grid grid-cols-2 gap-2.5">
            {availableConditions.map((c) => (
              <button
                key={c.code}
                type="button"
                role="radio"
                aria-checked={conditionCode === c.code}
                onClick={() => setConditionCode(c.code)}
                className={`flex min-h-12 items-center gap-2.5 rounded-md border px-4 py-3 text-base transition-all duration-150 ${
                  conditionCode === c.code
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm ring-1 ring-sky-500'
                    : 'border-slate-200 text-slate-700 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm'
                }`}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {applyToWholeTooth && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Saving this sets all 5 surfaces of tooth {toothNumber} to "{selectedLabel}",
              overwriting whatever each surface currently shows.
            </span>
          </div>
        )}

        <div>
          <label htmlFor={`${formId}-notes`} className="mb-1 block text-base font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
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

        {/* Dalawang button gaya ng ibang modal (dati Save lang) */}
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
            disabled={submitting}
            className="min-h-11 flex-1 rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
