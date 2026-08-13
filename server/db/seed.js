// Creates (or updates the password of) the dentist account. Run this once
// after migrating. There is no public sign-up route for the dentist role —
// per the proposal, only the dentist operates the system directly.
//
// Usage: node db/seed.js dentist@example.com "somePassword123"
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pool from '../src/config/db.js'

async function run() {
  const [, , email, password] = process.argv

  if (!email || !password) {
    console.error('Usage: node db/seed.js <email> <password>')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await pool.execute(
    `INSERT INTO users (role, email, password_hash, full_name)
     VALUES ('dentist', :email, :passwordHash, 'Dr. Nolita Reloj Teodosio Rufin')
     ON DUPLICATE KEY UPDATE password_hash = :passwordHash`,
    { email, passwordHash },
  )

  console.log(`Dentist account ready: ${email}`)
  await pool.end()
}

run().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
