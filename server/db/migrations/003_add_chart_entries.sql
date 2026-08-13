-- 2D Odontogram module. Append-only, like audit_logs: every mark the
-- dentist makes is its own row (the proposal explicitly requires a
-- "chronological record of all treatments performed on specific teeth").
-- The chart's CURRENT state for a tooth/surface is simply the latest row
-- for that (patient_id, tooth_number, surface) pair — derived at query
-- time, never a second table to keep in sync.
--
-- 3D charting is out of scope for this phase (see proposal constraint).
-- This table only stores what a 2D surface diagram needs; a future 3D
-- module can read the same rows without any schema change here.
CREATE TABLE IF NOT EXISTS chart_entries (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  tooth_number   VARCHAR(10) NOT NULL COMMENT 'FDI notation, e.g. 36',
  surface        ENUM('mesial', 'distal', 'occlusal', 'facial', 'lingual', 'whole') NOT NULL DEFAULT 'whole',
  condition_code ENUM('healthy', 'caries', 'filling', 'root_canal', 'crown', 'extracted') NOT NULL,
  notes          TEXT,
  recorded_by    INT UNSIGNED NOT NULL,
  recorded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chart_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_chart_dentist FOREIGN KEY (recorded_by) REFERENCES users(id),
  INDEX idx_chart_patient_tooth (patient_id, tooth_number, surface, recorded_at)
) ENGINE=InnoDB;
