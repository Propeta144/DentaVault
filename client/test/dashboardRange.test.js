import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardPreset, dashboardRangeError, dashboardRangeKey } from '../src/utils/dashboardRange.js'

test('reporting presets handle year changes and leap-year February', () => {
  assert.deepEqual(dashboardPreset(), { period: 'all' })
  assert.deepEqual(dashboardPreset(''), { period: 'all' })
  assert.equal(dashboardRangeError(dashboardPreset()), '')
  assert.notEqual(dashboardRangeKey(dashboardPreset()), dashboardRangeKey(dashboardPreset('month')))
  assert.deepEqual(dashboardPreset('lastMonth', '2026-01-15'), { dateFrom: '2025-12-01', dateTo: '2025-12-31' })
  assert.deepEqual(dashboardPreset('lastMonth', '2024-03-31'), { dateFrom: '2024-02-01', dateTo: '2024-02-29' })
  assert.deepEqual(dashboardPreset('sixMonths', '2026-03-15'), { dateFrom: '2025-10-01', dateTo: '2026-03-15' })
  assert.deepEqual(dashboardPreset('year', '2026-03-15'), { dateFrom: '2025-04-01', dateTo: '2026-03-15' })
})

test('custom reporting date validation catches invalid or excessive ranges', () => {
  const today = '2026-11-13'
  assert.equal(dashboardRangeError({ dateFrom: today, dateTo: today }, today), '')
  for (const range of [{ dateFrom: '', dateTo: today }, { dateFrom: '2026-02-30', dateTo: today }, { dateFrom: today, dateTo: '2026-11-01' }, { dateFrom: today, dateTo: '2026-11-14' }, { dateFrom: '2024-11-30', dateTo: today }]) {
    assert.ok(dashboardRangeError(range, today))
  }
})
