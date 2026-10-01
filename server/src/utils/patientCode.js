import { randomInt } from 'node:crypto'

// Crockford base32 — walang I, L, O, U para hindi mapagkamalan yung 1/0 o
// magkaroon ng aksidenteng salita kapag binabasa o tina-type ng dentist.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Internal na susi 'to (hal. DV-7K3M-9QX2) na ginagamit ng client sa API
// calls (/api/patients/:code), kapalit ng auto-increment na `patients.id`.
// HINDI 'to nakikita ng user — wala sa address bar (history state ang
// gamit, tignan client/src/utils/selectedPatient.js) at wala sa screen.
// Bakit hindi na lang numeric id sa API: sunod-sunod yun (1, 2, 3...), kaya
// kung may sumilip sa Network tab, madaling hulaan yung ibang records at
// malalaman kung ilan na ang patients. 8 random characters × 32 na
// pagpipilian = mahigit 1 trilyong kombinasyon, galing sa crypto.randomInt
// (hindi Math.random, na predictable). Numeric id pa rin sa loob ng DB
// para sa foreign keys.
export const PATIENT_CODE_PATTERN = /^DV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

export function generatePatientCode() {
  let chars = ''
  for (let i = 0; i < 8; i++) chars += ALPHABET[randomInt(ALPHABET.length)]
  return `DV-${chars.slice(0, 4)}-${chars.slice(4)}`
}

// Tinatanggap kahit lowercase o may space sa gilid (kung kinopya/tinype ng
// tao), pero kapag hindi talaga tugma sa format, null agad — hindi na
// kailangang mag-query sa DB para sa halatang invalid na value.
export function normalizePatientCode(value) {
  const code = String(value ?? '').trim().toUpperCase()
  return PATIENT_CODE_PATTERN.test(code) ? code : null
}
