-- Ibabang bahagi ng papel na "Intraoral Examination" ng clinic (client visit,
-- Oct 13, 2026): Periodontal Screening, Occlusion, Appliances, at TMD. Para
-- sa BUONG bibig ito (hindi bawat ngipin), kaya hiwalay sa chart_entries.
--
-- Isang kasalukuyang record bawat patient (PRIMARY KEY = patient_id); ang
-- bawat pagbabago ay nasa audit_logs (UPDATE_INTRAORAL_EXAM, may lumang at
-- bagong laman), kaya may kasaysayan pa rin.
--
-- findings (JSON): { "items": ["gingivitis", "crossbite", ...],
--                    "molarClass": "I" | "II" | "III" | null,
--                    "appliancesOther": "text" | null }
-- Ang mga code ay naka-whitelist sa server (utils/validators.js INTRAORAL_ITEMS).
CREATE TABLE IF NOT EXISTS intraoral_exams (
  patient_id INT UNSIGNED PRIMARY KEY,
  findings   JSON NOT NULL,
  updated_by INT UNSIGNED NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_intraoral_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_intraoral_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB;
