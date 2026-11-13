import { useEffect, useId, useRef, useState } from 'react'
import { Columns2, SplitSquareHorizontal, ArrowLeftRight, RotateCcw, X } from 'lucide-react'
import { fetchXrayObjectUrl } from '../../services/xrays'
import { formatDate } from '../../utils/formatDate'

const RESET = { x: 0, y: 0, scale: 100, rotation: 0 }
export default function CompareView({ xrays, onClose, onOpened }) {
  const [urls, setUrls] = useState([])
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [mode, setMode] = useState('side')
  const [swapped, setSwapped] = useState(false)
  const [position, setPosition] = useState(50)
  const [alignment, setAlignment] = useState(RESET)
  const [ratio, setRatio] = useState(2)
  const stageRef = useRef(null)
  const draggingPointer = useRef(null)
  const sliderId = useId()
  const imagesOnly = xrays.length === 2 && xrays.every((row) => row.mime_type?.startsWith('image/'))
  const order = swapped ? [1, 0] : [0, 1]
  useEffect(() => {
    let active = true
    const owned = new Set()
    setLoading(true)
    setUrls([])
    setErrors([])
    Promise.allSettled(xrays.map(async (xray, index) => {
      try {
        const url = await fetchXrayObjectUrl(xray.id)
        if (!active) { URL.revokeObjectURL(url); return }
        owned.add(url)
        setUrls((current) => { const next = [...current]; next[index] = url; return next })
      } catch (error) {
        if (active) setErrors((current) => [...current, error.response?.data?.error || `Could not load ${xray.original_filename}.`])
      }
    })).then(() => { if (active) { setLoading(false); onOpened?.() } })
    return () => { active = false; for (const url of owned) URL.revokeObjectURL(url); owned.clear() }
  }, [xrays, attempt, onOpened])
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  const moveSlider = (event) => {
    const rect = stageRef.current.getBoundingClientRect()
    setPosition(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)))
  }
  const caption = (index) => `${formatDate(xrays[index].taken_date || xrays[index].created_at)} · ${xrays[index].original_filename}`
  const button = 'flex min-h-11 items-center gap-1.5 rounded-md border border-slate-600 px-3 text-sm font-medium hover:bg-slate-700 disabled:opacity-50'
  return (
    <div role="dialog" aria-modal="true" aria-label="Compare X-rays" className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2.5">
        <span className="mr-auto text-base font-semibold">Comparing {xrays.length} X-rays</span>
        <button type="button" aria-pressed={mode === 'side'} onClick={() => setMode('side')} className={button}><Columns2 className="h-4 w-4" />Side by side</button>
        <button type="button" aria-pressed={mode === 'slider'} disabled={!imagesOnly || !urls[0] || !urls[1]} onClick={() => setMode('slider')} className={button}><SplitSquareHorizontal className="h-4 w-4" />Comparison slider</button>
        <button type="button" aria-label="Close comparison" onClick={onClose} className="flex min-h-11 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium hover:bg-red-700"><X className="h-4 w-4" />Close</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading && <p role="status" className="mb-3 text-sm text-slate-300">Loading X-rays...</p>}
        {errors.length > 0 && <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-red-800">{errors.map((error) => <p key={error}>{error}</p>)}<button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 min-h-11 rounded-md border border-red-300 px-3">Retry comparison</button></div>}
        {!imagesOnly && <p className="mb-3 text-sm text-slate-300">The slider is available for two image files. PDF documents can be opened below.</p>}
        {mode === 'side' ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {xrays.map((xray, index) => <section key={xray.id} className="min-w-0 flex-1 text-center"><h3 className="mb-2 break-words text-sm text-slate-300">{caption(index)}</h3>{urls[index] && (xray.mime_type === 'application/pdf' ? <a href={urls[index]} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-slate-600 px-4 text-base hover:bg-slate-800">Open PDF document</a> : <img src={urls[index]} alt={xray.original_filename} className="mx-auto h-auto max-w-full" />)}</section>)}
          </div>
        ) : urls[0] && urls[1] && (
          <div className="mx-auto max-w-6xl space-y-3">
            <p className="text-sm text-slate-300">Use comparable views and align the overlay if needed. These controls change the viewing position only.</p>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2"><p className="break-words">Base: {caption(order[0])}</p><p className="break-words">Overlay: {caption(order[1])}</p></div>
            <div ref={stageRef} role="img" aria-label="X-ray comparison slider preview" className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: ratio, maxHeight: '65vh', touchAction: 'none' }}
              onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); draggingPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveSlider(event) }}
              onPointerMove={(event) => { if (draggingPointer.current === event.pointerId && event.buttons === 1) moveSlider(event) }}
              onPointerUp={(event) => { if (draggingPointer.current === event.pointerId) moveSlider(event); draggingPointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
              onPointerCancel={() => { draggingPointer.current = null }}>
              <img src={urls[order[0]]} alt="" draggable={false} onLoad={(event) => setRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 2)} className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" />
              <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><img src={urls[order[1]]} alt="" draggable={false} className="h-full w-full select-none object-contain" style={{ transform: `translate(${alignment.x}%, ${alignment.y}%) scale(${alignment.scale / 100}) rotate(${alignment.rotation}deg)` }} /></div>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${position}%` }}><span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sky-600"><ArrowLeftRight className="h-5 w-5" /></span></div>
            </div>
            <label htmlFor={sliderId} className="block text-base">Overlay reveal: {Math.round(position)}%<input id={sliderId} aria-label="X-ray comparison reveal" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="mt-2 block min-h-11 w-full accent-sky-500" /></label>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSwapped((value) => !value); setAlignment(RESET) }} className={button}><ArrowLeftRight className="h-4 w-4" />Swap images</button><button type="button" onClick={() => { setAlignment(RESET); setPosition(50) }} className={button}><RotateCcw className="h-4 w-4" />Reset alignment</button></div>
            <details><summary className="flex min-h-11 cursor-pointer items-center text-base text-slate-300">Align overlay</summary><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[['x','Horizontal offset',-30,30,'%'],['y','Vertical offset',-30,30,'%'],['scale','Overlay size',50,200,'%'],['rotation','Rotation',-20,20,'°']].map(([key,label,min,max,unit]) => <label key={key} className="text-sm text-slate-300">{label}: {alignment[key]}{unit}<input aria-label={label} type="range" min={min} max={max} value={alignment[key]} onChange={(event) => setAlignment((current) => ({ ...current, [key]: Number(event.target.value) }))} className="block min-h-11 w-full accent-sky-500" /></label>)}</div></details>
          </div>
        )}
      </div>
    </div>
  )
}
