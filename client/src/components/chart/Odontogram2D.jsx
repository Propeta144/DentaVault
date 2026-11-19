import { useCallback, useEffect, useRef, useState } from 'react'
import Tooth from './Tooth'
import { TOOTH_BOX } from './toothShape'
import ChartEntryModal from './ChartEntryModal'
import ToothDetailsModal from './ToothDetailsModal'
import ConditionLegend from './ConditionLegend'
import PageLoader from '../common/PageLoader'
import { ODONTOGRAM_ROWS, PRIMARY_ROWS, isPrimaryTooth } from '../../constants/dental'
import { getCurrentChart, createChartEntry, deleteChartEntry } from '../../services/chart'
import { defaultDentition, dentitionLabel, isDentition } from '../../utils/dentition'

// Iisang sukat ng ngipin para sa layout at sa hugis (toothShape.js)
const TOOTH_SIZE = TOOTH_BOX
const TOOTH_GAP = 8
const QUADRANT_GAP = 24
// May 5px na labas ang selection/focus ring, kasama pa ang stroke at shadow.
// Parehong gilid kailangan ng puwang para hindi ito ma-clip ng SVG viewport.
const SIDE_PADDING = 12
const ARCH_LABEL_SPACE = 22 // UPPER RIGHT / LOWER LEFT na label
const NUMBER_SPACE = 30 // numero ng ngipin (itaas ng upper, ibaba ng lower)
const LETTER_SPACE = 26 // letter codes (D, F, ...) sa kabilang gilid
const BITE_GAP = 28 // pagitan ng upper at lower (may dashed na bite line)

function toothX(indexInRow, count) {
  const midpoint = count / 2
  const extraGap = indexInRow >= midpoint ? QUADRANT_GAP : 0
  return SIDE_PADDING + indexInRow * (TOOTH_SIZE + TOOTH_GAP) + extraGap
}

// Isang dentition lang: dalawang rows, kapwa malaki ang tap targets.
function buildLayout(dentition) {
  const rows = []
  let y = ARCH_LABEL_SPACE
  const teeth = dentition === 'primary' ? PRIMARY_ROWS : ODONTOGRAM_ROWS
  const upper = [{ teeth: teeth[0] }]
  for (const row of upper) {
    y += NUMBER_SPACE
    rows.push({ ...row, y, labelPosition: 'above' })
    y += TOOTH_SIZE + LETTER_SPACE
  }
  const biteY = y + BITE_GAP / 2
  y += BITE_GAP
  const lower = [{ teeth: teeth[1] }]
  for (const row of lower) {
    y += LETTER_SPACE
    rows.push({ ...row, y, labelPosition: 'below' })
    y += TOOTH_SIZE + NUMBER_SPACE
  }
  const count = teeth[0].length
  const half = count / 2
  return { rows, biteY, height: y + ARCH_LABEL_SPACE,
    width: toothX(count - 1, count) + TOOTH_SIZE + SIDE_PADDING,
    leftLabelX: (toothX(0, count) + toothX(half - 1, count) + TOOTH_SIZE) / 2,
    rightLabelX: (toothX(half, count) + toothX(count - 1, count) + TOOTH_SIZE) / 2 }
}

function rowToothX(row, i) {
  return toothX(i, row.teeth.length)
}

// Yung Quadrant 1 (kanan ng pasyente, taas), nasa LEFT half ng chart siya —
// parang salamin kasi kung paano haharapin ng chart yung pasyente, kaya
// ganito talaga binabasa ng dentist. Yung maliliit na arch labels na 'to,
// nandiyan para may maka-orient agad kahit hindi memorized yung FDI
// notation (hal. defense panel, o pasyente mismo) — di na kailangan pang
// i-explain isa-isa yung tooth numbers.

function ArchLabel({ x, y, children }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize="13" // ~8px pa rin kapag pinaliit ang chart sa laptop
      fontWeight="600"
      letterSpacing="0.5"
      fill="#7a6c93" // slate-500 ng brand (dati #94a3b8, 2.6:1 lang sa puti)
    >
      {children}
    </text>
  )
}

