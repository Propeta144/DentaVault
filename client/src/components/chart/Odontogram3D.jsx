import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PenLine, Undo2, Save, X } from 'lucide-react'
import Tooth3D, { mostCommon, surfaceForUV } from './Tooth3D'
import Gingiva from './Gingiva'
import { ARCHES } from './archLayout'
import { TOOTH_PLACEMENTS as PLACEMENTS, SceneLights, groupChartEntries } from './chartScene'
import ChartEntryModal from './ChartEntryModal'
import { ODONTOGRAM_ROWS, CONDITIONS, conditionColor } from '../../constants/dental'
import { getCurrentChart, createChartEntry } from '../../services/chart'

// Same physical dental arch (upper + lower) as Odontogram2D, laid out in
// 3D, inheriting the same FDI ordering (and patient-orientation mirroring)
// ODONTOGRAM_ROWS already encodes for the 2D chart. Ang hugis ng arch,
// pwesto at hilig ng bawat ngipin ay nasa archLayout.js; ang gums ay
// Gingiva.jsx (sumusunod sa parehong arch).
const NO_STROKES = []
// Stable na "walang entry" — para hindi mag-recompute ang kulay-layer ng
// bawat ngipin sa bawat render (hal. habang nagdo-drawing)
const NO_CHART = {}

