import { ChevronDown, AlertTriangle } from 'lucide-react'
import { HEALTH_QUESTIONS, INFO_TEXT_FIELDS, yesNoLabel } from '../../constants/patientInfo'

const text = (patient, key) => patient[INFO_TEXT_FIELDS.find((f) => f.key === key).column]

// Mga sagot na dapat mapansin bago mag-treatment (hal. buntis, umiinom ng
// gamot). Ang "in good health" ay kabaligtaran: ang "No" ang babala.
export function healthAlerts(patient) {
  const alerts = []
  for (const q of HEALTH_QUESTIONS) {
    const v = patient[q.column]
    if (q.key === 'inGoodHealth') {
      if (v === 0) alerts.push('Not in good health')
    } else if (v === 1) {
      const short = {
        underMedicalTreatment: 'Under medical treatment',
        seriousIllness: 'Past serious illness / operation',
        hospitalized: 'Hospitalized before',
        takingMedication: 'Taking medication',
        usesTobacco: 'Uses tobacco',
        usesAlcoholDrugs: 'Uses alcohol / drugs',
        isPregnant: 'Pregnant',
        isNursing: 'Nursing',
        takingBirthControl: 'On birth control pills',
      }[q.key]
      alerts.push(short)
    }
  }
  return alerts
}

function Row({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="break-words text-base text-slate-800">{value || '—'}</dd>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  )
}

// Buong "Patient Information Record" (papel na form ng clinic) sa profile.
// Nakatiklop (`<details>`) para hindi humaba ang page; nasa summary ang mga
// babala para kita kahit nakatiklop.
export default function PatientInfoRecord({ patient }) {
  const alerts = healthAlerts(patient)
  const questions = HEALTH_QUESTIONS.filter((q) => !q.womenOnly || patient.sex === 'female')

  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Patient Information Record</h2>
          {alerts.length > 0 ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {alerts.join(' · ')}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">Personal details, dental history, physician, and health questions</p>
          )}
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-slate-100 p-4 sm:p-6">
        <Group title="Personal">
          <Row label="Occupation" value={text(patient, 'occupation')} />
          <Row label="Nationality" value={text(patient, 'nationality')} />
          <Row label="Religion" value={text(patient, 'religion')} />
          <Row label="Parent / Guardian" value={text(patient, 'guardianName')} />
        </Group>

        <Group title="Dental History">
          <Row label="Previous Dentist" value={text(patient, 'previousDentist')} />
          <Row label="Last Dental Visit" value={text(patient, 'lastDentalVisit')} />
        </Group>

        <Group title="Physician">
          <Row label="Name" value={text(patient, 'physicianName')} />
          <Row label="Specialty" value={text(patient, 'physicianSpecialty')} />
          <Row label="Office Address" value={text(patient, 'physicianOfficeAddress')} />
          <Row label="Office Number" value={text(patient, 'physicianOfficeNumber')} />
        </Group>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Health Questions</h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {questions.map((q) => {
              const answer = yesNoLabel(patient[q.column])
              const details = q.detailsKey ? text(patient, q.detailsKey) : null
              return (
                <li key={q.key} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <span className="text-base text-slate-700">{q.question}</span>
                  <span className="shrink-0 text-base font-medium text-slate-900 sm:text-right">
                    {answer || <span className="font-normal text-slate-400">Not asked</span>}
                    {details && <span className="block text-sm font-normal text-slate-600">{details}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <Group title="Vital Information">
          <Row label="Blood Type" value={text(patient, 'bloodType')} />
          <Row label="Blood Pressure" value={text(patient, 'bloodPressure')} />
          <Row label="Bleeding Time" value={text(patient, 'bleedingTime')} />
        </Group>
      </div>
    </details>
  )
}
