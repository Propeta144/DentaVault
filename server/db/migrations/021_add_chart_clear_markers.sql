-- Append-only removal: huwag ibalik ang lumang condition o tawaging Healthy
-- ang cleared surface. Nasa history pa rin ang dating entries at removal.
ALTER TABLE chart_entries ADD COLUMN is_cleared TINYINT(1) NOT NULL DEFAULT 0;
