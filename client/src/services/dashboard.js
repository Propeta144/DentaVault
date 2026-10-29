import api from './api'

// Maliit na cache ng Dashboard data (#42), walang bagong library (parang
// "stale-while-revalidate" ng React Query/SWR):
// - `cached`: huling nakuhang data. Pagbalik sa Dashboard, ito muna ang
//   ipinapakita (agad), habang kinukuha ang bago sa background.
// - `inflight`: iisang request lang kahit sabay na tawagin (hal. prefetch sa
//   login + pagbukas ng Dashboard), kaya walang dobleng query sa server.
// Binubura sa sign out (clearDashboardCache sa AuthContext), para walang
// matirang data ng naunang user sa device.
let cached = null
let inflight = null

export function getDashboard() {
  if (!inflight) {
    inflight = api
      .get('/dashboard')
      .then((r) => {
        cached = r.data
        return r.data
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

// Pagka-login ng dentist: simulan na agad ang pagkuha, kasabay ng pag-download
// ng Dashboard page (dati sunod-sunod: login → page file → data).
export function prefetchDashboard() {
  getDashboard().catch(() => {})
}

export function peekDashboard() {
  return cached
}

export function clearDashboardCache() {
  cached = null
  inflight = null
}
