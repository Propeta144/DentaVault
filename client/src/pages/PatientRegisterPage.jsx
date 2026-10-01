import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import PatientForm from '../components/patients/PatientForm'
import { createPatient } from '../services/patients'
import { useToast } from '../context/ToastContext'
import useDiscardGuard from '../hooks/useDiscardGuard'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'

export default function PatientRegisterPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Babala bago mawala ang na-type (Cancel, o pagsara/refresh ng tab)
  const guard = useDiscardGuard(() => navigate('/patients'), { warnOnUnload: true })

  async function handleSubmit(form, { allowDuplicate }) {
    try {
      const patient = await createPatient({ ...form, allowDuplicate })
      showToast(`${patient.first_name} ${patient.last_name} registered successfully.`, {
        type: 'success',
      })
      navigate(PROFILE_PATH, { state: profileState(patient.patient_code) })
    } catch (err) {
      // 409 duplicate: ipinapakita na ng PatientForm bilang babala (hindi error)
      if (err.response?.status !== 409) {
        showToast(err.response?.data?.error || 'Failed to register patient.', { type: 'error' })
      }
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
          guard={guard}
          onOpenExisting={(code) => {
            guard.setDirty(false)
            navigate(PROFILE_PATH, { state: profileState(code) })
          }}
          stickyFooter
        />
      </div>
    </div>
  )
}
