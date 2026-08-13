import { useState } from 'react'
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react'
import Modal from '../common/Modal'
import { createPortalAccount } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import { generatePassword } from '../../utils/generatePassword'

export default function CreatePortalAccountModal({ patient, onClose, onCreated }) {
  const { showToast } = useToast()
  const fullName = `${patient.first_name} ${patient.last_name}`
  const [email, setEmail] = useState(patient.email || '')
  const [password, setPassword] = useState(() => generatePassword())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const created = await createPortalAccount(patient.id, { email, password })
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

  function handleCopy() {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (account) {
    return (
      <Modal title="Portal Account Created" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-800">
            <p className="font-semibold">{fullName} can now log in to DentaVault.</p>
            <p className="mt-1">
              Share these credentials with the patient — this password is only shown once.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base">
            <div>
              <span className="text-slate-500">Email: </span>
              {email}
            </div>
            <div>
              <span className="text-slate-500">Password: </span>
              {password}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Credentials'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Create Portal Account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-800">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            This lets <span className="font-semibold">{fullName}</span> log in and view their own
            records (treatment history, dental chart, X-rays) — read-only, and only their own.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-base font-medium text-slate-700">Login Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-base font-medium text-slate-700">
            Temporary Password
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 font-mono text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              title="Generate a new password"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

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
            className="min-h-11 flex-1 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
