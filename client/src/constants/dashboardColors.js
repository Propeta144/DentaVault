import { CONDITIONS, CONDITION_GROUPS } from './dental'

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

// Tooth Condition chart: PAREHONG kulay ng odontogram (galing mismo sa
// CONDITIONS / CONDITION_GROUPS ng dental.js, hindi kinopya): kulay bawat
// GRUPO, at nakasulat ang letter code + pangalan ng bawat kondisyon. Fixed
// display order (ayon sa grupo, hindi sorted by count); dahil pumasa ang mga
// kulay ng grupo sa --pairs all, ligtas kahit itago ang mga walang bilang.
export const CONDITION_CHART_ORDER = CONDITIONS.map((c) => ({
  code: c.code,
  label: `${c.letter} · ${c.label}`,
  color: c.color,
}))
export const CONDITION_LEGEND = CONDITION_GROUPS.map((g) => ({ label: g.label, color: g.color }))

// Procedure chart: kulay bawat GRUPO ng procedure (PROCEDURE_CATEGORIES sa
// dental.js), hindi bawat procedure. 17 na ang procedures (client visit,
// Oct 2026), pero 8 lang ang ligtas na categorical na kulay (dataviz rule:
// walang ika-9 na generated hue). Nakasulat pa rin ang pangalan ng bawat
// procedure sa bar, kaya hindi kailangang hulaan sa kulay.
// Fixed ang pagkakasunod ng grupo; validate_palette.js (adjacent, sa order
// na 'to): PASS, worst CVD ΔE 15.2, normal-vision ΔE 15.6.
// Tugma pa rin sa Tooth Condition chart: Restorative = yellow (Filling),
// Endodontic = blue (Root Canal), Prosthodontic = violet (Crown).
export const PROCEDURE_CATEGORY_COLORS = {
  diagnostic: HUE.aqua,
  preventive: HUE.green,
  restorative: HUE.yellow,
  surgery: HUE.red,
  endodontic: HUE.blue,
  orthodontic: HUE.orange,
  prosthodontic: HUE.violet,
  cosmetic: HUE.magenta,
}
export const PROCEDURE_OTHER = { label: 'Other', color: MUTED }

// Yung two-series chart (monthly trend): blue at orange, ang unang
// dalawang slot ng reference palette (validated na pares).
export const TREND_SERIES = {
  newPatients: { label: 'New Patients', color: HUE.blue },
  treatments: { label: 'Treatments', color: HUE.orange },
}
