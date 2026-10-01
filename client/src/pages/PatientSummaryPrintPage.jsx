import { useEffect, useState } from 'react'
import { usePrintState } from '../utils/selectedPatient'
import { getSummary } from '../services/patients'
import { ALL_TEETH } from '../constants/dental'
import PageLoader from '../components/common/PageLoader'

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

      <h1 className="text-xl font-bold">Teodosio-Rufin Dental Clinic</h1>
      <p className="mb-6 text-sm text-slate-500">Patient Treatment Summary</p>

      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-sm">
        <div>
          <strong>Name:</strong> {patient.last_name}, {patient.first_name}
        </div>
        <div>
          <strong>Sex:</strong> <span className="capitalize">{patient.sex}</span>
        </div>
        <div>
          <strong>Date of Birth:</strong> {patient.date_of_birth}
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
              <td className="py-1 pr-2 align-top">{t.treatment_date}</td>
              <td className="py-1 pr-2 align-top">{t.procedure_name}</td>
              <td className="py-1 pr-2 align-top">
                {t.tooth_number === ALL_TEETH ? 'All Teeth' : t.tooth_number || '—'}
              </td>
              <td className="py-1 align-top">{t.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-8 text-xs text-slate-400">
        Generated {new Date().toLocaleString()} — DentaVault
      </p>
    </div>
  )
}
