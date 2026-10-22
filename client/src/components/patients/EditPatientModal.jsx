import Modal from '../common/Modal'
import PatientForm from './PatientForm'
import { updatePatient } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import useDiscardGuard from '../../hooks/useDiscardGuard'
import { patientInfoToForm } from '../../constants/patientInfo'

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
    // Buong Patient Information Record (middle name, health questions, ...)
    ...patientInfoToForm(patient),
  }
}

// portalEmail: sign-in email ng portal account (kung meron). Sumusunod ito
// sa Email field kapag na-save (Feature #30), kaya ipinapaalam sa form.
export default function EditPatientModal({ patient, portalEmail, onClose, onSaved }) {
  const { showToast } = useToast()
  // X / Escape / Cancel: magtatanong muna kapag may binago
  const guard = useDiscardGuard(onClose)

  async function handleSubmit(form) {
    try {
      const { patient: updated, portalAccount } = await updatePatient(patient.patient_code, form)
      const loginChanged = portalAccount && portalEmail && portalAccount.email !== portalEmail
      showToast(
        loginChanged
          ? `Patient information updated. The patient now signs in with ${portalAccount.email}.`
          : 'Patient information updated successfully.',
        { type: 'success' },
      )
      onSaved(updated, portalAccount)
      onClose()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update patient.', { type: 'error' })
      throw err // para maipakita rin ni PatientForm yung inline error banner niya
    }
  }

  return (
    <Modal title={`Edit ${patient.first_name} ${patient.last_name}`} onClose={guard.requestClose} maxWidth="max-w-2xl">
      <PatientForm
        initialValues={toFormValues(patient)}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        guard={guard}
        patientCode={patient.patient_code}
        portalEmail={portalEmail}
      />
    </Modal>
  )
}
