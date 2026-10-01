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
            {/* Dati: "compare" label sa kaliwa at Email/Manual badge sa kanan,
                parehong nasa itaas — nagpapatong sila sa makitid na thumbnail.
                Ngayon: checkbox lang (44px touch target, may aria-label) sa
                itaas-kaliwa, "New" lang sa itaas-kanan (yun ang kailangang
                pansinin), at ang source ay lumipat sa bottom bar kasama ng petsa. */}
            <label
              title="Select to compare"
              className={`absolute left-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md shadow-sm transition-colors ${
                selected.includes(xray.id) ? 'bg-sky-600' : 'bg-white/95 hover:bg-white'
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Select X-ray from ${xray.taken_date || xray.created_at.slice(0, 10)} to compare`}
                checked={selected.includes(xray.id)}
                onChange={() => toggleSelect(xray.id)}
                className="h-5 w-5 cursor-pointer accent-sky-600"
              />
            </label>
            {xray.source === 'email_inbound' && !xray.reviewed_at && (
              <div className="absolute right-1 top-1">
                <StatusBadge variant="amber">New</StatusBadge>
              </div>
            )}
            <div className="absolute bottom-0 flex w-full items-center justify-between gap-1 bg-slate-900/75 px-2 py-1 text-xs text-white">
              <span className="truncate">{xray.taken_date || xray.created_at.slice(0, 10)}</span>
              <span className="flex shrink-0 items-center gap-1 text-slate-200">
                {xray.source === 'email_inbound' ? (
                  <>
                    <Mail className="h-3 w-3" /> Email
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-3 w-3" /> Manual
                  </>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
