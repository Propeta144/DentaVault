import { useId, useState } from 'react'
import { Upload, ScanLine } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

export default function UploadXrayForm({ onUpload }) {
  const { showToast } = useToast()
  const fileInputId = useId()
  const [file, setFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [takenDate, setTakenDate] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Choose a file first')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onUpload({ file, notes, takenDate })
      showToast('X-ray uploaded successfully.', { type: 'success' })
      setFile(null)
      setNotes('')
      setTakenDate('')
      e.target.reset()
    } catch (err) {
      const message = err.response?.data?.error || 'Upload failed'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2.5 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
        <ScanLine className="h-4 w-4 text-sky-600" />
        Upload X-ray
      </h3>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {error}
        </div>
      )}

      <div>
        <input
          id={fileInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="sr-only"
        />
        <label
          htmlFor={fileInputId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-base font-medium text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50"
        >
          <Upload className="h-5 w-5 text-slate-400" />
          {file ? 'Choose a different file' : 'Click to choose an X-ray file'}
        </label>
        {file && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {file.name} ({(file.size / 1024).toFixed(0)} KB)
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Date taken (optional)</label>
          <input
            type="date"
            className={inputClass}
            value={takenDate}
            onChange={(e) => setTakenDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Notes (optional)</label>
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !file}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {submitting ? 'Uploading...' : 'Upload X-ray'}
      </button>
    </form>
  )
}
