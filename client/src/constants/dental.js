// Mga grupo ng procedure. Ang pagkakasunod ay sinadya: ito rin ang order sa
// Add Treatment form at sa dashboard chart, at dito naka-validate ang kulay
// ng bawat grupo (tignan PROCEDURE_CATEGORY_COLORS sa dashboardColors.js).
export const PROCEDURE_CATEGORIES = [
  { code: 'diagnostic', label: 'Diagnostic' },
  { code: 'preventive', label: 'Preventive' },
  { code: 'restorative', label: 'Restorative' },
  { code: 'surgery', label: 'Surgery' },
  { code: 'endodontic', label: 'Endodontic' },
  { code: 'orthodontic', label: 'Orthodontic' },
  { code: 'prosthodontic', label: 'Prosthodontic' },
  { code: 'cosmetic', label: 'Cosmetic' },
]

// Standard procedures na inooffer sa Teodosio-Rufin Dental Clinic (kinumpirma
// ng clinic noong client visit, Oct 13, 2026: idinagdag ang Consultation at
// ang mga kulang, at hiniwalay ang Crown sa Bridge). Yung `wholeMouth`, sa
// buong bibig gumagana, kaya naka-lock sa ALL_TEETH ang tooth selector.
// Ang `value` ang naka-save sa database (treatments.procedure_name), kaya
// HUWAG palitan ang value ng luma; magdagdag na lang. Kapareho ito ng
// STANDARD_PROCEDURES sa server/src/services/patientImportService.js.
// `short`: maikling tawag sa masisikip na lugar (buttons ng Add Treatment,
// dashboard chart); laging kasama ang buong `value` sa tooltip.
export const PROCEDURES = [
  { value: 'Consultation', category: 'diagnostic', wholeMouth: true },
  { value: 'Oral Prophylaxis / Cleaning', short: 'Cleaning', category: 'preventive', wholeMouth: true },
  { value: 'Deep Scaling', category: 'preventive', wholeMouth: false },
  { value: 'Fluoride Treatment', short: 'Fluoride', category: 'preventive', wholeMouth: true },
  { value: 'Pit & Fissure Sealant', short: 'Sealant', category: 'preventive', wholeMouth: false },
  { value: 'Composite Restoration / Filling', short: 'Composite Filling', category: 'restorative', wholeMouth: false },
  { value: 'Amalgam Filling', category: 'restorative', wholeMouth: false },
  { value: 'Inlay / Onlay', category: 'restorative', wholeMouth: false },
  { value: 'Tooth Extraction', short: 'Extraction', category: 'surgery', wholeMouth: false },
  { value: 'Root Canal Treatment', short: 'Root Canal', category: 'endodontic', wholeMouth: false },
  { value: 'Braces Installation', short: 'Braces', category: 'orthodontic', wholeMouth: true },
  { value: 'Orthodontic Adjustment', short: 'Ortho Adjustment', category: 'orthodontic', wholeMouth: false },
  { value: 'Crown', category: 'prosthodontic', wholeMouth: false },
  { value: 'Bridge', category: 'prosthodontic', wholeMouth: false },
  { value: 'Denture', category: 'prosthodontic', wholeMouth: false },
  { value: 'Veneers', category: 'cosmetic', wholeMouth: false },
  { value: 'Teeth Whitening', short: 'Whitening', category: 'cosmetic', wholeMouth: true },
]

// Luma na hindi na pinipili: "Crown / Bridge" (bago hiwalayin). Nasa
// database pa rin ang mga dating record, kaya kinikilala pa rin ito ng
// dashboard (sa Prosthodontic), pero wala na sa mga form.
export const RETIRED_PROCEDURES = [{ value: 'Crown / Bridge', category: 'prosthodontic' }]

export function procedureShortLabel(procedureName) {
  return PROCEDURES.find((p) => p.value === procedureName)?.short || procedureName
}

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

// Baby teeth / primary dentition (FDI 51–55, 61–65, 71–75, 81–85). Idinagdag
// pagkatapos ng client visit: may batang pasyente ang clinic, at nasa papel
// na chart nila ang mga ito (itaas at ibaba ng permanent teeth). Parehong
// ayos ng ODONTOGRAM_ROWS: kanan ng pasyente → kaliwa. Q5 = upper right,
// Q6 = upper left, Q7 = lower left, Q8 = lower right. 2D chart at print lang
// (desisyon ng team); permanent teeth lang ang 3D model.
export const PRIMARY_ROWS = [
  [...Array.from({ length: 5 }, (_, i) => `5${5 - i}`), ...Array.from({ length: 5 }, (_, i) => `6${i + 1}`)],
  [...Array.from({ length: 5 }, (_, i) => `8${5 - i}`), ...Array.from({ length: 5 }, (_, i) => `7${i + 1}`)],
]
export const PRIMARY_TEETH = [5, 6, 7, 8].flatMap((quadrant) =>
  Array.from({ length: 5 }, (_, i) => `${quadrant}${i + 1}`),
)

