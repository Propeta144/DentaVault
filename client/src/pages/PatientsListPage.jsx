import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  FileCheck2,
  FileUp,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listPatients, getPatient, exportPatientsCsv } from '../services/patients'
import EditPatientModal from '../components/patients/EditPatientModal'
import DeletePatientModal from '../components/patients/DeletePatientModal'
import ImportPatientsModal from '../components/patients/ImportPatientsModal'
import StatusBadge from '../components/common/StatusBadge'
import Avatar from '../components/common/Avatar'
import DropdownMenu from '../components/common/DropdownMenu'
import EmptyState from '../components/common/EmptyState'
import { SkeletonRows } from '../components/common/Skeleton'
import { useToast } from '../context/ToastContext'
import { listName, sexLabel } from '../utils/patientName'
import { calculateAge, formatDate, formatRelativeDay } from '../utils/formatDate'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'date_added', label: 'Newest Registered' },
  { value: 'date_added_asc', label: 'Oldest Registered' },
  { value: 'last_visit', label: 'Last Visit' },
]

// "Imported" (neutral) para sa galing sa legacy import. Dati "Migrated
// Record" (amber) vs "Active" (green), parang may problema o hindi active
// ang imported na patient, kahit pareho lang naman silang aktibong record.
function ImportedBadge({ patient }) {
  if (!patient.is_legacy_migrated) return null
  return (
    <StatusBadge variant="slate" icon={FileCheck2}>
      Imported
    </StatusBadge>
  )
}

// "5 days ago" + eksaktong petsa sa tooltip
function LastVisit({ date }) {
  if (!date) return <span className="text-slate-400">No visits yet</span>
  return (
    <time dateTime={date} title={formatDate(date)}>
      {formatRelativeDay(date)}
    </time>
  )
}

