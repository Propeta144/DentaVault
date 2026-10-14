// Mga field ng "Patient Information Record" ng clinic (migration 015) na
// idinagdag pagkatapos ng client visit. IISANG listahan para sa model
// (insert/update), validation (patients.routes.js), at Import/Export, para
// hindi magkalimutan ang isa kapag may binago.
//
// type 'text': VARCHAR na may `max` (kapareho ng laki ng column)
// type 'bool': Yes / No / hindi natanong (TINYINT NULL). Tinatanggap ang
//   true/false/null mula sa form.
// womenOnly: binubura (null) kapag male ang sex, para walang maiwang
//   "Pregnant: Yes" kapag napalitan ang sex.
// Kapag binago ito, baguhin din ang client/src/constants/patientInfo.js.
export const EXTRA_PATIENT_FIELDS = [
  { key: 'middleName', column: 'middle_name', type: 'text', max: 100, label: 'Middle name' },
  { key: 'occupation', column: 'occupation', type: 'text', max: 100, label: 'Occupation' },
  { key: 'nationality', column: 'nationality', type: 'text', max: 60, label: 'Nationality' },
  { key: 'religion', column: 'religion', type: 'text', max: 60, label: 'Religion' },
  { key: 'guardianName', column: 'guardian_name', type: 'text', max: 150, label: 'Parent / guardian name' },
  { key: 'previousDentist', column: 'previous_dentist', type: 'text', max: 150, label: 'Previous dentist' },
  { key: 'lastDentalVisit', column: 'last_dental_visit', type: 'text', max: 100, label: 'Last dental visit' },
  { key: 'physicianName', column: 'physician_name', type: 'text', max: 150, label: 'Physician name' },
  { key: 'physicianSpecialty', column: 'physician_specialty', type: 'text', max: 100, label: 'Physician specialty' },
  { key: 'physicianOfficeAddress', column: 'physician_office_address', type: 'text', max: 255, label: 'Physician office address' },
  { key: 'physicianOfficeNumber', column: 'physician_office_number', type: 'text', max: 30, label: 'Physician office number' },
  { key: 'inGoodHealth', column: 'in_good_health', type: 'bool', label: 'In good health' },
  { key: 'underMedicalTreatment', column: 'under_medical_treatment', type: 'bool', label: 'Under medical treatment' },
  { key: 'medicalTreatmentDetails', column: 'medical_treatment_details', type: 'text', max: 255, label: 'Condition being treated' },
  { key: 'seriousIllness', column: 'serious_illness', type: 'bool', label: 'Serious illness or operation' },
  { key: 'seriousIllnessDetails', column: 'serious_illness_details', type: 'text', max: 255, label: 'Illness or operation' },
  { key: 'hospitalized', column: 'hospitalized', type: 'bool', label: 'Hospitalized' },
  { key: 'hospitalizationDetails', column: 'hospitalization_details', type: 'text', max: 255, label: 'When and why hospitalized' },
  { key: 'takingMedication', column: 'taking_medication', type: 'bool', label: 'Taking medication' },
  { key: 'medicationDetails', column: 'medication_details', type: 'text', max: 255, label: 'Medications' },
  { key: 'usesTobacco', column: 'uses_tobacco', type: 'bool', label: 'Uses tobacco' },
  { key: 'usesAlcoholDrugs', column: 'uses_alcohol_drugs', type: 'bool', label: 'Uses alcohol or dangerous drugs' },
  { key: 'bleedingTime', column: 'bleeding_time', type: 'text', max: 50, label: 'Bleeding time' },
  { key: 'isPregnant', column: 'is_pregnant', type: 'bool', womenOnly: true, label: 'Pregnant' },
  { key: 'isNursing', column: 'is_nursing', type: 'bool', womenOnly: true, label: 'Nursing' },
  { key: 'takingBirthControl', column: 'taking_birth_control', type: 'bool', womenOnly: true, label: 'Taking birth control pills' },
  { key: 'bloodType', column: 'blood_type', type: 'text', max: 10, label: 'Blood type' },
  { key: 'bloodPressure', column: 'blood_pressure', type: 'text', max: 20, label: 'Blood pressure' },
]

// Form value → database value. Blangkong text = NULL. Bool: true → 1,
// false → 0, iba pa (null, '', undefined) → NULL.
export function toDbValue(field, value) {
  if (field.type === 'bool') {
    if (value === true || value === 1 || value === '1') return 1
    if (value === false || value === 0 || value === '0') return 0
    return null
  }
  const text = typeof value === 'string' ? value.trim() : value
  return text ? String(text) : null
}

// Mga sagot na "Yes/No" mula sa CSV (papel → Excel): Yes/Y/Oo/1/True = 1,
// No/N/Hindi/0/False = 0, blangko = NULL. Ibang sagot = null + error.
export function parseYesNo(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return { value: null }
  if (['yes', 'y', 'oo', '1', 'true'].includes(v)) return { value: 1 }
  if (['no', 'n', 'hindi', '0', 'false'].includes(v)) return { value: 0 }
  return { error: true }
}
