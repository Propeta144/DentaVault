-- Lets the UI show a "new X-ray from email" badge for the dentist without a
-- separate read-tracking table. NULL means "not yet opened by the dentist" —
-- meaningful for source = 'email_inbound' rows, since those were auto-ingested
-- by the Mailgun webhook and the dentist has never seen them. Manual uploads
-- also get NULL (no DEFAULT), but the app only ever checks this column for
-- email_inbound rows, so it has no effect there.
ALTER TABLE xray_images
  ADD COLUMN reviewed_at DATETIME NULL AFTER uploaded_by;

-- Existing rows predate this feature — treat them as already seen so the
-- badge doesn't show a false backlog the first time this migration runs.
UPDATE xray_images SET reviewed_at = created_at WHERE reviewed_at IS NULL;
