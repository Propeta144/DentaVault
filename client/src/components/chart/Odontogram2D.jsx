import { useCallback, useEffect, useState } from 'react'
import Tooth from './Tooth'
import ChartEntryModal from './ChartEntryModal'
import { ODONTOGRAM_ROWS, CONDITIONS } from '../../constants/dental'
import { getCurrentChart, createChartEntry } from '../../services/chart'

// Dapat tugma 'to sa SIZE constant ng Tooth.jsx — hiwalay lang sila sa
// magkaibang files (isa ang gumagawa ng SVG geometry ng isang ngipin, yung
// isa naman ang naglalayout sa buong grid) pero same physical cell size
// naman ang tinutukoy nila.
const TOOTH_SIZE = 56
const TOOTH_GAP = 8
const QUADRANT_GAP = 24
const ROW_GAP = 110
const TOP_MARGIN = 44
const ARCH_LABEL_GAP = 14

function toothX(indexInRow) {
  const midpoint = ODONTOGRAM_ROWS[0].length / 2
  const extraGap = indexInRow >= midpoint ? QUADRANT_GAP : 0
  return indexInRow * (TOOTH_SIZE + TOOTH_GAP) + extraGap
}

const CHART_WIDTH = toothX(ODONTOGRAM_ROWS[0].length - 1) + TOOTH_SIZE + 8
const CHART_HEIGHT = ROW_GAP + TOOTH_SIZE * 2 + TOP_MARGIN * 2 + ARCH_LABEL_GAP

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
      fontSize="8.5"
      fontWeight="600"
      letterSpacing="0.5"
      fill="#94a3b8"
    >
      {children}
    </text>
  )
}

// Ito lang ang module na nagre-render ng chart. Kapag may future 3D module
// balang araw, hiwalay na component na lang siya na babasa rin sa parehong
// /chart API — wala nang babaguhin dito para idagdag 'yon.
export default function Odontogram2D({ patientId, canEdit }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // { toothNumber, surface }
  const [highlightedTooth, setHighlightedTooth] = useState(null)

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

  // { toothNumber: { surfaceCode: entry } }
  const chartByTooth = entries.reduce((acc, entry) => {
    acc[entry.tooth_number] ??= {}
    acc[entry.tooth_number][entry.surface] = entry
    return acc
  }, {})

  async function handleSaveEntry(payload) {
    await createChartEntry(patientId, payload)
    await load()
    // Sandaling highlight lang, para makita agad kung aling ngipin yung
    // kakabago lang, lalo na pag whole-tooth save na lahat ng 5 surfaces
    // sabay-sabay nag-update.
    setHighlightedTooth(payload.toothNumber)
    setTimeout(() => setHighlightedTooth(null), 2000)
  }

  if (loading) return <p className="text-sm text-slate-400">Loading chart...</p>

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/*
        Sinadya na HINDI siya naka-scale para bumagay sa viewport width
        (walang w-full/max-w-* sa svg). Kasi sa phone, kapag pinaliit yung
        16-tooth row papuntang ~350px, magiging sobrang liit na ng bawat isa
        sa 5 surface regions para pa i-touch nang maayos. Kaya fixed at
        laging-readable na pixel size na lang ang ginagamit ng chart, tapos
        naka-horizontal scroll na lang yung container sa maliliit na screen
        — same tradeoff din ginagawa ng totoong dental charting software.
      */}
      {/*
        print:overflow-visible + print:w-full sa svg sa baba: yung fixed-width
        horizontal-scroll layout sa taas, okay para sa touch screens pero
        di magagamit sa papel — kasi kahit ano lampas sa edge ng print
        viewport, hindi na lalabas, tahimik na ma-tutruncate yung upper-right
        at lower-right quadrants. Sa print media, sinasukat na lang ang SVG
        para bumagay sa page width, gamit yung viewBox niya para manatiling
        proportional.
      */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 print:overflow-visible print:border-0 print:p-0 print:shadow-none">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          className="mx-auto block print:h-auto print:w-full"
        >
          <defs>
            <filter id="tooth-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
          </defs>

          <ArchLabel x={LEFT_HALF_CENTER_X} y={10}>
            UPPER RIGHT
          </ArchLabel>
          <ArchLabel x={RIGHT_HALF_CENTER_X} y={10}>
            UPPER LEFT
          </ArchLabel>

          {ODONTOGRAM_ROWS.map((row, rowIndex) => {
            const y = rowIndex === 0 ? TOP_MARGIN : TOP_MARGIN + TOOTH_SIZE + ROW_GAP
            return row.map((toothNumber, i) => (
              <Tooth
                key={toothNumber}
                toothNumber={toothNumber}
                x={toothX(i)}
                y={y}
                labelPosition={rowIndex === 0 ? 'above' : 'below'}
                chartState={chartByTooth[toothNumber] || {}}
                canEdit={canEdit}
                highlighted={toothNumber === highlightedTooth}
                onSurfaceClick={(tooth, surface) => setSelection({ toothNumber: tooth, surface })}
                onWholeClick={(tooth) => setSelection({ toothNumber: tooth, surface: 'whole' })}
              />
            ))
          })}

          <ArchLabel x={LEFT_HALF_CENTER_X} y={CHART_HEIGHT - 4}>
            LOWER RIGHT
          </ArchLabel>
          <ArchLabel x={RIGHT_HALF_CENTER_X} y={CHART_HEIGHT - 4}>
            LOWER LEFT
          </ArchLabel>

          {/* bite-line divider sa pagitan ng upper at lower arches */}
          <line
            x1={0}
            y1={TOP_MARGIN + TOOTH_SIZE + ROW_GAP / 2}
            x2={CHART_WIDTH}
            y2={TOP_MARGIN + TOOTH_SIZE + ROW_GAP / 2}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Legend</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {CONDITIONS.map((c) => (
            <div key={c.code} className="flex items-center gap-1.5 text-base text-slate-600">
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: c.color }}
              />
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
          onClose={() => setSelection(null)}
          onSubmit={handleSaveEntry}
        />
      )}
    </div>
  )
}
