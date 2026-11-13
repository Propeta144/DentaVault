import { useEffect, useId, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { listAuditFilterOptions } from '../../services/auditLogs'
import { formatDate } from '../../utils/formatDate'

export default function AuditEntityFilter({ kind, selection, onChange }) {
  const id = useId()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [data, setData] = useState({ options: [], hasMore: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const label = kind === 'users' ? 'User' : 'Patient'
  useEffect(() => {
    if (!open) return
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  useEffect(() => {
    if (!open) return
    let valid = true
    setLoading(true)
    setError('')
    setData({ options: [], hasMore: false })
    const timer = setTimeout(() => {
      listAuditFilterOptions({ kind, search: query.trim() })
        .then((result) => { if (valid) { setData(result); setActive(0) } })
        .catch((err) => { if (valid) setError(err.response?.data?.error || 'Failed to load filter options.') })
        .finally(() => { if (valid) setLoading(false) })
    }, 250)
    return () => { valid = false; clearTimeout(timer) }
  }, [open, query, kind, attempt])
  const system = kind === 'users' && (!query.trim() || 'system / no account'.includes(query.trim().toLowerCase()))
    ? [{ value: 'system', name: 'System / no account' }] : []
  const options = [...system, ...data.options]
  const visibleOptions = loading || error ? [] : options
  function choose(option) { onChange(option); setOpen(false); setQuery('') }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) { setQuery(''); setOpen(true) } else setActive((value) => Math.min(visibleOptions.length - 1, value + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)) }
    else if (event.key === 'Enter' && open && visibleOptions[active]) { event.preventDefault(); choose(visibleOptions[active]) }
  }
  return (
    <div ref={ref} className="relative min-w-0 sm:col-span-1 lg:w-60" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
        <input id={id} role="combobox" aria-label={`Filter by ${label.toLowerCase()}`} aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && visibleOptions[active] ? `${id}-option-${active}` : undefined}
          value={open ? query : selection?.name || ''} placeholder={`All ${kind}`} maxLength={150} autoComplete="off"
          onFocus={() => { setQuery(''); setActive(0); setOpen(true) }}
          onClick={() => { if (!open) { setQuery(''); setActive(0); setOpen(true) } }}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true) }} onKeyDown={keyDown}
          className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white pl-9 pr-10 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100" />
        {selection && <button type="button" aria-label={`Clear ${label.toLowerCase()} filter`} onClick={() => choose(null)} className="absolute right-0 top-0 flex h-11 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {selection && <p className="break-words border-b border-slate-100 px-2 py-2 text-xs text-slate-600">Selected: {selection.name}</p>}
          {loading ? <p role="status" className="p-3 text-sm text-slate-600">Loading options…</p> : error ? <div role="alert" className="p-2 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-1 min-h-11 rounded-md border border-red-300 px-3 text-base">Retry options</button></div> : (
            <div id={`${id}-options`} role="listbox" aria-label={`${label} options`}>
              {options.map((option, index) => (
                <button key={option.value} id={`${id}-option-${index}`} type="button" role="option" aria-selected={selection?.value === option.value} tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} onMouseEnter={() => setActive(index)}
                  className={`block min-h-11 w-full rounded-md px-3 py-2 text-left ${active === index ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
                  <span className="block break-words text-base font-medium text-slate-900">{option.name}</span>
                  <span className="block break-words text-xs text-slate-600">{kind === 'patients' ? `Born ${formatDate(option.date_of_birth)}${option.deleted_at ? ' · Deleted record' : ''}` : [option.role === 'dentist' ? 'Dentist' : option.role === 'patient' ? 'Patient account' : '', option.email].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
              {!options.length && <p className="p-3 text-sm text-slate-600">No matching {kind} in the audit history.</p>}
              {data.hasMore && <p className="p-2 text-xs text-slate-600">Keep typing to narrow the results.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
