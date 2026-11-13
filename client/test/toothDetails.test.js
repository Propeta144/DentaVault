import test from 'node:test'
import assert from 'node:assert/strict'
import { toothFindings, toothTreatments } from '../src/utils/toothDetails.js'

test('tooth history includes the selected FDI tooth and clearly applicable full-mouth procedures only', () => {
  const treatments = [
    { id: 1, tooth_number: '16' }, { id: 2, tooth_number: 'ALL' },
    { id: 3, tooth_number: '26' }, { id: 4, tooth_number: '65' },
    { id: 5, tooth_number: 16 }, { id: 6, tooth_number: null },
  ]
  assert.deepEqual(toothTreatments(treatments, '16').map((t) => t.id), [1, 2, 5])
  assert.deepEqual(toothTreatments(treatments, '65').map((t) => t.id), [2, 4])
  assert.deepEqual(toothTreatments(treatments, '19'), [])
  assert.deepEqual(toothTreatments(treatments, null), [])
  assert.deepEqual(toothTreatments(treatments, 'ALL'), [])
  assert.equal(treatments.length, 6)
})

test('current findings collapse whole-tooth copies while preserving later overrides and distinct surface notes', () => {
  const whole = { id: 1, surface: 'whole', condition_code: 'crown', recorded_at: '2026-11-01T10:00:00Z', notes: 'Crown placed.' }
  const copy = { ...whole, id: 2, surface: 'occlusal', notes: '' }
  const later = { ...copy, id: 3, surface: 'mesial', recorded_at: '2026-11-02T10:00:00Z' }
  const note = { ...copy, id: 4, surface: 'facial', notes: 'Margin reviewed.' }
  const changed = { ...copy, id: 5, surface: 'distal', condition_code: 'caries' }
  assert.deepEqual(toothFindings({ whole, occlusal: copy, mesial: later, facial: note, distal: changed }), [whole, later, changed, note])
})

test('unrecorded and cleared surfaces are not represented as healthy findings', () => {
  assert.deepEqual(toothFindings({}), [])
  const removed = { id: 1, surface: 'facial', condition_code: 'caries', is_cleared: 1 }
  assert.deepEqual(toothFindings({ facial: removed }), [])
  const healthy = { id: 2, surface: 'occlusal', condition_code: 'healthy' }
  assert.deepEqual(toothFindings({ occlusal: healthy }), [healthy])
  const unknownDate = { id: 3, surface: 'facial', condition_code: 'crown' }
  assert.equal(toothFindings({ whole: { ...unknownDate, surface: 'whole' }, facial: unknownDate }).length, 2)
})
