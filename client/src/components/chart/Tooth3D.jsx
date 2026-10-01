import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Text, useGLTF } from '@react-three/drei'
import { conditionColor } from '../../constants/dental'
import teethModelUrl from '../../assets/models/teeth.glb?url'

// 8 distinct crown shapes, one per FDI tooth *position* (1 = central
// incisor ... 8 = 3rd molar), extracted/re-centered/PCA-aligned from a
// Poly-by-Google "Teeth" asset (see scripts/extract-tooth-set.cjs) — each
// mirrored across all 4 quadrants by position rather than stamping one
// single shape everywhere. Preloading avoids a pop-in flash the first
// time a tooth scrolls into view.
useGLTF.preload(teethModelUrl)

const INK_CANVAS_SIZE = 256
// Consecutive drag points further apart than this (in 0..1 UV space)
// don't get a connecting line — without this, a pointer that grazes off
// the crown's edge and re-enters somewhere else on the UV atlas (a real
// risk this close to a seam) draws one long streak across the whole
// texture instead of just lifting the pen.
const MAX_CONNECTED_UV_JUMP = 0.2

// Mesial-distal (X) and facial-lingual (Z) half-extents per FDI *position*
// (1-8), read straight off scripts/extract-tooth-set.cjs's printed bbox for
// each shape — crown height (Y) is always normalized to ±0.5 by that same
// script regardless of position, so only X/Z vary here. Re-run that script
// (e.g. picking different source meshes) and these need updating to match
// its new printed output.
const TOOTH_EXTENTS = {
  1: { x: 0.482, z: 0.134 },
  2: { x: 0.414, z: 0.129 },
  3: { x: 0.426, z: 0.147 },
  4: { x: 0.387, z: 0.157 },
  5: { x: 0.324, z: 0.148 },
  6: { x: 0.34, z: 0.18 },
  7: { x: 0.318, z: 0.218 },
  8: { x: 0.328, z: 0.344 },
}

export function toothExtents(toothNumber) {
  return TOOTH_EXTENTS[toothNumber[1]]
}

// Classify a touched point — local to the tooth's own un-rotated frame,
// the same one surfaceLayouts() below was measured against — into one of
// the 5 anatomical surfaces using the model's real proportions rather than
// an approximate flat proxy shape: near the crown tip is occlusal,
// otherwise whichever of the mesial-distal (X) or facial-lingual (Z) axis
// the point sits proportionally further out on, relative to that axis's
// real extent for this specific tooth's shape (see TOOTH_EXTENTS above —
// this varies per position now that each one has its own crown shape,
// unlike the single stamped-everywhere template this replaced).
export function classifySurface(localPoint, mesialOnPositiveX, extents) {
  const { x, y, z } = localPoint
  if (y > 0.32) return 'occlusal'
  const xFrac = Math.abs(x) / extents.x
  const zFrac = Math.abs(z) / extents.z
  if (xFrac > zFrac) return x > 0 === mesialOnPositiveX ? 'mesial' : 'distal'
  return z > 0 ? 'facial' : 'lingual'
}

export function mostCommon(list) {
  const counts = {}
  let best = list[0]
  for (const item of list) {
    counts[item] = (counts[item] || 0) + 1
    if (counts[item] > (counts[best] || 0)) best = item
  }
  return best
}

