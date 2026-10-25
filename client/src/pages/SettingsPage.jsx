import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, KeyRound, ShieldCheck, Inbox, ScrollText, Upload, MapPin, Phone, Mail } from 'lucide-react'
import clinicLogoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { CLINIC_INFO } from '../constants/clinic'
import { getSettings } from '../services/settings'
import { useAuth } from '../context/AuthContext'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'
import PageLoader from '../components/common/PageLoader'
import Avatar from '../components/common/Avatar'
import StatusBadge from '../components/common/StatusBadge'

// Settings (dentist at patient). Read-only na impormasyon na dating walang
// mapupuntahan:
// - Account: pangalan, email, role + Change password (dati nasa account menu lang)
// - Pag-upload ng X-ray sa patient portal (#27; ang email/Mailgun ay
//   tinanggal sa #32)
// - Dentist: gaano katagal itinatago ang audit log (Feature #10, RA 10173)

function years(days) {
  return days % 365 === 0 ? `${days / 365} year${days === 365 ? '' : 's'}` : `${days} days`
}

function Card({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Icon className="h-5 w-5 text-sky-600" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const isDentist = user?.role === 'dentist'
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings()
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load settings'))
  }, [])

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
  }
  if (!data) return <PageLoader label="Loading settings..." />

  const [firstName, ...rest] = data.account.fullName.replace(/^Dr\.?\s+/i, '').split(' ')
  const lastName = rest[rest.length - 1] || ''

  return (
    // mx-auto: nakagitna (dati nakadikit sa kaliwa, ~300px na bakante sa kanan
    // ng laptop). Iba ang subtitle ng dentist at patient.
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Settings className="h-6 w-6 text-sky-600" />
          Settings
        </h1>
        <p className="text-base text-slate-600">
          {isDentist
            ? 'Your account, X-rays from patients, and how long the audit log is kept.'
            : 'Your account and how to send X-rays to the clinic.'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Ang clinic mismo muna (bolder, critique 2026-10-25): logo at contact
            info, parehong nakalimbag sa header ng bawat printout (PrintHeader).
            Para sa pasyente: dito makikita kung paano kontakin ang clinic. */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="settings-clinic">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
            <img src={clinicLogoUrl} alt="" className="h-auto w-48 shrink-0" />
            <div className="min-w-0">
              <h2 id="settings-clinic" className="text-base font-semibold text-slate-900">{CLINIC_INFO.name}</h2>
              <ul className="mt-2 space-y-1.5 text-base text-slate-700">
                <li className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  {CLINIC_INFO.address}
                </li>
                {/* Pantay ang hanay ng mga numero (icon sa kaliwa, numero
                    magkasunod/nakasalansan); 44px ang tap area sa phone */}
                <li className="flex items-start gap-2">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-slate-500 max-lg:mt-3.5" aria-hidden="true" />
                  <span className="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-4">
                    {CLINIC_INFO.phones.map((p) => (
                      <a
                        key={p.number}
                        href={`tel:${p.number.replace(/\s/g, '')}`}
                        className="inline-flex min-h-11 items-center font-medium text-sky-700 hover:underline lg:min-h-0"
                      >
                        {p.number} <span className="ml-1 font-normal text-slate-600">({p.network})</span>
                      </a>
                    ))}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <a href={`mailto:${CLINIC_INFO.email}`} className="break-all font-medium text-sky-700 hover:underline">
                    {CLINIC_INFO.email}
                  </a>
                </li>
              </ul>
              <p className="mt-2 text-sm text-slate-600">
                {isDentist ? 'This is the header printed on every summary, chart, and X-ray printout.' : 'Call or text the clinic for appointments.'}
              </p>
            </div>
          </div>
        </section>

        <Card icon={KeyRound} title="Account">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar firstName={firstName} lastName={lastName} size="lg" tone="dark" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{data.account.fullName}</p>
                <p className="truncate text-sm text-slate-500">{data.account.email}</p>
                <div className="mt-1">
                  <StatusBadge variant={isDentist ? 'sky' : 'slate'}>{isDentist ? 'Dentist' : 'Patient'}</StatusBadge>
                </div>
              </div>
            </div>
            <Link
              to="/change-password"
              className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </Link>
          </div>
        </Card>

        {/* #27: dito nag-a-upload ng X-ray ang patient (wala nang email, #32) */}
        <Card icon={Upload} title="Uploading X-rays in the app">
          <p className="text-base text-slate-600">
            {isDentist
              ? 'Patients upload X-rays from outside clinics in their own record (My Record → X-rays). The dentist sees them in the X-ray Inbox, and the patient can remove one until it has been reviewed.'
              : 'The easiest way to send the clinic an X-ray from another clinic or laboratory: open My Record → X-rays and upload it there. You can remove it until the dentist has reviewed it.'}
          </p>
          {isDentist ? (
            <Link to="/xrays" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline">
              <Inbox className="h-4 w-4" />
              Open X-ray Inbox
            </Link>
          ) : (
            <Link to={PROFILE_PATH} state={profileState(user.patientCode, { tab: 'xrays' })} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline">
              <Upload className="h-4 w-4" />
              Upload an X-ray
            </Link>
          )}
        </Card>

        {isDentist && data.retention && (
          <Card icon={ShieldCheck} title="Data privacy (audit log)">
            <p className="text-base text-slate-600">
              Every view and change is recorded in the audit log (RA 10173). Older entries are archived to a file, then
              removed from the database:
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <dt className="text-sm text-slate-500">Views and printouts</dt>
                <dd className="text-base font-semibold text-slate-900">{years(data.retention.viewDays)}</dd>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <dt className="text-sm text-slate-500">Changes, sign-ins, imports</dt>
                <dd className="text-base font-semibold text-slate-900">{years(data.retention.changeDays)}</dd>
              </div>
            </dl>
            {!data.retention.enabled && (
              <p className="mt-2 text-sm text-amber-700">Automatic archiving is turned off on the server.</p>
            )}
            <Link
              to="/audit-log"
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline"
            >
              <ScrollText className="h-4 w-4" />
              Open Audit Log
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}
