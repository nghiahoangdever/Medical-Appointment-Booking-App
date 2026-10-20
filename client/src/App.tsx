import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ROLE_HOME } from './auth/roles';
import { Layout } from './components/Layout';
import { PageSpinner } from './components/ui/PageSpinner';
import { AdminAppointmentsPage } from './pages/admin/AdminAppointmentsPage';
import { DoctorsPage } from './pages/admin/DoctorsPage';
import { ReceptionistsPage } from './pages/admin/ReceptionistsPage';
import { RoomsPage } from './pages/admin/RoomsPage';
import { RosterPage } from './pages/admin/roster/RosterPage';
import { ShiftsPage } from './pages/admin/ShiftsPage';
import { SpecialtiesPage } from './pages/admin/SpecialtiesPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DoctorQueuePage } from './pages/doctor/DoctorQueuePage';
import { DoctorSchedulePage } from './pages/doctor/DoctorSchedulePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BookAppointmentPage } from './pages/patient/booking/BookAppointmentPage';
import { MyAppointmentsPage } from './pages/patient/MyAppointmentsPage';
import { ReceptionPage } from './pages/reception/ReceptionPage';

/** "/" sends users to their role's home page, or to login. */
function HomeRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) return <PageSpinner />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route element={<ProtectedRoute roles={['PATIENT']} />}>
                <Route path="/patient" element={<MyAppointmentsPage />} />
                <Route path="/patient/book" element={<BookAppointmentPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['RECEPTIONIST']} />}>
                <Route path="/reception" element={<ReceptionPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
                <Route path="/doctor" element={<DoctorSchedulePage />} />
                <Route path="/doctor/queue/:rosterEntryId" element={<DoctorQueuePage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/admin" element={<Navigate to={ROLE_HOME.ADMIN} replace />} />
                <Route path="/admin/roster" element={<RosterPage />} />
                <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
                <Route path="/admin/specialties" element={<SpecialtiesPage />} />
                <Route path="/admin/rooms" element={<RoomsPage />} />
                <Route path="/admin/doctors" element={<DoctorsPage />} />
                <Route path="/admin/receptionists" element={<ReceptionistsPage />} />
                <Route path="/admin/shifts" element={<ShiftsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
