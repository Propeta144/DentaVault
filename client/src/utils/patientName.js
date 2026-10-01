// Iisang paraan ng pagpapakita ng pangalan ng patient.
// - Listahan (naka-sort by apelyido): "Dela Cruz, Juan"
// - Header/bati: "Juan Dela Cruz"
export function listName(patient) {
  return `${patient.last_name}, ${patient.first_name}`
}

export function fullName(patient) {
  return `${patient.first_name} ${patient.last_name}`
}

// "male" → "Male" (lowercase ang naka-save sa DB)
export function sexLabel(sex) {
  return sex ? sex[0].toUpperCase() + sex.slice(1) : '—'
}

// "JD" para sa avatar. Unang letra ng unang salita ng first name at ng
// last name (kaya "Dela Cruz" → "D", hindi "DC").
export function initials(firstName = '', lastName = '') {
  const first = firstName.trim()[0] || ''
  const last = lastName.trim()[0] || ''
  return (first + last).toUpperCase() || '?'
}
