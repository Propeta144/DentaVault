import { initials } from '../../utils/patientName'
import { useRef, useState } from 'react'
import usePhotoUrl from '../../hooks/usePhotoUrl'

const SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-16 w-16 text-xl',
}

const TONES = {
  light: 'bg-sky-100 text-sky-700',
  dark: 'bg-sky-600 text-white',
}

// Dekorasyon: may nakasulat na pangalan sa tabi. Initials kapag walang photo.
export default function Avatar({ firstName, lastName, size = 'md', tone = 'light', photoUrl, photoVersion }) {
  const avatarRef = useRef(null)
  const source = usePhotoUrl(photoUrl, photoVersion, avatarRef)
  const [failed, setFailed] = useState(null)
  return (
    <span
      ref={avatarRef}
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ${SIZES[size]} ${TONES[tone]}`}
    >
      {source && failed !== source
        ? <img src={source} alt="" className="h-full w-full object-cover" onError={() => setFailed(source)} />
        : initials(firstName, lastName)}
    </span>
  )
}
