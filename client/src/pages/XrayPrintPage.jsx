import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPatient } from '../services/patients'
import { listXrays, fetchXrayObjectUrl } from '../services/xrays'
import { drawShapes } from '../components/xray/drawAnnotations'

export default function XrayPrintPage() {
  const { patientId, xrayId } = useParams()
  const [patient, setPatient] = useState(null)
  const [xray, setXray] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    let objectUrl
    Promise.all([getPatient(patientId), listXrays(patientId), fetchXrayObjectUrl(xrayId)])
      .then(([p, xrays, url]) => {
        const match = xrays.find((x) => String(x.id) === String(xrayId))
        if (!match) {
          setError('X-ray not found')
          return
        }
        setPatient(p)
        setXray(match)
        objectUrl = url
        setImageUrl(url)
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load X-ray'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [patientId, xrayId])

  function handleImageLoad() {
    const img = imgRef.current
    const canvas = canvasRef.current
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    drawShapes(canvas.getContext('2d'), xray?.annotations || [], canvas.width, canvas.height)
  }

  if (error) return <p className="p-6 text-red-600">{error}</p>
  if (!patient || !xray || !imageUrl) return <p className="p-6 text-slate-500">Loading...</p>

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <span className="text-sm text-slate-500">Print preview</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Print
        </button>
      </div>

      <h1 className="text-xl font-bold">Teodosio-Rufin Dental Clinic</h1>
      <p className="mb-6 text-sm text-slate-500">X-ray Image</p>

      <div className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-sm">
        <div>
          <strong>Name:</strong> {patient.last_name}, {patient.first_name}
        </div>
        <div>
          <strong>Patient ID:</strong> #{patient.id}
        </div>
        <div>
          <strong>Taken:</strong> {xray.taken_date || xray.created_at.slice(0, 10)}
        </div>
        <div>
          <strong>File:</strong> {xray.original_filename}
        </div>
        {xray.notes && (
          <div className="col-span-2">
            <strong>Notes:</strong> {xray.notes}
          </div>
        )}
      </div>

      <div className="relative mx-auto inline-block max-w-full">
        <img
          ref={imgRef}
          src={imageUrl}
          onLoad={handleImageLoad}
          alt={xray.original_filename}
          className="block max-w-full"
        />
        <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Generated {new Date().toLocaleString()} — DentaVault
      </p>
    </div>
  )
}
