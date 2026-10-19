import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ROLE_HOME } from '../auth/roles';
import { ROLE_LABEL } from '../i18n/labels';
import type { Role } from '../types';
import { Logo } from './Logo';

// Each phase adds its pages here.
const NAV_ITEMS: Record<Role, { to: string; label: string }[]> = {
  PATIENT: [
    { to: ROLE_HOME.PATIENT, label: 'Lịch hẹn của tôi' },
    { to: '/patient/book', label: 'Đặt lịch khám' },
  ],
  RECEPTIONIST: [{ to: ROLE_HOME.RECEPTIONIST, label: 'Hôm nay' }],
  DOCTOR: [{ to: ROLE_HOME.DOCTOR, label: 'Lịch trực' }],
  ADMIN: [{ to: ROLE_HOME.ADMIN, label: 'Tổng quan' }],
};

/** App shell for logged-in pages. Rendered inside <ProtectedRoute>, so user is set. */
export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            {NAV_ITEMS[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-700 sm:inline">{user.fullName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {ROLE_LABEL[user.role]}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
