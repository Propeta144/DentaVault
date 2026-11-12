import test from 'node:test'
import assert from 'node:assert/strict'
import { photoCropRect } from '../src/utils/photoCrop.js'

test('photo crop keeps portrait and landscape crops within the source at every slider extreme', () => {
  for (const [width, height] of [[400, 1000], [1200, 600], [512, 512]]) {
    for (const zoom of [1, 1.5, 3]) for (const horizontal of [-100, 0, 100]) for (const vertical of [-100, 0, 100]) {
      const crop = photoCropRect(width, height, zoom, horizontal, vertical)
      assert.ok(crop.x >= 0 && crop.y >= 0)
      assert.ok(crop.x + crop.size <= width + 0.00001)
      assert.ok(crop.y + crop.size <= height + 0.00001)
      assert.equal(crop.size, Math.min(width, height) / zoom)
    }
  }
  assert.deepEqual(photoCropRect(800, 400), { x: 200, y: 0, size: 400 })
  assert.throws(() => photoCropRect(0, 512))
})
