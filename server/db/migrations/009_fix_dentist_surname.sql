-- Ang apelyido ng dentist ay "Teodosio-Rufin" (iisang apelyido, may gitling,
-- gaya ng pangalan ng clinic). Naka-save dati bilang "Teodosio Rufin", kaya
-- "Dr. Rufin" ang lumalabas sa bati ng Dashboard (huling salita lang ang
-- nakukuha ng code). Eksaktong lumang pangalan lang ang tinatamaan: walang
-- epekto kung iba na ang pangalan o naayos na.
UPDATE users
SET full_name = 'Dr. Nolita Reloj Teodosio-Rufin'
WHERE role = 'dentist' AND full_name = 'Dr. Nolita Reloj Teodosio Rufin';
