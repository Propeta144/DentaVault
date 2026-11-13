import pool from '../config/db.js'
import AppError from '../utils/AppError.js'

// Iisang lock para hindi magsabay ang chart at linked treatment changes.
export async function lockChartPatient(connection, patientId) {
  const [rows] = await connection.execute('SELECT id FROM patients WHERE id = :patientId AND deleted_at IS NULL FOR UPDATE', { patientId })
  if (!rows.length) throw new AppError('Patient not found', 404)
}

export async function withChartMutation({ patientId, entryId }, operation, db = pool) {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    await lockChartPatient(connection, patientId)
    let selected
    if (entryId !== undefined) {
      const [rows] = await connection.execute('SELECT * FROM chart_entries WHERE id = :entryId AND patient_id = :patientId', { entryId, patientId })
      selected = rows[0]
      if (!selected) throw new AppError('Chart entry not found', 404)
    }
    const result = await operation(connection, selected)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
