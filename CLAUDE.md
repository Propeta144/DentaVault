# DentaVault — Mga Idinagdag (Minor Additions Session)

Buod ito ng mga **minor** na feature na idinagdag sa DentaVault nang hindi ginagalaw
ang core scope/architecture — lahat base sa mga puwang na napansin habang ginagawa ang
`FOLDER_STRUCTURE.md`. Bawat file dito ay may **Name**, **Type**, at **Purpose**, kasama
kung **bago (NEW)** o **binago lang (MODIFIED)**.

Anim na feature (5 minor addition + 1 dashboard na gumagamit ng lahat ng datos mula
sa mga naunang 5):
1. **Audit log viewer** (dentist-only page) — dati, silent lang sa DB, walang UI.
2. **CSV export** ng patient list — meron nang import, wala pang export.
3. **"New X-ray from email" badge** sa sidebar — notification kapag may bagong X-ray
   na auto-processed galing sa Mailgun inbound email.
4. **Sort options** sa patient list (Name, Newest/Oldest Registered, Last Visit).
5. **"Last Visit" column** sa patient list — derived mula sa pinakabagong treatment date.
6. **Dashboard** (dentist-only landing page para sa reports/analytics) — KPI stat tiles,
   procedure/condition breakdown charts, 6-month trend chart, at recent activity feed.

---

## 1. Audit Log Viewer

| Name | Type | Purpose |
|---|---|---|
| `server/src/models/auditLogModel.js` | MODIFIED | Dinagdagan ng `listAuditLogs({ limit, offset })` — SELECT na naka-JOIN sa `users` para makuha ang pangalan/role ng gumawa, may pagination (`total` count), at may `parseDetails()` helper na nag-a-`JSON.parse()` sa `details` column (parehong mysql2 raw-string gotcha na nasa `xrayModel.js` — kailangang ulitin dito dahil hiwalay na query ito). |
| `server/src/controllers/auditLog.controller.js` | **NEW** | `list` — kinukuha ang paginated audit logs, at nagla-log din ng sarili niyang `VIEW_AUDIT_LOG` entry (dahil ang pagtingin mismo sa audit trail ay sensitive action, parehong pattern sa buong app). |
| `server/src/routes/auditLog.routes.js` | **NEW** | `GET /api/audit-logs` — dentist-only (`requireRole('dentist')`), dahil ang audit trail mismo ay sensitive data (sino ang nag-access ng anong record, kailan). |
| `server/src/routes/index.js` | MODIFIED | Idinagdag ang pag-import at pag-register ng `auditLogRoutes`. |
| `client/src/services/auditLogs.js` | **NEW** | `listAuditLogs({ page, limit })` — API wrapper function. |
| `client/src/pages/AuditLogPage.jsx` | **NEW** | Ang buong page mismo — table ng Date/Time, User (+role), Action (color-coded badge base sa prefix: red=delete/failed, emerald=create/success, sky=update, amber=export, slate=view/default), Record (`entity_type #entity_id`), Details (flattened JSON), IP Address. May Prev/Next pagination (unang beses may ganitong control sa app — dati walang page navigation UI kahit saan). |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Idinagdag ang "Audit Log" nav item sa sidebar — **dentist-only**, hindi makikita ng patient role. |
| `client/src/App.jsx` | MODIFIED | Idinagdag ang route `/audit-log`, naka-wrap sa `ProtectedRoute allowedRoles={['dentist']}`. |

---

## 2. CSV Export ng Patient List

| Name | Type | Purpose |
|---|---|---|
| `server/src/utils/csv.js` | **NEW** | Shared `csvField()` helper (quote escaping para sa commas/quotes/newlines sa CSV output) — kinuha mula sa dating duplicate na version sa loob ng `patientImport.controller.js`, ginawang shared utility dahil dalawa na ngayon ang gumagamit nito. |
| `server/src/controllers/patientImport.controller.js` | MODIFIED | Tinanggal ang lumang local `csvField()` function, ginamit na lang ang shared version mula sa `utils/csv.js`. |
| `server/src/models/patientModel.js` | MODIFIED | Bagong `listPatientsForExport({ search })` — kunin LAHAT ng matching patients (walang pagination limit), gamit ang parehong search filter ng list view. |
| `server/src/controllers/patients.controller.js` | MODIFIED | Bagong `exportCsv` — bumubuo ng CSV mula sa buong patient fields (kasama address, medical history, allergies, emergency contact), naglo-log ng `EXPORT_PATIENTS_CSV` audit entry (may count), nagbibigay ng file na may petsa sa filename (`dentavault-patients-YYYY-MM-DD.csv`). |
| `server/src/routes/patients.routes.js` | MODIFIED | Idinagdag ang `GET /patients/export` (dentist-only) — **kailangang** nasa taas bago ang `/:id` route, gaya ng `/import` routes, para hindi ito ma-match bilang `:id = "export"`. |
| `client/src/services/patients.js` | MODIFIED | Bagong `exportPatientsCsv({ search })` — parehong "fetch as blob dahil authenticated ang endpoint" pattern gaya ng `downloadImportTemplate`. |
| `client/src/pages/PatientsListPage.jsx` | MODIFIED | Bagong "Export CSV" button sa tabi ng Import/Register buttons — nagre-respeto sa kasalukuyang search filter (kung naka-search ka, ang na-export lang ay yung mga match). |

---

