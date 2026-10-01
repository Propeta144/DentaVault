import {
  conditionColor,
  toothOrientation,
  UNMARKED_COLOR,
  UNMARKED_STROKE,
  SURFACES,
} from '../../constants/dental'

// Pinalaki 'to galing sa original 40px cell para talagang ma-tap yung bawat
// surface — pati yung number sa ilalim — sa tablet touchscreen, hindi lang
// basta readable sa desktop monitor.
const SIZE = 56
const MARGIN = 16
const INNER = SIZE - MARGIN // 40

// Yung classic 5-surface "envelope" diagram: may center square (occlusal /
// incisal) na nakapaligiran ng apat na trapezoid (facial, lingual, mesial,
// distal). Depende sa quadrant ng ngipin kung aling screen position
// (top/bottom/left/right) ang tumutugma sa aling anatomical surface —
// tignan yung toothOrientation().
const REGION_POINTS = {
  top: `0,0 ${SIZE},0 ${INNER},${MARGIN} ${MARGIN},${MARGIN}`,
  bottom: `0,${SIZE} ${SIZE},${SIZE} ${INNER},${INNER} ${MARGIN},${INNER}`,
  left: `0,0 ${MARGIN},${MARGIN} ${MARGIN},${INNER} 0,${SIZE}`,
  right: `${SIZE},0 ${INNER},${MARGIN} ${INNER},${INNER} ${SIZE},${SIZE}`,
  center: `${MARGIN},${MARGIN} ${INNER},${MARGIN} ${INNER},${INNER} ${MARGIN},${INNER}`,
}

function surfaceLabel(code) {
  return SURFACES.find((s) => s.code === code)?.label || code
}

export default function Tooth({
  toothNumber,
  x,
  y,
  labelPosition = 'below',
  chartState,
  canEdit,
  highlighted,
  onSurfaceClick,
  onWholeClick,
}) {
  const orientation = toothOrientation(toothNumber)
  const positionToSurface = {
    [orientation.facialSide]: 'facial',
    [orientation.lingualSide]: 'lingual',
    [orientation.mesialSide]: 'mesial',
    [orientation.distalSide]: 'distal',
    center: 'occlusal',
  }

  const wholeEntry = chartState.whole
  const isExtracted = wholeEntry?.condition_code === 'extracted'

  function fillFor(surfaceCode) {
    const entry = chartState[surfaceCode]
    return entry ? conditionColor(entry.condition_code) : UNMARKED_COLOR
  }

  return (
    <g
      transform={`translate(${x},${y})`}
      filter="url(#tooth-shadow)"
      className={highlighted ? 'animate-[pulse_1s_ease-in-out_2]' : ''}
    >
      {isExtracted ? (
        <g
          onClick={() => canEdit && onWholeClick(toothNumber)}
          className={canEdit ? 'cursor-pointer transition-all duration-150 hover:brightness-90' : ''}
        >
          <title>{`Tooth ${toothNumber} — Extracted / Missing`}</title>
          <rect
            width={SIZE}
            height={SIZE}
            fill={conditionColor('extracted')}
            stroke={UNMARKED_STROKE}
            rx={8}
          />
          <line
            x1={10}
            y1={10}
            x2={SIZE - 10}
            y2={SIZE - 10}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <line
            x1={SIZE - 10}
            y1={10}
            x2={10}
            y2={SIZE - 10}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      ) : (
        <>
          {Object.entries(REGION_POINTS).map(([position, points]) => {
            const surfaceCode = positionToSurface[position]
            return (
              <polygon
                key={position}
                points={points}
                fill={fillFor(surfaceCode)}
                stroke={UNMARKED_STROKE}
                strokeWidth={0.75}
                onClick={() => canEdit && onSurfaceClick(toothNumber, surfaceCode)}
                className={canEdit ? 'cursor-pointer transition-all duration-150 hover:brightness-90' : ''}
              >
                {canEdit && <title>{`Tooth ${toothNumber} — ${surfaceLabel(surfaceCode)}`}</title>}
              </polygon>
            )
          })}
        </>
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
