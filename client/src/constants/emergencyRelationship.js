export const EMERGENCY_RELATIONSHIPS = ['Parent', 'Spouse', 'Child', 'Sibling', 'Guardian', 'Relative', 'Friend', 'Other']

export function emergencyRelationshipLabel(patient) {
  return patient.emergency_contact_relationship === 'Other'
    ? patient.emergency_contact_relationship_other || 'Other'
    : patient.emergency_contact_relationship || ''
}
