# DentaVault

**DentaVault: A Web-Based Dental Records and Interactive Tooth Charting for
Teodosio-Rufin Dental Clinic** — a capstone project proposal presented to the
Information and Communications Technology Program, STI College Dasmariñas, in
partial fulfillment of the requirements for the degree of Bachelor of Science in
Information Technology (proposal dated May 17, 2026).

Proponents: Rhon Benedict T. Baylon, Carlo L. Firmanes, Jose Pepe F. Cañete.
Adviser: Mr. Lester Suanson.

## Tech stack

- **Frontend**: React (Vite), Tailwind CSS v4, React Router, Lucide icons, `vite-plugin-pwa`
- **Backend**: Node.js + Express (ESM), mysql2 (parameterized queries, named placeholders)
- **Database**: MySQL/MariaDB via XAMPP (`dentavault` database, `localhost:3306`, user `root`, no password)
- **Auth**: JWT + bcryptjs, RBAC (`dentist` / `patient` roles)
- **File storage**: Cloudinary for X-rays, fully wired up (`server/src/config/cloudinary.js`,
  `xrayStorageService.js`) — falls back to local disk (`server/uploads/xrays/`) only when
  Cloudinary env vars aren't configured. Real Cloudinary credentials are set in `.env`, so
  new uploads go to Cloudinary; the sample PNGs still in `uploads/xrays/` predate that setup.

## Running it

Three things need to be up:

```bash
# 1. MySQL — start via XAMPP Control Panel (Apache + MySQL)

# 2. Backend
cd server && npm run dev      # http://localhost:5000

# 3. Frontend
cd client && npm run dev      # http://localhost:5173
```

Test login (seeded dentist account):
- Email: `dentist@dentavault.local`
- Password: `DentaVault123!`

No patient-role account has been seeded yet — RBAC logic supports it (see
`middleware/rbac.js`) but it's never been tested end-to-end as a logged-in patient.

### If a port refuses connections / login fails for no obvious reason

This has happened repeatedly: old `node`/`npm run dev` processes from a previous
session are still running and squatting on port 5000 or 5173 with stale code,
while a *new* one you just started can't bind and silently fails. Check and clear
before assuming the code is broken:

```bash
# See what's actually listening
netstat -ano | findstr :5000
netstat -ano | findstr :5173

# Kill everything node-related if in doubt, then restart both dev servers
taskkill /F /IM node.exe
```

### DB migrations

`server/db/migrate.js` tracks applied migrations in a `schema_migrations` table —
safe to re-run (`npm run migrate` from `server/`), it skips what's already applied.
Current migrations: `001_init`, `002_add_emergency_contact`, `003_add_chart_entries`,
`004_add_patient_soft_delete`.

## What's built (verified working)

- **Patient records**: register, search/list, edit (modal), soft-delete (type-name-to-confirm),
  printable summary. Contact number is mandatory, PH mobile format only
  (`09XXXXXXXXX` / `+639XXXXXXXXX`), enforced client- and server-side.
- **Treatment history**: dropdown of standard procedures; whole-mouth procedures
  (cleaning, fluoride) auto-lock the tooth selector to "All Teeth."
- **2D Odontogram** (`components/chart/`): FDI-numbered, 5 clickable surfaces per tooth
  (mesial/distal/occlusal/facial/lingual — orientation is quadrant-aware, not a fixed
  screen position), color-coded conditions, full chronological history per tooth/surface
  (append-only `chart_entries` table, current state = latest row per tooth+surface).
  Marking a tooth "Extracted" transactionally fills in all 5 surfaces too.
