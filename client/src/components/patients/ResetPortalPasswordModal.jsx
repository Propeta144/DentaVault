import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import Modal from '../common/Modal'
import { resetPortalAccountPassword } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import { generatePassword } from '../../utils/generatePassword'
import { PortalCredentials, TemporaryPasswordField } from './PortalCredentials'

export default function ResetPortalPasswordModal({ patient, email, onClose }) {
  const { showToast } = useToast()
  const fullName = `${patient.first_name} ${patient.last_name}`
  const [password, setPassword] = useState(() => generatePassword())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters')
      return
    }
    setPasswordError('')
    setSubmitting(true)
    try {
      await resetPortalAccountPassword(patient.patient_code, { password })
      setDone(true)
      showToast('Portal password reset.', { type: 'success' })
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to reset password'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Modal title="Password Reset" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-800">
            <p className="font-semibold">{fullName}&apos;s portal password has been reset.</p>
            <p className="mt-1">
              Share the new password with the patient. It&apos;s only shown once, and their old password no longer works.
            </p>
          </div>
          <PortalCredentials fullName={fullName} email={email} password={password} onDone={onClose} />
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Reset Portal Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-800">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            This sets a new temporary password for <span className="font-semibold">{fullName}</span>&apos;s portal account
            ({email}). Their old password stops working immediately. Use this if they forgot it.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        <TemporaryPasswordField
          label="New Temporary Password"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setPasswordError('')
          }}
          error={passwordError}
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
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
