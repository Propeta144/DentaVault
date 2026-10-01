import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Stethoscope, ScanLine, MailWarning, LayoutDashboard } from 'lucide-react'
import { getDashboard } from '../services/dashboard'
import StatTile from '../components/dashboard/StatTile'
import HorizontalBarChart from '../components/dashboard/HorizontalBarChart'
import MonthlyTrendChart from '../components/dashboard/MonthlyTrendChart'
import StatusBadge from '../components/common/StatusBadge'
import PageLoader from '../components/common/PageLoader'
import { actionVariant } from '../utils/auditAction'
import { PROCEDURE_CHART_ORDER, PROCEDURE_OTHER, CONDITION_CHART_ORDER } from '../constants/dashboardColors'

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return <PageLoader label="Loading dashboard..." />

  const { stats, procedureBreakdown, conditionBreakdown, monthlyTrend, recentActivity } = data

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
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <LayoutDashboard className="h-6 w-6 text-sky-600" />
          Dashboard
        </h1>
        <p className="text-base text-slate-500">A snapshot of the clinic — patients, treatments, and X-rays.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active Patients" value={stats.activePatients} icon={Users} />
        <StatTile label="Treatments This Month" value={stats.treatmentsThisMonth} icon={Stethoscope} />
        <StatTile label="X-rays This Month" value={stats.xraysThisMonth} icon={ScanLine} />
        <StatTile
          label="Unreviewed X-rays"
          value={stats.unreviewedXrays}
          icon={MailWarning}
          accent={stats.unreviewedXrays > 0}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Procedures Performed</h2>
          <HorizontalBarChart data={procedureData} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Tooth Condition Breakdown</h2>
          <p className="mb-3 text-sm text-slate-400">
            Current state across all patients' dental charts (latest entry per tooth surface).
          </p>
          <HorizontalBarChart data={conditionData} showLegend />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">New Patients &amp; Treatments </h2>
          <MonthlyTrendChart data={monthlyTrend} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
            <Link to="/audit-log" className="text-sm font-medium text-sky-600 hover:text-sky-700">
              View full audit log →
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <StatusBadge variant={actionVariant(log.action)}>{log.action}</StatusBadge>
                    <span className="truncate text-slate-500">{log.user_name || 'system'}</span>
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {new Date(log.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
