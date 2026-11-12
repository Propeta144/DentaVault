import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPenDrafts, splitPenStroke, undoPenStroke } from '../src/utils/penDrafts.js'

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

test('a stroke crossing surfaces is split; Undo removes the whole pointer stroke', () => {
  const older = splitPenStroke('22', { conditionCode: 'filling', uv: [[.2, .5]] }, 'older')
  const crossed = splitPenStroke('21', { conditionCode: 'caries', uv: [[.2, .5], [.2, .7], [.21, .71], [.2, .5]] }, 'crossed')
  assert.deepEqual(crossed.map((draft) => draft.surface), ['facial', 'occlusal', 'facial'])
  assert.equal(new Set(crossed.map((draft) => draft.id)).size, 3)
  assert.deepEqual(undoPenStroke([...older, ...crossed]), older)
  assert.deepEqual(undoPenStroke([]), [])
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
