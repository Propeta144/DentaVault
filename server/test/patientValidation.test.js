import test from 'node:test'
import assert from 'node:assert/strict'
import { validationResult } from 'express-validator'
import router from '../src/routes/patients.routes.js'
import { importPatients } from '../src/services/patientImportService.js'
import { canAccessPatientRecord } from '../src/middleware/rbac.js'

const complete = {
  firstName: 'Sample', lastName: 'Patient', sex: 'female', dateOfBirth: '2000-01-01',
  contactNumber: '0917 123 4567', address: 'Sample address', allergies: 'None',
  emergencyContactName: 'Sample Guardian', emergencyContactPhone: '+63917 123 4567',
  emergencyContactRelationship: 'Guardian',
}

for (const [method, path] of [['post', '/'], ['put', '/:code']]) {
  test(`${method} ${path} enforces required patient fields and PH numbers`, async () => {
    const route = router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]).route
    const validators = route.stack.map((layer) => layer.handle).filter((handle) => handle.run)
    async function validate(body) {
      const req = { body: { ...body } }
      for (const validator of validators) await validator.run(req)
      return { errors: validationResult(req).array(), body: req.body }
    }
    const valid = await validate(complete)
    assert.deepEqual(valid.errors, [])
    assert.equal(valid.body.contactNumber, '09171234567')
    for (const field of ['firstName', 'lastName', 'contactNumber', 'address', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship']) {
      for (const empty of [undefined, '', '   ']) {
        const result = await validate({ ...complete, [field]: empty })
        assert.ok(result.errors.some((error) => error.path === field), `${field} must reject ${JSON.stringify(empty)}`)
      }
    }
    for (const field of ['contactNumber', 'emergencyContactPhone']) {
      const result = await validate({ ...complete, [field]: '12345' })
      assert.ok(result.errors.some((error) => error.path === field))
    }
    const invalidRelationship = await validate({ ...complete, emergencyContactRelationship: 'Unknown option' })
    assert.ok(invalidRelationship.errors.some((error) => error.path === 'emergencyContactRelationship'))
    const missingOther = await validate({ ...complete, emergencyContactRelationship: 'Other', emergencyContactRelationshipOther: '   ' })
    assert.ok(missingOther.errors.some((error) => error.path === 'emergencyContactRelationshipOther'))
    const validOther = await validate({ ...complete, emergencyContactRelationship: 'Other', emergencyContactRelationshipOther: '  Partner  ' })
    assert.deepEqual(validOther.errors, [])
    assert.equal(validOther.body.emergencyContactRelationshipOther, 'Partner')
    const tooLong = await validate({ ...complete, emergencyContactRelationship: 'Other', emergencyContactRelationshipOther: 'x'.repeat(101) })
    assert.ok(tooLong.errors.some((error) => error.path === 'emergencyContactRelationshipOther'))
    const switched = await validate({ ...complete, emergencyContactRelationshipOther: 'Stale other text' })
    assert.deepEqual(switched.errors, [])
    assert.equal(switched.body.emergencyContactRelationshipOther, '')
  })
}

test('import rejects blank required details before touching the database', async () => {
  const csv = 'first_name,last_name,sex,date_of_birth,contact_number,address,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship\nSample,Patient,female,2000-01-01,12345,   ,   ,,Guardian\n'
  const result = await importPatients(Buffer.from(csv), 'sample.csv', 1, { dryRun: true })
  assert.equal(result.errorCount, 1)
  for (const field of ['contact_number', 'address', 'emergency_contact_name', 'emergency_contact_phone']) {
    assert.ok(result.errors[0].errors.some((error) => error.startsWith(field)))
  }
})

test('import requires a relationship and details for Other', async () => {
  const headers = 'first_name,last_name,sex,date_of_birth,contact_number,address,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,emergency_contact_relationship_other\n'
  for (const relationship of ['', 'Unknown option', 'Other']) {
    const csv = headers + `Sample,Patient,female,2000-01-01,09171234567,Sample address,Sample Guardian,09171234567,${relationship},\n`
    const result = await importPatients(Buffer.from(csv), 'sample.csv', 1, { dryRun: true })
    assert.equal(result.errorCount, 1)
    assert.ok(result.errors[0].errors.some((error) => /relationship/.test(error)))
  }
})

test('patients can access only their own record', () => {
  assert.equal(canAccessPatientRecord({ role: 'patient', patientId: 1 }, 1), true)
  assert.equal(canAccessPatientRecord({ role: 'patient', patientId: 1 }, 2), false)
  assert.equal(canAccessPatientRecord({ role: 'dentist' }, 2), true)
})
