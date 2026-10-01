import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Trash2, UserPlus, Check, ArrowRight, RotateCcw, X } from 'lucide-react'
import { listPatients, addTreatmentsBatch } from '../../services/patients'
import { useToast } from '../../context/ToastContext'
import { PROCEDURES, FDI_TEETH, ALL_TEETH, isWholeMouthProcedure } from '../../constants/dental'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { PROFILE_PATH, profileState } from '../../utils/selectedPatient'
import { listName } from '../../utils/patientName'
import { calculateAge, formatDate, todayISO } from '../../utils/formatDate'
import Avatar from '../common/Avatar'

// Manual Entry (Legacy Record Migration): "guided manual entry for treatment
// histories" ayon sa proposal. Para sa mga lumang papel na record: pumili ng
// patient (o i-register muna), tapos i-encode ang LAHAT ng lumang visit sa
// iisang listahan at isang Save lang — hindi na isa-isang bubuksan ang Add
// Treatment para sa bawat visit. Sinusuri ng server ang buong listahan bago
// mag-save (kapag may mali, walang mase-save; sinasabi kung aling row).
const TOOTH_GROUPS = [
  { label: 'Upper Right', teeth: FDI_TEETH.filter((t) => t[0] === '1') },
  { label: 'Upper Left', teeth: FDI_TEETH.filter((t) => t[0] === '2') },
  { label: 'Lower Left', teeth: FDI_TEETH.filter((t) => t[0] === '3') },
  { label: 'Lower Right', teeth: FDI_TEETH.filter((t) => t[0] === '4') },
]

let nextKey = 1
const emptyRow = () => ({ key: nextKey++, treatmentDate: '', procedureName: '', toothNumber: '', notes: '' })

const inputClass = (hasError) =>
  `w-full rounded-md border bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
    hasError ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
  }`

