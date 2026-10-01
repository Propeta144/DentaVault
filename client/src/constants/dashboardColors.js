import { CONDITIONS } from './dental'

// Validated na categorical palette (light mode) — galing sa dataviz skill's
// reference palette (palette.md / validate_palette.js). Pinangalanan ayon
// sa kulay para malinaw kung alin ang ginagamit saan.
const HUE = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  magenta: '#e87ba4',
  green: '#008300',
  violet: '#4a3aa7',
  red: '#e34948',
}

// Neutral chrome gray para sa "Other" sa procedures — hindi categorical
// identity slot.
const MUTED = '#94a3b8'

const conditionColor = (code) => CONDITIONS.find((c) => c.code === code).color

// Tooth Condition chart: PAREHONG kulay ng odontogram (galing mismo sa
// CONDITIONS ng dental.js, hindi kinopya) — kaya ang "Caries" ay iisang
// kulay sa chart ng patient at sa dashboard. Fixed display order (hindi
// sorted by count); dahil pumasa ang set na 'to sa --pairs all, ligtas
// kahit anong magkatabi.
export const CONDITION_CHART_ORDER = [
  'healthy',
  'filling',
  'root_canal',
  'crown',
  'caries',
  'extracted',
].map((code) => ({
  code,
  label: CONDITIONS.find((c) => c.code === code).label,
  color: conditionColor(code),
}))

// Procedure chart: iba-ibang kulay bawat procedure (hiling ng adviser). Ang
// kulay ay nakakabit sa PROCEDURE mismo, hindi sa ranggo, at FIXED ang
// pagkakasunod (hindi sorted by count) para manatili sa validated na
// adjacency. Tugma sa katabing Tooth Condition chart: Filling = yellow,
// Root Canal = blue, Crown / Bridge = violet (kapareho ng kondisyon), at
// ang magenta ay para sa Caries lang kaya hindi ginamit dito.
// Iba pa: Cleaning = green (preventive), Orthodontic = orange, Fluoride =
// aqua, Extraction = red. validate_palette.js (adjacent, sa order na 'to):
// PASS, worst CVD ΔE 6.9 (6–8 = pinapayagan lang KUNG may secondary
// encoding — mayroon: nakasulat na label at numero sa bawat bar),
// normal-vision ΔE 16.3. Ang value ay kapareho ng PROCEDURES sa dental.js;
// ang hindi-standard na pangalan (legacy import) ay pinagsasama sa "Other".
export const PROCEDURE_CHART_ORDER = [
  { value: 'Oral Prophylaxis / Cleaning', label: 'Cleaning', color: HUE.green },
  { value: 'Composite Restoration / Filling', label: 'Filling', color: conditionColor('filling') },
  { value: 'Root Canal Treatment', label: 'Root Canal', color: conditionColor('root_canal') },
  { value: 'Crown / Bridge', label: 'Crown / Bridge', color: conditionColor('crown') },
  { value: 'Orthodontic Adjustment', label: 'Orthodontic Adj.', color: HUE.orange },
  { value: 'Fluoride Treatment', label: 'Fluoride', color: HUE.aqua },
  { value: 'Tooth Extraction', label: 'Extraction', color: HUE.red },
]
export const PROCEDURE_OTHER = { label: 'Other', color: MUTED }

// Yung two-series chart (monthly trend): blue at orange, ang unang
// dalawang slot ng reference palette (validated na pares).
export const TREND_SERIES = {
  newPatients: { label: 'New Patients', color: HUE.blue },
  treatments: { label: 'Treatments', color: HUE.orange },
}
