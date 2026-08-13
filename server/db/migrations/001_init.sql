-- DentaVault initial schema: Patient Records + X-ray Management modules.
-- Charting tables (2D/3D) are intentionally deferred to a later migration.

CREATE TABLE IF NOT EXISTS patients (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  sex               ENUM('male', 'female') NOT NULL,
  date_of_birth     DATE NOT NULL,
  contact_number    VARCHAR(20),
  email             VARCHAR(255),
  address           VARCHAR(255),
  medical_history   TEXT,
  allergies         TEXT,
  is_legacy_migrated TINYINT(1) NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patients_name (last_name, first_name)
) ENGINE=InnoDB;

-- Login accounts. Separate from `patients` because not every patient record
-- has portal access (legacy/migrated patients, walk-ins) but every account
-- that DOES exist is either the dentist or exactly one patient.
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NULL,
  role           ENUM('dentist', 'patient') NOT NULL,
  email          VARCHAR(255) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT chk_patient_role CHECK (
    (role = 'patient' AND patient_id IS NOT NULL) OR
    (role = 'dentist' AND patient_id IS NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS treatments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  procedure_name VARCHAR(150) NOT NULL,
  tooth_number   VARCHAR(10) NULL COMMENT 'FDI notation, optional until the charting module links here',
  notes          TEXT,
  treatment_date DATE NOT NULL,
  created_by     INT UNSIGNED NOT NULL COMMENT 'users.id of the dentist who recorded this',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_treatments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_treatments_dentist FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_treatments_patient_date (patient_id, treatment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS xray_images (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id         INT UNSIGNED NOT NULL,
  file_url           VARCHAR(500) NOT NULL COMMENT 'local path for now; becomes a Cloudinary secure_url later',
  original_filename  VARCHAR(255) NOT NULL,
  mime_type          VARCHAR(100) NOT NULL,
  file_size_bytes     INT UNSIGNED NOT NULL,
  source             ENUM('manual_upload', 'email_inbound') NOT NULL DEFAULT 'manual_upload',
  mailgun_message_id VARCHAR(255) NULL COMMENT 'set when source = email_inbound, used to prevent duplicate processing',
  taken_date         DATE NULL COMMENT 'date the x-ray was actually taken, if known',
  notes              TEXT,
  annotations        JSON NULL COMMENT 'canvas overlay shapes/text added during clinical review',
  uploaded_by        INT UNSIGNED NULL COMMENT 'users.id; NULL when source = email_inbound (system-ingested)',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_xrays_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_xrays_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_xrays_patient (patient_id),
  UNIQUE KEY uniq_mailgun_message (mailgun_message_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL COMMENT 'NULL for unauthenticated system events, e.g. inbound webhook',
  action      VARCHAR(100) NOT NULL COMMENT 'e.g. CREATE_PATIENT, VIEW_XRAY, LOGIN_SUCCESS',
  entity_type VARCHAR(50) NULL COMMENT 'e.g. patient, treatment, xray_image',
  entity_id   INT UNSIGNED NULL,
  details     JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