- **3D Odontogram** (`components/chart/Odontogram3D.jsx`, `Tooth3D.jsx`) — contrary to
  earlier notes, this IS built: React Three Fiber, teeth arranged on a curved horseshoe
  arch (both rows), freehand drawing directly on a tooth's own curved surface (a
  slightly-offset ink layer painted through the mesh's real UVs) that classifies the
  stroke into one of the 5 surfaces and opens the same entry modal the 2D chart uses —
  reads/writes the same `/chart` API, so both views always agree. Lazy-loaded
  (`React.lazy()` in `PatientProfilePage`) per the proposal's requirement to lazy-load
  resource-intensive modules, so Three.js/R3F/drei only download when a dentist
  actually opens the 3D tab. **8 distinct crown shapes**, one per FDI tooth *position*
  (`assets/models/teeth.glb`, produced by `scripts/extract-tooth-set.cjs`) — not a
  single shape stamped at all 32 positions like the original version; picked from a
  30-mesh "Teeth by Poly by Google" (CC-BY) source asset by sorting each candidate's
  PCA-realigned mesiodistal/faciolingual ratio and spreading across it (no anatomical
  labels in the source to classify against directly — see the script's own comments
  for the full reasoning and caveats). **Saved marks keep their real drawn shape**
  (`chart_entries.stroke_data`, JSON array of UV-space strokes, same "store as
  fractions not pixels" pattern as X-ray annotations — see below) instead of
  collapsing into a flat colored plane once saved; a `HistoryInkLayer` in
  `Tooth3D.jsx` redraws them on load. Entries without stroke data (2D-originated
  saves, whole-tooth saves, anything recorded before this column existed) still
  fall back to the flat-plane indicator.
- **X-ray management**: manual upload (dentist-only) plus **Mailgun inbound-email
  automation** (`webhooks.routes.js`, `webhooks.controller.js`, `mailgunService.js`
  with signature verification, mounted ahead of other routers in `routes/index.js`) —
  contrary to earlier notes, this IS built and wired up; `.env` has a real
  `MAILGUN_WEBHOOK_SIGNING_KEY`. Stored to Cloudinary (see File storage above),
  authenticated file serving (never a public static path — these are medical images),
  zoom, freehand + text annotation on a canvas overlay (coordinates stored as
  **fractions** of image size, not pixels, so they stay aligned at any zoom level),
  side-by-side comparison.
- **Legacy data import**: CSV/JSON only (not Excel — the standard `xlsx` npm package
  has an unpatched high-severity vuln; this endpoint parses untrusted uploaded files,
  so it was dropped rather than accepted). Duplicate detection by name+DOB, per-row
  validation report, downloadable CSV template. **Long-format sheet**: a patient can
  span multiple rows (same first/last name + DOB), one row per past visit, so a full
  treatment history rides in through the same file — the first occurrence creates the
  patient, later matching rows attach a treatment instead of being skipped as
  duplicates. `procedure_name` is validated against the same standard-procedure list
  the dentist's dropdown uses (`patientImportService.js`'s `STANDARD_PROCEDURES`,
  kept in sync with `client/src/constants/dental.js`'s `PROCEDURES` by hand — no
  shared package between client/server), and whole-mouth procedures force
  `tooth_number` to `"ALL"` regardless of what's in that column, matching
  `AddTreatmentForm.jsx`'s own behavior.
- **PWA**: installable, offline-capable. NetworkFirst caching for `/api/*` data,
  CacheFirst for X-ray images (route order matters in `vite.config.js` — the specific
  X-ray rule must come before the general `/api/` rule or it gets shadowed).
- **RBAC + audit log**: every sensitive read/write is logged to `audit_logs`
  (who, what, when, on which record) — this is a Data Privacy Act (RA 10173)
  requirement from the proposal, not incidental.
- **Responsive/mobile**: off-canvas sidebar drawer, card-based patient list below
  `md`, and — notably — the odontogram deliberately does NOT shrink-to-fit on phones;
  it renders at a fixed legible pixel width and scrolls horizontally, because shrinking
  a 16-tooth row into ~350px would make individual tooth surfaces impossible to tap.
- **Branding**: purple palette (`#6F2DBD` / `#A663CC` / `#171123` / `#FBFBFB`) matching
  the clinic's actual tarpaulin signage, not an arbitrary design choice — set once in
  `client/src/index.css`'s `@theme` block by redefining Tailwind's built-in `sky`
  (accent) and `slate` (neutrals) scales, so it applies app-wide without touching the
  ~36 files that use those class names. Brand mark is `ToothIcon.jsx` (sparkle + tooth
  + "R" for Rufin, `fill="currentColor"`, used only in the sidebar header and login
  page) — same mark is baked into `favicon.svg` and the PWA icons
  (`icon-192.png`/`icon-512.png`/`icon-512-maskable.png`, purple bg + white mark).

## What's pending / not started

- **Printing** the 2D/3D chart and annotated X-rays (patient info/treatment
  summary printing IS done; those two specifically are not).
- **Patient-role portal**, verified end-to-end — the backend RBAC supports it,
  but no patient account has ever actually been created and clicked through.

(Mailgun inbound automation, Cloudinary storage, and 3D charting were previously listed
here as pending — corrected above under "What's built": all three are actually wired
up/built already.)

## A few load-bearing design decisions (don't undo without a reason)

