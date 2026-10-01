import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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
  Sparkles,
  KeyRound,
  RotateCcw,
  Box,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getPatient, listTreatments, addTreatment, getPortalAccount } from '../services/patients'
import AddTreatmentForm from '../components/patients/AddTreatmentForm'
import PatientXraysSection from '../components/xray/PatientXraysSection'
import EditPatientModal from '../components/patients/EditPatientModal'
import DeletePatientModal from '../components/patients/DeletePatientModal'
import CreatePortalAccountModal from '../components/patients/CreatePortalAccountModal'
import ResetPortalPasswordModal from '../components/patients/ResetPortalPasswordModal'
import Modal from '../components/common/Modal'
import Odontogram2D from '../components/chart/Odontogram2D'
import { ALL_TEETH } from '../constants/dental'
import MedicalAlertBadge from '../components/common/MedicalAlertBadge'
import PageLoader from '../components/common/PageLoader'
import { useSelectedPatientCode, openPrintTab, profileState, PROFILE_PATH } from '../utils/selectedPatient'

const Odontogram3D = lazy(() => import('../components/chart/Odontogram3D'))

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
  // Patient Code galing sa history state, hindi sa URL (tignan utils/selectedPatient.js)
  const id = useSelectedPatientCode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [patient, setPatient] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [chartView, setChartView] = useState('2d')

  const [has3DPendingDrawing, setHas3DPendingDrawing] = useState(false)
  const [confirmLeave3D, setConfirmLeave3D] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [portalAccount, setPortalAccount] = useState(undefined)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getPatient(id), listTreatments(id)])
      .then(([p, t]) => {
        setPatient(p)
        setTreatments(t)
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patient'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (user.role !== 'dentist' || !id) return
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

  // Kinopya/tinype lang yung URL, o nag-expire yung history state — walang
  // patient na alam, kaya balik sa listahan.
  if (!id) return <Navigate to="/patients" replace />
  if (loading) return <PageLoader label="Loading patient record..." />
  if (error) return <p className="text-red-600">{error}</p>
  if (!patient) return null

  const tabClass = (name) =>
    `flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2 text-base font-medium transition-colors sm:flex-none ${
      tab === name
        ? 'border-sky-600 text-sky-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="w-full space-y-6">
      
      {/* 1. TOP HEADER SECTION */}
      {/* Walang print button dito sa header — nasa loob na ng bawat tab ang
          sariling print (Print Summary sa Treatment History, Print Chart sa
          Dental Chart), para malinaw kung ano ang ipi-print. */}
      <h1 className="text-2xl font-semibold text-slate-900">
        {patient.last_name}, {patient.first_name}
      </h1>

      {/* Mobile lang: Allergies at Medical History sa pinakaitaas — kritikal
          na impormasyon ito bago gumawa ng kahit anong treatment, kaya hindi
          dapat nasa ilalim ng mahabang scroll. Sa desktop, nasa Patient
          Details card pa rin sila (lg:hidden dito, hidden lg:block doon). */}
      <div className="space-y-2 lg:hidden">
        <MedicalAlertBadge label="Allergies" value={patient.allergies} />
        <MedicalAlertBadge label="Medical History" value={patient.medical_history} />
      </div>

      {/* 2. MAIN 2-COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        
        {/* ================= KALIWANG COLUMN: PATIENT INFO & ACTIONS (4 COLS) ================= */}
        <div className="space-y-6 lg:col-span-4">
          
          {/* Patient Details Card */}
<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 className="mb-4 border-b border-slate-100 pb-2 text-lg font-semibold text-slate-800">
    Patient Details
  </h2>
  <div className="space-y-4">
    <InfoRow icon={Cake} label="Date of Birth" value={patient.date_of_birth} />
    <InfoRow icon={Sparkles} label="Gender" value={patient.sex} capitalize />
    <InfoRow icon={Phone} label="Contact" value={patient.contact_number} />
    <InfoRow icon={Mail} label="Email" value={patient.email} />
    <InfoRow icon={MapPin} label="Address" value={patient.address} />
    <InfoRow
      icon={Phone}
      label="Emergency Contact"
      value={
        patient.emergency_contact_name
          ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` — ${patient.emergency_contact_phone}` : ''}`
          : null
      }
    />

    {/* PARATING NAKALITAW NA BADGES PARA SA ALLERGIES AT MEDICAL HISTORY.
        Desktop lang dito — sa mobile, nasa pinakaitaas na sila (tignan sa
        ilalim ng h1) para hindi matabunan ng tabs. */}
    <div className="hidden space-y-3 border-t border-slate-100 pt-4 lg:block">
      <MedicalAlertBadge label="Allergies" value={patient.allergies} />
      <MedicalAlertBadge label="Medical History" value={patient.medical_history} />
    </div>
  </div>
</div>

          {/* Quick Actions Card (Buttons) */}
          {user.role === 'dentist' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Actions
              </h3>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Information
                </button>

                {portalAccount === null && (
                  <button
                    type="button"
                    onClick={() => setCreatingAccount(true)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  >
                    <KeyRound className="h-4 w-4" />
                    Create Portal Account
                  </button>
                )}

                {portalAccount && (
                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    <span className="flex items-center gap-2 truncate">
                      <KeyRound className="h-4 w-4 shrink-0" />
                      <span className="truncate">Portal: {portalAccount.email}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setResettingPassword(true)}
                      title="Reset portal password"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Patient
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ================= KANANG COLUMN: TABS & CONTENT WORKSPACE (8 COLS) ================= */}
        {/* order-first sa mobile: tabs (History / Chart / X-rays) ang
            kasunod agad ng alerts, bago ang Patient Details at Actions — ito
            ang madalas gamitin ng dentist. Sa desktop (lg), balik sa normal
            na 2-column na ayos. */}
        <div className="order-first min-h-[500px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:order-none lg:col-span-8">
          
          {/* Tabs Nav */}
          <div className="mb-6 flex gap-4 overflow-x-auto border-b border-slate-200 sm:gap-6">
            <button type="button" className={tabClass('history')} onClick={() => setTab('history')}>
              <ClipboardList className="h-4 w-4" />
              {/* Maikling label sa phone para kasya ang 3 tab — dati natatago ang X-rays */}
              <span className="sm:hidden">History</span>
              <span className="hidden sm:inline">Treatment History</span>
            </button>
            <button type="button" className={tabClass('chart')} onClick={() => setTab('chart')}>
              <Grid3x3 className="h-4 w-4" />
              <span className="sm:hidden">Chart</span>
              <span className="hidden sm:inline">Dental Chart</span>
            </button>
            <button type="button" className={tabClass('xrays')} onClick={() => setTab('xrays')}>
              <ScanLine className="h-4 w-4" />
              X-rays
            </button>
          </div>

          {/* Tab 1: Treatment History */}
          {tab === 'history' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  {treatments.length} treatment{treatments.length === 1 ? '' : 's'} on record
                </p>
                <button
                  type="button"
                  onClick={() => openPrintTab(`${PROFILE_PATH}/summary`, profileState(id))}
                  className="flex min-h-11 items-center gap-1.5 text-base font-medium text-slate-500 transition-colors hover:text-sky-700"
                >
                  <Printer className="h-4 w-4" />
                  Print Summary
                </button>
              </div>
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
                <div className="border-t border-slate-100 pt-4">
                  <AddTreatmentForm onSubmit={handleAddTreatment} />
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Dental Chart */}
          {tab === 'chart' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (chartView === '3d' && has3DPendingDrawing) {
                        setConfirmLeave3D(true)
                        return
                      }
                      setChartView('2d')
                    }}
                    className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                      chartView === '2d' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    2D Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('3d')}
                    className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
                      chartView === '3d' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Box className="h-4 w-4" />
                    3D Chart
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openPrintTab(`${PROFILE_PATH}/chart/print`, profileState(id))}
                  className="flex min-h-11 items-center gap-1.5 text-base font-medium text-slate-500 transition-colors hover:text-sky-700"
                >
                  <Printer className="h-4 w-4" />
                  Print Chart
                </button>
              </div>
              
              <div className="overflow-x-auto">
                {chartView === '2d' ? (
                  <Odontogram2D patientId={id} canEdit={user.role === 'dentist'} />
                ) : (
                  <Suspense fallback={<PageLoader label="Loading 3D chart..." />}>
                    <Odontogram3D
                      patientId={id}
                      canEdit={user.role === 'dentist'}
                      onPendingChange={setHas3DPendingDrawing}
                    />
                  </Suspense>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: X-rays */}
          {tab === 'xrays' && <PatientXraysSection patientId={id} />}

        </div>

      </div>

      {/* MODALS */}
      {confirmLeave3D && (
        <Modal title="Discard unsaved 3D mark?" onClose={() => setConfirmLeave3D(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-base text-amber-800">
                You have an unsaved freehand mark on the 3D chart. Switching to the 2D chart now will discard it.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave3D(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Keep Drawing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLeave3D(false)
                  setHas3DPendingDrawing(false)
                  setChartView('2d')
                }}
                className="flex-1 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700"
              >
                Discard & Switch
              </button>
            </div>
          </div>
        </Modal>
      )}

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