export function isPrimaryTooth(toothNumber) {
  return /^[5-8]/.test(String(toothNumber))
}

// Pagkakasunod sa mga listahan (findings table, atbp.): permanent muna, saka baby teeth
export const CHART_TOOTH_ORDER = [...FDI_TEETH, ...PRIMARY_TEETH]

// Para sa tooth dropdown ng Add Treatment at Manual Entry
export const TOOTH_SELECT_GROUPS = [
  { label: 'Upper Right', teeth: FDI_TEETH.filter((t) => t[0] === '1') },
  { label: 'Upper Left', teeth: FDI_TEETH.filter((t) => t[0] === '2') },
  { label: 'Lower Left', teeth: FDI_TEETH.filter((t) => t[0] === '3') },
  { label: 'Lower Right', teeth: FDI_TEETH.filter((t) => t[0] === '4') },
  { label: 'Baby teeth: Upper Right', teeth: PRIMARY_TEETH.filter((t) => t[0] === '5') },
  { label: 'Baby teeth: Upper Left', teeth: PRIMARY_TEETH.filter((t) => t[0] === '6') },
  { label: 'Baby teeth: Lower Left', teeth: PRIMARY_TEETH.filter((t) => t[0] === '7') },
  { label: 'Baby teeth: Lower Right', teeth: PRIMARY_TEETH.filter((t) => t[0] === '8') },
]

export const SURFACES = [
  { code: 'mesial', label: 'Mesial' },
  { code: 'distal', label: 'Distal' },
  { code: 'occlusal', label: 'Occlusal / Incisal' },
  { code: 'facial', label: 'Facial / Buccal' },
  { code: 'lingual', label: 'Lingual / Palatal' },
  { code: 'whole', label: 'Whole Tooth' },
]

// Mga GRUPO ng kondisyon, at ang kulay ng bawat isa. Iisang pinagmumulan ng
// kulay para sa buong app (2D/3D odontogram, legend, chart entry modal,
// dashboard). Bakit grupo: 23 na ang kondisyon (legend ng papel na chart ng
// clinic, client visit Oct 2026), pero walang ligtas na palette na may 23 na
// magkakaibang kulay. Kaya kulay = grupo, at ang LETTER CODE ng clinic
// (D, F, J, ...) ang nakasulat sa bawat ngipin para sa eksaktong kondisyon.
//
// Color-blind safe (dataviz skill, validate_palette.js --pairs all, kasi
// kahit anong dalawang grupo ay puwedeng magkatabi): ang 5 orihinal na kulay
// + gray ay worst CVD ΔE 13; ang dagdag na aqua (anomaly) ay CVD ΔE 6.1 laban
// sa magenta (WARN: pinapayagan dahil may letter code laging nakasulat).
export const CONDITION_GROUPS = [
  { code: 'present', label: 'Present / Healthy', color: '#008300' },
  { code: 'decay', label: 'Decay & damage', color: '#e87ba4' },
  { code: 'restoration', label: 'Restorations', color: '#eda100' },
  { code: 'endodontic', label: 'Root canal', color: '#2a78d6' },
  { code: 'prosthetic', label: 'Crowns & prosthetics', color: '#4a3aa7' },
  { code: 'missing', label: 'Missing / Extracted', color: '#6b7280' },
  { code: 'anomaly', label: 'Other findings', color: '#1baf7a' },
]

