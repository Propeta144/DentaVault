import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Users, LogOut, Menu, X, ScrollText, LayoutDashboard } from 'lucide-react'
import ToothIcon from '../components/common/ToothIcon'
import PageLoader from '../components/common/PageLoader'
import { useAuth } from '../context/AuthContext'
import { getUnreviewedXrayCount } from '../services/xrays'

// Yung X-rays, dinidiretso na lang sa loob ng patient profile mismo (Patient
// ID lagi naman ang starting point clinically), kaya walang standalone
// /xrays nav item — instead, lalabas na lang yung unreviewed-email-Xray
// count bilang badge sa "Patients". Dentist-only yung Dashboard/Audit Log —
// sarili niyang record lang naman meron yung patient account, hindi buong
// clinic reports. Dashboard ang una sa listahan kasi 'yon din yung default
// landing page ng dentist (tignan yung HomeRedirect sa App.jsx).

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreviewedCount, setUnreviewedCount] = useState(0)

  // I-close yung drawer tuwing magbabago yung route, para hindi na naiwan
  // bukas yung overlay sa likod ng bagong page tuwing tatapik ng nav link.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Re-check tuwing magbabago yung route — mura lang naman, at yun din
  // dahilan kung bakit mawawala agad yung badge pagkatapos buksan ng
  // dentist yung X-ray tab ng isang patient (na siyang nagmamark ng
  // email-sourced X-rays bilang reviewed) — di na kailangan pa ng shared
  // context.
  useEffect(() => {
    if (user?.role !== 'dentist') return
    getUnreviewedXrayCount()
      .then(setUnreviewedCount)
      .catch(() => {}) // non-critical lang naman 'to: kahit mag-fail yung badge count, hindi dapat maapektuhan yung navigation
  }, [user, location.pathname])

  const navItems = [
    ...(user?.role === 'dentist' ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    { to: '/patients', label: 'Patients', icon: Users, badge: unreviewedCount },
    ...(user?.role === 'dentist' ? [{ to: '/audit-log', label: 'Audit Log', icon: ScrollText }] : []),
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar: hamburger + title lang ang nandito, below md lang 'to lalabas */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-slate-100 md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <ToothIcon className="h-5 w-5 text-sky-400" />
          <span className="font-semibold tracking-tight">DentaVault</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Backdrop, mobile lang, lalabas habang bukas yung drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Laging fixed sa viewport — kahit sa md+ pa — para yung sidebar
          (nav links, at yung dentist name / sign-out footer) laging
          buong makikita kahit gaano pa kahaba ang scroll ng main content
          (malaking patient table, mataas na dashboard). Dati kasi
          md:relative 'to, kaya bumabalik siya sa normal document flow sa
          desktop tapos sumasama sa scroll kasama lahat. Yung `main` sa
          baba, may kasamang md:pl-[16.5rem] (15rem width ng sidebar + yung
          usual 1.5rem gutter) para hindi na matabunan yung content ng
          laging-fixed na sidebar ngayon. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col overflow-y-auto bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out md:w-60 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <Link
            to="/"
            className="flex items-center gap-2 transition-colors hover:text-sky-300"
          >
            <ToothIcon className="h-6 w-6 text-sky-400" />
            <span className="text-lg font-semibold tracking-tight">DentaVault</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2.5 rounded-md px-3 text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {!!item.badge && (
                <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold leading-none text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-4 py-3 text-base">
          <div className="break-words text-slate-200">{user?.fullName}</div>
          <div className="text-sm uppercase tracking-wide text-slate-500">{user?.role}</div>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex min-h-11 items-center gap-1.5 text-base font-medium text-slate-300 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="p-4 sm:p-6 md:pl-[16.5rem]">
        {/* Suspense DITO (sa loob ng main, hindi sa labas ng buong layout) para
            habang dina-download ang page na pinindot, nakikita pa rin ang
            sidebar at loading indicator lang ang nasa content area. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