## 3. "New X-ray from Email" Badge

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/005_add_xray_reviewed_at.sql` | **NEW** | Nagdadagdag ng `reviewed_at DATETIME NULL` column sa `xray_images`. NULL = "hindi pa nabubuksan ng dentist" — pero applicable lang talaga ito sa `source = 'email_inbound'` rows. May backfill din: lahat ng existing rows ay minarkahan agad na "reviewed" (`reviewed_at = created_at`), para hindi lumabas na maling "backlog" ng notifications sa unang pagpapatakbo nitong migration. |
| `server/src/models/xrayModel.js` | MODIFIED | Idinagdag ang `reviewed_at` sa SELECT ng `listXraysForPatient`. Bagong `markXrayReviewed(id)` (idempotent — first-view lang ang nagse-set) at `countUnreviewedEmailXrays()` (COUNT kung saan `source = 'email_inbound' AND reviewed_at IS NULL`). |
| `server/src/controllers/xrays.controller.js` | MODIFIED | Sa `getFile` — kapag dentist ang tumitingin at `email_inbound` ang source at hindi pa reviewed, awtomatikong tinatawag ang `markXrayReviewed`. Ito ay natural na nangyayari kasi ang gallery thumbnails mismo ay tumatawag sa `/xrays/:id/file` (via `fetchXrayObjectUrl`) — kaya sa sandaling buksan ng dentist ang X-ray tab ng isang patient, "nabasa na" ang lahat ng thumbnails doon. Bagong `unreviewedCount` controller — global count lang, walang list, para sa badge. |
| `server/src/routes/xrays.routes.js` | MODIFIED | Idinagdag ang `GET /xrays/unreviewed-count` (dentist-only), nakalagay bago ang `/xrays/:id/file` (sundin lang ang existing convention ng codebase — walang aktwal na collision dahil magkaiba ang bilang ng path segments). |
| `client/src/services/xrays.js` | MODIFIED | Bagong `getUnreviewedXrayCount()`. |
| `client/src/components/xray/XrayGallery.jsx` | MODIFIED | May bagong amber "New" badge sa bawat thumbnail na `email_inbound` at hindi pa `reviewed_at` — dagdag sa existing "Email"/"Manual" badge. |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Kumukuha ng unreviewed count on mount at sa bawat pagpalit ng route (dentist-only) — ipinapakita bilang amber pill badge sa tabi ng "Patients" nav item. Awtomatikong nawawala/nag-uupdate ang bilang kapag nag-navigate (dahil pag binuksan ng dentist ang X-ray tab ng patient, na-mamark na reviewed agad, kaya bababa ang susunod na count fetch). |

---

## 4 & 5. Sort Options + "Last Visit" Column (magkasama, parehong query ang ginalaw)

| Name | Type | Purpose |
|---|---|---|
| `server/src/models/patientModel.js` | MODIFIED | Bagong `PATIENT_SORTS` whitelist (name, name_desc, date_added, date_added_asc, last_visit — **whitelisted, hindi galing sa raw user input**, kaya walang injection risk kahit direktang naka-interpolate sa SQL string). Ang `listPatients` query ay may bagong `LEFT JOIN` papunta sa isang subquery na kumukuha ng `MAX(treatment_date)` per patient (`last_treatment_date`). Para sa `last_visit` sort, gumamit ng `(x IS NULL) ASC` trick dahil walang native na `NULLS LAST` sa MySQL — mga patient na wala pang treatment ay laging nasa dulo, kahit anong direction. |
| `server/src/controllers/patients.controller.js` | MODIFIED | Dinaan na ang `req.query.sort` papunta sa model function. |
| `client/src/services/patients.js` | MODIFIED | Ang `listPatients()` ay tumatanggap na ng `sort` parameter (default `'name'`). |
| `client/src/pages/PatientsListPage.jsx` | MODIFIED | Bagong `<select>` dropdown sa tabi ng search bar (Name A-Z/Z-A, Newest/Oldest Registered, Last Visit). Bagong "Last Visit" column sa table view (desktop) at bagong field sa card view (mobile) — nagpapakita ng petsa o "No visits yet" kung wala pang treatment record. |

---

## 6. Dashboard (Reports & Analytics)

Ginamit ang **dataviz skill** (chart-design guidelines) bago isulat ang mga chart —
kaya may color palette validation step bago pa man mag-code. Ang lahat ng chart dito
ay **hand-built** (plain divs + Tailwind, walang bagong npm dependency gaya ng
Chart.js/Recharts) para hindi lumaki ang bundle para lang sa ilang simpleng bar chart —
consistent sa ginawa na ng app sa Odontogram (hand-rolled SVG, walang charting library).

| Name | Type | Purpose |
|---|---|---|
| `server/src/models/dashboardModel.js` | **NEW** | Limang query function: `getActivePatientCount`, `getTreatmentsThisMonthCount`, `getXraysThisMonthCount`, `getProcedureBreakdown` (count ng treatments per procedure name), `getConditionBreakdown` (parehong latest-row-per-slot na `ROW_NUMBER()` pattern gaya ng `chartModel.getCurrentChart`, pero clinic-wide at grouped by condition), at `getMonthlyTrend` (bagong patient + treatments per month, huling 6 buwan, zero-filled kahit walang laman ang isang buwan). Lahat ay naka-filter `deleted_at IS NULL` sa patients, consistent sa buong app. |
| `server/src/controllers/dashboard.controller.js` | **NEW** | Isang `get` handler na tumatawag sa lahat ng limang model function nang sabay (`Promise.all`) kasama ang `countUnreviewedEmailXrays` (mula sa X-ray badge feature) at `listAuditLogs` (mula sa Audit Log feature) — iisang response, iisang loading state sa frontend, parehong pattern gaya ng `patients.controller.js`'s `summary`. Naglo-log din ng `VIEW_DASHBOARD` audit entry. |
| `server/src/routes/dashboard.routes.js` | **NEW** | `GET /api/dashboard` — dentist-only. |
| `server/src/routes/index.js` | MODIFIED | Idinagdag ang pag-register ng `dashboardRoutes`. |
| `client/src/services/dashboard.js` | **NEW** | `getDashboard()` — API wrapper. |
| `client/src/constants/dashboardColors.js` | **NEW** | Ang **validated categorical color palette** (5 kulay, mula sa dataviz skill's reference palette — dumaan sa `validate_palette.js` script, PASSED lahat ng CVD/lightness/contrast checks). Sinadyang **hiwalay** sa `constants/dental.js`'s odontogram colors (yun ay raw/unvalidated Tailwind hues na ginagamit na sa ibang parte ng app — hindi na ginalaw para hindi masira ang existing verified feature). May fixed order (hindi sinu-sort by value) para manatiling ligtas ang adjacency na na-validate. |
| `client/src/components/dashboard/StatTile.jsx` | **NEW** | Reusable KPI tile — label + malaking number + icon, may optional na "accent" (amber) mode para sa values na nangangailangan ng atensyon (ginamit sa "Unreviewed X-rays" kapag > 0). |
| `client/src/components/dashboard/HorizontalBarChart.jsx` | **NEW** | Reusable horizontal bar chart — ginagamit parehong sa "Most Common Procedures" (single-hue, dahil isang metric lang ang minemeasure) at "Tooth Condition Breakdown" (may kulay per condition + legend, dahil dito totoong "magkaibang identity" ang minemeasure). May direct value label sa dulo ng bawat bar (sa labas, hindi sa loob, para walang clipping risk), at "No data yet" empty state. |
| `client/src/components/dashboard/MonthlyTrendChart.jsx` | **NEW** | Grouped bar chart (2 series: New Patients vs Treatments) per buwan, huling 6 buwan, iisang shared scale (hindi dual-axis — bawal 'yun per dataviz rules). May legend, hover tooltip per bar (native `title`), buwan labels sa ibaba. |
| `client/src/utils/auditAction.js` | **NEW** | Ang `actionVariant()` function na dating naka-inline sa `AuditLogPage.jsx` — inilipat dito dahil ginagamit na rin ito ng bagong "Recent Activity" section sa Dashboard. |
| `client/src/pages/AuditLogPage.jsx` | MODIFIED | Ginamit na ang shared `actionVariant` mula sa `utils/auditAction.js` imbes na local na function. |
| `client/src/pages/DashboardPage.jsx` | **NEW** | Ang buong page — KPI row (4 stat tiles), dalawang bar chart magkatabi (Procedures, Conditions), trend chart at Recent Activity feed magkatabi (may link papuntang buong Audit Log page). |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Idinagdag ang "Dashboard" nav item (dentist-only) — **una** sa listahan (bago ang "Patients"), dahil ito na rin ang default landing page. |
| `client/src/App.jsx` | MODIFIED | Idinagdag ang route `/dashboard`, dentist-only. Ang `HomeRedirect` ay pinalitan: **Dashboard na ngayon ang default landing page ng dentist** pagka-login (dati `/patients`). Ang patient role ay hindi apektado — diretso pa rin sila sa sariling record. |

**Tungkol sa color choices:** ang "Tooth Condition Breakdown" chart ay may **ibang
kulay** kumpara sa Odontogram (halimbawa, hindi berde ang "Healthy" dito, blue ito) —
sinadya ito. Ang mga kulay sa Odontogram (`constants/dental.js`) ay hindi pa
na-validate para sa color-blindness safety (na-check ko gamit ang validator script,
FAILED ito sa ilang check), pero ayaw kong baguhin 'yun dahil verified working na
feature 'yun at baka may sumandal na sa kasalukuyang kulay. Sa halip, bagong validated
palette ang ginamit sa dashboard chart — may direct text labels naman bawat bar, kaya
hindi kailangang umasa sa exact hue-matching para maintindihan.

| Item | Paliwanag |
|---|---|
| **OneDrive folder permission fix** | Habang sinusubukang patakbuhin ang migration, na-block ang Node.js ng isang Windows Deny ACL entry sa `C:\Users\rhonb\OneDrive` (partikular: "Deny Synchronize" para sa BUILTIN\Administrators group, na kasama ka dahil admin account ka). Ito ang dahilan kung bakit hindi basta gumagana ang `npm run migrate`/`npm run dev` — hindi ito related sa code, kundi sa Windows security config ng OneDrive folder mismo. Tinanggal ang partikular na Deny entry gamit ang `icacls` (may backup ng orihinal na ACL sa `scratchpad/onedrive_acl_backup.txt` sakaling kailangang ibalik). Ang "Everyone: Deny DeleteSubdirectoriesAndFiles" (di ito ang nagcocause ng error) ay hindi ginalaw. |
| **`server/db/migrations/005_add_xray_reviewed_at.sql`** | Pinatakbo na sa database gamit ang `npm run migrate` — ang column ay nandiyan na sa live schema, hindi lang nakasulat sa file. |
| **Live-tested sa browser** | Na-verify lahat ng limang feature sa browser (login bilang dentist, pumunta sa Patients, X-rays tab, Audit Log page) — hindi lang API-level testing. |

---

## UI Conventions (Skill)

Bago gumawa o mag-restyle ng kahit anong UI sa `client/src`, basahin/gamitin ang
project skill na **`.claude/skills/dentavault-ui/SKILL.md`**: purple brand via
remapped `sky-*`/`slate-*` (sa `src/index.css`), `min-h-11` touch targets, card/table/modal/form
patterns, responsive card-vs-table split, at role gating checklist.

---

## Patakaran sa Bawat Session (para kay Claude)

Tuwing may gagawin o babaguhin sa DentaVault, **laging ipaliwanag pagkatapos**
(Taglish, simpleng salita, kahit maliit na pagbabago):
1. **Ano ang ginawa**: aling files ang bago (NEW) o binago (MODIFIED).
2. **Para saan**: anong problema ang nilulutas, bakit kailangan.
3. **Explain the code**: mahahalagang parte at paano nagkakakonekta
   (page → service → route → controller → model → database).
4. **Functionality**: paano ito gumagana para sa user (dentist vs patient) at paano ito subukan sa app.

Dahilan: capstone ito, kailangang maintindihan at maipagtanggol ng buong team ang bawat code.

---

## 7. Walang Patient ID sa URL at Screen (Security, hiling ng adviser)

**Problema:** dati `/patients/5` ang URL at "Patient ID #5" ang nakikita. Kahit anong
fixed na identifier sa address bar (kahit random pa) ay permanenteng nakakabit sa patient at
lumalabas sa browser history, kinopyang link, at screenshot.

**Solusyon:**
- **Address bar:** pare-pareho na ang URL ng lahat ng patient: `/patients/profile` (at
  `/patients/profile/summary`, `/chart/print`, `/xray/print`). Ang napiling patient ay nasa
  **history state** ng React Router (`location.state`): nakatago sa browser, hindi sa URL,
  pero gumagana pa rin ang refresh at back/forward (bawat history entry may sariling patient).
- **Print pages (bagong tab):** hindi dala ng bagong tab ang history state, kaya may
  **localStorage handoff**: iniiwan sandali (15s TTL), kinukuha at binubura agad ng print page,
  tapos sine-save sa sariling history state ng tab (para gumana ang refresh).
- **Kinopyang URL / bagong tab na walang state:** balik sa patient list, o mensaheng "Open this
  page from..." sa print page. Walang record na lumalabas.
- **Screen:** tinanggal ang "Patient ID" sa profile, list, print pages, CSV export, at import results.
  Name-only na rin ang search.
- **API (hindi nakikita ng user):** gumagamit ng random na internal `patient_code`
  (`DV-XXXX-XXXX`, crypto-random) imbes na sunod-sunod na numeric id, para kahit sumilip sa
  DevTools Network tab ay hindi mahulaan ang ibang records.
- **Tunay na proteksyon:** ang server access check pa rin (`canAccessPatientRecord`, 403). Ang
  patient account ay laging sariling code (galing sa login) kahit pekein ang history state.

| Name | Type | Purpose |
|---|---|---|
| `client/src/utils/selectedPatient.js` | **NEW** | `PROFILE_PATH`, `profileState(code)`, `useSelectedPatientCode()` (history state; patient role → sariling code), `openPrintTab(path, state)` at `usePrintState()` (localStorage handoff para sa print tabs). |
| `client/src/App.jsx` | MODIFIED | Routes `patients/:id...` → `patients/profile`, `patients/profile/summary`, `patients/profile/chart/print`, `patients/profile/xray/print`. Patient `HomeRedirect` → `/patients/profile`. |
| `client/src/pages/PatientProfilePage.jsx` | MODIFIED | Code galing `useSelectedPatientCode()`; walang state → redirect sa list; Print buttons gumagamit ng `openPrintTab`; tinanggal ang "Patient ID" line. |
| `client/src/pages/PatientsListPage.jsx`, `PatientRegisterPage.jsx` | MODIFIED | Links/navigate papuntang `/patients/profile` na may state; walang code na naka-display; placeholder "Search by name...". |
| `client/src/pages/*PrintPage.jsx` (Summary, Chart, Xray) | MODIFIED | `usePrintState()` imbes na `useParams()`; tinanggal ang "Patient ID"; X-ray id nasa state rin. |
| `client/src/components/xray/XrayViewer.jsx`, `PatientXraysSection.jsx` | MODIFIED | Print via `openPrintTab` na may `{ patientCode, xrayId }`. |
| `client/src/components/patients/*Modal.jsx` | MODIFIED | API calls gamit ang `patient_code`; import results pangalan na lang. |
| `server/src/utils/patientCode.js` | **NEW** | `generatePatientCode()` (8 Crockford base32 chars, `crypto.randomInt`) at `normalizePatientCode()`. |
| `server/db/migrations/008_add_patient_code.js` | **NEW** | Unang JS migration: `patient_code` column + crypto-random backfill + NOT NULL + UNIQUE. Napatakbo na (17 patients). |
| `server/db/migrate.js` | MODIFIED | Sumusuporta na sa `.js` migrations (`export async function up(connection)`). |
| `server/src/models/patientModel.js` | MODIFIED | `findPatientByCode()`; `createPatient()` may code (retry kung duplicate); search name-only. |
| `server/src/controllers/{patients,chart,xrays}.controller.js`, `routes/{patients,chart,xrays}.routes.js` | MODIFIED | `:code` / `:patientCode` params; lumang numeric id → 404. CSV walang ID column. |
| `server/src/models/userModel.js`, `services/authService.js` | MODIFIED | Login at `/auth/me` may `patientCode` (LEFT JOIN patients). JWT numeric id pa rin (internal, signed). |
| `server/src/services/patientImportService.js` | MODIFIED | Import results walang ID. |

**Na-test (live, Edge browser via Playwright + API):** URL laging `/patients/profile`; walang
Patient ID/code sa list, profile, 3 print pages; refresh at back/forward tamang patient; print tabs
tama at gumagana pagka-refresh, handoff nabubura; kinopyang URL → balik sa list; mobile card view;
Edit mula sa list; Register → bagong profile; patient account → sariling record kahit pekein ang
state; API: lumang `/patients/1` = 404, record ng iba = 403.

**Trade-off:** hindi na pwedeng i-bookmark o i-share ang link ng isang specific na patient.
**Hindi pa sakop:** numeric `id` na kasama pa sa JSON responses at X-ray ids sa API
(`/api/xrays/12/file`). Parehong nakikita lang sa DevTools ng naka-login na user at protektado
ng access check.

---

## 8. Iba-ibang Kulay sa "Procedures Performed" Chart (hiling ng adviser)

Dati iisang kulay (blue) lahat ng bar. Ngayon may **sariling permanenteng kulay** ang bawat
isa sa 7 standard procedures (dumaan sa dataviz skill at `validate_palette.js`).

- **Fixed order, hindi naka-sort ayon sa bilang.** Sa fixed order, PASS lahat ng color-blind
  checks (worst adjacent CVD ΔE 9.1, normal-vision ΔE 22.9). Kung naka-sort, kahit anong dalawang
  kulay ay pwedeng magkatabi, at FAIL iyon (green↔orange CVD ΔE 3.2). Parehong approach ng
  Tooth Condition chart. Kaya pinalitan din ang title: "Most Common Procedures" → **"Procedures Performed"**.
- **Kulay sumusunod sa procedure, hindi sa ranggo.** Tugma sa katabing Tooth Condition chart:
  Filling = orange, Root Canal = aqua, Crown / Bridge = yellow. Ang magenta ay para sa Caries lang.
- **Laging kita ang 7 procedures** (kahit 0) para hindi gumagalaw ang pwesto at kulay.
- **"Other" (gray):** pinagsasama ang mga hindi-standard na pangalan galing legacy import (hal.
  "Dental Filling", "Cleaning"). Nasa hover tooltip kung ano-ano sila.

| Name | Type | Purpose |
|---|---|---|
| `client/src/constants/dashboardColors.js` | MODIFIED | Categorical palette ginawang 8 slots (dinagdag green, violet, red mula sa validated reference palette); bagong `PROCEDURE_CHART_ORDER` (value/label/color) at `PROCEDURE_OTHER`; shared `MUTED` gray. Tinanggal ang `SEQUENTIAL_HUE`. |
| `client/src/pages/DashboardPage.jsx` | MODIFIED | Procedure data binubuo sa fixed order + "Other" bucket; bagong title. |
| `client/src/components/dashboard/HorizontalBarChart.jsx` | MODIFIED | Optional na `tooltip` field bawat bar (buong pangalan ng procedure / listahan ng "Other"). |
| `server/src/models/dashboardModel.js` | MODIFIED | Tinanggal ang `LIMIT 8` sa `getProcedureBreakdown` para kumpleto ang bilang ng "Other". |

**Na-verify:** build pasado; screenshot sa browser (desktop at 400px mobile).

---

## 9. Lazy Loading ng Lahat ng Page (hiling ng adviser)

Dati, isang malaking JavaScript file ang dina-download pagbukas ng app, kasama na ang lahat ng
page kahit hindi pa binubuksan. Ngayon, bawat page ay hiwalay na file (**code splitting** gamit
ang `React.lazy()` + `<Suspense>`) na dina-download **lang kapag pinindot**. Habang
dina-download, may loading indicator.

- **Unang download:** 446 KB → **239 KB** (gzip 130 KB → 77 KB), halos kalahati.
- **Sidebar nananatili** habang naglo-load ang page (ang `<Suspense>` ay nasa loob ng `<main>` sa AppLayout).
- **Isang beses lang dina-download** ang bawat page. Sa susunod na bisita, galing na sa cache.
- **Iisang loader (`PageLoader`)** na para sa pag-download ng page at pagkuha ng data. Pinalitan
  ang iba-ibang "Loading..." text sa lahat ng page.
- **PWA note:** sa production, ang service worker ay nagda-download pa rin ng lahat ng page sa
  background *pagkatapos* mag-load ang app (para sa offline access requirement). Hindi nito
  pinapabagal ang unang bukas: ang kailangang page lang ang pinapatakbo agad.

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/common/PageLoader.jsx` | **NEW** | Spinner (lucide `Loader2`, `sky-600`) + label, `role="status"`; `fullScreen` para sa login/print pages. |
| `client/src/App.jsx` | MODIFIED | Lahat ng 9 na page ay `lazy(() => import(...))`; top-level `<Suspense fallback={<PageLoader fullScreen />}>`. AppLayout/ProtectedRoute eager pa rin (shell). |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | `<Suspense fallback={<PageLoader />}>` sa paligid ng `<Outlet />`. |
| `client/src/components/common/ProtectedRoute.jsx` | MODIFIED | Auth check loading → `PageLoader`. |
| `client/src/pages/{Dashboard,PatientsList,AuditLog,PatientProfile}Page.jsx`, 3 print pages | MODIFIED | Data-loading "Loading..." → `PageLoader` (may label hal. "Loading audit log..."). |

**Na-verify (production build, Edge via Playwright):** Login → LoginPage lang; pagka-login →
+DashboardPage; click Audit Log → +AuditLogPage; Patients → +PatientsListPage; profile →
+PatientProfilePage; balik sa Audit Log → walang bagong download. Loader at sidebar nakikita
habang naglo-load (screenshot, may pinabagal na network).

---

## 10. Audit Log Retention (Archive + Auto-cleanup)

Tuloy-tuloy ang pagdami ng audit logs (~1,700 sa 70 araw ng development). Ayon sa Data Privacy Act
(RA 10173), ang personal data (kasama ang sino/kailan/IP sa logs) ay dapat itago lang hangga't
kailangan. Kaya may **tiered retention** na ngayon:

| Tier | Mga action | Default (`.env`) |
|---|---|---|
| **view** | `VIEW_*`, `GENERATE_*` | 365 araw (`AUDIT_RETENTION_VIEW_DAYS`) |
| **change** | lahat ng iba (create/update/delete/export, login, reset password, inbound email...) | 1825 araw / 5 taon (`AUDIT_RETENTION_CHANGE_DAYS`) |

> ⚠️ **PLACEHOLDER ang 365 / 1825.** Hindi pa kumpirmado ang legal na tagal para sa dental
> clinic (DOH / PDA / NPC). Itanong sa adviser o clinic, tapos palitan lang sa `server/.env`.

- **Archive muna, bago burahin.** JSON Lines file bawat buwan (`server/archives/audit-logs/audit-logs-YYYY-MM.jsonl`),
  may `fsync` bago ang DELETE. Kung mag-crash sa gitna, duplicate lang ang posibleng mangyari, hindi pagkawala.
  Kasama ang `user_name`/`user_role` (hindi lang `user_id`) para buo pa rin kahit mabura ang user.
- **Awtomatiko:** tumatakbo 10 segundo pagka-start ng server, tapos kada 24 oras. Hindi pinababagsak ang API kapag pumalya.
- **Manual:** `npm run audit:prune -- --dry-run` (bilang lang) / `npm run audit:prune` (totoo).
- **Naka-log din ang pag-prune** (`PRUNE_AUDIT_LOGS`, user = system, may bilang at file names).
- **Ligtas na default:** ang bagong action code na hindi `VIEW_`/`GENERATE_` ay awtomatikong nasa mas mahabang tier.
- **Hindi binago ang pag-log mismo** (hal. paulit-ulit pa rin ang VIEW_XRAY bawat thumbnail). Sinadyang iwan muna
  ("Hakbang 1" na napag-usapan, hindi pa ginawa).
- `server/archives/` ay nasa `.gitignore` (may personal data). **Paalala:** nasa OneDrive folder ang project,
  kaya masi-sync sa cloud ang archive files. Dapat itong isaalang-alang sa production setup.

| Name | Type | Purpose |
|---|---|---|
| `server/src/services/auditRetentionService.js` | **NEW** | `getRetentionConfig()`, `pruneAuditLogs({ dryRun })` (batch na 1000, archive → delete, per tier), `startAuditRetentionJob()` (daily, may guard laban sa sabay na takbo). |
| `server/db/pruneAuditLogs.js` | **NEW** | CLI para sa manual run / dry run. |
| `server/server.js` | MODIFIED | Tinatawag ang `startAuditRetentionJob()` pagka-listen. |
| `server/package.json` | MODIFIED | Bagong script `audit:prune`. |
| `server/.env.example`, `server/.env` | MODIFIED | `AUDIT_RETENTION_ENABLED`, `AUDIT_RETENTION_VIEW_DAYS`, `AUDIT_RETENTION_CHANGE_DAYS`, `AUDIT_ARCHIVE_DIR`. |
| `.gitignore` | MODIFIED | `server/archives/`. |
| `server/src/controllers/auditLog.controller.js` | MODIFIED | May `retention: { enabled, viewDays, changeDays }` sa response. |
| `client/src/pages/AuditLogPage.jsx` | MODIFIED | Maikling paalala sa ilalim ng title: gaano katagal ang views/changes bago ma-archive. |

**Na-test:** backup muna ng `audit_logs`; 1,509 na pekeng lumang entries (marked `e2e_test`) → dry run tama
(1500 view + 4 change); totoong run → 1504 na-archive (2 files, lahat valid JSON, walang duplicate, lagpas
1000 kaya nasubok ang batching), naiwan ang 3 view na 300 araw at 2 delete na 400 araw (tama), buo ang
totoong logs, may PRUNE log, 2nd run = 0; UI screenshot OK. Nilinis pagkatapos ang test rows at files.

---

## 11. UI Review at Pagpapaganda

Sinuri ang lahat ng page (desktop 1366px at mobile 400px, screenshots via Playwright + Edge) ayon sa
`dentavault-ui` skill at pangkalahatang UI principles, tapos inayos:

| # | Problema (bago) | Ayos |
|---|---|---|
| 1 | **X-ray thumbnails:** nagpapatong ang "compare" label at "Email/Manual" badge | Checkbox na lang (44px, may `aria-label`) sa itaas-kaliwa; "New" lang sa itaas-kanan; petsa + source sa bottom bar |
| 2 | **Dental Chart:** naka-fixed sa ~1056px kaya sa laptop nakatago ang ngipin 21–28, 31–38 | SVG `w-full` hanggang natural na laki, **min 600px** (phone: scroll pa rin para ma-tap nang tama ang surfaces). Tooth numbers 12→16, arch labels 8.5→13 para mabasa pa rin kapag lumiit |
| 3 | **Mobile profile:** natatago ang "X-rays" tab (lampas sa screen) | Maikling label sa phone (History / Chart / X-rays), pantay ang lapad |
| 4 | **Register form:** "Contact Number *" lang ang may marka; iba ang laki ng label ng Medical History/Allergies; walang Cancel | `required` prop sa `Field` (pulang `*` sa First/Last Name, DOB, Contact); subtitle "Fields marked * are required"; labels `text-base`; Cancel + submit sa footer (pati sa Edit modal) |
| 5 | **Mobile patient list:** tatlong full-width na button sa itaas | Export + Import magkatabi, Register buong lapad sa ilalim |
| 6 | **Print Summary** nasa header ng profile, kaya kita pa rin kahit nasa Dental Chart o X-rays tab (parang global, nakakalito) | Inilipat sa loob ng **Treatment History** tab (katabi ng "N treatments on record"), parehong istilo ng "Print Chart" sa Dental Chart tab. Bawat tab may sariling print na lang |

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/xray/XrayGallery.jsx` | MODIFIED | Bagong layout ng thumbnail overlay (#1). |
| `client/src/components/chart/Odontogram2D.jsx`, `Tooth.jsx` | MODIFIED | Scale-to-fit na may min-width; mas malaking label fonts (#2). |
| `client/src/pages/PatientProfilePage.jsx` | MODIFIED | Responsive tab labels (#3); Print Summary inilipat sa Treatment History tab (#6). |
| `client/src/components/patients/PatientForm.jsx` | MODIFIED | `Field required`, `onCancel` prop, footer na may Cancel (#4). |
| `client/src/components/common/QuickInputTextarea.jsx` | MODIFIED | Label `text-sm` → `text-base` (#4). |
| `client/src/pages/PatientRegisterPage.jsx`, `components/patients/EditPatientModal.jsx` | MODIFIED | Subtitle; Cancel button (#4). |
| `client/src/pages/PatientsListPage.jsx` | MODIFIED | Compact na mobile header buttons (#5). |

**Na-verify:** before/after screenshots (desktop + mobile); functional test: na-click ang ngipin 28 sa
pinaliit na chart → modal bumukas; 0px horizontal overflow sa laptop; X-ray compare gumagana; Cancel sa
Register at Edit modal gumagana.

**Hindi ginalaw (mungkahi lang):** sa mobile profile, nauuna ang Patient Details bago ang tabs (mahabang
scroll bago makarating sa chart/X-rays); ang Odontogram colors (`constants/dental.js`) ay hindi pa
color-blind validated (tignan Feature #6).

---

## 12. Color-blind Safe na Dental Chart Colors + Mobile Profile Order

**Pinapalitan nito ang bahagi ng #6 at #8:** hindi na magkaiba ang kulay ng odontogram at dashboard.

### A. Kulay ng mga kondisyon (iisang pinagmumulan: `constants/dental.js` → `CONDITIONS`)
Sinuri gamit ang `validate_palette.js --pairs all` (sa odontogram, kahit anong dalawang kondisyon
pwedeng magkatabi). Ang dating Tailwind colors ay **FAIL**: Root Canal (blue) vs Crown (purple) ay
**ΔE 0.9** sa deuteranopia (halos magkapareho). Sinubukan ang lahat ng 56 na 5-kulay na kombinasyon
mula sa validated palette; napili ang pinakamahusay (CVD ΔE **13**, normal-vision ΔE 16.3):

| Kondisyon | Dati | Ngayon |
|---|---|---|
| Healthy | `#22c55e` green | `#008300` green |
| Caries | `#ef4444` red | `#e87ba4` **magenta** (tanging malaking pagbabago, dahil hindi pumapasa ang red kasama ng green) |
| Filling / Restored | `#eab308` yellow | `#eda100` yellow |
| Root Canal | `#3b82f6` blue | `#2a78d6` blue |
| Crown / Bridge | `#a855f7` purple | `#4a3aa7` violet |
| Extracted / Missing | `#6b7280` gray | `#6b7280` gray (walang pagbabago) |

> ⚠️ **Ayon sa comment sa code, galing sa proposal ang dating color coding.** I-update din ang
> proposal/documentation (lalo na ang Caries: red → magenta/pink).

- **Dashboard** `CONDITION_CHART_ORDER` ay kumukuha na mismo sa `CONDITIONS` (hindi na kinopya), kaya laging tugma.
- **Procedures chart** ay inayos para tugma: Filling = yellow, Root Canal = blue, Crown = violet; Cleaning = green,
  Orthodontic = orange, Fluoride = aqua, Extraction = red (adjacent PASS, CVD 6.9 = WARN na pinapayagan dahil may label bawat bar).
- **Lumang 3D drawings** (`chart_entries.stroke_data`, 10 rows na may naka-save na lumang hex): ang kulay ay kinukuha na sa
  `condition_code` tuwing ipinapakita (`Tooth3D.jsx`), kaya sumusunod sa bagong palette. **Walang binago sa database.**
- Ang pulang panulat sa X-ray annotation (`XrayViewer.jsx`) ay hindi kondisyon, kaya hindi ginalaw.

### B. Mobile profile order
Dati sa phone: Patient Details → Actions → (mahabang scroll) → tabs. Ngayon: **Allergies/Medical History alert**
(kritikal bago mag-treatment) → **tabs** (History/Chart/X-rays) → Patient Details → Actions. Desktop: walang pagbabago.

| Name | Type | Purpose |
|---|---|---|
| `client/src/constants/dental.js` | MODIFIED | Bagong color-blind safe na `CONDITIONS` colors + paliwanag. |
| `client/src/constants/dashboardColors.js` | MODIFIED | Isinulat ulit: pinangalanang `HUE`, condition colors galing `dental.js`, bagong procedure mapping. |
| `client/src/components/chart/Tooth3D.jsx` | MODIFIED | Stroke color galing sa `condition_code`, hindi sa naka-save na hex. |
| `client/src/pages/PatientProfilePage.jsx` | MODIFIED | Mobile-only alert block sa itaas (`lg:hidden`), desktop alerts `hidden lg:block`, tabs `order-first lg:order-none`. |

**Na-verify:** build pasado; screenshots ng 2D chart, 3D chart (lumang drawings sumusunod sa bagong kulay),
dashboard; mobile vertical order: Allergies (154px) → Tabs (329px) → Patient Details (1143px).

---

## 13. Buong UI Redesign (Phase 1–3) + Official Logo

Hiling: gawing **mas madaling gamitin** at **mas polished** ang buong app, puwedeng baguhin ang layout,
at gamitin ang **official logo** ng clinic (galing sa `Desktop/LOGOS`). Pareho pa rin ang purple brand
at ang mga validated chart colors. Walang bagong library.

### Phase 1: Mabilis na ayos
- **Audit Log:** pangalan ng patient na ang nakikita, hindi `patient #1` / `xray_image #4` (salungat iyon
  sa #7). Hinahanap ng server ang patient mula sa entity (treatment, X-ray, chart entry, portal account,
  o `details.patientId`). Puwede nang i-search ang pangalan ng patient.
- **Readable na action labels:** "Viewed patient record", "Signed in", atbp. (nasa tooltip pa rin ang code).
  Pinagsasama ang magkakasunod na `VIEW_XRAY` sa isang row ("Viewed 6 X-rays"); display lang ito, buo pa
  rin ang bawat entry sa database.
- **Iisang date format** sa buong app (`Oct 1, 2026`), pati print pages.
- **Patient account:** "My Record" ang menu (dati "Patients") at may bating "Hi, Joselita!".
- "Migrated Record" (amber) → **"Imported"** (neutral).

### Phase 2: Layout
- **Patient Profile:** header card na may avatar, pangalan, edad/kasarian/birthday, Allergies at Medical
  History, contact details, at mga action (**Add Treatment**, Edit, at ⋯ menu para sa portal account at
  Delete). Buong lapad na ang tabs, kaya mas malaki ang Dental Chart sa laptop. Sa phone: header + alerts →
  tabs → contact details (tugma sa #12).
- **Add Treatment = modal** (dati form sa pinakailalim ng Treatment History). Timeline na ang listahan.
- **Patients list:** avatar, buong row clickable, Edit/Delete nasa ⋯ menu (iwas maling pindot ng Delete),
  "Last visit: 2 days ago", at **pagination** (dati 20 lang ang lumalabas, walang Next).
- **Dashboard:** bati + petsa, quick actions (Find patient, Register), trend chart na may y-axis, gridlines,
  at tooltip (dumaan sa dataviz skill), at Recent Activity na readable at may pangalan ng patient (hindi na
  kasama ang pagbukas ng dashboard, audit log, at matagumpay na login).
- **Find patient (Ctrl+K):** mabilisang paghahanap ng patient mula sa kahit anong page (dentist lang).
- **Login:** split layout, **official logo PNG** sa itaas ng form, show/hide password.

### Phase 3: Polish
- Empty states (icon + paliwanag + button), skeleton loaders sa mga listahan, compact na chart legend na
  may tagubilin, sidebar na may official mark at avatar ng user, sticky na Save/Cancel sa Register form.
- **Official logo** sa print headers (Summary, Chart, X-ray). **Bagong favicon at PWA app icons** mula sa
  official mark.

| Name | Type | Purpose |
|---|---|---|
| `client/src/assets/brand/teodosio-rufin-logo.png`, `teodosio-rufin-mark.svg` | **NEW** | Official logo (kopya mula LOGOS) at mark (tinanggal ang 8KB na metadata). |
| `client/public/favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | MODIFIED | Official mark (puti sa purple ang PWA icons). |
| `client/src/components/common/BrandMark.jsx` | **NEW** | Official mark bilang CSS mask (sumusunod sa `text-*` color). Pinalitan ang `ToothIcon.jsx` (**binura**). |
| `client/src/components/common/{Avatar,DropdownMenu,EmptyState,Skeleton,PrintHeader,PatientSearchPalette}.jsx` | **NEW** | Shared UI pieces (tignan ang `dentavault-ui` skill). Lazy-loaded ang palette (Feature #9). |
| `client/src/utils/formatDate.js`, `patientName.js` | **NEW** | Date format/edad (local parsing, walang UTC day shift), at pangalan. (Ang `patientSearch.js` na ginawa rito ay binura sa #14.) |
| `client/src/utils/auditAction.js` | MODIFIED | `actionLabel`, `formatAuditDetails` (tago ang patientId), `auditPatientName`, `groupAuditLogs`. |
| `server/src/models/auditLogModel.js` | MODIFIED | `AUDIT_FROM` (LEFT JOINs para sa `patient_name`), search sa pangalan ng patient, `excludeActions`. |
| `server/src/controllers/dashboard.controller.js` | MODIFIED | Recent Activity: 20 entries, walang VIEW_DASHBOARD/VIEW_AUDIT_LOG/LOGIN_SUCCESS. |
| `client/src/pages/{Login,Dashboard,PatientsList,PatientProfile,AuditLog,PatientRegister}Page.jsx` | MODIFIED | Tignan ang Phase 1–3 sa itaas. |
| `client/src/pages/{PatientSummary,Chart,Xray}PrintPage.jsx` | MODIFIED | `PrintHeader` (logo) + iisang date format. |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Official mark, Find patient + Ctrl+K, "My Record", avatar ng user. |
| `client/src/components/dashboard/{MonthlyTrendChart,StatTile}.jsx` | MODIFIED | Axis/gridlines/tooltip/sr-only table; sentence-case tiles na puwedeng link. |
| `client/src/components/patients/{AddTreatmentForm,PatientForm}.jsx` | MODIFIED | Modal footer (Cancel + Save Treatment); `stickyFooter` prop. |
| `client/src/components/xray/{XrayGallery,PatientXraysSection,CompareView}.jsx`, `chart/{Odontogram2D,ChartEntryModal}.jsx` | MODIFIED | Empty state, date format, compact legend. |
| `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | Bagong shared helpers at patterns. |
| `.gitignore` | MODIFIED | `ui-review-login.txt` (local test login para sa screenshots, hindi kino-commit). |

**Na-verify (local, Edge via Playwright):** 22/22 functional tests: login (mali/tamang password, show password),
dashboard feed, register (sticky button), Add Treatment modal, empty states, Edit modal, Ctrl+K → Enter,
"Viewed 6 X-rays" grouping, walang numeric ID sa Audit Log, search by patient name, row click, ⋯ menu → Delete,
logo sa print, patient account (My Record lang, walang dentist actions). Walang console error (maliban sa
inaasahang 401 ng maling password). Screenshots desktop (1366px) at phone (400/360px), **0px horizontal
overflow**. Audit query nasubok sa MariaDB (local) at MySQL 8 (Aiven). Build pasado; main bundle 242.7 KB
(dati 239 KB). Ang mga test patient ("E2ETest Burahin") ay na-delete pagkatapos.

**Hindi pa nagagawa / paalala:**
- **Hindi pa naka-push.** Kailangan munang i-check ng team bago i-deploy.
- ~~Hindi naka-link ang mga label ng `PatientForm` sa input nito.~~ Naayos sa #14.
- Ang `npm run dev` ng server ay nagre-restart nang kusa minsan dahil sa OneDrive sync. Gamitin ang
  `npm start` kapag nagte-test nang matagal.

---

## 14. Responsive (Phone/Tablet), Top Navigation, at Pangalan ng Dentist

Puna pagkatapos ng #13: maganda na, pero hindi responsive sa phone/tablet; "Dr. Rufin" ang bati (dapat
**Teodosio-Rufin**, iisang apelyido); at parang bakante ang sidebar dahil tatlo lang ang menu.

### A. Sidebar → Top bar + bottom tab bar
- **Lahat ng screen:** puting top bar na may official mark, menu (Dashboard / Patients / Audit Log) sa
  md pataas, Find patient (icon sa tablet, buong search box sa laptop), at **user menu** (avatar → pangalan,
  role, Sign out). Wala nang sidebar, kaya **buong lapad** na ang content (hanggang 1600px).
- **Phone:** **bottom tab bar** (parang mobile app): isang tap lang para lumipat ng page, abot ng hinlalaki.
  Dati nakatago sa hamburger (dalawang tap). Wala ito sa patient account (iisa lang ang menu niya).
- Tinanggal ang "Find patient" sa Dashboard (nasa top bar na sa bawat page) at ang `utils/patientSearch.js`.

### B. Pangalan
Naka-save ang pangalan bilang "Teodosio Rufin" (walang gitling), kaya huling salita lang ("Rufin") ang
nakukuha ng bati. Inayos ang mismong data: **migration 009** → "Dr. Nolita Reloj Teodosio-Rufin" (at sa
`seed.js`). Ngayon "Good evening, Dr. Teodosio-Rufin", at ganito na rin sa top bar, Audit Log, at "by ..." ng treatments.
> ⚠️ **Kailangang patakbuhin din sa Aiven bago/kasabay ng push:** `$env:DOTENV_CONFIG_PATH=".env.aiven"; npm run migrate` (sa `server/`).

### C. Mga responsive na ayos
| Saan | Problema | Ayos |
|---|---|---|
| Top bar (768px) | "Audit Log" / "Find patient" nahahati sa 2 linya | `whitespace-nowrap`; icon lang ang search sa tablet |
| Patients (768px) | "Export / CSV" at mga cell nahahati | Buttons sa sariling hanay hanggang lg; nowrap cells; "Registered" column lg pataas lang |
| Audit Log (768–1023px) | 6 column, badges 3 linya | Cards hanggang lg (2 column sa tablet); 1 hanay ng filters sa laptop; role sa ilalim ng pangalan |
| Lahat ng badge | nahahati sa makitid na column | `whitespace-nowrap` sa `StatusBadge` |
| Profile (360px) | "Add Treatment" 2 linya | Icon lang ang Edit sa phone (may `aria-label`) |
| Profile (1024px) | contact details 2 column, mataas | 3 column sa lg |
| Dashboard (360px) | "Register patient" at KPI labels nahahati | Buong-lapad na button; KPI icon sm pataas lang; non-breaking hyphen sa "X‑rays" |
| Register (phone) | 2 nakasalansang button sa sticky footer (~120px) | Magkatabi; nasa ibabaw ng bottom tab bar |
| Toasts (phone) | 320px sa kanan-ibaba, matatakpan ng tab bar | Buong lapad, nasa ibabaw ng tab bar; X button may `aria-label` at 40px |
| Medical History / Allergies presets | ~22px chips, siksik sa tabi ng label | 36px chips, nasa ilalim ng label sa phone |

### D. Bugs (luma)
- **Form labels hindi naka-link sa input** (`PatientForm` `Field`, `QuickInputTextarea`): may `htmlFor`/`id`
  na (useId), pati `aria-invalid` / `aria-describedby` sa error. Napipindot na rin ang label para i-focus.

| Name | Type | Purpose |
|---|---|---|
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Isinulat ulit: top bar + bottom tab bar + user menu; walang sidebar. |
| `client/src/components/common/DropdownMenu.jsx` | MODIFIED | Optional `trigger`, `triggerClassName`, `header` (para sa user menu); `max-w` sa phone. |
| `client/src/context/ToastContext.jsx` | MODIFIED | Posisyon sa phone (ibabaw ng tab bar), dismiss button `aria-label` + touch target. |
| `client/src/components/common/StatusBadge.jsx` | MODIFIED | `whitespace-nowrap`. |
| `client/src/components/common/QuickInputTextarea.jsx` | MODIFIED | Label link, mas malaking presets, stacked sa phone, `text-base`. |
| `client/src/components/patients/PatientForm.jsx` | MODIFIED | `Field` may useId/htmlFor/aria; footer magkatabi; sticky footer sa ibabaw ng tab bar. |
| `client/src/components/dashboard/StatTile.jsx` | MODIFIED | Icon sm pataas lang. |
| `client/src/pages/{Dashboard,PatientsList,AuditLog,PatientProfile,PatientRegister}Page.jsx` | MODIFIED | Tignan ang table C. |
| `client/src/utils/patientSearch.js` | **BINURA** | Wala nang gumagamit (nasa top bar na ang search). |
| `server/db/migrations/009_fix_dentist_surname.sql` | **NEW** | "Teodosio Rufin" → "Teodosio-Rufin" (eksaktong lumang pangalan lang ang tinatamaan). Napatakbo na sa local. |
| `server/db/seed.js` | MODIFIED | Bagong pangalan para sa bagong install. |
| `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | Navigation pattern, responsive checklist (360/768/1024/1366). |

**Na-verify (local, Edge via Playwright):** responsive sweep sa **360, 400, 768, 1024, 1366px**: 12 screen bawat
lapad (login, dashboard, patients, register, audit log, profile ×3 tabs, Add Treatment modal, account menu,
search, patient view) = 60 screen, **0 horizontal overflow, 0 page errors**. Phone viewport checks (7/7): tab bar
nasa ibaba at gumagana ang tap, huling card hindi natatakpan, sticky Register button at toast nasa ibabaw ng tab
bar, account menu kasya sa screen. Functional e2e 22/22 pa rin. Build pasado (main bundle 245 KB).
**Hindi pa naka-push.**

---

## 15. Mga Form: Bug Fixes, Kaligtasan ng Pasyente, at Usability (A + B + C)

Review ng lahat ng form (Register, Edit, Add Treatment, Dental Chart entry, X-ray upload, Portal account, Import,
Login) gamit ang code, screenshots, at API tests. Lahat ng nakita ay inayos. Required na ang **Allergies** at **Sex**
(desisyon ng team).

### A. Mga bug na naayos (lahat kumpirmado bago ayusin)
| # | Bug | Ayos |
|---|---|---|
| 1 | **Add Treatment: kahapon ang default na petsa bago mag-8 AM** (UTC ang `toISOString`). Ganito rin ang CSV filename | `todayISO()` (local) sa `utils/formatDate.js` |
| 2 | **Walang limit ang haba ng input.** Local: tahimik na pinuputol (300 → 255 char address). Aiven (strict): 500 error | `FIELD_LIMITS` sa server (`utils/validators.js`, = laki ng DB column) + `maxLength` sa client + row errors sa Import |
| 3 | **Chart modal: hindi kailanman nagha-highlight ang single surface** (`top/left` vs `mesial/lingual`) | `toothOrientation()` mapping, gaya ng 2D chart |
| 4 | Chart modal: raw code ("root_canal") | `conditionLabel()` |
| 5 | Import modal: "Migrated Record" pa rin | "Imported" |
| 6 | Add Treatment: browser popup ang validation; "Save Treatment" nahahati sa phone | Sariling inline errors; nowrap |
| 7 | Register: kapag naka-scroll sa ibaba, wala sa screen ang mga error | Scroll + focus sa unang mali; server error/duplicate sa footer |
| 8 | Bakanteng `<label>` sa Medical History | Tinanggal ang `Field` wrapper |
| 9 | "Copied ✓" kahit pumalya ang copy | Chine-check ang resulta; may "Couldn't copy" na mensahe |
| + | **Sobrang laking X-ray file = "Internal server error"** (walang status ang MulterError) | 413 + malinaw na mensahe (`errorHandler.js`) |

### B. Kaligtasan ng pasyente at kalidad ng data
- **Allergies required** (client + server, Register at Edit). Blangkong lumang record = **"Not recorded yet"** (amber), hindi "None".
- **Sex required, walang default** (dati "Male" na agad): dalawang button (Female/Male). Label "Sex" na (dati "Gender").
- **Duplicate warning** (pareho ang pangalan at birthday): "Open existing record" o "Different person, register anyway"
  (server: 409 maliban kung `allowDuplicate: true`).
- **Bawal ang future na petsa** (birthday, treatment, X-ray date taken): `max` sa date picker + server check gamit ang
  oras sa Pilipinas (`CLINIC_TIMEZONE`, default `Asia/Manila`; UTC ang Render).
- **Presets:** toggle na (pindutin ulit para tanggalin); ang "None" ay nagtatanong muna bago palitan ang listahan.

### C. Usability
- Number pad sa phone (`type="tel"`), walang autofill ng browser sa patient fields, auto-capitalize ng pangalan.
- Tumatanggap ng "0917 123 4567" / "0917-123-4567" (nililinis sa client at server). May hint sa ilalim ng field.
- **Babala bago mawala ang binago** (Register, Edit, Add Treatment): Cancel / X / Escape → "Keep editing / Discard";
  Register: pati pagsara/refresh ng tab.
- **Add Treatment:** procedures bilang malalaking button, "Add another treatment after saving". Kita ang Save nang
  hindi nag-i-scroll sa laptop (1366×768), tablet (768), at 390px phone; sa 360×760 na phone, kaunting scroll sa loob
  ng modal (mas mataas na limit ng Modal body: `100dvh − 8.5rem`, dati `75vh`).
- **X-ray upload:** preview, drag-and-drop, check ng uri at laki bago mag-upload.
- **Chart modal:** Cancel button, radio semantics.
- **Import:** file picker muna; nakatiklop ang instructions ("How importing works"); 2×2 results sa phone.
- **Portal account:** "Print slip" para sa pasyente, linked labels.
- **Pagpalit ng password sa unang login:** ang temporary password mula sa dentist ay kailangang palitan bago makagamit
  ng app. **Server-side:** `must_change_password` (migration 010) → nasa JWT → 403 sa lahat ng API maliban sa
  `/auth/me` at `/auth/change-password`. Bagong page `/change-password` (sapilitan, o kusa mula sa account menu
  "Change password"). Naka-log bilang "Changed own password".

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/010_add_must_change_password.sql` | **NEW** | `users.must_change_password`. Napatakbo na sa local. **Kailangang patakbuhin sa Aiven bago/kasabay ng push.** |
| `server/src/utils/validators.js` | **NEW** | `FIELD_LIMITS`, `clinicToday()`, `notInFuture`, `stripPhoneFormatting`. |
| `server/src/routes/{patients,xrays,chart,auth}.routes.js` | MODIFIED | Lengths, future dates, allergies required, phone cleanup, `/auth/change-password`. |
| `server/src/controllers/{patients,auth}.controller.js` | MODIFIED | Duplicate 409; portal create/reset = must change; `changePassword`. |
| `server/src/services/authService.js` | MODIFIED | `signToken` (may `mustChangePassword`), `changePassword()`. |
| `server/src/middleware/{auth,errorHandler}.js`, `utils/AppError.js` | MODIFIED | 403 hangga't hindi napapalitan; MulterError → 413; `extra` fields sa error JSON. |
| `server/src/models/userModel.js`, `services/patientImportService.js` | MODIFIED | Flag sa create/update/findById; length checks bawat import row. |
| `client/src/pages/ChangePasswordPage.jsx` | **NEW** | Sapilitan/kusang pagpalit ng password. |
| `client/src/hooks/useDiscardGuard.js`, `components/common/DiscardChangesBar.jsx` | **NEW** | Babala bago mawala ang binago. |
| `client/src/components/patients/PortalCredentials.jsx` | **NEW** | Shared: credentials (Copy/Print slip/Done) + `TemporaryPasswordField`. |
| `client/src/constants/fieldLimits.js` | **NEW** | Kapareho ng server `FIELD_LIMITS` + X-ray max size. |
| `client/src/components/patients/{PatientForm,AddTreatmentForm,EditPatientModal,CreatePortalAccountModal,ResetPortalPasswordModal,ImportPatientsModal}.jsx` | MODIFIED | Tignan A/B/C. |
| `client/src/components/common/{QuickInputTextarea,MedicalAlertBadge,ProtectedRoute,Modal}.jsx` | MODIFIED | Presets, "Not recorded", forced password change, modal height. |
| `client/src/components/chart/ChartEntryModal.jsx`, `components/xray/UploadXrayForm.jsx` | MODIFIED | Tignan A/C. |
| `client/src/pages/{PatientRegister,PatientProfile}Page.jsx`, `App.jsx`, `context/AuthContext.jsx`, `layouts/AppLayout.jsx` | MODIFIED | Guard, duplicate, route, `changePassword()`, "Change password" sa account menu. |
| `client/src/services/patients.js`, `utils/{formatDate,auditAction}.js` | MODIFIED | Local date sa CSV; `todayISO()`; label ng CHANGE_OWN_PASSWORD. |
| `DEPLOYMENT.md`, `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | `CLINIC_TIMEZONE`, Gotcha #8 (migrations sa Aiven); form conventions. |

**Na-verify (local):** API tests **25/25** (required/length/future/phone/duplicate/password flow + 403 block);
forms e2e **41/41** sa Edge (lahat ng nasa A/B/C, kasama ang first-login password change at Escape-guard);
regression: functional **22/22**, phone **7/7**, responsive sweep **60/60** (0 overflow), build pasado (main 246 KB).
Lahat ng test data (patients, portal accounts) ay nilinis pagkatapos.
**Hindi pa naka-push.** Hindi rin isinama ang middle name at relationship field ng emergency contact (kailangan ng
desisyon at migration); may hint muna sa Contact Name na isama ang relationship.

### 15a. "Forgot password" vs "Change password" (puna ng team)
Parang salungat dati: may "Change password" na sa loob ng app, pero "Ask the clinic to reset it" ang nasa login.
Magkaibang sitwasyon talaga sila: **Change password** = alam pa ang password; **Forgot** = hindi na makaka-login.
- **Walang self-service email reset, sinadya:** sandbox ang Mailgun domain (sa mga na-verify na address lang
  makakapagpadala, hindi sa mga pasyente), at walang email-sending code ang app. Mas ligtas din para sa medical records:
  kilala ng clinic ang pasyente nang personal, naka-log ang bawat reset, at **sapilitang papalitan** ng pasyente ang
  temporary password pagka-login (#15C), kaya hindi alam ng clinic ang huling password.
- **Ayos:** dalawang malinaw na linya na sa login page (`LoginPage.jsx`): "Forgot your password? Contact the clinic for
  a temporary password. You'll set a new one right after you sign in." at "To change a password you know, sign in and
  open your account menu."
- **Dentist account:** kapag nakalimutan, `node db/seed.js <email> "<bagong password>"` sa server (tignan DEPLOYMENT.md).
- **Kung gusto sa hinaharap:** email reset link kapag may verified na Mailgun domain (kailangan ng token table,
  expiry, at rate limit).

---

## 16. Bagong 3D Teeth Model (Procedural, Hiwalay ang Upper at Lower)

**Problema (dati):** iisang set ng 8 crown (galing sa "Teeth by Poly by Google") ang ginagamit ng upper at lower, kaya
pareho ang hugis ng lower molars sa upper. Ang mga kondisyon ay nakalutang na "plane panels" sa harap ng ngipin, hindi
nakapinta sa mismong surface.

**Ayos:** 16 na bagong ngipin (8 upper + 8 lower) na **ginawa ng sarili nating procedural generator**
(`generate_teeth.py`). Walang third-party license na kailangang i-credit.

- **Prep script** (`prep-procedural-teeth.cjs`): bina-bundle ang 16 GLB papunta sa iisang `teeth.glb` (nodes
  `Tooth1..8`, `LowerTooth1..8`) at hinahati ang bawat ngipin sa **5 surface region** gamit ang UV atlas
  (occlusal / facial / lingual / mesial / distal). Ang occlusal ay batay sa taas **at** sa direksyon ng surface (normal),
  para hindi tusok-tusok ang kulay sa molars. Gumagawa rin ng `teethExtents.json` (laki ng bawat ngipin, para sa arch spacing).
- **Kondisyon nakapinta na sa surface mismo:** buong UV cell ang kinukulayan (alpha 0.72) kapag walang drawing; kapag may
  naka-save na drawing (`stroke_data`), yung stroke ang ipinapakita.
- **Mirror:** ang kaliwang side ng bibig ay naka-mirror (negative scale X), kaya **laging nakaharap sa midline ang mesial**
  sa lahat ng 4 na quadrant. Dahil dito, simple na ang pag-detect ng surface: `surfaceForUV()` (kung saang UV cell
  tumama ang drawing). Tinanggal na ang lumang `classifySurface` at `mesialMap`.
- **Arch:** ang pwesto ng ngipin ay batay sa totoong lapad ng bawat isa (`TOOTH_GAP` 0.04), naka-angkla sa gilagid
  (`CERVICAL_Y`). Ang tooth number labels ay nasa harap ng gilagid at hindi na naka-mirror kapag tinitingnan mula sa likod.
- **Extracted:** abo at translucent, at hindi pwedeng drawing-an (walang ink layer).
- **Laki ng file:** `teeth.glb` ~1.5 MB (KHR_mesh_quantization). Lazy pa rin, dina-download lang pagbukas ng 3D Chart.

> ⚠️ **Caveat sa lumang drawings:** ang mga 3D stroke na na-save **bago** ang pagbabagong ito sa mesial/distal ng ngipin
> na dating hindi naka-mirror ay maaaring lumabas sa kabilang gilid ng ngipin. Tama pa rin ang naka-save na `surface`
> at ang 2D chart, ang posisyon lang ng lumang guhit sa 3D ang posibleng iba.

| Name | Type | Purpose |
|---|---|---|
| `client/scripts/prep-procedural-teeth.cjs` | **NEW** | 16 GLB → `teeth.glb` + `teethExtents.json`; region per triangle; UV atlas; quantized output. Gamit: `node scripts/prep-procedural-teeth.cjs <folder ng tooth1..16.glb>`. |
| `client/scripts/teeth-source/generate_teeth.py`, `README.md` | **NEW** | Ang generator at paano mag-regenerate. |
| `client/src/assets/models/teeth.glb` | MODIFIED (pinalitan) | Bagong 16 na ngipin. Ang luma ay nasa git history. |
| `client/src/assets/models/teethExtents.json` | **NEW** | Lapad/taas/kapal ng bawat ngipin. |
| `client/src/components/chart/Tooth3D.jsx` | MODIFIED | `toothNodeName` (upper/lower), `toothExtents`, `surfaceForUV`, bagong `SurfaceLayer` (fills + strokes, pinalitan ang HistoryInkLayer at plane panels), mirror group, bagong material, label. |
| `client/src/components/chart/Odontogram3D.jsx` | MODIFIED | Arch spacing batay sa extents, `toothTransform` (may `labelY`, `mesialOnPositiveX`), Save Mark gamit `surfaceForUV`. |
| `client/scripts/extract-tooth-set.cjs`, `extract-tooth-model.js` | (hindi ginalaw) | Luma, **hindi na ginagamit**; iniwan bilang reference. |

**Na-verify (local, Edge via Playwright):** drawing test **14/14**: pen off = orbit lang; pen on → pending banner; 2nd stroke;
naka-lock ang ibang ngipin habang may pending; Undo; Discard; Save Mark → modal "Tooth 22 — Facial / Buccal" → save →
nananatili pagka-reload (at lumalabas sa 2D/print bilang Facial); surface detection: 11 Mesial, 21 Mesial, 32 Facial.
Mirror test (mesial = pink, distal = yellow sa 12 ngipin, 4 quadrant): lahat ng pink ay nakaharap sa midline.
Regression: functional **22/22**, forms **41/41**, phone **7/7**, sweep **60/60**, 2D chart + Print Chart OK, 3D sa
768px at 400px OK, 0 console errors, build pasado. Nilinis ang test patients. **Hindi pa naka-push.**

---

## 17. Mas Realistic na Gums at Pwesto ng Ngipin (3D Chart)

**Problema (dati):** bilog na arko (75°) ang pwesto ng mga ngipin, kaya ~10 cm ang lapad sa likod at mababaw: parang
pamaypay, hindi bibig. Ang gums ay simpleng tubo na nakalutang sa itaas at ibaba ng ngipin.

**Ayos:**
- **Totoong hugis ng arch (ovoid):** batay sa karaniwang sukat ng adult (mm): bilugan sa harap, halos tuwid ang molars
  sa likod. Mas makitid ang lower sa harap. 1 unit ≈ 10 mm (tugma sa lapad ng mga ngipin sa model, kaya halos eksaktong
  tumatama ang bawat ngipin sa karaniwang posisyon nito).
- **Normal na kagat:** ang upper ay nasa harap at labas ng lower (overjet ~2.3 mm). Lahat ng dulo ng crown ay nasa iisang
  occlusal plane, bahagyang nakabuka para makita at madrawingan pa rin ang biting surfaces.
- **Hilig ng ngipin:** ang incisors ay nakahilig pasulong (upper 14°/11°, lower 9°/8°), bahagya ang canine, tuwid ang likod.
  Umiikot sa leeg ng ngipin, kaya nananatiling nakabaon sa gums.
- **Bagong gums (`Gingiva.jsx`)**, parang dental study model: scalloped na gilid na kumukurba sa leeg ng bawat ngipin at
  tumutulis sa pagitan (papilla); facial at lingual na pader na may umbok; maputla malapit sa ngipin, mas mapula sa itaas;
  basang kinang; bilugang dulo sa likod ng huling molar; at **palate** (ngalangala) sa upper.
- **Mas magkakadikit ang ngipin** (`TOOTH_GAP` 0.04 → 0.015), parang totoong contact points.
- **Tooth number** nakadikit sa gums, puti na may outline para mabasa sa pink.
- Camera at ilaw inayos (hemisphere fill light) para kita ang buong harap ng arch, pati sa phone.
- **Walang binago sa data, drawing, o classification.** Pareho pa rin ang geometry ng bawat ngipin (UV), kaya ang mga
  naka-save na drawing ay nasa parehong lugar pa rin sa ngipin.

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/chart/archLayout.js` | **NEW** | Arch curves (mm control points → CatmullRom, arc-length), `ARCHES`, `toothPlacement()` (pivot sa cervical line, `rotationY`, `tiltX`, mirror), `archFrame()`, `marginAt()` (scalloped), `thicknessAt()`. |
| `client/src/components/chart/Gingiva.jsx` | **NEW** | Gum mesh (sweep ng cross-section sa kahabaan ng arch, vertex colors) + palate. Pinalitan ang `GumRidge`. |
| `client/src/components/chart/Odontogram3D.jsx` | MODIFIED | Gumagamit ng `archLayout`/`Gingiva`; tinanggal ang lumang circular arc at `GumRidge`; camera, target, hemisphere light. |
| `client/src/components/chart/Tooth3D.jsx` | MODIFIED | `position` = leeg ng ngipin; bagong `tiltX` prop; pinagsama ang flip/mirror/lift sa isang group; puting label na may outline. |

**Na-verify (local, Edge via Playwright):** drawing test **14/14** (pen, undo, discard, lock, save, reload; 22 Facial, 11 at 21
Mesial, 32 Facial), plus occlusal ng molar 48 mula sa side view; mirror test (mesial nakaharap sa midline sa lahat ng quadrant);
functional 22/22, phone 7/7, sweep 60/60; 2D/Print Chart OK; 3D sa 768px at 400px OK; 0 console errors; build pasado.
Nilinis ang test patients. **Hindi pa naka-push.**

---

## 18. Bagong Navigation (Sidebar) + X-ray Inbox + Legacy Record Migration + Settings

Batay sa mockup at sa proposal paper (`DENTAVAULT_FORSOFTBIND.pdf`): "Legacy Record Migration" (bulk import via
CSV/Excel templates + guided manual entry for treatment histories), "notifies the dentist" kapag may X-ray galing email,
at ang Notifications/Alerts sa dashboard wireframe. **Hindi** ginawa ang top-level "Dental Chart" (laging para sa
isang patient, nasa profile na) at "Feedback" (wala sa proposal).

### A. Navigation
- **lg pataas: sidebar** (logo, Find patient, menu, account sa ibaba). Phone/tablet: top bar + **bottom tab bar**
  (Dashboard, Patients, X-rays, Audit Log, **More** → Migration, Settings). Bumalik ang sidebar dahil 6 na ang menu.
- Ang badge ng bagong email X-ray ay nasa **X-ray Inbox** na (dati sa Patients).
- Patient account: My Record + Settings. Account menu: Settings, Change password, Sign out.
- Dahil hanggang `lg` na ang bottom bar, ang sticky Register footer at toasts ay `lg:bottom-0` na (dati `md`).

### B. X-ray Inbox (`/xrays`, dentist)
- Lahat ng X-ray na dumating sa email, buong clinic: **New** (hindi pa nabubuksan) / **All from email**.
- **Open** → profile ng patient, diretso sa X-rays tab (doon nagiging "reviewed", gaya ng dati). **Mark reviewed** nang
  hindi binubuksan. Dashboard tile "Unreviewed X-rays" → dito.
- **Emails from unknown senders** (huling 90 araw, galing sa audit log `INBOUND_XRAY_EMAIL_UNMATCHED`): hindi naiimbak
  ang mga ito, kaya dito lang makikita para maidagdag ang email sa tamang patient.

### C. Legacy Record Migration (`/migration`, dentist) — pinalitan ang Import modal
- **Bulk Import**, 5 hakbang gaya ng mockup: Upload → **Map Columns** (auto-match: "First Name", "Surname", "Gender",
  "Birthdate", "Phone"...; puwedeng palitan) → **Validate** (dry run sa server, walang isinusulat) → **Preview &
  Confirm** → Complete. CSV o JSON; Excel = "Save As CSV" (walang bagong library).
- **Manual Entry**: hanapin ang patient (o i-register muna), i-encode ang lahat ng lumang visit (date, procedure, tooth,
  notes), isang Save. Sinusuri muna ng server ang **lahat**: kapag may mali, walang mase-save at sinasabi ang row.
- Ang "Import Records" sa Patients ay link na papunta rito. Gumagana pa rin ang lumang CSV format (walang mapping).

### D. Settings (`/settings`, dentist at patient)
Account (pangalan, email, role, Change password), **email ng clinic para sa X-ray** (bagong `CLINIC_XRAY_EMAIL` sa
`.env`; ang address na naka-set sa Mailgun route), at para sa dentist: gaano katagal itinatago ang audit log.
Habang wala pang `CLINIC_XRAY_EMAIL`, ang nakikita ng dentist ay "The clinic’s X-ray email address will appear here once it
is ready, so you can share it with patients." (dati teknikal na tagubilin tungkol sa server settings, binago ayon sa puna ng
team). Patient: "Ask the clinic for the email address where you can send your X-rays."

| Name | Type | Purpose |
|---|---|---|
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Sidebar (lg+), top bar + bottom tab bar + `MoreMenu` (below lg), bagong menu items, badge sa X-ray Inbox. |
| `client/src/pages/XrayInboxPage.jsx` | **NEW** | Inbox: filter, table/cards, Open, Mark reviewed, pagination, unknown senders. |
| `client/src/pages/MigrationPage.jsx` | **NEW** | Pagpili ng Manual Entry / Bulk Import. |
| `client/src/components/migration/BulkImportWizard.jsx` | **NEW** | 5-step wizard (stepper, mapping, dry run, confirm). |
| `client/src/components/migration/LegacyTreatmentEntry.jsx` | **NEW** | Patient picker + maraming lumang visit, batch save. |
| `client/src/components/migration/ImportResultLists.jsx` | **NEW** | Bilang at listahan ng resulta (galing sa lumang modal). |
| `client/src/pages/SettingsPage.jsx`, `services/settings.js` | **NEW** | Settings page at API wrapper. |
| `client/src/components/patients/ImportPatientsModal.jsx` | **BINURA** | Pinalitan ng Migration page. |
| `client/src/App.jsx` | MODIFIED | Routes `/xrays`, `/migration` (dentist), `/settings` (lahat). |
| `client/src/pages/PatientsListPage.jsx` | MODIFIED | "Import Records" → link sa `/migration`. |
| `client/src/pages/PatientProfilePage.jsx`, `utils/selectedPatient.js` | MODIFIED | `profileState(code, { tab })`: bumubukas sa tamang tab. |
| `client/src/pages/DashboardPage.jsx` | MODIFIED | Unreviewed X-rays tile → `/xrays`. |
| `client/src/services/{xrays,patients,patientImport}.js` | MODIFIED | `getXrayInbox`, `markXrayReviewed`, `addTreatmentsBatch`, `previewImportFile`, `importPatientsFile(file, { mapping, dryRun })`. |
| `client/src/utils/auditAction.js` | MODIFIED | Labels: VIEW_XRAY_INBOX, MARK_XRAY_REVIEWED, MIGRATE_TREATMENT_HISTORY. |
| `client/src/components/patients/PatientForm.jsx`, `context/ToastContext.jsx` | MODIFIED | `md:bottom-0` → `lg:bottom-0` (bottom bar hanggang lg na). |
| `server/src/models/xrayModel.js` | MODIFIED | `listInboxXrays({ status, limit, offset })` (JOIN patients, walang numeric patient id sa response). |
| `server/src/models/auditLogModel.js` | MODIFIED | `listUnmatchedInboundEmails()`. |
| `server/src/controllers/xrays.controller.js`, `routes/xrays.routes.js` | MODIFIED | `GET /xrays/inbox`, `PUT /xrays/:id/reviewed` (dentist). |
| `server/src/services/patientImportService.js` | MODIFIED | Orihinal na headers, `suggestMapping()` (aliases), `previewImport()`, `importPatients(..., { mapping, dryRun })`. |
| `server/src/controllers/patientImport.controller.js`, `routes/patients.routes.js` | MODIFIED | `POST /patients/import/preview`, `?dryRun=1`, `mapping`; `POST /patients/:code/treatments/batch`. |
| `server/src/controllers/patients.controller.js` | MODIFIED | `addTreatmentsBatch` (max 50, all-or-nothing validation, audit `MIGRATE_TREATMENT_HISTORY`). |
| `server/src/controllers/settings.controller.js`, `routes/settings.routes.js`, `routes/index.js` | **NEW**/MODIFIED | `GET /api/settings`. |
| `server/.env.example` | MODIFIED | `CLINIC_XRAY_EMAIL`. |
| `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | Bagong navigation pattern. |

**Na-verify (local, Edge via Playwright + API):** bagong API tests **23/23** (inbox, mark reviewed, preview/auto-map, dry run
walang isinusulat, kulang na mapping = 422, totoong import, lumang format, batch + all-or-nothing); navigation/flow E2E
**54/54** (sidebar sa 1366, bottom bar + More sa 768 at 390, tile → inbox, Open → X-rays tab, buong wizard hanggang
Complete, manual entry 2 visit, Settings, account menu; 0 overflow, 0 console error); patient: My Record + Settings lang,
`/xrays` at `/migration` → sariling record. Regression: functional 22/22, forms 41/41, phone 7/7, sweep 60/60, API 25/25.
Build pasado (main 251 KB). Nilinis ang test data. **Hindi pa naka-push.**

### 18a. Lazy loading ng mga bagong page (paalala ng adviser, tugma sa #9)
- Ang `XrayInboxPage`, `MigrationPage`, at `SettingsPage` ay `lazy()` na sa `App.jsx` (hiwalay na file bawat isa).
- **Dagdag:** sa loob ng Migration, lazy rin ang `BulkImportWizard` at `LegacyTreatmentEntry`. Ang napiling paraan
  lang ang dina-download (may `<Suspense>` + `PageLoader`). `MigrationPage` 7.5 KB → 1.5 KB gzip.
- Kaya maaaring hindi mapansin ang loader: maliliit ang files (2–5 KB gzip), at sa live site, dina-download na ng
  service worker ang lahat ng page sa background pagkatapos mag-load (para sa offline, tingnan #9).
- **Na-verify sa production build** (`vite preview`, naka-block ang service worker): Login → LoginPage lang;
  Dashboard → DashboardPage; X-ray Inbox → XrayInboxPage; Migration → MigrationPage lang (walang wizard);
  Bulk Import → BulkImportWizard; Manual Entry → LegacyTreatmentEntry; Settings → SettingsPage; pagbalik sa
  X-ray Inbox → walang bagong download (cached). **8/8**. Flow E2E 54/54 pa rin.

| Name | Type | Purpose |
|---|---|---|
| `client/src/pages/MigrationPage.jsx` | MODIFIED | `lazy()` + `<Suspense>` para sa dalawang migration flow. |

### 18b. Responsiveness double-check (puna ng team: account menu sa sidebar)
**Bug:** sa sidebar, lumalampas sa kaliwang gilid ng screen ang account menu (nakahanay sa kanan ng button,
kaya itinulak pakaliwa ng mahabang pangalan). Inayos sa mismong `DropdownMenu`, kaya protektado ang LAHAT ng menu:
- Bagong `align` ('right' default / 'left') at `matchTriggerWidth`. Laging may `maxWidth` batay sa natitirang
  espasyo, kaya hindi na lalampas sa screen kahit anong menu. Sa sidebar: `align="left"`, kasinglapad ng button,
  at nakabalot (wrap) ang buong pangalan.

**Audit:** bagong script na binubuksan ang **33 screen/state** (lahat ng page, modal, menu, search, More, wizard
steps, manual entry, patient view) sa **11 lapad** (320, 360, 390, 414, 768, 820, 1024, 1280, 1366, 1440, 1920).
Awtomatikong sinusuri: page overflow, element na naputol sa gilid, popup na lumalabas sa screen, text na
lumalabas sa button, at table na kailangang i-scroll pakanan. Napatunayang nahuhuli nito ang orihinal na bug.

| Nakita | Ayos |
|---|---|
| 320px: top bar (logo + search + avatar) 3px lampas | Pangalan ng clinic `truncate` kapag kulang |
| 320px: "Save new password" lampas | Nakasalansan ang 2 button below 360px |
| 320px: profile tabs kailangang i-scroll | Mas maliit na gap, walang icon below 360px |
| 1024px (may sidebar, ~720px na lang ang content): Audit Log table siksik | Cards hanggang `xl` (dati `lg`) |
| 1024px: Patients header buttons nahahati, table 35px lampas | Header at "Registered" column `xl` |
| 768/1024px: X-ray Inbox table 26px lampas | File column `xl` lang; sa mas makitid, nasa ilalim ng pangalan |
| Sariling mali: JSX comment sa BulkImportWizard (hindi nag-load ang wizard) | Inilipat ang comment sa loob ng div |

**Resulta:** 325 screens, **0 issues**, 0 page errors (sinadyang naso-scroll lang: 2D odontogram sa phone at ang
spreadsheet preview sa Map Columns). Na-check din ang screenshots isa-isa. Regression: functional 22/22, forms
41/41, phone 7/7, sweep 60/60, API 25/25, nav/migration 54/54, 3D drawing 14/14 + occlusal. Build pasado.

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/common/DropdownMenu.jsx` | MODIFIED | `align`, `matchTriggerWidth`, laging nasa loob ng screen (`maxWidth`). |
| `client/src/layouts/AppLayout.jsx` | MODIFIED | Sidebar account menu `align="left"`; brand `truncate`; buong pangalan sa menu header. |
| `client/src/pages/{AuditLog,PatientsList,XrayInbox,ChangePassword,PatientProfile}Page.jsx` | MODIFIED | Tingnan ang table sa itaas. |
| `client/src/components/migration/BulkImportWizard.jsx`, `components/chart/Odontogram2D.jsx` | MODIFIED | `data-scroll-ok` / `data-odontogram-scroll` (sinadyang scroll); ayos ng comment. |
| `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | Dense tables → cards below `xl`; secondary columns `xl:table-cell`. |

### Mga napansin sa paper na HINDI pa tugma sa system (para sa team)
1. ~~**Patient upload ng X-ray sa app**: sa Functional Requirements at Patient Dashboard wireframe, may "Upload X-ray Image"
   ang patient; sa system, email lang (Mailgun). Gawin, o linawin sa paper na email ang paraan.~~ Naayos sa #27.
2. ~~**Print ng 3D chart**: "Print the graphical dental chart (2D or 3D view)"; 2D lang ang Print Chart.~~ Naayos sa #22.
3. **Excel**: "CSV/Excel templates"; CSV lang (Save As CSV).
4. **Search by ID**: tinanggal sa #7 (hiling ng adviser); "name or ID" pa rin sa paper.
5. **Kulay ng Caries**: red sa paper, magenta na (#12, color-blind safe).
6. **ERD**: iba sa totoong database (hal. `roles` table, `middle_name`, `chief_complaint`/`diagnosis`, `dental_chart_records`).
   I-update ang Figure 29 ayon sa aktwal na schema.
7. **"Encrypting data at rest"** (Review of Related Literature): HTTPS at password hashing ang meron; kumpirmahin kung
   naka-encrypt ang database storage (Aiven) bago sabihin ito sa defense.

---

## 19. Hugis-ngipin na 2D Chart (puna: "masyadong kuwadrado")

Dati: parehong parisukat na "envelope" (gitnang square + 4 na trapezoid) ang lahat ng 32 ngipin. Ngayon: **occlusal view**
(tingin mula sa itaas ng kagat) ayon sa uri ng ngipin, at **pareho pa rin ang 5 napipindot na surface** sa parehong pwesto.

| Uri | Hugis |
|---|---|
| Incisor (1–2) | Malapad at manipis (incisal edge), maliit na gitna |
| Canine (3) | Bilugang diamond |
| Premolar (4–5) | Oval, may 2 cusp (facial at lingual) + 1 groove |
| Molar (6–8) | Malapad, may 4 cusp + "+" na fissure |

- Paano: ang gilid ay superellipse (bilog ↔ parisukat) na may umbok para sa cusps; ang gitna (occlusal) ay parehong hugis,
  pinaliit; ang 4 na gilid ay hinati ng mga linyang papunta sa "kanto" ng hugis. `polygon` pa rin ang bawat surface.
- Palamuti lang ang balangkas at fissure lines (`pointerEvents="none"`), hindi humaharang sa pagpindot.
- Extracted: abong hugis-ngipin na may X (dati abong parisukat). Pindot pa rin → whole-tooth modal.
- Parehong hugis sa maliit na diagram ng ChartEntryModal at sa Print Chart.

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/chart/toothShape.js` | **NEW** | `toothType()`, `toothShape()` → `{ regions, outline, grooves }` (naka-cache bawat uri), `TOOTH_BOX`. |
| `client/src/components/chart/Tooth.jsx` | MODIFIED | Gumagamit ng `toothShape`; balangkas at grooves; extracted na hugis-ngipin. |
| `client/src/components/chart/ChartEntryModal.jsx` | MODIFIED | `SurfaceIndicator` gumagamit ng parehong hugis. |
| `client/src/components/chart/Odontogram2D.jsx` | MODIFIED | `TOOTH_SIZE = TOOTH_BOX` (iisang pinanggagalingan). |

