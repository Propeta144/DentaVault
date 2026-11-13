import Modal from '../common/Modal'
import { PatientAlertStrip } from '../common/MedicalAlertBadge'
import { SURFACES, conditionColor, conditionLabel, conditionLetter } from '../../constants/dental'
import { toothFindings } from '../../utils/toothDetails'
import { formatDate } from '../../utils/formatDate'
import { ColorDot } from './ChartFindings'
import ToothHistory from './ToothHistory'

export default function ToothDetailsModal({ patientId, toothNumber, surface, toothState, alerts, onClose }) {
  const findings = toothFindings(toothState)
  return (
    <Modal title={`Tooth ${toothNumber} · ${SURFACES.find((s) => s.code === surface)?.label || 'Tooth details'}`}
      onClose={onClose} maxWidth="max-w-2xl"
      notice={alerts && <PatientAlertStrip allergies={alerts.allergies} medicalHistory={alerts.medicalHistory} />}>
      <p className="mb-4 text-sm text-slate-600">Recorded findings and treatments. Only your dentist can update this record.</p>
      <section aria-label={`Current findings for tooth ${toothNumber}`}>
        <h3 className="mb-2 text-base font-semibold text-slate-900">Current findings</h3>
        {findings.length === 0 ? (
          <p className="text-base text-slate-600">No current findings recorded for this tooth.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3">
            {findings.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                  <ColorDot color={conditionColor(entry.condition_code)} />
                  {SURFACES.find((s) => s.code === entry.surface)?.label || entry.surface} · {conditionLetter(entry.condition_code)} {conditionLabel(entry.condition_code)}
                </p>
                <p className="mt-1 text-slate-600">Recorded {formatDate(entry.recorded_at)}</p>
                {entry.notes && <p className="mt-1 break-words text-slate-700">{entry.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4"><ToothHistory key={toothNumber} patientId={patientId} toothNumber={toothNumber} initiallyExpanded /></div>
      <button type="button" onClick={onClose}
        className="mt-4 min-h-11 w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50">Close</button>
    </Modal>
  )
}
