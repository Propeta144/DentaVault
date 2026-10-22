// Feature #30: sync ng Treatment History ↔ Dental Chart (2D/3D).
//
// Hindi lahat ng procedure ay may katapat na marka sa chart (hal. Cleaning,
// Consultation = buong bibig; Bridge = maraming ngipin), at hindi lahat ng
// chart condition ay treatment (hal. Decayed, Impacted = FINDING lang, walang
// ginawang procedure). Kaya may tahasang mapa rito, sa halip na manghula.
// KAPAREHO ng PROCEDURE_CHART sa client/src/constants/dental.js.
//
// `conditions`: mga puwedeng chart condition para sa procedure (ang una ang
// default). Ang Tooth Extraction ay may dalawa: X (Caries) at XO (Other
// causes), pinipili sa Add Treatment.
// `scope`: 'surface' = kailangang pumili ng surface(s) (hal. MO filling);
// 'whole' = buong ngipin (5 surfaces sabay, gaya ng chart).
export const PROCEDURE_CHART = {
  'Composite Restoration / Filling': { conditions: ['composite', 'filling'], scope: 'surface' },
  'Amalgam Filling': { conditions: ['amalgam'], scope: 'surface' },
  'Inlay / Onlay': { conditions: ['inlay'], scope: 'surface' },
  'Pit & Fissure Sealant': { conditions: ['sealant'], scope: 'surface' },
  'Tooth Extraction': { conditions: ['extracted', 'extraction_other'], scope: 'whole' },
  'Root Canal Treatment': { conditions: ['root_canal'], scope: 'whole' },
  Crown: { conditions: ['crown'], scope: 'whole' },
  Denture: { conditions: ['removable_denture'], scope: 'whole' },
}

// Chart condition → procedure (para sa "Also add to Treatment History")
export const CONDITION_PROCEDURE = Object.fromEntries(
  Object.entries(PROCEDURE_CHART).flatMap(([procedure, { conditions }]) => conditions.map((c) => [c, procedure])),
)

export const TOOTH_SURFACES = ['mesial', 'distal', 'occlusal', 'facial', 'lingual']

// "mesial, occlusal" / ["occlusal","mesial"] → ['mesial','occlusal'] (walang
// ulit, laging parehong pagkakasunod, kaya madaling ikumpara sa edit)
export function normalizeSurfaces(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',')
  const set = new Set(list.map((s) => String(s).trim().toLowerCase()).filter(Boolean))
  return TOOTH_SURFACES.filter((s) => set.has(s))
}

export function isValidSurfaceList(value) {
  if (value == null || value === '') return true
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.every((s) => TOOTH_SURFACES.includes(String(s).trim().toLowerCase()))
}

// Ano ang ilalagay sa chart para sa isang treatment. null = walang marka
// (procedure na walang katapat, walang ngipin / "ALL", o pang-surface na
// walang napiling surface).
// `preferredCondition`: galing sa client (hal. XO para sa extraction) o sa
// dating naka-link na entry (para hindi magbago ang F → FX kapag notes lang
// ang in-edit).
export function chartPlanFor({ procedureName, toothNumber, surfaces, preferredCondition }) {
  const map = PROCEDURE_CHART[procedureName]
  if (!map || !toothNumber || toothNumber === 'ALL') return null
  const conditionCode = map.conditions.includes(preferredCondition) ? preferredCondition : map.conditions[0]
  if (map.scope === 'whole') return { toothNumber, conditionCode, surfaces: ['whole'] }
  const list = normalizeSurfaces(surfaces)
  if (list.length === 0) return null
  return { toothNumber, conditionCode, surfaces: list }
}