**Na-verify (local, Edge):** bagong 2D test **30/30**: lahat ng 5 surface ng incisor 11, canine 23, premolar 35, molar 46
(upper/lower, kaliwa/kanan) → tamang surface sa modal; save → tamang kulay; numero → Whole Tooth; extracted → abong hugis
+ X, napipindot pa rin; walang console error. Regression: functional 22/22, forms 41/41 (kasama ang highlight sa modal),
sweep 60/60, responsive audit 148 screens 0 issues; screenshots ng chart, modal, at Print Chart. Build pasado.

---

## 20. X-ray Email: Shared Email at Pekeng Sender (Hold for Review)

**Problema (dati):** (1) Walang `UNIQUE` sa `patients.email` at `LIMIT 1` ang pagtugma, kaya kapag iisa ang email ng
magulang para sa mga anak, ang X-ray ay napupunta sa **unang** tugma, at walang babala (puwedeng maling anak).
(2) Napapatunayan ng Mailgun signature na galing kay Mailgun ang request, pero **hindi** na ang pasyente talaga ang
nagpadala (madaling pekein ang sender address).

**Ayos:** hindi na awtomatikong ifa-file ang X-ray kapag:
- **2+ patient ang may ganitong email** (`shared_email`), o
- **hindi "Pass" ang SPF** ni Mailgun (`unverified_sender`; kasama ang Fail, SoftFail, Neutral, at walang header).
  SPF lang ang batayan: sinusuri nito ang envelope sender, na siya mismong itinutugma natin. Ang DKIM "Pass" ay hindi
  sinasabi kung kaninong domain ang pumirma, kaya itinatala lang.

