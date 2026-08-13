// Konting headline numbers lang → KPI row ng stat tiles, hindi chart —
// tignan yung dataviz skill's choosing-a-form.md. Optional lang yung
// `accent`, para lang sa value na ibig sabihin "kailangan pansinin 'to"
// (hal. unreviewed X-rays); naka-off siya by default para karamihan sa
// tiles, parang neutral fact lang basahin, hindi parang alerto.
export default function StatTile({ label, value, icon: Icon, accent = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${accent ? 'text-amber-500' : 'text-slate-400'}`} />}
      </div>
      <p className={`mt-2 text-3xl font-semibold ${accent ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}
