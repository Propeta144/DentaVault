import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Printer,
  Pencil,
  Trash2,
  ClipboardList,
  ClipboardPlus,
  ScanLine,
  Grid3x3,
  Phone,
  Mail,
  MapPin,
  KeyRound,
  RotateCcw,
  Box,
  LayoutGrid,
  AlertTriangle,
  Contact,
  FileCheck2,
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
import Avatar from '../components/common/Avatar'
import DropdownMenu from '../components/common/DropdownMenu'
import EmptyState from '../components/common/EmptyState'
import StatusBadge from '../components/common/StatusBadge'
import Odontogram2D from '../components/chart/Odontogram2D'
import { ALL_TEETH } from '../constants/dental'
import MedicalAlertBadge from '../components/common/MedicalAlertBadge'
import PageLoader from '../components/common/PageLoader'
import { useSelectedPatientCode, openPrintTab, profileState, PROFILE_PATH } from '../utils/selectedPatient'
import { fullName, sexLabel } from '../utils/patientName'
import { calculateAge, formatDate } from '../utils/formatDate'
import useDiscardGuard from '../hooks/useDiscardGuard'

const Odontogram3D = lazy(() => import('../components/chart/Odontogram3D'))

// Contact at iba pang detalye. Dalawang beses ito nire-render sa page:
// sa loob ng header card sa desktop (lg), at sa ilalim ng tabs sa phone —
// para sa phone, ang tabs agad ang kasunod ng allergies (tignan #12 sa
// CLAUDE.md), hindi mahabang listahan ng contact details.
function PatientDetails({ patient, portalAccount, showPortal }) {
  const items = [
    { icon: Phone, label: 'Contact', value: patient.contact_number },
    { icon: Mail, label: 'Email', value: patient.email, truncate: true },
    { icon: MapPin, label: 'Address', value: patient.address },
    {
      icon: Contact,
      label: 'Emergency Contact',
      value: patient.emergency_contact_name
        ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ''}`
        : null,
    },
  ]
  if (showPortal) {
    items.push({
      icon: KeyRound,
      label: 'Patient Portal',
      value: portalAccount === undefined ? '…' : portalAccount ? portalAccount.email : 'No account yet',
      truncate: true,
    })
  }

  // Buong pangalan ng class (hindi `xl:grid-cols-${n}`): binabasa ng
  // Tailwind ang source code, kaya hindi nito makikita ang binuong string.
  const xlCols = items.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'

  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 ${xlCols}`}>
      {/* Email: truncate (+ buong value sa tooltip), dahil hinahati ng
          break-words ang email sa gitna ng salita sa makitid na column */}
      {items.map(({ icon: Icon, label, value, truncate }) => (
        <div key={label} className="flex min-w-0 items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
            <dd
              className={`text-base text-slate-800 ${truncate ? 'truncate' : 'break-words'}`}
              title={truncate && value ? value : undefined}
            >
              {value || '—'}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

export default function PatientProfilePage() {
  // Patient Code galing sa history state, hindi sa URL (tignan utils/selectedPatient.js)
  const id = useSelectedPatientCode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isDentist = user.role === 'dentist'
  const [patient, setPatient] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const location = useLocation()
  // Puwedeng may kasamang tab ang link (hal. X-ray inbox → 'xrays')
  const [tab, setTab] = useState(() =>
    ['history', 'chart', 'xrays'].includes(location.state?.tab) ? location.state.tab : 'history',
  )
  const [chartView, setChartView] = useState('2d')

  const [has3DPendingDrawing, setHas3DPendingDrawing] = useState(false)
  const [confirmLeave3D, setConfirmLeave3D] = useState(false)
  const [addingTreatment, setAddingTreatment] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [portalAccount, setPortalAccount] = useState(undefined)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  // X / Escape / Cancel sa Add Treatment: magtatanong muna kapag may na-type
  const closeAddTreatment = useCallback(() => setAddingTreatment(false), [])
  const addTreatmentGuard = useDiscardGuard(closeAddTreatment)

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

  // Treatments lang ang nire-reload pagka-add (hindi ang buong page), para
  // hindi bumalik sa loader at hindi mawala ang scroll position.
  const reloadTreatments = useCallback(() => listTreatments(id).then(setTreatments), [id])

  useEffect(() => {
    if (!isDentist || !id) return
    getPortalAccount(id)
      .then(setPortalAccount)
      .catch(() => setPortalAccount(null))
  }, [id, isDentist])

  useEffect(() => {
    load()
  }, [load])

  async function handleAddTreatment(payload, { keepOpen }) {
    await addTreatment(id, payload)
    await reloadTreatments()
    setTab('history') // para makita agad ang bagong entry
    if (!keepOpen) setAddingTreatment(false) // "Add another" = manatiling bukas
  }

  // Kinopya/tinype lang yung URL, o nag-expire yung history state — walang
  // patient na alam, kaya balik sa listahan.
  if (!id) return <Navigate to="/patients" replace />
  if (loading) return <PageLoader label="Loading patient record..." />
  if (error) return <p className="text-red-600">{error}</p>
  if (!patient) return null

  const age = calculateAge(patient.date_of_birth)

  const tabClass = (name) =>
    `flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2 text-base font-medium transition-colors sm:flex-none ${
      tab === name ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  const moreActions = [
    portalAccount === null && {
      label: 'Create portal account',
      icon: KeyRound,
      onClick: () => setCreatingAccount(true),
    },
    portalAccount && {
      label: 'Reset portal password',
      icon: RotateCcw,
      onClick: () => setResettingPassword(true),
    },
    { label: 'Delete patient', icon: Trash2, danger: true, onClick: () => setDeleting(true) },
  ].filter(Boolean)

  const addTreatmentButton = (extraClass = '') => (
    <button
      type="button"
      onClick={() => setAddingTreatment(true)}
      className={`flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 ${extraClass}`}
    >
      <ClipboardPlus className="h-4 w-4" />
      Add Treatment
    </button>
  )

  return (
    <div className="w-full space-y-6">
      {/* ================= HEADER: buod ng patient + actions =================
          Dati pangalan lang ang header; nasa kaliwang kahon ang edad,
          kasarian, at allergies, at nasa ilalim pa ang mga action. Ngayon
          isang tingin lang: sino, ilang taon, may allergy ba, at ano ang
          puwedeng gawin. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar firstName={patient.first_name} lastName={patient.last_name} size="lg" />
            <div className="min-w-0">
              {!isDentist && (
                <p className="text-sm font-medium text-sky-700">Hi, {patient.first_name}! This is your dental record.</p>
              )}
              <h1 className="break-words text-2xl font-semibold text-slate-900">{fullName(patient)}</h1>
              <p className="mt-0.5 text-base text-slate-500">
                {age !== null && `${age} yrs · `}
                {sexLabel(patient.sex)} · Born {formatDate(patient.date_of_birth)}
              </p>
              {isDentist && !!patient.is_legacy_migrated && (
                <div className="mt-1.5">
                  <StatusBadge variant="slate" icon={FileCheck2}>
                    Imported record
                  </StatusBadge>
                </div>
              )}
            </div>
          </div>

          {isDentist && (
            <div className="flex items-center gap-2">
              {addTreatmentButton('flex-1 sm:flex-none')}
              {/* Phone: icon lang ang Edit, para buong salita pa rin ang
                  "Add Treatment" (dati nahahati sa dalawang linya sa 360px) */}
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit patient details"
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:px-4"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <DropdownMenu label="More patient actions" items={moreActions} />
            </div>
          )}
        </div>

        {/* Allergies at Medical History: laging kita, bago ang kahit anong
            treatment (pula kapag may laman). */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MedicalAlertBadge label="Allergies" value={patient.allergies} />
          <MedicalAlertBadge label="Medical History" value={patient.medical_history} />
        </div>

        <div className="mt-5 hidden border-t border-slate-100 pt-5 lg:block">
          <PatientDetails patient={patient} portalAccount={portalAccount} showPortal={isDentist} />
        </div>
      </section>

      {/* ================= TABS: buong lapad =================
          Dati 8/12 lang ng lapad (may Patient Details sa kaliwa), kaya
          maliit ang Dental Chart sa laptop. */}
      <section className="min-h-[420px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {/* 320px: mas maliit na gap at walang icon para kasya ang 3 tab nang walang scroll */}
        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 min-[360px]:gap-4 sm:gap-6" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tabClass('history')} onClick={() => setTab('history')}>
            <ClipboardList className="hidden h-4 w-4 min-[360px]:block" />
            {/* Maikling label sa phone para kasya ang 3 tab — dati natatago ang X-rays */}
            <span className="sm:hidden">History</span>
            <span className="hidden sm:inline">Treatment History</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'chart'} className={tabClass('chart')} onClick={() => setTab('chart')}>
            <Grid3x3 className="hidden h-4 w-4 min-[360px]:block" />
            <span className="sm:hidden">Chart</span>
            <span className="hidden sm:inline">Dental Chart</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'xrays'} className={tabClass('xrays')} onClick={() => setTab('xrays')}>
            <ScanLine className="hidden h-4 w-4 min-[360px]:block" />
            X-rays
          </button>
        </div>

        {/* Tab 1: Treatment History */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">
                {treatments.length} treatment{treatments.length === 1 ? '' : 's'} on record
              </p>
              {treatments.length > 0 && (
                <button
                  type="button"
                  onClick={() => openPrintTab(`${PROFILE_PATH}/summary`, profileState(id))}
                  className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-base font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-sky-700"
                >
                  <Printer className="h-4 w-4" />
                  Print Summary
                </button>
              )}
            </div>

            {treatments.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title="No treatments recorded yet"
                description={
                  isDentist
                    ? 'Record the first procedure for this patient. It will show up here and on the dashboard.'
                    : 'Treatments done at the clinic will appear here.'
                }
                action={isDentist && addTreatmentButton()}
              />
            ) : (
              // Timeline: petsa sa kaliwa (desktop), pinakabago sa itaas
              <ol className="space-y-3">
                {treatments.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:gap-5"
                  >
                    <time
                      dateTime={t.treatment_date}
                      className="shrink-0 text-sm font-medium text-slate-500 sm:w-28 sm:pt-0.5"
                    >
                      {formatDate(t.treatment_date)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-900">{t.procedure_name}</span>
                        {t.tooth_number && (
                          <StatusBadge variant="sky">
                            {t.tooth_number === ALL_TEETH ? 'Full mouth' : `Tooth ${t.tooth_number}`}
                          </StatusBadge>
                        )}
                      </div>
                      {t.notes && <p className="mt-1 text-base text-slate-600">{t.notes}</p>}
                      <p className="mt-1 text-sm text-slate-400">by {t.dentist_name}</p>
                    </div>
                  </li>
                ))}
              </ol>
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
                // Sumusunod sa bukas na view: 2D → 2D print, 3D → 3D print (Feature #22)
                onClick={() =>
                  openPrintTab(`${PROFILE_PATH}/chart/${chartView === '3d' ? 'print-3d' : 'print'}`, profileState(id))
                }
                className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-base font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-sky-700"
              >
                <Printer className="h-4 w-4" />
                Print Chart
              </button>
            </div>

            <div className="overflow-x-auto">
              {chartView === '2d' ? (
                <Odontogram2D patientId={id} canEdit={isDentist} />
              ) : (
                <Suspense fallback={<PageLoader label="Loading 3D chart..." />}>
                  <Odontogram3D patientId={id} canEdit={isDentist} onPendingChange={setHas3DPendingDrawing} />
                </Suspense>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: X-rays */}
        {tab === 'xrays' && <PatientXraysSection patientId={id} />}
      </section>

      {/* Phone lang: contact details sa ilalim ng tabs */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Contact Details</h2>
        <PatientDetails patient={patient} portalAccount={portalAccount} showPortal={isDentist} />
      </section>

      {/* MODALS */}
      {addingTreatment && (
        // max-w-2xl: isang linya lang ang bawat procedure button, kaya kasya
        // ang buong form (pati Save) sa 768px na taas ng laptop
        <Modal
          title={`Add Treatment — ${fullName(patient)}`}
          onClose={addTreatmentGuard.requestClose}
          maxWidth="max-w-2xl"
        >
          <AddTreatmentForm onSubmit={handleAddTreatment} guard={addTreatmentGuard} />
        </Modal>
      )}

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
