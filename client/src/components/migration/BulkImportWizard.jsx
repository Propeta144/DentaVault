import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Download, Check, ArrowLeft, ArrowRight, FileSpreadsheet, RotateCcw, Users } from 'lucide-react'
import { previewImportFile, importPatientsFile, downloadImportTemplate } from '../../services/patientImport'
import { useToast } from '../../context/ToastContext'
import { PROCEDURES } from '../../constants/dental'
import { ImportCounts, ImportDetails } from './ImportResultLists'

// Bulk Import (Legacy Record Migration), 5 hakbang gaya ng wireframe:
// 1 Upload → 2 Map Columns → 3 Validate → 4 Preview & Confirm → 5 Complete.
//
// Dati: isang modal na diretso nang nag-iimport, at kailangang eksaktong
// "first_name", "date_of_birth"... ang header ng CSV. Ngayon:
// - Map Columns: ina-auto-match ng server ang karaniwang header ("First
//   Name", "Birthdate", "Gender"...), at puwedeng palitan ng dentist.
// - Validate at Preview: dry run sa server (walang isinusulat), kaya kita
//   muna ang mga mali at kung sino ang madadagdag BAGO mag-import.
const STEPS = ['Upload File', 'Map Columns', 'Validate Data', 'Preview & Confirm', 'Import Complete']

const FIELD_LABELS = {
  first_name: 'First name',
  last_name: 'Last name',
  sex: 'Sex',
  date_of_birth: 'Date of birth',
  contact_number: 'Contact number',
  email: 'Email',
  address: 'Address',
  medical_history: 'Medical history',
  allergies: 'Allergies',
  emergency_contact_name: 'Emergency contact name',
  emergency_contact_phone: 'Emergency contact phone',
  procedure_name: 'Procedure',
  treatment_date: 'Treatment date',
  tooth_number: 'Tooth number',
  treatment_notes: 'Treatment notes',
}
const TREATMENT_FIELDS = ['procedure_name', 'treatment_date', 'tooth_number', 'treatment_notes']

