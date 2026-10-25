import { useCallback, useEffect, useRef, useState } from 'react'
import { Baby } from 'lucide-react'
import Tooth from './Tooth'
import { TOOTH_BOX } from './toothShape'
import ChartEntryModal from './ChartEntryModal'
import ConditionLegend from './ConditionLegend'
import PageLoader from '../common/PageLoader'
import { ODONTOGRAM_ROWS, PRIMARY_ROWS, isPrimaryTooth } from '../../constants/dental'
import { getCurrentChart, createChartEntry } from '../../services/chart'

// Iisang sukat ng ngipin para sa layout at sa hugis (toothShape.js)
const TOOTH_SIZE = TOOTH_BOX
const TOOTH_GAP = 8
const QUADRANT_GAP = 24
const ARCH_LABEL_SPACE = 22 // UPPER RIGHT / LOWER LEFT na label
const NUMBER_SPACE = 30 // numero ng ngipin (itaas ng upper, ibaba ng lower)
const LETTER_SPACE = 26 // letter codes (D, F, ...) sa kabilang gilid
const BITE_GAP = 28 // pagitan ng upper at lower (may dashed na bite line)

// Baby teeth: bahagyang mas maliit, at nakahanay sa ilalim/ibabaw ng
// permanent na papalit sa kanila (55 sa tapat ng 15, 51 sa tapat ng 11),
// gaya ng papel na chart ng clinic.
const PRIMARY_SCALE = 0.85
const PRIMARY_COLUMN_OFFSET = 3 // 55 → column ng 15 (pang-4 sa hilera)

function toothX(indexInRow) {
  const midpoint = ODONTOGRAM_ROWS[0].length / 2
  const extraGap = indexInRow >= midpoint ? QUADRANT_GAP : 0
  return indexInRow * (TOOTH_SIZE + TOOTH_GAP) + extraGap
}

const CHART_WIDTH = toothX(ODONTOGRAM_ROWS[0].length - 1) + TOOTH_SIZE + 8

// Patayong ayos ng mga hilera. Kapag naka-on ang baby teeth: primary upper →
// permanent upper → bite line → permanent lower → primary lower (gaya ng papel
// ng clinic). Bawat ngipin: numero sa labas, letter codes palapit sa bite line.
function buildLayout(showPrimary) {
  const rows = []
  let y = ARCH_LABEL_SPACE
  const upper = showPrimary
    ? [
        { teeth: PRIMARY_ROWS[0], primary: true },
        { teeth: ODONTOGRAM_ROWS[0], primary: false },
      ]
    : [{ teeth: ODONTOGRAM_ROWS[0], primary: false }]
  for (const row of upper) {
    const size = TOOTH_SIZE * (row.primary ? PRIMARY_SCALE : 1)
    y += NUMBER_SPACE
    rows.push({ ...row, y, labelPosition: 'above' })
    y += size + LETTER_SPACE
  }
  const biteY = y + BITE_GAP / 2
  y += BITE_GAP
  const lower = showPrimary
    ? [
        { teeth: ODONTOGRAM_ROWS[1], primary: false },
        { teeth: PRIMARY_ROWS[1], primary: true },
      ]
    : [{ teeth: ODONTOGRAM_ROWS[1], primary: false }]
  for (const row of lower) {
    const size = TOOTH_SIZE * (row.primary ? PRIMARY_SCALE : 1)
    y += LETTER_SPACE
    rows.push({ ...row, y, labelPosition: 'below' })
    y += size + NUMBER_SPACE
  }
  return { rows, biteY, height: y + ARCH_LABEL_SPACE }
}

function rowToothX(row, i) {
  if (!row.primary) return toothX(i)
  // Nakagitna sa column ng katapat na permanent tooth
  return toothX(i + PRIMARY_COLUMN_OFFSET) + (TOOTH_SIZE * (1 - PRIMARY_SCALE)) / 2
}

// Yung Quadrant 1 (kanan ng pasyente, taas), nasa LEFT half ng chart siya —
// parang salamin kasi kung paano haharapin ng chart yung pasyente, kaya
// ganito talaga binabasa ng dentist. Yung maliliit na arch labels na 'to,
// nandiyan para may maka-orient agad kahit hindi memorized yung FDI
// notation (hal. defense panel, o pasyente mismo) — di na kailangan pang
// i-explain isa-isa yung tooth numbers.
const ARCH_MIDPOINT = ODONTOGRAM_ROWS[0].length / 2
const LEFT_HALF_CENTER_X = (toothX(0) + toothX(ARCH_MIDPOINT - 1) + TOOTH_SIZE) / 2
const RIGHT_HALF_CENTER_X = (toothX(ARCH_MIDPOINT) + toothX(ODONTOGRAM_ROWS[0].length - 1) + TOOTH_SIZE) / 2

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

