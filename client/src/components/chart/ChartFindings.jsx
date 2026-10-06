import { useMemo } from 'react'
import { CONDITIONS, FDI_TEETH, SURFACES, conditionColor } from '../../constants/dental'
import { formatDate } from '../../utils/formatDate'

// Listahan ng findings sa ilalim ng 2D at 3D Print Chart (Feature #22):
// pinakabagong entry bawat ngipin + surface (galing getCurrentChart), kasama
// ang notes at petsa na hindi nakikita sa mismong chart. Nakasulat din ang
// pangalan ng kondisyon, kaya nababasa kahit black-and-white ang printer.

const SURFACE_ORDER = ['whole', 'occlusal', 'mesial', 'distal', 'facial', 'lingual']

// SVG na bilog (hindi div na may background): kusang tinatanggal ng browser
// ang background colors kapag nagpi-print, pero hindi ang SVG fill. Gamit
// din ng legend ng 2D chart (Odontogram2D).
export function ColorDot({ color, className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 14 14" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill={color} stroke="rgba(0,0,0,0.15)" />
    </svg>
  )
}

export default function ChartFindings({ entries }) {
  const findings = useMemo(
    () =>
      entries
        .slice()
        .sort(
          (a, b) =>
            FDI_TEETH.indexOf(a.tooth_number) - FDI_TEETH.indexOf(b.tooth_number) ||
            SURFACE_ORDER.indexOf(a.surface) - SURFACE_ORDER.indexOf(b.surface),
        ),
    [entries],
  )

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Findings</h2>
      {findings.length === 0 ? (
        <p className="text-sm text-slate-500">No findings recorded on the chart yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-3">Tooth</th>
              <th className="py-2 pr-3">Surface</th>
              <th className="py-2 pr-3">Condition</th>
              <th className="py-2 pr-3">Notes</th>
              <th className="py-2">Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {findings.map((f) => (
              <tr key={`${f.tooth_number}-${f.surface}`} className="break-inside-avoid align-top">
                <td className="py-1.5 pr-3 font-medium">{f.tooth_number}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {SURFACES.find((s) => s.code === f.surface)?.label || f.surface}
                </td>
                <td className="py-1.5 pr-3">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <ColorDot color={conditionColor(f.condition_code)} />
                    {CONDITIONS.find((c) => c.code === f.condition_code)?.label || f.condition_code}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-slate-600">{f.notes || '—'}</td>
                <td className="py-1.5 whitespace-nowrap text-slate-600">{formatDate(f.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
