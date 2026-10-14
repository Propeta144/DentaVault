import { FIELD_LIMITS } from './fieldLimits'

// "Patient Information Record" ng clinic (papel na form nila, client visit
// Oct 13, 2026; buong form ang isinama, desisyon ng team). Kapareho ng
// EXTRA_PATIENT_FIELDS sa server/src/utils/patientFields.js at ng migration 015.
// Ginagamit ng PatientForm (Register/Edit), ng profile, at ng Print Summary.

// Mga text field: key (form / API, camelCase) → column (DB row, snake_case)
export const INFO_TEXT_FIELDS = [
  { key: 'middleName', column: 'middle_name', label: 'Middle Name' },
  { key: 'occupation', column: 'occupation', label: 'Occupation' },
  { key: 'nationality', column: 'nationality', label: 'Nationality' },
  { key: 'religion', column: 'religion', label: 'Religion' },
  { key: 'guardianName', column: 'guardian_name', label: "Parent / Guardian's Name" },
  { key: 'previousDentist', column: 'previous_dentist', label: 'Previous Dentist' },
  { key: 'lastDentalVisit', column: 'last_dental_visit', label: 'Last Dental Visit' },
  { key: 'physicianName', column: 'physician_name', label: 'Name of Physician' },
  { key: 'physicianSpecialty', column: 'physician_specialty', label: 'Specialty' },
  { key: 'physicianOfficeAddress', column: 'physician_office_address', label: 'Office Address' },
  { key: 'physicianOfficeNumber', column: 'physician_office_number', label: 'Office Number' },
  { key: 'medicalTreatmentDetails', column: 'medical_treatment_details', label: 'Condition being treated' },
  { key: 'seriousIllnessDetails', column: 'serious_illness_details', label: 'What illness or operation?' },
  { key: 'hospitalizationDetails', column: 'hospitalization_details', label: 'When and why?' },
  { key: 'medicationDetails', column: 'medication_details', label: 'Please specify' },
  { key: 'bleedingTime', column: 'bleeding_time', label: 'Bleeding Time' },
  { key: 'bloodType', column: 'blood_type', label: 'Blood Type' },
  { key: 'bloodPressure', column: 'blood_pressure', label: 'Blood Pressure' },
].map((f) => ({ ...f, max: FIELD_LIMITS[f.key] }))

// Mga Yes/No na tanong, sa pagkakasunod at pagkakasulat ng papel na form.
// `detailsKey` / `detailsLabel`: ang "If so, ..." na sagot (lalabas lang kapag Yes).
// `womenOnly`: "For women only" (nakatago kapag Male).
// Ang #8 (allergies) at #13 (checklist ng sakit) ay ang Allergies at
// Medical History na fields (ComboboxListInput).
export const HEALTH_QUESTIONS = [
  { number: 1, key: 'inGoodHealth', column: 'in_good_health', question: 'Are you in good health?' },
  {
    number: 2,
    key: 'underMedicalTreatment',
    column: 'under_medical_treatment',
    question: 'Are you under medical treatment now?',
    detailsKey: 'medicalTreatmentDetails',
    detailsLabel: 'What condition is being treated?',
  },
  {
    number: 3,
    key: 'seriousIllness',
    column: 'serious_illness',
    question: 'Have you ever had serious illness or surgical operation?',
    detailsKey: 'seriousIllnessDetails',
    detailsLabel: 'What illness or operation?',
  },
  {
    number: 4,
    key: 'hospitalized',
    column: 'hospitalized',
    question: 'Have you ever been hospitalized?',
    detailsKey: 'hospitalizationDetails',
    detailsLabel: 'When and why?',
  },
  {
    number: 5,
    key: 'takingMedication',
    column: 'taking_medication',
    question: 'Are you taking any prescription / non-prescription medication?',
    detailsKey: 'medicationDetails',
    detailsLabel: 'Please specify',
  },
  { number: 6, key: 'usesTobacco', column: 'uses_tobacco', question: 'Do you use tobacco products?' },
  {
    number: 7,
    key: 'usesAlcoholDrugs',
    column: 'uses_alcohol_drugs',
    question: 'Do you use alcohol, cocaine, or other dangerous drugs?',
  },
  { number: 10, key: 'isPregnant', column: 'is_pregnant', question: 'Are you pregnant?', womenOnly: true },
  { number: 10, key: 'isNursing', column: 'is_nursing', question: 'Are you nursing?', womenOnly: true },
  {
    number: 10,
    key: 'takingBirthControl',
    column: 'taking_birth_control',
    question: 'Are you taking birth control pills?',
    womenOnly: true,
  },
]

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// Blangkong values ng mga bagong field (text = '', Yes/No = null = hindi pa sinasagot)
export const EMPTY_INFO_FORM = {
  ...Object.fromEntries(INFO_TEXT_FIELDS.map((f) => [f.key, ''])),
  ...Object.fromEntries(HEALTH_QUESTIONS.map((q) => [q.key, null])),
}

// DB row → form values (1/0/NULL → true/false/null)
export function patientInfoToForm(patient) {
  return {
    ...Object.fromEntries(INFO_TEXT_FIELDS.map((f) => [f.key, patient[f.column] || ''])),
    ...Object.fromEntries(
      HEALTH_QUESTIONS.map((q) => [q.key, patient[q.column] === null || patient[q.column] === undefined ? null : Boolean(patient[q.column])]),
    ),
  }
}

// 1 → "Yes", 0 → "No", null → null (hindi natanong)
export function yesNoLabel(value) {
  if (value === null || value === undefined) return null
  return value ? 'Yes' : 'No'
}
