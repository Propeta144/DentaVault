import test from 'node:test'
import assert from 'node:assert/strict'
import { fitXrayScale, uploadProgressPercent, xrayReviewStatus } from '../src/utils/xrayView.js'

test('fit preserves the entire panoramic or portrait image, including large images on phones', () => {
  for (const [w, h, vw, vh] of [[8000, 2000, 336, 500], [2000, 8000, 336, 500], [1968, 984, 1300, 760]]) {
    const scale = fitXrayScale(w, h, vw, vh)
    assert.ok(w * scale <= vw + 0.001 && h * scale <= vh + 0.001)
  }
  assert.equal(fitXrayScale(100, 100, 1200, 800), 8)
  assert.equal(fitXrayScale(200, 100, 1200, 800), 6)
  assert.equal(fitXrayScale(0, 100, 300, 500), 1)
  assert.equal(fitXrayScale(100, 100, 300, NaN), 1)
})

test('upload progress supports native totals, Axios fractions, and genuinely unknown totals', () => {
  assert.equal(uploadProgressPercent({ loaded: 50, total: 200 }), 25)
  assert.equal(uploadProgressPercent({ progress: 0.555 }), 56)
  assert.equal(uploadProgressPercent({ loaded: 100, total: 0 }), null)
  assert.equal(uploadProgressPercent({ loaded: 100 }), null)
  assert.equal(uploadProgressPercent({ loaded: NaN, total: 200 }), null)
  assert.equal(uploadProgressPercent({ progress: Infinity }), null)
  assert.equal(uploadProgressPercent({ loaded: 250, total: 200 }), 100)
  assert.equal(uploadProgressPercent({ progress: -0.5 }), 0)
})

test('review labels use the saved timestamp and do not classify clinic uploads as pending submissions', () => {
  assert.deepEqual(xrayReviewStatus({ source: 'patient_upload', reviewed_at: null }, 'patient'), { label: 'Waiting for review', variant: 'amber' })
  assert.equal(xrayReviewStatus({ source: 'patient_upload' }).label, 'New')
  assert.equal(xrayReviewStatus({ source: 'email_inbound' }, 'patient').label, 'Waiting for review')
  assert.deepEqual(xrayReviewStatus({ source: 'patient_upload', reviewed_at: '2026-11-13T02:00:00Z' }, 'patient'), { label: 'Reviewed', variant: 'emerald' })
  assert.equal(xrayReviewStatus({ source: 'manual_upload', reviewed_at: null }), null)
  assert.equal(xrayReviewStatus({ source: 'manual_upload', reviewed_at: '2026-11-13T02:00:00Z' }).label, 'Reviewed')
})