Iniimbak muna ang file (hindi na kailangang ipadala ulit ng pasyente) sa hiwalay na table, kaya **hindi nakikita sa
kahit anong patient record** hangga't walang desisyon. Sa **X-ray Inbox → "Needs your decision"**: thumbnail (pindutin
para lumaki), dahilan, at mga button na **"File to <patient>"** (lahat ng may ganitong email) o **Dismiss** (may
kumpirmasyon; binubura ang file). Ang na-file ay lalabas sa "New" gaya ng karaniwang email X-ray. Kasama sa badge ng
X-ray Inbox ang mga naghihintay. Walang pagbabago sa unknown sender (hindi pa rin iniimbak).

**Babala sa Register/Edit:** kapag may ibang patient na may parehong email, may amber na paalala sa ilalim ng Email
("Also on ... X-rays emailed from this address will wait in the X-ray Inbox"). Hindi bawal, dahil normal sa pamilya.

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/011_add_inbound_xray_holds.sql` | **NEW** | `inbound_xray_holds` (reason, sender, SPF/DKIM, status pending/assigned/dismissed) + `inbound_xray_hold_files`. Napatakbo na sa local. **Kailangang patakbuhin sa Aiven bago/kasabay ng push.** |
| `server/src/models/xrayHoldModel.js` | **NEW** | `createHold`, `listPendingHolds` (may candidates batay sa kasalukuyang email), `findHoldFile`, `assignHold`/`dismissHold` (transaction; "inaangkin" muna ang hold kaya walang doble kahit dalawang beses pindutin), `countPendingHolds`. |
| `server/src/models/patientModel.js` | MODIFIED | `findPatientByEmail` (LIMIT 1) → `findPatientsByEmail(email, { exceptId })` (lahat ng tugma). |
| `server/src/services/mailgunService.js` | MODIFIED | `senderAuthentication()`: SPF/DKIM mula sa field o `message-headers`; `MAILGUN_REQUIRE_SPF` (default true). |
| `server/src/controllers/webhooks.controller.js` | MODIFIED | 0 tugma = unmatched (dati); 2+ o hindi verified = hold (dedupe sa Message-Id); 1 + SPF Pass = file agad (dati). |
| `server/src/services/xrayStorageService.js` | MODIFIED | `deleteXrayFile()` (local o Cloudinary), para sa Dismiss lang. |
| `server/src/controllers/xrays.controller.js`, `routes/xrays.routes.js` | MODIFIED | `held` sa inbox response; badge count + holds; `GET /xrays/holds/:holdId/files/:fileId`, `POST .../assign`, `POST .../dismiss` (dentist). |
| `server/src/controllers/patients.controller.js`, `routes/patients.routes.js` | MODIFIED | `GET /patients/email-usage?email=&exceptCode=` (dentist; pangalan lang ang ibinabalik). |
| `server/.env.example` | MODIFIED | `MAILGUN_REQUIRE_SPF=true`. |
| `client/src/components/xray/HeldXrayEmails.jsx` | **NEW** | "Needs your decision" section. |
| `client/src/pages/XrayInboxPage.jsx`, `services/xrays.js`, `services/patients.js` | MODIFIED | Section sa itaas ng Inbox; API wrappers. |
| `client/src/components/patients/PatientForm.jsx`, `EditPatientModal.jsx` | MODIFIED | Shared-email paalala (500ms debounce; hindi kasama ang sarili sa Edit). |
| `client/src/utils/auditAction.js` | MODIFIED | Labels: INBOUND_XRAY_EMAIL_HELD (amber), VIEW/ASSIGN/DISMISS_HELD_XRAY; readable details (reason, SPF). |

**Na-verify (local, Cloudinary storage):** API **36/36** (form check, SPF Pass/Fail/SoftFail/wala, SPF sa loob ng
`message-headers`, shared → hold, Mailgun retry = walang doble, unknown sender, bad signature 401, preview, maling hold
404, patient 403, assign → tamang anak lang, 2nd assign/dismiss 409, nabura ang file sa Cloudinary, audit entries). UI
sa Edge **22/22** (360/390/768/1366px, 0 overflow, preview, assign, dismiss, Register hint, audit labels, 0 console error).
Build pasado. Nalinis ang lahat ng test data (DB, Cloudinary, audit).
**Napansin:** kapag pumalya ang Cloudinary habang tumatanggap ng email, 500 ang sagot, kaya magre-retry si Mailgun at
walang mawawala. **Hindi pa sakop:** pag-file sa patient na wala sa candidates (hal. anak na walang email sa record):
mag-Dismiss muna at i-upload nang manual, o idagdag muna ang email sa record. Wala pang `role="dialog"` ang shared
`Modal` (luma, hindi ginalaw). **Naka-push na** (commit `27c27ca`, 2026-10-02). Napatakbo muna ang migration 011
sa Aiven bago ang push.

---

## 21. Build Output: Hash-only Filenames, `js/` Folder, Walang Source Maps (puna ng adviser: "exposed code")

**Puna:** sa DevTools → Sources ng live site, kita ang lahat ng JS file na may pangalan ng page (`LoginPage-...js`,
`AuditLogPage-...js`), halo-halo sa iisang `assets/` folder. Hiling din: "ilagay ang js file sa js folder".

**Paliwanag para sa defense:** hindi maitatago ang frontend JavaScript (kailangan itong i-download ng browser para
tumakbo; pareho sa Facebook, nasa `static.xx.fbcdn.net/rsrc.php` ang kanila). Ang magagawa: hindi ipakita ang
pangalan/istruktura, walang source maps, at walang sikreto sa frontend. **Ang tunay na proteksyon ay nasa server**
(login, `requireRole`, `canAccessPatientRecord`, 401/403/404). Na-check: walang `.map` files, minified, at walang
API key/password sa bundle (walang `import.meta.env` sa client; nasa `server/.env` lang ang secrets).

- **A. Folders:** `assets/js/`, `assets/css/`, `assets/images/`, `assets/models/` (`teeth.glb`), `assets/fonts/`.
- **B. Hash-only filenames:** `LoginPage-u6czFOA1.js` → `assets/js/u6czFOA1.js`. Hindi na kita kung anong page ang bawat file.
- **C. `sourcemap: false`** (explicit, kahit default na ito).
- **Hindi ginawa (sinadya):** obfuscation (2–3x laki, mas mabagal, nade-decode pa rin) at pag-block ng right-click/F12 (walang silbi).
  Hindi rin ginawa ang pag-group ng maliliit na file (napag-usapang "D", standby).

| Name | Type | Purpose |
|---|---|---|
| `client/vite.config.js` | MODIFIED | `build.sourcemap: false`; `build.rolldownOptions.output` (`entryFileNames`/`chunkFileNames` → `assets/js/[hash].js`, `assetFileNames` → folder ayon sa uri). |

**Na-verify (production build + `vite preview`, Edge via Playwright, local DB):** **20/20**: login (logo galing
`assets/images/`), Dashboard, Patients, X-ray Inbox, Audit Log, Migration + Bulk Import (lazy), Settings, profile,
2D chart, 3D chart (`teeth.glb` galing `assets/models/`), X-rays tab, Print Summary (bagong tab, may logo); 56 na
na-load na file, lahat nasa tamang folder at hash-only ang pangalan; 0 asset error, 0 console error; service worker
activated, 58 JS sa precache, at gumagana ang offline reload. Build pasado (may dati nang babala tungkol sa malaking
3D chunk, hindi bago). **Naka-push na** (commit `277928b`, 2026-10-05). Pagka-deploy, lalabas ang "A new version of DentaVault is ready" sa
mga dating bumisita (normal, bagong file paths).

---

## 22. Napi-print na ang 3D Chart (5 anggulo + listahan ng findings)

**Problema:** sa paper, "Print the graphical dental chart (2D or 3D view)", pero 2D lang ang lumalabas sa Print Chart, kahit
nasa 3D Chart ka. Hindi rin puwedeng i-print nang diretso ang 3D canvas (madalas blangko, at isang anggulo lang).

**Ayos:**
- **Print Chart sumusunod sa bukas na view:** 2D Chart → 2D print (gaya ng dati); 3D Chart → bagong **3D print**.
- **3D print** (bagong tab, parehong header gaya ng ibang print page): kinukunan ng larawan ang 3D model mula sa **5
  nakapirming anggulo**: Front, Upper arch (biting surfaces, tingin mula sa ilalim), Lower arch (biting surfaces, tingin mula
  sa itaas), Patient's right side, Patient's left side. Puting background, 2400×1600 bawat larawan (malinaw sa papel).
- **Mga numero ng ngipin** sa bawat larawan: laging nakaharap sa camera at hindi natatakpan ng gums. Sa harap/gilid, numero
  lang ng mga ngiping nakaharap sa camera (iwas siksikan); sa upper/lower, nasa labas ng arch.
- **Legend** at **Findings** table (Tooth, Surface, Condition, Notes, Recorded), pinakabagong entry bawat ngipin + surface,
  nakaayos 11→48. "No findings recorded on the chart yet." kapag wala.
- **Findings table din sa 2D Print Chart** (hiling ng team, para pareho): kita ang notes at petsa na wala sa mismong chart, at
  nakasulat ang pangalan ng kondisyon (nababasa kahit black-and-white ang printer). Iisang component (`ChartFindings`).
- Pareho ang oryentasyon sa 2D chart: sa Front/Upper/Lower, ang kanan ng pasyente ay nasa kaliwa ng larawan (may paalala sa page).
- Print button ay "Preparing..." hanggang handa ang mga larawan. Lazy pa rin: ang 3D files ay dina-download lang pagbukas ng 3D print.
- **Walang binago sa server, database, o naka-save na drawing.** Walang bagong library.

**Paano (code):** `Chart3DSnapshots` ay may nakatagong `<Canvas>` (nasa labas ng screen, `frameloop="never"`). Pagka-load ng
model at ng font ng mga numero, bawat view: ipinapakita lang ang kailangang arch, inilalapit ang camera hanggang kasya
(`fitCamera`), may "headlight" para pantay ang liwanag, `gl.render()`, tapos `toDataURL()` → `<img>` sa print page.
Pagkatapos, inaalis ang Canvas (walang WebGL na tumatakbo habang nagpi-print). Iisang scene code ang gamit ng screen at print
(`chartScene.jsx`).

| Name | Type | Purpose |
|---|---|---|
| `client/src/components/chart/Chart3DSnapshots.jsx` | **NEW** | 5 views, `fitCamera`, label placement/visibility, headlight, snapshot → `onDone([{ key, title, src }])`. |
| `client/src/components/chart/chartScene.jsx` | **NEW** | Shared: `TOOTH_PLACEMENTS`, `groupChartEntries()`, `SceneLights` (dati nasa loob ng `Odontogram3D`). |
| `client/src/pages/Chart3DPrintPage.jsx` | **NEW** | Ang print page: header, patient info, 5 larawan, legend, findings table. |
| `client/src/components/chart/ChartFindings.jsx` | **NEW** | Shared Findings table (2D at 3D print) + `ColorDot` (SVG, para lumabas ang kulay sa print). |
| `client/src/pages/ChartPrintPage.jsx` | MODIFIED | 2D print: kinukuha rin ang `getCurrentChart` at may `ChartFindings` sa ilalim ng odontogram. |
| `client/src/components/chart/Odontogram2D.jsx` | MODIFIED | Legend: `ColorDot` (SVG) imbes na `<span>` na may background color, para may kulay sa print. |
| `client/src/components/chart/Odontogram3D.jsx` | MODIFIED | Gumagamit na ng `chartScene.jsx` (walang pagbabago sa itsura o drawing). |
| `client/src/components/chart/Tooth3D.jsx` | MODIFIED | Bagong `showLabel` prop (default `true`; `false` sa print, doon hiwalay ang mga numero). |
| `client/src/pages/PatientProfilePage.jsx` | MODIFIED | Print Chart → `chart/print-3d` kapag 3D ang bukas. |
| `client/src/App.jsx` | MODIFIED | Lazy route `patients/profile/chart/print-3d`. |

**Na-verify (Edge via Playwright, local DB):** e2e **28/28** (kasama ang 2D findings: 42 rows, notes, sariling legend pa rin,
"No findings" sa walang chart; PDF ng 2D: 2 pahina, chart + simula ng listahan sa unang pahina). Dati: 2D view → 2D print pa rin;
3D view → 3D print; 5 larawan, walang blangko; findings = bilang sa database (Dela Cruz 42, Mendiola 12); patient na walang chart
→ "No findings"; refresh ng print tab OK; Print button nakatago sa print; direktang URL na walang state → paalala lang;
patient account → sariling record (kahit pekein ang handoff); walang patient code sa page; 0 console error. PDF (A4): 3 pahina,
hindi napuputol ang mga larawan, umuulit ang table header, lumalabas ang kulay. Screenshots ng lahat ng 5 anggulo, sinuri isa-isa
(naayos: madilim na upper view, siksik at naputol na mga numero). Regression: 3D chart sa screen (may numero, gumagana ang pen,
Discard), build/navigation test 19/20 (ang 1 ay timing ng service worker check; hiwalay na check: activated + offline OK).
**Naka-push na** (commit `d202ffd`, 2026-10-06).

**Paalala:** ang font ng mga numero sa 3D (troika Text) ay galing sa CDN (jsdelivr), gaya ng 3D chart sa screen. Kapag offline (hindi pa nasubok; batay sa code),
hinihintay ito nang hanggang 10 segundo bago kunan ang larawan. Sa test browser (walang GPU), 3–14 segundo bago maging handa;
mas mabilis sa laptop na may GPU.

**Naayos din (lumang bug):** sa 2D print, walang kulay ang mga bilog sa legend ng odontogram, dahil background color ang
gamit (tinatanggal ng browser sa print maliban kung naka-check ang "Background graphics"). Ngayon SVG na (`ColorDot`), kaya may
kulay na sa papel. Na-verify: PDF na naka-off ang background graphics → may kulay ang legend; sa screen, pareho ang itsura.

---

## 23. Contact Number: PH Mobile Lang ang Puwedeng I-type

Dati, kahit anong character ay puwedeng i-type sa Contact Number at Emergency Contact Phone (hanggang 20); sa pag-Save
lang lumalabas ang error. Ngayon, habang nagta-type pa lang, **digits lang (at "+" sa unahan)** ang tinatanggap, at
hindi na makakalampas sa:
- `09XXXXXXXXX`: **11 digits**, kailangang "09" ang simula, o
- `+639XXXXXXXXX`: "+63" + 10 digits (13 characters).

Maling simula (hal. "1", "08", "+1") ay hindi tinatanggap. Kapag nag-paste: "0917 123 4567" → `09171234567`,
"+63 917 123 4567" → `+639171234567`, "9171234567" → `09171234567`, "639171234567" → `+639171234567`.
Tinanggal ang `maxLength` sa dalawang input (napuputol nito ang na-paste na may espasyo bago pa malinis).
Walang binago sa server: pareho pa rin ang `PH_MOBILE_PATTERN` check sa `patients.routes.js` (huling proteksyon).
Hindi sakop ang Bulk Import (legacy data, puwedeng ibang format ang lumang numero).

| Name | Type | Purpose |
|---|---|---|
| `client/src/utils/phone.js` | **NEW** | `sanitizePhoneInput()`: digits/"+" lang, tamang simula, max haba. |
| `client/src/components/patients/PatientForm.jsx` | MODIFIED | Contact Number at Emergency Contact Phone gumagamit ng `sanitizePhoneInput`; bagong hint at placeholder. (Pareho sa Register at Edit modal.) |

**Na-verify:** 19 na sample input (typing, paste, maling simula, sobrang haba); build pasado. **Naka-push na** (commit `fc9657c`, 2026-10-06).

---

## 24. Obfuscation ng Frontend Code (puna ng teacher: kita ang code, imports, at paths sa F12)

**Puna:** sa DevTools → Sources, nababasa pa rin ang logic, ang mga API path (`/patients/export`), routes, at mensahe,
kahit hash-only na ang filenames (#21). Hiling: "layers" at "encrypt".

**Paliwanag para sa defense:** hindi puwedeng tunay na i-encrypt ang frontend JS (kailangang patakbuhin ito ng browser,
kaya nasa browser din ang susi). Ang ginawa ay **obfuscation na may 4 na layer**, at ang strings ay naka-**RC4 encode**
(pinakamalapit sa "encrypt"; dine-decode lang habang tumatakbo). Ang tunay na proteksyon ay nasa **server layer** pa rin
(auth, `requireRole`, `canAccessPatientRecord`, walang secrets sa frontend). Defense in depth.

| Layer | Epekto |
|---|---|
| 1. Identifier renaming | Lahat ng local na pangalan ay pinalitan |
| 2. String array + RC4 | Walang nababasang API path, route, o mensahe (hal. `n(324,'MxE&')`) |
| 3. Control flow flattening (0.25) | Ginulo ang daloy ng logic |
| 4. Dead code injection (0.05) | Kaunting pekeng code |
| 5. Domain lock (#25) | Tumatakbo lang sa `dentavault.vercel.app` (at localhost); kapag kinopya sa ibang site → blangkong page |

- **Sariling code lang (`client/src`)**, bawat file bago i-bundle. Hindi ginalaw ang React, Three.js, at lucide icons
  (public libraries; kung isasama, sobrang lalaki ang 3D chunk). Kaya kita pa rin ang mga icon name/SVG path nila.
- **Chart files (`components/chart/`)**: layers 1–2 lang, para hindi bumagal ang 3D/2D chart.
- **Lazy loading buo pa rin (#9):** hindi ine-encode ang `import('./pages/...')` (`reservedStrings`).
- **Production build lang** (`apply: 'build'`). Walang epekto sa `npm run dev`.
- **Sinadyang off:** `selfDefending` (nasisira kapag minify ulit ng bundler) at `debugProtection` (F12 trap; nakakainis, nalulusutan).
- **Kita pa rin (hindi maiiwasan):** ang `import{...}from"./DmWTtIqA.js"` sa simula ng bawat file. Ito ang paraan ng
  browser para pagdugtungin ang mga file; hash lang ang pangalan. Mawawala lang kung iisang malaking file ang buong app,
  pero masisira ang lazy loading (#9).

**Laki at bilis (sinukat):**
| | Bago | Pagkatapos |
|---|---|---|
| Main file (gzip, unang download) | 77 KB | 103.7 KB (kasama ang domain lock) |
| Lahat ng JS (gzip) | 482 KB | 743 KB |
| Login / Dashboard / Patients | ~0.65 / 0.9 / 0.92 s | ~0.63 / 0.89 / 1.03 s |
| Pagbukas ng patient profile | ~0.13 s | ~0.32 s |

| Name | Type | Purpose |
|---|---|---|
| `client/vite.config.js` | MODIFIED | Bagong `obfuscateSource()` plugin (transform, `enforce: 'post'`, `client/src` lang). |
| `client/package.json`, `package-lock.json` | MODIFIED | devDependency `javascript-obfuscator`. |

**Na-verify (production build + `vite preview`, Edge via Playwright, local DB):** e2e **26/26** (pareho sa build na walang
obfuscation): login (tama/mali), lahat ng page (Dashboard, Patients, X-ray Inbox, Audit Log, Migration + Bulk Import,
Settings), Ctrl+K + Escape, profile, Add Treatment modal, 2D chart tooth click → modal, 3D chart, 3D print (5 larawan),
2D print (findings), Print Summary, X-rays tab, patient account (sariling record, blocked sa Audit Log), 57 lazy JS files
hash-only, 0 console error, offline reload (service worker). **0** file na may nababasang `/patients`, `/auth`, `/xrays`,
`/audit-logs`, `/dashboard`, `/settings`. **Naka-push na** (commit `3670ae9`, 2026-10-11). Live-tested sa `dentavault.vercel.app`.

---

## 25. Security Hardening: Login Rate Limiting, Library Updates, Domain Lock

Galing sa mabilisang security check pagkatapos ng #24 (hindi pa ito buong security review; iyon ang susunod, kapag may go signal).

### A. Login rate limiting (brute force protection)
**Problema:** walang limit ang maling login, kaya puwedeng hulaan nang walang tigil ang password.
- **10 maling subok bawat 15 minuto**, hiwalay ang bilang **bawat IP** at **bawat email** (case-insensitive). Pagkalampas: 429
  "Too many failed sign-in attempts. Please try again in N minutes." (lumalabas sa login page).
- **Bawat email** dahil napepeke ang IP sa likod ng Vercel (Gotcha #7): kahit magpalit-palit ng IP, naha-harang pa rin ang
  paghula sa iisang account. **Kapalit:** kapag may nanghuhula, pansamantalang hindi rin makakapag-login ang may-ari ng account
  (hanggang 15 minuto, kusang nawawala).
- **Maling subok lang ang binibilang** (`skipSuccessfulRequests`); hindi naaapektuhan ang normal na pag-login.
- **Change password** (maling current password): parehong limit, bawat account.
- **Audit log:** `LOGIN_RATE_LIMITED` / `CHANGE_PASSWORD_RATE_LIMITED` (pula), **isang entry lang bawat lock** (hindi bawat naharang
  na request, para hindi mapuno ang log). Details: "Limit: per IP address · Wait: 15 min".
- Nasa memory ng server ang bilang (isang instance lang sa Render): nare-reset kapag nag-restart ang server.
- Settings sa `.env`: `LOGIN_RATE_LIMIT_MAX` (default 10), `LOGIN_RATE_LIMIT_WINDOW_MINUTES` (default 15). Hindi kailangang i-set sa Render.

### B. Library updates (`npm audit fix`, walang `--force`, patch/minor lang)
| Saan | Library | Dati → Ngayon | Bigat ng butas |
|---|---|---|---|
| server | `proxy-addr` (galing sa Express) | 2.0.7 → 2.0.8 | critical |
| server | `multer` (X-ray at import upload) | 2.2.0 → 2.4.0 | high |
| server | `qs`, `morgan`, `csv-parse` | 6.15 → 6.16, 1.11 → 1.12.1, 7.0.1 → 7.0.3 | moderate |
| client | `axios` | 1.18.1 → 1.20.0 | high |
| client | `react-router-dom` | 7.18.1 → 7.18.4 | high |
Resulta: **0 vulnerabilities** sa server at client.

### C. Domain lock (Layer 5 ng obfuscation, #24)
- Ang build ay tumatakbo lang sa `dentavault.vercel.app`, `localhost`, `127.0.0.1`. Kapag kinopya ang files sa ibang site → `about:blank`.
- Nasa **`main.jsx` lang** ang check (dito nagsisimula ang lahat ng file). Kung sa bawat file, 102 → 122 KB ang main file; ngayon 103.7 KB.
- ⚠️ **Kapag nagpalit ng domain** (custom domain, ibang hosting, Vercel preview URL, o pag-test sa phone gamit ang LAN IP):
  idagdag sa `ALLOWED_DOMAINS` sa `vite.config.js` o i-set ang `OBFUSCATE_DOMAINS` (comma-separated) bago mag-build.
  Kung hindi, **blangko ang app** sa bagong address.

| Name | Type | Purpose |
|---|---|---|
| `server/src/middleware/rateLimit.js` | **NEW** | `loginLimiterByIp`, `loginLimiterByEmail`, `changePasswordLimiter` (express-rate-limit), 429 message, isang audit entry bawat lock. |
| `server/src/routes/auth.routes.js` | MODIFIED | Limiters sa `/login` at `/change-password`. |
| `server/.env.example` | MODIFIED | `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MINUTES`. |
| `server/package.json`, `package-lock.json` | MODIFIED | `express-rate-limit`; audit fix. |
| `client/package-lock.json` | MODIFIED | audit fix (axios, react-router). |
| `client/vite.config.js` | MODIFIED | `ENTRY_MODULE`, `ALLOWED_DOMAINS` / `OBFUSCATE_DOMAINS`, `domainLock`. |
| `client/src/utils/auditAction.js` | MODIFIED | Labels at kulay ng 2 bagong action; readable `limitedBy`/`windowMinutes`. |

**Na-verify (local):** rate limit API **16/16** (pansamantalang limit 3 / 1 min: per IP, per email kahit iba-ibang IP, case-insensitive,
ibang IP/account hindi apektado, successful logins hindi binibilang, change password, isang audit entry lang, bumabalik pagkatapos
ng window); login page nagpapakita ng 429 message (screenshot) at Audit Log row readable. Pagkatapos ng library updates: API
**12/12** (X-ray upload + fetch, 413 sa sobrang laki, 415 sa hindi image, import preview + dry run, CSV export, query params,
helmet headers, 403/401); browser e2e **26/26**. Domain lock **3/3** (localhost at 127.0.0.1 gumagana; LAN IP → `about:blank`).
Nilinis ang lahat ng test data (test X-ray sa Cloudinary at DB, audit rows). **Naka-push na** (commit `3670ae9`, 2026-10-11). Live-tested sa `dentavault.vercel.app`.

---

## 26. Security Review at mga Ayos (A–H)

Buong review ng server, client, database, at config. **Walang kritikal na butas** (access control, SQL injection, XSS,
password hashing, secrets: pasado). Ayon sa Aiven docs, naka-encrypt ang disk ng database (LUKS, AES-XTS), kaya
masasagot na ang item #7 sa listahan ng paper. Inayos ang 4 na katamtaman at 4 na mababang isyu:

| | Problema (bago) | Ayos |
|---|---|---|
| **A** | Walang security headers ang live app sa Vercel (HSTS lang): puwedeng i-iframe (clickjacking), walang CSP | `vercel.json` `headers`: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Ginagamit din ng `vite preview` (para masubok nang lokal) |
| **B** | Mailgun webhook (walang login): hanggang 150 MB ang binabasa bago i-check ang signature, walang limit | Body > 30 MB = 413 agad; 60 request/15 min bawat IP at 300 sa kabuuan (429: nagre-retry si Mailgun) |
| **C** | Webhook replay: timestamp + token lang ang pinipirmahan, hindi ang laman | Timestamp hanggang 9 oras lang (retry window ni Mailgun ~8 oras; **pareho ang token sa retry**, kaya hindi 5 min); bawat token isang beses lang (`mailgun_webhook_tokens`, itinatala pagkatapos ng matagumpay na proseso) |
| **D** | Gumagana pa ang token nang hanggang 8 oras kahit na-reset ang password, nag-sign out, o na-delete ang patient; nakakapag-login pa ang portal account ng na-delete na patient | `users.token_version` (nasa JWT bilang `tv`), tinitingnan sa bawat request. Tumataas sa password change/reset, Sign out (lahat ng device), delete ng patient (+ `is_active = 0`), at `seed.js` reset |
| **E** | Nalalaman kung may account ang email: 1–5 ms (wala) vs ~400 ms (meron) | Pekeng bcrypt compare kapag walang account: ~300 ms pareho |
| **F** | CSV export: `=`, `+`, `-`, `@` sa simula = Excel formula | `'` sa unahan (maliban sa purong numero gaya ng `+639...`) |
| **G** | SPF: ang unang `X-Mailgun-Spf` lang ang tinitingnan (puwedeng magdagdag ng pekeng "Pass" ang nagpadala) | Verified lang kapag "Pass" ang LAHAT ng nakitang SPF value |
| **H** | `?search[]=x`, `?sort=__proto__`, atbp. = 500 | `queryText`/`queryInt` (`utils/query.js`), `Object.hasOwn` sa sort; 200 na |

