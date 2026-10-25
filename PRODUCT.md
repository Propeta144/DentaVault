# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dentist (primary):** Dr. Nolita Reloj Teodosio-Rufin of Teodosio-Rufin Dental Clinic (Molino IV, Bacoor, Cavite). She is the only person who uses the dentist account. She works on a desk laptop for records, the dashboard, legacy migration, and the audit log, and on a chairside tablet or phone while charting a patient in the chair.
- **Patients (secondary):** each one has a portal account that the clinic creates in person. On "My Record" they view their own treatment history, dental chart, and X-rays, and they can upload X-ray images (usually JPEG/PNG from another clinic). Most use a phone.

## Product Purpose

DentaVault is the clinic's digital patient record system. It replaces paper patient forms and charts with one secure record per patient: the full Patient Information Record, treatment history, a 2D and 3D odontogram, an intraoral exam, and X-rays. It brings in about 100 legacy paper records through bulk import (Excel/CSV) and guided manual entry. Success means the dentist can find a patient, see allergies and medical alerts, chart, and record a treatment quickly at chairside, and that every access to sensitive data is logged.

It is a BSIT capstone project (STI College Dasmariñas) for a real client. The team must be able to explain and defend every design and code decision.

## Positioning

It is built around this clinic's actual paper workflow: their Patient Information Record fields, their chart legend letter codes (D, M, F, J, RC, X, XO, ...), FDI numbering including baby teeth, and their procedure list. Treatment history and the chart stay in sync. It is not a generic multi-clinic practice-management SaaS.

## Operating Context

- One clinic and one dentist account. Patients book by text or phone call (appointments are not in the system).
- Chairside use: quick lookup (Ctrl+K), allergies and medical history visible before treatment, and touch charting on a tablet.
- Printed outputs (Summary, 2D and 3D Chart, X-ray) carry the clinic header and logo and must read well on a black-and-white printer.
- X-rays come from outside the clinic (the clinic has no X-ray equipment). Patients upload them in the portal, or the dentist uploads ones received over Messenger.
- Hosting: Vercel (client), Render free tier (server, slow cold start), Aiven MySQL. It is an installable PWA with offline page caching.

## Capabilities and Constraints

- Roles: `dentist` (everything) and `patient` (own record only). Access is enforced on the server.
- No patient ID in URLs or on screen (adviser requirement). Patient selection lives in history state.
- Audit log of sensitive actions, with tiered retention (the durations are still placeholders pending a legal answer).
- Security: strong password policy, forced change of temporary passwords, 15-minute idle sign-out, login rate limiting, and no email sending (no self-service password reset, by design).
- Stack is fixed: React 19 + Vite + Tailwind v4, Node/Express. No new UI or chart libraries; charts and the 2D odontogram are hand-built, and the 3D chart uses three.js.
- Condition and chart colors are color-blind validated and differ from the original proposal (Caries is magenta, not red). Don't change them without re-validating.
- Open: legal retention period for audit logs, ERD and paper updates.

## Brand Commitments

- Clinic name: Teodosio-Rufin Dental Clinic. The official logo and mark are in `client/src/assets/brand/`.
- The dentist's surname is "Teodosio-Rufin" (hyphenated), as in "Dr. Teodosio-Rufin".
- The clinic's brand color is purple. Existing UI conventions live in `.claude/skills/dentavault-ui/SKILL.md`.
- Copy: plain, short English in the UI. The team writes code comments and docs in Taglish. No em dashes anywhere.

## Evidence on Hand

- The clinic's real paper patient form, chart legend, and sign (client visit materials, Oct 13, 2026).
- The capstone paper `DENTAVAULT_CAPSTONE2` (outside the repo).
- The live site has 100 sample patients. Real patient data must never appear in design work, screenshots, or demos.
- No testimonials, metrics, or user studies exist. Don't fabricate any.

## Product Principles

1. **Patient safety first:** allergies and medical alerts are always visible before treatment, and missing data is shown as "Not recorded", never as "None".
2. **Privacy by default:** show the minimum identifying data, log sensitive access, and keep protection on the server.
3. **Match the clinic's paper:** use their codes, fields, and terms so the dentist doesn't have to learn a new vocabulary.
4. **Fast at chairside:** few taps, large targets, and no data loss (discard guards).
5. **Defensible:** every choice can be explained to the adviser and the panel.

## Accessibility & Inclusion

- Target: **WCAG 2.2 AA**.
- 44px touch targets, labels linked to inputs, color-blind safe chart colors that always come with text or letter labels, and no horizontal overflow from 320px to 1920px.
