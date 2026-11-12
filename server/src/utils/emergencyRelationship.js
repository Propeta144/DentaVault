// Kapareho ng dropdown sa client/src/constants/emergencyRelationship.js.
export const EMERGENCY_RELATIONSHIPS = ['Parent', 'Spouse', 'Child', 'Sibling', 'Guardian', 'Relative', 'Friend', 'Other']

export function relationshipErrors(data) {
  const errors = {}
  if (!EMERGENCY_RELATIONSHIPS.includes(data.emergencyContactRelationship)) {
    errors.emergencyContactRelationship = 'Select the emergency contact relationship'
  }
  if (data.emergencyContactRelationship === 'Other' && !String(data.emergencyContactRelationshipOther ?? '').trim()) {
    errors.emergencyContactRelationshipOther = 'Specify the emergency contact relationship'
  }
  return errors
}
