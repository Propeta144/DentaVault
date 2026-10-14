-- Mga kondisyon mula sa legend ng papel na dental chart ng clinic (client
-- visit, Oct 13, 2026). Ang 6 na dati ay naiwan (pareho ang code, kaya buo
-- ang lumang data); idinagdag lang ang mga bago sa dulo ng ENUM.
--
-- Letter codes ng clinic → code dito:
--   M  missing_caries         MO missing_other          I  indicated_extraction
--   RF root_fragment          RM removable_denture      A  amalgam
--   AB abutment               P  pontic                 In inlay
--   FX composite              XO extraction_other       CM congenitally_missing
--   Sp supernumerary          S  sealant
-- Dagdag (wala sa legend, nasa checklist): Im impacted, Fr fractured, Un unerupted.
--
-- Walang pagbabago sa tooth_number (VARCHAR(10)), kaya kasya na ang baby
-- teeth (51–55, 61–65, 71–75, 81–85).
ALTER TABLE chart_entries
  MODIFY COLUMN condition_code ENUM(
    'healthy', 'caries', 'filling', 'root_canal', 'crown', 'extracted',
    'missing_caries', 'missing_other', 'indicated_extraction', 'root_fragment',
    'removable_denture', 'amalgam', 'abutment', 'pontic', 'inlay', 'composite',
    'extraction_other', 'congenitally_missing', 'supernumerary', 'sealant',
    'impacted', 'fractured', 'unerupted'
  ) NOT NULL;
