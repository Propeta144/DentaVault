import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultDentition, dentitionEntries, dentitionLabel, isDentition, dentitionAgeCaution } from '../src/utils/dentition.js'

function birthday(yearsAgo, daysLater = 0) {
  const date = new Date()
  date.setFullYear(date.getFullYear() - yearsAgo)
  date.setDate(date.getDate() + daysLater)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const primary = { id: 1, tooth_number: '51', condition_code: 'caries' }
const adult = { id: 2, tooth_number: '21', condition_code: 'filling' }

test('age caution is symmetric and follows the actual tooth, including lower baby teeth', () => {
  assert.deepEqual(dentitionAgeCaution(birthday(24), '51'), { age: 24, ageDefault: 'permanent', selectedDentition: 'primary' })
  assert.deepEqual(dentitionAgeCaution(birthday(8), '21'), { age: 8, ageDefault: 'primary', selectedDentition: 'permanent' })
  assert.equal(dentitionAgeCaution(birthday(12), '51'), null)
  assert.equal(dentitionAgeCaution(birthday(13), '21'), null)
  assert.equal(dentitionAgeCaution(birthday(8), '85'), null)
  assert.ok(dentitionAgeCaution(birthday(24), '85'))
  assert.ok(dentitionAgeCaution(birthday(12), '21'))
  assert.ok(dentitionAgeCaution(birthday(13), '51'))
  for (const dob of [null, '', 'invalid', new Date(NaN), birthday(-1)]) assert.equal(dentitionAgeCaution(dob, '51'), null)
})

test('blank charts default to baby through age 12, adult from the 13th birthday', () => {
  for (const age of [0, 5, 8, 12]) assert.equal(defaultDentition(birthday(age)), 'primary')
  assert.equal(defaultDentition(birthday(13, 1)), 'primary')
  for (const age of [13, 18, 45]) assert.equal(defaultDentition(birthday(age)), 'permanent')
  for (const dob of [null, '', 'invalid', birthday(-1)]) assert.equal(defaultDentition(dob), 'permanent')
})

test('single-set clinical records take priority over age; mixed records use age', () => {
  assert.equal(defaultDentition(birthday(45), [primary]), 'primary')
  assert.equal(defaultDentition(birthday(8), [adult]), 'permanent')
  assert.equal(defaultDentition(birthday(8), [primary, adult]), 'primary')
  assert.equal(defaultDentition(birthday(45), [primary, adult]), 'permanent')
})

test('print filtering preserves records and uses only the selected dentition', () => {
  const entries = [primary, adult]
  assert.deepEqual(dentitionEntries(entries, 'primary'), [primary])
  assert.deepEqual(dentitionEntries(entries, 'permanent'), [adult])
  assert.deepEqual(entries, [primary, adult])
  assert.equal(dentitionLabel('primary'), 'Baby teeth')
  assert.equal(dentitionLabel('permanent'), 'Adult teeth')
  assert.equal(isDentition('primary'), true)
  assert.equal(isDentition('permanent'), true)
  assert.equal(isDentition('both'), false)
})
