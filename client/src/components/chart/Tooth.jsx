import {
  conditionColor,
  conditionLabel,
  conditionLetter,
  isMissingCondition,
  toothOrientation,
  UNMARKED_COLOR,
  UNMARKED_STROKE,
  SURFACES,
} from '../../constants/dental'

import { TOOTH_BOX, toothShape } from './toothShape'

// Pinalaki 'to galing sa original 40px cell para talagang ma-tap yung bawat
// surface — pati yung number sa ilalim — sa tablet touchscreen, hindi lang
// basta readable sa desktop monitor.
const SIZE = TOOTH_BOX

// Hugis-ngipin na 5-surface diagram (tignan ang toothShape.js): gitnang
// bahagi (occlusal / incisal) na napapaligiran ng apat na bahagi (facial,
// lingual, mesial, distal). Depende sa quadrant kung aling screen position
// (top/bottom/left/right) ang aling anatomical surface — toothOrientation().

function surfaceLabel(code) {
  return SURFACES.find((s) => s.code === code)?.label || code
}

const SURFACE_ORDER = ['whole', 'occlusal', 'mesial', 'distal', 'facial', 'lingual']

// Mga letter code ng clinic (D, F, J, ...) para sa isang ngipin, walang
// ulit. Kapag may whole-tooth entry na pareho sa lahat ng surface, isa lang.
// Ang "✓" (Present) ay ipinapakita lang kapag iyon lang ang naitala.
export function toothLetters(chartState) {
  const codes = []
  for (const surface of SURFACE_ORDER) {
    const code = chartState[surface]?.condition_code
    if (code && !codes.includes(code)) codes.push(code)
  }
  const meaningful = codes.filter((c) => c !== 'healthy')
  return meaningful.length > 0 ? meaningful : codes
}

