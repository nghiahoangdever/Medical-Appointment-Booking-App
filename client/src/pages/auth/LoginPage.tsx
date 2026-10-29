import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../auth/roles';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/FormField';
import { errorMessage, fieldErrorMessages, translateError } from '../../i18n/errors';
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
  const { user, login, sessionEndedReason } = useAuth();
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
          <Link to="/register" className="font-medium">
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Why the previous session ended (expired / deactivated), until the next attempt. */}
        {sessionEndedReason && !error && (
          <Alert tone="info">{translateError(sessionEndedReason)}</Alert>
        )}
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
        <Button type="submit" loading={submitting} block>
          Đăng nhập
        </Button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6 rounded-lg bg-slate-25 p-3 text-xs text-slate-500 ring-1 ring-slate-100">
          <p className="mb-2 font-medium">Tài khoản dùng thử (mật khẩu: password123)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map(([role, email]) => (
              <li key={email}>
                <button
                  type="button"
                  className="rounded text-left hover:text-brand-700"
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
