import { useId } from 'react'

// Textarea na may quick-pick na presets (hal. "None", "+ Penicillin").
//
// Responsive: sa phone, nasa ilalim ng label ang presets (dati magkatabi,
// kaya nagsisiksikan at nababalot sa makitid na screen). Presets: min 36px
// ang taas at text-sm (dati ~22px, mahirap tapikin sa tablet/phone).
// Naka-link ang label sa textarea (htmlFor + id) para sa screen reader.
export default function QuickInputTextarea({
  label,
  value,
  onChange,
  presets = ['None'],
  placeholder = 'Type details here...',
}) {
  const id = useId()

  const handleSelectPreset = (preset) => {
    if (preset === 'None') {
      onChange('None')
      return
    }

    if (!value || value.trim() === '' || value.trim().toLowerCase() === 'none') {
      onChange(preset)
    } else {
      if (!value.includes(preset)) {
        onChange(`${value}, ${preset}`)
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={id} className="text-base font-medium text-slate-700">
          {label}
        </label>

        {/* Quick Action Badges */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Quick options for ${label}`}>
          {presets.map((preset) => {
            const isSelected = value === preset
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectPreset(preset)}
                className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-sky-300 bg-sky-100 text-sky-800'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset === 'None' ? '✓ None' : `+ ${preset}`}
              </button>
            )
          })}
        </div>
      </div>

      <textarea
        id={id}
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
    </div>
  )
}
