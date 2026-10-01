# DentaVault — Session Log: Issues Found & Fixes Applied

This document summarizes every problem discovered and every fix applied during this
working session, in the order they came up. Grouped by feature area for reference.

---

## 1. Patient-Role Portal

### Bug: Redirect breaks after page refresh (`/patients/undefined`)
- **Symptom:** A logged-in patient who refreshed the page (or reopened the app) got
  redirected to `/patients/undefined` instead of their own profile.
- **Root cause:** `POST /auth/login` returned the user object in camelCase
  (`patientId`, `fullName`), but `GET /auth/me` (called on every app reload) returned
  raw snake_case (`patient_id`, `full_name`) straight from the DB. Anything reading
  `user.patientId` or `user.fullName` got `undefined` after a refresh.
- **Fix:** Aliased the SQL columns in `findUserById()` (`server/src/models/userModel.js`)
  to camelCase so both endpoints return the same shape.

### Feature: Patient-role portal built and verified
- Role-aware landing redirect (`HomeRedirect` in `client/src/App.jsx`) — dentist goes
  to the patient list, patient goes straight to their own record.
- `/patients` list route restricted to dentist-only.
- Verified: patient blocked from other patients' records, blocked from write actions,
  read-only UI (no edit/delete/upload buttons) for chart, treatments, X-rays.

### Feature: "Create Portal Account" UI (dentist-side)
- New button on the patient profile (dentist-only) that provisions a patient login
  account without needing the CLI script (`server/db/seedPatientUser.js`).
- New files: `server/src/controllers/patients.controller.js` (`createPortalAccount`,
  `getPortalAccount`), `client/src/components/patients/CreatePortalAccountModal.jsx`.
- Auto-generates a password, shows credentials once, guards against duplicate
  accounts/emails.

### Feature: "Reset Portal Password" (forgot-password flow for patients)
- Dentist-only action to set a new temporary password for an existing portal account.
- New files: `patients.controller.js` (`resetPortalAccountPassword`),
  `client/src/components/patients/ResetPortalPasswordModal.jsx`.
- Shared the password-generator utility (`client/src/utils/generatePassword.js`)
  between create and reset flows instead of duplicating it.

---

## 2. Printing

