// Kapag walang laman ang isang listahan. Dati plain na text lang ("No X-ray
// images yet."), walang sinasabi kung ano ang susunod na gagawin. Ngayon:
// icon + title + maikling paliwanag + optional na button (hal. "Upload").
// `compact`: para sa loob ng card/tab (mas maliit na padding).
export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-12'
      }`}
    >
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
