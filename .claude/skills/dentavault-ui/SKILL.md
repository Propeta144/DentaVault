---
name: dentavault-ui
description: DentaVault's frontend design system and code conventions (React + Tailwind v4, purple clinic brand, touch-friendly sizing, card/table/modal/form patterns, role-gated pages). Use BEFORE building or restyling any page, component, modal, form, table, or nav item in client/src, and when reviewing UI for consistency.
---

# DentaVault UI Conventions

Extracted from the existing code (`client/src`). New UI must look like it was
always part of the app. When in doubt, copy the nearest existing component
instead of inventing a new pattern.

## 1. Stack & rules of thumb
- React 19 + Vite, **Tailwind v4** (config lives in `src/index.css` `@theme`, no tailwind.config.js),
  React Router v7, **lucide-react** icons, `date-fns`, axios via `services/api.js`.
- **No new UI/chart libraries.** Charts are hand-built divs/SVG (see `components/dashboard/`).
  Odontogram is hand-rolled SVG (2D) + three.js (3D).
- Code comments are written in **Taglish**, explaining *why* (match that tone and density).
- Plain JSX with Tailwind classes inline; no CSS modules, no styled-components.

## 2. Color — the brand remap (IMPORTANT)
`src/index.css` **redefines** Tailwind's `sky-*` and `slate-*` scales as the clinic's purple brand:
- `sky-*` = brand purple accent. `sky-600` = **#6F2DBD** (primary), `sky-400` = **#A663CC**.
- `slate-*` = purple-tinted neutrals. `slate-50` = #FBFBFB (page bg), `slate-950` = #171123.

So: **write `sky-*` for brand/accent and `slate-*` for neutrals.** Never introduce `purple-*`,
`violet-*`, `indigo-*`, `gray-*`, or `zinc-*`: they bypass the brand mapping.

Semantic colors keep stock Tailwind meaning:
| Meaning | Color | Example |
|---|---|---|
| Success / active / create | `emerald` | Active badge, success toast |
| Warning / needs attention / export | `amber` | Unreviewed X-ray badge, export actions |
| Danger / delete / failed | `red` | Delete button, error box |
| Update / info | `sky` | Update actions |
| Neutral / view | `slate` | Default badge |

Chart colors are separate: use `constants/dashboardColors.js` (validated palette).
Odontogram colors live in `constants/dental.js`; don't change them.
Any new chart → load the **dataviz** skill first.

## 3. Sizing & accessibility (dentist uses this chairside, often on tablet)
- **Touch targets: `min-h-11`** (44px) on every button, link-button, select, nav item. Icon-only
  buttons are `h-11 w-11` with an `aria-label`.
- Form text is **`text-base`** (not `text-sm`) for labels, inputs, and buttons. `text-sm` is for
  secondary info, table cells, and helper/error text.
- Icons: `h-4 w-4` inside buttons, `h-5 w-5` in nav/close buttons, `h-6 w-6` next to page titles.
- Every page must work at phone width (see §6 for the card/table split).

## 4. Building blocks (copy these exactly)

**Page header**
```jsx
<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-slate-900">Title</h1>
    <p className="text-base text-slate-500">One-line description</p>
  </div>
  {/* action buttons: flex flex-col gap-2 sm:flex-row */}
</div>
```

**Card / panel:** `rounded-xl border border-slate-200 bg-white p-4 shadow-sm`
(section title inside: `mb-3 text-base font-semibold text-slate-900`)

**Buttons**
- Primary: `flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700`
- Secondary: `... rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50`
- Danger: `... rounded-md bg-red-600 ... font-semibold text-white hover:bg-red-700`
- Row/ghost action: `inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-700` (delete variant: `hover:bg-red-50 hover:text-red-700`)
- Always add `disabled:opacity-50` (+ `disabled:cursor-not-allowed` on destructive) and change the
  label while busy: `{saving ? 'Saving...' : 'Save'}`.

**Inputs / selects**
```
w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900
focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100
```
Error state: `border-red-300 focus:ring-red-200`. Label: `mb-1 block text-base font-medium text-slate-700`.
Field error: `mt-1 text-sm text-red-600`. Search input has a lucide `Search` icon absolutely placed (`pl-9`).
Reuse `Field` / `SectionHeading` pattern from `components/patients/PatientForm.jsx`.

