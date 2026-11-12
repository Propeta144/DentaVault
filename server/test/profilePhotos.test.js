import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePhoto } from '../src/utils/profilePhoto.js'
import { createPhotoHandlers } from '../src/controllers/photos.controller.js'
import patientsRouter from '../src/routes/patients.routes.js'

const jpeg = (width = 512, height = 512) => Buffer.from([255, 216, 255, 192, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 17, 0, 255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 0, 255, 217])
const invoke = (handler, request) => new Promise((resolve, reject) => {
  const response = { setHeader() {}, type() { return this }, json: resolve, redirect: resolve, sendFile: resolve }
  handler({ params: {}, ...request }, response, reject)
})

test('photo validation rejects disguised SVG, non-square, oversized and malformed JPEG data', () => {
  assert.deepEqual(validatePhoto(jpeg()), { width: 512, height: 512 })
  for (const buffer of [Buffer.from('<svg onload="alert(1)"/>'), jpeg(800, 600), jpeg(16, 16), jpeg(4096, 4096), Buffer.alloc(2 * 1024 * 1024 + 1), Buffer.from([255, 216, ...Array(30).fill(255), 255, 217])]) {
    assert.throws(() => validatePhoto(buffer), error => error.status === 415)
  }
})

test('photo reads and writes enforce owner and dentist access before storage', async () => {
  let reads = 0, writes = 0
  const handlers = createPhotoHandlers({
    patientByCode: async () => ({ id: 8 }),
    userById: async id => ({ id, role: 'patient', patientId: 8 }),
    model: { findPhoto: async owner => { reads++; assert.deepEqual(owner, { type: 'patient', id: 8 }); return { photo_file: 'owned.jpg' } } },
    storage: { resolvePhoto: () => ({ localPath: '/owned.jpg' }), storePhoto: () => { writes++ } },
  })
  const own = { user: { role: 'patient', patientId: 8, userId: 10 }, params: { code: 'sample' } }
  assert.equal(await invoke(handlers.get, own), '/owned.jpg')
  await assert.rejects(invoke(handlers.get, { ...own, user: { role: 'patient', patientId: 9 } }), error => error.status === 403)
  await assert.rejects(invoke(handlers.save, { ...own, file: { buffer: jpeg() } }), error => error.status === 403)
  await assert.rejects(invoke(handlers.remove, own), error => error.status === 403)
  assert.equal(reads, 1); assert.equal(writes, 0)
  for (const method of ['put', 'delete']) {
    const route = patientsRouter.stack.find(layer => layer.route?.path === '/:code/photo' && layer.route.methods[method]).route
    let error
    route.stack[0].handle({ user: own.user }, {}, result => { error = result })
    assert.equal(error?.status, 403)
  }
})

test('a patient account updates its shared patient photo, and failed writes clean up the new file only', async () => {
  const cleaned = [], owners = []
  let fail = false
  const handlers = createPhotoHandlers({
    userById: async id => ({ id, role: 'patient', patientId: 8 }),
    model: { replacePhoto: async (owner, file, version) => {
      owners.push(owner)
      assert.equal(file, 'new.jpg'); assert.match(version, /^[a-f0-9-]{36}$/)
      if (fail) throw new Error('Database unavailable')
      return 'old.jpg'
    } },
    storage: { storePhoto: async () => 'new.jpg', removePhoto: async file => { cleaned.push(file) } },
    audit: async () => {},
  })
  const request = { user: { userId: 10, role: 'patient', patientId: 8 }, file: { buffer: jpeg() }, body: { userId: 999, patientId: 999 } }
  const saved = await invoke(handlers.save, request)
  assert.ok(saved.photoVersion)
  assert.deepEqual(owners, [{ type: 'patient', id: 8 }])
  assert.deepEqual(cleaned, ['old.jpg'])
  fail = true
  await assert.rejects(invoke(handlers.save, request), /Database unavailable/)
  assert.deepEqual(cleaned, ['old.jpg', 'new.jpg'])
})
