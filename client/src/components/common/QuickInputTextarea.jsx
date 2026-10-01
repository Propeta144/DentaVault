import { useId, useState } from 'react'

// Textarea na may quick-pick na presets (hal. "None", "+ Penicillin").
//
// Responsive: sa phone, nasa ilalim ng label ang presets. Presets: min 36px
// ang taas at text-sm. Naka-link ang label at error sa textarea (htmlFor,
// aria-describedby) para sa screen reader.
//
// Presets ay toggle na: pindutin ulit para tanggalin sa listahan (dati
// hindi matanggal). Ang "None" ay hindi na basta binubura ang na-type na
// listahan: nagtatanong muna (inline), dahil kapag nawala nang hindi
// napansin ang "Penicillin", panganib iyon sa pasyente.
function splitItems(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const isNoneValue = (value) => (value || '').trim().toLowerCase() === 'none'

export default function QuickInputTextarea({
  label,
  value,
  onChange,
  presets = ['None'],
  placeholder = 'Type details here...',
  required = false,
  error,
  maxLength,
  hint,
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const [confirmNone, setConfirmNone] = useState(false)
  const items = splitItems(value)
  const hasItems = items.length > 0 && !isNoneValue(value)

  const isSelected = (preset) =>
    preset === 'None' ? isNoneValue(value) : items.some((i) => i.toLowerCase() === preset.toLowerCase())

  function handlePreset(preset) {
    setConfirmNone(false)
    if (preset === 'None') {
      if (isNoneValue(value)) onChange('')
      else if (hasItems) setConfirmNone(true)
      else onChange('None')
      return
    }
    if (isSelected(preset)) {
      onChange(items.filter((i) => i.toLowerCase() !== preset.toLowerCase()).join(', '))
    } else {
      onChange(hasItems ? [...items, preset].join(', ') : preset)
    }
  }

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={id} className="text-base font-medium text-slate-700">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Quick options for ${label}`}>
          {presets.map((preset) => {
            const selected = isSelected(preset)
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={selected}
                onClick={() => handlePreset(preset)}
                className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-sky-300 bg-sky-100 text-sky-800'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset === 'None' ? '✓ None' : `${selected ? '✓' : '+'} ${preset}`}
              </button>
            )
          })}
        </div>
      </div>

      {confirmNone && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            Replace "{items.join(', ')}" with <strong>None</strong>?
          </span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmNone(false)
                onChange('None')
              }}
              className="min-h-9 rounded-md bg-amber-600 px-3 font-semibold text-white hover:bg-amber-700"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setConfirmNone(false)}
              className="min-h-9 rounded-md border border-amber-300 bg-white px-3 font-medium text-amber-800 hover:bg-amber-100"
            >
              Keep list
            </button>
          </span>
        </div>
      )}

      <textarea
        id={id}
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-md border px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 ${
          error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
        }`}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
