import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSnapshotRows } from '../src/utils/auditDetails.js'
import { formatAuditDetails, groupAuditLogs } from '../src/utils/auditAction.js'

test('audit display formats recorded clinical fields without showing secrets, notes or unknown payloads', () => {
  const rows = auditSnapshotRows({ procedureName: 'Crown', toothNumber: 'ALL', surfaces: [], treatmentDate: '2026-11-01', password: 'SECRET', notes: 'PRIVATE' })
  assert.equal(rows.find((row) => row.label === 'Tooth').value, 'Full mouth')
  assert.equal(rows.find((row) => row.label === 'Surfaces').value, 'Not recorded')
  assert.equal(rows.find((row) => row.label === 'Treatment date').value, 'Nov 1, 2026')
  assert.doesNotMatch(JSON.stringify(rows), /SECRET|PRIVATE/)
  assert.equal(formatAuditDetails({ password: 'SECRET', token: 'SECRET', current: { toothNumber: '21' } }), '')
  assert.equal(formatAuditDetails({ changedFields: ['Address', 'Allergies'] }), 'Changed fields: Address, Allergies')
  assert.deepEqual(auditSnapshotRows(null), [])
})

test('same-name patient events and different IPs stay separate; same-record events retain all details', () => {
  const row = { id: 1, action: 'CREATE_CHART_ENTRY', patient_name: 'Same Name', patient_code: 'DV-ABCD-1234', user_id: 3, ip_address: '127.0.0.1', created_at: '2026-11-01T10:00:00Z', details: { toothNumber: '11' } }
  assert.equal(groupAuditLogs([row, { ...row, id: 2, patient_code: 'DV-EFGH-5678' }]).length, 2)
  assert.equal(groupAuditLogs([row, { ...row, id: 2, ip_address: '127.0.0.2' }]).length, 2)
  const groups = groupAuditLogs([row, { ...row, id: 2, details: { toothNumber: '21' } }])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].count, 2)
  assert.deepEqual(groups[0].logs.map((log) => log.details.toothNumber), ['11', '21'])
  assert.equal(groupAuditLogs([{ ...row, patient_code: null }, { ...row, id: 2, patient_code: null }]).length, 2)
})
