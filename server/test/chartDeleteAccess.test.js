import test from 'node:test'
import assert from 'node:assert/strict'
import router from '../src/routes/chart.routes.js'

test('chart deletion is dentist-only', () => {
  const route = router.stack.find((layer) => layer.route?.methods.delete && layer.route.path === '/patients/:patientCode/chart/:entryId').route
  const authorize = route.stack[0].handle
  for (const role of ['patient', 'unknown', undefined]) {
    let error
    authorize({ user: role ? { role } : undefined }, {}, (result) => { error = result })
    assert.equal(error?.status, 403)
  }
  let allowed = false
  authorize({ user: { role: 'dentist' } }, {}, (error) => { assert.equal(error, undefined); allowed = true })
  assert.equal(allowed, true)
})
