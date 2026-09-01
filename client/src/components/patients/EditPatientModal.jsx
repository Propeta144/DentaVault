import Modal from '../common/Modal'
import PatientForm from './PatientForm'
import { updatePatient } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import QuickInputTextarea from '../common/QuickInputTextarea'

// Snake_case yung DB rows; camelCase naman yung ginagamit ng PatientForm —
// same shape na tinatanggap ng API — kaya kailangan i-map muna papuntang
// isa para ma-prefill yung edit form.
function toFormValues(patient) {
  return {
    firstName: patient.first_name,
    lastName: patient.last_name,
    sex: patient.sex,
    dateOfBirth: patient.date_of_birth,
    contactNumber: patient.contact_number || '',
    email: patient.email || '',
    address: patient.address || '',
    medicalHistory: patient.medical_history || '',
    allergies: patient.allergies || '',
    emergencyContactName: patient.emergency_contact_name || '',
    emergencyContactPhone: patient.emergency_contact_phone || '',
  }
}

export default function EditPatientModal({ patient, onClose, onSaved }) {
  const { showToast } = useToast()

  async function handleSubmit(form) {
    try {
      const updated = await updatePatient(patient.id, form)
      showToast('Patient information updated successfully.', { type: 'success' })
      onSaved(updated)
      onClose()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update patient.', { type: 'error' })
      throw err // para maipakita rin ni PatientForm yung inline error banner niya
    }
  }

  return (
    <Modal title={`Edit ${patient.first_name} ${patient.last_name}`} onClose={onClose} maxWidth="max-w-2xl">
      <PatientForm initialValues={toFormValues(patient)} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </Modal>
  )
}
