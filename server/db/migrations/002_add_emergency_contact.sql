-- Emergency contact for a patient record, added alongside the Edit Patient
-- workflow. Kept as two plain columns (name + phone) rather than one free
-- text field so the UI can validate/format them independently.
ALTER TABLE patients
  ADD COLUMN emergency_contact_name VARCHAR(150) NULL AFTER allergies,
  ADD COLUMN emergency_contact_phone VARCHAR(20) NULL AFTER emergency_contact_name;
