import test from 'node:test'
import assert from 'node:assert/strict'
import { createPhotoCache } from '../src/utils/photoCache.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const photo = () => new Blob(['sample-photo'], { type: 'image/jpeg' })
function setup(options = {}) {
  let token = 'session-a', time = 0, nextUrl = 0
  const requests = [], revoked = []
  const cache = createPhotoCache({
    getToken: () => token,
    now: () => ++time,
    createUrl: () => `blob:sample-${++nextUrl}`,
    revokeUrl: url => revoked.push(url),
    load: async (endpoint, version, signal) => { requests.push({ endpoint, version, signal }); return photo() },
    ...options,
  })
  return { cache, requests, revoked, token: value => { token = value }, advance: value => { time += value } }
}

test('same saved photo coalesces simultaneous account/record requests and reuses it after navigation', async () => {
  const { cache, requests, revoked } = setup()
  const offMenu = cache.subscribe('session-a', '/settings/photo', 'shared-version', () => {})
  const offRecord = cache.subscribe('session-a', '/patients/sample/photo', 'shared-version', () => {})
  await flush()
  assert.equal(requests.length, 1)
  const source = cache.get('session-a', 'shared-version')
  assert.ok(source)
  offMenu(); offRecord()
  const offSettings = cache.subscribe('session-a', '/settings/photo', 'shared-version', () => {})
  await flush()
  assert.equal(requests.length, 1)
  assert.equal(cache.get('session-a', 'shared-version'), source)
  assert.deepEqual(revoked, [])
  offSettings(); cache.clear()
  assert.deepEqual(revoked, [source])
})

test('successful replacement/removal refreshes mounted consumers even with old version props', async () => {
  const { cache, requests, revoked } = setup()
  let changes = 0
  const off = cache.subscribe('session-a', '/settings/photo', 'old-version', () => { changes++ })
  await flush()
  const old = cache.get('session-a', 'old-version')
  cache.replace('session-a', 'old-version', 'new-version', photo())
  assert.equal(cache.get('session-a', 'old-version'), cache.get('session-a', 'new-version'))
  assert.notEqual(cache.get('session-a', 'new-version'), old)
  assert.ok(revoked.includes(old))
  cache.replace('session-a', 'new-version', 'third-version', photo())
  assert.equal(cache.get('session-a', 'old-version'), cache.get('session-a', 'third-version'))
  cache.replace('session-a', 'third-version', null)
  assert.equal(cache.get('session-a', 'old-version'), null)
  const offStale = cache.subscribe('session-a', '/patients/sample/photo', 'old-version', () => {})
  await flush()
  assert.equal(requests.length, 1, 'replacements use uploaded bytes; deleted old props cannot restart a download')
  assert.ok(changes >= 4)
  off(); offStale(); cache.clear()
})

test('session switch aborts old requests and late responses cannot repopulate the new session', async () => {
  let finish, signal, loads = 0
  const { cache, token, revoked } = setup({ load: (endpoint, version, currentSignal) => {
    loads++; signal = currentSignal
    return new Promise(resolve => { finish = resolve })
  } })
  const off = cache.subscribe('session-a', '/settings/photo', 'private-version', () => {})
  await flush()
  token('session-b'); cache.clear()
  assert.equal(signal.aborted, true)
  finish(photo()); await flush()
  assert.equal(cache.get('session-b', 'private-version'), null)
  assert.equal(cache.get('session-a', 'private-version'), null)
  const stale = cache.subscribe('session-a', '/settings/photo', 'private-version', () => {})
  await flush()
  assert.equal(loads, 1)
  assert.deepEqual(revoked, [])
  off(); stale(); cache.clear()
})

test('bounded retention evicts unused least-recent photos but keeps displayed images valid', async () => {
  const { cache, requests, revoked } = setup({ maxEntries: 2 })
  const active = cache.subscribe('session-a', '/active', 'active', () => {})
  await flush()
  const activeSource = cache.get('session-a', 'active')
  const first = cache.subscribe('session-a', '/first', 'first', () => {})
  await flush(); const firstSource = cache.get('session-a', 'first'); first()
  const second = cache.subscribe('session-a', '/second', 'second', () => {})
  await flush(); second()
  assert.equal(requests.length, 3)
  assert.ok(revoked.includes(firstSource))
  assert.equal(cache.get('session-a', 'first'), null)
  assert.equal(cache.get('session-a', 'active'), activeSource)
  active(); cache.clear()
})

test('errors show initials without a request loop, and a later visit can retry', async () => {
  let attempts = 0
  const { cache, advance } = setup({ load: async () => { attempts++; if (attempts === 1) throw new Error('Offline'); return photo() } })
  const one = cache.subscribe('session-a', '/settings/photo', 'version', () => {})
  await flush(); one()
  assert.equal(cache.get('session-a', 'version'), null)
  const two = cache.subscribe('session-a', '/settings/photo', 'version', () => {})
  await flush(); two()
  assert.equal(attempts, 1)
  advance(6000)
  const three = cache.subscribe('session-a', '/settings/photo', 'version', () => {})
  await flush()
  assert.equal(attempts, 2)
  assert.ok(cache.get('session-a', 'version'))
  three(); cache.clear()
})

test('logout revokes cached URLs and an old upload response cannot insert bytes afterward', async () => {
  const { cache, token, revoked } = setup()
  const off = cache.subscribe('session-a', '/settings/photo', 'version', () => {})
  await flush()
  const source = cache.get('session-a', 'version')
  token(null); cache.clear()
  cache.replace('session-a', 'version', 'late-upload', photo())
  assert.equal(cache.get('session-a', 'late-upload'), null)
  assert.deepEqual(revoked, [source])
  off()
})

test('byte and idle budgets release unused images and revoke their URLs', async () => {
  const { cache, revoked, advance } = setup({ maxBytes: photo().size, idleMs: 100 })
  const one = cache.subscribe('session-a', '/one', 'one', () => {})
  await flush(); const first = cache.get('session-a', 'one'); one()
  const two = cache.subscribe('session-a', '/two', 'two', () => {})
  await flush(); const second = cache.get('session-a', 'two'); two()
  assert.equal(cache.get('session-a', 'one'), null)
  assert.ok(revoked.includes(first))
  advance(200)
  const three = cache.subscribe('session-a', '/three', 'three', () => {})
  await flush()
  assert.equal(cache.get('session-a', 'two'), null)
  assert.ok(revoked.includes(second))
  assert.ok(cache.get('session-a', 'three'))
  three(); cache.clear()
})
