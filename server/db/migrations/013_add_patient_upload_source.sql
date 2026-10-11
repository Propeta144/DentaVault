-- Pag-upload ng X-ray ng patient mismo sa patient portal (CLAUDE.md #27,
-- ayon sa Functional Requirements at Patient Dashboard wireframe ng paper).
-- Bagong source para makilala sa dentist (X-ray Inbox) at para malaman kung
-- puwede pa itong burahin ng patient (hangga't hindi pa nare-review).
-- Walang epekto sa mga kasalukuyang row.
ALTER TABLE xray_images
  MODIFY COLUMN source ENUM('manual_upload', 'email_inbound', 'patient_upload') NOT NULL DEFAULT 'manual_upload';
