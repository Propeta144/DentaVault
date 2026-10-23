import pool from '../config/db.js'
import { limitOffset } from '../utils/sqlLimit.js'

// Ibinabalik ni mysql2 yung JSON columns bilang raw text, hindi parsed
// value — kailangan i-parse pabalik dito sa bawat read path, kung hindi,
// makakatanggap ang caller ng string kung saan array naman ang inaasahan
// (na, kapag ni-spread mamaya gamit ang `...`, tahimik na masisira
// papuntang array ng individual characters sa halip na mag-throw, kaya
// madaling hindi mapansin itong bug).
function parseAnnotations(row) {
  if (!row) return row
  if (typeof row.annotations === 'string') {
    row.annotations = JSON.parse(row.annotations)
  }
  return row
}

export async function listXraysForPatient(patientId) {
  const [rows] = await pool.execute(
    `SELECT id, patient_id, original_filename, mime_type, file_size_bytes, source,
            taken_date, notes, annotations, reviewed_at, created_at
     FROM xray_images
     WHERE patient_id = :patientId AND deleted_at IS NULL
     ORDER BY COALESCE(taken_date, created_at) DESC, id DESC`,
    { patientId },
  )
  return rows.map(parseAnnotations)
}

// Soft-deleted rows are treated as gone from the app's point of view (404,
// same as a bad id) — same pattern as patientModel.findPatientById, and for
// the same reason: the row (and the file it points to) stays in place for
// retention, but nothing in the API surfaces it anymore.
export async function findXrayById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM xray_images WHERE id = :id AND deleted_at IS NULL',
    { id },
  )
  return parseAnnotations(rows[0]) || null
}

export async function createXray({
  patientId,
  fileUrl,
  originalFilename,
  mimeType,
  fileSizeBytes,
  source = 'manual_upload',
  takenDate,
  notes,
  uploadedBy,
}) {
  const [result] = await pool.execute(
    `INSERT INTO xray_images
      (patient_id, file_url, original_filename, mime_type, file_size_bytes, source, taken_date, notes, uploaded_by)
     VALUES
      (:patientId, :fileUrl, :originalFilename, :mimeType, :fileSizeBytes, :source, :takenDate, :notes, :uploadedBy)`,
    {
      patientId,
      fileUrl,
      originalFilename,
      mimeType,
      fileSizeBytes,
      source,
      takenDate: takenDate ?? null,
      notes: notes ?? null,
      uploadedBy: uploadedBy ?? null,
    },
  )
  return findXrayById(result.insertId)
}

export async function updateAnnotations(id, annotations) {
  await pool.execute(
    'UPDATE xray_images SET annotations = :annotations WHERE id = :id',
    { id, annotations: JSON.stringify(annotations) },
  )
  return findXrayById(id)
}

// Para lang 'to sa REVIEWABLE_SOURCES rows tinatawag (tignan
// xrays.controller.js) — minamarkahan yung "binuksan na ng dentist yung
// X-ray tab ng patient na 'to at nakita na" para bumaba yung sidebar badge
// count. Idempotent: unang view lang ang nag-sset nito.
export async function markXrayReviewed(id) {
  await pool.execute(
    'UPDATE xray_images SET reviewed_at = NOW() WHERE id = :id AND reviewed_at IS NULL',
    { id },
  )
}

// Mga X-ray na hindi ang dentist ang nag-upload, kaya kailangan niyang
// makita: in-upload ng patient sa patient portal (#27), at mga lumang
// galing email (bago tinanggal ang Mailgun, #32).
// Ligtas i-interpolate: sariling constant, hindi galing sa user.
const REVIEWABLE_SOURCES_SQL = `('email_inbound', 'patient_upload')`

// 'To yung nagpapagana sa sidebar "new X-ray from email" badge — count
// lang, walang list, para hindi na kailangan maghanap-hanap ng dentist sa
// bawat patient para lang malaman na may naghihintay.
export async function countUnreviewedEmailXrays() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM xray_images
     WHERE source IN ${REVIEWABLE_SOURCES_SQL} AND reviewed_at IS NULL AND deleted_at IS NULL`,
  )
  return count
}

// X-ray inbox (dentist): lahat ng X-ray na dumating sa email (at, #27, na
// in-upload ng patient sa portal), sa buong
// clinic, pinakabago muna — para hindi na kailangang buksan isa-isa ang
// bawat patient para malaman kung sino ang may bagong X-ray. `status`:
// 'new' = hindi pa nabubuksan (reviewed_at IS NULL), 'all' = lahat.
// Hindi kasama ang X-ray ng na-delete na patient.
export async function listInboxXrays({ status = 'new', limit, offset }) {
  const where = `x.source IN ${REVIEWABLE_SOURCES_SQL} AND x.deleted_at IS NULL AND p.deleted_at IS NULL${
    status === 'new' ? ' AND x.reviewed_at IS NULL' : ''
  }`
  const [rows] = await pool.execute(
    `SELECT x.id, x.original_filename, x.mime_type, x.source, x.taken_date, x.reviewed_at, x.created_at,
            p.patient_code, p.first_name, p.last_name
     FROM xray_images x
     JOIN patients p ON p.id = x.patient_id
     WHERE ${where}
     ORDER BY x.created_at DESC, x.id DESC
     ${limitOffset(limit, offset)}`,
  )
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM xray_images x JOIN patients p ON p.id = x.patient_id WHERE ${where}`,
  )
  return { rows, total }
}

export async function softDeleteXray(id) {
  await pool.execute('UPDATE xray_images SET deleted_at = NOW() WHERE id = :id', { id })
}
