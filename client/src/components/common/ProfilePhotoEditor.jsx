import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import Modal from './Modal'
import DiscardChangesBar from './DiscardChangesBar'
import useDiscardGuard from '../../hooks/useDiscardGuard'
import usePhotoUrl from '../../hooks/usePhotoUrl'
import { useToast } from '../../context/ToastContext'
import { savePhoto, removePhoto } from '../../services/photos'
import { photoCropRect } from '../../utils/photoCrop'

export default function ProfilePhotoEditor({ endpoint, version, onSaved, onClose }) {
  const { showToast } = useToast()
  const guard = useDiscardGuard(onClose)
  const inputId = useId(), cropId = useId()
  const inputRef = useRef(null), canvasRef = useRef(null), loadId = useRef(0)
  const source = usePhotoUrl(endpoint, version)
  const [image, setImage] = useState(null), [reading, setReading] = useState(false)
  const [zoom, setZoom] = useState(1), [horizontal, setHorizontal] = useState(0), [vertical, setVertical] = useState(0)
  const [removing, setRemoving] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('')
  const busy = reading || saving
  useEffect(() => () => { loadId.current++ }, [])
  useEffect(() => {
    if (!image || !canvasRef.current) return
    const { x, y, size } = photoCropRect(image.naturalWidth, image.naturalHeight, zoom, horizontal, vertical)
    const context = canvasRef.current.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 512, 512)
    context.drawImage(image, x, y, size, size, 0, 0, 512, 512)
  }, [image, zoom, horizontal, vertical])

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG, or WebP photo.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Choose a photo smaller than 10 MB.'); return }
    const currentLoad = ++loadId.current
    setReading(true)
    const url = URL.createObjectURL(file)
    try {
      const nextImage = await new Promise((resolve, reject) => {
        const next = new Image()
        next.onload = () => resolve(next)
        next.onerror = () => reject(new Error('That photo could not be read. Choose another image.'))
        next.src = url
      })
      if (currentLoad !== loadId.current) return
      if (Math.min(nextImage.naturalWidth, nextImage.naturalHeight) < 32 || nextImage.naturalWidth * nextImage.naturalHeight > 40_000_000) throw new Error('Choose a photo at least 32 pixels wide and under 40 megapixels.')
      setImage(nextImage); setZoom(1); setHorizontal(0); setVertical(0)
      guard.setDirty(true)
    } catch (err) { if (currentLoad === loadId.current) setError(err.message) }
    finally { URL.revokeObjectURL(url); if (currentLoad === loadId.current) setReading(false) }
  }

  async function commit(remove = false) {
    if (busy) return
    setSaving(true); setError('')
    try {
      let result
      if (remove) result = await removePhoto(endpoint, version)
      else {
        const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.9))
        if (!blob) throw new Error('Could not prepare that photo. Try another image.')
        result = await savePhoto(endpoint, blob, version)
      }
      onSaved(result.photoVersion)
      showToast(remove ? 'Profile photo removed.' : 'Profile photo saved.', { type: 'success' })
      onClose()
    } catch (err) { setError(err.response?.data?.error || err.message || 'Could not update the photo. Try again.') }
    finally { setSaving(false) }
  }

  const secondary = 'flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
  return (
    <Modal title={removing ? 'Remove Profile Photo' : 'Profile Photo'} onClose={busy ? () => {} : guard.requestClose}>
      <div className="space-y-4">
        {removing ? (
          <p className="text-base text-slate-700">Remove this photo? Initials will appear in its place.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">Choose a photo, then adjust the crop before saving. JPEG, PNG, or WebP, up to 10 MB.</p>
            <div className="mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              {image ? <canvas ref={canvasRef} width="512" height="512" aria-label="Profile photo crop preview" role="img" className="h-full w-full" />
                : source ? <img src={source} alt="Current profile photo" className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center"><Camera className="h-16 w-16 text-slate-500" aria-hidden="true" /></div>}
            </div>
            <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choosePhoto} disabled={busy} />
            <button type="button" className={`${secondary} w-full`} disabled={busy} onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />{reading ? 'Reading photo...' : image || version ? 'Choose another photo' : 'Choose photo'}
            </button>
            {image && <fieldset disabled={busy} className="space-y-3">
              <legend className="sr-only">Adjust photo crop</legend>
              {[
                { label: 'Zoom', value: zoom, change: setZoom, min: 1, max: 3, step: 0.05 },
                { label: 'Horizontal position', value: horizontal, change: setHorizontal, min: -100, max: 100, step: 1 },
                { label: 'Vertical position', value: vertical, change: setVertical, min: -100, max: 100, step: 1 },
              ].map((control, i) => <div key={control.label}>
                <label htmlFor={`${cropId}-${i}`} className="block text-base font-medium text-slate-700">{control.label}</label>
                <input id={`${cropId}-${i}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={event => control.change(Number(event.target.value))} className="min-h-11 w-full accent-sky-600" />
              </div>)}
              <button type="button" className={secondary} onClick={() => { setZoom(1); setHorizontal(0); setVertical(0) }}><RotateCcw className="h-4 w-4" />Center photo</button>
            </fieldset>}
            {version && !image && <button type="button" disabled={busy} onClick={() => setRemoving(true)} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />Remove photo</button>}
          </>
        )}
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</p>}
        {guard.confirming ? <DiscardChangesBar guard={guard} /> : <div className="flex gap-2">
          <button type="button" disabled={busy} className={`${secondary} flex-1 py-3`} onClick={() => removing ? setRemoving(false) : guard.requestClose()}>{removing ? 'Keep photo' : 'Cancel'}</button>
          <button type="button" disabled={busy || (!image && !removing)} onClick={() => commit(removing)} className={`min-h-11 flex-1 rounded-md px-4 py-3 text-base font-semibold text-white disabled:opacity-50 ${removing ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'}`}>{saving ? 'Saving...' : removing ? 'Remove photo' : 'Save photo'}</button>
        </div>}
      </div>
    </Modal>
  )
}
