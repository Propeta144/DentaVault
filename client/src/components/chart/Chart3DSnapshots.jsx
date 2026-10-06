import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import Tooth3D, { toothExtents } from './Tooth3D'
import Gingiva from './Gingiva'
import { ARCHES } from './archLayout'
import { ODONTOGRAM_ROWS } from '../../constants/dental'
import { TOOTH_PLACEMENTS, SceneLights, groupChartEntries } from './chartScene'

// Mga larawan ng 3D chart para sa print (Feature #22). Hindi maaasahan ang
// pag-print ng mismong 3D canvas (madalas blangko, at isang anggulo lang
// kung saan huling iniwan), kaya dito: isang nakatagong Canvas na kumukuha
// ng larawan mula sa 5 nakapirming anggulo, tapos ibinibigay sa print page
// bilang <img>. Pare-pareho ang itsura sa bawat print at kita ang lahat ng ngipin.

// Laki ng bawat larawan (CSS px; ×2 dahil sa dpr para malinaw sa papel)
const WIDTH = 1200
const HEIGHT = 800
const DPR = 2
// Gaano kalaki ang model sa frame (1 = dikit sa gilid)
const FILL = 0.84
const LABEL_FONT_SIZE = 0.27

// `dir` = direksyon ng camera mula sa gitna ng model. `minFacing`: gaano
// dapat nakaharap sa camera ang ngipin para lumabas ang numero (mas mahigpit
// sa gilid, kung saan nagsisiksikan ang mga numero sa harap ng arch). Ang screen-kaliwa ng
// Front, Upper at Lower ay ang KANAN ng pasyente (gaya ng 2D chart: nakaharap
// ang dentist sa pasyente). Upper = tingin mula sa ilalim (incisors sa itaas
// ng larawan); Lower = tingin mula sa itaas (incisors sa ibaba).
const SNAPSHOT_VIEWS = [
  { key: 'front', title: 'Front', arches: ['upper', 'lower'], dir: [0, 0.12, 1], up: [0, 1, 0], labels: 'gum' },
  { key: 'upper', title: 'Upper arch (biting surfaces)', arches: ['upper'], dir: [0, -1, 0], up: [0, 0, 1], labels: 'occlusal' },
  { key: 'lower', title: 'Lower arch (biting surfaces)', arches: ['lower'], dir: [0, 1, 0], up: [0, 0, -1], labels: 'occlusal' },
  { key: 'right', title: "Patient's right side", arches: ['upper', 'lower'], dir: [-1, 0.12, 0], up: [0, 1, 0], labels: 'gum', minFacing: 0.6 },
  { key: 'left', title: "Patient's left side", arches: ['upper', 'lower'], dir: [1, 0.12, 0], up: [0, 1, 0], labels: 'gum', minFacing: 0.6 },
]

// Lokal na punto ng ngipin (x = mesial-distal, z = palabas/facial) → world,
// gamit ang pwesto at ikot (rotationY) ng ngipin sa arch
function toWorld(placement, [x, y, z]) {
  const r = placement.rotationY
  return new THREE.Vector3(
    placement.position[0] + x * Math.cos(r) + z * Math.sin(r),
    placement.position[1] + y,
    placement.position[2] - x * Math.sin(r) + z * Math.cos(r),
  )
}

// Pwesto ng numero ng ngipin sa isang view:
// - 'gum': nakadikit sa harap ng gums (gaya ng 3D chart sa screen)
// - 'occlusal': sa labas ng arch, nasa occlusal plane (y = 0), para mabasa
//   kapag tiningnan mula sa itaas/ilalim
function labelPosition(placement, toothNumber, mode) {
  const ext = toothExtents(toothNumber)
  if (mode === 'occlusal') {
    const p = toWorld(placement, [0, 0, ext.z + 0.42])
    p.y = 0
    return p
  }
  return toWorld(placement, [0, placement.labelY, ext.z + 0.22])
}

const ALL_TEETH = ODONTOGRAM_ROWS.flatMap((row, rowIndex) =>
  row.map((toothNumber, i) => ({ toothNumber, upper: rowIndex === 0, placement: TOOTH_PLACEMENTS[rowIndex][i] })),
)

