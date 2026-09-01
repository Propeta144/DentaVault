import React from 'react'

export default function MedicalAlertBadge({ label, value }) {
  const isNone =
    !value ||
    value.trim().toLowerCase() === 'none' ||
    value.trim().toLowerCase() === 'n/a' ||
    value.trim() === ''

  // KAPAG WALANG ALLERGY / MEDICAL HISTORY (Pakikita pa rin bilang Normal Info)
  if (isNone) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <p className="mt-0.5 text-sm font-medium text-slate-600">None</p>
      </div>
    )
  }

  // KAPAG MAY ALLERGY / CONDITION (Red Alert Badge)
  return (
    <div className="relative overflow-hidden rounded-md border border-red-200 bg-red-50 p-2.5 shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      <div className="ml-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {label}
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-red-800 border border-red-200">
          Alert
        </span>
      </div>
      <p className="mt-1 ml-1 text-sm font-semibold text-red-900">
        {value}
      </p>
    </div>
  )
}