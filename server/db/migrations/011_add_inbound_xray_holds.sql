-- X-ray emails na HINDI awtomatikong ini-file sa patient, kundi pinapahawak
-- muna para ang dentist ang pumili (X-ray Inbox → "Needs your decision"):
--   shared_email      = 2+ patient ang may ganitong email (hal. iisang email
--                       ng magulang para sa mga anak) — hindi alam kung kanino
--   unverified_sender = hindi pumasa sa SPF check ni Mailgun, kaya puwedeng
--                       peke ang "From" address
-- Hiwalay na table (hindi NULL patient_id sa xray_images) para walang
-- existing query/access check na kailangang galawin: hindi nakikita ang
-- mga file na 'to kahit saan hangga't hindi ina-assign ng dentist.
CREATE TABLE IF NOT EXISTS inbound_xray_holds (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reason              ENUM('shared_email', 'unverified_sender') NOT NULL,
  sender_email        VARCHAR(255) NOT NULL,
  subject             VARCHAR(255) NULL,
  mailgun_message_id  VARCHAR(255) NULL COMMENT 'para hindi madoble kapag nag-retry si Mailgun',
  spf_result          VARCHAR(50) NULL,
  dkim_result         VARCHAR(50) NULL,
  status              ENUM('pending', 'assigned', 'dismissed') NOT NULL DEFAULT 'pending',
  assigned_patient_id INT UNSIGNED NULL,
  resolved_by         INT UNSIGNED NULL,
  resolved_at         DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_holds_patient FOREIGN KEY (assigned_patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  CONSTRAINT fk_holds_resolver FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_holds_status (status),
  UNIQUE KEY uniq_holds_message (mailgun_message_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inbound_xray_hold_files (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hold_id           INT UNSIGNED NOT NULL,
  file_url          VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  file_size_bytes   INT UNSIGNED NOT NULL,
  dedupe_id         VARCHAR(255) NULL COMMENT 'magiging xray_images.mailgun_message_id kapag na-assign',
  CONSTRAINT fk_hold_files_hold FOREIGN KEY (hold_id) REFERENCES inbound_xray_holds(id) ON DELETE CASCADE,
  INDEX idx_hold_files_hold (hold_id)
) ENGINE=InnoDB;