**Para gumana ang 3D chart sa CSP** (nahuli sa lokal na test, masisira sana sa live): pinatay ang hindi ginagamit na
Draco/Meshopt (WebAssembly) sa `useGLTF` (`KHR_mesh_quantization` lang ang `teeth.glb`), at sa main thread na ang
troika text (dati worker na naglo-load ng `blob:` script). Print slip: walang inline `<script>` na; ang app ang tumatawag ng print.
Client: kapag 401 sa gitna ng paggamit, awtomatikong sign out at "Your session has ended. Please sign in again." sa login.

> ⚠️ **Bago/kasabay ng push:**
> 1. **Migration 012 sa Aiven** (`$env:DOTENV_CONFIG_PATH=".env.aiven"; npm run migrate` sa `server/`). Kung hindi, **pumapalya ang lahat ng login**. ✅ Napatakbo na (2026-10-11, bago ang push).
> 2. Pagka-deploy, **masa-sign out ang lahat ng naka-login** (walang `tv` ang lumang token). Normal ito, isang beses lang.
> 3. **Bagong external resource** (font, CDN, image host) = idagdag sa CSP sa `client/vercel.json`, kung hindi ma-ba-block.
> 4. Bagong 3D model na may Draco/Meshopt = i-on sa `Tooth3D.jsx` AT luwagan ang CSP.

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/012_security_hardening.sql` | **NEW** | `users.token_version`, deactivate portal accounts ng deleted patients, `mailgun_webhook_tokens`. Napatakbo na sa local. |
| `server/src/middleware/auth.js` | MODIFIED | Async; tinitingnan ang `is_active`, deleted patient, at `tv` sa database. `/auth/logout` pinapayagan kahit may temporary password. |
| `server/src/models/userModel.js` | MODIFIED | `findUserAuthState`, `bumpTokenVersion`, `deactivateUserForPatient`; `updatePasswordHash` nagba-bump. |
| `server/src/services/authService.js`, `controllers/auth.controller.js`, `routes/auth.routes.js` | MODIFIED | `tv` sa token, `DUMMY_HASH`, `logout` + `POST /auth/logout` (audit `LOGOUT`). |
| `server/src/controllers/patients.controller.js` | MODIFIED | Delete → deactivate portal account; `queryText`/`queryInt`. |
| `server/src/models/webhookTokenModel.js` | **NEW** | One-time Mailgun tokens (+ paglilinis > 2 araw). |
| `server/src/services/mailgunService.js`, `controllers/webhooks.controller.js` | MODIFIED | Edad ng timestamp; `done()` nagtatala ng token; lahat ng SPF value. |
| `server/src/middleware/rateLimit.js`, `routes/webhooks.routes.js` | MODIFIED | `webhookLimiterByIp`, `webhookLimiterGlobal`, `rejectLargeWebhookBody`. |
| `server/src/utils/csv.js` | MODIFIED | Formula injection. |
| `server/src/utils/query.js` | **NEW** | `queryText`, `queryInt`. |
| `server/src/controllers/{auditLog,xrays,dashboard}.controller.js`, `models/patientModel.js` | MODIFIED | Query params; `LOGOUT` wala sa Recent Activity; `Object.hasOwn`. |
| `server/db/seed.js`, `seedPatientUser.js` | MODIFIED | Password reset nagba-bump ng `token_version`. |
| `client/vercel.json` | MODIFIED | Security headers. |
| `client/vite.config.js` | MODIFIED | `preview.headers` galing `vercel.json` (walang `upgrade-insecure-requests` sa http). |
| `client/src/services/api.js`, `context/AuthContext.jsx`, `pages/LoginPage.jsx` | MODIFIED | 401 → session ended; Sign out tumatawag sa server; notice sa login. |
| `client/src/components/chart/Tooth3D.jsx`, `client/package.json` | MODIFIED | `configureTextBuilder({ useWorker: false })`, walang Draco/Meshopt; direktang dependency `troika-three-text` (parehong 0.52.5 ng drei). |
| `client/src/components/patients/PortalCredentials.jsx` | MODIFIED | Print slip walang inline script. |
| `client/src/utils/auditAction.js` | MODIFIED | Label ng `LOGOUT`. |

**Na-verify (local):** security API **33/33** (D: change/reset/sign out/delete/lumang token; E: 299 vs 298 ms; C: replay, 10 oras,
future, 8-oras na retry, maling signature; G: 5 kaso; F: 8 kaso + totoong export; H: 9 URL; B: 31 MB = 413 sa 32 ms, 429 sa limit).
UI **7/7** (Sign out sa server, "session ended" sa ibang device, print slip sa CSP, iframe naharang). E2E sa ilalim ng CSP **27/27**
(kasama ang 3D chart, 3D print, 6 na X-ray kasama ang Cloudinary, 0 console error). API regression **12/12**. Build pasado.
Nilinis ang lahat ng test data. **Naka-push na** (commit `3670ae9`, 2026-10-11). Live-tested sa `dentavault.vercel.app`.

---

## 27. Pag-upload ng X-ray ng Patient sa Patient Portal (ayon sa paper)

**Problema:** sa Functional Requirements at Patient Dashboard wireframe ng paper, may "Upload X-ray Image" ang patient. Sa
system, dentist lang ang makakapag-upload; email (Mailgun) lang ang paraan ng patient (puwang #1 sa listahan ng #18).

**Ayos (mga desisyon ng team):**
- **My Record → X-rays:** may "Send an X-ray to the clinic" na form (parehong form ng dentist: preview, drag-and-drop, check
  ng uri at laki, Date taken at Notes na optional).
- **Lumalabas agad sa record** na may strip na **"Waiting for review"** hanggang mabuksan ng dentist. (Strip na buong lapad,
  hindi badge, para hindi tumama sa compare checkbox sa phone.)
- **Puwedeng burahin ng patient** ang sariling upload, pero **bago lang ma-review** (hal. maling file). Pagkatapos, dentist na lang.
- **Dentist:** sa **X-ray Inbox** bilang "New" (kasama sa badge at sa "Unreviewed X-rays" tile), may "via Patient portal" / "via
  Email". Nagiging reviewed pagbukas ng X-rays tab ng patient, gaya ng email X-rays. Source sa thumbnail: Email / Patient / Clinic
  (dati "Manual"; icon lang sa phone para buo ang petsa).
- **Settings:** bagong card "Uploading X-rays in the app" (patient: link diretso sa X-rays tab; dentist: link sa X-ray Inbox).

**Seguridad:**
- **Sariling record lang** (`canAccessPatientRecord`); sa ibang record = 403. Annotate at X-ray Inbox: dentist pa rin.
- **Tinitingnan ang mismong laman ng file** (magic bytes: JPEG/PNG/WebP/PDF), hindi ang Content-Type na sinabi ng nagpadala.
  Ang text/HTML na nagpapanggap na larawan = 415. Ganito na rin sa upload ng dentist at sa **email attachments** (nilalaktawan
  ang pekeng attachment; ang naka-save na `mime_type` ay galing sa laman).
- **10 matagumpay na upload bawat 24 oras** bawat patient (`PATIENT_XRAY_UPLOADS_PER_DAY`); hindi binibilang ang pumalya.
  Nauuna ito sa pagbasa ng file.
- Audit: `PATIENT_UPLOAD_XRAY`; pagbura ng patient = `DELETE_XRAY` na may "Removed by the patient (before review)".

> ⚠️ **Kailangang patakbuhin ang migration 013 sa Aiven bago/kasabay ng push.** Kung hindi, pumapalya ang upload ng patient
> (`source` ENUM). ✅ Napatakbo na (2026-10-11, bago ang push).

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/013_add_patient_upload_source.sql` | **NEW** | `xray_images.source` + `'patient_upload'`. Napatakbo na sa local. |
| `server/src/utils/fileSignature.js` | **NEW** | `detectXrayMimeType(buffer)` (magic bytes). |
| `server/src/routes/xrays.routes.js` | MODIFIED | Upload at delete: `requireRole('dentist', 'patient')`; `patientXrayUploadLimiter` bago ang multer. |
| `server/src/middleware/rateLimit.js`, `server/.env.example` | MODIFIED | `patientXrayUploadLimiter` (patient lang, `skipFailedRequests`); `PATIENT_XRAY_UPLOADS_PER_DAY`. |
| `server/src/controllers/xrays.controller.js` | MODIFIED | `upload`: magic bytes, `source` ayon sa role, audit; `remove`: patient = sariling hindi pa nare-review lang; `getFile`: `REVIEWABLE_SOURCES`. |
| `server/src/models/xrayModel.js` | MODIFIED | `REVIEWABLE_SOURCES_SQL` sa badge count at inbox; `x.source` sa inbox. |
| `server/src/controllers/webhooks.controller.js` | MODIFIED | Attachment type mula sa laman ng file. |
| `client/src/components/xray/PatientXraysSection.jsx` | MODIFIED | Upload form para sa patient; `canDelete`. |
| `client/src/components/xray/UploadXrayForm.jsx` | MODIFIED | `title`, `description`, `successMessage` props. |
| `client/src/components/xray/XrayGallery.jsx` | MODIFIED | `viewerRole`; "New" (dentist) / "Waiting for review" strip (patient); `SourceLabel` (Email/Patient/Clinic). |
| `client/src/components/xray/XrayViewer.jsx`, `DeleteXrayModal.jsx` | MODIFIED | `canDelete` hiwalay sa `canAnnotate`; "Remove X-ray" na wording para sa patient. |
| `client/src/pages/XrayInboxPage.jsx` | MODIFIED | Wording (email o patient portal), "All received", "via ...". |
| `client/src/pages/SettingsPage.jsx` | MODIFIED | Card "Uploading X-rays in the app". |
| `client/src/utils/auditAction.js` | MODIFIED | Label ng `PATIENT_UPLOAD_XRAY`, `byPatient` detail. |

