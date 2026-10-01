import { useId, useState } from 'react'
import { KeyRound } from 'lucide-react'
import Modal from '../common/Modal'
import { createPortalAccount } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import { generatePassword } from '../../utils/generatePassword'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { PortalCredentials, TemporaryPasswordField } from './PortalCredentials'

export default function CreatePortalAccountModal({ patient, onClose, onCreated }) {
  const { showToast } = useToast()
  const emailId = useId()
  const fullName = `${patient.first_name} ${patient.last_name}`
  const [email, setEmail] = useState(patient.email || '')
  const [password, setPassword] = useState(() => generatePassword())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [account, setAccount] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const next = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address'
    if (password.length < 8) next.password = 'Use at least 8 characters'
    setFieldErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    try {
      const created = await createPortalAccount(patient.patient_code, { email: email.trim(), password })
      setAccount(created)
      onCreated(created)
      showToast('Portal account created.', { type: 'success' })
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create portal account'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (account) {
    return (
      <Modal title="Portal Account Created" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-800">
            <p className="font-semibold">{fullName} can now log in to DentaVault.</p>
            <p className="mt-1">Share these credentials with the patient. This password is only shown once.</p>
          </div>
          <PortalCredentials fullName={fullName} email={account.email} password={password} onDone={onClose} />
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Create Portal Account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-800">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            This lets <span className="font-semibold">{fullName}</span> log in and view their own records (treatment
            history, dental chart, X-rays), read-only and only their own.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={emailId} className="mb-1 block text-base font-medium text-slate-700">
            Login Email
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            maxLength={FIELD_LIMITS.email}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setFieldErrors((p) => ({ ...p, email: undefined }))
            }}
            className={`w-full rounded-md border px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 ${
              fieldErrors.email ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
            }`}
          />
          {fieldErrors.email && (
            <p id={`${emailId}-error`} className="mt-1 text-sm text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <TemporaryPasswordField
          label="Temporary Password"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setFieldErrors((p) => ({ ...p, password: undefined }))
          }}
          error={fieldErrors.password}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 flex-1 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
