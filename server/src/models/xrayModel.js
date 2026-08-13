import pool from '../config/db.js'

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
     WHERE patient_id = :patientId
     ORDER BY COALESCE(taken_date, created_at) DESC, id DESC`,
    { patientId },
  )
  return rows.map(parseAnnotations)
}

export async function findXrayById(id) {
  const [rows] = await pool.execute('SELECT * FROM xray_images WHERE id = :id', { id })
  return parseAnnotations(rows[0]) || null
}

// Nagre-retry si Mailgun ng inbound webhook delivery sa kahit ano maliban
// sa mabilis na 2xx — dito na kilala ng webhook handler na "na-process
// na pala 'to na email" tapos wala na siyang gagawin, sa halip na gumawa
// ng duplicate X-ray sa bawat retry.
export async function findXrayByMailgunMessageId(messageId) {
  const [rows] = await pool.execute(
    'SELECT id FROM xray_images WHERE mailgun_message_id = :messageId LIMIT 1',
    { messageId },
  )
  return rows[0] || null
}

export async function createXray({
  patientId,
  fileUrl,
  originalFilename,
  mimeType,
  fileSizeBytes,
  source = 'manual_upload',
  mailgunMessageId = null,
  takenDate,
  notes,
  uploadedBy,
}) {
  const [result] = await pool.execute(
    `INSERT INTO xray_images
      (patient_id, file_url, original_filename, mime_type, file_size_bytes, source, mailgun_message_id, taken_date, notes, uploaded_by)
     VALUES
      (:patientId, :fileUrl, :originalFilename, :mimeType, :fileSizeBytes, :source, :mailgunMessageId, :takenDate, :notes, :uploadedBy)`,
    {
      patientId,
      fileUrl,
      originalFilename,
      mimeType,
      fileSizeBytes,
      source,
      mailgunMessageId,
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

// Para lang 'to sa source = 'email_inbound' rows tinatawag (tignan
// xrays.controller.js) — minamarkahan yung "binuksan na ng dentist yung
// X-ray tab ng patient na 'to at nakita na" para bumaba yung sidebar badge
// count. Idempotent: unang view lang ang nag-sset nito.
export async function markXrayReviewed(id) {
  await pool.execute(
    'UPDATE xray_images SET reviewed_at = NOW() WHERE id = :id AND reviewed_at IS NULL',
    { id },
  )
}

// 'To yung nagpapagana sa sidebar "new X-ray from email" badge — count
// lang, walang list, para hindi na kailangan maghanap-hanap ng dentist sa
// bawat patient para lang malaman na may naghihintay.
export async function countUnreviewedEmailXrays() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM xray_images
     WHERE source = 'email_inbound' AND reviewed_at IS NULL`,
  )
  return count
}