// Parehong chart API at dentition policy ng 3D; hiwalay lang ang renderer.
// printMode: napiling set lang, bukas ang legend, walang view controls.
// alerts: { allergies, medicalHistory }, ipinapakita sa chart entry modal
export default function Odontogram2D({ patientId, canEdit, printMode = false, alerts, dateOfBirth, dentition: selectedDentition, onDentitionChange, selectedTooth, onToothSelect }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // { toothNumber, surface }
  const [highlightedTooth, setHighlightedTooth] = useState(null)
  // Keyboard (critique 2026-10-25): iisang Tab stop ang buong chart (dati 32);
  // ang ngiping ito ang may tabIndex 0, arrow keys ang paglipat.
  const [focusTooth, setFocusTooth] = useState(null)
  // Pagkasara ng modal: ibalik ang focus sa ngiping binuksan (dati napupunta
  // sa body, kaya nawawala ang keyboard user)
  const returnFocusTo = useRef(null)

  // Unang load lang ang may loader; ang reload pagka-save ay tahimik, para
  // hindi mawala ang chart (at ang focus) habang naglo-load
  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      return getCurrentChart(patientId)
        .then(setEntries)
        .catch((err) => setError(err.response?.data?.error || 'Failed to load chart'))
        .finally(() => setLoading(false))
    },
    [patientId],
  )

  useEffect(() => {
    load()
  }, [load])

  const dentition = isDentition(selectedDentition) ? selectedDentition : defaultDentition(dateOfBirth, entries)
  // Sa shared toolbar ang selector; hintayin ang records bago itakda ang default.
  useEffect(() => {
    if (!loading && !error && !isDentition(selectedDentition)) onDentitionChange?.(dentition)
  }, [loading, error, selectedDentition, dentition, onDentitionChange])

  // { toothNumber: { surfaceCode: entry } }
  const chartByTooth = entries.reduce((acc, entry) => {
    acc[entry.tooth_number] ??= {}
    acc[entry.tooth_number][entry.surface] = entry
    return acc
  }, {})

  function openTooth(toothNumber, surface) {
    if (printMode) return
    returnFocusTo.current = toothNumber
    setFocusTooth(toothNumber)
    onToothSelect?.(toothNumber)
    setSelection({ toothNumber, surface })
  }

  function closeModal() {
    setSelection(null)
    const tooth = returnFocusTo.current
    // Pagkatapos mag-render ulit (wala na ang modal)
    requestAnimationFrame(() => document.getElementById(`tooth-${tooth}`)?.focus())
  }

  async function handleSaveEntry(payload) {
    await createChartEntry(patientId, payload)
    await load(true)
    // Sandaling highlight lang, para makita agad kung aling ngipin yung
    // kakabago lang, lalo na pag whole-tooth save na lahat ng 5 surfaces
    // sabay-sabay nag-update.
    setHighlightedTooth(payload.toothNumber)
    setTimeout(() => setHighlightedTooth(null), 2000)
  }

  if (loading) return <PageLoader label="Loading chart..." />

  const hasPrimaryEntries = entries.some((e) => isPrimaryTooth(e.tooth_number))
  const hasPermanentEntries = entries.some((e) => !isPrimaryTooth(e.tooth_number))
  const layout = buildLayout(dentition)
  const visibleTeeth = layout.rows.flatMap((r) => r.teeth)
  const tabStopTooth = visibleTeeth.includes(focusTooth) ? focusTooth : visibleTeeth.includes(selectedTooth) ? selectedTooth : visibleTeeth[0]

  // ←/→ sa iisang hilera, ↑/↓ sa katapat na ngipin ng kabilang hilera
  // (pinakamalapit na x), Home/End = dulo ng hilera. Enter/Space ay nasa Tooth.
  function handleChartKeyDown(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const rowIndex = layout.rows.findIndex((r) => r.teeth.includes(tabStopTooth))
    if (rowIndex < 0) return
    const row = layout.rows[rowIndex]
    const i = row.teeth.indexOf(tabStopTooth)
    let next = null
    if (e.key === 'ArrowLeft') next = row.teeth[Math.max(0, i - 1)]
    else if (e.key === 'ArrowRight') next = row.teeth[Math.min(row.teeth.length - 1, i + 1)]
    else if (e.key === 'Home') next = row.teeth[0]
    else if (e.key === 'End') next = row.teeth[row.teeth.length - 1]
    else {
      const target = layout.rows[rowIndex + (e.key === 'ArrowDown' ? 1 : -1)]
      if (target) {
        const x = rowToothX(row, i)
        let best = 0
        target.teeth.forEach((_, j) => {
          if (Math.abs(rowToothX(target, j) - x) < Math.abs(rowToothX(target, best) - x)) best = j
        })
        next = target.teeth[best]
      }
    }
    e.preventDefault()
    if (next && next !== tabStopTooth) {
      setFocusTooth(next)
      document.getElementById(`tooth-${next}`)?.focus()
    }
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <h3 className="mb-3 text-base font-semibold text-slate-900">{dentitionLabel(dentition)}</h3>

      {/*
        Lumiliit ang chart para magkasya sa lalagyan (w-full, hanggang sa
        natural na laki niya), pero hindi bababa sa 600px (min-w). Dati
        naka-fixed ito sa buong laki (~1056px), kaya sa karaniwang laptop
        (1366px, may sidebar at 2-column na profile) naputol ang kalahati ng
        bibig (21-28, 31-38) at kailangan pang i-scroll. Ang 600px na sahig
        ay para sa phone: kung papaliitin pa sa ~350px, sobrang liit na ng 5
        surface regions para i-tap nang tama — kaya doon, horizontal scroll
        pa rin (overflow-x-auto), same tradeoff ng dental charting software.
      */}
      {/*
        print:overflow-visible: sa papel walang scroll — anumang lumampas sa
        gilid ng page, tahimik na mapuputol. Dahil w-full + viewBox na ang
        SVG, sumusukat na ito sa lapad ng print page nang proportional.
      */}
      {/* Walang sariling card (border/shadow): nasa loob na ito ng card ng
          tabs, kaya card-in-card dati (critique 2026-10-25). Sa print, pareho
          pa rin (walang border doon). */}
      <div data-odontogram-scroll className="-mx-1 overflow-x-auto px-1 py-2 print:mx-0 print:overflow-visible print:p-0"
        onClick={!printMode ? (event) => {
          if (event.target.closest('[id^="tooth-"]')) return
          onToothSelect?.(null)
          setHighlightedTooth(null)
          const focused = document.activeElement
          if (event.currentTarget.contains(focused)) focused.blur()
        } : undefined}>
        <svg
          data-dentition={dentition}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="mx-auto block h-auto w-full min-w-[600px]"
          style={{ maxWidth: layout.width }}
          role="group"
          aria-label={`${dentitionLabel(dentition)} dental chart.${!printMode ? ' Use arrow keys to move between teeth, Enter to open a tooth.' : ''}`}
          onKeyDown={!printMode ? handleChartKeyDown : undefined}
        >
          <defs>
            <filter id="tooth-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#171123" floodOpacity="0.18" />
            </filter>
          </defs>

          <ArchLabel x={layout.leftLabelX} y={14}>
            UPPER RIGHT
          </ArchLabel>
          <ArchLabel x={layout.rightLabelX} y={14}>
            UPPER LEFT
          </ArchLabel>

          {layout.rows.map((row) =>
            row.teeth.map((toothNumber, i) => (
              <Tooth
                key={toothNumber}
                toothNumber={toothNumber}
                x={rowToothX(row, i)}
                y={row.y}
                scale={1}
                labelPosition={row.labelPosition}
                chartState={chartByTooth[toothNumber] || {}}
                canEdit={canEdit}
                canInteract={!printMode}
                selected={!printMode && toothNumber === selectedTooth}
                highlighted={toothNumber === highlightedTooth}
                onSurfaceClick={(tooth, surface) => openTooth(tooth, surface)}
                onWholeClick={(tooth) => openTooth(tooth, 'whole')}
                tabIndex={toothNumber === tabStopTooth ? 0 : -1}
                onFocus={() => setFocusTooth(toothNumber)}
              />
            )),
          )}

          <ArchLabel x={layout.leftLabelX} y={layout.height - 4}>
            LOWER RIGHT
          </ArchLabel>
          <ArchLabel x={layout.rightLabelX} y={layout.height - 4}>
            LOWER LEFT
          </ArchLabel>

          {/* bite-line divider sa pagitan ng upper at lower arches */}
          <line
            x1={0}
            y1={layout.biteY}
            x2={layout.width}
            y2={layout.biteY}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      {/* Legend (kulay bawat grupo + letter codes ng clinic) at tagubilin */}
      <div className="mt-3 space-y-2 print:mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Wala sa print page (dati lumalabas ang "Only the dentist..." sa papel) */}
          {!printMode && (
            <p className="text-sm text-slate-600 print:hidden">
              {canEdit
                ? 'Tap a tooth to record a condition. You can pick or change the surface in the next step.'
                : 'Tap a tooth to view recorded findings and treatments.'}
            </p>
          )}
        </div>
        {!printMode && ((dentition === 'primary' && hasPermanentEntries) || (dentition === 'permanent' && hasPrimaryEntries)) && (
          <p className="text-sm text-slate-500">{dentitionLabel(dentition === 'primary' ? 'permanent' : 'primary')} also have chart entries. Select that set to view them.</p>
        )}
        <ConditionLegend expanded={printMode} />
      </div>

      {selection && !canEdit && (
        <ToothDetailsModal patientId={patientId} toothNumber={selection.toothNumber}
          surface={selection.surface} toothState={chartByTooth[selection.toothNumber] || {}}
          alerts={alerts} onClose={closeModal} />
      )}
      {selection && canEdit && (
        <ChartEntryModal
          patientId={patientId}
          toothNumber={selection.toothNumber}
          surface={selection.surface}
          toothState={chartByTooth[selection.toothNumber] || {}}
          alerts={alerts}
          dateOfBirth={dateOfBirth}
          onClose={closeModal}
          onSubmit={handleSaveEntry}
          onDelete={canEdit ? async (entryId) => {
            await deleteChartEntry(patientId, entryId)
            await load(true)
          } : undefined}
        />
      )}
    </div>
  )
}
