import React from 'react'

export default function QuickInputTextarea({
  label,
  value,
  onChange,
  presets = ['None'],
  placeholder = 'Type details here...'
}) {
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-base font-medium text-slate-700">{label}</label>
        
        {/* Quick Action Badges */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const isSelected = value === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-sky-100 text-sky-800 border border-sky-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {preset === 'None' ? '✓ None' : `+ ${preset}`}
              </button>
            )
          })}
        </div>
      </div>

      <textarea
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 p-2.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
    </div>
  )
}