export default function Tooth({
  toothNumber,
  x,
  y,
  scale = 1,
  labelPosition = 'below',
  chartState,
  canEdit,
  highlighted,
  onSurfaceClick,
  onWholeClick,
  // Roving tabindex (Odontogram2D): iisang ngipin lang ang nasa Tab order;
  // arrow keys ang paglipat sa ibang ngipin
  tabIndex = 0,
  onFocus,
}) {
  const orientation = toothOrientation(toothNumber)
  const positionToSurface = {
    [orientation.facialSide]: 'facial',
    [orientation.lingualSide]: 'lingual',
    [orientation.mesialSide]: 'mesial',
    [orientation.distalSide]: 'distal',
    center: 'occlusal',
  }

  const shape = toothShape(toothNumber)
  const wholeEntry = chartState.whole
  // Lahat ng "wala na ang ngipin" (Extracted, Missing, Congenitally Missing...)
  const isMissing = isMissingCondition(wholeEntry?.condition_code)

  // Letter codes: nasa kabilang gilid ng numero (palapit sa bite line), gaya
  // ng mga kahon sa papel na chart ng clinic. Hanggang 3 ang ipinapakita;
  // nasa tooltip ang lahat.
  const codes = toothLetters(chartState)
  const shownLetters = codes.slice(0, 3).map(conditionLetter).join(' ')
  const lettersY = labelPosition === 'above' ? SIZE + 18 : -8

  function fillFor(surfaceCode) {
    const entry = chartState[surfaceCode]
    return entry ? conditionColor(entry.condition_code) : UNMARKED_COLOR
  }

  // Keyboard (critique 2026-10-25): dati onClick lang ang bawat surface, kaya
  // hindi maabot ng Tab ang buong chart (WCAG 2.1.1). Ngayon bawat ngipin ay
  // isang button: Enter/Space → modal (doon pinipili ang surface).
  const findings = codes.filter((c) => c !== 'healthy').map(conditionLabel)
  const ariaLabel = `Tooth ${toothNumber}${findings.length ? `: ${findings.join(', ')}` : ', no findings'}`

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isMissing) onWholeClick(toothNumber)
      else onSurfaceClick(toothNumber, 'occlusal')
    }
  }

  return (
    <g
      transform={`translate(${x},${y}) scale(${scale})`}
      filter="url(#tooth-shadow)"
      className={`group outline-none ${highlighted ? 'animate-[pulse_1s_ease-in-out_2]' : ''}`}
      {...(canEdit
        ? {
            id: `tooth-${toothNumber}`,
            role: 'button',
            tabIndex,
            'aria-label': ariaLabel,
            onKeyDown: handleKeyDown,
            onFocus,
          }
        : { role: 'img', 'aria-label': ariaLabel })}
    >
      {/* Mas malaking tap area (hanggang kalahati ng puwang sa katabing
          ngipin): sa tablet ~42px lang ang lapad ng ngipin. Ang pagtapik sa
          gilid ay bubukas sa Occlusal; sa modal itinatama ang surface. */}
      {canEdit && (
        <rect
          x={-4}
          y={-4}
          width={SIZE + 8}
          height={SIZE + 8}
          fill="transparent"
          onClick={() => (isMissing ? onWholeClick(toothNumber) : onSurfaceClick(toothNumber, 'occlusal'))}
          className="cursor-pointer"
        />
      )}
      {/* Focus ring (keyboard lang): SVG ay walang maaasahang CSS outline */}
      {canEdit && (
        <rect
          x={-5}
          y={-5}
          width={SIZE + 10}
          height={SIZE + 10}
          rx={10}
          fill="none"
          stroke="#6f2dbd"
          strokeWidth={3}
          pointerEvents="none"
          className="opacity-0 group-focus-visible:opacity-100"
        />
      )}
      {isMissing ? (
        <g
          onClick={() => canEdit && onWholeClick(toothNumber)}
          className={canEdit ? 'cursor-pointer transition-all duration-150 hover:brightness-90' : ''}
        >
          <title>{`Tooth ${toothNumber}: ${conditionLabel(wholeEntry.condition_code)}`}</title>
          <polygon
            points={shape.outline}
            fill={conditionColor(wholeEntry.condition_code)}
            stroke={UNMARKED_STROKE}
            strokeWidth={0.75}
          />
          <line
            x1={16}
            y1={16}
            x2={SIZE - 16}
            y2={SIZE - 16}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line
            x1={SIZE - 16}
            y1={16}
            x2={16}
            y2={SIZE - 16}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      ) : (
        <>
          {Object.entries(shape.regions).map(([position, points]) => {
            const surfaceCode = positionToSurface[position]
            return (
              <polygon
                key={position}
                points={points}
                fill={fillFor(surfaceCode)}
                stroke={UNMARKED_STROKE}
                strokeWidth={0.75}
                strokeLinejoin="round"
                onClick={() => canEdit && onSurfaceClick(toothNumber, surfaceCode)}
                className={canEdit ? 'cursor-pointer transition-all duration-150 hover:brightness-90' : ''}
              >
                {canEdit && <title>{`Tooth ${toothNumber}, ${surfaceLabel(surfaceCode)}`}</title>}
              </polygon>
            )
          })}
          {/* Palamuti lang (hindi napipindot): fissure sa biting surface at
              mas madilim na balangkas ng ngipin */}
          {shape.grooves && (
            <path
              d={shape.grooves}
              fill="none"
              stroke="#171123"
              strokeOpacity={0.14}
              strokeWidth={1.25}
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}
          <polygon
            points={shape.outline}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        </>
      )}
      {codes.length > 0 && (
        <text
          x={SIZE / 2}
          y={lettersY}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#171123"
          pointerEvents="none"
          className="select-none"
        >
          <title>{codes.map(conditionLabel).join(', ')}</title>
          {shownLetters}
          {codes.length > 3 ? ' +' : ''}
        </text>
      )}
      {/* Invisible hit area, mas malaki pa sa mismong nakalimbag na numero,
          para talagang matap yung "click the number to open the whole-tooth
          view" na affordance — hindi na kailangan ng sobrang precise na tap
          sa 12px na text. */}
      <rect
        x={SIZE / 2 - 16}
        y={labelPosition === 'above' ? -24 : SIZE + 4}
        width={32}
        height={22}
        fill="transparent"
        onClick={() => canEdit && onWholeClick(toothNumber)}
        className={canEdit ? 'cursor-pointer' : ''}
      />
      <text
        x={SIZE / 2}
        y={labelPosition === 'above' ? -8 : SIZE + 20}
        textAnchor="middle"
        // 16 (hindi 12): lumiliit na ang buong chart para magkasya sa
        // laptop (~60%), kaya ~10px pa rin ang numero doon imbes na ~7px.
        fontSize="16"
        fontWeight="600"
        fill="#334155"
        onClick={() => canEdit && onWholeClick(toothNumber)}
        className={canEdit ? 'cursor-pointer select-none' : 'select-none'}
      >
        {toothNumber}
      </text>
    </g>
  )
}
