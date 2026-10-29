-- Isang session lang bawat account (CLAUDE.md #39).
--
-- Bawat pag-login ay tinataasan na rin ang token_version, kaya nalo-log out
-- ang naunang device. Itinatala rito KUNG BAKIT huling tinaasan ang
-- token_version, para masabi sa na-log out na device ang tamang dahilan:
--   signed_in_elsewhere | signed_out | password_changed | account_closed
-- NULL = wala pang naitalang dahilan (luma / bago pa ang migration na 'to).
ALTER TABLE users
  ADD COLUMN session_end_reason VARCHAR(32) NULL AFTER token_version;
