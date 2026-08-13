# DentaVault — Buong Folder Structure at Paliwanag ng Bawat File

Ito yung kumpletong listahan ng lahat ng files na nasa loob ng `Denta Vault` project
folder (hindi kasama ang `node_modules/`, `dist/`, `dev-dist/`, at `.git/` — mga
auto-generated na folder na hindi mo kailangang basahin, downloaded/build outputs lang
'yun). Bawat file dito ay may **Name**, **Type**, at **Purpose** — bakit siya
nandiyan at ano ginagawa niya.

## Ano ang buong "Denta Vault" folder

Ito ang **root** ng buong DentaVault project. Sa loob nito, dalawang magkahiwalay na
sub-project: **`client/`** (yung React frontend — ang UI na nakikita ng dentist/patient
sa browser) at **`server/`** (yung Node.js/Express backend — ang API na nagha-handle ng
database, authentication, file storage). Magkahiwalay sila dahil:

- May sarili silang `package.json` at dependencies — hindi pareho ang mga npm packages
  na kailangan ng frontend (React, Vite) at ng backend (Express, MySQL driver).
- Tumatakbo sila bilang **hiwalay na dev servers** (`client` sa port 5173, `server` sa
  port 5000) habang nagde-develop — kaya kailangan silang i-`cd` papunta at patakbuhin
  nang magkahiwalay (`npm run dev` sa bawat isa).
- Sa production, pwede silang i-deploy nang hiwalay (halimbawa, static hosting para sa
  client, at separate server para sa API) o pwede ring pagsamahin — pero sa development,
  ang split na ito ang nagpapahintulot sa Vite dev server (client) na mag-proxy ng
  `/api/*` requests papunta sa Express server (backend) nang hindi nagkakagulo yung code.

---

## Root-level files

| Name | Type | Purpose |
|---|---|---|
| `.gitignore` | Git ignore config | Sinasabi kay Git kung anong files/folders ang huwag i-track: `node_modules/`, `dist/`, `build/`, `.env` (pero hindi `.env.example`), log files, at `uploads/xrays/*` (maliban sa `.gitkeep`). Ibig sabihin, hindi pupunta sa Git repository ang totoong secrets at uploaded X-ray images — tama lang, dahil secrets 'yun at medical images na hindi dapat naka-publish. |
| `notes.md` | Markdown (dating `CLAUDE.md`) | Buod ng academic capstone proposal — project context, objectives, scope ng tatlong modules, limitations, gap analysis laban sa existing systems, at proposed tech stack. Pinalitan ang pangalan mula `CLAUDE.md` papuntang `notes.md`, kaya hindi na ito awtomatikong nababasa bilang project instructions sa simula ng bagong session. |

---

## `client/` — React Frontend

### Root config files ng client

| Name | Type | Purpose |
|---|---|---|
| `.gitignore` | Git ignore config | Karaniwang Vite/React ignore list — `node_modules`, `dist`, `dev-dist` (PWA service worker build output), editor folders (`.vscode`, `.idea`). |
| `.oxlintrc.json` | Linter config | Configuration para sa `oxlint` (mabilis na Rust-based linter, ginagamit imbes na ESLint). Naka-enable ang `react/rules-of-hooks` (mahalagang React rule, nagre-report ng error kung mali ang paggamit ng hooks) at `react/only-export-components` (warning lang). |
| `index.html` | HTML entry point | Ang literal na HTML shell na ilo-load ng browser — may `<div id="root">` kung saan mag-mo-mount ang buong React app, PWA meta tags (theme color, apple-touch-icon), at Google Fonts (Inter) preconnect. Dito rin naka-link ang `main.jsx` bilang `<script type="module">`. |
| `package.json` | npm manifest | Listahan ng dependencies (React 19, React Router 7, Axios, date-fns, lucide-react para sa icons) at devDependencies (Vite 8, Tailwind CSS v4, oxlint, vite-plugin-pwa). May mga script din: `dev`, `build`, `lint`, `preview`. |
| `package-lock.json` | npm lockfile | Auto-generated, nagla-lock ng exact versions ng lahat ng dependencies (kasama transitive) para consistent ang install sa bawat makina. Hindi dapat i-edit manually. |
| `README.md` | Markdown | Default README na galing sa Vite React template — pangkalahatang paliwanag tungkol sa Vite + React setup, hindi project-specific. |
| `vite.config.js` | Vite build config | Ito yung "utak" ng dev server at build process. Dito naka-configure ang React plugin, Tailwind plugin, at ang **PWA plugin** (`vite-plugin-pwa`) — kasama ang caching strategy: **CacheFirst** para sa X-ray images (dahil malaki sila at hindi nagbabago), **NetworkFirst** para sa `/api/*` JSON data (dahil kailangang updated kapag online, pero may fallback offline). May proxy config din papunta sa `http://localhost:5000` para sa `/api` requests habang nagde-develop. |

### `client/public/` — Static assets

| Name | Type | Purpose |
|---|---|---|
| `favicon.svg` | SVG image | Ang icon na lumalabas sa browser tab. |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | PNG images | Iba't-ibang laki ng app icon na ginagamit kapag "in-install" ang PWA sa home screen ng phone/tablet — kasama ang "maskable" version na sumusunod sa Android's adaptive icon shape. |

### `client/src/` — App root files

| Name | Type | Purpose |
|---|---|---|
| `App.jsx` | React component | Ang **routing map** ng buong app — gumagamit ng React Router. Dito naka-define lahat ng pages/paths (`/login`, `/patients`, `/patients/:id`, print pages, etc.), at nag-e-enforce ng role-based redirect (kung `patient` ang naka-login, diretso sila sa sarili nilang record imbes sa buong patient list). |
| `main.jsx` | React entry script | Ang literal na "unang tumatakbo" na code — nagre-render ng `<App />` sa `#root` div, at tinatawag ang `initPWA()` para irehistro ang service worker. |
| `pwa.js` | JS module | Nagha-handle ng PWA update notification — kapag may bagong version ng app na naka-deploy, may lumalabas na small banner (hindi automatic reload) para hindi ma-disrupt ang dentist na kasalukuyang nagta-type ng treatment note. |
| `index.css` | CSS (Tailwind entry) | Pinag-iimport ang Tailwind CSS, at dito naka-define ang custom font (`Inter`) at ang color palette notes (Deep Navy, Slate, Soft Teal — mapped diretso sa Tailwind's built-in `slate`/`sky` scales). May animation din (`modal-in`) para sa modal pop-ups. |

### `client/src/components/chart/` — 2D Odontogram (dental chart)

| Name | Type | Purpose |
|---|---|---|
| `Odontogram2D.jsx` | React component | Ang **buong 2D dental chart** — nagre-render ng SVG na naglalagay ng 32 ngipin (FDI notation) sa dalawang hanay (upper/lower arch), may arch labels (UPPER RIGHT/LEFT, LOWER RIGHT/LEFT) para sa oryentasyon, at legend ng colors. Deliberate na hindi ito shrink-to-fit sa maliit na screen — mag-scroll horizontally imbes, para hindi masyadong maliit ang bawat clickable surface. Ito lang ang tanging module na nagre-render ng chart — kapag ginawa na ang 3D module balang araw, ibang component na 'yun na magbabasa ng parehong `/chart` API. |
| `Tooth.jsx` | React component | Ang **isang individual na ngipin** sa loob ng chart — SVG na may 5 clickable regions (mesial, distal, occlusal, facial, lingual) gamit ang "envelope" diagram style. May espesyal na rendering kapag "extracted" (X mark imbes ng 5 hiwalay na region). Ang mapping kung anong screen position ang alin sa mesial/distal/facial/lingual ay depende sa quadrant ng ngipin (galing sa `constants/dental.js`). |
| `ChartEntryModal.jsx` | React component (modal) | Lumalabas kapag nag-click ng surface o buong tooth — dito pipiliin ng dentist ang condition (healthy, caries, filling, root canal, crown, extracted), magdagdag ng notes, at makikita ang full chronological history ng ngiping 'yun (view history button). May safety warning kapag whole-tooth entry (extraction/restoration) dahil ito ay mag-o-overwrite ng lahat ng 5 surfaces. |

### `client/src/components/common/` — Shared UI pieces

| Name | Type | Purpose |
|---|---|---|
| `Modal.jsx` | React component | Generic reusable modal wrapper (backdrop, close button, ESC key to close, animation) — ginagamit ng halos lahat ng ibang modals sa app (Edit Patient, Delete Patient, Create Portal Account, atbp). |
| `ProtectedRoute.jsx` | React component | Route guard — kung walang naka-login, redirect sa `/login`; kung may `allowedRoles` restriction (halimbawa `['dentist']` lang) pero hindi tugma ang role ng current user, redirect sa home. Ginagamit sa `App.jsx` para i-protect ang mga pages. |
| `StatusBadge.jsx` | React component | Maliit na "pill" label (may kulay depende sa variant: slate/sky/emerald/amber) na ginagamit para markahan ang status ng bagay-bagay — halimbawa "Active" o "Migrated Record" sa patient list, "Email" o "Manual" sa X-ray gallery. |

### `client/src/components/patients/` — Patient records UI

| Name | Type | Purpose |
|---|---|---|
| `AddTreatmentForm.jsx` | React component | Form para magdagdag ng bagong treatment entry sa isang patient — dropdown ng standard procedures, tooth selector (naka-lock sa "All Teeth" kapag whole-mouth procedure gaya ng cleaning/fluoride), date, notes. |
| `CreatePortalAccountModal.jsx` | React component (modal) | Ginagamit ng dentist para gumawa ng login account para sa isang patient (para makapag-access sila ng sarili nilang records). May auto-generate password button, at ipinapakita ang credentials **isang beses lang** pagkatapos gawin (para i-share sa patient). |
| `DeletePatientModal.jsx` | React component (modal) | Soft-delete confirmation — kailangang i-type ng dentist ang buong pangalan ng patient bago ma-enable ang Delete button (safety measure laban sa aksidenteng pagbura). Malinaw na sinasabi na hindi totoong nabubura ang record — natatago lang ito sa app, pero nananatili ang treatment history/chart/X-rays para sa records-keeping. |
| `EditPatientModal.jsx` | React component (modal) | Wrapper ng `PatientForm` para sa pag-edit ng existing patient — nagko-convert muna ng database fields (snake_case) papuntang form fields (camelCase). |
| `ImportPatientsModal.jsx` | React component (modal) | Bulk import ng legacy patient records mula sa CSV o JSON file — may download template button, at ipinapakita ang result summary (ilan ang na-add, ilan ang duplicate, ilan ang may error, kasama ang detalye ng bawat isa). |
| `PatientForm.jsx` | React component | Ang shared form (ginagamit parehong sa Register at Edit) — personal info, contact details, emergency contact, medical history/allergies. May client-side validation (required fields, PH mobile number format `09XXXXXXXXX`), pero ang totoong hindi mapapalampas na validation ay nasa server side. |
| `ResetPortalPasswordModal.jsx` | React component (modal) | Para sa dentist na mag-reset ng password ng isang patient portal account (halimbawa nakalimutan ng pasyente) — gumagawa ng bagong random password, ipinapakita isang beses lang. |

### `client/src/components/xray/` — X-ray management UI

| Name | Type | Purpose |
|---|---|---|
| `CompareView.jsx` | React component | Full-screen side-by-side comparison ng dalawang X-ray images — ginagamit kapag pumili ang dentist ng 2 images sa gallery para ikumpara ang progress ng treatment. |
| `drawAnnotations.js` | JS utility (walang React) | Shared drawing function na ginagamit parehong ng `XrayViewer` (live editing) at `XrayPrintPage` (static print output) — ginuguhit ang mga naka-save na annotations (lines/text) sa isang canvas, base sa **fraction coordinates** (0 hanggang 1, hindi pixels) para consistent ang display kahit anong laki ng image. |
| `PatientXraysSection.jsx` | React component | Ang "container" na nag-o-organisa ng buong X-ray tab sa patient profile — nagpapakita ng gallery, upload form (dentist lang), at nagha-handle ng viewer/compare modals. |
| `UploadXrayForm.jsx` | React component | Form para mag-upload ng bagong X-ray file — accepts JPEG/PNG/WebP/PDF, may optional na "date taken" at notes field. |
| `XrayGallery.jsx` | React component | Grid ng thumbnails ng lahat ng X-rays ng isang patient — may checkbox para pumili ng hanggang 2 para sa comparison, at badge na nagpapakita kung "Manual" (in-person upload) o "Email" (galing sa inbound email) ang pinanggalingan. |
| `XrayThumbnail.jsx` | React component | Nagre-render ng maliit na preview image (o "PDF" placeholder kung PDF file) — kinukuha ang image bilang authenticated blob (hindi plain `<img src>`, dahil kailangan ng Bearer token ang file endpoint). |
| `XrayViewer.jsx` | React component (full-screen modal) | Ang buong image viewer/annotator — may zoom in/out, pen tool (freehand drawing), text tool, undo, save. Ang lahat ng annotation coordinates ay naka-store bilang **fractions ng image size**, hindi pixels — ito ang tunay na bug fix noon (drifting coordinates sa iba't-ibang zoom level), ipinaliwanag nang detalyado sa comments ng file mismo. |

### `client/src/constants/`

| Name | Type | Purpose |
|---|---|---|
| `dental.js` | JS constants module | "Single source of truth" para sa lahat ng dental-related na data: listahan ng standard procedures (kasama kung alin ang whole-mouth), FDI tooth numbering (11-48), layout ng 2D odontogram rows, listahan ng surfaces (mesial/distal/occlusal/facial/lingual/whole), listahan ng conditions kasama ang kani-kanilang kulay, at ang function na nagde-determine kung anong screen position (top/bottom/left/right) ang tumutugma sa anong anatomical surface base sa quadrant ng ngipin. |

### `client/src/context/` — Global React state

| Name | Type | Purpose |
|---|---|---|
| `AuthContext.jsx` | React context | Nagha-handle ng buong login/logout state ng app — nag-che-check ng existing token sa `localStorage` pag-load, nag-p-provide ng `login()`/`logout()` functions. Nililinis din ang cached data sa service worker kapag nag-logout (para hindi ma-access ng susunod na gumagamit ng device ang cached records ng nauna). |
| `ToastContext.jsx` | React context | Global toast notification system — `showToast(message, {type})` na pwedeng tawagin kahit saan sa app, may auto-dismiss (4 seconds) at manual dismiss button. |

### `client/src/layouts/`

| Name | Type | Purpose |
|---|---|---|
| `AppLayout.jsx` | React component | Ang overall page shell — sidebar navigation (desktop) na naging off-canvas drawer (mobile, may hamburger menu), user info + sign out button, at `<Outlet />` kung saan lumalabas ang actual page content. |

### `client/src/pages/` — Full page components

| Name | Type | Purpose |
|---|---|---|
| `ChartPrintPage.jsx` | React page | Print-friendly standalone view ng dental chart (walang sidebar) — para ma-print ng dentist ang 2D chart. |
| `LoginPage.jsx` | React page | Ang login form — email + password, may error message display. |
| `PatientProfilePage.jsx` | React page | Ang **pinakamalaking page** — buong profile ng isang patient: personal info, tabs para sa Treatment History / Dental Chart / X-rays, at lahat ng action buttons (Edit, Delete, Create/Reset Portal Account, Print Summary). |
| `PatientRegisterPage.jsx` | React page | Page para sa pag-register ng bagong patient (dentist lang). |
| `PatientsListPage.jsx` | React page | Ang main list/search page ng lahat ng patients — may search bar (debounced, hindi humihingi ng request sa bawat keystroke), responsive na card view (mobile) o table view (desktop), Import at Register buttons. |
| `PatientSummaryPrintPage.jsx` | React page | Print-friendly standalone treatment summary (patient info + buong treatment history sa isang table). |
| `XrayPrintPage.jsx` | React page | Print-friendly standalone view ng isang X-ray image kasama ang mga annotation na nakadikit dito. |

### `client/src/services/` — API call wrappers

| Name | Type | Purpose |
|---|---|---|
| `api.js` | Axios instance | Ang shared HTTP client — naka-configure na ang `baseURL: '/api'` (proxied papunta sa backend), at automatic na nagdadagdag ng `Authorization: Bearer <token>` header sa bawat request kung may naka-login. |
| `chart.js` | API wrapper functions | `getCurrentChart`, `getToothHistory`, `createChartEntry` — mga function na tumatawag sa `/patients/:id/chart` endpoints. |
| `patientImport.js` | API wrapper functions | `importPatientsFile` (nagpapadala ng CSV/JSON file bilang multipart form) at `downloadImportTemplate` (kinukuha ang template bilang blob dahil kailangan ng auth token, hindi pwedeng plain `<a href>`). |
| `patients.js` | API wrapper functions | Lahat ng CRUD calls para sa patients: list, get, create, update, delete, treatments, summary, portal account management. |
| `xrays.js` | API wrapper functions | `listXrays`, `uploadXray`, `fetchXrayObjectUrl` (kinukuha bilang blob dahil authenticated ang endpoint), `saveAnnotations`. |

### `client/src/utils/`

| Name | Type | Purpose |
|---|---|---|
| `generatePassword.js` | JS utility function | Gumagawa ng random na temporary password (12 characters, cryptographically random gamit ang `crypto.getRandomValues`, iniiwasan ang mga confusing characters gaya ng `0`/`O`/`1`/`l`) — ginagamit sa Create Portal Account at Reset Password modals. |

---

## `server/` — Node.js / Express Backend

### Root files ng server

| Name | Type | Purpose |
|---|---|---|
| `.env` | Environment config (**hindi naka-commit sa Git** — nasa `.gitignore`) | Ang totoong secrets: DB credentials, JWT secret, **Cloudinary credentials (NAKA-SET NA, may totoong values)**, at **Mailgun webhook signing key (NAKA-SET NA rin)**. Ito ang aktwal na sinusunod na config sa tumatakbong server ngayon. |
| `.env.example` | Environment config template | Kopyahin at palitan ng totoong values para gumawa ng sariling `.env` — walang totoong secrets dito, sample/blank values lang. |
| `package.json` | npm manifest | Listahan ng dependencies: `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `multer` (file uploads), `cloudinary` (SDK), `csv-parse`, `express-validator`, `helmet` (security headers), `cors`, `morgan` (request logging), `dotenv`. May mga script din: `dev` (naka-scope ang `node --watch` sa `src/`, `server.js`, `.env` lang), `start`, `migrate`, `seed`, `seed:patient`. |
| `package-lock.json` | npm lockfile | Katulad ng sa client — auto-generated, huwag i-edit manually. |
| `server.js` | Node entry point | Ang literal na pinaka-unang file na tumatakbo — nagla-load ng `.env`, kinukuha ang `app` mula sa `src/app.js`, at nagpapatakbo ng server sa naka-configure na port (default 5000). |

### `server/db/` — Database setup scripts

| Name | Type | Purpose |
|---|---|---|
| `migrate.js` | Node script | Nagpapatakbo ng lahat ng SQL migration files sa `migrations/` folder ayon sa pagkakasunod-sunod, at tinatrack sa isang `schema_migrations` table kung alin na ang na-apply — kaya safe siyang paulit-ulit patakbuhin (skinip na lang ang mga naisagawa na). |
| `seed.js` | Node script | Gumagawa (o nag-u-update ng password) ng dentist account. Walang public sign-up para sa dentist role — ito lang ang paraan para makagawa ng dentist login. Usage: `node db/seed.js <email> <password>`. |
| `seedPatientUser.js` | Node script | Gumagawa ng patient portal login account, naka-link sa existing patient record. Walang self-signup UI pa — sa script na ito lang pwede gawin, gaya rin ng `seed.js`. |

### `server/db/migrations/` — Schema changes, in order

| Name | Type | Purpose |
|---|---|---|
| `001_init.sql` | SQL migration | Ang **pinakaunang** schema — gumagawa ng `patients`, `users` (login accounts, may CHECK constraint na ang `dentist` role ay walang `patient_id`, samantalang ang `patient` role ay dapat may `patient_id`), `treatments`, `xray_images` (may column para sa `mailgun_message_id` — ibig sabihin, plinano na talaga ang Mailgun feature mula pa sa simula), at `audit_logs` (RA 10173 compliance requirement). |
| `002_add_emergency_contact.sql` | SQL migration | Nagdadagdag ng `emergency_contact_name` at `emergency_contact_phone` columns sa `patients` table. |
| `003_add_chart_entries.sql` | SQL migration | Gumagawa ng `chart_entries` table para sa 2D odontogram — **append-only**, gaya ng `audit_logs`: bawat pagmarka ng dentist ay bagong row, hindi pag-update ng existing row. Ang "current state" ay derive lang sa query time (pinakabagong row per tooth+surface), hindi hiwalay na "current" table na pwedeng ma-out-of-sync. |
| `004_add_patient_soft_delete.sql` | SQL migration | Nagdadagdag ng `deleted_at` column sa `patients` — ito ang gumagawa sa "Delete Patient" bilang soft-delete (natatago sa app, pero buo pa rin ang record sa database para sa retention/liability reasons). |

### `server/src/` — App root

| Name | Type | Purpose |
|---|---|---|
| `app.js` | Express app setup | Dito naka-configure ang buong Express middleware chain: `helmet` (security headers), `cors` (naka-restrict lang sa `CORS_ORIGIN` na naka-set sa `.env`), `morgan` (request logging), `express.json()` (JSON body parsing), pagkonekta ng lahat ng routes sa `/api` prefix, at error handlers (404 + generic error). |

### `server/src/config/`

| Name | Type | Purpose |
|---|---|---|
| `cloudinary.js` | Config module | Nagko-configure ng Cloudinary SDK gamit ang env vars, at nag-e-export ng `isCloudinaryConfigured` — isang boolean check kung naka-set na ang lahat ng tatlong Cloudinary env vars. **Sa kasalukuyang `.env`, TAMA ang lahat ng values, kaya `true` ito ngayon.** |
| `db.js` | Config module | Gumagawa ng MySQL connection **pool** (hindi single connection — kaya kaya niyang mag-handle ng maraming concurrent requests). May espesyal na setting (`dateStrings: ['DATE']`) para hindi mag-shift ang mga petsa (halimbawa date of birth) dahil sa timezone conversion bugs. |
| `importUpload.js` | Multer config | Naghahanda ng file upload handler para sa CSV/JSON legacy import — memory storage lang (walang isinasave sa disk), 5MB limit, tinatanggap lang ang `.csv`/`.json` files. |
| `mailgunUpload.js` | Multer config | Naghahanda ng file upload handler **para sa Mailgun inbound webhook attachments** — memory storage, 15MB per file, hanggang 10 files, walang `fileFilter` (sinasadya, para hindi mabuo ang buong request kapag may isang bad attachment lang). |
| `upload.js` | Multer config | Naghahanda ng file upload handler para sa **manual** X-ray upload (dentist-initiated) — memory storage, 15MB limit, tinatanggap lang ang JPEG/PNG/WebP/PDF. |

### `server/src/controllers/` — Request handlers

| Name | Type | Purpose |
|---|---|---|
| `auth.controller.js` | Express controller | `login` (validate + tumawag sa `authService.login`) at `me` (kinukuha ang current user info base sa JWT token). |
| `chart.controller.js` | Express controller | `getCurrentChart`, `getToothHistory`, `createEntry` — lahat may access check (`canAccessPatientRecord`) bago magbigay ng data, at nagla-log sa `audit_logs`. |
| `patientImport.controller.js` | Express controller | `importFile` (tumatawag sa import service, saka nagla-log ng audit entry) at `downloadTemplate` (gumagawa ng sample CSV on-the-fly). |
| `patients.controller.js` | Express controller | Ang **pinakamalaking controller** — lahat ng patient-related actions: list (may pagination/search), create, getOne, update, remove (soft delete), listTreatments, addTreatment, portal account management (get/create/reset password), at `summary` (para sa print page). Bawat sensitive action ay naglo-log sa audit trail. |
| `webhooks.controller.js` | Express controller | Ang **Mailgun inbound email handler** — kino-verify ang signature, hinahanap ang patient base sa sender email, kinukuha ang mga attachment, tina-store ang mga ito (via `xrayStorageService`), at gumagawa ng bagong `xray_images` row bawat isa. May deduplication logic base sa `mailgun_message_id` (para hindi ma-duplicate kapag nag-retry si Mailgun). |
| `xrays.controller.js` | Express controller | `list`, `upload` (manual), `getFile` (nagre-redirect papunta sa Cloudinary signed URL O nagse-serve ng local file, depende kung saan naka-store), `updateAnnotations`. |

### `server/src/middleware/`

| Name | Type | Purpose |
|---|---|---|
| `auth.js` | Express middleware | `authenticate` — vine-verify ang JWT mula sa `Authorization: Bearer <token>` header, at inilalagay ang decoded payload (`userId`, `role`, `patientId`) sa `req.user` para magamit ng susunod na handlers. |
| `errorHandler.js` | Express middleware | Central error handler — kumukuha ng `status` mula sa thrown error (default 500), at nagre-respond ng consistent JSON error shape. May `notFoundHandler` din para sa 404 (walang matching route). |
| `rbac.js` | Express middleware/helper | `requireRole(...roles)` — route-level gate (halimbawa `requireRole('dentist')` sa bawat write endpoint). `canAccessPatientRecord(user, patientId)` — record-level gate: pwedeng makita ng dentist ang lahat, pero pwede lang makita ng patient ang **sarili** nilang record. |

### `server/src/models/` — Direct database queries

| Name | Type | Purpose |
|---|---|---|
| `auditLogModel.js` | Model | Isang function lang: `recordAuditLog` — nag-i-insert ng row sa `audit_logs` table. Tinatawag ito sa halos lahat ng sensitive read/write sa buong app (RA 10173 compliance requirement). |
| `chartModel.js` | Model | Mga query para sa `chart_entries`: `getCurrentChart` (gumagamit ng `ROW_NUMBER() OVER (...)` para makuha lang ang pinakabagong entry per tooth+surface), `getToothHistory`, `createChartEntry`, `createWholeToothEntry` (transaction na sumusulat ng 6 rows nang sabay-sabay — whole + 5 surfaces — para sa extraction/restoration). |
| `patientModel.js` | Model | Mga query para sa `patients`: `listPatients` (may search + pagination), `findPatientById`/`findPatientByEmail`/`findPatientByNameAndDob` (lahat ay naka-filter `deleted_at IS NULL`), `createPatient`, `updatePatient`, `softDeletePatient`. |
| `treatmentModel.js` | Model | Mga query para sa `treatments`: `listTreatmentsForPatient`, `createTreatment`. |
| `userModel.js` | Model | Mga query para sa `users` (login accounts): `findUserByEmail`, `findUserById`, `findUserByPatientId`, `updatePasswordHash`, `createUser`. |
| `xrayModel.js` | Model | Mga query para sa `xray_images`: `listXraysForPatient`, `findXrayById`, `findXrayByMailgunMessageId` (para sa deduplication), `createXray`, `updateAnnotations`. May espesyal na `parseAnnotations()` function na nagpapa-JSON.parse ng `annotations` column — dahil ibinabalik ito ni mysql2 bilang raw string, hindi parsed value (ito yung "load-bearing" bug fix na nabanggit sa lumang notes). |

### `server/src/routes/` — URL → controller mapping

| Name | Type | Purpose |
|---|---|---|
| `auth.routes.js` | Express router | `POST /auth/login` (may validation) at `GET /auth/me` (protected). |
| `chart.routes.js` | Express router | Lahat protected (`router.use(authenticate)`). `GET /patients/:patientId/chart`, `GET /patients/:patientId/chart/:toothNumber/history`, `POST /patients/:patientId/chart` (dentist lang, may validation ng surface/condition values). |
| `index.js` | Express router (aggregator) | Pinagsasama ang lahat ng sub-routers sa ilalim ng `/api` — `/health`, `/auth`, `/patients`, webhooks, xrays, chart. May **importanteng comment** dito na nagpapaliwanag kung bakit dapat mauna ang `webhooksRoutes` bago ang `xraysRoutes`/`chartRoutes` (para hindi ma-block ng `authenticate` middleware ng ibang routers ang Mailgun webhook, na walang Bearer token). |
| `patients.routes.js` | Express router | Lahat ng `/patients/*` endpoints — list/create/get/update/delete, treatments, import, summary, portal account. May PH mobile number regex validation dito rin (bilang backup sa client-side check, dahil ito ang hindi mapapalampas). |
| `webhooks.routes.js` | Express router | `POST /webhooks/mailgun/inbound` — **sadyang HINDI naka-behind ng `authenticate` middleware**, dahil si Mailgun ang tumatawag dito, hindi isang logged-in user. Ang signature verification na mismo (sa `mailgunService.js`) ang gumaganap bilang authentication. |
| `xrays.routes.js` | Express router | `/patients/:patientId/xrays` (list/upload) at `/xrays/:id/file` + `/xrays/:id/annotations` (per-image operations). |

### `server/src/services/` — Business logic

| Name | Type | Purpose |
|---|---|---|
| `authService.js` | Service | `hashPassword` (bcrypt, 12 salt rounds) at `login` (hinahanap ang user, kina-check ang password, gumagawa ng JWT token, nagla-log ng LOGIN_SUCCESS/LOGIN_FAILED sa audit trail — parehong error message para sa "walang ganung user" at "maling password" para hindi malaman ng attacker kung anong emails ang may account). |
| `mailgunService.js` | Service | `verifyMailgunSignature` — vine-verify ang HMAC-SHA256 signature na ipinapadala ni Mailgun sa bawat inbound webhook POST (gamit ang `MAILGUN_WEBHOOK_SIGNING_KEY`), gamit ang `timingSafeEqual` para maiwasan ang timing attacks. `extractSenderEmail` — kinukuha ang email address ng nagpadala mula sa Mailgun's `sender` field o `From` header. |
| `patientImportService.js` | Service | Ang buong CSV/JSON parsing logic — normalize ng sex/date values, per-row validation, duplicate detection (name+DOB), gumagawa ng detalyadong report (ilan na-add, ilan duplicate, ilan may error). Isa-isang row ang pino-process, kaya isang masamang row lang ay hindi bumabagsak sa buong import. |
| `xrayStorageService.js` | Service | **Ang core storage logic** — `storeXrayFile` ay opt-in na pumipili sa pagitan ng Cloudinary (kung naka-configure) o local disk (kung hindi), depende sa `isCloudinaryConfigured`. `resolveXrayFile` ay nagbibigay ng signed/authenticated URL (Cloudinary) o local file path, depende kung saan naka-store ang partikular na file (naka-prefix ang `file_url` ng `"cloudinary:"` kung Cloudinary, plain filename kung local — kaya gumagana pa rin ang mga lumang row na na-upload bago pa naka-configure ang Cloudinary). |

### `server/src/utils/`

| Name | Type | Purpose |
|---|---|---|
| `AppError.js` | Custom Error class | Extension ng `Error` na may `status` property — itapon ito sa mga controllers/services kapag alam mo na ang tamang HTTP status code (404, 403, 409, atbp). |
| `asyncHandler.js` | Higher-order function | Bina-balot ang async route handlers para awtomatikong ma-forward sa Express error handler ang anumang rejected promise, imbes na mag-crash ang buong server nang hindi na-catch. |

### `server/uploads/xrays/` — Local disk storage ng X-ray images

| Name | Type | Purpose |
|---|---|---|
| `.gitkeep` | Empty placeholder file | Ginagamit para "ipilit" kay Git na i-track ang walang laman na folder (kasi normally hindi tinatrack ni Git ang empty folders) — pero ang mismong `.gitignore` ay `uploads/xrays/*` (maliban dito), kaya hindi rin talaga na-upload sa Git ang totoong images. |
| 7 `.png` files (naka-timestamp+hash na pangalan, e.g. `1786083625148-4e1818c6a25060c6.png`) | Uploaded X-ray image files | Ito ang mga totoong X-ray image na na-upload/na-test habang nagde-develop. Ang pattern ng pangalan (`Date.now()-randomHex.ext`) ay galing sa `writeToLocalDisk()` function sa `xrayStorageService.js` — ginagawa ito para walang dalawang magkaparehong filename kahit magkaparehong orihinal na pangalan ang na-upload. **Pansinin:** dahil naka-configure na ang Cloudinary sa kasalukuyang `.env`, ang mga BAGONG upload mula ngayon ay sa Cloudinary na mapupunta, hindi na dito — ang mga files na ito ay galing sa mga lumang test uploads bago pa naka-set ang Cloudinary credentials. |

---

## ⚠️ Mahalagang Pagwawasto sa Lumang Notes (Mailgun at Cloudinary)

Habang binabasa ko ang buong codebase, natuklasan ko na **hindi na tama** ang dalawang
malalaking claim sa dating `CLAUDE.md`/`notes.md`:

1. **"Mailgun inbound-email automation is NOT built"** — **MALI ito ngayon.** Kumpleto
   ang code: `webhooks.routes.js`, `webhooks.controller.js`, `mailgunService.js`
   (signature verification), at `config/mailgunUpload.js` ay lahat naka-wire up nang
   tama, kasama ang deliberate na pagkakasunod-sunod sa `routes/index.js` para hindi
   ma-block ng ibang routers' auth middleware. Ang `MAILGUN_WEBHOOK_SIGNING_KEY` sa
   `.env` ay **may totoong value na**. (Ang `MAILGUN_API_KEY` at `MAILGUN_DOMAIN` ay
   blangko pa rin, pero hindi rin sila ginagamit kahit saan sa code — hindi kailangan
   ang mga 'yun para gumana ang inbound webhook, since ang signing key lang ang
   ginagamit sa pag-verify. Base rin sa nakikitang command history, mukhang na-test na
   ito gamit ang ngrok tunnel + test scripts.)

2. **"Cloudinary integration is planned but not yet wired up"** — **MALI rin ito
   ngayon.** Buo ang `config/cloudinary.js` at `xrayStorageService.js` — opt-in na
   logic (Cloudinary kung naka-configure, local disk kung hindi), at ang tatlong
   Cloudinary env vars sa `.env` ay **may totoong values na** (`cloud_name`, `api_key`,
   `api_secret`). Ibig sabihin, **aktibong Cloudinary na ang ginagamit ng system
   ngayon** para sa mga bagong X-ray upload — hindi na local disk.

Malamang na-build at na-configure na itong dalawang feature pagkatapos isulat yung
huling bersyon ng lumang notes, kaya hindi na-update doon. Kung gagawa ka ng bagong
`CLAUDE.md` para sa persistent project context, ito ang dapat na tamang estado, hindi
yung nasa lumang notes.
