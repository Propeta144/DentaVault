import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Text, useGLTF } from '@react-three/drei'
import { conditionColor } from '../../constants/dental'
import teethModelUrl from '../../assets/models/teeth.glb?url'
import TEETH_EXTENTS from '../../assets/models/teethExtents.json'

// 16 crown shapes mula sa procedural generator ng team (scripts/teeth-
// source/, inihanda ng scripts/prep-procedural-teeth.cjs): Tooth1..8 =
// upper, LowerTooth1..8 = lower (1 = central incisor ... 8 = 3rd molar).
// Dati: 8 hugis lang (~236 triangles) mula sa "Teeth by Poly by Google",
// iisa sa itaas at ibaba. Preloading avoids a pop-in flash the first time
// a tooth scrolls into view.
useGLTF.preload(teethModelUrl)

const INK_CANVAS_SIZE = 256
// Consecutive drag points further apart than this (in 0..1 UV space)
// don't get a connecting line — without this, a pointer that grazes off
// the crown's edge and re-enters somewhere else on the UV atlas (a real
// risk this close to a seam) draws one long streak across the whole
// texture instead of just lifting the pen.
const MAX_CONNECTED_UV_JUMP = 0.2

// Isang cell bawat surface sa UV atlas ng bawat ngipin. KAPAREHO ng
// UV_CELLS sa scripts/prep-procedural-teeth.cjs (at ng lumang atlas, kaya
// lumalabas pa rin ang mga lumang drawing). Sa geometry, +X = mesial: ang
// mga ngipin sa kabilang side ay mina-mirror (tingnan Tooth3D), kaya laging
// posX ang mesial at negX ang distal.
const UV_CELLS = {
  occlusal: [0, 2 / 3, 1, 1],
  facial: [0, 1 / 3, 0.5, 2 / 3],
  lingual: [0.5, 1 / 3, 1, 2 / 3],
  mesial: [0, 0, 0.5, 1 / 3],
  distal: [0.5, 0, 1, 1 / 3],
}

// Quadrant 3/4 = lower (mandibular) na hugis
function toothNodeName(toothNumber) {
  const lower = toothNumber[0] === '3' || toothNumber[0] === '4'
  return `${lower ? 'LowerTooth' : 'Tooth'}${toothNumber[1]}`
}

// Half-extents (x = mesial-distal, y = taas, z = facial-lingual) ng mismong
// hugis na ginagamit ng ngiping ito, mula teethExtents.json
export function toothExtents(toothNumber) {
  return TEETH_EXTENTS[toothNodeName(toothNumber)]
}

// Kung saang surface tumama ang isang drawing point, mula sa UV niya: bawat
// surface ay may sariling UV cell (tingnan ang UV_CELLS), kaya ang cell na
// tinamaan = ang surface. Dati, kinukuwenta mula sa 3D position (taas at
// lapad), na hindi laging tugma sa kung saan talaga lumalabas ang kulay —
// hal. ang central fossa ng molar ay mababa kaya napupunta sa "facial".
// Ngayon iisa ang batayan ng pintura at ng classification.
export function surfaceForUV([u, v]) {
  for (const [surface, [u0, v0, u1, v1]] of Object.entries(UV_CELLS)) {
    if (u >= u0 && u <= u1 && v >= v0 && v <= v1) return surface
  }
  return 'occlusal'
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

// Read-only na layer ng KULAY sa ibabaw ng crown (parehong UV ng InkLayer):
// 1. `fills`: buong surface na kinukulayan ayon sa condition — para sa mga
//    entry na walang drawing (galing sa 2D chart, o bago pa nagkaroon ng
//    stroke_data). Dati, patag na parihaba itong nakalutang sa tabi ng
//    ngipin; ngayon nakapinta na mismo sa surface (UV cell ng surface na iyon).
// 2. `marks`: ang mismong strokes na iginuhit ng dentist sa mga na-save na
//    entry (chart_entries.stroke_data), sa kulay ng condition nila.
// No pointer handlers and raycast disabled — pure visual layer, must not
// block InkLayer's own paint surface underneath it (an object with no
// handlers still intercepts the raycast unless explicitly excluded).
function SurfaceLayer({ geometry, fills, marks }) {
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

    for (const { surface, color } of fills) {
      const [u0, v0, u1, v1] = UV_CELLS[surface]
      ctx.globalAlpha = 0.72
      ctx.fillStyle = color
      // canvas y = 1 - v (parehong convention ng strokes sa baba)
      ctx.fillRect(u0 * s, (1 - v1) * s, (u1 - u0) * s, (v1 - v0) * s)
    }

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
  }, [ctx, texture, fills, marks])

  return (
    <mesh geometry={geometry} scale={1.012} raycast={() => null}>
      <meshStandardMaterial map={texture} transparent opacity={1} depthWrite={false} side={2} />
    </mesh>
  )
}

