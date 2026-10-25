import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Users,
  LogOut,
  ScrollText,
  LayoutDashboard,
  Search,
  FileHeart,
  ChevronsUpDown,
  KeyRound,
  Inbox,
  ArchiveRestore,
  Settings,
  MoreHorizontal,
} from 'lucide-react'
import BrandMark from '../components/common/BrandMark'
import clinicLogoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { CLINIC_INFO } from '../constants/clinic'
import Avatar from '../components/common/Avatar'
import DropdownMenu from '../components/common/DropdownMenu'
import PageLoader from '../components/common/PageLoader'
import { useAuth } from '../context/AuthContext'
import { getUnreviewedXrayCount } from '../services/xrays'
import SignInNotice from '../components/common/SignInNotice'
import { PROFILE_PATH } from '../utils/selectedPatient'

// Navigation:
// - Laptop/desktop (lg pataas): SIDEBAR sa kaliwa — logo, Find patient,
//   mga menu, at account sa ibaba.
// - Phone at tablet (below lg): top bar (logo, search, account) + bottom
//   tab bar (isang tap, abot ng hinlalaki). Hanggang 5 lang ang kasya, kaya
//   nasa "More" ang Migration at Settings.
//
// Kasaysayan: sidebar → top bar (#14, dahil 3 menu lang noon at halos
// bakante ang sidebar) → sidebar ulit, ngayong 6 na ang menu (X-ray Inbox,
// Migration, Settings — galing sa proposal), na hindi na kasya sa top bar.
//
// Dentist-only ang lahat maliban sa "My Record" at Settings. Ang bilang ng
// bagong X-ray galing sa patient ay badge sa "X-ray Inbox".

// Lazy (Feature #9): dina-download lang kapag binuksan ang search
const PatientSearchPalette = lazy(() => import('../components/common/PatientSearchPalette'))

function isSearchShortcut(e) {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
}

function NavBadge({ count }) {
  if (!count) return null
  return (
    <span
      className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
      title={`${count} new X-ray${count === 1 ? '' : 's'} from patients`}
    >
      {count}
    </span>
  )
}

