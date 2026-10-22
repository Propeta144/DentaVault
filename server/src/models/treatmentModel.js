import pool from '../config/db.js'
import { clinicToday } from '../utils/validators.js'
import { TOOTH_SURFACES, chartPlanFor, normalizeSurfaces } from '../utils/treatmentChart.js'

// `chart_entry_count` / `chart_condition`: para makita sa Treatment History
// na nasa chart din ito, at para ma-prefill ang edit (hal. X vs XO).
export async function listTreatmentsForPatient(patientId) {
  const [rows] = await pool.execute(
    `SELECT t.*, u.full_name AS dentist_name,
       (SELECT COUNT(*) FROM chart_entries ce WHERE ce.treatment_id = t.id) AS chart_entry_count,
       (SELECT ce.condition_code FROM chart_entries ce WHERE ce.treatment_id = t.id ORDER BY ce.id LIMIT 1) AS chart_condition
     FROM treatments t
     JOIN users u ON u.id = t.created_by
     WHERE t.patient_id = :patientId
     ORDER BY t.treatment_date DESC, t.id DESC`,
    { patientId },
  )
  return rows
}

export async function findTreatmentForPatient(id, patientId) {
  const [rows] = await pool.execute(
    `SELECT t.*,
       (SELECT ce.condition_code FROM chart_entries ce WHERE ce.treatment_id = t.id ORDER BY ce.id LIMIT 1) AS chart_condition
     FROM treatments t WHERE t.id = :id AND t.patient_id = :patientId`,
    { id, patientId },
  )
  return rows[0] || null
}

async function findTreatmentWithDentist(conn, id) {
  const [rows] = await conn.execute(
    `SELECT t.*, u.full_name AS dentist_name,
       (SELECT COUNT(*) FROM chart_entries ce WHERE ce.treatment_id = t.id) AS chart_entry_count,
       (SELECT ce.condition_code FROM chart_entries ce WHERE ce.treatment_id = t.id ORDER BY ce.id LIMIT 1) AS chart_condition
     FROM treatments t JOIN users u ON u.id = t.created_by WHERE t.id = :id`,
    { id },
  )
  return rows[0]
}

// Oras ng chart entry: NGAYON kapag ngayong araw ang treatment; kung luma
// (hal. legacy visit noong 2019), tanghali ng araw na iyon. Mahalaga ito
// dahil ang "kasalukuyang" chart ay ang pinakabagong entry bawat surface:
// hindi dapat matakpan ng 2019 na filling ang 2024 na extraction.
function recordedAtFor(treatmentDate) {
  return treatmentDate === clinicToday() ? null : `${treatmentDate} 12:00:00`
}

// Isinusulat ang mga chart entry ng isang plan (tingnan chartPlanFor).
// 'whole' = 6 rows (whole + 5 surfaces), parehong panuntunan ng
// createWholeToothEntry sa chartModel.js.
export async function insertChartRows(
  conn,
  { patientId, treatmentId, plan, notes, recordedBy, treatmentDate, strokeData = null },
) {
  const surfaces = plan.surfaces[0] === 'whole' ? ['whole', ...TOOTH_SURFACES] : plan.surfaces
  const recordedAt = treatmentDate ? recordedAtFor(treatmentDate) : null
  const ids = []
  for (const surface of surfaces) {
    const [result] = await conn.execute(
      `INSERT INTO chart_entries (patient_id, treatment_id, tooth_number, surface, condition_code, notes, stroke_data, recorded_by, recorded_at)
       VALUES (:patientId, :treatmentId, :toothNumber, :surface, :conditionCode, :notes, :strokeData, :recordedBy, COALESCE(:recordedAt, NOW()))`,
      {
        patientId,
        treatmentId,
        toothNumber: plan.toothNumber,
        surface,
        conditionCode: plan.conditionCode,
        notes: notes ?? null,
        // Drawing ng 3D pen: sa iisang surface lang (hindi kinokopya sa 5)
        strokeData: strokeData && surfaces.length === 1 ? JSON.stringify(strokeData) : null,
        recordedBy,
        recordedAt,
      },
    )
    ids.push(result.insertId)
  }
  return ids
}

async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function insertTreatmentRow(conn, { patientId, procedureName, toothNumber, surfaces, notes, treatmentDate, createdBy }) {
  const list = normalizeSurfaces(surfaces)
  const [result] = await conn.execute(
    `INSERT INTO treatments (patient_id, procedure_name, tooth_number, surfaces, notes, treatment_date, created_by)
     VALUES (:patientId, :procedureName, :toothNumber, :surfaces, :notes, :treatmentDate, :createdBy)`,
    {
      patientId,
      procedureName,
      toothNumber: toothNumber ?? null,
      surfaces: list.length ? list.join(',') : null,
      notes: notes ?? null,
      treatmentDate,
      createdBy,
    },
  )
  return result.insertId
}

