-- Hiwalay sa pangalan; NULL muna sa lumang records, walang hinuhulaang relasyon.
ALTER TABLE patients
  ADD COLUMN emergency_contact_relationship VARCHAR(20) NULL AFTER emergency_contact_name,
  ADD COLUMN emergency_contact_relationship_other VARCHAR(100) NULL AFTER emergency_contact_relationship;