// Icon ng bottom tab: may purple na "pill" sa likod kapag aktibo. Dati
// manipis na guhit sa itaas ng tab, na mukhang lumulutang at hindi
// nakakabit sa tab (critique 2026-10-25).
function TabIcon({ icon: Icon, active, badge }) {
  return (
    <span
      className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-sky-100' : ''
      }`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
      {!!badge && (
        <span className="absolute -top-1 right-0.5">
          <NavBadge count={badge} />
        </span>
      )}
    </span>
  )
}

// Phone/tablet: laman ng "More" tab (bumubukas sa ibabaw ng tab bar)
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const ref = useRef(null)
  const active = items.some((item) => location.pathname.startsWith(item.to))

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
          active || open ? 'text-sky-700' : 'text-slate-600'
        }`}
      >
        <TabIcon icon={MoreHorizontal} active={active || open} />
        More
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-2 mb-2 w-56 animate-[modal-in_120ms_ease-out] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2.5 px-4 text-base ${
                  isActive ? 'bg-sky-50 font-medium text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [unreviewedCount, setUnreviewedCount] = useState(0)
  const isDentist = user?.role === 'dentist'

  // Re-check tuwing magbabago ang route: mura lang, at dahil dito nawawala
  // agad ang badge pagkabukas ng X-rays tab ng patient o "Mark reviewed".
  useEffect(() => {
    if (!isDentist) return
    getUnreviewedXrayCount()
      .then(setUnreviewedCount)
      .catch(() => {}) // non-critical: hindi dapat maapektuhan ang navigation
  }, [isDentist, location.pathname, location.key])

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

  // `short`: label sa bottom tab bar; `more`: nasa "More" sa phone/tablet
  const navItems = isDentist
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/patients', label: 'Patients', icon: Users },
        { to: '/xrays', label: 'X-ray Inbox', short: 'X-rays', icon: Inbox, badge: unreviewedCount },
        { to: '/migration', label: 'Migration', icon: ArchiveRestore, more: true },
        { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
        { to: '/settings', label: 'Settings', icon: Settings, more: true },
      ]
    : [
        { to: PROFILE_PATH, label: 'My Record', icon: FileHeart },
        { to: '/settings', label: 'Settings', icon: Settings },
      ]
  const tabItems = navItems.filter((item) => !item.more)
  const moreItems = navItems.filter((item) => item.more)
  const tabCount = tabItems.length + (moreItems.length ? 1 : 0)

  const [firstName, ...rest] = (user?.fullName || '').replace(/^Dr\.?\s+/i, '').split(' ')
  const lastName = rest[rest.length - 1] || ''

  const accountItems = [
    { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
    { label: 'Change password', icon: KeyRound, onClick: () => navigate('/change-password') },
    { label: 'Sign out', icon: LogOut, onClick: logout },
  ]
  const accountHeader = (
    <>
      {/* Buong pangalan (wrap, hindi putol): sa sidebar, kasinglapad lang ng button ang menu */}
      <p className="break-words text-sm font-semibold text-slate-900">{user?.fullName}</p>
      <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
    </>
  )

  const brand = (
    // min-w-0 + truncate: sa 320px na phone, umiikli ang pangalan ng clinic
    // imbes na itulak palabas ng screen ang search at avatar
    <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-md pr-1" aria-label="DentaVault home">
      {/* Official mark sa eksaktong kulay ng logo (#3A2266) — brand asset, hindi UI color */}
      <BrandMark className="h-9 w-9 shrink-0 text-[#3A2266]" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-base font-semibold tracking-tight text-slate-900">DentaVault</span>
        <span className="block truncate text-xs text-slate-500">Teodosio-Rufin Dental Clinic</span>
      </span>
    </Link>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Skip link (keyboard): lumalabas lang kapag naka-focus. Dati 7 Tab
          muna (search + menu) bago makarating sa laman ng page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-base focus:font-semibold focus:text-sky-700 focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* ===== Sidebar (lg pataas) ===== */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {/* Buong official logo ng clinic (parehong itsura ng karatula nila at ng
            header ng printouts), hindi generic na icon + pangalan ng app
            (critique 2026-10-25: generic ang shell). "DentaVault" sa ilalim. */}
        <Link
          to="/"
          aria-label={`${CLINIC_INFO.name}, DentaVault home`}
          className="block border-b border-slate-100 px-5 pb-3 pt-5"
        >
          <img src={clinicLogoUrl} alt="" className="h-auto w-full" />
          <span className="mt-2 block text-center text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
            DentaVault
          </span>
        </Link>

        {isDentist && (
          <div className="px-3 pt-4">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Find a patient"
              className="flex min-h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap text-base">Find patient</span>
              <kbd className="ml-auto rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-600">Ctrl K</kbd>
            </button>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-3 text-base font-medium transition-colors ${
                  isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <NavBadge count={item.badge} />
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <DropdownMenu
            label="Account menu"
            align="left"
            matchTriggerWidth
            triggerClassName="flex min-h-11 w-56 items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-slate-100"
            trigger={
              <>
                <Avatar firstName={firstName} lastName={lastName} size="sm" tone="dark" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{user?.fullName}</span>
                  <span className="block text-xs capitalize text-slate-500">{user?.role}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
              </>
            }
            header={accountHeader}
            items={accountItems}
          />
        </div>
      </aside>

      {/* ===== Top bar (phone/tablet) ===== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-6">
          {brand}
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {isDentist && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Find a patient"
                className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <Search className="h-5 w-5" />
              </button>
            )}
            <DropdownMenu
              label="Account menu"
              triggerClassName="flex min-h-11 items-center rounded-full p-1 transition-colors hover:bg-slate-100"
              trigger={<Avatar firstName={firstName} lastName={lastName} size="sm" tone="dark" />}
              header={accountHeader}
              items={accountItems}
            />
          </div>
        </div>
      </header>

      {/* pb sa phone/tablet: espasyo para sa bottom tab bar (h-16 + safe area) */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none lg:pl-64">
        <div className="mx-auto max-w-[1600px] px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:pb-8">
          {/* Suspense DITO: habang dina-download ang page, kita pa rin ang navigation */}
          <SignInNotice />
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* ===== Bottom tab bar (phone/tablet) ===== */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className={`mx-auto grid max-w-3xl ${tabCount === 5 ? 'grid-cols-5' : tabCount === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {tabItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-sky-700' : 'text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <TabIcon icon={item.icon} active={isActive} badge={item.badge} />
                  <span className="whitespace-nowrap">{item.short || item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {moreItems.length > 0 && <MoreMenu items={moreItems} />}
        </div>
      </nav>

      {searchOpen && (
        <Suspense fallback={null}>
          <PatientSearchPalette onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
