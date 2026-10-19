import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../auth/roles';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { errorMessage, fieldErrorMessages } from '../../i18n/errors';
import { ROLE_LABEL } from '../../i18n/labels';
import type { Role } from '../../types';
import { AuthCard } from './AuthCard';

// Seeded accounts (server/prisma/seed.ts); shown only in development.
const DEMO_ACCOUNTS: [Role, string][] = [
  ['PATIENT', 'patient1@example.com'],
  ['RECEPTIONIST', 'reception1@medischedule.local'],
  ['DOCTOR', 'doctor1@medischedule.local'],
  ['ADMIN', 'admin@medischedule.local'],
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const loggedIn = await login(identifier, password);
      navigate(from ?? ROLE_HOME[loggedIn.role], { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setFieldErrors(fieldErrorMessages(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Đăng nhập"
      footer={
        <>
          Bệnh nhân mới?{' '}
          <Link to="/register" className="font-medium text-teal-700 hover:underline">
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Email hoặc số điện thoại"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Đăng nhập
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <p className="mb-2 font-medium">Tài khoản dùng thử (mật khẩu: password123)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map(([role, email]) => (
              <li key={email}>
                <button
                  type="button"
                  className="text-left hover:text-teal-700"
                  onClick={() => {
                    setIdentifier(email);
                    setPassword('password123');
                  }}
                >
                  <span className="inline-block w-28 font-medium">{ROLE_LABEL[role]}</span>
                  {email}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AuthCard>
  );
}
