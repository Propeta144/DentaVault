// Huling server-verified account lang, hindi patient records. Token-bound ang
// snapshot para hindi maghalo ang account kapag nagpalit ng login.
export const OFFLINE_SESSION_KEY = 'dentavault_offline_session'

export function saveOfflineSession(storage, token, user) {
  try {
    storage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({ token, user }))
  } catch {
    // Puwede pa rin ang online login kahit puno/disabled ang storage.
  }
}

export function readOfflineSession(storage, token, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(OFFLINE_SESSION_KEY))
    if (!token || saved?.token !== token || !saved.user || saved.user.mustChangePassword) return null
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload))
    if (!Number.isFinite(exp) || exp * 1000 <= now) return null
    return saved.user
  } catch {
    return null
  }
}
