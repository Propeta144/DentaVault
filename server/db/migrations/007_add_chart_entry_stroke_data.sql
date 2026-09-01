-- The 3D chart used to throw away the dentist's actual freehand strokes
-- after classifying them into a surface — once saved, only a flat colored
-- plane rendered over that surface, not the real drawing. This column
-- preserves the strokes themselves (UV coordinates, fraction 0..1 of the
-- tooth's own texture space, same "store as fractions not pixels" pattern
-- already used for xray_images.annotations) so the 3D chart can redraw the
-- actual mark on reload instead of a generic box. NULL for entries with no
-- captured strokes: 2D-originated saves (2D has no freehand drawing),
-- whole-tooth entries (one stroke doesn't represent all 5 surfaces), and
-- any entry created before this column existed.
ALTER TABLE chart_entries
  ADD COLUMN stroke_data JSON NULL AFTER notes;
