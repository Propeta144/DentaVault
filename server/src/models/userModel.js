import pool from '../config/db.js'

// Kasama yung patient_code (null kung dentist) — kailangan ng login
// response para malaman ng client kung saang /patients/:code dadalhin
// yung patient account.
export async function findUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT u.*, p.patient_code
     FROM users u
     LEFT JOIN patients p ON p.id = u.patient_id
     WHERE u.email = :email LIMIT 1`,
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
    `SELECT u.id, u.patient_id AS patientId, p.patient_code AS patientCode, u.role, u.email,
            u.full_name AS fullName, u.is_active AS isActive,
            u.must_change_password AS mustChangePassword
     FROM users u
     LEFT JOIN patients p ON p.id = u.patient_id
     WHERE u.id = :id LIMIT 1`,
    { id },
  )
  const user = rows[0]
  if (!user) return null
  // TINYINT 0/1 → tunay na boolean para sa client
  return { ...user, mustChangePassword: Boolean(user.mustChangePassword) }
}

export async function findUserByPatientId(patientId) {
  const [rows] = await pool.execute(
    `SELECT id, patient_id AS patientId, role, email, full_name AS fullName, is_active AS isActive
     FROM users WHERE patient_id = :patientId LIMIT 1`,
    { patientId },
  )
  return rows[0] || null
}

// `mustChangePassword`: true kapag ang dentist ang nag-set (temporary
// password na alam niya); false kapag ang user mismo ang nagpalit.
export async function updatePasswordHash(userId, passwordHash, { mustChangePassword = false } = {}) {
  await pool.execute(
    `UPDATE users SET password_hash = :passwordHash, must_change_password = :mustChange
     WHERE id = :userId`,
    { userId, passwordHash, mustChange: mustChangePassword ? 1 : 0 },
  )
}

export async function createUser({ patientId, role, email, passwordHash, fullName, mustChangePassword = false }) {
  const [result] = await pool.execute(
    `INSERT INTO users (patient_id, role, email, password_hash, must_change_password, full_name)
     VALUES (:patientId, :role, :email, :passwordHash, :mustChange, :fullName)`,
    { patientId: patientId ?? null, role, email, passwordHash, mustChange: mustChangePassword ? 1 : 0, fullName },
  )
  return findUserById(result.insertId)
}