**Badges:** use `components/common/StatusBadge.jsx` (`variant`: slate | sky | emerald | amber | red, optional `icon`).
Don't hand-roll pill spans. For audit actions, use `utils/auditAction.js` `actionVariant()`.

**Modals:** always wrap in `components/common/Modal.jsx` (`title`, `onClose`, optional `maxWidth`).
It already handles Escape, backdrop blur, animation, scroll. Modal footer = two `flex-1` buttons
(Cancel secondary + action) inside `flex gap-2`, buttons `py-3`.
Destructive modals follow `DeletePatientModal.jsx`: red alert box with `AlertTriangle` + type-the-name-to-confirm.

**Feedback**
- Toasts: `const { showToast } = useToast()` → `showToast(msg)` / `showToast(msg, { type: 'error' })`.
- Inline form error box: `rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700`.
- Error message source: `err.response?.data?.error || 'Failed to ...'`.
- Loading: whole page/tab → `components/common/PageLoader.jsx` (`label`); lists/tables →
  `SkeletonRows` from `components/common/Skeleton.jsx`. No plain "Loading..." text.
- Empty: `components/common/EmptyState.jsx` (`icon`, `title`, `description`, optional `action`
  button, `compact` inside tabs/cards). Say what's missing AND what to do next.
- Missing value in a cell: em dash `'—'`.

**Forms (see `PatientForm.jsx`, `AddTreatmentForm.jsx`)**
- `noValidate` + own inline errors (red text under the field). Never rely on browser popups.
- Every `<label>` is linked (`htmlFor` + `useId`); errors/hints via `aria-describedby`, `aria-invalid`.
  `Field` in `PatientForm` does this automatically and takes a `hint`.
- After a failed submit, scroll to and focus the first `[aria-invalid="true"]` field.
- `maxLength` from `constants/fieldLimits.js` (mirrors DB column sizes; server enforces the same).
- Phones: `type="tel" inputMode="tel"`; emails `inputMode="email" autoCapitalize="none"`; names
  `autoCapitalize="words"`; patient fields `autoComplete="off"` (the dentist is typing).
- Dates: default/`max` with `todayISO()` (local date). Never `new Date().toISOString()` (UTC).
- Choices with few options (sex, procedure, condition) = big buttons with `role="radio"` in a
  `role="radiogroup"`, no silent default for clinically important fields.
- Unsaved changes: `hooks/useDiscardGuard` + `components/common/DiscardChangesBar` (modal X/Escape
  and Cancel ask first). Report dirty with `useLayoutEffect`.
- Server errors and 409 warnings render in the form footer (visible even when scrolled down).

