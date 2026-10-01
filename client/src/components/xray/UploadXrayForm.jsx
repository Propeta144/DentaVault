import { useEffect, useId, useState } from 'react'
import { Upload, ScanLine, FileText, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { FIELD_LIMITS, MAX_XRAY_FILE_BYTES } from '../../constants/fieldLimits'
import { todayISO } from '../../utils/formatDate'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

// Bago sa form na 'to:
// - Preview ng larawan bago i-upload (para matiyak na tamang file)
// - Drag-and-drop (mukhang drop zone na ang dashed box dati pero click lang
//   ang gumagana)
// - Check ng uri at laki ng file BAGO i-upload (dati sa server lang, at
//   "Internal server error" pa ang lumalabas kapag sobrang laki)
// - Naka-link ang mga label, text-base, at bawal ang future na "Date taken"
export default function UploadXrayForm({ onUpload }) {
  const { showToast } = useToast()
  const ids = { file: useId(), date: useId(), notes: useId() }
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [notes, setNotes] = useState('')
  const [takenDate, setTakenDate] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Object URL para sa preview; nililinis kapag napalitan/natanggal ang file
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pickFile(candidate) {
    setError('')
    if (!candidate) return
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setFile(null)
      setError('Only JPEG, PNG, WebP, or PDF files can be uploaded.')
      return
    }
    if (candidate.size > MAX_XRAY_FILE_BYTES) {
      setFile(null)
      setError(`That file is ${formatSize(candidate.size)}. The limit is ${formatSize(MAX_XRAY_FILE_BYTES)}.`)
      return
    }
    setFile(candidate)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Choose a file first')
      return
    }
    if (takenDate && takenDate > todayISO()) {
      setError('Date taken cannot be in the future')
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
      const message =
        err.response?.status === 413
          ? 'That file is too large to upload. Try a smaller or compressed image.'
          : err.response?.data?.error || 'Upload failed'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100'

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" noValidate>
      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
        <ScanLine className="h-4 w-4 text-sky-600" />
        Upload X-ray
      </h3>

      <div>
        <input
          id={ids.file}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => {
            pickFile(e.target.files[0])
            // I-reset para gumana ulit ang onChange kahit parehong file ang
            // piliin pagkatapos tanggalin (X) o pagkatapos ng error
            e.target.value = ''
          }}
          className="sr-only"
        />
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected X-ray preview" className="h-20 w-20 shrink-0 rounded-md bg-slate-900 object-contain" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-white text-slate-400">
                <FileText className="h-8 w-8" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-slate-800" title={file.name}>
                {file.name}
              </p>
              <p className="text-sm text-slate-500">{formatSize(file.size)}</p>
              <label htmlFor={ids.file} className="mt-1 inline-flex min-h-9 cursor-pointer items-center text-sm font-medium text-sky-700 hover:underline">
                Choose a different file
              </label>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove selected file"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <label
            htmlFor={ids.file}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pickFile(e.dataTransfer.files[0])
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50'
            }`}
          >
            <span className="flex items-center gap-2 text-base font-medium text-slate-700">
              <Upload className="h-5 w-5 text-slate-400" />
              Tap to choose, or drop an X-ray here
            </span>
            <span className="text-sm text-slate-500">JPEG, PNG, WebP, or PDF · up to {formatSize(MAX_XRAY_FILE_BYTES)}</span>
          </label>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.date} className="mb-1 block text-base font-medium text-slate-700">
            Date taken <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={ids.date}
            type="date"
            max={todayISO()}
            className={inputClass}
            value={takenDate}
            onChange={(e) => setTakenDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={ids.notes} className="mb-1 block text-base font-medium text-slate-700">
            Notes <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id={ids.notes}
            className={inputClass}
            maxLength={FIELD_LIMITS.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
