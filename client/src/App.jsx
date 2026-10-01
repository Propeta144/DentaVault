import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import PageLoader from './components/common/PageLoader'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PROFILE_PATH } from './utils/selectedPatient'

// Lazy loading (code splitting): bawat page ay hiwalay na file (chunk) na
// dina-download LANG kapag binuksan — hal. hindi dina-download ang Audit Log
// page hangga't hindi pinipindot ng dentist ang "Audit Log". Mas maliit
// tuloy ang unang download pagbukas ng app. Habang dina-download, lalabas
// ang <PageLoader /> (tignan ang <Suspense> dito at sa AppLayout.jsx).
// Eager pa rin ang AppLayout/ProtectedRoute — sila ang "shell" na laging
// kailangan, kaya walang saysay na i-lazy.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PatientsListPage = lazy(() => import('./pages/PatientsListPage'))
const PatientRegisterPage = lazy(() => import('./pages/PatientRegisterPage'))
const PatientProfilePage = lazy(() => import('./pages/PatientProfilePage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const PatientSummaryPrintPage = lazy(() => import('./pages/PatientSummaryPrintPage'))
const ChartPrintPage = lazy(() => import('./pages/ChartPrintPage'))
const XrayPrintPage = lazy(() => import('./pages/XrayPrintPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const XrayInboxPage = lazy(() => import('./pages/XrayInboxPage'))
const MigrationPage = lazy(() => import('./pages/MigrationPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

// Yung dentist, dashboard muna ang una niyang makikita — buong clinic view
// kasi 'yan. Pero yung patient, sarili lang niyang record meron, kaya diretso
// na lang siya doon agad instead na dalhin sa list/dashboard na wala naman
// siyang access.
function HomeRedirect() {
  const { user } = useAuth()
  if (user.role === 'patient') {
    return <Navigate to={PROFILE_PATH} replace />
  }
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Para sa mga page na walang sidebar (login, print pages).
              Yung may sidebar, may sariling <Suspense> sa AppLayout. */}
          <Suspense fallback={<PageLoader fullScreen />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              {/* Pagpalit ng password: sapilitan kapag temporary password pa
                  (tignan ProtectedRoute), o kusa mula sa account menu. */}
              <Route path="change-password" element={<ChangePasswordPage />} />

              {/* Standalone 'to, walang sidebar — para malinis tignan pag pinrint.
                  Walang patient/X-ray ID sa URL — galing sa history state
                  (tignan utils/selectedPatient.js). */}
              <Route path="patients/profile/summary" element={<PatientSummaryPrintPage />} />
              <Route path="patients/profile/chart/print" element={<ChartPrintPage />} />
              <Route path="patients/profile/xray/print" element={<XrayPrintPage />} />

              <Route element={<AppLayout />}>
                <Route index element={<HomeRedirect />} />
                <Route path="patients" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<PatientsListPage />} />
                </Route>
                <Route path="patients/new" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<PatientRegisterPage />} />
                </Route>
                <Route path="patients/profile" element={<PatientProfilePage />} />
                <Route path="audit-log" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<AuditLogPage />} />
                </Route>
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<DashboardPage />} />
                </Route>
                <Route path="xrays" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<XrayInboxPage />} />
                </Route>
                <Route path="migration" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<MigrationPage />} />
                </Route>
                {/* Settings: dentist at patient (kanya-kanyang account) */}
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
