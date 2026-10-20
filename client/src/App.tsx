import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { ROLE_HOME } from './auth/roles';
import { Layout } from './components/Layout';
import { PageSpinner } from './components/ui/PageSpinner';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BookAppointmentPage } from './pages/patient/booking/BookAppointmentPage';
import { MyAppointmentsPage } from './pages/patient/MyAppointmentsPage';
import { ReceptionPage } from './pages/reception/ReceptionPage';
import { RoleHome } from './pages/RoleHome';

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
                <Route
                  path="/doctor"
                  element={
                    <RoleHome
                      title="Lịch trực của tôi"
                      upcoming={[
                        'Các ca trực sắp tới',
                        'Hàng đợi bệnh nhân với nút “Gọi bệnh nhân tiếp theo”',
                        'Hoàn thành / vắng mặt / ghi chú',
                      ]}
                    />
                  }
                />
              </Route>
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route
                  path="/admin"
                  element={
                    <RoleHome
                      title="Quản trị"
                      upcoming={[
                        'Chuyên khoa, phòng khám, bác sĩ, lễ tân',
                        'Giờ của các ca khám',
                        'Lịch trực theo tuần',
                      ]}
                    />
                  }
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