// This is the module React.lazy() loads for the 3D tab — kept as a
// standalone component (not split further) so the lazy import boundary in
// PatientProfilePage covers all of Three.js/R3F/drei in one chunk, per the
// proposal's "lazy loading for resource-intensive modules such as the 3D
// dental chart" requirement.
export default function Odontogram3D({ patientId, canEdit, onPendingChange }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // { toothNumber, surface }
  const [highlightedTooth, setHighlightedTooth] = useState(null)
  const [activeCondition, setActiveCondition] = useState('caries')
  // Pen starts off so the model is safe to orbit/inspect by default —
  // dragging across a tooth only paints once the dentist explicitly turns
  // drawing on, instead of every rotate-attempt risking an accidental mark.
  const [penActive, setPenActive] = useState(false)
  // A mark-in-progress: one tooth's worth of freehand strokes that have
  // been drawn but not yet saved. Only one tooth can be "active" at a time
  // — starting a stroke on a different tooth while this is set is blocked
  // (see paintEnabled below) so a half-finished mark can't get silently
  // abandoned by drifting to another tooth.
  const [pending, setPending] = useState(null) // { toothNumber, strokes: [{uv, local}, ...] }
  const controlsRef = useRef(null)

  useEffect(() => {
    onPendingChange?.(!!pending)
  }, [pending, onPendingChange])

  const load = useCallback(() => {
    setLoading(true)
    getCurrentChart(patientId)
      .then(setEntries)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load chart'))
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  const chartByTooth = useMemo(() => groupChartEntries(entries), [entries])

  const handleStrokeComplete = useCallback((toothNumber, stroke) => {
    setPending((prev) => {
      if (prev && prev.toothNumber === toothNumber) return { ...prev, strokes: [...prev.strokes, stroke] }
      if (prev) return prev // a different tooth is already active — ignore
      return { toothNumber, strokes: [stroke] }
    })
  }, [])

  function handleUndo() {
    setPending((prev) => {
      if (!prev) return prev
      const strokes = prev.strokes.slice(0, -1)
      return strokes.length ? { ...prev, strokes } : null
    })
  }

  function handleSaveMark() {
    if (!pending) return
    const uvPoints = pending.strokes.flatMap((s) => s.uv)
    if (uvPoints.length === 0) return
    // Surface = ang UV cell na pinakamaraming tinamaan ng drawing (tingnan
    // ang surfaceForUV). Laging mesial ang +X cell, dahil mina-mirror ng
    // Tooth3D ang geometry sa kabilang side ng bibig.
    const surface = mostCommon(uvPoints.map(surfaceForUV))
    // Carried through to ChartEntryModal so the actual drawn strokes (not
    // just which surface they landed on) get saved alongside the entry —
    // see stroke_data on chart_entries.
    const strokes = pending.strokes.map((s) => s.uv)
    setSelection({ toothNumber: pending.toothNumber, surface, strokes })
  }

  async function handleSaveEntry(payload) {
    await createChartEntry(patientId, payload)
    await load()
    setHighlightedTooth(payload.toothNumber)
    setTimeout(() => setHighlightedTooth(null), 2000)
    if (pending?.toothNumber === payload.toothNumber) setPending(null)
  }

  function setOrbitEnabled(enabled) {
    if (controlsRef.current) controlsRef.current.enabled = enabled
  }

  if (loading) return <p className="text-sm text-slate-400">Loading chart...</p>

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {canEdit && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPenActive((v) => !v)}
              className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-all ${
                penActive
                  ? 'border-sky-500 bg-sky-600 text-white ring-1 ring-sky-500'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <PenLine className="h-4 w-4" />
              {penActive ? 'Pen: On' : 'Pen: Off'}
            </button>
            <p className="text-sm text-slate-400">
              {penActive
                ? 'Draw directly on a tooth to mark it, then Save.'
                : 'Turn the pen on to mark teeth — drag freely to rotate for now.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setActiveCondition(c.code)}
                className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-all ${
                  activeCondition === c.code
                    ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-500'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
          </div>

          {pending && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm text-amber-800">
                Unsaved mark on tooth {pending.toothNumber} — {pending.strokes.length} stroke
                {pending.strokes.length === 1 ? '' : 's'}. Other teeth are locked until this is saved or discarded.
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  className="flex min-h-9 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="flex min-h-9 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveMark}
                  className="flex min-h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Mark
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fixed height, not viewport-scaled — same reasoning as the 2D
          chart's fixed pixel width: a shrunk canvas makes drag-painting
          individual tooth surfaces impractical on small screens. */}
      <div className="h-[480px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
        <Canvas shadows camera={{ position: [0, 2.6, 7.6], fov: 45 }}>
          <SceneLights />
          <OrbitControls
            ref={controlsRef}
            target={[0, 0, -2.2]}
            enablePan={false}
            minDistance={3}
            maxDistance={14}
          />
          {ARCHES.map((arch) => (
            <Gingiva key={arch.upper ? 'upper' : 'lower'} arch={arch} />
          ))}
          {ODONTOGRAM_ROWS.map((row, rowIndex) =>
            row.map((toothNumber, i) => {
              const { position, rotationY, flipUpper, mesialOnPositiveX, tiltX, labelY } = PLACEMENTS[rowIndex][i]
              const isPendingTooth = pending?.toothNumber === toothNumber
              return (
                <Tooth3D
                  key={toothNumber}
                  toothNumber={toothNumber}
                  chartState={chartByTooth[toothNumber] || NO_CHART}
                  labelY={labelY}
                  canEdit={canEdit}
                  paintEnabled={canEdit && penActive && (!pending || isPendingTooth)}
                  pendingStrokes={isPendingTooth ? pending.strokes : NO_STROKES}
                  onStrokeComplete={(stroke) => handleStrokeComplete(toothNumber, stroke)}
                  position={position}
                  rotationY={rotationY}
                  flipUpper={flipUpper}
                  mesialOnPositiveX={mesialOnPositiveX}
                  tiltX={tiltX}
                  penColor={conditionColor(activeCondition)}
                  onPaintStart={() => setOrbitEnabled(false)}
                  onPaintEnd={() => setOrbitEnabled(true)}
                  highlighted={toothNumber === highlightedTooth}
                />
              )
            }),
          )}
        </Canvas>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Legend</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {CONDITIONS.map((c) => (
            <div key={c.code} className="flex items-center gap-1.5 text-base text-slate-600">
              <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {!canEdit && (
        <p className="mt-3 text-sm text-slate-400">Read-only view — only the dentist can update the chart.</p>
      )}

      {selection && (
        <ChartEntryModal
          patientId={patientId}
          toothNumber={selection.toothNumber}
          surface={selection.surface}
          currentEntry={chartByTooth[selection.toothNumber]?.[selection.surface]}
          defaultConditionCode={activeCondition}
          strokes={selection.strokes}
          onClose={() => setSelection(null)}
          onSubmit={handleSaveEntry}
        />
      )}
    </div>
  )
}