- **Soft delete, not hard delete**, for patients (`deleted_at` column). Medical/dental
  records need retention for liability/continuity-of-care reasons even after a
  deletion request — deleting a patient hides them from the app but the row,
  treatments, chart, and X-ray metadata all survive.
- **`chart_entries` is append-only**, same pattern as `audit_logs`. "Current state"
  is always derived (latest row per tooth+surface via `ROW_NUMBER() OVER (...)`),
  never a separately-maintained "current" table that could drift out of sync.
- **X-ray annotation coordinates are stored as fractions (0..1) of image size**,
  not pixels. This was a real bug fix — pixel coordinates drifted when the container
  layout changed at different zoom levels; fractions are zoom-invariant by construction.
- **`mysql2` returns JSON columns as raw strings, not parsed values.** Every model
  function reading `xray_images.annotations` (or `chart_entries.stroke_data`) must
  `JSON.parse()` it — forgetting this caused a real, nasty bug where a raw JSON string
  got truthy-checked as an array and later spread (`[...string]`), silently corrupting
  it into an array of characters.
- **In `Tooth3D.jsx`, any mesh layered over the paintable crown surface needs
  `raycast={() => null}`** — the base crown mesh already had this, but the per-surface
  condition-indicator planes didn't, and being visually "just a colored box with no
  click handler" doesn't stop it from being hit first by the raycaster: it silently
  blocked the pen from ever reaching the ink layer underneath on any tooth that
  already had a saved mark. Same rule applies to `HistoryInkLayer`.
- **`scripts/extract-tooth-set.cjs` bakes its own UV atlas — it does NOT keep the
  source model's original UVs.** The "Teeth by Poly by Google" source unwraps facial
  and lingual (and possibly other pairs) onto the *same* texture region, presumably to
  save texture space on a roughly symmetric shape — verified by rendering a checker
  texture and viewing both sides. Left as-is, a mark drawn on one side of a tooth
  silently also painted the opposite side. The script now computes fresh, non-
  overlapping UVs itself (5 atlas cells: facial/lingual/posX/negX/occlusal, same
  region classification `classifySurface` already uses) from each vertex's PCA-aligned
  position, ignoring the source TEXCOORD_0 entirely. If `teeth.glb` is ever
  regenerated from a *different* source asset, don't assume its UVs are safe to
  reuse — check for exactly this kind of overlap first (render a UV-checker texture
  and view opposite faces side by side).
- **`node --watch` is scoped to `--watch-path=src --watch-path=server.js --watch-path=.env`**,
  not the whole project directory. Watching everything caused a restart loop every time
  a file got written to `uploads/xrays/` (i.e., every X-ray upload killed its own request
  mid-flight).

## Project context

Teodosio-Rufin Dental Clinic (Bacoor City, Cavite) is a small, family-operated clinic
currently run on paper-based records: patient folders organized by surname, X-rays
viewed temporarily on a laptop with no centralized storage. The clinic was purchased
from a previous owner, so a portion of the legacy paper records are disorganized.
Per the proponents' direct observation and interview with the clinic owner/dentist,
walk-in record retrieval takes roughly 10–15 minutes, handwritten entries are
frequently illegible, and there is no backup system.

Resource person: **Dr. Nolita Reloj Teodosio Rufin**, owner and dentist. The clinic
runs on two people — the dentist and one assistant; the assistant does not use the
system, as record management is handled solely by the dentist. Per her interview,
the most pressing pain point to solve first is X-ray handling: images currently pass
through a laptop and get forwarded straight to the patient's phone via chat, with no
copy retained at the clinic for future comparison.

## Purpose

A centralized, free, web-based platform (PWA) to replace the clinic's paper records
and ad hoc X-ray handling: patient registration and treatment history, an interactive
dental chart, and structured X-ray storage/review — scoped deliberately small
(no billing, no scheduling, no multi-branch support) to fit a single-dentist practice,
in contrast to commercial systems (Dentrix, Curve Dental, CareStack, etc.) built for
large practices and priced accordingly.

## Objectives

1. **Centralized Digital Patient Records Management** — registration, storage,
   updating, and quick retrieval of patient profiles and treatment histories.
2. **2D and 3D Interactive Dental Charting** — a flat 2D tooth diagram for quick
   reference plus a rotatable 3D model for surface-level documentation, with color
   coding, tooth deletion (extraction), and procedure marking.
3. **Radiographic Imaging and X-ray Management** — receiving, storing, viewing,
   and annotating X-rays submitted by patients from external diagnostic facilities
   (the clinic has no X-ray sensor of its own), including automated inbound-email
   intake via Mailgun.

