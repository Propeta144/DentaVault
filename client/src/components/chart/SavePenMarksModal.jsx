import { useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import Modal from '../common/Modal'
import { PatientAlertStrip } from '../common/MedicalAlertBadge'
import { SURFACES, conditionColor, conditionLabel, procedureForCondition } from '../../constants/dental'
import { dentitionAgeCaution, dentitionLabel } from '../../utils/dentition'

export default function SavePenMarksModal({ groups, dateOfBirth, alerts, saving, progress, error, onClose, onSave }) {
  const [addTreatments, setAddTreatments] = useState(true)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const cautions = groups.map((group) => ({ ...group, caution: dentitionAgeCaution(dateOfBirth, group.toothNumber) }))
    .filter((group) => group.caution)
  const hasTreatments = groups.some((group) => procedureForCondition(group.conditionCode))
  const surfaces = new Set(groups.map((group) => `${group.toothNumber}:${group.surface}`))

  return <Modal title="Save All Marks" onClose={() => { if (!saving) onClose() }}
    notice={alerts && <PatientAlertStrip allergies={alerts.allergies} medicalHistory={alerts.medicalHistory} />}>
    <div className="space-y-4">
      <p className="text-base text-slate-700">Save the conditions and drawings listed below to the patient's dental chart.</p>
      <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
        {groups.map((group) => <li key={group.key} className="flex items-start gap-2 text-sm text-slate-700">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: conditionColor(group.conditionCode) }} />
          Tooth {group.toothNumber} · {SURFACES.find((surface) => surface.code === group.surface)?.label} · {conditionLabel(group.conditionCode)}
        </li>)}
      </ul>
      {surfaces.size < groups.length && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Some surfaces have more than one condition. The last drawn condition will appear on the chart; earlier conditions remain in tooth history.
      </p>}
      {hasTreatments && <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <input type="checkbox" checked={addTreatments} disabled={saving} onChange={(event) => setAddTreatments(event.target.checked)} className="mt-1 h-5 w-5 accent-sky-600" />
        <span className="text-sm text-slate-700">Also add treatments to Treatment History
          <span className="mt-1 block text-slate-600">For treatment conditions only. Uncheck if these were done before, for example at another clinic.</span>
        </span>
      </label>}
      {cautions.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" /> Confirm Tooth Set</p>
        <p className="mt-2">Patient age: {cautions[0].caution.age}. The age-based guide is {dentitionLabel(cautions[0].caution.ageDefault).toLowerCase()}.
          {' '}Please check teeth {Array.from(new Set(cautions.map((group) => group.toothNumber))).join(', ')}.</p>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={ageConfirmed} disabled={saving} onChange={(event) => setAgeConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-sky-600" />
          <span>Age is a guide only. I confirm these are the teeth examined.</span>
        </label>
      </div>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saving && <p role="status" className="text-sm text-slate-600">Saving marks: {progress.completed} of {progress.total} saved...</p>}
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={onClose} className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
        <button type="button" disabled={saving || !groups.length || (cautions.length > 0 && !ageConfirmed)} onClick={() => onSave(addTreatments)}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </div>
  </Modal>
}
