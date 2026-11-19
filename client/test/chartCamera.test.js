import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { CHART_ZOOM_LIMITS, focusChartTooth, resetChartCamera, zoomChartCamera } from '../src/utils/chartCamera.js'

function controls(aspect = 2) {
  const camera = new PerspectiveCamera(45, aspect, 0.05, 100)
  camera.position.set(0, 2.6, 7.6)
  return { object: camera, target: new Vector3(0, 0, -2.2), enableDamping: true,
    ...CHART_ZOOM_LIMITS, update() { this.object.lookAt(this.target); this.object.updateMatrixWorld() } }
}

test('focus centers the transformed tooth, fits wide and narrow sizes, and approaches from its facial side', () => {
  for (const aspect of [2, 0.65]) {
    const c = controls(aspect)
    const tooth = new Group()
    tooth.position.set(-3, 1, -2)
    tooth.rotation.y = Math.PI / 4
    tooth.add(new Mesh(new BoxGeometry(0.8, 1.2, 0.8), new MeshBasicMaterial()))
    focusChartTooth(c, tooth)
    const direction = new Vector3(0, -0.15, 1).transformDirection(tooth.matrixWorld)
    assert.ok(c.target.distanceTo(tooth.position) < 0.00001)
    assert.ok(c.object.position.clone().sub(c.target).normalize().distanceTo(direction) < 0.00001)
    for (const x of [-0.4, 0.4]) for (const y of [-0.6, 0.6]) for (const z of [-0.4, 0.4]) {
      const projected = tooth.localToWorld(new Vector3(x, y, z)).project(c.object)
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1)
    }
    assert.equal(c.enableDamping, true)
  }
})

test('zoom keeps the current pan target, respects limits, and reset restores the whole arch', () => {
  const c = controls()
  c.target.set(-3, 1, -2)
  const target = c.target.clone()
  const distance = c.object.position.distanceTo(target)
  zoomChartCamera(c, 0.8)
  assert.ok(Math.abs(c.object.position.distanceTo(target) - distance * 0.8) < 0.00001)
  assert.deepEqual(c.target, target)
  for (const factor of [0.000001, 1000000]) {
    zoomChartCamera(c, factor)
    assert.ok(Math.abs(c.object.position.distanceTo(target) - (factor < 1 ? c.minDistance : c.maxDistance)) < 0.00001)
  }
  for (const view of [{ camera: [0, 2.6, 7.6], target: [0, 0, -2.2] }, { camera: [0, 2, 5.6], target: [0, 0, -1.3] }]) {
    resetChartCamera(c, view)
    assert.deepEqual(c.object.position.toArray(), view.camera)
    assert.deepEqual(c.target.toArray(), view.target)
    assert.equal(c.object.zoom, 1)
    assert.equal(c.enableDamping, true)
  }
})

test('focus ignores a missing or empty tooth', () => {
  const c = controls()
  const position = c.object.position.clone()
  focusChartTooth(c, undefined)
  focusChartTooth(c, new Group())
  assert.deepEqual(c.object.position, position)
})
