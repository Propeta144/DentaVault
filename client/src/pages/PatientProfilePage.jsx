import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Printer,
  Pencil,
  Trash2,
  ClipboardList,
  ScanLine,
  Grid3x3,
  Cake,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
  Sparkles,
  KeyRound,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPatient, listTreatments, addTreatment, getPortalAccount } from '../services/patients'
import AddTreatmentForm from '../components/patients/AddTreatmentForm'
import PatientXraysSection from '../components/xray/PatientXraysSection'
import EditPatientModal from '../components/patients/EditPatientModal'
import DeletePatientModal from '../components/patients/DeletePatientModal'
import CreatePortalAccountModal from '../components/patients/CreatePortalAccountModal'
import ResetPortalPasswordModal from '../components/patients/ResetPortalPasswordModal'
import Odontogram2D from '../components/chart/Odontogram2D'
import { ALL_TEETH } from '../constants/dental'

function InfoRow({ icon: Icon, label, value, capitalize }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <dt className="text-sm uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className={`text-base text-slate-800 ${capitalize ? 'capitalize' : ''}`}>
          {value || '—'}
        </dd>
      </div>
    </div>
  )
}

export default function PatientProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [portalAccount, setPortalAccount] = useState(undefined)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([getPatient(id), listTreatments(id)])
      .then(([p, t]) => {
        setPatient(p)
        setTreatments(t)
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patient'))
      .finally(() => setLoading(false))
  }, [id])

  // Dentist lang ang pwedeng gumawa/makakita ng portal-account status,
  // dentist-only din naman yung endpoint sa server side — kaya laktawan
  // na lang buong call kapag patient mismo ang nag-vi-view ng sarili
  // niyang profile.
  useEffect(() => {
    if (user.role !== 'dentist') return
    getPortalAccount(id)
      .then(setPortalAccount)
      .catch(() => setPortalAccount(null))
  }, [id, user.role])

  useEffect(() => {
    load()
  }, [load])

  async function handleAddTreatment(payload) {
    await addTreatment(id, payload)
    load()
  }

  if (loading) return <p className="text-slate-500">Loading...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!patient) return null

  const tabClass = (name) =>
    `flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2 text-base font-medium transition-colors ${
      tab === name
        ? 'border-sky-600 text-sky-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {patient.last_name}, {patient.first_name}
          </h1>
          <p className="text-base text-slate-500">Patient ID #{patient.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user.role === 'dentist' && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                Edit Information
              </button>
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              {portalAccount === null && (
                <button
                  type="button"
                  onClick={() => setCreatingAccount(true)}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                >
                  <KeyRound className="h-4 w-4" />
                  Create Portal Account
                </button>
              )}
              {portalAccount && (
                <span className="flex min-h-11 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 py-2 pl-3 pr-1.5 text-sm font-medium text-emerald-700">
                  <KeyRound className="h-4 w-4" />
                  Portal: {portalAccount.email}
                  <button
                    type="button"
                    onClick={() => setResettingPassword(true)}
                    title="Reset portal password"
                    className="flex h-8 w-8 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </span>
              )}
            </>
          )}
          <Link
            to={`/patients/${id}/summary`}
            target="_blank"
            className="flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print Summary
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoRow icon={Cake} label="Date of Birth" value={patient.date_of_birth} />
          <InfoRow icon={Sparkles} label="Gender" value={patient.sex} capitalize />
          <InfoRow icon={Phone} label="Contact" value={patient.contact_number} />
          <InfoRow icon={Mail} label="Email" value={patient.email} />
          <InfoRow icon={MapPin} label="Address" value={patient.address} />
          <InfoRow icon={ShieldAlert} label="Allergies" value={patient.allergies} />
          <InfoRow
            icon={Phone}
            label="Emergency Contact"
            value={
              patient.emergency_contact_name
                ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` — ${patient.emergency_contact_phone}` : ''}`
                : null
            }
          />
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <InfoRow icon={ClipboardList} label="Medical History" value={patient.medical_history} />
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto border-b border-slate-200 sm:gap-6">
        <button type="button" className={tabClass('history')} onClick={() => setTab('history')}>
          <ClipboardList className="h-4 w-4" />
          Treatment History
        </button>
        <button type="button" className={tabClass('chart')} onClick={() => setTab('chart')}>
          <Grid3x3 className="h-4 w-4" />
          Dental Chart
        </button>
        <button type="button" className={tabClass('xrays')} onClick={() => setTab('xrays')}>
          <ScanLine className="h-4 w-4" />
          X-rays
        </button>
      </div>

      {tab === 'history' && (
        <div>
          <div className="space-y-2">
            {treatments.length === 0 && (
              <p className="text-sm text-slate-400">No treatment entries yet.</p>
            )}
            {treatments.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-slate-200 bg-white p-3.5 text-base shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{t.procedure_name}</span>
                  <span className="text-sm text-slate-400">{t.treatment_date}</span>
                </div>
                {t.tooth_number && (
                  <span className="text-sm text-slate-500">
                    {t.tooth_number === ALL_TEETH ? 'All Teeth / Full Mouth' : `Tooth #${t.tooth_number}`}
                  </span>
                )}
                {t.notes && <p className="mt-1 text-slate-600">{t.notes}</p>}
                <p className="mt-1 text-sm text-slate-400">by {t.dentist_name}</p>
              </div>
            ))}
          </div>

          {user.role === 'dentist' && (
            <div className="mt-4">
              <AddTreatmentForm onSubmit={handleAddTreatment} />
            </div>
          )}
        </div>
      )}

      {tab === 'chart' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Link
              to={`/patients/${id}/chart/print`}
              target="_blank"
              className="flex min-h-11 items-center gap-1.5 text-base font-medium text-slate-500 transition-colors hover:text-sky-700"
            >
              <Printer className="h-4 w-4" />
              Print Chart
            </Link>
          </div>
          <Odontogram2D patientId={id} canEdit={user.role === 'dentist'} />
        </div>
      )}

      {tab === 'xrays' && <PatientXraysSection patientId={id} />}

      {editing && (
        <EditPatientModal
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={(updated) => setPatient((prev) => ({ ...prev, ...updated }))}
        />
      )}

      {deleting && (
        <DeletePatientModal
          patient={patient}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/patients', { replace: true })}
        />
      )}

      {creatingAccount && (
        <CreatePortalAccountModal
          patient={patient}
          onClose={() => setCreatingAccount(false)}
          onCreated={setPortalAccount}
        />
      )}

      {resettingPassword && (
        <ResetPortalPasswordModal
          patient={patient}
          email={portalAccount.email}
          onClose={() => setResettingPassword(false)}
        />
      )}
    </div>
  )
}
