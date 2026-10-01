import { generatePatientCode } from '../../src/utils/patientCode.js'

// Nagdadagdag ng `patient_code` (hal. DV-7K3M-9QX2) — ito na yung ID na
// makikita sa URL at sa screen, kapalit ng sunod-sunod na `patients.id`
// (tignan src/utils/patientCode.js kung bakit). JS migration 'to, hindi SQL,
// kasi kailangan ng crypto-random na code para sa bawat existing patient;
// yung UUID() ng MySQL/MariaDB, time-based, kaya mas predictable.
export async function up(connection) {
  // Chinicheck muna kung nandiyan na yung column, para kung pumalya 'to sa
  // gitna (hal. naputol yung DB), pwedeng patakbuhin ulit nang hindi
  // nag-e-error sa "duplicate column".
  const [cols] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patients' AND COLUMN_NAME = 'patient_code'`,
  )
  if (cols.length === 0) {
    await connection.query('ALTER TABLE patients ADD COLUMN patient_code VARCHAR(12) NULL AFTER id')
  }

  // Backfill — kasama pati soft-deleted patients, para lahat ng row may code.
  const [rows] = await connection.query('SELECT id FROM patients WHERE patient_code IS NULL')
  const used = new Set()
  for (const { id } of rows) {
    let code
    do code = generatePatientCode()
    while (used.has(code))
    used.add(code)
    await connection.execute('UPDATE patients SET patient_code = :code WHERE id = :id', { code, id })
  }

  await connection.query('ALTER TABLE patients MODIFY patient_code VARCHAR(12) NOT NULL')
  const [indexes] = await connection.query(
    "SHOW INDEX FROM patients WHERE Key_name = 'uq_patients_patient_code'",
  )
  if (indexes.length === 0) {
    await connection.query('CREATE UNIQUE INDEX uq_patients_patient_code ON patients (patient_code)')
  }

  console.log(`  Backfilled patient_code for ${rows.length} patient(s).`)
}
