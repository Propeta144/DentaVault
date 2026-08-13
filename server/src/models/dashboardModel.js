import pool from '../config/db.js'

export async function getActivePatientCount() {
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM patients WHERE deleted_at IS NULL',
  )
  return count
}

export async function getTreatmentsThisMonthCount() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     WHERE t.treatment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
  )
  return count
}

export async function getXraysThisMonthCount() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM xray_images x
     JOIN patients p ON p.id = x.patient_id AND p.deleted_at IS NULL
     WHERE x.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
  )
  return count
}

// Ranked, hindi fixed-order — single-metric breakdown lang naman 'to
// (count per procedure name), hindi distinct series, kaya same chart
// color lang lahat ng bar sa frontend, hindi isa-isang hue per procedure.
export async function getProcedureBreakdown() {
  const [rows] = await pool.execute(
    `SELECT t.procedure_name, COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     GROUP BY t.procedure_name
     ORDER BY count DESC
     LIMIT 8`,
  )
  return rows
}

// Clinic-wide snapshot 'to ng CURRENT tooth/surface conditions — same
// latest-row-per-slot pattern gaya ng chartModel.getCurrentChart, wala
// lang patient filter tapos grouped by condition sa halip na ibalik
// bilang full rows. Legit na nag-cocontribute rin ng 5 surface rows niya
// yung whole-tooth fact (extraction, full restoration), kagaya ng
// ginagawa niya sa bawat per-patient odontogram view — tignan yung
// createWholeToothEntry sa chartModel.js.
export async function getConditionBreakdown() {
  const [rows] = await pool.execute(
    `SELECT ce.condition_code, COUNT(*) AS count
     FROM (
       SELECT patient_id, tooth_number, surface, condition_code,
              ROW_NUMBER() OVER (
                PARTITION BY patient_id, tooth_number, surface ORDER BY recorded_at DESC, id DESC
              ) AS rn
       FROM chart_entries
     ) ce
     JOIN patients p ON p.id = ce.patient_id AND p.deleted_at IS NULL
     WHERE ce.rn = 1
     GROUP BY ce.condition_code`,
  )
  return rows
}

// Last 6 calendar months, zero-filled — kasi yung GROUP BY, months na may
// rows lang ang ibinabalik, kaya kung wala nito, mawawala na lang sa
// chart yung mga buwan na walang activity, sa halip na lumabas bilang
// zero-height bar.
export async function getMonthlyTrend() {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const sixMonthsAgo = `${months[0]}-01`

  const [newPatientRows] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM patients
     WHERE deleted_at IS NULL AND created_at >= :sixMonthsAgo
     GROUP BY month`,
    { sixMonthsAgo },
  )
  const [treatmentRows] = await pool.execute(
    `SELECT DATE_FORMAT(t.treatment_date, '%Y-%m') AS month, COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     WHERE t.treatment_date >= :sixMonthsAgo
     GROUP BY month`,
    { sixMonthsAgo },
  )

  const newPatientsByMonth = Object.fromEntries(newPatientRows.map((r) => [r.month, r.count]))
  const treatmentsByMonth = Object.fromEntries(treatmentRows.map((r) => [r.month, r.count]))

  return months.map((month) => ({
    month,
    newPatients: newPatientsByMonth[month] || 0,
    treatments: treatmentsByMonth[month] || 0,
  }))
}
