import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

// Konting headline numbers lang → KPI row ng stat tiles, hindi chart —
// tignan yung dataviz skill's choosing-a-form.md. Optional lang yung
// `accent`, para lang sa value na ibig sabihin "kailangan pansinin 'to"
// (hal. unreviewed X-rays); naka-off siya by default para karamihan sa
// tiles, parang neutral fact lang basahin, hindi parang alerto.
//
// Label: sentence case (dataviz stat tile contract), dati UPPERCASE.
// `hint`: maikling paliwanag sa ilalim ng numero (hal. "this month").
// `to`: kapag may page na pupuntahan, buong tile ang link.
export default function StatTile({ label, value, icon: Icon, accent = false, hint, to }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {/* Icon: sm pataas lang — sa phone, 2 tile bawat hanay, kaya kapag
            may icon, nahahati sa dalawang linya ang label */}
        {Icon && (
          <span
            className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex ${
              accent ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`text-3xl font-semibold tabular-nums ${accent ? 'text-amber-700' : 'text-slate-900'}`}>
        {value.toLocaleString()}
      </p>
      {(hint || to) && (
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
          {hint}
          {to && <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-colors group-hover:text-sky-600" />}
        </p>
      )}
    </>
  )

  const className = 'group block rounded-xl border bg-white p-4 shadow-sm transition-colors'
  const border = accent ? 'border-amber-200' : 'border-slate-200'

  if (to) {
    return (
      <Link to={to} className={`${className} ${border} hover:border-sky-300`}>
        {content}
      </Link>
    )
  }
  return <div className={`${className} ${border}`}>{content}</div>
}
