import { useEffect, useId, useState } from 'react'
import { ClipboardList, History, Loader2 } from 'lucide-react'
import { getToothHistory } from '../../services/chart'
import { listTreatments } from '../../services/patients'
import { ALL_TEETH, SURFACES, conditionLabel, surfaceLetters } from '../../constants/dental'
import { toothTreatments } from '../../utils/toothDetails'
import { formatDate } from '../../utils/formatDate'
import StatusBadge from '../common/StatusBadge'

// Iisang read-only history para sa dentist editor at patient tooth details.
// Existing endpoints ang nag-e-enforce ng patient ownership sa server.
export default function ToothHistory({ patientId, toothNumber, initiallyExpanded = false }) {
  const contentId = useId()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!expanded) return
    let active = true
    Promise.allSettled([getToothHistory(patientId, toothNumber), listTreatments(patientId)])
      .then(([history, treatments]) => {
        if (!active) return
        setResult({
          history: history.status === 'fulfilled' ? history.value : null,
          treatments: treatments.status === 'fulfilled' ? toothTreatments(treatments.value, toothNumber) : null,
        })
      })
    return () => { active = false }
  }, [expanded, patientId, toothNumber, retry])

  return (
    <div>
      <button type="button" onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded} aria-controls={contentId}
        className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900">
        <History className="h-4 w-4" />
        {expanded ? 'Hide' : 'View'} full history for tooth {toothNumber}
      </button>
      {expanded && (
        <div id={contentId} className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {!result ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />Loading tooth history...
            </p>
          ) : (
            <>
              <section aria-label={`Treatment history for tooth ${toothNumber}`}>
                <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900">
                  <ClipboardList className="h-4 w-4" />Treatment history
                </h3>
                {result.treatments === null ? (
                  <p role="alert" className="text-sm text-red-700">Could not load treatment history.</p>
                ) : result.treatments.length === 0 ? (
                  <p className="text-sm text-slate-600">No treatments recorded for this tooth or the full mouth.</p>
                ) : (
                  <ol className="max-h-64 space-y-3 overflow-y-auto">
                    {result.treatments.map((t) => (
                      <li key={t.id} className="border-b border-slate-200 pb-3 text-sm last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{t.procedure_name}</span>
                          <StatusBadge variant="slate">{t.tooth_number === ALL_TEETH ? 'Full mouth' : `Tooth ${toothNumber}`}</StatusBadge>
                        </div>
                        <p className="mt-1 text-slate-600">
                          {formatDate(t.treatment_date)}{surfaceLetters(t.surfaces) ? ` · ${surfaceLetters(t.surfaces)}` : ''}
                        </p>
                        {t.notes && <p className="mt-1 break-words text-slate-700">{t.notes}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section aria-label={`Condition history for tooth ${toothNumber}`}>
                <h3 className="mb-2 text-base font-semibold text-slate-900">Condition history</h3>
                {result.history === null ? (
                  <p role="alert" className="text-sm text-red-700">Could not load condition history.</p>
                ) : result.history.length === 0 ? (
                  <p className="text-sm text-slate-600">No condition history recorded for this tooth.</p>
                ) : (
                  <ol className="max-h-48 space-y-2 overflow-y-auto">
                    {result.history.map((entry) => (
                      <li key={entry.id} className="border-b border-slate-200 pb-2 text-sm last:border-0 last:pb-0">
                        <p className="font-medium text-slate-900">
                          {SURFACES.find((s) => s.code === entry.surface)?.label || entry.surface} · {entry.is_cleared ? 'Removed: ' : ''}{conditionLabel(entry.condition_code)}
                        </p>
                        <p className="text-slate-600">{formatDate(entry.recorded_at)}</p>
                        {entry.notes && <p className="mt-1 break-words text-slate-700">{entry.notes}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              {(result.history === null || result.treatments === null) && (
                <button type="button" onClick={() => { setResult(null); setRetry((value) => value + 1) }}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-slate-100">Retry history</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
