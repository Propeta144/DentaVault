import { ODONTOGRAM_ROWS, PRIMARY_ROWS } from '../../constants/dental'
import { DENTITION_ARCHES, toothPlacement } from './archLayout'

// Mga bahaging pareho ng 3D chart sa screen (Odontogram3D) at ng 3D print
// (Chart3DSnapshots), para iisa ang itsura at hindi kinokopya ang code.

// Pwesto ng bawat ngipin, kapareho ng ayos ng ODONTOGRAM_ROWS (upper, lower)
export const TOOTH_PLACEMENTS = ODONTOGRAM_ROWS.map((row, rowIndex) => row.map((_, i) => toothPlacement(rowIndex, i)))

// Buong scene bawat dentition (Feature #30: baby teeth sa 3D). `rows` =
// ayos ng ngipin (kanan ng pasyente → kaliwa), `arches` = gums,
// `placements` = pwesto ng bawat ngipin. `camera`/`target` = panimulang
// tingin (mas maliit ang arch ng bata, kaya mas malapit).
export const DENTITION_SCENES = {
  permanent: {
    rows: ODONTOGRAM_ROWS,
    arches: DENTITION_ARCHES.permanent,
    placements: TOOTH_PLACEMENTS,
    camera: [0, 2.6, 7.6],
    target: [0, 0, -2.2],
  },
  primary: {
    rows: PRIMARY_ROWS,
    arches: DENTITION_ARCHES.primary,
    placements: PRIMARY_ROWS.map((row, rowIndex) => row.map((_, i) => toothPlacement(rowIndex, i, 'primary'))),
    camera: [0, 2, 5.6],
    target: [0, 0, -1.3],
  },
}

// Chart entries (pinakabago bawat tooth + surface) → { [tooth]: { [surface]: entry } }
export function groupChartEntries(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.tooth_number] ??= {}
    acc[entry.tooth_number][entry.surface] = entry
    return acc
  }, {})
}

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      {/* Fill light mula sa ibaba, para hindi madilim ang gums at
          upper teeth kapag tiningnan mula sa ilalim */}
      <hemisphereLight args={['#ffffff', '#f3d6d4', 0.35]} />
      <directionalLight position={[4, 6, 6]} intensity={0.9} castShadow />
      <directionalLight position={[-4, 3, -2]} intensity={0.3} />
    </>
  )
}
