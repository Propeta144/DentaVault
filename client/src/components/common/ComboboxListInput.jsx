import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'

// Dropdown na puwedeng pumili ng marami (Medical History, Allergies) at
// puwede ring mag-type ng wala sa listahan. Pinalitan nito ang
// QuickInputTextarea (dati 3 preset chips + textarea lang).
//
// - Value: comma-separated text pa rin ("Diabetes, Asthma"), kaya walang
//   binago sa database, server, import, o sa pagpapakita (MedicalAlertBadge).
// - Pag-type: hinahanap sa label at sa `keywords` (hal. "hika" → Asthma).
//   Enter / comma / "Add ..." = idagdag ang na-type kahit wala sa listahan.
// - Kapag umalis sa field na may na-type pang hindi naidagdag, idinadagdag
//   ito (para hindi mawala ang allergy na na-type pero hindi na-Enter).
// - "None": toggle pa rin, at nagtatanong muna bago palitan ang listahan
//   (parehong kaligtasan gaya ng dati).
// - Lumulutang ang listahan (absolute, z-20). Dati nasa daloy ng page: kapag
//   nagsara ito pagka-blur, umaakyat ang "Register Patient" button bago pa
//   matapos ang click, kaya hindi gumagana ang unang pindot.
function splitItems(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const isNoneValue = (value) => (value || '').trim().toLowerCase() === 'none'
const norm = (s) => s.toLowerCase().trim()
// Keywords: simula lang ng salita ang tinitingnan ("mango" ay hindi dapat
// tumugma sa "alimango" → Seafood)
const startsWord = (text, q) => text.startsWith(q) || text.includes(` ${q}`)

export default function ComboboxListInput({
  label,
  value,
  onChange,
  groups,
  required = false,
  error,
  maxLength,
  hint,
  placeholder = 'Search or type, then press Enter',
}) {
  const id = useId()
  const inputId = `${id}-input`
  const listId = `${id}-list`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [confirmNone, setConfirmNone] = useState(false)
  const [limitMessage, setLimitMessage] = useState('')

  const none = isNoneValue(value)
  const items = none ? [] : splitItems(value)
  const selected = new Set(items.map(norm))

  // Mga option na tugma sa na-type at hindi pa napipili, naka-group pa rin.
  // `flat` = parehong pagkakasunod, para sa ArrowUp/ArrowDown.
  const { visibleGroups, flat } = useMemo(() => {
    const q = norm(query)
    const matches = (opt) =>
      !q || norm(opt.label).includes(q) || (opt.keywords || []).some((k) => startsWord(norm(k), q))
    const visible = groups
      .map((g) => ({ group: g.group, options: g.options.filter((o) => !selected.has(norm(o.label)) && matches(o)) }))
      .filter((g) => g.options.length > 0)

    const typed = query.trim()
    const exact =
      typed && (selected.has(norm(typed)) || groups.some((g) => g.options.some((o) => norm(o.label) === norm(typed))))
    // "Add ..." ay nasa DULO: kapag "pen" ang na-type, Enter = Penicillin
    // (unang tugma), hindi ang mismong "pen".
    const list = []
    visible.forEach((g) => g.options.forEach((o) => list.push(o)))
    if (typed && !exact) list.push({ custom: true, label: typed })
    return { visibleGroups: visible, flat: list }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, groups, value])

  function addItems(texts) {
    const clean = texts.map((t) => t.replace(/,/g, ' ').trim()).filter(Boolean)
    if (clean.length === 0) return
    const next = [...items]
    for (const t of clean) {
      if (!next.some((i) => norm(i) === norm(t))) next.push(t)
    }
    const joined = next.join(', ')
    if (maxLength && joined.length > maxLength) {
      setLimitMessage(`This list can only be ${maxLength} characters long.`)
      return
    }
    setLimitMessage('')
    setConfirmNone(false)
    onChange(joined)
    setQuery('')
    setActiveIndex(0)
    // Kusang nagsasara pagkapili (dati kailangan pang mag-click sa labas).
    // Nananatili ang cursor sa field: click o type ulit para magdagdag pa.
    setOpen(false)
  }

  function removeItem(item) {
    setLimitMessage('')
    onChange(items.filter((i) => i !== item).join(', '))
  }

  function handleNone() {
    setConfirmNone(false)
    if (none) onChange('')
    else if (items.length > 0) setConfirmNone(true)
    else {
      onChange('None')
      setOpen(false)
    }
  }

  function handleQueryChange(text) {
    // Comma = hiwalay na item (hal. nag-paste ng "Penicillin, Latex")
    if (text.includes(',')) {
      const parts = text.split(',')
      const rest = parts.pop()
      addItems(parts)
      setQuery(rest.trimStart())
      if (rest.trim()) setOpen(true)
    } else {
      setQuery(text)
      setActiveIndex(0)
      setOpen(true)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveIndex(0)
        return
      }
      setActiveIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // Huwag i-submit ang buong form habang pumipili
      if (open || query.trim()) e.preventDefault()
      if (open && flat[activeIndex]) addItems([flat[activeIndex].label])
      else if (query.trim()) addItems([query])
    } else if (e.key === 'Escape' && open) {
      // Isara lang ang listahan, hindi ang buong modal (Modal ay nakikinig sa document)
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'Backspace' && !query && items.length > 0) {
      removeItem(items[items.length - 1])
    }
  }

  function handleBlur(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (query.trim()) addItems([query])
    setOpen(false)
  }

  // ArrowUp/ArrowDown: laging kita ang naka-highlight na option
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, id])

  const describedBy = [error && errorId, hint && hintId, limitMessage && `${id}-limit`].filter(Boolean).join(' ') || undefined
  const activeOptionId = open && flat[activeIndex] ? `${id}-opt-${activeIndex}` : undefined
  let optionIndex = -1 // tumutugma sa `flat`

  const optionClass = (index) =>
    `flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-base ${
      index === activeIndex ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-base font-medium text-slate-700">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <button
          type="button"
          aria-pressed={none}
          aria-label={`None (no ${label.toLowerCase()})`}
          onClick={handleNone}
          className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
            none
              ? 'border-sky-300 bg-sky-100 text-sky-800'
              : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {none ? '✓ None' : 'None'}
        </button>
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

      <div onBlur={handleBlur} className="relative">
        <div
          className={`flex flex-wrap items-center gap-1.5 rounded-md border bg-white py-1 pl-2 pr-1 focus-within:ring-2 ${
            error ? 'border-red-300 focus-within:ring-red-200' : 'border-slate-300 focus-within:border-sky-500 focus-within:ring-sky-100'
          }`}
        >
          {none && (
            <span className="inline-flex min-h-9 items-center rounded-full bg-slate-100 px-3 text-sm font-medium text-slate-700">
              None
            </span>
          )}
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-full bg-sky-100 py-1 pl-3 pr-1 text-sm font-medium text-sky-800"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-sky-200"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ))}
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoComplete="off"
            value={query}
            placeholder={none ? 'Type to replace None' : items.length > 0 ? 'Add more...' : placeholder}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="min-h-9 min-w-[10rem] flex-1 bg-transparent px-1 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? `Hide ${label} options` : `Show ${label} options`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div
            id={listId}
            role="listbox"
            aria-label={`${label} options`}
            aria-multiselectable="true"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            {flat.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-500">
                {query.trim() ? 'Already on the list.' : 'Everything on the list is already added. Type to add something else.'}
              </p>
            )}
            {visibleGroups.map((g) => (
              <div key={g.group} role="group" aria-label={g.group}>
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.group}</p>
                {g.options.map((opt) => {
                  optionIndex += 1
                  const index = optionIndex
                  return (
                    <div
                      key={opt.label}
                      id={`${id}-opt-${index}`}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addItems([opt.label])}
                      className={optionClass(index)}
                    >
                      {opt.label}
                    </div>
                  )
                })}
              </div>
            ))}
            {flat[flat.length - 1]?.custom &&
              (() => {
                optionIndex += 1
                const index = optionIndex
                return (
                  <div
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addItems([query])}
                    className={`${optionClass(index)} ${visibleGroups.length > 0 ? 'border-t border-slate-100' : ''}`}
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">
                      Add "<span className="font-semibold">{query.trim()}</span>"
                    </span>
                  </div>
                )
              })()}
          </div>
        )}
      </div>

      {limitMessage && (
        <p id={`${id}-limit`} className="text-sm text-red-600">
          {limitMessage}
        </p>
      )}
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
