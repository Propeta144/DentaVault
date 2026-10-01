import { AlertTriangle, HelpCircle } from 'lucide-react'

// Tatlong estado (dati dalawa):
// - May laman (hal. "Penicillin") → PULA, "Alert": dapat makita bago
//   gumawa ng kahit anong treatment.
// - "None" / "N/A" → neutral: tinanong at wala talaga.
// - BLANGKO → AMBER, "Not recorded". Dati "None" din ang ipinapakita, pero
//   magkaiba ang "walang allergy" at "hindi natanong" — panganib iyon kapag
//   allergic pala ang pasyente. (Mangyayari ito sa mga lumang/imported na
//   record; required na ang Allergies sa Register at Edit.)
export default function MedicalAlertBadge({ label, value }) {
  const trimmed = (value || '').trim()
  const lower = trimmed.toLowerCase()

  if (!trimmed) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">
          <HelpCircle className="h-4 w-4" />
          {label}
        </span>
        {/* Neutral na salita: nakikita rin ito ng pasyente sa sariling record */}
        <p className="mt-0.5 text-sm font-medium text-amber-800">Not recorded yet</p>
      </div>
    )
  }

  if (lower === 'none' || lower === 'n/a') {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <p className="mt-0.5 text-sm font-medium text-slate-600">None</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-red-200 bg-red-50 p-2.5 shadow-sm">
      <div className="absolute bottom-0 left-0 top-0 w-1 bg-red-500" />
      <div className="ml-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          {label}
        </span>
        <span className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-red-800">
          Alert
        </span>
      </div>
      <p className="ml-1 mt-1 text-sm font-semibold text-red-900">{trimmed}</p>
    </div>
  )
}
