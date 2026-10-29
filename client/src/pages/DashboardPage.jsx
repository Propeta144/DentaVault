import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { UserPlus, ScrollText, ArrowRight, Inbox, HelpCircle, CheckCircle2, ChevronRight, Users } from 'lucide-react'
import { getDashboard, peekDashboard } from '../services/dashboard'
import HorizontalBarChart from '../components/dashboard/HorizontalBarChart'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import { SkeletonBlock } from '../components/common/Skeleton'
import Avatar from '../components/common/Avatar'
import { AllergyFlag } from '../components/common/MedicalAlertBadge'
import { useAuth } from '../context/AuthContext'
import { actionVariant, actionLabel, auditPatientName, groupAuditLogs } from '../utils/auditAction'
import { calculateAge, formatActivityTime, formatDate, formatRelativeDay, greetingForNow } from '../utils/formatDate'
import { listName } from '../utils/patientName'
import { PROFILE_PATH, profileState } from '../utils/selectedPatient'
import { PROCEDURE_CATEGORY_COLORS, PROCEDURE_OTHER, CONDITION_CHART_ORDER, CONDITION_LEGEND } from '../constants/dashboardColors'
import { PROCEDURES, PROCEDURE_CATEGORIES, RETIRED_PROCEDURES, procedureShortLabel } from '../constants/dental'

// Patient-first na Dashboard (critique 2026-10-25, desisyon ng team): ang unang
// tanong ng dentist tuwing umaga ay "sino ang susunod sa upuan", hindi
// "kumusta ang clinic". Kaya:
// 1. Itaas: Recent patients, pinakabagong visit muna (isang tap pabalik sa record) at "Needs attention"
//    (bagong X-ray, mga record na hindi pa naitatala ang allergies).
// 2. Ibaba: Clinic overview (dating KPI tiles + charts), mas tahimik.

// Kulay ng tuldok sa Recent Activity: parehong grupo ng actionVariant
// (status colors). Hindi kulay lang ang nagdadala ng kahulugan: laging may
// nakasulat na label sa tabi.
const DOT = {
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-300',
}

const RECENT_LIMIT = 8
const CARD = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'

// "Dr. Nolita Reloj Teodosio-Rufin" → "Dr. Teodosio-Rufin" (huling salita =
// apelyido; may gitling ang compound na apelyido, tignan migration 009).
// Kung walang "Dr.", unang pangalan lang.
function greetingName(fullName = '') {
  const parts = fullName.trim().split(/\s+/)
  if (/^dr\.?$/i.test(parts[0]) && parts.length > 1) return `Dr. ${parts[parts.length - 1]}`
  return parts[0] || ''
}

