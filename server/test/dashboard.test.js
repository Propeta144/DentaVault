import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardRange, monthKeys } from '../src/utils/dashboardRange.js'
import { listDashboardRecords, getMonthlyTrend, getTreatmentCount, getXrayCount, getProcedureBreakdown } from '../src/models/dashboardModel.js'
import { get, records } from '../src/controllers/dashboard.controller.js'
import router from '../src/routes/dashboard.routes.js'
import pool from '../src/config/db.js'

test('dashboard ranges validate leap days, inclusive single days, ordering, type and month limits', () => {
  const today = '2026-11-13'
  assert.deepEqual(dashboardRange({}, today), { period: 'all' })
  assert.deepEqual(dashboardRange({ period: 'all' }, today), { period: 'all' })
  assert.deepEqual(dashboardRange({ dateFrom: '', dateTo: '' }, today), { period: 'all' })
  assert.deepEqual(dashboardRange({ dateFrom: today, dateTo: today }, today), { dateFrom: today, dateTo: today })
  assert.deepEqual(dashboardRange({ dateFrom: '2024-02-29', dateTo: '2024-02-29' }, today), { dateFrom: '2024-02-29', dateTo: '2024-02-29' })
  assert.equal(monthKeys('2025-12-31', '2026-02-01').length, 3)
  for (const range of [
    { dateFrom: '2025-02-29' }, { dateTo: '2026-11-31' }, { dateFrom: ['2026-11-01'] },
    { dateFrom: '2026-11-14' }, { dateTo: '2026-12-01' }, { dateFrom: '2024-11-30', dateTo: today }, { dateFrom: today, dateTo: '' },
    { period: ['all'] }, { period: 'all', dateFrom: today, dateTo: today }, { period: 'invalid' },
  ]) assert.throws(() => dashboardRange(range, today), (error) => error.status === 400)
  assert.equal(monthKeys(...Object.values(dashboardRange({ dateFrom: '2024-12-31', dateTo: today }, today))).length, 24)
})

test('all-time aggregates and drill-down retain old records without date predicates or a 24-month truncation', async () => {
  const original = pool.execute
  const calls = []
  pool.execute = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('GROUP BY month')) return [[{ month: '2020-01', count: 2 }]]
    if (sql.includes('GROUP BY t.procedure_name')) return [[{ procedure_name: 'Crown', count: 2 }]]
    return [[{ count: 2 }]]
  }
  try {
    const range = { period: 'all' }
    const trend = await getMonthlyTrend(range)
    assert.equal(trend[0].month, '2020-01')
    assert.deepEqual(trend[0], { month: '2020-01', newPatients: 2, treatments: 2 })
    assert.ok(trend.length > 24)
    assert.equal(trend[1].treatments, 0)
    await getTreatmentCount(range)
    await getXrayCount(range)
    await getProcedureBreakdown(range)
    for (const call of calls) {
      assert.doesNotMatch(call.sql, /:dateFrom|:dateTo/)
      assert.deepEqual(call.params, {})
      assert.match(call.sql, /deleted_at IS NULL/)
    }
    for (const kind of ['treatments', 'xrays']) {
      const queries = []
      const db = { execute: async (sql, params) => { queries.push({ sql, params }); return queries.length === 1 ? [[{ total: 2 }]] : [[]] } }
      const result = await listDashboardRecords({ ...range, kind, procedure: kind === 'treatments' ? 'Crown' : undefined }, db)
      assert.equal(result.total, 2)
      for (const query of queries) {
        assert.doesNotMatch(query.sql, /:dateFrom|:dateTo/)
        assert.deepEqual(query.params, kind === 'treatments' ? { procedure: 'Crown' } : {})
      }
    }
  } finally { pool.execute = original }
})

test('summary and record reads reject malformed filters before reaching the database', async () => {
  const invoke = (handler, query) => new Promise((resolve, reject) => handler({ query }, { json: resolve }, reject))
  await assert.rejects(invoke(get, { dateFrom: 'invalid' }), (error) => error.status === 400)
  for (const query of [{ kind: 'patients' }, { kind: ['xrays'] }, { kind: 'xrays', procedure: 'Crown' }, { kind: 'treatments', procedure: {} }, { kind: 'treatments', procedure: 'x'.repeat(151) }]) {
    await assert.rejects(invoke(records, query), (error) => error.status === 400)
  }
})

test('both dashboard routes enforce dentist role', () => {
  for (const path of ['/dashboard', '/dashboard/records']) {
    const route = router.stack.find((layer) => layer.route?.path === path).route
    for (const role of ['patient', undefined, 'unknown', 'dentist']) {
      let error
      route.stack[0].handle({ user: { role } }, {}, (value) => { error = value })
      assert.equal(error?.status, role === 'dentist' ? undefined : 403)
    }
  }
})

test('drill-down count and page use identical dates, deletion filters, and bound procedure names', async () => {
  const range = { dateFrom: '2026-10-31', dateTo: '2026-11-01' }
  for (const kind of ['treatments', 'xrays']) {
    const calls = []
    const db = { execute: async (sql, params) => { calls.push({ sql, params }); return calls.length === 1 ? [[{ total: 21 }]] : [[{ patient_code: 'TEST', id: 7 }]] } }
    const procedure = "Legacy ' procedure --"
    const result = await listDashboardRecords({ ...range, kind, procedure, limit: 20, offset: 20 }, db)
    assert.equal(result.total, 21)
    assert.equal(result.rows[0].patient_code, 'TEST')
    assert.deepEqual(calls[0].params, calls[1].params)
    assert.equal(calls[0].sql.split('WHERE ')[1], calls[1].sql.split('WHERE ')[1].split(' ORDER BY')[0])
    assert.match(calls[1].sql, /LIMIT 20 OFFSET 20/)
    assert.match(calls[0].sql, /p.deleted_at IS NULL/)
    assert.match(calls[0].sql, /< DATE_ADD\(:dateTo, INTERVAL 1 DAY\)/)
    assert.doesNotMatch(calls[0].sql, /Legacy/)
    if (kind === 'xrays') assert.match(calls[0].sql, /r.deleted_at IS NULL/)
    else assert.equal(calls[0].params.procedure, procedure)
  }
})

test('aggregates share selected boundaries and zero-fill partial months across years', async () => {
  const original = pool.execute
  const range = { dateFrom: '2025-12-31', dateTo: '2026-02-01' }
  const calls = []
  pool.execute = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('GROUP BY month')) return [[{ month: '2026-01', count: 3 }]]
    if (sql.includes('GROUP BY t.procedure_name')) return [[{ procedure_name: 'Crown', count: 2 }]]
    return [[{ count: 2 }]]
  }
  try {
    const trend = await getMonthlyTrend(range)
    assert.deepEqual(trend, [
      { month: '2025-12', newPatients: 0, treatments: 0 },
      { month: '2026-01', newPatients: 3, treatments: 3 },
      { month: '2026-02', newPatients: 0, treatments: 0 },
    ])
    assert.equal(await getTreatmentCount(range), 2)
    assert.equal(await getXrayCount(range), 2)
    assert.equal((await getProcedureBreakdown(range))[0].count, 2)
    for (const call of calls) {
      assert.deepEqual(call.params, range)
      assert.match(call.sql, />= :dateFrom/)
      assert.match(call.sql, /< DATE_ADD\(:dateTo, INTERVAL 1 DAY\)/)
      assert.match(call.sql, /deleted_at IS NULL/)
    }
    assert.match(calls.find((call) => call.sql.includes('xray_images')).sql, /x.deleted_at IS NULL/)
  } finally { pool.execute = original }
})
