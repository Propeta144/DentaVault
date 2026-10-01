import { useEffect, useState } from 'react'
import { usePrintState } from '../utils/selectedPatient'
import { getPatient } from '../services/patients'
import Odontogram2D from '../components/chart/Odontogram2D'
import PageLoader from '../components/common/PageLoader'

export default function ChartPrintPage() {
  const id = usePrintState()?.patientCode
  const [patient, setPatient] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getPatient(id)
      .then(setPatient)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patient'))
  }, [id])

  if (!id) return <p className="p-6 text-slate-500">Open this page from the patient profile's Print button.</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!patient) return <PageLoader fullScreen />

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
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
      <p className="mb-6 text-sm text-slate-500">Dental Chart</p>

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
      </div>

      <Odontogram2D patientId={id} canEdit={false} />

      <p className="mt-8 text-xs text-slate-400">
        Generated {new Date().toLocaleString()} — DentaVault
      </p>
    </div>
  )
}
