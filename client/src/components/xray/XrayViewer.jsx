import { useEffect, useRef, useState, useCallback } from 'react'
import { PenLine, Type, Undo2, Save, ZoomIn, ZoomOut, X, Printer, Trash2 } from 'lucide-react'
import { fetchXrayObjectUrl, saveAnnotations } from '../../services/xrays'
import { useToast } from '../../context/ToastContext'
import { drawShapes } from './drawAnnotations'
import DeleteXrayModal from './DeleteXrayModal'
import Modal from '../common/Modal'

// --- Coordinate system -----------------------------------------------------
// Bawat annotation point, naka-store bilang FRACTION (0..1) ng rendered
// width/height ng image, hindi pixel value. Kasi kapag fraction, same
// relative spot pa rin sa image kahit anong laki na kasalukuyang ginagamit
// pag-drawing — kaya hindi na madi-drift yung annotations kapag nag-zoom
// in/out yung user, wala na kasing pixel-to-pixel mapping na kailangan
// i-sync.
//
// Yung dating version, canvas-internal pixel coordinates (0..naturalWidth)
// ang naka-store, tapos umaasa lang na palaging eksaktong tugma yung CSS box
// kung saan naka-render yung canvas sa rendered box ng image. Nasira 'yon
// nung nagkaroon ng conflicting inline `style={{ display: 'block' }}` na
// nag-o-override sa Tailwind `inline-block` class: tumigil na yung
// container sa shrink-wrap papunta sa image, kaya yung percentage-based
// CSS width ng image, mali na yung na-compute na containing block, at
// yung mouse-to-canvas coordinate conversion (na umaasa doon) na-drift —
// lalong lumala habang mas nag-zoom out ka. Sa paglipat papuntang fractions
// AT pagbibigay ng explicit pixel width sa image/canvas (naturalSize.width
// * scale) sa halip na `%`, natanggal parehong yung coordinate bug at
// yung ugat nito.
function pointerToFraction(e, canvas) {
  const rect = canvas.getBoundingClientRect()
  return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height]
}

