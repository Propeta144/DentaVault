import { useState } from 'react'
import { format, parse } from 'date-fns'
import { TREND_SERIES } from '../../constants/dashboardColors'

// Dalawang magkaibang series (new patients vs treatments) pero iisang axis
// lang — grouped column per month, hindi dual-axis chart (yung "one axis"
// rule sa dataviz skill). Maliliit lang naman yung counts dito, kaya okay
// lang na shared scale.
//
// Dati walang axis o bilang, kaya hindi mo alam kung ilan ang taas ng bawat
// bar. Ngayon (ayon sa dataviz marks-and-anatomy.md):
// - y-axis ticks sa malilinis na numero + 1px solid na gridlines (recessive)
// - columns <= 24px, 4px rounded sa dulo, square sa baseline, 2px na pagitan
// - walang numero sa bawat bar ("label selectively"); ang ticks at tooltip
//   ang nagdadala ng eksaktong value
// - iisang tooltip bawat buwan na may PAREHONG series (hover o keyboard focus)
// - sr-only na table para sa screen reader

const CHART_HEIGHT = 140

// Malinis na hakbang ng ticks: 1, 2, 5, 10, 20, 50... para hindi hihigit
// sa ~4 na gridline.
function niceScale(max) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
  const step = steps.find((s) => max / s <= 4) || Math.ceil(max / 4)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

function monthLabel(month, pattern) {
  return format(parse(month, 'yyyy-MM', new Date()), pattern)
}

export default function MonthlyTrendChart({ data }) {
  const [active, setActive] = useState(null)

  if (!data || data.every((d) => d.newPatients === 0 && d.treatments === 0)) {
    return <p className="py-8 text-center text-sm text-slate-400">No activity in the last 6 months yet.</p>
  }

  const max = Math.max(...data.flatMap((d) => [d.newPatients, d.treatments]), 1)
  const { top, ticks } = niceScale(max)
  const series = [
    { key: 'newPatients', ...TREND_SERIES.newPatients },
    { key: 'treatments', ...TREND_SERIES.treatments },
  ]

  return (
    <div>
      {/* Legend: laging meron kapag 2+ series; text ink, kulay nasa swatch lang */}
      <div className="mb-4 flex gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-sm text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {/* Y-axis ticks */}
        <div className="relative w-6 shrink-0" style={{ height: CHART_HEIGHT }} aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-slate-400"
              style={{ top: CHART_HEIGHT - (t / top) * CHART_HEIGHT }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Gridlines: 1px, solid, recessive */}
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden="true"
              className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-slate-300' : 'bg-slate-100'}`}
              style={{ top: CHART_HEIGHT - (t / top) * CHART_HEIGHT }}
            />
          ))}

          <div className="relative flex items-end justify-around" style={{ height: CHART_HEIGHT }}>
            {data.map((d) => (
              <div
                key={d.month}
                tabIndex={0}
                role="img"
                aria-label={`${monthLabel(d.month, 'MMMM yyyy')}: ${d.newPatients} new patients, ${d.treatments} treatments`}
                onMouseEnter={() => setActive(d.month)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.month)}
                onBlur={() => setActive(null)}
                // Mas malaki ang hit target kaysa sa bar mismo: buong column ng buwan
                className="relative flex h-full flex-1 cursor-default items-end justify-center gap-0.5 rounded-sm outline-none focus-visible:bg-sky-50"
              >
                {series.map((s) => (
                  <div
                    key={s.key}
                    className="w-5 rounded-t transition-opacity"
                    style={{
                      height: `${(d[s.key] / top) * CHART_HEIGHT}px`,
                      minHeight: d[s.key] > 0 ? 2 : 0,
                      backgroundColor: s.color,
                      opacity: active && active !== d.month ? 0.45 : 1,
                    }}
                  />
                ))}

                {active === d.month && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                    <p className="mb-1 font-medium text-slate-900">{monthLabel(d.month, 'MMMM yyyy')}</p>
                    {series.map((s) => (
                      <p key={s.key} className="flex items-center gap-2 text-slate-600">
                        <span className="h-0.5 w-3 rounded" style={{ backgroundColor: s.color }} />
                        <span className="font-semibold tabular-nums text-slate-900">{d[s.key]}</span>
                        {s.label}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month labels, naka-align sa columns */}
      <div className="mt-2 flex gap-2" aria-hidden="true">
        <div className="w-6 shrink-0" />
        <div className="flex flex-1 justify-around">
          {data.map((d) => (
            <span key={d.month} className="flex-1 text-center text-xs text-slate-500">
              {monthLabel(d.month, 'MMM')}
            </span>
          ))}
        </div>
      </div>

      {/* Table view para sa screen reader (nakatago sa paningin). Nasa loob
          ng sr-only na div, hindi sr-only mismo ang table: hindi lumiliit
          ang table nang mas maliit sa laman niya, kaya nagdudulot ito ng
          horizontal scroll sa phone. */}
      <div className="sr-only">
      <table>
        <caption>New patients and treatments per month, last 6 months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th scope="row">{monthLabel(d.month, 'MMMM yyyy')}</th>
              {series.map((s) => (
                <td key={s.key}>{d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
