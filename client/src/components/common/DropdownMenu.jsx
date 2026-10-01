import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

const MENU_GAP = 4
const ITEM_HEIGHT = 44
// Pinakamaliit na layo ng menu sa gilid ng screen
const EDGE = 8

// "⋯" menu para sa mga hindi gaanong madalas (o mapanganib) na action, hal.
// Delete. Dati magkatabi ang Edit at Delete sa bawat row ng patient list,
// kaya madaling mapindot ang Delete nang hindi sinasadya.
//
// items: [{ label, icon, onClick, danger?, disabled? }]
// Nagsasara kapag: pumili ng item, Escape, nag-click sa labas, o nawala
// sa screen ang button.
//
// position: fixed (hindi absolute): nasa loob ng table na may
// overflow-x-auto ang menu sa patient list, kaya kapag absolute, mapuputol
// ito sa huling mga row. Kinukuwenta ang posisyon mula sa button, at
// bumubukas pataas kapag kulang ang espasyo sa ibaba ng screen.
//
// stopPropagation: para hindi ma-trigger ang click ng buong row.
//
// Optional (para sa user menu sa top bar):
// - trigger / triggerClassName: sariling laman at itsura ng button (hal.
//   avatar + pangalan) kapalit ng "⋯"
// - header: hindi-pipinduting laman sa itaas ng menu (hal. pangalan at role)
// - align: 'right' (default; kanang gilid ng menu = kanang gilid ng button)
//   o 'left' (para sa button na nasa kaliwa ng screen, hal. account sa sidebar)
// - matchTriggerWidth: kasinglapad ng button ang menu (min 192px), hal. sa sidebar
//
// Laging nasa loob ng screen ang menu: may maxWidth batay sa espasyong
// natitira. Dati, kapag mahaba ang laman (hal. buong pangalan ng dentist)
// at nasa kaliwa ang button, lumalampas ang menu sa kaliwang gilid ng screen.
const DEFAULT_TRIGGER_CLASS =
  'flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800'

export default function DropdownMenu({
  items,
  label = 'More actions',
  trigger,
  triggerClassName = DEFAULT_TRIGGER_CLASS,
  header,
  align = 'right',
  matchTriggerWidth = false,
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const hasHeader = Boolean(header)

  // Kinukuwenta ulit tuwing mag-scroll/resize, para nakadikit pa rin ang
  // menu sa button. (Dati nagsasara agad ito sa kahit anong scroll — pero
  // may scroll event na dumarating pagkatapos mismong bumukas, hal. kapag
  // in-scroll ng browser ang button papasok sa screen bago i-click, kaya
  // hindi bumubukas ang menu sa mga huling row.) Nagsasara lang kapag
  // lumabas na sa screen ang button.
  const reposition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false)
      return
    }
    const menuHeight = items.length * ITEM_HEIGHT + 8 + (hasHeader ? 64 : 0)
    const openUp = rect.bottom + MENU_GAP + menuHeight > window.innerHeight && rect.top > menuHeight
    const vertical = openUp ? { bottom: window.innerHeight - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }
    const sizing = matchTriggerWidth ? { width: Math.max(rect.width, 192) } : {}
    if (align === 'left') {
      const left = Math.max(EDGE, rect.left)
      setPosition({ left, maxWidth: window.innerWidth - left - EDGE, ...sizing, ...vertical })
    } else {
      const right = Math.max(EDGE, window.innerWidth - rect.right)
      setPosition({ right, maxWidth: window.innerWidth - right - EDGE, ...sizing, ...vertical })
    }
  }, [items.length, hasHeader, align, matchTriggerWidth])

  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, reposition])

  useEffect(() => {
    if (!open) return
    function handlePointer(e) {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

  // Unang item ang naka-focus pagbukas, para gumana ang keyboard (Tab/Enter).
  useEffect(() => {
    if (open && position) menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus()
  }, [open, position])

  return (
    <div className="inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setPosition(null)
          setOpen((v) => !v)
        }}
        className={triggerClassName}
      >
        {trigger || <MoreHorizontal className="h-5 w-5" />}
      </button>
      {open && position && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', ...position }}
          className="z-50 min-w-48 animate-[modal-in_120ms_ease-out] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {header && <div className="border-b border-slate-100 px-4 py-3">{header}</div>}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-base transition-colors focus:outline-none disabled:opacity-50 ${
                item.danger
                  ? 'text-red-700 hover:bg-red-50 focus:bg-red-50'
                  : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50'
              }`}
            >
              {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
