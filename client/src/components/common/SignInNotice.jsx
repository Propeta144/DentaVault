import { Link } from 'react-router-dom'
import { AlertTriangle, History, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { formatActivityTime } from '../../utils/formatDate'

// "Last sign-in" pagka-login (#33): kailan ang naunang pag-login (at saang
// IP, dentist lang) at ilang maling subok sa account mula noon. Kapag may
// maling subok, amber, para mapansin agad kung may ibang nanghuhula ng
// password. Isang beses lang bawat login (X = hindi na lalabas).
export default function SignInNotice() {
  const { user, signInInfo, dismissSignInNotice } = useAuth()
  if (!user || !signInInfo || signInInfo.noticeDismissed) return null

  const failed = Number(signInInfo.failedAttemptsSince) || 0
  const isDentist = user.role === 'dentist'
  if (!signInInfo.lastSignInAt && failed === 0) return null // unang login, walang maibabalita

  const warn = failed > 0
  return (
    <div
      role={warn ? 'alert' : 'status'}
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-base ${
        warn ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700 shadow-sm'
      }`}
    >
      {warn ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <History className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        {signInInfo.lastSignInAt && (
          <p>
            Last sign-in: <span className="font-medium">{formatActivityTime(signInInfo.lastSignInAt)}</span>
            {isDentist && signInInfo.lastSignInIp && (
              <span className={warn ? 'text-amber-800' : 'text-slate-500'}> from {signInInfo.lastSignInIp}</span>
            )}
          </p>
        )}
        {warn && (
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
        )}
      </div>
      <button
        type="button"
        onClick={dismissSignInNotice}
        aria-label="Dismiss sign-in notice"
        className={`-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors ${
          warn ? 'text-amber-700 hover:bg-amber-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
