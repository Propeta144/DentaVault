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
