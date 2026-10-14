import { CONDITIONS, CONDITION_GROUPS } from '../../constants/dental'
import { ColorDot } from './ChartFindings'

// Iisang legend ng chart (2D, 3D, at print). Dalawang bahagi:
// 1. Kulay bawat GRUPO (7 lang, kaya madaling tandaan)
// 2. Letter codes ng clinic (D = Decayed, F = Filled, ...), kapareho ng
//    legend sa papel na chart nila. Ito ang nakasulat sa mismong ngipin.
// Sa screen, nakatiklop ang letter codes (`<details>`) para hindi mahaba;
// sa print (`expanded`), laging bukas.
export default function ConditionLegend({ expanded = false }) {
  const letters = (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:text-xs">
      {CONDITIONS.map((c) => (
        <li key={c.code} className="flex items-baseline gap-2">
          <span className="inline-block w-7 shrink-0 font-semibold text-slate-900">{c.letter}</span>
          {c.label}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
        {CONDITION_GROUPS.map((g) => (
          <li key={g.code} className="flex items-center gap-1.5 text-sm text-slate-600">
            {/* SVG, hindi background color: lumalabas pa rin ang kulay kapag ipinrint */}
            <ColorDot color={g.color} className="h-3 w-3" />
            {g.label}
          </li>
        ))}
      </ul>
      {expanded ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Letter codes</p>
          {letters}
        </div>
      ) : (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-sky-600 hover:text-sky-700">
            Letter codes (D, F, J, ...)
          </summary>
          <div className="mt-1">{letters}</div>
        </details>
      )}
    </div>
  )
}
