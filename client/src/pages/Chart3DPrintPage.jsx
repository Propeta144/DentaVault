import { useCallback, useEffect, useState } from 'react'
import { usePrintState } from '../utils/selectedPatient'
import { getPatient } from '../services/patients'
import { getCurrentChart } from '../services/chart'
import Chart3DSnapshots from '../components/chart/Chart3DSnapshots'
import PageLoader from '../components/common/PageLoader'
import PrintHeader from '../components/common/PrintHeader'
import ChartFindings, { ColorDot } from '../components/chart/ChartFindings'
import { CONDITIONS } from '../constants/dental'
import { formatDate, formatDateTime } from '../utils/formatDate'

// 3D na bersyon ng Print Chart (Feature #22). Galing sa paper: "Print the
// graphical dental chart (2D or 3D view)". Ang 3D model ay kinukunan ng
// larawan mula sa 5 anggulo (Chart3DSnapshots), at may listahan ng findings
// sa ilalim, dahil mahirap basahin ang eksaktong surface sa larawan lang.

function Snapshot({ shot, className = '' }) {
  return (
    <figure className={`break-inside-avoid ${className}`}>
      <img src={shot.src} alt={`3D dental chart, ${shot.title}`} className="w-full rounded-md border border-slate-200" />
      <figcaption className="mt-1 text-center text-xs font-medium text-slate-600">{shot.title}</figcaption>
    </figure>
  )
}

export default function Chart3DPrintPage() {
  const id = usePrintState()?.patientCode
  const [patient, setPatient] = useState(null)
  const [entries, setEntries] = useState(null)
  const [shots, setShots] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([getPatient(id), getCurrentChart(id)])
      .then(([p, e]) => {
        setPatient(p)
        setEntries(e)
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load patient'))
  }, [id])

  const handleSnapshotError = useCallback(() => {
    setError("Couldn't draw the 3D chart on this device. Try the 2D Print Chart instead.")
  }, [])

  if (!id) return <p className="p-6 text-slate-500">Open this page from the patient profile's Print button.</p>
  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!patient || !entries) return <PageLoader fullScreen />

  const byKey = Object.fromEntries((shots || []).map((s) => [s.key, s]))

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-slate-500">Print preview</span>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!shots}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {shots ? 'Print' : 'Preparing...'}
        </button>
      </div>

      <PrintHeader title="Dental Chart (3D)" />

      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-sm">
        <div>
          <strong>Name:</strong> {patient.last_name}, {patient.first_name}
        </div>
        <div>
          <strong>Sex:</strong> <span className="capitalize">{patient.sex}</span>
        </div>
        <div>
          <strong>Date of Birth:</strong> {formatDate(patient.date_of_birth)}
        </div>
      </div>

      {!shots ? (
        <>
          <PageLoader label="Preparing 3D views..." />
          <Chart3DSnapshots entries={entries} onDone={setShots} onError={handleSnapshotError} />
        </>
      ) : (
        <div className="space-y-4">
          <Snapshot shot={byKey.front} />
          <div className="grid grid-cols-2 gap-4">
            <Snapshot shot={byKey.upper} />
            <Snapshot shot={byKey.lower} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Snapshot shot={byKey.right} />
            <Snapshot shot={byKey.left} />
          </div>
          <p className="text-xs text-slate-500">
            Front, upper, and lower views: the patient&apos;s right is on the left side of the picture (as seen when
            facing the patient).
          </p>
        </div>
      )}

      <div className="mt-6 break-inside-avoid">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Legend</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {CONDITIONS.map((c) => (
            <div key={c.code} className="flex items-center gap-1.5 text-sm text-slate-700">
              <ColorDot color={c.color} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <ChartFindings entries={entries} />

      <p className="mt-8 text-xs text-slate-400">
        Generated {formatDateTime(new Date())} — DentaVault
      </p>
    </div>
  )
}
