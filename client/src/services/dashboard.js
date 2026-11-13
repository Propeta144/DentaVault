import api from './api'
import { dashboardPreset, dashboardRangeKey } from '../utils/dashboardRange'

// Maliit na cache ng Dashboard data (#42), walang bagong library (parang
// "stale-while-revalidate" ng React Query/SWR):
// - `cached`: huling nakuhang data per date range (hanggang anim). Ito muna ang
//   ipinapakita (agad), habang kinukuha ang bago sa background.
// - `inflight`: iisang request per range kahit sabay na tawagin (hal. prefetch sa
//   login + pagbukas ng Dashboard), kaya walang dobleng query sa server.
// Binubura sa sign out (clearDashboardCache sa AuthContext), para walang
// matirang data ng naunang user sa device.
const cached = new Map()
const inflight = new Map()
let generation = 0

export function getDashboard(range = dashboardPreset()) {
  const key = dashboardRangeKey(range)
  if (!inflight.has(key)) {
    const started = generation
    const request = api
      .get('/dashboard', { params: range })
      .then((r) => {
        if (started === generation) {
          if (cached.size >= 6) cached.delete(cached.keys().next().value)
          cached.set(key, r.data)
        }
        return r.data
      })
      .finally(() => {
        if (started === generation) inflight.delete(key)
      })
    inflight.set(key, request)
  }
  return inflight.get(key)
}

// Pagka-login ng dentist: simulan na agad ang pagkuha, kasabay ng pag-download
// ng Dashboard page (dati sunod-sunod: login → page file → data).
export function prefetchDashboard() {
  getDashboard().catch(() => {})
}

export function peekDashboard(range = dashboardPreset()) {
  return cached.get(dashboardRangeKey(range)) || null
}

export function clearDashboardCache() {
  generation++
  cached.clear()
  inflight.clear()
}

export function listDashboardRecords(params) {
  return api.get('/dashboard/records', { params }).then((r) => r.data)
}
