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
| Warning / needs attention / export | `amber` | Migrated Record, unreviewed X-ray badge |
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
- Loading: `<p className="px-1 py-6 text-center text-sm text-slate-400">Loading...</p>`
- Empty: card with `px-4 py-6 text-center text-sm text-slate-400`, e.g. "No patients found."
- Missing value in a cell: em dash `'—'`.

## 5. Tables
```
wrapper: hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block
table:   w-full text-left text-sm
thead:   border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500
th/td:   px-4 py-3        tbody: divide-y divide-slate-100      tr: hover:bg-slate-50
```
Primary cell link: `font-medium text-slate-900 hover:text-sky-700 hover:underline`. Other cells `text-slate-600`.
Actions column `text-right`, and only rendered for the dentist.

## 6. Responsive pattern
- Breakpoint for layout switch is **`md`**. Lists render a **card list below md**
  (`space-y-3 md:hidden`, each item a card with a `<dl className="grid grid-cols-2 ...">`) and a
  **table at md+**. New list pages must provide both.
- Grids: `grid grid-cols-1 gap-4 lg:grid-cols-2`, KPI rows `grid-cols-2 lg:grid-cols-4`.
- Sidebar is fixed (`w-60`); `main` already has `md:pl-[16.5rem]`, so pages don't add their own left offset.

## 7. Roles & routing
- Two roles: `dentist` (full clinic) and `patient` (read-only, own record only).
- Dentist-only page → wrap route in `<ProtectedRoute allowedRoles={['dentist']} />` in `App.jsx`,
  gate the nav item in `layouts/AppLayout.jsx`, **and** use `requireRole('dentist')` on the server route.
- Hide write buttons (`user.role === 'dentist' && ...`) for patients. UI gating is cosmetic;
  the server check is the real one.
- Print pages (`*PrintPage.jsx`) live outside `AppLayout` (no sidebar).

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
