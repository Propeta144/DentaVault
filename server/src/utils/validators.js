// Mga shared na panuntunan sa validation ng API.

// Pinakamahabang tinatanggap bawat field — TUGMA sa laki ng column sa
// database (001_init.sql, 002_add_emergency_contact.sql). Dati walang limit:
// sa local (MariaDB, non-strict) tahimik na pinuputol ang sobra (nawawala
// ang dulo ng address), at sa Aiven (MySQL 8, STRICT_ALL_TABLES) error ang
// insert kaya "Internal server error" lang ang makikita ng user. Ang mga
// TEXT column (medical history, allergies, notes) ay may sariling makatwirang
// limit para hindi maging walang hanggan ang isang record.
// Kapag binago ang isang column, baguhin din ito AT ang client/src/constants/fieldLimits.js.
export const FIELD_LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 255,
  address: 255,
  contactNumber: 20,
  emergencyContactName: 150,
  emergencyContactPhone: 20,
  medicalHistory: 2000,
  allergies: 2000,
  procedureName: 150,
  notes: 2000,
}

// Ang "ngayon" ng clinic (Asia/Manila), hindi ng server. Sa Render, UTC ang
// oras ng server: sa 1:00 AM ng Oct 2 sa Pilipinas, Oct 1 pa sa UTC — kaya
// kapag UTC ang gamit, tatanggihan ang treatment na ginawa "ngayon".
export function clinicToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.CLINIC_TIMEZONE || 'Asia/Manila',
  }).format(new Date()) // en-CA = YYYY-MM-DD
}

// express-validator custom: YYYY-MM-DD na hindi lampas sa ngayon
export function notInFuture(value) {
  if (value && String(value).slice(0, 10) > clinicToday()) {
    throw new Error('Date cannot be in the future')
  }
  return true
}

// "0917 123 4567" / "0917-123-4567" / "(0917) 123.4567" → "09171234567".
// Tinatanggal lang ang espasyo, gitling, tuldok, at panaklong — hindi
// binabago ang mismong digits, kaya ang PH_MOBILE_PATTERN pa rin ang
// magpapasya kung tama.
export function stripPhoneFormatting(value) {
  return typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value
}

// FDI tooth number: permanent (11–18, 21–28, 31–38, 41–48) o baby teeth /
// primary (51–55, 61–65, 71–75, 81–85; idinagdag pagkatapos ng client visit,
// may batang pasyente ang clinic). Dati walang check sa Add Treatment at sa
// chart, kaya puwedeng ma-save ang "99" o "abc".
export const TOOTH_NUMBER_PATTERN = /^(?:[1-4][1-8]|[5-8][1-5])$/

export function isValidToothNumber(value) {
  return TOOTH_NUMBER_PATTERN.test(String(value ?? ''))
}

// Ang mga condition code na tinatanggap ng chart (tugma sa ENUM ng
// chart_entries.condition_code, migration 014, at sa CONDITIONS ng
// client/src/constants/dental.js).
export const CHART_CONDITIONS = [
  'healthy', 'caries', 'filling', 'root_canal', 'crown', 'extracted',
  'missing_caries', 'missing_other', 'indicated_extraction', 'root_fragment',
  'removable_denture', 'amalgam', 'abutment', 'pontic', 'inlay', 'composite',
  'extraction_other', 'congenitally_missing', 'supernumerary', 'sealant',
  'impacted', 'fractured', 'unerupted',
]

// Mga kondisyon na para sa BUONG ngipin (hal. nawawala, crown, root canal):
// laging sine-save bilang 'whole' kahit sa isang surface pinindot. Kapareho
// ng `scope: 'whole'` sa client.
export const WHOLE_TOOTH_CONDITIONS = [
  'root_canal', 'crown', 'extracted', 'missing_caries', 'missing_other',
  'indicated_extraction', 'root_fragment', 'removable_denture', 'abutment',
  'pontic', 'extraction_other', 'congenitally_missing', 'supernumerary',
  'impacted', 'unerupted',
]

// Intraoral Examination (ibabang bahagi ng papel na chart ng clinic): mga
// code na puwedeng i-check. Kapareho ng INTRAORAL_GROUPS sa client
// (constants/dental.js).
export const INTRAORAL_ITEMS = [
  // Periodontal Screening
  'gingivitis', 'early_periodontitis', 'moderate_periodontitis', 'advanced_periodontitis',
  // Occlusion
  'overjet', 'overbite', 'midline_deviation', 'crossbite',
  // Appliances
  'orthodontic', 'stayplate',
  // TMD
  'clenching', 'clicking', 'trismus', 'muscle_spasm',
]
export const MOLAR_CLASSES = ['I', 'II', 'III']
