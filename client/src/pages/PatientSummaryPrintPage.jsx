import { useEffect, useState } from 'react'
import { HEALTH_QUESTIONS, INFO_TEXT_FIELDS, yesNoLabel } from '../constants/patientInfo'
import { usePrintState } from '../utils/selectedPatient'
import { getSummary } from '../services/patients'
import { ALL_TEETH, surfaceLetters } from '../constants/dental'
import PageLoader from '../components/common/PageLoader'
import PrintHeader from '../components/common/PrintHeader'
import { formatDate, formatDateTime } from '../utils/formatDate'

// Hindi hiwalay na linya: ang middle name ay nasa Name na, at ang "If so, ..."
// na sagot ay nasa tabi ng Yes/No
const SKIP_IN_DETAILS = ['middleName', ...HEALTH_QUESTIONS.map((q) => q.detailsKey).filter(Boolean)]

export default function PatientSummaryPrintPage() {
  const id = usePrintState()?.patientCode
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getSummary(id)
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load summary'))
  }, [id])

  if (!id) return <p className="p-6 text-slate-500">Open this page from the patient profile's Print button.</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!data) return <PageLoader fullScreen />

  const { patient, treatments } = data

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-slate-900">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-slate-500">Print preview</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Print
        </button>
      </div>

      <PrintHeader title="Patient Treatment Summary" />

      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-sm">
        <div>
          <strong>Name:</strong> {patient.last_name}, {patient.first_name}
          {patient.middle_name ? ` ${patient.middle_name}` : ''}
        </div>
        <div>
          <strong>Sex:</strong> <span className="capitalize">{patient.sex}</span>
        </div>
        <div>
          <strong>Date of Birth:</strong> {formatDate(patient.date_of_birth)}
        </div>
        <div>
          <strong>Contact:</strong> {patient.contact_number || '—'}
        </div>
        <div>
          <strong>Allergies:</strong> {patient.allergies || '—'}
        </div>
        <div className="col-span-2">
          <strong>Medical History:</strong> {patient.medical_history || '—'}
        </div>
      </div>

      {/* Patient Information Record (papel na form ng clinic): ang may sagot
          lang, para hindi humaba ang papel sa mga lumang record na kulang */}
      {(() => {
        const details = INFO_TEXT_FIELDS.filter((f) => !SKIP_IN_DETAILS.includes(f.key) && patient[f.column])
        const answered = HEALTH_QUESTIONS.filter((q) => patient[q.column] !== null && patient[q.column] !== undefined)
        if (details.length === 0 && answered.length === 0) return null
        return (
          <div className="mb-6 break-inside-avoid border-b border-slate-200 pb-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Patient Information</h2>
            {details.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {details.map((f) => (
                  <div key={f.key}>
                    <strong>{f.label}:</strong> {patient[f.column]}
                  </div>
                ))}
              </div>
            )}
            {answered.length > 0 && (
              <table className="w-full border-collapse">
                <tbody>
                  {answered.map((q) => {
                    const more = q.detailsKey && patient[INFO_TEXT_FIELDS.find((f) => f.key === q.detailsKey).column]
                    return (
                      <tr key={q.key} className="border-b border-slate-100">
                        <td className="py-1 pr-2 align-top">{q.question}</td>
                        <td className="w-1/3 py-1 align-top font-medium">
                          {yesNoLabel(patient[q.column])}
                          {more ? ` — ${more}` : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })()}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Treatment History
      </h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th className="py-1 pr-2">Date</th>
            <th className="py-1 pr-2">Procedure</th>
            <th className="py-1 pr-2">Tooth</th>
            <th className="py-1">Notes</th>
          </tr>
        </thead>
        <tbody>
          {treatments.map((t) => (
            <tr key={t.id} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-1 pr-2 align-top">{formatDate(t.treatment_date)}</td>
              <td className="py-1 pr-2 align-top">{t.procedure_name}</td>
              <td className="py-1 pr-2 align-top">
                {t.tooth_number === ALL_TEETH ? 'All Teeth' : t.tooth_number || '—'}
                {t.surfaces ? ` (${surfaceLetters(t.surfaces)})` : ''}
              </td>
              <td className="py-1 align-top">{t.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-slate-400">
        Generated {formatDateTime(new Date())} — DentaVault
      </p>
    </div>
  )
}