const SURFACES = ['facial', 'lingual', 'mesial', 'distal', 'occlusal']

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
  tiltX = 0,
  labelY,
  penColor,
  onPaintStart,
  onPaintEnd,
  highlighted,
  // false sa 3D print: doon, hiwalay na inilalagay ang mga numero para
  // mabasa sa bawat anggulo (tingnan Chart3DSnapshots)
  showLabel = true,
}) {
  const { nodes } = useGLTF(teethModelUrl)
  // FDI: quadrant digit + position digit (1-8). Upper (Q1/Q2) at lower
  // (Q3/Q4) ay may kani-kaniyang hugis na.
  const nodeName = toothNodeName(toothNumber)
  const toothGeometry = nodes[nodeName]?.geometry
  const extents = TEETH_EXTENTS[nodeName]
  const isExtracted = chartState.whole?.condition_code === 'extracted'

  // Hindi simetriko ang mga ngipin (iba ang mesial at distal na side), at
  // +X = mesial sa geometry. Sa mga posisyong nasa kabilang direksyon ang
  // midline, mina-mirror ang X para laging nakaharap sa midline ang mesial —
  // gaya ng totoong bibig (magkasalamin ang kanan at kaliwa). Kaya ang +X
  // UV cell ay laging mesial (tingnan ang UV_CELLS at surfaceForUV).
  // (Inaayos ng three.js ang face winding kapag negative ang scale.)
  const mirrorX = !mesialOnPositiveX

  // Ang kulay ay kinukuha sa condition_code NGAYON, hindi sa hex na
  // naka-save sa stroke_data noong iginuhit — kaya kapag nagbago ang
  // palette (hal. ginawang color-blind safe), sumusunod din ang mga lumang
  // drawing at tugma pa rin sa legend.
  const { fills, marks } = useMemo(() => {
    const fillList = []
    const markList = []
    for (const surface of SURFACES) {
      const entry = chartState[surface]
      if (!entry) continue
      const color = conditionColor(entry.condition_code)
      // May totoong drawing → ang drawing ang ipinapakita; kung wala,
      // buong surface ang kinukulayan
      if (entry.stroke_data?.length) entry.stroke_data.forEach((mark) => markList.push({ ...mark, color }))
      else fillList.push({ surface, color })
    }
    return { fills: fillList, marks: markList }
  }, [chartState])

  return (
    // `position` = gitna ng cervical line (leeg ng ngipin, kung saan lumalabas
    // sa gums). Dito umiikot ang labial tilt (`tiltX`), tapos inaangat ang
    // crown nang kalahating taas niya papunta sa kagat.
    <group position={position} rotation={[0, rotationY, 0]} scale={highlighted ? 1.15 : 1}>
      <group rotation={[tiltX, 0, 0]}>
        {/* Isang group (three.js: scale → rotation → position): mirror X,
            baligtad para sa upper, tapos inaangat ang crown mula sa leeg */}
        <group
          position={[0, extents ? (flipUpper ? -extents.y : extents.y) : 0, 0]}
          rotation={[0, 0, flipUpper ? Math.PI : 0]}
          scale={[mirrorX ? -1 : 1, 1, 1]}
        >
          {toothGeometry && (
            <mesh castShadow receiveShadow geometry={toothGeometry} raycast={() => null}>
              {/* Enamel: bahagyang malamig na off-white, may kaunting kinang
                  (clearcoat) — dati flat na puti. Extracted = abo. */}
              <meshPhysicalMaterial
                color={isExtracted ? '#94a3b8' : '#f2eee6'}
                roughness={isExtracted ? 0.7 : 0.38}
                clearcoat={isExtracted ? 0 : 0.35}
                clearcoatRoughness={0.35}
                transparent={isExtracted}
                opacity={isExtracted ? 0.55 : 1}
              />
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

          {toothGeometry && !isExtracted && (fills.length > 0 || marks.length > 0) && (
            <SurfaceLayer geometry={toothGeometry} fills={fills} marks={marks} />
          )}
        </group>
      </group>

      {/* Tooth number: nakadikit sa harap ng gums (facial side, +Z), ~3 mm
          lampas sa leeg ng ngipin. Labas sa tilt/flip/mirror para laging
          tuwid at nababasa. */}
      {showLabel && extents && (
        <Text
          position={[0, labelY, extents.z + 0.22]}
          fontSize={0.2}
          color="#ffffff"
          outlineWidth={0.014}
          outlineColor="#8a3442"
          anchorX="center"
          anchorY="middle"
          raycast={() => null}
          // Harap lang: kapag tiningnan mula sa likod, hindi lalabas na baligtad
          material-side={THREE.FrontSide}
        >
          {toothNumber}
        </Text>
      )}
    </group>
  )
}
