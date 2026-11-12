import { calculateAge } from './formatDate.js'
import { isPrimaryTooth } from '../constants/dental.js'

export const isDentition = (value) => value === 'primary' || value === 'permanent'
export const dentitionLabel = (value) => value === 'primary' ? 'Baby teeth' : 'Adult teeth'

export function dentitionAgeCaution(dateOfBirth, toothNumber) {
  const age = calculateAge(dateOfBirth)
  if (!Number.isInteger(age) || age < 0) return null
  const ageDefault = age <= 12 ? 'primary' : 'permanent'
  const selectedDentition = isPrimaryTooth(toothNumber) ? 'primary' : 'permanent'
  return ageDefault === selectedDentition ? null : { age, ageDefault, selectedDentition }
}

// View default lang, hindi diagnosis. Existing single-set chart muna;
// kung blank/mixed, edad 0-12 = baby view. Manual choice always wins.
export function defaultDentition(dateOfBirth, entries = []) {
  const primary = entries.some((entry) => isPrimaryTooth(entry.tooth_number))
  const permanent = entries.some((entry) => !isPrimaryTooth(entry.tooth_number))
  if (primary !== permanent) return primary ? 'primary' : 'permanent'
  const age = calculateAge(dateOfBirth)
  return age !== null && age >= 0 && age <= 12 ? 'primary' : 'permanent'
}

export function dentitionEntries(entries, dentition) {
  return entries.filter((entry) => isPrimaryTooth(entry.tooth_number) === (dentition === 'primary'))
}
