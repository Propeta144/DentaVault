import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Walang patient identifier sa URL (hiling ng adviser): pare-pareho lang
// ang URL ng lahat ng patient (/patients/profile), kaya kahit makita,
// makopya, o mapunta sa browser history, walang tinuturo. Ang patient na
// binuksan, dinadala sa *history state* (location.state) ng React Router
// sa halip — nakatago sa browser, hindi nakikita sa address bar, pero
// naiiwan pa rin sa bawat history entry, kaya gumagana pa rin ang refresh
// at back/forward button (babalik sa tamang patient).

export const PROFILE_PATH = '/patients/profile'

// Gamitin sa <Link to={PROFILE_PATH} state={profileState(code)}> o
// navigate(PROFILE_PATH, { state: profileState(code) }).
export function profileState(patientCode) {
  return { patientCode }
}

// Yung patient account, laging sarili lang niyang record, kaya hindi na
// kailangan ng state — galing na sa login mismo yung code niya.
export function useSelectedPatientCode() {
  const location = useLocation()
  const { user } = useAuth()
  if (user?.role === 'patient') return user.patientCode
  return location.state?.patientCode ?? null
}

// --- Print pages (bagong tab) ---
// Hindi dinadala ng bagong tab yung history state ng pinanggalingang tab.
// Kaya bago buksan, iniiwan muna sa localStorage (shared ng mga tab sa
// parehong site) yung state, tapos kukunin at buburahin agad ng print page
// pagbukas. Maikli lang ang bisa (15s) para hindi maiwan o magamit ng
// ibang tab na binuksan mamaya pa.
const HANDOFF_KEY = 'dentavault_print_handoff'
const HANDOFF_TTL_MS = 15_000

export function openPrintTab(path, state) {
  localStorage.setItem(HANDOFF_KEY, JSON.stringify({ state, at: Date.now() }))
  window.open(path, '_blank')
}

function takePrintHandoff() {
  const raw = localStorage.getItem(HANDOFF_KEY)
  localStorage.removeItem(HANDOFF_KEY)
  if (!raw) return null
  try {
    const { state, at } = JSON.parse(raw)
    return Date.now() - at <= HANDOFF_TTL_MS ? state : null
  } catch {
    return null
  }
}

// Sa print page: kunin yung handoff isang beses, tapos isave sa sariling
// history state ng tab na 'to — para kahit i-refresh, nandiyan pa rin.
export function usePrintState() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state] = useState(() => location.state ?? takePrintHandoff())

  useEffect(() => {
    if (state && !location.state) navigate(location.pathname, { replace: true, state })
  }, [state, location.state, location.pathname, navigate])

  if (!state) return null
  // Patient account: sariling code lang, kahit ano pa ang nasa handoff.
  return user?.role === 'patient' ? { ...state, patientCode: user.patientCode } : state
}
