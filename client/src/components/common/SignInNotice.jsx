import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, History, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { formatActivityTime } from '../../utils/formatDate'

// Sariling computer (local testing): walang silbing ipakita ang "::1"
const LOOPBACK_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

// "Last sign-in" pagka-login (#33): kailan ang naunang pag-login (at saang
// IP, dentist lang) at ilang maling subok sa account mula noon. Kapag may
// maling subok, amber, para mapansin agad kung may ibang nanghuhula ng
// password. Isang beses lang bawat login (X = hindi na lalabas).
//
// Critique 2026-10-25: dati nakadikit ito sa itaas ng BAWAT page hangga't
// hindi isinasara (malaking card, ~70px sa phone). Ngayon:
// - Karaniwang balita: maliit na linya lang, at kusang nawawala pagkalipat
//   ng page (nakita na sa unang page pagka-login).
// - May maling subok: nananatili ang amber na babala hanggang isara
//   (seguridad: hindi dapat makaligtaan).
export default function SignInNotice() {
  const { user, signInInfo, dismissSignInNotice } = useAuth()
  const location = useLocation()
  const firstPath = useRef(location.pathname)

  const visible = Boolean(user && signInInfo && !signInInfo.noticeDismissed)
  const failed = Number(signInInfo?.failedAttemptsSince) || 0
  const warn = failed > 0

  useEffect(() => {
    if (visible && !warn && location.pathname !== firstPath.current) dismissSignInNotice()
  }, [visible, warn, location.pathname, dismissSignInNotice])

  if (!visible) return null
  const isDentist = user.role === 'dentist'
  if (!signInInfo.lastSignInAt && failed === 0) return null // unang login, walang maibabalita

  const ip =
    isDentist && signInInfo.lastSignInIp && !LOOPBACK_IPS.has(signInInfo.lastSignInIp)
      ? signInInfo.lastSignInIp
      : null

  if (!warn) {
    return (
      <div role="status" className="mb-3 flex items-center gap-2 text-sm text-slate-600">
        <History className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          Last sign-in: <span className="font-medium text-slate-800">{formatActivityTime(signInInfo.lastSignInAt)}</span>
          {ip && <span> from {ip}</span>}
        </p>
        <button
          type="button"
          onClick={dismissSignInNotice}
          aria-label="Dismiss sign-in notice"
          className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {signInInfo.lastSignInAt && (
          <p>
            Last sign-in: <span className="font-medium">{formatActivityTime(signInInfo.lastSignInAt)}</span>
            {ip && <span className="text-amber-800"> from {ip}</span>}
          </p>
        )}
        <p className="mt-0.5">
          <span className="font-semibold">
            {failed} failed sign-in attempt{failed === 1 ? '' : 's'}
          </span>{' '}
          on your account {signInInfo.lastSignInAt ? 'since then' : 'in the last 30 days'}. If this wasn&apos;t you,{' '}
          {isDentist ? (
            <>
              <Link to="/audit-log" className="font-medium underline hover:no-underline">
                check the Audit Log
              </Link>{' '}
              and{' '}
            </>
          ) : null}
          <Link to="/change-password" className="font-medium underline hover:no-underline">
            change your password
          </Link>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={dismissSignInNotice}
        aria-label="Dismiss sign-in notice"
        className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-amber-700 transition-colors hover:bg-amber-100"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
