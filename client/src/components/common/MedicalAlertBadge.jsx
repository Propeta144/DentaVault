import { AlertTriangle, HeartPulse, HelpCircle } from 'lucide-react'

// Tatlong estado ng Allergies / Medical History:
// - May laman (hal. "Penicillin") → dapat makita bago gumawa ng kahit anong
//   treatment.
// - "None" / "N/A" → neutral: tinanong at wala talaga.
// - BLANGKO → "Not recorded". Magkaiba ang "walang allergy" at "hindi
//   natanong": panganib iyon kapag allergic pala ang pasyente. (Lumang/
//   imported na record; required na ang Allergies sa Register at Edit.)
export function medicalStatus(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'empty'
  const lower = trimmed.toLowerCase()
  if (lower === 'none' || lower === 'n/a') return 'none'
  return 'present'
}

// Magkaiba na ang bigat (critique 2026-10-25): PULA ang allergies (puwedeng
// anaphylaxis), AMBER ang medical history (hal. Hypertension: babala, hindi
// emergency). Dati parehong pula na may "ALERT" chip, kaya pantay ang dating.
// Ang "Not recorded" ay putol-putol na amber na gilid sa puti, para hindi
// mapagkamalang may laman.
const TONES = {
  danger: {
    box: 'border-red-200 bg-red-50',
    icon: AlertTriangle,
    iconClass: 'text-red-600',
    label: 'text-red-800',
    value: 'font-semibold text-red-900',
  },
  caution: {
    box: 'border-amber-200 bg-amber-50',
    icon: HeartPulse,
    iconClass: 'text-amber-700',
    label: 'text-amber-900',
    value: 'font-medium text-amber-950',
  },
}

export default function MedicalAlertBadge({ label, value, tone = 'danger' }) {
  const status = medicalStatus(value)

  if (status === 'empty') {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-white px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          {label}
        </p>
        {/* Neutral na salita: nakikita rin ito ng pasyente sa sariling record */}
        <p className="mt-0.5 text-base text-amber-900">Not recorded yet</p>
      </div>
    )
  }

  if (status === 'none') {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="mt-0.5 text-base text-slate-700">None</p>
      </div>
    )
  }

  const t = TONES[tone]
  const Icon = t.icon
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${t.box}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${t.label}`}>
        <Icon className={`h-4 w-4 ${t.iconClass}`} aria-hidden="true" />
        {label}
      </p>
      <p className={`mt-0.5 break-words text-base ${t.value}`}>{value.trim()}</p>
    </div>
  )
}

// Maikling bersyon para sa loob ng modal (Add Treatment, chart entry):
// laging kita habang nagre-record. Kapag walang allergy at walang medical
// history, sinasabi pa rin ("No known allergies") para sigurado ang dentist.
export function PatientAlertStrip({ allergies, medicalHistory }) {
  const allergyStatus = medicalStatus(allergies)
  const historyStatus = medicalStatus(medicalHistory)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm" aria-label="Medical alerts">
      {allergyStatus === 'present' && (
        <span className="flex min-w-0 items-start gap-1.5 font-semibold text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span className="min-w-0 break-words">Allergies: {allergies.trim()}</span>
        </span>
      )}
      {allergyStatus === 'empty' && (
        <span className="flex items-center gap-1.5 font-semibold text-amber-800">
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Allergies not recorded yet
        </span>
      )}
      {allergyStatus === 'none' && <span className="text-slate-600">No known allergies</span>}
      {historyStatus === 'present' && (
        <span className="flex min-w-0 items-start gap-1.5 font-medium text-amber-900">
          <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span className="min-w-0 break-words">Medical: {medicalHistory.trim()}</span>
        </span>
      )}
    </div>
  )
}

// Para sa listahan (Ctrl+K, Dashboard): isang maikling linya lang, at wala
// kapag "None".
export function AllergyFlag({ allergies }) {
  const status = medicalStatus(allergies)
  if (status === 'present') {
    return (
      <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-red-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate" title={allergies.trim()}>
          Allergy: {allergies.trim()}
        </span>
      </span>
    )
  }
  if (status === 'empty') {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-amber-800">
        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Allergies not recorded
      </span>
    )
  }
  return null
}
