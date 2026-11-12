// Memory-only, para sa kasalukuyang sign-in lang. Ang photoVersion ay UUID
// ng saved image: pareho ito sa sariling /settings/photo at patient record.
export function createPhotoCache({ load, getToken, createUrl = blob => URL.createObjectURL(blob), revokeUrl = url => URL.revokeObjectURL(url), now = Date.now, maxEntries = 80, maxBytes = 20 * 1024 * 1024, idleMs = 5 * 60 * 1000 }) {
  const entries = new Map(), replacements = new Map(), watchers = new Set()
  let session = null, generation = 0

  function resolve(version) {
    const seen = new Set()
    while (version && replacements.has(version) && !seen.has(version)) {
      seen.add(version)
      version = replacements.get(version)
    }
    return version || null
  }
  const emit = () => { for (const watcher of [...watchers]) watcher.changed() }
  function dispose(entry) {
    entry.controller?.abort()
    if (entry.url) revokeUrl(entry.url)
    entries.delete(entry.version)
  }
  function clear() {
    generation++
    for (const entry of [...entries.values()]) dispose(entry)
    replacements.clear()
    session = null
    emit()
  }
  function syncSession(token) {
    if (!token || token !== getToken()) return false
    if (session !== token) { clear(); session = token }
    return true
  }
  function active(version) {
    return [...watchers].some(watcher => watcher.token === session && resolve(watcher.version) === version)
  }
  function prune() {
    let bytes = [...entries.values()].reduce((sum, entry) => sum + entry.bytes, 0)
    const unused = [...entries.values()].filter(entry => !active(entry.version)).sort((a, b) => a.used - b.used)
    for (const entry of unused) {
      if (entries.size <= maxEntries && bytes <= maxBytes && now() - entry.used < idleMs) continue
      bytes -= entry.bytes
      dispose(entry)
    }
    // Old props can still point to a replaced version. Keep a bounded alias
    // history; never discard aliases currently used by mounted consumers.
    for (const version of replacements.keys()) {
      if (replacements.size <= 256) break
      if (![...watchers].some(watcher => watcher.version === version)) replacements.delete(version)
    }
  }
  function ensure(token, endpoint, requestedVersion) {
    if (!syncSession(token) || !endpoint) return
    const version = resolve(requestedVersion)
    if (!version) return
    let entry = entries.get(version)
    if (entry) {
      entry.used = now()
      if (entry.url || entry.controller || now() - entry.failedAt < 5000) return
    } else {
      entry = { version, bytes: 0, url: null, used: now(), failedAt: -Infinity }
      entries.set(version, entry)
    }
    const controller = new AbortController(), started = generation
    entry.controller = controller
    const current = () => started === generation && token === session && token === getToken() && entries.get(version) === entry && !controller.signal.aborted
    Promise.resolve().then(() => current() ? load(endpoint, version, controller.signal) : null).then(blob => {
      if (!current()) return
      entry.url = createUrl(blob)
      entry.bytes = blob.size
      entry.controller = null
      entry.used = now()
      prune()
      emit()
    }).catch(() => {
      if (!current()) return
      entry.controller = null
      entry.failedAt = now()
      prune()
      emit() // initials sa failure; susubok ulit sa susunod na visit
    })
    prune()
  }
  function get(token, version) {
    if (!token || token !== session || token !== getToken()) return null
    const entry = entries.get(resolve(version))
    if (entry) entry.used = now()
    return entry?.url || null
  }
  function subscribe(token, endpoint, version, changed) {
    const watcher = { token, endpoint, version, changed }
    watchers.add(watcher)
    ensure(token, endpoint, version)
    return () => { watchers.delete(watcher); prune() }
  }
  function replace(token, previousVersion, version, blob) {
    if (!syncSession(token)) return
    const previous = resolve(previousVersion)
    for (const alias of replacements.keys()) {
      if (resolve(alias) === previous && previous) replacements.set(alias, version || null)
    }
    if (previousVersion && previousVersion !== version) replacements.set(previousVersion, version || null)
    if (previous && previous !== version) {
      replacements.set(previous, version || null)
      const old = entries.get(previous)
      if (old) dispose(old)
    }
    // Reuse the freshly cropped bytes after a successful upload; no extra
    // download just to display what was saved. Removal has no new entry.
    if (version && blob && !entries.get(version)?.url) {
      const old = entries.get(version)
      if (old) dispose(old)
      entries.set(version, { version, url: createUrl(blob), bytes: blob.size, used: now(), controller: null })
    }
    for (const watcher of watchers) {
      if (watcher.token === session) ensure(watcher.token, watcher.endpoint, watcher.version)
    }
    prune()
    emit()
  }
  return { subscribe, get, replace, clear }
}