### Feature: 2D Chart printing
- New `client/src/pages/ChartPrintPage.jsx`, route `/patients/:id/chart/print`.
- **Bug found & fixed while building this:** the odontogram's mobile-friendly
  horizontal-scroll layout would silently truncate the upper-right/lower-right
  quadrants when printed (nothing past the print viewport's edge renders). Fixed
  with `print:` Tailwind overrides in `Odontogram2D.jsx` so the chart scales to fit
  the page width during printing instead of staying in scroll-container mode.

### Feature: Annotated X-ray printing
- New `client/src/pages/XrayPrintPage.jsx`, route `/patients/:patientId/xrays/:xrayId/print`.
- Extracted the annotation-drawing logic shared between the live editor
  (`XrayViewer.jsx`) and the print page into `client/src/components/xray/drawAnnotations.js`,
  so a saved annotation renders identically whether being edited or printed.
- "Print" entry points added to both the profile page (chart tab) and the X-ray
  viewer toolbar.

---

## 3. 2D Dental Chart — Bugs Found in User Testing & Fixes

### Bug: Notes not shown when reopening a chart entry
- **Symptom:** Notes typed when marking a tooth condition were saved to the
  database but never displayed again — the modal always showed a blank textarea.
- **Fix:** `ChartEntryModal.jsx` now pre-fills the notes textarea from the existing
  entry and shows the saved note in the "Currently..." summary card.

### Bug: "Un-extracting" a tooth left it in a broken visual state
- **Symptom:** Marking an extracted tooth back to "Healthy" removed the X icon but
  left the tooth rendered as a solid gray block instead of clean/white — because
  only the "whole tooth" entry was updated, not the 5 individual surface entries
  that extraction had originally set.
- **Root cause:** `createExtractionEntry()` wrote all 6 rows (whole + 5 surfaces) as
  `extracted`, but there was no equivalent "restore" path — any other condition
  chosen for the whole tooth only touched 1 row.
- **Fix:** Generalized `createExtractionEntry` → `createWholeToothEntry()`
  (`server/src/models/chartModel.js`) so **any** condition chosen at the whole-tooth
  level propagates to all 5 surfaces, not just `extracted`. This fixed the
  un-extraction bug and made whole-tooth edits consistent in general.

### Bug/UX issue: "Extracted" selectable on a single surface
- **Symptom:** A single surface (e.g. just the mesial side) could be marked
  "Extracted / Missing" independently, which doesn't make clinical sense — and
  conversely, picking non-extraction conditions (Crown, Caries, etc.) at the
  whole-tooth level created invisible, confusing entries.
- **Fix:** `ChartEntryModal.jsx` now restricts available conditions by context:
  - Whole-tooth entry point → only "Healthy" or "Extracted / Missing"
  - Individual surface entry point → all conditions except "Extracted / Missing"

### Feature: Full tooth history view
- **Gap found:** the backend already had a complete `getToothHistory` endpoint
  (full chronological log per tooth), but nothing in the UI ever called it — only
  the single latest entry was ever visible.
- **Fix:** Added a "View full history for tooth X" expandable section inside
  `ChartEntryModal.jsx`, showing every past entry (surface, condition, date,
  dentist, notes) for that tooth.

### Visual polish (all 4 areas requested)
- **Tooth design:** subtle drop-shadow filter, smoother hover feedback, rounded
  extraction icon, native hover tooltips per surface.
- **Legend/labels:** legend redesigned as a labeled card; added UPPER RIGHT / UPPER
  LEFT / LOWER RIGHT / LOWER LEFT arch labels so the chart is readable without
  knowing FDI tooth numbering.
- **Modal:** added a mini surface-indicator diagram, relative timestamps
  ("18m ago"), improved condition-button hover/selected states.
- **Feedback/interactivity:** brief highlight pulse on a tooth right after saving;
  shared fade/scale-in animation added to the common `Modal.jsx` component (benefits
  every modal in the app).

---

## 4. Mailgun Inbound X-ray Automation (new feature)

Implements the proposal's "patient emails an X-ray, it auto-attaches to their
record" flow, which was previously entirely unbuilt.

### New files
- `server/src/services/mailgunService.js` — verifies Mailgun's HMAC webhook
  signature (the only thing authenticating this endpoint, since Mailgun can't send
  a Bearer token) and extracts the sender's email.
- `server/src/config/mailgunUpload.js` — multer config for parsing email
  attachments.
- `server/src/controllers/webhooks.controller.js` — matches sender email to a
  patient, saves valid image/PDF attachments, logs to `audit_logs`.
- `server/src/routes/webhooks.routes.js` — `POST /api/webhooks/mailgun/inbound`.
- Added `findPatientByEmail()` (`patientModel.js`) and
  `findXrayByMailgunMessageId()` (`xrayModel.js`).

### Bug found while building: routing order blocked the webhook
- **Symptom:** every request to the new webhook route returned
  `401 Authentication required`, even though the route itself has no auth
  middleware.
- **Root cause:** `xrays.routes.js` and `chart.routes.js` mount `authenticate` with
  `router.use()` at their own root (no path prefix). Since they were registered in
  `routes/index.js` *before* the webhook route, **every** request passing through
  them hit that blanket auth check first — even ones that don't match any route
  inside those routers.
- **Fix:** Reordered `routes/index.js` so `webhooksRoutes` is registered before
  `xraysRoutes`/`chartRoutes`.

### Bug found while building: schema constraint on multi-attachment emails
- **Root cause:** `xray_images.mailgun_message_id` is `UNIQUE`, but Mailgun's
  Message-Id is per-*email*, not per-*attachment* — an email with 2+ X-ray
  attachments would crash on the second insert.
- **Fix:** Suffix the stored id per attachment position (`messageId#0`,
  `messageId#1`, ...) when an email has more than one attachment, while a retried
  delivery (same Message-Id, same attachment order) still reproduces the same
  suffixed id and is caught as a duplicate.

### Verified (via simulated signed requests, and later with the real signing key)
- Correct patient matching by sender email, correct rejection of bad signatures,
  idempotent on retry (no duplicate rows), no orphaned files on rejected/duplicate
  attachments.

### Local testing infrastructure
- Installed and configured **ngrok** to expose `localhost:5000` publicly
  (`https://jargon-crumb-abstract.ngrok-free.dev` at time of writing — this URL
  changes on every ngrok restart on the free tier).
- Real Mailgun sandbox domain + Route configured, real webhook signing key wired
  into `server/.env`.

### Known limitation — not fully resolved
- **Mailgun sandbox domains cannot receive real inbound email** (sending-only, to
  authorized recipients) — confirmed via a real bounce: `550 5.0.1 Recipient
  rejected`. Full live end-to-end testing with a real email requires a **paid,
  owned custom domain** with its own MX records pointed at Mailgun. This was set
  aside for later (cost/scope decision) — the code itself is complete and verified
  via signed simulated requests in the meantime.

---

## 5. Cloudinary Integration (new feature)

Replaces local-disk-only X-ray storage with Cloudinary, while keeping local disk as
an automatic fallback when Cloudinary isn't configured (per the original
`.env.example` design intent).

