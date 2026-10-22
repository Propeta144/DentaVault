-- Feature #30: naka-sync na ang Treatment History at ang Dental Chart (2D/3D).
--
-- 1. treatments.surfaces: aling surface ang ginawan (hal. "mesial,occlusal"
--    para sa MO filling). NULL = buong ngipin / hindi tinukoy. Kailangan ito
--    para maipinta ang tamang surface sa chart, at para ma-edit ulit.
-- 2. chart_entries.treatment_id: ang chart entry na ginawa KASABAY ng isang
--    treatment (galing Add Treatment, o galing sa chart na may "Also add to
--    Treatment History"). Kapag na-edit ang treatment, inaayos din ang mga
--    entry na ito; kapag binura ang treatment, binubura rin sila (bumabalik
--    ang chart sa dating kalagayan, dahil append-only ang chart_entries).
--    Walang FK na ON DELETE CASCADE: ang server mismo ang nagbubura sa
--    loob ng iisang transaction (para may audit ng bilang).
ALTER TABLE treatments
  ADD COLUMN surfaces VARCHAR(60) NULL AFTER tooth_number;

ALTER TABLE chart_entries
  ADD COLUMN treatment_id INT UNSIGNED NULL AFTER patient_id,
  ADD INDEX idx_chart_treatment (treatment_id);
