import { useCallback, useState } from 'react'
import { Camera } from 'lucide-react'
import { createPortal } from 'react-dom'
import ProfilePhotoEditor from './ProfilePhotoEditor'

export default function ProfilePhotoButton({ endpoint, version, onSaved, children }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={version ? 'Change profile photo' : 'Add profile photo'}
        title={version ? 'Change profile photo' : 'Add profile photo'}
        className={`relative flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 ${children ? 'rounded-full' : 'rounded-md border border-slate-300 bg-white px-4'}`}>
        {children || <><Camera className="h-4 w-4" />{version ? 'Change photo' : 'Add photo'}</>}
        {children && <span className="absolute -bottom-1 -right-1 rounded-full border border-slate-200 bg-white p-1"><Camera className="h-3 w-3" aria-hidden="true" /></span>}
      </button>
      {open && createPortal(<ProfilePhotoEditor endpoint={endpoint} version={version} onSaved={onSaved} onClose={close} />, document.body)}
    </>
  )
}