export default function XrayViewer({ xray, canAnnotate, onClose }) {
  const { showToast } = useToast()
  const [imageUrl, setImageUrl] = useState(null)
  const [naturalSize, setNaturalSize] = useState(null) // { width, height } in real pixels
  const [scale, setScale] = useState(1)
  const [tool, setTool] = useState('pen')
  // Defensive lang: dapat array yung annotations. Kasi kung magkaroon ng
  // backend regression na nagpadala nito bilang raw (unparsed) JSON string,
  // makakapasa pa rin sa truthy check na 'to, tapos yung `[...shapes,
  // newShape]` sa susunod, tahimik lang na i-spread yung string papuntang
  // individual characters sa halip na mag-error.
  const [shapes, setShapes] = useState(Array.isArray(xray.annotations) ? xray.annotations : [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  // Baseline para sa "may unsaved changes ba?" check — yung last-saved (o
  // initially-loaded) na shapes, bilang string para mabilis i-compare sa
  // kasalukuyang `shapes` nang walang deep-equal. Naka-ref (hindi state) kasi
  // hindi dapat mag-trigger ng re-render sa sarili niya, updater lang siya
  // ng "saved" checkpoint pagkatapos ng successful save.
  const savedShapesRef = useRef(JSON.stringify(shapes))
  const hasUnsavedChanges = JSON.stringify(shapes) !== savedShapesRef.current
  // In-progress text annotation: inline input na naka-anchor sa tap point,
  // kapalit ng window.prompt() para hindi na umaalis yung annotation flow
  // sa sarili nating styled UI papunta sa native OS dialog. Null kapag
  // walang pending na text tool tap.
  const [textInput, setTextInput] = useState(null) // { xFrac, yFrac, value }

  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const viewerRef = useRef(null)
  const textInputRef = useRef(null)
  const drawingRef = useRef(null) // in-progress stroke, as fraction points, while dragging

  useEffect(() => {
    let objectUrl
    fetchXrayObjectUrl(xray.id).then((url) => {
      objectUrl = url
      setImageUrl(url)
    })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [xray.id])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawShapes(ctx, shapes, canvas.width, canvas.height)
  }, [shapes])

  useEffect(() => {
    redraw()
  }, [redraw])

  function handleImageLoad() {
    const img = imgRef.current
    // Naka-fix yung canvas internal resolution sa natural size ng image
    // para crisp yung strokes; yung CSS width (naturalSize.width * scale)
    // yung nagbabago talaga pag nag-zoom — pareho lang naman yung fraction
    // math kahit alin pa.
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    canvasRef.current.width = img.naturalWidth
    canvasRef.current.height = img.naturalHeight

    // Simula sa scale na kasya sa buong viewer, hindi flat 100%. Kasi kung
    // maliit yung source image (hal. kinuha lang sa web para sa testing),
    // magbubukas 'yon sa ilang dosenang native pixels lang sa kanto ng
    // halos-walang-laman na viewer — walang silbi tignan. Yung malalaking
    // X-ray naman, nagbubukas pa rin na naka-shrink para kasya, kagaya ng
    // dati.
    const viewer = viewerRef.current
    if (viewer) {
      const availableWidth = viewer.clientWidth - 48
      const availableHeight = viewer.clientHeight - 48
      const fitScale = Math.min(availableWidth / img.naturalWidth, availableHeight / img.naturalHeight)
      setScale(Math.min(4, Math.max(0.25, fitScale)))
    }

    redraw()
  }

  // Pointer events 'to (hindi mouse events), para same handlers ang
  // gumagana kahit mouse, daliri, o stylus — ito naman talaga yung
  // pangunahing paraan ng paggamit ng app, sa tablet. Yung mouse-only
  // handlers, may click nga sa single tap pero hindi reliable magbigay
  // ng continuous move events na kailangan ng freehand touch-drag.
  function handlePointerDown(e) {
    if (!canAnnotate || textInput) return

    // Kailangan 'to lalo na para sa Text tool: pagkatapos ng mga listener
    // (kasama na tayo), gagawin pa rin ng browser yung sarili niyang default
    // action para sa mousedown — ilipat yung focus base sa kung ano ang
    // "focusable" sa ilalim ng pointer. Yung canvas mismo, hindi naman
    // focusable, kaya kung real mouse click 'to (hindi touch, hindi
    // synthetic), aagawin ng browser yung focus palayo sa bagong
    // <input autoFocus> na kaka-mount lang natin sa ibaba — mag-bblur agad
    // ito bago pa man makapag-type yung user, tapos i-ccommit (at itatapon,
    // kasi wala pang laman) ni onBlur nang tahimik. preventDefault() dito
    // ang pumipigil sa browser sa ganitong default focus-stealing, para
    // manatili yung autoFocus natin.
    e.preventDefault()

    if (tool === 'text') {
      const [xFrac, yFrac] = pointerToFraction(e, canvasRef.current)
      setTextInput({ xFrac, yFrac, value: '' })
      return
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = [pointerToFraction(e, canvasRef.current)]
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return
    drawingRef.current.push(pointerToFraction(e, canvasRef.current))
    // live preview: i-redraw yung committed shapes, tapos overlay yung
    // in-progress stroke sa ibabaw, hindi pa siya kino-commit sa state
    redraw()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = Math.max(2, canvas.width * 0.003)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    drawingRef.current.forEach(([xFrac, yFrac], i) => {
      const x = xFrac * canvas.width
      const y = yFrac * canvas.height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    // I-capture muna sa local bago i-clear yung ref: yung updater function
    // ng setShapes, tumatakbo mamaya, hindi synchronous, kaya kung hindi
    // ganito, mag-close over sa drawingRef.current PAGKATAPOS na ma-null
    // out sa baba.
    const points = drawingRef.current
    drawingRef.current = null
    if (points.length > 1) {
      setShapes((prev) => [...prev, { type: 'line', points, color: '#ef4444' }])
    }
  }

  function commitTextInput() {
    if (textInput && textInput.value.trim()) {
      setShapes((prev) => [
        ...prev,
        { type: 'text', x: textInput.xFrac, y: textInput.yFrac, text: textInput.value.trim(), color: '#ef4444' },
      ])
    }
    setTextInput(null)
  }

  function undoLast() {
    setShapes((prev) => prev.slice(0, -1))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await saveAnnotations(xray.id, shapes)
      savedShapesRef.current = JSON.stringify(shapes)
      showToast('Annotations saved.', { type: 'success' })
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to save annotations'
      setError(message)
      showToast(message, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const renderedWidth = naturalSize ? naturalSize.width * scale : undefined
  const renderedHeight = naturalSize ? naturalSize.height * scale : undefined

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-3 py-2.5 text-white sm:px-4">
        <span className="max-w-[45%] truncate text-base font-medium sm:max-w-none">
          {xray.original_filename}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {canAnnotate && (
            <>
              <button
                type="button"
                title="Pen"
                onClick={() => setTool('pen')}
                className={`flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
                  tool === 'pen' ? 'bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <PenLine className="h-4 w-4" />
                Pen
              </button>
              <button
                type="button"
                title="Text"
                onClick={() => setTool('text')}
                className={`flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
                  tool === 'text' ? 'bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <Type className="h-4 w-4" />
                Text
              </button>
              <button
                type="button"
                title="Undo"
                onClick={undoLast}
                className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium transition-colors hover:bg-slate-700"
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </button>
              <button
                type="button"
                title="Save Annotations"
                onClick={handleSave}
                disabled={saving}
                className="flex min-h-11 items-center gap-1.5 rounded bg-emerald-600 px-3 text-sm font-semibold transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Annotations'}
              </button>
              <button
                type="button"
                title="Delete X-ray"
                onClick={() => setDeleting(true)}
                className="flex min-h-11 items-center gap-1.5 rounded bg-red-600 px-3 text-sm font-medium transition-colors hover:bg-red-500"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
            </>
          )}
          <button
            type="button"
            title="Print"
            onClick={() => window.open(`/patients/${xray.patient_id}/xrays/${xray.id}/print`, '_blank')}
            className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium transition-colors hover:bg-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
          <button
            type="button"
            title="Zoom out"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
            className="flex h-11 w-11 items-center justify-center rounded bg-slate-800 transition-colors hover:bg-slate-700"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            title="Zoom in"
            onClick={() => setScale((s) => Math.min(4, s + 0.25))}
            className="flex h-11 w-11 items-center justify-center rounded bg-slate-800 transition-colors hover:bg-slate-700"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Close"
            onClick={() => (hasUnsavedChanges ? setConfirmingClose(true) : onClose())}
            className="ml-2 flex min-h-11 items-center gap-1.5 rounded bg-red-600 px-3 text-sm font-medium transition-colors hover:bg-red-500"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {error && <div className="bg-red-600 px-4 py-2 text-sm text-white">{error}</div>}

      <div ref={viewerRef} className="flex-1 overflow-auto p-3 sm:p-6">
        {/* inline-block, WALANG overriding style: kailangan talaga eksakto
            i-shrink-wrap 'to papunta sa rendered box ng image, kasi yung
            canvas sa baba, naka-size sa 100% nito. */}
        <div className="relative mx-auto inline-block">
          {imageUrl && (
            <>
              <img
                ref={imgRef}
                src={imageUrl}
                onLoad={handleImageLoad}
                alt={xray.original_filename}
                style={{ width: renderedWidth, height: renderedHeight, display: 'block' }}
                className="select-none"
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="absolute left-0 top-0 h-full w-full"
                style={{ cursor: canAnnotate ? 'crosshair' : 'default', touchAction: 'none' }}
              />
              {textInput && (
                <input
                  ref={textInputRef}
                  type="text"
                  autoFocus
                  value={textInput.value}
                  placeholder="Annotation text"
                  onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
                  onBlur={commitTextInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTextInput()
                    if (e.key === 'Escape') setTextInput(null)
                  }}
                  className="absolute z-10 min-w-[10rem] -translate-y-1/2 rounded-md border-2 border-red-500 bg-white px-2 py-1 text-base text-red-700 shadow-lg focus:outline-none"
                  style={{
                    left: textInput.xFrac * (renderedWidth || 0),
                    top: textInput.yFrac * (renderedHeight || 0),
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {deleting && (
        <DeleteXrayModal xray={xray} onClose={() => setDeleting(false)} onDeleted={onClose} />
      )}

      {confirmingClose && (
        <Modal title="Discard unsaved annotations?" onClose={() => setConfirmingClose(false)}>
          <div className="space-y-4">
            <p className="text-base text-slate-700">
              You have annotations that haven't been saved yet. Closing now will discard them.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingClose(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md bg-red-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
