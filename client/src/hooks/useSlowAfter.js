import { useEffect, useState } from 'react'

// true kapag `active` pa rin pagkalipas ng `ms` (hal. naghihintay pa sa
// server). Sa Render free, natutulog ang server pagkatapos ng 15 minutong
// walang gamit at mga 1 minuto bago magising, kaya ipinapaliwanag ito sa
// user imbes na mukhang sira ang app (#34).
export function useSlowAfter(active, ms = 5000) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      setSlow(false)
      return undefined
    }
    const timer = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(timer)
  }, [active, ms])
  return slow
}

export const SERVER_WAKING_MESSAGE = 'Starting up the server. This can take up to a minute the first time.'
