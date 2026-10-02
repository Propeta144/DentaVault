import pool from '../config/db.js'

// X-ray emails na hinawakan muna (hindi awtomatikong na-file) — tignan
// migration 011 at webhooks.controller.js. Ang dentist ang magpapasya sa
// X-ray Inbox: i-assign sa tamang patient, o i-dismiss.

export async function findHoldByMessageId(messageId) {
  const [rows] = await pool.execute(
    'SELECT id FROM inbound_xray_holds WHERE mailgun_message_id = :messageId LIMIT 1',
    { messageId },
  )
  return rows[0] || null
}

export async function createHold({ reason, senderEmail, subject, messageId, spf, dkim, files }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute(
      `INSERT INTO inbound_xray_holds
        (reason, sender_email, subject, mailgun_message_id, spf_result, dkim_result)
       VALUES (:reason, :senderEmail, :subject, :messageId, :spf, :dkim)`,
      {
        reason,
        senderEmail,
        subject: subject ? String(subject).slice(0, 255) : null,
        messageId: messageId || null,
        spf: spf ? String(spf).slice(0, 50) : null,
        dkim: dkim ? String(dkim).slice(0, 50) : null,
      },
    )
    const holdId = result.insertId
    for (const f of files) {
      await connection.execute(
        `INSERT INTO inbound_xray_hold_files
          (hold_id, file_url, original_filename, mime_type, file_size_bytes, dedupe_id)
         VALUES (:holdId, :fileUrl, :originalFilename, :mimeType, :fileSizeBytes, :dedupeId)`,
        { holdId, ...f, dedupeId: f.dedupeId ?? null },
      )
    }
    await connection.commit()
    return holdId
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

export async function countPendingHolds() {
  const [[{ count }]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM inbound_xray_holds WHERE status = 'pending'",
  )
  return count
}

// Para sa X-ray Inbox. Ang mga "candidate" na patient ay kinukuha NGAYON
// (hindi noong dumating ang email), kaya kapag inayos ng dentist ang email
// ng isang patient, tama na agad ang listahan.
export async function listPendingHolds({ limit = 50 } = {}) {
  const [holds] = await pool.execute(
    `SELECT id, reason, sender_email, subject, spf_result, dkim_result, created_at
     FROM inbound_xray_holds
     WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC
     LIMIT ${Math.max(1, Math.trunc(Number(limit)) || 50)}`,
  )
  if (holds.length === 0) return []

  const ids = holds.map((h) => h.id)
  const [files] = await pool.query(
    `SELECT id, hold_id, original_filename, mime_type, file_size_bytes
     FROM inbound_xray_hold_files WHERE hold_id IN (?) ORDER BY id`,
    [ids],
  )
  const emails = [...new Set(holds.map((h) => h.sender_email.toLowerCase()))]
  const [candidates] = await pool.query(
    `SELECT LOWER(email) AS email, patient_code, first_name, last_name FROM patients
     WHERE LOWER(email) IN (?) AND deleted_at IS NULL
     ORDER BY last_name, first_name`,
    [emails],
  )

  return holds.map((h) => ({
    ...h,
    files: files.filter((f) => f.hold_id === h.id).map(({ hold_id: _omit, ...f }) => f),
    candidates: candidates
      .filter((c) => c.email === h.sender_email.toLowerCase())
      .map(({ email: _omit, ...c }) => c),
  }))
}

export async function findHoldFile(holdId, fileId) {
  const [rows] = await pool.execute(
    `SELECT f.*, h.status FROM inbound_xray_hold_files f
     JOIN inbound_xray_holds h ON h.id = f.hold_id
     WHERE f.hold_id = :holdId AND f.id = :fileId`,
    { holdId, fileId },
  )
  return rows[0] || null
}

// I-file sa patient: isang transaction — inaangkin muna ang hold (status
// pending → assigned; kapag 0 rows, may nauna nang nagpasya, kaya walang
// madodoble kahit dalawang beses napindot), tapos gagawa ng xray_images
// row bawat file. reviewed_at = NULL: lalabas sa "New" ng Inbox, gaya ng
// karaniwang email X-ray. Ibinabalik ang bilang ng nagawang X-ray, o null
// kapag hindi na pending.
export async function assignHold(holdId, { patientId, userId }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [claim] = await connection.execute(
      `UPDATE inbound_xray_holds
       SET status = 'assigned', assigned_patient_id = :patientId, resolved_by = :userId, resolved_at = NOW()
       WHERE id = :holdId AND status = 'pending'`,
      { holdId, patientId, userId },
    )
    if (claim.affectedRows === 0) {
      await connection.rollback()
      return null
    }
    const [files] = await connection.execute(
      'SELECT * FROM inbound_xray_hold_files WHERE hold_id = :holdId ORDER BY id',
      { holdId },
    )
    for (const f of files) {
      await connection.execute(
        `INSERT INTO xray_images
          (patient_id, file_url, original_filename, mime_type, file_size_bytes, source, mailgun_message_id, uploaded_by)
         VALUES (:patientId, :fileUrl, :originalFilename, :mimeType, :fileSizeBytes, 'email_inbound', :dedupeId, NULL)`,
        {
          patientId,
          fileUrl: f.file_url,
          originalFilename: f.original_filename,
          mimeType: f.mime_type,
          fileSizeBytes: f.file_size_bytes,
          dedupeId: f.dedupe_id,
        },
      )
    }
    // Nasa xray_images na ang file_url, kaya hindi na kailangan ang kopya rito
    await connection.execute('DELETE FROM inbound_xray_hold_files WHERE hold_id = :holdId', { holdId })
    await connection.commit()
    return files.length
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

// Dismiss: inaangkin ang hold, tapos ibinabalik ang listahan ng file_url
// para burahin ng controller ang mismong mga file. null kapag hindi na pending.
export async function dismissHold(holdId, { userId }) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [claim] = await connection.execute(
      `UPDATE inbound_xray_holds
       SET status = 'dismissed', resolved_by = :userId, resolved_at = NOW()
       WHERE id = :holdId AND status = 'pending'`,
      { holdId, userId },
    )
    if (claim.affectedRows === 0) {
      await connection.rollback()
      return null
    }
    const [files] = await connection.execute(
      'SELECT file_url FROM inbound_xray_hold_files WHERE hold_id = :holdId',
      { holdId },
    )
    await connection.execute('DELETE FROM inbound_xray_hold_files WHERE hold_id = :holdId', { holdId })
    await connection.commit()
    return files.map((f) => f.file_url)
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}