**Na-verify (local):** API **17/17** (sariling record 201 / ibang record 403, text at HTML na nagpapanggap = 415, inbox + badge,
pagbura bago review 204 / pagkatapos 403, upload ng clinic hindi mabubura ng patient, walang annotate/inbox ang patient,
email: pekeng attachment nilaktawan at tamang `mime_type`, audit, limit 10 bawat araw at hindi binibilang ang pumalya). UI **22/22**
(form, toast, "Waiting for review", viewer Delete, Remove modal, Settings link, 360px walang patong at walang overflow, inbox
"via Patient portal" sa laptop at phone, pagkatapos ng review wala nang strip at Delete; 0 console error). Regression e2e
**27/27** (sa ilalim ng CSP). Build pasado. Nilinis ang lahat ng test data (kasama ang mga file sa Cloudinary). **Naka-push na** (commit `ebc830d`, 2026-10-11). Live sa `dentavault.vercel.app` (Settings card, Inbox wording, 0 console error).


---

## 28. Blangkong CSV Template + Dropdown sa Medical History at Allergies

Galing sa paghahanda para sa client visit (pagkuha ng lumang records).

### A. CSV template (Migration → Bulk Import)
- **Blangko na** (header row lang). Dati may 2 halimbawang row ("Juan Dela Cruz"), kaya kailangan pang burahin bago
  mag-encode, at kapag nakalimutan, naiimport ang pekeng patient.
