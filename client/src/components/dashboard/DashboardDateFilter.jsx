import { useEffect, useId, useState } from 'react'
import { dashboardPreset, dashboardRangeError, dashboardRangeKey, dashboardToday } from '../../utils/dashboardRange'

const INPUT = 'min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100'

export default function DashboardDateFilter({ range, onChange }) {
  const id = useId()
  const [preset, setPreset] = useState('all')
  const [draft, setDraft] = useState({ dateFrom: '', dateTo: '' })
  const complete = Boolean(draft.dateFrom && draft.dateTo)
  const error = preset === 'custom' && complete ? dashboardRangeError(draft) : ''

  // Presets apply agad; custom dates wait briefly habang tinatapos ang input.
  // Invalid/incomplete drafts keep the last valid report, labeled sa header.
  useEffect(() => {
    if (preset !== 'custom' || !complete || error || dashboardRangeKey(draft) === dashboardRangeKey(range)) return
    const timeout = setTimeout(() => onChange(draft), 350)
    return () => clearTimeout(timeout)
  }, [preset, draft, complete, error, range, onChange])

  function choosePreset(value) {
    setPreset(value)
    if (value === 'custom') {
      setDraft(range.period === 'all' ? { dateFrom: '', dateTo: '' } : range)
    } else {
      onChange(dashboardPreset(value))
    }
  }
  return (
    <div className="min-w-0 xl:max-w-3xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 sm:w-48">
          <label htmlFor={`${id}-period`} className="mb-1 block text-sm font-medium text-slate-700">Reporting period</label>
          <select id={`${id}-period`} value={preset} onChange={(event) => choosePreset(event.target.value)} className={INPUT}>
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="sixMonths">Last 6 months</option>
            <option value="year">Last 12 months</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        {preset === 'custom' && ['dateFrom', 'dateTo'].map((field) => (
          <div key={field} className="min-w-0 sm:w-44">
            <label htmlFor={`${id}-${field}`} className="mb-1 block text-sm font-medium text-slate-700">{field === 'dateFrom' ? 'From' : 'To'}</label>
            <input id={`${id}-${field}`} type="date" max={dashboardToday()} value={draft[field]} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint`}
              onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className={INPUT} />
          </div>
        ))}
      </div>
      {preset === 'custom' && (
        <p id={`${id}-hint`} role={error ? 'alert' : undefined} className={`mt-2 text-sm ${error ? 'text-red-600' : 'text-slate-600'}`}>
          {error || (complete ? 'Dates apply automatically. Up to 24 calendar months.' : 'Choose both dates to filter. Up to 24 calendar months.')}
        </p>
      )}
    </div>
  )
}
