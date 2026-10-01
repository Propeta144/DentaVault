import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react'
import logoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

// Dalawang paraan papunta rito:
// 1. SAPILITAN: temporary password pa ang gamit (ginawa/ni-reset ng dentist,
//    kaya alam niya). Hindi makakapunta sa ibang page hangga't hindi
//    napapalitan (ProtectedRoute + 403 sa server). Walang Cancel; may
//    "Sign out" lang.
// 2. KUSA: "Change password" sa account menu — may Cancel.
function PasswordInput({ label, value, onChange, error, autoComplete, describedBy }) {
  const id = useId()
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={72}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error && `${id}-error`, describedBy].filter(Boolean).join(' ') || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-md border py-2.5 pl-3 pr-12 text-base text-slate-900 focus:outline-none focus:ring-2 ${
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
          }`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-700"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const rulesId = useId()
  const forced = Boolean(user?.mustChangePassword)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const found = {}
    if (!current) found.current = forced ? 'Enter the temporary password from the clinic' : 'Enter your current password'
    if (next.length < 8) found.next = 'Use at least 8 characters'
    else if (next === current) found.next = 'Choose a password different from the current one'
    if (confirm !== next) found.confirm = 'The two new passwords don’t match'
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      await changePassword(current, next)
      showToast('Password changed.', { type: 'success' })
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <img src={logoUrl} alt="Teodosio-Rufin Dental Clinic" className="mx-auto mb-6 h-auto w-full max-w-[14rem]" />

        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <KeyRound className="h-6 w-6 text-sky-600" />
          {forced ? 'Set your own password' : 'Change password'}
        </h1>
        <p className="mb-6 mt-1 text-base text-slate-500">
          {forced
            ? 'You signed in with a temporary password from the clinic. Choose a new password only you know before continuing.'
            : `Signed in as ${user?.email}.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <PasswordInput
            label={forced ? 'Temporary password' : 'Current password'}
            value={current}
            onChange={setCurrent}
            error={errors.current}
            autoComplete="current-password"
          />
          <PasswordInput
            label="New password"
            value={next}
            onChange={setNext}
            error={errors.next}
            autoComplete="new-password"
            describedBy={rulesId}
          />
          <p id={rulesId} className="-mt-2 text-sm text-slate-500">
            At least 8 characters. A short phrase you can remember works well.
          </p>
          <PasswordInput
            label="Confirm new password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
            autoComplete="new-password"
          />

          {serverError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
              {serverError}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {forced ? (
              <button
                type="button"
                onClick={logout}
                className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 flex-1 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