- **Madaling basahin ang header** (palatandaan): `First Name *`, `Sex * (male/female)`, `Date of Birth * (MM/DD/YYYY)`,
  `Contact Number (09XXXXXXXXX)`, `Allergies (or None)`, `Tooth Number (e.g. 26 or ALL)`... `*` = required.
- Kusa pa ring nakikilala sa Map Columns: hindi na pinapansin ng `normalizeHeader` ang `*` at ang nasa loob ng `( )`.
  Gumagana pa rin ang lumang format (`first_name`, ...).
- **Gabay sa Upload step** ("Filling in the template"): required columns, petsa, isang row bawat visit, comma sa
  maraming kondisyon, listahan ng procedures, at paano palaparin ang column sa Excel.
- **Excel phone fix:** kapag tinype ang `09171234567` sa Excel, nagiging `9171234567` (nawawala ang 0). Ibinabalik na ito
  sa import (`9XXXXXXXXX` → `09...`, `639...` → `+639...`). Mobile lang ang ginagalaw; ang landline ay iniiwan.

### B. Medical History at Allergies = dropdown na puwede ring mag-type
- Pinalitan ang 3 preset chips + textarea ng **`ComboboxListInput`**: listahang naka-group, maraming mapipili (chips na may X),
  at puwedeng mag-type ng wala sa listahan (Enter, comma, o "Add ...").
