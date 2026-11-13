const REQUIRED_FIELDS = [
  ['first_name', 'First name'], ['last_name', 'Last name'], ['sex', 'Sex'],
  ['date_of_birth', 'Date of birth'], ['contact_number', 'Contact number'], ['address', 'Address'],
  ['emergency_contact_name', 'Emergency contact name'],
  ['emergency_contact_relationship', 'Emergency contact relationship'],
  ['emergency_contact_phone', 'Emergency contact number'], ['allergies', 'Allergies'],
]

// Presence lang ito, hindi diagnosis o bagong validation rule. Optional
// email/history/health questions ay hindi ginagawang required sa lumang record.
export function missingPatientFields(patient) {
  if (!patient) return []
  const missing = REQUIRED_FIELDS.filter(([field]) => !String(patient[field] ?? '').trim())
    .map(([field, label]) => ({ field, label }))
  if (patient.emergency_contact_relationship === 'Other' && !String(patient.emergency_contact_relationship_other ?? '').trim()) {
    missing.push({ field: 'emergency_contact_relationship_other', label: 'Other emergency contact relationship' })
  }
  return missing
}
