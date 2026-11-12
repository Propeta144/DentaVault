// Opt-in local DB check: node --env-file=.env test/emergencyRelationship.local.js
// Transaction rollback: walang naiiwang sample patient sa database.
import assert from 'node:assert/strict'
import pool from '../src/config/db.js'
import { createPatient, updatePatient, listPatientsForExport } from '../src/models/patientModel.js'
import { previewImport, importPatients, IMPORT_TEMPLATE_HEADERS } from '../src/services/patientImportService.js'

if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
  throw new Error('This check requires a local database')
}
const connection = await pool.getConnection()
const execute = pool.execute
try {
  await connection.beginTransaction()
  pool.execute = connection.execute.bind(connection)
  const sample = await createPatient({
    firstName: 'RelationshipTest', lastName: 'LocalOnly', sex: 'female', dateOfBirth: '2000-01-01',
    contactNumber: '09171234567', address: 'Sample address', allergies: 'None',
    emergencyContactName: 'Sample Guardian', emergencyContactPhone: '09171234567',
    emergencyContactRelationship: 'Guardian', emergencyContactRelationshipOther: '',
  })
  assert.equal(sample.emergency_contact_name, 'Sample Guardian')
  assert.equal(sample.emergency_contact_relationship, 'Guardian')
  assert.equal(sample.emergency_contact_relationship_other, null)
  const edited = await updatePatient(sample.id, {
    emergencyContactRelationship: 'Other', emergencyContactRelationshipOther: 'Partner',
  })
  assert.equal(edited.emergency_contact_relationship, 'Other')
  assert.equal(edited.emergency_contact_relationship_other, 'Partner')
  const changed = await updatePatient(sample.id, {
    emergencyContactRelationship: 'Parent', emergencyContactRelationshipOther: '',
  })
  assert.equal(changed.emergency_contact_relationship_other, null)
  const exported = await listPatientsForExport({ search: 'RelationshipTest' })
  assert.equal(exported.find((patient) => patient.id === sample.id).emergency_contact_relationship, 'Parent')

  const csv = Buffer.from('first_name,last_name,sex,date_of_birth,contact_number,address,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,emergency_contact_relationship_other\nRelationshipImportTest,LocalOnly,female,2000-01-01,09171234567,Sample address,Sample Guardian,09171234567,Other,Partner\n')
  const preview = await previewImport(csv, 'sample.csv')
  assert.ok(preview.requiredFields.includes('emergency_contact_relationship'))
  assert.equal(new Set(IMPORT_TEMPLATE_HEADERS).size, IMPORT_TEMPLATE_HEADERS.length)
  const result = await importPatients(csv, 'sample.csv', null)
  assert.equal(result.errorCount, 0)
  assert.equal(result.createdCount, 1)
  const imported = await listPatientsForExport({ search: 'RelationshipImportTest' })
  assert.equal(imported[0].emergency_contact_relationship, 'Other')
  assert.equal(imported[0].emergency_contact_relationship_other, 'Partner')
  console.log('Local create, edit, clear-Other, export, and import persistence checks passed; sample rows rolled back.')
} finally {
  pool.execute = execute
  await connection.rollback()
  connection.release()
  await pool.end()
}
