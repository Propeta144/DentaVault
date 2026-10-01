import { useId, useState } from 'react'
import { Download, Upload, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import Modal from '../common/Modal'
import { importPatientsFile, downloadImportTemplate } from '../../services/patientImport'
import { useToast } from '../../context/ToastContext'
import { PROCEDURES } from '../../constants/dental'

export default function ImportPatientsModal({ onClose, onImported }) {
  const { showToast } = useToast()
  const fileInputId = useId()
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Choose a CSV or JSON file first')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const data = await importPatientsFile(file)
      setResult(data)
      showToast(
        `Import complete: ${data.createdCount} added, ${data.treatmentsAddedCount} treatments added, ${data.duplicateCount} duplicates, ${data.errorCount} errors.`,
        { type: data.errorCount > 0 ? 'error' : 'success' },
      )
      if (data.createdCount > 0 || data.treatmentsAddedCount > 0) onImported()
    } catch (err) {
      const message = err.response?.data?.error || 'Import failed'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Import Legacy Patient Records" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-base text-slate-600">
          <p className="mb-2">
            Bulk-import existing paper or spreadsheet records as a one-time migration. Each new
            name+birthdate becomes a patient marked <span className="font-medium">Migrated Record</span>.
          </p>
          <p className="mb-2">
            To bring in treatment history too, add a row per past visit — repeat the same
            first/last name and birthdate, and fill in procedure/date/tooth for that row. Matching
            rows attach to the patient instead of creating a duplicate. See the template for an
            example.
          </p>
          <p>
            <span className="font-medium">procedure_name</span> must match one of:{' '}
            {PROCEDURES.map((p) => p.value).join(', ')}.
          </p>
          <button
            type="button"
            onClick={downloadImportTemplate}
            className="flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
              {error}
            </div>
          )}

          <input
            id={fileInputId}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => setFile(e.target.files[0])}
            className="sr-only"
          />
          <label
            htmlFor={fileInputId}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-base font-medium text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50"
          >
            <Upload className="h-5 w-5 text-slate-400" />
            {file ? file.name : 'Click to choose a CSV or JSON file'}
          </label>

          <button
            type="submit"
            disabled={submitting || !file}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Importing...' : 'Import'}
          </button>
        </form>

        {result && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div className="rounded-md bg-emerald-50 py-2">
                <div className="text-lg font-semibold text-emerald-700">{result.createdCount}</div>
                <div className="text-xs text-emerald-600">Added</div>
              </div>
              <div className="rounded-md bg-sky-50 py-2">
                <div className="text-lg font-semibold text-sky-700">{result.treatmentsAddedCount}</div>
                <div className="text-xs text-sky-600">Treatments added</div>
              </div>
              <div className="rounded-md bg-amber-50 py-2">
                <div className="text-lg font-semibold text-amber-700">{result.duplicateCount}</div>
                <div className="text-xs text-amber-600">Duplicates</div>
              </div>
              <div className="rounded-md bg-red-50 py-2">
                <div className="text-lg font-semibold text-red-700">{result.errorCount}</div>
                <div className="text-xs text-red-600">Errors</div>
              </div>
            </div>

            {result.treatmentsAdded.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-sky-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Treatment history added
                </h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  {result.treatmentsAdded.map((t) => (
                    <li key={t.row}>
                      Row {t.row}: {t.procedureName} for {t.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.duplicates.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Skipped as duplicates
                </h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  {result.duplicates.map((d) => (
                    <li key={d.row}>
                      Row {d.row}: {d.name} — already exists
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-red-700">
                  <XCircle className="h-3.5 w-3.5" />
                  Rows with errors
                </h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  {result.errors.map((e) => (
                    <li key={e.row}>
                      Row {e.row}: {e.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.created.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Added
                </h4>
                <ul className="space-y-1 text-sm text-slate-600">
                  {result.created.map((c) => (
                    <li key={c.row}>
                      Row {c.row}: {c.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
