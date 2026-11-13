import test from 'node:test'
import assert from 'node:assert/strict'
import pool from '../src/config/db.js'
import { createChartEntryWithTreatment } from '../src/models/treatmentModel.js'
import { clearChartEntry } from '../src/models/chartModel.js'
import { CONDITION_PROCEDURE } from '../src/utils/treatmentChart.js'
import { CONDITIONS, procedureForCondition } from '../../client/src/constants/dental.js'

// Transaction fixture lang; walang live DB writes.
function database() {
  const db = { chart: [], treatments: [], locks: 0, commits: 0, rollbacks: 0, releases: 0, failAt: null }
  let checkpoint, nextId = 0, inserts = 0
  db.connection = {
    async beginTransaction() { checkpoint = structuredClone({ chart: db.chart, treatments: db.treatments }) },
    async commit() { db.commits++ },
    async rollback() { db.chart = checkpoint.chart; db.treatments = checkpoint.treatments; db.rollbacks++ },
    release() { db.releases++ },
    async execute(sql, values) {
      if (sql.startsWith('SELECT id FROM patients')) { db.locks++; return [[{ id: values.patientId }]] }
      if (sql.startsWith('SELECT * FROM chart_entries WHERE id')) return [db.chart.filter((row) => row.id === values.entryId && row.patient_id === values.patientId)]
      if (sql.startsWith('SELECT * FROM chart_entries WHERE patient_id')) return [[...db.chart].filter((row) => row.patient_id === values.patientId && row.tooth_number === values.toothNumber).reverse()]
      if (sql.startsWith('INSERT INTO treatments')) { const id = ++nextId; db.treatments.push({ id, ...values }); return [{ insertId: id }] }
      if (sql.startsWith('INSERT INTO chart_entries')) {
        if (++inserts === db.failAt) throw Error('Chart insert failed')
        const id = ++nextId
        db.chart.push({ id, patient_id: values.patientId, tooth_number: values.toothNumber, surface: values.surface, condition_code: values.conditionCode, treatment_id: values.treatmentId ?? null, notes: values.notes, stroke_data: values.strokeData ?? null, is_cleared: sql.includes('recordedBy, 1)') ? 1 : 0 })
        return [{ insertId: id }]
      }
      throw Error('Unexpected SQL in fixture: ' + sql)
    },
  }
  return db
}

async function usingDatabase(db, run) {
  const original = pool.getConnection
  pool.getConnection = async () => db.connection
  try { return await run() } finally { pool.getConnection = original }
}

test('client treatment options match server mappings; findings remain chart-only', () => {
  for (const condition of CONDITIONS) assert.equal(procedureForCondition(condition.code), CONDITION_PROCEDURE[condition.code] || null)
  assert.equal(procedureForCondition('filling'), 'Composite Restoration / Filling')
  assert.equal(procedureForCondition('crown'), 'Crown')
  for (const finding of ['caries', 'fractured', 'healthy', 'missing']) assert.equal(procedureForCondition(finding), null)
})

test('chart sync creates one linked treatment for surface drawings and whole-tooth conditions', async () => {
  for (const conditionCode of ['filling', 'root_canal', 'crown', 'extracted']) {
    const db = database()
    const whole = conditionCode !== 'filling'
    const stroke = [{ type: 'freehand', points: [[.2, .5], [.3, .5]], color: '#efa000' }]
    await usingDatabase(db, async () => {
      const result = await createChartEntryWithTreatment({ patientId: 8, procedureName: CONDITION_PROCEDURE[conditionCode], plan: { toothNumber: '14', conditionCode, surfaces: [whole ? 'whole' : 'facial'] }, notes: 'Recorded procedure', strokeData: stroke, recordedBy: 1 })
      assert.equal(db.treatments.length, 1)
      assert.equal(db.chart.length, whole ? 6 : 1)
      assert.ok(db.chart.every((row) => row.treatment_id === result.treatmentId && row.notes === 'Recorded procedure'))
      assert.equal(db.treatments[0].procedureName, CONDITION_PROCEDURE[conditionCode])
      assert.equal(db.locks, 1)
      assert.equal(db.commits, 1)
      assert.equal(db.releases, 1)
      assert.deepEqual(db.chart[0].stroke_data ? JSON.parse(db.chart[0].stroke_data) : null, whole ? null : stroke)
      assert.equal('undoToken' in result, false)
    })
  }
})

test('a failed chart sync rolls back the treatment and every chart surface', async () => {
  const db = database()
  db.failAt = 2
  await usingDatabase(db, async () => {
    await assert.rejects(createChartEntryWithTreatment({ patientId: 8, procedureName: 'Crown', plan: { toothNumber: '14', conditionCode: 'crown', surfaces: ['whole'] }, recordedBy: 1 }), /Chart insert failed/)
    assert.equal(db.treatments.length, 0)
    assert.equal(db.chart.length, 0)
    assert.equal(db.commits, 0)
    assert.equal(db.rollbacks, 1)
    assert.equal(db.releases, 1)
  })
})

test('deleting a synced condition preserves treatment history and rejects stale or foreign entries', async () => {
  const db = database()
  await usingDatabase(db, async () => {
    const saved = await createChartEntryWithTreatment({ patientId: 8, procedureName: 'Composite Restoration / Filling', plan: { toothNumber: '14', conditionCode: 'filling', surfaces: ['facial'] }, recordedBy: 1 })
    await assert.rejects(clearChartEntry({ patientId: 9, entryId: saved.chartEntryId, recordedBy: 1 }), (error) => error.status === 404)
    const result = await clearChartEntry({ patientId: 8, entryId: saved.chartEntryId, recordedBy: 1 })
    assert.equal(result.whole, false)
    assert.equal(db.chart.at(-1).is_cleared, 1)
    assert.equal(db.treatments[0].id, saved.treatmentId)
    assert.equal(db.treatments.length, 1)
    await assert.rejects(clearChartEntry({ patientId: 8, entryId: saved.chartEntryId, recordedBy: 1 }), (error) => error.status === 409)
  })
})
