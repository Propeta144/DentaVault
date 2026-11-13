import test from 'node:test'
import assert from 'node:assert/strict'
import { missingPatientFields } from '../src/utils/patientCompleteness.js'

const complete = { first_name: 'Maria', last_name: 'Reyes', sex: 'female', date_of_birth: '1988-06-02', contact_number: '09123456789', address: 'Quezon City', emergency_contact_name: 'Ana Reyes', emergency_contact_relationship: 'Sibling', emergency_contact_phone: '09987654321', allergies: 'None' }

test('missing information reflects required fields and leaves optional fields optional', () => {
  assert.deepEqual(missingPatientFields(complete), [])
  assert.deepEqual(missingPatientFields({ ...complete, address: '  ', contact_number: null, allergies: '' }).map((field) => field.field), ['contact_number', 'address', 'allergies'])
  assert.equal(missingPatientFields({}).length, 10)
  assert.deepEqual(missingPatientFields(null), [])
  assert.deepEqual(missingPatientFields({ ...complete, medical_history: '', email: '', is_pregnant: null }), [])
})

test('other emergency relationship needs its detail only when selected', () => {
  assert.deepEqual(missingPatientFields({ ...complete, emergency_contact_relationship: 'Other' }).map((field) => field.field), ['emergency_contact_relationship_other'])
  assert.deepEqual(missingPatientFields({ ...complete, emergency_contact_relationship: 'Other', emergency_contact_relationship_other: 'Neighbor' }), [])
  assert.deepEqual(missingPatientFields({ ...complete, emergency_contact_relationship_other: '' }), [])
})
