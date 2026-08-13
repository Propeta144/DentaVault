const VARIANTS = {
  slate: 'bg-slate-100 text-slate-700',
  sky: 'bg-sky-50 text-sky-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
}

export default function StatusBadge({ children, variant = 'slate', icon: Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANTS[variant]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
