import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Users, LogOut, ScrollText, LayoutDashboard, Search, FileHeart, ChevronDown } from 'lucide-react'
import BrandMark from '../components/common/BrandMark'
import Avatar from '../components/common/Avatar'
import DropdownMenu from '../components/common/DropdownMenu'
import PageLoader from '../components/common/PageLoader'
import { useAuth } from '../context/AuthContext'
import { getUnreviewedXrayCount } from '../services/xrays'
import { PROFILE_PATH } from '../utils/selectedPatient'

// Navigation: top bar (lahat ng screen) + bottom tab bar (phone lang).
//
// Dati: madilim na sidebar na laging nakabukas sa kaliwa (240px), pero
// tatlong menu lang ang laman (Dashboard, Patients, Audit Log), kaya halos
// bakante ito at sinasakop ang lapad na kailangan ng Dental Chart at mga
// table. Sa phone naman, nakatago ito sa hamburger (dalawang tap bago
// makalipat ng page).
//
// Ngayon:
// - Top bar (puti, official mark): menu sa gitna (md pataas), Find patient,
//   at user menu (avatar → pangalan, role, Sign out).
// - Phone (below md): bottom tab bar, parang mobile app — isang tap lang,
//   abot ng hinlalaki. Wala ito sa patient account (iisa lang ang menu niya).
// - Buong lapad na ang content (hanggang 1600px).
//
// Yung X-rays, nasa loob ng patient profile mismo, kaya walang hiwalay na
// menu; ang unreviewed-email-X-ray count ay badge sa "Patients".
// Dentist-only ang Dashboard/Audit Log. Patient account: "My Record" lang.

// Lazy (Feature #9): dina-download lang kapag binuksan ang search, para
// hindi lumaki ang unang download ng app (kasama nito ang date-fns).
const PatientSearchPalette = lazy(() => import('../components/common/PatientSearchPalette'))

// Ctrl+K (Windows) / ⌘K (Mac) para sa patient search palette
function isSearchShortcut(e) {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
}

function NavBadge({ count }) {
  if (!count) return null
  return (
    <span
      className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
      title={`${count} new X-ray${count === 1 ? '' : 's'} from email`}
    >
      {count}
    </span>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [unreviewedCount, setUnreviewedCount] = useState(0)
  const isDentist = user?.role === 'dentist'

  // Re-check tuwing magbabago yung route — mura lang naman, at yun din
  // dahilan kung bakit mawawala agad yung badge pagkatapos buksan ng
  // dentist yung X-ray tab ng isang patient (na siyang nagmamark ng
  // email-sourced X-rays bilang reviewed).
  useEffect(() => {
    if (!isDentist) return
    getUnreviewedXrayCount()
      .then(setUnreviewedCount)
      .catch(() => {}) // non-critical lang naman 'to: kahit mag-fail yung badge count, hindi dapat maapektuhan yung navigation
  }, [isDentist, location.pathname])

  useEffect(() => {
    if (!isDentist) return
    function handleKey(e) {
      if (isSearchShortcut(e)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isDentist])

  const navItems = isDentist
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/patients', label: 'Patients', icon: Users, badge: unreviewedCount },
        { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
      ]
    : [{ to: PROFILE_PATH, label: 'My Record', icon: FileHeart }]
  const hasBottomNav = navItems.length > 1

  const [firstName, ...rest] = (user?.fullName || '').replace(/^Dr\.?\s+/i, '').split(' ')
  const lastName = rest[rest.length - 1] || ''

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-md pr-1" aria-label="DentaVault home">
            {/* Official mark sa eksaktong kulay ng logo (#3A2266, galing sa
                LOGOS) — brand asset ito, hindi UI color. */}
            <BrandMark className="h-9 w-9 text-[#3A2266]" />
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight text-slate-900">DentaVault</span>
              <span className="hidden text-xs text-slate-500 lg:block">Teodosio-Rufin Dental Clinic</span>
            </span>
          </Link>

          {/* Menu: md pataas (sa phone, nasa bottom tab bar) */}
          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-base font-medium transition-colors ${
                    isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                <NavBadge count={item.badge} />
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {isDentist && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Find a patient"
                // Tablet (md): icon lang, para kasya ang tatlong menu nang
                // hindi nahahati sa dalawang linya. lg pataas: buong search box.
                className="flex h-11 min-w-11 items-center justify-center gap-2 rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:w-64 lg:justify-start lg:border lg:border-slate-300 lg:bg-white lg:px-3 lg:hover:border-slate-400"
              >
                <Search className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" />
                <span className="hidden whitespace-nowrap text-base lg:inline">Find patient</span>
                <kbd className="ml-auto hidden rounded border border-slate-200 px-1.5 text-xs text-slate-400 lg:inline">
                  Ctrl K
                </kbd>
              </button>
            )}

            <DropdownMenu
              label="Account menu"
              triggerClassName="flex min-h-11 items-center gap-2 rounded-full p-1 transition-colors hover:bg-slate-100 xl:rounded-md xl:pr-2"
              trigger={
                <>
                  <Avatar firstName={firstName} lastName={lastName} size="sm" tone="dark" />
                  <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 xl:block">
                    {user?.fullName}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
                </>
              }
              header={
                <>
                  <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
                </>
              }
              items={[{ label: 'Sign out', icon: LogOut, onClick: logout }]}
            />
          </div>
        </div>
      </header>

      {/* pb sa phone: espasyo para sa bottom tab bar (h-16 + safe area) */}
      <main
        className={`mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 sm:pt-6 ${
          hasBottomNav ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8' : 'pb-8'
        }`}
      >
        {/* Suspense DITO (sa loob ng main): habang dina-download ang page,
            kita pa rin ang navigation at loader lang ang nasa content. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom tab bar: phone lang */}
      {hasBottomNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          <div className={`grid ${navItems.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                    isActive ? 'text-sky-700' : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-sky-600" />}
                    <span className="relative">
                      <item.icon className="h-6 w-6" />
                      {!!item.badge && (
                        <span className="absolute -right-3 -top-1.5">
                          <NavBadge count={item.badge} />
                        </span>
                      )}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {searchOpen && (
        <Suspense fallback={null}>
          <PatientSearchPalette onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
