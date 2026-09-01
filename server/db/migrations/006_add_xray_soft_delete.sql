-- Same reasoning as patients.deleted_at (see 004_add_patient_soft_delete.sql):
-- an X-ray is a medical record, so "Delete" hides it from the app instead of
-- destroying the row or the underlying file — it stays available for
-- continuity-of-care, disputes, or audit, just not through the UI anymore.
ALTER TABLE xray_images
  ADD COLUMN deleted_at DATETIME NULL AFTER reviewed_at;

CREATE INDEX idx_xray_images_deleted_at ON xray_images (deleted_at);
