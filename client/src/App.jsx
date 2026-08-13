import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import PatientsListPage from './pages/PatientsListPage'
import PatientRegisterPage from './pages/PatientRegisterPage'
import PatientProfilePage from './pages/PatientProfilePage'
import PatientSummaryPrintPage from './pages/PatientSummaryPrintPage'
import ChartPrintPage from './pages/ChartPrintPage'
import XrayPrintPage from './pages/XrayPrintPage'
import AuditLogPage from './pages/AuditLogPage'
import DashboardPage from './pages/DashboardPage'
import ProtectedRoute from './components/common/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

// Yung dentist, dashboard muna ang una niyang makikita — buong clinic view
// kasi 'yan. Pero yung patient, sarili lang niyang record meron, kaya diretso
// na lang siya doon agad instead na dalhin sa list/dashboard na wala naman
// siyang access.
function HomeRedirect() {
  const { user } = useAuth()
  if (user.role === 'patient') {
    return <Navigate to={`/patients/${user.patientId}`} replace />
  }
  return <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              {/* Standalone 'to, walang sidebar — para malinis tignan pag pinrint */}
              <Route path="patients/:id/summary" element={<PatientSummaryPrintPage />} />
              <Route path="patients/:id/chart/print" element={<ChartPrintPage />} />
              <Route path="patients/:patientId/xrays/:xrayId/print" element={<XrayPrintPage />} />

              <Route element={<AppLayout />}>
                <Route index element={<HomeRedirect />} />
                <Route path="patients" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<PatientsListPage />} />
                </Route>
                <Route path="patients/new" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<PatientRegisterPage />} />
                </Route>
                <Route path="patients/:id" element={<PatientProfilePage />} />
                <Route path="audit-log" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<AuditLogPage />} />
                </Route>
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={['dentist']} />}>
                  <Route index element={<DashboardPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