// Treatment + (kung may katapat) marka sa chart, iisang transaction.
// Ginagamit ng Add Treatment, Manual Entry (batch), at Bulk Import.
// Ibinabalik din ang `chartEntryCount` (0 = treatment lang).
export async function createTreatment(input, { conn: outerConn } = {}) {
  const run = async (conn) => {
    const id = await insertTreatmentRow(conn, input)
    const plan = chartPlanFor({
      procedureName: input.procedureName,
      toothNumber: input.toothNumber,
      surfaces: input.surfaces,
      preferredCondition: input.chartCondition,
    })
    if (plan) {
      await insertChartRows(conn, {
        patientId: input.patientId,
        treatmentId: id,
        plan,
        notes: input.notes,
        recordedBy: input.createdBy,
        treatmentDate: input.treatmentDate,
      })
    }
    return findTreatmentWithDentist(conn, id)
  }
  return outerConn ? run(outerConn) : withTransaction(run)
}

// Maraming treatment nang sabay (Manual Entry): all-or-nothing
export async function createTreatments(inputs) {
  return withTransaction(async (conn) => {
    const rows = []
    for (const input of inputs) rows.push(await createTreatment(input, { conn }))
    return rows
  })
}

// Galing sa CHART ("Also add to Treatment History"): ang chart entry ang
// pinanggalingan, kaya kasama ang drawing (strokeData) ng 3D pen.
export async function createChartEntryWithTreatment({
  patientId,
  procedureName,
  plan,
  notes,
  strokeData,
  recordedBy,
}) {
  return withTransaction(async (conn) => {
    const treatmentId = await insertTreatmentRow(conn, {
      patientId,
      procedureName,
      toothNumber: plan.toothNumber,
      surfaces: plan.surfaces[0] === 'whole' ? null : plan.surfaces,
      notes,
      treatmentDate: clinicToday(),
      createdBy: recordedBy,
    })
    const ids = await insertChartRows(conn, { patientId, treatmentId, plan, notes, recordedBy, strokeData })
    return { treatmentId, chartEntryId: ids[0] }
  })
}

async function linkedChartEntries(conn, treatmentId) {
  const [rows] = await conn.execute(
    'SELECT id, tooth_number, surface, condition_code, stroke_data FROM chart_entries WHERE treatment_id = :treatmentId ORDER BY id',
    { treatmentId },
  )
  return rows
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

// Edit ng treatment. Kapag pareho pa rin ang marka (ngipin, kondisyon,
// surfaces), notes at oras lang ang ina-update sa chart entries, kaya hindi
// nawawala ang drawing ng 3D pen. Kapag nagbago, pinapalitan ang mga entry
// (bumabalik muna sa dating kalagayan ang chart, tapos bagong marka).
// Ibinabalik: { treatment, chartChange: 'none' | 'updated' | 'replaced' | 'removed' | 'added' }
export async function updateTreatment(id, input) {
  return withTransaction(async (conn) => {
    const linked = await linkedChartEntries(conn, id)
    const surfaces = normalizeSurfaces(input.surfaces)
    await conn.execute(
      `UPDATE treatments SET procedure_name = :procedureName, tooth_number = :toothNumber, surfaces = :surfaces,
         notes = :notes, treatment_date = :treatmentDate
       WHERE id = :id`,
      {
        id,
        procedureName: input.procedureName,
        toothNumber: input.toothNumber ?? null,
        surfaces: surfaces.length ? surfaces.join(',') : null,
        notes: input.notes ?? null,
        treatmentDate: input.treatmentDate,
      },
    )

    const plan = chartPlanFor({
      procedureName: input.procedureName,
      toothNumber: input.toothNumber,
      surfaces: input.surfaces,
      preferredCondition: input.chartCondition || linked[0]?.condition_code,
    })

    let chartChange = 'none'
    const linkedSurfaces = linked.some((e) => e.surface === 'whole') ? ['whole'] : linked.map((e) => e.surface)
    const unchanged =
      plan &&
      linked.length > 0 &&
      linked[0].tooth_number === plan.toothNumber &&
      linked[0].condition_code === plan.conditionCode &&
      sameSet(linkedSurfaces, plan.surfaces)

    if (unchanged) {
      await conn.execute(
        `UPDATE chart_entries SET notes = :notes, recorded_at = COALESCE(:recordedAt, recorded_at)
         WHERE treatment_id = :id`,
        // Ngayong araw pa rin = hindi ginagalaw ang oras
        { id, notes: input.notes ?? null, recordedAt: recordedAtFor(input.treatmentDate) },
      )
      chartChange = 'updated'
    } else {
      if (linked.length > 0) {
        await conn.execute('DELETE FROM chart_entries WHERE treatment_id = :id', { id })
        chartChange = plan ? 'replaced' : 'removed'
      }
      if (plan) {
        await insertChartRows(conn, {
          patientId: input.patientId,
          treatmentId: id,
          plan,
          notes: input.notes,
          recordedBy: input.updatedBy,
          treatmentDate: input.treatmentDate,
        })
        if (linked.length === 0) chartChange = 'added'
      }
    }

    return { treatment: await findTreatmentWithDentist(conn, id), chartChange }
  })
}

// Pagbura (maling entry): kasama ang marka nito sa chart. Ibinabalik ang
// bilang ng nabura na chart entries (para sa audit log).
export async function deleteTreatment(id) {
  return withTransaction(async (conn) => {
    const [chart] = await conn.execute('DELETE FROM chart_entries WHERE treatment_id = :id', { id })
    await conn.execute('DELETE FROM treatments WHERE id = :id', { id })
    return chart.affectedRows
  })
}
