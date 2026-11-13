import pool from '../config/db.js'
import { monthKeys } from '../utils/dashboardRange.js'
import { limitOffset } from '../utils/sqlLimit.js'
import { clinicToday } from '../utils/validators.js'

// All time ay walang date predicate, para kasama rin ang older imported records.
function dateFilter(column, range) {
  return range.period === 'all' ? '' : `AND ${column} >= :dateFrom AND ${column} < DATE_ADD(:dateTo, INTERVAL 1 DAY)`
}

function dateParams(range) {
  return range.period === 'all' ? {} : { dateFrom: range.dateFrom, dateTo: range.dateTo }
}

export async function getActivePatientCount() {
  const [[{ count }]] = await pool.execute(
    'SELECT COUNT(*) AS count FROM patients WHERE deleted_at IS NULL',
  )
  return count
}

export async function getTreatmentCount(range) {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     WHERE 1 = 1 ${dateFilter('t.treatment_date', range)}`,
    dateParams(range),
  )
  return count
}

export async function getXrayCount(range) {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM xray_images x
     JOIN patients p ON p.id = x.patient_id AND p.deleted_at IS NULL
     WHERE x.deleted_at IS NULL ${dateFilter('x.created_at', range)}`,
    dateParams(range),
  )
  return count
}

// Count per procedure name — LAHAT ng pangalan (walang LIMIT), kasi ang
// frontend na ang nag-aayos: fixed order ng standard procedures, tapos
// sariling row ang custom/legacy names para exact ang drill-down filter.
export async function getProcedureBreakdown(range) {
  const [rows] = await pool.execute(
    `SELECT t.procedure_name, COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     WHERE 1 = 1 ${dateFilter('t.treatment_date', range)}
     GROUP BY t.procedure_name
     ORDER BY count DESC`,
    dateParams(range),
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
       SELECT patient_id, tooth_number, surface, condition_code, is_cleared,
              ROW_NUMBER() OVER (
                PARTITION BY patient_id, tooth_number, surface ORDER BY recorded_at DESC, id DESC
              ) AS rn
       FROM chart_entries
     ) ce
     JOIN patients p ON p.id = ce.patient_id AND p.deleted_at IS NULL
     WHERE ce.rn = 1 AND ce.is_cleared = 0
     GROUP BY ce.condition_code`,
  )
  return rows
}

// Mga buwan sa selected range, zero-filled — kasi yung GROUP BY, months na may
// rows lang ang ibinabalik, kaya kung wala nito, mawawala na lang sa
// chart yung mga buwan na walang activity, sa halip na lumabas bilang
// zero-height bar.
export async function getMonthlyTrend(range) {
  const [newPatientRows] = await pool.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
     FROM patients
     WHERE deleted_at IS NULL ${dateFilter('created_at', range)}
     GROUP BY month`,
    dateParams(range),
  )
  const [treatmentRows] = await pool.execute(
    `SELECT DATE_FORMAT(t.treatment_date, '%Y-%m') AS month, COUNT(*) AS count
     FROM treatments t
     JOIN patients p ON p.id = t.patient_id AND p.deleted_at IS NULL
     WHERE 1 = 1 ${dateFilter('t.treatment_date', range)}
     GROUP BY month`,
    dateParams(range),
  )

  const newPatientsByMonth = Object.fromEntries(newPatientRows.map((r) => [r.month, r.count]))
  const treatmentsByMonth = Object.fromEntries(treatmentRows.map((r) => [r.month, r.count]))
  const activityMonths = [...newPatientRows, ...treatmentRows].map((row) => row.month).sort()
  const currentMonth = clinicToday().slice(0, 7)
  const months = range.period === 'all'
    ? monthKeys(`${activityMonths[0] || currentMonth}-01`, `${[currentMonth, ...activityMonths].sort().at(-1)}-01`)
    : monthKeys(range.dateFrom, range.dateTo)

  return months.map((month) => ({
    month,
    newPatients: newPatientsByMonth[month] || 0,
    treatments: treatmentsByMonth[month] || 0,
  }))
}

// Parehong predicate ang count at list, para ang card/bar at drill-down ay
// iisang bilang. Whitelisted ang table/column; bound parameters ang filters.
export async function listDashboardRecords({ kind, procedure, period, dateFrom, dateTo, limit = 20, offset = 0 }, db = pool) {
  const range = { period, dateFrom, dateTo }
  const xray = kind === 'xrays'
  const table = xray ? 'xray_images' : 'treatments'
  const dateColumn = xray ? 'r.created_at' : 'r.treatment_date'
  const where = `p.deleted_at IS NULL
    ${xray ? 'AND r.deleted_at IS NULL' : ''}
    ${dateFilter(dateColumn, range)}
    ${!xray && procedure ? 'AND r.procedure_name = :procedure' : ''}`
  const params = { ...dateParams(range), ...(!xray && procedure ? { procedure } : {}) }
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM ${table} r JOIN patients p ON p.id = r.patient_id WHERE ${where}`, params,
  )
  const fields = xray
    ? 'r.original_filename, r.created_at AS record_date, r.taken_date, r.source, r.reviewed_at'
    : 'r.procedure_name, r.treatment_date AS record_date, r.tooth_number, r.surfaces'
  const [rows] = await db.execute(
    `SELECT r.id, p.patient_code, p.first_name, p.last_name, p.date_of_birth, ${fields}
     FROM ${table} r JOIN patients p ON p.id = r.patient_id
     WHERE ${where} ORDER BY ${dateColumn} DESC, r.id DESC ${limitOffset(limit, offset)}`, params,
  )
  return { rows, total }
}

// Patient-first na Dashboard: mga record na BLANGKO ang Allergies (hal.
// lumang/imported). Hindi "None": iyon ay natanong at wala talaga. Ito ang
// kailangang itanong sa susunod na bisita, bago mag-treatment.
export async function getAllergiesNotRecorded({ limit = 5 } = {}) {
  const [rows] = await pool.execute(
    `SELECT p.patient_code, p.first_name, p.last_name, p.date_of_birth, p.photo_version
     FROM patients p
     WHERE p.deleted_at IS NULL AND (p.allergies IS NULL OR TRIM(p.allergies) = '')
     ORDER BY p.last_name, p.first_name
     LIMIT ${Number(limit)}`,
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM patients p
     WHERE p.deleted_at IS NULL AND (p.allergies IS NULL OR TRIM(p.allergies) = '')`,
  )
  return { rows, total }
}
