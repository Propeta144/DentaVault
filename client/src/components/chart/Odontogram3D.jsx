import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PenLine, Undo2, Save, X } from 'lucide-react'
import Tooth3D, { classifySurface, mostCommon, toothExtents } from './Tooth3D'
import ChartEntryModal from './ChartEntryModal'
import { ODONTOGRAM_ROWS, CONDITIONS, conditionColor } from '../../constants/dental'
import { getCurrentChart, createChartEntry } from '../../services/chart'

// Same physical dental arch (upper + lower) as Odontogram2D, just curved
// into 3D instead of laid out as a flat grid. Each row's 16 teeth are
// spread across an arc so the whole thing forms a rotatable horseshoe
// shape — index 0 of a row sits at -HALF_ANGLE, index 15 at +HALF_ANGLE,
// inheriting the same FDI ordering (and patient-orientation mirroring)
// ODONTOGRAM_ROWS already encodes for the 2D chart.
//
// Radius is tuned to the extracted tooth model's actual crown width
// (~0.83 units after PCA re-alignment — see scripts/extract-tooth-model.js)
// so adjacent teeth sit edge-to-edge without interpenetrating: chord
// length between neighboring tooth centers is 2R·sin(halfStep), so for a
// ~0.85-unit chord with 16 teeth over a 150° arc (halfStep = 150°/15/2 =
// 5°), R ≈ 0.85 / (2·sin(5°)) ≈ 4.9. This has nothing to do with the
// arch's on-screen size — individual tooth scale is fixed regardless of
// radius.
const ARCH_RADIUS = 4.9
const HALF_ANGLE = (75 * Math.PI) / 180
const ROW_Y = { 0: 0.75, 1: -0.75 }
const NO_STROKES = []

function archPoint(theta, y) {
  return new THREE.Vector3(ARCH_RADIUS * Math.sin(theta), y, -ARCH_RADIUS + ARCH_RADIUS * Math.cos(theta))
}

function toothTransform(rowIndex, indexInRow, rowLength) {
  const theta = -HALF_ANGLE + (2 * HALF_ANGLE * indexInRow) / (rowLength - 1)
  const { x, y, z } = archPoint(theta, ROW_Y[rowIndex])
  // The extracted tooth template is authored crown-up (see extraction
  // script) — correct for a lower tooth, since lower crowns point up
  // toward the bite line. Upper teeth need flipping so their crowns point
  // down instead; a 180° turn around the tooth's own front-back (Z) axis
  // does that while leaving its facial side pointing outward either way —
  // it only swaps which physical side ends up mesial vs distal, which
  // `mesialOnPositiveX` below compensates for.
  const flipUpper = rowIndex === 0
  const mesialOnPositiveX = flipUpper ? theta > 0 : theta < 0
  return { position: [x, y, z], rotationY: theta, flipUpper, mesialOnPositiveX }
}

// A simple pink ridge tracing the same arc the teeth sit on, so the arch
// doesn't look like a row of teeth floating in mid-air — stands in for
// gums without needing a separate downloaded/licensed asset. `edgeY` is
// where the ridge should touch the visible arch (just past the crown tips
// on the row's outward vertical edge); it tapers to `rootY` behind that.
function GumRidge({ edgeY, rootY }) {
  const curve = useMemo(() => {
    const points = []
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      const theta = -HALF_ANGLE + (2 * HALF_ANGLE * i) / steps
      points.push(archPoint(theta, (edgeY + rootY) / 2))
    }
    return new THREE.CatmullRomCurve3(points)
  }, [edgeY, rootY])

  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 48, Math.abs(rootY - edgeY) / 2 + 0.12, 10, false),
    [curve, edgeY, rootY],
  )

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#e0a8a3" roughness={0.7} />
    </mesh>
  )
}

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

  const chartByTooth = useMemo(
    () =>
      entries.reduce((acc, entry) => {
        acc[entry.tooth_number] ??= {}
        acc[entry.tooth_number][entry.surface] = entry
        return acc
      }, {}),
    [entries],
  )

  // toothNumber -> mesialOnPositiveX, precomputed once so handleSaveMark
  // can classify without re-deriving the whole arch layout.
  const mesialMap = useMemo(() => {
    const map = {}
    ODONTOGRAM_ROWS.forEach((row, rowIndex) => {
      row.forEach((toothNumber, i) => {
        map[toothNumber] = toothTransform(rowIndex, i, row.length).mesialOnPositiveX
      })
    })
    return map
  }, [])

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
    const points = pending.strokes.flatMap((s) => s.local)
    if (points.length === 0) return
    const extents = toothExtents(pending.toothNumber)
    const surface = mostCommon(points.map((p) => classifySurface(p, mesialMap[pending.toothNumber], extents)))
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
        <Canvas shadows camera={{ position: [0, 2, 7.5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 6, 6]} intensity={0.9} castShadow />
          <directionalLight position={[-4, 3, -2]} intensity={0.3} />
          <OrbitControls
            ref={controlsRef}
            target={[0, 0, -1.2]}
            enablePan={false}
            minDistance={3}
            maxDistance={14}
          />
          <GumRidge edgeY={1} rootY={1.5} />
          <GumRidge edgeY={-1} rootY={-1.5} />
          {ODONTOGRAM_ROWS.map((row, rowIndex) =>
            row.map((toothNumber, i) => {
              const { position, rotationY, flipUpper, mesialOnPositiveX } = toothTransform(
                rowIndex,
                i,
                row.length,
              )
              const isPendingTooth = pending?.toothNumber === toothNumber
              return (
                <Tooth3D
                  key={toothNumber}
                  toothNumber={toothNumber}
                  chartState={chartByTooth[toothNumber] || {}}
                  canEdit={canEdit}
                  paintEnabled={canEdit && penActive && (!pending || isPendingTooth)}
                  pendingStrokes={isPendingTooth ? pending.strokes : NO_STROKES}
                  onStrokeComplete={(stroke) => handleStrokeComplete(toothNumber, stroke)}
                  position={position}
                  rotationY={rotationY}
                  flipUpper={flipUpper}
                  mesialOnPositiveX={mesialOnPositiveX}
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
