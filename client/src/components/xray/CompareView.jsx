import { useEffect, useState } from 'react'
import { fetchXrayObjectUrl } from '../../services/xrays'

export default function CompareView({ xrays, onClose }) {
  const [urls, setUrls] = useState([])

  useEffect(() => {
    let objectUrls = []
    Promise.all(xrays.map((x) => fetchXrayObjectUrl(x.id))).then((loaded) => {
      objectUrls = loaded
      setUrls(loaded)
    })
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u))
  }, [xrays])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90">
      <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 text-white">
        <span className="text-base">Comparing {xrays.length} X-rays</span>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center rounded bg-red-600 px-4 text-sm font-medium"
        >
          Close
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 sm:flex-row sm:gap-2">
        {xrays.map((xray, i) => (
          <div key={xray.id} className="flex-1 overflow-auto text-center">
            <p className="mb-2 text-sm text-slate-300">
              {xray.taken_date || xray.created_at.slice(0, 10)} — {xray.original_filename}
            </p>
            {urls[i] && (
              <img src={urls[i]} alt={xray.original_filename} className="mx-auto max-w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
