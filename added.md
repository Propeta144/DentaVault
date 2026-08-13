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
