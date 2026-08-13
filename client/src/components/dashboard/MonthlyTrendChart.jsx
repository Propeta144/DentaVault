import { format, parse } from 'date-fns'
import { TREND_SERIES } from '../../constants/dashboardColors'

// Dalawang magkaibang series (new patients vs treatments) pero iisang axis
// lang — grouped bar per month, hindi dual-axis chart (yung "one axis" rule
// sa dataviz skill: dalawang measures na magkaiba ng scale, dapat hiwalay
// silang chart o shared scale na lang, huwag na dalawang y-scales). Maliliit
// lang naman yung counts dito, kaya okay lang na shared scale. Kailangan
// talaga ng legend pag 2+ na series; skinip yung per-bar value labels,
// hover tooltip na lang, kasi 6 months × 2 bars naman, malinaw na basahin
// kahit wala nun — tignan yung "label selectively, never a number on every
// point" sa marks-and-anatomy.md.
export default function MonthlyTrendChart({ data }) {
  if (!data || data.every((d) => d.newPatients === 0 && d.treatments === 0)) {
    return <p className="text-sm text-slate-400">No activity in the last 6 months yet.</p>
  }

  const max = Math.max(...data.flatMap((d) => [d.newPatients, d.treatments]), 1)
  const CHART_HEIGHT = 120

  return (
    <div>
      <div className="mb-3 flex gap-4">
        {Object.values(TREND_SERIES).map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <div className="flex items-end justify-between gap-2" style={{ height: CHART_HEIGHT }}>
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full items-end gap-0.5">
              <div
                className="w-3 rounded-t"
                style={{
                  height: `${(d.newPatients / max) * (CHART_HEIGHT - 8)}px`,
                  backgroundColor: TREND_SERIES.newPatients.color,
                  minHeight: d.newPatients > 0 ? 2 : 0,
                }}
                title={`${TREND_SERIES.newPatients.label}: ${d.newPatients}`}
              />
              <div
                className="w-3 rounded-t"
                style={{
                  height: `${(d.treatments / max) * (CHART_HEIGHT - 8)}px`,
                  backgroundColor: TREND_SERIES.treatments.color,
                  minHeight: d.treatments > 0 ? 2 : 0,
                }}
                title={`${TREND_SERIES.treatments.label}: ${d.treatments}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between gap-2">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[10px] text-slate-500">
            {format(parse(d.month, 'yyyy-MM', new Date()), 'MMM')}
          </span>
        ))}
      </div>
    </div>
  )
}
