// Local database integration check; all fixture rows are rolled back.
// Run from server: node --env-file=.env test/chartDeletion.local.js
import assert from 'node:assert/strict'
import pool from '../src/config/db.js'
import { createPatient } from '../src/models/patientModel.js'
import { createChartEntry, createWholeToothEntry, clearChartEntry, getCurrentChart, getToothHistory } from '../src/models/chartModel.js'
import { createTreatment, listTreatmentsForPatient } from '../src/models/treatmentModel.js'
import { getConditionBreakdown } from '../src/models/dashboardModel.js'

if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) throw new Error('Local DB required')
const conn = await pool.getConnection()
const execute = pool.execute
const getConnection = pool.getConnection
const nested = {
  execute: conn.execute.bind(conn), release() {},
  beginTransaction: () => conn.query('SAVEPOINT chart_test'),
  commit: () => conn.query('RELEASE SAVEPOINT chart_test'),
  rollback: () => conn.query('ROLLBACK TO SAVEPOINT chart_test'),
}
try {
  await conn.beginTransaction()
  pool.execute = conn.execute.bind(conn)
  pool.getConnection = async () => nested
  const [[dentist]] = await conn.query("SELECT id FROM users WHERE role = 'dentist' LIMIT 1")
  assert.ok(dentist, 'Local fixture needs an existing dentist')
  const patient = await createPatient({ firstName: 'ChartDeleteTest', lastName: 'LocalOnly', sex: 'female', dateOfBirth: '2000-01-01' })
  const input = { patientId: patient.id, toothNumber: '21', surface: 'facial', recordedBy: dentist.id }
  const old = await createChartEntry({ ...input, conditionCode: 'caries' })
  const latest = await createChartEntry({ ...input, conditionCode: 'filling' })
  await createChartEntry({ ...input, toothNumber: '22', conditionCode: 'caries' })
  await assert.rejects(clearChartEntry({ ...input, entryId: old.id }), (error) => error.status === 409)
  await assert.rejects(clearChartEntry({ ...input, patientId: -1, entryId: latest.id }), (error) => error.status === 404)
  await clearChartEntry({ ...input, entryId: latest.id })
  let current = await getCurrentChart(patient.id)
  assert.equal(current.some((row) => row.tooth_number === '21'), false, 'Old caries must not reappear')
  assert.ok(current.some((row) => row.tooth_number === '22'), 'Other teeth must be preserved')
  const history = await getToothHistory(patient.id, '21')
  assert.equal(history.length, 3)
  assert.equal(history[0].is_cleared, 1)
  await assert.rejects(clearChartEntry({ ...input, entryId: latest.id }), (error) => error.status === 409)
  await createWholeToothEntry({ ...input, conditionCode: 'crown' })
  current = await getCurrentChart(patient.id)
  const crown = current.find((row) => row.tooth_number === '21' && row.surface === 'facial')
  const result = await clearChartEntry({ ...input, entryId: crown.id })
  assert.equal(result.whole, true)
  assert.equal(result.surfaces.length, 6)
  assert.equal((await getCurrentChart(patient.id)).some((row) => row.tooth_number === '21'), false)
  const treatment = await createTreatment({
    patientId: patient.id, procedureName: 'Composite Restoration / Filling', toothNumber: '23',
    surfaces: ['facial'], treatmentDate: '2026-01-01', createdBy: dentist.id,
  }, { conn })
  const linked = (await getCurrentChart(patient.id)).find((row) => row.treatment_id === treatment.id)
  assert.ok(linked)
  await clearChartEntry({ ...input, entryId: linked.id })
  assert.ok((await listTreatmentsForPatient(patient.id)).some((row) => row.id === treatment.id))
  await createChartEntry({ ...input, conditionCode: 'caries' })
  assert.ok((await getCurrentChart(patient.id)).some((row) => row.tooth_number === '21'))
  await getConditionBreakdown()
  console.log('Chart deletion passed: surface/whole clearing, stale and cross-patient rejection, history retention, treatment preservation, re-add, and dashboard. Fixtures rolled back.')
} finally {
  pool.execute = execute
  pool.getConnection = getConnection
  await conn.rollback()
  conn.release()
  await pool.end()
}