function Stepper({ step }) {
  return (
    <>
      {/* Phone: maikli */}
      <p className="mb-4 text-sm font-medium text-slate-500 md:hidden">
        Step {step + 1} of {STEPS.length} · <span className="text-sky-700">{STEPS[step]}</span>
      </p>
      {/* md pataas: 5 pantay na column (bilog sa itaas, label sa ilalim) —
          kasya pati sa tablet at sa laptop na may sidebar */}
      <ol className="mb-6 hidden grid-cols-5 md:grid" aria-label="Import steps">
        {STEPS.map((label, i) => {
          const done = i < step
          const current = i === step
          return (
            <li
              key={label}
              className="relative flex flex-col items-center px-1 text-center"
              aria-current={current ? 'step' : undefined}
            >
              {i > 0 && (
                <span
                  className={`absolute right-1/2 top-[18px] h-0.5 w-full -translate-y-1/2 ${
                    i <= step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                  done ? 'bg-emerald-600 text-white' : current ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="mt-1 block text-xs text-slate-400">Step {i + 1}</span>
              <span
                className={`block text-sm font-medium leading-tight ${
                  done ? 'text-emerald-700' : current ? 'text-sky-700' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

const primaryBtn =
  'flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryBtn =
  'flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50'

export default function BulkImportWizard() {
  const { showToast } = useToast()
  const fileInputId = useId()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [mapping, setMapping] = useState({})
  const [check, setCheck] = useState(null) // dry-run result
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(chosen) {
    if (!chosen) return
    setError('')
    setFile(chosen)
    setBusy(true)
    try {
      const data = await previewImportFile(chosen)
      setPreview(data)
      setMapping(data.suggestedMapping)
      setStep(1)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  async function runCheck() {
    setError('')
    setBusy(true)
    try {
      const data = await importPatientsFile(file, { mapping, dryRun: true })
      setCheck(data)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not check the file')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    setError('')
    setBusy(true)
    try {
      const data = await importPatientsFile(file, { mapping })
      setResult(data)
      setStep(4)
      showToast(`Import complete: ${data.createdCount} patients and ${data.treatmentsAddedCount} treatments added.`, {
        type: 'success',
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStep(0)
    setFile(null)
    setPreview(null)
    setMapping({})
    setCheck(null)
    setResult(null)
    setError('')
  }

  const missingRequired = preview ? preview.requiredFields.filter((f) => !mapping[f]) : []
  const mappedColumns = preview ? preview.fields.filter((f) => mapping[f]) : []
  const willAdd = check ? check.createdCount + check.treatmentsAddedCount : 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Bulk Import Workflow</h2>
      <Stepper step={step} />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* 1. Upload */}
      {step === 0 && (
        <div className="space-y-4">
          <input
            id={fileInputId}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => handleFile(e.target.files[0])}
            className="sr-only"
          />
          <label
            htmlFor={fileInputId}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFile(e.dataTransfer.files[0])
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center transition-colors hover:border-sky-400 hover:bg-sky-50"
          >
            <Upload className="h-7 w-7 text-slate-400" />
            <span className="text-base font-medium text-slate-700">
              {busy ? 'Reading file...' : 'Choose a CSV file or drag it here'}
            </span>
            <span className="text-sm text-slate-500">
              From Excel: File → Save As → <span className="font-medium">CSV (Comma delimited)</span>. Column names can be
              anything; you will match them in the next step.
            </span>
          </label>
          <button
            type="button"
            onClick={downloadImportTemplate}
            className="flex min-h-11 items-center gap-1.5 text-base font-medium text-sky-700 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download a sample template
          </button>
        </div>
      )}

      {/* 2. Map Columns */}
      {step === 1 && preview && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base text-slate-600">
              Tell DentaVault which column in your file holds each detail. Fields marked{' '}
              <span className="text-red-600">*</span> are required.
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
              <FileSpreadsheet className="h-4 w-4" />
              {file?.name} · {preview.totalRows} rows
            </span>
          </div>

          {[
            { title: 'Patient details', fields: preview.fields.filter((f) => !TREATMENT_FIELDS.includes(f)) },
            { title: 'Treatment history (optional, one row per past visit)', fields: TREATMENT_FIELDS },
          ].map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.fields.map((field) => {
                  const required = preview.requiredFields.includes(field)
                  const id = `${fileInputId}-${field}`
                  return (
                    <div key={field}>
                      <label htmlFor={id} className="mb-1 block text-base font-medium text-slate-700">
                        {FIELD_LABELS[field]}
                        {required && <span className="ml-0.5 text-red-600">*</span>}
                      </label>
                      <select
                        id={id}
                        value={mapping[field] || ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                        className={`w-full rounded-md border bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 ${
                          required && !mapping[field]
                            ? 'border-red-300 focus:ring-red-200'
                            : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
                        }`}
                      >
                        <option value="">— Not in this file —</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}

          {mapping.procedure_name && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Procedure values must be one of: {PROCEDURES.map((p) => p.value).join(', ')}.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Preview ({Math.min(5, preview.totalRows)} of {preview.totalRows} rows)
            </h3>
            {mappedColumns.length === 0 ? (
              <p className="text-sm text-slate-500">Match at least one column to see a preview.</p>
            ) : (
              <div data-scroll-ok className="overflow-x-auto rounded-lg border border-slate-200">
                {/* Sinadyang naso-scroll pakanan: preview ng spreadsheet (hanggang 15 column) */}
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {mappedColumns.map((f) => (
                        <th key={f} className="whitespace-nowrap px-3 py-2">
                          {FIELD_LABELS[f]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.sampleRows.map((row, i) => (
                      <tr key={i}>
                        {mappedColumns.map((f) => (
                          <td key={f} className="max-w-48 truncate whitespace-nowrap px-3 py-2 text-slate-700">
                            {row[mapping[f]] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={reset} className={secondaryBtn}>
              <ArrowLeft className="h-4 w-4" />
              Choose another file
            </button>
            <button type="button" onClick={runCheck} disabled={busy || missingRequired.length > 0} className={primaryBtn}>
              {busy ? 'Checking...' : 'Check the data'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {missingRequired.length > 0 && (
            <p className="text-right text-sm text-red-600">
              Choose a column for: {missingRequired.map((f) => FIELD_LABELS[f]).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* 3. Validate */}
      {step === 2 && check && (
        <div className="space-y-5">
          <p className="text-base text-slate-600">
            Nothing has been saved yet. Here is what DentaVault found in {check.totalRows} rows:
          </p>
          <ImportCounts result={check} dryRun />
          {check.errorCount > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-base text-amber-800">
              {check.errorCount} row{check.errorCount === 1 ? ' has' : 's have'} problems and will be skipped. You can
              fix them in the file and upload again, or continue without them.
            </div>
          ) : (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-base text-emerald-800">
              No problems found.
            </div>
          )}
          <ImportDetails result={check} dryRun show={['errors', 'duplicates']} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(1)} className={secondaryBtn}>
              <ArrowLeft className="h-4 w-4" />
              Back to columns
            </button>
            <button type="button" onClick={() => setStep(3)} disabled={willAdd === 0} className={primaryBtn}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {willAdd === 0 && (
            <p className="text-right text-sm text-slate-500">There is nothing new to import from this file.</p>
          )}
        </div>
      )}

      {/* 4. Preview & Confirm */}
      {step === 3 && check && (
        <div className="space-y-5">
          <p className="text-base text-slate-600">
            Review who will be added. Imported patients are marked <span className="font-medium">Imported</span> on
            their record.
          </p>
          <ImportDetails result={check} dryRun show={['created', 'treatments']} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(2)} className={secondaryBtn} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="button" onClick={runImport} disabled={busy} className={primaryBtn}>
              {busy
                ? 'Importing...'
                : `Import ${check.createdCount} patient${check.createdCount === 1 ? '' : 's'}${
                    check.treatmentsAddedCount ? ` and ${check.treatmentsAddedCount} treatments` : ''
                  }`}
            </button>
          </div>
        </div>
      )}

      {/* 5. Complete */}
      {step === 4 && result && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-base text-emerald-900">
              Import complete. The records are now searchable under Patients.
            </p>
          </div>
          <ImportCounts result={result} />
          <ImportDetails result={result} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={reset} className={secondaryBtn}>
              <RotateCcw className="h-4 w-4" />
              Import another file
            </button>
            <Link to="/patients" className={primaryBtn}>
              <Users className="h-4 w-4" />
              View patients
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