function PatientPicker({ onPick }) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      listPatients({ search: trimmed, limit: 8 })
        .then((d) => !cancelled && setResults(d.patients))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  return (
    <div className="space-y-3">
      <label htmlFor={searchId} className="block text-base font-medium text-slate-700">
        Whose paper record is this?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name..."
          autoComplete="off"
          className={`${inputClass(false)} pl-9`}
        />
      </div>
      {query.trim() && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {loading && results.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Searching...</li>}
          {!loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">No patient with that name yet. Register them first.</li>
          )}
          {results.map((p) => (
            <li key={p.patient_code}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left hover:bg-sky-50"
              >
                <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{listName(p)}</span>
                  <span className="block text-sm text-slate-500">
                    {calculateAge(p.date_of_birth)} yrs · Born {formatDate(p.date_of_birth)}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-slate-500">
        Not in DentaVault yet?{' '}
        <Link to="/patients/new" className="inline-flex min-h-11 items-center gap-1 font-medium text-sky-700 hover:underline">
          <UserPlus className="h-4 w-4" />
          Register the patient first
        </Link>
        , then come back here.
      </p>
    </div>
  )
}

export default function LegacyTreatmentEntry() {
  const { showToast } = useToast()
  const baseId = useId()
  const [patient, setPatient] = useState(null)
  const [rows, setRows] = useState(() => [emptyRow()])
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null) // bilang ng na-save

  function updateRow(key, patch) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const next = { ...r, ...patch }
        if ('procedureName' in patch) {
          if (isWholeMouthProcedure(patch.procedureName)) next.toothNumber = ALL_TEETH
          else if (r.toothNumber === ALL_TEETH) next.toothNumber = ''
        }
        return next
      }),
    )
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate() {
    const next = {}
    const today = todayISO()
    for (const r of rows) {
      const e = {}
      if (!r.treatmentDate) e.treatmentDate = 'Enter the date'
      else if (r.treatmentDate > today) e.treatmentDate = 'Cannot be in the future'
      if (!r.procedureName) e.procedureName = 'Choose a procedure'
      if (!r.toothNumber) e.toothNumber = 'Choose a tooth'
      if (Object.keys(e).length) next[r.key] = e
    }
    return next
  }

  async function handleSave(e) {
    e.preventDefault()
    setServerError('')
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    try {
      const saved = await addTreatmentsBatch(
        patient.patient_code,
        rows.map(({ treatmentDate, procedureName, toothNumber, notes }) => ({
          treatmentDate,
          procedureName,
          toothNumber,
          notes,
        })),
      )
      setSaved(saved.length)
      showToast(`${saved.length} past treatment${saved.length === 1 ? '' : 's'} saved for ${listName(patient)}.`, {
        type: 'success',
      })
    } catch (err) {
      setServerError(err.response?.data?.error || 'Failed to save treatments')
    } finally {
      setSaving(false)
    }
  }

  function startOver() {
    setPatient(null)
    setRows([emptyRow()])
    setErrors({})
    setServerError('')
    setSaved(null)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Manual Entry</h2>
      <p className="mb-5 text-base text-slate-500">
        Encode past visits from a paper record. Add one row per visit, oldest or newest first.
      </p>

      {!patient && <PatientPicker onPick={setPatient} />}

      {patient && saved === null && (
        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Avatar firstName={patient.first_name} lastName={patient.last_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{listName(patient)}</p>
              <p className="text-sm text-slate-500">Born {formatDate(patient.date_of_birth)}</p>
            </div>
            <button
              type="button"
              onClick={() => setPatient(null)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-700"
            >
              <X className="h-4 w-4" />
              Change
            </button>
          </div>

          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700" role="alert">
              {serverError}
            </div>
          )}

          <ol className="space-y-3">
            {rows.map((r, i) => {
              const e = errors[r.key] || {}
              const id = (f) => `${baseId}-${r.key}-${f}`
              return (
                <li key={r.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-500">Visit {i + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                        aria-label={`Remove visit ${i + 1}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_minmax(0,1.4fr)_10rem_minmax(0,1fr)]">
                    <div>
                      <label htmlFor={id('date')} className="mb-1 block text-base font-medium text-slate-700">
                        Date<span className="ml-0.5 text-red-600">*</span>
                      </label>
                      <input
                        id={id('date')}
                        type="date"
                        max={todayISO()}
                        value={r.treatmentDate}
                        onChange={(ev) => updateRow(r.key, { treatmentDate: ev.target.value })}
                        className={inputClass(e.treatmentDate)}
                      />
                      {e.treatmentDate && <p className="mt-1 text-sm text-red-600">{e.treatmentDate}</p>}
                    </div>
                    <div>
                      <label htmlFor={id('proc')} className="mb-1 block text-base font-medium text-slate-700">
                        Procedure<span className="ml-0.5 text-red-600">*</span>
                      </label>
                      <select
                        id={id('proc')}
                        value={r.procedureName}
                        onChange={(ev) => updateRow(r.key, { procedureName: ev.target.value })}
                        className={inputClass(e.procedureName)}
                      >
                        <option value="">Choose...</option>
                        {PROCEDURES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.value}
                          </option>
                        ))}
                      </select>
                      {e.procedureName && <p className="mt-1 text-sm text-red-600">{e.procedureName}</p>}
                    </div>
                    <div>
                      <label htmlFor={id('tooth')} className="mb-1 block text-base font-medium text-slate-700">
                        Tooth<span className="ml-0.5 text-red-600">*</span>
                      </label>
                      <select
                        id={id('tooth')}
                        value={r.toothNumber}
                        disabled={isWholeMouthProcedure(r.procedureName)}
                        onChange={(ev) => updateRow(r.key, { toothNumber: ev.target.value })}
                        className={inputClass(e.toothNumber)}
                      >
                        <option value="">Choose...</option>
                        <option value={ALL_TEETH}>All teeth</option>
                        {TOOTH_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.teeth.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {e.toothNumber && <p className="mt-1 text-sm text-red-600">{e.toothNumber}</p>}
                    </div>
                    <div>
                      <label htmlFor={id('notes')} className="mb-1 block text-base font-medium text-slate-700">
                        Notes
                      </label>
                      <input
                        id={id('notes')}
                        type="text"
                        value={r.notes}
                        maxLength={FIELD_LIMITS.notes}
                        onChange={(ev) => updateRow(r.key, { notes: ev.target.value })}
                        placeholder="As written on the paper record"
                        className={inputClass(false)}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            disabled={rows.length >= 50}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-4 text-base font-medium text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add another visit
          </button>

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Saving...' : `Save ${rows.length} visit${rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      )}

      {patient && saved !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-5 w-5" />
            </span>
            <p className="text-base text-emerald-900">
              {saved} past treatment{saved === 1 ? '' : 's'} added to {listName(patient)}&apos;s history.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={startOver}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Encode another patient
            </button>
            <Link
              to={PROFILE_PATH}
              state={profileState(patient.patient_code)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Open patient record
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
