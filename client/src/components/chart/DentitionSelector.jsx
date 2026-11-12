import { Baby, Smile } from 'lucide-react'

export default function DentitionSelector({ value, onChange }) {
  return (
    <div role="group" aria-label="Teeth shown" className="flex gap-1.5 self-start rounded-lg border border-slate-200 bg-slate-100 p-1">
      {[
        { code: 'permanent', label: 'Adult teeth', icon: Smile },
        { code: 'primary', label: 'Baby teeth', icon: Baby },
      ].map(({ code, label, icon: Icon }) => (
        <button key={code} type="button" aria-pressed={value === code} onClick={() => onChange(code)}
          className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors ${value === code
            ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  )
}
