// Standard procedures na inooffer sa Teodosio-Rufin Dental Clinic. Yung
// mga `wholeMouth` procedures, sa buong dentition gumagana, hindi isang
// ngipin lang, kaya yung treatment form, default (at naka-lock) na sa
// ALL_TEETH yung tooth selector para dito, sa halip na pilitin pang pumili
// ang dentist ng isang ngipin.
export const PROCEDURES = [
  { value: 'Oral Prophylaxis / Cleaning', wholeMouth: true },
  { value: 'Composite Restoration / Filling', wholeMouth: false },
  { value: 'Tooth Extraction', wholeMouth: false },
  { value: 'Root Canal Treatment', wholeMouth: false },
  { value: 'Crown / Bridge', wholeMouth: false },
  { value: 'Orthodontic Adjustment', wholeMouth: false },
  { value: 'Fluoride Treatment', wholeMouth: true },
]

export function isWholeMouthProcedure(procedureName) {
  return PROCEDURES.some((p) => p.value === procedureName && p.wholeMouth)
}

// Sentinel na naka-store sa treatments.tooth_number (VARCHAR(10), kasya
// naman yung "ALL"), ibig sabihin "applicable 'to sa buong bunganga",
// hindi isang ngipin lang.
export const ALL_TEETH = 'ALL'

// FDI two-digit notation: quadrant (1-4) + tooth position (1-8) para sa
// permanent dentition — 11-18, 21-28, 31-38, 41-48.
export const FDI_TEETH = [1, 2, 3, 4].flatMap((quadrant) =>
  Array.from({ length: 8 }, (_, i) => `${quadrant}${i + 1}`),
)

// --- 2D Odontogram ----------------------------------------------------
// Visual chart layout: dalawang rows (upper/lower arch), bawat isa
// tumatakbo galing sa kanan ng pasyente papunta sa kaliwa niya — standard
// clinical orientation 'to, tugma sa kung paano talaga binabasa ng dentist
// yung chart na nakaharap sa pasyente. Quadrant 4, nasa ilalim ng
// quadrant 1 (parehong "kanan ng pasyente"), quadrant 3 naman nasa ilalim
// ng quadrant 2 (parehong "kaliwa ng pasyente").
export const ODONTOGRAM_ROWS = [
  [...Array.from({ length: 8 }, (_, i) => `1${8 - i}`), ...Array.from({ length: 8 }, (_, i) => `2${i + 1}`)],
  [...Array.from({ length: 8 }, (_, i) => `4${8 - i}`), ...Array.from({ length: 8 }, (_, i) => `3${i + 1}`)],
]

export const SURFACES = [
  { code: 'mesial', label: 'Mesial' },
  { code: 'distal', label: 'Distal' },
  { code: 'occlusal', label: 'Occlusal / Incisal' },
  { code: 'facial', label: 'Facial / Buccal' },
  { code: 'lingual', label: 'Lingual / Palatal' },
  { code: 'whole', label: 'Whole Tooth' },
]

// Tugma 'to sa color coding na nakasaad sa proposal, plus yung `crown`
// para sa Crown/Bridge procedure. Lalabas lang yung `healthy` kapag talagang
// na-record 'to ng dentist mismo — neutral lang ang itsura ng unmarked
// na ngipin, hindi green, para hindi mag-imply yung chart ng exam na hindi
// naman talaga nangyari.
export const CONDITIONS = [
  { code: 'healthy', label: 'Healthy', color: '#22c55e' },
  { code: 'caries', label: 'Caries', color: '#ef4444' },
  { code: 'filling', label: 'Filling / Restored', color: '#eab308' },
  { code: 'root_canal', label: 'Root Canal', color: '#3b82f6' },
  { code: 'crown', label: 'Crown / Bridge', color: '#a855f7' },
  { code: 'extracted', label: 'Extracted / Missing', color: '#6b7280' },
]

export const UNMARKED_COLOR = '#ffffff'
export const UNMARKED_STROKE = '#cbd5e1' // slate-300

export function conditionColor(code) {
  return CONDITIONS.find((c) => c.code === code)?.color || UNMARKED_COLOR
}

// Base sa quadrant ng ngipin (unang digit ng FDI number niya), aling side
// ng tooth-square ang mesial vs distal, at alin ang facial vs lingual —
// dito lang minsan kinukuha 'to sa halip na paulit-ulit kunin yung anatomy
// sa SVG code.
export function toothOrientation(toothNumber) {
  const quadrant = Number(toothNumber[0])
  const isPatientRight = quadrant === 1 || quadrant === 4 // Q1/Q4, nasa kanan sila papunta sa midline ng chart
  const isUpperArch = quadrant === 1 || quadrant === 2
  return {
    mesialSide: isPatientRight ? 'right' : 'left',
    distalSide: isPatientRight ? 'left' : 'right',
    facialSide: isUpperArch ? 'top' : 'bottom',
    lingualSide: isUpperArch ? 'bottom' : 'top',
  }
}
