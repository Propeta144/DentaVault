-- Security review (CLAUDE.md #26).
--
-- 1) token_version: kasama sa bawat login token (JWT). Tinataasan kapag
--    nag-reset/nagpalit ng password, nag-sign out, o na-delete ang patient,
--    kaya agad nang hindi gumagana ang mga lumang token (dati, hanggang 8
--    oras pa). Tignan ang middleware/auth.js.
ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER must_change_password;

-- Portal account ng mga patient na na-delete na: hindi na dapat makapag-login.
-- (Mula ngayon, ginagawa na ito ng pag-delete ng patient.)
UPDATE users u
  JOIN patients p ON p.id = u.patient_id
  SET u.is_active = 0
  WHERE p.deleted_at IS NOT NULL;

-- 2) Mailgun webhook replay protection: ang `token` ng bawat napirmahang
--    request ay isang beses lang tatanggapin. Itinatala pagkatapos ng
--    matagumpay na proseso (para gumana pa rin ang retry ni Mailgun kapag
--    pumalya ang una). Binubura ang mga lampas 2 araw (tignan
--    webhookTokenModel.js).
CREATE TABLE mailgun_webhook_tokens (
  token VARCHAR(100) NOT NULL PRIMARY KEY,
  used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mailgun_webhook_tokens_used_at (used_at)
);
