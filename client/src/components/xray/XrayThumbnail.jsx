import { useEffect, useState } from 'react'
import { fetchXrayObjectUrl } from '../../services/xrays'

export default function XrayThumbnail({ xray }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let objectUrl
    if (xray.mime_type !== 'application/pdf') {
      fetchXrayObjectUrl(xray.id).then((u) => {
        objectUrl = u
        setUrl(u)
      })
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [xray.id, xray.mime_type])

  if (xray.mime_type === 'application/pdf') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
        PDF
      </div>
    )
  }

  if (!url) {
    return <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">...</div>
  }

  return <img src={url} alt={xray.original_filename} className="h-full w-full object-cover" />
}
