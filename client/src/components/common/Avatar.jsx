import { initials } from '../../utils/patientName'

const SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-16 w-16 text-xl',
}

const TONES = {
  light: 'bg-sky-100 text-sky-700',
  dark: 'bg-sky-600 text-white',
}

// Initials avatar (walang litrato ang patients sa system). Dekorasyon lang
// ito: laging may kasamang nakasulat na pangalan sa tabi, kaya aria-hidden.
export default function Avatar({ firstName, lastName, size = 'md', tone = 'light' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${SIZES[size]} ${TONES[tone]}`}
    >
      {initials(firstName, lastName)}
    </span>
  )
}
