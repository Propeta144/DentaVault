import pool from '../config/db.js'

export async function listTreatmentsForPatient(patientId) {
  const [rows] = await pool.execute(
    `SELECT t.*, u.full_name AS dentist_name
     FROM treatments t
     JOIN users u ON u.id = t.created_by
     WHERE t.patient_id = :patientId
     ORDER BY t.treatment_date DESC, t.id DESC`,
    { patientId },
  )
  return rows
}

export async function createTreatment({ patientId, procedureName, toothNumber, notes, treatmentDate, createdBy }) {
  const [result] = await pool.execute(
    `INSERT INTO treatments (patient_id, procedure_name, tooth_number, notes, treatment_date, created_by)
     VALUES (:patientId, :procedureName, :toothNumber, :notes, :treatmentDate, :createdBy)`,
    {
      patientId,
      procedureName,
      toothNumber: toothNumber ?? null,
      notes: notes ?? null,
      treatmentDate,
      createdBy,
    },
  )
  const [rows] = await pool.execute('SELECT * FROM treatments WHERE id = :id', {
    id: result.insertId,
  })
  return rows[0]
}