function RecentPatients({ patients }) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <Users className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
        <p className="text-base font-medium text-slate-800">No patients yet</p>
        <p className="mt-1 text-sm text-slate-600">Register a patient to start their record.</p>
      </div>
    )
  }
  return (
    <ul className="-mx-2 divide-y divide-slate-100">
      {patients.map((p) => (
        <li key={p.patient_code}>
          <Link
            to={PROFILE_PATH}
            state={profileState(p.patient_code)}
            className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
          >
            <Avatar firstName={p.first_name} lastName={p.last_name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-slate-900">{listName(p)}</span>
              {/* Birthday: para matukoy ang magkapangalan */}
              <span className="block truncate text-sm text-slate-600">
                Born {formatDate(p.date_of_birth)} ({calculateAge(p.date_of_birth)} yrs)
              </span>
              <AllergyFlag allergies={p.allergies} />
            </span>
            <span className="hidden shrink-0 text-right text-sm text-slate-600 sm:block">
              {p.last_treatment_date ? `Last visit ${formatRelativeDay(p.last_treatment_date).toLowerCase()}` : 'No visits yet'}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function NeedsAttention({ unreviewedXrays, allergiesNotRecorded }) {
  const { rows, total } = allergiesNotRecorded
  return (
    <div className="space-y-5">
      <Link
        to="/xrays"
        className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
          unreviewedXrays > 0
            ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
            : 'border-slate-200 hover:border-sky-300'
        }`}
      >
        <Inbox className={`h-5 w-5 shrink-0 ${unreviewedXrays > 0 ? 'text-amber-700' : 'text-slate-500'}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium text-slate-900">
            {unreviewedXrays > 0
              ? `${unreviewedXrays} new X‑ray${unreviewedXrays === 1 ? '' : 's'} to review`
              : 'No new X‑rays'}
          </span>
          <span className="block text-sm text-slate-600">
            {unreviewedXrays > 0 ? 'Sent by patients, not opened yet' : 'All caught up'}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>

      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {total > 0 ? (
            <HelpCircle className="h-5 w-5 text-amber-700" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          )}
          Allergies not recorded
          {total > 0 && <span className="text-sm font-medium text-amber-800">({total})</span>}
        </h3>
        {total === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Every record has allergies filled in.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">Ask at their next visit, before any treatment.</p>
            <ul className="mt-2 space-y-0.5">
              {rows.map((p) => (
                <li key={p.patient_code}>
                  <Link
                    to={PROFILE_PATH}
                    state={profileState(p.patient_code)}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-base text-slate-800 transition-colors hover:bg-slate-50 hover:text-sky-700"
                  >
                    <span className="truncate">{listName(p)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {total > rows.length && (
              <p className="mt-1 px-2 text-sm text-slate-600">and {total - rows.length} more</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Mga placeholder habang wala pang data (#42). aria-hidden: iisang
// "Loading dashboard data" lang ang binabasa ng screen reader (nasa itaas).
function ListSkeleton({ rows = 4 }) {
  return (
    <div aria-hidden="true" className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 py-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200/70 motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-2/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton({ bars = 5 }) {
  const widths = ['w-11/12', 'w-3/4', 'w-1/2', 'w-2/5', 'w-1/4', 'w-1/5']
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="h-3.5 w-24 shrink-0" />
          <SkeletonBlock className={`h-5 ${widths[i % widths.length]}`} />
        </div>
      ))}
    </div>
  )
}

// Chart data ng "Procedures performed" at "Tooth conditions" (galing sa
// dating loob ng DashboardPage; inilipat para hindi kailangan ang data bago
// ipakita ang page).
function buildOverview({ procedureBreakdown, conditionBreakdown }, showAllProcedures) {
  // Kulay ayon sa GRUPO ng procedure, sa FIXED na pagkakasunod (hindi sorted
  // by count): tignan PROCEDURE_CATEGORY_COLORS sa dashboardColors.js kung
  // bakit. Ang lumang "Crown / Bridge" ay lumalabas lang kapag may record pa.
  // Ang hindi-standard na pangalan ay "Other".
  // Critique 2026-10-25: dati laging 21 row (karamihan 0), kaya nakatago na
  // ang 0 maliban kung "Show all". May label bawat bar, kaya ligtas pa rin
  // kahit magkatabi ang kulay na dati'y hindi.
  const procedureCounts = Object.fromEntries(procedureBreakdown.map((p) => [p.procedure_name, p.count]))
  const knownProcedures = PROCEDURE_CATEGORIES.flatMap((cat) => [
    ...PROCEDURES.filter((p) => p.category === cat.code),
    ...RETIRED_PROCEDURES.filter((p) => p.category === cat.code && procedureCounts[p.value]),
  ])
  const allProcedureData = knownProcedures.map((p) => ({
    // Lumang "Crown / Bridge" (bago hinati sa Crown at Bridge, #29): may "(old)" para hindi
    // mapagkamalang kapareho ng bagong Crown (critique 2026-10-25)
    label: RETIRED_PROCEDURES.includes(p) ? `${p.value} (old)` : procedureShortLabel(p.value),
    value: procedureCounts[p.value] || 0,
    color: PROCEDURE_CATEGORY_COLORS[p.category],
    category: p.category,
    tooltip: RETIRED_PROCEDURES.includes(p)
      ? `${p.value}: ${procedureCounts[p.value] || 0} (older records, before Crown and Bridge were separated)`
      : `${p.value}: ${procedureCounts[p.value] || 0}`,
  }))
  const otherProcedures = procedureBreakdown.filter((p) => !knownProcedures.some((known) => known.value === p.procedure_name))
  if (otherProcedures.length > 0) {
    allProcedureData.push({
      label: PROCEDURE_OTHER.label,
      value: otherProcedures.reduce((sum, p) => sum + p.count, 0),
      color: PROCEDURE_OTHER.color,
      category: 'other',
      tooltip: `Other: ${otherProcedures.map((p) => `${p.procedure_name} (${p.count})`).join(', ')}`,
    })
  }
  const procedureData = showAllProcedures ? allProcedureData : allProcedureData.filter((d) => d.value > 0)
  const hiddenProcedures = allProcedureData.length - allProcedureData.filter((d) => d.value > 0).length
  // Legend: ang mga grupong nakikita lang
  const shownCategories = new Set(procedureData.map((d) => d.category))
  const procedureLegend = [
    ...PROCEDURE_CATEGORIES.filter((c) => shownCategories.has(c.code)).map((c) => ({
      label: c.label,
      color: PROCEDURE_CATEGORY_COLORS[c.code],
    })),
    ...(shownCategories.has('other') ? [PROCEDURE_OTHER] : []),
  ]

  // Fixed display order (hindi sorted by count) para manatili sa loob ng
  // validated adjacency yung categorical color assignment (dashboardColors.js).
  const conditionCounts = Object.fromEntries(conditionBreakdown.map((c) => [c.condition_code, c.count]))
  // 23 na ang kondisyon, kaya ang may naitala lang ang ipinapakita
  const conditionData = CONDITION_CHART_ORDER.filter((c) => conditionCounts[c.code]).map((c) => ({
    label: c.label,
    value: conditionCounts[c.code],
    color: c.color,
  }))

  return { procedureData, hiddenProcedures, procedureLegend, conditionData }
}

export default function DashboardPage() {
  const { user } = useAuth()
  // Huling data (cache) muna kung meron, kaya agad may laman pagbalik (#42)
  const [data, setData] = useState(peekDashboard)
  const [error, setError] = useState('')
  const [showAllProcedures, setShowAllProcedures] = useState(false)

  // Laging kinukuha ang bago. Kapag pumalya pero may lumang data na, iyon na
  // lang ang ipinapakita (walang error box sa ibabaw ng gumaganang page).
  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => {
        if (!peekDashboard()) setError(err.response?.data?.error || 'Failed to load dashboard')
      })
  }, [])

  const recent = useMemo(
    () => (data ? groupAuditLogs(data.recentActivity).slice(0, RECENT_LIMIT) : []),
    [data],
  )

  // Hindi na hinihintay ang data bago ipakita ang page (#42): dati buong-page
  // spinner hanggang dumating ang lahat, kaya pati ang bati ay naantala (LCP).
  // Ngayon agad ang bati at mga section; skeleton ang laman hanggang may data.
  const stats = data?.stats
  const recentPatients = data?.recentPatients || []
  const allergiesNotRecorded = data?.allergiesNotRecorded || { rows: [], total: 0 }
  const overview = data ? buildOverview(data, showAllProcedures) : null

  return (
    <div className="space-y-8">
      {/* Bati + petsa + Register. Ang "Find patient" ay nasa sidebar/top bar
          na (laging kita sa lahat ng page). */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {greetingForNow()}, {greetingName(user?.fullName)}
          </h1>
        </div>
        <Link
          to="/patients/new"
          className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
        >
          <UserPlus className="h-4 w-4" />
          Register patient
        </Link>
      </div>

      {!data && !error && (
        <p role="status" className="sr-only">
          Loading dashboard data
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {error}
        </div>
      )}

      {/* ===== 1. Patients: ang uunahin ===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`${CARD} lg:col-span-2`} aria-labelledby="dash-recent-patients">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="dash-recent-patients" className="text-lg font-semibold text-slate-900">
              Recent patients
            </h2>
            <Link
              to="/patients"
              className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
            >
              All patients
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {data ? <RecentPatients patients={recentPatients} /> : <ListSkeleton rows={5} />}
        </section>

        <section className={CARD} aria-labelledby="dash-attention">
          <h2 id="dash-attention" className="mb-3 text-lg font-semibold text-slate-900">
            Needs attention
          </h2>
          {data ? (
            <NeedsAttention unreviewedXrays={stats.unreviewedXrays} allergiesNotRecorded={allergiesNotRecorded} />
          ) : (
            <ListSkeleton rows={3} />
          )}
        </section>
      </div>

      {/* ===== 2. Clinic overview: nasa ibaba ng mga patient =====
          Ang header ay ang purple na band ng official logo ("DENTAL CLINIC" sa
          malalapad na puting letra), hindi generic na KPI tiles: parehong
          itsura ng karatula ng clinic (bolder, critique 2026-10-25). */}
      <section aria-labelledby="dash-overview" className="space-y-4 pt-2">
        <div className="rounded-xl bg-sky-700 px-5 py-4 text-white shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="dash-overview" className="text-sm font-semibold uppercase tracking-[0.25em]">
              Clinic overview
            </h2>
            <dl className="grid grid-cols-3 gap-4 sm:flex sm:gap-10">
              {[
                ['Active patients', stats?.activePatients],
                ['Treatments this month', stats?.treatmentsThisMonth],
                ['X‑rays this month', stats?.xraysThisMonth],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-xs uppercase tracking-[0.12em] text-sky-100">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {data ? value : <span aria-hidden="true" className="my-1 block h-6 w-10 rounded-md bg-white/25 motion-safe:animate-pulse" />}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={CARD}>
            <h3 className="mb-1 text-base font-semibold text-slate-900">Procedures performed</h3>
            <p className="mb-4 text-sm text-slate-600">All treatments on record, by procedure.</p>
            {overview ? (
              <HorizontalBarChart data={overview.procedureData} legend={overview.procedureLegend} minScale={5} />
            ) : (
              <ChartSkeleton bars={6} />
            )}
            {overview?.hiddenProcedures > 0 && (
              <button
                type="button"
                onClick={() => setShowAllProcedures((v) => !v)}
                aria-expanded={showAllProcedures}
                className="mt-3 flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
              >
                {showAllProcedures ? 'Hide procedures with no records' : `Show all procedures (${overview.hiddenProcedures} with no records)`}
              </button>
            )}
          </section>
          <section className={CARD}>
            <h3 className="mb-1 text-base font-semibold text-slate-900">Tooth conditions</h3>
            <p className="mb-4 text-sm text-slate-600">Current state across all charts (latest entry per tooth surface).</p>
            {overview ? (
              <HorizontalBarChart data={overview.conditionData} legend={CONDITION_LEGEND} minScale={5} />
            ) : (
              <ChartSkeleton bars={5} />
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={CARD}>
            <h3 className="mb-1 text-base font-semibold text-slate-900">New patients and treatments</h3>
            <p className="mb-4 text-sm text-slate-600">Last 6 months. Hover or tap a month for exact numbers.</p>
            {data ? <MonthlyTrendChart data={data.monthlyTrend} /> : <SkeletonBlock className="h-48 w-full" />}
          </section>

          <section className={CARD}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
              <Link
                to="/audit-log"
                className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
              >
                Full audit log
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {!data ? (
              <ListSkeleton rows={5} />
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <ScrollText className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
                <p className="text-sm text-slate-600">No activity on patient records yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((g) => {
                  // Hindi na uulitin ang pangalan kung ang patient mismo ang
                  // gumawa (hal. patient na nag-upload sa portal)
                  const name = auditPatientName(g)
                  const patientName = name && name !== g.user_name ? name : null
                  return (
                    <li key={g.id} className="flex items-start gap-3 py-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[actionVariant(g.action)]}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          {actionLabel(g.action, g.count)}
                          {patientName && (
                            <>
                              {' · '}
                              <span className="font-medium">{patientName}</span>
                            </>
                          )}
                        </p>
                        {/* Pangalan lang kapag hindi ang dentist (iisa lang ang dentist account) */}
                        {g.user_role && g.user_role !== 'dentist' && (
                          <p className="truncate text-xs text-slate-600">{g.user_name || 'System'}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-slate-600">{formatActivityTime(g.created_at)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
