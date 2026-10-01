import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { listPatients } from '../../services/patients'
import { PROFILE_PATH, profileState } from '../../utils/selectedPatient'
import { listName, sexLabel } from '../../utils/patientName'
import { calculateAge, formatRelativeDay } from '../../utils/formatDate'
import Avatar from './Avatar'

// Mabilisang paghahanap ng patient mula sa KAHIT ANONG page (button sa
// sidebar, o Ctrl+K / ⌘K). Dati: kailangang pumunta muna sa Patients page,
// mag-type, at saka i-click. Habang may pasyente sa upuan, mahalaga ang
// bilis ng paglipat sa tamang record.
//
// Walang na-type → "Recently seen" (pinakabagong treatment). Keyboard:
// ↑/↓ para pumili, Enter para buksan, Escape para isara.
export default function PatientSearchPalette({ onClose }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      const trimmed = query.trim()
      listPatients(trimmed ? { search: trimmed, sort: 'name', limit: 8 } : { sort: 'last_visit', limit: 6 })
        .then((data) => {
          if (cancelled) return
          setResults(data.patients)
          setError('')
          setActive(0)
        })
        .catch((err) => !cancelled && setError(err.response?.data?.error || 'Search failed'))
        .finally(() => !cancelled && setLoading(false))
    }, 250) // debounce, parehong dahilan ng search sa PatientsListPage
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query])

  function open(patient) {
    onClose()
    navigate(PROFILE_PATH, { state: profileState(patient.patient_code) })
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      open(results[active])
    }
  }

  const heading = query.trim() ? 'Patients' : 'Recently seen'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-3 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a patient"
        className="w-full max-w-lg animate-[modal-in_150ms_ease-out] overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search patients by name..."
            aria-label="Search patients by name"
            aria-controls="patient-search-results"
            aria-activedescendant={results[active] ? `patient-search-${results[active].patient_code}` : undefined}
            className="min-h-14 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-400 sm:block">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
          {error && <p className="px-2 py-4 text-sm text-red-600">{error}</p>}
          {!error && !loading && results.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-slate-400">
              {query.trim() ? `No patients match "${query.trim()}".` : 'No patients yet.'}
            </p>
          )}
          <ul id="patient-search-results" role="listbox" aria-label={heading}>
            {results.map((p, i) => (
              <li
                key={p.patient_code}
                id={`patient-search-${p.patient_code}`}
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  onClick={() => open(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                    i === active ? 'bg-sky-50' : ''
                  }`}
                >
                  <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-slate-900">{listName(p)}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {calculateAge(p.date_of_birth)} yrs · {sexLabel(p.sex)} · Last visit:{' '}
                      {formatRelativeDay(p.last_treatment_date, 'none yet').toLowerCase()}
                    </span>
                  </span>
                  {i === active && <CornerDownLeft className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