- **Listahan** (`constants/medicalOptions.js`): Medical History **52** (11 grupo, batay sa PDA-style na medical history form:
  puso/BP, pagdurugo at blood thinners, diabetes/thyroid, baga, hepatitis/HIV/TB, bato, epilepsy, bisphosphonates/joint
  implant, cancer/radiation, pagbubuntis, atbp.); Allergies **28** (antibiotics, pain relievers, anesthesia, dental
  materials gaya ng latex/nickel/acrylic, pagkain). May Filipino keywords sa paghahanap (hal. "hika" → Asthma,
  "altapresyon" → Hypertension, "lido" → Lidocaine).
- **Kaligtasan:** kapag may na-type pero hindi na-Enter at umalis sa field, idinadagdag pa rin (hindi mawawala ang allergy).
  "None" nagtatanong pa rin bago palitan ang listahan. Enter = unang tugma (hal. "pen" → Penicillin), nasa dulo ang "Add ...".
- **Walang binago sa database/server:** comma-separated text pa rin ang naka-save, kaya buo ang lumang data (hal.
  "Hypertension" ay lumalabas bilang chip).
- **Kusang nagsasara ang listahan pagkapili** (click, Enter, o comma), para hindi na kailangang mag-click sa labas.
  Nananatili ang cursor sa field: click, type, o ↓ para magdagdag pa.
- Section heading sa form: "Medical & Dental History" → **"Medical"**.
- Lumulutang (overlay) ang listahan: kung nasa daloy ng page, umaakyat ang Register button pagsara ng listahan at
  hindi gumagana ang unang pindot (nahuli sa test).

| Name | Type | Purpose |
|---|---|---|
| `server/src/controllers/patientImport.controller.js` | MODIFIED | `TEMPLATE_COLUMN_TITLES`; blangkong template. |
| `server/src/services/patientImportService.js` | MODIFIED | `normalizeHeader` (hindi pinapansin ang `*`/`( )`), `normalizeImportPhone()`. |
| `client/src/components/migration/BulkImportWizard.jsx` | MODIFIED | "Download a blank template" + gabay sa pagpuno. |
| `client/src/constants/medicalOptions.js` | **NEW** | `MEDICAL_HISTORY_OPTIONS`, `ALLERGY_OPTIONS` (group, label, keywords). |
| `client/src/components/common/ComboboxListInput.jsx` | **NEW** | Multi-select combobox na may free text, None toggle, keyboard (↑↓ Enter Esc Backspace). |
| `client/src/components/patients/PatientForm.jsx` | MODIFIED | Gumagamit ng `ComboboxListInput` (Register at Edit modal); heading "Medical". |
| `client/src/components/common/QuickInputTextarea.jsx` | **BINURA** | Pinalitan ng `ComboboxListInput`. |

**Na-verify (local, Edge via Playwright + API):** UI **31/31** (grouped list, nagsasara pagkapili at bumubukas ulit, keyword search, Filipino keywords, custom item,
blur nagdadagdag ng na-type, Backspace/X, comma paste, Escape sa list lang (hindi sa Edit modal), "pen" → Penicillin,
None confirm, eksaktong value na ipinapadala sa server, 360px walang overflow, 0 console error); template: 15/15 header
auto-match, lumang format OK, dry-run import OK, phone fix 8 kaso. Build pasado. Walang test data na naisulat (naka-stub
ang Register request). **Naka-push na** (commit `b1f5c2d`, 2026-10-12). Walang migration (walang binago sa database).

---

## 29. Mga Pagbabago Mula sa Client Visit (Oct 13, 2026)

Galing sa pagbisita sa clinic (sagot sa checklist, litrato ng papel na patient form, dental chart, at karatula; nasa
`Downloads/pagpunta sa client`). Mga desisyon ng team: **Bacoor address** lang sa print, **buong patient form**,
**baby teeth sa 2D at print lang** (hindi 3D), at **isang dentist account** pa rin (kahit dalawa ang nasa karatula).
Hindi binago (tama na ayon sa clinic): FDI numbering, surfaces, kulay, dashboard, retention. **Walang Dental X-ray** sa procedures: wala silang X-ray equipment (galing sa ibang clinic ang X-ray; dumarating sa Messenger at ina-upload ng dentist).

### A. Procedures (7 → 17) + CSV template
- Dagdag: **Consultation**, Deep Scaling, Pit & Fissure Sealant, Amalgam Filling, Inlay / Onlay, Braces
  Installation, **Crown** at **Bridge** (hiwalay na), Denture, Veneers, Teeth Whitening. Naka-grupo sa 8 category
  (Diagnostic → Cosmetic). Ang lumang "Crown / Bridge" ay nasa database pa: lumalabas sa dashboard kapag may record,
  pero wala na sa mga form; sa import, may mensaheng "Write Crown or Bridge".
- **Add Treatment:** maikling label sa button (hal. "Cleaning", buo sa tooltip), 2–5 column, modal `max-w-4xl`, kaya kita
  pa rin ang Save sa 1366×768. Sa phone (390px), kaunting scroll sa loob ng modal.
- **Import aliases:** "Cleaning", "Pasta", "Bunot", "RCT", "Jacket Crown", "Whitening", atbp. → tamang procedure.
- **Dashboard "Procedures Performed":** kulay bawat **category** (8 lang ang ligtas na kulay; validate_palette adjacent PASS,
  CVD ΔE 15.2, normal 15.6), may legend.

### B. Mga kondisyon (6 → 23) + letter codes ng clinic
- Lahat ng nasa legend ng papel nila (D, M, F, I, RF, MO, RM, J, A, AB, P, In, FX, X, XO, ✓, CM, Sp, S) + Impacted, Fractured,
  Unerupted. Pareho ang 6 na lumang code (binago lang ang label, hal. Crown → "Jacket Crown"), kaya buo ang lumang data.
- **Kulay = grupo (7)**, ang **letter code** ang nakasulat sa mismong ngipin (palapit sa bite line), gaya ng kahon sa papel nila.
  Aqua (Other findings) vs magenta = CVD ΔE 6.1 (WARN, pinapayagan dahil laging may letter code).
- `scope`: pang-surface (D, F, A, FX, In, S, Fr) o pang-buong-ngipin (hal. M, J, RC). Ang pang-buong-ngipin ay laging
  sine-save sa 5 surface (client **at** server: `WHOLE_TOOTH_CONDITIONS`). Lahat ng "missing" (X, XO, M, MO, CM) = abong X.
- Chart modal: naka-grupo, may letter. 3D pen: pang-surface lang (8). Legend (`ConditionLegend`): kulay ng grupo + nakatiklop
  na "Letter codes" (bukas sa print). Findings table: isang "Whole Tooth" row na lang (dati 6 na ulit).

### C. Baby teeth (51–55, 61–65, 71–75, 81–85)
- 2D chart: hilera sa **itaas at ibaba** ng permanent (gaya ng papel nila), 85% ang laki, nakahanay sa papalit na ngipin
  (55 sa tapat ng 15). Primary 4–5 = molar ang hugis. Kusang lumalabas kapag may naitala; may **"Show baby teeth"** button.
- Print Chart: lumalabas kapag may naitala. 3D: paalala na "Baby teeth appear on the 2D chart only".
- Tooth dropdown (Add Treatment, Manual Entry): may "Baby teeth" na grupo.
- **Bagong server check:** tooth number = 11–48 o 51–85 (o "ALL") sa chart, Add Treatment, batch, at import. Dati walang
  check sa Add Treatment at chart (puwedeng "99").

### D. Buong Patient Information Record (papel na form nila)
- Middle name, occupation, nationality, religion, **parent/guardian** (lumalabas kapag wala pang 18), previous dentist, last
  dental visit, physician (name, specialty, office address/number), **Yes/No na tanong 1–7 at 10** (may "Please specify"
  kapag Yes; "For women" kapag Female), bleeding time, blood type, blood pressure. Ang #8 (allergies) at #13 (checklist ng
  sakit) ay ang dating Allergies at Medical History (dinagdagan ng "Respiratory problems" at "Jaundice").
- Yes/No: **Yes / No / hindi natanong** (NULL). Pindutin ulit para burahin. Kapag Male, binubura ang pang-babae (server din).
- Profile: dilaw na "Health questions: ..." sa header (hal. Pregnant, Taking medication), at nakatiklop na
  **Patient Information Record** card. Print Summary: may "Patient Information" (ang may sagot lang). Pangalan may middle name.
- CSV export at import: lahat ng bagong field (Yes/No: Yes/No/Oo/Hindi). Template: 43 column; ang Map Columns step ay may
  hiwalay na grupong "Patient information record (optional)" (label galing sa server).

### E. Print header
- Gaya ng papel nila: logo, **437 Sapanghila Building (above LJ Bike Shop), Molino IV, Bacoor, Cavite**, Smart/Globe na numero,
  email (`constants/clinic.js` → `CLINIC_INFO`). Sa lahat ng print page.

### F. Intraoral Examination (ibaba ng papel na chart nila)
- **Periodontal Screening** (gingivitis, early/moderate/advanced periodontitis), **Occlusion** (Class I/II/III molar, overjet,
  overbite, midline deviation, crossbite), **Appliances** (orthodontic, stayplate, others), **TMD** (clenching, clicking,
  trismus, muscle spasm). Para sa buong bibig, kaya hiwalay na table (isang kasalukuyang record bawat patient).
- Card sa ilalim ng 2D/3D chart sa Dental Chart tab: checkbox, lalabas ang Save kapag may binago. Patient: basa lang.
  Kasama sa Print Chart (2D at 3D) kapag may laman. Audit: `UPDATE_INTRAORAL_EXAM` (may dating laman sa details).

### Hindi muna isinama: Appointments
Ginawa (bagong tab sa profile, dashboard card, Copy reminder / Text patient, paalala sa oras ng clinic) pero **tinanggal muna**
ayon sa hiling ng team (Oct 14, 2026). Walang natira sa code o sa local database. Backup ng code:
`Downloads/pagpunta sa client/appointments-backup/` (mga file + `shared-files-before-removal.diff`). Kapag ibabalik, gawing
**017** ang migration (016 na ang intraoral).

> ⚠️ **Bago/kasabay ng push, patakbuhin sa Aiven ang migrations 014, 015, 016**
> (`$env:DOTENV_CONFIG_PATH=".env.aiven"; npm run migrate` sa `server/`). Kung hindi: pumapalya ang pag-save ng bagong
> kondisyon (014), ang pag-register at pag-edit ng patient (015), at ang Intraoral Examination (016). ✅ Napatakbo na sa Aiven (2026-10-14, bago ang push).
> **Para sa paper:** i-update ang ERD (bagong columns sa `patients`, bagong `intraoral_exams` table, bagong condition codes),
> ang listahan ng procedures, at banggitin na tugma na sa form at chart ng clinic.

| Name | Type | Purpose |
|---|---|---|
| `server/db/migrations/014_add_clinic_chart_conditions.sql` | **NEW** | 17 bagong `condition_code`. Napatakbo na sa local. |
| `server/db/migrations/015_add_patient_information_record.sql` | **NEW** | 28 column sa `patients`. Napatakbo na sa local. |
| `server/db/migrations/016_add_intraoral_exams.sql` | **NEW** | `intraoral_exams` (JSON findings bawat patient). Napatakbo na sa local. |
| `server/src/models/chartModel.js`, `controllers/chart.controller.js`, `routes/chart.routes.js` | MODIFIED | `GET/PUT /patients/:code/intraoral` (whitelist `INTRAORAL_ITEMS`, `MOLAR_CLASSES`). |
| `client/src/components/chart/IntraoralExam.jsx` | **NEW** | Card (edit/view) at print na bersyon. `INTRAORAL_GROUPS` sa `dental.js`; `services/chart.js` may get/save. |
| `server/src/utils/patientFields.js` | **NEW** | `EXTRA_PATIENT_FIELDS` (iisang listahan: model, validation, import/export), `toDbValue`, `parseYesNo`. |
| `server/src/utils/validators.js` | MODIFIED | `isValidToothNumber` (permanent + baby), `CHART_CONDITIONS`, `WHOLE_TOOTH_CONDITIONS`. |
| `server/src/models/patientModel.js` | MODIFIED | Insert/update ng mga bagong field; pang-babae → NULL kapag male. |
| `server/src/routes/{patients,chart}.routes.js`, `controllers/{patients,chart}.controller.js` | MODIFIED | Validation ng bagong field at tooth number; whole-tooth conditions; CSV export may bagong columns. |
| `server/src/services/patientImportService.js`, `controllers/patientImport.controller.js` | MODIFIED | 17 procedures + aliases, baby teeth, bagong columns + Yes/No, template 43 column, `infoFields`/`fieldLabels` sa preview. |
| `client/src/constants/dental.js` | MODIFIED | `PROCEDURE_CATEGORIES`, 17 `PROCEDURES` (`short`), `RETIRED_PROCEDURES`, `PRIMARY_ROWS/TEETH`, `TOOTH_SELECT_GROUPS`, `CONDITION_GROUPS`, 23 `CONDITIONS` (letter/scope), helpers. |
| `client/src/constants/{clinic,patientInfo}.js` | **NEW** | `CLINIC_INFO`; `INFO_TEXT_FIELDS`, `HEALTH_QUESTIONS`, `BLOOD_TYPES`, `patientInfoToForm`. |
| `client/src/constants/{dashboardColors,fieldLimits,medicalOptions}.js` | MODIFIED | Category/condition colors + legends; limits ng bagong field; 2 bagong medical option. |
| `client/src/components/chart/{Odontogram2D,Tooth,toothShape,ChartEntryModal,ChartFindings,Odontogram3D,Tooth3D}.jsx` | MODIFIED | Baby teeth rows/toggle, letter codes, grouped modal, whole-tooth rules, findings dedupe, 3D pen. |
| `client/src/components/chart/ConditionLegend.jsx` | **NEW** | Legend ng grupo + letter codes. |
| `client/src/components/patients/PatientInfoRecord.jsx` | **NEW** | Card ng buong record + `healthAlerts()`. |
| `client/src/components/patients/{PatientForm,EditPatientModal,AddTreatmentForm}.jsx` | MODIFIED | Bagong sections + `YesNoQuestion`; prefill; 17 procedures. |
| `client/src/components/common/PrintHeader.jsx` | MODIFIED | Address, numbers, email. |
| `client/src/components/dashboard/HorizontalBarChart.jsx` | MODIFIED | `legend` prop. |
| `client/src/components/migration/{BulkImportWizard,LegacyTreatmentEntry}.jsx` | MODIFIED | Grupo ng bagong field, gabay sa Yes/No at aliases, grouped procedures, baby teeth. |
| `client/src/pages/{Dashboard,PatientProfile,PatientSummaryPrint,ChartPrint,Chart3DPrint}Page.jsx` | MODIFIED | Tingnan A–F. |
| `client/src/utils/{auditAction,patientName}.js` | MODIFIED | Audit labels (condition, intraoral), middle name. |
| `.claude/skills/dentavault-ui/SKILL.md` | MODIFIED | "Clinic data" na seksyon (procedures, conditions, patient info, clinic constants). |

**Na-verify (local, Edge via Playwright + API):** Phase 1 **21/21** (procedures, walang Dental X-ray, aliases, lumang import format, dashboard legend,
Save kita sa 1366×768, print header); Phase 2 **29/29** (bagong codes, whole-tooth mula sa surface, baby teeth 55/84, maling
tooth number 59/99/19/abc = 422, letter codes, toggle, grouped modal 23, print + findings dedupe, 3D pen 8); Phase 3 **30/30**
(create/update/export/import ng bagong field, Oo/Hindi, male → binubura ang pang-babae, guardian para sa minor, Edit prefill,
Print Summary; 2 sa test script ay timing, nakumpirma sa screenshot); Phase 5 **13/13** (intraoral API 422/403, card, Save, print, 360px); patient view 4/4; responsive sweep **45 screens** (320–1366px), 0 overflow, 0 page errors (bago tanggalin ang Appointments; pagkatapos: build at 3 tab sa 320–1024px muling sinuri). Build pasado.
Nilinis ang lahat ng test data. **Naka-push na** (commit `5cd533d`, 2026-10-14). Napatakbo muna ang migrations 014–016 sa Aiven bago ang push.
