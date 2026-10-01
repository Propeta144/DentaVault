import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import PatientForm from '../components/patients/PatientForm'
import { createPatient } from '../services/patients'
import { useToast } from '../context/ToastContext'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'

export default function PatientRegisterPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function handleSubmit(form) {
    try {
      const patient = await createPatient(form)
      showToast(`${patient.first_name} ${patient.last_name} registered successfully.`, {
        type: 'success',
      })
      navigate(PROFILE_PATH, { state: profileState(patient.patient_code) })
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to register patient.', { type: 'error' })
      throw err
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <UserPlus className="h-6 w-6 text-sky-600" />
          Register New Patient
        </h1>
        <p className="text-base text-slate-500">
          Fields marked <span className="text-red-600">*</span> are required.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <PatientForm
          onSubmit={handleSubmit}
          submitLabel="Register Patient"
          onCancel={() => navigate('/patients')}
          stickyFooter
        />
      </div>
    </div>
  )
}