## Scope — functional modules

**I. Digital Patient Records Management** — Dentist: register patients, manage
treatment histories, migrate legacy paper records, search/retrieve, generate
printable treatment summaries, print. Patient: view own profile/history, download
or request printed summaries.

**II. 2D and 3D Interactive Dental Charting** — Dentist: 2D charting with color
coding (red=caries, gray=missing, yellow=filling, etc.) and tooth deletion for
extractions; 3D charting to mark procedures on specific surfaces (mesial, distal,
buccal, lingual) via a rotatable/zoomable model; chronological per-tooth treatment
records; print chart. Patient: read-only chart viewing (2D and 3D).

**III. Radiographic Imaging and X-ray Management** — Dentist: receive/store X-rays
submitted by patients (Mailgun inbound routing + webhook automatically extracts
email attachments), view, zoom, annotate (drawing + text), side-by-side comparison,
print. Patient: submit X-rays by emailing the clinic's designated address; the system
auto-extracts and links the attachment to their record.

Role-based access control underlies all three modules: **Dentist** has full CRUD
access; **Patient** is read-only on their own records plus X-ray submission.
Data Privacy Act (RA 10173) compliance — role-based access, hashed passwords,
encrypted transport, audit logging — is treated as a requirement, not a nice-to-have.

## Limitations (as scoped in the proposal)

- Built specifically for a small single-dentist clinic; not a full transition away
  from all paper records, and would need customization for larger/multi-branch use.
- Charting is standard-procedure documentation only (fillings, extractions,
  cleanings) — no clinical decision support, no automated diagnosis, no third-party
  PMS integration.
- No in-house X-ray capture: images are sourced externally and submitted digitally
  by the patient, so image quality/completeness/timeliness depends on the external
  facility and the patient's compliance.
- PWA offline support covers cached static assets/previously loaded data only;
  authentication and full record sync still require connectivity.

## Related-systems gap analysis (why this project, not an existing tool)

Reviewed systems fall into three groups — full practice-management suites (Dentrix,
Curve Dental, CareStack, DentalPro PH, PIMSPlus), record/charting-focused tools
(Open Dental, My Dental Clinic, myDMD, SeriousMD, Klinikly), and web/imaging-centered
platforms (DentalLink, DentalPro Cloud, MedImages, DentSoft, Driefcase). None
combines: free web-based PWA access, 3D interactive charting, X-ray management
purpose-built for externally-sourced images, a patient-facing portal, and RA 10173
compliance (RBAC + encryption + audit logging) in one system sized for a small
Philippine clinic — that combination is the proposal's stated gap to fill.

## Technical background (as proposed)

- **Frontend**: React.js (component-based architecture for patient records, X-ray
  handling, and the charting modules)
- **3D charting**: Three.js — rotatable/zoomable tooth model for surface-level
  marking; **2D charting**: HTML5 Canvas or a lightweight charting library
- **Backend**: Node.js + Express.js
- **Database**: MySQL — patients, treatments, dental chart entries, X-ray image
  references, user accounts, audit logs, structured relationally
- **Media storage**: Cloudinary — offloads X-ray image storage/optimization/delivery
- **Inbound email**: Mailgun — inbound routing + webhook to auto-receive X-ray
  attachments, upload to Cloudinary, and link to the patient record
- **Architecture**: Progressive Web Application — browser-based, installable to a
  device home screen, no native app store distribution
- **Auth**: JSON Web Tokens (JWT)
- **Tooling**: Visual Studio Code, Figma (UI/UX + wireframes), GitHub (version
  control), Chrome/Edge (testing)

## Methodology

**Modified Waterfall**: Requirements Gathering → System Design → Implementation →
Testing → Deployment, with limited controlled backward iteration allowed between
adjacent phases (unlike strict Waterfall). Chosen because the clinic's scope was
clearly defined up front via direct observation and structured interview with the
dentist. Testing includes unit, integration, and user acceptance testing (UAT) with
the dentist; deployment targets a cloud-based environment plus a dentist training
session. Development/implementation timeline: academic year 2026–2027.

## Theoretical grounding cited

Information Processing Theory, Theory of Database Normalization, UX Design Theory,
Cognitive Load Theory, Design Theory, Color Theory — applied respectively to how
clinical data is presented, how the MySQL schema is structured, interface
simplicity/minimal training, avoiding information overload, visual hierarchy, and a
calm professional color scheme for a clinical setting.
