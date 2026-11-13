import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFilters } from '../src/utils/auditFilters.js'
import { publicAuditDetails, changedPatientFields } from '../src/utils/auditDetails.js'
import { buildAuditLogQuery, listAuditLogs, listAuditFilterOptions } from '../src/models/auditLogModel.js'
import * as controller from '../src/controllers/auditLog.controller.js'
import router from '../src/routes/auditLog.routes.js'

const code = 'DV-ABCD-1234'
test('audit exact selectors and dates reject malformed filters before database access', async () => {
  assert.deepEqual(auditFilters({ userId: '2', patientCode: code.toLowerCase(), dateFrom: '2024-02-29' }), { userId: 2, patientCode: code, dateFrom: '2024-02-29' })
  assert.deepEqual(auditFilters({ userId: 'system' }), { userId: 'system' })
  for (const value of [{ userId: ['1'] }, { userId: '0' }, { userId: '1 OR 1=1' }, { userId: '9007199254740992' }, { patientCode: 'invalid' }, { patientCode: [code] }, { dateFrom: '2025-02-29' }, { dateTo: {} }, { dateFrom: '2026-11-02', dateTo: '2026-11-01' }]) assert.throws(() => auditFilters(value), (error) => error.status === 400)
  const invoke = (handler, query) => new Promise((resolve, reject) => handler({ query }, { json: resolve }, reject))
  await assert.rejects(invoke(controller.list, { userId: 'invalid' }), (error) => error.status === 400)
  await assert.rejects(invoke(controller.filterOptions, { kind: ['patients'] }), (error) => error.status === 400)
})

test('all audit routes retain dentist-only access', () => {
  for (const path of ['/audit-logs', '/audit-logs/actions', '/audit-logs/filter-options']) {
    const route = router.stack.find((layer) => layer.route?.path === path).route
    for (const role of ['patient', undefined, 'dentist']) {
      let error
      route.stack[0].handle({ user: { role } }, {}, (value) => { error = value })
      assert.equal(error?.status, role === 'dentist' ? undefined : 403)
    }
  }
})

test('audit filters combine exact identities with action/search and inclusive date bounds', () => {
  const result = buildAuditLogQuery({ userId: 3, patientCode: code, action: 'UPDATE_TREATMENT', search: "O'Brien", dateFrom: '2026-11-01', dateTo: '2026-11-02', excludeActions: ['VIEW_DASHBOARD'] })
  assert.match(result.where, /al.user_id = :userId/)
  assert.match(result.where, /rp.patient_code = :patientCode/)
  assert.match(result.where, /al.action = :action/)
  assert.match(result.where, /al.created_at < DATE_ADD\(:dateTo, INTERVAL 1 DAY\)/)
  assert.doesNotMatch(result.where, /O'Brien|DV-ABCD/)
  assert.equal(result.params.userId, 3)
  assert.equal(result.params.search, "%O'Brien%")
  assert.equal(result.params.dateTo, '2026-11-02')
  assert.match(buildAuditLogQuery({ userId: 'system' }).where, /al.user_id IS NULL/)
})

test('count/page share predicates and audit response omits secrets, notes, raw IDs and archive paths', async () => {
  const calls = []
  const db = { execute: async (sql, params) => {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ id: 1, patient_code: code, details: JSON.stringify({ patientId: 8, password: 'SECRET', archivePath: '/private', changedFields: ['Tooth'], previous: { toothNumber: '11', notes: 'PRIVATE NOTE', token: 'SECRET' }, current: { toothNumber: '21' } }) }]] : [[{ total: 1 }]]
  } }
  const result = await listAuditLogs({ limit: 20, offset: 40, userId: 3, patientCode: code }, db)
  assert.deepEqual(calls[0].params, calls[1].params)
  assert.equal(calls[0].sql.split('WHERE ')[1].split(' ORDER BY')[0].trim(), calls[1].sql.split('WHERE ')[1].trim())
  assert.match(calls[0].sql, /LIMIT 20 OFFSET 40/)
  assert.doesNotMatch(calls[0].sql, /rp.deleted_at IS NULL/)
  assert.deepEqual(result.rows[0].details, { changedFields: ['Tooth'], previous: { toothNumber: '11' }, current: { toothNumber: '21' } })
  assert.equal(result.rows[0].patient_code, code)
})

test('filter option searches are bound and capped, and retain deleted audit patients', async () => {
  for (const kind of ['users', 'patients']) {
    let query
    const db = { execute: async (sql, params) => { query = { sql, params }; return [Array.from({ length: 21 }, (_, index) => ({ value: index + 1, name: 'Same name', deleted_at: '2026-01-01' }))] } }
    const result = await listAuditFilterOptions({ kind, search: "O'Brien" }, db)
    assert.equal(result.options.length, 20)
    assert.equal(result.hasMore, true)
    assert.equal(typeof result.options[0].value, 'string')
    assert.match(query.sql, /LIMIT 21 OFFSET 0/)
    assert.doesNotMatch(query.sql, /O'Brien|rp.deleted_at IS NULL/)
    assert.equal(query.params.search, "%O'Brien%")
  }
})

test('audit detail allowlist handles old/malformed events and records field names without copying patient values', () => {
  assert.equal(publicAuditDetails('invalid JSON'), null)
  assert.equal(publicAuditDetails({ passwordHash: 'SECRET', auth: { token: 'SECRET' } }), null)
  assert.deepEqual(publicAuditDetails({ previous: { procedureName: 'Crown', surfaces: ['facial'], notes: 'PRIVATE' } }), { previous: { procedureName: 'Crown', surfaces: ['facial'] } })
  const changed = changedPatientFields({ first_name: 'Maria', address: 'OLD PRIVATE', emergency_contact_relationship: 'Parent' }, { first_name: 'Maria', address: 'NEW PRIVATE', emergency_contact_relationship: 'Spouse' })
  assert.deepEqual(changed, ['Address', 'Emergency contact relationship'])
  assert.doesNotMatch(JSON.stringify(changed), /PRIVATE/)
})
