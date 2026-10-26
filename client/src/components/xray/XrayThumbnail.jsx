import { useEffect, useState } from 'react'
import { FileText, ImageOff } from 'lucide-react'
import { fetchXrayObjectUrl } from '../../services/xrays'

// Habang dina-download (authenticated, kaya blob muna): kumikislap na
// placeholder imbes na "..." sa itim/abo na kahon (critique 2026-10-25). May
// sariling mensahe kapag pumalya.
export default function XrayThumbnail({ xray }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl
    let cancelled = false
    if (xray.mime_type !== 'application/pdf') {
      fetchXrayObjectUrl(xray.id)
        .then((u) => {
          objectUrl = u
          if (!cancelled) setUrl(u)
        })
        .catch(() => !cancelled && setFailed(true))
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [xray.id, xray.mime_type])

  if (xray.mime_type === 'application/pdf') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 text-sm text-slate-600">
        <FileText className="h-6 w-6" aria-hidden="true" />
        PDF
      </div>
    )
  }

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 px-2 text-center text-xs text-slate-600">
        <ImageOff className="h-5 w-5" aria-hidden="true" />
        Couldn&apos;t load preview
      </div>
    )
  }

  if (!url) {
    return (
      <div className="h-full w-full bg-slate-200 motion-safe:animate-pulse" role="status">
        <span className="sr-only">Loading X-ray preview</span>
      </div>
    )
  }

  return <img src={url} alt={xray.original_filename} className="h-full w-full object-cover" />
}
