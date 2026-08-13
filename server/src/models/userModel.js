import pool from '../config/db.js'

export async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE email = :email LIMIT 1',
    { email },
  )
  return rows[0] || null
}

// Aliased papuntang camelCase para tumugma sa shape na binabalik na ng
// authService.login() — kung hindi, ang ibibigay ng /auth/me (na tinatawag
// nito sa bawat app reload) sa client ay patient_id/full_name, samantalang
// yung login, patientId/fullName ang ibinibigay, kaya kahit ano mang
// nagbabasa ng user.patientId o user.fullName, sisira nang tahimik
// pagkatapos ng refresh.
export async function findUserById(id) {
  const [rows] = await pool.execute(
    `SELECT id, patient_id AS patientId, role, email, full_name AS fullName, is_active AS isActive
     FROM users WHERE id = :id LIMIT 1`,
    { id },
  )
  return rows[0] || null
}

export async function findUserByPatientId(patientId) {
  const [rows] = await pool.execute(
    `SELECT id, patient_id AS patientId, role, email, full_name AS fullName, is_active AS isActive
     FROM users WHERE patient_id = :patientId LIMIT 1`,
    { patientId },
  )
  return rows[0] || null
}

export async function updatePasswordHash(userId, passwordHash) {
  await pool.execute(
    'UPDATE users SET password_hash = :passwordHash WHERE id = :userId',
    { userId, passwordHash },
  )
}

export async function createUser({ patientId, role, email, passwordHash, fullName }) {
  const [result] = await pool.execute(
    `INSERT INTO users (patient_id, role, email, password_hash, full_name)
     VALUES (:patientId, :role, :email, :passwordHash, :fullName)`,
    { patientId: patientId ?? null, role, email, passwordHash, fullName },
  )
  return findUserById(result.insertId)
}