export default function PatientsListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ patients: [], total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingPatient, setEditingPatient] = useState(null)
  const [importing, setImporting] = useState(false)
  const [deletingPatient, setDeletingPatient] = useState(null)
  const [exporting, setExporting] = useState(false)
  const isDentist = user.role === 'dentist'

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    listPatients({ search, sort, page, limit: PAGE_SIZE })
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }, [search, sort, page])

  useEffect(() => {
    const timeout = setTimeout(reload, 300) // debounce so we don't fire a search request on every keystroke
    return () => clearTimeout(timeout)
  }, [reload])

  function openProfile(patient) {
    navigate(PROFILE_PATH, { state: profileState(patient.patient_code) })
  }

  // Buong record ang kailangan ng Edit modal (address, medical history,
  // atbp.), hindi lang ang nasa listahan.
  async function handleEditClick(row) {
    try {
      const full = await getPatient(row.patient_code)
      setEditingPatient(full)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load patient details.', { type: 'error' })
    }
  }

  function handleSaved(updated) {
    setData((prev) => ({
      ...prev,
      patients: prev.patients.map((p) => (p.patient_code === updated.patient_code ? { ...p, ...updated } : p)),
    }))
  }

  function handleDeleted(deletedCode) {
    setData((prev) => ({
      ...prev,
      patients: prev.patients.filter((p) => p.patient_code !== deletedCode),
      total: prev.total - 1,
    }))
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportPatientsCsv({ search })
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to export patients.', { type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const rowActions = (p) => [
    { label: 'Edit details', icon: Pencil, onClick: () => handleEditClick(p) },
    { label: 'Delete patient', icon: Trash2, danger: true, onClick: () => setDeletingPatient(p) },
  ]

  const hasSearch = Boolean(search.trim())

  return (
    <div>
      {/* lg pataas lang magkatabi ang title at mga button; sa tablet, hiwalay
          na hanay ang mga button (dati nahahati ang "Export / CSV"). */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Users className="h-6 w-6 text-sky-600" />
            Patients
          </h1>
          <p className="text-base text-slate-500">Search, register, and manage patient records</p>
        </div>
        {isDentist && (
          // Sa phone: Export at Import magkatabi (2 columns), Register sa ilalim
          // na buong lapad — dati tatlong full-width na button ang nakasalansan.
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex min-h-11 whitespace-nowrap items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex min-h-11 whitespace-nowrap items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileUp className="h-4 w-4" />
              <span className="sm:hidden">Import</span>
              <span className="hidden sm:inline">Import Records</span>
            </button>
            <Link
              to="/patients/new"
              className="col-span-2 flex min-h-11 whitespace-nowrap items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
            >
              <UserPlus className="h-4 w-4" />
              Register Patient
            </Link>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by name..."
            aria-label="Search patients by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={sort}
          aria-label="Sort patients"
          onChange={(e) => {
            setSort(e.target.value)
            setPage(1)
          }}
          className="min-h-11 rounded-md border border-slate-300 bg-white py-2.5 pl-3 pr-8 text-base text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
      )}

      {loading && <SkeletonRows rows={6} label="Loading patients..." />}

      {!loading && !error && data.patients.length === 0 && (
        <EmptyState
          icon={Users}
          title={hasSearch ? `No patients match "${search.trim()}"` : 'No patients yet'}
          description={
            hasSearch
              ? 'Check the spelling, or search by first or last name only.'
              : 'Register a patient, or import existing records from a CSV file.'
          }
          action={
            isDentist &&
            !hasSearch && (
              <Link
                to="/patients/new"
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
              >
                <UserPlus className="h-4 w-4" />
                Register Patient
              </Link>
            )
          }
        />
      )}

      {!loading && data.patients.length > 0 && (
        <>
          {/* Card list: small screens only. Buong card ang pipindutin para
              buksan ang profile; nasa ⋯ menu ang Edit/Delete. */}
          <ul className="space-y-3 md:hidden">
            {data.patients.map((p) => (
              // Click kahit saan sa card = buksan. Para sa keyboard/screen
              // reader, ang pangalan ang totoong link (walang interactive
              // element na nakapaloob sa isa pang interactive element).
              <li
                key={p.patient_code}
                onClick={() => openProfile(p)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-200"
              >
                <div className="flex items-start gap-3">
                  <Avatar firstName={p.first_name} lastName={p.last_name} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={PROFILE_PATH}
                      state={profileState(p.patient_code)}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-base font-semibold text-slate-900 hover:text-sky-700"
                    >
                      {listName(p)}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {calculateAge(p.date_of_birth)} yrs · {sexLabel(p.sex)}
                    </p>
                    <div className="mt-1">
                      <ImportedBadge patient={p} />
                    </div>
                  </div>
                  {isDentist && <DropdownMenu label={`Actions for ${listName(p)}`} items={rowActions(p)} />}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Contact</dt>
                    <dd className="text-slate-700">{p.contact_number || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Last visit</dt>
                    <dd className="text-slate-700">
                      <LastVisit date={p.last_treatment_date} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Table: md and up. Buong row ang clickable (dati pangalan lang);
              ang pangalan pa rin ang totoong link para sa keyboard. */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Name</th>
                  <th className="whitespace-nowrap px-4 py-3">Age / Sex</th>
                  <th className="whitespace-nowrap px-4 py-3">Contact</th>
                  <th className="whitespace-nowrap px-4 py-3">Last Visit</th>
                  <th className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">Registered</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.patients.map((p) => (
                  <tr
                    key={p.patient_code}
                    onClick={() => openProfile(p)}
                    className="group cursor-pointer transition-colors hover:bg-sky-50/60 focus-within:bg-sky-50/60"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
                        <div>
                          {/* Totoong link pa rin (para sa screen reader / middle-click) */}
                          <Link
                            to={PROFILE_PATH}
                            state={profileState(p.patient_code)}
                            onClick={(e) => e.stopPropagation()}
                            className="whitespace-nowrap font-medium text-slate-900 group-hover:text-sky-700"
                          >
                            {listName(p)}
                          </Link>
                          <div>
                            <ImportedBadge patient={p} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {calculateAge(p.date_of_birth)} / {sexLabel(p.sex)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{p.contact_number || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      <LastVisit date={p.last_treatment_date} />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-slate-600 lg:table-cell">{formatDate(p.created_at)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end">
                        {isDentist && <DropdownMenu label={`Actions for ${listName(p)}`} items={rowActions(p)} />}
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-sky-600" aria-hidden="true" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.total > 0 && !loading && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <p>
            {data.total} patient{data.total === 1 ? '' : 's'}
            {data.totalPages > 1 && ` — page ${data.page} of ${data.totalPages}`}
          </p>
          {/* Dati walang pagination: 20 lang ang lumalabas kahit marami pa */}
          {data.totalPages > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="flex min-h-11 items-center gap-1 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {editingPatient && (
        <EditPatientModal patient={editingPatient} onClose={() => setEditingPatient(null)} onSaved={handleSaved} />
      )}

      {importing && <ImportPatientsModal onClose={() => setImporting(false)} onImported={reload} />}

      {deletingPatient && (
        <DeletePatientModal
          patient={deletingPatient}
          onClose={() => setDeletingPatient(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