// Ilapit/ilayo ang camera hanggang kasya ang box sa frame (ilang ulit,
// dahil perspective: hindi linear ang laki sa distansya)
function fitCamera(camera, box, dir, up) {
  const center = box.getCenter(new THREE.Vector3())
  const { min, max } = box
  const corners = [
    [min.x, min.y, min.z], [min.x, min.y, max.z], [min.x, max.y, min.z], [min.x, max.y, max.z],
    [max.x, min.y, min.z], [max.x, min.y, max.z], [max.x, max.y, min.z], [max.x, max.y, max.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const direction = new THREE.Vector3(...dir).normalize()
  camera.up.set(...up)
  let distance = box.getSize(new THREE.Vector3()).length() * 1.5
  for (let i = 0; i < 6; i++) {
    camera.position.copy(center).addScaledVector(direction, distance)
    camera.lookAt(center)
    camera.updateMatrixWorld()
    let extent = 0
    for (const c of corners) {
      const p = c.clone().project(camera)
      extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y))
    }
    distance *= extent / FILL
  }
  camera.position.copy(center).addScaledVector(direction, distance)
  camera.lookAt(center)
  camera.updateMatrixWorld()
  return direction
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

function SnapshotTaker({ archRefs, labelRefs, labelsReady, onDone, onError }) {
  const { gl, scene } = useThree()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await labelsReady
      // Ilang frame muna para ma-drawing ng SurfaceLayer ang mga kulay/strokes
      // (useEffect) bago kunan
      await nextFrame()
      await nextFrame()
      if (cancelled) return

      const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.1, 200)
      // "Headlight": ilaw mula sa direksyon ng camera, para pantay ang liwanag
      // sa bawat anggulo (lalo na ang upper arch na tinitingnan mula sa ilalim,
      // na madilim kung ang mga ilaw lang ng 3D chart ang gamit)
      const headlight = new THREE.DirectionalLight('#ffffff', 0.55)
      scene.add(headlight, headlight.target)
      const shots = []
      for (const view of SNAPSHOT_VIEWS) {
        const box = new THREE.Box3()
        for (const key of ['upper', 'lower']) {
          const group = archRefs[key].current
          group.visible = view.arches.includes(key)
          if (group.visible) box.union(new THREE.Box3().setFromObject(group))
        }
        const direction = fitCamera(camera, box, view.dir, view.up)
        headlight.position.copy(camera.position)
        headlight.target.position.copy(box.getCenter(new THREE.Vector3()))
        headlight.target.updateMatrixWorld()
        const facing = new THREE.Vector3(direction.x, 0, direction.z)
        const hasFacing = facing.lengthSq() > 0.01
        if (hasFacing) facing.normalize()

        for (const { toothNumber, upper, placement } of ALL_TEETH) {
          const label = labelRefs.current[toothNumber]
          if (!label) continue
          // Numero lang ng mga ngipin na nakaharap sa camera (sa gilid at
          // harap); sa itaas/ilalim, lahat ng ngipin ng arch na iyon
          let visible = view.arches.includes(upper ? 'upper' : 'lower')
          if (visible && view.labels === 'gum' && hasFacing) {
            const r = placement.rotationY
            visible = Math.sin(r) * facing.x + Math.cos(r) * facing.z > (view.minFacing ?? 0.45)
          }
          label.visible = visible
          // Laging nasa ibabaw (hindi natatakpan ng kurba ng gums). Sa mismong
          // material ng troika Text ito sine-set; dahil may outline, DALAWA
          // ang material (outline + text), kaya array. Ang mga nakatalikod
          // ay itinago na sa taas.
          for (const material of [label.material].flat()) {
            material.depthTest = false
            material.depthWrite = false
          }
          label.position.copy(labelPosition(placement, toothNumber, view.labels))
          // Laging nakaharap at tuwid sa camera, para nababasa
          label.quaternion.copy(camera.quaternion)
        }

        gl.render(scene, camera)
        shots.push({ key: view.key, title: view.title, src: gl.domElement.toDataURL('image/jpeg', 0.92) })
      }
      scene.remove(headlight, headlight.target)
      if (!cancelled) onDone(shots)
    })().catch((err) => {
      if (!cancelled) onError(err)
    })
    return () => {
      cancelled = true
    }
    // Isang beses lang, pagka-load ng model
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// Kumukuha ng 5 larawan; tinatawag ang onDone([{ key, title, src }]) kapag tapos.
// Walang nakikita sa screen (nasa labas ng viewport ang Canvas).
export default function Chart3DSnapshots({ entries, onDone, onError }) {
  const chartByTooth = useMemo(() => groupChartEntries(entries), [entries])
  const archRefs = { upper: useRef(null), lower: useRef(null) }
  const labelRefs = useRef({})

  // Hinihintay na ma-load ang font ng lahat ng 32 numero (troika Text, async),
  // may 10s na palugit para hindi maipit kung may pumalya
  const labels = useMemo(() => {
    let resolve
    const promise = new Promise((r) => (resolve = r))
    const synced = new Set()
    const timer = setTimeout(() => resolve(), 10_000)
    return {
      promise,
      onSync(toothNumber) {
        synced.add(toothNumber)
        if (synced.size === ALL_TEETH.length) {
          clearTimeout(timer)
          resolve()
        }
      },
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', left: -100000, top: 0, width: WIDTH, height: HEIGHT, pointerEvents: 'none' }}
    >
      <Canvas
        shadows
        dpr={DPR}
        frameloop="never"
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => gl.setClearColor('#ffffff', 1)}
      >
        <color attach="background" args={['#ffffff']} />
        <SceneLights />
        <Suspense fallback={null}>
          {ARCHES.map((arch, rowIndex) => {
            const key = arch.upper ? 'upper' : 'lower'
            return (
              <group key={key} ref={archRefs[key]}>
                <Gingiva arch={arch} />
                {ODONTOGRAM_ROWS[rowIndex].map((toothNumber, i) => {
                  const { position, rotationY, flipUpper, mesialOnPositiveX, tiltX, labelY } =
                    TOOTH_PLACEMENTS[rowIndex][i]
                  return (
                    <Tooth3D
                      key={toothNumber}
                      toothNumber={toothNumber}
                      chartState={chartByTooth[toothNumber] || {}}
                      canEdit={false}
                      showLabel={false}
                      position={position}
                      rotationY={rotationY}
                      flipUpper={flipUpper}
                      mesialOnPositiveX={mesialOnPositiveX}
                      tiltX={tiltX}
                      labelY={labelY}
                    />
                  )
                })}
              </group>
            )
          })}
          {ALL_TEETH.map(({ toothNumber }) => (
            <Text
              key={toothNumber}
              ref={(el) => {
                if (el) labelRefs.current[toothNumber] = el
              }}
              fontSize={LABEL_FONT_SIZE}
              color="#171123"
              outlineWidth={0.018}
              outlineColor="#ffffff"
              anchorX="center"
              anchorY="middle"
              renderOrder={10}
              onSync={() => labels.onSync(toothNumber)}
            >
              {toothNumber}
            </Text>
          ))}
          <SnapshotTaker
            archRefs={archRefs}
            labelRefs={labelRefs}
            labelsReady={labels.promise}
            onDone={onDone}
            onError={onError}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
