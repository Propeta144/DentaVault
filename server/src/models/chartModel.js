import pool from '../config/db.js'

// Yung CURRENT state ang ipinapakita ng odontogram: yung latest entry per
// (tooth_number, surface). Kapag walang entry para sa isang tooth/surface,
// ibig sabihin "unmarked" — dini-draw 'to ng frontend bilang default
// healthy color, hindi na kailangan pa ng seeded row para sa lahat ng
// 32 teeth.
export async function getCurrentChart(patientId) {
  const [rows] = await pool.execute(
    `SELECT ce.id, ce.tooth_number, ce.surface, ce.condition_code, ce.notes, ce.recorded_at, u.full_name AS dentist_name
     FROM (
       SELECT *, ROW_NUMBER() OVER (
         PARTITION BY tooth_number, surface ORDER BY recorded_at DESC, id DESC
       ) AS rn
       FROM chart_entries
       WHERE patient_id = :patientId
     ) ce
     JOIN users u ON u.id = ce.recorded_by
     WHERE ce.rn = 1`,
    { patientId },
  )
  return rows
}

export async function getToothHistory(patientId, toothNumber) {
  const [rows] = await pool.execute(
    `SELECT ce.*, u.full_name AS dentist_name
     FROM chart_entries ce
     JOIN users u ON u.id = ce.recorded_by
     WHERE ce.patient_id = :patientId AND ce.tooth_number = :toothNumber
     ORDER BY ce.recorded_at DESC, ce.id DESC`,
    { patientId, toothNumber },
  )
  return rows
}

export async function createChartEntry({ patientId, toothNumber, surface, conditionCode, notes, recordedBy }) {
  const [result] = await pool.execute(
    `INSERT INTO chart_entries (patient_id, tooth_number, surface, condition_code, notes, recorded_by)
     VALUES (:patientId, :toothNumber, :surface, :conditionCode, :notes, :recordedBy)`,
    {
      patientId,
      toothNumber,
      surface,
      conditionCode,
      notes: notes ?? null,
      recordedBy,
    },
  )
  const [rows] = await pool.execute(
    `SELECT ce.*, u.full_name AS dentist_name FROM chart_entries ce
     JOIN users u ON u.id = ce.recorded_by WHERE ce.id = :id`,
    { id: result.insertId },
  )
  return rows[0]
}

const ALL_SURFACES = ['whole', 'mesial', 'distal', 'occlusal', 'facial', 'lingual']

// Yung whole-tooth fact (extracted, o na-restore pabalik sa present/healthy),
// wala talagang sariling mesial/distal/occlusal state — either missing yung
// ngipin o hindi, hindi naman puwedeng "medyo missing lang". Kaysa iwan
// na lang stale yung 5 surface rows (na nagpapakita pa rin ng huling
// naitala — hal. buhay pa rin yung "caries" entry sa ngiping wala na
// pala, o buhay pa rin yung "extracted" sa ngiping bagong-restore lang),
// isinusulat na lang lahat ng 6 rows (whole + 5 surfaces) bilang isang
// transaction, para consistent pa rin sa whole-tooth state yung per-surface
// query (getToothHistory, o kahit anong future per-surface report), hindi
// na kailangan pang mag-special-case ang frontend ng "eh kung ang whole
// tooth pala ay X...". Uniform 'to sa kahit anong conditionCode ipasa,
// hindi lang 'extracted' — hal. legit ding whole-tooth fact yung
// full-coverage crown.
export async function createWholeToothEntry({ patientId, toothNumber, conditionCode, notes, recordedBy }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    let wholeEntryId = null
    for (const surface of ALL_SURFACES) {
      const [result] = await connection.execute(
        `INSERT INTO chart_entries (patient_id, tooth_number, surface, condition_code, notes, recorded_by)
         VALUES (:patientId, :toothNumber, :surface, :conditionCode, :notes, :recordedBy)`,
        { patientId, toothNumber, surface, conditionCode, notes: notes ?? null, recordedBy },
      )
      if (surface === 'whole') wholeEntryId = result.insertId
    }

    await connection.commit()

    const [rows] = await pool.execute(
      `SELECT ce.*, u.full_name AS dentist_name FROM chart_entries ce
       JOIN users u ON u.id = ce.recorded_by WHERE ce.id = :id`,
      { id: wholeEntryId },
    )
    return rows[0]
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}
