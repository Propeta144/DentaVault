-- Pansamantalang password na ginawa ng dentist (Create Portal Account /
-- Reset Password) ay alam din ng dentist — kaya dapat palitan ito ng
-- pasyente sa unang login bago siya makagamit ng app. 1 = kailangang
-- palitan; nililinis (0) pagkatapos ng /auth/change-password.
-- Walang epekto sa mga kasalukuyang account (default 0).
ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash;
