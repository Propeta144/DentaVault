-- #32: Tinanggal ang Mailgun (X-ray sa email). Ang patient ay nag-a-upload na
-- lang ng X-ray sa patient portal (#27). Binubura ang mga table at column na
-- para lang sa email. Ang mga lumang X-ray na galing email (source =
-- 'email_inbound') ay naiiwan sa record ng patient; ang ENUM value ay hindi
-- tinatanggal para hindi masira ang mga row na iyon.
DROP TABLE IF EXISTS inbound_xray_hold_files;
DROP TABLE IF EXISTS inbound_xray_holds;
DROP TABLE IF EXISTS mailgun_webhook_tokens;

ALTER TABLE xray_images
  DROP INDEX uniq_mailgun_message,
  DROP COLUMN mailgun_message_id;
