import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState, useCallback } from 'react'
import { PenLine, Type, Undo2, Redo2, Save, ZoomIn, ZoomOut, X, Printer, Trash2, Hand, Eye, EyeOff, SlidersHorizontal, RotateCcw, Loader2, FileText } from 'lucide-react'
import { fetchXrayObjectUrl, saveAnnotations } from '../../services/xrays'
import { useToast } from '../../context/ToastContext'
import { openPrintTab, PROFILE_PATH } from '../../utils/selectedPatient'
import { drawShapes, ANNOTATION_TEXT_MAX } from './drawAnnotations'
import { createAnnotationHistory, annotationHistoryReducer } from './annotationHistory'
import DeleteXrayModal from './DeleteXrayModal'
import Modal from '../common/Modal'
import XrayReviewBadge from './XrayReviewBadge'
import { fitXrayScale, MIN_XRAY_ZOOM, MAX_XRAY_ZOOM } from '../../utils/xrayView'

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

// canDelete: dentist palagi; patient (#27) sa sariling upload lang na hindi
// pa nare-review (tignan PatientXraysSection; server ang tunay na check).
export default function XrayViewer({ xray, patientCode, canAnnotate, canDelete = canAnnotate, onClose, onOpened }) {
  const { showToast } = useToast()
  const [imageUrl, setImageUrl] = useState(null)
  const [naturalSize, setNaturalSize] = useState(null) // { width, height } in real pixels
  const [scale, setScale] = useState(1)
  const [tool, setTool] = useState(canAnnotate ? 'pen' : 'pan')
  const [annotationsVisible, setAnnotationsVisible] = useState(true)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [panning, setPanning] = useState(false)
  const [fileLoading, setFileLoading] = useState(true)
  const [fileError, setFileError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const brightnessId = useId()
  const contrastId = useId()
  const isPdf = xray.mime_type === 'application/pdf'
  const panMode = tool === 'pan' || !canAnnotate || !annotationsVisible
  // Defensive lang: dapat array yung annotations. Kasi kung magkaroon ng
  // backend regression na nagpadala nito bilang raw (unparsed) JSON string,
  // makakapasa pa rin sa truthy check na 'to, tapos yung `[...shapes,
  // newShape]` sa susunod, tahimik lang na i-spread yung string papuntang
  // individual characters sa halip na mag-error.
  // cleanShapes: walang sirang entry na ipapakita o ipapadala ulit pag-save (#41)
  const [annotationHistory, dispatchAnnotations] = useReducer(annotationHistoryReducer, xray.annotations, createAnnotationHistory)
  const { shapes, undone } = annotationHistory
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
  const panRef = useRef(null)
  const pointerIdRef = useRef(null)
  const maxZoomRef = useRef(MAX_XRAY_ZOOM)
  const zoomAnchorRef = useRef(null)

  const zoomImage = useCallback((factor) => {
    const viewer = viewerRef.current
    const image = imgRef.current
    if (!viewer || !image?.naturalWidth || pointerIdRef.current !== null) return
    const imageRect = image.getBoundingClientRect()
    const viewport = viewer.getBoundingClientRect()
    const x = viewport.left + viewer.clientLeft + viewer.clientWidth / 2
    const y = viewport.top + viewer.clientTop + viewer.clientHeight / 2
    // Itabi ang image point sa gitna; ibalik sa parehong screen point
    // pagkatapos mag-render ang bagong sukat, bago pa mag-paint ang browser.
    zoomAnchorRef.current = {
      imageX: (x - imageRect.left) / imageRect.width, imageY: (y - imageRect.top) / imageRect.height,
    }
    setScale((current) => Math.min(maxZoomRef.current, Math.max(MIN_XRAY_ZOOM, current * factor)))
  }, [])

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    if (!anchor || !imgRef.current || !viewerRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const viewer = viewerRef.current
    const viewport = viewer.getBoundingClientRect()
    const x = viewport.left + viewer.clientLeft + viewer.clientWidth / 2
    const y = viewport.top + viewer.clientTop + viewer.clientHeight / 2
    viewer.scrollLeft += rect.left + rect.width * anchor.imageX - x
    viewer.scrollTop += rect.top + rect.height * anchor.imageY - y
    zoomAnchorRef.current = null
  }, [scale])

  useEffect(() => {
    let objectUrl
    let cancelled = false
    setFileLoading(true)
    setFileError('')
    setImageUrl(null)
    setNaturalSize(null)
    fetchXrayObjectUrl(xray.id)
      .then((url) => {
        objectUrl = url
        if (cancelled) { URL.revokeObjectURL(url); return }
        setImageUrl(url)
        onOpened?.()
      })
      .catch(() => { if (!cancelled) setFileError('Could not load this X-ray. Try again.') })
      .finally(() => { if (!cancelled) setFileLoading(false) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [xray.id, loadAttempt, onOpened])

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

  function fitImage(size = naturalSize) {
    const viewer = viewerRef.current
    if (!viewer || !size) return
    const padding = getComputedStyle(viewer)
    const fitScale = fitXrayScale(size.width, size.height,
      viewer.offsetWidth - parseFloat(padding.borderLeftWidth) - parseFloat(padding.borderRightWidth) - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight),
      viewer.offsetHeight - parseFloat(padding.borderTopWidth) - parseFloat(padding.borderBottomWidth) - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom))
    maxZoomRef.current = Math.max(MAX_XRAY_ZOOM, fitScale * 8)
    zoomAnchorRef.current = null
    setScale(fitScale)
    viewer.scrollTo(0, 0)
  }

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
    fitImage({ width: img.naturalWidth, height: img.naturalHeight })

    redraw()
  }

  // Pointer events 'to (hindi mouse events), para same handlers ang
  // gumagana kahit mouse, daliri, o stylus — ito naman talaga yung
  // pangunahing paraan ng paggamit ng app, sa tablet. Yung mouse-only
  // handlers, may click nga sa single tap pero hindi reliable magbigay
  // ng continuous move events na kailangan ng freehand touch-drag.
  function handlePointerDown(e) {
    if (e.button !== 0 || pointerIdRef.current !== null || !naturalSize || saving || textInput) return
    if (panMode) {
      e.preventDefault()
      pointerIdRef.current = e.pointerId
      e.currentTarget.setPointerCapture(e.pointerId)
      panRef.current = { x: e.clientX, y: e.clientY, left: viewerRef.current.scrollLeft, top: viewerRef.current.scrollTop }
      setPanning(true)
      return
    }
    if (!canAnnotate || !annotationsVisible || e.target !== canvasRef.current) return

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
    pointerIdRef.current = e.pointerId
    drawingRef.current = [pointerToFraction(e, canvasRef.current)]
  }

  function handlePointerMove(e) {
    if (pointerIdRef.current !== e.pointerId) return
    if (panRef.current) {
      viewerRef.current.scrollLeft = panRef.current.left + panRef.current.x - e.clientX
      viewerRef.current.scrollTop = panRef.current.top + panRef.current.y - e.clientY
      return
    }
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

  function handlePointerUp(e, cancelled = false) {
    if (pointerIdRef.current !== e.pointerId) return
    pointerIdRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (panRef.current) {
      panRef.current = null
      setPanning(false)
      return
    }
    if (!drawingRef.current) return
    // Itabi ang completed stroke bago i-clear ang in-progress drawing ref.
    const points = drawingRef.current
    drawingRef.current = null
    if (!cancelled && points.length > 1) {
      dispatchAnnotations({ type: 'add', shape: { type: 'line', points, color: '#ef4444' } })
    } else redraw()
  }

  function commitTextInput() {
    if (textInput && textInput.value.trim()) {
      dispatchAnnotations({ type: 'add', shape: { type: 'text', x: textInput.xFrac, y: textInput.yFrac, text: textInput.value.trim(), color: '#ef4444' } })
    }
    setTextInput(null)
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="max-w-[70vw] truncate text-base font-medium sm:max-w-sm">{xray.original_filename}</span>
          <XrayReviewBadge xray={xray} viewerRole={canAnnotate ? 'dentist' : 'patient'} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isPdf && (
            <button type="button" title="Drag to pan" aria-pressed={panMode} onClick={() => setTool('pan')}
              className={`flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-medium ${panMode ? 'bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              <Hand className="h-4 w-4" />Pan
            </button>
          )}
          {canAnnotate && !isPdf && (
            <>
              <button
                type="button"
                title="Pen"
                onClick={() => { setAnnotationsVisible(true); setTool('pen') }}
                aria-pressed={tool === 'pen' && annotationsVisible}
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
                onClick={() => { setAnnotationsVisible(true); setTool('text') }}
                aria-pressed={tool === 'text' && annotationsVisible}
                className={`flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
                  tool === 'text' ? 'bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <Type className="h-4 w-4" />
                Text
              </button>
              <button type="button" title="Undo last annotation" onClick={() => dispatchAnnotations({ type: 'undo' })} disabled={!shapes.length || saving} className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Undo2 className="h-4 w-4" aria-hidden="true" />Undo
              </button>
              <button type="button" title="Redo annotation" onClick={() => dispatchAnnotations({ type: 'redo' })} disabled={!undone.length || saving} className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Redo2 className="h-4 w-4" aria-hidden="true" />Redo
              </button>
              <button
                type="button"
                title="Save Annotations"
                onClick={handleSave}
                disabled={saving}
                className="flex min-h-11 items-center gap-1.5 rounded bg-emerald-700 px-3 text-sm font-semibold transition-colors hover:bg-emerald-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Annotations'}
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              title="Delete X-ray"
              onClick={() => setDeleting(true)}
              className="flex min-h-11 items-center gap-1.5 rounded bg-red-600 px-3 text-sm font-medium transition-colors hover:bg-red-500"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          {(canAnnotate || canDelete) && <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />}
          {!isPdf && (
            <>
              <button type="button" aria-pressed={annotationsVisible} onClick={() => { setAnnotationsVisible((value) => !value); setTool('pan') }}
                className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium hover:bg-slate-700">
                {annotationsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {annotationsVisible ? 'Hide annotations' : 'Show annotations'}
              </button>
              <button type="button" aria-expanded={showAdjustments} onClick={() => setShowAdjustments((value) => !value)}
                className={`flex min-h-11 items-center gap-1.5 rounded px-3 text-sm font-medium ${showAdjustments ? 'bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
                <SlidersHorizontal className="h-4 w-4" />Adjust image
              </button>
              <button
                type="button"
                title="Print"
                onClick={() => openPrintTab(`${PROFILE_PATH}/xray/print`, { patientCode, xrayId: xray.id })}
                className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium transition-colors hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
              <button
                type="button"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={() => zoomImage(1 / 1.25)}
                className="flex h-11 w-11 items-center justify-center rounded bg-slate-800 transition-colors hover:bg-slate-700"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" title="Fit image" aria-label="Fit image" onClick={() => fitImage()}
                className="min-h-11 min-w-11 rounded px-1 text-center text-sm hover:bg-slate-800">{Math.round(scale * 100)}%</button>
              <button
                type="button"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={() => zoomImage(1.25)}
                className="flex h-11 w-11 items-center justify-center rounded bg-slate-800 transition-colors hover:bg-slate-700"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </>
          )}
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

      {showAdjustments && !isPdf && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t border-slate-700 bg-slate-900 px-3 py-2 text-white sm:px-4">
          <div className="flex min-h-11 items-center gap-2">
            <label htmlFor={brightnessId} className="text-base">Brightness</label>
            <input id={brightnessId} type="range" min={50} max={200} step={5} value={brightness}
              onChange={(event) => setBrightness(Number(event.target.value))} className="min-h-11 w-28 accent-sky-400 sm:w-36" />
            <output htmlFor={brightnessId} className="w-12 text-right text-sm tabular-nums">{brightness}%</output>
          </div>
          <div className="flex min-h-11 items-center gap-2">
            <label htmlFor={contrastId} className="text-base">Contrast</label>
            <input id={contrastId} type="range" min={50} max={200} step={5} value={contrast}
              onChange={(event) => setContrast(Number(event.target.value))} className="min-h-11 w-28 accent-sky-400 sm:w-36" />
            <output htmlFor={contrastId} className="w-12 text-right text-sm tabular-nums">{contrast}%</output>
          </div>
          <button type="button" onClick={() => { setBrightness(100); setContrast(100) }}
            className="flex min-h-11 items-center gap-1.5 rounded bg-slate-800 px-3 text-sm font-medium hover:bg-slate-700">
            <RotateCcw className="h-4 w-4" />Reset adjustments
          </button>
          <p className="text-sm text-slate-200">Applies to this view only.</p>
        </div>
      )}

      {(fileError || error) && <div role="alert" className="flex flex-wrap items-center gap-3 bg-red-600 px-4 py-2 text-sm text-white">
        {fileError || error}
        {fileError && <button type="button" onClick={() => setLoadAttempt((value) => value + 1)} className="min-h-11 rounded border border-white px-3 font-medium">Retry file</button>}
      </div>}

      <div ref={viewerRef} tabIndex={0} aria-label="X-ray image viewport" className="min-h-0 flex-1 overflow-auto p-3 sm:p-6"
        style={{ touchAction: 'none', overflowAnchor: 'none', cursor: panMode ? panning ? 'grabbing' : 'grab' : 'default' }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onPointerCancel={(event) => handlePointerUp(event, true)} onLostPointerCapture={(event) => handlePointerUp(event, true)}>
        {(fileLoading || (!isPdf && imageUrl && !naturalSize && !fileError)) && (
          <p role="status" className="flex items-center justify-center gap-2 py-8 text-base text-white"><Loader2 className="h-5 w-5 animate-spin" />Loading X-ray...</p>
        )}
        {isPdf && imageUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-white">
            <FileText className="h-10 w-10 text-slate-200" />
            <p className="text-base">PDF document</p>
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-md bg-sky-600 px-4 text-base font-semibold hover:bg-sky-700">Open PDF</a>
          </div>
        ) : (
          <div className="grid min-h-full w-max min-w-full place-items-center">
            {/* Parehong pixel size ang wrapper, image, at annotation overlay.
                max-w-none sa image para hindi ito ma-squash ng responsive
                image defaults kapag mas malaki na sa viewport ang zoom. */}
            <div className="relative mx-auto inline-block" style={{ width: renderedWidth, height: renderedHeight }}>
              {imageUrl && (
                <>
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    onLoad={handleImageLoad}
                    alt={xray.original_filename}
                    onError={() => setFileError('Could not display this image. Try again.')}
                    style={{ width: renderedWidth, height: renderedHeight, display: 'block', filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
                    className="max-w-none select-none"
                    draggable={false}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute left-0 top-0 h-full w-full"
                    style={{ cursor: panMode ? panning ? 'grabbing' : 'grab' : 'crosshair', opacity: annotationsVisible ? 1 : 0, pointerEvents: annotationsVisible ? 'auto' : 'none' }}
                  />
                  {textInput && (
                    <input
                      ref={textInputRef}
                      type="text"
                      autoFocus
                      value={textInput.value}
                      maxLength={ANNOTATION_TEXT_MAX}
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
        )}
      </div>

      {deleting && (
        <DeleteXrayModal xray={xray} byPatient={!canAnnotate} onClose={() => setDeleting(false)} onDeleted={onClose} />
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