### New files
- `server/src/config/cloudinary.js` — SDK config + `isCloudinaryConfigured` flag.
- `server/src/services/xrayStorageService.js` — decides Cloudinary vs. local disk at
  upload time; generates short-lived (5 min) **signed** Cloudinary URLs for
  retrieval so X-rays stay access-controlled, never public.

### Design decision: kept X-rays access-controlled, not public
- Cloudinary's default delivery type is public — anyone with the URL could view a
  medical image with no login. Uploaded instead with `type: 'authenticated'` so the
  raw asset URL 401s without a valid signature; the existing auth+RBAC check on
  `GET /xrays/:id/file` is what gates generating that signature, preserving the
  "never a public static path" property the app already had for local-disk files.

### Refactor required
- `config/upload.js` and `config/mailgunUpload.js` switched from `diskStorage` to
  `memoryStorage`, since the storage backend is now chosen per-upload rather than
  fixed at the multer-config level.
- `xrays.controller.js` (`upload`, `getFile`) and `webhooks.controller.js` updated
  to go through `xrayStorageService`. This also **simplified** the webhook
  controller — with memory storage, rejected/duplicate/unmatched attachments never
  touch disk in the first place, removing the need for explicit cleanup code.
- No database migration needed: `file_url` distinguishes storage backend by prefix
  (`cloudinary:<public_id>` vs. a bare local filename), so existing rows keep
  working untouched.

### Verified (with the real Cloudinary account, not just simulated)
- New uploads (manual and Mailgun-inbound) correctly land on Cloudinary.
- Byte-perfect round trip confirmed with both a tiny (68-byte) and a real
  341,143-byte panoramic X-ray image.
- Signed URL correctly gates access; image renders correctly in the viewer
  including the fit-to-screen zoom behavior.

---

## 6. Security Bug: PWA Cache Could Leak Data Across Users

### Bug: intermittent unauthorized record access
- **Symptom (reported by user):** sometimes, after switching which patient ID was
  in the URL, a record that should be forbidden was briefly viewable — but not
  reproducible consistently, and correct ("You do not have permission") after
  logging out and back in.
- **Root cause:** the PWA's offline-support service worker (Workbox) caches
  `/api/*` GET responses (`NetworkFirst`) and X-ray image bytes (`CacheFirst`) —
  but the cache key was **the URL only**, with no regard for which user (or
  whether *any* authenticated user) made the request. If User A's browser had a
  cached 200 response for a given URL from an earlier session, and User B later
  requested the same URL while the network was slow/unavailable, Workbox's
  fallback-to-cache behavior could serve User A's cached data to User B — bypassing
  the backend's RBAC check entirely, since the request never reached the server.
- **Fix (`client/vite.config.js`):** added a `cacheKeyWillBeUsed` Workbox plugin to
  both runtime-caching rules that folds a hash of the request's `Authorization`
  header into the cache key. Different signed-in identities (or a logged-out
  visitor) now never share a cache entry, even for the same URL.
- **Fix (`client/src/context/AuthContext.jsx`):** `logout()` now also explicitly
  clears both Workbox-managed caches, as a second layer of defense (and general
  hygiene) on top of the per-identity key scoping — a shared clinic device won't
  carry a previous user's cached patient data forward at all.
- **Verification caveat:** this fix does **not** show up when testing under
  `npm run dev` — `vite-plugin-pwa`'s dev-mode service worker doesn't fully apply
  custom cache-key plugins (a dev-mode limitation, not a flaw in the fix). Verified
  correct by inspecting the compiled `dist/sw.js` after `npm run build`, and by
  testing live against `npm run preview`: dentist and patient sessions produced
  different cache-key hashes for the same endpoint, and cross-user access stayed
  correctly blocked.

---

## Still Outstanding (as of end of session)

- **3D charting** — deferred by design from the start of the project, not started.
- **Mailgun going fully live** — needs a purchased custom domain with its own MX
  records; code is complete and tested via simulation in the meantime.
