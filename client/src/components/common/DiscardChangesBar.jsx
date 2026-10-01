import { AlertTriangle } from 'lucide-react'

// Ipinapalit sa footer ng form habang `guard.confirming` (tignan
// hooks/useDiscardGuard.js). Nasa footer mismo (hindi hiwalay na modal sa
// ibabaw ng modal), para walang dalawang Escape handler na nagbabanggaan
// at laging kita kahit naka-scroll sa ibaba.
export default function DiscardChangesBar({ guard }) {
  return (
    <div role="alertdialog" aria-label="Discard unsaved changes?" className="w-full space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-base text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>You have unsaved changes. Discard them?</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          autoFocus
          onClick={guard.keepEditing}
          className="min-h-11 flex-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={guard.discard}
          className="min-h-11 flex-1 whitespace-nowrap rounded-md bg-red-600 px-4 text-base font-semibold text-white transition-colors hover:bg-red-700"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