// Lahat ng kondisyon. `letter` = code sa legend ng clinic; `scope`:
// 'surface' = bawat surface (hal. Decayed sa mesial lang), 'whole' = buong
// ngipin (laging 5 surfaces sabay, hal. Missing, Jacket Crown), 'any' = pareho.
// Ang 6 na unang code (healthy, caries, filling, root_canal, crown, extracted)
// ay luma; pareho ang code kaya buo ang lumang data, binago lang ang label
// para tugma sa papel nila. Kapareho ng CHART_CONDITIONS at
// WHOLE_TOOTH_CONDITIONS sa server/src/utils/validators.js.
//
// Lalabas lang yung `healthy` kapag talagang na-record 'to ng dentist
// mismo — neutral lang ang itsura ng unmarked na ngipin, hindi green, para
// hindi mag-imply yung chart ng exam na hindi naman talaga nangyari.
const CONDITION_LIST = [
  { code: 'healthy', letter: '✓', label: 'Present / Healthy', group: 'present', scope: 'any' },
  { code: 'caries', letter: 'D', label: 'Decayed (Caries)', group: 'decay', scope: 'surface' },
  { code: 'fractured', letter: 'Fr', label: 'Fractured', group: 'decay', scope: 'surface' },
  { code: 'indicated_extraction', letter: 'I', label: 'Indicated for Extraction', group: 'decay', scope: 'whole' },
  { code: 'root_fragment', letter: 'RF', label: 'Root Fragment', group: 'decay', scope: 'whole' },
  { code: 'filling', letter: 'F', label: 'Filled', group: 'restoration', scope: 'surface' },
  { code: 'amalgam', letter: 'A', label: 'Amalgam Filling', group: 'restoration', scope: 'surface' },
  { code: 'composite', letter: 'FX', label: 'Composite (Light Cure)', group: 'restoration', scope: 'surface' },
  { code: 'inlay', letter: 'In', label: 'Inlay', group: 'restoration', scope: 'surface' },
  { code: 'sealant', letter: 'S', label: 'Sealant', group: 'restoration', scope: 'surface' },
  { code: 'root_canal', letter: 'RC', label: 'Root Canal Treated', group: 'endodontic', scope: 'whole' },
  { code: 'crown', letter: 'J', label: 'Jacket Crown', group: 'prosthetic', scope: 'whole' },
  { code: 'abutment', letter: 'AB', label: 'Abutment', group: 'prosthetic', scope: 'whole' },
  { code: 'pontic', letter: 'P', label: 'Pontic', group: 'prosthetic', scope: 'whole' },
  { code: 'removable_denture', letter: 'RM', label: 'Removable Denture', group: 'prosthetic', scope: 'whole' },
  { code: 'extracted', letter: 'X', label: 'Extracted (Caries)', group: 'missing', scope: 'whole' },
  { code: 'extraction_other', letter: 'XO', label: 'Extracted (Other Causes)', group: 'missing', scope: 'whole' },
  { code: 'missing_caries', letter: 'M', label: 'Missing (Caries)', group: 'missing', scope: 'whole' },
  { code: 'missing_other', letter: 'MO', label: 'Missing (Other Causes)', group: 'missing', scope: 'whole' },
  { code: 'congenitally_missing', letter: 'CM', label: 'Congenitally Missing', group: 'missing', scope: 'whole' },
  { code: 'impacted', letter: 'Im', label: 'Impacted', group: 'anomaly', scope: 'whole' },
  { code: 'unerupted', letter: 'Un', label: 'Unerupted', group: 'anomaly', scope: 'whole' },
  { code: 'supernumerary', letter: 'Sp', label: 'Supernumerary', group: 'anomaly', scope: 'whole' },
]

export const CONDITIONS = CONDITION_LIST.map((c) => ({
  ...c,
  color: CONDITION_GROUPS.find((g) => g.code === c.group).color,
}))

// Mga kondisyon na nangangahulugang WALA na ang ngipin: iginuguhit bilang
// abong ngipin na may X (2D) at translucent (3D).
export function isMissingCondition(code) {
  return CONDITIONS.find((c) => c.code === code)?.group === 'missing'
}

export function isWholeToothCondition(code) {
  return CONDITIONS.find((c) => c.code === code)?.scope === 'whole'
}

export function conditionLabel(code) {
  return CONDITIONS.find((c) => c.code === code)?.label || code
}

export function conditionLetter(code) {
  return CONDITIONS.find((c) => c.code === code)?.letter || ''
}

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
  // Q1/Q4 (at baby teeth Q5/Q8), nasa kanan sila papunta sa midline ng chart
  const isPatientRight = quadrant === 1 || quadrant === 4 || quadrant === 5 || quadrant === 8
  const isUpperArch = quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6
  return {
    mesialSide: isPatientRight ? 'right' : 'left',
    distalSide: isPatientRight ? 'left' : 'right',
    facialSide: isUpperArch ? 'top' : 'bottom',
    lingualSide: isUpperArch ? 'bottom' : 'top',
  }
}

// Intraoral Examination: ibabang bahagi ng papel na chart ng clinic (para sa
// buong bibig, hindi bawat ngipin). Kapareho ng INTRAORAL_ITEMS sa
// server/src/utils/validators.js. Ang Occlusion ay may "Class (Molar)" din
// (MOLAR_CLASSES) at ang Appliances ay may "others" na text.
export const INTRAORAL_GROUPS = [
  {
    code: 'periodontal',
    label: 'Periodontal Screening',
    items: [
      { code: 'gingivitis', label: 'Gingivitis' },
      { code: 'early_periodontitis', label: 'Early Periodontitis' },
      { code: 'moderate_periodontitis', label: 'Moderate Periodontitis' },
      { code: 'advanced_periodontitis', label: 'Advanced Periodontitis' },
    ],
  },
  {
    code: 'occlusion',
    label: 'Occlusion',
    items: [
      { code: 'overjet', label: 'Overjet' },
      { code: 'overbite', label: 'Overbite' },
      { code: 'midline_deviation', label: 'Midline Deviation' },
      { code: 'crossbite', label: 'Crossbite' },
    ],
  },
  {
    code: 'appliances',
    label: 'Appliances',
    items: [
      { code: 'orthodontic', label: 'Orthodontic' },
      { code: 'stayplate', label: 'Stayplate' },
    ],
  },
  {
    code: 'tmd',
    label: 'TMD',
    items: [
      { code: 'clenching', label: 'Clenching' },
      { code: 'clicking', label: 'Clicking' },
      { code: 'trismus', label: 'Trismus' },
      { code: 'muscle_spasm', label: 'Muscle Spasm' },
    ],
  },
]
export const MOLAR_CLASSES = ['I', 'II', 'III']
