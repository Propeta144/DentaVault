import { Box3, MathUtils, Sphere, Vector3 } from 'three'

export const CHART_ZOOM_LIMITS = { minDistance: 0.8, maxDistance: 24 }

function moveCamera(controls, target, distance, facingDirection) {
  const camera = controls.object
  // Finish any residual orbit/pan damping before changing the camera target.
  const damping = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  const direction = facingDirection || camera.position.clone().sub(controls.target).normalize()
  if (!direction.lengthSq()) direction.set(0, 0, 1)
  controls.target.copy(target)
  camera.position.copy(target).addScaledVector(direction, MathUtils.clamp(distance, controls.minDistance, controls.maxDistance))
  controls.update()
  controls.enableDamping = damping
}

export function focusChartTooth(controls, tooth) {
  if (!controls || !tooth) return
  tooth.updateWorldMatrix(true, true)
  // Frame the crown itself, excluding the number label and selection outline.
  let crown
  tooth.traverse((object) => { if (object.userData.toothCrown) crown = object })
  const bounds = new Box3().setFromObject(crown || tooth)
  if (bounds.isEmpty()) return
  const { center, radius } = bounds.getBoundingSphere(new Sphere())
  if (!Number.isFinite(radius) || !center.toArray().every(Number.isFinite)) return
  const camera = controls.object
  const vertical = MathUtils.degToRad(camera.getEffectiveFOV())
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect)
  const distance = Math.max(2.5, radius / Math.sin(Math.min(vertical, horizontal) / 2) * 1.65)
  // Approach from this tooth's facial side. A front-of-mouth camera aimed at
  // a back molar can otherwise sit inside the arch or behind nearby teeth.
  const upper = tooth.getWorldPosition(new Vector3()).y > 0
  const direction = new Vector3(0, upper ? -0.15 : 0.15, 1).transformDirection(tooth.matrixWorld)
  moveCamera(controls, center, distance, direction)
}

export function zoomChartCamera(controls, factor) {
  if (!controls) return
  moveCamera(controls, controls.target.clone(), controls.object.position.distanceTo(controls.target) * factor)
}

export function resetChartCamera(controls, view) {
  if (!controls) return
  const damping = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  controls.target.copy(new Vector3(...view.target))
  controls.object.position.set(...view.camera)
  controls.object.zoom = 1
  controls.object.updateProjectionMatrix()
  controls.update()
  controls.enableDamping = damping
}
