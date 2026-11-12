import pool from '../config/db.js'
import { photoOwnerTable } from '../utils/profilePhoto.js'
import AppError from '../utils/AppError.js'

export async function findPhoto(owner) {
  const table = photoOwnerTable(owner)
  const [rows] = await pool.execute(`SELECT photo_file, photo_version FROM ${table} WHERE id = :id${owner.type === 'patient' ? ' AND deleted_at IS NULL' : ''}`, { id: owner.id })
  return rows[0] || null
}

// Row lock: ang dine-delete na old file ay yung totoong napalitan, kahit may
// sabay na upload mula sa dentist at patient. Hindi nawawala ang bagong photo.
export async function replacePhoto(owner, file, version) {
  const table = photoOwnerTable(owner)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(`SELECT photo_file FROM ${table} WHERE id = :id${owner.type === 'patient' ? ' AND deleted_at IS NULL' : ''} FOR UPDATE`, { id: owner.id })
    if (!rows[0]) throw new AppError('Profile not found', 404)
    await connection.execute(`UPDATE ${table} SET photo_file = :file, photo_version = :version WHERE id = :id`, { id: owner.id, file, version })
    await connection.commit()
    return rows[0].photo_file
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}
