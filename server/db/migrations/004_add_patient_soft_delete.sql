-- Soft delete: dental/medical records need retention for continuity-of-care
-- and liability reasons even after a deletion request, so "Delete Patient"
-- hides the record from the app rather than destroying the row. The data
-- (and its full treatment/chart/X-ray history) stays intact in the database.
ALTER TABLE patients
  ADD COLUMN deleted_at DATETIME NULL AFTER is_legacy_migrated;

CREATE INDEX idx_patients_deleted_at ON patients (deleted_at);