// Freehand ink layer: an exact copy of the tooth's own curved geometry,
// very slightly enlarged so it sits just outside the base crown's surface,
// carrying a canvas texture mapped through the tooth's own real UVs.
// Dragging across it paints an actual stroke that follows the crown's
// contours. A stroke is *collected*, not committed — it's handed to the
// parent on release via `onStrokeComplete`, which decides whether to keep
// it as part of a still-unsaved mark (so the dentist can draw several
// strokes, undo, and only then explicitly save — see Odontogram3D). This
// component just renders whatever `strokes` it's given (redrawing fully
// whenever that list changes, e.g. after an undo) and reports raw points
// while a new one is in progress.
function InkLayer({ geometry, strokes = [], paintEnabled, penColor, onStrokeComplete, onPaintStart, onPaintEnd }) {
  const canvas = useMemo(() => {
    const el = document.createElement('canvas')
    el.width = INK_CANVAS_SIZE
    el.height = INK_CANVAS_SIZE
    return el
  }, [])
  const ctx = useMemo(() => canvas.getContext('2d'), [canvas])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])

  function drawSegment(fromUV, toUV) {
    const s = INK_CANVAS_SIZE
    ctx.globalAlpha = 0.85
    ctx.fillStyle = penColor
    ctx.strokeStyle = penColor
    ctx.lineWidth = s * 0.05
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (fromUV) {
      ctx.beginPath()
      ctx.moveTo(fromUV[0] * s, (1 - fromUV[1]) * s)
      ctx.lineTo(toUV[0] * s, (1 - toUV[1]) * s)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(toUV[0] * s, (1 - toUV[1]) * s, (s * 0.05) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Full redraw whenever the committed-but-unsaved stroke list changes —
  // covers undo (list shrinks), a fresh mark starting (list resets to
  // empty for every tooth except the one being drawn on), and a save
  // clearing everything back out.
  useEffect(() => {
    ctx.clearRect(0, 0, INK_CANVAS_SIZE, INK_CANVAS_SIZE)
    for (const stroke of strokes) {
      stroke.uv.forEach((uv, i) => drawSegment(i === 0 ? null : stroke.uv[i - 1], uv))
    }
    texture.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, texture, strokes])

  const dragging = useRef(false)
  const lastUV = useRef(null)
  const currentUV = useRef([])
  const currentLocal = useRef([])

  function clampedUV(e) {
    if (!e.uv) return null
    return [Math.min(1, Math.max(0, e.uv.x)), Math.min(1, Math.max(0, e.uv.y))]
  }

  function handlePointerDown(e) {
    if (!paintEnabled) return
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    onPaintStart()
    dragging.current = true
    const uv = clampedUV(e)
    lastUV.current = uv
    currentUV.current = uv ? [uv] : []
    currentLocal.current = e.point ? [e.object.worldToLocal(e.point.clone())] : []
    if (uv) drawSegment(null, uv)
    texture.needsUpdate = true
  }

  function handlePointerMove(e) {
    if (!paintEnabled || !dragging.current) return
    const uv = clampedUV(e)
    if (!uv) return
    if (e.point) currentLocal.current.push(e.object.worldToLocal(e.point.clone()))
    const jumped =
      lastUV.current && Math.hypot(uv[0] - lastUV.current[0], uv[1] - lastUV.current[1]) > MAX_CONNECTED_UV_JUMP
    drawSegment(jumped ? null : lastUV.current, uv)
    texture.needsUpdate = true
    currentUV.current.push(uv)
    lastUV.current = uv
  }

  function handlePointerUp(e) {
    if (!paintEnabled || !dragging.current) return
    e.stopPropagation()
    dragging.current = false
    onPaintEnd()
    if (currentUV.current.length > 0) {
      onStrokeComplete({ uv: currentUV.current, local: currentLocal.current })
    }
    lastUV.current = null
    currentUV.current = []
    currentLocal.current = []
  }

  return (
    <mesh
      geometry={geometry}
      scale={1.015}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* depthWrite off: this shell is almost entirely transparent (only
          drawn-on pixels are opaque) and sits a hair outside the base
          crown — without this it can z-fight/occlude the crown underneath
          at grazing angles. */}
      <meshStandardMaterial map={texture} transparent opacity={1} depthWrite={false} side={2} />
    </mesh>
  )
}

// Read-only counterpart to InkLayer: redraws the actual strokes a dentist
// drew for already-saved entries (chart_entries.stroke_data), so a saved
// mark keeps looking like what was actually drawn instead of collapsing
// into a flat colored plane — same UV space as InkLayer, but each mark
// carries its own color (whatever condition was selected when it was
// saved), not one shared live pen color. No pointer handlers and raycast
// disabled — this is a pure visual layer, must not block InkLayer's own
// paint surface underneath it (the exact bug fixed for the condition-plane
// indicators below: an object with no handlers still intercepts the
// raycast unless explicitly excluded).
function HistoryInkLayer({ geometry, marks }) {
  const canvas = useMemo(() => {
    const el = document.createElement('canvas')
    el.width = INK_CANVAS_SIZE
    el.height = INK_CANVAS_SIZE
    return el
  }, [])
  const ctx = useMemo(() => canvas.getContext('2d'), [canvas])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [canvas])

  useEffect(() => {
    const s = INK_CANVAS_SIZE
    ctx.clearRect(0, 0, s, s)
    for (const mark of marks) {
      const pts = mark.points
      if (!pts || pts.length === 0) continue
      ctx.globalAlpha = 0.85
      ctx.fillStyle = mark.color
      ctx.strokeStyle = mark.color
      ctx.lineWidth = s * 0.05
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (pts.length === 1) {
        ctx.beginPath()
        ctx.arc(pts[0][0] * s, (1 - pts[0][1]) * s, (s * 0.05) / 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.moveTo(pts[0][0] * s, (1 - pts[0][1]) * s)
      let last = pts[0]
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > MAX_CONNECTED_UV_JUMP) {
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(p[0] * s, (1 - p[1]) * s)
        } else {
          ctx.lineTo(p[0] * s, (1 - p[1]) * s)
        }
        last = p
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    texture.needsUpdate = true
  }, [ctx, texture, marks])

  return (
    <mesh geometry={geometry} scale={1.012} raycast={() => null}>
      <meshStandardMaterial map={texture} transparent opacity={1} depthWrite={false} side={2} />
    </mesh>
  )
}

// Where each of the 5 surfaces' status panels sit around the crown — only
// rendered when that surface actually has a recorded entry, as an at-a-
// glance summary of the chart (drawing itself now happens directly on the
// tooth via InkLayer, not by touching these). Numbers below were tuned
// against the original single template (x:±0.415, z:±0.148) — scaled here
// by each position's own extents (TOOTH_EXTENTS) so panels still sit flush
// against the crown's actual mesiodistal/faciolingual size instead of the
// old template's proportions.
const TUNED_X_HALF = 0.415
const TUNED_Z_HALF = 0.148

function surfaceLayouts(mesialOnPositiveX, extents) {
  const sx = extents.x / TUNED_X_HALF
  const sz = extents.z / TUNED_Z_HALF
  return {
    facial: { args: [0.68 * sx, 0.72], position: [0, -0.06, 0.16 * sz], rotation: [0, 0, 0] },
    lingual: { args: [0.68 * sx, 0.72], position: [0, -0.06, -0.16 * sz], rotation: [0, Math.PI, 0] },
    mesial: {
      args: [0.3 * sz, 0.72],
      position: [mesialOnPositiveX ? 0.43 * sx : -0.43 * sx, -0.06, 0],
      rotation: [0, mesialOnPositiveX ? -Math.PI / 2 : Math.PI / 2, 0],
    },
    distal: {
      args: [0.3 * sz, 0.72],
      position: [mesialOnPositiveX ? -0.43 * sx : 0.43 * sx, -0.06, 0],
      rotation: [0, mesialOnPositiveX ? Math.PI / 2 : -Math.PI / 2, 0],
    },
    occlusal: { args: [0.68 * sx, 0.32 * sz], position: [0, 0.52, 0], rotation: [-Math.PI / 2, 0, 0] },
  }
}

export default function Tooth3D({
  toothNumber,
  chartState,
  canEdit,
  paintEnabled,
  pendingStrokes,
  onStrokeComplete,
  position,
  rotationY,
  flipUpper,
  mesialOnPositiveX,
  penColor,
  onPaintStart,
  onPaintEnd,
  highlighted,
}) {
  const { nodes } = useGLTF(teethModelUrl)
  // toothNumber is FDI notation: quadrant digit + position digit (1-8,
  // central incisor -> 3rd molar) — same shape reused across all 4
  // quadrants, mirrored/rotated into place by the group transforms below.
  const positionDigit = toothNumber[1]
  const toothGeometry = nodes[`Tooth${positionDigit}`]?.geometry
  const isExtracted = chartState.whole?.condition_code === 'extracted'

  const layouts = surfaceLayouts(mesialOnPositiveX, TOOTH_EXTENTS[positionDigit])
  const surfaces = ['facial', 'lingual', 'mesial', 'distal', 'occlusal']
  // Ang kulay ay kinukuha sa condition_code NGAYON, hindi sa hex na
  // naka-save sa stroke_data noong iginuhit — kaya kapag nagbago ang
  // palette (hal. ginawang color-blind safe), sumusunod din ang mga lumang
  // drawing at tugma pa rin sa legend.
  const historyMarks = surfaces.flatMap((surface) => {
    const entry = chartState[surface]
    return (entry?.stroke_data || []).map((mark) => ({ ...mark, color: conditionColor(entry.condition_code) }))
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={highlighted ? 1.15 : 1}>
      <group rotation={[0, 0, flipUpper ? Math.PI : 0]}>
        {toothGeometry && (
          <mesh castShadow receiveShadow geometry={toothGeometry} raycast={() => null}>
            <meshStandardMaterial color={isExtracted ? '#94a3b8' : '#fdfcfa'} roughness={0.55} />
          </mesh>
        )}

        {toothGeometry && !isExtracted && canEdit && (
          <InkLayer
            geometry={toothGeometry}
            strokes={pendingStrokes}
            paintEnabled={paintEnabled}
            penColor={penColor}
            onStrokeComplete={onStrokeComplete}
            onPaintStart={onPaintStart}
            onPaintEnd={onPaintEnd}
          />
        )}

        {!isExtracted &&
          surfaces.map((surface) => {
            const entry = chartState[surface]
            // Entries with real stroke_data get their actual drawing back
            // via HistoryInkLayer below instead — the flat plane is only a
            // fallback for entries with no captured strokes (2D-originated
            // saves, or anything recorded before stroke_data existed).
            if (!entry || entry.stroke_data) return null
            const layout = layouts[surface]
            return (
              <mesh key={surface} position={layout.position} rotation={layout.rotation} raycast={() => null}>
                <planeGeometry args={layout.args} />
                <meshStandardMaterial
                  color={conditionColor(entry.condition_code)}
                  transparent
                  opacity={0.85}
                  side={2}
                />
              </mesh>
            )
          })}

        {toothGeometry && !isExtracted && historyMarks.length > 0 && (
          <HistoryInkLayer geometry={toothGeometry} marks={historyMarks} />
        )}
      </group>

      {/* Kept outside the flip group deliberately — the label must stay
          upright and land near the gumline (away from the biting edge)
          for both rows, so it needs its own offset rather than inheriting
          the 180° crown-orientation flip applied to upper teeth above. */}
      <Text
        position={[0, flipUpper ? 0.68 : -0.68, 0]}
        fontSize={0.22}
        color="#475569"
        anchorX="center"
        anchorY="middle"
      >
        {toothNumber}
      </Text>
    </group>
  )
}
