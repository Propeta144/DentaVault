// Mga bar na pang-compare ng magnitude — galing 'to sa mark spec ng
// dataviz skill's marks-and-anatomy.md: bar na hindi lalagpas sa 24px kapal
// (20px ang ginagamit), 4px rounded sa dulo ng data / square sa baseline,
// yung value naka-label sa tip (nasa labas ng bar, hindi sa loob, para
// hindi ma-clip kapag maiksi lang yung bar). `data` items: { label, value,
// color, tooltip? } — `tooltip` kapag kailangan ng mas mahabang paliwanag
// sa hover kaysa sa maikling label (hal. buong pangalan ng procedure). Lalabas lang yung legend kapag mahigit isa yung distinct colors
// na ginagamit — kasi kung single-hue naman, yung section title na mismo
// ang nagsasabi kung ano 'yon, sunod sa "single series needs no legend box"
// na rule.
export default function HorizontalBarChart({ data, showLegend = false }) {
  if (!data || data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="text-sm text-slate-400">No data yet.</p>
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const legendEntries = showLegend
    ? [...new Map(data.map((d) => [d.label, d.color])).entries()]
    : []

  return (
    <div>
      {showLegend && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {legendEntries.map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3" title={d.tooltip ?? `${d.label}: ${d.value}`}>
            <span className="w-36 shrink-0 truncate text-xs text-slate-600">{d.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded-r bg-slate-100">
              <div
                className="h-5 rounded-r"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-700">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
