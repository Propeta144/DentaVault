// Creates (or updates the password of) a patient portal login account,
// linked to an existing patient record. There is no self-signup or "create
// portal account" UI yet — for now, patient accounts are provisioned
// manually via this script (same pattern as db/seed.js for the dentist).
//
// Usage: node db/seedPatientUser.js <patientId> <email> "<password>"
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pool from '../src/config/db.js'
import { findPatientById } from '../src/models/patientModel.js'

async function run() {
  const [, , patientIdArg, email, password] = process.argv

  if (!patientIdArg || !email || !password) {
    console.error('Usage: node db/seedPatientUser.js <patientId> <email> <password>')
    process.exit(1)
  }

  const patient = await findPatientById(patientIdArg)
  if (!patient) {
    console.error(`No patient found with id ${patientIdArg} (or it has been deleted)`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const fullName = `${patient.first_name} ${patient.last_name}`

  await pool.execute(
    `INSERT INTO users (patient_id, role, email, password_hash, full_name)
     VALUES (:patientId, 'patient', :email, :passwordHash, :fullName)
     ON DUPLICATE KEY UPDATE password_hash = :passwordHash, patient_id = :patientId, full_name = :fullName`,
    { patientId: patient.id, email, passwordHash, fullName },
  )

  console.log(`Patient portal account ready: ${email} -> patient #${patient.id} (${fullName})`)
  await pool.end()
}

run().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
