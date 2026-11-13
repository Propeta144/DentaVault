import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import Modal from '../common/Modal'
import Avatar from '../common/Avatar'
import { SkeletonRows } from '../common/Skeleton'
import { PatientAlertStrip } from '../common/MedicalAlertBadge'
import MissingPatientInfo from './MissingPatientInfo'
import { healthAlerts } from './PatientInfoRecord'
import { getPatient } from '../../services/patients'
import { fullName, sexLabel } from '../../utils/patientName'
import { calculateAge, formatDate } from '../../utils/formatDate'
import { emergencyRelationshipLabel } from '../../constants/emergencyRelationship'
import { PROFILE_PATH, profileState } from '../../utils/selectedPatient'

export default function PatientPreviewModal({ summary, onClose }) {
  const [patient, setPatient] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setPatient(null)
    setError('')
    getPatient(summary.patient_code)
      .then((result) => { if (active) setPatient(result) })
      .catch((err) => { if (active) setError(err.response?.data?.error || 'Failed to load patient preview.') })
    return () => { active = false }
  }, [summary.patient_code, attempt])
  const notes = patient ? healthAlerts(patient) : []
  const age = patient ? calculateAge(patient.date_of_birth) : null
  const relationship = patient ? emergencyRelationshipLabel(patient) : ''
  return (
    <Modal title="Patient preview" onClose={onClose} maxWidth="max-w-2xl"
      notice={patient && <PatientAlertStrip allergies={patient.allergies} medicalHistory={patient.medical_history} />}>
      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
          <p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 min-h-11 rounded-md border border-red-300 px-3 text-base font-medium">Retry</button>
        </div>
      ) : !patient ? <SkeletonRows rows={3} label="Loading patient preview" /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar firstName={patient.first_name} lastName={patient.last_name} photoUrl={`/patients/${patient.patient_code}/photo`} photoVersion={patient.photo_version} />
            <div className="min-w-0">
              <p className="break-words text-lg font-semibold text-slate-900">{fullName(patient)}</p>
              <p className="text-sm text-slate-600">Born {formatDate(patient.date_of_birth)}{age !== null ? ` (${age} yrs)` : ''} · {sexLabel(patient.sex)}</p>
            </div>
          </div>
          {notes.length > 0 && <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><span className="font-semibold">Health questions:</span> {notes.join(' · ')}</span></p>}
          <MissingPatientInfo patient={patient} />
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Contact number', patient.contact_number], ['Email', patient.email], ['Address', patient.address],
              ['Last recorded visit', formatDate(summary.last_treatment_date, 'No visits recorded')],
              ['Emergency contact', patient.emergency_contact_name ? `${patient.emergency_contact_name}${relationship ? ` (${relationship})` : ''}` : null],
              ['Emergency contact number', patient.emergency_contact_phone],
            ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-slate-600">{label}</dt><dd className="break-words text-base text-slate-900">{value || 'Not recorded'}</dd></div>)}
          </dl>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 hover:bg-slate-50">Close preview</button>
        {patient && <Link to={PROFILE_PATH} state={profileState(patient.patient_code)} className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white hover:bg-sky-700">Open full record<ArrowRight className="h-4 w-4" /></Link>}
      </div>
    </Modal>
  )
}