// Ito lang ang module na nagre-render ng chart. Kapag may future 3D module
// balang araw, hiwalay na component na lang siya na babasa rin sa parehong
// /chart API — wala nang babaguhin dito para idagdag 'yon.
// printMode: Print Chart page (bukas ang letter codes sa legend; baby teeth
// lumalabas lang kapag may naitala, walang toggle button).
// alerts: { allergies, medicalHistory }, ipinapakita sa chart entry modal
export default function Odontogram2D({ patientId, canEdit, printMode = false, alerts }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // { toothNumber, surface }
  const [highlightedTooth, setHighlightedTooth] = useState(null)
  // null = sundin ang default (bukas kapag may naitalang baby tooth)
  const [showPrimaryChoice, setShowPrimaryChoice] = useState(null)
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

  // { toothNumber: { surfaceCode: entry } }
  const chartByTooth = entries.reduce((acc, entry) => {
    acc[entry.tooth_number] ??= {}
    acc[entry.tooth_number][entry.surface] = entry
    return acc
  }, {})

  function openTooth(toothNumber, surface) {
    returnFocusTo.current = toothNumber
    setFocusTooth(toothNumber)
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

  // Madalang ang batang pasyente (sabi ng clinic), kaya nakatago ang baby
  // teeth hangga't walang naitala o hindi binubuksan ng dentist
  const hasPrimaryEntries = entries.some((e) => isPrimaryTooth(e.tooth_number))
  const showPrimary = printMode ? hasPrimaryEntries : (showPrimaryChoice ?? hasPrimaryEntries)
  const layout = buildLayout(showPrimary)
  const visibleTeeth = layout.rows.flatMap((r) => r.teeth)
  const tabStopTooth = visibleTeeth.includes(focusTooth) ? focusTooth : visibleTeeth[0]

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
      <div data-odontogram-scroll className="-mx-1 overflow-x-auto px-1 py-2 print:mx-0 print:overflow-visible print:p-0">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${layout.height}`}
          className="mx-auto block h-auto w-full min-w-[600px]"
          style={{ maxWidth: CHART_WIDTH }}
          role="group"
          aria-label={canEdit ? 'Dental chart. Use arrow keys to move between teeth, Enter to open a tooth.' : 'Dental chart'}
          onKeyDown={canEdit ? handleChartKeyDown : undefined}
        >
          <defs>
            <filter id="tooth-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#171123" floodOpacity="0.18" />
            </filter>
          </defs>

          <ArchLabel x={LEFT_HALF_CENTER_X} y={14}>
            UPPER RIGHT
          </ArchLabel>
          <ArchLabel x={RIGHT_HALF_CENTER_X} y={14}>
            UPPER LEFT
          </ArchLabel>

          {layout.rows.map((row) =>
            row.teeth.map((toothNumber, i) => (
              <Tooth
                key={toothNumber}
                toothNumber={toothNumber}
                x={rowToothX(row, i)}
                y={row.y}
                scale={row.primary ? PRIMARY_SCALE : 1}
                labelPosition={row.labelPosition}
                chartState={chartByTooth[toothNumber] || {}}
                canEdit={canEdit}
                highlighted={toothNumber === highlightedTooth}
                onSurfaceClick={(tooth, surface) => openTooth(tooth, surface)}
                onWholeClick={(tooth) => openTooth(tooth, 'whole')}
                tabIndex={toothNumber === tabStopTooth ? 0 : -1}
                onFocus={() => setFocusTooth(toothNumber)}
              />
            )),
          )}

          <ArchLabel x={LEFT_HALF_CENTER_X} y={layout.height - 4}>
            LOWER RIGHT
          </ArchLabel>
          <ArchLabel x={RIGHT_HALF_CENTER_X} y={layout.height - 4}>
            LOWER LEFT
          </ArchLabel>

          {/* bite-line divider sa pagitan ng upper at lower arches */}
          <line
            x1={0}
            y1={layout.biteY}
            x2={CHART_WIDTH}
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
                : 'Only the dentist can update the chart.'}
            </p>
          )}
          {!printMode && (
            <button
              type="button"
              aria-pressed={showPrimary}
              onClick={() => setShowPrimaryChoice(!showPrimary)}
              className="flex min-h-11 items-center justify-center gap-2 self-start whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto print:hidden"
            >
              <Baby className="h-4 w-4" />
              {showPrimary ? 'Hide baby teeth' : 'Show baby teeth'}
            </button>
          )}
        </div>
        <ConditionLegend expanded={printMode} />
      </div>

      {selection && (
        <ChartEntryModal
          patientId={patientId}
          toothNumber={selection.toothNumber}
          surface={selection.surface}
          toothState={chartByTooth[selection.toothNumber] || {}}
          alerts={alerts}
          onClose={closeModal}
          onSubmit={handleSaveEntry}
        />
      )}
    </div>
  )
}
