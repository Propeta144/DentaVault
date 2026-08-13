import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 pt-8 backdrop-blur-sm sm:p-4 sm:pt-12">
      <div
        className={`w-full ${maxWidth} animate-[modal-in_180ms_ease-out] rounded-xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  )
}
