import { useCallback, useEffect, useRef, useState } from 'react'

// Babala bago mawala ang hindi pa nase-save na laman ng form.
//
// Paano gamitin: ipasa ang guard sa form (tinatawag ng form ang
// `guard.setDirty` kapag may binago), at gamitin ang `requestClose` bilang
// onClose ng Modal / Cancel ng form. Kapag may binago, hindi agad
// nagsasara: `confirming` = true, at ipinapakita ng form ang
// <DiscardChangesBar> (Keep editing / Discard).
//
// Naka-ref ang `dirty` (hindi lang state): kung pinindot ang Escape sa
// mismong sandali pagkatapos mag-type/pumili, baka hindi pa nagre-render
// ang parent — sa ref, laging pinakabago ang nababasa ni requestClose.
//
// `warnOnUnload`: para sa buong page (Register) — babala rin ng browser
// kapag isinara/ni-refresh ang tab. (Hindi sakop ang pag-click sa ibang menu
// sa loob ng app: BrowserRouter ang gamit, walang route blocker.)
export default function useDiscardGuard(onClose, { warnOnUnload = false } = {}) {
  const dirtyRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const [dirty, setDirtyState] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const setDirty = useCallback((value) => {
    dirtyRef.current = value
    setDirtyState(value)
  }, [])

  const requestClose = useCallback(() => {
    if (dirtyRef.current) setConfirming(true)
    else onCloseRef.current()
  }, [])

  const keepEditing = useCallback(() => setConfirming(false), [])

  const discard = useCallback(() => {
    setConfirming(false)
    dirtyRef.current = false
    setDirtyState(false)
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (!warnOnUnload || !dirty) return
    function handleBeforeUnload(e) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [warnOnUnload, dirty])

  return { setDirty, requestClose, confirming, keepEditing, discard }
}
