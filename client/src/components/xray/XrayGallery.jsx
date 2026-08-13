import { useState } from 'react'
import { Columns2, Mail, UploadCloud } from 'lucide-react'
import XrayThumbnail from './XrayThumbnail'
import StatusBadge from '../common/StatusBadge'

export default function XrayGallery({ xrays, onOpen, onCompare }) {
  const [selected, setSelected] = useState([])

  function toggleSelect(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id] // keep the selection to at most 2
      return [...prev, id]
    })
  }

  if (xrays.length === 0) {
    return <p className="text-sm text-slate-400">No X-ray images yet.</p>
  }

  return (
    <div>
      {selected.length === 2 && (
        <button
          type="button"
          onClick={() => onCompare(xrays.filter((x) => selected.includes(x.id)))}
          className="mb-3 flex min-h-11 items-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
        >
          <Columns2 className="h-4 w-4" />
          Compare Selected
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {xrays.map((xray) => (
          <div
            key={xray.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <button type="button" onClick={() => onOpen(xray)} className="h-full w-full">
              <XrayThumbnail xray={xray} />
            </button>
            <label className="absolute left-1 top-1 flex min-h-9 items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-sm shadow-sm">
              <input
                type="checkbox"
                checked={selected.includes(xray.id)}
                onChange={() => toggleSelect(xray.id)}
                className="h-4 w-4 accent-sky-600"
              />
              compare
            </label>
            <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
              {xray.source === 'email_inbound' && !xray.reviewed_at && (
                <StatusBadge variant="amber">New</StatusBadge>
              )}
              {xray.source === 'email_inbound' ? (
                <StatusBadge variant="sky" icon={Mail}>
                  Email
                </StatusBadge>
              ) : (
                <StatusBadge variant="slate" icon={UploadCloud}>
                  Manual
                </StatusBadge>
              )}
            </div>
            <div className="absolute bottom-0 w-full truncate bg-slate-900/70 px-1.5 py-1 text-xs text-white">
              {xray.taken_date || xray.created_at.slice(0, 10)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
