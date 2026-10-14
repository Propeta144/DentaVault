-- Buong "Patient Information Record" ng clinic (papel na form nila, client
-- visit Oct 13, 2026; desisyon ng team: isama ang buong form). Lahat ay
-- NULL-able: ang mga lumang record ay walang ganitong datos, at hindi lahat
-- ng tanong ay laging nasasagot.
--
-- Yes/No na tanong = TINYINT(1) NULL: 1 = Yes, 0 = No, NULL = hindi natanong
-- (iba ang "hindi natanong" sa "No", para sa kaligtasan ng pasyente).
-- Ang mga sagot na may "If so, ..." ay may kasamang *_details na text.
--
-- Hindi na kailangan ng bagong column para sa: Age (kinukuwenta mula sa
-- date_of_birth), Sex, Cel/Mobile, Email, Home Address, Allergies (#8) at ang
-- checklist ng mga sakit (#13) — nasa medical_history at allergies na ang mga ito.
ALTER TABLE patients
  ADD COLUMN middle_name               VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN occupation                VARCHAR(100) NULL AFTER address,
  ADD COLUMN nationality               VARCHAR(60)  NULL AFTER occupation,
  ADD COLUMN religion                  VARCHAR(60)  NULL AFTER nationality,
  ADD COLUMN guardian_name             VARCHAR(150) NULL COMMENT 'Parent/guardian, for minors' AFTER religion,
  -- Dental history
  ADD COLUMN previous_dentist          VARCHAR(150) NULL AFTER guardian_name,
  ADD COLUMN last_dental_visit         VARCHAR(100) NULL COMMENT 'Free text: paper records often only have a year or "2 years ago"' AFTER previous_dentist,
  -- Physician
  ADD COLUMN physician_name            VARCHAR(150) NULL AFTER last_dental_visit,
  ADD COLUMN physician_specialty       VARCHAR(100) NULL AFTER physician_name,
  ADD COLUMN physician_office_address  VARCHAR(255) NULL AFTER physician_specialty,
  ADD COLUMN physician_office_number   VARCHAR(30)  NULL AFTER physician_office_address,
  -- Health questions 1–7, 9–12 of the paper form
  ADD COLUMN in_good_health            TINYINT(1)   NULL AFTER physician_office_number,
  ADD COLUMN under_medical_treatment   TINYINT(1)   NULL AFTER in_good_health,
  ADD COLUMN medical_treatment_details VARCHAR(255) NULL AFTER under_medical_treatment,
  ADD COLUMN serious_illness           TINYINT(1)   NULL AFTER medical_treatment_details,
  ADD COLUMN serious_illness_details   VARCHAR(255) NULL AFTER serious_illness,
  ADD COLUMN hospitalized              TINYINT(1)   NULL AFTER serious_illness_details,
  ADD COLUMN hospitalization_details   VARCHAR(255) NULL AFTER hospitalized,
  ADD COLUMN taking_medication         TINYINT(1)   NULL AFTER hospitalization_details,
  ADD COLUMN medication_details        VARCHAR(255) NULL AFTER taking_medication,
  ADD COLUMN uses_tobacco              TINYINT(1)   NULL AFTER medication_details,
  ADD COLUMN uses_alcohol_drugs        TINYINT(1)   NULL AFTER uses_tobacco,
  ADD COLUMN bleeding_time             VARCHAR(50)  NULL AFTER uses_alcohol_drugs,
  ADD COLUMN is_pregnant               TINYINT(1)   NULL COMMENT 'Women only' AFTER bleeding_time,
  ADD COLUMN is_nursing                TINYINT(1)   NULL COMMENT 'Women only' AFTER is_pregnant,
  ADD COLUMN taking_birth_control      TINYINT(1)   NULL COMMENT 'Women only' AFTER is_nursing,
  ADD COLUMN blood_type                VARCHAR(10)  NULL AFTER taking_birth_control,
  ADD COLUMN blood_pressure            VARCHAR(20)  NULL AFTER blood_type;
