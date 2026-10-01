import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Users, Stethoscope, ScanLine, MailWarning, UserPlus, ScrollText, ArrowRight } from 'lucide-react'
import { getDashboard } from '../services/dashboard'
import StatTile from '../components/dashboard/StatTile'
import HorizontalBarChart from '../components/dashboard/HorizontalBarChart'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import PageLoader from '../components/common/PageLoader'
import { useAuth } from '../context/AuthContext'
import { actionVariant, actionLabel, auditPatientName, groupAuditLogs } from '../utils/auditAction'
import { formatActivityTime, greetingForNow } from '../utils/formatDate'
import { PROCEDURE_CHART_ORDER, PROCEDURE_OTHER, CONDITION_CHART_ORDER } from '../constants/dashboardColors'

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

// "Dr. Nolita Reloj Teodosio-Rufin" → "Dr. Teodosio-Rufin" (huling salita =
// apelyido; may gitling ang compound na apelyido, tignan migration 009).
// Kung walang "Dr.", unang pangalan lang.
function greetingName(fullName = '') {
  const parts = fullName.trim().split(/\s+/)
  if (/^dr\.?$/i.test(parts[0]) && parts.length > 1) return `Dr. ${parts[parts.length - 1]}`
  return parts[0] || ''
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'))
  }, [])

  const recent = useMemo(
    () => (data ? groupAuditLogs(data.recentActivity).slice(0, RECENT_LIMIT) : []),
    [data],
  )

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
  }
  if (!data) return <PageLoader label="Loading dashboard..." />

  const { stats, procedureBreakdown, conditionBreakdown, monthlyTrend } = data

  // Iba-ibang kulay bawat procedure, sa FIXED na pagkakasunod (hindi sorted
  // by count) — tignan PROCEDURE_CHART_ORDER sa dashboardColors.js kung
  // bakit. Laging kita lahat ng 7 standard procedures (kahit 0), para hindi
  // gumagalaw ang pwesto/kulay nila. Ang mga hindi-standard na pangalan,
  // pinagsasama sa "Other" (nasa tooltip kung ano-ano sila).
  const procedureCounts = Object.fromEntries(procedureBreakdown.map((p) => [p.procedure_name, p.count]))
  const procedureData = PROCEDURE_CHART_ORDER.map((p) => ({
    label: p.label,
    value: procedureCounts[p.value] || 0,
    color: p.color,
    tooltip: `${p.value}: ${procedureCounts[p.value] || 0}`,
  }))
  const otherProcedures = procedureBreakdown.filter(
    (p) => !PROCEDURE_CHART_ORDER.some((known) => known.value === p.procedure_name),
  )
  if (otherProcedures.length > 0) {
    procedureData.push({
      label: PROCEDURE_OTHER.label,
      value: otherProcedures.reduce((sum, p) => sum + p.count, 0),
      color: PROCEDURE_OTHER.color,
      tooltip: `Other: ${otherProcedures.map((p) => `${p.procedure_name} (${p.count})`).join(', ')}`,
    })
  }

  // Fixed display order (hindi sorted by count) para manatili sa loob ng
  // validated adjacency yung categorical color assignment — tignan yung
  // dashboardColors.js.
  const conditionCounts = Object.fromEntries(conditionBreakdown.map((c) => [c.condition_code, c.count]))
  const conditionData = CONDITION_CHART_ORDER.map((c) => ({
    label: c.label,
    value: conditionCounts[c.code] || 0,
    color: c.color,
  }))

  return (
    <div>
      {/* Bati + petsa ngayon + quick actions. Dati: "Dashboard" lang, at
          kailangan pang pumunta sa Patients para maghanap o mag-register. */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {greetingForNow()}, {greetingName(user?.fullName)}
          </h1>
          <p className="text-base text-slate-500">Here's what's happening at the clinic.</p>
        </div>
        {/* "Find patient" nasa top bar na (laging kita sa lahat ng page),
            kaya Register na lang dito. Buong lapad sa phone. */}
        <Link
          to="/patients/new"
          className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 sm:self-start lg:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          Register patient
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active patients" value={stats.activePatients} icon={Users} hint="View all" to="/patients" />
        <StatTile label="Treatments" value={stats.treatmentsThisMonth} icon={Stethoscope} hint="This month" />
        <StatTile label="X-rays uploaded" value={stats.xraysThisMonth} icon={ScanLine} hint="This month" />
        <StatTile
          // ‑ = non-breaking hyphen: hindi mahahati sa "X- / rays" sa phone
          label={'Unreviewed X‑rays'}
          value={stats.unreviewedXrays}
          icon={MailWarning}
          accent={stats.unreviewedXrays > 0}
          hint={stats.unreviewedXrays > 0 ? 'From email, not opened yet' : 'All caught up'}
          to="/xrays"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Procedures Performed</h2>
          <p className="mb-4 text-sm text-slate-400">All treatments on record, by procedure.</p>
          <HorizontalBarChart data={procedureData} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-900">Tooth Condition Breakdown</h2>
          <p className="mb-4 text-sm text-slate-400">
            Current state across all patients' dental charts (latest entry per tooth surface).
          </p>
          <HorizontalBarChart data={conditionData} showLegend />
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-1 text-base font-semibold text-slate-900">New Patients &amp; Treatments</h2>
          <p className="mb-4 text-sm text-slate-400">Last 6 months. Hover or tap a month for exact numbers.</p>
          <MonthlyTrendChart data={monthlyTrend} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <Link
              to="/audit-log"
              className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50"
            >
              Full audit log
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ScrollText className="mb-2 h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">No activity on patient records yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((g) => {
                // Hindi na uulitin ang pangalan kung ang patient mismo ang
                // gumawa (hal. patient na nag-login sa portal)
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
                      <p className="truncate text-xs text-slate-400">{g.user_name || 'System'}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{formatActivityTime(g.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
