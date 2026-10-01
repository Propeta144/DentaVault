import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, KeyRound, Mail, ShieldCheck, Copy, Check, Inbox, ScrollText } from 'lucide-react'
import { getSettings } from '../services/settings'
import { useAuth } from '../context/AuthContext'
import PageLoader from '../components/common/PageLoader'
import Avatar from '../components/common/Avatar'
import StatusBadge from '../components/common/StatusBadge'

// Settings (dentist at patient). Read-only na impormasyon na dating walang
// mapupuntahan:
// - Account: pangalan, email, role + Change password (dati nasa account menu lang)
// - Email ng clinic para sa X-ray: sa proposal, email ang paraan ng pasyente
//   para magpadala ng X-ray, pero wala sa app kung saan ipapadala
// - Dentist: gaano katagal itinatago ang audit log (Feature #10, RA 10173)

function years(days) {
  return days % 365 === 0 ? `${days / 365} year${days === 365 ? '' : 's'}` : `${days} days`
}

function CopyButton({ text }) {
  const [state, setState] = useState('idle')
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      {state === 'copied' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : 'Copy'}
    </button>
  )
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
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Settings className="h-6 w-6 text-sky-600" />
          Settings
        </h1>
        <p className="text-base text-slate-500">Your account and how the clinic receives X-rays.</p>
      </div>

      <div className="space-y-4">
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

        <Card icon={Mail} title="Sending X-rays by email">
          {data.xraySubmissionEmail ? (
            <div className="space-y-3">
              <p className="text-base text-slate-600">
                {isDentist
                  ? 'Patients send X-rays from outside clinics to this address:'
                  : 'Got an X-ray from another clinic or laboratory? Email the image to:'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-base text-slate-900">
                  {data.xraySubmissionEmail}
                </p>
                <CopyButton text={data.xraySubmissionEmail} />
              </div>
            </div>
          ) : (
            <p className="text-base text-slate-600">
              {isDentist
                ? 'The clinic X-ray email address is not set yet. Add CLINIC_XRAY_EMAIL (the Mailgun route address) to the server settings so patients can see it here.'
                : 'Ask the clinic for the email address where you can send your X-rays.'}
            </p>
          )}
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">
            <li>
              {isDentist
                ? 'It must come from the email saved on the patient’s record, so it is filed to the right person automatically.'
                : 'Send it from the email address the clinic has on your record, so it is filed to you automatically.'}
            </li>
            <li>Accepted files: JPG, PNG, WEBP, or PDF.</li>
            {isDentist && <li>New ones appear in the X-ray Inbox.</li>}
          </ul>
          {isDentist && (
            <Link to="/xrays" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline">
              <Inbox className="h-4 w-4" />
              Open X-ray Inbox
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
