// Skeleton loaders: kulay-abong "hugis" ng listahan habang naglo-load, para
// hindi tumatalon ang layout pagdating ng data (dati spinner sa gitna, tapos
// biglang lilitaw ang buong table). Para lang ito sa mga listahan; ang
// PageLoader pa rin ang gamit habang dina-download ang mismong page.
//
// role="status" + sr-only na label: para alam ng screen reader na
// naglo-load, kahit hindi nila nakikita ang mga kahon.
export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />
}

export function SkeletonRows({ rows = 6, label = 'Loading...' }) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0">
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-1/3" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="hidden h-3.5 w-20 sm:block" />
        </div>
      ))}
    </div>
  )
}