**Shared helpers (use these, don't re-implement)**
- Dates: `utils/formatDate.js` → `formatDate` ("Oct 1, 2026"), `formatDateTime`, `formatActivityTime`
  ("Today, 7:34 PM"), `formatRelativeDay` ("5 days ago"), `calculateAge`. Never `toLocaleString()` or
  raw `YYYY-MM-DD` on screen. DATE strings are parsed as local dates (no UTC day shift).
- Names: `utils/patientName.js` → `listName` ("Dela Cruz, Juan") for lists, `fullName` for headers,
  `sexLabel`, `initials`.
- `components/common/Avatar.jsx`: initials avatar (`size` sm|md|lg, `tone` light|dark).
- `components/common/DropdownMenu.jsx`: "⋯" menu (`items: [{ label, icon, onClick, danger }]`) for
  secondary/destructive actions. Fixed-positioned, so it is safe inside `overflow-x-auto` tables.
- `components/common/BrandMark.jsx`: the official clinic mark (CSS mask, takes `text-*` color).
  Official logo PNG: `assets/brand/teodosio-rufin-logo.png` (login, print headers via `PrintHeader`).
- Patient search: the "Find patient" button / Ctrl+K palette lives in the sidebar (lg+) and the top
  bar (below lg) in `AppLayout` on every page, so pages don't add their own search-patient button.
- Audit actions: `actionLabel()` (readable text), `groupAuditLogs()`, `auditPatientName()`,
  `formatAuditDetails()` in `utils/auditAction.js`. Never show raw codes or numeric IDs.

**Tailwind gotcha:** never build class names dynamically (`xl:grid-cols-${n}`); Tailwind scans
source text, so write the full class (`n === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'`). Don't put
a display class (`grid`/`flex`) and `hidden` on the same element; wrap it instead.

## 5. Tables
```
wrapper: hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block
table:   w-full text-left text-sm
thead:   border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500
th/td:   px-4 py-3        tbody: divide-y divide-slate-100      tr: hover:bg-slate-50
```
Primary cell link: `font-medium text-slate-900 hover:text-sky-700 hover:underline`. Other cells `text-slate-600`.
Actions column `text-right`, and only rendered for the dentist. Row actions go in a `DropdownMenu`
(⋯), not side-by-side Edit/Delete buttons. When a row opens a record, make the whole `<tr>` clickable
(`cursor-pointer`) but keep the name as a real `<Link>` (with `stopPropagation`) for keyboard users.
Lists with more than one page need Prev/Next pagination (see `PatientsListPage`).

## 6. Responsive pattern
- Breakpoint for layout switch is **`md`**. Lists render a **card list below md**
  (`space-y-3 md:hidden`, each item a card with a `<dl className="grid grid-cols-2 ...">`) and a
  **table at md+**. New list pages must provide both.
- Grids: `grid grid-cols-1 gap-4 lg:grid-cols-2`, KPI rows `grid-cols-2 lg:grid-cols-4`.
- Navigation (`layouts/AppLayout.jsx`): **sidebar** (`w-64`, fixed) at **lg+** with logo, Find patient,
  menu, and the account menu at the bottom. **Below lg** (phone + tablet): white sticky top bar (h-16)
  + fixed **bottom tab bar** (max 5 slots; extra items go in its "More" menu via `more: true` in
  `navItems`). Content width at lg is viewport minus 256px (1024 → ~720px), so design for that.
  `main` already reserves bottom space for the tab bar, so pages add no offsets. Anything pinned to
  the bottom (sticky footers, toasts) must sit above the tab bar until lg:
  `bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-0`.
- New top-level page → add it to `navItems` in `AppLayout` (+ route + role gate), not to the page header.
- Check every page at **360, 768 (tablet portrait), 1024 (tablet landscape), and 1366**. Dense
  tables switch to cards below `xl` when they have more than ~5 columns (Audit Log), because at lg the sidebar leaves only ~720px; short cells
  get `whitespace-nowrap`; secondary columns use `hidden xl:table-cell`. Button labels must never
  wrap (`whitespace-nowrap`); on phones, shorten to icon + `aria-label` instead.

## 7. Roles & routing
- Two roles: `dentist` (full clinic) and `patient` (read-only, own record only).
- Dentist-only page → wrap route in `<ProtectedRoute allowedRoles={['dentist']} />` in `App.jsx`,
  gate the nav item in `layouts/AppLayout.jsx`, **and** use `requireRole('dentist')` on the server route.
- Hide write buttons (`user.role === 'dentist' && ...`) for patients. UI gating is cosmetic;
  the server check is the real one.
- Print pages (`*PrintPage.jsx`) live outside `AppLayout` (no navigation bars).

## 8. Data layer
- One service file per resource in `services/` exporting small functions returning `r.data`
  (`api.get('/x').then((r) => r.data)`). Pages never call axios directly.
- Authenticated file downloads: fetch as blob (see `exportPatientsCsv` / `downloadImportTemplate`).
- Search inputs debounce 300ms via `setTimeout` in `useEffect`.
- Sensitive views/actions log an audit entry server-side (`recordAuditLog`, action like `VIEW_X`, `EXPORT_X`).

## 9. Checklist before calling UI work done
- [ ] Only `sky-*`/`slate-*` + semantic colors; no stray palettes
- [ ] `min-h-11` targets, `text-base` form text, `aria-label` on icon buttons
- [ ] Loading, empty, and error states handled
- [ ] Works at ~400px (card view) and desktop (table view)
- [ ] Role gating on route + nav + server
- [ ] Reused `Modal`, `StatusBadge`, `useToast`, services, not duplicated
- [ ] Checked in the running app (use the **run** skill / browser) when possible
- [ ] `CLAUDE.md` updated with the NEW/MODIFIED file table for the feature
