import test from 'node:test'
import assert from 'node:assert/strict'
import { OFFLINE_SESSION_KEY, readOfflineSession, saveOfflineSession } from '../src/utils/offlineSession.js'

const now = 1800000000000
const token = (exp) => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`
function storage() {
  const entries = new Map()
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
}

test('offline restore accepts only the matching unexpired verified account', () => {
  const store = storage()
  const current = token(now / 1000 + 60)
  const user = { id: 1, role: 'patient', patientCode: 'DV-SAMPLE', mustChangePassword: false }
  saveOfflineSession(store, current, user)
  assert.deepEqual(readOfflineSession(store, current, now), user)
  assert.equal(readOfflineSession(store, 'another-account-token', now), null)
  assert.equal(readOfflineSession(store, current, now + 60000), null)
  assert.equal(readOfflineSession(store, null, now), null)
})

test('temporary passwords, corrupt snapshots, and invalid tokens cannot restore offline', () => {
  const store = storage()
  const current = token(now / 1000 + 60)
  saveOfflineSession(store, current, { mustChangePassword: true })
  assert.equal(readOfflineSession(store, current, now), null)
  store.setItem(OFFLINE_SESSION_KEY, '{broken')
  assert.equal(readOfflineSession(store, current, now), null)
  saveOfflineSession(store, 'invalid', { id: 1 })
  assert.equal(readOfflineSession(store, 'invalid', now), null)
})
