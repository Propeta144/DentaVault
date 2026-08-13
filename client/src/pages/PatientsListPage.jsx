import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Pencil, Trash2, FileCheck2, FileUp, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listPatients, getPatient, exportPatientsCsv } from '../services/patients'
import EditPatientModal from '../components/patients/EditPatientModal'
import DeletePatientModal from '../components/patients/DeletePatientModal'
import ImportPatientsModal from '../components/patients/ImportPatientsModal'
import StatusBadge from '../components/common/StatusBadge'
import { useToast } from '../context/ToastContext'

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'date_added', label: 'Newest Registered' },
  { value: 'date_added_asc', label: 'Oldest Registered' },
  { value: 'last_visit', label: 'Last Visit' },
]

function formatLastVisit(dateStr) {
  return dateStr ? new Date(dateStr).toLocaleDateString() : 'No visits yet'
}

function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth)
  const diff = Date.now() - dob.getTime()
  return Math.abs(new Date(diff).getUTCFullYear() - 1970)
}

function PatientStatusBadge({ patient }) {
  return patient.is_legacy_migrated ? (
    <StatusBadge variant="amber" icon={FileCheck2}>
      Migrated Record
    </StatusBadge>
  ) : (
    <StatusBadge variant="emerald">Active</StatusBadge>
  )
}

function RowActions({ patient, loadingEditId, onEdit, onDelete, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onEdit(patient)}
        disabled={loadingEditId === patient.id}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-sky-700 disabled:opacity-50"
      >
        <Pencil className="h-4 w-4" />
        {loadingEditId === patient.id ? 'Loading...' : 'Edit'}
      </button>
      <button
        type="button"
        onClick={() => onDelete(patient)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  )
}

export default function PatientsListPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [data, setData] = useState({ patients: [], total: 0, page: 1, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingPatient, setEditingPatient] = useState(null)
  const [loadingEditId, setLoadingEditId] = useState(null)
  const [importing, setImporting] = useState(false)
  const [deletingPatient, setDeletingPatient] = useState(null)
  const [exporting, setExporting] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    listPatients({ search, sort })
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }, [search, sort])

  useEffect(() => {
    const timeout = setTimeout(reload, 300) // debounce so we don't fire a search request on every keystroke
    return () => clearTimeout(timeout)
  }, [reload])

  async function handleEditClick(row) {
    setLoadingEditId(row.id)
    try {
      const full = await getPatient(row.id)
      setEditingPatient(full)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load patient details.', { type: 'error' })
    } finally {
      setLoadingEditId(null)
    }
  }

  function handleSaved(updated) {
    setData((prev) => ({
      ...prev,
      patients: prev.patients.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    }))
  }

  function handleDeleted(deletedId) {
    setData((prev) => ({
      ...prev,
      patients: prev.patients.filter((p) => p.id !== deletedId),
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

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Patients</h1>
          <p className="text-base text-slate-500">Search, register, and manage patient records</p>
        </div>
        {user.role === 'dentist' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileUp className="h-4 w-4" />
              Import Legacy Records
            </button>
            <Link
              to="/patients/new"
              className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
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
            type="text"
            placeholder="Search by name or patient ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-base focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="min-h-11 rounded-md border border-slate-300 py-2.5 pl-3 pr-8 text-base text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="px-1 py-6 text-center text-sm text-slate-400">Loading...</p>}

      {!loading && data.patients.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">
          No patients found.
        </p>
      )}

      {!loading && data.patients.length > 0 && (
        <>
          {/* Card list: small screens only */}
          <div className="space-y-3 md:hidden">
            {data.patients.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/patients/${p.id}`}
                    className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                  >
                    {p.last_name}, {p.first_name}
                  </Link>
                  <PatientStatusBadge patient={p} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-500">
                  <div>
                    <dt className="inline">Age/Gender: </dt>
                    <dd className="inline capitalize text-slate-700">
                      {calculateAge(p.date_of_birth)} / {p.sex}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Contact: </dt>
                    <dd className="inline text-slate-700">{p.contact_number || '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Registered: </dt>
                    <dd className="inline text-slate-700">
                      {new Date(p.created_at).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Last visit: </dt>
                    <dd className="inline text-slate-700">{formatLastVisit(p.last_treatment_date)}</dd>
                  </div>
                </dl>
                {user.role === 'dentist' && (
                  <RowActions
                    patient={p}
                    loadingEditId={loadingEditId}
                    onEdit={handleEditClick}
                    onDelete={setDeletingPatient}
                    className="mt-3 justify-end border-t border-slate-100 pt-2"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Table: md and up */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Age / Gender</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Last Visit</th>
                  {user.role === 'dentist' && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/patients/${p.id}`}
                        className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
                      >
                        {p.last_name}, {p.first_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {calculateAge(p.date_of_birth)} / {p.sex}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.contact_number || '—'}</td>
                    <td className="px-4 py-3">
                      <PatientStatusBadge patient={p} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatLastVisit(p.last_treatment_date)}
                    </td>
                    {user.role === 'dentist' && (
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          patient={p}
                          loadingEditId={loadingEditId}
                          onEdit={handleEditClick}
                          onDelete={setDeletingPatient}
                          className="justify-end"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.total > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {data.total} patient{data.total === 1 ? '' : 's'} total
        </p>
      )}

      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={handleSaved}
        />
      )}

      {importing && (
        <ImportPatientsModal onClose={() => setImporting(false)} onImported={reload} />
      )}

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
