import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'
import AuthBrandPanel from '../components/common/AuthBrandPanel'
import logoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { useAuth } from '../context/AuthContext'
import { useSlowAfter, SERVER_WAKING_MESSAGE } from '../hooks/useSlowAfter'

// Split layout: sa kaliwa ang brand panel (desktop lang), sa kanan ang form
// na may official logo ng clinic (LOGOS/teodosio-rufin-logo.png). Sa phone,
// form at logo lang. Dati: maliit na card sa gitna ng blangkong screen.
// Habang nasa login page (nagta-type pa ng email/password), i-download na ang
// Dashboard page file para hindi na hintayin pagka-sign in (#42). Maliit na
// file ito; ang 3D chart at ibang mabibigat na page ay hindi kasama.
function preloadDashboardPage() {
  const load = () => import('./DashboardPage').catch(() => {})
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 })
  else setTimeout(load, 1000)
}

export default function LoginPage() {
  const { login, signOutReason } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const slow = useSlowAfter(submitting)

  useEffect(preloadDashboardPage, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      const redirectTo = location.state?.from || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 py-2.5 pl-10 pr-3 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100'

  return (
    <div className="flex min-h-screen bg-white">
      <AuthBrandPanel />

      {/* Form */}
      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Pabalik sa Welcome page ("/") */}
          <Link
            to="/"
            className="-ml-3 mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <img
            src={logoUrl}
            alt="Teodosio-Rufin Dental Clinic"
            className="mx-auto mb-8 h-auto w-full max-w-[18rem]"
          />

          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mb-6 text-base text-slate-500">Use the account provided by the clinic.</p>

          <form onSubmit={handleSubmit}>
            {/* Hindi ang user ang nag-sign out dito: pinutol ng server ang session
                (hal. na-reset ang password, nag-sign out, o nag-login sa ibang
                device, #39), o 15 minutong walang galaw (#33) */}
            {signOutReason && !error && (
              <div
                role="status"
                className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-base text-sky-800"
              >
                {signOutReason === 'idle' && 'You were signed out after 15 minutes of inactivity. Please sign in again.'}
                {signOutReason === 'elsewhere' &&
                  "Your account was signed in on another device, so you were signed out here. If that wasn't you, sign in and change your password."}
                {signOutReason !== 'idle' && signOutReason !== 'elsewhere' && 'Your session has ended. Please sign in again.'}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700"
              >
                {error}
              </div>
            )}

            <label htmlFor="login-email" className="mb-1 block text-base font-medium text-slate-700">
              Email
            </label>
            <div className="relative mb-4">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <label htmlFor="login-password" className="mb-1 block text-base font-medium text-slate-700">
              Password
            </label>
            <div className="relative mb-6">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
              />
              {/* Para makita ang tinype, lalo na sa tablet keyboard */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 w-full items-center justify-center rounded-md bg-sky-600 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
            {/* Natutulog na server (Render free): matagal ang unang login */}
            {slow && (
              <p role="status" className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600" aria-hidden="true" />
                {SERVER_WAKING_MESSAGE}
              </p>
            )}
          </form>

          {/* Dalawang magkaibang sitwasyon (dati iisang linya lang, kaya parang
              salungat sa "Change password" sa loob ng app):
              - Nakalimutan: walang self-service email reset (walang
                email-sending sa app), kaya ang clinic ang magbibigay ng temporary password — na papalitan
                agad ng pasyente sa pag-login (tignan ChangePasswordPage).
              - Alam pa pero gustong palitan: sa loob ng app mismo. */}
          <div className="mt-8 space-y-1 text-center text-sm text-slate-500">
            <p>
              <span className="font-medium text-slate-600">Forgot your password?</span> Contact the clinic for a
              temporary password. You&apos;ll set a new one right after you sign in.
            </p>
            <p className="text-slate-500">To change a password you know, sign in and open your account menu.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
