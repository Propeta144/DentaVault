import { AlertTriangle, ChevronDown } from 'lucide-react'
import { missingPatientFields } from '../../utils/patientCompleteness'

export default function MissingPatientInfo({ patient, forPatient = false, onEdit }) {
  const missing = missingPatientFields(patient)
  if (!missing.length) return null
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-medium text-amber-900 [&::-webkit-details-marker]:hidden">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{missing.length} required {missing.length === 1 ? 'field' : 'fields'} not recorded</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </summary>
      <div className="pb-3 text-sm text-amber-900">
        <ul className="mb-2 list-disc space-y-1 pl-6">{missing.map((item) => <li key={item.field}>{item.label}</li>)}</ul>
        {forPatient ? <p>Ask the clinic to update these details.</p> : onEdit ? (
          <button type="button" onClick={onEdit} className="min-h-11 rounded-md border border-amber-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-amber-100">Complete information</button>
        ) : <p>Open the full record to complete this information.</p>}
      </div>
    </details>
  )
}
