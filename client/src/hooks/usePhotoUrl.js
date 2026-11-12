import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { photoCache } from '../services/photos'

// Avatars observe their actual container (including CSS-hidden layouts).
// The open editor has no targetRef, kaya agad nitong nakukuha ang preview.
export default function usePhotoUrl(endpoint, version, targetRef) {
  const [visible, setVisible] = useState(!targetRef)
  const token = localStorage.getItem('dentavault_token')
  useEffect(() => {
    if (!targetRef) return
    const element = targetRef.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.boundingClientRect.width > 0 && entry.boundingClientRect.height > 0)
    }, { rootMargin: '0px', threshold: 0.01 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [targetRef])
  const enabled = visible && !!endpoint && !!version && !!token
  const subscribe = useCallback(changed => enabled ? photoCache.subscribe(token, endpoint, version, changed) : () => {}, [enabled, token, endpoint, version])
  const snapshot = useCallback(() => enabled ? photoCache.get(token, version) : null, [enabled, token, version])
  return useSyncExternalStore(subscribe, snapshot, () => null)
}
