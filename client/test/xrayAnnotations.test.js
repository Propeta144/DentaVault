import test from 'node:test'
import assert from 'node:assert/strict'
import { createAnnotationHistory, annotationHistoryReducer as reduce } from '../src/components/xray/annotationHistory.js'

const line = { type: 'line', points: [[.2, .3], [.4, .5]], color: '#ef4444' }
const text = { type: 'text', x: .6, y: .7, text: 'Review', color: '#ef4444' }

test('X-ray undo and redo retain saved and newly added pen/text marks in order with original coordinates', () => {
  const initial = [line, text]
  let state = createAnnotationHistory(initial)
  const baseline = JSON.stringify(state.shapes)
  state = reduce(state, { type: 'undo' })
  assert.deepEqual(state.shapes, [line])
  state = reduce(state, { type: 'undo' })
  assert.deepEqual(state.shapes, [])
  assert.equal(reduce(state, { type: 'undo' }), state)
  state = reduce(state, { type: 'redo' })
  state = reduce(state, { type: 'redo' })
  assert.equal(JSON.stringify(state.shapes), baseline)
  assert.deepEqual(state.undone, [])
  assert.equal(reduce(state, { type: 'redo' }), state)
  const next = { ...line, points: [[.1, .1], [.15, .2]] }
  state = reduce(state, { type: 'add', shape: next })
  state = reduce(state, { type: 'undo' })
  state = reduce(state, { type: 'redo' })
  assert.deepEqual(state.shapes, [...initial, next])
  assert.deepEqual(initial, [line, text])
})

test('a new X-ray annotation clears the redo branch; another viewer starts from its own saved annotations', () => {
  let state = createAnnotationHistory([line, text])
  state = reduce(state, { type: 'undo' })
  const replacement = { ...text, text: 'New review' }
  state = reduce(state, { type: 'add', shape: replacement })
  assert.deepEqual(state.shapes, [line, replacement])
  assert.deepEqual(state.undone, [])
  assert.equal(reduce(state, { type: 'redo' }), state)
  assert.deepEqual(createAnnotationHistory(null), { shapes: [], undone: [] })
  assert.deepEqual(createAnnotationHistory([line]), { shapes: [line], undone: [] })
})
