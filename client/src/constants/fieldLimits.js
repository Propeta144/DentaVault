// Pinakamahabang tinatanggap bawat field (maxLength sa mga input). KAPAREHO
// ng server/src/utils/validators.js FIELD_LIMITS (= laki ng column sa DB);
// ang server pa rin ang tunay na nagpapatupad. Kapag binago ang isa,
// baguhin din ang isa.
export const FIELD_LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 255,
  address: 255,
  contactNumber: 20,
  emergencyContactName: 150,
  emergencyContactPhone: 20,
  medicalHistory: 2000,
  allergies: 2000,
  notes: 2000,
}

// Kapareho ng server/src/config/upload.js MAX_FILE_SIZE_BYTES
export const MAX_XRAY_FILE_BYTES = 15 * 1024 * 1024
