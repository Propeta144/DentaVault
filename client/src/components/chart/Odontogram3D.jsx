import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Focus, Move, PenLine, RotateCcw, Save, X, ZoomIn, ZoomOut } from 'lucide-react'
import ChartCameraControls from './ChartCameraControls'
import { defaultDentition, dentitionLabel, isDentition } from '../../utils/dentition'
import Tooth3D from './Tooth3D'
import { groupPenDrafts, savePenDrafts, splitPenStroke } from '../../utils/penDrafts'
import Gingiva from './Gingiva'
import { DENTITION_SCENES, SceneLights, groupChartEntries } from './chartScene'
import ChartEntryModal from './ChartEntryModal'
import ToothDetailsModal from './ToothDetailsModal'
import SavePenMarksModal from './SavePenMarksModal'
import { useToast } from '../../context/ToastContext'
import { CONDITIONS, SURFACES, conditionColor, conditionLabel, isPrimaryTooth } from '../../constants/dental'
import ConditionLegend from './ConditionLegend'

// Pagpipilian ng pen: ang mga kondisyon na iginuguhit sa isang SURFACE lang
// (Decayed, Filled, ...). Ang pang-buong-ngipin (Missing, Crown, ...) ay
// pinipili sa modal pagkatapos gumuhit, o sa 2D chart.
const PEN_CONDITIONS = CONDITIONS.filter((c) => c.scope !== 'whole')
import { getCurrentChart, createChartEntry, deleteChartEntry } from '../../services/chart'
import PageLoader from '../common/PageLoader'

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
// alerts: { allergies, medicalHistory }, ipinapakita sa chart entry modal (pati sa 3D pen)
export default function Odontogram3D({ patientId, canEdit, onPendingChange, alerts, dateOfBirth, dentition: selectedDentition, onDentitionChange, selectedTooth, onToothSelect }) {
  const { showToast } = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // { toothNumber, surface }
  const [highlightedTooth, setHighlightedTooth] = useState(null)
  // Walang napiling kondisyon sa simula (dati "D Decayed" agad, kahit naka-off
  // pa ang pen; critique 2026-10-25). Hindi makakaguhit hangga't walang napili.
  const [activeCondition, setActiveCondition] = useState(null)
  // Pen starts off so the model is safe to orbit/inspect by default —
  // dragging across a tooth only paints once the dentist explicitly turns
  // drawing on, instead of every rotate-attempt risking an accidental mark.
  const [penActive, setPenActive] = useState(false)
  // Drafts sa maraming ngipin; bawat segment may sariling condition/surface.
  // Hindi kinukulayan ulit ang lumang stroke kapag nagpalit ng pen.
  const [pending, setPending] = useState([])
  const hasPending = pending.length > 0
  const pendingGroups = useMemo(() => groupPenDrafts(pending), [pending])
  const pendingByTooth = useMemo(() => {
    const grouped = {}
    for (const draft of pending) (grouped[draft.toothNumber] ??= []).push(draft)
    return grouped
  }, [pending])
  const controlsRef = useRef(null)
  const [panMode, setPanMode] = useState(false)
  const [cameraAction, setCameraAction] = useState(null)
  const [saveAllOpen, setSaveAllOpen] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const [saveAllError, setSaveAllError] = useState('')
  const [saveProgress, setSaveProgress] = useState({ completed: 0, total: 0 })
  const saveAllLock = useRef(false)
  const canSelectSurface = !penActive && !panMode && !selection && !saveAllOpen

  useEffect(() => {
    onPendingChange?.(hasPending)
  }, [hasPending, onPendingChange])

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    return getCurrentChart(patientId)
      .then(setEntries)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load chart'))
      .finally(() => { if (!silent) setLoading(false) })
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  const chartByTooth = useMemo(() => groupChartEntries(entries), [entries])
  const hasPrimary = entries.some((e) => isPrimaryTooth(e.tooth_number))
  const hasPermanent = entries.some((e) => !isPrimaryTooth(e.tooth_number))
  const dentition = isDentition(selectedDentition) ? selectedDentition : defaultDentition(dateOfBirth, entries)
  const scene = DENTITION_SCENES[dentition]

  // Sa shared toolbar ang selector; pareho ang active set at chart pagkatapos mag-load.
  useEffect(() => {
    if (!loading && !error && !isDentition(selectedDentition)) onDentitionChange?.(dentition)
  }, [loading, error, selectedDentition, dentition, onDentitionChange])

  const handleStrokeComplete = useCallback((toothNumber, stroke) => {
    const segments = splitPenStroke(toothNumber, stroke, crypto.randomUUID())
    setPending((prev) => [...prev, ...segments])
    onToothSelect?.(toothNumber)
  }, [onToothSelect])

  function handleSaveMark(group = pendingGroups[0]) {
    if (!group?.drafts) return
    onToothSelect?.(group.toothNumber)
    setSelection({ toothNumber: group.toothNumber, surface: group.surface,
      conditionCode: group.conditionCode, strokes: group.drafts.map((draft) => draft.uv),
      draftIds: group.drafts.map((draft) => draft.id) })
  }

  function discardMark(group) {
    const ids = new Set(group.drafts.map((draft) => draft.id))
    setPending((previous) => previous.filter((draft) => !ids.has(draft.id)))
  }

  async function handleSaveAll(addTreatments) {
    if (saveAllLock.current || !pending.length || !canEdit) return
    saveAllLock.current = true
    setSavingAll(true)
    setSaveAllError('')
    const drafts = pending.slice()
    const total = groupPenDrafts(drafts).length
    let completed = 0
    setSaveProgress({ completed, total })
    try {
      const latest = await getCurrentChart(patientId)
      setEntries(latest)
      await savePenDrafts({ drafts, entries: latest, addTreatments,
        saveEntry: (payload) => createChartEntry(patientId, payload),
        onSaved: (group, entry) => {
          discardMark(group)
          setEntries((previous) => [...previous.filter((old) => !(old.tooth_number === entry.tooth_number && old.surface === entry.surface)), entry])
          completed += 1
          setSaveProgress({ completed, total })
        },
      })
      setSaveAllOpen(false)
      setPenActive(false)
      showToast(`${completed} ${completed === 1 ? 'mark saved' : 'marks saved'}.`, { type: 'success' })
    } catch (err) {
      setSaveAllError(`${completed} of ${total} marks saved. ${err.response?.data?.error || 'Could not save the next mark.'} Remaining marks have been kept. You can retry or cancel to review them.`)
    } finally {
      saveAllLock.current = false
      setSavingAll(false)
    }
  }

  async function handleSaveEntry(payload) {
    // Dagdag na guhit sa parehong saved condition: panatilihin ang dating
    // strokes. Ibang condition sa parehong surface = explicit replacement.
    const current = chartByTooth[payload.toothNumber]?.[payload.surface]
    const existingStrokes = selection?.strokes && current?.condition_code === payload.conditionCode && Array.isArray(current.stroke_data)
      ? current.stroke_data : []
    await createChartEntry(patientId, { ...payload,
      strokeData: payload.strokeData ? [...existingStrokes, ...payload.strokeData] : payload.strokeData })
    if (selection?.draftIds) {
      const savedIds = new Set(selection.draftIds)
      setPending((prev) => prev.filter((draft) => !savedIds.has(draft.id)))
    }
    await load(true)
    setHighlightedTooth(payload.toothNumber)
    setTimeout(() => setHighlightedTooth(null), 2000)
  }

  function setOrbitEnabled(enabled) {
    if (controlsRef.current) controlsRef.current.enabled = enabled
  }

  function openSurface(toothNumber, surface) {
    if (!canSelectSurface) return
    const draft = pendingGroups.findLast((group) => group.toothNumber === toothNumber && group.surface === surface)
    if (draft) { handleSaveMark(draft); return }
    onToothSelect?.(toothNumber)
    setSelection({ toothNumber, surface })
  }

  if (loading) return <PageLoader label="Loading chart..." />

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <h3 className="mb-3 text-base font-semibold text-slate-900">{dentitionLabel(dentition)}</h3>

      {canEdit && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setPenActive((v) => !v); setPanMode(false) }}
              className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-all ${
                penActive
                  ? 'border-sky-500 bg-sky-600 text-white ring-1 ring-sky-500'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <PenLine className="h-4 w-4" />
              {penActive ? 'Pen: On' : 'Pen: Off'}
            </button>
            <p
              className={`text-sm ${penActive && !activeCondition ? 'font-medium text-amber-800' : 'text-slate-600'}`}
              aria-live="polite"
            >
              {!penActive
                ? panMode ? 'Drag to move the chart. Turn Pan off to select a surface.'
                  : 'Click or hover a surface, even with unsaved marks. Turn the pen on to draw.'
                : activeCondition
                  ? 'Draw on any tooth, then Save All. Turn the pen off to hover or select surfaces.'
                  : 'Choose a condition first, then draw on a tooth.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pen condition">
            {PEN_CONDITIONS.map((c) => (
              <button
                key={c.code}
                type="button"
                aria-pressed={activeCondition === c.code}
                onClick={() => setActiveCondition(c.code)}
                className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-all ${
                  activeCondition === c.code
                    ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-500'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: c.color }} />
                <span className="font-semibold">{c.letter}</span>
                {c.label}
              </button>
            ))}
          </div>

          {hasPending && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm text-amber-800">
                {pendingGroups.length} unsaved {pendingGroups.length === 1 ? 'mark' : 'marks'} on {Object.keys(pendingByTooth).length} {Object.keys(pendingByTooth).length === 1 ? 'tooth' : 'teeth'}. Save all together or review individual marks below.
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPending([])}
                  className="flex min-h-11 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  <X className="h-3.5 w-3.5" />
                  Discard All
                </button>
                <button
                  type="button"
                  onClick={() => { setSaveAllError(''); setSaveAllOpen(true) }}
                  disabled={!hasPending}
                  className="flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save All
                </button>
              </div>
            </div>
          )}
          {hasPending && (
            <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-slate-700">Review unsaved marks ({pendingGroups.length})</summary>
              <div className="space-y-2 pb-1">
                {pendingGroups.map((group) => (
                  <div key={group.key} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white">
                    <button type="button" onClick={() => handleSaveMark(group)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: conditionColor(group.conditionCode) }} />
                      <span>Tooth {group.toothNumber} · {SURFACES.find((surface) => surface.code === group.surface)?.label} · {conditionLabel(group.conditionCode)}</span>
                    </button>
                    <button type="button" onClick={() => discardMark(group)}
                      aria-label={`Discard unsaved mark: tooth ${group.toothNumber}, ${group.surface}, ${conditionLabel(group.conditionCode)}`}
                      title="Discard this unsaved mark"
                      className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Fixed height, not viewport-scaled — same reasoning as the 2D
          chart's fixed pixel width: a shrunk canvas makes drag-painting
          individual tooth surfaces impractical on small screens. */}
      {/* Permanent / Baby teeth: nasa pending state ang drafts, kaya
          nananatili kahit magpalit ng dentition. */}
      {((dentition === 'permanent' && hasPrimary) || (dentition === 'primary' && hasPermanent)) && <div className="mb-3">
        {dentition === 'permanent' && hasPrimary && (
          <p className="text-sm text-slate-500">This patient also has baby teeth on record.</p>
        )}
        {dentition === 'primary' && hasPermanent && (
          <p className="text-sm text-slate-500">This patient also has adult teeth on record.</p>
        )}
      </div>}

      <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="3D camera controls">
        <button type="button" aria-pressed={panMode}
          onClick={() => { setPanMode((value) => !value); setPenActive(false) }}
          className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium ${panMode ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
          <Move className="h-4 w-4" aria-hidden="true" /> Pan
        </button>
        <button type="button" disabled={!selectedTooth} onClick={() => setCameraAction({ type: 'focus' })}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Focus className="h-4 w-4" aria-hidden="true" /> Focus tooth
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setCameraAction({ type: 'out' })}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          <ZoomOut className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setCameraAction({ type: 'in' })}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setCameraAction({ type: 'reset' })}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset view
        </button>
      </div>
      <p className="mb-2 text-sm text-slate-600">Drag to {panMode ? 'pan' : 'rotate'}. Right-drag to pan; scroll or pinch to zoom. Click empty space to clear the highlight.</p>
      <div data-dentition={dentition} data-selected-tooth={selectedTooth || undefined} className="h-[480px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
        {/* key: bagong camera kapag nagpalit ng set (mas maliit ang arch ng bata) */}
        <Canvas key={dentition} shadows camera={{ position: scene.camera, fov: 45, near: 0.05 }}
          onPointerMissed={(event) => {
            if (event.button !== 0 || selection) return
            onToothSelect?.(null)
            setHighlightedTooth(null)
          }}>
          <SceneLights />
          <ChartCameraControls controlsRef={controlsRef} view={scene} selectedTooth={selectedTooth}
            autoFocus={!penActive && !panMode && !hasPending} panMode={panMode} action={cameraAction} />
          {scene.arches.map((arch) => (
            <Gingiva key={arch.upper ? 'upper' : 'lower'} arch={arch}
              blockSurfaceSelection={canSelectSurface} />
          ))}
          {scene.rows.map((row, rowIndex) =>
            row.map((toothNumber, i) => {
              const { position, rotationY, flipUpper, mesialOnPositiveX, tiltX, labelY } = scene.placements[rowIndex][i]
              return (
                <Tooth3D
                  key={toothNumber}
                  toothNumber={toothNumber}
                  chartState={chartByTooth[toothNumber] || NO_CHART}
                  labelY={labelY}
                  canEdit={canEdit}
                  surfaceSelectionEnabled={canSelectSurface}
                  onSurfaceSelect={openSurface}
                  paintEnabled={canEdit && penActive && Boolean(activeCondition) && !selection && !saveAllOpen}
                  pendingStrokes={pendingByTooth[toothNumber] || NO_STROKES}
                  onStrokeComplete={(stroke) => handleStrokeComplete(toothNumber, stroke)}
                  position={position}
                  rotationY={rotationY}
                  flipUpper={flipUpper}
                  mesialOnPositiveX={mesialOnPositiveX}
                  tiltX={tiltX}
                  penColor={conditionColor(activeCondition)}
                  penConditionCode={activeCondition}
                  onPaintStart={() => setOrbitEnabled(false)}
                  onPaintEnd={() => setOrbitEnabled(true)}
                  highlighted={toothNumber === highlightedTooth}
                  selected={toothNumber === selectedTooth}
                />
              )
            }),
          )}
        </Canvas>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Legend</h3>
        <ConditionLegend />
      </div>

      {!canEdit && (
        <p className="mt-3 text-sm text-slate-600">Tap a tooth to view recorded findings and treatments. Drag to rotate.</p>
      )}

      {saveAllOpen && <SavePenMarksModal groups={pendingGroups} dateOfBirth={dateOfBirth} alerts={alerts}
        saving={savingAll} progress={saveProgress} error={saveAllError}
        onClose={() => { if (!saveAllLock.current) setSaveAllOpen(false) }} onSave={handleSaveAll} />}

      {selection && !canEdit && (
        <ToothDetailsModal patientId={patientId} toothNumber={selection.toothNumber}
          surface={selection.surface} toothState={chartByTooth[selection.toothNumber] || NO_CHART}
          alerts={alerts} onClose={() => setSelection(null)} />
      )}
      {selection && canEdit && (
        <ChartEntryModal
          patientId={patientId}
          toothNumber={selection.toothNumber}
          surface={selection.surface}
          currentEntry={chartByTooth[selection.toothNumber]?.[selection.surface]}
          toothState={!selection.strokes ? chartByTooth[selection.toothNumber] || NO_CHART : undefined}
          defaultConditionCode={selection.strokes ? selection.conditionCode : undefined}
          strokes={selection.strokes}
          alerts={alerts}
          dateOfBirth={dateOfBirth}
          onClose={() => setSelection(null)}
          onSubmit={handleSaveEntry}
          onDelete={canEdit && !selection.strokes ? async (entryId) => {
            await deleteChartEntry(patientId, entryId)
            await load(true)
          } : undefined}
        />
      )}
    </div>
  )
}
