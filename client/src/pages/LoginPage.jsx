import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ClipboardList, ScanLine, ShieldCheck } from 'lucide-react'
import BrandMark from '../components/common/BrandMark'
import logoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { useAuth } from '../context/AuthContext'

const HIGHLIGHTS = [
  { icon: ClipboardList, text: 'Treatment history and dental charting in one record' },
  { icon: ScanLine, text: 'X-rays stored, annotated, and compared side by side' },
  { icon: ShieldCheck, text: 'Every access logged, as required by the Data Privacy Act' },
]

// Split layout: sa kaliwa ang brand panel (desktop lang), sa kanan ang form
// na may official logo ng clinic (LOGOS/teodosio-rufin-logo.png). Sa phone,
// form at logo lang. Dati: maliit na card sa gitna ng blangkong screen.
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      {/* Brand panel: lg pataas lang */}
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
        {/* Malaking mark sa likod, dekorasyon lang */}
        <BrandMark className="pointer-events-none absolute -right-24 -bottom-24 h-[28rem] w-[28rem] text-sky-600/25" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10 text-sky-300" />
          <div>
            <p className="text-lg font-semibold leading-tight">DentaVault</p>
            <p className="text-sm text-slate-400">Teodosio-Rufin Dental Clinic</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">
            Patient records,
            <br />
            charts, and X-rays
            <br />
            <span className="text-sky-300">in one secure place.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-base text-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sky-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-slate-500">
          For clinic staff and registered patients only.
        </p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <img
            src={logoUrl}
            alt="Teodosio-Rufin Dental Clinic"
            className="mx-auto mb-8 h-auto w-full max-w-[18rem]"
          />

          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mb-6 text-base text-slate-500">Use the account provided by the clinic.</p>

          <form onSubmit={handleSubmit}>
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
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700"
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
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Forgot your password? Ask the clinic to reset it.
          </p>
        </div>
      </main>
    </div>
  )
}
