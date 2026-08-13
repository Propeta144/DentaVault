import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import PatientForm from '../components/patients/PatientForm'
import { createPatient } from '../services/patients'
import { useToast } from '../context/ToastContext'

export default function PatientRegisterPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(form) {
    try {
      const patient = await createPatient(form)
      showToast(`${patient.first_name} ${patient.last_name} registered successfully.`, {
        type: 'success',
      })
      navigate(`/patients/${patient.id}`)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to register patient.', { type: 'error' })
      throw err
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        <UserPlus className="h-6 w-6 text-sky-600" />
        <h1 className="text-2xl font-semibold text-slate-900">Register New Patient</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <PatientForm onSubmit={handleSubmit} submitLabel="Register Patient" />
      </div>
    </div>
  )
}
