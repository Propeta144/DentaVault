import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

// notice: laging kita sa ilalim ng title (hindi nasi-scroll), hal. ang
// allergy strip sa Add Treatment at chart modal. Dati natatakpan ng modal
// ang allergies sa header ng profile habang nagre-record (critique 2026-10-25).
export default function Modal({ title, onClose, children, notice, maxWidth = 'max-w-lg' }) {
  const titleId = useId()
  const dialogRef = useRef(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Keyboard/screen reader: pagbukas, nasa loob ng dialog ang focus (para
  // Escape/Tab ay dito agad); pagsara, bumabalik sa pinindot na button.
  // Hindi inaagaw kapag may autoFocus na field na sa loob.
  useEffect(() => {
    const previous = document.activeElement
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 pt-8 backdrop-blur-sm sm:p-4 sm:pt-12">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidth} animate-[modal-in_180ms_ease-out] rounded-xl bg-white shadow-xl focus:outline-none`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h2 id={titleId} className="min-w-0 text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {notice && <div className="border-b border-slate-200 px-4 py-2.5 sm:px-6">{notice}</div>}
        {/* Taas ng screen bawas ang itaas na gilid + header (dati 75vh lang,
            kaya sa phone natatakpan ang Save ng mahahabang form kahit may
            espasyo pa). dvh: tama kahit lumalabas/nawawala ang address bar
            ng mobile browser. May notice: bawas pa ang taas nito. */}
        <div
          className={`${notice ? 'max-h-[calc(100dvh-12rem)]' : 'max-h-[calc(100dvh-8.5rem)]'} overflow-y-auto px-4 py-4 sm:px-6 sm:py-5`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
