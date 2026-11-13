import { ALL_TEETH, FDI_TEETH, PRIMARY_TEETH } from '../constants/dental.js'

const TOOTH_NUMBERS = new Set([...FDI_TEETH, ...PRIMARY_TEETH])
const SURFACE_ORDER = ['whole', 'occlusal', 'mesial', 'distal', 'facial', 'lingual']

export function toothTreatments(treatments, toothNumber) {
  const tooth = String(toothNumber)
  if (!TOOTH_NUMBERS.has(tooth)) return []
  // Full-mouth procedures ay applicable rin, pero may sariling label sa UI.
  return treatments.filter((t) => String(t.tooth_number) === tooth || t.tooth_number === ALL_TEETH)
}

export function toothFindings(chartState) {
  const whole = chartState.whole
  return SURFACE_ORDER.flatMap((surface) => {
    const entry = chartState[surface]
    if (!entry || entry.is_cleared) return []
    // Whole-tooth save = whole + limang surface rows. Itago lang ang exact
    // copies; manatili ang later surface changes at anumang sariling notes.
    const at = Date.parse(entry.recorded_at)
    if (surface !== 'whole' && whole && !whole.is_cleared
      && entry.condition_code === whole.condition_code
      && Number.isFinite(at) && at === Date.parse(whole.recorded_at)
      && (!entry.notes || entry.notes === whole.notes)) return []
    return [entry]
  })
}
