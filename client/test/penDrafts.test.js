import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPenDrafts, savePenDrafts, splitPenStroke } from '../src/utils/penDrafts.js'

test('pen drafts retain each condition across surfaces and teeth', () => {
  const drafts = [
    ...splitPenStroke('21', { conditionCode: 'caries', uv: [[.2, .5], [.21, .51]] }, 'a'),
    ...splitPenStroke('21', { conditionCode: 'filling', uv: [[.5, .8]] }, 'b'),
    ...splitPenStroke('22', { conditionCode: 'sealant', uv: [[.5, .8]] }, 'c'),
  ]
  const groups = groupPenDrafts(drafts)
  assert.deepEqual(groups.map(({ toothNumber, surface, conditionCode }) => ({ toothNumber, surface, conditionCode })), [
    { toothNumber: '21', surface: 'facial', conditionCode: 'caries' },
    { toothNumber: '21', surface: 'occlusal', conditionCode: 'filling' },
    { toothNumber: '22', surface: 'occlusal', conditionCode: 'sealant' },
  ])
  assert.equal(drafts[0].conditionCode, 'caries')
})

test('a stroke crossing surfaces keeps distinct segments', () => {
  const crossed = splitPenStroke('21', { conditionCode: 'caries', uv: [[.2, .5], [.2, .7], [.21, .71], [.2, .5]] }, 'crossed')
  assert.deepEqual(crossed.map((draft) => draft.surface), ['facial', 'occlusal', 'facial'])
  assert.equal(new Set(crossed.map((draft) => draft.id)).size, 3)
})

test('groups combine only matching tooth, surface, and condition; saved drafts can be removed without losing others', () => {
  const drafts = [
    ...splitPenStroke('21', { conditionCode: 'caries', uv: [[.2, .5]] }, 'a'),
    ...splitPenStroke('21', { conditionCode: 'caries', uv: [[.3, .5]] }, 'b'),
    ...splitPenStroke('21', { conditionCode: 'filling', uv: [[.2, .5]] }, 'c'),
  ]
  const groups = groupPenDrafts(drafts)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].drafts.length, 2)
  const savedIds = new Set(groups[0].drafts.map((draft) => draft.id))
  const remaining = drafts.filter((draft) => !savedIds.has(draft.id))
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].conditionCode, 'filling')
  assert.equal(drafts.length, 3)
})

test('large UV seam jumps do not create connecting strokes', () => {
  const segments = splitPenStroke('21', { conditionCode: 'caries', uv: [[.1, .8], [.9, .8]] }, 'seam')
  assert.equal(segments.length, 2)
  assert.ok(segments.every((segment) => segment.surface === 'occlusal' && segment.uv.length === 1))
})

const draft = (tooth, code, id, uv = [.2, .5]) => splitPenStroke(tooth, { conditionCode: code, uv: [uv] }, id)
const response = (payload) => ({ tooth_number: payload.toothNumber, surface: payload.surface,
  condition_code: payload.conditionCode, stroke_data: payload.strokeData, notes: payload.notes, treatment_id: payload.addTreatment ? 10 : null })

test('save all preserves tooth/surface/condition identity and saves in last-drawn order', async () => {
  const drafts = [...draft('21', 'caries', 'a'), ...draft('21', 'filling', 'b'),
    ...draft('22', 'sealant', 'c', [.5, .8]), ...draft('21', 'caries', 'd')]
  const calls = [], saved = []
  await savePenDrafts({ drafts, entries: [], addTreatments: true,
    saveEntry: async (payload) => { calls.push(payload); return response(payload) },
    onSaved: (group) => saved.push(group.key),
  })
  assert.deepEqual(saved, ['21:facial:filling', '22:occlusal:sealant', '21:facial:caries'])
  assert.equal(calls[2].strokeData.length, 2)
  assert.deepEqual(calls.map((payload) => payload.addTreatment), [true, true, false])
  assert.equal(drafts.length, 4)
})

test('save all appends matching saved strokes, retains notes, and avoids an existing linked treatment', async () => {
  const strokes = [{ type: 'freehand', points: [[.21, .51]], color: '#000000' }]
  let payload
  await savePenDrafts({ drafts: draft('21', 'filling', 'a'), addTreatments: true,
    entries: [{ tooth_number: '21', surface: 'facial', condition_code: 'filling', stroke_data: strokes, notes: 'Existing note', treatment_id: 9 }],
    saveEntry: async (input) => { payload = input; return response(input) }, onSaved: () => {},
  })
  assert.equal(payload.strokeData.length, 2)
  assert.deepEqual(payload.strokeData[0], strokes[0])
  assert.equal(payload.notes, 'Existing note')
  assert.equal(payload.addTreatment, false)
  assert.equal(strokes.length, 1)
})

test('a replacement condition does not inherit another condition drawings or notes; treatment sync can be unchecked', async () => {
  let payload
  await savePenDrafts({ drafts: draft('21', 'filling', 'a'), addTreatments: false,
    entries: [{ tooth_number: '21', surface: 'facial', condition_code: 'caries', notes: 'Old caries note', stroke_data: [{ type: 'freehand', points: [[.3, .5]] }] }],
    saveEntry: async (input) => { payload = input; return response(input) }, onSaved: () => {},
  })
  assert.equal(payload.strokeData.length, 1)
  assert.equal(payload.notes, '')
  assert.equal(payload.addTreatment, false)
})

test('a failed save stops the batch and retry submits only the remaining drafts', async () => {
  let remaining = [...draft('21', 'filling', 'a'), ...draft('22', 'caries', 'b'), ...draft('23', 'sealant', 'c')]
  const entries = [], calls = []
  const onSaved = (group, entry) => {
    const ids = new Set(group.drafts.map((item) => item.id))
    remaining = remaining.filter((item) => !ids.has(item.id))
    entries.push(entry)
  }
  await assert.rejects(savePenDrafts({ drafts: remaining, entries: [], addTreatments: true,
    saveEntry: async (payload) => {
      calls.push(payload.toothNumber)
      if (payload.toothNumber === '22') throw new Error('Save unavailable')
      return response(payload)
    }, onSaved,
  }), /Save unavailable/)
  assert.deepEqual(calls, ['21', '22'])
  assert.deepEqual(remaining.map((item) => item.toothNumber), ['22', '23'])
  await savePenDrafts({ drafts: remaining, entries, addTreatments: true,
    saveEntry: async (payload) => { calls.push(payload.toothNumber); return response(payload) }, onSaved,
  })
  assert.deepEqual(calls, ['21', '22', '22', '23'])
  assert.equal(remaining.length, 0)
})
